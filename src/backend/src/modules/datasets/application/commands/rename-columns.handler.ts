/**
 * RenameColumnsHandler — Use case: `renameColumns()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 *
 * **Bước 3 — Rich Domain Model:** gọi `dataset.renameColumns()` để entity tự
 * kiểm tra invariant (key tồn tại, tên không rỗng, không trùng) → handler
 * không viết lại điều kiện.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  DATASET_REPOSITORY_PORT,
  type DatasetRepositoryPort,
} from '../../domain/ports/dataset.repository.port';
import type { Dataset } from '../../domain/entities/dataset.entity';
import { SchemaInferenceService } from '../services/schema-inference.service';
import { RenameColumnsInput } from '../datasets.types';
import { NotFoundError } from '../../../../shared/domain/errors';

@Injectable()
export class RenameColumnsHandler {
  constructor(
    @Inject(DATASET_REPOSITORY_PORT)
    private readonly datasets: DatasetRepositoryPort,
    private readonly schemaInferenceService: SchemaInferenceService,
  ) {}

  async execute(id: string, dto: RenameColumnsInput): Promise<Dataset> {
    const dataset = await this.datasets.findById(id);
    if (!dataset) {
      throw new NotFoundError('Khong tim thay tap du lieu hoac tap du lieu da bi xoa');
    }
    // Entity tự bảo vệ: key phải tồn tại, tên không rỗng, không trùng nhau.
    dataset.renameColumns(dto.columns);

    // Tính lại lỗi tên cột sau khi đổi (tên rỗng/trùng/whitespace).
    const names = dataset.columns.map((c) => c.name);
    const issues = this.schemaInferenceService.detectColumnIssues(names).map((iss) => {
      if (!iss.columnKey) return iss;
      const idx = Number(String(iss.columnKey).replace('c', ''));
      const realKey = dataset.columns[idx]?.key ?? iss.columnKey;
      return { ...iss, columnKey: realKey };
    });
    dataset.setColumnIssues(issues);

    const updated = await this.datasets.updateById(id, {
      columns: dataset.columns.map((c) => ({ ...c })),
      columnIssues: dataset.columnIssues.map((i) => ({ ...i })),
    });
    if (!updated) throw new NotFoundError('Khong tim thay tap du lieu de cap nhat');
    return updated;
  }
}
