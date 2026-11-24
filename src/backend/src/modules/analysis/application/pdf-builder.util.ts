/**
 * PDF builder — sinh báo cáo Tổng kết (REPORT-01).
 *
 * ## Vì sao dùng PDFKit + font nhúng
 *
 * Bản đầu tiên tự dựng PDF 1.4 thủ công với font `Helvetica` (WinAnsi).
 * Hệ quả: **tiếng Việt mất dấu** (`Nguyễn` → `Nguyên`, `đ` → `d`), vì
 * WinAnsi không có glyph cho dấu than/khứ/dấu nặng. Với hệ thống báo cáo
 * chất lượng dữ liệu tiếng Việt, đó là lỗi nghiêm trọng — báo cáo tải về
 * không đọc được nội dung.
 *
 * Nay dùng `pdfkit` + nhúng font `DejaVuSans` (hỗ trợ đầy đủ Unicode/Vietnamese)
 * → giữ nguyên dấu tiếng Việt trong file PDF.
 *
 * ## Font
 *
 * Font được nhúng sẵn trong repo (`assets/fonts/`) để không phụ thuộc font
 * hệ thống (container/CI có thể không cài `fonts-dejavu`). Nếu đọc file font
 * thất bại → fallback về font chuẩn của PDFKit (`Helvetica`), chấp nhận mất dấu
 * thay vì crash worker.
 */
import PDFDocument from 'pdfkit';
import { existsSync } from 'node:fs';
import path from 'node:path';

/** Thư mục chứa font nhúng. */
const FONT_DIR = path.join(__dirname, '..', 'assets', 'fonts');
const FONT_REGULAR = path.join(FONT_DIR, 'DejaVuSans.ttf');
const FONT_BOLD = path.join(FONT_DIR, 'DejaVuSans-Bold.ttf');
/** Font hệ thống — dự phòng khi bản build không kèm assets. */
const SYSTEM_FONT_DIR = '/usr/share/fonts/truetype/dejavu';

/** Một bảng trong PDF (dùng cho ma trận tương quan, VIF, thống kê mô tả…). */
export interface PdfTable {
  headers: string[];
  rows: string[][];
  /** Tỉ lệ độ rộng từng cột (tổng ~1). Mặc định chia đều. */
  widths?: number[];
}

export interface PdfSection {
  heading: string;
  lines: string[];
  /** Bảng đi kèm phần nội dung (tuỳ chọn). */
  table?: PdfTable;
}

export interface BuildReportPdfOptions {
  title: string;
  sections: PdfSection[];
  /** Ngày sinh báo cáo (mặc định: hiện tại). */
  generatedAt?: Date;
  /** Chân trang (mặc định: câu thông báo bất biến dữ liệu). */
  footer?: string;
}

/** Cỡ chữ (pt). */
const FONT_SIZE = { title: 16, heading: 12, body: 9 } as const;
/** Cỡ chữ bảng (pt) — nhỏ hơn để nhiều cột vừa bề rộng trang. */
const TABLE_FONT_SIZE = 8;
/** Lề trang (pt). */
const MARGIN = 48;
/** Chiều rộng nội dung (pt) — A4 595pt trừ 2 lề. */
const CONTENT_WIDTH = 595 - MARGIN * 2;

/**
 * Nạp font TrueType có hỗ trợ tiếng Việt.
 *
 * Trả `false` nếu không đọc được (thiếu file font / bản build không kèm assets)
 * → caller fallback về font chuẩn của PDFKit.
 */
function loadVietnameseFont(doc: PDFKit.PDFDocument, bold: boolean): boolean {
  const name = bold ? 'DejaVu-Bold' : 'DejaVu';
  const candidates = [
    bold ? FONT_BOLD : FONT_REGULAR,
    path.join(SYSTEM_FONT_DIR, bold ? 'DejaVuSans-Bold.ttf' : 'DejaVuSans.ttf'),
  ];
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    try {
      doc.registerFont(name, file);
      return true;
    } catch {
      /* thử file tiếp theo */
    }
  }
  return false;
}

/** Bỏ ký tự điều khiển mà PDF không chấp nhận (giữ nguyên dấu tiếng Việt). */
function sanitize(text: string): string {
  return String(text ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/\r\n?/g, '\n')
    .trim();
}

/**
 * Vẽ bảng: tiêu đề + các dòng dữ liệu, tự co giãn độ rộng cột theo `widths`.
 *
 * Dùng toạ độ tuyệt đối (`doc.text(str, x, y, { width })`) cho từng ô →
 * các cột nằm cạnh nhau đúng ý. Ô dài hơn bề rộng cột sẽ bị cắt bằng dấu
 * `…` (PDFKit `ellipsis`) thay vì tràn sang cột bên cạnh.
 */
function renderTable(
  doc: PDFKit.PDFDocument,
  table: PdfTable,
  boldFont: string,
  regularFont: string,
): void {
  const n = Math.max(1, table.headers.length);
  const fr =
    table.widths && table.widths.length === n ? table.widths : new Array<number>(n).fill(1 / n);
  const total = fr.reduce((a, b) => a + b, 0) || 1;
  const colW = fr.map((f) => (f / total) * CONTENT_WIDTH);
  const xs: number[] = [];
  let acc = MARGIN;
  for (const w of colW) {
    xs.push(acc);
    acc += w;
  }
  const cellWidth = (i: number): number => Math.max(20, (colW[i] as number) - 4);

  // Vị trí y hiện tại — `doc.y` bị PDFKit tự cập nhật sau mỗi lệnh text,
  // nên ta tự theo dõi và cộng dồn chiều cao hàng.
  let y = doc.y;

  doc.font(boldFont).fontSize(TABLE_FONT_SIZE);
  table.headers.forEach((h, i) => {
    doc.text(sanitize(h), xs[i] as number, y, { width: cellWidth(i), align: 'left' });
  });
  y += TABLE_FONT_SIZE + 4;
  doc.y = y;

  doc.font(regularFont).fontSize(TABLE_FONT_SIZE);
  if (table.rows.length === 0) {
    doc.text(sanitize('(không có dữ liệu)'), MARGIN, y, { width: CONTENT_WIDTH, align: 'left' });
    doc.y = y + TABLE_FONT_SIZE + 2;
    return;
  }
  for (const row of table.rows) {
    const cells = row.slice(0, n);
    const heights = cells.map((c, i) =>
      doc.heightOfString(sanitize(String(c ?? '')), { width: cellWidth(i), ellipsis: true }),
    );
    const rowHeight = Math.max(TABLE_FONT_SIZE + 2, ...heights);
    cells.forEach((c, i) => {
      doc.text(sanitize(String(c ?? '')), xs[i] as number, y, {
        width: cellWidth(i),
        align: 'left',
        height: rowHeight,
        ellipsis: true,
      });
    });
    y += rowHeight;
    doc.y = y;
  }
}

/**
 * Sinh buffer PDF (bất đồng bộ — PDFKit phát sự kiện `end` bất đồng bộ).
 *
 * - Giữ nguyên dấu tiếng Việt (font Unicode nhúng sẵn).
 * - Tự động ngắt dòng theo bề rộng trang + phân trang tự động.
 */
export async function buildReportPdfAsync(opts: BuildReportPdfOptions): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
  });

  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const hasUnicode = loadVietnameseFont(doc, false);
  const hasUnicodeBold = hasUnicode && loadVietnameseFont(doc, true);
  const regular = hasUnicode ? 'DejaVu' : 'Helvetica';
  const bold = hasUnicodeBold ? 'DejaVu-Bold' : 'Helvetica-Bold';

  doc.font(regular);
  doc.fontSize(FONT_SIZE.title).font(bold).text(sanitize(opts.title), { align: 'left' });
  doc.moveDown(0.3);
  doc
    .font(regular)
    .fontSize(FONT_SIZE.body)
    .fillColor('#555555')
    .text(`Ngày sinh: ${(opts.generatedAt ?? new Date()).toISOString()}`);
  doc.fillColor('#000000');
  doc.moveDown(0.8);

  for (const sec of opts.sections) {
    doc.font(bold).fontSize(FONT_SIZE.heading).text(sanitize(sec.heading));
    doc.moveDown(0.2);
    doc.font(regular).fontSize(FONT_SIZE.body);
    const lines = sec.lines.length > 0 ? sec.lines : [];
    for (const ln of lines) {
      // `width` của PDFKit tự ngắt dòng theo bề rộng khả dụng.
      doc.text(sanitize(ln), { width: CONTENT_WIDTH, align: 'left' });
    }
    if (sec.table) {
      if (lines.length > 0) doc.moveDown(0.2);
      renderTable(doc, sec.table, bold, regular);
    } else if (lines.length === 0) {
      doc.text(sanitize('(không có dữ liệu)'), { width: CONTENT_WIDTH, align: 'left' });
    }
    doc.moveDown(0.6);
  }

  doc.moveDown(0.4);
  doc
    .font(regular)
    .fontSize(FONT_SIZE.body)
    .fillColor('#555555')
    .text(
      sanitize(
        opts.footer ??
          'Hệ thống chỉ phát hiện và báo cáo — không tự sửa dữ liệu tại nguồn.',
      ),
      { width: CONTENT_WIDTH },
    );

  doc.end();
  return done;
}
