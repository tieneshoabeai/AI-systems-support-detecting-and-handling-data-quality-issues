/**
 * GetDatasetByIdHandler — Use case: `getDatasetById()`
 * (chỉ đọc) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 *
 * **Bước 3 — Rich Domain Model:** trả về **entity** `Dataset`.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  DATASET_REPOSITORY_PORT,
  type DatasetRepositoryPort,
} from '../../domain/ports/dataset.repository.port';
import type { Dataset } from '../../domain/entities/dataset.entity';
import { isObjectIdHex } from '../../../../shared/domain/utils/object-id.util';
import { NotFoundError, ValidationError } from '../../../../shared/domain/errors';

@Injectable()
export class GetDatasetByIdHandler {
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
      throw new NotFoundError('Khong tim thay tap du lieu hoac tap du lieu da bi xoa');
    }
    // S14: `storageKey` không lộ ra API — mapper `toDatasetResponse()` loại bỏ.
    return dataset;
  }
}
