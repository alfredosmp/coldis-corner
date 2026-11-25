/**
 * Normalizes Spanish text for accent-insensitive and case-insensitive search.
 * Example: "Prescripción Adquisitiva" -> "prescripcion adquisitiva"
 */
export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return '¡Buenos días';
  if (hour >= 12 && hour < 19) return '¡Buenas tardes';
  return '¡Buenas noches';
}

export function formatShortDate(timestamp: number): string {
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(timestamp));
}
