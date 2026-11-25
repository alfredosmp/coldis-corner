import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  ArrowLeft,
  Bold,
  BookMarked,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Columns2,
  FileText,
  GitBranch,
  Highlighter,
  Italic,
  Layers,
  List,
  ListOrdered,
  Palette,
  Plus,
  Scale,
  Search,
  Sparkles,
  Star,
  Trash2,
  Underline,
  Wand2,
  X,
} from 'lucide-react';
import { SUBJECT_COLORS } from '../data/subjectStyles';
import {
  extractFlashcardsFromNote,
  findLiveBookSuggestions,
  findLiveGlossaryMatches,
  generateOfflineOutlineFromNote,
  generateOfflineSummary,
  type GeneratedFlashcardDraft,
  type GeneratedOutlineDraft,
  type GeneratedSummaryDraft,
  type LiveBookSuggestion,
} from '../services/studyGenerator';
import type {
  BookItem,
  Flashcard,
  GlossaryTerm,
  OutlineNode,
  StudyNote,
  StudyNoteKind,
  Subject,
} from '../types/models';
import { createId, formatShortDate, normalizeText } from '../utils/text';
import { ColdiAvatar } from './ColdiAvatar';
import { EmbeddedBookPane } from './EmbeddedBookPane';

interface NotesOutlinesViewProps {
  notes: StudyNote[];
  subjects: Subject[];
  books: BookItem[];
  glossary: GlossaryTerm[];
  animateMascot: boolean;
  liveBookSuggestionsEnabled?: boolean;
  glossaryUnderlinesDefault?: boolean;
  initialSubjectFilter?: string;
  quickNewNoteSignal?: number;
  onSaveNote: (note: StudyNote) => Promise<void>;
  onDeleteNote: (id: string) => Promise<void>;
  onCreateFlashcardsBatch: (
    cards: Pick<
      Flashcard,
      'subjectId' | 'deckName' | 'sourceNoteId' | 'sourceNoteTitle' | 'mode' | 'front' | 'back' | 'legalRef'
    >[]
  ) => Promise<void>;
}

const TEXT_COLORS = [
  { label: 'Automático', value: 'inherit', swatch: '#2E1F3E' },
  { label: 'Morado', value: '#7C3AED', swatch: '#7C3AED' },
  { label: 'Rosa', value: '#DB2777', swatch: '#DB2777' },
  { label: 'Azul', value: '#2563EB', swatch: '#2563EB' },
  { label: 'Verde', value: '#059669', swatch: '#059669' },
  { label: 'Rojo', value: '#DC2626', swatch: '#DC2626' },
];

const HIGHLIGHT_COLORS = [
  { label: 'Amarillo pastel', value: '#FEF08A' },
  { label: 'Lavanda', value: '#E9D5FF' },
  { label: 'Rosa pastel', value: '#FBCFE8' },
  { label: 'Menta', value: '#A7F3D0' },
  { label: 'Cielo', value: '#BAE6FD' },
];

function formatNoteDateBadge(timestamp: number): string {
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(timestamp));
}

function getResolvedNoteTitle(note: Pick<StudyNote, 'title' | 'kind' | 'createdAt'>): string {
  if (note.title.trim()) return note.title.trim();
  const shortDate = new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(note.createdAt));
  if (note.kind === 'summary') return `Resumen sin título · ${shortDate}`;
  if (note.kind === 'outline') return `Esquema sin título · ${shortDate}`;
  return `Apunte sin título · ${shortDate}`;
}

/**
 * Extracts the immediate word & neighboring phrase strictly around the caret inside the editor
 * so live book suggestions always follow what Mafecita just typed or clicked.
 */
function extractTextAtCursor(editorEl: HTMLElement | null): string {
  if (!editorEl) return '';
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    if (editorEl.contains(range.startContainer)) {
      const selectedStr = sel.toString().trim();
      if (selectedStr.length >= 3 && selectedStr.length <= 90) {
        return selectedStr;
      }

      const node = range.startContainer;
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent ?? '';
        const caret = range.startOffset;
        // Extend slightly forward to complete the word under the cursor if mid-word
        let end = caret;
        while (end < text.length && /[\p{L}\p{N}]/u.test(text[end])) {
          end += 1;
        }
        const before = text.slice(Math.max(0, end - 90), end).trim();
        if (before.length >= 3) return before;
      }

      // If caret is on an element node, grab text of current block up to caret
      try {
        const preRange = document.createRange();
        preRange.selectNodeContents(editorEl);
        preRange.setEnd(range.startContainer, range.startOffset);
        const preText = preRange.toString().trim();
        if (preText.length >= 3) {
          const lastLine = preText.split(/\n+/).pop() ?? preText;
          return lastLine.slice(-90).trim();
        }
      } catch {
        // fallback below
      }
    }
  }

  const fallback = (editorEl.innerText ?? '').trim();
  const lastLine = fallback.split(/\n+/).filter(Boolean).pop() ?? '';
  return lastLine.slice(-90).trim();
}

function createEmptyOutlineTree(): OutlineNode[] {
  return [
    {
      id: createId('node'),
      text: 'Concepto principal',
      detail: 'Definición breve o fundamento legal',
      children: [
        { id: createId('node'), text: 'Requisitos / Elementos', detail: '', children: [] },
        { id: createId('node'), text: 'Excepciones o casos especiales', detail: '', children: [] },
      ],
    },
  ];
}

function updateNodeInTree(
  nodes: OutlineNode[],
  targetId: string,
  updater: (node: OutlineNode) => OutlineNode
): OutlineNode[] {
  return nodes.map((node) => {
    if (node.id === targetId) return updater(node);
    if (node.children.length > 0) {
      return { ...node, children: updateNodeInTree(node.children, targetId, updater) };
    }
    return node;
  });
}

function deleteNodeInTree(nodes: OutlineNode[], targetId: string): OutlineNode[] {
  return nodes
    .filter((node) => node.id !== targetId)
    .map((node) =>
      node.children.length > 0
        ? { ...node, children: deleteNodeInTree(node.children, targetId) }
        : node
    );
}

function plainToInitialHtml(plain: string): string {
  if (!plain.trim()) return '';
  return plain
    .split('\n')
    .map((line) => (line.trim() ? `<p>${line.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>` : '<p><br></p>'))
    .join('');
}

export function NotesOutlinesView({
  notes,
  subjects,
  books,
  glossary,
  animateMascot,
  liveBookSuggestionsEnabled = true,
  glossaryUnderlinesDefault = true,
  initialSubjectFilter = 'ALL',
  quickNewNoteSignal = 0,
  onSaveNote,
  onDeleteNote,
  onCreateFlashcardsBatch,
}: NotesOutlinesViewProps) {
  const [kindTab, setKindTab] = useState<StudyNoteKind>('note');
  const [subjectFilter, setSubjectFilter] = useState<string>(initialSubjectFilter);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeNote, setActiveNote] = useState<StudyNote | null>(null);
  const [savedToast, setSavedToast] = useState<string | null>(null);

  // Split-View Book Companion State
  const [splitBookOpen, setSplitBookOpen] = useState(false);
  const [splitBookId, setSplitBookId] = useState<string>('');
  const [splitTargetLocation, setSplitTargetLocation] = useState<number | undefined>(undefined);

  // Cursor-focused Live Suggestions while typing
  const [cursorContext, setCursorContext] = useState('');
  const [liveSuggestionsOpen, setLiveSuggestionsOpen] = useState(true);
  const [liveSuggestions, setLiveSuggestions] = useState<LiveBookSuggestion[]>([]);
  const [liveGlossaryHits, setLiveGlossaryHits] = useState<GlossaryTerm[]>([]);
  const [liveKeywords, setLiveKeywords] = useState<string[]>([]);

  // Color picker popovers for Word toolbar
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [hlPickerOpen, setHlPickerOpen] = useState(false);

  // Flashcards, Summary & Visual Outline Generator Modals
  const [generatedCards, setGeneratedCards] = useState<GeneratedFlashcardDraft[] | null>(null);
  const [generatedDeckName, setGeneratedDeckName] = useState('');
  const [generatedSummary, setGeneratedSummary] = useState<GeneratedSummaryDraft | null>(null);
  const [generatedOutline, setGeneratedOutline] = useState<GeneratedOutlineDraft | null>(null);

  const editorRef = useRef<HTMLDivElement | null>(null);
  const loadedNoteIdRef = useRef<string | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const lastQuickSignalRef = useRef(quickNewNoteSignal);

  const activeSubjects = useMemo(() => subjects.filter((s) => !s.archived), [subjects]);
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);

  // Fast-entry from Dashboard ("Empezar apunte") -> immediately create blank note & focus editor!
  useEffect(() => {
    if (quickNewNoteSignal > lastQuickSignalRef.current) {
      lastQuickSignalRef.current = quickNewNoteSignal;
      handleCreateNew('note', true);
    }
  }, [quickNewNoteSignal]);

  // Populate contentEditable DOM ONLY when opening a different note
  useEffect(() => {
    if (!activeNote || activeNote.kind === 'outline') {
      loadedNoteIdRef.current = null;
      setCursorContext('');
      return;
    }
    if (loadedNoteIdRef.current !== activeNote.id && editorRef.current) {
      const initialHtml =
        activeNote.htmlContent ?? plainToInitialHtml(activeNote.content ?? '');
      editorRef.current.innerHTML = initialHtml;
      loadedNoteIdRef.current = activeNote.id;
      setCursorContext('');

      // Sync split book if this note already had a linked book
      if (activeNote.linkedBookId) {
        setSplitBookId(activeNote.linkedBookId);
      } else {
        setSplitBookId('');
        setSplitBookOpen(false);
      }
    }
  }, [activeNote?.id, activeNote?.kind]);

  // Cursor-focused Live Book & Glossary Suggestions!
  useEffect(() => {
    if (!liveBookSuggestionsEnabled || !activeNote || activeNote.kind === 'outline') {
      setLiveSuggestions([]);
      setLiveGlossaryHits([]);
      setLiveKeywords([]);
      return;
    }

    const trimmed = cursorContext.trim();
    if (trimmed.length < 4) {
      setLiveSuggestions([]);
      setLiveGlossaryHits([]);
      setLiveKeywords([]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const res = await findLiveBookSuggestions(
        trimmed,
        books,
        activeNote.subjectId,
        splitBookId || activeNote.linkedBookId
      );
      if (cancelled) return;
      setLiveKeywords(res.keywords);
      setLiveSuggestions(res.suggestions);
      setLiveGlossaryHits(findLiveGlossaryMatches(res.keywords.slice(0, 2), glossary));
    }, 320);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    liveBookSuggestionsEnabled,
    cursorContext,
    activeNote?.subjectId,
    activeNote?.id,
    activeNote?.kind,
    books,
    glossary,
    splitBookId,
  ]);

  // Books prioritized for the selected subject in the current note
  const sortedNoteBooks = useMemo(() => {
    const subjId = activeNote?.subjectId;
    const lawBooks = books.filter((b) => b.shelf === 'law');
    if (!subjId) return lawBooks;
    const matching = lawBooks.filter((b) => b.subjectId === subjId);
    const others = lawBooks.filter((b) => b.subjectId !== subjId);
    return [...matching, ...others];
  }, [books, activeNote?.subjectId]);

  const currentSplitBook = useMemo(
    () => books.find((b) => b.id === splitBookId) ?? null,
    [books, splitBookId]
  );

  const filteredNotes = useMemo(() => {
    const q = normalizeText(searchQuery);
    return notes
      .filter((n) => {
        if (n.kind !== kindTab) return false;
        if (subjectFilter !== 'ALL' && n.subjectId !== subjectFilter) return false;
        if (!q) return true;
        return (
          normalizeText(getResolvedNoteTitle(n)).includes(q) ||
          normalizeText(n.content).includes(q) ||
          normalizeText(JSON.stringify(n.outlineNodes)).includes(q)
        );
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [notes, kindTab, subjectFilter, searchQuery]);

  function showToast(msg: string) {
    setSavedToast(msg);
    window.setTimeout(() => setSavedToast(null), 2200);
  }

  function handleCreateNew(kind: StudyNoteKind, autoFocusEditor = false) {
    const now = Date.now();
    const fresh: StudyNote = {
      id: createId('note'),
      title: '',
      kind,
      subjectId: subjectFilter !== 'ALL' ? subjectFilter : undefined,
      content: '',
      htmlContent: '',
      outlineNodes: kind === 'outline' ? createEmptyOutlineTree() : [],
      isFavorite: false,
      createdAt: now,
      updatedAt: now,
    };

    loadedNoteIdRef.current = null;
    setSplitBookOpen(false);
    setSplitBookId('');
    setCursorContext('');
    setActiveNote(fresh);
    onSaveNote(fresh);

    if (autoFocusEditor) {
      window.setTimeout(() => editorRef.current?.focus(), 80);
    }
  }

  function scheduleSave(next: StudyNote) {
    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(() => {
      onSaveNote({ ...next, updatedAt: Date.now() });
    }, 450);
  }

  async function saveNow(next: StudyNote, toastLabel = '¡Guardado!') {
    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    const updated = { ...next, updatedAt: Date.now() };
    setActiveNote(updated);
    await onSaveNote(updated);
    showToast(toastLabel);
  }

  function refreshCursorContext() {
    if (!liveBookSuggestionsEnabled) return;
    const ctx = extractTextAtCursor(editorRef.current);
    setCursorContext(ctx);
  }

  function syncEditorHtml() {
    if (!activeNote || !editorRef.current) return;
    const html = editorRef.current.innerHTML;
    const plain = (editorRef.current.innerText ?? '').trim();
    const updated: StudyNote = {
      ...activeNote,
      htmlContent: html,
      content: plain,
      updatedAt: Date.now(),
    };
    setActiveNote(updated);
    scheduleSave(updated);
    refreshCursorContext();
  }

  // Word-style rich text commands
  function execFormat(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    setColorPickerOpen(false);
    setHlPickerOpen(false);
    syncEditorHtml();
  }

  function insertHtmlAtCaret(htmlSnippet: string) {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    const ok = document.execCommand('insertHTML', false, htmlSnippet);
    if (!ok) {
      el.innerHTML += htmlSnippet;
    }
    syncEditorHtml();
  }

  function insertLegalCallout(type: 'article' | 'juris' | 'key') {
    if (type === 'article') {
      insertHtmlAtCaret(
        `<blockquote class="legal-callout-article"><strong>§ Artículo:</strong> </blockquote><p><br></p>`
      );
    } else if (type === 'juris') {
      insertHtmlAtCaret(
        `<blockquote class="legal-callout-juris"><strong>⚖ Jurisprudencia:</strong> </blockquote><p><br></p>`
      );
    } else {
      insertHtmlAtCaret(
        `<blockquote class="legal-callout-key"><strong>★ Punto clave:</strong> </blockquote><p><br></p>`
      );
    }
  }

  function handleInsertBookCitation(citationLabel: string) {
    insertHtmlAtCaret(
      `<p><strong>📌 [${citationLabel}]:</strong> </p>`
    );
  }

  function handleInsertBookExcerpt(excerptText: string, citationLabel: string) {
    const safe = excerptText.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    insertHtmlAtCaret(
      `<blockquote>"${safe}"<br><small><em>— ${citationLabel}</em></small></blockquote><p><br></p>`
    );
  }

  function openSuggestionInSplitView(sug: LiveBookSuggestion) {
    setSplitBookId(sug.bookId);
    setSplitTargetLocation(sug.location);
    setSplitBookOpen(true);
    if (activeNote && activeNote.linkedBookId !== sug.bookId) {
      const updated = { ...activeNote, linkedBookId: sug.bookId };
      setActiveNote(updated);
      onSaveNote(updated);
    }
  }

  function handleSelectBookDropdown(bookId: string) {
    setSplitBookId(bookId);
    setSplitTargetLocation(undefined);
    setSplitBookOpen(Boolean(bookId));
    if (activeNote) {
      const updated = { ...activeNote, linkedBookId: bookId || undefined };
      setActiveNote(updated);
      onSaveNote(updated);
    }
  }

  // === Flashcard, Summary & Visual Outline Generators from Current Note ===
  function handleOpenFlashcardsGenerator() {
    if (!activeNote) return;
    const html = editorRef.current?.innerHTML ?? activeNote.htmlContent ?? '';
    const plain = editorRef.current?.innerText ?? activeNote.content ?? '';
    const selection = window.getSelection()?.toString().trim() ?? '';
    const resolvedTitle = getResolvedNoteTitle(activeNote);

    const drafts = extractFlashcardsFromNote(resolvedTitle, html, plain);

    // If Mafecita highlighted a specific selection right now, put it at the very top as a ready draft!
    if (selection.length >= 4) {
      drafts.unshift({
        id: `sel_${Date.now()}`,
        selected: true,
        mode: 'basic',
        front: `¿Qué debes recordar sobre: "${selection.slice(0, 80)}"?`,
        back: selection,
        sourceHint: 'Texto que acabas de seleccionar',
      });
    }

    setGeneratedDeckName(resolvedTitle);
    setGeneratedCards(drafts);
  }

  async function handleConfirmGeneratedFlashcards() {
    if (!generatedCards || !activeNote) return;
    const chosen = generatedCards.filter((c) => c.selected && c.front.trim());
    if (chosen.length === 0) return;

    const resolvedTitle = getResolvedNoteTitle(activeNote);
    const chosenDeck = generatedDeckName.trim() || resolvedTitle;

    await onCreateFlashcardsBatch(
      chosen.map((c) => ({
        subjectId: activeNote.subjectId,
        deckName: chosenDeck,
        sourceNoteId: activeNote.id,
        sourceNoteTitle: resolvedTitle,
        mode: c.mode,
        front: c.front.trim(),
        back: c.back.trim(),
        legalRef: c.legalRef?.trim() || undefined,
      }))
    );

    setGeneratedCards(null);
    showToast(`¡${chosen.length} flashcards guardadas!`);
  }

  function handleOpenSummaryGenerator() {
    if (!activeNote) return;
    const html = editorRef.current?.innerHTML ?? activeNote.htmlContent ?? '';
    const plain = editorRef.current?.innerText ?? activeNote.content ?? '';
    const resolvedTitle = getResolvedNoteTitle(activeNote);
    const summary = generateOfflineSummary(resolvedTitle, html, plain);
    setGeneratedSummary(summary);
  }

  async function handleSaveGeneratedSummary(openImmediately = false) {
    if (!generatedSummary || !activeNote) return;
    const now = Date.now();
    const newSummary: StudyNote = {
      id: createId('sum'),
      title: generatedSummary.title,
      kind: 'summary',
      subjectId: activeNote.subjectId,
      linkedBookId: activeNote.linkedBookId,
      content: generatedSummary.plainText,
      htmlContent: generatedSummary.html,
      outlineNodes: [],
      isFavorite: false,
      createdAt: now,
      updatedAt: now,
    };
    await onSaveNote(newSummary);
    setGeneratedSummary(null);
    if (openImmediately) {
      loadedNoteIdRef.current = null;
      setKindTab('summary');
      setActiveNote(newSummary);
    } else {
      showToast('Guardado en Apuntes → Resúmenes');
    }
  }

  function handleOpenOutlineGenerator() {
    if (!activeNote) return;
    const html = editorRef.current?.innerHTML ?? activeNote.htmlContent ?? '';
    const plain = editorRef.current?.innerText ?? activeNote.content ?? '';
    const resolvedTitle = getResolvedNoteTitle(activeNote);
    const outline = generateOfflineOutlineFromNote(resolvedTitle, html, plain);
    setGeneratedOutline(outline);
  }

  async function handleSaveGeneratedOutline(openImmediately = false) {
    if (!generatedOutline || !activeNote) return;
    const now = Date.now();
    const newOutline: StudyNote = {
      id: createId('out'),
      title: generatedOutline.title,
      kind: 'outline',
      subjectId: activeNote.subjectId,
      linkedBookId: activeNote.linkedBookId,
      content: '',
      htmlContent: '',
      outlineNodes: generatedOutline.nodes,
      isFavorite: false,
      createdAt: now,
      updatedAt: now,
    };
    await onSaveNote(newOutline);
    setGeneratedOutline(null);
    if (openImmediately) {
      loadedNoteIdRef.current = null;
      setKindTab('outline');
      setActiveNote(newOutline);
    } else {
      showToast('Guardado en Apuntes → Esquemas');
    }
  }

  // Recursive Outline Tree Node renderer (for Esquemas tab)
  function renderOutlineNode(node: OutlineNode, depth = 0) {
    const isRoot = depth === 0;
    const hasChildren = node.children.length > 0;

    return (
      <div
        key={node.id}
        className={
          depth > 0
            ? 'ml-5 sm:ml-7 pl-4 border-l-2 border-lavender-200 dark:border-midnight-700 mt-2.5'
            : 'mt-2'
        }
      >
        <div
          className={`group rounded-2xl p-3 sm:p-3.5 border transition-all ${
            isRoot
              ? 'bg-lavender-100/75 dark:bg-midnight-800 border-lavender-300/80 dark:border-midnight-600'
              : depth === 1
              ? 'bg-white dark:bg-midnight-900 border-lavender-200/80 dark:border-midnight-700'
              : 'bg-lavender-50/70 dark:bg-midnight-850 border-lavender-200/60 dark:border-midnight-700/80'
          }`}
        >
          <div className="flex items-start gap-2">
            {hasChildren ? (
              <button
                onClick={() => {
                  if (!activeNote) return;
                  const nextTree = updateNodeInTree(activeNote.outlineNodes, node.id, (n) => ({
                    ...n,
                    collapsed: !n.collapsed,
                  }));
                  saveNow({ ...activeNote, outlineNodes: nextTree });
                }}
                className="mt-1 p-0.5 rounded-lg text-accent dark:text-lavender-300"
              >
                {node.collapsed ? (
                  <ChevronRight className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            ) : (
              <span className="mt-2 w-2 h-2 rounded-full bg-accent/60 shrink-0 ml-1" />
            )}

            <div className="flex-1 min-w-0 space-y-1">
              <input
                type="text"
                value={node.text}
                onChange={(e) => {
                  if (!activeNote) return;
                  const nextTree = updateNodeInTree(activeNote.outlineNodes, node.id, (n) => ({
                    ...n,
                    text: e.target.value,
                  }));
                  setActiveNote({ ...activeNote, outlineNodes: nextTree });
                }}
                onBlur={() => activeNote && saveNow(activeNote)}
                placeholder="Concepto o rama..."
                className={`w-full bg-transparent focus:outline-none ${
                  isRoot
                    ? 'font-display font-bold text-base text-[#2E1F3E] dark:text-white'
                    : 'font-semibold text-sm text-[#2E1F3E] dark:text-white'
                }`}
              />
              <input
                type="text"
                value={node.detail ?? ''}
                onChange={(e) => {
                  if (!activeNote) return;
                  const nextTree = updateNodeInTree(activeNote.outlineNodes, node.id, (n) => ({
                    ...n,
                    detail: e.target.value,
                  }));
                  setActiveNote({ ...activeNote, outlineNodes: nextTree });
                }}
                onBlur={() => activeNote && saveNow(activeNote)}
                placeholder="Detalle breve, plazo o artículo..."
                className="w-full bg-transparent text-xs text-[#6E5B85] dark:text-[#B4A3CB] placeholder:text-[#A896C0] focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => {
                  if (!activeNote) return;
                  const child: OutlineNode = {
                    id: createId('node'),
                    text: 'Nuevo subtema',
                    detail: '',
                    children: [],
                  };
                  const nextTree = updateNodeInTree(activeNote.outlineNodes, node.id, (n) => ({
                    ...n,
                    collapsed: false,
                    children: [...n.children, child],
                  }));
                  saveNow({ ...activeNote, outlineNodes: nextTree });
                }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-lavender-100/90 dark:bg-midnight-800 text-[11px] font-bold text-accent dark:text-lavender-300"
              >
                <Plus className="w-3 h-3" />
                <span className="hidden sm:inline">Subtema</span>
              </button>
              <button
                onClick={() => {
                  if (!activeNote) return;
                  const nextTree = deleteNodeInTree(activeNote.outlineNodes, node.id);
                  saveNow({ ...activeNote, outlineNodes: nextTree });
                }}
                className="p-1.5 rounded-xl text-[#9B89B3] hover:text-rose-500"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {!node.collapsed && hasChildren && (
          <div>{node.children.map((child) => renderOutlineNode(child, depth + 1))}</div>
        )}
      </div>
    );
  }

  // === ACTIVE WORD-LIKE APUNTES WORKSPACE (with Split-View Book & Generators!) ===
  if (activeNote) {
    const isRichDoc = activeNote.kind === 'note' || activeNote.kind === 'summary';
    const subjectBookCount = activeNote.subjectId
      ? books.filter((b) => b.subjectId === activeNote.subjectId).length
      : 0;

    return (
      <div className="flex flex-col gap-3 pb-6 h-[calc(100vh-3rem)] md:h-[calc(100vh-3.5rem)]">
        {/* Top Bar: Back + Subject Picker + Book Picker + Split Toggle + Generators */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-2xl bg-white dark:bg-midnight-900 border border-lavender-200/80 dark:border-midnight-700 shadow-soft shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={async () => {
                if (isRichDoc && editorRef.current) {
                  await onSaveNote({
                    ...activeNote,
                    htmlContent: editorRef.current.innerHTML,
                    content: (editorRef.current.innerText ?? '').trim(),
                    updatedAt: Date.now(),
                  });
                } else {
                  await onSaveNote({ ...activeNote, updatedAt: Date.now() });
                }
                setActiveNote(null);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-lavender-50 dark:bg-midnight-850 hover:bg-lavender-100 dark:hover:bg-midnight-800 text-xs font-bold text-[#4A3861] dark:text-[#E4DCF4]"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Apuntes</span>
            </button>

            {/* Materia Selector */}
            <select
              value={activeNote.subjectId ?? ''}
              onChange={(e) => {
                const nextSubj = e.target.value || undefined;
                saveNow({ ...activeNote, subjectId: nextSubj }, 'Materia actualizada');
              }}
              className="px-3 py-1.5 rounded-xl bg-lavender-50 dark:bg-midnight-850 border border-lavender-200 dark:border-midnight-700 text-xs font-bold text-[#2E1F3E] dark:text-white"
              title="Elige la materia de este apunte"
            >
              <option value="">Elegir materia...</option>
              {activeSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            {/* Book Selector (filtered/prioritized by selected Subject!) */}
            {isRichDoc && (
              <select
                value={splitBookId}
                onChange={(e) => handleSelectBookDropdown(e.target.value)}
                className="max-w-[210px] px-3 py-1.5 rounded-xl bg-lavender-50 dark:bg-midnight-850 border border-lavender-200 dark:border-midnight-700 text-xs font-semibold text-[#2E1F3E] dark:text-white truncate"
                title="Elige un libro para abrirlo a la par de tus apuntes"
              >
                <option value="">
                  {sortedNoteBooks.length === 0
                    ? 'Sin libros en biblioteca'
                    : subjectBookCount > 0
                    ? `Abrir libro de la materia (${subjectBookCount})...`
                    : 'Abrir libro al lado...'}
                </option>
                {sortedNoteBooks.map((b) => {
                  const isFromSubject = Boolean(
                    activeNote.subjectId && b.subjectId === activeNote.subjectId
                  );
                  return (
                    <option key={b.id} value={b.id}>
                      {isFromSubject ? '★ ' : ''}
                      {b.title} ({b.format.toUpperCase()})
                    </option>
                  );
                })}
              </select>
            )}

            {isRichDoc && currentSplitBook && (
              <button
                onClick={() => setSplitBookOpen((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                  splitBookOpen
                    ? 'bg-accent text-white border-accent shadow-sm'
                    : 'bg-lavender-50 dark:bg-midnight-850 border-lavender-200 dark:border-midnight-700 text-[#5A4574] dark:text-[#D1C3E5]'
                }`}
                title="Mostrar u ocultar libro mitad y mitad"
              >
                <Columns2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Mitad y mitad</span>
              </button>
            )}
          </div>

          {/* Right Actions: Generate Summary, Visual Outline, Flashcards, Save */}
          <div className="flex flex-wrap items-center gap-1.5">
            {isRichDoc && (
              <>
                <button
                  onClick={handleOpenSummaryGenerator}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-lavender-100 dark:bg-midnight-800 hover:bg-lavender-200/80 text-accent dark:text-lavender-300 text-xs font-bold transition-colors"
                  title="Generar un resumen condensado en base a este apunte"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>Resumen</span>
                </button>
                <button
                  onClick={handleOpenOutlineGenerator}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-100/85 dark:bg-[#192D42] hover:bg-sky-200/80 text-sky-700 dark:text-sky-200 text-xs font-bold transition-colors"
                  title="Generar un esquema visual editable desde este apunte"
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  <span>Esquema</span>
                </button>
                <button
                  onClick={handleOpenFlashcardsGenerator}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blush-100 dark:bg-[#41203B] hover:bg-blush-200/80 text-blush-600 dark:text-blush-200 text-xs font-bold transition-colors"
                  title="Generar flashcards desde este apunte (o desde el texto seleccionado)"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>+ Flashcards</span>
                </button>
              </>
            )}

            <button
              onClick={() => {
                if (isRichDoc && editorRef.current) {
                  saveNow({
                    ...activeNote,
                    htmlContent: editorRef.current.innerHTML,
                    content: (editorRef.current.innerText ?? '').trim(),
                  });
                } else {
                  saveNow(activeNote);
                }
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-accent hover:bg-accent-dark text-white text-xs font-bold shadow-sm"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{savedToast ?? 'Guardar'}</span>
            </button>
          </div>
        </div>

        {/* Main Workspace: Optional 50/50 Split-View Book Left + Word-style Apuntes Right */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3 overflow-hidden">
          {/* Left Half: Embedded Book Pane (with PDF Highlighter!) */}
          {isRichDoc && splitBookOpen && currentSplitBook && (
            <div className="lg:w-1/2 h-[45%] lg:h-full min-w-0 min-h-0">
              <EmbeddedBookPane
                book={currentSplitBook}
                glossary={glossary}
                defaultGlossaryMarks={glossaryUnderlinesDefault}
                targetLocation={splitTargetLocation}
                onInsertCitation={handleInsertBookCitation}
                onInsertExcerpt={handleInsertBookExcerpt}
                onClosePane={() => setSplitBookOpen(false)}
              />
            </div>
          )}

          {/* Right Half (or Full Width): Word-like Editor OR Outline Builder */}
          <div
            className={`${
              isRichDoc && splitBookOpen && currentSplitBook
                ? 'lg:w-1/2 h-[55%] lg:h-full'
                : 'flex-1 h-full'
            } min-w-0 min-h-0 flex flex-col rounded-3xl bg-white dark:bg-midnight-900 border border-lavender-200/80 dark:border-midnight-700 shadow-soft overflow-hidden`}
          >
            {/* Note Title Row with Automatic Date */}
            <div className="px-5 pt-4 pb-2.5 border-b border-lavender-100 dark:border-midnight-800 flex items-center justify-between gap-3 shrink-0">
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-lavender-100/90 dark:bg-midnight-800 text-accent dark:text-lavender-300">
                    {formatNoteDateBadge(activeNote.createdAt)}
                  </span>
                  {!activeNote.title.trim() && (
                    <span className="text-[11px] text-[#9A87B2] dark:text-[#9683B0]">
                      Opcional · si lo dejas vacío se guarda con la fecha de hoy
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={activeNote.title}
                  onChange={(e) => {
                    const next = { ...activeNote, title: e.target.value };
                    setActiveNote(next);
                    scheduleSave(next);
                  }}
                  placeholder={
                    activeNote.kind === 'outline'
                      ? 'Agrega el tema de tu esquema...'
                      : activeNote.kind === 'summary'
                      ? 'Agrega el tema de tu resumen...'
                      : 'Agrega el tema o título de tu apunte...'
                  }
                  className="w-full font-display font-bold text-xl sm:text-2xl text-[#2E1F3E] dark:text-white placeholder:text-[#B4A3CA] dark:placeholder:text-[#6B5A84] bg-transparent focus:outline-none"
                />
              </div>
              <button
                onClick={() =>
                  saveNow({ ...activeNote, isFavorite: !activeNote.isFavorite }, 'Actualizado')
                }
                className={`p-1.5 rounded-xl transition-colors shrink-0 ${
                  activeNote.isFavorite
                    ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/30'
                    : 'text-[#A896C0] hover:text-amber-500'
                }`}
                title="Favorito"
              >
                <Star className={`w-4 h-4 ${activeNote.isFavorite ? 'fill-current' : ''}`} />
              </button>
            </div>

            {isRichDoc ? (
              <>
                {/* Word-Like Rich Formatting Toolbar */}
                <div className="px-4 py-2 border-b border-lavender-100 dark:border-midnight-800 bg-lavender-50/60 dark:bg-midnight-850/70 flex flex-wrap items-center gap-1 shrink-0 relative">
                  {/* Heading / Size Dropdown */}
                  <select
                    defaultValue="P"
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'H1' || val === 'H2' || val === 'P') {
                        execFormat('formatBlock', val);
                      } else {
                        execFormat('fontSize', val);
                      }
                      e.target.value = 'P';
                    }}
                    className="px-2 py-1 rounded-xl bg-white dark:bg-midnight-900 border border-lavender-200 dark:border-midnight-700 text-[11px] font-bold text-[#4A3861] dark:text-[#E2D8F3]"
                    title="Tamaño o estilo de texto"
                  >
                    <option value="P">Texto normal</option>
                    <option value="H1">Título grande</option>
                    <option value="H2">Subtítulo</option>
                    <option value="2">Letra chica</option>
                    <option value="4">Letra mediana</option>
                    <option value="5">Letra grande</option>
                  </select>

                  <div className="h-5 w-px bg-lavender-200 dark:bg-midnight-700 mx-0.5" />

                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => execFormat('bold')}
                    className="p-1.5 rounded-lg hover:bg-lavender-200/70 dark:hover:bg-midnight-800 text-[#4A3861] dark:text-[#E2D8F3]"
                    title="Negrita (Ctrl+B)"
                  >
                    <Bold className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => execFormat('italic')}
                    className="p-1.5 rounded-lg hover:bg-lavender-200/70 dark:hover:bg-midnight-800 text-[#4A3861] dark:text-[#E2D8F3]"
                    title="Cursiva (Ctrl+I)"
                  >
                    <Italic className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => execFormat('underline')}
                    className="p-1.5 rounded-lg hover:bg-lavender-200/70 dark:hover:bg-midnight-800 text-[#4A3861] dark:text-[#E2D8F3]"
                    title="Subrayado (Ctrl+U)"
                  >
                    <Underline className="w-4 h-4" />
                  </button>

                  {/* Text Color Popover */}
                  <div className="relative">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setColorPickerOpen((v) => !v);
                        setHlPickerOpen(false);
                      }}
                      className="p-1.5 rounded-lg hover:bg-lavender-200/70 dark:hover:bg-midnight-800 text-[#4A3861] dark:text-[#E2D8F3]"
                      title="Color de letra"
                    >
                      <Palette className="w-4 h-4" />
                    </button>
                    {colorPickerOpen && (
                      <div className="absolute left-0 top-9 z-30 flex items-center gap-1.5 p-2 rounded-2xl bg-white dark:bg-midnight-900 border border-lavender-200 dark:border-midnight-700 shadow-soft-lg">
                        {TEXT_COLORS.map((c) => (
                          <button
                            key={c.label}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => execFormat('foreColor', c.value)}
                            title={c.label}
                            className="w-6 h-6 rounded-full border border-black/10 hover:scale-110 transition-transform"
                            style={{ backgroundColor: c.swatch }}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Pastel Highlighter Popover */}
                  <div className="relative">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setHlPickerOpen((v) => !v);
                        setColorPickerOpen(false);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-100/80 dark:bg-amber-900/35 text-amber-800 dark:text-amber-200 text-[11px] font-bold hover:opacity-90"
                      title="Marcatextos pastel (también ayuda a generar mejores flashcards y resúmenes)"
                    >
                      <Highlighter className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Resaltar</span>
                    </button>
                    {hlPickerOpen && (
                      <div className="absolute left-0 top-9 z-30 flex items-center gap-1.5 p-2 rounded-2xl bg-white dark:bg-midnight-900 border border-lavender-200 dark:border-midnight-700 shadow-soft-lg">
                        {HIGHLIGHT_COLORS.map((c) => (
                          <button
                            key={c.label}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => execFormat('hiliteColor', c.value)}
                            title={c.label}
                            className="w-6 h-6 rounded-full border border-black/10 hover:scale-110 transition-transform"
                            style={{ backgroundColor: c.value }}
                          />
                        ))}
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => execFormat('hiliteColor', 'transparent')}
                          title="Quitar resaltado"
                          className="px-2 py-0.5 rounded-lg text-[10px] font-bold text-[#6E5B85] hover:bg-lavender-100"
                        >
                          Quitar
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="h-5 w-px bg-lavender-200 dark:bg-midnight-700 mx-0.5" />

                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => execFormat('insertUnorderedList')}
                    className="p-1.5 rounded-lg hover:bg-lavender-200/70 dark:hover:bg-midnight-800 text-[#4A3861] dark:text-[#E2D8F3]"
                    title="Lista con viñetas"
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => execFormat('insertOrderedList')}
                    className="p-1.5 rounded-lg hover:bg-lavender-200/70 dark:hover:bg-midnight-800 text-[#4A3861] dark:text-[#E2D8F3]"
                    title="Lista numerada"
                  >
                    <ListOrdered className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => execFormat('justifyLeft')}
                    className="p-1.5 rounded-lg hover:bg-lavender-200/70 dark:hover:bg-midnight-800 text-[#4A3861] dark:text-[#E2D8F3]"
                    title="Alinear izquierda"
                  >
                    <AlignLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => execFormat('justifyCenter')}
                    className="p-1.5 rounded-lg hover:bg-lavender-200/70 dark:hover:bg-midnight-800 text-[#4A3861] dark:text-[#E2D8F3]"
                    title="Centrar"
                  >
                    <AlignCenter className="w-4 h-4" />
                  </button>

                  <div className="h-5 w-px bg-lavender-200 dark:bg-midnight-700 mx-0.5" />

                  {/* Legal Quick Callout Inserts */}
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => insertLegalCallout('article')}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-lavender-100 dark:bg-midnight-800 text-accent dark:text-lavender-300 text-[11px] font-bold"
                  >
                    <Scale className="w-3 h-3" />
                    <span>§ Art.</span>
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => insertLegalCallout('juris')}
                    className="px-2 py-1 rounded-lg bg-sky-100/80 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 text-[11px] font-bold"
                  >
                    ⚖ Jurisp.
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => insertLegalCallout('key')}
                    className="px-2 py-1 rounded-lg bg-blush-100/90 dark:bg-[#41203B] text-blush-600 dark:text-blush-200 text-[11px] font-bold"
                  >
                    ★ Clave
                  </button>
                </div>

                {/* Word-like Writing Canvas */}
                <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-5">
                  <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={syncEditorHtml}
                    onKeyUp={refreshCursorContext}
                    onClick={refreshCursorContext}
                    data-placeholder="Empieza a escribir tus apuntes aquí..."
                    className="word-editor min-h-[260px] text-[15px] text-[#2E1F3E] dark:text-[#F2ECFA]"
                  />
                </div>

                {/* Cursor-Focused Live Book & Glossary Companion Bar */}
                {liveBookSuggestionsEnabled && (liveSuggestions.length > 0 || liveGlossaryHits.length > 0) && (
                  <div className="border-t border-lavender-200/80 dark:border-midnight-700 bg-lavender-50/85 dark:bg-midnight-850/90 px-4 py-2.5 shrink-0 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => setLiveSuggestionsOpen((v) => !v)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-accent dark:text-lavender-300"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>
                          Coincidencias para «{liveKeywords[0]}»
                        </span>
                        {liveSuggestionsOpen ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <span className="text-[10px] text-[#8A76A3] dark:text-[#A995C4]">
                        Clic para abrir al lado en esa página
                      </span>
                    </div>

                    {liveSuggestionsOpen && (
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {liveSuggestions.map((sug) => (
                          <button
                            key={sug.id}
                            onClick={() => openSuggestionInSplitView(sug)}
                            className="shrink-0 w-64 text-left p-2.5 rounded-2xl bg-white dark:bg-midnight-900 border border-lavender-200 dark:border-midnight-700 hover:border-accent shadow-sm transition-all space-y-1"
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-accent dark:text-lavender-300 truncate">
                                <BookOpen className="w-3 h-3 shrink-0" />
                                {sug.bookTitle}
                              </span>
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-lavender-100 dark:bg-midnight-800 text-[#5A4574] dark:text-[#D1C3E5] shrink-0">
                                {sug.locationLabel}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#66537D] dark:text-[#BEB0D1] line-clamp-2 leading-snug">
                              {sug.snippet.before}
                              <mark className="bg-lavender-200 dark:bg-lavender-700/70 text-[#2E1F3E] dark:text-white px-0.5 rounded">
                                {sug.snippet.match}
                              </mark>
                              {sug.snippet.after}
                            </p>
                          </button>
                        ))}

                        {liveGlossaryHits.map((g) => (
                          <div
                            key={g.id}
                            className="shrink-0 w-60 p-2.5 rounded-2xl bg-blush-50/80 dark:bg-[#2F1B2C] border border-blush-200/80 dark:border-[#522D4C] space-y-1"
                          >
                            <div className="flex items-center gap-1 text-[11px] font-bold text-blush-600 dark:text-blush-300">
                              <BookMarked className="w-3 h-3 shrink-0" />
                              <span className="truncate">{g.term}</span>
                            </div>
                            <p className="text-[11px] text-[#68455C] dark:text-[#E5C5D8] line-clamp-2 leading-snug">
                              {g.definition}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              /* Visual Hierarchical Outline Builder */
              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-[#735F8C] dark:text-[#A996C3]">
                    Arma tu cuadro sinóptico por niveles: Concepto → Clasificación → Requisitos → Excepciones.
                  </p>
                  <button
                    onClick={() => {
                      const rootNode: OutlineNode = {
                        id: createId('node'),
                        text: 'Nueva rama principal',
                        detail: '',
                        children: [],
                      };
                      saveNow({
                        ...activeNote,
                        outlineNodes: [...activeNote.outlineNodes, rootNode],
                      });
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-lavender-100 dark:bg-midnight-800 text-accent dark:text-lavender-300 text-xs font-bold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Nueva rama principal</span>
                  </button>
                </div>

                {activeNote.outlineNodes.map((node) => renderOutlineNode(node, 0))}
              </div>
            )}
          </div>
        </div>

        {/* === GENERATED FLASHCARDS REVIEW MODAL === */}
        {generatedCards !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1D112C]/55 backdrop-blur-sm">
            <div className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-3xl bg-white dark:bg-midnight-900 border border-lavender-200 dark:border-midnight-700 shadow-soft-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-lavender-100 dark:border-midnight-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <ColdiAvatar pose="thinking" size="xs" />
                  <div>
                    <h2 className="font-display font-bold text-lg text-[#2E1F3E] dark:text-white">
                      Flashcards detectadas en tu apunte
                    </h2>
                    <p className="text-xs text-[#7A6693] dark:text-[#A995C4]">
                      Revisa, edita o desmarca las tarjetas antes de guardarlas (quedarán ligadas a este apunte)
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setGeneratedCards(null)}
                  className="p-2 rounded-xl text-[#7E6B96] hover:bg-lavender-100 dark:hover:bg-midnight-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto flex-1 space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#6D588A] dark:text-[#BAA8D1] mb-1">
                    Tema / Apunte en Flashcards
                  </label>
                  <input
                    type="text"
                    value={generatedDeckName}
                    onChange={(e) => setGeneratedDeckName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-2xl bg-lavender-50 dark:bg-midnight-850 border border-lavender-200 dark:border-midnight-700 text-sm text-[#2E1F3E] dark:text-white focus:outline-none"
                  />
                </div>

                {generatedCards.length === 0 ? (
                  <div className="rounded-2xl p-6 text-center bg-lavender-50/70 dark:bg-midnight-850 border border-dashed border-lavender-300 dark:border-midnight-700 space-y-2">
                    <p className="text-sm font-bold text-[#2E1F3E] dark:text-white">
                      Todavía no detecté frases clave en este apunte
                    </p>
                    <p className="text-xs text-[#735F8C] dark:text-[#A996C3] max-w-md mx-auto">
                      Tip: usa el <strong>Marcatextos pastel</strong>, <strong>Negritas</strong>, definiciones con dos puntos (<em>"Amparo: medio de control..."</em>) o selecciona un párrafo antes de pulsar <strong>+ Flashcards</strong>.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {generatedCards.map((draft, idx) => (
                      <div
                        key={draft.id}
                        className={`rounded-2xl p-4 border space-y-2.5 transition-opacity ${
                          draft.selected
                            ? 'bg-lavender-50/70 dark:bg-midnight-850 border-lavender-200 dark:border-midnight-700'
                            : 'opacity-50 bg-gray-50 dark:bg-midnight-950 border-gray-200 dark:border-midnight-800'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <label className="inline-flex items-center gap-2 text-xs font-bold text-[#2E1F3E] dark:text-white cursor-pointer">
                            <input
                              type="checkbox"
                              checked={draft.selected}
                              onChange={(e) =>
                                setGeneratedCards((prev) =>
                                  prev
                                    ? prev.map((c, i) =>
                                        i === idx ? { ...c, selected: e.target.checked } : c
                                      )
                                    : prev
                                )
                              }
                              className="rounded text-accent"
                            />
                            <span>
                              {draft.mode === 'cloze' ? 'Ocultar palabras' : 'Clásica'} ·{' '}
                              <span className="font-normal text-[#7A6693] dark:text-[#A995C4]">
                                {draft.sourceHint}
                              </span>
                            </span>
                          </label>
                        </div>

                        <textarea
                          rows={2}
                          value={draft.front}
                          onChange={(e) =>
                            setGeneratedCards((prev) =>
                              prev
                                ? prev.map((c, i) =>
                                    i === idx ? { ...c, front: e.target.value } : c
                                  )
                                : prev
                            )
                          }
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-midnight-900 border border-lavender-200 dark:border-midnight-700 text-xs font-semibold text-[#2E1F3E] dark:text-white focus:outline-none"
                        />
                        <textarea
                          rows={2}
                          value={draft.back}
                          onChange={(e) =>
                            setGeneratedCards((prev) =>
                              prev
                                ? prev.map((c, i) =>
                                    i === idx ? { ...c, back: e.target.value } : c
                                  )
                                : prev
                            )
                          }
                          placeholder="Reverso o nota..."
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-midnight-900 border border-lavender-200 dark:border-midnight-700 text-xs text-[#5A4574] dark:text-[#D1C3E5] focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-lavender-100 dark:border-midnight-800 flex justify-end gap-2.5">
                <button
                  onClick={() => setGeneratedCards(null)}
                  className="px-4 py-2 rounded-2xl text-xs font-bold text-[#6E5B85] dark:text-[#BBA9D3]"
                >
                  Cancelar
                </button>
                <button
                  disabled={generatedCards.filter((c) => c.selected).length === 0}
                  onClick={handleConfirmGeneratedFlashcards}
                  className="px-5 py-2 rounded-2xl bg-accent hover:bg-accent-dark disabled:opacity-40 text-white text-xs font-bold shadow-soft"
                >
                  Guardar {generatedCards.filter((c) => c.selected).length} flashcards
                </button>
              </div>
            </div>
          </div>
        )}

        {/* === GENERATED SUMMARY PREVIEW MODAL === */}
        {generatedSummary && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1D112C]/55 backdrop-blur-sm">
            <div className="w-full max-w-xl max-h-[85vh] flex flex-col rounded-3xl bg-white dark:bg-midnight-900 border border-lavender-200 dark:border-midnight-700 shadow-soft-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-lavender-100 dark:border-midnight-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <ColdiAvatar pose="writing" size="xs" />
                  <div>
                    <h2 className="font-display font-bold text-lg text-[#2E1F3E] dark:text-white">
                      Resumen de tu apunte
                    </h2>
                    <p className="text-xs text-[#7A6693] dark:text-[#A995C4]">
                      Se guarda en Apuntes → pestaña Resúmenes
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setGeneratedSummary(null)}
                  className="p-2 rounded-xl text-[#7E6B96]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto flex-1">
                {generatedSummary.bulletCount === 0 ? (
                  <p className="text-sm text-[#735F8C] dark:text-[#A996C3] text-center py-6">
                    Escribe un poco más o resalta algunas frases importantes en tu apunte para condensarlo en un resumen.
                  </p>
                ) : (
                  <div
                    className="word-editor text-sm text-[#2E1F3E] dark:text-[#F0E8FA]"
                    dangerouslySetInnerHTML={{ __html: generatedSummary.html }}
                  />
                )}
              </div>

              <div className="px-6 py-4 border-t border-lavender-100 dark:border-midnight-800 flex flex-wrap justify-end gap-2">
                <button
                  onClick={() => setGeneratedSummary(null)}
                  className="px-4 py-2 rounded-2xl text-xs font-bold text-[#6E5B85] dark:text-[#BBA9D3]"
                >
                  Cerrar
                </button>
                <button
                  disabled={generatedSummary.bulletCount === 0}
                  onClick={() => handleSaveGeneratedSummary(false)}
                  className="px-4 py-2 rounded-2xl bg-lavender-100 dark:bg-midnight-800 hover:bg-lavender-200/80 disabled:opacity-40 text-accent dark:text-lavender-300 text-xs font-bold"
                >
                  Guardar en Resúmenes
                </button>
                <button
                  disabled={generatedSummary.bulletCount === 0}
                  onClick={() => handleSaveGeneratedSummary(true)}
                  className="px-5 py-2 rounded-2xl bg-accent hover:bg-accent-dark disabled:opacity-40 text-white text-xs font-bold shadow-soft"
                >
                  Guardar y abrir
                </button>
              </div>
            </div>
          </div>
        )}

        {/* === GENERATED VISUAL OUTLINE PREVIEW MODAL === */}
        {generatedOutline && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1D112C]/55 backdrop-blur-sm">
            <div className="w-full max-w-xl max-h-[85vh] flex flex-col rounded-3xl bg-white dark:bg-midnight-900 border border-lavender-200 dark:border-midnight-700 shadow-soft-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-lavender-100 dark:border-midnight-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <ColdiAvatar pose="thinking" size="xs" />
                  <div>
                    <h2 className="font-display font-bold text-lg text-[#2E1F3E] dark:text-white">
                      Esquema visual de tu apunte
                    </h2>
                    <p className="text-xs text-[#7A6693] dark:text-[#A995C4]">
                      Se guarda en Apuntes → pestaña Esquemas (puedes editar y agregar ramas)
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setGeneratedOutline(null)}
                  className="p-2 rounded-xl text-[#7E6B96]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto flex-1 space-y-2.5">
                {generatedOutline.nodes.length === 0 ? (
                  <p className="text-sm text-[#735F8C] dark:text-[#A996C3] text-center py-6">
                    Escribe algunos conceptos, subtítulos o listas en tu apunte para convertirlo en un esquema visual.
                  </p>
                ) : (
                  generatedOutline.nodes.map((root) => (
                    <div key={root.id} className="space-y-2">
                      <div className="p-3 rounded-2xl bg-lavender-100/80 dark:bg-midnight-800 border border-lavender-300/70 dark:border-midnight-600 font-display font-bold text-sm text-[#2E1F3E] dark:text-white">
                        {root.text}
                      </div>
                      <div className="ml-4 pl-3 border-l-2 border-lavender-200 dark:border-midnight-700 space-y-2">
                        {root.children.map((branch) => (
                          <div
                            key={branch.id}
                            className="p-2.5 rounded-2xl bg-lavender-50/70 dark:bg-midnight-850 border border-lavender-200/70 dark:border-midnight-700 space-y-1.5"
                          >
                            <p className="text-xs font-bold text-[#2E1F3E] dark:text-white">
                              {branch.text}
                            </p>
                            {branch.detail && (
                              <p className="text-[11px] text-[#6E5B85] dark:text-[#B4A3CB]">
                                {branch.detail}
                              </p>
                            )}
                            {branch.children.length > 0 && (
                              <ul className="pl-3 space-y-1 border-l border-lavender-200 dark:border-midnight-700">
                                {branch.children.map((leaf) => (
                                  <li key={leaf.id} className="text-[11px] text-[#5B4774] dark:text-[#C8B9DC]">
                                    <strong>{leaf.text}</strong>
                                    {leaf.detail ? `: ${leaf.detail}` : ''}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="px-6 py-4 border-t border-lavender-100 dark:border-midnight-800 flex flex-wrap justify-end gap-2">
                <button
                  onClick={() => setGeneratedOutline(null)}
                  className="px-4 py-2 rounded-2xl text-xs font-bold text-[#6E5B85] dark:text-[#BBA9D3]"
                >
                  Cerrar
                </button>
                <button
                  disabled={generatedOutline.nodes.length === 0}
                  onClick={() => handleSaveGeneratedOutline(false)}
                  className="px-4 py-2 rounded-2xl bg-lavender-100 dark:bg-midnight-800 hover:bg-lavender-200/80 disabled:opacity-40 text-accent dark:text-lavender-300 text-xs font-bold"
                >
                  Guardar en Esquemas
                </button>
                <button
                  disabled={generatedOutline.nodes.length === 0}
                  onClick={() => handleSaveGeneratedOutline(true)}
                  className="px-5 py-2 rounded-2xl bg-accent hover:bg-accent-dark disabled:opacity-40 text-white text-xs font-bold shadow-soft"
                >
                  Guardar y abrir esquema
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // === APUNTES / RESÚMENES / ESQUEMAS LIST ===
  const notesCount = notes.filter((n) => n.kind === 'note').length;
  const summariesCount = notes.filter((n) => n.kind === 'summary').length;
  const outlinesCount = notes.filter((n) => n.kind === 'outline').length;

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <ColdiAvatar pose="writing" size="md" floating={animateMascot} />
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-[#2E1F3E] dark:text-white">
            Apuntes
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => handleCreateNew('outline')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-white dark:bg-midnight-900 border border-lavender-200 dark:border-midnight-700 hover:border-accent text-[#4A3861] dark:text-[#E2D8F3] text-xs font-bold transition-all"
          >
            <GitBranch className="w-4 h-4 text-accent dark:text-lavender-300" />
            <span>+ Esquema</span>
          </button>
          <button
            onClick={() => handleCreateNew('note', true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-accent hover:bg-accent-dark text-white text-xs font-bold shadow-soft transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo apunte</span>
          </button>
        </div>
      </div>

      {/* Sub-Tabs: Apuntes | Resúmenes | Esquemas */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="inline-flex p-1 rounded-2xl bg-white dark:bg-midnight-900 border border-lavender-200/80 dark:border-midnight-700 self-start">
          <button
            onClick={() => setKindTab('note')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              kindTab === 'note'
                ? 'bg-accent text-white shadow-sm'
                : 'text-[#6C5788] dark:text-[#B9A7D1]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Apuntes ({notesCount})</span>
          </button>
          <button
            onClick={() => setKindTab('summary')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              kindTab === 'summary'
                ? 'bg-accent text-white shadow-sm'
                : 'text-[#6C5788] dark:text-[#B9A7D1]'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>Resúmenes ({summariesCount})</span>
          </button>
          <button
            onClick={() => setKindTab('outline')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              kindTab === 'outline'
                ? 'bg-accent text-white shadow-sm'
                : 'text-[#6C5788] dark:text-[#B9A7D1]'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>Esquemas ({outlinesCount})</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:min-w-[200px]">
            <Search className="w-4 h-4 text-[#9B89B3] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar en tus apuntes..."
              className="w-full pl-9 pr-4 py-2 rounded-2xl bg-white dark:bg-midnight-900 border border-lavender-200/80 dark:border-midnight-700 text-xs text-[#2E1F3E] dark:text-white focus:outline-none focus:ring-2 focus:ring-lavender-400/50"
            />
          </div>

          {activeSubjects.length > 0 && (
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="px-3 py-2 rounded-2xl bg-white dark:bg-midnight-900 border border-lavender-200/80 dark:border-midnight-700 text-xs font-semibold text-[#4A3861] dark:text-[#E2D8F3]"
            >
              <option value="ALL">Todas las materias</option>
              {activeSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Cards Grid */}
      {filteredNotes.length === 0 ? (
        <div className="rounded-3xl p-10 text-center bg-white dark:bg-midnight-900 border border-dashed border-lavender-300 dark:border-midnight-700 space-y-3">
          <div className="flex justify-center">
            <ColdiAvatar pose="writing" size="lg" floating={animateMascot} />
          </div>
          <h3 className="font-display font-bold text-lg text-[#2E1F3E] dark:text-white">
            {kindTab === 'note'
              ? 'Empieza tu primer apunte de clase'
              : kindTab === 'summary'
              ? 'Sin resúmenes guardados todavía'
              : 'Sin esquemas visuales todavía'}
          </h3>
          <p className="text-sm text-[#735F8C] dark:text-[#A996C3] max-w-md mx-auto">
            {kindTab === 'note'
              ? 'Toma notas de clase, abre tus libros al lado y convierte tus apuntes en resúmenes o flashcards.'
              : kindTab === 'summary'
              ? 'Genera un resumen desde cualquier apunte o redacta uno nuevo aquí.'
              : 'Organiza conceptos, clasificaciones y requisitos en un esquema desplegable.'}
          </p>
          <button
            onClick={() => handleCreateNew(kindTab, true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-accent hover:bg-accent-dark text-white text-sm font-semibold shadow-soft"
          >
            <Plus className="w-4 h-4" />
            <span>
              {kindTab === 'note'
                ? 'Crear primer apunte'
                : kindTab === 'summary'
                ? 'Crear resumen'
                : 'Crear primer esquema'}
            </span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredNotes.map((note) => {
            const subj = note.subjectId ? subjectMap.get(note.subjectId) : undefined;
            const palette = subj ? SUBJECT_COLORS[subj.color] : SUBJECT_COLORS.lavender;
            const linkedBook = note.linkedBookId
              ? books.find((b) => b.id === note.linkedBookId)
              : undefined;

            return (
              <div
                key={note.id}
                onClick={() => {
                  loadedNoteIdRef.current = null;
                  setActiveNote(note);
                }}
                className="group cursor-pointer rounded-3xl p-5 bg-white dark:bg-midnight-900 border border-lavender-200/80 dark:border-midnight-700 shadow-soft hover:-translate-y-0.5 hover:border-accent/50 transition-all flex flex-col justify-between gap-3"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {subj && (
                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${palette.badgeBg} ${palette.badgeText}`}
                        >
                          {subj.name}
                        </span>
                      )}
                      {linkedBook && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-lavender-100 dark:bg-midnight-800 text-accent dark:text-lavender-300 max-w-[140px] truncate">
                          <BookOpen className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate">{linkedBook.title}</span>
                        </span>
                      )}
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteNote(note.id);
                      }}
                      className="p-1.5 rounded-xl text-[#A896C0] hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 opacity-60 group-hover:opacity-100"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <h3 className="font-display font-bold text-base text-[#2E1F3E] dark:text-white leading-snug">
                    {getResolvedNoteTitle(note)}
                  </h3>

                  {note.kind === 'outline' ? (
                    <div className="space-y-1 text-xs text-[#6E5B85] dark:text-[#B4A3CB]">
                      {note.outlineNodes.slice(0, 3).map((root) => (
                        <p key={root.id} className="truncate">
                          • <strong className="text-[#4A3861] dark:text-[#E2D8F3]">{root.text}</strong>
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[#6E5B85] dark:text-[#B4A3CB] line-clamp-3 leading-relaxed">
                      {note.content.trim() || 'Apunte en blanco — toca para empezar a escribir.'}
                    </p>
                  )}
                </div>

                <div className="pt-2.5 border-t border-lavender-100 dark:border-midnight-800 flex items-center justify-between text-[11px] text-[#8E7AA8]">
                  <span>Actualizado {formatShortDate(note.updatedAt)}</span>
                  {note.isFavorite && <Star className="w-3.5 h-3.5 text-amber-500 fill-current" />}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
