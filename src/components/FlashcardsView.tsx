import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bookmark,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Edit3,
  EyeOff,
  FileText,
  HelpCircle,
  LayoutGrid,
  Layers,
  MoreVertical,
  Plus,
  RotateCw,
  Shuffle,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { SUBJECT_COLORS } from '../data/subjectStyles';
import { computeNextReview, parseClozeText } from '../services/spacedRepetition';
import type { Flashcard, FlashcardMode, ReviewRating, Subject } from '../types/models';
import { ColdiAvatar } from './ColdiAvatar';

interface FlashcardsViewProps {
  cards: Flashcard[];
  subjects: Subject[];
  animateMascot: boolean;
  initialSubjectFilter?: string;
  onSaveCard: (
    data: Pick<Flashcard, 'subjectId' | 'deckName' | 'mode' | 'front' | 'back' | 'legalRef'>,
    existingId?: string
  ) => Promise<void>;
  onReviewCard: (card: Flashcard, rating: ReviewRating) => Promise<void>;
  onToggleNeedsReview: (card: Flashcard) => Promise<void>;
  onDeleteCard: (id: string) => Promise<void>;
}

interface CardFormState {
  subjectId: string;
  deckName: string;
  mode: FlashcardMode;
  front: string;
  back: string;
  legalRef: string;
}

function getCardTopicLabel(card: Flashcard): string {
  return (card.sourceNoteTitle?.trim() || card.deckName.trim() || 'General').trim();
}

export function FlashcardsView({
  cards,
  subjects,
  animateMascot,
  initialSubjectFilter = 'ALL',
  onSaveCard,
  onReviewCard,
  onToggleNeedsReview,
  onDeleteCard,
}: FlashcardsViewProps) {
  const [subjectFilter, setSubjectFilter] = useState<string>(initialSubjectFilter);
  const [topicFilter, setTopicFilter] = useState<string>('ALL');
  const [onlyNeedsReview, setOnlyNeedsReview] = useState(false);

  const [viewMode, setViewMode] = useState<'deck' | 'manage'>('deck');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [shuffledOrder, setShuffledOrder] = useState<string[] | null>(null);

  // Discreet ⋮ menu + delete confirmation + SM-2 help popover
  const [openMenuCardId, setOpenMenuCardId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Flashcard | null>(null);
  const [showRatingInfo, setShowRatingInfo] = useState(false);

  // Create / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null);
  const [form, setForm] = useState<CardFormState>({
    subjectId: '',
    deckName: '',
    mode: 'basic',
    front: '',
    back: '',
    legalRef: '',
  });

  const frontAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const activeSubjects = useMemo(() => subjects.filter((s) => !s.archived), [subjects]);
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);

  // Close open ⋮ popover on outside click
  useEffect(() => {
    if (!openMenuCardId) return;
    const close = () => setOpenMenuCardId(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [openMenuCardId]);

  // Step 1: Filter by Materia
  const cardsBySubject = useMemo(() => {
    return cards.filter((c) => {
      if (subjectFilter === 'ALL') return true;
      if (subjectFilter === 'NONE') return !c.subjectId;
      return c.subjectId === subjectFilter;
    });
  }, [cards, subjectFilter]);

  // Step 2: Build available Apunte / Tema sub-filters inside the selected Materia
  const availableTopics = useMemo(() => {
    const counts = new Map<string, { label: string; count: number; fromNote: boolean }>();
    for (const c of cardsBySubject) {
      const label = getCardTopicLabel(c);
      const prev = counts.get(label);
      if (prev) {
        prev.count += 1;
        prev.fromNote = prev.fromNote || Boolean(c.sourceNoteId);
      } else {
        counts.set(label, { label, count: 1, fromNote: Boolean(c.sourceNoteId) });
      }
    }
    return Array.from(counts.values()).sort((a, b) => a.label.localeCompare(b.label, 'es'));
  }, [cardsBySubject]);

  // Cards matching Materia + Apunte/Tema (before needsReview toggle, so counter stays accurate)
  const cardsByTopic = useMemo(() => {
    if (topicFilter === 'ALL') return cardsBySubject;
    return cardsBySubject.filter((c) => getCardTopicLabel(c) === topicFilter);
  }, [cardsBySubject, topicFilter]);

  const needsReviewCount = useMemo(
    () => cardsByTopic.filter((c) => Boolean(c.needsReview)).length,
    [cardsByTopic]
  );

  // Final filtered deck
  const filteredCards = useMemo(() => {
    const base = onlyNeedsReview
      ? cardsByTopic.filter((c) => Boolean(c.needsReview))
      : cardsByTopic;

    if (shuffledOrder) {
      const orderMap = new Map(shuffledOrder.map((id, idx) => [id, idx]));
      return [...base].sort(
        (a, b) => (orderMap.get(a.id) ?? 9999) - (orderMap.get(b.id) ?? 9999)
      );
    }

    // Prioritize cards marked as "Por repasar" first, then by nextReviewAt
    return [...base].sort((a, b) => {
      const aMark = a.needsReview ? 0 : 1;
      const bMark = b.needsReview ? 0 : 1;
      if (aMark !== bMark) return aMark - bMark;
      return a.nextReviewAt - b.nextReviewAt;
    });
  }, [cardsByTopic, onlyNeedsReview, shuffledOrder]);

  // Reset sub-topic if selected topic no longer exists under new Materia
  useEffect(() => {
    if (topicFilter !== 'ALL' && !availableTopics.some((t) => t.label === topicFilter)) {
      setTopicFilter('ALL');
    }
  }, [availableTopics, topicFilter]);

  // Keep index valid whenever filters or deck size change
  useEffect(() => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setOpenMenuCardId(null);
  }, [subjectFilter, topicFilter, onlyNeedsReview, shuffledOrder]);

  useEffect(() => {
    if (currentIndex >= filteredCards.length && filteredCards.length > 0) {
      setCurrentIndex(filteredCards.length - 1);
      setIsFlipped(false);
    }
  }, [filteredCards.length, currentIndex]);

  const currentCard = filteredCards[currentIndex] ?? null;

  // Keyboard shortcuts (Space to flip, Left/Right to move)
  useEffect(() => {
    if (viewMode !== 'deck' || isModalOpen || deleteTarget || filteredCards.length === 0) return;
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsFlipped((f) => !f);
      } else if (e.key === 'ArrowRight') {
        setIsFlipped(false);
        setOpenMenuCardId(null);
        setCurrentIndex((i) => (i + 1) % filteredCards.length);
      } else if (e.key === 'ArrowLeft') {
        setIsFlipped(false);
        setOpenMenuCardId(null);
        setCurrentIndex((i) => (i - 1 + filteredCards.length) % filteredCards.length);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [viewMode, isModalOpen, deleteTarget, filteredCards.length]);

  function openNewCardModal() {
    const chosenSubjId =
      subjectFilter !== 'ALL' && subjectFilter !== 'NONE' ? subjectFilter : '';
    const subjName = chosenSubjId ? subjectMap.get(chosenSubjId)?.name ?? '' : '';
    setEditingCard(null);
    setForm({
      subjectId: chosenSubjId,
      deckName: topicFilter !== 'ALL' ? topicFilter : subjName || 'General',
      mode: 'basic',
      front: '',
      back: '',
      legalRef: '',
    });
    setIsModalOpen(true);
  }

  function openEditCardModal(card: Flashcard) {
    setOpenMenuCardId(null);
    setEditingCard(card);
    setForm({
      subjectId: card.subjectId ?? '',
      deckName: card.deckName,
      mode: card.mode,
      front: card.front,
      back: card.back,
      legalRef: card.legalRef ?? '',
    });
    setIsModalOpen(true);
  }

  function wrapSelectionAsCloze() {
    const el = frontAreaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (start === end) return;
    const selected = form.front.slice(start, end);
    if (!selected.trim()) return;
    const next = form.front.slice(0, start) + `{{${selected}}}` + form.front.slice(end);
    setForm((prev) => ({ ...prev, front: next }));
  }

  async function handleSubmitCard(e: React.FormEvent) {
    e.preventDefault();
    if (!form.front.trim()) return;
    if (form.mode === 'basic' && !form.back.trim()) return;

    await onSaveCard(
      {
        subjectId: form.subjectId || undefined,
        deckName: form.deckName.trim() || 'General',
        mode: form.mode,
        front: form.front.trim(),
        back: form.back.trim(),
        legalRef: form.legalRef.trim() || undefined,
      },
      editingCard?.id
    );
    setIsModalOpen(false);
    setEditingCard(null);
  }

  function handlePrevCard() {
    if (filteredCards.length === 0) return;
    setIsFlipped(false);
    setOpenMenuCardId(null);
    setCurrentIndex((i) => (i - 1 + filteredCards.length) % filteredCards.length);
  }

  function handleNextCard() {
    if (filteredCards.length === 0) return;
    setIsFlipped(false);
    setOpenMenuCardId(null);
    setCurrentIndex((i) => (i + 1) % filteredCards.length);
  }

  function handleShuffle() {
    const ids = filteredCards.map((c) => c.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    setShuffledOrder(ids);
  }

  async function handleRate(rating: ReviewRating) {
    if (!currentCard) return;
    await onReviewCard(currentCard, rating);
    // If studying only "Por repasar" and card was mastered (good/easy), it leaves the list automatically
    if (onlyNeedsReview && (rating === 'good' || rating === 'easy')) {
      setIsFlipped(false);
      return;
    }
    handleNextCard();
  }

  async function confirmDeleteCard() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    await onDeleteCard(id);
  }

  function renderCardMenu(card: Flashcard, alignTop = true) {
    const isOpen = openMenuCardId === card.id;
    return (
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpenMenuCardId(isOpen ? null : card.id);
          }}
          className="p-1.5 rounded-xl text-[#8A76A3] hover:text-accent hover:bg-lavender-100/80 dark:hover:bg-midnight-800 transition-colors"
          aria-label="Opciones de tarjeta"
          title="Opciones"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {isOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            className={`absolute right-0 ${
              alignTop ? 'mt-1' : 'bottom-9'
            } w-52 rounded-2xl bg-white dark:bg-midnight-900 border border-lavender-200 dark:border-midnight-700 shadow-soft-lg py-1.5 z-40 text-left`}
          >
            <button
              type="button"
              onClick={async () => {
                setOpenMenuCardId(null);
                await onToggleNeedsReview(card);
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-[#3F2D57] dark:text-[#E8DEF6] hover:bg-lavender-50 dark:hover:bg-midnight-800"
            >
              {card.needsReview ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Ya me la sé</span>
                </>
              ) : (
                <>
                  <Bookmark className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>Todavía no me la sé</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => openEditCardModal(card)}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-[#3F2D57] dark:text-[#E8DEF6] hover:bg-lavender-50 dark:hover:bg-midnight-800"
            >
              <Edit3 className="w-3.5 h-3.5 text-accent dark:text-lavender-300 shrink-0" />
              <span>Editar tarjeta</span>
            </button>

            <div className="my-1 border-t border-lavender-100 dark:border-midnight-800" />

            <button
              type="button"
              onClick={() => {
                setOpenMenuCardId(null);
                setDeleteTarget(card);
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
            >
              <Trash2 className="w-3.5 h-3.5 shrink-0" />
              <span>Eliminar tarjeta</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  const cardSubject = currentCard?.subjectId ? subjectMap.get(currentCard.subjectId) : undefined;
  const hasGeneralCards = cards.some((c) => !c.subjectId);

  return (
    <div className="space-y-5 pb-10">
      {/* Clean Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <ColdiAvatar pose="thinking" size="md" floating={animateMascot} />
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-[#2E1F3E] dark:text-white">
            Flashcards
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="inline-flex p-1 rounded-2xl bg-white dark:bg-midnight-900 border border-lavender-200/80 dark:border-midnight-700">
            <button
              onClick={() => setViewMode('deck')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'deck'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-[#6D588A] dark:text-[#B9A7D1]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Repasar</span>
            </button>
            <button
              onClick={() => setViewMode('manage')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'manage'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-[#6D588A] dark:text-[#B9A7D1]'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Todas</span>
            </button>
          </div>

          <button
            onClick={openNewCardModal}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-accent hover:bg-accent-dark text-white text-xs font-bold shadow-soft transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva tarjeta</span>
          </button>
        </div>
      </div>

      {/* Filter Row 1: Materias */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setSubjectFilter('ALL');
              setTopicFilter('ALL');
              setShuffledOrder(null);
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
              subjectFilter === 'ALL'
                ? 'bg-accent text-white shadow-sm'
                : 'bg-white dark:bg-midnight-900 border border-lavender-200 dark:border-midnight-700 text-[#685483] dark:text-[#B9A7D1] hover:border-accent'
            }`}
          >
            Todas ({cards.length})
          </button>

          {activeSubjects.map((subj) => {
            const count = cards.filter((c) => c.subjectId === subj.id).length;
            const active = subjectFilter === subj.id;
            const palette = SUBJECT_COLORS[subj.color];
            return (
              <button
                key={subj.id}
                onClick={() => {
                  setSubjectFilter(subj.id);
                  setTopicFilter('ALL');
                  setShuffledOrder(null);
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all ${
                  active
                    ? 'bg-accent text-white border-accent shadow-sm'
                    : `${palette.cardBg} ${palette.border} ${palette.badgeText} hover:opacity-90`
                }`}
              >
                {subj.name} ({count})
              </button>
            );
          })}

          {hasGeneralCards && (
            <button
              onClick={() => {
                setSubjectFilter('NONE');
                setTopicFilter('ALL');
                setShuffledOrder(null);
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                subjectFilter === 'NONE'
                  ? 'bg-accent text-white shadow-sm'
                  : 'bg-white dark:bg-midnight-900 border border-lavender-200 dark:border-midnight-700 text-[#685483] dark:text-[#B9A7D1]'
              }`}
            >
              General ({cards.filter((c) => !c.subjectId).length})
            </button>
          )}
        </div>

        {/* Filter Row 2: Sub-filters by Apunte / Tema + "Por repasar" */}
        {cardsBySubject.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            {/* Por repasar toggle (only cards marked "Todavía no me la sé") */}
            <button
              onClick={() => setOnlyNeedsReview((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-all ${
                onlyNeedsReview
                  ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                  : 'bg-amber-50/90 dark:bg-amber-950/35 border-amber-200/80 dark:border-amber-800/60 text-amber-800 dark:text-amber-200 hover:border-amber-400'
              }`}
              title="Estudiar solo las tarjetas marcadas como «Todavía no me la sé»"
            >
              <Bookmark className={`w-3.5 h-3.5 ${onlyNeedsReview ? 'fill-current' : ''}`} />
              <span>Por repasar ({needsReviewCount})</span>
            </button>

            {availableTopics.length > 1 && (
              <>
                <span className="h-4 w-px bg-lavender-200 dark:bg-midnight-700 mx-0.5" />
                <button
                  onClick={() => {
                    setTopicFilter('ALL');
                    setShuffledOrder(null);
                  }}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
                    topicFilter === 'ALL'
                      ? 'bg-lavender-200/90 dark:bg-midnight-700 text-[#2E1F3E] dark:text-white'
                      : 'bg-white/80 dark:bg-midnight-900/70 border border-lavender-200/70 dark:border-midnight-700 text-[#735F8C] dark:text-[#A995C4] hover:border-accent'
                  }`}
                >
                  Todos los apuntes
                </button>

                {availableTopics.map((topic) => {
                  const active = topicFilter === topic.label;
                  return (
                    <button
                      key={topic.label}
                      onClick={() => {
                        setTopicFilter(topic.label);
                        setShuffledOrder(null);
                      }}
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
                        active
                          ? 'bg-lavender-200/95 dark:bg-midnight-700 text-[#2E1F3E] dark:text-white ring-1 ring-accent/50'
                          : 'bg-white/80 dark:bg-midnight-900/70 border border-lavender-200/70 dark:border-midnight-700 text-[#735F8C] dark:text-[#A995C4] hover:border-accent'
                      }`}
                    >
                      {topic.fromNote && <FileText className="w-3 h-3 shrink-0 opacity-75" />}
                      <span className="max-w-[180px] truncate">{topic.label}</span>
                      <span className="opacity-70">({topic.count})</span>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>

      {/* Empty State */}
      {filteredCards.length === 0 ? (
        <div className="rounded-3xl p-10 text-center bg-white dark:bg-midnight-900 border border-dashed border-lavender-300 dark:border-midnight-700 space-y-3">
          <div className="flex justify-center">
            <ColdiAvatar pose="thinking" size="lg" floating={animateMascot} />
          </div>
          {onlyNeedsReview ? (
            <>
              <h3 className="font-display font-bold text-lg text-[#2E1F3E] dark:text-white">
                ¡No tienes tarjetas pendientes por repasar aquí!
              </h3>
              <p className="text-sm text-[#735F8C] dark:text-[#A996C3] max-w-md mx-auto">
                Cuando marques una tarjeta con «Todavía no me la sé» (desde los ⋮ o al pulsar Otra vez / Difícil), aparecerá en esta ronda enfocada.
              </p>
              <button
                onClick={() => setOnlyNeedsReview(false)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-lavender-100 dark:bg-midnight-800 text-accent dark:text-lavender-300 text-sm font-semibold"
              >
                Ver todas las tarjetas
              </button>
            </>
          ) : (
            <>
              <h3 className="font-display font-bold text-lg text-[#2E1F3E] dark:text-white">
                No hay tarjetas en esta materia todavía
              </h3>
              <p className="text-sm text-[#735F8C] dark:text-[#A996C3] max-w-md mx-auto">
                Crea tarjetas aquí o genéralas directamente desde tus apuntes.
              </p>
              <button
                onClick={openNewCardModal}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-accent hover:bg-accent-dark text-white text-sm font-semibold shadow-soft"
              >
                <Plus className="w-4 h-4" />
                <span>Crear tarjeta</span>
              </button>
            </>
          )}
        </div>
      ) : viewMode === 'deck' && currentCard ? (
        /* === GOOGLE NOTEBOOKLM-STYLE 3D FLIP FLASHCARD VIEWER === */
        <div className="max-w-2xl mx-auto space-y-5 pt-2">
          {/* Interactive 3D Flip Card */}
          <div className="flashcard-scene">
            <div
              onClick={() => setIsFlipped((f) => !f)}
              className={`flashcard-inner cursor-pointer select-none ${
                isFlipped ? 'is-flipped' : ''
              }`}
            >
              {/* FRONT FACE */}
              <div className="flashcard-face rounded-3xl p-7 sm:p-9 bg-white dark:bg-midnight-900 border border-lavender-200/90 dark:border-midnight-700 shadow-soft-lg flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-lavender-100 dark:bg-midnight-800 text-accent dark:text-lavender-300 truncate max-w-[180px]">
                      {cardSubject ? cardSubject.name : getCardTopicLabel(currentCard)}
                    </span>
                    {currentCard.needsReview && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200">
                        <Bookmark className="w-3 h-3 fill-current" />
                        Por repasar
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-[#8E7AA8] dark:text-[#A995C4] mr-1">
                      <RotateCw className="w-3.5 h-3.5" />
                      Toca para voltear
                    </span>
                    {renderCardMenu(currentCard)}
                  </div>
                </div>

                <div className="py-6 text-center space-y-3">
                  {currentCard.mode === 'cloze' ? (
                    <p className="text-xl sm:text-2xl font-medium text-[#2E1F3E] dark:text-white leading-relaxed">
                      {parseClozeText(currentCard.front).map((seg, i) =>
                        seg.isHidden ? (
                          <span
                            key={i}
                            className="inline-block px-3 py-0.5 mx-0.5 rounded-xl bg-lavender-200/90 dark:bg-midnight-700 text-accent dark:text-lavender-300 font-bold tracking-widest"
                          >
                            •••
                          </span>
                        ) : (
                          <span key={i}>{seg.text}</span>
                        )
                      )}
                    </p>
                  ) : (
                    <p className="font-display font-bold text-xl sm:text-2xl text-[#2E1F3E] dark:text-white leading-snug">
                      {currentCard.front}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#9A87B2]">
                  <span className="truncate max-w-[70%]">{getCardTopicLabel(currentCard)}</span>
                  <span>
                    {currentIndex + 1} / {filteredCards.length}
                  </span>
                </div>
              </div>

              {/* BACK FACE */}
              <div className="flashcard-face flashcard-back rounded-3xl p-7 sm:p-9 bg-gradient-to-br from-lavender-100/85 via-white to-blush-50/90 dark:from-[#2C1E42] dark:via-midnight-900 dark:to-[#321B33] border border-accent/50 shadow-soft-lg flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-accent text-white">
                      Respuesta
                    </span>
                    {currentCard.needsReview && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200">
                        <Bookmark className="w-3 h-3 fill-current" />
                        Por repasar
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-[#7A6693] dark:text-[#C5B5DA] mr-1">
                      <RotateCw className="w-3.5 h-3.5" />
                      Toca para girar
                    </span>
                    {renderCardMenu(currentCard)}
                  </div>
                </div>

                <div className="py-5 text-center space-y-3.5 overflow-y-auto">
                  {currentCard.mode === 'cloze' ? (
                    <>
                      <p className="text-lg sm:text-xl font-medium text-[#2E1F3E] dark:text-white leading-relaxed">
                        {parseClozeText(currentCard.front).map((seg, i) =>
                          seg.isHidden ? (
                            <span
                              key={i}
                              className="inline-block px-2 py-0.5 mx-0.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-200 font-bold"
                            >
                              {seg.text}
                            </span>
                          ) : (
                            <span key={i}>{seg.text}</span>
                          )
                        )}
                      </p>
                      {currentCard.back && (
                        <p className="text-xs sm:text-sm text-[#6E5B85] dark:text-[#C8B9DC]">
                          {currentCard.back}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-base sm:text-xl font-semibold text-[#2E1F3E] dark:text-white leading-relaxed whitespace-pre-line">
                      {currentCard.back}
                    </p>
                  )}

                  {currentCard.legalRef && (
                    <div className="inline-block px-3 py-1 rounded-xl bg-white/80 dark:bg-midnight-850 border border-lavender-200/80 dark:border-midnight-700 text-xs font-bold text-accent dark:text-lavender-300">
                      § {currentCard.legalRef}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#8A76A3]">
                  <span className="truncate max-w-[70%]">{getCardTopicLabel(currentCard)}</span>
                  <span>
                    {currentIndex + 1} / {filteredCards.length}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* NotebookLM-style Navigation Bar (Prev / Counter / Shuffle / Next) */}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={handlePrevCard}
              className="p-3 rounded-2xl bg-white dark:bg-midnight-900 border border-lavender-200 dark:border-midnight-700 text-[#4A3861] dark:text-[#E2D8F3] hover:border-accent shadow-sm transition-all active:scale-95"
              title="Tarjeta anterior (←)"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <span className="min-w-[84px] text-center font-display font-bold text-sm text-[#2E1F3E] dark:text-white tabular-nums">
              {currentIndex + 1} / {filteredCards.length}
            </span>

            <button
              onClick={handleNextCard}
              className="p-3 rounded-2xl bg-white dark:bg-midnight-900 border border-lavender-200 dark:border-midnight-700 text-[#4A3861] dark:text-[#E2D8F3] hover:border-accent shadow-sm transition-all active:scale-95"
              title="Siguiente tarjeta (→)"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            <button
              onClick={handleShuffle}
              className="p-3 rounded-2xl bg-lavender-100/80 dark:bg-midnight-800 text-accent dark:text-lavender-300 hover:bg-lavender-200/80 transition-colors"
              title="Mezclar orden"
            >
              <Shuffle className="w-4 h-4" />
            </button>
          </div>

          {/* Discreet SM-2 rating pills appear when flipped */}
          {isFlipped && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-semibold text-[#7A6693] dark:text-[#A995C4]">
                  ¿Qué tanto te la supiste?
                </span>
                <button
                  type="button"
                  onClick={() => setShowRatingInfo((v) => !v)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent dark:text-lavender-300 hover:underline"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>¿Qué significa?</span>
                </button>
              </div>

              {showRatingInfo && (
                <div className="p-3 rounded-2xl bg-lavender-50 dark:bg-midnight-850 border border-lavender-200/80 dark:border-midnight-700 text-[11px] text-[#5A4574] dark:text-[#D1C3E5] space-y-1">
                  <p>
                    <strong className="text-rose-600 dark:text-rose-300">Otra vez / Difícil:</strong> La marca automáticamente en <strong>Por repasar</strong> para volvértela a preguntar pronto.
                  </p>
                  <p>
                    <strong className="text-emerald-600 dark:text-emerald-300">Bien / Fácil:</strong> La descarta de <strong>Por repasar</strong> y la programa para días después para que no pierdas tiempo en lo que ya dominas.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-4 gap-2">
                {(
                  [
                    { id: 'again', label: 'Otra vez', style: 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300' },
                    { id: 'hard', label: 'Difícil', style: 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300' },
                    { id: 'good', label: 'Bien', style: 'bg-lavender-100 dark:bg-midnight-800 text-accent dark:text-lavender-300' },
                    { id: 'easy', label: 'Fácil', style: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' },
                  ] as const
                ).map((opt) => {
                  const preview = computeNextReview(currentCard, opt.id);
                  return (
                    <button
                      key={opt.id}
                      onClick={() => handleRate(opt.id)}
                      className={`py-2 px-2 rounded-2xl font-bold text-xs transition-opacity hover:opacity-90 ${opt.style}`}
                    >
                      <span className="block">{opt.label}</span>
                      <span className="text-[10px] opacity-75">{preview.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* === MANAGE ALL CARDS GRID === */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {filteredCards.map((card, idx) => {
            const subj = card.subjectId ? subjectMap.get(card.subjectId) : undefined;
            return (
              <div
                key={card.id}
                onClick={() => {
                  setCurrentIndex(idx);
                  setIsFlipped(false);
                  setViewMode('deck');
                }}
                className="cursor-pointer rounded-3xl p-4 sm:p-5 bg-white dark:bg-midnight-900 border border-lavender-200/80 dark:border-midnight-700 hover:border-accent/60 shadow-soft flex flex-col justify-between gap-3 transition-all"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-lavender-100 dark:bg-midnight-800 text-accent dark:text-lavender-300 truncate max-w-[150px]">
                        {card.mode === 'cloze' ? (
                          <>
                            <EyeOff className="w-3 h-3 shrink-0" /> Ocultar palabras
                          </>
                        ) : (
                          subj?.name ?? getCardTopicLabel(card)
                        )}
                      </span>
                      {card.needsReview && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200">
                          <Bookmark className="w-2.5 h-2.5 fill-current" />
                          Por repasar
                        </span>
                      )}
                    </div>
                    {renderCardMenu(card)}
                  </div>

                  <p className="text-sm font-bold text-[#2E1F3E] dark:text-white leading-snug line-clamp-3">
                    {card.front}
                  </p>
                  {card.back && (
                    <p className="text-xs text-[#6E5B85] dark:text-[#B4A3CB] line-clamp-2">
                      {card.back}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 text-[11px] text-[#8A76A3]">
                  <span className="truncate">{getCardTopicLabel(card)}</span>
                  {card.legalRef && (
                    <span className="font-semibold text-accent dark:text-lavender-300 shrink-0">
                      § {card.legalRef}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Safe Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1D112C]/55 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-midnight-900 border border-lavender-200 dark:border-midnight-700 shadow-soft-lg p-6 space-y-4">
            <h3 className="font-display font-bold text-lg text-[#2E1F3E] dark:text-white">
              ¿Eliminar esta flashcard?
            </h3>
            <p className="text-xs text-[#6E5B85] dark:text-[#B4A3CB] line-clamp-3 leading-relaxed">
              "{deleteTarget.front}"
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-2xl text-xs font-bold text-[#6E5B85] dark:text-[#BBA9D3] hover:bg-lavender-100 dark:hover:bg-midnight-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteCard}
                className="px-4 py-2 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Flashcard Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1D112C]/55 backdrop-blur-sm">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-midnight-900 border border-lavender-200 dark:border-midnight-700 shadow-soft-lg p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ColdiAvatar pose="thinking" size="xs" />
                <h2 className="font-display font-bold text-xl text-[#2E1F3E] dark:text-white">
                  {editingCard ? 'Editar tarjeta' : 'Nueva tarjeta'}
                </h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-[#7E6B96] hover:bg-lavender-100 dark:hover:bg-midnight-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitCard} className="space-y-4">
              <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-lavender-50 dark:bg-midnight-850 border border-lavender-200 dark:border-midnight-700">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, mode: 'basic' }))}
                  className={`py-2 rounded-xl text-xs font-bold transition-all ${
                    form.mode === 'basic'
                      ? 'bg-accent text-white shadow-sm'
                      : 'text-[#6D588A] dark:text-[#B9A7D1]'
                  }`}
                >
                  Clásica
                </button>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, mode: 'cloze' }))}
                  className={`py-2 rounded-xl text-xs font-bold transition-all ${
                    form.mode === 'cloze'
                      ? 'bg-accent text-white shadow-sm'
                      : 'text-[#6D588A] dark:text-[#B9A7D1]'
                  }`}
                >
                  Ocultar palabras
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#6D588A] dark:text-[#BAA8D1] mb-1.5">
                    Materia
                  </label>
                  <select
                    value={form.subjectId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      const sName = nextId ? subjectMap.get(nextId)?.name ?? '' : '';
                      setForm((prev) => ({
                        ...prev,
                        subjectId: nextId,
                        deckName:
                          !prev.deckName || prev.deckName === 'General' ? sName || 'General' : prev.deckName,
                      }));
                    }}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-lavender-50 dark:bg-midnight-850 border border-lavender-200 dark:border-midnight-700 text-sm text-[#2E1F3E] dark:text-white"
                  >
                    <option value="">General</option>
                    {activeSubjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#6D588A] dark:text-[#BAA8D1] mb-1.5">
                    Tema / Apunte *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.deckName}
                    onChange={(e) => setForm({ ...form, deckName: e.target.value })}
                    placeholder="Ej. Derecho Familiar, Plazos, Vocabulario..."
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-lavender-50 dark:bg-midnight-850 border border-lavender-200 dark:border-midnight-700 text-sm text-[#2E1F3E] dark:text-white focus:outline-none focus:ring-2 focus:ring-lavender-400"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#6D588A] dark:text-[#BAA8D1]">
                    {form.mode === 'cloze' ? 'Texto completo *' : 'Frente (Concepto / Pregunta) *'}
                  </label>
                  {form.mode === 'cloze' && (
                    <button
                      type="button"
                      onClick={wrapSelectionAsCloze}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-lavender-100 dark:bg-midnight-800 text-accent dark:text-lavender-300 text-[11px] font-bold"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Ocultar selección {'{{...}}'}</span>
                    </button>
                  )}
                </div>
                <textarea
                  ref={frontAreaRef}
                  required
                  rows={3}
                  value={form.front}
                  onChange={(e) => setForm({ ...form, front: e.target.value })}
                  placeholder={
                    form.mode === 'cloze'
                      ? 'Ej. El plazo genérico para promover el amparo es de {{15 días}} hábiles.'
                      : 'Escribe la pregunta o definición...'
                  }
                  className="w-full px-4 py-2.5 rounded-2xl bg-lavender-50 dark:bg-midnight-850 border border-lavender-200 dark:border-midnight-700 text-sm text-[#2E1F3E] dark:text-white focus:outline-none focus:ring-2 focus:ring-lavender-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#6D588A] dark:text-[#BAA8D1] mb-1.5">
                  {form.mode === 'cloze' ? 'Nota adicional (opcional)' : 'Reverso (Respuesta / Concepto) *'}
                </label>
                <textarea
                  required={form.mode === 'basic'}
                  rows={3}
                  value={form.back}
                  onChange={(e) => setForm({ ...form, back: e.target.value })}
                  placeholder="Respuesta clara y concisa..."
                  className="w-full px-4 py-2.5 rounded-2xl bg-lavender-50 dark:bg-midnight-850 border border-lavender-200 dark:border-midnight-700 text-sm text-[#2E1F3E] dark:text-white focus:outline-none focus:ring-2 focus:ring-lavender-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#6D588A] dark:text-[#BAA8D1] mb-1.5">
                  Referencia / Artículo (opcional)
                </label>
                <input
                  type="text"
                  value={form.legalRef}
                  onChange={(e) => setForm({ ...form, legalRef: e.target.value })}
                  placeholder="Ej. Art. 17 Ley de Amparo"
                  className="w-full px-4 py-2.5 rounded-2xl bg-lavender-50 dark:bg-midnight-850 border border-lavender-200 dark:border-midnight-700 text-sm text-[#2E1F3E] dark:text-white focus:outline-none focus:ring-2 focus:ring-lavender-400"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-lavender-100 dark:border-midnight-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-2xl text-sm font-semibold text-[#6E5B85] dark:text-[#BBA9D3]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-2xl bg-accent hover:bg-accent-dark text-white text-sm font-semibold shadow-soft"
                >
                  {editingCard ? 'Guardar cambios' : 'Guardar tarjeta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
