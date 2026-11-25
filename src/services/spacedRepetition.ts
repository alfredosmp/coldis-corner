import type { Flashcard, ReviewRating } from '../types/models';

const DAY_MS = 1000 * 60 * 60 * 24;

/**
 * SM-2 spaced repetition scheduler tailored for legal memorization.
 */
export function computeNextReview(
  card: Pick<Flashcard, 'repetitions' | 'intervalDays' | 'easeFactor'>,
  rating: ReviewRating,
  now = Date.now()
): {
  repetitions: number;
  intervalDays: number;
  easeFactor: number;
  nextReviewAt: number;
  label: string;
} {
  let { repetitions, intervalDays, easeFactor } = card;
  easeFactor = Number.isFinite(easeFactor) ? easeFactor : 2.5;

  if (rating === 'again') {
    repetitions = 0;
    intervalDays = 0;
    easeFactor = Math.max(1.3, +(easeFactor - 0.2).toFixed(2));
    return {
      repetitions,
      intervalDays,
      easeFactor,
      // Re-show in 10 minutes
      nextReviewAt: now + 10 * 60 * 1000,
      label: '10 min',
    };
  }

  if (rating === 'hard') {
    repetitions = Math.max(1, repetitions);
    intervalDays = intervalDays <= 1 ? 1 : Math.max(1, Math.round(intervalDays * 1.2));
    easeFactor = Math.max(1.3, +(easeFactor - 0.15).toFixed(2));
  } else if (rating === 'good') {
    repetitions += 1;
    if (repetitions === 1) intervalDays = 1;
    else if (repetitions === 2) intervalDays = 3;
    else intervalDays = Math.max(1, Math.round(intervalDays * easeFactor));
  } else {
    // easy
    repetitions += 1;
    if (repetitions === 1) intervalDays = 4;
    else if (repetitions === 2) intervalDays = 7;
    else intervalDays = Math.max(2, Math.round(intervalDays * easeFactor * 1.3));
    easeFactor = Math.min(3.0, +(easeFactor + 0.15).toFixed(2));
  }

  return {
    repetitions,
    intervalDays,
    easeFactor,
    nextReviewAt: now + intervalDays * DAY_MS,
    label: intervalDays === 1 ? '1 día' : `${intervalDays} días`,
  };
}

export interface ClozeSegment {
  text: string;
  isHidden: boolean;
}

/**
 * Splits a Cloze string like "El plazo es de {{15 días}} hábiles" into visible & hidden segments.
 */
export function parseClozeText(input: string): ClozeSegment[] {
  const segments: ClozeSegment[] = [];
  const regex = /\{\{([^}]+)\}\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(input)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: input.slice(lastIndex, match.index), isHidden: false });
    }
    segments.push({ text: match[1], isHidden: true });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < input.length) {
    segments.push({ text: input.slice(lastIndex), isHidden: false });
  }

  return segments;
}
