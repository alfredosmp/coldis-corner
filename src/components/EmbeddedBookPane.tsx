import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  BookMarked,
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  Eraser,
  Highlighter,
  Quote,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { db } from '../db/database';
import {
  loadDocxSections,
  loadEpubDocument,
  pdfjsLib,
  type ParsedSection,
} from '../services/documentParser';
import {
  annotateHtmlWithGlossary,
  extractPdfGlossaryHits,
  type PdfGlossaryHit,
} from '../services/glossaryMatcher';
import type {
  BookHighlight,
  BookItem,
  GlossaryTerm,
  HighlightColorId,
} from '../types/models';
import { createId } from '../utils/text';
import { ColdiAvatar } from './ColdiAvatar';
import {
  GlossaryHoverTooltip,
  type ActiveGlossaryPopover,
} from './GlossaryHoverTooltip';

interface EmbeddedBookPaneProps {
  book: BookItem;
  glossary: GlossaryTerm[];
  defaultGlossaryMarks?: boolean;
  targetLocation?: number;
  onLocationChange?: (location: number) => void;
  onInsertCitation: (citationText: string) => void;
  onInsertExcerpt: (excerptText: string, citationLabel: string) => void;
  onClosePane: () => void;
}

const HIGHLIGHT_STYLES: Record<
  HighlightColorId,
  { label: string; swatch: string; overlayBg: string }
> = {
  yellow: { label: 'Amarillo', swatch: '#FDE047', overlayBg: 'rgba(253, 224, 71, 0.42)' },
  lavender: { label: 'Lavanda', swatch: '#D8B4FE', overlayBg: 'rgba(192, 132, 252, 0.42)' },
  pink: { label: 'Rosa', swatch: '#F9A8D4', overlayBg: 'rgba(244, 114, 182, 0.38)' },
  mint: { label: 'Menta', swatch: '#6EE7B7', overlayBg: 'rgba(52, 211, 153, 0.38)' },
};

export function EmbeddedBookPane({
  book,
  glossary,
  defaultGlossaryMarks = true,
  targetLocation,
  onLocationChange,
  onInsertCitation,
  onInsertExcerpt,
  onClosePane,
}: EmbeddedBookPaneProps) {
  const [location, setLocation] = useState(
    Math.max(1, Math.min(book.totalLocations || 1, targetLocation ?? book.currentLocation ?? 1))
  );
  const [totalLocations, setTotalLocations] = useState(Math.max(1, book.totalLocations || 1));
  const [pdfZoom, setPdfZoom] = useState(1.0);
  const [fontSize, setFontSize] = useState(15);

  // Interactive PDF Highlighter state
  const [highlightMode, setHighlightMode] = useState(false);
  const [highlightColor, setHighlightColor] = useState<HighlightColorId>('yellow');
  const [dragBox, setDragBox] = useState<{
    startX: number;
    startY: number;
    curX: number;
    curY: number;
  } | null>(null);

  // In-book Glossary auto-underline + hover tooltip state
  const [glossaryMarksOn, setGlossaryMarksOn] = useState(defaultGlossaryMarks);
  const [pdfGlossaryHits, setPdfGlossaryHits] = useState<PdfGlossaryHit[]>([]);
  const [glossaryPopover, setGlossaryPopover] = useState<ActiveGlossaryPopover | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sections, setSections] = useState<ParsedSection[]>([]);

  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);

  const glossaryMap = useMemo(() => new Map(glossary.map((g) => [g.id, g])), [glossary]);

  useEffect(() => {
    if (targetLocation && targetLocation >= 1) {
      setLocation(Math.min(Math.max(1, totalLocations), targetLocation));
    }
  }, [targetLocation, totalLocations]);

  useEffect(() => {
    setLocation(
      Math.max(1, Math.min(book.totalLocations || 1, targetLocation ?? book.currentLocation ?? 1))
    );
  }, [book.id]);

  const pageHighlights =
    useLiveQuery(
      () =>
        db.bookHighlights
          .where('[bookId+page]')
          .equals([book.id, location])
          .toArray(),
      [book.id, location]
    ) ?? [];

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      setPdfGlossaryHits([]);
      try {
        const blobRecord = await db.bookFiles.get(book.id);
        if (cancelled) return;
        if (!blobRecord) {
          setLoadError('No se encontró el archivo local de este libro.');
          setLoading(false);
          return;
        }

        if (book.format === 'pdf') {
          const loadingTask = pdfjsLib.getDocument({
            data: new Uint8Array(blobRecord.data.slice(0)),
          });
          const pdfDoc = await loadingTask.promise;
          if (cancelled) {
            await pdfDoc.cleanup();
            return;
          }
          pdfDocRef.current = pdfDoc;
          setTotalLocations(pdfDoc.numPages);
          setLoading(false);
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
          setLoadError(err instanceof Error ? err.message : 'No se pudo abrir el libro.');
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
      }
      if (pdfDocRef.current) {
        pdfDocRef.current.cleanup();
        pdfDocRef.current = null;
      }
    };
  }, [book.id, book.format]);

  // Render PDF page + detect Glossary terms on this page!
  useEffect(() => {
    if (book.format !== 'pdf' || loading || !pdfDocRef.current || !canvasRef.current) return;
    let cancelled = false;
    async function renderPage() {
      const pdfDoc = pdfDocRef.current;
      const canvas = canvasRef.current;
      if (!pdfDoc || !canvas) return;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
      }

      const safePage = Math.max(1, Math.min(pdfDoc.numPages, location));
      const page = await pdfDoc.getPage(safePage);
      if (cancelled) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: pdfZoom * dpr });
      const displayViewport = page.getViewport({ scale: pdfZoom });

      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = `${Math.floor(displayViewport.width)}px`;
      canvas.style.height = `${Math.floor(displayViewport.height)}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const task = page.render({ canvas, canvasContext: ctx, viewport });
      renderTaskRef.current = task;
      try {
        await task.promise;
      } catch {
        // ignore cancel
      }

      if (!cancelled && glossaryMarksOn) {
        const hits = await extractPdfGlossaryHits(page, glossary);
        if (!cancelled) setPdfGlossaryHits(hits);
      } else if (!cancelled) {
        setPdfGlossaryHits([]);
      }
    }
    renderPage();
    return () => {
      cancelled = true;
    };
  }, [book.format, loading, location, pdfZoom, glossaryMarksOn, glossary]);

  useEffect(() => {
    if (loading) return;
    onLocationChange?.(location);
    const t = window.setTimeout(() => {
      db.books.update(book.id, {
        currentLocation: location,
        lastOpenedAt: Date.now(),
        updatedAt: Date.now(),
      });
    }, 400);
    return () => window.clearTimeout(t);
  }, [book.id, location, loading]);

  const currentSection = sections[location - 1];
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

  function getNormalizedPoint(e: React.PointerEvent<HTMLDivElement>) {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    return { x, y };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!highlightMode) return;
    const pt = getNormalizedPoint(e);
    if (!pt) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragBox({ startX: pt.x, startY: pt.y, curX: pt.x, curY: pt.y });
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragBox) return;
    const pt = getNormalizedPoint(e);
    if (!pt) return;
    setDragBox((prev) => (prev ? { ...prev, curX: pt.x, curY: pt.y } : null));
  }

  async function handlePointerUp() {
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

  const currentLocLabel =
    book.format === 'pdf'
      ? `Pág. ${location}`
      : sections[location - 1]?.title || `Sección ${location}`;

  function handlePassSelectionToNotes() {
    const selected = window.getSelection()?.toString().trim();
    if (!selected) return;
    onInsertExcerpt(selected, `${book.title} · ${currentLocLabel}`);
  }

  return (
    <div className="flex flex-col h-full rounded-3xl bg-white dark:bg-midnight-900 border border-lavender-200/80 dark:border-midnight-700 shadow-soft overflow-hidden">
      {/* Compact Top Bar */}
      <div className="px-3.5 py-2.5 border-b border-lavender-100 dark:border-midnight-800 flex flex-wrap items-center justify-between gap-2 bg-lavender-50/60 dark:bg-midnight-850/70 shrink-0">
        <div className="min-w-0 flex-1">
          <p className="font-display font-bold text-xs sm:text-sm text-[#2E1F3E] dark:text-white truncate">
            {book.title}
          </p>
          <p className="text-[10px] text-[#7A6693] dark:text-[#A995C4]">
            {book.format.toUpperCase()} · {currentLocLabel} / {totalLocations}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <div className="inline-flex items-center rounded-xl bg-white dark:bg-midnight-900 border border-lavender-200 dark:border-midnight-700 px-1 py-0.5">
            <button
              onClick={() => setLocation((p) => Math.max(1, p - 1))}
              disabled={location <= 1}
              className="p-1 text-[#5A4574] dark:text-[#D1C3E5] disabled:opacity-35"
              title="Anterior"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-bold px-1.5 tabular-nums text-[#2E1F3E] dark:text-white">
              {location}/{totalLocations}
            </span>
            <button
              onClick={() => setLocation((p) => Math.min(totalLocations, p + 1))}
              disabled={location >= totalLocations}
              className="p-1 text-[#5A4574] dark:text-[#D1C3E5] disabled:opacity-35"
              title="Siguiente"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {book.format === 'pdf' ? (
            <div className="inline-flex items-center rounded-xl bg-white dark:bg-midnight-900 border border-lavender-200 dark:border-midnight-700 px-1 py-0.5">
              <button
                onClick={() => setPdfZoom((z) => Math.max(0.6, +(z - 0.15).toFixed(2)))}
                className="p-1 text-[#5A4574] dark:text-[#D1C3E5]"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setPdfZoom((z) => Math.min(2.0, +(z + 0.15).toFixed(2)))}
                className="p-1 text-[#5A4574] dark:text-[#D1C3E5]"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="inline-flex items-center rounded-xl bg-white dark:bg-midnight-900 border border-lavender-200 dark:border-midnight-700 px-1 py-0.5">
              <button
                onClick={() => setFontSize((s) => Math.max(12, s - 1))}
                className="px-1.5 text-[11px] font-bold text-[#5A4574] dark:text-[#D1C3E5]"
              >
                A-
              </button>
              <button
                onClick={() => setFontSize((s) => Math.min(22, s + 1))}
                className="px-1.5 text-[11px] font-bold text-[#5A4574] dark:text-[#D1C3E5]"
              >
                A+
              </button>
            </div>
          )}

          {/* Glossary auto-underline toggle */}
          <button
            onClick={() => setGlossaryMarksOn((v) => !v)}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-xl text-[11px] font-bold border transition-colors ${
              glossaryMarksOn
                ? 'bg-lavender-100 dark:bg-midnight-800 border-accent/50 text-accent dark:text-lavender-300'
                : 'bg-white dark:bg-midnight-900 border-lavender-200 dark:border-midnight-700 text-[#8A76A3]'
            }`}
            title="Subrayar palabras del Glosario para ver su definición al pasar el cursor"
          >
            <BookMarked className="w-3 h-3" />
          </button>

          <button
            onClick={() => onInsertCitation(`${book.title} · ${currentLocLabel}`)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-lavender-100 dark:bg-midnight-800 hover:bg-lavender-200/80 text-accent dark:text-lavender-300 text-[11px] font-bold"
            title="Citar esta página en tus apuntes"
          >
            <Quote className="w-3 h-3" />
            <span>Citar</span>
          </button>

          {book.format !== 'pdf' && (
            <button
              onClick={handlePassSelectionToNotes}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-blush-100 dark:bg-[#41203B] text-blush-600 dark:text-blush-200 text-[11px] font-bold"
              title="Pasar texto seleccionado a tus apuntes"
            >
              <ClipboardPaste className="w-3 h-3" />
            </button>
          )}

          <button
            onClick={onClosePane}
            className="p-1.5 rounded-xl text-[#8A76A3] hover:text-rose-500"
            title="Cerrar panel de libro"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* PDF Highlighter Toolbar */}
      {book.format === 'pdf' && (
        <div className="px-3.5 py-2 border-b border-lavender-100 dark:border-midnight-800 flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-midnight-900 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setHighlightMode((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all ${
                highlightMode
                  ? 'bg-accent text-white border-accent shadow-sm'
                  : 'bg-lavender-50 dark:bg-midnight-850 border-lavender-200 dark:border-midnight-700 text-[#5A4574] dark:text-[#D1C3E5]'
              }`}
            >
              <Highlighter className="w-3.5 h-3.5" />
              <span>{highlightMode ? 'Subrayando (arrastra)' : 'Subrayar'}</span>
            </button>

            <div className="flex items-center gap-1.5">
              {(Object.keys(HIGHLIGHT_STYLES) as HighlightColorId[]).map((cid) => (
                <button
                  key={cid}
                  onClick={() => {
                    setHighlightColor(cid);
                    setHighlightMode(true);
                  }}
                  title={HIGHLIGHT_STYLES[cid].label}
                  className={`w-5 h-5 rounded-full transition-transform ${
                    highlightColor === cid && highlightMode
                      ? 'scale-115 ring-2 ring-offset-1 ring-accent dark:ring-offset-midnight-900'
                      : 'opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: HIGHLIGHT_STYLES[cid].swatch }}
                />
              ))}
            </div>
          </div>

          {pageHighlights.length > 0 && (
            <button
              onClick={() => db.bookHighlights.bulkDelete(pageHighlights.map((h) => h.id))}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#8A76A3] hover:text-rose-500"
            >
              <Eraser className="w-3.5 h-3.5" />
              <span>Limpiar</span>
            </button>
          )}
        </div>
      )}

      {/* Section picker for DOCX / EPUB */}
      {book.format !== 'pdf' && sections.length > 1 && (
        <div className="px-3.5 py-1.5 border-b border-lavender-100 dark:border-midnight-800 bg-white dark:bg-midnight-900 shrink-0">
          <select
            value={location}
            onChange={(e) => setLocation(Number(e.target.value))}
            className="w-full text-xs font-semibold bg-lavender-50 dark:bg-midnight-850 border border-lavender-200 dark:border-midnight-700 rounded-xl px-2.5 py-1 text-[#2E1F3E] dark:text-white"
          >
            {sections.map((sec) => (
              <option key={sec.location} value={sec.location}>
                {sec.location}. {sec.title}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Document Viewport */}
      <div className="flex-1 overflow-auto p-3.5 bg-lavender-50/40 dark:bg-midnight-950/60">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 py-10">
            <ColdiAvatar pose="reading" size="md" floating />
            <p className="text-xs font-semibold text-[#7A6693] dark:text-[#B4A3CB]">
              Abriendo libro...
            </p>
          </div>
        ) : loadError ? (
          <div className="h-full flex items-center justify-center text-xs font-bold text-rose-500 p-4 text-center">
            {loadError}
          </div>
        ) : book.format === 'pdf' ? (
          <div className="flex justify-center">
            <div className="relative inline-block shadow-soft rounded-xl overflow-hidden bg-white select-none">
              <canvas ref={canvasRef} className="block max-w-none" />

              {/* Interactive Highlight & Glossary Hover Layer */}
              <div
                ref={overlayRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                className={`absolute inset-0 ${
                  highlightMode ? 'cursor-crosshair touch-none' : 'pointer-events-none'
                }`}
              >
                {/* Automatic Glossary Word Underlines (hover to see definition!) */}
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

                {/* Saved Manual Highlights */}
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
                      backgroundColor:
                        HIGHLIGHT_STYLES[hl.color]?.overlayBg ?? HIGHLIGHT_STYLES.yellow.overlayBg,
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
                      backgroundColor: HIGHLIGHT_STYLES[highlightColor].overlayBg,
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
            className="reader-prose rounded-2xl p-5 bg-white dark:bg-midnight-900 border border-lavender-200/60 dark:border-midnight-800 text-[#2E1F3E] dark:text-[#EFE9F8]"
            style={{ fontSize: `${fontSize}px` }}
            dangerouslySetInnerHTML={{ __html: annotatedHtml }}
          />
        )}
      </div>

      <GlossaryHoverTooltip
        popover={glossaryPopover}
        onClose={() => setGlossaryPopover(null)}
      />
    </div>
  );
}
