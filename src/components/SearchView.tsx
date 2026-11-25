import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BookMarked,
  BookOpen,
  Check,
  FileText,
  FolderKanban,
  Layers,
  Search,
  SlidersHorizontal,
  StickyNote,
  X,
} from 'lucide-react';
import { SUBJECT_COLORS } from '../data/subjectStyles';
import {
  runOfflineGlobalSearch,
  type SearchContentKind,
  type SearchFilters,
  type SearchHit,
} from '../services/searchEngine';
import type { BookItem, Flashcard, GlossaryTerm, StudyNote, Subject } from '../types/models';
import { normalizeText } from '../utils/text';
import { ColdiAvatar } from './ColdiAvatar';

interface SearchViewProps {
  books: BookItem[];
  subjects: Subject[];
  glossary: GlossaryTerm[];
  studyNotes: StudyNote[];
  flashcards: Flashcard[];
  animateMascot: boolean;
  onOpenBookAt: (bookId: string, location: number, query: string) => void;
  onOpenSubject: (subjectId: string) => void;
  onOpenGlossary: () => void;
  onOpenNotes: () => void;
  onOpenFlashcards: () => void;
}

const ALL_KINDS: { id: SearchContentKind; label: string; icon: typeof BookOpen }[] = [
  { id: 'books', label: 'Contenido de libros', icon: BookOpen },
  { id: 'bookNotes', label: 'Apuntes de libros', icon: StickyNote },
  { id: 'studyNotes', label: 'Resúmenes y Esquemas', icon: FileText },
  { id: 'flashcards', label: 'Flashcards', icon: Layers },
  { id: 'subjectNotes', label: 'Bloc de materias', icon: FolderKanban },
  { id: 'glossary', label: 'Glosario Jurídico', icon: BookMarked },
];

export function SearchView({
  books,
  subjects,
  glossary,
  studyNotes,
  flashcards,
  animateMascot,
  onOpenBookAt,
  onOpenSubject,
  onOpenGlossary,
  onOpenNotes,
  onOpenFlashcards,
}: SearchViewProps) {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'results' | 'filters'>('results');
  const [bookFilterQuery, setBookFilterQuery] = useState('');

  const [filters, setFilters] = useState<SearchFilters>({
    subjectIds: [],
    bookIds: [],
    includePersonalShelf: true,
    kinds: ['books', 'bookNotes', 'studyNotes', 'flashcards', 'subjectNotes', 'glossary'],
  });

  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);

  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const bookMap = useMemo(() => new Map(books.map((b) => [b.id, b])), [books]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(async () => {
      const results = await runOfflineGlobalSearch(
        trimmed,
        filters,
        books,
        subjects,
        glossary,
        studyNotes,
        flashcards
      );
      if (!cancelled) {
        setHits(results);
        setSearching(false);
      }
    }, 140);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, filters, books, subjects, glossary, studyNotes, flashcards]);

  const activeFilterCount =
    filters.subjectIds.length +
    filters.bookIds.length +
    (filters.includePersonalShelf ? 0 : 1) +
    (filters.kinds.length < ALL_KINDS.length ? 1 : 0);

  function toggleSubjectFilter(subjectId: string) {
    setFilters((prev) => ({
      ...prev,
      subjectIds: prev.subjectIds.includes(subjectId)
        ? prev.subjectIds.filter((id) => id !== subjectId)
        : [...prev.subjectIds, subjectId],
    }));
  }

  function toggleBookFilter(bookId: string) {
    setFilters((prev) => ({
      ...prev,
      bookIds: prev.bookIds.includes(bookId)
        ? prev.bookIds.filter((id) => id !== bookId)
        : [...prev.bookIds, bookId],
    }));
  }

  function toggleKind(kind: SearchContentKind) {
    setFilters((prev) => {
      const exists = prev.kinds.includes(kind);
      if (exists && prev.kinds.length === 1) return prev;
      return {
        ...prev,
        kinds: exists ? prev.kinds.filter((k) => k !== kind) : [...prev.kinds, kind],
      };
    });
  }

  function resetFilters() {
    setFilters({
      subjectIds: [],
      bookIds: [],
      includePersonalShelf: true,
      kinds: ['books', 'bookNotes', 'studyNotes', 'flashcards', 'subjectNotes', 'glossary'],
    });
  }

  const filterableBooks = useMemo(() => {
    const q = normalizeText(bookFilterQuery);
    return books.filter((b) => {
      if (filters.subjectIds.length > 0 && b.shelf === 'law') {
        if (!b.subjectId || !filters.subjectIds.includes(b.subjectId)) return false;
      }
      if (!q) return true;
      return normalizeText(b.title).includes(q) || normalizeText(b.author).includes(q);
    });
  }, [books, bookFilterQuery, filters.subjectIds]);

  function handleHitClick(hit: SearchHit) {
    if ((hit.kind === 'books' || hit.kind === 'bookNotes') && hit.bookId) {
      onOpenBookAt(hit.bookId, hit.location ?? 1, hit.matchedQuery);
    } else if (hit.kind === 'studyNotes') {
      onOpenNotes();
    } else if (hit.kind === 'flashcards') {
      onOpenFlashcards();
    } else if (hit.kind === 'subjectNotes' && hit.subjectId) {
      onOpenSubject(hit.subjectId);
    } else if (hit.kind === 'glossary') {
      onOpenGlossary();
    }
  }

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <div className="flex items-center gap-4">
        <ColdiAvatar pose="thinking" size="md" floating={animateMascot} />
        <h1 className="font-display font-bold text-2xl sm:text-3xl text-[#2E1F3E] dark:text-white">
          Buscador
        </h1>
      </div>

      {/* Main Search Input + Tabs */}
      <div className="rounded-3xl p-4 sm:p-5 bg-white dark:bg-midnight-900 border border-lavender-200/80 dark:border-midnight-700 shadow-soft space-y-3.5">
        <div className="relative">
          <Search className="w-5 h-5 text-accent dark:text-lavender-300 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ej. prescripción adquisitiva, art. 14, dolo eventual, suspensión provisional..."
            className="w-full pl-12 pr-10 py-3 rounded-2xl bg-lavender-50 dark:bg-midnight-850 border border-lavender-200 dark:border-midnight-700 text-sm sm:text-base text-[#2E1F3E] dark:text-white placeholder:text-[#9D8AB5] focus:outline-none focus:ring-2 focus:ring-lavender-400/60"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-[#9B89B3] hover:text-accent"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex p-1 rounded-2xl bg-lavender-50 dark:bg-midnight-850 border border-lavender-200/80 dark:border-midnight-700">
            <button
              onClick={() => setActiveTab('results')}
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'results'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-[#6D588A] dark:text-[#B9A7D1]'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Resultados</span>
            </button>
            <button
              onClick={() => setActiveTab('filters')}
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'filters'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-[#6D588A] dark:text-[#B9A7D1]'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filtros</span>
              {activeFilterCount > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    activeTab === 'filters'
                      ? 'bg-white/25 text-white'
                      : 'bg-accent text-white'
                  }`}
                >
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {activeFilterCount > 0 && (
            <button
              onClick={resetFilters}
              className="text-xs font-semibold text-accent dark:text-lavender-300 hover:underline"
            >
              Limpiar todos los filtros
            </button>
          )}
        </div>

        {(filters.subjectIds.length > 0 || filters.bookIds.length > 0) && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {filters.subjectIds.map((id) => {
              const s = subjectMap.get(id);
              if (!s) return null;
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-lavender-100 dark:bg-midnight-800 text-accent dark:text-lavender-300 text-[11px] font-bold"
                >
                  <span>Materia: {s.name}</span>
                  <button onClick={() => toggleSubjectFilter(id)}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
            {filters.bookIds.map((id) => {
              const b = bookMap.get(id);
              if (!b) return null;
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blush-100 dark:bg-[#41203B] text-blush-600 dark:text-blush-200 text-[11px] font-bold"
                >
                  <span className="max-w-[180px] truncate">Libro: {b.title}</span>
                  <button onClick={() => toggleBookFilter(id)}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Filters Tab */}
      {activeTab === 'filters' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <section className="rounded-3xl p-5 bg-white dark:bg-midnight-900 border border-lavender-200/80 dark:border-midnight-700 shadow-soft space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display font-bold text-base text-[#2E1F3E] dark:text-white">
                  Filtrar por Materia
                </h2>
                <p className="text-xs text-[#7A6693] dark:text-[#A995C4]">
                  Elige una o varias materias (sin selección busca en todas)
                </p>
              </div>
              {filters.subjectIds.length > 0 && (
                <button
                  onClick={() => setFilters((p) => ({ ...p, subjectIds: [] }))}
                  className="text-xs font-semibold text-accent dark:text-lavender-300 hover:underline"
                >
                  Todas
                </button>
              )}
            </div>

            {subjects.length === 0 ? (
              <p className="text-xs text-[#7E6B96] dark:text-[#A995C4]">
                Todavía no hay materias creadas.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {subjects.map((subj) => {
                  const selected = filters.subjectIds.includes(subj.id);
                  const palette = SUBJECT_COLORS[subj.color];
                  return (
                    <button
                      key={subj.id}
                      onClick={() => toggleSubjectFilter(subj.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-bold border transition-all ${
                        selected
                          ? 'bg-accent text-white border-accent shadow-sm'
                          : `${palette.cardBg} ${palette.border} ${palette.badgeText} hover:opacity-90`
                      }`}
                    >
                      {selected && <Check className="w-3.5 h-3.5" />}
                      <span>{subj.name}</span>
                      {subj.archived && <span className="opacity-70 text-[10px]">(Arch.)</span>}
                    </button>
                  );
                })}
              </div>
            )}

            <label className="flex items-center gap-2.5 pt-2 border-t border-lavender-100 dark:border-midnight-800 text-xs font-semibold text-[#5A4574] dark:text-[#CBBCE0] cursor-pointer">
              <input
                type="checkbox"
                checked={filters.includePersonalShelf}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, includePersonalShelf: e.target.checked }))
                }
                className="rounded text-accent"
              />
              <span>Incluir libros de Lectura Personal</span>
            </label>
          </section>

          <section className="rounded-3xl p-5 bg-white dark:bg-midnight-900 border border-lavender-200/80 dark:border-midnight-700 shadow-soft space-y-3.5">
            <div>
              <h2 className="font-display font-bold text-base text-[#2E1F3E] dark:text-white">
                ¿Dónde buscar?
              </h2>
              <p className="text-xs text-[#7A6693] dark:text-[#A995C4]">
                Activa o desactiva las secciones que quieres incluir
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {ALL_KINDS.map((k) => {
                const Icon = k.icon;
                const active = filters.kinds.includes(k.id);
                return (
                  <button
                    key={k.id}
                    onClick={() => toggleKind(k.id)}
                    className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl border text-xs font-bold text-left transition-all ${
                      active
                        ? 'bg-lavender-100/90 dark:bg-midnight-800 border-accent text-accent dark:text-lavender-300'
                        : 'bg-lavender-50/50 dark:bg-midnight-850 border-lavender-200/70 dark:border-midnight-700 text-[#7A6693] dark:text-[#A995C4]'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="flex-1">{k.label}</span>
                    {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="lg:col-span-2 rounded-3xl p-5 bg-white dark:bg-midnight-900 border border-lavender-200/80 dark:border-midnight-700 shadow-soft space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="font-display font-bold text-base text-[#2E1F3E] dark:text-white">
                  Filtrar por Libro específico
                </h2>
                <p className="text-xs text-[#7A6693] dark:text-[#A995C4]">
                  Escoge uno o varios libros exactos para buscar solo dentro de ellos
                </p>
              </div>

              <div className="flex items-center gap-2">
                {books.length > 5 && (
                  <input
                    type="text"
                    value={bookFilterQuery}
                    onChange={(e) => setBookFilterQuery(e.target.value)}
                    placeholder="Buscar libro en la lista..."
                    className="px-3 py-1.5 rounded-xl bg-lavender-50 dark:bg-midnight-850 border border-lavender-200 dark:border-midnight-700 text-xs text-[#2E1F3E] dark:text-white focus:outline-none"
                  />
                )}
                {filters.bookIds.length > 0 && (
                  <button
                    onClick={() => setFilters((p) => ({ ...p, bookIds: [] }))}
                    className="text-xs font-semibold text-accent dark:text-lavender-300 hover:underline shrink-0"
                  >
                    Todos los libros
                  </button>
                )}
              </div>
            </div>

            {filterableBooks.length === 0 ? (
              <p className="text-xs text-[#7E6B96] dark:text-[#A995C4]">
                Aún no hay libros en tu biblioteca (o ninguno coincide con las materias seleccionadas).
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-64 overflow-y-auto pr-1">
                {filterableBooks.map((book) => {
                  const selected = filters.bookIds.includes(book.id);
                  const subj = book.subjectId ? subjectMap.get(book.subjectId) : undefined;
                  return (
                    <button
                      key={book.id}
                      onClick={() => toggleBookFilter(book.id)}
                      className={`flex items-center gap-2.5 p-3 rounded-2xl border text-left transition-all ${
                        selected
                          ? 'bg-accent text-white border-accent shadow-sm'
                          : 'bg-lavender-50/70 dark:bg-midnight-850 border-lavender-200/70 dark:border-midnight-700 text-[#2E1F3E] dark:text-white hover:border-lavender-400'
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 border ${
                          selected
                            ? 'bg-white/20 border-white/40 text-white'
                            : 'border-lavender-300 dark:border-midnight-600'
                        }`}
                      >
                        {selected && <Check className="w-3.5 h-3.5" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold truncate">{book.title}</p>
                        <p
                          className={`text-[10px] truncate ${
                            selected ? 'text-white/80' : 'text-[#7A6693] dark:text-[#A995C4]'
                          }`}
                        >
                          {book.format.toUpperCase()}
                          {subj ? ` · ${subj.name}` : book.shelf === 'personal' ? ' · Personal' : ''}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setActiveTab('results')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-accent hover:bg-accent-dark text-white text-xs font-bold shadow-soft"
              >
                <span>Ver resultados</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </section>
        </div>
      ) : (
        <div className="space-y-3">
          {query.trim().length < 2 ? (
            <div className="rounded-3xl p-10 text-center bg-white dark:bg-midnight-900 border border-dashed border-lavender-300 dark:border-midnight-700 space-y-3">
              <div className="flex justify-center">
                <ColdiAvatar pose="thinking" size="lg" floating={animateMascot} />
              </div>
              <h3 className="font-display font-bold text-base text-[#2E1F3E] dark:text-white">
                Escribe un tema o concepto para buscar
              </h3>
              <p className="text-xs sm:text-sm text-[#735F8C] dark:text-[#A996C3] max-w-md mx-auto">
                Busca en libros, resúmenes, esquemas, flashcards y glosario. Usa la pestaña <strong>Filtros</strong> para limitar por materia o libro específico.
              </p>
            </div>
          ) : searching ? (
            <div className="rounded-3xl p-8 text-center bg-white dark:bg-midnight-900 border border-lavender-200/80 dark:border-midnight-700">
              <p className="text-sm font-semibold text-accent dark:text-lavender-300">
                Buscando...
              </p>
            </div>
          ) : hits.length === 0 ? (
            <div className="rounded-3xl p-10 text-center bg-white dark:bg-midnight-900 border border-dashed border-lavender-300 dark:border-midnight-700 space-y-3">
              <div className="flex justify-center">
                <ColdiAvatar pose="thinking" size="lg" />
              </div>
              <h3 className="font-display font-bold text-base text-[#2E1F3E] dark:text-white">
                Sin coincidencias para "{query.trim()}"
              </h3>
              <p className="text-xs text-[#735F8C] dark:text-[#A996C3] max-w-md mx-auto">
                Prueba con palabras más cortas o revisa si tienes algún filtro activo.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {hits.map((hit) => (
                <button
                  key={hit.id}
                  onClick={() => handleHitClick(hit)}
                  className="w-full text-left rounded-3xl p-4 sm:p-5 bg-white dark:bg-midnight-900 border border-lavender-200/80 dark:border-midnight-700/80 shadow-soft hover:border-accent/60 hover:-translate-y-0.5 transition-all group space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            hit.kind === 'books'
                              ? 'bg-lavender-100 dark:bg-midnight-800 text-accent dark:text-lavender-300'
                              : hit.kind === 'bookNotes' || hit.kind === 'studyNotes'
                              ? 'bg-blush-100 dark:bg-[#41203B] text-blush-600 dark:text-blush-200'
                              : hit.kind === 'flashcards'
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                              : hit.kind === 'subjectNotes'
                              ? 'bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300'
                              : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                          }`}
                        >
                          {hit.kind === 'books'
                            ? 'Libro'
                            : hit.kind === 'bookNotes'
                            ? 'Apunte de lectura'
                            : hit.kind === 'studyNotes'
                            ? 'Resumen / Esquema'
                            : hit.kind === 'flashcards'
                            ? 'Flashcard'
                            : hit.kind === 'subjectNotes'
                            ? 'Bloc de materia'
                            : 'Glosario'}
                        </span>
                        <span className="text-xs font-semibold text-[#7A6693] dark:text-[#B4A3CB]">
                          {hit.subtitle}
                        </span>
                      </div>
                      <h3 className="font-display font-bold text-base text-[#2E1F3E] dark:text-white group-hover:text-accent dark:group-hover:text-lavender-300 transition-colors">
                        {hit.title}
                      </h3>
                    </div>

                    <span className="shrink-0 inline-flex items-center gap-1 text-xs font-bold text-accent dark:text-lavender-300 mt-1">
                      <span>Ir</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-[#574370] dark:text-[#CFC2E3] leading-relaxed">
                    {hit.snippet.before}
                    {hit.snippet.match && (
                      <mark className="bg-lavender-200/90 dark:bg-lavender-700/70 text-[#2E1F3E] dark:text-white font-semibold px-1 rounded">
                        {hit.snippet.match}
                      </mark>
                    )}
                    {hit.snippet.after}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
