# Frontend coverage baseline — 2026-11-17

> Đây là baseline trước khi bổ sung test mở rộng Batch 3. Xem
> [kết quả sau bổ sung](expanded-report.md) để đọc số liệu hiện tại.
> `coverage/` được tạo lại ở lần chạy mới nhất nên HTML/JSON coverage bên dưới
> hiện phản ánh lần đo mở rộng, không phải bảng baseline lịch sử trong tài liệu này.

## Phạm vi Batch 3

Thêm `@vitest/coverage-v8` phiên bản 5.0.5, khớp peer dependency Vitest 5.0.5.
Thêm script `yarn test:coverage` và cấu hình V8 coverage. Không thay đổi logic sản phẩm,
test assertion hoặc baseline 3D. Chưa bật coverage thresholds.

`yarn.lock` do Yarn 1.22.22 cập nhật khi cài dependency đã duyệt; các entry cũ không đổi
phiên bản. Cài bằng `yarn install --ignore-scripts --non-interactive --network-timeout 10000`.
Giữ nguyên package-lock.json có sẵn; không chuyển package manager.

## Cách chạy

Chạy trong thư mục frontend:

```sh
yarn test:coverage
```

Lệnh dùng để thu bằng chứng của lần đo này:

```sh
yarn test:coverage --reporter=json --outputFile=.agents/testing-coverage/test-results.json --silent
```

Coverage include `src/**/*.{ts,tsx}`, chỉ exclude `src/__tests__/**` và `src/**/*.d.ts`.
Không loại graphics, mocks, barrel, entry hay code chưa được test import.
Đối chiếu filesystem với JSON summary: đủ 367 file TS/TSX nằm trong phạm vi; không thiếu file.
File chỉ có type hoặc re-export có thể không có statement/function để đo.

`reportOnFailure: true` xuất báo cáo dù test fail; không đổi exit code thành thành công.
Thư mục `coverage/` có thể được Vitest dọn và tạo lại mỗi lần chạy; không đặt tài liệu viết tay ở đó.

## Kết quả thực tế

| Chỉ số | Covered / Total | Coverage | Mục tiêu chưa áp thành gate |
| --- | ---: | ---: | ---: |
| Statements | 8035 / 11831 | 67.91% | 90% |
| Branches | 3508 / 5716 | 61.37% | 85% |
| Functions | 1628 / 2412 | 67.49% | 90% |
| Lines | 6930 / 10030 | 69.09% | 90% |

63 file test: 59 pass, 4 fail. 805 ca: 796 pass, 9 fail, 0 pending/skipped.
Thời gian từ start đến kết thúc file test cuối theo JSON: khoảng 155.4 giây,
không phải thời gian toàn bộ quá trình cài dependency hoặc sinh HTML report.

9 ca fail trùng tên với baseline trước Batch 3:

- `dataset-3d/holographic-towers.test.ts`: 1 ca thiếu mesh mong đợi.
- `dataset-3d/model-fingerprint.test.ts`: 5 ca drift baseline.
- `dataset-3d/orbit-clearance.test.ts`: 1 ca drift khoảng cách.
- `dataset-3d/spool-core.test.ts`: 2 ca khoảng cách và màu vật liệu.

Chưa xác định các ca này là regression sản phẩm hay test/baseline cũ.
Không cập nhật expected value, skip test hoặc thay đồ họa trong batch này.

## Coverage theo nhóm

Các tỷ lệ dưới đây cộng covered/total của file trong nhóm, không lấy trung bình tỷ lệ từng file.

| Nhóm | Statements | Branches | Functions | Lines |
| --- | ---: | ---: | ---: | ---: |
| app | 81.35% | 75.68% | 80.00% | 85.53% |
| components | 29.95% | 39.65% | 37.77% | 29.43% |
| configs | 96.97% | 100% | 100% | 96.77% |
| graphics | 73.90% | 50.12% | 69.26% | 74.65% |
| hooks | 87.44% | 74.47% | 85.43% | 91.30% |
| lib | 90.91% | 84.62% | 95.65% | 91.30% |
| math | 97.93% | 94.56% | 100% | 98.82% |
| mocks | 83.33% | 82.54% | 76.47% | 85.53% |
| repositories | 96.49% | 95.00% | 100% | 97.00% |
| services | 92.05% | 83.09% | 91.74% | 96.91% |
| utils | 96.30% | 95.65% | 100% | 100% |
| views | 86.86% | 84.48% | 81.09% | 90.16% |

Nhóm components gồm cả các renderer 3D; không suy tỷ lệ này thành chất lượng riêng của UI primitives.

## Ưu tiên đề xuất sau baseline

1. Triage 9 lỗi 3D trước khi thay baseline; cần đối chiếu quyết định thiết kế và source.
2. Kiểm tra branch gaps của logic ứng dụng, chọn hành vi chưa được xác minh để bổ sung:
   - `services/preview/preview-mock.service.ts`: 140/187 branches, còn 47 nhánh.
   - `components/project/create/project-wizard.tsx`: 83/120 branches, còn 37 nhánh.
   - `hooks/preview/preview-presentation.ts`: 91/120 branches, còn 29 nhánh.
   - `hooks/preview/use-preview-session.ts`: 46/72 branches, còn 26 nhánh.
   - `services/auth/session-coordinator.ts`: 115/140 branches, còn 25 nhánh,
     mặc dù line coverage 99.49%.
   - `components/project/members/project-members-dialog.tsx`: 18/42 branches, còn 24 nhánh.
3. Lập scenario browser/WebGL cho renderer: holographic-core scene, environment và decor
   có line coverage 0%; auth-glass scene mới 10.62%. Không mock toàn renderer để tăng số đẹp.
4. Sau khi xác minh hành vi và môi trường E2E, mới chọn gate phù hợp với mục tiêu 90/85/90/90.

Đây là ưu tiên dựa trên coverage và rủi ro; chưa phải danh sách thay đổi được duyệt.
Coverage cho biết code đã được chạy, không chứng minh assertion đủ mạnh. Những ca fail có
thể dừng sớm nên kết quả là baseline của checkout đang fail, chưa phải baseline suite xanh.
Chưa có số liệu trước Batch 1–2 để tính mức tăng coverage.

## Bằng chứng và validation

- [HTML report](coverage/index.html).
- [JSON coverage summary](coverage/coverage-summary.json).
- [JSON kết quả test](test-results.json).
- TypeScript: `tsc -b --pretty false` pass.
- ESLint riêng `vitest.config.ts` pass; có cảnh báo rule stylistic deprecated từ cấu hình có sẵn.
- `git diff --check` pass.
- Chưa chạy build production; không cần nạp cấu hình env cho baseline test này (`envDir: false`).
- Chưa chạy E2E hoặc xác minh WebGL/backend thật.

Tham khảo cấu hình: [Vitest coverage](https://vitest.dev/config/coverage),
đặc biệt `include`, `reportOnFailure` và `reportsDirectory`.
