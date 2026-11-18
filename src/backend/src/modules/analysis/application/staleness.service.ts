import { Inject, Injectable } from '@nestjs/common';
import {
  ANALYSIS_REPOSITORY_PORT,
  type AnalysisRepositoryPort,
  type AnalysisResultRecord,
  type AnalysisRunRecord,
} from '../domain/ports/analysis.repository.port';
import { DATASET_REPOSITORY_PORT, type DatasetRepositoryPort } from '../../datasets/domain/ports/dataset.repository.port';
import { computeInputFingerprint, readResolvedRunConfig } from '../domain/input-fingerprint.util';

export interface Freshness {
  isStale: boolean;
  staleReason: string | null;
}

/**
 * D2 — phat hien ket qua loi thoi khi dataset/cot thay doi sau lan chay (doi ten cot, doi kieu/PII,
 * upload dataset moi). So fingerprint luc chay voi fingerprint tinh lai tu dataset hien tai;
 * lech -> ghi `is_stale = true, stale_reason = 'dataset_changed'` (mot lan) va tra ve.
 * Lan chay cu (truoc fingerprint v2) chi dua vao co `is_stale` da luu.
 */
@Injectable()
export class StalenessService {
  constructor(
    @Inject(ANALYSIS_REPOSITORY_PORT)
    private readonly repository: AnalysisRepositoryPort,
    @Inject(DATASET_REPOSITORY_PORT)
    private readonly datasets: DatasetRepositoryPort,
  ) {}

  async assess(projectId: string, run: AnalysisRunRecord | null, result: AnalysisResultRecord): Promise<Freshness> {
    if (result.isStale) return { isStale: true, staleReason: result.staleReason ?? null };
    const cfg = readResolvedRunConfig(run?.config ?? null);
    if (!run || !cfg) return { isStale: false, staleReason: null };
    const current = await this.datasets.findByProject(projectId).catch(() => null);
    const changed =
      !current ||
      String(current.id) !== String(run.datasetId) ||
      computeInputFingerprint(
        { id: String(current.id), fileChecksum: current.fileChecksum, rowCount: current.rowCount, columns: current.columns },
        cfg,
      ) !== run.inputFingerprint;
    if (!changed) return { isStale: false, staleReason: null };
    await this.repository
      .updateResultById(result.id, { is_stale: true, stale_reason: 'dataset_changed' })
      .catch(() => null);
    return { isStale: true, staleReason: 'dataset_changed' };
  }
}
