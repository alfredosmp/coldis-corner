import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  ArrowLeft,
  BookOpen,
  Calendar,
  Check,
  Clock,
  Edit3,
  FileText,
  GraduationCap,
  Layers,
  ListTodo,
  MoreVertical,
  Plus,
  Search,
  StickyNote,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { SUBJECT_COLOR_LIST, SUBJECT_COLORS, SUBJECT_ICONS } from '../data/subjectStyles';
import type {
  BookItem,
  CalendarEvent,
  CalendarEventType,
  Flashcard,
  StudyNote,
  Subject,
  SubjectColorId,
  SubjectIconId,
} from '../types/models';
import {
  formatExamCountdown,
  formatFriendlyDate,
  formatTime12h,
  getEventDateTime,
  getMsUntilEvent,
} from '../utils/calendar';
import { formatShortDate, normalizeText } from '../utils/text';
import { ColdiAvatar } from './ColdiAvatar';
import { SubjectIcon } from './SubjectIcon';

interface SubjectsViewProps {
  subjects: Subject[];
  books: BookItem[];
  events: CalendarEvent[];
  studyNotes: StudyNote[];
  flashcards: Flashcard[];
  defaultSemesterLabel: string;
  selectedSubjectId: string | null;
  openCreateSignal: number;
  strictDeleteConfirm: boolean;
  animateMascot: boolean;
  onSelectSubject: (id: string | null) => void;
  onSaveSubject: (subject: Omit<Subject, 'id' | 'createdAt' | 'updatedAt' | 'archived' | 'quickNotes'>, existingId?: string) => Promise<void>;
  onToggleArchive: (subject: Subject) => Promise<void>;
  onDeleteSubject: (subjectId: string) => Promise<void>;
  onUpdateQuickNotes: (subjectId: string, notes: string) => Promise<void>;
  onQuickAddEvent: (subjectId: string, type: CalendarEventType) => void;
  onOpenBook: (bookId: string) => void;
  onQuickUploadBook: (subjectId: string) => void;
  onOpenNotesForSubject: (subjectId: string) => void;
  onOpenFlashcardsForSubject: (subjectId: string) => void;
}

interface SubjectFormState {
  name: string;
  semester: string;
  professor: string;
  schedule: string;
  description: string;
  color: SubjectColorId;
  icon: SubjectIconId;
}

export function SubjectsView({
  subjects,
  books,
  events,
  studyNotes,
  flashcards,
  defaultSemesterLabel,
  selectedSubjectId,
  openCreateSignal,
  strictDeleteConfirm,
  animateMascot,
  onSelectSubject,
  onSaveSubject,
  onToggleArchive,
  onDeleteSubject,
  onUpdateQuickNotes,
  onQuickAddEvent,
  onOpenBook,
  onQuickUploadBook,
  onOpenNotesForSubject,
  onOpenFlashcardsForSubject,
}: SubjectsViewProps) {
  const [tab, setTab] = useState<'active' | 'archived'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Create / Edit modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [form, setForm] = useState<SubjectFormState>({
    name: '',
    semester: defaultSemesterLabel,
    professor: '',
    schedule: '',
    description: '',
    color: 'lavender',
    icon: 'scale',
  });

  // Safe Double-Confirmation Delete Modal state
  const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');

  // Quick notes local state in detail view
  const [notesDraft, setNotesDraft] = useState('');
  const [notesSavedToast, setNotesSavedToast] = useState(false);
  const lastSignalRef = useRef(openCreateSignal);

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId) ?? null;

  useEffect(() => {
    if (openCreateSignal > lastSignalRef.current) {
      lastSignalRef.current = openCreateSignal;
      openCreateModal();
    }
  }, [openCreateSignal]);

  useEffect(() => {
    if (selectedSubject) {
      setNotesDraft(selectedSubject.quickNotes ?? '');
    }
  }, [selectedSubject?.id]);

  // Close dropdown menu when clicking outside
  useEffect(() => {
    if (!openMenuId) return;
    const handleClick = () => setOpenMenuId(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [openMenuId]);

  function openCreateModal() {
    setEditingSubject(null);
    setForm({
      name: '',
      semester: defaultSemesterLabel,
      professor: '',
      schedule: '',
      description: '',
      color: 'lavender',
      icon: 'scale',
    });
    setIsFormOpen(true);
  }

  function openEditModal(subject: Subject) {
    setEditingSubject(subject);
    setForm({
      name: subject.name,
      semester: subject.semester,
      professor: subject.professor,
      schedule: subject.schedule,
      description: subject.description,
      color: subject.color,
      icon: subject.icon,
    });
    setOpenMenuId(null);
    setIsFormOpen(true);
  }

  async function handleSubmitForm(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;

    await onSaveSubject(
      {
        name: form.name.trim(),
        semester: form.semester.trim() || defaultSemesterLabel,
        professor: form.professor.trim(),
        schedule: form.schedule.trim(),
        description: form.description.trim(),
        color: form.color,
        icon: form.icon,
      },
      editingSubject?.id
    );
    setIsFormOpen(false);
    setEditingSubject(null);
  }

  function requestDelete(subject: Subject) {
    setOpenMenuId(null);
    setDeleteConfirmInput('');
    setDeleteTarget(subject);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    if (
      strictDeleteConfirm &&
      normalizeText(deleteConfirmInput) !== normalizeText(deleteTarget.name)
    ) {
      return;
    }
    const targetId = deleteTarget.id;
    setDeleteTarget(null);
    setDeleteConfirmInput('');
    if (selectedSubjectId === targetId) {
      onSelectSubject(null);
    }
    await onDeleteSubject(targetId);
  }

  async function handleSaveQuickNotes() {
    if (!selectedSubject) return;
    await onUpdateQuickNotes(selectedSubject.id, notesDraft);
    setNotesSavedToast(true);
    setTimeout(() => setNotesSavedToast(false), 1800);
  }

  const activeCount = subjects.filter((s) => !s.archived).length;
  const archivedCount = subjects.filter((s) => s.archived).length;

  const filteredSubjects = subjects.filter((s) => {
    const matchesTab = tab === 'active' ? !s.archived : s.archived;
    if (!matchesTab) return false;
    if (!searchQuery.trim()) return true;
    const q = normalizeText(searchQuery);
    return (
      normalizeText(s.name).includes(q) ||
      normalizeText(s.semester).includes(q) ||
      normalizeText(s.professor).includes(q)
    );
  });

  // === SUBJECT DETAIL WORKSPACE ===
  if (selectedSubject) {
    const palette = SUBJECT_COLORS[selectedSubject.color] ?? SUBJECT_COLORS.lavender;
    const isMenuOpen = openMenuId === selectedSubject.id;

    return (
      <div className="space-y-6 pb-10">
        {/* Back button */}
        <button
          onClick={() => onSelectSubject(null)}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#6D588A] dark:text-[#BBA9D3] hover:text-accent dark:hover:text-lavender-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver a Materias</span>
        </button>

        {/* Subject Banner */}
        <div className={`relative rounded-3xl p-6 border shadow-soft ${palette.cardBg} ${palette.border}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0">
              <div className={`p-3.5 rounded-2xl shrink-0 ${palette.badgeBg} ${palette.badgeText}`}>
                <SubjectIcon icon={selectedSubject.icon} className="w-7 h-7" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${palette.badgeBg} ${palette.badgeText}`}>
                    {selectedSubject.semester}
                  </span>
                  {selectedSubject.archived && (
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white/80 dark:bg-midnight-900/70 text-[#6D588A] dark:text-[#C5B5DA]">
                      Archivada
                    </span>
                  )}
                </div>
                <h1 className="font-display font-bold text-2xl sm:text-3xl text-[#2E1F3E] dark:text-white">
                  {selectedSubject.name}
                </h1>
                {selectedSubject.description && (
                  <p className="text-sm text-[#5F4B78] dark:text-[#C8B9DC] mt-1.5 max-w-2xl">
                    {selectedSubject.description}
                  </p>
                )}
                <div className="flex flex-wrap gap-4 mt-3 text-xs font-medium text-[#6C5788] dark:text-[#B9A7D1]">
                  {selectedSubject.professor && (
                    <span className="inline-flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" />
                      Prof. {selectedSubject.professor}
                    </span>
                  )}
                  {selectedSubject.schedule && (
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {selectedSubject.schedule}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Discreet 3-dots menu in corner */}
            <div className="relative shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenMenuId(isMenuOpen ? null : selectedSubject.id);
                }}
                className="p-2 rounded-xl bg-white/70 dark:bg-midnight-900/60 hover:bg-white dark:hover:bg-midnight-800 text-[#6B5487] dark:text-[#C9B9DE] transition-colors"
                title="Opciones de la materia"
                aria-label="Opciones de la materia"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {isMenuOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-midnight-900 border border-lavender-200 dark:border-midnight-700 shadow-soft-lg py-1.5 z-30"
                >
                  <button
                    onClick={() => openEditModal(selectedSubject)}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#3F2D57] dark:text-[#E8DEF6] hover:bg-lavender-50 dark:hover:bg-midnight-800"
                  >
                    <Edit3 className="w-4 h-4 text-accent dark:text-lavender-300" />
                    <span>Editar información</span>
                  </button>
                  <button
                    onClick={() => {
                      setOpenMenuId(null);
                      onToggleArchive(selectedSubject);
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#3F2D57] dark:text-[#E8DEF6] hover:bg-lavender-50 dark:hover:bg-midnight-800"
                  >
                    {selectedSubject.archived ? (
                      <>
                        <ArchiveRestore className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>Restaurar al semestre</span>
                      </>
                    ) : (
                      <>
                        <Archive className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <span>Archivar semestre</span>
                      </>
                    )}
                  </button>
                  <div className="my-1 border-t border-lavender-100 dark:border-midnight-800" />
                  <button
                    onClick={() => requestDelete(selectedSubject)}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Eliminar definitivamente</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Linked Upcoming Exams & Tasks for this Subject */}
        {(() => {
          const subjectEvents = events
            .filter(
              (ev) =>
                ev.subjectId === selectedSubject.id &&
                !ev.completed &&
                (ev.type === 'task' || getMsUntilEvent(ev) > 0)
            )
            .sort((a, b) => getEventDateTime(a).getTime() - getEventDateTime(b).getTime());

          return (
            <div className="rounded-3xl p-4 sm:p-5 bg-white dark:bg-midnight-900 border border-lavender-200/80 dark:border-midnight-700 shadow-soft space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-accent dark:text-lavender-300" />
                  <h2 className="font-display font-bold text-sm text-[#2E1F3E] dark:text-white">
                    Exámenes y tareas de {selectedSubject.name}
                  </h2>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onQuickAddEvent(selectedSubject.id, 'task')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-lavender-50 dark:bg-midnight-850 hover:bg-lavender-100 dark:hover:bg-midnight-800 text-[11px] font-bold text-accent dark:text-lavender-300 transition-colors"
                  >
                    <ListTodo className="w-3.5 h-3.5" />
                    <span>+ Tarea</span>
                  </button>
                  <button
                    onClick={() => onQuickAddEvent(selectedSubject.id, 'exam')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blush-100/90 dark:bg-[#41203B] hover:bg-blush-200/80 text-[11px] font-bold text-blush-600 dark:text-blush-200 transition-colors"
                  >
                    <GraduationCap className="w-3.5 h-3.5" />
                    <span>+ Examen</span>
                  </button>
                </div>
              </div>

              {subjectEvents.length === 0 ? (
                <p className="text-xs text-[#7E6B96] dark:text-[#A995C4]">
                  Sin exámenes ni tareas pendientes para esta materia.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {subjectEvents.slice(0, 4).map((ev) => {
                    const isExam = ev.type === 'exam';
                    return (
                      <div
                        key={ev.id}
                        className={`rounded-2xl px-3.5 py-2.5 border text-xs space-y-1 ${
                          isExam
                            ? 'bg-blush-50/85 dark:bg-[#311A2E] border-blush-200 dark:border-[#532E4E]'
                            : 'bg-lavender-50/70 dark:bg-midnight-850 border-lavender-200/70 dark:border-midnight-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`font-bold ${
                              isExam
                                ? 'text-blush-600 dark:text-blush-300'
                                : 'text-accent dark:text-lavender-300'
                            }`}
                          >
                            {isExam ? `Examen · ${formatExamCountdown(ev)}` : 'Tarea'}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] text-[#735F8C] dark:text-[#B4A3CB]">
                            <Clock className="w-3 h-3" />
                            {formatFriendlyDate(ev.date)}
                            {ev.time ? ` · ${formatTime12h(ev.time)}` : ''}
                          </span>
                        </div>
                        <p className="font-bold text-sm text-[#2E1F3E] dark:text-white truncate">
                          {ev.title}
                        </p>
                        {ev.notes && (
                          <p className="text-[11px] text-[#6E5B85] dark:text-[#BBA9D3] line-clamp-2">
                            {ev.notes}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* Quick Notes Workspace (Live offline persistence!) */}
        <div className="rounded-3xl p-5 sm:p-6 bg-white dark:bg-midnight-900 border border-lavender-200/80 dark:border-midnight-700 shadow-soft space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <StickyNote className="w-5 h-5 text-accent dark:text-lavender-300" />
              <div>
                <h2 className="font-display font-bold text-base text-[#2E1F3E] dark:text-white">
                  Bloc rápido de la materia
                </h2>
                <p className="text-xs text-[#7B6794] dark:text-[#A894C2]">
                  Guarda fechas de examen, temas clave, artículos o pendientes offline
                </p>
              </div>
            </div>

            <button
              onClick={handleSaveQuickNotes}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-accent hover:bg-accent-dark text-white text-xs font-semibold transition-all"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{notesSavedToast ? '¡Guardado!' : 'Guardar notas'}</span>
            </button>
          </div>

          <textarea
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            onBlur={handleSaveQuickNotes}
            rows={6}
            placeholder="Ejemplo: Examen final el viernes · Repasar Art. 14 y 16 CPEUM, suspensión provisional vs. definitiva..."
            className="w-full rounded-2xl p-4 bg-lavender-50/70 dark:bg-midnight-850 border border-lavender-200/80 dark:border-midnight-700 text-sm text-[#2E1F3E] dark:text-[#F0E8FA] placeholder:text-[#9D8AB5] focus:outline-none focus:ring-2 focus:ring-lavender-400/50 resize-y leading-relaxed"
          />
        </div>

        {/* Linked Books & Documents (LIVE in Phase 2) */}
        {(() => {
          const subjectBooks = books.filter((b) => b.subjectId === selectedSubject.id);
          return (
            <div className="rounded-3xl p-5 bg-white dark:bg-midnight-900 border border-lavender-200/80 dark:border-midnight-700 shadow-soft space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-accent dark:text-lavender-300" />
                  <h2 className="font-display font-bold text-base text-[#2E1F3E] dark:text-white">
                    Libros y documentos de {selectedSubject.name}
                  </h2>
                </div>
                <button
                  onClick={() => onQuickUploadBook(selectedSubject.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent hover:bg-accent-dark text-white text-xs font-semibold transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Subir PDF / Word / EPUB</span>
                </button>
              </div>

              {subjectBooks.length === 0 ? (
                <p className="text-xs text-[#7A6693] dark:text-[#A995C4]">
                  Todavía no has ligado libros ni documentos de Word a esta materia. Súbelos aquí para abrirlos directo cuando estudies.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {subjectBooks.map((book) => {
                    const pct = Math.round(
                      ((book.currentLocation || 1) / Math.max(1, book.totalLocations || 1)) * 100
                    );
                    return (
                      <button
                        key={book.id}
                        onClick={() => onOpenBook(book.id)}
                        className="text-left p-3.5 rounded-2xl bg-lavender-50/70 dark:bg-midnight-850 border border-lavender-200/70 dark:border-midnight-700 hover:border-accent/60 flex items-center gap-3 transition-all"
                      >
                        <div className="w-10 h-12 rounded-xl overflow-hidden shrink-0 bg-lavender-100 dark:bg-midnight-800 flex items-center justify-center">
                          {book.coverDataUrl ? (
                            <img src={book.coverDataUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <BookOpen className="w-4 h-4 text-accent dark:text-lavender-300" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="font-display font-bold text-xs sm:text-sm text-[#2E1F3E] dark:text-white truncate">
                            {book.title}
                          </p>
                          <p className="text-[11px] text-[#7A6693] dark:text-[#A995C4]">
                            {book.format.toUpperCase()} · {pct}%
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* Connected Study Tools (LIVE in Phase 3) */}
        {(() => {
          const subjectNotes = studyNotes.filter((n) => n.subjectId === selectedSubject.id);
          const subjectCards = flashcards.filter((c) => c.subjectId === selectedSubject.id);
          const dueCards = subjectCards.filter((c) => c.nextReviewAt <= Date.now()).length;

          return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => onOpenNotesForSubject(selectedSubject.id)}
                className="text-left rounded-3xl p-5 bg-white dark:bg-midnight-900 border border-lavender-200/80 dark:border-midnight-700/80 hover:border-accent/60 shadow-soft space-y-2 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="inline-flex p-2.5 rounded-xl bg-blush-100 dark:bg-[#3A2135] text-blush-500 dark:text-blush-300">
                    <FileText className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-accent dark:text-lavender-300 group-hover:underline">
                    Abrir →
                  </span>
                </div>
                <h3 className="font-display font-bold text-base text-[#2E1F3E] dark:text-white">
                  Apuntes y Esquemas ({subjectNotes.length})
                </h3>
                <p className="text-xs text-[#7A6693] dark:text-[#A995C4] leading-relaxed">
                  {subjectNotes.length > 0
                    ? `Tienes ${subjectNotes.length} apuntes ligados a ${selectedSubject.name}.`
                    : `Toma apuntes tipo Word con tus libros al lado para ${selectedSubject.name}.`}
                </p>
              </button>

              <button
                onClick={() => onOpenFlashcardsForSubject(selectedSubject.id)}
                className="text-left rounded-3xl p-5 bg-white dark:bg-midnight-900 border border-lavender-200/80 dark:border-midnight-700/80 hover:border-accent/60 shadow-soft space-y-2 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="inline-flex p-2.5 rounded-xl bg-sky-100 dark:bg-[#1B2F42] text-sky-600 dark:text-sky-300">
                    <Layers className="w-5 h-5" />
                  </div>
                  {dueCards > 0 ? (
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blush-500 text-white">
                      {dueCards} por repasar
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-accent dark:text-lavender-300 group-hover:underline">
                      Abrir →
                    </span>
                  )}
                </div>
                <h3 className="font-display font-bold text-base text-[#2E1F3E] dark:text-white">
                  Flashcards ({subjectCards.length})
                </h3>
                <p className="text-xs text-[#7A6693] dark:text-[#A995C4] leading-relaxed">
                  {subjectCards.length > 0
                    ? `Repasa tus tarjetas con repetición espaciada y modo ocultar palabras.`
                    : `Crea flashcards de artículos, plazos y conceptos para ${selectedSubject.name}.`}
                </p>
              </button>
            </div>
          );
        })()}

        {/* Modals rendered at bottom */}
        {renderModals()}
      </div>
    );
  }

  function renderModals() {
    const canConfirmDelete =
      deleteTarget !== null &&
      (!strictDeleteConfirm ||
        normalizeText(deleteConfirmInput) === normalizeText(deleteTarget.name));

    return (
      <>
        {/* Create / Edit Subject Modal */}
        {isFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1D112C]/50 backdrop-blur-sm">
            <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-midnight-900 border border-lavender-200 dark:border-midnight-700 shadow-soft-lg p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-xl text-[#2E1F3E] dark:text-white">
                  {editingSubject ? 'Editar materia' : 'Nueva materia'}
                </h2>
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="p-2 rounded-xl text-[#7E6B96] hover:bg-lavender-100 dark:hover:bg-midnight-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitForm} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#6D588A] dark:text-[#BAA8D1] mb-1.5">
                    Nombre de la materia *
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ej. Derecho Constitucional, Amparo I, Civil II..."
                    className="w-full px-4 py-2.5 rounded-2xl bg-lavender-50 dark:bg-midnight-850 border border-lavender-200 dark:border-midnight-700 text-sm text-[#2E1F3E] dark:text-white focus:outline-none focus:ring-2 focus:ring-lavender-400"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#6D588A] dark:text-[#BAA8D1] mb-1.5">
                      Semestre / Periodo
                    </label>
                    <input
                      type="text"
                      value={form.semester}
                      onChange={(e) => setForm({ ...form, semester: e.target.value })}
                      placeholder="Ej. 5.º Semestre"
                      className="w-full px-4 py-2.5 rounded-2xl bg-lavender-50 dark:bg-midnight-850 border border-lavender-200 dark:border-midnight-700 text-sm text-[#2E1F3E] dark:text-white focus:outline-none focus:ring-2 focus:ring-lavender-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#6D588A] dark:text-[#BAA8D1] mb-1.5">
                      Profesor(a) (opcional)
                    </label>
                    <input
                      type="text"
                      value={form.professor}
                      onChange={(e) => setForm({ ...form, professor: e.target.value })}
                      placeholder="Ej. Lic. Martínez"
                      className="w-full px-4 py-2.5 rounded-2xl bg-lavender-50 dark:bg-midnight-850 border border-lavender-200 dark:border-midnight-700 text-sm text-[#2E1F3E] dark:text-white focus:outline-none focus:ring-2 focus:ring-lavender-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#6D588A] dark:text-[#BAA8D1] mb-1.5">
                    Horario / Aula (opcional)
                  </label>
                  <input
                    type="text"
                    value={form.schedule}
                    onChange={(e) => setForm({ ...form, schedule: e.target.value })}
                    placeholder="Ej. Lun y Mié 9:00 - 11:00 · Salón 204"
                    className="w-full px-4 py-2.5 rounded-2xl bg-lavender-50 dark:bg-midnight-850 border border-lavender-200 dark:border-midnight-700 text-sm text-[#2E1F3E] dark:text-white focus:outline-none focus:ring-2 focus:ring-lavender-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#6D588A] dark:text-[#BAA8D1] mb-1.5">
                    Descripción breve (opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Temario principal o notas de la materia..."
                    className="w-full px-4 py-2.5 rounded-2xl bg-lavender-50 dark:bg-midnight-850 border border-lavender-200 dark:border-midnight-700 text-sm text-[#2E1F3E] dark:text-white focus:outline-none focus:ring-2 focus:ring-lavender-400 resize-none"
                  />
                </div>

                {/* Pastel Color Picker */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#6D588A] dark:text-[#BAA8D1] mb-2">
                    Color pastel
                  </label>
                  <div className="flex flex-wrap gap-2.5">
                    {SUBJECT_COLOR_LIST.map((swatch) => {
                      const active = form.color === swatch.id;
                      return (
                        <button
                          key={swatch.id}
                          type="button"
                          onClick={() => setForm({ ...form, color: swatch.id })}
                          title={swatch.label}
                          className={`w-9 h-9 rounded-full flex items-center justify-center transition-transform ${
                            active ? 'scale-110 ring-2 ring-offset-2 ring-accent dark:ring-offset-midnight-900' : 'hover:scale-105'
                          }`}
                          style={{ backgroundColor: swatch.swatch }}
                        >
                          {active && <Check className="w-4 h-4 text-[#2E1F3E]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Icon Picker */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#6D588A] dark:text-[#BAA8D1] mb-2">
                    Ícono
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {SUBJECT_ICONS.map((iconOpt) => {
                      const active = form.icon === iconOpt.id;
                      return (
                        <button
                          key={iconOpt.id}
                          type="button"
                          onClick={() => setForm({ ...form, icon: iconOpt.id })}
                          className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl border text-xs font-medium transition-all ${
                            active
                              ? 'bg-accent text-white border-accent shadow-soft'
                              : 'bg-lavender-50 dark:bg-midnight-850 text-[#594473] dark:text-[#CBBCE0] border-lavender-200 dark:border-midnight-700 hover:border-lavender-400'
                          }`}
                        >
                          <SubjectIcon icon={iconOpt.id} className="w-4 h-4" />
                          <span className="truncate">{iconOpt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-lavender-100 dark:border-midnight-800">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-4 py-2.5 rounded-2xl text-sm font-semibold text-[#6E5B85] dark:text-[#BBA9D3] hover:bg-lavender-100 dark:hover:bg-midnight-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-2xl bg-accent hover:bg-accent-dark text-white text-sm font-semibold shadow-soft transition-colors"
                  >
                    {editingSubject ? 'Guardar cambios' : 'Crear materia'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Double-Confirmation Safe Delete Modal */}
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1D112C]/60 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-3xl bg-white dark:bg-midnight-900 border border-rose-200 dark:border-rose-900/60 shadow-soft-lg p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="font-display font-bold text-lg text-[#2E1F3E] dark:text-white">
                    ¿Eliminar materia definitivamente?
                  </h2>
                  <p className="text-xs text-[#6E5B85] dark:text-[#B9A7D1] mt-1 leading-relaxed">
                    Esta acción no se puede deshacer. Si solo terminó el semestre, te recomendamos{' '}
                    <strong className="text-accent dark:text-lavender-300">Archivarla</strong> para conservar tus notas y poder consultarlas después.
                  </p>
                </div>
              </div>

              {!deleteTarget.archived && (
                <button
                  type="button"
                  onClick={async () => {
                    const target = deleteTarget;
                    setDeleteTarget(null);
                    await onToggleArchive(target);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl bg-lavender-100 dark:bg-midnight-800 hover:bg-lavender-200/80 text-accent dark:text-lavender-300 text-xs font-bold transition-colors"
                >
                  <Archive className="w-4 h-4" />
                  <span>Mejor archivar "{deleteTarget.name}" sin perder datos</span>
                </button>
              )}

              {strictDeleteConfirm && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[#5B4774] dark:text-[#C8B9DC]">
                    Para confirmar el borrado, escribe exactamente:{' '}
                    <strong className="text-rose-600 dark:text-rose-400">{deleteTarget.name}</strong>
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmInput}
                    onChange={(e) => setDeleteConfirmInput(e.target.value)}
                    placeholder={deleteTarget.name}
                    className="w-full px-4 py-2.5 rounded-2xl bg-rose-50/60 dark:bg-midnight-850 border border-rose-200 dark:border-rose-900/60 text-sm text-[#2E1F3E] dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-400"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2.5 rounded-2xl text-sm font-semibold text-[#6E5B85] dark:text-[#BBA9D3] hover:bg-lavender-100 dark:hover:bg-midnight-800"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!canConfirmDelete}
                  onClick={confirmDelete}
                  className="px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
                >
                  Eliminar para siempre
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // === SUBJECTS LIST GRID ===
  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="font-display font-bold text-2xl sm:text-3xl text-[#2E1F3E] dark:text-white">
          Materias
        </h1>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-accent hover:bg-accent-dark text-white text-sm font-semibold shadow-soft transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva materia</span>
        </button>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="inline-flex p-1 rounded-2xl bg-white dark:bg-midnight-900 border border-lavender-200/80 dark:border-midnight-700 self-start">
          <button
            onClick={() => setTab('active')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              tab === 'active'
                ? 'bg-accent text-white shadow-sm'
                : 'text-[#6C5788] dark:text-[#B9A7D1] hover:text-accent'
            }`}
          >
            Semestre Actual ({activeCount})
          </button>
          <button
            onClick={() => setTab('archived')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              tab === 'archived'
                ? 'bg-accent text-white shadow-sm'
                : 'text-[#6C5788] dark:text-[#B9A7D1] hover:text-accent'
            }`}
          >
            Archivadas ({archivedCount})
          </button>
        </div>

        <div className="relative flex-1 sm:max-w-xs">
          <Search className="w-4 h-4 text-[#9B89B3] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrar materia o profesor..."
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white dark:bg-midnight-900 border border-lavender-200/80 dark:border-midnight-700 text-sm text-[#2E1F3E] dark:text-white placeholder:text-[#9D8AB5] focus:outline-none focus:ring-2 focus:ring-lavender-400/50"
          />
        </div>
      </div>

      {/* Grid */}
      {filteredSubjects.length === 0 ? (
        <div className="rounded-3xl p-10 text-center bg-white dark:bg-midnight-900 border border-dashed border-lavender-300 dark:border-midnight-700 space-y-3">
          <div className="flex justify-center">
            <ColdiAvatar pose="writing" size="lg" floating={animateMascot} />
          </div>
          <h3 className="font-display font-bold text-lg text-[#2E1F3E] dark:text-white">
            {tab === 'active'
              ? searchQuery
                ? 'No se encontraron materias con ese filtro'
                : 'Todavía no hay materias en este semestre'
              : 'No tienes materias archivadas'}
          </h3>
          <p className="text-sm text-[#735F8C] dark:text-[#A996C3] max-w-md mx-auto">
            {tab === 'active'
              ? 'Da de alta tus materias actuales para empezar a organizar tus apuntes y libros.'
              : 'Cuando cierres un semestre, archiva tus materias desde el menú de tres puntitos (⋮) para guardarlas aquí.'}
          </p>
          {tab === 'active' && !searchQuery && (
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-accent hover:bg-accent-dark text-white text-sm font-semibold shadow-soft"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar materia</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredSubjects.map((subject) => {
            const palette = SUBJECT_COLORS[subject.color] ?? SUBJECT_COLORS.lavender;
            const isMenuOpen = openMenuId === subject.id;

            return (
              <div
                key={subject.id}
                onClick={() => onSelectSubject(subject.id)}
                className={`relative group cursor-pointer rounded-3xl p-5 border transition-all hover:-translate-y-0.5 hover:shadow-soft ${palette.cardBg} ${palette.border}`}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className={`p-3 rounded-2xl ${palette.badgeBg} ${palette.badgeText}`}>
                    <SubjectIcon icon={subject.icon} className="w-5 h-5" />
                  </div>

                  {/* Discreet 3-dots menu in top-right corner */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(isMenuOpen ? null : subject.id);
                      }}
                      className="p-1.5 rounded-xl text-[#7D6997] dark:text-[#BCAAD2] hover:bg-white/80 dark:hover:bg-midnight-900/70 transition-colors"
                      title="Más opciones"
                      aria-label={`Opciones de ${subject.name}`}
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {isMenuOpen && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 mt-1.5 w-52 rounded-2xl bg-white dark:bg-midnight-900 border border-lavender-200 dark:border-midnight-700 shadow-soft-lg py-1.5 z-30"
                      >
                        <button
                          onClick={() => openEditModal(subject)}
                          className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-[#3F2D57] dark:text-[#E8DEF6] hover:bg-lavender-50 dark:hover:bg-midnight-800"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-accent dark:text-lavender-300" />
                          <span>Editar materia</span>
                        </button>
                        <button
                          onClick={() => {
                            setOpenMenuId(null);
                            onToggleArchive(subject);
                          }}
                          className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-[#3F2D57] dark:text-[#E8DEF6] hover:bg-lavender-50 dark:hover:bg-midnight-800"
                        >
                          {subject.archived ? (
                            <>
                              <ArchiveRestore className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span>Restaurar al semestre</span>
                            </>
                          ) : (
                            <>
                              <Archive className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                              <span>Archivar semestre</span>
                            </>
                          )}
                        </button>
                        <div className="my-1 border-t border-lavender-100 dark:border-midnight-800" />
                        <button
                          onClick={() => requestDelete(subject)}
                          className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Eliminar definitivamente</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <span className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full mb-2 ${palette.badgeBg} ${palette.badgeText}`}>
                  {subject.semester}
                </span>

                <h3 className="font-display font-bold text-lg text-[#2E1F3E] dark:text-white leading-snug">
                  {subject.name}
                </h3>

                {subject.description && (
                  <p className="text-xs text-[#65527E] dark:text-[#B9A7D1] line-clamp-2 mt-1.5 leading-relaxed">
                    {subject.description}
                  </p>
                )}

                <div className="mt-4 pt-3 border-t border-black/5 dark:border-white/10 flex items-center justify-between text-[11px] text-[#735F8C] dark:text-[#B19FC9]">
                  <span className="truncate">
                    {subject.professor ? `Prof. ${subject.professor}` : 'Toca para abrir'}
                  </span>
                  <span className="shrink-0 ml-2">{formatShortDate(subject.updatedAt)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {renderModals()}
    </div>
  );
}
