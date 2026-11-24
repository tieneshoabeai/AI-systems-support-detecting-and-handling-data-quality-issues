/**
 * B2.6 — Test tích hợp **RecordQueryRepository** trên MongoDB thật.
 *
 * Repository này chứa logic **ép kiểu phía server** (`$convert` / `$expr`) —
 * đúng thứ mà unit test với model giả không thể chứng minh:
 *   - Cột `number` lưu chuỗi ("10") vẫn so sánh & sort đúng theo số.
 *   - Cột `boolean` khớp cả `true` lẫn `"true"`.
 *   - Cột `date` so sánh được với chuỗi ngày.
 *   - Histogram cột số có 10 bucket, min/max/average đúng.
 *
 * Yêu cầu hạ tầng:
 * ```bash
 * pnpm run test:infra:up   # mongo replica set rs0 @27018
 * ```
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import {
  DatasetRecordSchema,
  type IDatasetRecord,
} from '../../src/modules/datasets/infrastructure/persistence/dataset-record.schema';
import { RecordQueryRepository } from '../../src/modules/datasets/infrastructure/persistence/record-query.repository';
import type {
  DatasetColumnRef,
  RecordQueryInput,
} from '../../src/modules/datasets/domain/ports/record-query.port';
import { detectInfra, openTestConnection } from '../helpers/test-infra';

describe('B2.6 — RecordQueryRepository trên MongoDB thật', () => {
  let conn: Connection;
  let recordModel: Model<IDatasetRecord>;
  let repo: RecordQueryRepository;

  const datasetId = new Types.ObjectId();

  const columns: DatasetColumnRef[] = [
    { key: 'c0', name: 'name', originalName: 'name', dataType: 'string' },
    { key: 'c1', name: 'age', originalName: 'age', dataType: 'number' },
    { key: 'c2', name: 'active', originalName: 'active', dataType: 'boolean' },
    { key: 'c3', name: 'joined', originalName: 'joined', dataType: 'date' },
  ];

  const insert = async (
    rowIndex: number,
    props: Record<string, unknown>,
  ): Promise<void> => {
    await recordModel.create({
      dataset_id: datasetId,
      row_index: rowIndex,
      props,
      created_at: new Date(),
      updated_at: new Date(),
    });
  };

  beforeAll(async () => {
    const infra = await detectInfra();
    if (!infra.mongo) {
      throw new Error(
        '[B2.6] Thiếu hạ tầng test: MongoDB chưa sẵn sàng. Chạy `pnpm run test:infra:up` trước.',
      );
    }
    conn = await openTestConnection();

    recordModel = conn.model(
      'DatasetRecord',
      DatasetRecordSchema,
    ) as unknown as Model<IDatasetRecord>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: getConnectionToken(), useValue: conn },
        { provide: 'DatasetRecordModel', useValue: recordModel },
        RecordQueryRepository,
      ],
    }).compile();

    repo = module.get(RecordQueryRepository);
  }, 30000);

  afterAll(async () => {
    if (conn) await conn.close().catch(() => undefined);
  });

  beforeEach(async () => {
    await recordModel.deleteMany({});
    // Dữ liệu cố tình lưu "chuỗi số" cho cột `c1` để chứng minh `$convert` hoạt động.
    await insert(0, { c0: 'Alpha', c1: '10', c2: true, c3: '2024-01-01' });
    await insert(1, { c0: 'Beta', c1: '9', c2: 'true', c3: '2024-06-01' });
    await insert(2, { c0: 'Gamma', c1: 20, c2: false, c3: new Date('2023-01-01') });
    await insert(3, { c0: 'Delta', c1: 'abc', c3: null });
  });

  // ─── listRecords ──────────────────────────────────────────────────────────

  describe('listRecords / listAllRecords', () => {
    it('listRecords trả về theo row_index tăng dần', async () => {
      const page = await repo.listRecords(datasetId.toHexString(), undefined, 10);
      expect(page.items).toHaveLength(4);
      expect(page.items[0]?.rowIndex).toBe(0);
      expect(page.hasMore).toBe(false);
    });

    it('listRecords phân trang bằng cursor (row_index > cursor)', async () => {
      const cursor = Buffer.from(JSON.stringify({ row_index: 1 })).toString('base64');
      const page = await repo.listRecords(datasetId.toHexString(), cursor, 10);
      expect(page.items).toHaveLength(2);
      expect(page.items[0]?.rowIndex).toBe(2);
    });

    it('listRecords báo hasMore khi vượt limit', async () => {
      const page = await repo.listRecords(datasetId.toHexString(), undefined, 2);
      expect(page.items).toHaveLength(2);
      expect(page.hasMore).toBe(true);
    });

    it('listRecords bỏ qua cursor hỏng', async () => {
      const page = await repo.listRecords(datasetId.toHexString(), 'khong-phai-base64!!', 10);
      expect(page.items).toHaveLength(4);
    });

    it('listAllRecords trả toàn bộ bản ghi của dataset', async () => {
      const rows = await repo.listAllRecords(datasetId.toHexString());
      expect(rows).toHaveLength(4);
      expect(rows.map((r) => r.rowIndex)).toEqual([0, 1, 2, 3]);
    });
  });

  // ─── queryRecords: bộ lọc ─────────────────────────────────────────────────

  describe('queryRecords — bộ lọc', () => {
    const query = (input: Partial<RecordQueryInput>): Promise<{
      items: { rowIndex: number; props: Record<string, unknown> }[];
      hasMore: boolean;
    }> => repo.queryRecords(datasetId.toHexString(), {
      filters: [],
      sort: [],
      ...input,
    } as RecordQueryInput, columns);

    it('lọc chuỗi bằng contains (không phân biệt hoa thường)', async () => {
      const res = await query({ filters: [{ column: 'name', operator: 'contains', value: 'alp' }] });
      expect(res.items).toHaveLength(1);
      expect(res.items[0]?.props.c0).toBe('Alpha');
    });

    it('lọc chuỗi bằng startsWith / endsWith', async () => {
      const starts = await query({ filters: [{ column: 'name', operator: 'startsWith', value: 'Be' }] });
      expect(starts.items).toHaveLength(1);

      // "Beta" và "Delta" đều kết thúc bằng "ta" ⇒ 2 bản ghi khớp.
      const ends = await query({ filters: [{ column: 'name', operator: 'endsWith', value: 'ta' }] });
      expect(ends.items).toHaveLength(2);
      expect(ends.items.map((r) => r.props.c0)).toEqual(['Beta', 'Delta']);
    });

    it('lọc chuỗi bằng equals / notEquals', async () => {
      const eq = await query({ filters: [{ column: 'name', operator: 'equals', value: 'Gamma' }] });
      expect(eq.items).toHaveLength(1);

      const ne = await query({ filters: [{ column: 'name', operator: 'notEquals', value: 'Gamma' }] });
      expect(ne.items).toHaveLength(3);
    });

    it('lọc cột SỐ với giá trị lưu dạng chuỗi ($convert phía server)', async () => {
      // "10" (chuỗi) > "9" (chuỗi) ⇒ equals 9 không khớp dòng "10".
      const eq = await query({ filters: [{ column: 'age', operator: 'equals', value: 9 }] });
      expect(eq.items).toHaveLength(1);
      expect(eq.items[0]?.props.c0).toBe('Beta');

      const gt = await query({ filters: [{ column: 'age', operator: 'greaterThan', value: 15 }] });
      expect(gt.items).toHaveLength(1);
      expect(gt.items[0]?.props.c0).toBe('Gamma');
    });

    it('lọc cột SỐ bằng between / in', async () => {
      const between = await query({
        filters: [{ column: 'age', operator: 'between', value: [9, 10] }],
      });
      expect(between.items).toHaveLength(2);

      const inList = await query({ filters: [{ column: 'age', operator: 'in', value: [20] }] });
      expect(inList.items).toHaveLength(1);
      expect(inList.items[0]?.props.c0).toBe('Gamma');
    });

    it('lọc cột BOOLEAN khớp cả true lẫn "true"', async () => {
      const res = await query({ filters: [{ column: 'active', operator: 'equals', value: true }] });
      expect(res.items).toHaveLength(2);
    });

    it('lọc cột NGÀY bằng greaterThan', async () => {
      const res = await query({
        filters: [{ column: 'joined', operator: 'greaterThan', value: '2024-01-01' }],
      });
      expect(res.items.length).toBeGreaterThanOrEqual(1);
    });

    it('lọc isEmpty / isNotEmpty', async () => {
      // Dòng 3 (Delta) không có `c2` ⇒ isEmpty khớp đúng 1 bản ghi.
      const empty = await query({ filters: [{ column: 'active', operator: 'isEmpty' }] });
      expect(empty.items).toHaveLength(1);

      // 3 bản ghi còn lại có giá trị (true / "true" / false) ⇒ isNotEmpty khớp 3.
      const notEmpty = await query({ filters: [{ column: 'active', operator: 'isNotEmpty' }] });
      expect(notEmpty.items).toHaveLength(3);
    });

    it('nhiều bộ lọc trên cùng cột ⇒ điều kiện OR', async () => {
      const res = await query({
        filters: [
          { column: 'name', operator: 'equals', value: 'Alpha' },
          { column: 'name', operator: 'equals', value: 'Beta' },
        ],
      });
      expect(res.items).toHaveLength(2);
    });

    it('tìm kiếm toàn văn trên nhiều cột', async () => {
      const res = await query({ search: { columns: ['name', 'age'], value: 'Gam' } });
      expect(res.items).toHaveLength(1);
      expect(res.items[0]?.props.c0).toBe('Gamma');
    });

    it('cột không tồn tại ⇒ ném lỗi', async () => {
      await expect(
        query({ filters: [{ column: 'cot_khong_co', operator: 'equals', value: 'x' }] }),
      ).rejects.toThrow(/Cot khong ton tai/);
    });

    it('toán tử lạ ⇒ bỏ qua (không throw)', async () => {
      const res = await query({
        filters: [{ column: 'name', operator: 'toan_tu_la', value: 'x' } as never],
      });
      expect(res.items).toHaveLength(4);
    });
  });

  // ─── queryRecords: sắp xếp ───────────────────────────────────────────────

  describe('queryRecords — sắp xếp', () => {
    const query = (input: Partial<RecordQueryInput>): Promise<{
      items: { rowIndex: number; props: Record<string, unknown> }[];
      hasMore: boolean;
    }> => repo.queryRecords(datasetId.toHexString(), {
      filters: [],
      sort: [],
      ...input,
    } as RecordQueryInput, columns);

    it('sắp xếp cột chuỗi tăng dần', async () => {
      const res = await query({ sort: [{ column: 'name', order: 'asc' }] });
      expect(res.items[0]?.props.c0).toBe('Alpha');
      expect(res.items[1]?.props.c0).toBe('Beta');
    });

    it('sắp xếp cột SỐ theo giá trị số (không lexicographic)', async () => {
      const asc = await query({ sort: [{ column: 'age', order: 'asc' }] });
      // "9" phải đứng trước "10" (lexicographic sẽ ra ngược lại).
      // Dòng "abc" (không ép được sang số) bị đẩy xuống CUỐI, không đứng đầu.
      expect(asc.items[0]?.props.c0).toBe('Beta');
      expect(asc.items[1]?.props.c0).toBe('Alpha');
      expect(asc.items[asc.items.length - 1]?.props.c0).toBe('Delta');

      const desc = await query({ sort: [{ column: 'age', order: 'desc' }] });
      expect(desc.items[0]?.props.c0).toBe('Gamma');
      expect(desc.items[desc.items.length - 1]?.props.c0).toBe('Delta');
    });

    it('sắp xếp cột NGÀY', async () => {
      const asc = await query({ sort: [{ column: 'joined', order: 'asc' }] });
      // "2023-01-01" (Gamma) < "2024-01-01" (Alpha) < "2024-06-01" (Beta);
      // dòng c3 = null (Delta) bị đẩy xuống cuối.
      expect(asc.items[0]?.props.c0).toBe('Gamma');
      expect(asc.items[asc.items.length - 1]?.props.c0).toBe('Delta');
    });

    it('sắp xếp + lọc kết hợp', async () => {
      const res = await query({
        filters: [{ column: 'age', operator: 'greaterThan', value: 0 }],
        sort: [{ column: 'age', order: 'asc' }],
      });
      expect(res.items.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ─── getColumnStats ──────────────────────────────────────────────────────

  describe('getColumnStats', () => {
    it('tính min/max/average + histogram 10 bucket cho cột số', async () => {
      const stats = await repo.getColumnStats(datasetId.toHexString(), 'c1');

      expect(stats.totalRecords).toBe(4);
      // "abc" không chuyển được sang số ⇒ không tính vào numeric.
      expect(stats.min).toBe(9);
      expect(stats.max).toBe(20);
      expect(stats.average).toBe(13);
      expect(stats.histogram).toHaveLength(10);
    });

    it('đếm null/missing ratio cho cột thiếu dữ liệu', async () => {
      const stats = await repo.getColumnStats(datasetId.toHexString(), 'c2');
      expect(stats.totalRecords).toBe(4);
      expect(stats.nullCount).toBe(1);
      expect(stats.missingRatio).toBeCloseTo(0.25);
      // Cột boolean KHÔNG phải cột số ⇒ không sinh histogram.
      expect(stats.histogram).toEqual([]);
    });

    it('cột không có giá trị số nào ⇒ histogram rỗng, không min/max', async () => {
      await recordModel.deleteMany({});
      await insert(0, { c0: 'x' });
      const stats = await repo.getColumnStats(datasetId.toHexString(), 'c1');
      expect(stats.histogram).toEqual([]);
      expect(stats.min).toBeUndefined();
    });
  });

  // ─── getColumnValues ─────────────────────────────────────────────────────

  describe('getColumnValues', () => {
    it('ép kiểu cột số về double (chuỗi số → số)', async () => {
      const res = await repo.getColumnValues(datasetId.toHexString(), 'c1', 'number', 100);
      expect(res.totalRecords).toBe(4);
      expect(res.sampledRecords).toBe(4);
      expect(res.truncated).toBe(false);
      expect(res.values).toContain(10);
      expect(res.values).toContain(9);
      expect(res.values).toContain(20);
    });

    it('cắt bớt theo limit ⇒ truncated = true', async () => {
      const res = await repo.getColumnValues(datasetId.toHexString(), 'c1', 'number', 2);
      expect(res.sampledRecords).toBe(2);
      expect(res.totalRecords).toBe(4);
      expect(res.truncated).toBe(true);
    });

    it('cột chuỗi giữ nguyên giá trị', async () => {
      const res = await repo.getColumnValues(datasetId.toHexString(), 'c0', 'string', 100);
      expect(res.values).toContain('Alpha');
      expect(res.values).not.toContain(10);
    });
  });

  // ─── resolveColumnKey ────────────────────────────────────────────────────

  describe('resolveColumnKey', () => {
    it('trả về key nếu tồn tại, null nếu không', () => {
      expect(repo.resolveColumnKey('c0', ['c0', 'c1'], ['name', 'age'])).toBe('c0');
      expect(repo.resolveColumnKey('c9', ['c0', 'c1'], ['name', 'age'])).toBeNull();
    });
  });
});
