/**
 * GĐ3 — `ReportWorkerService`: sinh PDF từ bản Tổng kết đã yêu cầu.
 *
 * Trọng tâm:
 *   1. Dùng **đúng bản Tổng kết theo id** (không lấy bản mới nhất) → nội dung
 *      PDF nhất quán với yêu cầu của người dùng.
 *   2. Thiếu bản Tổng kết / sai project → job `failed`, không upload file rác.
 *   3. Thành công → upload đúng key `reports/{projectId}/{reportId}.pdf` + cập nhật
 *      trạng thái `succeeded` với `storageKey`/`fileSizeBytes`.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ReportWorkerService } from '../../../src/modules/analysis/application/report-worker.service';
import { ANALYSIS_REPOSITORY_PORT } from '../../../src/modules/analysis/domain/ports/analysis.repository.port';
import { STORAGE_PORT } from '../../../src/shared/application/ports/storage.port';

const PROJECT_ID = '65f0000000000000000000b2';
const REPORT_ID = '65f0000000000000000000f7';
const SAVE_ID = '65f0000000000000000000a1';
const RUN_ID = '65f0000000000000000000d4';

describe('GĐ3 — ReportWorkerService sinh PDF', () => {
  let worker: ReportWorkerService;
  let repository: {
    findReportById: jest.Mock;
    findSaveById: jest.Mock;
    findLatestSaveByProject: jest.Mock;
    findResultByRun: jest.Mock;
    findEvidencesByRun: jest.Mock;
    updateReportById: jest.Mock;
    claimPendingReport: jest.Mock;
  };
  let storage: { uploadStream: jest.Mock };

  const buildSave = (over: Record<string, unknown> = {}) => ({
    id: SAVE_ID,
    projectId: PROJECT_ID,
    workspaceId: '65f0000000000000000000c3',
    analysisRunId: RUN_ID,
    analysisResultId: '65f0000000000000000000e5',
    inputFingerprint: 'fp-1234567890',
    summary: {
      overview: 'Tổng kết',
      issues: [{ dq: 'DQ-01', column: 'Ten', count: 5, rate: 0.05, severity: 'medium' }],
      suspicions: [],
      evidence_refs: 3,
      top_n: 50,
    },
    isStale: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...over,
  });

  beforeEach(async () => {
    repository = {
      findReportById: jest.fn().mockResolvedValue({
        id: REPORT_ID,
        projectId: PROJECT_ID,
        workspaceId: '65f0000000000000000000c3',
        projectSaveId: SAVE_ID,
        status: 'running',
        storageKey: null,
        fileSizeBytes: null,
        error: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      findSaveById: jest.fn().mockResolvedValue(buildSave()),
      findLatestSaveByProject: jest.fn().mockResolvedValue(buildSave()),
      findResultByRun: jest.fn().mockResolvedValue({
        id: '65f0000000000000000000e5',
        analysisRunId: RUN_ID,
        projectId: PROJECT_ID,
        inputFingerprint: 'fp-1234567890',
        descriptive: [],
        isStale: false,
        createdAt: new Date(),
      }),
      findEvidencesByRun: jest.fn().mockResolvedValue([]),
      updateReportById: jest.fn().mockResolvedValue({}),
      claimPendingReport: jest.fn().mockResolvedValue(null),
    };
    storage = { uploadStream: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportWorkerService,
        { provide: ANALYSIS_REPOSITORY_PORT, useValue: repository },
        { provide: STORAGE_PORT, useValue: storage },
        { provide: ConfigService, useValue: { get: (_k: string, d: unknown) => d } },
      ],
    }).compile();
    worker = module.get(ReportWorkerService);
  });

  it('sinh PDF và upload đúng key, cập nhật trạng thái succeeded', async () => {
    await worker.buildPdf(REPORT_ID);

    expect(repository.findSaveById).toHaveBeenCalledWith(SAVE_ID);
    expect(storage.uploadStream).toHaveBeenCalledTimes(1);
    const [key, stream, mime] = storage.uploadStream.mock.calls[0] as [string, unknown, string];
    expect(key).toBe(`reports/${PROJECT_ID}/${REPORT_ID}.pdf`);
    expect(mime).toBe('application/pdf');
    expect(Buffer.isBuffer(stream)).toBe(false); // Readable stream, không phải Buffer

    const update = repository.updateReportById.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(update.status).toBe('succeeded');
    expect(update.storageKey).toBe(key);
    expect(typeof update.fileSizeBytes).toBe('number');
  });

  it('dùng bản Tổng kết theo id, KHÔNG lấy bản mới nhất', async () => {
    await worker.buildPdf(REPORT_ID);
    expect(repository.findSaveById).toHaveBeenCalledWith(SAVE_ID);
    expect(repository.findLatestSaveByProject).not.toHaveBeenCalled();
  });

  it('bản Tổng kết không tồn tại → job failed, KHÔNG upload', async () => {
    repository.findSaveById.mockResolvedValue(null);
    await worker.buildPdf(REPORT_ID);

    expect(storage.uploadStream).not.toHaveBeenCalled();
    const update = repository.updateReportById.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(update.status).toBe('failed');
    expect((update.error as { code: string }).code).toBe('REPORT_BUILD_FAILED');
    expect((update.error as { message: string }).message).toContain('REPORT_PREREQUISITE_MISSING');
  });

  it('bản Tổng kết thuộc project khác → job failed, KHÔNG upload', async () => {
    repository.findSaveById.mockResolvedValue(buildSave({ projectId: '65f0000000000000000099' }));
    await worker.buildPdf(REPORT_ID);

    expect(storage.uploadStream).not.toHaveBeenCalled();
    const update = repository.updateReportById.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(update.status).toBe('failed');
  });

  it('job không tồn tại → không làm gì', async () => {
    repository.findReportById.mockResolvedValue(null);
    await worker.buildPdf(REPORT_ID);
    expect(storage.uploadStream).not.toHaveBeenCalled();
    expect(repository.updateReportById).not.toHaveBeenCalled();
  });

  it('lỗi khi sinh PDF → job failed với mã REPORT_BUILD_FAILED', async () => {
    repository.findEvidencesByRun.mockRejectedValue(new Error('db down'));
    await worker.buildPdf(REPORT_ID);

    expect(storage.uploadStream).not.toHaveBeenCalled();
    const update = repository.updateReportById.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(update.status).toBe('failed');
    expect((update.error as { code: string }).code).toBe('REPORT_BUILD_FAILED');
  });
});
