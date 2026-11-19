/**
 * UpdateColumnNamesHandler — Use case: `updateColumnNames()`
 * (thay đổi trạng thái metadata) — theo §3.10 Command/Query pattern.
 *
 * `PATCH /datasets/{id}/columns` — đổi **tên hiển thị** của nhiều cột trong
 * một lần (contract §3.13 #47 `VIEW-08`; UC-10 "Nhập hoặc chỉnh sửa tên cột
 * rỗng/trùng").
 *
 * **Không phải sửa nội dung dữ liệu.** Chỉ `columns[].name` đổi; key `c{i}`
 * bất biến nên **không** phải viết lại bản ghi nào (schema v7 §3.6.3).
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  DATASET_REPOSITORY_PORT,
  type DatasetRepositoryPort,
} from '../../domain/ports/dataset.repository.port';
import type { Dataset } from '../../domain/entities/dataset.entity';
import { NotFoundError, ValidationError } from '../../../../shared/domain/errors';
import { isObjectIdHex } from '../../../../shared/domain/utils/object-id.util';

export interface UpdateColumnNamesInput {
  columns: Array<{ columnKey: string; name: string }>;
}

@Injectable()
export class UpdateColumnNamesHandler {
  constructor(
    @Inject(DATASET_REPOSITORY_PORT)
    private readonly datasets: DatasetRepositoryPort,
  ) {}

  async execute(id: string, input: UpdateColumnNamesInput): Promise<Dataset> {
    if (!isObjectIdHex(id)) {
      throw new ValidationError('ID Tap du lieu khong hop le');
    }
    const dataset = await this.datasets.findById(id);
    if (!dataset) {
      throw new NotFoundError(`Khong tim thay tap du lieu ${id}`);
    }
    // Entity tự bảo vệ invariant (key tồn tại, tên không rỗng, không trùng)
    // và **tính lại** `columnIssues` sau khi đổi tên.
    dataset.renameColumns(
      input.columns.map((u) => ({ columnKey: u.columnKey, newName: u.name })),
    );
    const updated = await this.datasets.updateColumnNames(
      id,
      input.columns.map((u) => ({ columnKey: u.columnKey, name: u.name })),
      [...dataset.columnIssues],
    );
    if (!updated) {
      throw new NotFoundError(`Khong tim thay tap du lieu ${id}`);
    }
    return updated;
  }
}
