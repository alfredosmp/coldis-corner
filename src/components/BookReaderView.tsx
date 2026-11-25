import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft,
  BookMarked,
  Check,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Eraser,
  Highlighter,
  Quote,
  Search,
  Type,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { db } from '../db/database';
import {
  loadDocxSections,
  loadEpubDocument,
  pdfjsLib,
  toFreshUint8Array,
  type ParsedSection,
} from '../services/documentParser';
import { buildSnippet, tokenizeQuery } from '../services/searchEngine';
import {
  annotateHtmlWithGlossary,
  extractPdfGlossaryHits,
  type PdfGlossaryHit,
} from '../services/glossaryMatcher';
import type {
  BookHighlight,
  BookItem,
  BookTextChunk,
  GlossaryTerm,
  HighlightColorId,
  Subject,
} from '../types/models';
import { createId, normalizeText } from '../utils/text';
import { ColdiAvatar } from './ColdiAvatar';
import {
  GlossaryHoverTooltip,
  type ActiveGlossaryPopover,
} from './GlossaryHoverTooltip';

const PDF_HL_STYLES: Record<HighlightColorId, { label: string; swatch: string; overlayBg: string }> = {
  yellow: { label: 'Amarillo', swatch: '#FDE047', overlayBg: 'rgba(253, 224, 71, 0.42)' },
  lavender: { label: 'Lavanda', swatch: '#D8B4FE', overlayBg: 'rgba(192, 132, 252, 0.42)' },
  pink: { label: 'Rosa', swatch: '#F9A8D4', overlayBg: 'rgba(244, 114, 182, 0.38)' },
  mint: { label: 'Menta', swatch: '#6EE7B7', overlayBg: 'rgba(52, 211, 153, 0.38)' },
};

interface BookReaderViewProps {
  book: BookItem;
  subject?: Subject;
  glossary: GlossaryTerm[];
  defaultGlossaryMarks?: boolean;
  initialLocation?: number;
  initialSearchQuery?: string;
  onClose: () => void;
  onUpdateBookProgress: (bookId: string, location: number, totalLocations?: number) => Promise<void>;
  onUpdateReadingNotes: (bookId: string, notes: string) => Promise<void>;
}

export function BookReaderView({
  book,
  subject,
  glossary,
  defaultGlossaryMarks = true,
  initialLocation,
  initialSearchQuery,
  onClose,
  onUpdateBookProgress,
  onUpdateReadingNotes,
}: BookReaderViewProps) {
  const [location, setLocation] = useState(
    Math.max(1, Math.min(book.totalLocations || 1, initialLocation ?? book.currentLocation ?? 1))
  );
  const [totalLocations, setTotalLocations] = useState(Math.max(1, book.totalLocations || 1));
  const [pageInput, setPageInput] = useState(String(location));

  // Reader appearance & PDF highlighter
  const [pdfZoom, setPdfZoom] = useState(1.15);
  const [fontSize, setFontSize] = useState(16);
  const [useSerif, setUseSerif] = useState(book.format === 'epub');
  const [highlightMode, setHighlightMode] = useState(false);
  const [highlightColor, setHighlightColor] = useState<HighlightColorId>('yellow');
  const [dragBox, setDragBox] = useState<{
    startX: number;
    startY: number;
    curX: number;
    curY: number;
  } | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const pageHighlights =
    useLiveQuery(
      () =>
        db.bookHighlights
          .where('[bookId+page]')
          .equals([book.id, location])
          .toArray(),
      [book.id, location]
    ) ?? [];

  // Split-view notes & helper drawers
  const [splitNotesOpen, setSplitNotesOpen] = useState(true);
  const [notesDraft, setNotesDraft] = useState(book.readingNotes ?? '');
  const [notesSaved, setNotesSaved] = useState(false);
  const [inBookSearchOpen, setInBookSearchOpen] = useState(Boolean(initialSearchQuery));
  const [inBookQuery, setInBookQuery] = useState(initialSearchQuery ?? '');
  const [glossaryDrawerOpen, setGlossaryDrawerOpen] = useState(false);
  const [glossaryQuery, setGlossaryQuery] = useState('');
  const [glossaryMarksOn, setGlossaryMarksOn] = useState(defaultGlossaryMarks);
  const [pdfGlossaryHits, setPdfGlossaryHits] = useState<PdfGlossaryHit[]>([]);
  const [glossaryPopover, setGlossaryPopover] = useState<ActiveGlossaryPopover | null>(null);

  const glossaryMap = useMemo(() => new Map(glossary.map((g) => [g.id, g])), [glossary]);

  // Document loaded states
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pdfDocVersion, setPdfDocVersion] = useState(0);
  const [sections, setSections] = useState<ParsedSection[]>([]);
  const [bookChunks, setBookChunks] = useState<BookTextChunk[]>([]);

  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const loadingTaskRef = useRef<pdfjsLib.PDFDocumentLoadingTask | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
  const notesAreaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setPageInput(String(location));
  }, [location]);

  // Load binary file + indexed chunks from Dexie
  useEffect(() => {
    let cancelled = false;

    async function loadBookContent() {
      setLoading(true);
      setLoadError(null);
      setPdfGlossaryHits([]);
      try {
        const [blobRecord, chunks] = await Promise.all([
          db.bookFiles.get(book.id),
          db.bookChunks.where('bookId').equals(book.id).toArray(),
        ]);

        if (cancelled) return;
        setBookChunks(chunks.sort((a, b) => a.location - b.location));

        if (!blobRecord) {
          setLoadError('No se encontró el archivo local de este libro.');
          setLoading(false);
          return;
        }

        if (book.format === 'pdf') {
          const loadingTask = pdfjsLib.getDocument({
            data: toFreshUint8Array(blobRecord.data),
            useSystemFonts: true,
          });
          loadingTaskRef.current = loadingTask;
          const pdfDoc = await loadingTask.promise;
          if (cancelled) {
            await loadingTask.destroy().catch(() => {});
            return;
          }
          pdfDocRef.current = pdfDoc;
          setTotalLocations(pdfDoc.numPages);
          setLoading(false);
          setPdfDocVersion((v) => v + 1);
        } else if (book.format === 'docx') {
          const parsed = await loadDocxSections(blobRecord.data);
          if (cancelled) return;
          setSections(parsed);
          setTotalLocations(Math.max(1, parsed.length));
          setLoading(false);
        } else {
          const epub = await loadEpubDocument(blobRecord.data);
          if (cancelled) return;
          setSections(epub.chapters);
          setTotalLocations(Math.max(1, epub.chapters.length));
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : 'No se pudo abrir este documento.'
          );
          setLoading(false);
        }
      }
    }

    loadBookContent();

    return () => {
      cancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
        renderTaskRef.current = null;
      }
      pdfDocRef.current = null;
      if (loadingTaskRef.current) {
        loadingTaskRef.current.destroy().catch(() => {});
        loadingTaskRef.current = null;
      }
    };
  }, [book.id, book.format]);

  // Render current PDF page onto an isolated offscreen canvas first (prevents PDF.js v6 canvas conflicts & blank frames)
  useEffect(() => {
    if (book.format !== 'pdf' || loading || pdfDocVersion === 0 || !pdfDocRef.current) return;

    let cancelled = false;
    let activeTask: pdfjsLib.RenderTask | null = null;

    async function renderPdfPage() {
      const pdfDoc = pdfDocRef.current;
      if (!pdfDoc) return;

      try {
        const safePage = Math.max(1, Math.min(pdfDoc.numPages, location));
        const page = await pdfDoc.getPage(safePage);
        if (cancelled) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale: pdfZoom * dpr });
        const displayViewport = page.getViewport({ scale: pdfZoom });

        const offscreen = document.createElement('canvas');
        offscreen.width = Math.max(1, Math.floor(viewport.width));
        offscreen.height = Math.max(1, Math.floor(viewport.height));

        const task = page.render({ canvas: offscreen, viewport });
        activeTask = task;
        renderTaskRef.current = task;
        await task.promise;
        if (cancelled) return;

        const visible = canvasRef.current;
        if (!visible) return;
        visible.width = offscreen.width;
        visible.height = offscreen.height;
        visible.style.width = `${Math.max(1, Math.floor(displayViewport.width))}px`;
        visible.style.height = `${Math.max(1, Math.floor(displayViewport.height))}px`;

        const visibleCtx = visible.getContext('2d');
        if (visibleCtx) {
          visibleCtx.clearRect(0, 0, visible.width, visible.height);
          visibleCtx.drawImage(offscreen, 0, 0);
        }
      } catch (err) {
        if (cancelled) return;
        const name = err instanceof Error ? err.name : '';
        if (name !== 'RenderingCancelledException') {
          setLoadError(
            err instanceof Error ? `No se pudo renderizar esta página: ${err.message}` : 'No se pudo mostrar esta página.'
          );
        }
      }
    }

    renderPdfPage();
    return () => {
      cancelled = true;
      if (activeTask) {
        try {
          activeTask.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, [book.id, book.format, loading, pdfDocVersion, location, pdfZoom]);

  // Separate effect for PDF Glossary underlines so glossary updates never cancel/blank the PDF canvas!
  useEffect(() => {
    if (book.format !== 'pdf' || loading || pdfDocVersion === 0 || !pdfDocRef.current) return;
    if (!glossaryMarksOn) {
      setPdfGlossaryHits([]);
      return;
    }

    let cancelled = false;
    async function detectGlossaryHits() {
      const pdfDoc = pdfDocRef.current;
      if (!pdfDoc) return;
      try {
        const safePage = Math.max(1, Math.min(pdfDoc.numPages, location));
        const page = await pdfDoc.getPage(safePage);
        if (cancelled) return;
        const hits = await extractPdfGlossaryHits(page, glossary);
        if (!cancelled) setPdfGlossaryHits(hits);
      } catch {
        // Non-fatal
      }
    }

    detectGlossaryHits();
    return () => {
      cancelled = true;
    };
  }, [book.id, book.format, loading, pdfDocVersion, location, glossaryMarksOn, glossary]);

  // Persist reading progress automatically
  useEffect(() => {
    if (loading) return;
    const timer = window.setTimeout(() => {
      onUpdateBookProgress(book.id, location, totalLocations);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [book.id, location, totalLocations, loading]);

  // Keyboard arrow navigation when not typing
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowRight') {
        setLocation((p) => Math.min(totalLocations, p + 1));
      } else if (e.key === 'ArrowLeft') {
        setLocation((p) => Math.max(1, p - 1));
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [totalLocations]);

  async function saveNotes() {
    await onUpdateReadingNotes(book.id, notesDraft);
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 1600);
  }

  function insertCitation() {
    const locLabel =
      book.format === 'pdf'
        ? `Pág. ${location}`
        : sections[location - 1]?.title || `Sección ${location}`;
    const citation = `\n📌 [${book.title} · ${locLabel}]: `;
    const nextText = (notesDraft ? notesDraft.trimEnd() + '\n' : '') + citation.trimStart();
    setNotesDraft(nextText);
    if (!splitNotesOpen) setSplitNotesOpen(true);
    onUpdateReadingNotes(book.id, nextText);
    setTimeout(() => {
      if (notesAreaRef.current) {
        notesAreaRef.current.focus();
        notesAreaRef.current.setSelectionRange(nextText.length, nextText.length);
      }
    }, 50);
  }

  // In-book search matches
  const inBookMatches = useMemo(() => {
    const q = inBookQuery.trim();
    if (q.length < 2) return [];
    const tokens = tokenizeQuery(q);
    const normPhrase = normalizeText(q);
    if (tokens.length === 0) return [];

    return bookChunks
      .filter((ch) => {
        if (ch.normalizedText.includes(normPhrase)) return true;
        return tokens.every((t) => ch.normalizedText.includes(t));
      })
      .slice(0, 30)
      .map((ch) => ({
        location: ch.location,
        label: ch.locationLabel,
        snippet: buildSnippet(ch.text, q, tokens),
      }));
  }, [inBookQuery, bookChunks]);

  // Quick glossary matches
  const quickGlossaryResults = useMemo(() => {
    const q = normalizeText(glossaryQuery);
    if (!q) return glossary.slice(0, 8);
    return glossary
      .filter(
        (g) =>
          normalizeText(g.term).includes(q) ||
          normalizeText(g.definition).includes(q) ||
          normalizeText(g.branch).includes(q)
      )
      .slice(0, 10);
  }, [glossary, glossaryQuery]);

  const currentSection = sections[location - 1];
  const progressPct = Math.round((location / Math.max(1, totalLocations)) * 100);

  const annotatedHtml = useMemo(() => {
    const raw = currentSection?.html ?? '<p>Sección vacía.</p>';
    if (!glossaryMarksOn || book.format === 'pdf') return raw;
    return annotateHtmlWithGlossary(raw, glossary);
  }, [currentSection?.html, glossaryMarksOn, book.format, glossary]);

  function handleProseMouseOver(e: React.MouseEvent<HTMLElement>) {
    const target = (e.target as HTMLElement | null)?.closest('.glossary-hit') as HTMLElement | null;
    if (!target) return;
    const termId = target.getAttribute('data-glossary-id');
    if (!termId) return;
    const term = glossaryMap.get(termId);
    if (!term) return;
    const rect = target.getBoundingClientRect();
    setGlossaryPopover({ term, x: rect.left + rect.width / 2, y: rect.top });
  }

  function handleProseMouseOut(e: React.MouseEvent<HTMLElement>) {
    const target = (e.target as HTMLElement | null)?.closest('.glossary-hit');
    if (target) setGlossaryPopover(null);
  }

  function handlePageInputSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = Number(pageInput);
    if (Number.isFinite(parsed)) {
      setLocation(Math.max(1, Math.min(totalLocations, Math.floor(parsed))));
    } else {
      setPageInput(String(location));
    }
  }

  function getNormPoint(e: React.PointerEvent<HTMLDivElement>) {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  }

  function handleHlPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!highlightMode) return;
    const pt = getNormPoint(e);
    if (!pt) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragBox({ startX: pt.x, startY: pt.y, curX: pt.x, curY: pt.y });
  }

  function handleHlPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragBox) return;
    const pt = getNormPoint(e);
    if (!pt) return;
    setDragBox((prev) => (prev ? { ...prev, curX: pt.x, curY: pt.y } : null));
  }

  async function handleHlPointerUp() {
    if (!dragBox) return;
    const x = Math.min(dragBox.startX, dragBox.curX);
    const y = Math.min(dragBox.startY, dragBox.curY);
    const width = Math.abs(dragBox.curX - dragBox.startX);
    const height = Math.abs(dragBox.curY - dragBox.startY);
    setDragBox(null);
    if (width < 0.015 || height < 0.008) return;
    const hl: BookHighlight = {
      id: createId('hl'),
      bookId: book.id,
      page: location,
      x,
      y,
      width,
      height,
      color: highlightColor,
      createdAt: Date.now(),
    };
    await db.bookHighlights.put(hl);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] md:h-[calc(100vh-3.5rem)] gap-3">
      {/* Top Reader Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-2xl bg-white dark:bg-midnight-900 border border-lavender-200/80 dark:border-midnight-700 shadow-soft shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={async () => {
              await onUpdateReadingNotes(book.id, notesDraft);
              onClose();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-lavender-50 dark:bg-midnight-850 hover:bg-lavender-100 dark:hover:bg-midnight-800 text-xs font-bold text-[#4A3861] dark:text-[#E4DCF4] transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Biblioteca</span>
          </button>

          <div className="min-w-0">
            <h1 className="font-display font-bold text-sm sm:text-base text-[#2E1F3E] dark:text-white truncate">
              {book.title}
            </h1>
            <p className="text-[11px] text-[#7A6693] dark:text-[#A995C4] truncate">
              {book.format.toUpperCase()}
              {subject ? ` · ${subject.name}` : book.shelf === 'personal' ? ' · Lectura Personal' : ''}
              {` · ${progressPct}%`}
            </p>
          </div>
        </div>

        {/* Navigation & Reader Controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Page / Section stepper */}
          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-lavender-50 dark:bg-midnight-850 border border-lavender-200/70 dark:border-midnight-700">
            <button
              onClick={() => setLocation((p) => Math.max(1, p - 1))}
              disabled={location <= 1}
              className="p-1 rounded-lg text-[#5A4574] dark:text-[#D1C3E5] hover:bg-white dark:hover:bg-midnight-800 disabled:opacity-35"
              title="Anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <form onSubmit={handlePageInputSubmit} className="inline-flex items-center gap-1 text-xs font-semibold">
              <input
                type="text"
                inputMode="numeric"
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                className="w-10 text-center py-0.5 rounded-lg bg-white dark:bg-midnight-900 border border-lavender-200 dark:border-midnight-700 text-[#2E1F3E] dark:text-white focus:outline-none"
              />
              <span className="text-[#7E6B96] dark:text-[#A995C4]">/ {totalLocations}</span>
            </form>

            <button
              onClick={() => setLocation((p) => Math.min(totalLocations, p + 1))}
              disabled={location >= totalLocations}
              className="p-1 rounded-lg text-[#5A4574] dark:text-[#D1C3E5] hover:bg-white dark:hover:bg-midnight-800 disabled:opacity-35"
              title="Siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Zoom (PDF) or Font Size (DOCX / EPUB) */}
          {book.format === 'pdf' ? (
            <div className="inline-flex items-center gap-0.5 px-1.5 py-1 rounded-xl bg-lavender-50 dark:bg-midnight-850 border border-lavender-200/70 dark:border-midnight-700">
              <button
                onClick={() => setPdfZoom((z) => Math.max(0.6, +(z - 0.15).toFixed(2)))}
                className="p-1 rounded-lg text-[#5A4574] dark:text-[#D1C3E5] hover:bg-white dark:hover:bg-midnight-800"
                title="Alejar"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-bold px-1 text-[#5A4574] dark:text-[#D1C3E5]">
                {Math.round(pdfZoom * 100)}%
              </span>
              <button
                onClick={() => setPdfZoom((z) => Math.min(2.4, +(z + 0.15).toFixed(2)))}
                className="p-1 rounded-lg text-[#5A4574] dark:text-[#D1C3E5] hover:bg-white dark:hover:bg-midnight-800"
                title="Acercar"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1 px-1.5 py-1 rounded-xl bg-lavender-50 dark:bg-midnight-850 border border-lavender-200/70 dark:border-midnight-700">
              <button
                onClick={() => setFontSize((s) => Math.max(13, s - 1))}
                className="px-1.5 py-0.5 rounded-lg text-xs font-bold text-[#5A4574] dark:text-[#D1C3E5] hover:bg-white dark:hover:bg-midnight-800"
                title="Reducir letra"
              >
                A-
              </button>
              <button
                onClick={() => setFontSize((s) => Math.min(24, s + 1))}
                className="px-1.5 py-0.5 rounded-lg text-xs font-bold text-[#5A4574] dark:text-[#D1C3E5] hover:bg-white dark:hover:bg-midnight-800"
                title="Aumentar letra"
              >
                A+
              </button>
              <button
                onClick={() => setUseSerif((v) => !v)}
                className={`p-1 rounded-lg transition-colors ${
                  useSerif ? 'bg-accent text-white' : 'text-[#5A4574] dark:text-[#D1C3E5]'
                }`}
                title="Alternar tipografía libro / moderna"
              >
                <Type className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* In-book search toggle */}
          <button
            onClick={() => {
              setInBookSearchOpen((v) => !v);
              setGlossaryDrawerOpen(false);
            }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
              inBookSearchOpen
                ? 'bg-accent text-white border-accent'
                : 'bg-lavender-50 dark:bg-midnight-850 border-lavender-200/70 dark:border-midnight-700 text-[#5A4574] dark:text-[#D1C3E5]'
            }`}
            title="Buscar dentro de este libro"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Buscar aquí</span>
          </button>

          {/* Glossary in-text underlines toggle */}
          <button
            onClick={() => setGlossaryMarksOn((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
              glossaryMarksOn
                ? 'bg-lavender-100 dark:bg-midnight-800 border-accent/50 text-accent dark:text-lavender-300'
                : 'bg-lavender-50 dark:bg-midnight-850 border-lavender-200/70 dark:border-midnight-700 text-[#7A6693] dark:text-[#A995C4]'
            }`}
            title="Subrayar términos del glosario en el texto (pasa el mouse para ver su definición)"
          >
            <span className="underline decoration-dotted decoration-2 underline-offset-2 font-bold">Aa</span>
            <span className="hidden xl:inline">Definiciones</span>
          </button>

          {/* Quick Glossary lookup */}
          <button
            onClick={() => {
              setGlossaryDrawerOpen((v) => !v);
              setInBookSearchOpen(false);
            }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
              glossaryDrawerOpen
                ? 'bg-accent text-white border-accent'
                : 'bg-lavender-50 dark:bg-midnight-850 border-lavender-200/70 dark:border-midnight-700 text-[#5A4574] dark:text-[#D1C3E5]'
            }`}
            title="Consultar Glosario sin salir de la lectura"
          >
            <BookMarked className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Glosario</span>
          </button>

          {/* Split-View Notes toggle */}
          <button
            onClick={() => setSplitNotesOpen((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
              splitNotesOpen
                ? 'bg-accent text-white border-accent shadow-sm'
                : 'bg-lavender-50 dark:bg-midnight-850 border-lavender-200/70 dark:border-midnight-700 text-[#5A4574] dark:text-[#D1C3E5]'
            }`}
            title="Vista dividida: libro y apuntes lado a lado"
          >
            <Columns2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Apuntes</span>
          </button>
        </div>
      </div>

      {/* Main Reader + Split-View Area */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3 overflow-hidden">
        {/* Left: Document Viewport */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col rounded-3xl bg-white dark:bg-midnight-900 border border-lavender-200/80 dark:border-midnight-700 shadow-soft overflow-hidden">
          {/* Optional section selector for DOCX / EPUB */}
          {book.format !== 'pdf' && sections.length > 1 && (
            <div className="px-4 py-2 border-b border-lavender-100 dark:border-midnight-800 flex items-center gap-2 bg-lavender-50/50 dark:bg-midnight-850/60 shrink-0">
              <span className="text-[11px] font-bold text-[#7A6693] dark:text-[#A995C4] shrink-0">
                {book.format === 'epub' ? 'Capítulo:' : 'Sección:'}
              </span>
              <select
                value={location}
                onChange={(e) => setLocation(Number(e.target.value))}
                className="flex-1 min-w-0 text-xs font-semibold bg-white dark:bg-midnight-900 border border-lavender-200 dark:border-midnight-700 rounded-xl px-2.5 py-1 text-[#2E1F3E] dark:text-white focus:outline-none"
              >
                {sections.map((sec) => (
                  <option key={sec.location} value={sec.location}>
                    {sec.location}. {sec.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Optional In-Book Search Drawer */}
          {inBookSearchOpen && (
            <div className="p-3 border-b border-lavender-200/80 dark:border-midnight-700 bg-lavender-50/80 dark:bg-midnight-850 space-y-2.5 shrink-0">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-accent dark:text-lavender-300 shrink-0" />
                <input
                  type="text"
                  autoFocus
                  value={inBookQuery}
                  onChange={(e) => setInBookQuery(e.target.value)}
                  placeholder="Buscar tema, artículo o palabra dentro de este libro..."
                  className="flex-1 bg-white dark:bg-midnight-900 border border-lavender-200 dark:border-midnight-700 rounded-xl px-3 py-1.5 text-xs text-[#2E1F3E] dark:text-white focus:outline-none focus:ring-2 focus:ring-lavender-400/50"
                />
                <button
                  onClick={() => setInBookSearchOpen(false)}
                  className="p-1.5 rounded-lg text-[#7E6B96] hover:bg-white dark:hover:bg-midnight-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {inBookQuery.trim().length >= 2 && (
                <div className="max-h-40 overflow-y-auto space-y-1.5">
                  {inBookMatches.length === 0 ? (
                    <p className="text-xs text-[#7E6B96] dark:text-[#A995C4] px-1">
                      Sin coincidencias en este documento.
                    </p>
                  ) : (
                    inBookMatches.map((m) => (
                      <button
                        key={`${m.location}_${m.label}`}
                        onClick={() => setLocation(m.location)}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs border transition-colors ${
                          m.location === location
                            ? 'bg-accent/10 border-accent/40'
                            : 'bg-white dark:bg-midnight-900 border-lavender-200/70 dark:border-midnight-700 hover:border-accent/50'
                        }`}
                      >
                        <span className="font-bold text-accent dark:text-lavender-300 mr-2">
                          {m.label}
                        </span>
                        <span className="text-[#594473] dark:text-[#CBBCE0]">
                          {m.snippet.before}
                          <mark className="bg-lavender-200 dark:bg-lavender-700/70 text-[#2E1F3E] dark:text-white px-0.5 rounded">
                            {m.snippet.match}
                          </mark>
                          {m.snippet.after}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Optional Quick Glossary Lookup */}
          {glossaryDrawerOpen && (
            <div className="p-3 border-b border-lavender-200/80 dark:border-midnight-700 bg-lavender-50/80 dark:bg-midnight-850 space-y-2.5 shrink-0">
              <div className="flex items-center gap-2">
                <BookMarked className="w-4 h-4 text-accent dark:text-lavender-300 shrink-0" />
                <input
                  type="text"
                  autoFocus
                  value={glossaryQuery}
                  onChange={(e) => setGlossaryQuery(e.target.value)}
                  placeholder="Consulta rápida del Glosario..."
                  className="flex-1 bg-white dark:bg-midnight-900 border border-lavender-200 dark:border-midnight-700 rounded-xl px-3 py-1.5 text-xs text-[#2E1F3E] dark:text-white focus:outline-none focus:ring-2 focus:ring-lavender-400/50"
                />
                <button
                  onClick={() => setGlossaryDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-[#7E6B96] hover:bg-white dark:hover:bg-midnight-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="max-h-44 overflow-y-auto space-y-1.5">
                {quickGlossaryResults.map((term) => (
                  <div
                    key={term.id}
                    className="p-2.5 rounded-xl bg-white dark:bg-midnight-900 border border-lavender-200/70 dark:border-midnight-700 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[#2E1F3E] dark:text-white">{term.term}</span>
                      <span className="text-[10px] font-semibold text-accent dark:text-lavender-300">
                        {term.branch}
                      </span>
                    </div>
                    <p className="text-[#5A4574] dark:text-[#C8B9DC] leading-relaxed">
                      {term.definition}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PDF Pastel Highlighter Toolbar */}
          {book.format === 'pdf' && (
            <div className="px-4 py-2 border-b border-lavender-100 dark:border-midnight-800 bg-white dark:bg-midnight-900 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setHighlightMode((v) => !v)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border transition-all ${
                    highlightMode
                      ? 'bg-accent text-white border-accent shadow-sm'
                      : 'bg-lavender-50 dark:bg-midnight-850 border-lavender-200 dark:border-midnight-700 text-[#5A4574] dark:text-[#D1C3E5]'
                  }`}
                >
                  <Highlighter className="w-3.5 h-3.5" />
                  <span>{highlightMode ? 'Subrayando PDF (arrastra sobre el texto)' : 'Subrayar PDF'}</span>
                </button>
                <div className="flex items-center gap-1.5">
                  {(Object.keys(PDF_HL_STYLES) as HighlightColorId[]).map((cid) => (
                    <button
                      key={cid}
                      onClick={() => {
                        setHighlightColor(cid);
                        setHighlightMode(true);
                      }}
                      title={`Marcatextos ${PDF_HL_STYLES[cid].label}`}
                      className={`w-5 h-5 rounded-full transition-transform ${
                        highlightColor === cid && highlightMode
                          ? 'scale-115 ring-2 ring-offset-1 ring-accent dark:ring-offset-midnight-900'
                          : 'opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: PDF_HL_STYLES[cid].swatch }}
                    />
                  ))}
                </div>
              </div>
              {pageHighlights.length > 0 && (
                <button
                  onClick={() => db.bookHighlights.bulkDelete(pageHighlights.map((h) => h.id))}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#8A76A3] hover:text-rose-500"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  <span>Limpiar subrayados de esta pág.</span>
                </button>
              )}
            </div>
          )}

          {/* Document Canvas / Prose Area */}
          <div className="flex-1 overflow-auto p-4 sm:p-6 bg-lavender-50/40 dark:bg-midnight-950/60">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 py-12">
                <ColdiAvatar pose="reading" size="lg" floating />
                <p className="text-sm font-semibold text-[#6D588A] dark:text-[#BBA9D3]">
                  Abriendo documento...
                </p>
              </div>
            ) : loadError ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-center py-12">
                <ColdiAvatar pose="thinking" size="lg" />
                <p className="text-sm font-bold text-rose-600 dark:text-rose-400">{loadError}</p>
              </div>
            ) : book.format === 'pdf' ? (
              <div className="flex justify-center">
                <div className="relative inline-block rounded-xl shadow-soft-lg bg-white overflow-hidden select-none">
                  <canvas ref={canvasRef} className="block max-w-none" />
                  <div
                    ref={overlayRef}
                    onPointerDown={handleHlPointerDown}
                    onPointerMove={handleHlPointerMove}
                    onPointerUp={handleHlPointerUp}
                    className={`absolute inset-0 ${
                      highlightMode ? 'cursor-crosshair touch-none' : 'pointer-events-none'
                    }`}
                  >
                    {/* Automatic Glossary Word Underlines (hover or click for definition) */}
                    {glossaryMarksOn &&
                      !highlightMode &&
                      pdfGlossaryHits.map((hit) => (
                        <div
                          key={hit.id}
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setGlossaryPopover({
                              term: hit.term,
                              x: rect.left + rect.width / 2,
                              y: rect.top,
                            });
                          }}
                          onMouseLeave={() => setGlossaryPopover(null)}
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            setGlossaryPopover({
                              term: hit.term,
                              x: rect.left + rect.width / 2,
                              y: rect.top,
                            });
                          }}
                          style={{
                            left: `${hit.x * 100}%`,
                            top: `${hit.y * 100}%`,
                            width: `${hit.width * 100}%`,
                            height: `${hit.height * 100}%`,
                          }}
                          className="absolute pointer-events-auto cursor-help border-b-2 border-dotted border-lavender-500 hover:bg-lavender-300/30 rounded-sm transition-colors"
                        />
                      ))}

                    {pageHighlights.map((hl) => (
                      <div
                        key={hl.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          db.bookHighlights.delete(hl.id);
                        }}
                        title="Clic para quitar subrayado"
                        style={{
                          left: `${hl.x * 100}%`,
                          top: `${hl.y * 100}%`,
                          width: `${hl.width * 100}%`,
                          height: `${hl.height * 100}%`,
                          backgroundColor: PDF_HL_STYLES[hl.color]?.overlayBg ?? PDF_HL_STYLES.yellow.overlayBg,
                          mixBlendMode: 'multiply',
                        }}
                        className="absolute rounded-sm pointer-events-auto cursor-pointer hover:ring-2 hover:ring-rose-400/80"
                      />
                    ))}
                    {dragBox && (
                      <div
                        style={{
                          left: `${Math.min(dragBox.startX, dragBox.curX) * 100}%`,
                          top: `${Math.min(dragBox.startY, dragBox.curY) * 100}%`,
                          width: `${Math.abs(dragBox.curX - dragBox.startX) * 100}%`,
                          height: `${Math.abs(dragBox.curY - dragBox.startY) * 100}%`,
                          backgroundColor: PDF_HL_STYLES[highlightColor].overlayBg,
                          mixBlendMode: 'multiply',
                        }}
                        className="absolute rounded-sm border border-accent/60"
                      />
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <article
                onMouseOver={handleProseMouseOver}
                onMouseOut={handleProseMouseOut}
                onClick={handleProseMouseOver}
                className={`reader-prose max-w-3xl mx-auto rounded-2xl p-6 sm:p-8 bg-white dark:bg-midnight-900 border border-lavender-200/60 dark:border-midnight-800 shadow-sm text-[#2E1F3E] dark:text-[#EFE9F8] ${
                  useSerif ? 'font-serif' : 'font-sans'
                }`}
                style={{ fontSize: `${fontSize}px` }}
                dangerouslySetInnerHTML={{
                  __html: annotatedHtml,
                }}
              />
            )}
          </div>
        </div>

        {/* Right: Split-View Reading Notes Panel */}
        {splitNotesOpen && (
          <aside className="lg:w-[340px] xl:w-[390px] h-64 lg:h-auto shrink-0 flex flex-col rounded-3xl bg-white dark:bg-midnight-900 border border-lavender-200/80 dark:border-midnight-700 shadow-soft overflow-hidden">
            <div className="px-4 py-3 border-b border-lavender-100 dark:border-midnight-800 flex items-center justify-between gap-2">
              <h2 className="font-display font-bold text-sm text-[#2E1F3E] dark:text-white">
                Apuntes de lectura
              </h2>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={insertCitation}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-lavender-100 dark:bg-midnight-800 hover:bg-lavender-200/80 text-accent dark:text-lavender-300 text-[11px] font-bold transition-colors"
                  title="Insertar cita con la página o sección actual"
                >
                  <Quote className="w-3.5 h-3.5" />
                  <span>Citar</span>
                </button>
                <button
                  onClick={saveNotes}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-accent hover:bg-accent-dark text-white text-[11px] font-bold transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{notesSaved ? '¡Listo!' : 'Guardar'}</span>
                </button>
              </div>
            </div>

            <textarea
              ref={notesAreaRef}
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              onBlur={saveNotes}
              placeholder={`Anota ideas clave, artículos o resúmenes mientras lees "${book.title}".\n\nUsa el botón "Citar" para marcar automáticamente la página actual.`}
              className="flex-1 w-full p-4 bg-lavender-50/40 dark:bg-midnight-950/40 text-sm text-[#2E1F3E] dark:text-[#EFE9F8] placeholder:text-[#9D8AB5] focus:outline-none resize-none leading-relaxed"
            />
          </aside>
        )}
      </div>

      <GlossaryHoverTooltip
        popover={glossaryPopover}
        onClose={() => setGlossaryPopover(null)}
      />
    </div>
  );
}
