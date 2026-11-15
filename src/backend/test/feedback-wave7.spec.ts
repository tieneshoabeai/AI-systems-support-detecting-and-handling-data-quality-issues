import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { FeedbackService } from '../src/modules/feedback/application/feedback.service';
import { FEEDBACK_REPOSITORY_PORT } from '../src/modules/feedback/domain/ports/feedback.repository.port';
import { ANALYSIS_REPOSITORY_PORT } from '../src/modules/analysis/domain/ports/analysis.repository.port';
import { ProjectsService } from '../src/modules/projects/application/projects.service';
import { WorkspacesService } from '../src/modules/workspaces/application/workspaces.service';
import { UsersService } from '../src/modules/users/application/users.service';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';

const runId = new Types.ObjectId();
const projectId = new Types.ObjectId();
const workspaceId = new Types.ObjectId();
const userId = new Types.ObjectId().toHexString();
const otherId = new Types.ObjectId().toHexString();

function docOf(over: Record<string, unknown> = {}) {
  const d = {
    id: new Types.ObjectId().toHexString(),
    analysisRunId: runId.toHexString(),
    findingId: 'DQ-01:colA',
    projectId: projectId.toHexString(),
    workspaceId: workspaceId.toHexString(),
    label: 'correct',
    reason: null,
    suggestedSeverity: null,
    aiConfidence: null,
    aiRationale: null,
    authorId: userId,
    authorRoleAtTime: 'viewer',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
  return d;
}

async function build(deps: {
  repo?: Record<string, jest.Mock>;
  run?: Record<string, unknown> | null;
  projectRole?: string | null;
  workspaceRole?: 'owner' | 'member' | null;
  meFirst?: string;
  meLast?: string;
}) {
  const runDoc =
    deps.run === undefined
      ? { id: runId.toHexString(), projectId: projectId.toHexString(), workspaceId: workspaceId.toHexString(), datasetId: new Types.ObjectId().toHexString(), status: 'succeeded', inputFingerprint: 'fp', config: {}, startedBy: null, startedAt: null, finishedAt: null, durationMs: null, error: null, createdAt: new Date(), updatedAt: new Date() }
      : deps.run;
  const repoVal = {
    create: jest.fn().mockImplementation(async (d: Record<string, unknown>) => docOf(d)),
    listByScope: jest.fn().mockResolvedValue([]),
    findByIdActive: jest.fn().mockResolvedValue(null),
    updateById: jest.fn(),
    softDelete: jest.fn(),
    countByProject: jest.fn().mockResolvedValue(0),
    aggregateByProject: jest.fn().mockResolvedValue([]),
    countDistinctRuns: jest.fn().mockResolvedValue(0),
    ...(deps.repo ?? {}),
  };
  const m: TestingModule = await Test.createTestingModule({
    providers: [
      FeedbackService,
      { provide: FEEDBACK_REPOSITORY_PORT, useValue: repoVal },
      {
        provide: ANALYSIS_REPOSITORY_PORT,
        useValue: {
          findById: jest.fn().mockResolvedValue(runDoc),
          findResultByRun: jest.fn().mockResolvedValue(null),
          findDuplicateExample: jest.fn().mockResolvedValue(null),
          saveFewShotExample: jest.fn(),
          updateFewShotTrust: jest.fn(),
        },
      },
      {
        provide: ProjectsService,
        useValue: {
          getProjectById: jest.fn().mockResolvedValue({
            id: projectId.toHexString(),
            workspaceId: workspaceId.toHexString(),
          }),
          resolveUserProjectRole: jest.fn().mockResolvedValue(deps.projectRole ?? 'viewer'),
        },
      },
      {
        provide: WorkspacesService,
        useValue: {
          resolveUserWorkspaceRole: jest.fn().mockResolvedValue(deps.workspaceRole ?? 'member'),
        },
      },
      {
        provide: UsersService,
        useValue: {
          findById: jest.fn().mockResolvedValue({
            firstName: deps.meFirst ?? 'A',
            lastName: deps.meLast ?? 'B',
          }),
        },
      },
    ],
  }).compile();
  return { service: m.get<FeedbackService>(FeedbackService), repoVal };
}

describe('Wave7 FB-01/FB-02: tao nhan xet', () => {
  it('FB-01 tao nhan xet finding, viewer duoc phep', async () => {
    const { service, repoVal } = await build({});
    const r = (await service.createFindingFeedback(userId, 'analyst', runId.toHexString(), 'DQ-01:age', {
      label: 'correct',
    })) as Record<string, unknown>;
    expect(r.label).toBe('correct');
    expect(repoVal.create).toHaveBeenCalled();
  });

  it('FB-01 thieu reason voi false_positive -> 400', async () => {
    const { service } = await build({});
    await expect(
      service.createFindingFeedback(userId, 'analyst', runId.toHexString(), 'DQ-01:age', {
        label: 'false_positive',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('FB-01 Zod chan reason qua 2000 ky tu', async () => {
    const { CreateFeedbackSchema } = await import(
      '../src/modules/feedback/infrastructure/http/dtos/feedback.dto'
    );
    expect(
      CreateFeedbackSchema.safeParse({ label: 'other', reason: 'x'.repeat(2001) }).success,
    ).toBe(false);
    expect(
      CreateFeedbackSchema.safeParse({ label: 'false_positive' }).success,
    ).toBe(false);
  });

  it('FB-01 admin bi chan (SYS-ADMIN khong co quyen FB-*)', async () => {
    const { service } = await build({});
    await expect(
      service.createFindingFeedback(userId, 'admin', runId.toHexString(), 'DQ-01:age', {
        label: 'correct',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('FB-02 tao nhan xet cap run (finding_id null)', async () => {
    const { service, repoVal } = await build({});
    await service.createRunFeedback(userId, 'analyst', runId.toHexString(), {
      label: 'partially_correct',
      reason: 'thieu DQ-03',
    });
    expect(repoVal.create).toHaveBeenCalledWith(
      expect.objectContaining({ findingId: null }),
    );
  });
});

describe('Wave7 FB-03/FB-04: xem + tong hop + an danh', () => {
  it('tra items/meta/summary; nguoi khac chi thay ten hien thi', async () => {
    const d1 = docOf({ authorId: otherId });
    const d2 = docOf({ authorId: userId, label: 'false_positive' });
    const { service } = await build({
      repo: {
        listByScope: jest
          .fn()
          .mockResolvedValueOnce([d1, d2])
          .mockResolvedValueOnce([d1, d2]),
      },
    });
    const r = await service.listFindingFeedback(userId, 'analyst', runId.toHexString(), 'DQ-01:age', {
      limit: 20,
      sortOrder: 'desc',
    });
    expect(r.items).toHaveLength(2);
    expect(r.meta).toHaveProperty('hasMore');
    expect(r.summary).toEqual({ correct: 1, false_positive: 1 });
    const first = r.items[0] as Record<string, unknown>;
    expect(first.isMine).toBe(false);
    expect(first).not.toHaveProperty('authorId');
    expect(first).toHaveProperty('authorDisplayName');
  });

  it('cursor sai -> 400', async () => {
    const { service } = await build({});
    await expect(
      service.listRunFeedback(userId, 'analyst', runId.toHexString(), {
        limit: 10,
        sortOrder: 'desc',
        cursor: 'sai',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('Wave7 FB-05: sua/xoa', () => {
  it('chi chu duoc sua; nguoi khac -> 403', async () => {
    const existing = docOf({ authorId: userId });
    const { service } = await build({
      repo: {
        findByIdActive: jest.fn().mockResolvedValue(existing),
        updateById: jest.fn().mockImplementation(async (_id: string, _u: unknown) => ({
          ...existing,
          label: 'partially_correct',
        })),
      },
    });
    const r = (await service.updateMine(userId, existing.id, {
      label: 'partially_correct',
    })) as Record<string, unknown>;
    expect(r.label).toBe('partially_correct');
    const s2 = (
      await build({
        repo: { findByIdActive: jest.fn().mockResolvedValue(existing) },
      })
    ).service;
    await expect(
      s2.updateMine(otherId, existing.id, { label: 'correct' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('sua sang false_positive ma thieu reason -> 400', async () => {
    const existing = docOf({ authorId: userId, reason: null });
    const { service } = await build({
      repo: { findByIdActive: jest.fn().mockResolvedValue(existing) },
    });
    await expect(
      service.updateMine(userId, existing.id, { label: 'false_positive' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('owner duoc xoa vi pham (ghi log), nguoi la -> 403', async () => {
    const existing = docOf({ authorId: otherId });
    const b = await build({
      projectRole: 'viewer',
      workspaceRole: 'member',
      repo: { findByIdActive: jest.fn().mockResolvedValue(existing), softDelete: jest.fn() },
    });
    await expect(b.service.remove(userId, 'analyst', existing.id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    const b2 = await build({
      projectRole: 'owner',
      workspaceRole: 'member',
      repo: { findByIdActive: jest.fn().mockResolvedValue(existing), softDelete: jest.fn() },
    });
    const r = await b2.service.remove(userId, 'analyst', existing.id);
    expect(r.deleted).toBe(true);
  });

  it('khong tim thay -> 404', async () => {
    const { service } = await build({});
    await expect(service.remove(userId, 'analyst', new Types.ObjectId().toHexString())).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('Wave7 FB-06 + append-only/TTL', () => {
  it('FB-06 chi owner/member; viewer -> 403; tong co mau so', async () => {
    const ok = await build({
      projectRole: 'member',
      repo: {
        aggregateByProject: jest.fn().mockResolvedValue([
          { label: 'correct', count: 3 },
          { label: 'false_positive', count: 1 },
        ]),
        countByProject: jest.fn().mockResolvedValue(4),
        countDistinctRuns: jest.fn().mockResolvedValue(2),
      },
    });
    const r = (await ok.service.aiQualityMetrics(userId, 'analyst', projectId.toHexString())) as Record<string, unknown>;
    expect(r.total).toBe(4);
    expect(r.falsePositiveRate).toBe(0.25);

    const denied = await build({ projectRole: 'viewer' });
    await expect(
      denied.service.aiQualityMetrics(userId, 'analyst', projectId.toHexString()),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('schema append-only: TTL 365 ngay + index scope', async () => {
    const { FindingFeedbackSchema } = await import(
      '../src/modules/feedback/infrastructure/persistence/finding-feedback.schema'
    );
    const idx = FindingFeedbackSchema.indexes() as Array<[Record<string, unknown>, Record<string, unknown>?]>;
    const hasScope = idx.some(([k]) => 'analysis_run_id' in k && 'finding_id' in k);
    const hasProject = idx.some(([k]) => 'project_id' in k);
    const ttl = idx.find(([, o]) => o && (o as Record<string, unknown>).expireAfterSeconds === 365 * 24 * 60 * 60);
    expect(hasScope).toBe(true);
    expect(hasProject).toBe(true);
    expect(ttl).toBeDefined();
  });
});
