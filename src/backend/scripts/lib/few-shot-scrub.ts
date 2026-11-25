/**
 * Logic của migration `scrub-few-shot` (đóng OPEN-FB-01) — Phần 12 v17 §3.24
 * (T1-7…T1-10), Phần 11 v5 mục 3.18.
 *
 * Tách khỏi `scripts/migrate-scrub-few-shot-examples.ts` để test bằng Mongo thật
 * (`test/integration/few-shot-scrub.spec.ts`). Khuôn mẫu và cách tính đồng thuận
 * dùng **chung** hàm thuần với `FeedbackService.syncFindingExample`.
 */
import type { Model, Types } from 'mongoose';
import {
  buildFindingExampleDraft,
  isTemplatedDescription,
} from '../../src/modules/feedback/feedback-example-template';
import {
  MAX_FEW_SHOT_STORE,
  computeTrustScore,
  embedText,
  isEligibleForStore,
  mapFeedbackLabelToExampleLabel,
} from '../../src/modules/analysis/domain/rag-few-shot.util';
import type { IFewShotExample } from '../../src/modules/analysis/infrastructure/persistence/few-shot-example.schema';
import type { IFindingFeedback } from '../../src/modules/feedback/finding-feedback.schema';
import {
  DEFAULT_EMBEDDING_DIM,
  normalizeEmbeddingDim,
} from '../../src/shared/domain/utils/embedding-dim.util';

export type FewShotScrubMode = 'dry-run' | 'apply' | 'verify';

export interface FewShotScrubReport {
  script: 'migrate-scrub-few-shot-examples';
  mode: FewShotScrubMode;
  /** Mẫu còn sống đã quét. */
  scanned: number;
  /** Mẫu không theo khuôn (T1-7) — dry-run: sẽ xoá mềm; apply: đã xoá mềm. */
  nonTemplated: number;
  nonTemplatedByWorkspace: Record<string, number>;
  softDeleted: number;
  /** `_id` đã xoá mềm (chỉ khi apply) — để rollback (Phần 11 v5 mục 3.18). */
  softDeletedIds: string[];
  /** Nhóm (workspace, finding, nhãn mẫu) từ nhận xét còn hiệu lực. */
  groups: number;
  created: number;
  updated: number;
  unchanged: number;
  /** Nhóm chưa có mẫu và chưa đủ 3 người → không tạo. */
  belowThreshold: number;
  /** Mẫu còn sống không theo khuôn sau khi chạy (verify/apply phải = 0). */
  remainingNonTemplated: number;
}

/** Model tối thiểu — dựng từ đúng schema của app (`FewShotExampleSchema`, `FindingFeedbackSchema`). */
export interface FewShotScrubModels {
  fewShot: Model<IFewShotExample>;
  feedback: Model<IFindingFeedback>;
}

export interface FewShotScrubOptions extends FewShotScrubModels {
  mode: FewShotScrubMode;
  /**
   * Như `RagFewShotService.embeddingDim()` — mặc định lấy từ
   * `DEFAULT_EMBEDDING_DIM` (nguồn sự thật duy nhất, OPEN-FB-02).
   */
  embeddingDim?: number;
  now?: Date;
}

interface ExampleRow {
  _id: Types.ObjectId;
  workspace_id: Types.ObjectId;
  error_type: string;
  column_traits?: string | null;
  description: string;
  label: string;
}

const BATCH = 5_000;

function sameVector(a: readonly number[] | undefined, b: readonly number[]): boolean {
  if (!a || a.length !== b.length) return false;
  return a.every((x, i) => x === b[i]);
}

/** Mẫu còn sống không theo khuôn (T1-7). */
async function findNonTemplated(fewShot: FewShotScrubModels['fewShot']): Promise<{
  scanned: number;
  ids: Types.ObjectId[];
  byWorkspace: Record<string, number>;
}> {
  const ids: Types.ObjectId[] = [];
  const byWorkspace: Record<string, number> = {};
  let scanned = 0;
  const cursor = fewShot
    .find({ deleted_at: null })
    .select('_id workspace_id error_type column_traits description label')
    .lean<ExampleRow>()
    .cursor();
  for await (const doc of cursor as AsyncIterable<ExampleRow>) {
    scanned++;
    const ok = isTemplatedDescription({
      label: doc.label,
      errorType: doc.error_type,
      columnTraits: doc.column_traits,
      description: doc.description,
    });
    if (ok) continue;
    ids.push(doc._id);
    const ws = String(doc.workspace_id);
    byWorkspace[ws] = (byWorkspace[ws] ?? 0) + 1;
  }
  return { scanned, ids, byWorkspace };
}

interface FeedbackGroup {
  workspaceId: Types.ObjectId;
  projectId: Types.ObjectId | null;
  findingId: string;
  exampleLabel: string;
  authors: Set<string>;
}

/** Gom nhận xét còn hiệu lực theo (workspace, finding, nhãn mẫu) — T1-3. */
async function collectGroups(feedback: FewShotScrubModels['feedback']): Promise<FeedbackGroup[]> {
  const rows = await feedback
    .aggregate<{
      _id: { ws: Types.ObjectId; fid: string; label: string };
      project: Types.ObjectId | null;
      authors: Types.ObjectId[];
    }>([
      { $match: { deleted_at: null, finding_id: { $nin: [null, ''] } } },
      {
        $group: {
          _id: { ws: '$workspace_id', fid: '$finding_id', label: '$label' },
          project: { $first: '$project_id' },
          authors: { $addToSet: '$author_id' },
        },
      },
    ])
    .exec();
  const groups = new Map<string, FeedbackGroup>();
  for (const r of rows) {
    const exampleLabel = mapFeedbackLabelToExampleLabel(r._id.label);
    if (!exampleLabel) continue;
    const key = `${String(r._id.ws)}|${r._id.fid}|${exampleLabel}`;
    const g =
      groups.get(key) ??
      ({
        workspaceId: r._id.ws,
        projectId: r.project ?? null,
        findingId: r._id.fid,
        exampleLabel,
        authors: new Set<string>(),
      } satisfies FeedbackGroup);
    for (const a of r.authors) g.authors.add(String(a));
    groups.set(key, g);
  }
  return [...groups.values()];
}

/** Giữ trần kho như `AnalysisRepository.enforceFewShotCap` (FIFO). */
async function enforceCap(fewShot: FewShotScrubModels['fewShot'], now: Date): Promise<void> {
  const total = await fewShot.countDocuments({ deleted_at: null }).exec();
  const excess = total - MAX_FEW_SHOT_STORE;
  if (excess <= 0) return;
  const oldest = await fewShot
    .find({ deleted_at: null })
    .sort({ created_at: 1 })
    .limit(excess)
    .select('_id')
    .lean<{ _id: Types.ObjectId }>()
    .exec();
  const ids = (oldest as unknown as { _id: Types.ObjectId }[]).map((d) => d._id);
  if (ids.length > 0) await fewShot.updateMany({ _id: { $in: ids } }, { $set: { deleted_at: now } }).exec();
}

export async function runFewShotScrub(opts: FewShotScrubOptions): Promise<FewShotScrubReport> {
  const { fewShot, feedback, mode } = opts;
  const now = opts.now ?? new Date();
  const dim = normalizeEmbeddingDim(opts.embeddingDim ?? DEFAULT_EMBEDDING_DIM);
  const write = mode === 'apply';

  // ── Bước 1: quét + xoá mềm mẫu không theo khuôn (T1-7, T1-8) ─────────────
  const scan = await findNonTemplated(fewShot);
  const report: FewShotScrubReport = {
    script: 'migrate-scrub-few-shot-examples',
    mode,
    scanned: scan.scanned,
    nonTemplated: scan.ids.length,
    nonTemplatedByWorkspace: scan.byWorkspace,
    softDeleted: 0,
    softDeletedIds: [],
    groups: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    belowThreshold: 0,
    remainingNonTemplated: scan.ids.length,
  };
  if (mode === 'verify') return report;

  if (write) {
    for (let i = 0; i < scan.ids.length; i += BATCH) {
      const batch = scan.ids.slice(i, i + BATCH);
      const res = await fewShot
        .updateMany({ _id: { $in: batch }, deleted_at: null }, { $set: { deleted_at: now } })
        .exec();
      report.softDeleted += res.modifiedCount ?? 0;
    }
    report.softDeletedIds = scan.ids.map(String);
  }

  // ── Bước 2: dựng lại mẫu theo khuôn từ nhận xét còn hiệu lực (T1-9) ──────
  const groups = await collectGroups(feedback);
  report.groups = groups.length;
  for (const g of groups) {
    const draft = buildFindingExampleDraft(g.findingId, g.exampleLabel);
    if (!draft) continue;
    const agreement = g.authors.size;
    const trustScore = computeTrustScore(agreement);
    const embedding = embedText(draft.queryText, dim);
    const existing = await fewShot
      .findOne({
        workspace_id: g.workspaceId,
        error_type: draft.errorType,
        description: draft.description,
        label: draft.exampleLabel,
        deleted_at: null,
      })
      .select('_id agreement_count trust_score embedding')
      .lean<{ _id: Types.ObjectId; agreement_count: number; trust_score: number; embedding: number[] }>()
      .exec();
    if (existing) {
      const same =
        existing.agreement_count === agreement &&
        existing.trust_score === trustScore &&
        sameVector(existing.embedding, embedding);
      if (same) {
        report.unchanged++;
        continue;
      }
      if (write) {
        await fewShot
          .updateOne(
            { _id: existing._id, deleted_at: null },
            { $set: { agreement_count: agreement, trust_score: trustScore, embedding } },
          )
          .exec();
      }
      report.updated++;
      continue;
    }
    if (!isEligibleForStore(agreement, trustScore)) {
      report.belowThreshold++;
      continue;
    }
    if (write) {
      await fewShot.create({
        workspace_id: g.workspaceId,
        project_id: g.projectId,
        error_type: draft.errorType,
        column_traits: draft.columnTraits,
        description: draft.description,
        label: draft.exampleLabel,
        embedding,
        trust_score: trustScore,
        language: 'vi',
        agreement_count: agreement,
        deleted_at: null,
      });
    }
    report.created++;
  }
  if (write && report.created > 0) await enforceCap(fewShot, now);

  report.remainingNonTemplated = write ? (await findNonTemplated(fewShot)).ids.length : scan.ids.length;
  return report;
}

/**
 * Số chiều embedding như `RagFewShotService.embeddingDim()` (biến môi trường `EMBEDDING_DIM`).
 *
 * Dùng chung `DEFAULT_EMBEDDING_DIM` + `normalizeEmbeddingDim` với runtime để
 * **không thể** lệch chiều (OPEN-FB-02). Trước đây fallback cục bộ là `64`
 * trong khi runtime thực tế dùng `1024` → mẫu do migration ghi ra không bao
 * giờ khớp truy vấn (`cosineSimilarity` trả 0 khi lệch chiều).
 */
export function embeddingDimFromEnv(raw: string | undefined): number {
  return normalizeEmbeddingDim(raw === undefined || raw === '' ? DEFAULT_EMBEDDING_DIM : Number(raw));
}
