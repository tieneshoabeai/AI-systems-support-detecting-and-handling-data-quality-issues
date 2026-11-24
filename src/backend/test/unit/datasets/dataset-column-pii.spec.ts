/**
 * OPEN-04 (chốt 2026-11-19) — cờ PII được **tự động suy luận** theo tên cột.
 *
 * Route `PATCH /datasets/:id/columns/pii` đã bị **xoá** (mâu thuẫn #2): hệ thống
 * "chỉ nhận dataset và phân tích" — không cho người dùng thao tác lên dataset.
 *
 * Vì vậy cờ `isPii` phải suy ra tự động ngay lúc nạp, dựa trên **heuristic tên
 * cột** (không học từ mẫu giá trị).
 */
import { SchemaInferenceService } from '../../../src/modules/datasets/application/services/schema-inference.service';
import {
  isPiiColumnName,
  normalizeColumnName,
  inferPiiFlags,
} from '../../../src/modules/datasets/domain/services/pii-heuristic.util';

describe('OPEN-04 — PII tự động theo heuristic tên cột', () => {
  const service = new SchemaInferenceService();

  describe('normalizeColumnName', () => {
    it('bỏ dấu tiếng Việt', () => {
      expect(normalizeColumnName('Họ Tên')).toBe('ho_ten');
      expect(normalizeColumnName('Số Điện Thoại')).toBe('so_dien_thoai');
    });

    it('chuẩn hoá ký tự đặc biệt thành gạch dưới', () => {
      expect(normalizeColumnName('user-email')).toBe('user_email');
      expect(normalizeColumnName('user.email')).toBe('user_email');
      expect(normalizeColumnName('  email  ')).toBe('email');
    });
  });

  describe('isPiiColumnName — khớp dương', () => {
    const piiNames = [
      'email',
      'Email',
      'e_mail',
      'user_email',
      'email_khach_hang',
      'phone',
      'phone_number',
      'sdt',
      'so_dien_thoai',
      'hoten',
      'ho_ten',
      'full_name',
      'customer_name',
      'cmnd',
      'cccd',
      'so_dinh_danh',
      'ngay_sinh',
      'dia_chi',
    ];

    it.each(piiNames)('"%s" được coi là PII', (name) => {
      expect(isPiiColumnName(name)).toBe(true);
    });
  });

  describe('isPiiColumnName — khớp âm (không phải PII)', () => {
    const nonPiiNames = [
      'company_name',
      'ten_cong_ty',
      'product_name',
      'file_name',
      'ten_file',
      'city',
      'thanh_pho',
      'department',
      'project_name',
      'table_name',
      'subject',
      'label',
      'status',
      'role',
      'so_luong',
      'doanh_thu',
      'price',
      'quantity',
      'id',
      'user_id',
      'order_id',
    ];

    it.each(nonPiiNames)('"%s" KHÔNG được coi là PII', (name) => {
      expect(isPiiColumnName(name)).toBe(false);
    });
  });

  describe('isPiiColumnName — biên', () => {
    it('tên rỗng → false', () => {
      expect(isPiiColumnName('')).toBe(false);
      expect(isPiiColumnName('   ')).toBe(false);
    });

    it('chỉ khoảng trắng/dấu → false', () => {
      expect(isPiiColumnName('___')).toBe(false);
    });
  });

  describe('inferPiiFlags', () => {
    it('gán cờ theo tên gốc, không mutate input', () => {
      const input = [
        { name: 'Email', originalName: 'Email', isPii: false },
        { name: 'Doanh thu', originalName: 'Doanh thu', isPii: false },
      ];
      const out = inferPiiFlags(input);
      expect(out[0]?.isPii).toBe(true);
      expect(out[1]?.isPii).toBe(false);
      expect(input[0]?.isPii).toBe(false); // input không bị mutate
    });

    it('ưu tiên tên gốc khi có', () => {
      const out = inferPiiFlags([{ name: 'x', originalName: 'email', isPii: false }]);
      expect(out[0]?.isPii).toBe(true);
    });
  });

  describe('SchemaInferenceService — tích hợp', () => {
    it('suy schema gắn cờ PII tự động', () => {
      const { columns } = service.inferSchemaWithIssues(
        ['email', 'doanh_thu', 'ho_ten'],
        [{ email: 'a@b.c', doanh_thu: '100', ho_ten: 'Nguyen' }],
      );
      expect(columns.find((c) => c.name === 'email')?.isPii).toBe(true);
      expect(columns.find((c) => c.name === 'ho_ten')?.isPii).toBe(true);
      expect(columns.find((c) => c.name === 'doanh_thu')?.isPii).toBe(false);
    });

    it('inferSchema() cũng trả về cờ PII đã suy', () => {
      const columns = service.inferSchema(['cmnd'], []);
      expect(columns[0]?.isPii).toBe(true);
    });
  });
});
