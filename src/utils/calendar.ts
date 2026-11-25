import type { CalendarEvent } from '../types/models';

const HOUR_MS = 1000 * 60 * 60;
const DAY_MS = HOUR_MS * 24;

export function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTodayDateKey(): string {
  return toLocalDateKey(new Date());
}

/**
 * Parses a CalendarEvent's local date + optional HH:mm time into a local Date.
 * For exams without an explicit time, defaults to 09:00 local time.
 * For tasks without an explicit time, defaults to 23:59 local time.
 */
export function getEventDateTime(event: Pick<CalendarEvent, 'date' | 'time' | 'type'>): Date {
  const [yearStr, monthStr, dayStr] = event.date.split('-');
  const year = Number(yearStr) || new Date().getFullYear();
  const month = (Number(monthStr) || 1) - 1;
  const day = Number(dayStr) || 1;

  const fallbackTime = event.type === 'exam' ? '09:00' : '23:59';
  const [hourStr, minStr] = (event.time || fallbackTime).split(':');
  const hours = Number(hourStr);
  const minutes = Number(minStr);

  return new Date(
    year,
    month,
    day,
    Number.isFinite(hours) ? hours : 9,
    Number.isFinite(minutes) ? minutes : 0,
    0,
    0
  );
}

export function getMsUntilEvent(event: Pick<CalendarEvent, 'date' | 'time' | 'type'>, now = Date.now()): number {
  return getEventDateTime(event).getTime() - now;
}

export function formatTime12h(time?: string): string {
  if (!time) return '';
  const [hStr, mStr] = time.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return time;
  const period = h >= 12 ? 'p.m.' : 'a.m.';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

export function formatFriendlyDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  const today = getTodayDateKey();
  const tomorrow = toLocalDateKey(new Date(Date.now() + DAY_MS));

  if (dateKey === today) return 'Hoy';
  if (dateKey === tomorrow) return 'Mañana';

  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(dt);
}

export function formatExamCountdown(event: CalendarEvent, now = Date.now()): string {
  const ms = getMsUntilEvent(event, now);
  if (ms <= 0) return 'En curso o finalizado';

  const totalMinutes = Math.ceil(ms / (1000 * 60));
  if (totalMinutes < 60) {
    return `En ${totalMinutes} min`;
  }

  const totalHours = Math.floor(totalMinutes / 60);
  const remMinutes = totalMinutes % 60;
  if (totalHours < 24) {
    return remMinutes > 0 ? `En ${totalHours} h ${remMinutes} min` : `En ${totalHours} h`;
  }

  const days = Math.ceil(ms / DAY_MS);
  if (days === 1) return 'Mañana';
  return `En ${days} días`;
}

export interface ExamAlertBuckets {
  /** Exams strictly between now and 24 hours from now (active shortcut window) */
  urgentWithin24h: CalendarEvent[];
  /** Exams strictly between 24h and reminderDays * 24h from now */
  upcomingSoon: CalendarEvent[];
}

export function classifyExamAlerts(
  events: CalendarEvent[],
  reminderDays = 3,
  now = Date.now()
): ExamAlertBuckets {
  const maxSoonMs = Math.max(1, reminderDays) * DAY_MS;

  const exams = events
    .filter((e) => e.type === 'exam' && !e.completed)
    .map((event) => ({ event, ms: getMsUntilEvent(event, now) }))
    .filter(({ ms }) => ms > 0)
    .sort((a, b) => a.ms - b.ms);

  const urgentWithin24h: CalendarEvent[] = [];
  const upcomingSoon: CalendarEvent[] = [];

  for (const { event, ms } of exams) {
    if (ms <= DAY_MS) {
      urgentWithin24h.push(event);
    } else if (ms <= maxSoonMs) {
      upcomingSoon.push(event);
    }
  }

  return { urgentWithin24h, upcomingSoon };
}
