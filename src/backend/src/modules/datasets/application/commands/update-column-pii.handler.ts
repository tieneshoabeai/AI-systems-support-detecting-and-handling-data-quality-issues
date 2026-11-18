/**
 * UpdateColumnPiiHandler — Use case: `updateColumnPii()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 *
 * **GĐ4 — Vì sao route này tồn tại?**
 * Nguyên tắc bất biến dữ liệu: sau khi nạp, nội dung dataset không được sửa
 * (route đổi tên dataset / đổi tên cột / reset tên cột đã bị gỡ).
 *
 * Nhưng cờ `isPii` là **metadata phân loại cột**, không phải nội dung dữ liệu —
 * nó nằm ngoài bản chụp dữ liệu. Cho phép bật/tắt cờ này:
 *   - vẫn giữ nguyên nguyên tắc bất biến;
 *   - mở đường cho tính năng che PII trước khi đưa dữ liệu lên prompt AI
 *     (`domain/pii-mask.util.ts` đọc `dataset.columns[].isPii`).
 *
 * Route được tách riêng khỏi `PATCH /datasets/:id/columns` (đã gỡ) để ranh giới
 * "sửa nội dung" vs "sửa metadata" luôn rõ ràng.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  DATASET_REPOSITORY_PORT,
  type DatasetRepositoryPort,
} from '../../domain/ports/dataset.repository.port';
import type { Dataset } from '../../domain/entities/dataset.entity';
import { NotFoundError } from '../../../../shared/domain/errors';

export interface UpdateColumnPiiInput {
  columns: Array<{ columnKey: string; isPii: boolean }>;
}

@Injectable()
export class UpdateColumnPiiHandler {
  constructor(
    @Inject(DATASET_REPOSITORY_PORT)
    private readonly datasets: DatasetRepositoryPort,
  ) {}

  async execute(id: string, dto: UpdateColumnPiiInput): Promise<Dataset> {
    const dataset = await this.datasets.findById(id);
    if (!dataset) {
      throw new NotFoundError('Khong tim thay tap du lieu hoac tap du lieu da bi xoa');
    }
    // Entity tự bảo vệ: key cột phải tồn tại, và phải có ít nhất 1 cột thay đổi.
    dataset.setColumnPii(dto.columns);

    // Ghi chỉ cờ PII — không đụng tới bất kì thuộc tính nội dung nào.
    const updated = await this.datasets.updateColumnPii(id, dto.columns);
    if (!updated) throw new NotFoundError('Khong tim thay tap du lieu de cap nhat');
    return updated;
  }
}
