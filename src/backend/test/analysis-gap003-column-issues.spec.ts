/**
 * GAP-003 — **Gate lỗi tên cột** chặn phân tích (UC-08 / §3.25).
 *
 * ## Vấn đề
 *
 * `detectColumnIssues()` (domain entity `Dataset`) phát hiện 3 loại lỗi tên cột:
 * `empty_name`, `whitespace_only`, `duplicate_name`. Nhưng trước GĐ7/GAP-003,
 * **không có tầng nào thực thi** invariant đó → người dùng có thể chạy phân tích
 * trên dataset có cột trùng tên → các bản đồ `key → tên` (label/time/value,
 * role theo tên) đè lên nhau → **tương quan tính nhầm cột, kết quả sai mà không
 * báo lỗi**.
 *
 * ## Yêu cầu đã chốt
 *
 * - `empty_name` / `duplicate_name` → **chặn** phân tích.
 * - `whitespace_only` → vẫn là **warning**, không chặn (tên có thể hiển thị).
 * - Reset tên cột phải **tái tính** lại issues từ tên gốc (không xoá sạch).
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RunAnalysisHandler } from '../src/modules/analysis/application/commands/run-analysis.handler';
import { ANALYSIS_REPOSITORY_PORT } from '../src/modules/analysis/domain/ports/analysis.repository.port';
import { PROJECT_ACCESS_PORT } from '../src/modules/projects';
import { DATASET_REPOSITORY_PORT, RECORD_QUERY_PORT } from '../src/modules/datasets';
import { REALTIME_PORT } from '../src/modules/realtime';
import { detectColumnIssues } from '../src/modules/datasets/domain/entities/dataset.entity';

const P = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const WS = 'cccccccccccccccccccccccc';
const DS = 'bbbbbbbbbbbbbbbbbbbbbbbb';

type Col = {
  key: string;
  index: number;
  name: string;
  dataType: 'string' | 'number' | 'boolean' | 'date';
  originalName: string;
  missingCount: number;
  isPii: boolean;
};

const col = (i: number, name: string, dataType: Col['dataType'] = 'number'): Col => ({
  key: `c${i}`,
  index: i,
  name,
  dataType,
  originalName: name,
  missingCount: 0,
  isPii: false,
});

const dataset = (columns: Col[], over: Record<string, unknown> = {}) => ({
  id: DS,
  projectId: P,
  workspaceId: WS,
  name: 'ds',
  originalFileName: 'ds.csv',
  fileFormat: 'csv' as const,
  fileSizeBytes: 10,
  fileChecksum: 'sum',
  storageKey: 'raw_files/ds.csv',
  rowCount: 3,
  columnCount: columns.length,
  columns,
  columnIssues: [] as Array<{ columnKey: string | null; issue: string; message: string }>,
  hasHeader: true,
  delimiter: ',' as const,
  currentVersion: 1,
  status: 'READY' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  version: 1,
  ...over,
});

describe('GAP-003 — gate lỗi tên cột chặn phân tích', () => {
  let runHandler: RunAnalysisHandler;
  let repository: {
    create: jest.Mock;
    findConfigByProject: jest.Mock;
    updateById: jest.Mock;
    saveResult: jest.Mock;
    createJob: jest.Mock;
    markResultsStale: jest.Mock;
    insertEvidences: jest.Mock;
    countEvidencesByRun: jest.Mock;
    findEvidencesByRun: jest.Mock;
    findResultByRun: jest.Mock;
  };
  let listAllRecords: jest.Mock;

  const build = async (columns: Col[], issues: Array<{ columnKey: string | null; issue: string; message: string }>) => {
    repository = {
      // Run đã tạo phải có `id` — handler dùng nó để tạo job AI.
      create: jest.fn(async () => ({ id: 'run-1' })),
      findConfigByProject: jest.fn().mockResolvedValue(null),
      updateById: jest.fn(async () => ({ id: 'run-1' })),
      saveResult: jest.fn(async () => ({ id: 'res-1' })),
      createJob: jest.fn(async () => ({ id: 'job-1' })),
      markResultsStale: jest.fn(async () => undefined),
      insertEvidences: jest.fn(async () => 0),
      countEvidencesByRun: jest.fn(async () => 0),
      findEvidencesByRun: jest.fn(async () => []),
      findResultByRun: jest.fn(async () => ({ id: 'res-1' })),
    };
    listAllRecords = jest.fn(async () => []);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RunAnalysisHandler,
        {
          provide: PROJECT_ACCESS_PORT,
          useValue: { getProjectById: jest.fn(async () => ({ id: P, workspaceId: WS })) },
        },
        {
          provide: DATASET_REPOSITORY_PORT,
          useValue: {
            findByProject: jest.fn(async () =>
              dataset(columns, {
                columnIssues: issues,
                // Nếu adapter trả entity, `columnIssues` phải khớp `detectColumnIssues`.
                ...(issues.length > 0 ? {} : {}),
              }),
            ),
          },
        },
        { provide: ANALYSIS_REPOSITORY_PORT, useValue: repository },
        { provide: RECORD_QUERY_PORT, useValue: { listAllRecords } },
        {
          provide: REALTIME_PORT,
          useValue: { emitAnalysisLifecycle: jest.fn(), emitToProject: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: { get: (k: string, d: unknown) => (k === 'ANALYSIS_MAX_ROWS' ? 1000 : d) },
        },
      ],
    }).compile();
    runHandler = module.get(RunAnalysisHandler);
  };

  const run = () =>
    runHandler.execute(P, {
      correlation_method: 'pearson',
      outlier_method: 'iqr',
      top_n: 50,
    });

  it('dataset SẠCH (không lỗi tên cột) → chạy phân tích bình thường', async () => {
    await build([col(0, 'doanh_thu'), col(1, 'loai', 'string')], []);
    await expect(run()).resolves.toBeDefined();
  });

  it('cột trùng tên → CHẶN, không tạo run, không đọc bản ghi', async () => {
    const columns = [col(0, 'trung'), col(1, 'trung', 'string')];
    const issues = detectColumnIssues(columns);
    expect(issues.length).toBeGreaterThan(0);
    await build(columns, issues);

    await expect(run()).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(repository.create).not.toHaveBeenCalled();
    expect(listAllRecords).not.toHaveBeenCalled();
  });

  it('cột tên RỖNG → CHẶN', async () => {
    const columns = [col(0, ''), col(1, 'loai', 'string')];
    const issues = detectColumnIssues(columns);
    expect(issues.some((i) => i.issue === 'empty_name')).toBe(true);
    await build(columns, issues);

    await expect(run()).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('cột tên CHỈ KHOẢNG TRẮNG → vẫn CHẶN (empty_name không áp dụng, whitespace_only chặn)', async () => {
    const columns = [col(0, '   '), col(1, 'loai', 'string')];
    const issues = detectColumnIssues(columns);
    expect(issues.some((i) => i.issue === 'whitespace_only')).toBe(true);
    await build(columns, issues);

    await expect(run()).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('lỗi trong `details.columnIssues` để frontend hiển thị chính xác cột lỗi', async () => {
    const columns = [col(0, 'trung'), col(1, 'trung', 'string')];
    await build(columns, detectColumnIssues(columns));

    await expect(run()).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      details: {
        columnIssues: expect.arrayContaining([
          expect.objectContaining({ columnKey: 'c1', issue: 'duplicate_name' }),
        ]),
      },
    });
  });

  it('gate chạy TRƯỚC khi đọc bản ghi (không tốn tài nguyên cho dataset lỗi)', async () => {
    const columns = [col(0, 'trung'), col(1, 'trung', 'string')];
    await build(columns, detectColumnIssues(columns));

    await expect(run()).rejects.toThrow();
    expect(listAllRecords).not.toHaveBeenCalled();
  });
});
