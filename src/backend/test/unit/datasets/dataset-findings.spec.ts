/**
 * Mục **"Phát hiện"** (findings) — OPEN-03/04/05 (chốt 2026-11-19).
 *
 * Vì dataset **bất biến** sau khi nạp, mọi vấn đề phải được báo cáo kèm
 * **vị trí lỗi cụ thể** để người dùng tự sửa file rồi xoá & nạp lại.
 */
import { DatasetFindingService } from '../../../src/modules/datasets/application/services/dataset-finding.service';
import { makeFinding } from '../../../src/modules/datasets/domain/services/finding.util';
import type { DatasetColumn, DatasetColumnIssue } from '../../../src/modules/datasets/domain/entities/dataset.entity';

describe('Mục "Phát hiện" (findings)', () => {
  const service = new DatasetFindingService();

  const columns: DatasetColumn[] = [
    {
      key: 'c0',
      index: 0,
      name: 'Ten',
      originalName: 'Ten',
      dataType: 'string',
      missingCount: 0,
      isPii: false,
    },
    {
      key: 'c1',
      index: 1,
      name: '',
      originalName: '',
      dataType: 'string',
      missingCount: 0,
      isPii: false,
    },
  ];

  describe('fromColumnIssues', () => {
    it('chuyển lỗi tên cột rỗng thành phát hiện severity high', () => {
      const issues: DatasetColumnIssue[] = [
        { columnKey: 'c1', issue: 'empty_name', message: 'Cot c1 co ten rong' },
      ];
      const findings = service.fromColumnIssues(issues, columns);
      expect(findings).toHaveLength(1);
      expect(findings[0]).toMatchObject({
        type: 'empty_name',
        severity: 'high',
        columnKey: 'c1',
        message: 'Cot c1 co ten rong',
      });
    });

    it('chuyển lỗi tên cột trùng thành phát hiện', () => {
      const issues: DatasetColumnIssue[] = [
        { columnKey: 'c1', issue: 'duplicate_name', message: 'Ten cot bi trung' },
      ];
      const findings = service.fromColumnIssues(issues, columns);
      expect(findings[0]?.type).toBe('duplicate_name');
      expect(findings[0]?.severity).toBe('high');
    });

    it('chuyển lỗi tên cột chỉ khoảng trắng thành phát hiện', () => {
      const issues: DatasetColumnIssue[] = [
        { columnKey: 'c1', issue: 'whitespace_only', message: 'Cot c1 chi chua khoang trang' },
      ];
      expect(service.fromColumnIssues(issues, columns)[0]?.type).toBe('whitespace_only');
    });

    it('gắn tên cột khi tìm được', () => {
      const issues: DatasetColumnIssue[] = [
        { columnKey: 'c0', issue: 'duplicate_name', message: 'x' },
      ];
      expect(service.fromColumnIssues(issues, columns)[0]?.columnName).toBe('Ten');
    });

    it('columnKey null → columnName null', () => {
      const issues: DatasetColumnIssue[] = [
        { columnKey: null, issue: 'duplicate_name', message: 'x' },
      ];
      expect(service.fromColumnIssues(issues, columns)[0]?.columnName).toBeNull();
    });
  });

  describe('merge', () => {
    it('sắp xếp theo mức độ nghiêm trọng giảm dần', () => {
      const merged = service.merge([
        makeFinding('blank_row', 'low', 'a'),
        makeFinding('row_column_mismatch', 'medium', 'b'),
        makeFinding('empty_name', 'high', 'c'),
        makeFinding('blank_row', 'info', 'd'),
      ]);
      expect(merged.map((f) => f.severity)).toEqual(['high', 'medium', 'low', 'info']);
    });

    it('cùng mức độ → sắp theo dòng rồi cột', () => {
      const merged = service.merge([
        makeFinding('blank_row', 'low', 'b', { rowIndex: 5 }),
        makeFinding('blank_row', 'low', 'a', { rowIndex: 1 }),
      ]);
      expect(merged.map((f) => f.rowIndex)).toEqual([1, 5]);
    });

    it('không mutate input', () => {
      const input = [makeFinding('blank_row', 'low', 'a', { rowIndex: 5 })];
      service.merge(input);
      expect(input[0]?.rowIndex).toBe(5);
    });
  });

  describe('makeFinding', () => {
    it('điền mặc định null cho vị trí không xác định', () => {
      const f = makeFinding('blank_row', 'low', 'msg');
      expect(f).toMatchObject({
        type: 'blank_row',
        severity: 'low',
        columnKey: null,
        columnName: null,
        rowIndex: null,
        message: 'msg',
      });
    });

    it('giữ details nếu có', () => {
      const f = makeFinding('blank_row', 'low', 'msg', { details: { csvLine: 7 } });
      expect(f.details).toEqual({ csvLine: 7 });
    });

    it('không tạo key details nếu không truyền', () => {
      const f = makeFinding('blank_row', 'low', 'msg');
      expect('details' in f).toBe(false);
    });
  });
});
