# Dataset 3D — core v3 working folder

Thư mục này là **log + baseline** cho thay đổi "Issue Constellation" của Dataset 3D. Mục đích: mọi
thay đổi hình ảnh đều có before/after và một đường rollback rõ ràng.

## Đọc gì trước

1. `plan-issue-constellation.md` — đặc tả đầy đủ: câu chuyện, anchor, de-glare, đường bay, UI, tiêu chí.
2. `change-log.md` — bảng thay đổi thật (Trước/Sau/Kiểm chứng/Rollback) và log thực thi.
3. `baseline/` + `baseline.sha256` — bản gốc 5 file trước khi sửa.
4. `captures/` — ảnh before/after, `comparison-attached.png`, và `measurements.json` (sinh bởi
   `captures/measure-core-v3.py` + `captures/make-comparison-sheet.py`).

## Rollback nhanh

Theo feature (không cần git), sửa trong `src/graphics/holographic-core/core-visual-config.ts`:

```ts
export const CORE_VISUAL_REVISION: 'v2-tier' | 'v3-constellation' = 'v2-tier'
```

Theo file:

```bash
cp .agents/dataset-3d-core/baseline/holographic-core.model.ts src/graphics/holographic-core/holographic-core.model.ts
cp .agents/dataset-3d-core/baseline/dataset-3d.view.tsx src/views/dataset-3d/dataset-3d.view.tsx
cp .agents/dataset-3d-core/baseline/dataset-3d.css src/views/dataset-3d/dataset-3d.css
```

Kiểm tra baseline còn nguyên:

```bash
cd src/frontend
shasum -a 256 -c .agents/dataset-3d-core/baseline.sha256
```

## Ràng buộc

- **Không đóng gate img2threejs nào**; không chạy `forge/state.py mark`.
- Không thêm dependency.
- Không sửa base/tower/camera/fog/bloom trừ khi có dòng log riêng và metric chứng minh cần thiết.
