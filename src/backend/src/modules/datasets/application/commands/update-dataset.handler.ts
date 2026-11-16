/**
 * UpdateDatasetHandler — Use case: `updateDataset()`
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
import { UpdateDatasetInput } from '../datasets.types';
import { GetDatasetByIdHandler } from '../queries/get-dataset-by-id.handler';

@Injectable()
export class UpdateDatasetHandler {
  constructor(
    @Inject(DATASET_REPOSITORY_PORT)
    private readonly datasets: DatasetRepositoryPort,
    private readonly getDatasetByIdHandler: GetDatasetByIdHandler,
  ) {}

  async execute(id: string, dto: UpdateDatasetInput): Promise<DatasetRecord> {
    await this.getDatasetByIdHandler.execute(id);
    const updated = await this.datasets.updateById(id, {
      name: dto.name,
    } as Partial<CreateDatasetRecord>);
    if (!updated) {
      throw new NotFoundException('Khong tim thay tap du lieu de cap nhat');
    }
    return updated;
  }
}
