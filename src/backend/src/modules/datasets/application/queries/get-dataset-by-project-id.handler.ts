/**
 * GetDatasetByProjectIdHandler — Use case: `getDatasetByProjectId()`
 * (chỉ đọc) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 *
 * **Bước 3 — Rich Domain Model:** trả về **entity** `Dataset` (hoặc `null`).
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  DATASET_REPOSITORY_PORT,
  type DatasetRepositoryPort,
} from '../../domain/ports/dataset.repository.port';
import type { Dataset } from '../../domain/entities/dataset.entity';
import { isObjectIdHex } from '../../../../shared/domain/utils/object-id.util';
import { ValidationError } from '../../../../shared/domain/errors';

@Injectable()
export class GetDatasetByProjectIdHandler {
  constructor(
    @Inject(DATASET_REPOSITORY_PORT)
    private readonly datasets: DatasetRepositoryPort,
  ) {}

  async execute(projectId: string): Promise<Dataset | null> {
    if (!isObjectIdHex(projectId)) {
      throw new ValidationError('ID Du an khong hop le');
    }
    const found = await this.datasets.findByProject(projectId);
    // S14: `storageKey` không lộ ra API — mapper `toDatasetResponse()` loại bỏ.
    return found;
  }
}
