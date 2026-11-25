import { CheckCircle2, Sparkles } from 'lucide-react';
import type { ColdiPose } from '../types/models';
import { ColdiAvatar } from './ColdiAvatar';

interface ComingSoonViewProps {
  title: string;
  phaseLabel: string;
  description: string;
  highlights: string[];
  pose?: ColdiPose;
  animateMascot?: boolean;
  onGoBack: () => void;
}

export function ComingSoonView({
  title,
  phaseLabel,
  description,
  highlights,
  pose = 'thinking',
  animateMascot = true,
  onGoBack,
}: ComingSoonViewProps) {
  return (
    <div className="max-w-2xl mx-auto py-8 sm:py-12">
      <div className="rounded-3xl p-6 sm:p-8 bg-white dark:bg-midnight-900 border border-lavender-200/80 dark:border-midnight-700 shadow-soft text-center space-y-5">
        <div className="flex justify-center">
          <ColdiAvatar pose={pose} size="xl" floating={animateMascot} />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-lavender-100 dark:bg-midnight-800 text-accent dark:text-lavender-300 text-xs font-bold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Próximamente · {phaseLabel}</span>
        </div>

        <h1 className="font-display font-bold text-2xl text-[#2E1F3E] dark:text-white">
          {title}
        </h1>

        <p className="text-sm text-[#6E5B85] dark:text-[#BAA8D1] leading-relaxed max-w-lg mx-auto">
          {description}
        </p>

        <div className="text-left rounded-2xl p-4 sm:p-5 bg-lavender-50/90 dark:bg-midnight-850 border border-lavender-200/70 dark:border-midnight-700/70 space-y-2.5">
          <p className="text-xs font-bold uppercase tracking-wider text-accent dark:text-lavender-300">
            Lo que incluirá este módulo:
          </p>
          {highlights.map((item) => (
            <div key={item} className="flex items-start gap-2.5 text-sm text-[#49375F] dark:text-[#D5C9E6]">
              <CheckCircle2 className="w-4 h-4 text-accent dark:text-lavender-300 shrink-0 mt-0.5" />
              <span>{item}</span>
            </div>
          ))}
        </div>

        <button
          onClick={onGoBack}
          className="px-5 py-2.5 rounded-2xl bg-accent hover:bg-accent-dark text-white text-sm font-semibold shadow-soft transition-colors"
        >
          Volver al Inicio
        </button>
      </div>
    </div>
  );
}
