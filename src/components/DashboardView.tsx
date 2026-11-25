import {
  ArrowRight,
  BellRing,
  BookOpen,
  Check,
  Clock,
  GraduationCap,
  PenLine,
  Plus,
  Star,
} from 'lucide-react';
import { BRAND_CONFIG, getPersonalSubtitle } from '../config/brand';
import { SUBJECT_COLORS } from '../data/subjectStyles';
import type {
  AppSettings,
  BookItem,
  CalendarEvent,
  GlossaryTerm,
  NavSection,
  Subject,
} from '../types/models';
import {
  classifyExamAlerts,
  formatExamCountdown,
  formatFriendlyDate,
  formatTime12h,
  getEventDateTime,
} from '../utils/calendar';
import { getTimeGreeting } from '../utils/text';
import { ColdiAvatar } from './ColdiAvatar';
import { SubjectIcon } from './SubjectIcon';

interface DashboardViewProps {
  settings: AppSettings;
  subjects: Subject[];
  books: BookItem[];
  glossary: GlossaryTerm[];
  events: CalendarEvent[];
  nowTick: number;
  onNavigate: (section: NavSection) => void;
  onOpenSubject: (subjectId: string) => void;
  onOpenBook: (bookId: string) => void;
  onCreateSubject: () => void;
  onQuickNewNote: () => void;
  onToggleFavoriteTerm: (term: GlossaryTerm) => void;
  onToggleEventComplete: (event: CalendarEvent) => void;
}

export function DashboardView({
  settings,
  subjects,
  books,
  glossary,
  events,
  nowTick,
  onNavigate,
  onOpenSubject,
  onOpenBook,
  onCreateSubject,
  onQuickNewNote,
  onToggleFavoriteTerm,
  onToggleEventComplete,
}: DashboardViewProps) {
  const activeSubjects = subjects.filter((s) => !s.archived);
  const subjectMap = new Map(subjects.map((s) => [s.id, s]));

  const { urgentWithin24h, upcomingSoon } = classifyExamAlerts(
    events,
    settings.examReminderDays,
    nowTick
  );

  const pendingTasks = events
    .filter((e) => e.type === 'task' && !e.completed)
    .sort((a, b) => getEventDateTime(a).getTime() - getEventDateTime(b).getTime());

  const recentBooks = [...books]
    .sort((a, b) => (b.lastOpenedAt ?? b.createdAt) - (a.lastOpenedAt ?? a.createdAt))
    .slice(0, 2);

  // Deterministic "Legal Term of the Day" based on current date
  const daySeed = Math.floor(nowTick / (1000 * 60 * 60 * 24));
  const termOfTheDay = glossary.length > 0 ? glossary[daySeed % glossary.length] : null;

  return (
    <div className="space-y-5 pb-8">
      {/* Priority <24h Exam Direct Study Shortcut Card */}
      {urgentWithin24h.length > 0 && (
        <section className="rounded-3xl p-5 bg-gradient-to-r from-blush-100/90 via-white to-lavender-100/90 dark:from-[#3A1E36] dark:via-midnight-900 dark:to-[#2B1F40] border border-blush-300/80 dark:border-blush-700/60 shadow-soft space-y-3">
          {urgentWithin24h.map((exam) => {
            const subj = exam.subjectId ? subjectMap.get(exam.subjectId) : undefined;
            return (
              <div
                key={exam.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <ColdiAvatar pose="thinking" size="md" floating={settings.mascotAnimations} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blush-500 text-white text-[11px] font-bold">
                        <GraduationCap className="w-3 h-3" />
                        Examen {formatExamCountdown(exam, nowTick).toLowerCase()}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#6D588A] dark:text-[#D1C1E5]">
                        <Clock className="w-3.5 h-3.5" />
                        {formatFriendlyDate(exam.date)}
                        {exam.time ? ` · ${formatTime12h(exam.time)}` : ''}
                      </span>
                    </div>
                    <h2 className="font-display font-bold text-lg text-[#2E1F3E] dark:text-white truncate">
                      {exam.title}
                      {subj ? ` · ${subj.name}` : ''}
                    </h2>
                    {exam.notes && (
                      <p className="text-xs text-[#6E5B85] dark:text-[#C4B4DA] truncate">
                        {exam.notes}
                      </p>
                    )}
                  </div>
                </div>

                {subj ? (
                  <button
                    onClick={() => onOpenSubject(subj.id)}
                    className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-accent hover:bg-accent-dark text-white text-xs sm:text-sm font-bold shadow-soft transition-all"
                  >
                    <span>Seguir estudiando {subj.name}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => onNavigate('calendar')}
                    className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-accent hover:bg-accent-dark text-white text-xs font-bold shadow-soft"
                  >
                    <span>Ver en Calendario</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* Gentle 2-3 Days Ahead Exam Reminder Strip */}
      {upcomingSoon.length > 0 && (
        <section className="rounded-2xl px-4 py-3 bg-lavender-100/75 dark:bg-midnight-850 border border-lavender-200/80 dark:border-midnight-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <BellRing className="w-4 h-4 text-accent dark:text-lavender-300 shrink-0" />
            <p className="text-xs sm:text-sm text-[#4A3861] dark:text-[#DFD5EF] truncate">
              <strong className="font-bold">{upcomingSoon[0].title}</strong>{' '}
              ({formatExamCountdown(upcomingSoon[0], nowTick).toLowerCase()} ·{' '}
              {formatFriendlyDate(upcomingSoon[0].date)}) — ¿repasamos un ratito?
            </p>
          </div>
          {upcomingSoon[0].subjectId ? (
            <button
              onClick={() => onOpenSubject(upcomingSoon[0].subjectId!)}
              className="shrink-0 inline-flex items-center gap-1 text-xs font-bold text-accent dark:text-lavender-300 hover:underline self-end sm:self-auto"
            >
              <span>Ir a {subjectMap.get(upcomingSoon[0].subjectId)?.name ?? 'la materia'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={() => onNavigate('calendar')}
              className="shrink-0 inline-flex items-center gap-1 text-xs font-bold text-accent dark:text-lavender-300 hover:underline self-end sm:self-auto"
            >
              <span>Ver agenda</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </section>
      )}

      {/* Personal Minimalist Welcome Header */}
      <section className="relative overflow-hidden rounded-3xl px-6 py-5 bg-gradient-to-r from-lavender-100/80 via-white to-blush-50/80 dark:from-midnight-850 dark:via-midnight-900 dark:to-[#271B36] border border-lavender-200/75 dark:border-midnight-700/80">
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-5 min-w-0">
            <ColdiAvatar pose="reading" size="lg" floating={settings.mascotAnimations} />

            <div className="min-w-0 space-y-1">
              <h1 className="font-display font-bold text-2xl sm:text-3xl text-[#2E1F3E] dark:text-[#F6F0FC] tracking-tight">
                {getTimeGreeting()}, {BRAND_CONFIG.studentName}!
              </h1>
              <p className="text-sm text-[#6E5B85] dark:text-[#B9A7D1]">
                {getPersonalSubtitle()}
              </p>
            </div>
          </div>

          <button
            onClick={onQuickNewNote}
            className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-accent hover:bg-accent-dark text-white text-xs sm:text-sm font-bold shadow-soft transition-all active:scale-[0.98]"
          >
            <PenLine className="w-4 h-4" />
            <span>Empezar apunte</span>
          </button>
        </div>
      </section>

      {/* Main Content Area: Subjects + Recent Books + Tasks + Daily Legal Term */}
      <div className={`grid grid-cols-1 ${settings.showDailyTerm ? 'xl:grid-cols-3' : ''} gap-6`}>
        <div className={`${settings.showDailyTerm ? 'xl:col-span-2' : ''} space-y-6`}>
          {/* Active Subjects */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display font-bold text-lg text-[#2E1F3E] dark:text-white">
                  Tus materias
                </h2>
                <p className="text-xs text-[#735F8C] dark:text-[#A996C3]">
                  Elige una para seguir con tus notas y libros
                </p>
              </div>
              <button
                onClick={() => onNavigate('subjects')}
                className="text-xs font-semibold text-accent dark:text-lavender-300 hover:underline inline-flex items-center gap-1"
              >
                <span>Ver todas</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {activeSubjects.length === 0 ? (
              <div className="rounded-3xl p-8 text-center bg-white dark:bg-midnight-900 border border-dashed border-lavender-300/90 dark:border-midnight-700 space-y-3">
                <div className="flex justify-center">
                  <ColdiAvatar pose="writing" size="lg" floating={settings.mascotAnimations} />
                </div>
                <h3 className="font-display font-bold text-base text-[#2E1F3E] dark:text-white">
                  Aún no has agregado materias
                </h3>
                <p className="text-sm text-[#735F8C] dark:text-[#A996C3] max-w-sm mx-auto">
                  Da de alta tus materias de este semestre para empezar a guardar tus libros y exámenes.
                </p>
                <button
                  onClick={onCreateSubject}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-accent hover:bg-accent-dark text-white text-sm font-semibold shadow-soft transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Crear mi primera materia</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {activeSubjects.slice(0, 6).map((subject) => {
                  const palette = SUBJECT_COLORS[subject.color] ?? SUBJECT_COLORS.lavender;
                  return (
                    <button
                      key={subject.id}
                      onClick={() => onOpenSubject(subject.id)}
                      className={`text-left p-4 rounded-2xl border transition-all hover:-translate-y-0.5 hover:shadow-soft ${palette.cardBg} ${palette.border}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2.5 rounded-xl shrink-0 ${palette.badgeBg} ${palette.badgeText}`}>
                          <SubjectIcon icon={subject.icon} className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span
                            className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-1 ${palette.badgeBg} ${palette.badgeText}`}
                          >
                            {subject.semester || settings.currentSemesterLabel}
                          </span>
                          <h3 className="font-display font-bold text-base text-[#2E1F3E] dark:text-white truncate">
                            {subject.name}
                          </h3>
                          {subject.professor && (
                            <p className="text-xs text-[#6E5B85] dark:text-[#BBAAD0] truncate mt-0.5">
                              Prof. {subject.professor}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Continue Reading Strip (only shown when she has books) */}
          {recentBooks.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-base text-[#2E1F3E] dark:text-white">
                  Seguir leyendo
                </h2>
                <button
                  onClick={() => onNavigate('library')}
                  className="text-xs font-semibold text-accent dark:text-lavender-300 hover:underline inline-flex items-center gap-1"
                >
                  <span>Ir a Biblioteca</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {recentBooks.map((book) => {
                  const pct = Math.round(
                    ((book.currentLocation || 1) / Math.max(1, book.totalLocations || 1)) * 100
                  );
                  return (
                    <button
                      key={book.id}
                      onClick={() => onOpenBook(book.id)}
                      className="text-left p-3.5 rounded-2xl bg-white dark:bg-midnight-900 border border-lavender-200/80 dark:border-midnight-700 hover:border-accent/50 shadow-soft flex items-center gap-3 transition-all"
                    >
                      <div className="w-11 h-14 rounded-xl overflow-hidden shrink-0 bg-lavender-100 dark:bg-midnight-800 flex items-center justify-center">
                        {book.coverDataUrl ? (
                          <img src={book.coverDataUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <BookOpen className="w-5 h-5 text-accent dark:text-lavender-300" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="font-display font-bold text-sm text-[#2E1F3E] dark:text-white truncate">
                          {book.title}
                        </p>
                        <p className="text-[11px] text-[#7A6693] dark:text-[#A995C4]">
                          {book.format.toUpperCase()} · {book.format === 'pdf' ? 'Pág.' : 'Sec.'}{' '}
                          {book.currentLocation}/{book.totalLocations} ({pct}%)
                        </p>
                        <div className="h-1 rounded-full bg-lavender-100 dark:bg-midnight-800 overflow-hidden">
                          <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(5, pct)}%` }} />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Compact Upcoming Tasks */}
          {pendingTasks.length > 0 && (
            <section className="rounded-3xl p-5 bg-white dark:bg-midnight-900 border border-lavender-200/80 dark:border-midnight-700/80 shadow-soft space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-base text-[#2E1F3E] dark:text-white">
                  Tareas pendientes
                </h2>
                <button
                  onClick={() => onNavigate('calendar')}
                  className="text-xs font-semibold text-accent dark:text-lavender-300 hover:underline inline-flex items-center gap-1"
                >
                  <span>Abrir calendario</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-2">
                {pendingTasks.slice(0, 4).map((task) => {
                  const subj = task.subjectId ? subjectMap.get(task.subjectId) : undefined;
                  return (
                    <div
                      key={task.id}
                      className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl bg-lavender-50/70 dark:bg-midnight-850 border border-lavender-200/60 dark:border-midnight-700/70"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          onClick={() => onToggleEventComplete(task)}
                          className="w-5 h-5 rounded-lg border border-lavender-400 hover:bg-lavender-100 dark:hover:bg-midnight-700 flex items-center justify-center shrink-0 transition-colors"
                          title="Marcar completada"
                        >
                          {task.completed && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                        </button>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#2E1F3E] dark:text-white truncate">
                            {task.title}
                          </p>
                          <p className="text-[11px] text-[#7A6693] dark:text-[#A995C4] truncate">
                            {formatFriendlyDate(task.date)}
                            {task.time ? ` · ${formatTime12h(task.time)}` : ''}
                            {subj ? ` · ${subj.name}` : ''}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* Daily Legal Term Card */}
        {settings.showDailyTerm && termOfTheDay && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-lg text-[#2E1F3E] dark:text-white">
                Término jurídico del día
              </h2>
              <ColdiAvatar pose="thinking" size="xs" />
            </div>

            <div className="rounded-3xl p-5 bg-white dark:bg-midnight-900 border border-lavender-200/80 dark:border-midnight-700/80 shadow-soft space-y-3.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-lavender-100 dark:bg-midnight-800 text-accent dark:text-lavender-300">
                    {termOfTheDay.branch}
                  </span>
                  <h3 className="font-display font-bold text-lg text-[#2E1F3E] dark:text-white mt-2">
                    {termOfTheDay.term}
                  </h3>
                </div>
                <button
                  onClick={() => onToggleFavoriteTerm(termOfTheDay)}
                  className={`p-2 rounded-xl transition-colors ${
                    termOfTheDay.isFavorite
                      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-500'
                      : 'bg-lavender-50 dark:bg-midnight-800 text-[#9B89B3] hover:text-amber-500'
                  }`}
                  title={termOfTheDay.isFavorite ? 'Quitar de favoritos' : 'Guardar en favoritos'}
                >
                  <Star className={`w-4 h-4 ${termOfTheDay.isFavorite ? 'fill-current' : ''}`} />
                </button>
              </div>

              <p className="text-sm text-[#4D3B63] dark:text-[#D5C9E6] leading-relaxed">
                {termOfTheDay.definition}
              </p>

              {termOfTheDay.legalBasis && (
                <div className="px-3 py-2 rounded-xl bg-lavender-50 dark:bg-midnight-850 border border-lavender-200/70 dark:border-midnight-700 text-xs text-[#6B5487] dark:text-[#BFAED6]">
                  <span className="font-semibold">Fundamento:</span> {termOfTheDay.legalBasis}
                </div>
              )}

              <button
                onClick={() => onNavigate('glossary')}
                className="w-full py-2.5 rounded-2xl bg-lavender-100/80 dark:bg-midnight-800 hover:bg-lavender-200/70 dark:hover:bg-midnight-700 text-accent dark:text-lavender-300 text-xs font-bold transition-colors"
              >
                Explorar glosario jurídico →
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
