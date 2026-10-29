# Module 01 — Auth và vòng đời phiên

Trạng thái: plan, chưa code/chưa test nghiệp vụ. Owner FE A; reviewer FE B. Nguồn: [contract audit](00-contract-audit.md), `src/backend/src/modules/auth/`, `modules/users/users.service.ts`, user/session schemas, JWT strategy; Swagger live ngày 26/10/2026. Mọi path API dưới đây có prefix `/api/v1`; payload response là T bên trong envelope theo source.

## 1. Yêu cầu và phạm vi

Cho người dùng đăng nhập, quản lý phiên và quay lại ứng dụng sau reload với chính sách consent đã chốt. Không giả auth thành công khi BE lỗi. Foundation làm login/session trước; register/sessions/revoke là batch feature sau.

Có 6 operation Auth; health và `/users/me` là phụ thuộc. Chưa có Google OAuth, forgot/reset password, permissions trong Swagger. Public register nhận role nhưng policy tạo admin chưa được BE xác nhận: không hiển thị chọn role, chưa phát hành đăng ký trước gate này. Xóa account thuộc module User và chưa được duyệt UI.

## 2. Đặc tả sáu mục

| Mục | Quy định |
|---|---|
| Đầu vào | Login email/password, device_name tùy chọn; register email/password/first_name/last_name; refresh_token; session id khi revoke |
| Điều kiện | Input theo schema thật; storage có cấu trúc hợp lệ, accountId khớp sub; private action cần phiên hợp lệ; server quyết định quyền |
| Xử lý | Login → validate response → ghi một object session → runtime state → private route. Reload → đọc schema/exp → health/consent hoặc `/users/me` tùy trạng thái. Logout kết thúc FE và cố thu hồi server khi token dùng được |
| Đầu ra | Session state và user từ server; login/register failure là lỗi có nguồn, không mở private route; không lưu password |
| Xếp loại | bootstrapping, anonymous, authenticated, local-limited, awaiting-consent, refreshing; đây là nhóm state đề xuất, không phải field API |
| Thứ tự | Phiên mới nhất thắng; chặn request khi expired/consent/refresh; một health/dialog/refresh trong mỗi tab; không tự replay mutation |

## 3. Contract theo operation

| API | Input/validation static | T theo source | Hành vi FE |
|---|---|---|---|
| POST `/auth/login` | email đúng định dạng; password string min 1; device_name optional | access_token, refresh_token, expires_in, user `{ id,email,first_name,last_name,role }` | Không áp min 8 của register vào login; không trim password; chống submit trùng ở UI |
| POST `/auth/register` | email; password 8–100; first_name,last_name 1–50; role optional mặc định analyst | id,email,first_name,last_name,role,created_at | Form không chọn role; duplicate theo source là 409; policy public register còn gate |
| POST `/auth/refresh` | `{ refresh_token }`, string min 1 | access_token, expires_in | Giữ refresh token hiện có vì response không trả token mới; validate sub khớp account hiện tại |
| POST `/auth/logout` | bearer; controller không đọc body sessionId | message | Không gửi sessionId như spec cũ; transport lỗi không tuyên bố đã revoke server |
| GET `/auth/sessions` | bearer | mảng session document: `_id,user_id,device_name,ip_address,user_agent,is_revoked,expires_at,created_at,updated_at` | Không render token hash; dùng `_id`, không tự chờ `isCurrentSession` từ API |
| DELETE `/auth/sessions/{id}` | bearer và id phiên | message | Source trả 400 nếu không tìm thấy/đã revoke; chỉ remove/refetch sau ACK; không hứa access token cũ bị vô hiệu ngay |

EmailSchema source gọi email validation rồi lowercase/trim; tên field min/max được chain trước trim. Chuỗi chỉ khoảng trắng là khoảng trống contract: test/trao đổi BE, không coi raw minLength chứng minh tên hợp lệ sau trim. DTO/response đầy đủ runtime chưa được test.

## 4. Storage, expiry và recovery đã duyệt

Key `data-quality.auth.v1` chứa `{ schemaVersion: 1, accessToken, refreshToken, accountId }`; không password/role. `accountId` đối chiếu sub, không chứng minh chữ ký. JSON/trường/schema/exp sai: clear riêng phiên và về login; không xóa draft IndexedDB.

Hết hạn tại `Date.now() >= exp * 1000`, không grace period/clock correction. Token exp hợp lệ nhưng expired không phải corrupt. Token source mặc định 15 phút, refresh session source tính 7 ngày; không hardcode 30 ngày, không suy ra runtime từ `.env`.

| Tình huống | Quyết định FE |
|---|---|
| Reload, còn hạn, `/users/me` thành công | Lấy user mới, mở route; không dùng role cũ từ storage |
| Còn hạn, transport/BE outage | Chế độ local-limited; foundation chưa có IndexedDB thì chỉ hiện giới hạn, không giả nghiệp vụ |
| Expired | Dừng nghiệp vụ, gọi public health timeout 5.000 ms không bearer |
| Health HTTP/payload hợp lệ + MongoDB connected | Hỏi tiếp tục phiên; Neo4j disconnected không tự chặn auth |
| Health lỗi/timeout/payload sai/Mongo disconnected | Clear phiên và về login; draft giữ nguyên |
| Người dùng đồng ý | Một refresh; success mới khôi phục flow, không mutation replay |
| Từ chối hoặc refresh lỗi/rejected | Clear phiên/cache, về login; draft giữ nguyên |

Trong dialog chờ vẫn dừng nghiệp vụ; không giới thiệu idle timeout mới. Tab độc lập, không đồng bộ logout; duplicate tab có thể có bản sao storage/server session cũ. Request cũ trở về sau logout/đổi account phải bị bỏ qua. Cách bảo vệ runtime: generation/session identity, không chỉ kiểm tra mounted.

## 5. Cấu trúc UI và bàn giao

- `app/pages/public/auth/login/` và register sau gate: route entry mỏng; view tại `views/auth/`, dialog tại `components/auth/`.
- `app/context/`: Auth context/provider + hook export tách khi cần; `app/router/`: routes; protected/public-only guard chỉ triển khai với state thật, không guard giả.
- `hooks/auth/`: login flow, bootstrap/expiry/consent; `services/auth/`, `services/health/`, `services/users/`; `types/auth/`, `utils/auth/`; test `src/__tests__/auth/`.
- Tên file kebab-case với suffix, trừ App/main/layout đã được duyệt. Danh sách file cuối cùng chốt ở batch code; không tạo folder rỗng bổ sung trong đợt plan.
- UI có label, submitting, lỗi, nút đồng ý/từ chối và focus dialog; không có credential mặc định. Shell chỉ hiện khi auth gate đạt.
- Cache user/sessions theo account; logout cancel/invalidate và clear phạm vi account. Không expose IP/user-agent trong log/screenshot công khai; không lưu credential trong Query cache hoặc draft.

## 6. Test case dự kiến

| Mã | Nhóm | Đầu vào/sự kiện | Kết quả mong đợi | Lý do |
|---|---|---|---|---|
| A01 | Thường | Login được server chấp nhận | Ghi schema, user và route đúng account | Flow chính |
| A02 | Thường | Reload token còn hạn, me ACK | Chờ bootstrap rồi private | Không flash dữ liệu |
| A03 | Biên | now = exp*1000 | Dừng, health → consent nếu đạt | Ranh giới hạn |
| A04 | Biên | Register password 8/100; tên 1/50 | Theo schema field, role policy vẫn gate | Biên input |
| A05 | Không hợp lệ | Sai mật khẩu/blocked | Hiển thị response thực, không lưu session | Không coi 401 là outage |
| A06 | Không hợp lệ | JSON hỏng/exp sai/account khác sub | Clear key, login, giữ draft | Storage không tin cậy |
| A07 | Đặc biệt | 5 request cùng expired | Một health/dialog/refresh mỗi tab | Concurrency |
| A08 | Đặc biệt | Health Mongo disconnected hoặc timeout | Login, không refresh | Gate availability |
| A09 | Thường | Health đạt, người dùng đồng ý | Refresh đúng body; giữ refresh token | Consent |
| A10 | Đặc biệt | Từ chối / refresh rejected / mất response refresh | Login; không giả refresh thành công | Failure flow |
| A11 | Đặc biệt | Logout A, response login/me cũ về sau | Không khôi phục phiên A | Stale response |
| A12 | Đặc biệt | Revoke session ACK | Refetch list; token cũ effect chưa kết luận | Backend limit |
| A13 | Biên | Token expired khi tab ngủ rồi focus | Recheck trước action | Timer throttling |
| A14 | Không hợp lệ | Session storage setItem throw | Không báo đã lưu phiên bền qua reload | Predictable failure |

Tên whitespace và quyền public register cần thêm test contract sau BE xác nhận, chưa có expected status tự đặt. Empty array áp dụng sessions; array duplicate không áp dụng input login nên không ép test kiểu mảng. Chưa thực thi các case.

## 7. Pseudocode và dò tay

```text
KHI bootstrap/action/focus:
  đọc và kiểm tra session schema
  NẾU corrupt: clear phiên; login; DỪNG
  NẾU còn hạn: gọi me khi bootstrap online; xử lý result/outage theo policy; DỪNG
  khóa nghiệp vụ; tham gia expiry flow đang có nếu có
  gọi health không credential, timeout 5 giây
  NẾU không đạt: clear phiên; login; DỪNG
  hỏi tiếp tục
  NẾU từ chối: clear phiên; login; DỪNG
  refresh đúng một lần
  NẾU success + identity còn đúng: persist token, mở lại read flow
  NGƯỢC LẠI: clear phiên; login
```

| Dò tay | Qua bước | Kết quả dự kiến |
|---|---|---|
| Token còn 60 giây, me ACK | schema → còn hạn → me | authenticated, không hỏi refresh |
| now đúng exp, health đạt, từ chối | schema → expired → health → consent | anonymous, không request refresh |

Đây là dò tay theo chính sách, không phải kết quả thực thi source FE.

## 8. Batch và tiêu chí nghiệm thu

1. Shared DTO/client/sessionStorage + test corrupt/exp (phụ thuộc QueryClient/router boundary).
2. Login tối giản, bootstrap/me, guard, clear cache.
3. Health/consent/single-flight/focus và failure tests; API thực khi có test account.
4. Sessions/revoke; register chỉ sau policy role rõ. Reviewer kiểm tra stale response và tab behavior.

Mỗi bước implementation cần human confirmation. Gate: response fixture/instance version, public register policy, quyền analyst trong modules sau. Bộ test pass không thay runtime/browser. Không fix BE trong batch FE.

## 9. Prompt triển khai và log

```text
CONTEXT: React 19.3.1, TypeScript 6.0.3, Vite 8, Yarn 1.22.22; entry src/app/main.tsx. Đọc module 01 và contract audit trong .agents/frontend-delivery/modules.
TASK: Sau khi batch được người dùng duyệt, chỉ triển khai phần Auth thuộc batch đó theo thứ tự mục 8. Không mở rộng sang register policy chưa chốt hoặc feature khác.
INPUT: Contract mục 3; StoredSession mục 4; fixture sạch dữ liệu nhạy cảm được xác nhận. Nếu thiếu response runtime thì báo rõ, không tạo fallback field.
CONSTRAINTS: SessionStorage, exp tuyệt đối, một flow/tab, consent trước refresh; không mutation retry, không token log/.env/BE edit.
PSEUDOCODE: Theo mục 7; mỗi nhánh phải giữ identity phiên mới nhất.
EXAMPLES: Reload token còn hạn + me ACK → private; token đúng exp + health đạt + từ chối → login, không refresh.
OUTPUT: Patch file đã duyệt, code trọng tâm và giải thích flow, diff, kết quả kiểm tra tách static/test/runtime; nêu giả định còn chờ.
CRITERIA: Các case liên quan A01–A14 của batch đạt; không tuyên bố case chưa chạy đã pass.
```

Log: bước 1 yêu cầu ở mục 1; bước 2 đặc tả/contract mục 2–4; bước 3 test mục 6; bước 4 pseudocode mục 7; bước 5 prompt mục 9. Bước 6 mã AI: chưa thực hiện; bước 7 kiểm chứng FE: chưa thực hiện; bước 8 quyết định chấp nhận code: chưa có. Không có giả định business đã được tự xác nhận.
