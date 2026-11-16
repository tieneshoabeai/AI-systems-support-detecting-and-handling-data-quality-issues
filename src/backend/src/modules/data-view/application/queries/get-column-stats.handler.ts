/**
 * GetColumnStatsHandler — Use case: `getColumnStats()`
 * (chỉ đọc) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DATASET_REPOSITORY_PORT, type DatasetRepositoryPort } from '../../../datasets';
import { RECORD_QUERY_PORT, type RecordQueryPort } from '../../../datasets';
import { ColumnStatsResult } from '../data-view.types';
import { isObjectIdHex, toSnakeStats } from '../data-view.utils';

@Injectable()
export class GetColumnStatsHandler {
  constructor(
    @Inject(DATASET_REPOSITORY_PORT)
    private readonly datasets: DatasetRepositoryPort,
    @Inject(RECORD_QUERY_PORT)
    private readonly records: RecordQueryPort,
  ) {}

  async execute(datasetId: string, columnRef: string): Promise<ColumnStatsResult> {
    if (!isObjectIdHex(datasetId)) {
      throw new BadRequestException('ID Tap du lieu khong hop le');
    }
    const dataset = await this.datasets.findById(datasetId);
    if (!dataset) {
      throw new NotFoundException(`Khong tim thay tap du lieu ${datasetId}`);
    }
    const targetColumn =
      dataset.columns.find((c) => c.key === columnRef) ??
      dataset.columns.find((c) => c.name === columnRef) ??
      dataset.columns.find((c) => c.originalName === columnRef);
    if (!targetColumn) {
      throw new NotFoundException(`Khong tim thay cot ${columnRef} trong dataset ${datasetId}`);
    }
    const domain = await this.records.getColumnStats(datasetId, targetColumn.key);
    const snake = toSnakeStats({ ...domain, columnName: targetColumn.name });
    // Chi tra histogram so khi cot la number; neu cot khong phai number thi tra rong (giua API cu).
    if (targetColumn.dataType !== 'number') {
      return { ...snake, min: undefined, max: undefined, average: undefined, histogram: [] };
    }
    return snake;
  }
}
