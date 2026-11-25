import { Pause, Play, Timer, Volume2, VolumeX } from 'lucide-react';
import type { PomodoroState } from './PomodoroView';

interface FloatingPomodoroBarProps {
  state: PomodoroState;
  anyAudioActive: boolean;
  isMuted: boolean;
  onToggleRun: () => void;
  onToggleMute: () => void;
  onOpenPomodoro: () => void;
}

function formatMiniClock(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function FloatingPomodoroBar({
  state,
  anyAudioActive,
  isMuted,
  onToggleRun,
  onToggleMute,
  onOpenPomodoro,
}: FloatingPomodoroBarProps) {
  if (!state.running && !anyAudioActive) return null;

  return (
    <div className="fixed bottom-20 md:bottom-5 right-4 z-40 flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white/95 dark:bg-midnight-900/95 border border-lavender-300/80 dark:border-midnight-600 shadow-soft-lg backdrop-blur-md">
      <button
        onClick={onOpenPomodoro}
        className="flex items-center gap-2 text-left hover:opacity-85 transition-opacity"
        title="Abrir Sesión Pomodoro"
      >
        <span
          className={`p-1.5 rounded-xl text-white ${
            state.phase === 'focus' ? 'bg-accent' : 'bg-blush-500'
          }`}
        >
          <Timer className="w-3.5 h-3.5" />
        </span>
        <div>
          <p className="font-display font-bold text-sm text-[#2E1F3E] dark:text-white leading-none tabular-nums">
            {formatMiniClock(state.secondsLeft)}
          </p>
          <p className="text-[10px] font-semibold text-[#7A6693] dark:text-[#A995C4] mt-0.5">
            {state.phase === 'focus' ? 'Enfoque' : 'Descanso'}
          </p>
        </div>
      </button>

      <div className="h-6 w-px bg-lavender-200 dark:bg-midnight-700 mx-0.5" />

      <button
        onClick={onToggleRun}
        className="p-1.5 rounded-xl bg-lavender-100 dark:bg-midnight-800 text-accent dark:text-lavender-300 hover:bg-lavender-200/80 transition-colors"
        title={state.running ? 'Pausar Pomodoro' : 'Reanudar Pomodoro'}
      >
        {state.running ? (
          <Pause className="w-3.5 h-3.5 fill-current" />
        ) : (
          <Play className="w-3.5 h-3.5 fill-current" />
        )}
      </button>

      {anyAudioActive && (
        <button
          onClick={onToggleMute}
          className={`p-1.5 rounded-xl transition-colors ${
            isMuted
              ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300'
              : 'bg-lavender-100 dark:bg-midnight-800 text-accent dark:text-lavender-300'
          }`}
          title={isMuted ? 'Activar sonido' : 'Silenciar sonido'}
        >
          {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  );
}
