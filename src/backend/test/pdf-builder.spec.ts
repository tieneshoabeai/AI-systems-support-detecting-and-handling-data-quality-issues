/**
 * PDF builder — kiểm thử bản PDF có thực sự giữ dấu tiếng Việt.
 *
 * Trước đây builder tự dựng PDF 1.4 với font Helvetica (WinAnsi) → mất dấu
 * tiếng Việt. Nay dùng PDFKit + font Unicode nhúng → phải xác nhận:
 *   1. File là PDF hợp lệ.
 *   2. Font được NHÚNG trong file (FontFile2) → không phụ thuộc font máy đọc.
 *   3. Nội dung tiếng Việt còn nguyên dấu khi trích xuất text.
 */
import { buildReportPdfAsync } from '../src/modules/analysis/application/pdf-builder.util';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

describe('PDF builder — giữ dấu tiếng Việt', () => {
  it('sinh file PDF hợp lệ (magic %PDF-)', async () => {
    const pdf = await buildReportPdfAsync({
      title: 'Báo cáo Tổng kết',
      sections: [{ heading: 'Tổng quan', lines: ['dòng dữ liệu'] }],
    });
    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(1000);
  });

  it('nhúng font Unicode trong file (FontFile2) → đọc được ở máy không cài font', async () => {
    const pdf = await buildReportPdfAsync({
      title: 'Báo cáo',
      sections: [{ heading: 'Mục', lines: ['nội dung'] }],
    });
    expect(pdf.includes(Buffer.from('FontFile2'))).toBe(true);
  });

  it('trích xuất text ra đúng tiếng Việt có dấu', async () => {
    const pdf = await buildReportPdfAsync({
      title: 'Báo cáo Tổng kết Chất lượng Dữ liệu',
      sections: [
        {
          heading: '1. Tổng quan',
          lines: ['Nguyễn Văn Anh', 'Độ chính xác: 87.5%', 'cột "Tuổi" bị trùng'],
        },
      ],
    });

    const dir = mkdtempSync(path.join(tmpdir(), 'pdf-test-'));
    try {
      const file = path.join(dir, 'report.pdf');
      writeFileSync(file, pdf);
      let text = '';
      try {
        text = execFileSync('pdftotext', [file, '-'], { encoding: 'utf-8' });
      } catch {
        // Không có `pdftotext` trên máy → bỏ qua assert nội dung (các assert
        // cấu trúc PDF ở trên vẫn chạy).
        return;
      }
      expect(text).toContain('Nguyễn Văn Anh');
      expect(text).toContain('Tổng kết');
      expect(text).toContain('Chất lượng');
      expect(text).toContain('Tuổi');
      // Dấu tiếng Việt KHÔNG bị mất (trước đây "Nguyễn" → "Nguyên").
      expect(text).not.toContain('Nguyễn'.replace('ễ', 'e'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('nhiều mục / nhiều trang vẫn sinh PDF hợp lệ', async () => {
    const pdf = await buildReportPdfAsync({
      title: 'Báo cáo dài',
      sections: Array.from({ length: 200 }, (_, i) => ({
        heading: `Mục ${i}`,
        lines: ['nội dung dòng 1', 'nội dung dòng 2'],
      })),
    });
    expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    // Nhiều trang → nhiều đối tượng `/Type /Page`.
    const pages = pdf.toString('latin1').match(/\/Type \/Page[^s]/g);
    expect((pages ?? []).length).toBeGreaterThan(1);
  });

  it('section rỗng vẫn sinh PDF (không crash)', async () => {
    const pdf = await buildReportPdfAsync({ title: 'Rỗng', sections: [] });
    expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });
});
