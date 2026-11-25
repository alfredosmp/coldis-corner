import { useRef } from 'react';
import {
  Bird,
  CloudRain,
  Coffee,
  Headphones,
  Music,
  Pause,
  Play,
  RotateCcw,
  TreePine,
  Upload,
  Waves,
  Wind,
} from 'lucide-react';
import { AMBIENT_CHANNELS, type AmbientChannelId } from '../services/ambientAudio';
import type { PomodoroSession, Subject } from '../types/models';
import { getTodayDateKey } from '../utils/calendar';
import { ColdiAvatar } from './ColdiAvatar';

export type PomodoroPhase = 'focus' | 'break';

export interface PomodoroState {
  phase: PomodoroPhase;
  focusMinutes: number;
  breakMinutes: number;
  secondsLeft: number;
  running: boolean;
  subjectId: string;
}

interface PomodoroViewProps {
  state: PomodoroState;
  subjects: Subject[];
  sessions: PomodoroSession[];
  dailyGoalMinutes: number;
  animateMascot: boolean;
  channelVolumes: Record<AmbientChannelId, number>;
  customTrackName: string | null;
  customTrackPlaying: boolean;
  onToggleRun: () => void;
  onReset: () => void;
  onSwitchPhase: (phase: PomodoroPhase) => void;
  onApplyPreset: (focusMin: number, breakMin: number) => void;
  onSelectSubject: (subjectId: string) => void;
  onSetChannelVolume: (id: AmbientChannelId, volume: number) => void;
  onStopAllAudio: () => void;
  onLoadCustomTrack: (file: File) => void;
  onToggleCustomTrack: () => void;
}

const CHANNEL_ICONS: Record<AmbientChannelId, typeof CloudRain> = {
  lofi: Headphones,
  rain: CloudRain,
  water: Waves,
  forest: TreePine,
  birds: Bird,
  whitenoise: Wind,
  piano: Music,
};

function formatClock(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function PomodoroView({
  state,
  subjects,
  sessions,
  dailyGoalMinutes,
  animateMascot,
  channelVolumes,
  customTrackName,
  customTrackPlaying,
  onToggleRun,
  onReset,
  onSwitchPhase,
  onApplyPreset,
  onSelectSubject,
  onSetChannelVolume,
  onStopAllAudio,
  onLoadCustomTrack,
  onToggleCustomTrack,
}: PomodoroViewProps) {
  const audioFileRef = useRef<HTMLInputElement | null>(null);
  const activeSubjects = subjects.filter((s) => !s.archived);
  const todayKey = getTodayDateKey();
  const todayMinutes = sessions
    .filter((s) => s.dateKey === todayKey)
    .reduce((sum, s) => sum + s.durationMinutes, 0);
  const goalPct = Math.min(100, Math.round((todayMinutes / Math.max(1, dailyGoalMinutes)) * 100));

  const totalPhaseSeconds =
    (state.phase === 'focus' ? state.focusMinutes : state.breakMinutes) * 60;
  const elapsedPct = Math.max(
    0,
    Math.min(
      100,
      Math.round(((totalPhaseSeconds - state.secondsLeft) / Math.max(1, totalPhaseSeconds)) * 100)
    )
  );

  const anyAudioActive =
    Object.values(channelVolumes).some((v) => v > 0.01) || customTrackPlaying;

  function applySoundMix(mix: Partial<Record<AmbientChannelId, number>>) {
    for (const ch of AMBIENT_CHANNELS) {
      onSetChannelVolume(ch.id, mix[ch.id] ?? 0);
    }
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Clean Minimalist Header */}
      <div className="flex items-center gap-4">
        <ColdiAvatar pose="music" size="md" floating={animateMascot} />
        <h1 className="font-display font-bold text-2xl sm:text-3xl text-[#2E1F3E] dark:text-white">
          Sesión Pomodoro
        </h1>
      </div>

      {/* Main Split: Timer Left + Relaxing Sound Mixer Right */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Pomodoro Timer Card */}
        <section className="xl:col-span-6 rounded-3xl p-6 sm:p-7 bg-white dark:bg-midnight-900 border border-lavender-200/80 dark:border-midnight-700 shadow-soft flex flex-col justify-between gap-6">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex p-1 rounded-2xl bg-lavender-50 dark:bg-midnight-850 border border-lavender-200/80 dark:border-midnight-700">
              <button
                onClick={() => onSwitchPhase('focus')}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  state.phase === 'focus'
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-[#6D588A] dark:text-[#B9A7D1]'
                }`}
              >
                Enfoque
              </button>
              <button
                onClick={() => onSwitchPhase('break')}
                className={`inline-flex items-center gap-1 px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  state.phase === 'break'
                    ? 'bg-blush-500 text-white shadow-sm'
                    : 'text-[#6D588A] dark:text-[#B9A7D1]'
                }`}
              >
                <Coffee className="w-3.5 h-3.5" />
                <span>Descanso</span>
              </button>
            </div>

            <div className="inline-flex items-center gap-1">
              {[
                { label: '25/5', f: 25, b: 5 },
                { label: '50/10', f: 50, b: 10 },
                { label: '15/3', f: 15, b: 3 },
              ].map((preset) => {
                const active =
                  state.focusMinutes === preset.f && state.breakMinutes === preset.b;
                return (
                  <button
                    key={preset.label}
                    onClick={() => onApplyPreset(preset.f, preset.b)}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-colors ${
                      active
                        ? 'bg-lavender-200/80 dark:bg-midnight-700 text-accent dark:text-lavender-200'
                        : 'text-[#7E6B96] dark:text-[#A995C4] hover:bg-lavender-50 dark:hover:bg-midnight-850'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col items-center text-center py-4 space-y-4">
            <ColdiAvatar
              pose={state.phase === 'focus' ? 'music' : 'reading'}
              size="xl"
              floating={animateMascot && state.running}
            />

            <div className="space-y-1">
              <p className="font-display font-bold text-5xl sm:text-6xl tracking-tight text-[#2E1F3E] dark:text-white tabular-nums">
                {formatClock(state.secondsLeft)}
              </p>
              <p className="text-xs font-semibold text-[#7A6693] dark:text-[#B4A3CB]">
                {state.phase === 'focus'
                  ? state.running
                    ? 'En sesión de enfoque'
                    : '¿Empezamos?'
                  : 'Tómate un respiro'}
              </p>
            </div>

            <div className="w-full max-w-xs h-2 rounded-full bg-lavender-100 dark:bg-midnight-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  state.phase === 'focus' ? 'bg-accent' : 'bg-blush-400'
                }`}
                style={{ width: `${elapsedPct}%` }}
              />
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={onToggleRun}
                className={`inline-flex items-center gap-2 px-7 py-3 rounded-2xl text-white text-sm font-bold shadow-soft transition-all active:scale-[0.98] ${
                  state.phase === 'focus'
                    ? 'bg-accent hover:bg-accent-dark'
                    : 'bg-blush-500 hover:bg-blush-600'
                }`}
              >
                {state.running ? (
                  <>
                    <Pause className="w-4 h-4 fill-current" />
                    <span>Pausar</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Iniciar</span>
                  </>
                )}
              </button>

              <button
                onClick={onReset}
                className="p-3 rounded-2xl bg-lavender-50 dark:bg-midnight-850 border border-lavender-200 dark:border-midnight-700 text-[#6D588A] dark:text-[#C5B5DA] hover:text-accent transition-colors"
                title="Reiniciar temporizador"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-lavender-100 dark:border-midnight-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-bold text-[#6D588A] dark:text-[#BAA8D1]">
                Materia:
              </label>
              <select
                value={state.subjectId}
                onChange={(e) => onSelectSubject(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-lavender-50 dark:bg-midnight-850 border border-lavender-200 dark:border-midnight-700 text-xs font-semibold text-[#2E1F3E] dark:text-white"
              >
                <option value="">General</option>
                {activeSubjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-2xl p-3.5 bg-lavender-50/75 dark:bg-midnight-850 border border-lavender-200/70 dark:border-midnight-700 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#5A4574] dark:text-[#D1C3E5]">
                  Meta de hoy
                </span>
                <span className="font-bold text-accent dark:text-lavender-300">
                  {todayMinutes} / {dailyGoalMinutes} min ({goalPct}%)
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-lavender-200/70 dark:bg-midnight-700 overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${goalPct}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Relaxing Ambient Sound Mixer */}
        <section className="xl:col-span-6 rounded-3xl p-6 sm:p-7 bg-white dark:bg-midnight-900 border border-lavender-200/80 dark:border-midnight-700 shadow-soft space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display font-bold text-lg text-[#2E1F3E] dark:text-white">
                Sonidos de Estudio
              </h2>
              <p className="text-xs text-[#735F8C] dark:text-[#A996C3]">
                Enciende uno o combina varios a tu gusto
              </p>
            </div>

            {anyAudioActive && (
              <button
                onClick={onStopAllAudio}
                className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline"
              >
                Apagar todo
              </button>
            )}
          </div>

          {/* Quick Cozy Mix Presets */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => applySoundMix({ lofi: 0.6, rain: 0.35 })}
              className="px-3 py-1.5 rounded-full bg-lavender-100/90 dark:bg-midnight-800 hover:bg-lavender-200/80 text-accent dark:text-lavender-300 text-xs font-bold transition-colors"
            >
              Lo-Fi + Lluvia
            </button>
            <button
              onClick={() => applySoundMix({ rain: 0.6, piano: 0.45 })}
              className="px-3 py-1.5 rounded-full bg-lavender-100/90 dark:bg-midnight-800 hover:bg-lavender-200/80 text-accent dark:text-lavender-300 text-xs font-bold transition-colors"
            >
              Lluvia + Piano
            </button>
            <button
              onClick={() => applySoundMix({ forest: 0.55, birds: 0.4, water: 0.35 })}
              className="px-3 py-1.5 rounded-full bg-lavender-100/90 dark:bg-midnight-800 hover:bg-lavender-200/80 text-accent dark:text-lavender-300 text-xs font-bold transition-colors"
            >
              Bosque y río
            </button>
            <button
              onClick={() => applySoundMix({ whitenoise: 0.55 })}
              className="px-3 py-1.5 rounded-full bg-lavender-100/90 dark:bg-midnight-800 hover:bg-lavender-200/80 text-accent dark:text-lavender-300 text-xs font-bold transition-colors"
            >
              Enfoque profundo
            </button>
          </div>

          {/* Individual Sound Channels */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {AMBIENT_CHANNELS.map((ch) => {
              const Icon = CHANNEL_ICONS[ch.id];
              const vol = channelVolumes[ch.id] ?? 0;
              const active = vol > 0.01;

              return (
                <div
                  key={ch.id}
                  className={`rounded-2xl p-3.5 border transition-all space-y-2.5 ${
                    active
                      ? 'bg-lavender-50 dark:bg-midnight-800 border-accent/60 shadow-sm'
                      : 'bg-lavender-50/40 dark:bg-midnight-850/70 border-lavender-200/70 dark:border-midnight-700/70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => onSetChannelVolume(ch.id, active ? 0 : 0.6)}
                      className="flex items-center gap-2.5 text-left min-w-0 flex-1"
                    >
                      <span
                        className={`p-2 rounded-xl shrink-0 transition-colors ${
                          active
                            ? 'bg-accent text-white'
                            : 'bg-white dark:bg-midnight-900 text-accent dark:text-lavender-300'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#2E1F3E] dark:text-white truncate">
                          {ch.label}
                        </p>
                        <p className="text-[10px] text-[#7A6693] dark:text-[#A995C4] truncate">
                          {ch.description}
                        </p>
                      </div>
                    </button>
                    <span className="text-[11px] font-bold text-accent dark:text-lavender-300 tabular-nums">
                      {Math.round(vol * 100)}%
                    </span>
                  </div>

                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(vol * 100)}
                    onChange={(e) => onSetChannelVolume(ch.id, Number(e.target.value) / 100)}
                    className="w-full accent-[#8444C2] h-1.5 rounded-lg cursor-pointer"
                  />
                </div>
              );
            })}
          </div>

          {/* Optional Local MP3 Track Upload */}
          <div className="pt-3 border-t border-lavender-100 dark:border-midnight-800 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#2E1F3E] dark:text-white">
                Tu propia pista
              </p>
              <p className="text-[11px] text-[#7A6693] dark:text-[#A995C4] truncate">
                {customTrackName ? customTrackName : 'Agrega un archivo de audio (MP3 / WAV)'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {customTrackName && (
                <button
                  onClick={onToggleCustomTrack}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-accent text-white text-xs font-bold"
                >
                  {customTrackPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{customTrackPlaying ? 'Pausar' : 'Reproducir'}</span>
                </button>
              )}
              <button
                onClick={() => audioFileRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-lavender-100 dark:bg-midnight-800 hover:bg-lavender-200/80 text-accent dark:text-lavender-300 text-xs font-bold"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Cargar audio</span>
              </button>
              <input
                ref={audioFileRef}
                type="file"
                accept="audio/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onLoadCustomTrack(file);
                  e.target.value = '';
                }}
                className="hidden"
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
