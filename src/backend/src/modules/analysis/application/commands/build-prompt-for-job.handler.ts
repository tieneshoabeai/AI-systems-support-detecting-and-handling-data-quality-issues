/**
 * BuildPromptForJobHandler — Use case: `buildPromptForJob()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { Inject, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ANALYSIS_REPOSITORY_PORT,
  type AnalysisRepositoryPort,
} from '../../domain/ports/analysis.repository.port';
import { DATASET_REPOSITORY_PORT, type DatasetRepositoryPort } from '../../../datasets';
import { RECORD_QUERY_PORT, type RecordQueryPort } from '../../../datasets';
import { classifyColumn } from '../../domain/correlation.util';
import { buildCorrV1Prompt } from '../../domain/ai-grounding.util';
import { RagFewShotService } from '../services/rag-few-shot.service';
import { maskSampleValue } from '../analysis.utils';
import { NotFoundError } from '../../../../shared/domain/errors';
import {
  assertAnalysisRowLimit,
  resolveAnalysisMaxRows,
} from '../analysis-limit.util';

@Injectable()
export class BuildPromptForJobHandler {
  constructor(
    @Inject(ANALYSIS_REPOSITORY_PORT)
    private readonly analysisRepository: AnalysisRepositoryPort,
    @Inject(DATASET_REPOSITORY_PORT)
    private readonly datasetsRepository: DatasetRepositoryPort,
    @Inject(RECORD_QUERY_PORT)
    private readonly records: RecordQueryPort,
    @Optional()
    private readonly ragFewShot: RagFewShotService,
    private readonly configService: ConfigService,
  ) {}

  async execute(jobId: string): Promise<string> {
    const job = await this.analysisRepository.findJobById(jobId);
    if (!job) throw new NotFoundError('Không tìm thấy AI job');
    const result = await this.analysisRepository.findResultByRun(
      (job.analysisRunId as string).toString(),
    );
    if (!result || !result.correlationMatrix || !result.vif) {
      throw new NotFoundError('Kết quả hệ thống chưa sẵn sàng để dựng prompt AI');
    }
    if (!job.datasetId) throw new NotFoundError('AI job thiếu dataset');
    const dataset = await this.datasetsRepository.findById(job.datasetId);
    // GĐ0d — chặn sớm theo số dòng, trước khi nạp dataset lần thứ 2 vào RAM.
    if (dataset) {
      assertAnalysisRowLimit(
        dataset.rowCount,
        resolveAnalysisMaxRows(this.configService.get('ANALYSIS_MAX_ROWS')),
      );
    }
    const recordRows2 = await this.records.listAllRecords(job.datasetId);
    const keyToName = new Map((dataset?.columns ?? []).map((c) => [c.key, c.name] as const));
    // GĐ0b — tạo object `named` đúng một lần cho mỗi dòng (không nhân đôi).
    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < recordRows2.length; i++) {
      const r = recordRows2[i] as unknown as {
        props?: Record<string, unknown>;
        data?: Record<string, unknown>;
      };
      const props = (r.props ?? r.data ?? {}) as Record<string, unknown>;
      const named: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(props)) named[keyToName.get(k) ?? k] = v;
      rows.push(named);
    }
    const roleByKey = new Map<string, string>();
    if (dataset) {
      for (const c of dataset.columns) {
        roleByKey.set(c.name, classifyColumn(c.dataType));
      }
    }
    const piiColumnKeys = new Set(
      (dataset?.columns ?? []).filter((c) => c.isPii).map((c) => c.name),
    );
    const maskedSamples: Record<string, string[]> = {};
    for (const key of result.correlationMatrix.columns) {
      const samples: string[] = [];
      const markedPii = piiColumnKeys.has(key);
      for (const row of rows) {
        if (samples.length >= 20) break;
        const v = row[key];
        if (v === null || v === undefined || v === '') continue;
        const masked = maskSampleValue(v, markedPii);
        if (masked === null) continue; // ô không che được → loại khỏi prompt
        samples.push(masked);
      }
      maskedSamples[key] = samples;
    }
    const columns = result.correlationMatrix.columns.map((key) => {
      let used = 0;
      for (const row of rows) {
        const v = row[key];
        if (v === null || v === undefined || (typeof v === 'string' && v.trim() === '')) continue;
        used++;
      }
      return {
        key,
        role: roleByKey.get(key) ?? 'unknown',
        usedRows: used,
        excludedRows: rows.length - used,
      };
    });
    // GĐ9 — `excludedColumns` phải khớp với những gì `run-analysis.handler.ts`
    // đã loại (theo **vai trò**: identifier/text/datetime), nếu không AI sẽ bị
    // báo "loại cột X" trong khi ma trận tương quan lại không có X → mâu thuẫn.
    const excludedColumns = (result.correlationMatrix.excludedColumns ?? []).map((e) => ({
      column: e.column,
      reason: e.reason ?? 'unsupported_data_type',
    }));
    let fewShotBlock = '';
    try {
      const run = await this.analysisRepository.findById((job.analysisRunId as string).toString());
      const workspaceId = run ? (run.workspaceId as string).toString() : null;
      if (workspaceId && this.ragFewShot) {
        const queryText = this.ragFewShot.buildQueryText(
          'corr-v1',
          columns.map((c) => c.key).join(','),
          result.correlationMatrix.method,
        );
        fewShotBlock = await this.ragFewShot.buildFewShotBlockFromText({
          workspaceId,
          queryText,
          language: 'vi',
        });
      }
    } catch {
      fewShotBlock = '';
    }
    return buildCorrV1Prompt({
      columns,
      cells: result.correlationMatrix.cells,
      vif: {
        columns: result.vif.columns,
        rows: result.vif.rows,
        commonN: result.vif.commonN,
        totalScanned: result.vif.totalScanned,
        commonNRate: result.vif.commonNRate,
        lossWarning: result.vif.lossWarning,
        excluded: result.vif.excluded,
      },
      maskedSamples,
      method: result.correlationMatrix.method,
      excludedColumns,
      fewShotBlock,
    });
  }
}
