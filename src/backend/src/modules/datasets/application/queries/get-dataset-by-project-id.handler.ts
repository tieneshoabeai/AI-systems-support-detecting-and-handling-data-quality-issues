/**
 * GetDatasetByProjectIdHandler — Use case: `getDatasetByProjectId()`
 * (chỉ đọc) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  DATASET_REPOSITORY_PORT,
  type DatasetRecord,
  type DatasetRepositoryPort,
} from '../../domain/ports/dataset.repository.port';
import { isObjectIdHex } from '../../../../shared/utils/object-id.util';

@Injectable()
export class GetDatasetByProjectIdHandler {
  constructor(
    @Inject(DATASET_REPOSITORY_PORT)
    private readonly datasets: DatasetRepositoryPort,
  ) {}

  async execute(projectId: string): Promise<DatasetRecord | null> {
    if (!isObjectIdHex(projectId)) {
      throw new BadRequestException('ID Du an khong hop le');
    }
    const found = await this.datasets.findByProject(projectId);
    if (!found) return null;
    const { storageKey: _sk2, ...safe } = found as DatasetRecord & { storageKey?: string };
    void _sk2;
    return safe as DatasetRecord;
  }
}
