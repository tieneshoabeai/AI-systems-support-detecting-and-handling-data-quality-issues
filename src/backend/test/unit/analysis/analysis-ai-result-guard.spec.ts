/**
 * Phần 13 v17 mục 3.30 — VAT-06 / VAT-07 (Phần 7 v15 mục 3.25 VA-1, VA-2;
 * Phần 6 v9 §3.22): `POST /analysis/jobs/:jobId/result` chỉ SYS-ADMIN, tắt ở
 * production; audit khi thử lại / nạp kết quả AI qua HTTP.
 */
import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import { CaslAbilityFactory } from '../../../src/shared/interfaces/casl/casl-ability.factory';
import { CHECK_POLICIES_KEY, type PolicyHandler } from '../../../src/shared/interfaces/casl/check-policies.decorator';
import { Action } from '../../../src/shared/domain/security/action';
import type { CurrentUser } from '../../../src/shared/domain/security/current-user';
import { AnalysisController } from '../../../src/modules/analysis/presentation/controllers/analysis.controller';
import { IngestAiResultHandler } from '../../../src/modules/analysis/application/commands/ingest-ai-result.handler';
import { RetryJobHandler } from '../../../src/modules/analysis/application/commands/retry-job.handler';
import { NotFoundError } from '../../../src/shared/domain/errors';
import type { AnalysisRepositoryPort } from '../../../src/modules/analysis/domain/ports/analysis.repository.port';
import type { AuditLoggerPort } from '../../../src/modules/audit';

const ws = new Types.ObjectId().toHexString();
const project = new Types.ObjectId().toHexString();
const jobId = new Types.ObjectId().toHexString();
const runId = new Types.ObjectId().toHexString();

function user(over: Partial<CurrentUser>): CurrentUser {
  return { userId: new Types.ObjectId().toHexString(), role: 'analyst', ...over } as CurrentUser;
}

function ingestPolicy(): PolicyHandler {
  const handlers = Reflect.getMetadata(
    CHECK_POLICIES_KEY,
    AnalysisController.prototype.ingestAiResult,
  ) as PolicyHandler[];
  expect(handlers).toHaveLength(1);
  return handlers[0] as PolicyHandler;
}

describe('VAT-06 — POST /analysis/jobs/:jobId/result chỉ SYS-ADMIN (VA-1)', () => {
  const factory = new CaslAbilityFactory();

  it.each([
    ['WS-OWNER', user({ ownedWorkspaceIds: [ws], workspaceIds: [ws] })],
    ['PROJ-OWNER', user({ workspaceIds: [ws], projectRoles: { [project]: 'owner' } })],
    ['PROJ-MEMBER', user({ workspaceIds: [ws], projectRoles: { [project]: 'member' } })],
    ['PROJ-VIEWER', user({ workspaceIds: [ws], projectRoles: { [project]: 'viewer' } })],
  ])('%s ⇒ policy của route trả false (trước đây PROJ-MEMBER+ được)', async (_label, u) => {
    const ability = factory.createForUser(u);
    // Vẫn chạy được phân tích — chỉ route nạp kết quả thủ công bị siết.
    expect(await ingestPolicy()(ability as never)).toBe(false);
  });

  it('SYS-ADMIN ⇒ policy trả true', async () => {
    const ability = factory.createForUser(user({ role: 'admin' }));
    expect(await ingestPolicy()(ability as never)).toBe(true);
  });

  it('PROJ-MEMBER vẫn thử lại được job AI (route retry không đổi quyền)', async () => {
    const handlers = Reflect.getMetadata(
      CHECK_POLICIES_KEY,
      AnalysisController.prototype.retryJob,
    ) as PolicyHandler[];
    const ability = factory.createForUser(user({ workspaceIds: [ws], projectRoles: { [project]: 'member' } }));
    expect(ability.can(Action.Execute, 'Analysis')).toBe(true);
    expect(await (handlers[0] as PolicyHandler)(ability as never)).toBe(true);
  });

  it('NODE_ENV=production ⇒ NOT_FOUND, không gọi handler', async () => {
    const ingest = { execute: jest.fn() };
    const config = { get: jest.fn().mockImplementation((k: string) => (k === 'NODE_ENV' ? 'production' : undefined)) };
    const controller = new AnalysisController(
      ingest as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      config as unknown as ConfigService,
    );
    await expect(
      controller.ingestAiResult(jobId, { userId: 'u', role: 'admin' } as never, { result: {} }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(ingest.execute).not.toHaveBeenCalled();
  });

  it('không có ConfigService (test module tự dựng) + process.env NODE_ENV=production ⇒ vẫn NOT_FOUND', async () => {
    const ingest = { execute: jest.fn() };
    const saved = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const controller = new AnalysisController(ingest as never, {} as never, {} as never, {} as never, {} as never);
      await expect(
        controller.ingestAiResult(jobId, { userId: 'u', role: 'admin' } as never, { result: {} }),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(ingest.execute).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = saved;
    }
  });

  it('ngoài production ⇒ chuyển actor xuống handler', async () => {
    const ingest = { execute: jest.fn().mockResolvedValue({ jobId, status: 'failed' }) };
    const config = { get: jest.fn().mockReturnValue('development') };
    const controller = new AnalysisController(
      ingest as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      config as unknown as ConfigService,
    );
    await controller.ingestAiResult(jobId, { userId: 'admin-1', role: 'admin' } as never, { result: {}, modelId: 'm' });
    expect(ingest.execute).toHaveBeenCalledWith(jobId, {}, 'm', { userId: 'admin-1', role: 'admin' });
  });
});

describe('VAT-07 — audit job AI (VA-2)', () => {
  const job = {
    id: jobId,
    analysisRunId: runId,
    projectId: project,
    datasetId: new Types.ObjectId().toHexString(),
    inputFingerprint: 'fp',
    status: 'failed',
    attempt: 1,
    modelId: 'qwen3',
    promptVersion: 'corr-v1',
  };

  function repo(over: Partial<Record<keyof AnalysisRepositoryPort, jest.Mock>> = {}): AnalysisRepositoryPort {
    return {
      findJobById: jest.fn().mockResolvedValue(job),
      findResultByRun: jest.fn().mockResolvedValue({
        id: 'res1',
        correlationMatrix: { cells: [] },
        vif: { rows: [] },
      }),
      updateJobById: jest.fn().mockResolvedValue(job),
      updateResultById: jest.fn().mockResolvedValue({ aiCorrelationAssessment: { status: 'failed' } }),
      createJob: jest.fn().mockResolvedValue({ id: 'job2', status: 'pending', attempt: 2 }),
      ...over,
    } as unknown as AnalysisRepositoryPort;
  }

  it('retry qua HTTP ⇒ AI_JOB_RETRIED (actor, jobId, projectId)', async () => {
    const audit: AuditLoggerPort = { log: jest.fn().mockResolvedValue(undefined) };
    const handler = new RetryJobHandler(repo(), audit);
    await handler.execute(jobId, { userId: 'u1', role: 'analyst' });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'AI_JOB_RETRIED',
        targetType: 'ai_job',
        targetId: jobId,
        actorId: 'u1',
        projectId: project,
        metadata: expect.objectContaining({ newJobId: 'job2' }),
      }),
    );
  });

  it('nạp kết quả qua HTTP ⇒ AI_RESULT_INGESTED; worker (không actor) ⇒ không ghi', async () => {
    const audit: AuditLoggerPort = { log: jest.fn().mockResolvedValue(undefined) };
    const handler = new IngestAiResultHandler(repo(), undefined as never, audit);
    await handler.execute(jobId, {}, 'm', { userId: 'admin-1', role: 'admin' });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'AI_RESULT_INGESTED',
        targetId: jobId,
        actorId: 'admin-1',
        projectId: project,
      }),
    );
    (audit.log as jest.Mock).mockClear();
    await handler.execute(jobId, {}, 'm');
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('job đã bị thay thế (skipped) ⇒ vẫn ghi audit với status skipped', async () => {
    const audit: AuditLoggerPort = { log: jest.fn().mockResolvedValue(undefined) };
    const handler = new IngestAiResultHandler(
      repo({ findJobById: jest.fn().mockResolvedValue({ ...job, status: 'skipped' }) }),
      undefined as never,
      audit,
    );
    const r = await handler.execute(jobId, {}, undefined, { userId: 'admin-1', role: 'admin' });
    expect(r.skipped).toBe(true);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ status: 'skipped' }) }),
    );
  });
});
