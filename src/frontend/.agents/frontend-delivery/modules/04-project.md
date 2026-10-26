# Module 04 — Project trong Workspace

Trạng thái: plan; owner FE A, reviewer FE B; chưa implementation/test nghiệp vụ. Nguồn: [audit](00-contract-audit.md), [Workspace](03-workspace.md), Swagger live và backend `modules/projects/` controller/service/repository/schema/DTO. Path API sau `/api/v1`.

## 1. Yêu cầu

Cho người dùng chọn/tạo/sửa/xóa project thuộc workspace hợp lệ, rồi đi tới dataset của project. Project chỉ có tối đa một dataset active theo service ingestion; không tự biến thành danh sách nhiều dataset. Cần bàn giao project context cho FE B mà không buộc hai người sửa cùng router/lib mỗi lúc.

## 2. Đặc tả sáu mục

| Mục | Nội dung |
|---|---|
| Đầu vào | workspaceId để list/create; projectId để detail/update/delete; name/description |
| Điều kiện | Phiên và quyền server; name trim trước kiểm tra 1–100, description trim trước kiểm tra ≤500; workspace tồn tại; route id đúng resource |
| Xử lý | List/create theo workspace; detail theo project; ACK cập nhật cache và selection; đọc dataset qua API Dataset riêng |
| Đầu ra | T `{ projects }`, `{ project }`, mutations `{ message,project }`, delete `{ message }` |
| Xếp loại | loading/empty/ready/denied/not-found/error; has_dataset là tín hiệu trạng thái, không datasetId |
| Thứ tự | Workspace context trước project list; project trước dataset; tránh response workspace cũ về sau; confirm delete trước request |

## 3. Contract và nguồn

| Method/path | Input | T/hành vi theo source |
|---|---|---|
| GET `/workspaces/{workspaceId}/projects` | path workspaceId, không query pagination | `{ projects: document[] }`, repository sort updated_at giảm dần |
| POST `/workspaces/{workspaceId}/projects` | `{ name,description? }` | `{ message,project }`, created_by từ server, has_dataset false |
| GET `/projects/{id}` | path project id | `{ project }` |
| PATCH `/projects/{id}` | `{ name?,description? }` | `{ message,project }` |
| DELETE `/projects/{id}` | path id | `{ message }`, service softDelete project |

Project document: `_id,workspace_id,name,description,has_dataset,created_by,deleted_at,created_at,updated_at`. Không tự thêm project.datasetId hoặc currentVersion. Id dataset lấy qua `GET /projects/{projectId}/datasets` ở module 05.

Spec cũ yêu cầu tên unique/cascade/restore/pagination; source hiện đã đọc không chứng minh các hành vi đó. Index `{ workspace_id,name,deleted_at }` không ghi unique; không tự dự đoán 409 duplicate. Permission context xem audit; có JWT không chứng minh quyền trên project đó.

## 4. UI/state/cache và file

- List đặt trong workspace detail; route detail `/projects/:projectId`. Entry mỏng `app/pages/private/projects/`; view/component/hook/service/type domain projects; test `src/__tests__/projects/`.
- Action create/update dialog có submitting và field error, delete confirm chưa hứa cascade. No-op edit không gửi.
- FE A cung cấp resource UI model `{ id, workspaceId, name, description, hasDataset }` qua mapper (đây là model UI đề xuất, không API body). FE B nhận projectId để query Dataset; hasDataset không được biến thành datasetId.
- Cache account + workspace projects và account + project detail; invalidate sau ACK, clear selection/request cũ khi đổi workspace/account. Sau delete refetch context liên quan; không local đánh dấu dataset con đã bị BE xóa.
- BE outage: không local create/edit/delete project; input chỉ memory. Nếu has_dataset và dataset response không khớp, refetch và hiện trạng thái đối chiếu, không tự set server cờ hoặc cho upload mù.

## 5. Test case dự kiến

| Mã | Nhóm | Input/sự kiện | Kết quả mong đợi | Lý do |
|---|---|---|---|---|
| P01 | Thường | List workspace W1 | Chỉ render response W1 theo thứ tự trả về | Context |
| P02 | Đặc biệt | Projects [] | Empty state, create nếu đủ quyền | Empty |
| P03 | Thường | Create hợp lệ ACK | Id/project thật, list refetch, hasDataset false | Write |
| P04 | Biên | Name 1/100, description 500 | Theo DTO, không truncate | Boundary |
| P05 | Không hợp lệ | Name rỗng/101, description 501 | Form/BE validation; giữ input | Input |
| P06 | Không hợp lệ | Workspace/project không tồn tại, 403 | Not-found/denied theo response; không chuyển sang resource khác | Isolation |
| P07 | Đặc biệt | Chuyển W1→W2 trước GET W1 về | Không ghi/render W1 dưới W2 | Race |
| P08 | Thường | has_dataset true | Query module Dataset bằng projectId, không đoán datasetId | Contract |
| P09 | Đặc biệt | Hủy delete / delete ACK | Hủy không request; ACK mới bỏ selection | Confirmation |
| P10 | Đặc biệt | Write timeout | Không tự retry/queue, không success giả | Ambiguous result |
| P11 | Đặc biệt | PATCH ACK rồi GET cũ về | Không ghi đè state mới bằng response cũ | Cache |

Đã đọc DTO: name trim trước min/max, whitespace-only bị validation từ chối; description trim trước max 500. Duplicate name chưa có uniqueness được chứng minh, không tự đặt status 409. List duplicates nếu server trả về phải phát hiện identity trùng để báo lỗi dữ liệu, không tạo resource id mới; quy tắc sửa dữ liệu cần đặc tả riêng. Không ép test floating point vì project không có input số. Chưa thực thi.

## 6. Pseudocode và dò tay

```text
workspace thay đổi → scope query mới, bỏ kết quả scope cũ
GET projects → map và render empty/ready/error
select project → GET detail → chuyển context cho Dataset bằng project id
submit create/edit:
  validate + session gate; gửi đúng payload một lần
  ACK còn đúng scope → update/invalidate queries
  lỗi → giữ form, không retry ghi ngầm
delete:
  confirm → DELETE → ACK → clear selection/refetch
```

Dò tay thường: tạo P trong W1 → response `_id=P`, `workspace_id=W1` → list W1 refetch. Dò tay biên: mô tả 501 ký tự → chặn validation, không POST. Chưa chạy FE.

## 7. Batch, gate và nghiệm thu

1. DTO/mapper/query list/detail và bàn giao context cho FE B.
2. Create/update sau permission fixture rõ.
3. Delete sau semantic soft delete được xác nhận, integration tests với Workspace/Dataset.

Gate: authorization runtime, contract response, duplicate naming, semantic descendants và asset scope. Whitespace validation đã có DTO. Không tự expose restore hoặc edit has_dataset/created_by. Mỗi batch code duyệt riêng.

## 8. Prompt triển khai và log

```text
CONTEXT: React 19.3.1, TS 6.0.3, Vite 8, Yarn 1.22.22; Auth/Workspace boundary theo plan.
TASK: Implement batch Project đã duyệt ở mục 7, owner FE A; FE B nhận project context.
INPUT: Năm endpoint mục 3, DTO name/description, project document có has_dataset nhưng không datasetId.
CONSTRAINTS: Không tự thêm pagination/uniqueness/cascade/restore; không queue mutation; account+workspace query keys; ACK trước state chính thức.
PSEUDOCODE: Mục 6, stale response không được vượt scope.
EXAMPLES: Create W1 ACK → refetch list W1; description 501 → validation lỗi, không POST; has_dataset true → query dataset bằng projectId.
OUTPUT: Patch file đã duyệt, code trọng tâm/flow, diff, kết quả test/runtime tách riêng và blockers.
CRITERIA: Case P01–P11 liên quan batch; không giả thành công khi BE lỗi.
```

Log 1–5 được chuẩn bị ở mục 1/2–3/5/6/8; mã AI, test FE/runtime và quyết định nhận code chưa thực hiện. Không có endpoint mới được sáng tạo trong plan.
