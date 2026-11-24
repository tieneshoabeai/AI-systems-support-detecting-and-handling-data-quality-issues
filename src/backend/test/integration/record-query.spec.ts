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

  // ─── Phần 13 v15 mục 3.28 — đợt sửa data-view (Phần 7 v13 mục 3.23) ─────

  describe('v13 — bộ lọc theo kiểu cột (DVT-06..10)', () => {
    const query = (input: Partial<RecordQueryInput>): Promise<{
      items: { rowIndex: number; props: Record<string, unknown> }[];
      hasMore: boolean;
      nextCursor?: string | null;
    }> => repo.queryRecords(datasetId.toHexString(), {
      filters: [],
      sort: [],
      ...input,
    } as RecordQueryInput, columns);
    const rows = (res: { items: { rowIndex: number }[] }): number[] => res.items.map((r) => r.rowIndex);

    it('DVT-06: lọc cùng cột qua key c0 + tên hiển thị ⇒ OR', async () => {
      const res = await query({
        filters: [
          { column: 'c0', operator: 'equals', value: 'Alpha' },
          { column: 'name', operator: 'equals', value: 'Beta' },
        ],
      });
      expect(rows(res)).toEqual([0, 1]);
    });

    it('DVT-07: so sánh số với giá trị không phải số ⇒ lỗi rõ ràng (không trả cả bảng)', async () => {
      await expect(
        query({ filters: [{ column: 'age', operator: 'greaterThan', value: 'abc' }] }),
      ).rejects.toThrow(/khong phai so hop le/);
      await expect(
        query({ filters: [{ column: 'age', operator: 'between', value: [1, 'x'] }] }),
      ).rejects.toThrow(/khong phai so hop le/);
    });

    it('DVT-07: so sánh ngày với giá trị không phải ngày ⇒ lỗi rõ ràng', async () => {
      await expect(
        query({ filters: [{ column: 'joined', operator: 'lessThan', value: 'khong-phai-ngay' }] }),
      ).rejects.toThrow(/khong phai ngay hop le/);
    });

    it('DVT-07: equals giá trị không phải số trên cột số ⇒ khớp đúng chuỗi thô (tìm ô sai kiểu)', async () => {
      const res = await query({ filters: [{ column: 'age', operator: 'equals', value: 'abc' }] });
      expect(rows(res)).toEqual([3]);
    });

    it('DV-6: value là object ⇒ bị chặn ở repository (lớp phòng vệ thứ 2)', async () => {
      await expect(
        query({ filters: [{ column: 'name', operator: 'equals', value: { $ne: null } }] }),
      ).rejects.toThrow(/khong hop le/);
      await expect(
        query({ filters: [{ column: 'name', operator: 'in', value: [{ $regex: '.*' }] }] }),
      ).rejects.toThrow(/khong hop le/);
    });

    it('DVT-08: date between (trước đây là code chết ⇒ 0 dòng)', async () => {
      const res = await query({
        filters: [{ column: 'joined', operator: 'between', value: ['2024-01-01', '2024-12-31'] }],
      });
      expect(rows(res)).toEqual([0, 1]);
    });

    it('DVT-08: date in / notEquals (ngày lưu như lúc nạp: nửa đêm UTC+7)', async () => {
      // Ingest ép '2024-06-01' → Date nửa đêm giờ Việt Nam (coerceDate). Chuỗi ngày
      // legacy được `$convert` đọc theo UTC (lệch 7 giờ) — tồn đọng, ngoài phạm vi v13.
      await recordModel.deleteMany({});
      await insert(0, { c3: new Date('2024-06-01T00:00:00+07:00') });
      await insert(1, { c3: new Date('2023-01-01T00:00:00+07:00') });
      await insert(2, { c3: new Date('2024-12-25T00:00:00+07:00') });
      await insert(3, { c3: null });
      const inList = await query({
        filters: [{ column: 'joined', operator: 'in', value: ['2024-06-01', '2023-01-01'] }],
      });
      expect(rows(inList)).toEqual([0, 1]);
      const eq = await query({ filters: [{ column: 'joined', operator: 'equals', value: '2024-12-25' }] });
      expect(rows(eq)).toEqual([2]);
      const ne = await query({ filters: [{ column: 'joined', operator: 'notEquals', value: '2024-06-01' }] });
      expect(rows(ne)).toEqual([1, 2, 3]);
    });

    it('DVT-08: boolean in khớp cả native lẫn chuỗi legacy (kể cả "True")', async () => {
      await insert(4, { c0: 'Eps', c2: 'True' });
      const t = await query({ filters: [{ column: 'active', operator: 'in', value: [true] }] });
      expect(rows(t)).toEqual([0, 1, 4]);
      const f = await query({ filters: [{ column: 'active', operator: 'in', value: ['false'] }] });
      expect(rows(f)).toEqual([2]);
    });

    it('DVT-09: contains / search trên cột số đã lưu dạng số', async () => {
      const contains = await query({ filters: [{ column: 'age', operator: 'contains', value: '2' }] });
      expect(rows(contains)).toEqual([2]);
      const search = await query({ search: { columns: ['age'], value: '20' } });
      expect(rows(search)).toEqual([2]);
      const notContains = await query({ filters: [{ column: 'age', operator: 'notContains', value: '2' }] });
      expect(rows(notContains)).toEqual([0, 1, 3]);
    });

    it('DV-12: search toàn khoảng trắng ⇒ không lọc; không trim khi có chữ', async () => {
      const blank = await query({ search: { columns: ['name'], value: '   ' } });
      expect(rows(blank)).toEqual([0, 1, 2, 3]);
      await insert(4, { c0: 'Al pha' });
      const spaced = await query({ search: { columns: ['name'], value: 'l p' } });
      expect(rows(spaced)).toEqual([4]);
    });

    it('DVT-10: isEmpty / isNotEmpty tính chuỗi toàn khoảng trắng là trống', async () => {
      await insert(4, { c0: '   ' });
      await insert(5, { c0: '' });
      const empty = await query({ filters: [{ column: 'name', operator: 'isEmpty' }] });
      expect(rows(empty)).toEqual([4, 5]);
      const notEmpty = await query({ filters: [{ column: 'name', operator: 'isNotEmpty' }] });
      expect(rows(notEmpty)).toEqual([0, 1, 2, 3]);
    });

    it('DVT-03: cursor hỏng ⇒ ValidationError (không âm thầm về trang 1)', async () => {
      await expect(query({ cursor: 'khong-phai-base64!!' })).rejects.toThrow(/Cursor khong hop le/);
    });
  });

  describe('v13 — phân trang keyset khi sort (DVT-01, DVT-03)', () => {
    beforeEach(async () => {
      await recordModel.deleteMany({});
      // Cố tình trộn kiểu lưu (số / chuỗi số / Date / chuỗi ngày / boolean legacy),
      // giá trị trùng và giá trị trống để bắt lỗi bỏ sót / lặp dòng giữa các trang.
      const age = [5, '3', null, 5, 'abc', 1, '5', 2, null, 3, 10, ''];
      const joined = [
        '2024-01-03', new Date('2024-01-01T00:00:00Z'), null, '2024-01-03', 'bad', '2023-12-31',
        new Date('2024-01-03T00:00:00Z'), '2024-02-01', null, '2023-12-31', '2025-01-01', '',
      ];
      const name = ['b', 'a', null, 'b', '   ', 'c', 'a', '', 'B', 'd', 'a', 'z'];
      const active = [true, 'true', null, false, 'True', 'no', 1, 'x', true, false, '0', null];
      for (let i = 0; i < 12; i++) {
        await insert(i, { c0: name[i], c1: age[i], c2: active[i], c3: joined[i] });
      }
    });

    type Sort = RecordQueryInput['sort'];
    const run = (sort: Sort, limit: number, cursor?: string): Promise<{
      items: { rowIndex: number }[];
      hasMore: boolean;
      nextCursor?: string | null;
    }> =>
      repo.queryRecords(datasetId.toHexString(), { filters: [], sort, limit, cursor }, columns);

    const pageAll = async (sort: Sort, limit: number): Promise<number[]> => {
      const out: number[] = [];
      let cursor: string | undefined;
      for (let guard = 0; guard < 50; guard++) {
        const res = await run(sort, limit, cursor);
        out.push(...res.items.map((r) => r.rowIndex));
        if (!res.hasMore) return out;
        expect(res.nextCursor).toBeTruthy();
        cursor = res.nextCursor as string;
      }
      throw new Error('Phân trang không dừng');
    };

    const cases: [string, Sort][] = [
      ['number asc', [{ column: 'age', order: 'asc' }]],
      ['number desc', [{ column: 'age', order: 'desc' }]],
      ['date asc', [{ column: 'joined', order: 'asc' }]],
      ['date desc', [{ column: 'joined', order: 'desc' }]],
      ['string asc', [{ column: 'name', order: 'asc' }]],
      ['string desc', [{ column: 'name', order: 'desc' }]],
      ['boolean asc', [{ column: 'active', order: 'asc' }]],
      ['nhiều cột: boolean desc + number asc', [{ column: 'active', order: 'desc' }, { column: 'age', order: 'asc' }]],
    ];

    it.each(cases)('DVT-01 %s: duyệt hết trang (limit 2) = kết quả một lần, không sót/lặp', async (_label, sort) => {
      const once = (await run(sort, 500)).items.map((r) => r.rowIndex);
      expect(once).toHaveLength(12);
      for (const limit of [1, 2, 5]) {
        const paged = await pageAll(sort, limit);
        expect(paged).toEqual(once);
        expect(new Set(paged).size).toBe(12);
      }
    });

    it('DV-5: null / không ép được / chuỗi trống xếp CUỐI cho mọi kiểu, cả asc lẫn desc', async () => {
      const tail = async (sort: Sort, n: number): Promise<number[]> =>
        (await run(sort, 500)).items.map((r) => r.rowIndex).slice(-n);
      // age: null (2, 8), 'abc' (4), '' (11)
      expect(await tail([{ column: 'age', order: 'asc' }], 4)).toEqual([2, 4, 8, 11]);
      expect(await tail([{ column: 'age', order: 'desc' }], 4)).toEqual([2, 4, 8, 11]);
      // name: null (2), '   ' (4), '' (7)
      expect(await tail([{ column: 'name', order: 'asc' }], 3)).toEqual([2, 4, 7]);
      expect(await tail([{ column: 'name', order: 'desc' }], 3)).toEqual([2, 4, 7]);
      // active: null (2, 11), 'x' (7)
      expect(await tail([{ column: 'active', order: 'asc' }], 3)).toEqual([2, 7, 11]);
    });

    it('DVT-03: cursor sinh từ sort khác / từ truy vấn không sort ⇒ ValidationError', async () => {
      const p1 = await run([{ column: 'age', order: 'asc' }], 2);
      await expect(run([{ column: 'name', order: 'asc' }], 2, p1.nextCursor as string)).rejects.toThrow(
        /Cursor khong khop/,
      );
      await expect(run([{ column: 'age', order: 'desc' }], 2, p1.nextCursor as string)).rejects.toThrow(
        /Cursor khong khop/,
      );
      const noSort = await run([], 2);
      await expect(run([{ column: 'age', order: 'asc' }], 2, noSort.nextCursor as string)).rejects.toThrow(
        /Cursor khong khop/,
      );
      await expect(run([], 2, p1.nextCursor as string)).rejects.toThrow(/Cursor khong khop/);
    });

    it('không sort: phân trang theo row_index, cursor { row_index }', async () => {
      expect(await pageAll([], 5)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    });
  });

  describe('v13 — getColumnStats / getColumnValues (DVT-10, DVT-11)', () => {
    it('DVT-11: cột hằng số ⇒ 1 bucket [min, max] (không còn bucket đảo đầu)', async () => {
      await recordModel.deleteMany({});
      for (let i = 0; i < 5; i++) await insert(i, { c1: i % 2 === 0 ? 7 : '7' });
      const stats = await repo.getColumnStats(datasetId.toHexString(), 'c1', 'number');
      expect(stats.min).toBe(7);
      expect(stats.max).toBe(7);
      expect(stats.histogram).toEqual([{ bucketStart: 7, bucketEnd: 7, count: 5 }]);
    });

    it('DVT-11: tổng count các bucket = số giá trị số; bucket tăng dần', async () => {
      const stats = await repo.getColumnStats(datasetId.toHexString(), 'c1', 'number');
      expect(stats.histogram.reduce((s, b) => s + b.count, 0)).toBe(3);
      for (const b of stats.histogram) expect(b.bucketEnd).toBeGreaterThanOrEqual(b.bucketStart);
      expect(stats.histogram[0]?.count).toBe(2); // 9, 10
      expect(stats.histogram[9]?.count).toBe(1); // 20
    });

    it('DVT-10: null_count tính chuỗi trống / toàn khoảng trắng', async () => {
      await insert(4, { c0: '' });
      await insert(5, { c0: '   ' });
      const stats = await repo.getColumnStats(datasetId.toHexString(), 'c0', 'string');
      expect(stats.totalRecords).toBe(6);
      expect(stats.nullCount).toBe(2);
    });

    it('DV-14: cột không phải number ⇒ không thống kê số', async () => {
      const stats = await repo.getColumnStats(datasetId.toHexString(), 'c1', 'string');
      expect(stats.min).toBeUndefined();
      expect(stats.histogram).toEqual([]);
    });

    it('DV-16: getColumnValues đọc mẫu theo row_index; knownTotal bỏ qua countDocuments', async () => {
      await recordModel.deleteMany({});
      for (const i of [5, 1, 3, 0, 4, 2]) await insert(i, { c0: `r${i}` });
      const res = await repo.getColumnValues(datasetId.toHexString(), 'c0', 'string', 3, 999);
      expect(res.values).toEqual(['r0', 'r1', 'r2']);
      expect(res.totalRecords).toBe(999);
      expect(res.truncated).toBe(true);
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
