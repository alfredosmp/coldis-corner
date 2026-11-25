/**
 * Identidad de la aplicación para Mafecita.
 */
export const BRAND_CONFIG = {
  appName: "Coldi's Corner",
  studentName: 'Mafecita',
} as const;

const PERSONAL_PROMPTS = [
  '¿Empezamos? ¿Qué vamos a repasar hoy?',
  '¿Qué materia conquistamos hoy?',
  '¿Lista para repasar un ratito?',
  'Todo listo por aquí. ¿Por dónde empezamos?',
];

export function getPersonalSubtitle(): string {
  const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  return PERSONAL_PROMPTS[dayIndex % PERSONAL_PROMPTS.length];
}
