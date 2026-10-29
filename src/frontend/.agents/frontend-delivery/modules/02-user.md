# Module 02 — Hồ sơ người dùng

Trạng thái: plan, chưa code/chưa test nghiệp vụ. Owner FE A, reviewer FE B. Phụ thuộc [Auth](01-auth.md), [contract audit](00-contract-audit.md). Bằng chứng: live Swagger và backend `modules/users/users.controller.ts`, `users.service.ts`, `dto/update-user.dto.ts`, `schemas/user.schema.ts`.

## 1. Yêu cầu và phạm vi

Người dùng xem/sửa hồ sơ chính mình, thông tin cập nhật được phản ánh trong header/account view sau ACK. Không chỉnh email/role qua profile; không giả lưu khi BE lỗi. DELETE me có trong Swagger nhưng xóa tài khoản chưa được duyệt vào UI; admin list/detail/block/unblock và change-password chưa có path tương ứng.

## 2. Đặc tả sáu mục

| Mục | Nội dung |
|---|---|
| Đầu vào | Bearer; PATCH có first_name,last_name,avatar_url tùy chọn |
| Điều kiện | Phiên còn hợp lệ hoặc gia hạn theo Auth; tên 1–50 theo DTO raw; avatar là URL hợp lệ nếu gửi; quyền do server |
| Xử lý | GET me → map DTO; form giữ draft memory; PATCH chỉ field thay đổi; ACK mới thay profile/cache; lỗi giữ input |
| Đầu ra | GET/PATCH T là user document; map whitelist field UI, không render mọi key |
| Xếp loại | Loading, ready/view, editing, saving, failed; empty/malformed response là error chứ không user mới |
| Thứ tự | Bootstrap Auth có thể chia sẻ query me; submit sau validation; cache/header cùng cập nhật sau ACK; response account cũ bị loại |

## 3. Contract thực tế

| Method/path sau `/api/v1` | Input | T theo source | Lưu ý |
|---|---|---|---|
| GET `/users/me` | bearer, không userId từ client | `_id,email,first_name,last_name,avatar_url,role,status,deleted_at,created_at,updated_at` theo document schema; field optional theo nguồn | Không tự đòi id/fullName; role admin/analyst, status active/blocked |
| PATCH `/users/me` | object partial: first_name/last_name string 1–50, avatar_url URL | user sau update | Không null avatar hoặc bỏ ảnh bằng empty string khi chưa có contract; không gửi email/role |
| DELETE `/users/me` | bearer | `{ message }` | Ngoài UI scope; source soft delete user + revoke sessions, chưa test; không gọi thử |

Envelope/validation errors xem audit. Schema có password/reset hashes select:false; mapper vẫn chỉ chọn field cần UI, không log response thô. Tên min trước trim có rủi ro whitespace cần trao đổi BE. Không áp ràng buộc tên 2–100/fullName từ spec cũ.

## 4. UI, file và state

- Route đề xuất `/account`, entry mỏng dưới `app/pages/private/account/`; view `views/users/`, form `components/users/`.
- Hook `hooks/users/` gọi service `services/users/`; DTO/mapper tại `types/users/` và service boundary; test `src/__tests__/users/`.
- Query key account + me dùng chung Auth; tránh hai state profile độc lập. Form state không lưu token hoặc toàn user vào sessionStorage.
- Loading/error có retry GET chủ động; disable submit đang saving. Không đổi tên hiển thị thành chính thức trước ACK.
- Outage: không persist/queue profile edit; input memory giữ khi view còn mở, không hứa tồn tại reload. Phiên hết hạn đi Auth flow, không lưu thành công giả.
- Chưa chốt component library; dùng CSS/DOM hiện có, không cài UI lib trong batch feature.

## 5. Test case dự kiến

| Mã | Nhóm | Input/sự kiện | Kết quả mong đợi | Lý do |
|---|---|---|---|---|
| U01 | Thường | GET user hợp lệ | Render field whitelist đúng account | Read |
| U02 | Thường | Đổi first_name, ACK | Chỉ gửi field đổi, header/account cùng cập nhật | Mutation/cache |
| U03 | Biên | Tên 1 và 50 ký tự | Theo DTO, không tự truncate | Boundary |
| U04 | Không hợp lệ | Tên rỗng/51 ký tự hoặc avatar không URL | Form lỗi; không gửi payload sai | Validation |
| U05 | Không hợp lệ | GET 401/403/404 | Auth/forbidden/not-found phù hợp, không render user giả | Error |
| U06 | Đặc biệt | PATCH timeout | Không báo đã lưu; giữ input, không auto retry mutation | Ambiguous result |
| U07 | Đặc biệt | Profile A request về sau login B | Không ghi cache B | Isolation |
| U08 | Đặc biệt | PATCH đồng thời bootstrap GET cũ | Không ghi đè dữ liệu ACK bằng response cũ | Race |
| U09 | Không hợp lệ | Avatar null/empty trong draft | Không tự gửi clear-avatar contract chưa có | Scope |
| U10 | Đặc biệt | DELETE account button | Không xuất hiện trong batch profile | Outside scope |

Whitespace-only name chưa có rule FE được duyệt: đánh dấu cần thống nhất, không đặt expected status mới. Mảng rỗng/duplicate không là input profile nên không ép nhóm đó. Chưa chạy test.

## 6. Pseudocode và ví dụ dò tay

```text
load profile trong account scope
NẾU ACK hợp lệ: map whitelist → view/form baseline
KHI submit:
  kiểm tra phiên và validate field theo contract đã chốt
  tính field thay đổi, bỏ field không được sửa
  NẾU không thay đổi: không gửi
  gửi PATCH đúng một lần
  NẾU ACK và vẫn cùng account: update query me, reset baseline
  NẾU lỗi: giữ draft, hiển thị nguồn lỗi, không queue
```

| Dò tay | Diễn biến | Kết quả |
|---|---|---|
| first_name Minh → An | diff một field → PATCH → ACK | baseline An và header An |
| first_name dài 51 ký tự | validate fail | Giữ input, không gửi |

Không phải kết quả chạy FE.

## 7. Batch, gate và nghiệm thu

1. Xác nhận response me sạch dữ liệu nhạy cảm, DTO/mapper + query chung Auth.
2. Account read view; tiếp đến partial edit và validation đã duyệt.
3. Cache/race/failure tests; reviewer kiểm tra qua bootstrap và header.

Gate còn mở: whitespace sau trim, clear-avatar behavior nếu cần, resource/permission runtime. Không tự implement delete/admin/change-password. Mỗi batch cần duyệt trước code; source presence không chứng minh response instance đang chạy.

## 8. Prompt triển khai và log

```text
CONTEXT: React 19.3.1/TypeScript 6.0.3/Vite 8/Yarn 1.22.22; kiến trúc theo tầng, auth/session policy đã chốt.
TASK: Chỉ triển khai batch profile đã duyệt từ module 02; không delete me/admin/change-password.
INPUT: GET/PATCH /api/v1/users/me; DTO partial first_name,last_name,avatar_url; response document qua mapper whitelist, xem mục 3 và audit.
CONSTRAINTS: Component → hook → service; account-scoped query dùng chung Auth; không .env/token log/offline queue; không invent null-avatar contract.
PSEUDOCODE: Theo mục 6, identity guard và ACK trước cập nhật chính thức.
EXAMPLES: Đổi Minh thành An → PATCH first_name → ACK → header An; tên 51 ký tự → lỗi, không gửi.
OUTPUT: Patch đã duyệt, code trọng tâm/cách dùng, diff và bằng chứng validation; nêu phần chưa xác minh.
CRITERIA: U01–U10 liên quan batch; test mock và API thật phải báo riêng.
```

Log 1–5: yêu cầu mục 1, đặc tả mục 2–3, test mục 5, pseudocode mục 6, prompt mục 8. Mã AI/FE tests/runtime profile/quyết định nhận code: chưa thực hiện. Không dùng dữ liệu cá nhân thật làm ví dụ hoặc fixture.
