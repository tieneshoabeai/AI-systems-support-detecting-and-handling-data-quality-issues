# utils

## 1. Mục đích

Đọc thông tin thời hạn và định danh từ access token để frontend điều phối phiên. Xác minh chữ ký và quyền thuộc backend.

## 2. Vị trí & phụ thuộc

`lib/session-storage.ts`, `services/auth/auth.service.ts` và `services/auth/session-coordinator.ts` dùng tiện ích này. Đầu ra được định kiểu bằng `AccessTokenInfo`.

## 3. Public API

- `readAccessToken(token: string): AccessTokenInfo | null` đọc claim `sub`, `exp` và trả `{ accountId, expiresAtMs }`. Trả `null` với chuỗi hoặc payload sai.
- `isAccessTokenExpired(info: AccessTokenInfo, nowMs: number): boolean` trả `true` khi thời điểm bằng/vượt hạn hoặc thời điểm hiện tại không hữu hạn.

## 4. Cách dùng (ví dụ)

```ts
import { isAccessTokenExpired, readAccessToken } from './utils/auth/access-token'

console.log(readAccessToken('invalid')) // null
console.log(isAccessTokenExpired({ accountId: 'demo', expiresAtMs: 1000 }, 1000)) // true
```

Ví dụ chạy trong TypeScript với runtime có `atob` và `TextDecoder`.

## 5. Cấu trúc thư mục

**Khi thêm code.** Đặt helper thuần dùng chung theo nhóm, như xử lý claim trong `auth/`. Quyết định chuyển pha phiên thuộc coordinator và phép tính hình học thuộc [math](../math/README.md).

- [auth/access-token.ts](auth/access-token.ts) — giải mã payload và so sánh thời hạn.

## 6. Luồng hoạt động

Tách token thành ba phần → giải mã payload base64url thành UTF-8 → đọc JSON → kiểm tra `sub` và `exp` → đổi `exp` từ giây sang mili giây.

## 7. Cấu hình

| Tham số | Mặc định | Tác dụng |
| --- | --- | --- |
| `nowMs` | Caller truyền | Mốc thời gian để so với `expiresAtMs` |

## 8. Quy ước & bất biến

Dùng mili giây cho đồng hồ phía frontend. Xem `null` là token không đọc được. Không dùng claim đã giải mã làm bằng chứng phân quyền.

## 9. Test & debug

Chạy `yarn test src/__tests__/foundation/session.test.ts src/__tests__/auth/auth.service.test.ts`. Debug bằng token giả hoặc object thời hạn mẫu.

## 10. Giới hạn & lưu ý

Chỉ hỗ trợ định dạng token ba phần với claim hợp lệ. Việc payload đọc được không chứng minh chữ ký hợp lệ.

## 11. Hướng cải tiến

Chưa có công việc triển khai riêng cho tầng này. Đề xuất giữ các ca biên của `exp` trong suite phiên khi contract auth thay đổi.
