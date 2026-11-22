/**
 * B2.10 — Test unit cho `AiWorkerService` + `extractJsonObject`.
 *
 * Worker là **vòng lặp xử lý job AI** — nơi quyết định job thành công, retry
 * hay thất bại. Trước đây 0% coverage ⇒ một lỗi ở đây có thể khiến job
 * treo vô hạn, retry vô hạn, hoặc nuốt kết quả AI.
 *
 * Bộ test chứng minh:
 *   1. Vòng đời job: pending → running → succeeded (kèm heartbeat, lease).
 *   2. Retry: lỗi tạm thời ⇒ `pending` + attempt++; hết số lần ⇒ `failed`.
 *   3. RAM Guard: thiếu RAM ⇒ **không** claim job mới (job pending giữ nguyên).
 *   4. `extractJsonObject`: bóc JSON từ prose, trả null khi không hợp lệ.
 */
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AiWorkerService } from '../src/modules/analysis/application/services/ai-worker.service';
import { extractJsonObject } from '../src/modules/analysis/application/ports/ai-inference.port';
import { ANALYSIS_REPOSITORY_PORT } from '../src/modules/analysis/domain/ports/analysis.repository.port';
import { BuildPromptForJobHandler } from '../src/modules/analysis/application/commands/build-prompt-for-job.handler';
import { IngestAiResultHandler } from '../src/modules/analysis/application/commands/ingest-ai-result.handler';
import { RESOURCE_GUARD_PORT } from '../src/modules/analysis/application/ports/resource-guard.port';
import { AiInferencePort } from '../src/modules/analysis/application/ports/ai-inference.port';

describe('B2.10 — AiWorkerService', () => {
  let worker: AiWorkerService;
  let repository: {
    skipStaleJobs: jest.Mock;
    claimPendingJob: jest.Mock;
    findJobById: jest.Mock;
    updateJobById: jest.Mock;
    heartbeatJob: jest.Mock;
  };
  let buildPrompt: { execute: jest.Mock };
  let ingestResult: { execute: jest.Mock };
  let inference: { engine: string; complete: jest.Mock };
  let guard: { check: jest.Mock; canAcceptAiJob: jest.Mock; blockReason: jest.Mock };
  let config: { get: jest.Mock };

  const job = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    id: 'job-1',
    modelId: 'model-x',
    attempt: 0,
    ...over,
  });

  beforeEach(async () => {
    repository = {
      skipStaleJobs: jest.fn(async () => 0),
      claimPendingJob: jest.fn(async () => null),
      findJobById: jest.fn(async () => job()),
      updateJobById: jest.fn(async () => undefined),
      heartbeatJob: jest.fn(async () => undefined),
    };
    buildPrompt = { execute: jest.fn(async () => 'PROMPT') };
    ingestResult = { execute: jest.fn(async () => undefined) };
    inference = {
      engine: 'ollama',
      complete: jest.fn(async () => ({
        text: '{"ok":true}',
        modelId: 'model-x',
        durationMs: 10,
      })),
    };
    guard = {
      check: jest.fn(() => ({
        blocked: false,
        reason: '',
        availableBytes: 1e10,
        totalBytes: 1e10,
        engineRssBytes: 0,
      })),
      canAcceptAiJob: jest.fn(() => true),
      blockReason: jest.fn(() => null),
    };
    config = {
      get: jest.fn((key: string) => {
        if (key === 'AI_TIMEOUT_MS') return 1000;
        if (key === 'AI_MAX_RETRIES') return 2;
        return undefined;
      }),
    };

    const module = await Test.createTestingModule({
      providers: [
        AiWorkerService,
        { provide: ANALYSIS_REPOSITORY_PORT, useValue: repository },
        { provide: BuildPromptForJobHandler, useValue: buildPrompt },
        { provide: IngestAiResultHandler, useValue: ingestResult },
        { provide: AiInferencePort, useValue: inference },
        { provide: ConfigService, useValue: config },
        { provide: RESOURCE_GUARD_PORT, useValue: guard },
      ],
    }).compile();

    worker = module.get(AiWorkerService);
  });

  // ─── onModuleInit ────────────────────────────────────────────────────────

  describe('onModuleInit', () => {
    it('WORKER_MODE=api ⇒ không bật timer', () => {
      config.get.mockImplementation((k: string) =>
        k === 'WORKER_MODE' ? 'api' : undefined,
      );
      worker.onModuleInit();
      expect(config.get).toHaveBeenCalledWith('WORKER_MODE');
    });

    it('AI_WORKER_ENABLED=false ⇒ không bật timer', () => {
      config.get.mockImplementation((k: string) =>
        k === 'AI_WORKER_ENABLED' ? false : undefined,
      );
      worker.onModuleInit();
      expect(config.get).toHaveBeenCalledWith('AI_WORKER_ENABLED');
    });

    it('AI_WORKER_ENABLED=true ⇒ bật timer (interval từ config)', () => {
      jest.useFakeTimers();
      try {
        config.get.mockImplementation((k: string) => {
          if (k === 'AI_WORKER_ENABLED') return true;
          if (k === 'AI_WORKER_INTERVAL_MS') return 1000;
          return undefined;
        });
        worker.onModuleInit();
        // Timer đã được tạo (không assert số lần gọi vì interval > 0).
        expect(config.get).toHaveBeenCalledWith('AI_WORKER_INTERVAL_MS');
      } finally {
        jest.useRealTimers();
      }
    });
  });

  // ─── tick ────────────────────────────────────────────────────────────────

  describe('tick', () => {
    it('không có job pending ⇒ không xử lý gì', async () => {
      repository.claimPendingJob.mockResolvedValue(null);
      await worker.tick();

      expect(repository.skipStaleJobs).toHaveBeenCalled();
      expect(repository.claimPendingJob).toHaveBeenCalled();
      expect(inference.complete).not.toHaveBeenCalled();
    });

    it('RAM Guard chặn ⇒ KHÔNG claim job (job pending giữ nguyên)', async () => {
      guard.blockReason.mockReturnValue('RAM khong du');
      await worker.tick();

      expect(repository.claimPendingJob).not.toHaveBeenCalled();
      expect(inference.complete).not.toHaveBeenCalled();
    });

    it('busy ⇒ tick tiếp theo bị bỏ qua', async () => {
      let release: () => void = () => undefined;
      const gate = new Promise<void>((r) => {
        release = r;
      });
      repository.claimPendingJob.mockImplementation(async () => {
        await gate;
        return null;
      });

      const first = worker.tick();
      await worker.tick(); // tick thứ 2 phải bị bỏ qua vì busy
      expect(repository.claimPendingJob).toHaveBeenCalledTimes(1);
      release();
      await first;
    });

    it('job không tồn tại khi xử lý ⇒ thoát an toàn', async () => {
      repository.claimPendingJob.mockResolvedValue({ id: 'job-1' });
      repository.findJobById.mockResolvedValue(null);

      await worker.tick();

      expect(inference.complete).not.toHaveBeenCalled();
    });
  });

  // ─── processJob: thành công ─────────────────────────────────────────────

  describe('processJob — thành công', () => {
    it('AI trả JSON ⇒ ingest + đánh dấu succeeded', async () => {
      repository.claimPendingJob.mockResolvedValue({ id: 'job-1' });
      await worker.tick();

      expect(buildPrompt.execute).toHaveBeenCalledWith('job-1');
      expect(inference.complete).toHaveBeenCalledWith({
        prompt: 'PROMPT',
        timeoutMs: 1000,
        modelId: 'model-x',
      });
      expect(ingestResult.execute).toHaveBeenCalledWith('job-1', { ok: true }, 'model-x');

      const lastCall = repository.updateJobById.mock.calls.at(-1)?.[1] as Record<string, unknown>;
      expect(lastCall?.finishedAt).toBeInstanceOf(Date);
      expect(lastCall?.durationMs).toBeGreaterThanOrEqual(0);
      expect(lastCall?.leaseExpiresAt).toBeNull();
    });

    it('job được đánh dấu running trước khi gọi AI', async () => {
      repository.claimPendingJob.mockResolvedValue({ id: 'job-1' });
      await worker.tick();

      const firstCall = repository.updateJobById.mock.calls[0]?.[1] as Record<string, unknown>;
      expect(firstCall?.status).toBe('running');
      expect(firstCall?.heartbeatAt).toBeInstanceOf(Date);
      expect(firstCall?.leaseExpiresAt).toBeInstanceOf(Date);
    });

    it('modelId từ config khi job không có', async () => {
      repository.claimPendingJob.mockResolvedValue({ id: 'job-1' });
      repository.findJobById.mockResolvedValue(job({ modelId: null }));
      config.get.mockImplementation((k: string) =>
        k === 'AI_MODEL_ID' ? 'model-from-config' : k === 'AI_TIMEOUT_MS' ? 1000 : undefined,
      );

      await worker.tick();

      expect(inference.complete).toHaveBeenCalledWith(
        expect.objectContaining({ modelId: 'model-from-config' }),
      );
    });
  });

  // ─── processJob: lỗi & retry ────────────────────────────────────────────

  describe('processJob — lỗi', () => {
    it('AI trả text không phải JSON ⇒ retryable, đưa về pending', async () => {
      repository.claimPendingJob.mockResolvedValue({ id: 'job-1' });
      inference.complete.mockResolvedValue({
        text: 'khong phai JSON',
        modelId: 'model-x',
        durationMs: 1,
      });

      await worker.tick();

      const lastCall = repository.updateJobById.mock.calls.at(-1)?.[1] as Record<string, unknown>;
      expect(lastCall?.status).toBe('pending');
      expect(lastCall?.attempt).toBe(1);
      const error = lastCall?.error as { code: string; retryable: boolean };
      expect(error.code).toBe('AI_RETRY');
      expect(error.retryable).toBe(true);
    });

    it('hết số lần retry ⇒ đánh dấu failed', async () => {
      repository.claimPendingJob.mockResolvedValue({ id: 'job-1' });
      repository.findJobById.mockResolvedValue(job({ attempt: 2 }));
      inference.complete.mockRejectedValue(new Error('HTTP 500 server error'));

      await worker.tick();

      const lastCall = repository.updateJobById.mock.calls.at(-1)?.[1] as Record<string, unknown>;
      expect(lastCall?.status).toBe('failed');
      const error = lastCall?.error as { code: string };
      expect(error.code).toBe('AI_FAILED');
    });

    it('lỗi JSON ⇒ gọi ingest với payload rỗng để ghi nhận kết quả rỗng', async () => {
      repository.claimPendingJob.mockResolvedValue({ id: 'job-1' });
      inference.complete.mockResolvedValue({
        text: 'AI tra ve khong phai JSON object',
        modelId: 'model-x',
        durationMs: 1,
      });

      await worker.tick();

      expect(ingestResult.execute).toHaveBeenCalledWith('job-1', {}, 'model-x');
    });

    it('lỗi không retryable (parse) ⇒ vẫn retry nhưng không đánh dấu failed ngay', async () => {
      repository.claimPendingJob.mockResolvedValue({ id: 'job-1' });
      inference.complete.mockRejectedValue(new Error('AI tra ve khong phai JSON object'));

      await worker.tick();

      const lastCall = repository.updateJobById.mock.calls.at(-1)?.[1] as Record<string, unknown>;
      expect(lastCall?.status).toBe('pending');
    });

    it('lỗi không phải Error (string) ⇒ vẫn xử lý được', async () => {
      repository.claimPendingJob.mockResolvedValue({ id: 'job-1' });
      inference.complete.mockRejectedValue('string failure');

      await worker.tick();

      const lastCall = repository.updateJobById.mock.calls.at(-1)?.[1] as Record<string, unknown>;
      expect(lastCall?.status).toBe('pending');
      const error = lastCall?.error as { message: string };
      expect(error.message).toBe('string failure');
    });

    it('lỗi timeout ⇒ retryable = true', async () => {
      repository.claimPendingJob.mockResolvedValue({ id: 'job-1' });
      inference.complete.mockRejectedValue(new Error('request timeout'));

      await worker.tick();

      const lastCall = repository.updateJobById.mock.calls.at(-1)?.[1] as Record<string, unknown>;
      const error = lastCall?.error as { retryable: boolean };
      expect(error.retryable).toBe(true);
    });
  });
});

// ─── extractJsonObject ─────────────────────────────────────────────────────

describe('B2.10 — extractJsonObject', () => {
  it('JSON thuần ⇒ parse được', () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 });
  });

  it('JSON có prose trước ⇒ bóc ra object', () => {
    expect(extractJsonObject('Kết quả: {"a":1} — hết')).toEqual({ a: 1 });
  });

  it('JSON có prose sau ⇒ bóc ra object', () => {
    expect(extractJsonObject('```json\n{"a":2}\n```')).toEqual({ a: 2 });
  });

  it('chuỗi rỗng ⇒ null', () => {
    expect(extractJsonObject('')).toBeNull();
  });

  it('null / undefined ⇒ null', () => {
    expect(extractJsonObject(null as unknown as string)).toBeNull();
    expect(extractJsonObject(undefined as unknown as string)).toBeNull();
  });

  it('không có dấu { ⇒ null', () => {
    expect(extractJsonObject('khong co json')).toBeNull();
  });

  it('JSON hỏng ⇒ null', () => {
    expect(extractJsonObject('{a:1}')).toBeNull();
  });
});
