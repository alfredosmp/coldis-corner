import Dexie, { type Table } from 'dexie';
import type {
  AppSettings,
  BookFileBlob,
  BookHighlight,
  BookItem,
  BookTextChunk,
  CalendarEvent,
  Flashcard,
  GlossaryTerm,
  PomodoroSession,
  StudyNote,
  Subject,
} from '../types/models';
import { buildSeedGlossary } from '../data/mexicanGlossary';
import { normalizeText } from '../utils/text';

export class ColdiEstudioDB extends Dexie {
  settings!: Table<AppSettings, 'main'>;
  subjects!: Table<Subject, string>;
  glossary!: Table<GlossaryTerm, string>;
  calendarEvents!: Table<CalendarEvent, string>;
  books!: Table<BookItem, string>;
  bookFiles!: Table<BookFileBlob, string>;
  bookChunks!: Table<BookTextChunk, string>;
  bookHighlights!: Table<BookHighlight, string>;
  studyNotes!: Table<StudyNote, string>;
  flashcards!: Table<Flashcard, string>;
  pomodoroSessions!: Table<PomodoroSession, string>;

  constructor() {
    super('ColdiEstudioDB');
    this.version(1).stores({
      settings: 'id',
      subjects: 'id, archived, semester, name, updatedAt',
      glossary: 'id, term, branch, isFavorite, isBuiltIn, updatedAt',
    });
    this.version(2).stores({
      settings: 'id',
      subjects: 'id, archived, semester, name, updatedAt',
      glossary: 'id, term, branch, isFavorite, isBuiltIn, updatedAt',
      calendarEvents: 'id, date, type, subjectId, completed, updatedAt',
    });
    this.version(3).stores({
      settings: 'id',
      subjects: 'id, archived, semester, name, updatedAt',
      glossary: 'id, term, branch, isFavorite, isBuiltIn, updatedAt',
      calendarEvents: 'id, date, type, subjectId, completed, updatedAt',
      books: 'id, shelf, format, subjectId, isFavorite, lastOpenedAt, updatedAt',
      bookFiles: 'bookId',
      bookChunks: 'id, bookId, location',
    });
    this.version(4).stores({
      settings: 'id',
      subjects: 'id, archived, semester, name, updatedAt',
      glossary: 'id, term, branch, isFavorite, isBuiltIn, updatedAt',
      calendarEvents: 'id, date, type, subjectId, completed, updatedAt',
      books: 'id, shelf, format, subjectId, isFavorite, lastOpenedAt, updatedAt',
      bookFiles: 'bookId',
      bookChunks: 'id, bookId, location',
      studyNotes: 'id, kind, subjectId, isFavorite, updatedAt',
      flashcards: 'id, subjectId, deckName, nextReviewAt, updatedAt',
      pomodoroSessions: 'id, subjectId, dateKey, completedAt',
    });
    this.version(5).stores({
      settings: 'id',
      subjects: 'id, archived, semester, name, updatedAt',
      glossary: 'id, term, branch, isFavorite, isBuiltIn, updatedAt',
      calendarEvents: 'id, date, type, subjectId, completed, updatedAt',
      books: 'id, shelf, format, subjectId, isFavorite, lastOpenedAt, updatedAt',
      bookFiles: 'bookId',
      bookChunks: 'id, bookId, location',
      bookHighlights: 'id, bookId, [bookId+page], createdAt',
      studyNotes: 'id, kind, subjectId, linkedBookId, isFavorite, updatedAt',
      flashcards: 'id, subjectId, deckName, nextReviewAt, updatedAt',
      pomodoroSessions: 'id, subjectId, dateKey, completedAt',
    });
    this.version(6).stores({
      settings: 'id',
      subjects: 'id, archived, semester, name, updatedAt',
      glossary: 'id, term, branch, isFavorite, isBuiltIn, updatedAt',
      calendarEvents: 'id, date, type, subjectId, completed, updatedAt',
      books: 'id, shelf, format, subjectId, isFavorite, lastOpenedAt, updatedAt',
      bookFiles: 'bookId',
      bookChunks: 'id, bookId, location',
      bookHighlights: 'id, bookId, [bookId+page], createdAt',
      studyNotes: 'id, kind, subjectId, linkedBookId, isFavorite, updatedAt',
      flashcards: 'id, subjectId, deckName, sourceNoteId, nextReviewAt, updatedAt',
      pomodoroSessions: 'id, subjectId, dateKey, completedAt',
    });
  }
}

export const db = new ColdiEstudioDB();

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'main',
  currentSemesterLabel: 'Semestre Actual',
  colorMode: 'light',
  accentTheme: 'lavender',
  dailyGoalMinutes: 60,
  showDailyTerm: true,
  mascotAnimations: true,
  strictDeleteConfirm: true,
  examReminderDays: 3,
  examUrgentShortcut: true,
  glossaryUnderlinesDefault: true,
  liveBookSuggestions: true,
  pomodoroChime: true,
  updatedAt: Date.now(),
};

let initPromise: Promise<void> | null = null;

export function ensureDatabaseReady(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const existingSettings = await db.settings.get('main');
      if (!existingSettings) {
        await db.settings.put({ ...DEFAULT_SETTINGS, updatedAt: Date.now() });
      } else {
        const merged: AppSettings = {
          ...DEFAULT_SETTINGS,
          ...existingSettings,
          id: 'main',
        };
        await db.settings.put(merged);
      }

      const glossaryCount = await db.glossary.count();
      if (glossaryCount === 0) {
        await db.glossary.bulkPut(buildSeedGlossary());
      }
    })();
  }
  return initPromise;
}

export async function findDuplicateGlossaryTerm(
  termName: string,
  excludeId?: string
): Promise<GlossaryTerm | undefined> {
  const normalizedTarget = normalizeText(termName);
  if (!normalizedTarget) return undefined;
  const all = await db.glossary.toArray();
  return all.find(
    (item) => item.id !== excludeId && normalizeText(item.term) === normalizedTarget
  );
}

export async function restoreMissingBuiltInGlossary(): Promise<number> {
  const seed = buildSeedGlossary();
  const existing = await db.glossary.toArray();
  const existingNormalized = new Set(existing.map((t) => normalizeText(t.term)));

  let restored = 0;
  for (const item of seed) {
    const existsById = existing.some((e) => e.id === item.id);
    const existsByName = existingNormalized.has(normalizeText(item.term));
    if (!existsById && !existsByName) {
      await db.glossary.put(item);
      existingNormalized.add(normalizeText(item.term));
      restored += 1;
    }
  }
  return restored;
}

export async function deleteBookWithContent(bookId: string): Promise<void> {
  await db.transaction(
    'rw',
    [db.books, db.bookFiles, db.bookChunks, db.bookHighlights],
    async () => {
      await db.books.delete(bookId);
      await db.bookFiles.delete(bookId);
      await db.bookChunks.where('bookId').equals(bookId).delete();
      await db.bookHighlights.where('bookId').equals(bookId).delete();
    }
  );
}

export interface BackupPayload {
  schemaVersion: 1 | 2 | 3 | 4 | 5;
  exportedAt: number;
  settings: AppSettings | undefined;
  subjects: Subject[];
  glossary: GlossaryTerm[];
  calendarEvents?: CalendarEvent[];
  booksMeta?: BookItem[];
  bookHighlights?: BookHighlight[];
  studyNotes?: StudyNote[];
  flashcards?: Flashcard[];
  pomodoroSessions?: PomodoroSession[];
}

export async function exportLocalBackup(): Promise<string> {
  const [
    settings,
    subjects,
    glossary,
    calendarEvents,
    booksMeta,
    bookHighlights,
    studyNotes,
    flashcards,
    pomodoroSessions,
  ] = await Promise.all([
    db.settings.get('main'),
    db.subjects.toArray(),
    db.glossary.toArray(),
    db.calendarEvents.toArray(),
    db.books.toArray(),
    db.bookHighlights.toArray(),
    db.studyNotes.toArray(),
    db.flashcards.toArray(),
    db.pomodoroSessions.toArray(),
  ]);

  const payload: BackupPayload = {
    schemaVersion: 5,
    exportedAt: Date.now(),
    settings,
    subjects,
    glossary,
    calendarEvents,
    booksMeta,
    bookHighlights,
    studyNotes,
    flashcards,
    pomodoroSessions,
  };

  return JSON.stringify(payload, null, 2);
}

export async function importLocalBackup(
  rawJson: string
): Promise<{ subjects: number; glossary: number; events: number }> {
  const parsed = JSON.parse(rawJson) as Partial<BackupPayload>;
  if (!parsed || ![1, 2, 3, 4, 5].includes(Number(parsed.schemaVersion))) {
    throw new Error('El archivo de respaldo no tiene un formato válido.');
  }

  await db.transaction(
    'rw',
    [
      db.settings,
      db.subjects,
      db.glossary,
      db.calendarEvents,
      db.bookHighlights,
      db.studyNotes,
      db.flashcards,
      db.pomodoroSessions,
    ],
    async () => {
      if (parsed.settings) {
        await db.settings.put({ ...DEFAULT_SETTINGS, ...parsed.settings, id: 'main' });
      }
      if (Array.isArray(parsed.subjects)) {
        await db.subjects.bulkPut(parsed.subjects);
      }
      if (Array.isArray(parsed.glossary)) {
        const current = await db.glossary.toArray();
        const seen = new Set(current.map((t) => normalizeText(t.term)));
        const uniqueIncoming = parsed.glossary.filter((t) => {
          const key = normalizeText(t.term);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        if (uniqueIncoming.length > 0) {
          await db.glossary.bulkPut(uniqueIncoming);
        }
      }
      if (Array.isArray(parsed.calendarEvents)) {
        await db.calendarEvents.bulkPut(parsed.calendarEvents);
      }
      if (Array.isArray(parsed.bookHighlights)) {
        await db.bookHighlights.bulkPut(parsed.bookHighlights);
      }
      if (Array.isArray(parsed.studyNotes)) {
        await db.studyNotes.bulkPut(parsed.studyNotes);
      }
      if (Array.isArray(parsed.flashcards)) {
        await db.flashcards.bulkPut(parsed.flashcards);
      }
      if (Array.isArray(parsed.pomodoroSessions)) {
        await db.pomodoroSessions.bulkPut(parsed.pomodoroSessions);
      }
    }
  );

  return {
    subjects: Array.isArray(parsed.subjects) ? parsed.subjects.length : 0,
    glossary: Array.isArray(parsed.glossary) ? parsed.glossary.length : 0,
    events: Array.isArray(parsed.calendarEvents) ? parsed.calendarEvents.length : 0,
  };
}
