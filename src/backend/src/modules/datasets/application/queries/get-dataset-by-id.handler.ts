/**
 * GetDatasetByIdHandler — Use case: `getDatasetById()`
 * (chỉ đọc) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  DATASET_REPOSITORY_PORT,
  type DatasetRecord,
  type DatasetRepositoryPort,
} from '../../domain/ports/dataset.repository.port';
import { isObjectIdHex } from '../../../../shared/utils/object-id.util';

@Injectable()
export class GetDatasetByIdHandler {
  constructor(
    @Inject(DATASET_REPOSITORY_PORT)
    private readonly datasets: DatasetRepositoryPort,
  ) {}

  async execute(id: string): Promise<DatasetRecord> {
    if (!isObjectIdHex(id)) {
      throw new BadRequestException('ID Tap du lieu khong hop le');
    }
    const dataset = await this.datasets.findById(id);
    if (!dataset) {
      throw new NotFoundException('Khong tim thay tap du lieu hoac tap du lieu da bi xoa');
    }
    // S14: khong de lo storageKey/storage_key ra API response
    const { storageKey: _sk, ...safe } = dataset as DatasetRecord & { storageKey?: string };
    void _sk;
    return safe as DatasetRecord;
  }
}
