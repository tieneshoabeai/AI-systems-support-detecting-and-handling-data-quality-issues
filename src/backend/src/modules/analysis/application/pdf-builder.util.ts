/**
 * PDF nhi phan toi thieu (PDF 1.4, khong phu thuoc thu vien ngoai).
 * Du de doc bang moi trinh doc PDF, dung cho REPORT-01.
 * Hoi ve font Helvetica WinAnsi — chi ASCII + thay the dau tieng Viet.
 */

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

function toPdfText(s: string): string {
  const ascii = stripVietnamese(String(s ?? ''));
  return ascii
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7E]/g, '?')
    .slice(0, 1000);
}

export interface PdfSection {
  heading: string;
  lines: string[];
}

export function buildReportPdf(opts: { title: string; sections: PdfSection[] }): Buffer {
  const W = 595; // A4 width pt
  const H = 842; // A4 height pt
  const MARGIN = 48;
  const TITLE_SIZE = 16;
  const HEAD_SIZE = 12;
  const BODY_SIZE = 9;
  const LEAD = 13;

  const pages: string[][] = [];
  let cur: string[] = [];
  let y = H - MARGIN;

  const push = (text: string, size: number, opts2?: { bold?: boolean; gapAfter?: number }) => {
    const need = (opts2?.gapAfter ?? 0) + LEAD;
    if (y - need < MARGIN) {
      pages.push(cur);
      cur = [];
      y = H - MARGIN;
    }
    const x = MARGIN;
    const op = opts2?.bold ? 'BT /F2' : 'BT /F1';
    cur.push(`${op} ${size} Tf ${x} ${y.toFixed(1)} Td (${toPdfText(text)}) Tj ET`);
    y -= LEAD + (opts2?.gapAfter ?? 0);
  };

  push(opts.title, TITLE_SIZE, { bold: true, gapAfter: 6 });
  push(`Ngay sinh: ${new Date().toISOString()}`, BODY_SIZE, { gapAfter: 8 });
  for (const sec of opts.sections) {
    push(sec.heading, HEAD_SIZE, { bold: true, gapAfter: 2 });
    if (sec.lines.length === 0) push('(khong co du lieu)', BODY_SIZE);
    for (const ln of sec.lines) {
      // cat dong dai thanh nhieu dong PDF
      let rest = ln;
      while (rest.length > 110) {
        push(rest.slice(0, 110), BODY_SIZE);
        rest = rest.slice(110);
      }
      push(rest, BODY_SIZE);
    }
    y -= 8;
    if (y < MARGIN + LEAD) {
      pages.push(cur);
      cur = [];
      y = H - MARGIN;
    }
  }
  push('He thong chi phat hien va bao cao - khong tu sua du lieu tai nguon.', BODY_SIZE, { gapAfter: 0 });
  pages.push(cur);

  const objects: string[] = [];
  // 1: Catalog, 2: Pages, fonts 3 (regular) 4 (bold)
  const pageCount = pages.length;
  const pageObjNums: number[] = [];
  let nextObj = 5;
  const contentObjNums: number[] = [];
  for (let i = 0; i < pageCount; i++) {
    pageObjNums.push(nextObj++);
    contentObjNums.push(nextObj++);
  }
  const kids = pageObjNums.map((n) => `${n} 0 R`).join(' ');

  objects[1] = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
  objects[2] = `2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>\nendobj\n`;
  objects[3] = `3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`;
  objects[4] = `4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n`;

  for (let i = 0; i < pageCount; i++) {
    const content = pages[i].join('\n');
    const len = Buffer.byteLength(content, 'utf-8');
    objects[contentObjNums[i]] =
      `${contentObjNums[i]} 0 obj\n<< /Length ${len} >>\nstream\n${content}\nendstream\nendobj\n`;
    objects[pageObjNums[i]] =
      `${pageObjNums[i]} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjNums[i]} 0 R >>\nendobj\n`;
  }

  const header = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  let out = header;
  const offsets: number[] = [];
  const maxObj = Math.max(...pageObjNums, ...contentObjNums, 4);
  for (let n = 1; n <= maxObj; n++) {
    if (!objects[n]) continue;
    offsets[n] = Buffer.byteLength(out, 'utf-8');
    out += objects[n];
  }
  const xrefPos = Buffer.byteLength(out, 'utf-8');
  const size = maxObj + 1;
  out += `xref\n0 ${size}\n`;
  out += `0000000000 65535 f \n`;
  for (let n = 1; n <= maxObj; n++) {
    if (!objects[n]) {
      out += `0000000000 00000 f \n`;
      continue;
    }
    out += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  return Buffer.from(out, 'utf-8');
}
