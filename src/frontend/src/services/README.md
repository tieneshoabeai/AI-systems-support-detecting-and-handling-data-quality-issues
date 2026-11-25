# Services

`src/services` chứa các thao tác nghiệp vụ gọi API, điều phối phiên, xử lý dữ liệu Management và các helper điều hướng. UI gọi service qua runtime, provider hoặc hook tùy luồng. Phần gửi HTTP và chuẩn hóa lỗi dùng [`src/lib`](../lib/README.md).

## Chọn đúng chỗ khi sửa

| Nhóm | Trách nhiệm | Bắt đầu đọc |
| --- | --- | --- |
| `auth` | Đăng nhập, gia hạn, kết thúc phiên, tài khoản và callback Google | [`auth.service.ts`](auth/auth.service.ts), [`session-coordinator.ts`](auth/session-coordinator.ts), [`account.service.ts`](auth/account.service.ts), [`google-sign-in.ts`](auth/google-sign-in.ts) |
| `health` | Kiểm tra backend trước khi gia hạn phiên | [`health.service.ts`](health/health.service.ts) |
| `users` | Đọc hồ sơ và xóa tài khoản qua `/users/me` | [`users.service.ts`](users/users.service.ts) |
| `management` | Store workspace/project, mapping phiên, chức năng quản trị, đọc CSV xem trước và kiểm tra upload | [`management.store.ts`](management/management.store.ts), [`session.mapper.ts`](management/session.mapper.ts), [`admin.service.ts`](management/admin.service.ts) |
| `processing` | Chi tiết, schema và records của dataset, thống kê cột, cờ PII, xóa dataset, tải CSV gốc, project gần đây và kiểm tra đánh giá kết quả | [`dataset.service.ts`](processing/dataset.service.ts), [`recent-projects.service.ts`](processing/recent-projects.service.ts), [`result-review.ts`](processing/result-review.ts) |
| `navigation` | Tạo và phân tích URL Management/Processing, chuyển hướng URL cũ | [`application-route.ts`](navigation/application-route.ts) |

[`services/index.ts`](index.ts) export một số factory và helper, gồm `createAuthService`, `createSessionCoordinator`, `createHealthService`, `createUsersService` và `validateResultReview`. Factory dataset, factory admin và loader project gần đây được import từ file triển khai tương ứng. Kiểm tra `index.ts` của nhóm trước khi chọn đường dẫn import.

## Lần theo hai luồng thực tế

### Đăng nhập và vòng đời phiên

1. [`app-runtime.ts`](../app/app-runtime.ts) ghép HTTP client, storage và các service để tạo coordinator.
2. Coordinator nhận yêu cầu đăng nhập, chuyển sang `signing-in` và gọi auth service. Với callback Google, coordinator tạo phiên ứng viên từ token, gọi `getMe` và kiểm tra hồ sơ khớp tài khoản.
3. Nếu tác vụ vẫn thuộc phiên hiện tại và dữ liệu hợp lệ, coordinator lưu phiên và phát snapshot. UI đọc snapshot qua AuthProvider. Kết quả từ tác vụ cũ bị bỏ qua nếu phiên đã thay đổi.
4. Gia hạn đi qua health check và xác nhận người dùng khi đủ điều kiện. Khi đăng xuất, `SignOutResult` cho biết riêng kết quả thu hồi ở backend và lỗi dọn cục bộ nếu có.

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
│   └── upload-validation.ts
├── navigation/
│   ├── application-route.ts
│   ├── legacy-workbench-route.ts
│   └── index.ts
├── processing/
│   ├── dataset.service.ts
│   ├── index.ts
│   ├── recent-projects.service.ts
│   └── result-review.ts
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
