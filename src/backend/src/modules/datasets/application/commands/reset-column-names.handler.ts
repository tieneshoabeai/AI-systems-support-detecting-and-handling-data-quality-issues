/**
 * ResetColumnNamesHandler — Use case: `resetColumnNames()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 *
 * **Bước 3 — Rich Domain Model:** gọi `dataset.resetColumnNames()` để entity
 * tự khôi phục tên gốc + xoá lỗi tên cột.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  DATASET_REPOSITORY_PORT,
  type DatasetRepositoryPort,
} from '../../domain/ports/dataset.repository.port';
import type { Dataset } from '../../domain/entities/dataset.entity';
import { NotFoundError } from '../../../../shared/domain/errors';

@Injectable()
export class ResetColumnNamesHandler {
  constructor(
    @Inject(DATASET_REPOSITORY_PORT)
    private readonly datasets: DatasetRepositoryPort,
  ) {}

  async execute(id: string): Promise<Dataset> {
    const dataset = await this.datasets.findById(id);
    if (!dataset) {
      throw new NotFoundError('Khong tim thay tap du lieu hoac tap du lieu da bi xoa');
    }
    dataset.resetColumnNames();
    const updated = await this.datasets.updateById(id, {
      columns: dataset.columns.map((c) => ({ ...c })),
      columnIssues: dataset.columnIssues.map((i) => ({ ...i })),
    });
    if (!updated) throw new NotFoundError('Khong tim thay tap du lieu de cap nhat');
    return updated;
  }
}
