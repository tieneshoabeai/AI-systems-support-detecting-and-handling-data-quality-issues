/**
 * RenameColumnsHandler — Use case: `renameColumns()`
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
import { SchemaInferenceService } from '../services/schema-inference.service';
import { RenameColumnsInput } from '../datasets.types';
import { validationError } from '../datasets.utils';

@Injectable()
export class RenameColumnsHandler {
  constructor(
    @Inject(DATASET_REPOSITORY_PORT)
    private readonly datasets: DatasetRepositoryPort,
    private readonly schemaInferenceService: SchemaInferenceService,
  ) {}

  async execute(id: string, dto: RenameColumnsInput): Promise<DatasetRecord> {
    const dataset = await this.datasets.findById(id);
    if (!dataset) {
      throw new NotFoundException('Khong tim thay tap du lieu hoac tap du lieu da bi xoa');
    }
    const byKey = new Map(dataset.columns.map((c) => [c.key, c]));
    for (const r of dto.columns) {
      const col = byKey.get(r.key);
      if (!col) {
        throw validationError(`Cot khong ton tai: ${r.key}`, {
          reason: 'unknown_column_key',
          key: r.key,
        });
      }
      col.name = r.name;
    }
    const names = dataset.columns.map((c) => c.name);
    const issues = this.schemaInferenceService.detectColumnIssues(names).map((iss) => {
      if (!iss.columnKey) return iss;
      const idx = Number(String(iss.columnKey).replace('c', ''));
      const realKey = dataset.columns[idx]?.key ?? iss.columnKey;
      return { ...iss, columnKey: realKey };
    });
    const updated = await this.datasets.updateById(id, {
      columns: dataset.columns,
      columnIssues: issues,
    } as Partial<CreateDatasetRecord>);
    if (!updated) throw new NotFoundException('Khong tim thay tap du lieu de cap nhat');
    return updated;
  }
}
