/**
 * PDF nhi phan toi thieu (PDF 1.4, khong phu thuoc thu vien ngoai) cho REPORT-01.
 *
 * Hai che do font (Phan 2 v10 muc 3.41 — PDF FULL, tieng Viet co dau):
 * - Unicode: nhung font TrueType (`REPORT_FONT_PATH`, vd DejaVu Sans / Noto Sans) dang
 *   Type0 + CIDFontType2, Identity-H, kem ToUnicode de copy/tim kiem duoc chu.
 * - ASCII (du phong khi khong co font): Helvetica WinAnsi, bo dau tieng Viet nhu truoc.
 */
import * as zlib from 'zlib';

// ---------------------------------------------------------------------------
// TrueType parser (chi doc cac bang can thiet: head, hhea, hmtx, cmap)
// ---------------------------------------------------------------------------

export interface TrueTypeFont {
  data: Buffer;
  unitsPerEm: number;
  ascent: number;
  descent: number;
  bbox: [number, number, number, number];
  advances: number[];
  glyphFor(codePoint: number): number;
}

export function parseTrueType(data: Buffer): TrueTypeFont | null {
  try {
    const sfnt = data.readUInt32BE(0);
    // 0x00010000 = TrueType outlines; 'true' (Apple). Bo qua OTF/CFF ('OTTO') va .ttc ('ttcf').
    if (sfnt !== 0x00010000 && sfnt !== 0x74727565) return null;
    const numTables = data.readUInt16BE(4);
    const tables = new Map<string, { offset: number; length: number }>();
    for (let i = 0; i < numTables; i++) {
      const rec = 12 + i * 16;
      const tag = data.toString('latin1', rec, rec + 4);
      tables.set(tag, { offset: data.readUInt32BE(rec + 8), length: data.readUInt32BE(rec + 12) });
    }
    const head = tables.get('head');
    const hhea = tables.get('hhea');
    const hmtx = tables.get('hmtx');
    const cmap = tables.get('cmap');
    const maxp = tables.get('maxp');
    if (!head || !hhea || !hmtx || !cmap || !maxp || !tables.has('glyf')) return null;

    const unitsPerEm = data.readUInt16BE(head.offset + 18);
    const bbox: [number, number, number, number] = [
      data.readInt16BE(head.offset + 36),
      data.readInt16BE(head.offset + 38),
      data.readInt16BE(head.offset + 40),
      data.readInt16BE(head.offset + 42),
    ];
    const ascent = data.readInt16BE(hhea.offset + 4);
    const descent = data.readInt16BE(hhea.offset + 6);
    const numHMetrics = data.readUInt16BE(hhea.offset + 34);
    const numGlyphs = data.readUInt16BE(maxp.offset + 4);
    const advances: number[] = [];
    for (let g = 0; g < numGlyphs; g++) {
      const idx = Math.min(g, numHMetrics - 1);
      advances.push(data.readUInt16BE(hmtx.offset + idx * 4));
    }

    // cmap: uu tien (3,10) format 12, sau do (3,1)/(0,*) format 4
    const nSub = data.readUInt16BE(cmap.offset + 2);
    let fmt12: number | null = null;
    let fmt4: number | null = null;
    for (let i = 0; i < nSub; i++) {
      const rec = cmap.offset + 4 + i * 8;
      const platform = data.readUInt16BE(rec);
      const encoding = data.readUInt16BE(rec + 2);
      const sub = cmap.offset + data.readUInt32BE(rec + 4);
      const format = data.readUInt16BE(sub);
      if (format === 12 && (platform === 3 || platform === 0)) fmt12 = sub;
      if (format === 4 && ((platform === 3 && encoding === 1) || platform === 0)) fmt4 ??= sub;
    }
    if (fmt12 === null && fmt4 === null) return null;

    const cache = new Map<number, number>();
    const lookup12 = (cp: number): number => {
      const base = fmt12 as number;
      const nGroups = data.readUInt32BE(base + 12);
      let lo = 0;
      let hi = nGroups - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const g = base + 16 + mid * 12;
        const start = data.readUInt32BE(g);
        const end = data.readUInt32BE(g + 4);
        if (cp < start) hi = mid - 1;
        else if (cp > end) lo = mid + 1;
        else return data.readUInt32BE(g + 8) + (cp - start);
      }
      return 0;
    };
    const lookup4 = (cp: number): number => {
      if (cp > 0xffff) return 0;
      const base = fmt4 as number;
      const segX2 = data.readUInt16BE(base + 6);
      const endCodes = base + 14;
      const startCodes = endCodes + segX2 + 2;
      const idDeltas = startCodes + segX2;
      const idRangeOffsets = idDeltas + segX2;
      for (let i = 0; i < segX2 / 2; i++) {
        const end = data.readUInt16BE(endCodes + i * 2);
        if (cp > end) continue;
        const start = data.readUInt16BE(startCodes + i * 2);
        if (cp < start) return 0;
        const delta = data.readInt16BE(idDeltas + i * 2);
        const roPos = idRangeOffsets + i * 2;
        const ro = data.readUInt16BE(roPos);
        if (ro === 0) return (cp + delta) & 0xffff;
        const gPos = roPos + ro + (cp - start) * 2;
        const g = data.readUInt16BE(gPos);
        return g === 0 ? 0 : (g + delta) & 0xffff;
      }
      return 0;
    };
    const glyphFor = (cp: number): number => {
      const hit = cache.get(cp);
      if (hit !== undefined) return hit;
      const g = fmt12 !== null ? lookup12(cp) : lookup4(cp);
      const safe = g < numGlyphs ? g : 0;
      cache.set(cp, safe);
      return safe;
    };
    return { data, unitsPerEm, ascent, descent, bbox, advances, glyphFor };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Font adapter (Unicode TTF hoac Helvetica ASCII)
// ---------------------------------------------------------------------------

function stripVietnamese(s: string): string {
  return s
    .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, 'a')
    .replace(/[ÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴ]/g, 'A')
    .replace(/[èéẹẻẽêềếệểễ]/g, 'e')
    .replace(/[ÈÉẸẺẼÊỀẾỆỂỄ]/g, 'E')
    .replace(/[ìíịỉĩ]/g, 'i')
    .replace(/[ÌÍỊỈĨ]/g, 'I')
    .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, 'o')
    .replace(/[ÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠ]/g, 'O')
    .replace(/[ùúụủũưừứựửữ]/g, 'u')
    .replace(/[ÙÚỤỦŨƯỪỨỰỬỮ]/g, 'U')
    .replace(/[ỳýỵỷỹ]/g, 'y')
    .replace(/[ỲÝỴỶỸ]/g, 'Y')
    .replace(/[đ]/g, 'd')
    .replace(/[Đ]/g, 'D');
}

interface FontAdapter {
  unicode: boolean;
  /** Do rong chuoi (pt) o co chu `size`. */
  width(text: string, size: number): number;
  /** Toan tu hien thi chuoi, vd `(abc) Tj` hoac `<0012> Tj`. */
  show(text: string): string;
}

function asciiFont(): FontAdapter {
  const norm = (s: string): string =>
    stripVietnamese(String(s ?? ''))
      .replace(/[—–]/g, '-')
      .replace(/…/g, '...')
      .replace(/·/g, '|')
      .replace(/•/g, '-')
      .replace(/η²/g, 'eta2')
      .replace(/²/g, '2')
      .replace(/≥/g, '>=')
      .replace(/≤/g, '<=')
      .replace(/×/g, 'x')
      .replace(/[“”]/g, '"')
      .replace(/[^\x20-\x7E]/g, '?');
  return {
    unicode: false,
    // Helvetica trung binh ~0.52 em
    width: (text, size) => norm(text).length * size * 0.52,
    show: (text) =>
      `(${norm(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')}) Tj`,
  };
}

function unicodeFont(ttf: TrueTypeFont, used: Map<number, number>): FontAdapter {
  const gids = (text: string): number[] => {
    const out: number[] = [];
    for (const ch of String(text ?? '').normalize('NFC')) {
      const cp = ch.codePointAt(0) as number;
      if (cp < 0x20) continue;
      let g = ttf.glyphFor(cp);
      if (g === 0) g = ttf.glyphFor(0x3f); // '?' khi font thieu glyph
      if (!used.has(g)) used.set(g, cp);
      out.push(g);
    }
    return out;
  };
  return {
    unicode: true,
    width: (text, size) => {
      let w = 0;
      for (const g of gids(text)) w += ttf.advances[g] ?? 0;
      return (w * size) / ttf.unitsPerEm;
    },
    show: (text) => `<${gids(text).map((g) => g.toString(16).padStart(4, '0')).join('')}> Tj`,
  };
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export interface PdfTable {
  headers: string[];
  rows: string[][];
  /** Ti le do rong tung cot (tong ~1). Mac dinh chia deu. */
  widths?: number[];
}

export interface PdfSection {
  heading: string;
  lines?: string[];
  table?: PdfTable;
}

export interface BuildReportPdfOptions {
  title: string;
  sections: PdfSection[];
  /** Noi dung file TTF. Thieu/khong hop le -> che do ASCII. */
  font?: Buffer | null;
  generatedAt?: Date;
  footer?: string;
}

const W = 595; // A4 pt
const H = 842;
const MARGIN = 48;
const TITLE_SIZE = 16;
const HEAD_SIZE = 12;
const BODY_SIZE = 9;
const TABLE_SIZE = 8;
const LEAD = 13;
const TABLE_LEAD = 11;

export function buildReportPdf(opts: BuildReportPdfOptions): Buffer {
  const ttf = opts.font ? parseTrueType(opts.font) : null;
  const used = new Map<number, number>();
  const font = ttf ? unicodeFont(ttf, used) : asciiFont();
  const textWidth = W - 2 * MARGIN;

  const pages: string[][] = [];
  let cur: string[] = [];
  let y = H - MARGIN;

  const newPage = (): void => {
    pages.push(cur);
    cur = [];
    y = H - MARGIN;
  };
  const ensure = (need: number): boolean => {
    if (y - need < MARGIN + 16) {
      newPage();
      return true;
    }
    return false;
  };
  const textAt = (x: number, yy: number, text: string, size: number, bold = false): void => {
    // Unicode: gia lap dam bang fill+stroke (1 font nhung); ASCII: Helvetica-Bold
    if (font.unicode) {
      const mode = bold ? `2 Tr ${(size * 0.03).toFixed(2)} w` : '0 Tr';
      cur.push(`BT /F1 ${size} Tf ${mode} ${x.toFixed(1)} ${yy.toFixed(1)} Td ${font.show(text)} ET`);
    } else {
      cur.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x.toFixed(1)} ${yy.toFixed(1)} Td ${font.show(text)} ET`);
    }
  };
  const wrap = (text: string, size: number, maxW: number): string[] => {
    const out: string[] = [];
    let line = '';
    for (const word of String(text ?? '').split(/\s+/)) {
      if (!word) continue;
      const cand = line ? `${line} ${word}` : word;
      if (font.width(cand, size) <= maxW) {
        line = cand;
        continue;
      }
      if (line) out.push(line);
      // tu qua dai -> cat cung theo ky tu
      let rest = word;
      while (font.width(rest, size) > maxW && rest.length > 1) {
        let n = rest.length;
        while (n > 1 && font.width(rest.slice(0, n), size) > maxW) n--;
        out.push(rest.slice(0, n));
        rest = rest.slice(n);
      }
      line = rest;
    }
    if (line) out.push(line);
    return out.length > 0 ? out : [''];
  };
  const fit = (text: string, size: number, maxW: number): string => {
    if (font.width(text, size) <= maxW) return text;
    let n = text.length;
    while (n > 0 && font.width(`${text.slice(0, n)}…`, size) > maxW) n--;
    return font.unicode ? `${text.slice(0, n)}…` : `${text.slice(0, Math.max(0, n - 1))}..`;
  };
  const para = (text: string, size: number, bold = false, gapAfter = 0): void => {
    for (const ln of wrap(text, size, textWidth)) {
      ensure(LEAD);
      textAt(MARGIN, y, ln, size, bold);
      y -= LEAD;
    }
    y -= gapAfter;
  };
  const table = (t: PdfTable): void => {
    const n = Math.max(1, t.headers.length);
    const fr = t.widths && t.widths.length === n ? t.widths : new Array(n).fill(1 / n);
    const total = fr.reduce((a, b) => a + b, 0) || 1;
    const colW = fr.map((f) => (f / total) * textWidth);
    const xs: number[] = [];
    let acc = MARGIN;
    for (const w of colW) {
      xs.push(acc);
      acc += w;
    }
    const drawHeader = (): void => {
      t.headers.forEach((h, i) => textAt(xs[i] as number, y, fit(h, TABLE_SIZE, (colW[i] as number) - 4), TABLE_SIZE, true));
      cur.push(`0.5 w ${MARGIN} ${(y - 3).toFixed(1)} m ${W - MARGIN} ${(y - 3).toFixed(1)} l S`);
      y -= TABLE_LEAD + 2;
    };
    ensure(TABLE_LEAD * 2);
    drawHeader();
    if (t.rows.length === 0) {
      textAt(MARGIN, y, '(không có dữ liệu)', TABLE_SIZE);
      y -= TABLE_LEAD;
    }
    for (const row of t.rows) {
      if (ensure(TABLE_LEAD)) drawHeader();
      row.slice(0, n).forEach((c, i) => textAt(xs[i] as number, y, fit(String(c ?? ''), TABLE_SIZE, (colW[i] as number) - 4), TABLE_SIZE));
      y -= TABLE_LEAD;
    }
  };

  para(opts.title, TITLE_SIZE, true, 6);
  para(`Ngày sinh: ${(opts.generatedAt ?? new Date()).toISOString()}`, BODY_SIZE, false, 8);
  for (const sec of opts.sections) {
    ensure(LEAD * 3);
    para(sec.heading, HEAD_SIZE, true, 2);
    const lines = sec.lines ?? [];
    if (lines.length === 0 && !sec.table) para('(không có dữ liệu)', BODY_SIZE);
    for (const ln of lines) para(ln, BODY_SIZE);
    if (sec.table) {
      if (lines.length > 0) y -= 4;
      table(sec.table);
    }
    y -= 10;
  }
  para(opts.footer ?? 'Hệ thống chỉ phát hiện và báo cáo — không tự sửa dữ liệu tại nguồn.', BODY_SIZE);
  pages.push(cur);

  // So trang o chan trang
  const pageCount = pages.length;
  pages.forEach((p, i) => {
    const label = `Trang ${i + 1}/${pageCount}`;
    const x = W - MARGIN - font.width(label, 8);
    cur = p;
    textAt(x, MARGIN - 20, label, 8);
  });

  return assemble(pages, ttf, used);
}

// ---------------------------------------------------------------------------
// Ghi file PDF (nhi phan)
// ---------------------------------------------------------------------------

function toUnicodeCMap(used: Map<number, number>): string {
  const entries = [...used.entries()].sort((a, b) => a[0] - b[0]);
  const hex4 = (n: number): string => n.toString(16).padStart(4, '0');
  const utf16 = (cp: number): string => {
    if (cp <= 0xffff) return hex4(cp);
    const v = cp - 0x10000;
    return hex4(0xd800 + (v >> 10)) + hex4(0xdc00 + (v & 0x3ff));
  };
  const chunks: string[] = [];
  for (let i = 0; i < entries.length; i += 100) {
    const part = entries.slice(i, i + 100);
    chunks.push(`${part.length} beginbfchar\n${part.map(([g, cp]) => `<${hex4(g)}> <${utf16(cp)}>`).join('\n')}\nendbfchar`);
  }
  return [
    '/CIDInit /ProcSet findresource begin',
    '12 dict begin',
    'begincmap',
    '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def',
    '/CMapName /Adobe-Identity-UCS def',
    '/CMapType 2 def',
    '1 begincodespacerange',
    '<0000> <FFFF>',
    'endcodespacerange',
    ...chunks,
    'endcmap',
    'CMapName currentdict /CMap defineresource pop',
    'end',
    'end',
  ].join('\n');
}

function assemble(pages: string[][], ttf: TrueTypeFont | null, used: Map<number, number>): Buffer {
  const objs = new Map<number, Buffer>();
  const put = (n: number, dict: string, stream?: Buffer): void => {
    if (stream) {
      objs.set(n, Buffer.concat([
        Buffer.from(`${n} 0 obj\n${dict}\nstream\n`, 'latin1'),
        stream,
        Buffer.from('\nendstream\nendobj\n', 'latin1'),
      ]));
    } else {
      objs.set(n, Buffer.from(`${n} 0 obj\n${dict}\nendobj\n`, 'latin1'));
    }
  };
  const flate = (b: Buffer): Buffer => zlib.deflateSync(b);

  // 1 Catalog, 2 Pages, 3..: font objects, sau do trang + noi dung
  let next = 3;
  let fontRes: string;
  if (ttf) {
    const type0 = next++;
    const cid = next++;
    const desc = next++;
    const file = next++;
    const tou = next++;
    const scale = 1000 / ttf.unitsPerEm;
    const widths = [...used.keys()]
      .sort((a, b) => a - b)
      .map((g) => `${g} [${Math.round((ttf.advances[g] ?? 0) * scale)}]`)
      .join(' ');
    const [x0, y0, x1, y1] = ttf.bbox.map((v) => Math.round(v * scale));
    const fontData = flate(ttf.data);
    put(type0, `<< /Type /Font /Subtype /Type0 /BaseFont /ReportFont /Encoding /Identity-H /DescendantFonts [${cid} 0 R] /ToUnicode ${tou} 0 R >>`);
    put(cid, `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /ReportFont /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${desc} 0 R /DW 1000 /W [${widths}] /CIDToGIDMap /Identity >>`);
    put(desc, `<< /Type /FontDescriptor /FontName /ReportFont /Flags 32 /FontBBox [${x0} ${y0} ${x1} ${y1}] /ItalicAngle 0 /Ascent ${Math.round(ttf.ascent * scale)} /Descent ${Math.round(ttf.descent * scale)} /CapHeight ${Math.round(ttf.ascent * scale)} /StemV 80 /FontFile2 ${file} 0 R >>`);
    put(file, `<< /Length ${fontData.length} /Length1 ${ttf.data.length} /Filter /FlateDecode >>`, fontData);
    const cmap = flate(Buffer.from(toUnicodeCMap(used), 'latin1'));
    put(tou, `<< /Length ${cmap.length} /Filter /FlateDecode >>`, cmap);
    fontRes = `/F1 ${type0} 0 R`;
  } else {
    const f1 = next++;
    const f2 = next++;
    put(f1, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    put(f2, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    fontRes = `/F1 ${f1} 0 R /F2 ${f2} 0 R`;
  }

  const pageNums: number[] = [];
  for (const p of pages) {
    const pageNum = next++;
    const contentNum = next++;
    pageNums.push(pageNum);
    const content = flate(Buffer.from(p.join('\n'), 'latin1'));
    put(contentNum, `<< /Length ${content.length} /Filter /FlateDecode >>`, content);
    put(pageNum, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << ${fontRes} >> >> /Contents ${contentNum} 0 R >>`);
  }
  put(1, '<< /Type /Catalog /Pages 2 0 R >>');
  put(2, `<< /Type /Pages /Kids [${pageNums.map((n) => `${n} 0 R`).join(' ')}] /Count ${pageNums.length} >>`);

  const parts: Buffer[] = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')];
  let offset = parts[0]!.length;
  const maxObj = next - 1;
  const offsets: number[] = [];
  for (let n = 1; n <= maxObj; n++) {
    const b = objs.get(n);
    if (!b) continue;
    offsets[n] = offset;
    parts.push(b);
    offset += b.length;
  }
  let xref = `xref\n0 ${maxObj + 1}\n0000000000 65535 f \n`;
  for (let n = 1; n <= maxObj; n++) {
    xref += offsets[n] !== undefined ? `${String(offsets[n]).padStart(10, '0')} 00000 n \n` : '0000000000 65535 f \n';
  }
  xref += `trailer\n<< /Size ${maxObj + 1} /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF`;
  parts.push(Buffer.from(xref, 'latin1'));
  return Buffer.concat(parts);
}
