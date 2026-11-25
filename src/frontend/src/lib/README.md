# Lib

`src/lib` cung cấp HTTP client, chuẩn hóa lỗi, lưu phiên và cấu hình query cache cho frontend. Các endpoint nghiệp vụ nằm trong [`services`](../services/README.md).

## Bản đồ file

| File | Trách nhiệm |
| --- | --- |
| [`axios-client.ts`](axios-client.ts) | Tạo `ApiClient`, kiểm tra URL và tùy chọn request, gửi request qua Axios và đọc response. |
| [`api-error.ts`](api-error.ts) | Định nghĩa `ApiError`, chuẩn hóa lỗi HTTP và cung cấp helper kiểm tra kiểu dữ liệu lúc chạy. |
| [`session-storage.ts`](session-storage.ts) | Đọc, ghi và xóa phiên trong storage qua một key riêng. |
| [`query-client.ts`](query-client.ts) | Tạo TanStack Query client và cung cấp thao tác hủy query, dọn cache khi đổi phiên. |
| [`openapi.json`](openapi.json), [`openapi.ts`](openapi.ts) | Đặc tả đã chuẩn hóa và kiểu sinh tự động. Xem quy trình đồng bộ ở [`types/README.md`](../types/README.md). |
| [`index.ts`](index.ts) | Điểm import chung cho các factory và helper của `lib`. |

## Request chạy như thế nào

1. [Runtime](../app/app-runtime.ts) cấu hình client. Service gọi `request` với đường dẫn, chế độ xác thực và tùy chọn như `signal` hoặc timeout.
2. Client ghép path với API base. Riêng `GET /health` với `auth: 'public'` dùng path ở origin backend, bên ngoài API prefix.
3. Với `auth: 'session'`, client lấy token từ `readToken` để gắn Bearer. Token thiếu hoặc request đã bị hủy có thể làm thao tác dừng trước khi gọi mạng.
4. Client bóc envelope JSON một lần. Request có `responseType: 'blob'` trả dữ liệu file. Service tiếp tục kiểm tra các trường nghiệp vụ trước khi trả model cho UI.

Ví dụ từ một module đặt ngay dưới `src/`. Hàm nhận client đã cấu hình và chuyển nó cho health service.

```ts
import { createHealthService } from './services'
import type { ApiClient } from './types'

export function checkBackend(api: ApiClient, signal: AbortSignal) {
  return createHealthService(api).check({ signal })
}
```

## Phiên và query cache

- `createSessionStorage` dùng key mặc định `data-quality.auth.v1`. `read()` trả `empty`, `invalid`, `expired` hoặc `valid`. Bản ghi sai định dạng bị xóa theo key. `readToken()` chỉ trả access token từ phiên hợp lệ.
- `createQueryClient` tắt retry mặc định cho query và mutation, đồng thời tắt refetch khi focus hoặc kết nối lại. `clearSessionQueries` yêu cầu hủy các query đang chạy rồi dọn cache.

## Cấu trúc thư mục hiện tại

```text
src/lib/
├── README.md
├── api-error.ts
├── axios-client.ts
├── index.ts
├── openapi.json
├── openapi.ts
├── query-client.ts
└── session-storage.ts
```

## Kiểm thử

Từ `src/frontend`, chạy `yarn test src/__tests__/foundation/api.test.ts src/__tests__/foundation/session.test.ts src/__tests__/foundation/startup.test.tsx`. Các suite dùng adapter, storage và môi trường trình duyệt mô phỏng.
