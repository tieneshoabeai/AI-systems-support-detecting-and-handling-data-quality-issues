# configs

## 1. Mục đích

Kiểm tra cấu hình HTTP, định danh môi trường API ổn định và tập trung các giới hạn dung lượng bản nháp. Lớp gửi request nằm ở [lib](../lib/README.md), còn các kho IndexedDB nằm ở [repositories](../repositories/README.md).

## 2. Vị trí & phụ thuộc

`app/application-bootstrap.tsx` và `lib/axios-client.ts` dùng cấu hình API. `repositories/datasets/upload-draft.repository.ts` dùng hạn mức dung lượng. Config API dùng `ApiError` và kiểu `ApiConfig`.

## 3. Public API

- `getApiEnvironmentId(): string` trả về `environment:<id>`; mặc định `qa-main` ở dev và `production` khi build production. Đặt `VITE_API_ENVIRONMENT_ID` khác nhau khi backend trỏ tới môi trường dữ liệu khác.
- `parseApiConfig(value: unknown): ApiConfig` kiểm tra URL API đầy đủ và chuẩn hóa dấu `/` cuối.
- `composeApiConfig(baseValue: unknown, prefixValue: unknown): ApiConfig` ghép origin và prefix. `getApiConfig(): ApiConfig` đọc cấu hình ban đầu từ Vite environment; target runtime thay đổi được giữ bởi [`ApiTargetManager`](../lib/api-target-manager.ts). Các hàm ném `ApiError` loại `config` khi đầu vào sai.
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

`getApiConfig()` → kiểm tra cấu hình Vite ban đầu → tạo target ban đầu cho `ApiTargetManager`. Sau đó client đọc target/revision hiện hành từ manager tại đầu mỗi request. Repository đọc hạn mức khi kiểm tra dung lượng trước khi ghi.

## 7. Cấu hình

| Tham số | Mặc định | Tác dụng |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Bắt buộc | Origin HTTP(S) của API |
| `VITE_API_PREFIX` | Bắt buộc | Đường dẫn API, ví dụ `/api/v1` |
| `VITE_API_ENVIRONMENT_ID` | `qa-main` ở dev; `production` ở production | ID ổn định cho namespace local; đổi ID khi đổi môi trường dữ liệu, không đổi khi chỉ xoay tunnel |
| `DEFAULT_API_TIMEOUT_MS` | 30.000 ms | Hạn chờ HTTP mặc định |
| `UPLOAD_DRAFT_LIMITS` | 50 MiB/file, 200 MiB/tài khoản, 500 MiB/toàn app | Ngưỡng nhận bản nháp |

## 8. Quy ước & bất biến

Biến base chỉ chứa origin, prefix khai báo riêng. URL API từ chối credentials, query, hash và segment `docs` hoặc `docs-json`. Giá trị tiền tố `VITE_` có thể xuất hiện trong bundle trình duyệt.

## 9. Test & debug

Từ thư mục frontend chạy `yarn test src/__tests__/foundation/api.test.ts src/__tests__/auth/upload-draft.repository.test.ts`. Khi bootstrap báo lỗi cấu hình, đối chiếu tên biến, origin và prefix trước khi kiểm tra mạng.

## 10. Giới hạn & lưu ý

`getApiConfig()` ném lỗi `config` nếu frontend chạy HTTPS nhưng API dùng HTTP. `getApiEnvironmentId()` kiểm tra ID chỉ gồm chữ, số, dấu chấm, gạch dưới và gạch ngang, tối đa 64 ký tự. Khi đổi tunnel, manager giữ nguyên EnvironmentId/prefix và chỉ công bố URL mới sau readiness cùng xác minh tài khoản. Nếu URL hợp lệ mà vẫn lỗi mạng, kiểm tra backend và CORS theo origin đang chạy frontend. Dung lượng IndexedDB phụ thuộc trình duyệt.

## 11. Hướng cải tiến

Đề xuất bổ sung ma trận cấu hình dev và deploy với origin giả nếu có thêm môi trường.

## Từ cấu hình đến caller

| Chức năng | Nguồn → xử lý → nơi dùng |
| --- | --- |
| Cấu hình kết nối | Tên biến Vite → `getApiConfig` và `composeApiConfig` → target ban đầu; `ApiTargetManager` cấp target hiện hành cho Axios. Sai cấu hình trả lỗi `config` về điểm khởi tạo. |
| Hạn mức bản nháp | `UPLOAD_DRAFT_LIMITS` → repository kiểm tra từng file, tổng theo tài khoản và toàn ứng dụng trước khi ghi → caller nhận kết quả lưu hoặc lỗi dung lượng. |
