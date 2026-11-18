/**
 * UpdateDatasetHandler — Use case: `updateDataset()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 *
 * **Bước 3 — Rich Domain Model:** gọi `dataset.rename()` để entity tự kiểm tra
 * invariant (tên rỗng / quá 100 ký tự) → handler không viết lại điều kiện.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  DATASET_REPOSITORY_PORT,
  type DatasetRepositoryPort,
} from '../../domain/ports/dataset.repository.port';
import type { Dataset } from '../../domain/entities/dataset.entity';
import { UpdateDatasetInput } from '../datasets.types';
import { GetDatasetByIdHandler } from '../queries/get-dataset-by-id.handler';
import { NotFoundError } from '../../../../shared/domain/errors';

@Injectable()
export class UpdateDatasetHandler {
  constructor(
    @Inject(DATASET_REPOSITORY_PORT)
    private readonly datasets: DatasetRepositoryPort,
    private readonly getDatasetByIdHandler: GetDatasetByIdHandler,
  ) {}

  async execute(id: string, dto: UpdateDatasetInput): Promise<Dataset> {
    const dataset = await this.getDatasetByIdHandler.execute(id);
    dataset.rename(dto.name);
    const updated = await this.datasets.updateById(id, {
      name: dataset.name,
    });
    if (!updated) {
      throw new NotFoundError('Khong tim thay tap du lieu de cap nhat');
    }
    return updated;
  }
}
