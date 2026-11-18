/**
 * GetDatasetSchemaHandler — Use case: `getDatasetSchema()`
 * (chỉ đọc) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 *
 * **Bước 3 — Rich Domain Model:** trả về cột của entity `Dataset`.
 */
import { Injectable } from '@nestjs/common';
import type { DatasetColumn } from '../../domain/entities/dataset.entity';
import { GetDatasetByIdHandler } from '../queries/get-dataset-by-id.handler';

@Injectable()
export class GetDatasetSchemaHandler {
  constructor(private readonly getDatasetByIdHandler: GetDatasetByIdHandler) {}

  async execute(id: string): Promise<DatasetColumn[]> {
    const dataset = await this.getDatasetByIdHandler.execute(id);
    return [...dataset.columns];
  }
}
