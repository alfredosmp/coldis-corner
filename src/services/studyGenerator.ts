import { db } from '../db/database';
import type { BookItem, FlashcardMode, GlossaryTerm, OutlineNode } from '../types/models';
import { createId, normalizeText } from '../utils/text';
import { buildSnippet, type SearchSnippet } from './searchEngine';

const STOPWORDS_ES = new Set([
  'de', 'la', 'el', 'en', 'y', 'a', 'los', 'las', 'del', 'se', 'por', 'un', 'una', 'unos', 'unas',
  'con', 'para', 'es', 'al', 'lo', 'como', 'su', 'sus', 'o', 'u', 'que', 'si', 'no', 'son', 'fue',
  'ser', 'esta', 'este', 'estos', 'estas', 'mas', 'pero', 'cuando', 'donde', 'quien', 'cual',
  'sobre', 'entre', 'tambien', 'puede', 'pueden', 'tiene', 'tienen', 'hace', 'hacer', 'muy',
  'todo', 'toda', 'todos', 'todas', 'porque', 'desde', 'hasta', 'ante', 'bajo', 'sin', 'mediante',
  'solo', 'cada', 'otro', 'otra', 'otros', 'otras', 'mismo', 'misma', 'asi', 'bien', 'ya',
  'entonces', 'aqui', 'ahi', 'ese', 'esa', 'eso', 'esto', 'aquel', 'aquella',
]);

export interface LiveBookSuggestion {
  id: string;
  bookId: string;
  bookTitle: string;
  location: number;
  locationLabel: string;
  matchedTerms: string[];
  snippet: SearchSnippet;
  score: number;
}

export interface GeneratedFlashcardDraft {
  id: string;
  selected: boolean;
  mode: FlashcardMode;
  front: string;
  back: string;
  legalRef?: string;
  sourceHint: string;
}

export interface GeneratedSummaryDraft {
  title: string;
  html: string;
  plainText: string;
  bulletCount: number;
}

export interface GeneratedOutlineDraft {
  title: string;
  nodes: OutlineNode[];
  nodeCount: number;
}

/**
 * Extracts the immediate 1-3 meaningful keywords right at the user's cursor
 * so writing longer notes never dilutes live book suggestions.
 */
export function extractCursorKeywords(cursorContext: string, maxKeywords = 3): string[] {
  const cleaned = cursorContext.replace(/\s+/g, ' ').trim();
  if (cleaned.length < 3) return [];

  // Only inspect the immediate phrase right around the cursor (~90 chars)
  const localSlice = cleaned.slice(-90);
  const words = normalizeText(localSlice)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS_ES.has(w));

  // Most recent word at the cursor is index 0 (highest priority!)
  const uniqueRecent: string[] = [];
  for (let i = words.length - 1; i >= 0; i--) {
    const w = words[i];
    if (!uniqueRecent.includes(w)) {
      uniqueRecent.push(w);
    }
    if (uniqueRecent.length >= maxKeywords) break;
  }

  return uniqueRecent;
}

/**
 * Cursor-focused live book companion: finds matching pages inside books of the selected Materia
 * strictly for the exact word/concept currently at Mafecita's cursor.
 */
export async function findLiveBookSuggestions(
  cursorContext: string,
  books: BookItem[],
  subjectId?: string,
  preferredBookId?: string
): Promise<{
  keywords: string[];
  suggestions: LiveBookSuggestion[];
}> {
  const keywords = extractCursorKeywords(cursorContext, 3);
  if (keywords.length === 0) return { keywords: [], suggestions: [] };

  const primaryWord = keywords[0];

  // Prioritize books of the chosen subject; fall back to all books if none linked yet
  let targetBooks = subjectId
    ? books.filter((b) => b.subjectId === subjectId)
    : books.filter((b) => b.shelf === 'law');

  if (preferredBookId && !targetBooks.some((b) => b.id === preferredBookId)) {
    const preferred = books.find((b) => b.id === preferredBookId);
    if (preferred) targetBooks = [preferred, ...targetBooks];
  }

  if (targetBooks.length === 0) {
    targetBooks = books;
  }

  if (targetBooks.length === 0) {
    return { keywords, suggestions: [] };
  }

  const bookMap = new Map(targetBooks.map((b) => [b.id, b]));
  const chunks = await db.bookChunks
    .where('bookId')
    .anyOf(targetBooks.map((b) => b.id))
    .toArray();

  const rawHits: LiveBookSuggestion[] = [];

  for (const chunk of chunks) {
    // Primary match MUST contain the exact word at the cursor for razor-sharp relevance!
    const hasPrimary = chunk.normalizedText.includes(primaryWord);
    if (!hasPrimary) continue;

    const matched: string[] = [primaryWord];
    let score = 4.0;

    // Bonus if neighboring cursor words (e.g. "derecho" + "familia") also appear in the same page
    for (let i = 1; i < keywords.length; i++) {
      const kw = keywords[i];
      if (chunk.normalizedText.includes(kw)) {
        matched.push(kw);
        score += 2.2 - i * 0.4;
      }
    }

    // Bonus for phrase proximity (e.g. "derecho familiar" / "amparo indirecto")
    if (keywords.length >= 2) {
      const pairForward = `${keywords[1]} ${primaryWord}`;
      const pairReverse = `${primaryWord} ${keywords[1]}`;
      if (
        chunk.normalizedText.includes(pairForward) ||
        chunk.normalizedText.includes(pairReverse)
      ) {
        score += 3.0;
      }
    }

    const book = bookMap.get(chunk.bookId);
    if (!book) continue;
    if (preferredBookId && book.id === preferredBookId) {
      score += 0.8;
    }

    rawHits.push({
      id: `live_${chunk.id}`,
      bookId: book.id,
      bookTitle: book.title,
      location: chunk.location,
      locationLabel: chunk.locationLabel,
      matchedTerms: matched,
      snippet: buildSnippet(chunk.text, primaryWord, matched),
      score,
    });
  }

  rawHits.sort((a, b) => b.score - a.score);

  // Deduplicate so we show diverse pages across her books (max 2 per book, top 5 total)
  const perBook = new Map<string, number>();
  const finalHits: LiveBookSuggestion[] = [];
  for (const hit of rawHits) {
    const count = perBook.get(hit.bookId) ?? 0;
    if (count >= 2) continue;
    perBook.set(hit.bookId, count + 1);
    finalHits.push(hit);
    if (finalHits.length >= 5) break;
  }

  return { keywords: [primaryWord, ...keywords.slice(1)], suggestions: finalHits };
}

/**
 * Finds related Mexican Law Glossary terms matching what she's currently typing.
 */
export function findLiveGlossaryMatches(
  keywords: string[],
  glossary: GlossaryTerm[]
): GlossaryTerm[] {
  if (keywords.length === 0) return [];
  const scored: { term: GlossaryTerm; score: number }[] = [];

  for (const item of glossary) {
    const normTerm = normalizeText(item.term);
    let score = 0;
    for (const kw of keywords) {
      if (normTerm.includes(kw)) score += 3;
    }
    if (score > 0) scored.push({ term: item, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 3).map((s) => s.term);
}

function extractLegalRefFromText(text: string): string | undefined {
  const match = text.match(
    /(?:art(?:ículo|iculo|\.)?\s*\d+[a-zA-Z0-9\s,\-°]*(?:CPEUM|CCF|CNPP|CPF|LFT|LGTOC|Ley\s+de\s+Amparo)?)/i
  );
  return match ? match[0].trim().slice(0, 55) : undefined;
}

/**
 * 100% Offline Smart Flashcard Generator from rich-text notes (zero AI tokens!).
 * Detects:
 * 1. Highlighted (<mark>) & bolded (<strong>/<b>) key phrases -> Cloze ("Ocultar palabras") cards
 * 2. Definitions ("Concepto: explicación", "X es ...") -> Basic Q&A cards
 * 3. Legal articles / numbers / plazos ("15 días", "Art. 14") -> Cloze cards
 * 4. Headings + bullet lists -> Basic Q&A cards
 */
export function extractFlashcardsFromNote(
  noteTitle: string,
  htmlContent: string,
  plainText: string
): GeneratedFlashcardDraft[] {
  const drafts: GeneratedFlashcardDraft[] = [];
  const seenFronts = new Set<string>();

  const addDraft = (draft: Omit<GeneratedFlashcardDraft, 'id' | 'selected'>) => {
    const key = normalizeText(draft.front).slice(0, 90);
    if (!key || seenFronts.has(key)) return;
    seenFronts.add(key);
    drafts.push({
      ...draft,
      id: `draft_${drafts.length}_${Date.now()}`,
      selected: true,
    });
  };

  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent || `<p>${plainText}</p>`, 'text/html');

  // 1. Scan paragraphs/blocks with highlighted <mark> or <strong>/<b> spans -> Cloze cards!
  const blocks = Array.from(doc.body.querySelectorAll('p, div, li, blockquote'));
  for (const block of blocks) {
    // Skip container divs that wrap other blocks
    if (block.tagName === 'DIV' && block.querySelector('p, div, ul, ol')) continue;
    const text = (block.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (text.length < 22 || text.length > 360) continue;

    const emphasized = Array.from(
      block.querySelectorAll('mark, strong, b, span[style*="background"]')
    )
      .map((el) => (el.textContent ?? '').trim())
      .filter((t) => t.length >= 3 && t.length <= 70 && t.length < text.length * 0.72);

    if (emphasized.length > 0) {
      let clozeSentence = text;
      let replacedCount = 0;
      for (const phrase of Array.from(new Set(emphasized)).slice(0, 3)) {
        const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`(?<!\\{\\{)${escaped}(?!\\}\\})`);
        if (re.test(clozeSentence)) {
          clozeSentence = clozeSentence.replace(re, `{{${phrase}}}`);
          replacedCount += 1;
        }
      }
      if (replacedCount > 0) {
        addDraft({
          mode: 'cloze',
          front: clozeSentence,
          back: `Tomado de "${noteTitle}"`,
          legalRef: extractLegalRefFromText(text),
          sourceHint: 'Texto resaltado / negrita',
        });
      }
    }
  }

  // 2. Scan Headings followed by <ul>/<ol> -> Basic enumeration flashcards!
  const topNodes = Array.from(doc.body.children);
  for (let i = 0; i < topNodes.length - 1; i++) {
    const cur = topNodes[i];
    const next = topNodes[i + 1];
    const isHeading = /^H[1-4]$/.test(cur.tagName);
    const isList = next.tagName === 'UL' || next.tagName === 'OL';
    if (isHeading && isList) {
      const headingText = (cur.textContent ?? '').trim();
      const items = Array.from(next.querySelectorAll('li'))
        .map((li) => (li.textContent ?? '').trim())
        .filter(Boolean);
      if (headingText.length >= 4 && items.length >= 2) {
        addDraft({
          mode: 'basic',
          front: `¿Cuáles son los puntos clave de "${headingText}"?`,
          back: items.map((it) => `• ${it}`).join('\n'),
          legalRef: extractLegalRefFromText(`${headingText} ${items.join(' ')}`),
          sourceHint: 'Título + lista',
        });
      }
    }
  }

  // 3. Scan plain lines for definitions ("Concepto: explicación" or "X consiste en ...") and legal deadlines
  const rawLines = plainText
    .split(/\n+/)
    .map((l) => l.replace(/^[•\-*]\s*/, '').trim())
    .filter((l) => l.length >= 20);

  for (const line of rawLines) {
    // Pattern A: "Término: definición"
    const colonIdx = line.indexOf(':');
    if (colonIdx >= 4 && colonIdx <= 65) {
      const left = line.slice(0, colonIdx).replace(/^[§⚖★\s]+/, '').trim();
      const right = line.slice(colonIdx + 1).trim();
      if (left.length >= 3 && right.length >= 16) {
        addDraft({
          mode: 'basic',
          front: left.endsWith('?') ? left : `¿Qué es / en qué consiste: ${left}?`,
          back: right,
          legalRef: extractLegalRefFromText(line),
          sourceHint: 'Definición detectada',
        });
        continue;
      }
    }

    // Pattern B: Legal deadlines / time spans (e.g. "15 días", "30 días hábiles", "5 años") -> Cloze!
    const deadlineRegex = /(\b\d+\s+(?:d[ií]as(?:\s+h[aá]biles|\s+naturales)?|meses|a[ñn]os|horas)\b)/i;
    if (deadlineRegex.test(line) && line.length <= 280) {
      const cloze = line.replace(deadlineRegex, '{{$1}}');
      addDraft({
        mode: 'cloze',
        front: cloze,
        back: `Plazo / término en "${noteTitle}"`,
        legalRef: extractLegalRefFromText(line),
        sourceHint: 'Plazo legal detectado',
      });
    }
  }

  return drafts.slice(0, 20);
}

/**
 * 100% Offline Extractive Summary Generator from class notes (zero AI tokens!).
 * Combines headings, highlighted/bolded points, legal callouts (§, ⚖, ★),
 * and top TF-IDF-scored sentences into a clean condensed study sheet.
 */
export function generateOfflineSummary(
  noteTitle: string,
  htmlContent: string,
  plainText: string
): GeneratedSummaryDraft {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent || `<p>${plainText}</p>`, 'text/html');

  const keyPoints: string[] = [];
  const articles: string[] = [];
  const seen = new Set<string>();

  const pushUnique = (target: string[], text: string) => {
    const clean = text.replace(/\s+/g, ' ').trim();
    const key = normalizeText(clean).slice(0, 80);
    if (clean.length < 10 || seen.has(key)) return;
    seen.add(key);
    target.push(clean);
  };

  // 1. Collect explicit legal callouts & highlighted/bolded blocks
  const blocks = Array.from(doc.body.querySelectorAll('p, li, blockquote, h1, h2, h3, div'));
  for (const el of blocks) {
    if (el.tagName === 'DIV' && el.querySelector('p, div, ul, ol')) continue;
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (!text) continue;

    if (text.startsWith('§') || /\bart(?:ículo|iculo|\.)?\s*\d+/i.test(text)) {
      pushUnique(articles, text);
    } else if (
      text.startsWith('★') ||
      text.startsWith('⚖') ||
      el.querySelector('mark, strong, b, span[style*="background"]')
    ) {
      pushUnique(keyPoints, text);
    }
  }

  // 2. Classic TF-IDF extractive sentence scoring on remaining plain text
  const sentences = plainText
    .replace(/\n+/g, '. ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 28 && s.length <= 320);

  const wordFreq = new Map<string, number>();
  for (const s of sentences) {
    const words = normalizeText(s)
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !STOPWORDS_ES.has(w));
    for (const w of words) {
      wordFreq.set(w, (wordFreq.get(w) ?? 0) + 1);
    }
  }

  const scoredSentences = sentences.map((sentence, idx) => {
    const words = normalizeText(sentence)
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !STOPWORDS_ES.has(w));
    const uniqueWords = Array.from(new Set(words));
    let score = uniqueWords.reduce((sum, w) => sum + (wordFreq.get(w) ?? 0), 0);
    score = score / Math.max(4, Math.sqrt(words.length));
    // Slight boost for definitions and early topic sentences
    if (sentence.includes(':') || /\b(consiste|significa|define|requisitos|plazo)\b/i.test(sentence)) {
      score *= 1.35;
    }
    if (idx < 2) score *= 1.15;
    return { sentence, score };
  });

  scoredSentences.sort((a, b) => b.score - a.score);
  for (const item of scoredSentences.slice(0, 6)) {
    if (keyPoints.length >= 10) break;
    pushUnique(keyPoints, item.sentence);
  }

  // Build clean HTML & plain summary
  const htmlParts: string[] = [`<h2>Resumen: ${noteTitle}</h2>`];
  const plainParts: string[] = [`Resumen: ${noteTitle}`, ''];

  if (keyPoints.length > 0) {
    htmlParts.push('<h3>Ideas principales</h3><ul>');
    plainParts.push('Ideas principales:');
    for (const pt of keyPoints) {
      htmlParts.push(`<li>${pt}</li>`);
      plainParts.push(`• ${pt}`);
    }
    htmlParts.push('</ul>');
    plainParts.push('');
  }

  if (articles.length > 0) {
    htmlParts.push('<h3>Artículos y fundamentos citados</h3>');
    plainParts.push('Artículos y fundamentos citados:');
    for (const art of articles.slice(0, 8)) {
      htmlParts.push(
        `<blockquote class="legal-callout-article">${art}</blockquote>`
      );
      plainParts.push(`§ ${art.replace(/^§\s*/, '')}`);
    }
  }

  return {
    title: `Resumen · ${noteTitle}`,
    html: htmlParts.join('\n'),
    plainText: plainParts.join('\n').trim(),
    bulletCount: keyPoints.length + articles.length,
  };
}

/**
 * Generates an editable visual outline tree (OutlineNode[]) directly from a class note's
 * headings, lists, definitions ("Concepto: explicación"), highlights, and callouts.
 */
export function generateOfflineOutlineFromNote(
  noteTitle: string,
  htmlContent: string,
  plainText: string
): GeneratedOutlineDraft {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent || `<p>${plainText}</p>`, 'text/html');

  const rootChildren: OutlineNode[] = [];
  let currentBranch: OutlineNode | null = null;
  let totalNodes = 0;

  const ensureBranch = (fallbackTitle: string): OutlineNode => {
    if (!currentBranch) {
      currentBranch = {
        id: createId('node'),
        text: fallbackTitle,
        detail: '',
        children: [],
      };
      rootChildren.push(currentBranch);
      totalNodes += 1;
    }
    return currentBranch;
  };

  const elements = Array.from(doc.body.children);
  for (const el of elements) {
    const tag = el.tagName;
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (!text) continue;

    if (/^H[1-3]$/.test(tag)) {
      currentBranch = {
        id: createId('node'),
        text: text.slice(0, 120),
        detail: '',
        children: [],
      };
      rootChildren.push(currentBranch);
      totalNodes += 1;
      continue;
    }

    if (tag === 'UL' || tag === 'OL') {
      const target = ensureBranch('Puntos clave');
      const items = Array.from(el.querySelectorAll('li'))
        .map((li) => (li.textContent ?? '').replace(/\s+/g, ' ').trim())
        .filter(Boolean);
      for (const item of items.slice(0, 12)) {
        const colon = item.indexOf(':');
        if (colon >= 3 && colon <= 55) {
          target.children.push({
            id: createId('node'),
            text: item.slice(0, colon).trim(),
            detail: item.slice(colon + 1).trim(),
            children: [],
          });
        } else {
          target.children.push({
            id: createId('node'),
            text: item.slice(0, 130),
            detail: item.length > 130 ? item.slice(130) : '',
            children: [],
          });
        }
        totalNodes += 1;
      }
      continue;
    }

    if (tag === 'BLOCKQUOTE') {
      const target = ensureBranch('Fundamentos y destacados');
      const colon = text.indexOf(':');
      target.children.push({
        id: createId('node'),
        text: colon >= 3 && colon <= 45 ? text.slice(0, colon).trim() : 'Nota destacada',
        detail: colon >= 3 && colon <= 45 ? text.slice(colon + 1).trim() : text,
        children: [],
      });
      totalNodes += 1;
      continue;
    }

    // Paragraph / div: detect "Concepto: definición" or bold lead-in or regular key sentence
    const colonIdx = text.indexOf(':');
    if (colonIdx >= 3 && colonIdx <= 60) {
      const left = text.slice(0, colonIdx).trim();
      const right = text.slice(colonIdx + 1).trim();
      const node: OutlineNode = {
        id: createId('node'),
        text: left,
        detail: right,
        children: [],
      };
      if (currentBranch && rootChildren.length > 0 && currentBranch.children.length < 10) {
        currentBranch.children.push(node);
      } else {
        rootChildren.push(node);
        currentBranch = node;
      }
      totalNodes += 1;
    } else {
      const strongEl = el.querySelector('strong, b, mark');
      const strongText = (strongEl?.textContent ?? '').trim();
      if (strongText.length >= 3 && strongText.length <= 70 && strongText.length < text.length) {
        const target = ensureBranch('Ideas principales');
        target.children.push({
          id: createId('node'),
          text: strongText,
          detail: text,
          children: [],
        });
        totalNodes += 1;
      } else if (text.length >= 12) {
        const target = ensureBranch('Desarrollo del tema');
        if (target.children.length < 10) {
          target.children.push({
            id: createId('node'),
            text: text.slice(0, 95) + (text.length > 95 ? '…' : ''),
            detail: text.length > 95 ? text : '',
            children: [],
          });
          totalNodes += 1;
        }
      }
    }
  }

  // Fallback if note only had raw plain text lines
  if (rootChildren.length === 0 && plainText.trim().length > 0) {
    const lines = plainText
      .split(/\n+/)
      .map((l) => l.trim())
      .filter((l) => l.length >= 4);
    for (const line of lines.slice(0, 12)) {
      const colon = line.indexOf(':');
      rootChildren.push({
        id: createId('node'),
        text: colon >= 3 && colon <= 55 ? line.slice(0, colon).trim() : line.slice(0, 100),
        detail: colon >= 3 && colon <= 55 ? line.slice(colon + 1).trim() : '',
        children: [],
      });
      totalNodes += 1;
    }
  }

  const nodes: OutlineNode[] =
    rootChildren.length > 0
      ? [
          {
            id: createId('node'),
            text: noteTitle,
            detail: 'Esquema generado a partir de tu apunte',
            children: rootChildren,
          },
        ]
      : [];

  return {
    title: `Esquema · ${noteTitle}`,
    nodes,
    nodeCount: totalNodes,
  };
}
