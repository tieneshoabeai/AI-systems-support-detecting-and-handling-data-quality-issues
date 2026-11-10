# __tests__

## 1. Mục đích

Kiểm tra contract, trạng thái, tương tác và hình học frontend bằng Vitest. Thư mục này không cung cấp tính năng runtime.

## 2. Vị trí & phụ thuộc

Vitest thu thập test qua `vitest.config.ts`. Suites dùng source frontend, Testing Library, jsdom và mock theo từng ca. Test repository dùng IndexedDB mô phỏng.

## 3. Public API

Không có API production. [preview-test-kit.tsx](preview/preview-test-kit.tsx) và helper trong `dataset-3d/support` cung cấp công cụ riêng cho các test.

## 4. Cách dùng (ví dụ)

```sh
yarn test src/__tests__/workspace-3d/local-csv.test.ts
```

Chạy từ thư mục frontend sau khi đã cài dependency. Vitest chạy bộ input CSV nhỏ và báo kết quả parse hoặc lỗi theo các assertion của file.

## 5. Cấu trúc thư mục

**Khi thêm test.** Chọn thư mục theo hành vi cần kiểm như `auth/`, `preview/` hay `dataset-3d/`. Đặt fixture/helper chỉ dùng trong một suite cạnh suite đó.

### Foundation và Auth

- [api.test.ts](foundation/api.test.ts) — cấu hình, transport và error mapping.
- [session.test.ts](foundation/session.test.ts) — token và session storage.
- [startup.test.tsx](foundation/startup.test.tsx) — entry và hành vi khởi động.
- [auth-flow.test.tsx](auth/auth-flow.test.tsx) — UI đăng nhập, guard và gia hạn.
- [auth.service.test.ts](auth/auth.service.test.ts) — request/response login.
- [session-coordinator.test.ts](auth/session-coordinator.test.ts) — chuyển pha, consent, logout và race.
- [session-services.test.ts](auth/session-services.test.ts) — refresh/logout, health và user mapping.
- [upload-draft.repository.test.ts](auth/upload-draft.repository.test.ts) — draft theo tài khoản, quota và ACK.

### Preview 2D

- [preview-constraints.test.ts](preview/preview-constraints.test.ts) — ràng buộc của preview.
- [preview-entry.test.tsx](preview/preview-entry.test.tsx) — entry, URL và scope.
- [preview-interactions.test.tsx](preview/preview-interactions.test.tsx) — tương tác thẻ, menu và dialog.
- [preview-notifications.test.tsx](preview/preview-notifications.test.tsx) — trạng thái và thao tác thông báo.
- [preview-reports.test.tsx](preview/preview-reports.test.tsx) — thao tác với report mẫu.
- [preview-settings.test.tsx](preview/preview-settings.test.tsx) — thao tác cài đặt.
- [preview-shell.test.tsx](preview/preview-shell.test.tsx) — bố cục và điều hướng shell.
- [preview-test-kit.tsx](preview/preview-test-kit.tsx) — tiện ích render và setup test preview.
- [preview-views.test.tsx](preview/preview-views.test.tsx) — các màn hình preview.
- [preview-worst-case.test.tsx](preview/preview-worst-case.test.tsx) — dữ liệu biên, rỗng và danh sách lớn.

### Workspace 3D

- [connection-geometry.test.ts](workspace-3d/connection-geometry.test.ts) — cổng và đường nối.
- [local-csv-viewer.test.tsx](workspace-3d/local-csv-viewer.test.tsx) — bảng và phân trang CSV.
- [local-csv.test.ts](workspace-3d/local-csv.test.ts) — parser và cây tài nguyên CSV.
- [preview-entry.test.tsx](workspace-3d/preview-entry.test.tsx) — entry 3D preview.
- [resource-label-policy.test.ts](workspace-3d/resource-label-policy.test.ts) — quy tắc hiển thị nhãn.
- [resource-layout.test.ts](workspace-3d/resource-layout.test.ts) — validation, bố cục và đường dẫn cây.
- [resource-map.test.tsx](workspace-3d/resource-map.test.tsx) — render và lựa chọn trên bản đồ.
- [resource-navigation.test.ts](workspace-3d/resource-navigation.test.ts) — lệnh camera và điều hướng tài nguyên.
- [scene-lifecycle.test.tsx](workspace-3d/scene-lifecycle.test.tsx) — vòng đời scene và motion.

### Dataset 3D và Neon Cube

- [dataset-3d-view.test.tsx](dataset-3d/dataset-3d-view.test.tsx) — view, legend, focus và chọn part.
- [holographic-towers.test.ts](dataset-3d/holographic-towers.test.ts) — bố cục tháp holographic.
- [inbound-stream-paths.test.ts](dataset-3d/inbound-stream-paths.test.ts) — hình học luồng vào.
- [inbound-streams.test.ts](dataset-3d/inbound-streams.test.ts) — model và update luồng vào.
- [issue-constellation.test.ts](dataset-3d/issue-constellation.test.ts) — cụm hạt vấn đề.
- [model-fingerprint.test.ts](dataset-3d/model-fingerprint.test.ts) — so fingerprint theo từng trạng thái model.
- [orbit-clearance.test.ts](dataset-3d/orbit-clearance.test.ts) — so khoảng cách giữa quỹ đạo, tháp và lõi.
- [spool-core.test.ts](dataset-3d/spool-core.test.ts) — cấu hình, hình học và vật liệu buồng lõi.
- [support/model-fingerprint.ts](dataset-3d/support/model-fingerprint.ts) — helper lấy fingerprint từ model.
- [support/orbit-clearance.ts](dataset-3d/support/orbit-clearance.ts) — helper tính khoảng cách.
- [tower-crowns.test.ts](dataset-3d/tower-crowns.test.ts) — chi tiết đỉnh tháp.
- [tower-gauge-data.test.ts](dataset-3d/tower-gauge-data.test.ts) — điểm mẫu và trạng thái ô.
- [tower-gauge.test.ts](dataset-3d/tower-gauge.test.ts) — lắp ráp và cập nhật gauge.
- [tower-picking.test.ts](dataset-3d/tower-picking.test.ts) — chọn part và ánh xạ ID.
- [neon-cube.model.test.ts](neon-cube/neon-cube.model.test.ts) — model, theme và cấu trúc mesh.
- [neon-cube-spec.test.ts](neon-cube/neon-cube-spec.test.ts) — kiểm đặc tả cube.

## 6. Luồng hoạt động

`yarn test` → Vitest đọc config → tạo môi trường jsdom từng file → setup fixture/mock → thực thi và so assertion → dọn mock, env stub hoặc dữ liệu giả theo cấu hình và suite.

## 7. Cấu hình

| Tham số | Mặc định | Tác dụng |
| --- | --- | --- |
| `environment` | `jsdom` | Mô phỏng DOM cho test |
| `include` | `src/__tests__/**/*.test.{ts,tsx}` | Mẫu tìm suite |
| `envDir` | `false` | Không nạp file env cục bộ |
| `fileParallelism` | `false` | Chạy file tuần tự |
| `clearMocks`, `restoreMocks`, `unstubEnvs` | `true` | Đặt lại mock và biến môi trường giữa các ca |

## 8. Quy ước & bất biến

Dùng `.test.ts` cho test không có JSX và `.test.tsx` cho test dựng UI. Thư mục `__tests__/` được dùng JSX theo quy tắc frontend. Dùng fixture và dữ liệu giả. Baseline hình học cần review khi source đổi. Giữ setup độc lập để kết quả không dựa vào thứ tự test.

## 9. Test & debug

`yarn test` chạy toàn bộ. Thêm đường dẫn hoặc `-t 'tên ca'` để thu hẹp. Khi test scene hỏng, đọc assertion đầu tiên và phân biệt khác biệt model với giới hạn canvas của jsdom.

## 10. Giới hạn & lưu ý

Test mô phỏng không xác nhận API thật, chất lượng WebGL hay hiệu năng GPU. Checkout hiện tại còn lỗi ở các kiểm tra 3D. Xem assertion và diff baseline khi triage.

## 11. Hướng cải tiến

Đối chiếu riêng các lỗi hình học và palette đang mở. Đề xuất bổ sung kiểm thử trên trình duyệt cho tương tác WebGL khi có tiêu chí acceptance.
