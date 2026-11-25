import { BookMarked, X } from 'lucide-react';
import type { GlossaryTerm } from '../types/models';

export interface ActiveGlossaryPopover {
  term: GlossaryTerm;
  x: number;
  y: number;
}

interface GlossaryHoverTooltipProps {
  popover: ActiveGlossaryPopover | null;
  onClose?: () => void;
}

export function GlossaryHoverTooltip({ popover, onClose }: GlossaryHoverTooltipProps) {
  if (!popover) return null;

  const { term, x, y } = popover;
  // Clamp horizontally/vertically inside viewport so tooltip never clips off-screen
  const safeLeft = Math.max(12, Math.min(window.innerWidth - 332, x - 140));
  const preferAbove = y > 240;
  const topPos = preferAbove ? Math.max(12, y - 14) : Math.min(window.innerHeight - 200, y + 18);

  return (
    <div
      style={{
        left: `${safeLeft}px`,
        top: `${topPos}px`,
        transform: preferAbove ? 'translateY(-100%)' : 'none',
      }}
      className="fixed z-50 w-80 max-w-[calc(100vw-24px)] rounded-2xl p-4 bg-white/98 dark:bg-midnight-900/98 border border-lavender-300 dark:border-lavender-600/50 shadow-soft-lg backdrop-blur-md pointer-events-auto space-y-2"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-lavender-100 dark:bg-midnight-800 text-accent dark:text-lavender-300">
            <BookMarked className="w-2.5 h-2.5" />
            {term.branch}
          </span>
          <h4 className="font-display font-bold text-sm text-[#2E1F3E] dark:text-white mt-1 leading-snug">
            {term.term}
          </h4>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#9B89B3] hover:text-accent shrink-0"
            aria-label="Cerrar definición"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <p className="text-xs text-[#4A3861] dark:text-[#DFD5EF] leading-relaxed">
        {term.definition}
      </p>

      {term.legalBasis && (
        <p className="text-[11px] font-semibold text-accent dark:text-lavender-300 pt-1 border-t border-lavender-100 dark:border-midnight-800">
          § {term.legalBasis}
        </p>
      )}
    </div>
  );
}
