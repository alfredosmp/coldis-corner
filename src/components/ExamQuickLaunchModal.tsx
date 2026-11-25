import { ArrowRight, Clock, GraduationCap, Sparkles, X } from 'lucide-react';
import { BRAND_CONFIG } from '../config/brand';
import type { CalendarEvent, Subject } from '../types/models';
import { formatExamCountdown, formatFriendlyDate, formatTime12h } from '../utils/calendar';
import { ColdiAvatar } from './ColdiAvatar';

interface ExamQuickLaunchModalProps {
  urgentExams: CalendarEvent[];
  subjects: Subject[];
  animateMascot: boolean;
  onJumpToSubject: (subjectId: string) => void;
  onOpenCalendar: () => void;
  onDismiss: () => void;
}

export function ExamQuickLaunchModal({
  urgentExams,
  subjects,
  animateMascot,
  onJumpToSubject,
  onOpenCalendar,
  onDismiss,
}: ExamQuickLaunchModalProps) {
  if (urgentExams.length === 0) return null;

  const subjectMap = new Map(subjects.map((s) => [s.id, s]));
  const primaryExam = urgentExams[0];
  const primarySubject = primaryExam.subjectId ? subjectMap.get(primaryExam.subjectId) : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#191026]/65 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-3xl p-6 sm:p-7 bg-white dark:bg-midnight-900 border border-blush-200 dark:border-blush-800/60 shadow-soft-lg space-y-5">
        <button
          onClick={onDismiss}
          className="absolute right-4 top-4 p-2 rounded-xl text-[#8A76A3] hover:bg-lavender-100 dark:hover:bg-midnight-800 transition-colors"
          aria-label="Ir al inicio"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center text-center space-y-3">
          <ColdiAvatar pose="reading" size="xl" floating={animateMascot} />

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blush-100 dark:bg-[#43213D] text-blush-600 dark:text-blush-200 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Acceso directo · {formatExamCountdown(primaryExam)}</span>
          </div>

          <h2 className="font-display font-bold text-2xl text-[#2E1F3E] dark:text-white leading-snug">
            ¡Tú puedes, {BRAND_CONFIG.studentName}!
          </h2>

          <p className="text-sm text-[#6E5B85] dark:text-[#BEB0D1]">
            Tu examen está a menos de 24 horas. Entra directo a repasar sin buscar nada:
          </p>
        </div>

        <div className="space-y-2.5">
          {urgentExams.map((exam) => {
            const subj = exam.subjectId ? subjectMap.get(exam.subjectId) : undefined;
            return (
              <div
                key={exam.id}
                className="rounded-2xl p-4 bg-gradient-to-br from-blush-50/90 to-lavender-50/90 dark:from-[#301B2E] dark:to-midnight-850 border border-blush-200/80 dark:border-[#522D4C] space-y-2"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 font-bold text-blush-600 dark:text-blush-300">
                    <GraduationCap className="w-3.5 h-3.5" />
                    {subj ? subj.name : 'Examen próximo'}
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold text-[#6D588A] dark:text-[#C5B5DA]">
                    <Clock className="w-3.5 h-3.5" />
                    {formatFriendlyDate(exam.date)}
                    {exam.time ? ` · ${formatTime12h(exam.time)}` : ''}
                  </span>
                </div>

                <p className="font-display font-bold text-base text-[#2E1F3E] dark:text-white">
                  {exam.title}
                </p>

                {exam.notes && (
                  <p className="text-xs text-[#695582] dark:text-[#BFAED6] leading-relaxed">
                    {exam.notes}
                  </p>
                )}

                {urgentExams.length > 1 && subj && (
                  <button
                    onClick={() => onJumpToSubject(subj.id)}
                    className="w-full mt-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-accent hover:bg-accent-dark text-white text-xs font-bold transition-colors"
                  >
                    <span>Ir directo a {subj.name}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-2 pt-1">
          {primarySubject ? (
            <button
              onClick={() => onJumpToSubject(primarySubject.id)}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-accent hover:bg-accent-dark text-white text-sm font-bold shadow-soft transition-all active:scale-[0.99]"
            >
              <span>Seguir estudiando {primarySubject.name}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={onOpenCalendar}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-accent hover:bg-accent-dark text-white text-sm font-bold shadow-soft transition-all"
            >
              <span>Ver detalles en Calendario</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={onDismiss}
            className="w-full py-2.5 rounded-2xl text-xs font-semibold text-[#7A6693] dark:text-[#B4A3CB] hover:bg-lavender-100/80 dark:hover:bg-midnight-800 transition-colors"
          >
            Ir al inicio
          </button>
        </div>
      </div>
    </div>
  );
}
