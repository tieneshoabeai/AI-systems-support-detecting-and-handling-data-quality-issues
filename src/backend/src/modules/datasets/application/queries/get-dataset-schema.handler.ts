/**
 * GetDatasetSchemaHandler — Use case: `getDatasetSchema()`
 * (chỉ đọc) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { Injectable } from '@nestjs/common';
import { type DatasetRecord } from '../../domain/ports/dataset.repository.port';
import { GetDatasetByIdHandler } from '../queries/get-dataset-by-id.handler';

@Injectable()
export class GetDatasetSchemaHandler {
  constructor(private readonly getDatasetByIdHandler: GetDatasetByIdHandler) {}

  async execute(id: string): Promise<DatasetRecord['columns']> {
    const dataset = await this.getDatasetByIdHandler.execute(id);
    return dataset.columns;
  }
}
