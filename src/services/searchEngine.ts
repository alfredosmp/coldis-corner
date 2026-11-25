import { db } from '../db/database';
import type {
  BookItem,
  Flashcard,
  GlossaryTerm,
  OutlineNode,
  StudyNote,
  Subject,
} from '../types/models';
import { normalizeText } from '../utils/text';

export type SearchContentKind =
  | 'books'
  | 'bookNotes'
  | 'studyNotes'
  | 'flashcards'
  | 'subjectNotes'
  | 'glossary';

export interface SearchFilters {
  subjectIds: string[];
  bookIds: string[];
  includePersonalShelf: boolean;
  kinds: SearchContentKind[];
}

export interface SearchSnippet {
  before: string;
  match: string;
  after: string;
}

export interface SearchHit {
  id: string;
  kind: SearchContentKind;
  title: string;
  subtitle: string;
  score: number;
  snippet: SearchSnippet;
  bookId?: string;
  location?: number;
  locationLabel?: string;
  subjectId?: string;
  glossaryTermId?: string;
  matchedQuery: string;
}

const STOPWORDS_ES = new Set([
  'de', 'la', 'el', 'en', 'y', 'a', 'los', 'las', 'del', 'se', 'por', 'un', 'una',
  'con', 'para', 'es', 'al', 'lo', 'como', 'su', 'o', 'u', 'que', 'si',
]);

export function tokenizeQuery(rawQuery: string): string[] {
  const normalized = normalizeText(rawQuery).replace(/[^\p{L}\p{N}\s]/gu, ' ');
  const tokens = normalized
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);

  const meaningful = tokens.filter((t) => !STOPWORDS_ES.has(t));
  return meaningful.length > 0 ? Array.from(new Set(meaningful)) : Array.from(new Set(tokens));
}

function flattenOutlineText(nodes: OutlineNode[]): string {
  const parts: string[] = [];
  const walk = (list: OutlineNode[]) => {
    for (const n of list) {
      if (n.text) parts.push(n.text);
      if (n.detail) parts.push(n.detail);
      if (n.children.length > 0) walk(n.children);
    }
  };
  walk(nodes);
  return parts.join(' · ');
}

function scoreNormalizedText(
  normalizedDoc: string,
  normalizedPhrase: string,
  tokens: string[]
): number {
  if (!normalizedDoc || tokens.length === 0) return 0;

  let matchedTokens = 0;
  let tfScore = 0;

  for (const token of tokens) {
    let idx = normalizedDoc.indexOf(token);
    if (idx === -1) continue;
    matchedTokens += 1;

    let count = 0;
    while (idx !== -1 && count < 12) {
      count += 1;
      idx = normalizedDoc.indexOf(token, idx + token.length);
    }
    tfScore += 1 + Math.log(count);
  }

  if (matchedTokens === 0) return 0;

  const coverageRatio = matchedTokens / tokens.length;
  const hasExactPhrase = normalizedPhrase.length >= 3 && normalizedDoc.includes(normalizedPhrase);
  if (!hasExactPhrase && tokens.length >= 2 && coverageRatio < 0.5) {
    return 0;
  }

  let score = tfScore * (0.6 + coverageRatio * 1.4);
  if (hasExactPhrase) {
    score += 4.5;
  }
  return score;
}

export function buildSnippet(originalText: string, rawQuery: string, tokens: string[]): SearchSnippet {
  const clean = originalText.replace(/\s+/g, ' ').trim();
  const normalizedClean = normalizeText(clean);
  const normalizedPhrase = normalizeText(rawQuery);

  let matchIndex = -1;
  let matchLength = 0;

  if (normalizedPhrase.length >= 2) {
    const idx = normalizedClean.indexOf(normalizedPhrase);
    if (idx !== -1) {
      matchIndex = idx;
      matchLength = normalizedPhrase.length;
    }
  }

  if (matchIndex === -1) {
    for (const token of tokens) {
      const idx = normalizedClean.indexOf(token);
      if (idx !== -1) {
        matchIndex = idx;
        matchLength = token.length;
        break;
      }
    }
  }

  if (matchIndex === -1) {
    return {
      before: clean.slice(0, 170) + (clean.length > 170 ? '…' : ''),
      match: '',
      after: '',
    };
  }

  const radius = 85;
  const start = Math.max(0, matchIndex - radius);
  const end = Math.min(clean.length, matchIndex + matchLength + radius);

  const prefix = start > 0 ? '…' : '';
  const suffix = end < clean.length ? '…' : '';

  return {
    before: prefix + clean.slice(start, matchIndex),
    match: clean.slice(matchIndex, Math.min(clean.length, matchIndex + matchLength)),
    after: clean.slice(Math.min(clean.length, matchIndex + matchLength), end) + suffix,
  };
}

export async function runOfflineGlobalSearch(
  rawQuery: string,
  filters: SearchFilters,
  books: BookItem[],
  subjects: Subject[],
  glossary: GlossaryTerm[],
  studyNotes: StudyNote[] = [],
  flashcards: Flashcard[] = []
): Promise<SearchHit[]> {
  const trimmed = rawQuery.trim();
  if (trimmed.length < 2) return [];

  const normalizedPhrase = normalizeText(trimmed);
  const tokens = tokenizeQuery(trimmed);
  if (tokens.length === 0) return [];

  const subjectMap = new Map(subjects.map((s) => [s.id, s]));
  const hasSubjectFilter = filters.subjectIds.length > 0;
  const hasBookFilter = filters.bookIds.length > 0;

  const eligibleBooks = books.filter((book) => {
    if (hasBookFilter && !filters.bookIds.includes(book.id)) return false;

    if (hasSubjectFilter) {
      const matchesSelectedSubject = Boolean(
        book.subjectId && filters.subjectIds.includes(book.subjectId)
      );
      const matchesPersonal = filters.includePersonalShelf && book.shelf === 'personal';
      if (!matchesSelectedSubject && !matchesPersonal) return false;
    } else if (!filters.includePersonalShelf && book.shelf === 'personal') {
      return false;
    }

    return true;
  });

  const eligibleBookMap = new Map(eligibleBooks.map((b) => [b.id, b]));
  const hits: SearchHit[] = [];

  // 1. Indexed Book Chunks
  if (filters.kinds.includes('books') && eligibleBooks.length > 0) {
    const bookIds = eligibleBooks.map((b) => b.id);
    const chunks = await db.bookChunks.where('bookId').anyOf(bookIds).toArray();

    const perBookCount = new Map<string, number>();
    const candidateChunkHits: SearchHit[] = [];

    for (const chunk of chunks) {
      const score = scoreNormalizedText(chunk.normalizedText, normalizedPhrase, tokens);
      if (score <= 0) continue;

      const book = eligibleBookMap.get(chunk.bookId);
      if (!book) continue;

      const subj = book.subjectId ? subjectMap.get(book.subjectId) : undefined;
      candidateChunkHits.push({
        id: `chunk_${chunk.id}`,
        kind: 'books',
        title: book.title,
        subtitle: `${chunk.locationLabel}${subj ? ` · ${subj.name}` : book.shelf === 'personal' ? ' · Lectura Personal' : ''}`,
        score,
        snippet: buildSnippet(chunk.text, trimmed, tokens),
        bookId: book.id,
        location: chunk.location,
        locationLabel: chunk.locationLabel,
        subjectId: book.subjectId,
        matchedQuery: trimmed,
      });
    }

    candidateChunkHits.sort((a, b) => b.score - a.score);
    for (const hit of candidateChunkHits) {
      const bId = hit.bookId ?? '';
      const count = perBookCount.get(bId) ?? 0;
      const maxPerBook = hasBookFilter && filters.bookIds.length <= 2 ? 18 : 5;
      if (count >= maxPerBook) continue;
      perBookCount.set(bId, count + 1);
      hits.push(hit);
    }
  }

  // 2. Book Reading Notes
  if (filters.kinds.includes('bookNotes') && eligibleBooks.length > 0) {
    for (const book of eligibleBooks) {
      if (!book.readingNotes?.trim()) continue;
      const score = scoreNormalizedText(
        normalizeText(`${book.title} ${book.readingNotes}`),
        normalizedPhrase,
        tokens
      );
      if (score <= 0) continue;

      const subj = book.subjectId ? subjectMap.get(book.subjectId) : undefined;
      hits.push({
        id: `bnote_${book.id}`,
        kind: 'bookNotes',
        title: `Apuntes de "${book.title}"`,
        subtitle: subj ? subj.name : book.shelf === 'personal' ? 'Lectura Personal' : 'Biblioteca',
        score: score + 0.6,
        snippet: buildSnippet(book.readingNotes, trimmed, tokens),
        bookId: book.id,
        location: book.currentLocation || 1,
        subjectId: book.subjectId,
        matchedQuery: trimmed,
      });
    }
  }

  // 3. Resúmenes y Esquemas
  if (filters.kinds.includes('studyNotes') && !hasBookFilter) {
    const eligibleNotes = hasSubjectFilter
      ? studyNotes.filter((n) => n.subjectId && filters.subjectIds.includes(n.subjectId))
      : studyNotes;

    for (const note of eligibleNotes) {
      const body =
        note.kind === 'outline' ? flattenOutlineText(note.outlineNodes) : note.content;
      const score = scoreNormalizedText(
        normalizeText(`${note.title} ${body}`),
        normalizedPhrase,
        tokens
      );
      if (score <= 0) continue;

      const subj = note.subjectId ? subjectMap.get(note.subjectId) : undefined;
      const kindLabel =
        note.kind === 'note' ? 'Apunte' : note.kind === 'summary' ? 'Resumen' : 'Esquema';
      hits.push({
        id: `stnote_${note.id}`,
        kind: 'studyNotes',
        title: note.title,
        subtitle: `${kindLabel}${subj ? ` · ${subj.name}` : ''}`,
        score: score + 0.8,
        snippet: buildSnippet(body || note.title, trimmed, tokens),
        subjectId: note.subjectId,
        matchedQuery: trimmed,
      });
    }
  }

  // 4. Flashcards
  if (filters.kinds.includes('flashcards') && !hasBookFilter) {
    const eligibleCards = hasSubjectFilter
      ? flashcards.filter((c) => c.subjectId && filters.subjectIds.includes(c.subjectId))
      : flashcards;

    for (const card of eligibleCards) {
      const full = [card.front, card.back, card.legalRef].filter(Boolean).join(' — ');
      const score = scoreNormalizedText(normalizeText(full), normalizedPhrase, tokens);
      if (score <= 0) continue;

      const subj = card.subjectId ? subjectMap.get(card.subjectId) : undefined;
      hits.push({
        id: `fc_${card.id}`,
        kind: 'flashcards',
        title: card.front.replace(/\{\{|\}\}/g, '').slice(0, 80),
        subtitle: `Flashcard · ${card.deckName}${subj ? ` · ${subj.name}` : ''}`,
        score: score + 0.7,
        snippet: buildSnippet(full.replace(/\{\{|\}\}/g, ''), trimmed, tokens),
        subjectId: card.subjectId,
        matchedQuery: trimmed,
      });
    }
  }

  // 5. Subject Quick Notes
  if (filters.kinds.includes('subjectNotes') && !hasBookFilter) {
    const eligibleSubjects = hasSubjectFilter
      ? subjects.filter((s) => filters.subjectIds.includes(s.id))
      : subjects;

    for (const subj of eligibleSubjects) {
      if (!subj.quickNotes?.trim() && !subj.description?.trim()) continue;
      const sourceText = [subj.quickNotes, subj.description].filter(Boolean).join(' · ');
      const score = scoreNormalizedText(
        normalizeText(`${subj.name} ${sourceText}`),
        normalizedPhrase,
        tokens
      );
      if (score <= 0) continue;

      hits.push({
        id: `snote_${subj.id}`,
        kind: 'subjectNotes',
        title: `Bloc de ${subj.name}`,
        subtitle: subj.semester,
        score: score + 0.5,
        snippet: buildSnippet(sourceText, trimmed, tokens),
        subjectId: subj.id,
        matchedQuery: trimmed,
      });
    }
  }

  // 6. Mexican Legal Glossary
  if (filters.kinds.includes('glossary') && !hasBookFilter && !hasSubjectFilter) {
    for (const term of glossary) {
      const fullText = [term.term, term.definition, term.example, term.legalBasis]
        .filter(Boolean)
        .join(' — ');
      const titleScore = scoreNormalizedText(normalizeText(term.term), normalizedPhrase, tokens);
      const bodyScore = scoreNormalizedText(normalizeText(fullText), normalizedPhrase, tokens);
      const score = titleScore * 1.8 + bodyScore;
      if (score <= 0) continue;

      hits.push({
        id: `gloss_${term.id}`,
        kind: 'glossary',
        title: term.term,
        subtitle: `Glosario · ${term.branch}`,
        score,
        snippet: buildSnippet(
          `${term.definition}${term.legalBasis ? ` (${term.legalBasis})` : ''}`,
          trimmed,
          tokens
        ),
        glossaryTermId: term.id,
        matchedQuery: trimmed,
      });
    }
  }

  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, 60);
}
