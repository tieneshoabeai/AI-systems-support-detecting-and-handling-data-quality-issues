/**
 * MapPropsToOriginalNamesHandler — Use case: `mapPropsToOriginalNames()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { Injectable } from '@nestjs/common';

@Injectable()
export class MapPropsToOriginalNamesHandler {
  execute(
    columns: { key: string; originalName: string }[],
    props: Record<string, unknown>,
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const c of columns) {
      out[c.originalName] = props[c.key] ?? null;
    }
    return out;
  }
}
