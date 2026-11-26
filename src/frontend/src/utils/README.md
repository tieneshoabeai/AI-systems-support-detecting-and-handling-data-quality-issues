# Utils

`src/utils` chứa helper dùng chung để đọc thông tin access token và kiểm tra giá trị bắt buộc. Import các helper qua [`utils/index.ts`](index.ts).

## Bản đồ file

| File | Trách nhiệm |
| --- | --- |
| [`auth/access-token.ts`](auth/access-token.ts) | Đọc claim cần cho frontend và kiểm tra thời điểm hết hạn. |
| [`auth/index.ts`](auth/index.ts) | Điểm import của nhóm helper token. |
| [`required-value.ts`](required-value.ts) | Buộc giá trị tồn tại và ném lỗi có nhãn nếu giá trị là `undefined`. |
| [`index.ts`](index.ts) | Export ba helper `readAccessToken`, `isAccessTokenExpired` và `requireDefined`. |

## Đọc và kiểm tra hạn token

`readAccessToken(token)` đọc payload JWT và chuyển `sub` thành `accountId`, `exp` từ giây sang `expiresAtMs`. Nếu `sessionId` là chuỗi có giá trị, kết quả cũng chứa claim này. Token sai cấu trúc hoặc thiếu claim bắt buộc hợp lệ trả `null`. Backend chịu trách nhiệm xác minh chữ ký và quyền truy cập.

`isAccessTokenExpired(info, nowMs)` trả `true` khi `nowMs >= info.expiresAtMs` hoặc `nowMs` không hữu hạn. Caller đưa thời gian vào để có thể kiểm tra chính xác các giá trị ngay trước và đúng thời điểm hết hạn.

Ví dụ từ module đặt ngay dưới `src/`:

```ts
import { isAccessTokenExpired, readAccessToken } from './utils'

export function hasUnexpiredAccessToken(token: string, nowMs: number) {
  const info = readAccessToken(token)
  return info !== null && !isAccessTokenExpired(info, nowMs)
}
```

Xem [session storage](../lib/session-storage.ts) để thấy cách helper này tham gia kiểm tra bản ghi phiên.

## Đọc giá trị bắt buộc

`requireDefined(value, label)` trả nguyên giá trị đầu vào nếu giá trị tồn tại. `0`, `false`, chuỗi rỗng và `null` đều được giữ. Với `undefined`, hàm ném `Error` có nội dung `Missing required value: <label>`. Dùng nhãn nêu rõ trường hoặc vị trí lỗi. Nếu thiếu dữ liệu là trạng thái hợp lệ, xử lý nhánh đó tại caller.

## Cấu trúc thư mục hiện tại

```text
src/utils/
├── auth/
│   ├── access-token.ts
│   └── index.ts
├── README.md
├── index.ts
└── required-value.ts
```

## Kiểm thử

Từ `src/frontend`, chạy `yarn test src/__tests__/foundation/session.test.ts src/__tests__/auth/auth.service.test.ts` để kiểm tra helper token qua các luồng lưu phiên và xác thực. Dùng token mẫu khi debug.

## Caller → kiểm tra → kết quả

- **Đọc token:** AuthService/coordinator → [readAccessToken](auth/access-token.ts) → account ID, thời điểm hết hạn hoặc `null` khi dữ liệu sai → caller quyết định việc dùng phiên.
- **So hạn token:** Caller cấp thông tin token và thời gian hiện tại → `isAccessTokenExpired` → boolean cho bước điều phối phiên.
- **Giá trị bắt buộc:** Ví dụ helper điều hướng truyền segment và tên vị trí → [requireDefined](required-value.ts) → giá trị có kiểu hẹp hơn hoặc lỗi có nhãn để truy vết.
