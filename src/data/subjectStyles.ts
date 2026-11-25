import type { AccentTheme, LawBranch, SubjectColorId, SubjectIconId } from '../types/models';

export interface SubjectColorStyle {
  id: SubjectColorId;
  label: string;
  swatch: string;
  cardBg: string;
  badgeBg: string;
  badgeText: string;
  border: string;
  ring: string;
}

export const SUBJECT_COLORS: Record<SubjectColorId, SubjectColorStyle> = {
  lavender: {
    id: 'lavender',
    label: 'Lavanda',
    swatch: '#C4B5FD',
    cardBg: 'bg-[#F5F0FF] dark:bg-[#2A2040]',
    badgeBg: 'bg-[#E9DCFF] dark:bg-[#3F2E61]',
    badgeText: 'text-[#6D33A3] dark:text-[#D9C2FF]',
    border: 'border-[#E2D2FA] dark:border-[#47346D]',
    ring: 'ring-[#C4B5FD]',
  },
  blush: {
    id: 'blush',
    label: 'Rosa Pastel',
    swatch: '#FBCFE8',
    cardBg: 'bg-[#FFF0F7] dark:bg-[#381E30]',
    badgeBg: 'bg-[#FFE0EE] dark:bg-[#522B46]',
    badgeText: 'text-[#B42A6C] dark:text-[#FFC2DF]',
    border: 'border-[#FAD2E5] dark:border-[#5D3250]',
    ring: 'ring-[#F9A8D4]',
  },
  lilac: {
    id: 'lilac',
    label: 'Lila Suave',
    swatch: '#E9D5FF',
    cardBg: 'bg-[#FAF2FF] dark:bg-[#2E1F3C]',
    badgeBg: 'bg-[#F0DDFC] dark:bg-[#49305F]',
    badgeText: 'text-[#7E22CE] dark:text-[#E5C1FF]',
    border: 'border-[#EAD2F9] dark:border-[#52376B]',
    ring: 'ring-[#D8B4FE]',
  },
  peach: {
    id: 'peach',
    label: 'Durazno',
    swatch: '#FED7AA',
    cardBg: 'bg-[#FFF6EE] dark:bg-[#38251C]',
    badgeBg: 'bg-[#FDE6D2] dark:bg-[#523628]',
    badgeText: 'text-[#B45309] dark:text-[#FCD1A7]',
    border: 'border-[#FADEC4] dark:border-[#5E3E2E]',
    ring: 'ring-[#FDBA74]',
  },
  mint: {
    id: 'mint',
    label: 'Menta',
    swatch: '#A7F3D0',
    cardBg: 'bg-[#EFFDF6] dark:bg-[#1A332A]',
    badgeBg: 'bg-[#D7F7E7] dark:bg-[#254A3D]',
    badgeText: 'text-[#047857] dark:text-[#9CEAC8]',
    border: 'border-[#C6F1DC] dark:border-[#2C5849]',
    ring: 'ring-[#6EE7B7]',
  },
  sky: {
    id: 'sky',
    label: 'Cielo Pingüino',
    swatch: '#BAE6FD',
    cardBg: 'bg-[#F0F9FF] dark:bg-[#1B2C3E]',
    badgeBg: 'bg-[#DCF1FE] dark:bg-[#27405A]',
    badgeText: 'text-[#0369A1] dark:text-[#A6DDFD]',
    border: 'border-[#CBE8FC] dark:border-[#2E4B6A]',
    ring: 'ring-[#7DD3FC]',
  },
  berry: {
    id: 'berry',
    label: 'Mora',
    swatch: '#F5D0FE',
    cardBg: 'bg-[#FDF4FF] dark:bg-[#361E3B]',
    badgeBg: 'bg-[#F8E2FE] dark:bg-[#4F2B57]',
    badgeText: 'text-[#A21CAF] dark:text-[#F4B9FD]',
    border: 'border-[#F2CEFB] dark:border-[#5A3263]',
    ring: 'ring-[#E879F9]',
  },
  butter: {
    id: 'butter',
    label: 'Vainilla',
    swatch: '#FEF08A',
    cardBg: 'bg-[#FEFCE8] dark:bg-[#332E18]',
    badgeBg: 'bg-[#FDF4B8] dark:bg-[#4C4422]',
    badgeText: 'text-[#A16207] dark:text-[#FDE68A]',
    border: 'border-[#F9EB9B] dark:border-[#595029]',
    ring: 'ring-[#FDE047]',
  },
};

export const SUBJECT_COLOR_LIST: SubjectColorStyle[] = Object.values(SUBJECT_COLORS);

export const SUBJECT_ICONS: { id: SubjectIconId; label: string }[] = [
  { id: 'scale', label: 'Balanza' },
  { id: 'book', label: 'Libro' },
  { id: 'gavel', label: 'Mazo' },
  { id: 'scroll', label: 'Pergamino' },
  { id: 'landmark', label: 'Tribunal' },
  { id: 'feather', label: 'Pluma' },
  { id: 'heart', label: 'Corazón' },
  { id: 'sparkles', label: 'Estrellitas' },
];

export const LAW_BRANCHES: LawBranch[] = [
  'Constitucional y Amparo',
  'Civil y Familiar',
  'Penal y CNPP',
  'Procesal y Teoría del Proceso',
  'Mercantil',
  'Laboral',
  'Administrativo',
  'Locuciones Latinas',
  'General / Otros',
];

export const ACCENT_THEMES: { id: AccentTheme; label: string; preview: string; description: string }[] = [
  { id: 'lavender', label: 'Lavanda Pastel', preview: '#9E64D8', description: 'Morado suave clásico y relajante' },
  { id: 'rose', label: 'Rosa Girly', preview: '#E25B9C', description: 'Toques rosados cálidos y dulces' },
  { id: 'grape', label: 'Morado Uva', preview: '#7C3AED', description: 'Violeta elegante con alto contraste' },
  { id: 'ice', label: 'Hielo Pingüino', preview: '#5B9BD5', description: 'Azul pastel fresco estilo Coldi' },
];
