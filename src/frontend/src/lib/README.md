# lib

## 1. Mục đích

Cung cấp hạ tầng HTTP, chuẩn hóa lỗi, cache truy vấn và lưu phiên. Kiểm tra DTO và quyết định nghiệp vụ thuộc services.

## 2. Vị trí & phụ thuộc

App runtime dùng HTTP và session storage. Bootstrap dùng QueryClient. Services và repositories dùng `ApiError`. Thư viện phụ thuộc Axios, TanStack Query, cấu hình API và tiện ích token.

## 3. Public API

- `createAxiosClient(options?: { baseUrl?: string; readToken?: TokenReader; adapter?: AxiosAdapter }): ApiClient`. `request<T>(options: ApiRequestOptions): Promise<T>` trả `data` của envelope hoặc ném `ApiError`.
- `ApiError` nhận thông tin `AppError`. `normalizeApiError(error: unknown): ApiError` chuẩn hóa lỗi. `isRecord(value: unknown): value is Record<string, unknown>` kiểm tra object.
- `createSessionStorage(options?: { getStorage?: () => SessionStoragePort; now?: () => number })` trả `read(): SessionReadResult`, `write(session: StoredSession): void`, `clear(): void`, `readToken(): string | null`. Có thể ném lỗi `storage` hoặc `session`.
- `createQueryClient(): QueryClient`, `clearSessionQueries(client: QueryClient): void` tạo cache và hủy/xóa cache phiên.

## 4. Cách dùng (ví dụ)

```ts
import { createQueryClient, clearSessionQueries } from './lib/query-client'

const client = createQueryClient()
client.setQueryData(['demo'], 42)
clearSessionQueries(client)
console.log(client.getQueryData(['demo'])) // undefined
```

Chạy trong module TypeScript dưới `src` với dependencies frontend.

## 5. Cấu trúc thư mục

**Khi thêm code.** Đặt xử lý HTTP, lỗi, cache hoặc storage dùng chung trong file hạ tầng tương ứng. Mapper của một endpoint đặt cạnh [service](../services/README.md) gọi endpoint đó.

- [api-error.ts](api-error.ts) — lớp lỗi ứng dụng và mapper lỗi Axios.
- [axios-client.ts](axios-client.ts) — kiểm tra URL, gắn token, gửi request, unwrap envelope.
- [query-client.ts](query-client.ts) — cấu hình QueryClient và dọn cache phiên.
- [session-storage.ts](session-storage.ts) — kiểm tra schema, hạn phiên và lưu/xóa một key.

## 6. Luồng hoạt động

`request` kiểm tra auth mode, path, timeout và signal → thêm bearer nếu `session` → Axios gửi → unwrap `success/data` đúng một lần. Session storage đọc JSON → xác thực schema và account → trả `empty`, `invalid`, `expired` hoặc `valid`. Phiên lỗi format bị xóa riêng key.

## 7. Cấu hình

| Tham số | Mặc định | Tác dụng |
| --- | --- | --- |
| HTTP method / timeout | `GET` / 30.000 ms | Cách gọi và hạn chờ mỗi request |
| `SESSION_STORAGE_KEY` | `data-quality.auth.v1` | Key phiên trong `window.sessionStorage` |
| Query retry, mutation retry, refetch khi focus/reconnect | `false` | Tránh tự gửi lại hoặc làm mới query theo sự kiện |

## 8. Quy ước & bất biến

Yêu cầu khai báo `auth` rõ. Bearer chỉ gắn vào request `session` trong API base. `readToken()` chỉ trả token ở trạng thái `valid`. Không đưa raw Axios config hoặc credential vào log.

## 9. Test & debug

Chạy `yarn test src/__tests__/foundation/api.test.ts src/__tests__/foundation/session.test.ts`. Dùng Axios adapter và storage giả để kiểm nhánh lỗi mà không gọi mạng.

## 10. Giới hạn & lưu ý

Client chỉ xác thực envelope, DTO cụ thể do service kiểm tra. Hủy phía client không xác nhận server đã dừng xử lý.

## 11. Hướng cải tiến

Nếu triển khai binary export, bổ sung transport riêng theo thiết kế foundation vì luồng hiện tại mong đợi JSON envelope.
