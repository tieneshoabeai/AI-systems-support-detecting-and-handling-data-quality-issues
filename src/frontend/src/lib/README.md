# Lib

`src/lib` cung cấp HTTP client, chuẩn hóa lỗi, lưu phiên và cấu hình query cache cho frontend. Các endpoint nghiệp vụ nằm trong [`services`](../services/README.md).

## Bản đồ file

| File | Trách nhiệm |
| --- | --- |
| [`axios-client.ts`](axios-client.ts) | Tạo `ApiClient`, kiểm tra URL và tùy chọn request, gửi request qua Axios và đọc response. |
| [`api-target-manager.ts`](api-target-manager.ts) | Giữ target/revision hiện hành, cấp lease cho request, hủy request cũ và điều phối pause/resume worker khi đổi URL. |
| [`api-target-hmr.ts`](api-target-hmr.ts) | Nhận target qua Vite HMR, yêu cầu manager xác minh backend/phiên rồi ACK trạng thái về dev server. |
| [`api-error.ts`](api-error.ts) | Định nghĩa `ApiError`, chuẩn hóa lỗi HTTP và cung cấp helper kiểm tra kiểu dữ liệu lúc chạy. |
| [`session-storage.ts`](session-storage.ts) | Đọc, ghi và xóa phiên trong storage qua một key riêng. |
| [`query-client.ts`](query-client.ts) | Tạo TanStack Query client và cung cấp thao tác hủy query, dọn cache khi đổi phiên. |
| [`openapi.json`](openapi.json), [`openapi.ts`](openapi.ts) | Đặc tả đã chuẩn hóa và kiểu sinh tự động. Xem quy trình đồng bộ ở [`types/README.md`](../types/README.md). |
| [`index.ts`](index.ts) | Điểm import chung cho các factory và helper của `lib`. |

## Request chạy như thế nào

1. [Runtime](../app/app-runtime.ts) nối auth, health, client theo phiên và các client riêng vào cùng `ApiTargetManager`. Mỗi request lấy target/revision tại thời điểm bắt đầu; client đang sống cũng dùng được tunnel mới.
2. Client ghép path dưới prefix và chặn path thoát khỏi prefix. Riêng `GET /health` và `/health/ready` với `auth: 'public'` dùng path ở origin backend, bên ngoài API prefix.
3. Network, timeout hoặc HTTP 5xx từ client đang dùng báo outage cho coordinator: phiên vào `local-limited`, request cần session bị chặn và worker/queue pause. Manager không xóa cache hay credential.
4. Khi nhận yêu cầu đổi target, manager tạm dừng worker đã đăng ký, hủy và đánh dấu request đang chạy, kiểm tra `/health/ready` và `/users/me` bằng phiên hiện tại. Nếu access token đã hết hạn, đợi người dùng xác nhận rồi refresh và kiểm tra hồ sơ trên URL mới. Chỉ sau khi xác minh mới công bố revision mới và bật worker. Nếu xác minh thất bại, giữ target cũ, giữ queue ở trạng thái pause và hiện lỗi trong UI.
5. Với `auth: 'session'`, client lấy token đã bind từ `readToken` để gắn Bearer. Token thiếu, phiên chưa xác nhận lại hoặc request đã bị hủy sẽ dừng trước khi gọi mạng.
6. Client bóc envelope JSON một lần. Request có `responseType: 'blob'` trả dữ liệu file. Service tiếp tục kiểm tra các trường nghiệp vụ trước khi trả model cho UI.

Ví dụ từ một module đặt ngay dưới `src/`. Hàm nhận client đã cấu hình và chuyển nó cho health service.

```ts
import { createHealthService } from './services'
import type { ApiClient } from './types'

export function checkBackend(api: ApiClient, signal: AbortSignal) {
  return createHealthService(api).check({ signal })
}
```

## Phiên và query cache

- `createSessionStorage` dùng key mặc định `data-quality.auth.v1`. `read()` trả `empty`, `invalid`, `expired` hoặc `valid`; trạng thái `expired` không tự xóa credential. `readToken()` chỉ trả access token khi access token và refresh session còn hạn. Khi access token hết hạn nhưng refresh session còn hiệu lực, coordinator giữ credential và vào `local-limited` nếu backend không kết nối được.
- `createQueryClient` tắt retry mặc định cho query và mutation, đồng thời tắt refetch khi focus hoặc kết nối lại. `clearSessionQueries` yêu cầu hủy các query đang chạy rồi dọn cache.

## Cấu trúc thư mục hiện tại

```text
src/lib/
├── README.md
├── api-error.ts
├── api-target-manager.ts
├── api-target-hmr.ts
├── axios-client.ts
├── index.ts
├── openapi.json
├── openapi.ts
├── query-client.ts
└── session-storage.ts
```

## Kiểm thử

Từ `src/frontend`, chạy `yarn test src/__tests__/foundation/api.test.ts src/__tests__/foundation/session.test.ts src/__tests__/foundation/startup.test.tsx`. Các suite dùng adapter, storage và môi trường trình duyệt mô phỏng.

## Đầu vào và đầu ra của từng chức năng

| Chức năng | Luồng |
| --- | --- |
| Request public hoặc theo phiên | Service → `request()` → chuẩn hóa path và tùy chọn, gắn Bearer cho chế độ session → Axios → HTTP. |
| Đọc response | Axios → status và body → API client trả `data` trong envelope, `Blob`, dữ liệu kèm status hoặc `undefined` cho 204 theo tùy chọn. Ví dụ login nhận `data`, còn tải report cần status để phân biệt đang tạo và đã có tệp. |
| Lỗi và kiểm tra object | Axios hoặc caller → [normalizeApiError/isRecord](api-error.ts) → lỗi chuẩn hóa hoặc kết quả kiểm tra → service/hook/UI xử lý. |
| Lưu, đọc, dọn phiên | Coordinator → [session storage](session-storage.ts) → browser storage → trạng thái bản ghi hoặc token về caller. |
| Query cache | Runtime → [query client](query-client.ts) → provider. Đổi phiên → hủy query → dọn cache theo vòng đời phiên. |
| Hợp đồng kiểu | OpenAPI JSON chuẩn hóa → kiểu TypeScript sinh tự động → [types](../types/README.md) và service tham chiếu khi biên dịch. |
