import JSZip from 'jszip';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { BookFormat, BookTextChunk } from '../types/models';
import { normalizeText } from '../utils/text';

// Bundle PDF.js worker locally for 100% offline desktop/PWA support
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export { pdfjsLib };

export interface ParsedSection {
  location: number;
  title: string;
  html: string;
  plainText: string;
}

export interface DocumentImportResult {
  format: BookFormat;
  suggestedTitle: string;
  suggestedAuthor: string;
  totalLocations: number;
  coverDataUrl?: string;
  chunks: BookTextChunk[];
  arrayBuffer: ArrayBuffer;
  mimeType: string;
}

export function detectBookFormat(fileName: string): BookFormat | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.docx')) return 'docx';
  if (lower.endsWith('.epub')) return 'epub';
  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function cleanFileTitle(fileName: string): string {
  return fileName
    .replace(/\.(pdf|docx|epub)$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Basic DOM sanitizer to safely render HTML extracted from DOCX/EPUB files.
 */
export function sanitizeHtml(rawHtml: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, 'text/html');

  const blocked = doc.querySelectorAll('script, style, iframe, object, embed, link, meta, base, form');
  blocked.forEach((el) => el.remove());

  const all = doc.body.querySelectorAll('*');
  all.forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on') || name === 'style' || name === 'class' || name === 'id') {
        el.removeAttribute(attr.name);
      } else if (
        (name === 'href' || name === 'src') &&
        attr.value.trim().toLowerCase().startsWith('javascript:')
      ) {
        el.removeAttribute(attr.name);
      }
    }
  });

  return doc.body.innerHTML;
}

function htmlToPlainText(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function splitHtmlIntoSections(rawHtml: string): ParsedSection[] {
  const safeHtml = sanitizeHtml(rawHtml);
  const parser = new DOMParser();
  const doc = parser.parseFromString(safeHtml, 'text/html');
  const children = Array.from(doc.body.children);

  if (children.length === 0) {
    const plain = htmlToPlainText(safeHtml);
    return [
      {
        location: 1,
        title: 'Documento completo',
        html: safeHtml || '<p>Sin contenido visible.</p>',
        plainText: plain,
      },
    ];
  }

  const sections: ParsedSection[] = [];
  let currentNodes: Element[] = [];
  let currentTitle = 'Inicio';
  let currentCharCount = 0;

  const flush = () => {
    if (currentNodes.length === 0) return;
    const html = currentNodes.map((n) => n.outerHTML).join('\n');
    const plainText = currentNodes
      .map((n) => (n.textContent ?? '').trim())
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (plainText.length > 0 || html.includes('<img') || html.includes('<table')) {
      sections.push({
        location: sections.length + 1,
        title: currentTitle || `Sección ${sections.length + 1}`,
        html,
        plainText,
      });
    }
    currentNodes = [];
    currentCharCount = 0;
  };

  for (const el of children) {
    const tag = el.tagName.toUpperCase();
    const text = (el.textContent ?? '').trim();
    const isHeading = tag === 'H1' || tag === 'H2' || tag === 'H3';

    if (isHeading && currentNodes.length > 0 && currentCharCount > 300) {
      flush();
      currentTitle = text.slice(0, 72) || `Sección ${sections.length + 1}`;
    } else if (isHeading && currentNodes.length === 0) {
      currentTitle = text.slice(0, 72) || `Sección ${sections.length + 1}`;
    } else if (currentCharCount > 4500 && currentNodes.length > 0) {
      flush();
      currentTitle = `Sección ${sections.length + 1}`;
    }

    currentNodes.push(el);
    currentCharCount += text.length;
  }

  flush();

  if (sections.length === 0) {
    return [
      {
        location: 1,
        title: 'Documento',
        html: safeHtml,
        plainText: htmlToPlainText(safeHtml),
      },
    ];
  }

  return sections;
}

export async function loadDocxSections(arrayBuffer: ArrayBuffer): Promise<ParsedSection[]> {
  // Clone buffer because mammoth/zip may detach or read it
  const copy = arrayBuffer.slice(0);
  const result = await mammoth.convertToHtml({ arrayBuffer: copy });
  return splitHtmlIntoSections(result.value);
}

function resolveZipPath(baseDir: string, relativePath: string): string {
  const cleanRel = decodeURIComponent(relativePath.split('#')[0].split('?')[0]);
  if (!baseDir) return cleanRel.replace(/^\/+/, '');
  const parts = `${baseDir}/${cleanRel}`.split('/');
  const resolved: string[] = [];
  for (const p of parts) {
    if (!p || p === '.') continue;
    if (p === '..') resolved.pop();
    else resolved.push(p);
  }
  return resolved.join('/');
}

export async function loadEpubDocument(arrayBuffer: ArrayBuffer): Promise<{
  title: string;
  author: string;
  coverDataUrl?: string;
  chapters: ParsedSection[];
}> {
  const zip = await JSZip.loadAsync(arrayBuffer.slice(0));
  const parser = new DOMParser();

  // 1. Locate OPF rootfile via META-INF/container.xml
  const containerFile = zip.file('META-INF/container.xml');
  if (!containerFile) {
    throw new Error('El archivo EPUB no contiene META-INF/container.xml.');
  }
  const containerXml = await containerFile.async('string');
  const containerDoc = parser.parseFromString(containerXml, 'application/xml');
  const rootfileEl = containerDoc.querySelector('rootfile');
  const opfPath = rootfileEl?.getAttribute('full-path');
  if (!opfPath) {
    throw new Error('No se encontró el índice OPF dentro del EPUB.');
  }

  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/')) : '';
  const opfFile = zip.file(opfPath);
  if (!opfFile) {
    throw new Error('Archivo OPF faltante en el EPUB.');
  }

  const opfXml = await opfFile.async('string');
  const opfDoc = parser.parseFromString(opfXml, 'application/xml');

  // Metadata
  const titleEl = opfDoc.getElementsByTagNameNS('*', 'title')[0] ?? opfDoc.querySelector('title');
  const creatorEl =
    opfDoc.getElementsByTagNameNS('*', 'creator')[0] ?? opfDoc.querySelector('creator');
  const title = (titleEl?.textContent ?? '').trim();
  const author = (creatorEl?.textContent ?? '').trim();

  // Manifest map: id -> { href, mediaType, properties }
  const manifestMap = new Map<string, { href: string; mediaType: string; properties: string }>();
  const manifestItems = Array.from(opfDoc.querySelectorAll('manifest > item'));
  for (const item of manifestItems) {
    const id = item.getAttribute('id') ?? '';
    const href = item.getAttribute('href') ?? '';
    const mediaType = item.getAttribute('media-type') ?? '';
    const properties = item.getAttribute('properties') ?? '';
    if (id && href) {
      manifestMap.set(id, { href, mediaType, properties });
    }
  }

  // Optional Cover Image
  let coverDataUrl: string | undefined;
  let coverHref: string | undefined;
  for (const [, info] of manifestMap) {
    if (info.properties.includes('cover-image') && info.mediaType.startsWith('image/')) {
      coverHref = info.href;
      break;
    }
  }
  if (!coverHref) {
    const metaCover = opfDoc.querySelector('meta[name="cover"]');
    const coverId = metaCover?.getAttribute('content');
    if (coverId && manifestMap.has(coverId)) {
      const candidate = manifestMap.get(coverId)!;
      if (candidate.mediaType.startsWith('image/')) {
        coverHref = candidate.href;
      }
    }
  }
  if (coverHref) {
    const coverZipPath = resolveZipPath(opfDir, coverHref);
    const coverZipEntry = zip.file(coverZipPath);
    if (coverZipEntry) {
      try {
        const base64 = await coverZipEntry.async('base64');
        const ext = coverHref.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
        coverDataUrl = `data:${ext};base64,${base64}`;
      } catch {
        // Non-critical cover load error
      }
    }
  }

  // Spine chapters
  const spineRefs = Array.from(opfDoc.querySelectorAll('spine > itemref'));
  const chapters: ParsedSection[] = [];

  for (const ref of spineRefs) {
    const idref = ref.getAttribute('idref');
    if (!idref) continue;
    const entry = manifestMap.get(idref);
    if (!entry) continue;
    const isHtml =
      entry.mediaType.includes('html') ||
      entry.href.toLowerCase().endsWith('.xhtml') ||
      entry.href.toLowerCase().endsWith('.html') ||
      entry.href.toLowerCase().endsWith('.htm');
    if (!isHtml) continue;

    const fullPath = resolveZipPath(opfDir, entry.href);
    const fileEntry = zip.file(fullPath);
    if (!fileEntry) continue;

    const rawXhtml = await fileEntry.async('string');
    const htmlDoc = parser.parseFromString(rawXhtml, 'text/html');
    const heading =
      htmlDoc.querySelector('h1, h2, h3, title')?.textContent?.trim() ??
      `Capítulo ${chapters.length + 1}`;
    const safeHtml = sanitizeHtml(htmlDoc.body?.innerHTML || rawXhtml);
    const plainText = htmlToPlainText(safeHtml);

    if (plainText.length < 15 && !safeHtml.includes('<img')) continue;

    chapters.push({
      location: chapters.length + 1,
      title: heading.slice(0, 80) || `Capítulo ${chapters.length + 1}`,
      html: safeHtml,
      plainText,
    });
  }

  if (chapters.length === 0) {
    throw new Error('No se pudo extraer texto legible de este EPUB.');
  }

  return { title, author, coverDataUrl, chapters };
}

async function generatePdfThumbnail(pdfDoc: pdfjsLib.PDFDocumentProxy): Promise<string | undefined> {
  try {
    const page = await pdfDoc.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const targetWidth = 240;
    const scale = Math.min(1, targetWidth / viewport.width);
    const scaled = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(scaled.width);
    canvas.height = Math.round(scaled.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    await page.render({ canvas, canvasContext: ctx, viewport: scaled }).promise;
    return canvas.toDataURL('image/jpeg', 0.72);
  } catch {
    return undefined;
  }
}

export async function parseAndIndexDocument(
  file: File,
  bookId: string,
  onProgress?: (percent: number, stageLabel: string) => void
): Promise<DocumentImportResult> {
  const format = detectBookFormat(file.name);
  if (!format) {
    throw new Error('Formato no soportado. Usa archivos PDF, Word (.docx) o EPUB.');
  }

  onProgress?.(5, 'Leyendo archivo...');
  const arrayBuffer = await file.arrayBuffer();
  const fallbackTitle = cleanFileTitle(file.name) || 'Documento sin título';

  if (format === 'pdf') {
    onProgress?.(12, 'Abriendo PDF...');
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer.slice(0)) });
    const pdfDoc = await loadingTask.promise;

    let suggestedTitle = fallbackTitle;
    let suggestedAuthor = '';
    try {
      const meta = await pdfDoc.getMetadata();
      const info = meta.info as Record<string, unknown> | undefined;
      if (info && typeof info.Title === 'string' && info.Title.trim().length > 2) {
        suggestedTitle = info.Title.trim();
      }
      if (info && typeof info.Author === 'string' && info.Author.trim().length > 1) {
        suggestedAuthor = info.Author.trim();
      }
    } catch {
      // Metadata optional
    }

    onProgress?.(20, 'Generando portada...');
    const coverDataUrl = await generatePdfThumbnail(pdfDoc);

    const numPages = pdfDoc.numPages;
    const chunks: BookTextChunk[] = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (pageText.length > 0) {
        chunks.push({
          id: `${bookId}_loc_${pageNum}`,
          bookId,
          location: pageNum,
          locationLabel: `Pág. ${pageNum}`,
          text: pageText,
          normalizedText: normalizeText(pageText),
        });
      }

      if (pageNum % 5 === 0 || pageNum === numPages) {
        const pct = 20 + Math.round((pageNum / numPages) * 75);
        onProgress?.(pct, `Indexando página ${pageNum} de ${numPages}...`);
      }
    }

    await loadingTask.destroy();
    onProgress?.(100, '¡Listo!');

    return {
      format: 'pdf',
      suggestedTitle,
      suggestedAuthor,
      totalLocations: numPages,
      coverDataUrl,
      chunks,
      arrayBuffer,
      mimeType: file.type || 'application/pdf',
    };
  }

  if (format === 'docx') {
    onProgress?.(25, 'Procesando documento de Word (.docx)...');
    const sections = await loadDocxSections(arrayBuffer);
    onProgress?.(75, 'Indexando secciones para búsqueda offline...');

    const chunks: BookTextChunk[] = sections
      .filter((s) => s.plainText.length > 0)
      .map((s) => ({
        id: `${bookId}_loc_${s.location}`,
        bookId,
        location: s.location,
        locationLabel: s.title,
        text: s.plainText,
        normalizedText: normalizeText(s.plainText),
      }));

    onProgress?.(100, '¡Listo!');
    return {
      format: 'docx',
      suggestedTitle: fallbackTitle,
      suggestedAuthor: '',
      totalLocations: sections.length,
      chunks,
      arrayBuffer,
      mimeType:
        file.type ||
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
  }

  // EPUB
  onProgress?.(25, 'Desempaquetando libro EPUB...');
  const epub = await loadEpubDocument(arrayBuffer);
  onProgress?.(75, 'Indexando capítulos para búsqueda offline...');

  const chunks: BookTextChunk[] = epub.chapters
    .filter((ch) => ch.plainText.length > 0)
    .map((ch) => ({
      id: `${bookId}_loc_${ch.location}`,
      bookId,
      location: ch.location,
      locationLabel: ch.title,
      text: ch.plainText,
      normalizedText: normalizeText(ch.plainText),
    }));

  onProgress?.(100, '¡Listo!');
  return {
    format: 'epub',
    suggestedTitle: epub.title || fallbackTitle,
    suggestedAuthor: epub.author || '',
    totalLocations: epub.chapters.length,
    coverDataUrl: epub.coverDataUrl,
    chunks,
    arrayBuffer,
    mimeType: file.type || 'application/epub+zip',
  };
}
