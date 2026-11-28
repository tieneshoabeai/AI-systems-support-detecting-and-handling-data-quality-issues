# Services

`src/services` chứa các thao tác nghiệp vụ gọi API, điều phối phiên, xử lý dữ liệu Management và các helper điều hướng. UI gọi service qua runtime, provider hoặc hook tùy luồng. Phần gửi HTTP và chuẩn hóa lỗi dùng [`src/lib`](../lib/README.md).

## Chọn đúng chỗ khi sửa

| Nhóm | Trách nhiệm | Bắt đầu đọc |
| --- | --- | --- |
| `auth` | Đăng nhập, gia hạn, kết thúc phiên, tài khoản và callback Google | [`auth.service.ts`](auth/auth.service.ts), [`session-coordinator.ts`](auth/session-coordinator.ts), [`account.service.ts`](auth/account.service.ts), [`google-sign-in.ts`](auth/google-sign-in.ts) |
| `health` | Kiểm tra backend trước khi gia hạn phiên | [`health.service.ts`](health/health.service.ts) |
| `users` | Đọc hồ sơ và xóa tài khoản qua `/users/me` | [`users.service.ts`](users/users.service.ts) |
| `management` | Store workspace/project, mapping phiên, chức năng quản trị, đọc CSV xem trước và kiểm tra upload | [`management.store.ts`](management/management.store.ts), [`session.mapper.ts`](management/session.mapper.ts), [`admin.service.ts`](management/admin.service.ts) |
| `processing` | Dataset và project gần đây, phân tích, feedback, báo cáo và kiểm tra đánh giá kết quả | [`dataset.service.ts`](processing/dataset.service.ts), [`analysis.service.ts`](processing/analysis.service.ts), [`recent-projects.service.ts`](processing/recent-projects.service.ts), [`result-review.ts`](processing/result-review.ts) |
| `offline` | Cache response đọc allowlist và chạy queue-first write/replay cho các command được phép | [`offline-data.service.ts`](offline/offline-data.service.ts), [`offline-write.service.ts`](offline/offline-write.service.ts) |
| `navigation` | Tạo và phân tích URL Management/Processing, chuyển hướng URL cũ | [`application-route.ts`](navigation/application-route.ts) |

[`services/index.ts`](index.ts) export một số factory và helper, gồm `createAuthService`, `createSessionCoordinator`, `createHealthService`, `createUsersService`, `createOfflineDataService`, `createOfflineWriteService` và `validateResultReview`. Factory dataset, factory admin và loader project gần đây được import từ file triển khai tương ứng. Kiểm tra `index.ts` của nhóm trước khi chọn đường dẫn import.

## Lần theo hai luồng thực tế

### Đăng nhập và vòng đời phiên

1. [`app-runtime.ts`](../app/app-runtime.ts) ghép HTTP client, storage và các service để tạo coordinator.
2. Coordinator nhận yêu cầu đăng nhập, chuyển sang `signing-in` và gọi auth service. Với callback Google, coordinator tạo phiên ứng viên từ token, gọi `getMe` và kiểm tra hồ sơ khớp tài khoản.
3. Nếu tác vụ vẫn thuộc phiên hiện tại và dữ liệu hợp lệ, coordinator lưu phiên và phát snapshot. UI đọc snapshot qua AuthProvider. Kết quả từ tác vụ cũ bị bỏ qua nếu phiên đã thay đổi.
4. Access token hết hạn sẽ chạy health check rồi mở hộp thoại xác nhận. Network, timeout, 5xx hoặc backend chưa sẵn sàng chuyển phiên sang `local-limited`, giữ credential/IndexedDB và chặn replay worker; khi mạng trở lại, health cùng `/users/me` được kiểm tra lại. Chỉ refresh bị từ chối/hết hạn, tài khoản không hoạt động hoặc người dùng từ chối mới kết thúc phiên. Khi đang đổi tunnel mà access token đã hết hạn, hộp thoại vẫn chờ xác nhận; refresh và `/users/me` chạy qua URL mới, worker chỉ resume sau khi profile hợp lệ. Khi đăng xuất, `SignOutResult` cho biết riêng kết quả thu hồi ở backend và lỗi dọn cục bộ nếu có.

### Ghi offline và replay queue

API wrapper chỉ queue request có `deferIfOffline: true` và payload/path nằm trong allowlist. Upload project đã tồn tại cần `deferredDraftId` khớp draft account/project/hash; upload của wizard không được đưa vào queue. `OfflineWriteService` commit command vào IndexedDB trước khi trả receipt; Web Lock staging bảo đảm liên kết upload draft có trước command, còn Web Lock độc quyền tránh hai tab replay đồng thời. Queue replay theo sequence khi session gate mở. PATCH được gửi kèm `expectedVersion`; conflict chuyển `blocked`. Request có kết quả chưa rõ chuyển `uncertain`; upload ở trạng thái này chỉ được xác nhận bằng dataset/hash backend khớp, nếu không sẽ `blocked` và không retry tự động. `confirmed` chỉ được ghi sau ACK/đối chiếu và được lưu bền trước khi draft Blob được dọn.

### Đọc schema dataset

[`LiveDatasetPanel`](../views/processing/project/sections/live-dataset-panel.tsx) gọi `service.schema(id, signal)`. Phương thức `schema` gửi request theo phiên đến `/datasets/:id/schema`, rồi kiểm tra mảng cột, khóa trùng và các trường bắt buộc trước khi trả dữ liệu. Payload sai làm service ném `ApiError` với loại `invalid-response`.

Ví dụ import từ một module ở ngay dưới `src/`. Caller cấp client của phiên và `AbortSignal` của tác vụ.

```ts
import { createDatasetService } from './services/processing/dataset.service'
import type { ApiClient } from './types'

export function loadDatasetColumns(api: ApiClient, datasetId: string, signal: AbortSignal) {
  return createDatasetService(api).schema(datasetId, signal)
}
```

## Quy ước khi sửa service

- Giữ đường dẫn endpoint, request và kiểm tra response cạnh service sở hữu nghiệp vụ. Dùng `auth: 'public'` hoặc `auth: 'session'` theo endpoint.
- Tách kiểu hợp đồng và dữ liệu chạy thật. Với phản hồi cần kiểm tra, nhận `unknown` rồi xác thực hoặc map trước khi trả model. Xem [`types/README.md`](../types/README.md).
- Truyền `AbortSignal` tại những thao tác có hỗ trợ hủy. Giữ việc ghi phiên và phát snapshot trong coordinator.
- Workbench trực tuyến báo lỗi API cho UI. Test cấp fixture và store giả từ `src/__tests__/support/`.

## Cấu trúc thư mục hiện tại

```text
src/services/
├── auth/
│   ├── account.service.ts
│   ├── auth.service.ts
│   ├── google-sign-in.ts
│   ├── index.ts
│   └── session-coordinator.ts
├── health/
│   ├── health.service.ts
│   └── index.ts
├── management/
│   ├── admin.service.ts
│   ├── csv-preview.ts
│   ├── index.ts
│   ├── management.store.ts
│   ├── management.types.ts
│   ├── session.mapper.ts
│   ├── type.ts
│   └── upload-validation.ts
├── navigation/
│   ├── application-route.ts
│   ├── legacy-workbench-route.ts
│   └── index.ts
├── offline/
│   └── offline-data.service.ts
├── processing/
│   ├── analysis.service.ts
│   ├── dataset.service.ts
│   ├── index.ts
│   ├── recent-projects.service.ts
│   ├── result-review.ts
│   └── type.ts
├── users/
│   ├── index.ts
│   └── users.service.ts
├── README.md
└── index.ts
```

## Kiểm thử

Chạy từ `src/frontend`.

| Nhóm | Lệnh |
| --- | --- |
| Phiên và callback Google | `yarn test src/__tests__/auth/session-services.test.ts src/__tests__/auth/session-coordinator.test.ts src/__tests__/auth/google-sign-in.test.ts` |
| Mapping, API Management và contract | `yarn test src/__tests__/management/connected-api.test.ts src/__tests__/management/backend-contract.test.ts` |

Các suite trên dùng dữ liệu hoặc transport mô phỏng. Xem [README frontend](../../README.md) để chạy bài kiểm tra với backend thử nghiệm.

## Danh mục luồng theo nhóm service

Các thao tác HTTP bên dưới đi qua [API client](../lib/README.md). Service nhận lại dữ liệu hoặc lỗi đã được chuẩn hóa. Với helper và store cục bộ, kết quả quay về caller hoặc subscriber.

| Chức năng | Caller → service → kết quả |
| --- | --- |
| Đăng nhập email, khôi phục và callback Google | LoginView/useLogin hoặc AuthProvider → [coordinator](auth/session-coordinator.ts) → AuthService hoặc UsersService → kiểm tra và lưu phiên → snapshot cho guard. |
| Đăng ký, quên, đặt lại mật khẩu | Form auth → [account service](auth/account.service.ts) → endpoint public tương ứng → phản hồi hoặc lỗi về form. |
| Kiểm tra phiên, gia hạn, đăng xuất, xóa tài khoản | AuthProvider/UI → coordinator → health, refresh, logout hoặc `deleteMe` theo thao tác → cập nhật hoặc dọn phiên, thông báo kết quả cho UI. |
| Hồ sơ và trạng thái hệ thống | Coordinator → [users service](users/users.service.ts) đọc hồ sơ hiện tại. Settings → [health service](health/health.service.ts) đọc readiness → trạng thái MongoDB/storage hoặc lỗi. |
| Overview, workspace, project và thông tin cá nhân | ManagementDataProvider → [store](management/management.store.ts) tải dữ liệu và phân trang → map sang model → publish snapshot theo vùng. |
| Chọn hoặc đánh dấu yêu thích tài nguyên | View/card → store cập nhật selection/favorite trong snapshot. Mở workspace có thể gọi `touchWorkspace` để cập nhật dấu truy cập. |
| Tạo, cập nhật, đổi tên, xóa, chuyển chủ và rời tài nguyên | Wizard/dialog → store gửi mutation; khi endpoint yêu cầu thì gửi version → làm mới snapshot hoặc trả lỗi. `completeProject` gửi cập nhật snapshot project. |
| Quản lý thành viên | Dialog → store thêm/xóa member workspace và thêm/đổi vai trò/xóa member project. `setWorkspaceMemberRole` đi qua nhánh unsupported. |
| CSV và upload | Wizard dùng [CSV preview](management/csv-preview.ts) và [upload validation](management/upload-validation.ts); sau xác nhận, store tạo project và upload nếu có file. Project detail có luồng upload riêng qua store → FormData → phản hồi và thông tin dataset. |
| Project gần đây | RecentProjects → store → [loader](processing/recent-projects.service.ts) đọc danh sách theo cursor → bảng nhận items và con trỏ. |
| Thông báo | Màn hình thông báo → store đọc chi tiết, đánh dấu một hoặc tất cả đã đọc → snapshot. Xóa thông báo trả lỗi chưa hỗ trợ. |
| Issue và tệp | Report/workbench → store tạo, đọc, sửa issue và tải hoặc gửi tệp → kết quả về panel. |
| Settings tài khoản | Settings → store map và cập nhật hồ sơ, đổi mật khẩu, tải/đọc chi tiết hoặc thu hồi phiên, cập nhật tùy chọn thông báo → dữ liệu trả về UI. |
| Quản trị | AdminApiPanel → [admin service](management/admin.service.ts) lấy trang/danh sách và chi tiết user/issue, cập nhật trạng thái issue → kiểm tra dữ liệu rồi trả model hoặc lỗi. |
| Dataset | LiveDatasetPanel → [dataset service](processing/dataset.service.ts) → chi tiết/schema/records, thống kê cột, dữ liệu biểu đồ, xóa hoặc tải CSV gốc → model, kết quả mutation hoặc Blob cho panel. |
| Cache đọc offline | ManagementDataProvider → [offline data service](offline/offline-data.service.ts) bọc API client → lưu response online theo account/environment/request key, fallback khi network/timeout/5xx hoặc session gate, báo cache miss khi chưa có bản lưu → store và banner trạng thái cache. |
| Analysis | Project panel/store → [analysis service](processing/analysis.service.ts) → chạy/đọc kết quả, đọc/thử lại job, đọc/tạo tổng kết, yêu cầu/tải report, đọc chỉ số AI. Tải report trả trạng thái pending hoặc PDF đã kiểm tra. |
| Feedback và đánh giá | Panel feedback → analysis service đọc/tạo feedback cấp run hoặc finding, sửa/xóa feedback. Dialog đánh giá riêng → [validation](processing/result-review.ts) → callback caller nếu dữ liệu hợp lệ. |
| URL hiện tại và URL cũ | App/router/workbench → helper [application route](navigation/application-route.ts) hoặc [legacy redirect](navigation/legacy-workbench-route.ts) → URL/phạm vi hợp lệ hoặc kết quả không khớp. |
