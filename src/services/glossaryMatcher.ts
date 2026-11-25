import type { pdfjsLib } from './documentParser';
import type { GlossaryTerm } from '../types/models';
import { normalizeText } from '../utils/text';

export interface PdfGlossaryHit {
  id: string;
  term: GlossaryTerm;
  matchedText: string;
  /** Normalized 0..1 coordinates relative to PDF page size */
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CompiledGlossaryEntry {
  term: GlossaryTerm;
  /** Candidate normalized phrases (e.g. "usucapion", "prescripcion positiva") */
  variants: string[];
}

/**
 * Extracts clean searchable term variants from a GlossaryTerm
 * e.g. "Usucapión (Prescripción Positiva)" -> ["usucapion", "prescripcion positiva"]
 */
function compileGlossary(glossary: GlossaryTerm[]): CompiledGlossaryEntry[] {
  const entries: CompiledGlossaryEntry[] = [];

  for (const term of glossary) {
    const raw = term.term.trim();
    if (raw.length < 4) continue;

    const variants = new Set<string>();
    const mainWithoutParens = raw.replace(/\([^)]*\)/g, '').trim();
    if (mainWithoutParens.length >= 4) {
      variants.add(normalizeText(mainWithoutParens));
    }

    // Also include parenthetical synonyms like "(Prescripción Positiva)"
    const parenMatches = raw.match(/\(([^)]+)\)/g);
    if (parenMatches) {
      for (const pm of parenMatches) {
        const inside = pm.slice(1, -1).trim();
        if (inside.length >= 5) {
          variants.add(normalizeText(inside));
        }
      }
    }

    // Also handle "A quo / Ad quem"
    if (mainWithoutParens.includes('/')) {
      for (const part of mainWithoutParens.split('/')) {
        const clean = part.trim();
        if (clean.length >= 4) variants.add(normalizeText(clean));
      }
    }

    const list = Array.from(variants).filter((v) => v.length >= 4);
    if (list.length > 0) {
      entries.push({ term, variants: list });
    }
  }

  // Sort longest variants first so specific phrases ("juicio de amparo") win over shorter ones
  entries.sort((a, b) => {
    const maxA = Math.max(...a.variants.map((v) => v.length));
    const maxB = Math.max(...b.variants.map((v) => v.length));
    return maxB - maxA;
  });

  return entries;
}

function isWordBoundary(text: string, start: number, end: number): boolean {
  const before = start > 0 ? text[start - 1] : ' ';
  const after = end < text.length ? text[end] : ' ';
  const isWordChar = (ch: string) => /[\p{L}\p{N}]/u.test(ch);
  return !isWordChar(before) && !isWordChar(after);
}

/**
 * Annotates sanitized DOCX/EPUB HTML with subtle <span class="glossary-hit" data-glossary-id="...">
 * marks for words/phrases that exist in the user's glossary.
 */
export function annotateHtmlWithGlossary(rawHtml: string, glossary: GlossaryTerm[]): string {
  if (!rawHtml || glossary.length === 0) return rawHtml;

  const compiled = compileGlossary(glossary);
  if (compiled.length === 0) return rawHtml;

  // Flatten into ordered pattern list (longest first)
  const patterns: { norm: string; term: GlossaryTerm }[] = [];
  for (const entry of compiled) {
    for (const v of entry.variants) {
      patterns.push({ norm: v, term: entry.term });
    }
  }
  patterns.sort((a, b) => b.norm.length - a.norm.length);

  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, 'text/html');

  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let current: Node | null;
  while ((current = walker.nextNode())) {
    const parentTag = current.parentElement?.tagName;
    if (parentTag && ['SCRIPT', 'STYLE', 'CODE', 'PRE'].includes(parentTag)) continue;
    if ((current.textContent ?? '').trim().length >= 4) {
      textNodes.push(current as Text);
    }
  }

  for (const textNode of textNodes) {
    const original = textNode.textContent ?? '';
    const norm = normalizeText(original);
    if (norm.length !== original.length) {
      // Skip rare unicode length-shifting strings to keep slice indices exact
      continue;
    }

    const matches: { start: number; end: number; term: GlossaryTerm }[] = [];

    for (const p of patterns) {
      let searchFrom = 0;
      while (searchFrom < norm.length) {
        const idx = norm.indexOf(p.norm, searchFrom);
        if (idx === -1) break;
        const end = idx + p.norm.length;

        if (isWordBoundary(norm, idx, end)) {
          const overlaps = matches.some((m) => !(end <= m.start || idx >= m.end));
          if (!overlaps) {
            matches.push({ start: idx, end, term: p.term });
          }
        }
        searchFrom = end;
      }
    }

    if (matches.length === 0) continue;

    matches.sort((a, b) => a.start - b.start);
    const frag = doc.createDocumentFragment();
    let cursor = 0;

    for (const m of matches) {
      if (m.start > cursor) {
        frag.appendChild(doc.createTextNode(original.slice(cursor, m.start)));
      }
      const span = doc.createElement('span');
      span.className = 'glossary-hit';
      span.setAttribute('data-glossary-id', m.term.id);
      span.textContent = original.slice(m.start, m.end);
      frag.appendChild(span);
      cursor = m.end;
    }

    if (cursor < original.length) {
      frag.appendChild(doc.createTextNode(original.slice(cursor)));
    }

    textNode.parentNode?.replaceChild(frag, textNode);
  }

  return doc.body.innerHTML;
}

/**
 * Extracts exact normalized overlay rectangles on a PDF page for words/phrases found in the Glossary!
 * Uses PDF.js text item transforms so hovering over a glossary term on a PDF page shows its definition.
 */
export async function extractPdfGlossaryHits(
  page: pdfjsLib.PDFPageProxy,
  glossary: GlossaryTerm[]
): Promise<PdfGlossaryHit[]> {
  if (glossary.length === 0) return [];

  const compiled = compileGlossary(glossary);
  if (compiled.length === 0) return [];

  const patterns: { norm: string; term: GlossaryTerm }[] = [];
  for (const entry of compiled) {
    for (const v of entry.variants) {
      patterns.push({ norm: v, term: entry.term });
    }
  }
  patterns.sort((a, b) => b.norm.length - a.norm.length);

  const viewport = page.getViewport({ scale: 1 });
  const pageWidth = viewport.width || 1;
  const pageHeight = viewport.height || 1;

  const textContent = await page.getTextContent();
  const hits: PdfGlossaryHit[] = [];

  for (let i = 0; i < textContent.items.length; i++) {
    const item = textContent.items[i];
    if (!('str' in item) || !item.str || item.str.trim().length < 4) continue;

    const str = item.str;
    const norm = normalizeText(str);
    if (norm.length !== str.length) continue;

    // PDF coordinate space has origin at bottom-left; transform[4]=x, transform[5]=y
    const tx = item.transform[4];
    const ty = item.transform[5];
    const fontHeight = Math.hypot(item.transform[2], item.transform[3]) || item.height || 11;
    const itemWidth = item.width || str.length * (fontHeight * 0.5);

    const matchedRanges: { start: number; end: number; term: GlossaryTerm }[] = [];

    for (const p of patterns) {
      let searchFrom = 0;
      while (searchFrom < norm.length) {
        const idx = norm.indexOf(p.norm, searchFrom);
        if (idx === -1) break;
        const end = idx + p.norm.length;
        if (isWordBoundary(norm, idx, end)) {
          const overlaps = matchedRanges.some((m) => !(end <= m.start || idx >= m.end));
          if (!overlaps) {
            matchedRanges.push({ start: idx, end, term: p.term });
          }
        }
        searchFrom = end;
      }
    }

    for (const m of matchedRanges) {
      const startRatio = m.start / Math.max(1, str.length);
      const lenRatio = (m.end - m.start) / Math.max(1, str.length);

      const boxX = (tx + itemWidth * startRatio) / pageWidth;
      const boxW = (itemWidth * lenRatio) / pageWidth;
      const boxH = (fontHeight * 1.18) / pageHeight;
      const boxY = 1 - (ty + fontHeight * 0.92) / pageHeight;

      if (boxX >= 0 && boxY >= 0 && boxW > 0.005 && boxH > 0.005 && boxX <= 1 && boxY <= 1) {
        hits.push({
          id: `pdfgl_${i}_${m.start}_${m.term.id}`,
          term: m.term,
          matchedText: str.slice(m.start, m.end),
          x: Math.max(0, Math.min(0.98, boxX)),
          y: Math.max(0, Math.min(0.98, boxY)),
          width: Math.min(1 - Math.max(0, boxX), boxW),
          height: Math.min(0.08, boxH),
        });
      }
    }

    if (hits.length >= 65) break;
  }

  return hits;
}
