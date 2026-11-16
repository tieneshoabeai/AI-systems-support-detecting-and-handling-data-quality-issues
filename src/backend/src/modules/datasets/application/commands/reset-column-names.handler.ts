/**
 * ResetColumnNamesHandler — Use case: `resetColumnNames()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  DATASET_REPOSITORY_PORT,
  type CreateDatasetRecord,
  type DatasetRecord,
  type DatasetRepositoryPort,
} from '../../domain/ports/dataset.repository.port';

@Injectable()
export class ResetColumnNamesHandler {
  constructor(
    @Inject(DATASET_REPOSITORY_PORT)
    private readonly datasets: DatasetRepositoryPort,
  ) {}

  async execute(id: string): Promise<DatasetRecord> {
    const dataset = await this.datasets.findById(id);
    if (!dataset) {
      throw new NotFoundException('Khong tim thay tap du lieu hoac tap du lieu da bi xoa');
    }
    for (const c of dataset.columns) {
      c.name = c.originalName;
    }
    const updated = await this.datasets.updateById(id, {
      columns: dataset.columns,
      columnIssues: [],
    } as Partial<CreateDatasetRecord>);
    if (!updated) throw new NotFoundException('Khong tim thay tap du lieu de cap nhat');
    return updated;
  }
}
