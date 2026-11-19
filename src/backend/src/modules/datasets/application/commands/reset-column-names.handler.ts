/**
 * ResetColumnNamesHandler — Use case: `resetColumnNames()`
 * (thay đổi trạng thái metadata) — theo §3.10 Command/Query pattern.
 *
 * `POST /datasets/{id}/columns/reset` — khôi phục **tên hiển thị** của các cột
 * về tên gốc trong file CSV (contract §3.13 #48 `VIEW-07`).
 *
 * **Phạm vi:** đây là **hành vi duy nhất còn lại** của "Reset Dataset" sau khi
 * thu hẹp (mục 3.12 / 3.40.5): khôi phục tên cột, **không** khôi phục dữ liệu
 * (không có dữ liệu nào bị xoá/sửa).
 *
 * Không làm mất hiệu lực kết quả phân tích: `input_fingerprint` không chứa tên
 * cột (mục 3.28).
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  DATASET_REPOSITORY_PORT,
  type DatasetRepositoryPort,
} from '../../domain/ports/dataset.repository.port';
import type { Dataset } from '../../domain/entities/dataset.entity';
import { NotFoundError, ValidationError } from '../../../../shared/domain/errors';
import { isObjectIdHex } from '../../../../shared/domain/utils/object-id.util';

@Injectable()
export class ResetColumnNamesHandler {
  constructor(
    @Inject(DATASET_REPOSITORY_PORT)
    private readonly datasets: DatasetRepositoryPort,
  ) {}

  async execute(id: string): Promise<Dataset> {
    if (!isObjectIdHex(id)) {
      throw new ValidationError('ID Tap du lieu khong hop le');
    }
    const dataset = await this.datasets.findById(id);
    if (!dataset) {
      throw new NotFoundError(`Khong tim thay tap du lieu ${id}`);
    }
    // Entity tự bảo vệ invariant (phải có ít nhất 1 cột khác tên gốc) và
    // tính lại `columnIssues`.
    dataset.resetColumnNames();
    const updated = await this.datasets.resetColumnNames(id, [...dataset.columnIssues]);
    if (!updated) {
      throw new NotFoundError(`Khong tim thay tap du lieu ${id}`);
    }
    return updated;
  }
}
