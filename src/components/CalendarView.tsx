import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BellRing,
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit3,
  GraduationCap,
  ListTodo,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { SUBJECT_COLORS } from '../data/subjectStyles';
import type { CalendarEvent, CalendarEventType, Subject } from '../types/models';
import {
  formatExamCountdown,
  formatFriendlyDate,
  formatTime12h,
  getEventDateTime,
  getMsUntilEvent,
  getTodayDateKey,
  toLocalDateKey,
} from '../utils/calendar';
import { ColdiAvatar } from './ColdiAvatar';

interface CalendarViewProps {
  events: CalendarEvent[];
  subjects: Subject[];
  animateMascot: boolean;
  quickAddSignal?: { seq: number; type?: CalendarEventType; subjectId?: string };
  onSaveEvent: (
    data: Omit<CalendarEvent, 'id' | 'completed' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ) => Promise<void>;
  onToggleComplete: (event: CalendarEvent) => Promise<void>;
  onDeleteEvent: (id: string) => Promise<void>;
  onOpenSubject: (subjectId: string) => void;
}

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

interface EventFormState {
  title: string;
  type: CalendarEventType;
  date: string;
  time: string;
  subjectId: string;
  notes: string;
}

export function CalendarView({
  events,
  subjects,
  animateMascot,
  quickAddSignal,
  onSaveEvent,
  onToggleComplete,
  onDeleteEvent,
  onOpenSubject,
}: CalendarViewProps) {
  const todayKey = getTodayDateKey();
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [listFilter, setListFilter] = useState<'all' | 'exam' | 'task'>('all');

  // Add / Edit modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [form, setForm] = useState<EventFormState>({
    title: '',
    type: 'task',
    date: todayKey,
    time: '',
    subjectId: '',
    notes: '',
  });
  const lastSignalSeq = useRef(quickAddSignal?.seq ?? 0);

  const activeSubjects = useMemo(() => subjects.filter((s) => !s.archived), [subjects]);
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);

  useEffect(() => {
    if (quickAddSignal && quickAddSignal.seq > lastSignalSeq.current) {
      lastSignalSeq.current = quickAddSignal.seq;
      openCreateModal(quickAddSignal.type ?? 'task', selectedDate, quickAddSignal.subjectId ?? '');
    }
  }, [quickAddSignal, selectedDate]);

  // Group events by dateKey
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const list = map.get(ev.date) ?? [];
      list.push(ev);
      map.set(ev.date, list);
    }
    for (const [, list] of map) {
      list.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'exam' ? -1 : 1;
        return (a.time ?? '23:59').localeCompare(b.time ?? '23:59');
      });
    }
    return map;
  }, [events]);

  // Build calendar grid cells (Monday-first)
  const calendarCells = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // Convert JS Sunday=0..Saturday=6 to Monday=0..Sunday=6
    const startOffset = (firstDayOfMonth.getDay() + 6) % 7;

    const cells: { dateKey: string; day: number; inMonth: boolean }[] = [];

    // Leading days from previous month
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      cells.push({ dateKey: toLocalDateKey(d), day: d.getDate(), inMonth: false });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      cells.push({ dateKey: toLocalDateKey(d), day, inMonth: true });
    }

    // Trailing days to finish full weeks
    const remainder = cells.length % 7;
    if (remainder !== 0) {
      const fill = 7 - remainder;
      for (let day = 1; day <= fill; day++) {
        const d = new Date(year, month + 1, day);
        cells.push({ dateKey: toLocalDateKey(d), day, inMonth: false });
      }
    }

    return cells;
  }, [viewMonth]);

  const monthLabel = useMemo(() => {
    const raw = new Intl.DateTimeFormat('es-MX', {
      month: 'long',
      year: 'numeric',
    }).format(viewMonth);
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, [viewMonth]);

  const selectedDayEvents = useMemo(() => {
    const dayItems = eventsByDate.get(selectedDate) ?? [];
    if (listFilter === 'all') return dayItems;
    return dayItems.filter((e) => e.type === listFilter);
  }, [eventsByDate, selectedDate, listFilter]);

  const upcomingExams = useMemo(() => {
    const now = Date.now();
    return events
      .filter((e) => e.type === 'exam' && !e.completed && getMsUntilEvent(e, now) > 0)
      .sort((a, b) => getEventDateTime(a).getTime() - getEventDateTime(b).getTime());
  }, [events]);

  function openCreateModal(
    type: CalendarEventType = 'task',
    date = selectedDate,
    subjectId = ''
  ) {
    setEditingEvent(null);
    setForm({
      title: '',
      type,
      date,
      time: type === 'exam' ? '09:00' : '',
      subjectId,
      notes: '',
    });
    setIsModalOpen(true);
  }

  function openEditModal(ev: CalendarEvent) {
    setEditingEvent(ev);
    setForm({
      title: ev.title,
      type: ev.type,
      date: ev.date,
      time: ev.time ?? (ev.type === 'exam' ? '09:00' : ''),
      subjectId: ev.subjectId ?? '',
      notes: ev.notes ?? '',
    });
    setIsModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.date) return;

    await onSaveEvent(
      {
        title: form.title.trim(),
        type: form.type,
        date: form.date,
        time: form.time.trim() || (form.type === 'exam' ? '09:00' : undefined),
        subjectId: form.subjectId || undefined,
        notes: form.notes.trim() || undefined,
      },
      editingEvent?.id
    );

    setSelectedDate(form.date);
    setIsModalOpen(false);
    setEditingEvent(null);
  }

  function shiftMonth(delta: number) {
    setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  function jumpToToday() {
    const now = new Date();
    setViewMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(todayKey);
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <ColdiAvatar pose="writing" size="md" floating={animateMascot} />
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-[#2E1F3E] dark:text-white">
            Calendario
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => openCreateModal('task', selectedDate)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-white dark:bg-midnight-900 border border-lavender-200 dark:border-midnight-700 hover:border-accent text-[#4A3861] dark:text-[#E2D8F3] text-xs font-bold transition-all"
          >
            <ListTodo className="w-4 h-4 text-accent dark:text-lavender-300" />
            <span>+ Tarea</span>
          </button>
          <button
            onClick={() => openCreateModal('exam', selectedDate)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-accent hover:bg-accent-dark text-white text-xs font-bold shadow-soft transition-all"
          >
            <GraduationCap className="w-4 h-4" />
            <span>+ Examen</span>
          </button>
        </div>
      </div>

      {/* Main Split: Calendar Month Grid + Selected Day & Upcoming Exams */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Monthly Calendar */}
        <section className="xl:col-span-7 rounded-3xl p-5 sm:p-6 bg-white dark:bg-midnight-900 border border-lavender-200/80 dark:border-midnight-700 shadow-soft space-y-4">
          {/* Month Controls */}
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display font-bold text-lg text-[#2E1F3E] dark:text-white">
              {monthLabel}
            </h2>
            <div className="flex items-center gap-1.5">
              <button
                onClick={jumpToToday}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-accent dark:text-lavender-300 bg-lavender-50 dark:bg-midnight-850 hover:bg-lavender-100 dark:hover:bg-midnight-800 transition-colors"
              >
                Hoy
              </button>
              <button
                onClick={() => shiftMonth(-1)}
                className="p-2 rounded-xl text-[#6D588A] dark:text-[#BAA8D1] hover:bg-lavender-100 dark:hover:bg-midnight-800 transition-colors"
                aria-label="Mes anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => shiftMonth(1)}
                className="p-2 rounded-xl text-[#6D588A] dark:text-[#BAA8D1] hover:bg-lavender-100 dark:hover:bg-midnight-800 transition-colors"
                aria-label="Mes siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1.5 text-center">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="text-[11px] font-bold uppercase tracking-wider text-[#8C79A6] dark:text-[#9C88B8] py-1"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {calendarCells.map((cell) => {
              const dayEvents = eventsByDate.get(cell.dateKey) ?? [];
              const hasExam = dayEvents.some((e) => e.type === 'exam' && !e.completed);
              const hasPendingTask = dayEvents.some((e) => e.type === 'task' && !e.completed);
              const isSelected = cell.dateKey === selectedDate;
              const isToday = cell.dateKey === todayKey;

              return (
                <button
                  key={cell.dateKey}
                  onClick={() => setSelectedDate(cell.dateKey)}
                  className={`relative aspect-square sm:aspect-auto sm:h-16 rounded-2xl p-1.5 flex flex-col items-center justify-between transition-all border ${
                    isSelected
                      ? 'bg-accent text-white border-accent shadow-soft'
                      : isToday
                      ? 'bg-lavender-100/90 dark:bg-midnight-800 border-accent/60 text-[#2E1F3E] dark:text-white'
                      : cell.inMonth
                      ? 'bg-lavender-50/40 dark:bg-midnight-850/60 border-transparent hover:border-lavender-300 dark:hover:border-midnight-700 text-[#2E1F3E] dark:text-[#EAE0F7]'
                      : 'bg-transparent border-transparent text-[#B8ABC9] dark:text-[#55476B]'
                  }`}
                >
                  <span className={`text-xs sm:text-sm font-bold ${isSelected ? 'text-white' : ''}`}>
                    {cell.day}
                  </span>

                  {/* Minimalist event indicators */}
                  <div className="flex items-center gap-1 min-h-[8px]">
                    {hasExam && (
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isSelected ? 'bg-blush-200' : 'bg-blush-500 dark:bg-blush-400'
                        }`}
                        title="Examen"
                      />
                    )}
                    {hasPendingTask && (
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isSelected ? 'bg-white/80' : 'bg-accent dark:bg-lavender-300'
                        }`}
                        title="Tarea pendiente"
                      />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Subtle Legend */}
          <div className="flex items-center gap-4 pt-2 border-t border-lavender-100 dark:border-midnight-800 text-[11px] text-[#7A6693] dark:text-[#A995C4]">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blush-500 dark:bg-blush-400" />
              Examen
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent dark:bg-lavender-300" />
              Tarea / recordatorio
            </span>
          </div>
        </section>

        {/* Right Side: Selected Day Agenda + Upcoming Exams */}
        <div className="xl:col-span-5 space-y-5">
          {/* Selected Day Panel */}
          <section className="rounded-3xl p-5 bg-white dark:bg-midnight-900 border border-lavender-200/80 dark:border-midnight-700 shadow-soft space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-accent dark:text-lavender-300">
                  Agenda del día
                </p>
                <h2 className="font-display font-bold text-lg text-[#2E1F3E] dark:text-white capitalize">
                  {formatFriendlyDate(selectedDate)}
                </h2>
              </div>

              <div className="inline-flex p-0.5 rounded-xl bg-lavender-50 dark:bg-midnight-850 border border-lavender-200/70 dark:border-midnight-700 text-[11px]">
                {(['all', 'exam', 'task'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setListFilter(f)}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                      listFilter === f
                        ? 'bg-accent text-white'
                        : 'text-[#6E5B85] dark:text-[#B4A3CB]'
                    }`}
                  >
                    {f === 'all' ? 'Todo' : f === 'exam' ? 'Exámenes' : 'Tareas'}
                  </button>
                ))}
              </div>
            </div>

            {selectedDayEvents.length === 0 ? (
              <div className="rounded-2xl p-6 text-center bg-lavender-50/60 dark:bg-midnight-850/70 border border-dashed border-lavender-200 dark:border-midnight-700 space-y-2.5">
                <CalendarIcon className="w-6 h-6 text-lavender-400 mx-auto" />
                <p className="text-xs font-medium text-[#735F8C] dark:text-[#A996C3]">
                  Día libre por ahora. ¿Anotamos algo para {formatFriendlyDate(selectedDate).toLowerCase()}?
                </p>
                <div className="flex justify-center gap-2">
                  <button
                    onClick={() => openCreateModal('task', selectedDate)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white dark:bg-midnight-900 border border-lavender-200 dark:border-midnight-700 text-xs font-semibold text-accent dark:text-lavender-300 hover:border-accent"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Tarea
                  </button>
                  <button
                    onClick={() => openCreateModal('exam', selectedDate)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-accent text-white text-xs font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Examen
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {selectedDayEvents.map((ev) => {
                  const subj = ev.subjectId ? subjectMap.get(ev.subjectId) : undefined;
                  const subjStyle = subj ? SUBJECT_COLORS[subj.color] : null;
                  const isExam = ev.type === 'exam';

                  return (
                    <div
                      key={ev.id}
                      className={`group rounded-2xl p-3.5 border transition-all ${
                        isExam
                          ? 'bg-blush-50/80 dark:bg-[#2F1B2C] border-blush-200/80 dark:border-[#522D4C]'
                          : 'bg-lavender-50/70 dark:bg-midnight-850 border-lavender-200/70 dark:border-midnight-700'
                      } ${ev.completed ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => onToggleComplete(ev)}
                          className={`mt-0.5 w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
                            ev.completed
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : isExam
                              ? 'border-blush-400 hover:bg-blush-100 dark:hover:bg-[#492544]'
                              : 'border-lavender-400 hover:bg-lavender-100 dark:hover:bg-midnight-700'
                          }`}
                          title={ev.completed ? 'Marcar como pendiente' : 'Marcar como completado'}
                        >
                          {ev.completed && <Check className="w-3.5 h-3.5" />}
                        </button>

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                isExam
                                  ? 'bg-blush-200/80 dark:bg-[#5A2D53] text-blush-600 dark:text-blush-200'
                                  : 'bg-lavender-200/70 dark:bg-midnight-700 text-accent dark:text-lavender-300'
                              }`}
                            >
                              {isExam ? 'Examen' : 'Tarea'}
                            </span>
                            {ev.time && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6D588A] dark:text-[#C4B4DA]">
                                <Clock className="w-3 h-3" />
                                {formatTime12h(ev.time)}
                              </span>
                            )}
                          </div>

                          <p
                            className={`text-sm font-bold text-[#2E1F3E] dark:text-white ${
                              ev.completed ? 'line-through' : ''
                            }`}
                          >
                            {ev.title}
                          </p>

                          {ev.notes && (
                            <p className="text-xs text-[#6B5785] dark:text-[#B8A6CF] leading-relaxed">
                              {ev.notes}
                            </p>
                          )}

                          {subj && subjStyle && (
                            <button
                              onClick={() => onOpenSubject(subj.id)}
                              className={`mt-1 inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full transition-opacity hover:opacity-85 ${subjStyle.badgeBg} ${subjStyle.badgeText}`}
                            >
                              <span>{subj.name}</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-0.5 shrink-0 opacity-70 group-hover:opacity-100">
                          <button
                            onClick={() => openEditModal(ev)}
                            className="p-1.5 rounded-xl text-[#7E6B96] hover:text-accent hover:bg-white/70 dark:hover:bg-midnight-800"
                            title="Editar"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteEvent(ev.id)}
                            className="p-1.5 rounded-xl text-[#7E6B96] hover:text-rose-500 hover:bg-white/70 dark:hover:bg-midnight-800"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Upcoming Exams List */}
          <section className="rounded-3xl p-5 bg-white dark:bg-midnight-900 border border-lavender-200/80 dark:border-midnight-700 shadow-soft space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BellRing className="w-4 h-4 text-blush-500 dark:text-blush-300" />
                <h2 className="font-display font-bold text-base text-[#2E1F3E] dark:text-white">
                  Próximos exámenes
                </h2>
              </div>
              <ColdiAvatar pose="thinking" size="xs" />
            </div>

            {upcomingExams.length === 0 ? (
              <p className="text-xs text-[#7A6693] dark:text-[#A995C4] leading-relaxed">
                Sin exámenes próximos agendados. Cuando registres uno, te recordaré 2–3 días antes y te daré acceso directo a su materia 24 horas antes.
              </p>
            ) : (
              <div className="space-y-2.5">
                {upcomingExams.slice(0, 5).map((exam) => {
                  const subj = exam.subjectId ? subjectMap.get(exam.subjectId) : undefined;
                  const ms = getMsUntilEvent(exam);
                  const isUrgent = ms > 0 && ms <= 24 * 60 * 60 * 1000;

                  return (
                    <div
                      key={exam.id}
                      className={`rounded-2xl p-3.5 border flex items-center justify-between gap-3 ${
                        isUrgent
                          ? 'bg-blush-50 dark:bg-[#351C31] border-blush-300 dark:border-blush-700/60'
                          : 'bg-lavender-50/70 dark:bg-midnight-850 border-lavender-200/70 dark:border-midnight-700'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isUrgent
                                ? 'bg-blush-500 text-white'
                                : 'bg-lavender-200/80 dark:bg-midnight-700 text-accent dark:text-lavender-300'
                            }`}
                          >
                            {formatExamCountdown(exam)}
                          </span>
                          <span className="text-[11px] text-[#7A6693] dark:text-[#B4A3CB]">
                            {formatFriendlyDate(exam.date)}
                            {exam.time ? ` · ${formatTime12h(exam.time)}` : ''}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-[#2E1F3E] dark:text-white truncate">
                          {exam.title}
                        </p>
                        {subj && (
                          <p className="text-xs text-[#6E5B85] dark:text-[#B9A7D1] truncate">
                            {subj.name}
                          </p>
                        )}
                      </div>

                      {subj && (
                        <button
                          onClick={() => onOpenSubject(subj.id)}
                          className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-accent hover:bg-accent-dark text-white text-xs font-semibold transition-colors"
                        >
                          <span>Estudiar</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Create / Edit Event Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1D112C]/50 backdrop-blur-sm">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-midnight-900 border border-lavender-200 dark:border-midnight-700 shadow-soft-lg p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ColdiAvatar pose={form.type === 'exam' ? 'thinking' : 'writing'} size="xs" />
                <h2 className="font-display font-bold text-xl text-[#2E1F3E] dark:text-white">
                  {editingEvent
                    ? 'Editar evento'
                    : form.type === 'exam'
                    ? 'Agendar examen'
                    : 'Nueva tarea'}
                </h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-[#7E6B96] hover:bg-lavender-100 dark:hover:bg-midnight-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Type Toggle */}
              <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-lavender-50 dark:bg-midnight-850 border border-lavender-200/80 dark:border-midnight-700">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, type: 'task' }))}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all ${
                    form.type === 'task'
                      ? 'bg-accent text-white shadow-sm'
                      : 'text-[#6D588A] dark:text-[#B9A7D1]'
                  }`}
                >
                  <ListTodo className="w-3.5 h-3.5" />
                  <span>Tarea / Recordatorio</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setForm((f) => ({ ...f, type: 'exam', time: f.time || '09:00' }))
                  }
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all ${
                    form.type === 'exam'
                      ? 'bg-blush-500 text-white shadow-sm'
                      : 'text-[#6D588A] dark:text-[#B9A7D1]'
                  }`}
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>Examen</span>
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#6D588A] dark:text-[#BAA8D1] mb-1.5">
                  {form.type === 'exam' ? 'Nombre del examen *' : '¿Qué hay que hacer? *'}
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder={
                    form.type === 'exam'
                      ? 'Ej. Parcial de Amparo, Final de Civil...'
                      : 'Ej. Leer capítulo 3, entregar demanda simulada...'
                  }
                  className="w-full px-4 py-2.5 rounded-2xl bg-lavender-50 dark:bg-midnight-850 border border-lavender-200 dark:border-midnight-700 text-sm text-[#2E1F3E] dark:text-white focus:outline-none focus:ring-2 focus:ring-lavender-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#6D588A] dark:text-[#BAA8D1] mb-1.5">
                  Materia relacionada {form.type === 'exam' ? '(recomendado para acceso directo)' : '(opcional)'}
                </label>
                <select
                  value={form.subjectId}
                  onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-lavender-50 dark:bg-midnight-850 border border-lavender-200 dark:border-midnight-700 text-sm text-[#2E1F3E] dark:text-white focus:outline-none focus:ring-2 focus:ring-lavender-400"
                >
                  <option value="">Sin materia específica</option>
                  {activeSubjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#6D588A] dark:text-[#BAA8D1] mb-1.5">
                    Fecha *
                  </label>
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-lavender-50 dark:bg-midnight-850 border border-lavender-200 dark:border-midnight-700 text-sm text-[#2E1F3E] dark:text-white focus:outline-none focus:ring-2 focus:ring-lavender-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#6D588A] dark:text-[#BAA8D1] mb-1.5">
                    Hora {form.type === 'exam' ? '*' : '(opcional)'}
                  </label>
                  <input
                    type="time"
                    required={form.type === 'exam'}
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-lavender-50 dark:bg-midnight-850 border border-lavender-200 dark:border-midnight-700 text-sm text-[#2E1F3E] dark:text-white focus:outline-none focus:ring-2 focus:ring-lavender-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#6D588A] dark:text-[#BAA8D1] mb-1.5">
                  Temario / Notas (opcional)
                </label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder={
                    form.type === 'exam'
                      ? 'Ej. Arts. 103 y 107 CPEUM, salón 204, llevar código...'
                      : 'Detalles rápidos que dio el profesor en clase...'
                  }
                  className="w-full px-4 py-2.5 rounded-2xl bg-lavender-50 dark:bg-midnight-850 border border-lavender-200 dark:border-midnight-700 text-sm text-[#2E1F3E] dark:text-white focus:outline-none focus:ring-2 focus:ring-lavender-400 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-lavender-100 dark:border-midnight-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-2xl text-sm font-semibold text-[#6E5B85] dark:text-[#BBA9D3] hover:bg-lavender-100 dark:hover:bg-midnight-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2.5 rounded-2xl text-white text-sm font-semibold shadow-soft transition-colors ${
                    form.type === 'exam'
                      ? 'bg-blush-500 hover:bg-blush-600'
                      : 'bg-accent hover:bg-accent-dark'
                  }`}
                >
                  {editingEvent ? 'Guardar cambios' : form.type === 'exam' ? 'Agendar examen' : 'Guardar tarea'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
