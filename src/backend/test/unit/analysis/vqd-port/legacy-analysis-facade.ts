/**
 * Lớp tương thích cho test port từ nhánh `Vqd_BE` (Phần 13 v14 mục 3.26).
 *
 * Bộ test đợt A–I (AN-01 → AN-68) được viết cho các service cũ
 * (`AnalysisService`, `SummaryService`, …) đã gỡ ở refactor P1–P6. Lớp này giữ
 * **đúng chữ ký constructor và tên hàm cũ**, bên trong gọi command/query
 * handler hiện hành — để file test port chỉ đổi import, giữ nguyên mock và
 * assert (ràng buộc TC-01, `docs/refactor/13_refactor_constraints.md`).
 *
 * Hai việc chuyển đổi duy nhất:
 *  1. Repo giả của test cũ thiếu vài hàm mà handler mới gọi → `withDefaults`
 *     bổ sung hàm trung tính (trả `null` / `0` / `[]`), không đụng mock có sẵn.
 *  2. Handler mới ném `DomainError`; test cũ chờ exception của Nest → `toHttp`
 *     đổi theo đúng bảng `httpStatusForErrorCode` (AC-04), response
 *     `{ error: code, message, details }` như service cũ.
 *
 * Chỉ giữ các hàm mà test còn hiệu lực (nhóm B) dùng: `runAnalysis`, `retryJob`, `createSummary`.
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { DomainError } from '../../../../src/shared/domain/errors/domain-error';
import { httpStatusForErrorCode } from '../../../../src/shared/interfaces/errors/error-http-mapping';
import { RunAnalysisHandler } from '../../../../src/modules/analysis/application/commands/run-analysis.handler';
import { RetryJobHandler } from '../../../../src/modules/analysis/application/commands/retry-job.handler';
import { CreateSummaryHandler } from '../../../../src/modules/analysis/application/commands/create-summary.handler';
import type { RunAnalysisInput } from '../../../../src/modules/analysis/application/analysis.types';

type Obj = Record<string, unknown>;

/** Hàm handler mới gọi mà repo giả của test cũ có thể chưa có → giá trị trung tính. */
const NEUTRAL: Record<string, (...a: unknown[]) => unknown> = {
  // RetryJobHandler mới tạo job mới (thay vì cập nhật job cũ) → mock cũ không có createJob
  createJob: (d) => ({ id: 'job-retry', ...(d as Obj) }),
  findRunByFingerprint: () => null,
  findLatestRunByProject: () => null,
  findLatestSaveByProject: () => null,
  countEvidencesByRun: () => 0,
  findEvidencesByRun: () => [],
  insertEvidences: () => 0,
  markResultsStale: () => undefined,
  markSavesStale: () => undefined,
  updateResultById: () => null,
  updateJobById: () => null,
  updateById: () => null,
  heartbeatJob: () => null,
  skipStaleJobs: () => 0,
  findFewShotCandidates: () => [],
  countFewShotExamples: () => 0,
};

/** Bọc repo/port giả: giữ nguyên mock có sẵn, chỉ thêm hàm còn thiếu. */
export function withDefaults<T extends object>(target: T, extra: Record<string, (...a: unknown[]) => unknown> = NEUTRAL): T {
  return new Proxy(target, {
    get(obj, prop, recv) {
      const v = Reflect.get(obj, prop, recv) as unknown;
      if (v !== undefined || typeof prop !== 'string') return v;
      const d = extra[prop];
      return d ? async (...a: unknown[]) => d(...a) : undefined;
    },
  });
}

/** DomainError → exception Nest như service cũ (status theo AC-04). */
export function toHttp(err: unknown): unknown {
  if (!(err instanceof DomainError)) return err;
  const body = { error: err.code, message: err.message, details: err.details };
  const status = (err as unknown as { status?: number }).status ?? httpStatusForErrorCode(err.code);
  switch (status) {
    case 400:
      return new BadRequestException(body);
    case 403:
      return new ForbiddenException(body);
    case 404:
      return new NotFoundException(body);
    case 409:
      return new ConflictException(body);
    case 413:
      return new PayloadTooLargeException(body);
    default:
      return new HttpException(body, status);
  }
}
async function call<R>(f: () => Promise<R>): Promise<R> {
  try {
    return await f();
  } catch (e) {
    throw toHttp(e);
  }
}

/** Chỉ để giữ nguyên dòng khởi tạo của test cũ; service này đã gỡ (không có hàm). */
export class RemovedServicePlaceholder {
  constructor(..._args: unknown[]) {}
}

/**
 * `AnalysisService` cũ:
 * `(repo, projects, datasets, records, config, access, staleness, realtime?, rag?, outbox?, notifications?)`.
 * `access`, `staleness`, `outbox`, `notifications` không còn được handler dùng.
 */
export class LegacyAnalysisService {
  private readonly run: RunAnalysisHandler;
  private readonly retry: RetryJobHandler;

  constructor(
    repo: object,
    projects: object,
    datasets: object,
    records: object,
    config: object,
    _access?: unknown,
    _staleness?: unknown,
    realtime?: object,
    rag?: object,
    _outbox?: unknown,
    _notifications?: unknown,
  ) {
    const r = withDefaults(repo) as never;
    const p = withDefaults(projects, { setHasDataset: () => true }) as never;
    const d = withDefaults(datasets, { findById: () => null, findByProject: () => null }) as never;
    this.run = new RunAnalysisHandler(p, d, r, records as never, rag as never, config as never, realtime as never);
    this.retry = new RetryJobHandler(r);
  }

  runAnalysis(projectId: string, dto: RunAnalysisInput, userId?: string): Promise<Obj> {
    return call(() => this.run.execute(projectId, dto, userId));
  }
  retryJob(jobId: string): Promise<Obj> {
    return call(() => this.retry.execute(jobId));
  }
}

/** `SummaryService` cũ: `(repo, projects, staleness)`. */
export class LegacySummaryService {
  private readonly create: CreateSummaryHandler;

  constructor(repo: object, projects: object, _staleness?: unknown) {
    const r = withDefaults(repo) as never;
    const p = withDefaults(projects) as never;
    this.create = new CreateSummaryHandler(p, r);
  }
  createSummary(projectId: string): Promise<Obj> {
    return call(() => this.create.execute(projectId));
  }
}
