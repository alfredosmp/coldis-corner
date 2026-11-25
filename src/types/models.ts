export type AccentTheme = 'lavender' | 'rose' | 'grape' | 'ice';
export type ColorMode = 'light' | 'dark';
export type ColdiPose = 'default' | 'reading' | 'writing' | 'thinking' | 'music';

export type NavSection =
  | 'dashboard'
  | 'subjects'
  | 'calendar'
  | 'library'
  | 'search'
  | 'notes'
  | 'flashcards'
  | 'pomodoro'
  | 'glossary'
  | 'settings';

export type SubjectColorId =
  | 'lavender'
  | 'blush'
  | 'lilac'
  | 'peach'
  | 'mint'
  | 'sky'
  | 'berry'
  | 'butter';

export type SubjectIconId =
  | 'scale'
  | 'book'
  | 'gavel'
  | 'scroll'
  | 'landmark'
  | 'feather'
  | 'heart'
  | 'sparkles';

export interface Subject {
  id: string;
  name: string;
  semester: string;
  professor: string;
  schedule: string;
  description: string;
  color: SubjectColorId;
  icon: SubjectIconId;
  archived: boolean;
  quickNotes: string;
  createdAt: number;
  updatedAt: number;
}

export type CalendarEventType = 'task' | 'exam';

export interface CalendarEvent {
  id: string;
  title: string;
  type: CalendarEventType;
  /** Local date string YYYY-MM-DD */
  date: string;
  /** Optional local 24h time string HH:mm (used for exam countdown & <24h cutoff) */
  time?: string;
  subjectId?: string;
  notes?: string;
  completed: boolean;
  createdAt: number;
  updatedAt: number;
}

export type BookShelf = 'law' | 'personal';
export type BookFormat = 'pdf' | 'docx' | 'epub';

export interface BookItem {
  id: string;
  title: string;
  author: string;
  shelf: BookShelf;
  format: BookFormat;
  subjectId?: string;
  fileName: string;
  fileSize: number;
  totalLocations: number;
  currentLocation: number;
  readingNotes: string;
  coverColor: SubjectColorId;
  coverDataUrl?: string;
  isFavorite: boolean;
  indexed: boolean;
  lastOpenedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface BookFileBlob {
  bookId: string;
  data: ArrayBuffer;
  mimeType: string;
}

export interface BookTextChunk {
  id: string;
  bookId: string;
  /** 1-indexed page number (PDF) or chapter/section number (EPUB/DOCX) */
  location: number;
  locationLabel: string;
  text: string;
  normalizedText: string;
}

export type HighlightColorId = 'yellow' | 'lavender' | 'pink' | 'mint';

export interface BookHighlight {
  id: string;
  bookId: string;
  /** 1-indexed PDF page number */
  page: number;
  /** Normalized coordinates (0..1) relative to page dimensions so zoom stays pixel-perfect */
  x: number;
  y: number;
  width: number;
  height: number;
  color: HighlightColorId;
  createdAt: number;
}

export type StudyNoteKind = 'note' | 'summary' | 'outline';

export interface OutlineNode {
  id: string;
  text: string;
  detail?: string;
  color?: SubjectColorId;
  collapsed?: boolean;
  children: OutlineNode[];
}

export interface StudyNote {
  id: string;
  title: string;
  kind: StudyNoteKind;
  subjectId?: string;
  linkedBookId?: string;
  /** Plain text mirror for fast offline search and live suggestions */
  content: string;
  /** Rich HTML for Word-like notes and summaries */
  htmlContent?: string;
  /** Hierarchical tree nodes for 'outline' */
  outlineNodes: OutlineNode[];
  isFavorite: boolean;
  createdAt: number;
  updatedAt: number;
}

export type FlashcardMode = 'basic' | 'cloze';
export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

export interface Flashcard {
  id: string;
  subjectId?: string;
  deckName: string;
  sourceNoteId?: string;
  sourceNoteTitle?: string;
  needsReview?: boolean;
  mode: FlashcardMode;
  /** Front question (basic) or text with {{hidden}} words (cloze) */
  front: string;
  /** Back answer (basic) or extra note/hint (cloze) */
  back: string;
  legalRef?: string;
  repetitions: number;
  intervalDays: number;
  easeFactor: number;
  nextReviewAt: number;
  lastReviewedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface PomodoroSession {
  id: string;
  subjectId?: string;
  label: string;
  durationMinutes: number;
  completedAt: number;
  dateKey: string;
}

export type LawBranch =
  | 'Constitucional y Amparo'
  | 'Civil y Familiar'
  | 'Penal y CNPP'
  | 'Procesal y Teoría del Proceso'
  | 'Mercantil'
  | 'Laboral'
  | 'Administrativo'
  | 'Locuciones Latinas'
  | 'General / Otros';

export interface GlossaryTerm {
  id: string;
  term: string;
  branch: LawBranch;
  definition: string;
  example?: string;
  legalBasis?: string;
  isLatin?: boolean;
  isFavorite: boolean;
  isBuiltIn: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AppSettings {
  id: 'main';
  currentSemesterLabel: string;
  colorMode: ColorMode;
  accentTheme: AccentTheme;
  dailyGoalMinutes: number;
  showDailyTerm: boolean;
  mascotAnimations: boolean;
  strictDeleteConfirm: boolean;
  examReminderDays: number;
  examUrgentShortcut: boolean;
  glossaryUnderlinesDefault: boolean;
  liveBookSuggestions: boolean;
  pomodoroChime: boolean;
  updatedAt: number;
}

export interface SyncStatus {
  state: 'local-only' | 'synced' | 'syncing' | 'offline';
  lastSyncedAt?: number;
  providerName?: string;
}
