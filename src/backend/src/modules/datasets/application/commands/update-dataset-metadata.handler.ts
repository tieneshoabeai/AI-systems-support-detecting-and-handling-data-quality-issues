/**
 * UpdateDatasetMetadataHandler — Use case: `updateDatasetMetadata()`
 * (thay đổi trạng thái metadata) — theo §3.10 Command/Query pattern.
 *
 * `PATCH /datasets/{id}` — cập nhật **tên hiển thị** của dataset
 * (contract §3.13 #46 `VIEW-08`).
 *
 * **Không phải sửa nội dung dữ liệu.** Tên dataset là *metadata nhãn*; nội dung
 * bản ghi (`props.cN`) và file gốc trên R2 giữ nguyên → không vi phạm nguyên tắc
 * bất biến (mục 3.40).
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  DATASET_REPOSITORY_PORT,
  type DatasetRepositoryPort,
} from '../../domain/ports/dataset.repository.port';
import type { Dataset } from '../../domain/entities/dataset.entity';
import { NotFoundError, ValidationError } from '../../../../shared/domain/errors';
import { isObjectIdHex } from '../../../../shared/domain/utils/object-id.util';

export interface UpdateDatasetMetadataInput {
  name: string;
}

@Injectable()
export class UpdateDatasetMetadataHandler {
  constructor(
    @Inject(DATASET_REPOSITORY_PORT)
    private readonly datasets: DatasetRepositoryPort,
  ) {}

  async execute(id: string, input: UpdateDatasetMetadataInput): Promise<Dataset> {
    if (!isObjectIdHex(id)) {
      throw new ValidationError('ID Tap du lieu khong hop le');
    }
    const dataset = await this.datasets.findById(id);
    if (!dataset) {
      throw new NotFoundError(`Khong tim thay tap du lieu ${id}`);
    }
    // Entity tự bảo vệ invariant (tên rỗng / quá dài).
    dataset.rename(input.name);
    const updated = await this.datasets.updateName(id, dataset.name);
    if (!updated) {
      throw new NotFoundError(`Khong tim thay tap du lieu ${id}`);
    }
    return updated;
  }
}
