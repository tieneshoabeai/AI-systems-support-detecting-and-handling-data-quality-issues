# Batch 3 mở rộng — Unit/Integration coverage

Ngày kiểm chứng: 2026-11-17. So sánh với [baseline](report.md).

## Thay đổi

Thêm 8 file test, 59 ca; không sửa source sản phẩm, dependency, coverage include/exclude,
assertion hay baseline đồ họa có sẵn.

| Test file dưới `src/__tests__/` | Hành vi xác minh |
| --- | --- |
| `preview/member-store-errors.test.ts` | Resource/member không tồn tại, owner bị thêm lại, duplicate membership, đổi vai trò/gỡ và undo |
| `preview/project-members-branches.test.tsx` | Thêm bằng Enter/nút bấm, tìm tên/email, đổi vai trò/gỡ qua real session/store, custom role, lọc rỗng, workspace mất, owner không trùng, panel không có project |
| `preview/project-wizard-errors.test.tsx` | Thiếu workspace, tên trắng, sai định dạng file, lỗi đọc Error/non-Error, CSV lỗi, UTF-8 lỗi, bỏ file và chặn tiếp tục |
| `preview/session-lifecycle.test.tsx` | Deadline/dismiss toast, cleanup timer, project mất không điều hướng, dialog guard, lỗi mutation, rename/undo |
| `dataset-3d/auth-panel-geometry.test.ts` | Kích thước bevel, vị trí tiếp giáp sau xoay, footprint nhiều panel; dùng Three.js thật |
| `dataset-3d/display-base-factories.test.ts` | Tier bounds, màu ring, pixel panorama, shader uniforms, texture fallback khi không có Canvas2D, parse review view |
| `dataset-3d/project-glass-profiler.test.ts` | Warmup, mean/p95, chỉ xuất một aggregate, reset khi đổi mode |
| `dataset-3d/preview-scene-runtime.test.ts` | Orthographic projection theo zoom, bỏ qua perspective camera, environment và uniform |

Các bộ test dùng fake timers cho deadline/mutation delay; đọc file được mô phỏng tại
File.arrayBuffer để kiểm tra parser/validation thật. Chỉ stub Canvas2D ở ca fallback.
Không mock store/session/geometry đang cần xác minh. Các tài nguyên geometry/material/texture
do test tạo được dispose; đây không phải bằng chứng renderer thật tự cleanup đúng.

## Kết quả toàn suite có coverage

Lệnh chạy từ frontend:

```sh
yarn test:coverage --reporter=json --outputFile=.agents/testing-coverage/expanded-test-results.json --silent
```

| Metric | Trước | Sau | Chênh lệch điểm phần trăm |
| --- | ---: | ---: | ---: |
| Statements | 67.91% (8035/11831) | 69.78% (8256/11831) | +1.87 |
| Branches | 61.37% (3508/5716) | 63.10% (3607/5716) | +1.73 |
| Functions | 67.49% (1628/2412) | 69.61% (1679/2412) | +2.12 |
| Lines | 69.09% (6930/10030) | 70.83% (7105/10030) | +1.74 |

Mẫu số không đổi: không loại code để tăng phần trăm. Số covered tăng 221 statements,
99 branches, 51 functions, 175 lines.

71 file test: 67 pass / 4 fail. 864 ca: 855 pass / 9 fail / 0 skipped.
Cả 8 file mới và 59 ca mới đều pass. Tên file + full test name của 9 ca fail giống hoàn toàn
baseline 805 ca; đều ở holographic-towers, model-fingerprint, orbit-clearance và spool-core.
Không kết luận root cause của 9 ca này trong Batch 3.

Thời gian từ start đến kết thúc test file cuối theo JSON khoảng 156.5 giây; không đại diện
benchmark và không bao gồm toàn bộ công đoạn sinh báo cáo.

## Mức cải thiện ở các phần được kiểm tra

| Source | Lines trước → sau | Branches trước → sau |
| --- | ---: | ---: |
| `components/project/create/project-wizard.tsx` | 82.02 → 89.88% | 69.16 → 85.00% |
| `components/project/members/project-members-dialog.tsx` | 68.18 → 100% | 42.85 → 95.23% |
| `hooks/preview/use-preview-session.ts` | 83.80 → 91.54% | 63.88 → 75.00% |
| `services/preview/preview-mock.service.ts` | 93.80 → 98.57% | 74.86 → 85.56% |
| `graphics/auth-glass/auth-glass.geometry.ts` | 0 → 100% | 0 → 100% |
| `graphics/auth-glass/display-base/display-base.geometry.ts` | 0 → 100% | Không có branch được instrument |
| `graphics/auth-glass/display-base/display-base.lighting.ts` | 0 → 71.42% | 0 → 88.88% |
| `graphics/holographic-core/project-glass-profiler.ts` | 0 → 100% | 0 → 100% |
| `graphics/workspace-3d/preview-scene-runtime.ts` | 0 → 100% | 0 → 100% |

## Validation và giới hạn

- TypeScript `tsc -b --pretty false`: pass.
- ESLint 8 file test mới: pass; còn thông báo rule stylistic deprecated của config có sẵn.
- `git diff --check`: pass.
- Không chạy formatter hoặc build production. Không đọc `.env`.
- Geometry/texture data/uniform tests không chứng minh shader compile, hình ảnh hay GPU performance.
- Các nhánh Canvas2D drawing vẫn cần môi trường phù hợp để xác minh ảnh đầu ra có ý nghĩa.
- Chưa đạt mục tiêu coverage tổng 90/85/90/90; không bật gate hoặc che các file 0%.
- Renderer/WebGL và một số nhánh ứng dụng còn thiếu. Chưa chuyển sang sửa lỗi 3D hoặc E2E.

Coverage 100% ở một file chỉ cho biết toàn bộ phần được instrument đã chạy;
không chứng minh mọi input hay hành vi đều đúng.

## Bằng chứng

- [Kết quả test sau mở rộng](expanded-test-results.json).
- [Kết quả test baseline](test-results.json).
- [HTML coverage hiện tại](coverage/index.html).
- [JSON coverage hiện tại](coverage/coverage-summary.json).
