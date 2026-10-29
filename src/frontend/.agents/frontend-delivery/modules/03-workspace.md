# Module 03 — Workspace và thành viên

Trạng thái: plan, chưa code/chưa test nghiệp vụ. Owner FE A, reviewer FE B. Phụ thuộc Auth/shared client; nguồn: [audit](00-contract-audit.md), Swagger live, backend `modules/workspaces/` controller/service/repository/schema/DTO và CASL. Path API sau prefix `/api/v1`.

## 1. Yêu cầu

Người dùng chọn workspace, xem/tạo/sửa/xóa workspace trong quyền server cho phép; resource context được bàn giao cho Project và scene 3D. Membership tách batch vì ảnh hưởng quyền, không coi là UI CRUD thông thường đã được cho phép mọi người dùng.

Không restore, không search/pagination server chưa có, không offline queue thao tác workspace. Scope xóa hiện là resource soft delete trong source; không hứa xóa toàn bộ project/dataset con.

## 2. Đặc tả sáu mục

| Mục | Nội dung |
|---|---|
| Đầu vào | Route workspace id, name, description; membership email/role hoặc member userId |
| Điều kiện | Phiên hợp lệ; name trim trước kiểm tra 1–100, description trim trước kiểm tra ≤500; membership role owner/editor/viewer; quyền server cần runtime test |
| Xử lý | GET list/detail; create/update/delete chỉ ACK mới thay cache; membership trả workspace cập nhật; route/resource selection thống nhất |
| Đầu ra | T list `{ workspaces }`, detail `{ workspace }`, write workspace `{ message,workspace }`, delete `{ message }` |
| Xếp loại | list loading/empty/ready/error; detail denied/not-found; write pending/success/error; không đồng nhất empty và outage |
| Thứ tự | Auth trước read/write; chọn workspace trước Project; confirm delete trước gửi; ACK rồi invalidate list/detail/dependent context |

## 3. Contract theo action

| Method/path | Payload hoặc T | Kế hoạch FE |
|---|---|---|
| GET `/workspaces` | T `{ workspaces: document[] }` | Không gửi page/search như spec; repository sort updated_at giảm dần |
| POST `/workspaces` | `{ name, description? }` → `{ message,workspace }` | Owner do server lấy từ user; không gửi owner_id từ form |
| GET `/workspaces/{id}` | `{ workspace }` | Document `_id,name,description,owner_id,members,deleted_at,created_at,updated_at` |
| PATCH `/workspaces/{id}` | `{ name?,description? }` → `{ message,workspace }` | Không tự PATCH members/owner |
| DELETE `/workspaces/{id}` | `{ message }` | Source chỉ softDelete workspace; descendants phải refetch/đối chiếu, không giả cascade |
| POST `/workspaces/{id}/members` | `{ email,role }` → `{ message,workspace }` | Member `{ user_id,role,joined_at }`; email phải thuộc user có sẵn theo source |
| DELETE `/workspaces/{id}/members/{userId}` | `{ message,workspace }` | Source từ chối xóa owner chính 400; không có update role endpoint |

Source getWorkspaces: admin lấy tất cả active; analyst lấy owner hoặc member. List không có projectCount; không tự render số 0 giả. Tên trùng không có guard/unique owner-name trong source đã đọc như spec cũ; không tự đặt expected 409. Sort tie updated_at không có secondary key được đảm bảo.

Gate phân quyền: CASL dùng workspaceId/workspaceRole nhưng JWT strategy đang đọc chỉ gắn user/session; phải xác minh permission context và cross-workspace access với backend, không dùng role string từ FE để chữa server 403. Không tự cho viewer/editor thao tác vượt quyền khi guard lỗi.

## 4. UI, file, state và cache

- Route `/workspaces`, `/workspaces/:workspaceId`; entry mỏng dưới `app/pages/private/workspaces/`; view/component/hook/service/type cùng domain workspaces.
- List UI có select/create, empty state và error riêng. Detail có metadata/project region; form/dialog dùng input chuẩn, delete confirm nêu đúng phạm vi server đã xác nhận.
- Membership batch: danh sách member dùng user_id/role; không tự suy email/name nếu response chưa cung cấp. Chưa có lookup users endpoint thì không tạo autocomplete giả.
- Query key account + workspace list/detail; mutations không optimistic success. Sau membership ACK refetch permissions/resource, không coi role cache cũ là quyền mới.
- Sau delete ACK: hủy queries phụ thuộc resource, bỏ selection workspace, quay list; không local mark các dataset con là server deleted. Đổi workspace bỏ request cũ và selection sai scope.
- Outage: ghi workspace không được queue; form memory có thể giữ nhưng không hứa durable. Read snapshot policy chưa được duyệt riêng thì không tự persist.
- Bàn giao FE B: workspace UI model có identity và selection callback, không truyền raw Mongoose document cho scene hoặc tạo count chưa có.

## 5. Test case dự kiến

| Mã | Nhóm | Input/sự kiện | Kết quả mong đợi | Lý do |
|---|---|---|---|---|
| W01 | Thường | List có 2 workspace | Render đúng thứ tự source/response, chọn đúng id | Read |
| W02 | Đặc biệt | List [] | Empty state, không lỗi hoặc projectCount giả | Empty |
| W03 | Thường | Create hợp lệ, ACK | Đúng payload, refetch list, select từ id thật khi cần | Create |
| W04 | Biên | Name 1/100, description 500 | Theo schema; không truncate | Boundary |
| W05 | Không hợp lệ | Name rỗng/101, description 501, role khác enum | Chặn input sai hoặc hiển thị validation BE | Validation |
| W06 | Thường | PATCH description, ACK | Không ghi owner/members; cache/detail cập nhật | Partial |
| W07 | Đặc biệt | Người dùng hủy delete | Không request | Confirmation |
| W08 | Đặc biệt | Delete ACK | Về list, không tuyên bố cascade descendants | Source khác spec |
| W09 | Không hợp lệ | Member đã có / email không tồn tại | Theo source 409/404; giữ dialog | Membership |
| W10 | Không hợp lệ | Remove owner chính | Theo source 400, không xóa UI trước ACK | Protected relation |
| W11 | Không hợp lệ | 401/403/404 hoặc cross-account id | Auth/denied/not-found; không fallback admin | Permission gate |
| W12 | Đặc biệt | Timeout write / đổi workspace khi GET đang chạy | Không retry ghi; không render scope cũ | Race/error |

Đã đọc DTO: name trim trước min/max nên chuỗi chỉ khoảng trắng không hợp lệ; description cũng trim trước max 500. Duplicate name chưa có rule uniqueness được chứng minh, không tự đặt status 409. Null/undefined kiểm tra biên form/DTO; số thực/NaN không là input name nên không ép ca số học. Chưa thực thi.

## 6. Pseudocode và dò tay

```text
KHI chọn workspace id:
  tạo query account+id; hủy/bỏ kết quả scope cũ
  GET detail → map identity → render hoặc denied/not-found/error
KHI sửa:
  validate fields; gửi partial PATCH một lần
  NẾU ACK cùng account/resource: update detail và invalidate list
  NGƯỢC LẠI giữ input và hiện lỗi, không queue
KHI xóa:
  hỏi xác nhận phạm vi đã biết
  NẾU đồng ý: DELETE; ACK mới bỏ selection và refetch list
```

Dò tay thường: đổi mô tả W1 → PATCH ACK → detail/list cùng cập nhật. Dò tay biên: name 101 ký tự → validation lỗi → không gửi. Không phải test runtime.

## 7. Batch và nghiệm thu

1. DTO/mapper/list/detail + identity bàn giao scene.
2. Create/update; permission matrix owner/editor/viewer/admin được BE xác nhận trước bật action tương ứng.
3. Delete theo phạm vi thật; membership tách review và được người dùng duyệt.
4. Test W01–W12 theo batch, kiểm tra chuyển scope và FE A/B integration.

Chưa triển khai trước khi quyền, response fixtures và semantic delete rõ. Không tự thêm uniqueness/search/pagination/restore hoặc sửa repository BE.

## 8. Prompt triển khai và log

```text
CONTEXT: React 19.3.1/TypeScript 6.0.3/Vite 8/Yarn 1.22.22, tầng View→Hook→Service, Auth đã có boundary.
TASK: Triển khai duy nhất batch Workspace được duyệt từ mục 7, FE A owner và FE B review; không expand membership khi chưa duyệt.
INPUT: Endpoint/payload mục 3, response mapper từ fixture đã xác nhận, permission matrix thật; không có projectCount/pagination server.
CONSTRAINTS: Không giả cascade/uniqueness/restore; không offline write queue, token log hoặc sửa BE; scope cache theo account/resource.
PSEUDOCODE: Mục 6; ACK trước state chính thức.
EXAMPLES: PATCH mô tả W1 ACK → update detail/list; name dài 101 → lỗi, không gửi. Remove owner chính → BE từ chối theo contract.
OUTPUT: Patch theo file duyệt, code trọng tâm/cách dùng, diff, test evidence và gate còn mở.
CRITERIA: W01–W12 liên quan batch; không tuyên bố phân quyền đúng chỉ vì admin gọi được.
```

Log 1–5: mục 1/2–3/5/6/8. Mã AI, kiểm chứng FE/API nghiệp vụ và quyết định chấp nhận code: chưa thực hiện. Không có giả định business được tự đưa vào contract.
