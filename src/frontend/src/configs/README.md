# configs

## 1. Mục đích

Kiểm tra cấu hình HTTP và tập trung các giới hạn dung lượng bản nháp. Lớp gửi request nằm ở [lib](../lib/README.md), còn lớp ghi bản nháp nằm ở [repositories](../repositories/README.md).

## 2. Vị trí & phụ thuộc

`app/application-bootstrap.tsx` và `lib/axios-client.ts` dùng cấu hình API. `repositories/datasets/upload-draft.repository.ts` dùng hạn mức dung lượng. Config API dùng `ApiError` và kiểu `ApiConfig`.

## 3. Public API

- `parseApiConfig(value: unknown): ApiConfig` kiểm tra URL API đầy đủ và chuẩn hóa dấu `/` cuối.
- `composeApiConfig(baseValue: unknown, prefixValue: unknown): ApiConfig` ghép origin và prefix. `getApiConfig(): ApiConfig` lấy hai đầu vào từ Vite. Cả ba ném `ApiError` loại `config` khi đầu vào sai.
- `DEFAULT_API_TIMEOUT_MS: number` và `UPLOAD_DRAFT_LIMITS` là hằng mặc định.

## 4. Cách dùng (ví dụ)

```ts
import { composeApiConfig } from './configs/api.config'

const config = composeApiConfig('https://example.test', '/api/v1')
console.log(config) // { baseUrl: 'https://example.test/api/v1', timeoutMs: 30000 }
```

Ví dụ chỉ tạo object, không gửi request. Đặt đoạn gọi trong ngữ cảnh module TypeScript dưới `src`.

## 5. Cấu trúc thư mục

**Khi thêm code.** Đặt bước đọc/chuẩn hóa biến API tại `api.config.ts`, hạn mức draft tại `upload-draft.config.ts`. Giá trị chỉ thuộc một scene đặt cạnh scene đó.

- [api.config.ts](api.config.ts) — kiểm tra URL, ghép prefix và đọc biến build Vite.
- [upload-draft.config.ts](upload-draft.config.ts) — hạn mức theo file, tài khoản và toàn ứng dụng.

## 6. Luồng hoạt động

`getApiConfig()` → kiểm tra origin → kiểm tra prefix → ghép URL → trả `baseUrl` và `timeoutMs` cho client. Repository đọc hạn mức khi kiểm tra dung lượng trước khi ghi.

## 7. Cấu hình

| Tham số | Mặc định | Tác dụng |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Bắt buộc | Origin HTTP(S) của API |
| `VITE_API_PREFIX` | Bắt buộc | Đường dẫn API, ví dụ `/api/v1` |
| `DEFAULT_API_TIMEOUT_MS` | 30.000 ms | Hạn chờ HTTP mặc định |
| `UPLOAD_DRAFT_LIMITS` | 50 MiB/file, 200 MiB/tài khoản, 500 MiB/toàn app | Ngưỡng nhận bản nháp |

## 8. Quy ước & bất biến

Biến base chỉ chứa origin, prefix khai báo riêng. URL API từ chối credentials, query, hash và segment `docs` hoặc `docs-json`. Giá trị tiền tố `VITE_` có thể xuất hiện trong bundle trình duyệt.

## 9. Test & debug

Từ thư mục frontend chạy `yarn test src/__tests__/foundation/api.test.ts src/__tests__/auth/upload-draft.repository.test.ts`. Khi bootstrap báo lỗi cấu hình, đối chiếu tên biến, origin và prefix trước khi kiểm tra mạng.

## 10. Giới hạn & lưu ý

Validation URL kiểm tra hình thức. Backend, CORS và dung lượng IndexedDB còn phụ thuộc môi trường.

## 11. Hướng cải tiến

Đề xuất bổ sung ma trận cấu hình dev và deploy với origin giả nếu có thêm môi trường.
