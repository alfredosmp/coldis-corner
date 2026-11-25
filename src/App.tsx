import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { BookReaderView } from './components/BookReaderView';
import { CalendarView } from './components/CalendarView';
import { ColdiAvatar } from './components/ColdiAvatar';
import { DashboardView } from './components/DashboardView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ExamQuickLaunchModal } from './components/ExamQuickLaunchModal';
import { FlashcardsView } from './components/FlashcardsView';
import { FloatingPomodoroBar } from './components/FloatingPomodoroBar';
import { GlossaryView } from './components/GlossaryView';
import { LibraryView } from './components/LibraryView';
import { NotesOutlinesView } from './components/NotesOutlinesView';
import { PomodoroView, type PomodoroState } from './components/PomodoroView';
import { SearchView } from './components/SearchView';
import { SettingsView } from './components/SettingsView';
import { Sidebar } from './components/Sidebar';
import { SubjectsView } from './components/SubjectsView';
import { BRAND_CONFIG } from './config/brand';
import {
  DEFAULT_SETTINGS,
  db,
  deleteBookWithContent,
  ensureDatabaseReady,
  findDuplicateGlossaryTerm,
  restoreMissingBuiltInGlossary,
} from './db/database';
import { ambientAudio, type AmbientChannelId } from './services/ambientAudio';
import type { DocumentImportResult } from './services/documentParser';
import {
  completeWebOAuthIfPresent,
  connectGoogleDrive,
  disconnectGoogleDrive,
  getGoogleDriveConfig,
  getStoredDriveSession,
  isDesktopApp,
  recordDeletionTombstone,
  syncWithGoogleDrive,
  type CloudSyncState,
} from './services/googleDriveSync';
import { computeNextReview } from './services/spacedRepetition';
import type {
  AppSettings,
  BookItem,
  BookShelf,
  CalendarEvent,
  CalendarEventType,
  Flashcard,
  GlossaryTerm,
  NavSection,
  ReviewRating,
  StudyNote,
  Subject,
} from './types/models';
import { classifyExamAlerts, getTodayDateKey } from './utils/calendar';
import { createId } from './utils/text';

interface ActiveReaderState {
  bookId: string;
  initialLocation?: number;
  initialSearchQuery?: string;
}

export function App() {
  const [ready, setReady] = useState(false);
  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [activeReader, setActiveReader] = useState<ActiveReaderState | null>(null);
  const [notesInitialSubject, setNotesInitialSubject] = useState<string>('ALL');
  const [quickNewNoteSignal, setQuickNewNoteSignal] = useState(0);
  const [flashcardsInitialSubject, setFlashcardsInitialSubject] = useState<string>('ALL');
  const [createSubjectSignal, setCreateSubjectSignal] = useState(0);
  const [calendarQuickAdd, setCalendarQuickAdd] = useState<{
    seq: number;
    type?: CalendarEventType;
    subjectId?: string;
  }>({ seq: 0 });
  const [libraryQuickUpload, setLibraryQuickUpload] = useState<{
    seq: number;
    subjectId?: string;
    shelf?: BookShelf;
  }>({ seq: 0 });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Persistent Pomodoro Timer State (keeps running while navigating all tabs!)
  const [pomodoro, setPomodoro] = useState<PomodoroState>({
    phase: 'focus',
    focusMinutes: 25,
    breakMinutes: 5,
    secondsLeft: 25 * 60,
    running: false,
    subjectId: '',
  });

  // Persistent Offline Ambient Sound Mixer State
  const [channelVolumes, setChannelVolumes] = useState<Record<AmbientChannelId, number>>({
    lofi: 0,
    rain: 0,
    water: 0,
    forest: 0,
    birds: 0,
    whitenoise: 0,
    piano: 0,
  });
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [customTrackName, setCustomTrackName] = useState<string | null>(null);
  const [customTrackPlaying, setCustomTrackPlaying] = useState(false);

  // Live minute ticker so exam countdowns & <24h shortcut window stay accurate
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [examShortcutDismissed, setExamShortcutDismissed] = useState(false);
  const hasShownStartupShortcut = useRef(false);
  const [showStartupExamModal, setShowStartupExamModal] = useState(false);

  // Silent Google Drive Sync State
  const [cloudSync, setCloudSync] = useState<CloudSyncState>(() => {
    const sess = getStoredDriveSession();
    return {
      connected: Boolean(sess),
      email: sess?.email,
      syncing: false,
      lastSyncedAt: sess?.lastSyncedAt,
      isDesktop: isDesktopApp(),
      hasClientId: Boolean(getGoogleDriveConfig().clientId),
    };
  });
  const syncTimerRef = useRef<number | null>(null);

  async function runCloudSync(silent = false) {
    if (!getStoredDriveSession()) return;
    if (!navigator.onLine) return;

    setCloudSync((prev) => ({ ...prev, syncing: true, error: silent ? prev.error : undefined }));
    try {
      const updated = await syncWithGoogleDrive();
      setCloudSync((prev) => ({
        ...prev,
        connected: true,
        email: updated.email,
        syncing: false,
        lastSyncedAt: updated.lastSyncedAt,
        error: undefined,
        needsReauth: false,
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al sincronizar';
      if (msg === 'OFFLINE' || msg === 'NOT_CONNECTED') {
        setCloudSync((prev) => ({ ...prev, syncing: false }));
        return;
      }
      setCloudSync((prev) => ({
        ...prev,
        syncing: false,
        needsReauth: msg === 'REAUTH_REQUIRED',
        error:
          msg === 'REAUTH_REQUIRED'
            ? 'Tu sesión de Google expiró. Pulsa Conectar para reactivar la sincronización.'
            : silent
            ? undefined
            : msg,
      }));
    }
  }

  function scheduleSilentSync() {
    if (!getStoredDriveSession()) return;
    if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    syncTimerRef.current = window.setTimeout(() => {
      runCloudSync(true);
    }, 5000);
  }

  async function handleConnectCloud() {
    setCloudSync((prev) => ({ ...prev, syncing: true, error: undefined }));
    try {
      const session = await connectGoogleDrive();
      if (session) {
        setCloudSync((prev) => ({
          ...prev,
          connected: true,
          email: session.email,
          syncing: true,
          error: undefined,
        }));
        await runCloudSync(false);
      }
    } catch (err) {
      setCloudSync((prev) => ({
        ...prev,
        syncing: false,
        error: err instanceof Error ? err.message : 'No se pudo conectar con Google Drive.',
      }));
    }
  }

  function handleDisconnectCloud() {
    if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    disconnectGoogleDrive();
    setCloudSync((prev) => ({
      ...prev,
      connected: false,
      email: undefined,
      syncing: false,
      lastSyncedAt: undefined,
      error: undefined,
      needsReauth: false,
    }));
  }

  function handleRefreshCloudConfig() {
    setCloudSync((prev) => ({
      ...prev,
      hasClientId: Boolean(getGoogleDriveConfig().clientId),
      error: undefined,
    }));
  }

  useEffect(() => {
    ensureDatabaseReady().then(async () => {
      setReady(true);
      // Complete Mobile/Web OAuth redirect if returning from Google Sign-In
      try {
        const webSession = await completeWebOAuthIfPresent();
        if (webSession) {
          setCloudSync((prev) => ({
            ...prev,
            connected: true,
            email: webSession.email,
            error: undefined,
          }));
          runCloudSync(true);
        } else if (getStoredDriveSession() && navigator.onLine) {
          runCloudSync(true);
        }
      } catch (err) {
        setCloudSync((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : undefined,
        }));
      }
    });
  }, []);

  const [updateReadyVersion, setUpdateReadyVersion] = useState<string | null>(null);

  // Listen for background desktop updates downloaded automatically from GitHub Releases
  useEffect(() => {
    if (!window.coldiDesktop?.onUpdateReady) return;
    return window.coldiDesktop.onUpdateReady((info) => {
      setUpdateReadyVersion(info.version || 'nueva');
    });
  }, []);

  // Automatically sync silently whenever internet connection returns
  useEffect(() => {
    const onOnline = () => {
      if (getStoredDriveSession()) {
        runCloudSync(true);
      }
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const settingsRecord = useLiveQuery(() => db.settings.get('main'), []);
  const settings: AppSettings = { ...DEFAULT_SETTINGS, ...(settingsRecord ?? {}) };

  const subjects =
    useLiveQuery(async () => {
      const list = await db.subjects.toArray();
      return list.sort((a, b) => b.updatedAt - a.updatedAt);
    }, []) ?? [];

  const glossary = useLiveQuery(() => db.glossary.toArray(), []) ?? [];
  const calendarEvents = useLiveQuery(() => db.calendarEvents.toArray(), []);
  const books = useLiveQuery(() => db.books.toArray(), []) ?? [];
  const studyNotes = useLiveQuery(() => db.studyNotes.toArray(), []) ?? [];
  const flashcards = useLiveQuery(() => db.flashcards.toArray(), []) ?? [];
  const pomodoroSessions = useLiveQuery(() => db.pomodoroSessions.toArray(), []) ?? [];

  const eventsList = calendarEvents ?? [];

  // Pomodoro countdown effect
  useEffect(() => {
    if (!pomodoro.running) return;
    const timer = window.setInterval(() => {
      setPomodoro((prev) => {
        if (!prev.running) return prev;
        if (prev.secondsLeft > 1) {
          return { ...prev, secondsLeft: prev.secondsLeft - 1 };
        }

        // Phase finished!
        if (settings.pomodoroChime) {
          ambientAudio.playCompletionChime();
        }
        if (prev.phase === 'focus') {
          const subjName =
            subjects.find((s) => s.id === prev.subjectId)?.name ?? 'Estudio general';
          db.pomodoroSessions.put({
            id: createId('pomo'),
            subjectId: prev.subjectId || undefined,
            label: subjName,
            durationMinutes: prev.focusMinutes,
            completedAt: Date.now(),
            dateKey: getTodayDateKey(),
          });
          return {
            ...prev,
            phase: 'break',
            secondsLeft: prev.breakMinutes * 60,
            running: true,
          };
        }

        return {
          ...prev,
          phase: 'focus',
          secondsLeft: prev.focusMinutes * 60,
          running: true,
        };
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [pomodoro.running, subjects, settings.pomodoroChime]);

  const examAlerts = useMemo(
    () => classifyExamAlerts(eventsList, settings.examReminderDays, nowTick),
    [eventsList, settings.examReminderDays, nowTick]
  );

  // Show startup 24h direct exam shortcut automatically once when opening the app
  useEffect(() => {
    if (!ready || calendarEvents === undefined) return;
    if (hasShownStartupShortcut.current || examShortcutDismissed) return;
    if (!settings.examUrgentShortcut) return;

    if (examAlerts.urgentWithin24h.length > 0) {
      hasShownStartupShortcut.current = true;
      setShowStartupExamModal(true);
    }
  }, [
    ready,
    calendarEvents,
    examAlerts.urgentWithin24h.length,
    settings.examUrgentShortcut,
    examShortcutDismissed,
  ]);

  // Apply color mode, pastel accent, and document title
  useEffect(() => {
    const root = document.documentElement;
    if (settings.colorMode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.setAttribute('data-accent', settings.accentTheme);
    document.title = BRAND_CONFIG.appName;
  }, [settings.colorMode, settings.accentTheme]);

  async function updateSettings(partial: Partial<AppSettings>) {
    const current = (await db.settings.get('main')) ?? DEFAULT_SETTINGS;
    await db.settings.put({
      ...DEFAULT_SETTINGS,
      ...current,
      ...partial,
      id: 'main',
      updatedAt: Date.now(),
    });
    scheduleSilentSync();
  }

  async function toggleColorMode() {
    await updateSettings({
      colorMode: settings.colorMode === 'light' ? 'dark' : 'light',
    });
  }

  // === Subjects ===
  async function saveSubject(
    data: Omit<Subject, 'id' | 'createdAt' | 'updatedAt' | 'archived' | 'quickNotes'>,
    existingId?: string
  ) {
    const now = Date.now();
    if (existingId) {
      const prev = await db.subjects.get(existingId);
      if (prev) {
        await db.subjects.put({ ...prev, ...data, updatedAt: now });
        scheduleSilentSync();
        return;
      }
    }
    await db.subjects.put({
      id: createId('subj'),
      ...data,
      archived: false,
      quickNotes: '',
      createdAt: now,
      updatedAt: now,
    });
    scheduleSilentSync();
  }

  async function toggleArchiveSubject(subject: Subject) {
    await db.subjects.update(subject.id, {
      archived: !subject.archived,
      updatedAt: Date.now(),
    });
    scheduleSilentSync();
  }

  async function deleteSubject(subjectId: string) {
    await db.subjects.delete(subjectId);
    recordDeletionTombstone(subjectId);
    scheduleSilentSync();
  }

  async function updateQuickNotes(subjectId: string, notes: string) {
    await db.subjects.update(subjectId, {
      quickNotes: notes,
      updatedAt: Date.now(),
    });
    scheduleSilentSync();
  }

  // === Glossary ===
  async function saveGlossaryTerm(
    data: Omit<GlossaryTerm, 'id' | 'isFavorite' | 'isBuiltIn' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ): Promise<{ ok: boolean; duplicateOf?: string }> {
    const duplicate = await findDuplicateGlossaryTerm(data.term, existingId);
    if (duplicate) {
      return { ok: false, duplicateOf: duplicate.term };
    }

    const now = Date.now();
    if (existingId) {
      const prev = await db.glossary.get(existingId);
      if (prev) {
        await db.glossary.put({ ...prev, ...data, updatedAt: now });
        scheduleSilentSync();
        return { ok: true };
      }
    }

    await db.glossary.put({
      id: createId('term'),
      ...data,
      isFavorite: false,
      isBuiltIn: false,
      createdAt: now,
      updatedAt: now,
    });
    scheduleSilentSync();
    return { ok: true };
  }

  async function toggleFavoriteTerm(term: GlossaryTerm) {
    await db.glossary.update(term.id, {
      isFavorite: !term.isFavorite,
      updatedAt: Date.now(),
    });
    scheduleSilentSync();
  }

  async function deleteGlossaryTerm(id: string) {
    await db.glossary.delete(id);
    recordDeletionTombstone(id);
    scheduleSilentSync();
  }

  // === Calendar ===
  async function saveCalendarEvent(
    data: Omit<CalendarEvent, 'id' | 'completed' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ) {
    const now = Date.now();
    if (existingId) {
      const prev = await db.calendarEvents.get(existingId);
      if (prev) {
        await db.calendarEvents.put({ ...prev, ...data, updatedAt: now });
        scheduleSilentSync();
        return;
      }
    }
    await db.calendarEvents.put({
      id: createId('evt'),
      ...data,
      completed: false,
      createdAt: now,
      updatedAt: now,
    });
    scheduleSilentSync();
  }

  async function toggleCalendarEventComplete(event: CalendarEvent) {
    await db.calendarEvents.update(event.id, {
      completed: !event.completed,
      updatedAt: Date.now(),
    });
    scheduleSilentSync();
  }

  async function deleteCalendarEvent(id: string) {
    await db.calendarEvents.delete(id);
    recordDeletionTombstone(id);
    scheduleSilentSync();
  }

  // === Books & Reader ===
  async function importBook(book: BookItem, parsed: DocumentImportResult) {
    await db.transaction('rw', db.books, db.bookFiles, db.bookChunks, async () => {
      await db.books.put(book);
      await db.bookFiles.put({
        bookId: book.id,
        data: parsed.arrayBuffer,
        mimeType: parsed.mimeType,
      });
      if (parsed.chunks.length > 0) {
        await db.bookChunks.bulkPut(parsed.chunks);
      }
    });
    scheduleSilentSync();
  }

  async function updateBookMeta(
    bookId: string,
    partial: Partial<
      Pick<BookItem, 'title' | 'author' | 'shelf' | 'subjectId' | 'coverColor' | 'isFavorite'>
    >
  ) {
    await db.books.update(bookId, { ...partial, updatedAt: Date.now() });
    scheduleSilentSync();
  }

  async function updateBookProgress(bookId: string, location: number, totalLocations?: number) {
    await db.books.update(bookId, {
      currentLocation: location,
      ...(totalLocations ? { totalLocations } : {}),
      lastOpenedAt: Date.now(),
      updatedAt: Date.now(),
    });
    scheduleSilentSync();
  }

  async function updateBookReadingNotes(bookId: string, notes: string) {
    await db.books.update(bookId, { readingNotes: notes, updatedAt: Date.now() });
    scheduleSilentSync();
  }

  async function deleteBook(bookId: string) {
    if (activeReader?.bookId === bookId) setActiveReader(null);
    await deleteBookWithContent(bookId);
    recordDeletionTombstone(bookId);
    scheduleSilentSync();
  }

  function openBookReader(bookId: string, initialLocation?: number, initialSearchQuery?: string) {
    db.books.update(bookId, { lastOpenedAt: Date.now() });
    setActiveReader({ bookId, initialLocation, initialSearchQuery });
    setActiveSection('library');
  }

  // === Resúmenes & Esquemas ===
  async function saveStudyNote(note: StudyNote) {
    await db.studyNotes.put({ ...note, updatedAt: Date.now() });
    scheduleSilentSync();
  }

  async function deleteStudyNote(id: string) {
    await db.studyNotes.delete(id);
    recordDeletionTombstone(id);
    scheduleSilentSync();
  }

  // === Flashcards ===
  async function saveFlashcard(
    data: Pick<Flashcard, 'subjectId' | 'deckName' | 'mode' | 'front' | 'back' | 'legalRef'>,
    existingId?: string
  ) {
    const now = Date.now();
    if (existingId) {
      const prev = await db.flashcards.get(existingId);
      if (prev) {
        await db.flashcards.put({ ...prev, ...data, updatedAt: now });
        scheduleSilentSync();
        return;
      }
    }
    await db.flashcards.put({
      id: createId('card'),
      ...data,
      repetitions: 0,
      intervalDays: 0,
      easeFactor: 2.5,
      nextReviewAt: now,
      createdAt: now,
      updatedAt: now,
    });
    scheduleSilentSync();
  }

  async function saveFlashcardsBatch(
    items: Pick<
      Flashcard,
      'subjectId' | 'deckName' | 'sourceNoteId' | 'sourceNoteTitle' | 'mode' | 'front' | 'back' | 'legalRef'
    >[]
  ) {
    const now = Date.now();
    const records: Flashcard[] = items.map((data, idx) => ({
      id: createId('card'),
      ...data,
      needsReview: false,
      repetitions: 0,
      intervalDays: 0,
      easeFactor: 2.5,
      nextReviewAt: now + idx,
      createdAt: now + idx,
      updatedAt: now + idx,
    }));
    await db.flashcards.bulkPut(records);
    scheduleSilentSync();
  }

  async function reviewFlashcard(card: Flashcard, rating: ReviewRating) {
    const now = Date.now();
    const next = computeNextReview(card, rating, now);
    await db.flashcards.update(card.id, {
      needsReview: rating === 'again' || rating === 'hard',
      repetitions: next.repetitions,
      intervalDays: next.intervalDays,
      easeFactor: next.easeFactor,
      nextReviewAt: next.nextReviewAt,
      lastReviewedAt: now,
      updatedAt: now,
    });
    scheduleSilentSync();
  }

  async function toggleFlashcardNeedsReview(card: Flashcard) {
    await db.flashcards.update(card.id, {
      needsReview: !card.needsReview,
      updatedAt: Date.now(),
    });
    scheduleSilentSync();
  }

  async function deleteFlashcard(id: string) {
    await db.flashcards.delete(id);
    recordDeletionTombstone(id);
    scheduleSilentSync();
  }

  // === Ambient Audio Handlers ===
  function handleSetChannelVolume(id: AmbientChannelId, volume: number) {
    setChannelVolumes((prev) => ({ ...prev, [id]: volume }));
    ambientAudio.setChannelVolume(id, volume);
  }

  function handleToggleMute() {
    const next = !isAudioMuted;
    setIsAudioMuted(next);
    ambientAudio.setMuted(next);
  }

  function handleStopAllAudio() {
    ambientAudio.stopAll();
    setChannelVolumes({
      lofi: 0,
      rain: 0,
      water: 0,
      forest: 0,
      birds: 0,
      whitenoise: 0,
      piano: 0,
    });
    setCustomTrackPlaying(false);
  }

  function handleLoadCustomTrack(file: File) {
    const name = ambientAudio.loadCustomAudio(file);
    setCustomTrackName(name);
    setCustomTrackPlaying(true);
  }

  function handleToggleCustomTrack() {
    const next = !customTrackPlaying;
    setCustomTrackPlaying(next);
    ambientAudio.toggleCustomAudio(next);
  }

  // === Navigation ===
  function handleSelectSection(section: NavSection) {
    setActiveReader(null);
    setActiveSection(section);
    if (section !== 'subjects') setSelectedSubjectId(null);
    if (section === 'notes') setNotesInitialSubject('ALL');
    if (section === 'flashcards') setFlashcardsInitialSubject('ALL');
  }

  function handleOpenSubject(subjectId: string) {
    setActiveReader(null);
    setSelectedSubjectId(subjectId);
    setActiveSection('subjects');
  }

  function handleCreateSubjectFromDashboard() {
    setActiveReader(null);
    setSelectedSubjectId(null);
    setActiveSection('subjects');
    setCreateSubjectSignal((n) => n + 1);
  }

  function handleQuickNewNote() {
    setActiveReader(null);
    setSelectedSubjectId(null);
    setNotesInitialSubject('ALL');
    setActiveSection('notes');
    setQuickNewNoteSignal((n) => n + 1);
  }

  function handleQuickAddEventForSubject(subjectId: string, type: CalendarEventType) {
    setActiveReader(null);
    setActiveSection('calendar');
    setCalendarQuickAdd((prev) => ({ seq: prev.seq + 1, type, subjectId }));
  }

  function handleQuickUploadBookForSubject(subjectId: string) {
    setActiveReader(null);
    setActiveSection('library');
    setLibraryQuickUpload((prev) => ({ seq: prev.seq + 1, shelf: 'law', subjectId }));
  }

  function handleOpenNotesForSubject(subjectId: string) {
    setActiveReader(null);
    setNotesInitialSubject(subjectId);
    setActiveSection('notes');
  }

  function handleOpenFlashcardsForSubject(subjectId: string) {
    setActiveReader(null);
    setFlashcardsInitialSubject(subjectId);
    setActiveSection('flashcards');
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-lavender-50 dark:bg-midnight-950 p-6">
        <ColdiAvatar pose="default" size="xl" floating />
        <p className="font-display font-bold text-lg text-[#2E1F3E] dark:text-white">
          Abriendo {BRAND_CONFIG.appName}...
        </p>
      </div>
    );
  }

  const hasExamAlert =
    examAlerts.urgentWithin24h.length > 0 || examAlerts.upcomingSoon.length > 0;
  const anyAudioActive =
    Object.values(channelVolumes).some((v) => v > 0.01) || customTrackPlaying;

  const activeBook = activeReader
    ? books.find((b) => b.id === activeReader.bookId) ?? null
    : null;
  const activeBookSubject = activeBook?.subjectId
    ? subjects.find((s) => s.id === activeBook.subjectId)
    : undefined;

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-lavender-50 dark:bg-midnight-950 text-[#2E1F3E] dark:text-[#F3EEFA] transition-colors duration-300">
      <Sidebar
        activeSection={activeSection}
        onSelectSection={handleSelectSection}
        appName={BRAND_CONFIG.appName}
        colorMode={settings.colorMode}
        onToggleColorMode={toggleColorMode}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((c) => !c)}
        hasExamAlert={hasExamAlert}
        isMuted={isAudioMuted}
        onToggleMute={handleToggleMute}
      />

      <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-10 py-6 pb-24 md:pb-8 max-w-[1440px] w-full mx-auto">
        <ErrorBoundary
          onReset={() => {
            setActiveReader(null);
            setActiveSection('dashboard');
          }}
        >
          {activeBook && activeReader ? (
            <BookReaderView
              book={activeBook}
              subject={activeBookSubject}
              glossary={glossary}
              defaultGlossaryMarks={settings.glossaryUnderlinesDefault}
              initialLocation={activeReader.initialLocation}
              initialSearchQuery={activeReader.initialSearchQuery}
              onClose={() => setActiveReader(null)}
              onUpdateBookProgress={updateBookProgress}
              onUpdateReadingNotes={updateBookReadingNotes}
            />
          ) : (
            <>
              {activeSection === 'dashboard' && (
                <DashboardView
                  settings={settings}
                  subjects={subjects}
                  books={books}
                  glossary={glossary}
                  events={eventsList}
                  nowTick={nowTick}
                  onNavigate={handleSelectSection}
                  onOpenSubject={handleOpenSubject}
                  onOpenBook={(bookId) => openBookReader(bookId)}
                  onCreateSubject={handleCreateSubjectFromDashboard}
                  onQuickNewNote={handleQuickNewNote}
                  onToggleFavoriteTerm={toggleFavoriteTerm}
                  onToggleEventComplete={toggleCalendarEventComplete}
                />
              )}

              {activeSection === 'subjects' && (
                <SubjectsView
                  subjects={subjects}
                  books={books}
                  events={eventsList}
                  studyNotes={studyNotes}
                  flashcards={flashcards}
                  defaultSemesterLabel={settings.currentSemesterLabel}
                  selectedSubjectId={selectedSubjectId}
                  openCreateSignal={createSubjectSignal}
                  strictDeleteConfirm={settings.strictDeleteConfirm}
                  animateMascot={settings.mascotAnimations}
                  onSelectSubject={setSelectedSubjectId}
                  onSaveSubject={saveSubject}
                  onToggleArchive={toggleArchiveSubject}
                  onDeleteSubject={deleteSubject}
                  onUpdateQuickNotes={updateQuickNotes}
                  onQuickAddEvent={handleQuickAddEventForSubject}
                  onOpenBook={(bookId) => openBookReader(bookId)}
                  onQuickUploadBook={handleQuickUploadBookForSubject}
                  onOpenNotesForSubject={handleOpenNotesForSubject}
                  onOpenFlashcardsForSubject={handleOpenFlashcardsForSubject}
                />
              )}

              {activeSection === 'library' && (
                <LibraryView
                  books={books}
                  subjects={subjects}
                  animateMascot={settings.mascotAnimations}
                  quickUploadSignal={libraryQuickUpload}
                  onImportBook={importBook}
                  onUpdateBookMeta={updateBookMeta}
                  onDeleteBook={deleteBook}
                  onOpenBook={(bookId, loc) => openBookReader(bookId, loc)}
                />
              )}

              {activeSection === 'search' && (
                <SearchView
                  books={books}
                  subjects={subjects}
                  glossary={glossary}
                  studyNotes={studyNotes}
                  flashcards={flashcards}
                  animateMascot={settings.mascotAnimations}
                  onOpenBookAt={(bookId, location, query) =>
                    openBookReader(bookId, location, query)
                  }
                  onOpenSubject={handleOpenSubject}
                  onOpenGlossary={() => handleSelectSection('glossary')}
                  onOpenNotes={() => handleSelectSection('notes')}
                  onOpenFlashcards={() => handleSelectSection('flashcards')}
                />
              )}

              {activeSection === 'calendar' && (
                <CalendarView
                  events={eventsList}
                  subjects={subjects}
                  animateMascot={settings.mascotAnimations}
                  quickAddSignal={calendarQuickAdd}
                  onSaveEvent={saveCalendarEvent}
                  onToggleComplete={toggleCalendarEventComplete}
                  onDeleteEvent={deleteCalendarEvent}
                  onOpenSubject={handleOpenSubject}
                />
              )}

              {activeSection === 'glossary' && (
                <GlossaryView
                  terms={glossary}
                  animateMascot={settings.mascotAnimations}
                  onSaveTerm={saveGlossaryTerm}
                  onToggleFavorite={toggleFavoriteTerm}
                  onDeleteTerm={deleteGlossaryTerm}
                  onRestoreBuiltIn={restoreMissingBuiltInGlossary}
                />
              )}

              {activeSection === 'notes' && (
                <NotesOutlinesView
                  key={notesInitialSubject}
                  notes={studyNotes}
                  subjects={subjects}
                  books={books}
                  glossary={glossary}
                  animateMascot={settings.mascotAnimations}
                  liveBookSuggestionsEnabled={settings.liveBookSuggestions}
                  glossaryUnderlinesDefault={settings.glossaryUnderlinesDefault}
                  initialSubjectFilter={notesInitialSubject}
                  quickNewNoteSignal={quickNewNoteSignal}
                  onSaveNote={saveStudyNote}
                  onDeleteNote={deleteStudyNote}
                  onCreateFlashcardsBatch={saveFlashcardsBatch}
                />
              )}

              {activeSection === 'flashcards' && (
                <FlashcardsView
                  key={flashcardsInitialSubject}
                  cards={flashcards}
                  subjects={subjects}
                  animateMascot={settings.mascotAnimations}
                  initialSubjectFilter={flashcardsInitialSubject}
                  onSaveCard={saveFlashcard}
                  onReviewCard={reviewFlashcard}
                  onToggleNeedsReview={toggleFlashcardNeedsReview}
                  onDeleteCard={deleteFlashcard}
                />
              )}

              {activeSection === 'pomodoro' && (
                <PomodoroView
                  state={pomodoro}
                  subjects={subjects}
                  sessions={pomodoroSessions}
                  dailyGoalMinutes={settings.dailyGoalMinutes}
                  animateMascot={settings.mascotAnimations}
                  channelVolumes={channelVolumes}
                  customTrackName={customTrackName}
                  customTrackPlaying={customTrackPlaying}
                  onToggleRun={() => setPomodoro((p) => ({ ...p, running: !p.running }))}
                  onReset={() =>
                    setPomodoro((p) => ({
                      ...p,
                      phase: 'focus',
                      running: false,
                      secondsLeft: p.focusMinutes * 60,
                    }))
                  }
                  onApplyPreset={(focusMinutes, breakMinutes) =>
                    setPomodoro((p) => ({
                      ...p,
                      phase: 'focus',
                      focusMinutes,
                      breakMinutes,
                      running: false,
                      secondsLeft: focusMinutes * 60,
                    }))
                  }
                  onSelectSubject={(subjectId) => setPomodoro((p) => ({ ...p, subjectId }))}
                  onSetChannelVolume={handleSetChannelVolume}
                  onStopAllAudio={handleStopAllAudio}
                  onLoadCustomTrack={handleLoadCustomTrack}
                  onToggleCustomTrack={handleToggleCustomTrack}
                />
              )}

              {activeSection === 'settings' && (
                <SettingsView
                  settings={settings}
                  cloudSync={cloudSync}
                  onUpdateSettings={updateSettings}
                  onConnectCloud={handleConnectCloud}
                  onSyncCloudNow={() => runCloudSync(false)}
                  onDisconnectCloud={handleDisconnectCloud}
                  onRefreshCloudConfig={handleRefreshCloudConfig}
                />
              )}
            </>
          )}
        </ErrorBoundary>
      </main>

      {/* Discreet Desktop Auto-Update Ready Pill */}
      {updateReadyVersion && (
        <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white dark:bg-midnight-900 border border-accent/50 shadow-soft-lg text-xs">
          <span className="font-semibold text-[#2E1F3E] dark:text-white">
            Nueva versión lista (v{updateReadyVersion})
          </span>
          <button
            type="button"
            onClick={() => window.coldiDesktop?.installUpdateNow?.()}
            className="px-3 py-1 rounded-xl bg-accent hover:bg-accent-dark text-white font-bold transition-colors"
          >
            Reiniciar ahora
          </button>
          <button
            type="button"
            onClick={() => setUpdateReadyVersion(null)}
            className="text-[#8A76A3] hover:text-accent font-semibold px-1"
            title="Se instalará al cerrar la app"
          >
            Luego
          </button>
        </div>
      )}

      {/* Persistent Floating Mini-Bar while studying in other tabs */}
      {activeSection !== 'pomodoro' && (
        <FloatingPomodoroBar
          state={pomodoro}
          anyAudioActive={anyAudioActive}
          isMuted={isAudioMuted}
          onToggleRun={() => setPomodoro((p) => ({ ...p, running: !p.running }))}
          onToggleMute={handleToggleMute}
          onOpenPomodoro={() => handleSelectSection('pomodoro')}
        />
      )}

      {/* Automatic 24h Pre-Exam Direct Study Shortcut Modal */}
      {showStartupExamModal && (
        <ExamQuickLaunchModal
          urgentExams={examAlerts.urgentWithin24h}
          subjects={subjects}
          animateMascot={settings.mascotAnimations}
          onJumpToSubject={(subjectId) => {
            setShowStartupExamModal(false);
            setExamShortcutDismissed(true);
            handleOpenSubject(subjectId);
          }}
          onOpenCalendar={() => {
            setShowStartupExamModal(false);
            setExamShortcutDismissed(true);
            handleSelectSection('calendar');
          }}
          onDismiss={() => {
            setShowStartupExamModal(false);
            setExamShortcutDismissed(true);
          }}
        />
      )}
    </div>
  );
}

export default App;
