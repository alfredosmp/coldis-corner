import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Edit3,
  MoreVertical,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { LAW_BRANCHES } from '../data/subjectStyles';
import type { GlossaryTerm, LawBranch } from '../types/models';
import { normalizeText } from '../utils/text';
import { ColdiAvatar } from './ColdiAvatar';

interface GlossaryViewProps {
  terms: GlossaryTerm[];
  animateMascot: boolean;
  onSaveTerm: (
    data: Omit<GlossaryTerm, 'id' | 'isFavorite' | 'isBuiltIn' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ) => Promise<{ ok: boolean; duplicateOf?: string }>;
  onToggleFavorite: (term: GlossaryTerm) => Promise<void>;
  onDeleteTerm: (id: string) => Promise<void>;
  onRestoreBuiltIn: () => Promise<number>;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

interface TermFormState {
  term: string;
  branch: LawBranch;
  definition: string;
  example: string;
  legalBasis: string;
  isLatin: boolean;
}

export function GlossaryView({
  terms,
  animateMascot,
  onSaveTerm,
  onToggleFavorite,
  onDeleteTerm,
  onRestoreBuiltIn,
}: GlossaryViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<LawBranch | 'ALL'>('ALL');
  const [selectedLetter, setSelectedLetter] = useState<string>('ALL');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [onlyCustom, setOnlyCustom] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);

  // Add / Edit modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTerm, setEditingTerm] = useState<GlossaryTerm | null>(null);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [form, setForm] = useState<TermFormState>({
    term: '',
    branch: 'Constitucional y Amparo',
    definition: '',
    example: '',
    legalBasis: '',
    isLatin: false,
  });

  useEffect(() => {
    if (!openMenuId) return;
    const close = () => setOpenMenuId(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [openMenuId]);

  const sortedTerms = useMemo(() => {
    return [...terms].sort((a, b) => a.term.localeCompare(b.term, 'es'));
  }, [terms]);

  const liveDuplicate = useMemo(() => {
    const normalized = normalizeText(form.term);
    if (!normalized) return null;
    return (
      terms.find(
        (item) => item.id !== editingTerm?.id && normalizeText(item.term) === normalized
      ) ?? null
    );
  }, [form.term, terms, editingTerm?.id]);

  const filteredTerms = useMemo(() => {
    const q = normalizeText(searchQuery);
    return sortedTerms.filter((item) => {
      if (selectedBranch !== 'ALL' && item.branch !== selectedBranch) return false;
      if (onlyFavorites && !item.isFavorite) return false;
      if (onlyCustom && item.isBuiltIn) return false;

      if (selectedLetter !== 'ALL') {
        const firstLetter = normalizeText(item.term).charAt(0).toUpperCase();
        if (firstLetter !== selectedLetter) return false;
      }

      if (!q) return true;
      return (
        normalizeText(item.term).includes(q) ||
        normalizeText(item.definition).includes(q) ||
        normalizeText(item.branch).includes(q) ||
        normalizeText(item.example ?? '').includes(q) ||
        normalizeText(item.legalBasis ?? '').includes(q)
      );
    });
  }, [sortedTerms, searchQuery, selectedBranch, selectedLetter, onlyFavorites, onlyCustom]);

  const availableLetters = useMemo(() => {
    const set = new Set<string>();
    for (const t of terms) {
      const ch = normalizeText(t.term).charAt(0).toUpperCase();
      if (ch) set.add(ch);
    }
    return set;
  }, [terms]);

  function openNewTermModal(prefillTerm = '') {
    setEditingTerm(null);
    setDuplicateError(null);
    setForm({
      term: prefillTerm,
      branch: selectedBranch === 'ALL' ? 'Constitucional y Amparo' : selectedBranch,
      definition: '',
      example: '',
      legalBasis: '',
      isLatin: selectedBranch === 'Locuciones Latinas',
    });
    setIsModalOpen(true);
  }

  function openEditTermModal(item: GlossaryTerm) {
    setOpenMenuId(null);
    setEditingTerm(item);
    setDuplicateError(null);
    setForm({
      term: item.term,
      branch: item.branch,
      definition: item.definition,
      example: item.example ?? '',
      legalBasis: item.legalBasis ?? '',
      isLatin: Boolean(item.isLatin),
    });
    setIsModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.term.trim() || !form.definition.trim()) return;
    if (liveDuplicate) {
      setDuplicateError(`Ya existe el concepto "${liveDuplicate.term}" en tu glosario.`);
      return;
    }

    const res = await onSaveTerm(
      {
        term: form.term.trim(),
        branch: form.branch,
        definition: form.definition.trim(),
        example: form.example.trim() || undefined,
        legalBasis: form.legalBasis.trim() || undefined,
        isLatin: form.isLatin || form.branch === 'Locuciones Latinas',
      },
      editingTerm?.id
    );

    if (!res.ok) {
      setDuplicateError(
        `Ya existe el concepto "${res.duplicateOf ?? form.term.trim()}" en tu glosario.`
      );
      return;
    }

    setDuplicateError(null);
    setIsModalOpen(false);
    setEditingTerm(null);
  }

  async function handleRestoreDefaults() {
    const count = await onRestoreBuiltIn();
    setRestoreMessage(
      count > 0
        ? 'Se restauraron los conceptos base faltantes del glosario.'
        : 'El glosario base ya está completo.'
    );
    setTimeout(() => setRestoreMessage(null), 3000);
  }

  const hasActiveFilters = Boolean(
    searchQuery || selectedBranch !== 'ALL' || selectedLetter !== 'ALL' || onlyFavorites || onlyCustom
  );

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <ColdiAvatar pose="reading" size="md" floating={animateMascot} />
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-[#2E1F3E] dark:text-white">
            Glosario Jurídico
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleRestoreDefaults}
            className="p-2.5 rounded-2xl bg-white dark:bg-midnight-900 border border-lavender-200 dark:border-midnight-700 text-[#6D588A] dark:text-[#BAA8D1] hover:text-accent transition-colors"
            title="Restaurar conceptos base si borraste alguno"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => openNewTermModal()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-accent hover:bg-accent-dark text-white text-sm font-semibold shadow-soft transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar término</span>
          </button>
        </div>
      </div>

      {restoreMessage && (
        <div className="px-4 py-2.5 rounded-2xl bg-lavender-100 dark:bg-midnight-800 border border-lavender-300/70 dark:border-midnight-700 text-xs font-semibold text-accent dark:text-lavender-300">
          {restoreMessage}
        </div>
      )}

      {/* Search & Filter Panel */}
      <div className="rounded-3xl p-4 sm:p-5 bg-white dark:bg-midnight-900 border border-lavender-200/80 dark:border-midnight-700 shadow-soft space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#9B89B3] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar concepto, artículo, locución latina o palabra clave..."
              className="w-full pl-10 pr-10 py-2.5 rounded-2xl bg-lavender-50 dark:bg-midnight-850 border border-lavender-200 dark:border-midnight-700 text-sm text-[#2E1F3E] dark:text-white placeholder:text-[#9D8AB5] focus:outline-none focus:ring-2 focus:ring-lavender-400/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9B89B3] hover:text-accent"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setOnlyFavorites((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl text-xs font-bold border transition-all ${
                onlyFavorites
                  ? 'bg-amber-100 dark:bg-amber-900/35 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300'
                  : 'bg-lavender-50 dark:bg-midnight-850 border-lavender-200 dark:border-midnight-700 text-[#6D588A] dark:text-[#BAA8D1]'
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${onlyFavorites ? 'fill-current' : ''}`} />
              <span>Favoritos</span>
            </button>

            <button
              onClick={() => setOnlyCustom((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl text-xs font-bold border transition-all ${
                onlyCustom
                  ? 'bg-accent text-white border-accent'
                  : 'bg-lavender-50 dark:bg-midnight-850 border-lavender-200 dark:border-midnight-700 text-[#6D588A] dark:text-[#BAA8D1]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Mis términos</span>
            </button>

            {hasActiveFilters && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedBranch('ALL');
                  setSelectedLetter('ALL');
                  setOnlyFavorites(false);
                  setOnlyCustom(false);
                }}
                className="px-3 py-2.5 rounded-2xl text-xs font-semibold text-accent dark:text-lavender-300 hover:bg-lavender-50 dark:hover:bg-midnight-800"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        {/* Branch Filter Pills */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSelectedBranch('ALL')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              selectedBranch === 'ALL'
                ? 'bg-accent text-white shadow-sm'
                : 'bg-lavender-50 dark:bg-midnight-850 text-[#685483] dark:text-[#B9A7D1] hover:bg-lavender-100 dark:hover:bg-midnight-800'
            }`}
          >
            Todas las ramas
          </button>
          {LAW_BRANCHES.map((branch) => (
            <button
              key={branch}
              onClick={() => setSelectedBranch(branch)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                selectedBranch === branch
                  ? 'bg-accent text-white shadow-sm'
                  : 'bg-lavender-50 dark:bg-midnight-850 text-[#685483] dark:text-[#B9A7D1] hover:bg-lavender-100 dark:hover:bg-midnight-800'
              }`}
            >
              {branch}
            </button>
          ))}
        </div>

        {/* Alphabetical Bar */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 pt-1 border-t border-lavender-100 dark:border-midnight-800">
          <button
            onClick={() => setSelectedLetter('ALL')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 transition-colors ${
              selectedLetter === 'ALL'
                ? 'bg-accent text-white'
                : 'text-[#7A6693] dark:text-[#A995C4] hover:bg-lavender-100 dark:hover:bg-midnight-800'
            }`}
          >
            A–Z
          </button>
          {ALPHABET.map((letter) => {
            const hasTerms = availableLetters.has(letter);
            const active = selectedLetter === letter;
            return (
              <button
                key={letter}
                disabled={!hasTerms}
                onClick={() => setSelectedLetter(active ? 'ALL' : letter)}
                className={`w-7 h-7 rounded-lg text-xs font-bold shrink-0 transition-colors ${
                  active
                    ? 'bg-accent text-white'
                    : hasTerms
                    ? 'text-[#5A4675] dark:text-[#CBBCE0] hover:bg-lavender-100 dark:hover:bg-midnight-800'
                    : 'text-[#C6B9D8] dark:text-[#4D3F63] cursor-not-allowed'
                }`}
              >
                {letter}
              </button>
            );
          })}
        </div>
      </div>

      {/* Terms Grid */}
      {filteredTerms.length === 0 ? (
        <div className="rounded-3xl p-10 text-center bg-white dark:bg-midnight-900 border border-dashed border-lavender-300 dark:border-midnight-700 space-y-3">
          <div className="flex justify-center">
            <ColdiAvatar pose="thinking" size="lg" floating={animateMascot} />
          </div>
          <h3 className="font-display font-bold text-lg text-[#2E1F3E] dark:text-white">
            No encontramos ese concepto
          </h3>
          <p className="text-sm text-[#735F8C] dark:text-[#A996C3] max-w-md mx-auto">
            Puedes agregarlo tú misma a tu glosario personal para tenerlo siempre a la mano.
          </p>
          <button
            onClick={() => openNewTermModal(searchQuery.trim())}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-accent hover:bg-accent-dark text-white text-sm font-semibold shadow-soft"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar "{searchQuery.trim() || 'nuevo término'}"</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredTerms.map((item) => {
            const isMenuOpen = openMenuId === item.id;
            return (
              <article
                key={item.id}
                className="relative rounded-3xl p-5 bg-white dark:bg-midnight-900 border border-lavender-200/80 dark:border-midnight-700/80 shadow-soft hover:border-lavender-300 dark:hover:border-lavender-600/50 transition-all flex flex-col justify-between gap-3"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-lavender-100 dark:bg-midnight-800 text-accent dark:text-lavender-300">
                          {item.branch}
                        </span>
                        {item.isLatin && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blush-100 dark:bg-[#3A2135] text-blush-500 dark:text-blush-300">
                            Latín
                          </span>
                        )}
                        {!item.isBuiltIn && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                            Personal
                          </span>
                        )}
                      </div>
                      <h3 className="font-display font-bold text-lg text-[#2E1F3E] dark:text-white leading-snug">
                        {item.term}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => onToggleFavorite(item)}
                        className={`p-1.5 rounded-xl transition-colors ${
                          item.isFavorite
                            ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/30'
                            : 'text-[#A896C0] hover:text-amber-500 hover:bg-lavender-50 dark:hover:bg-midnight-800'
                        }`}
                        title={item.isFavorite ? 'Quitar favorito' : 'Marcar favorito'}
                      >
                        <Star className={`w-4 h-4 ${item.isFavorite ? 'fill-current' : ''}`} />
                      </button>

                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(isMenuOpen ? null : item.id);
                          }}
                          className="p-1.5 rounded-xl text-[#9B89B3] hover:text-accent hover:bg-lavender-50 dark:hover:bg-midnight-800"
                          aria-label={`Opciones de ${item.term}`}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {isMenuOpen && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 mt-1 w-44 rounded-2xl bg-white dark:bg-midnight-900 border border-lavender-200 dark:border-midnight-700 shadow-soft-lg py-1.5 z-20"
                          >
                            <button
                              onClick={() => openEditTermModal(item)}
                              className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#3F2D57] dark:text-[#E8DEF6] hover:bg-lavender-50 dark:hover:bg-midnight-800"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-accent dark:text-lavender-300" />
                              <span>Editar término</span>
                            </button>
                            <button
                              onClick={() => {
                                setOpenMenuId(null);
                                onDeleteTerm(item.id);
                              }}
                              className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Eliminar</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-[#4A3861] dark:text-[#D5C9E6] leading-relaxed">
                    {item.definition}
                  </p>

                  {item.example && (
                    <div className="px-3.5 py-2.5 rounded-2xl bg-blush-50/80 dark:bg-[#2C1C2B] border border-blush-200/70 dark:border-[#492C47] text-xs text-[#6B415A] dark:text-[#E8C5DA] leading-relaxed">
                      <span className="font-bold">Ejemplo: </span>
                      {item.example}
                    </div>
                  )}
                </div>

                {item.legalBasis && (
                  <div className="px-3.5 py-2 rounded-xl bg-lavender-50 dark:bg-midnight-850 border border-lavender-200/70 dark:border-midnight-700 text-xs text-[#695285] dark:text-[#B9A7D1]">
                    <span className="font-bold text-accent dark:text-lavender-300">Fundamento MX: </span>
                    {item.legalBasis}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Add / Edit Glossary Term Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1D112C]/50 backdrop-blur-sm">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-midnight-900 border border-lavender-200 dark:border-midnight-700 shadow-soft-lg p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ColdiAvatar pose="writing" size="xs" />
                <h2 className="font-display font-bold text-xl text-[#2E1F3E] dark:text-white">
                  {editingTerm ? 'Editar término jurídico' : 'Agregar término al glosario'}
                </h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-[#7E6B96] hover:bg-lavender-100 dark:hover:bg-midnight-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#6D588A] dark:text-[#BAA8D1] mb-1.5">
                  Término o concepto *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={form.term}
                  onChange={(e) => {
                    setDuplicateError(null);
                    setForm({ ...form, term: e.target.value });
                  }}
                  placeholder="Ej. Suplencia de la queja deficiente"
                  className={`w-full px-4 py-2.5 rounded-2xl bg-lavender-50 dark:bg-midnight-850 border text-sm text-[#2E1F3E] dark:text-white focus:outline-none focus:ring-2 ${
                    liveDuplicate || duplicateError
                      ? 'border-rose-400 focus:ring-rose-400/50'
                      : 'border-lavender-200 dark:border-midnight-700 focus:ring-lavender-400'
                  }`}
                />
                {(liveDuplicate || duplicateError) && (
                  <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {duplicateError ??
                        `Este concepto ya existe en tu glosario ("${liveDuplicate?.term}"). No se permiten duplicados.`}
                    </span>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-end">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#6D588A] dark:text-[#BAA8D1] mb-1.5">
                    Rama del Derecho
                  </label>
                  <select
                    value={form.branch}
                    onChange={(e) => setForm({ ...form, branch: e.target.value as LawBranch })}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-lavender-50 dark:bg-midnight-850 border border-lavender-200 dark:border-midnight-700 text-sm text-[#2E1F3E] dark:text-white focus:outline-none focus:ring-2 focus:ring-lavender-400"
                  >
                    {LAW_BRANCHES.map((branch) => (
                      <option key={branch} value={branch}>
                        {branch}
                      </option>
                    ))}
                  </select>
                </div>

                <label className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-lavender-50 dark:bg-midnight-850 border border-lavender-200 dark:border-midnight-700 text-xs font-semibold text-[#5A4675] dark:text-[#CBBCE0] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isLatin}
                    onChange={(e) => setForm({ ...form, isLatin: e.target.checked })}
                    className="rounded text-accent focus:ring-lavender-400"
                  />
                  <span>Es locución latina</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#6D588A] dark:text-[#BAA8D1] mb-1.5">
                  Definición clara *
                </label>
                <textarea
                  required
                  rows={4}
                  value={form.definition}
                  onChange={(e) => setForm({ ...form, definition: e.target.value })}
                  placeholder="Explica el concepto con tus propias palabras o la definición doctrinal..."
                  className="w-full px-4 py-2.5 rounded-2xl bg-lavender-50 dark:bg-midnight-850 border border-lavender-200 dark:border-midnight-700 text-sm text-[#2E1F3E] dark:text-white focus:outline-none focus:ring-2 focus:ring-lavender-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#6D588A] dark:text-[#BAA8D1] mb-1.5">
                  Ejemplo práctico (opcional)
                </label>
                <textarea
                  rows={2}
                  value={form.example}
                  onChange={(e) => setForm({ ...form, example: e.target.value })}
                  placeholder="Un caso corto para recordarlo más fácil en el examen..."
                  className="w-full px-4 py-2.5 rounded-2xl bg-lavender-50 dark:bg-midnight-850 border border-lavender-200 dark:border-midnight-700 text-sm text-[#2E1F3E] dark:text-white focus:outline-none focus:ring-2 focus:ring-lavender-400 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#6D588A] dark:text-[#BAA8D1] mb-1.5">
                  Fundamento legal mexicano (opcional)
                </label>
                <input
                  type="text"
                  value={form.legalBasis}
                  onChange={(e) => setForm({ ...form, legalBasis: e.target.value })}
                  placeholder="Ej. Art. 79 Ley de Amparo"
                  className="w-full px-4 py-2.5 rounded-2xl bg-lavender-50 dark:bg-midnight-850 border border-lavender-200 dark:border-midnight-700 text-sm text-[#2E1F3E] dark:text-white focus:outline-none focus:ring-2 focus:ring-lavender-400"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-lavender-100 dark:border-midnight-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-2xl text-sm font-semibold text-[#6E5B85] dark:text-[#BBA9D3] hover:bg-lavender-100 dark:hover:bg-midnight-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={Boolean(liveDuplicate)}
                  className="px-5 py-2.5 rounded-2xl bg-accent hover:bg-accent-dark disabled:opacity-45 disabled:cursor-not-allowed text-white text-sm font-semibold shadow-soft"
                >
                  {editingTerm ? 'Guardar cambios' : 'Guardar término'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
