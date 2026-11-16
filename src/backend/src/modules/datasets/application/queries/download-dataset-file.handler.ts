/**
 * DownloadDatasetFileHandler — Use case: `downloadDatasetFile()`
 * (chỉ đọc) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Readable } from 'stream';
import {
  DATASET_REPOSITORY_PORT,
  type DatasetRepositoryPort,
} from '../../domain/ports/dataset.repository.port';
import { STORAGE_PORT, type StoragePort } from '../../../../shared/ports/storage.port';
import { isObjectIdHex } from '../../../../shared/utils/object-id.util';

@Injectable()
export class DownloadDatasetFileHandler {
  constructor(
    @Inject(DATASET_REPOSITORY_PORT)
    private readonly datasets: DatasetRepositoryPort,
    @Inject(STORAGE_PORT)
    private readonly storage: StoragePort,
  ) {}

  async execute(id: string): Promise<{
    stream: Readable;
    filename: string;
    fileSizeBytes: number;
    contentType: string;
    workspaceId: string;
    projectId: string;
  }> {
    if (!isObjectIdHex(id)) throw new BadRequestException('ID Tap du lieu khong hop le');
    const dataset = await this.datasets.findById(id);
    if (!dataset)
      throw new NotFoundException('Khong tim thay tap du lieu hoac tap du lieu da bi xoa');
    if (!dataset.storageKey) throw new NotFoundException('Khong tim thay file goc cua tap du lieu');
    const stream = await this.storage.downloadStream(dataset.storageKey);
    const filename = dataset.originalFileName?.endsWith('.csv')
      ? dataset.originalFileName
      : `${dataset.originalFileName || dataset.name}.csv`;
    return {
      stream,
      filename,
      fileSizeBytes: dataset.fileSizeBytes ?? 0,
      contentType: 'text/csv; charset=utf-8',
      workspaceId: dataset.workspaceId,
      projectId: dataset.projectId,
    };
  }
}
