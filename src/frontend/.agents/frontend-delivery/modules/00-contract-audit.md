# Đối chiếu contract — Swagger đang chạy

Ngày kiểm tra: 26/10/2026. Nguồn runtime: [Swagger UI](http://localhost:3000/api/v1/docs), [OpenAPI JSON](http://localhost:3000/api/v1/docs-json). Nguồn static: checkout backend cùng repository. Đường dẫn workspace hiện tại là `/Users/mac/Documents/JS-TS-AI`, không còn dùng đường dẫn JS&TS-AI cũ.

## 1. Phạm vi bằng chứng

Đã thực hiện GET OpenAPI JSON và đọc controller/DTO/service/schema/repository. Không đăng nhập, không gọi API nghiệp vụ cần bearer hoặc các method ghi. Vì vậy:

- **Runtime verified:** server trả tài liệu OpenAPI, 36 operation được liệt kê.
- **Static verified:** tên trường/luồng service bên dưới xuất hiện trong checkout; chưa chứng minh instance BE đang chạy đúng commit này.
- **Chưa thực thi:** authorization, response nghiệp vụ, ingestion, cell edit, graph, rollback, replay và browser FE integration.
- Schema request trong OpenAPI không bảo đảm mọi runtime validation đã được mô tả; response nghiệp vụ cần fixture được xác nhận trước implementation.

Skill áp dụng: `dac-ta-prompt-test` trong frontend `.agents/skills/`; từng module có 6 mục đặc tả, test case, pseudocode/dò tay, prompt và log. `doc-ma-giai-thich` dùng khi cần đọc một hàm cụ thể, không coi dò tay là chạy test.

## 2. Kiểm kê đầy đủ 36 operation

Prefix thực tế của snapshot: `/api/v1`. Các path sau giữ placeholder theo OpenAPI.

| Nhóm | Method | Path |
|---|---|---|
| Health | GET | `/api/v1/health` |
| Users | GET | `/api/v1/users/me` |
| Users | PATCH | `/api/v1/users/me` |
| Users | DELETE | `/api/v1/users/me` |
| Auth | POST | `/api/v1/auth/register` |
| Auth | POST | `/api/v1/auth/login` |
| Auth | POST | `/api/v1/auth/refresh` |
| Auth | POST | `/api/v1/auth/logout` |
| Auth | GET | `/api/v1/auth/sessions` |
| Auth | DELETE | `/api/v1/auth/sessions/{id}` |
| Workspaces | POST | `/api/v1/workspaces` |
| Workspaces | GET | `/api/v1/workspaces` |
| Workspaces | GET | `/api/v1/workspaces/{id}` |
| Workspaces | PATCH | `/api/v1/workspaces/{id}` |
| Workspaces | DELETE | `/api/v1/workspaces/{id}` |
| Workspaces | POST | `/api/v1/workspaces/{id}/members` |
| Workspaces | DELETE | `/api/v1/workspaces/{id}/members/{userId}` |
| Projects | POST | `/api/v1/workspaces/{workspaceId}/projects` |
| Projects | GET | `/api/v1/workspaces/{workspaceId}/projects` |
| Projects | GET | `/api/v1/projects/{id}` |
| Projects | PATCH | `/api/v1/projects/{id}` |
| Projects | DELETE | `/api/v1/projects/{id}` |
| Datasets | POST | `/api/v1/projects/{projectId}/datasets/upload` |
| Datasets | GET | `/api/v1/projects/{projectId}/datasets` |
| Datasets | GET | `/api/v1/datasets/{id}` |
| Datasets | PATCH | `/api/v1/datasets/{id}` |
| Datasets | DELETE | `/api/v1/datasets/{id}` |
| Datasets | GET | `/api/v1/datasets/{id}/schema` |
| Data View | GET | `/api/v1/datasets/{datasetId}/records` |
| Data View | PATCH | `/api/v1/datasets/{datasetId}/records/{rowIndex}` |
| Data View | GET | `/api/v1/datasets/{datasetId}/columns/{columnName}/stats` |
| Lineage | GET | `/api/v1/lineage/{dataset_id}` |
| Lineage | GET | `/api/v1/lineage/node/{id}/upstream` |
| Lineage | GET | `/api/v1/lineage/node/{id}/downstream` |
| Lineage | GET | `/api/v1/lineage/verify-integrity/{dataset_id}` |
| Lineage | POST | `/api/v1/lineage/verify-integrity/{dataset_id}` |

Tổng theo tag: Health 1, Users 3, Auth 6, Workspaces 7, Projects 5, Datasets 6, Data View 3, Lineage 5 = **36**. Mô tả giới thiệu ghi 43 nhưng không dùng số đó để suy ra API còn thiếu đã có.

## 3. Biên HTTP dùng chung

### Kiểm tra folder DTO theo yêu cầu người dùng

Đã đọc 14 file dưới `src/backend/src/modules/*/dto/`. Phải phân biệt **schema response có trong source DTO** với **schema đã được publish trong OpenAPI**; snapshot Swagger chưa có response schema không có nghĩa source hoàn toàn không có response DTO.

| Module/folder | DTO đã thấy | Vai trò và kết luận |
|---|---|---|
| auth/dto | login, register, refresh-token, password-reset | Request schemas; password-reset định nghĩa ForgotPassword/ResetPassword nhưng chưa có route tương ứng được kiểm chứng; login/refresh response đọc auth.service |
| users/dto | update-user | Request partial profile; response đọc UsersService/UserSchema |
| workspaces/dto | create-workspace, update-workspace, add-member | Request; name/description trim trước length; membership role enum; response đọc service/schema |
| projects/dto | create-project, update-project | Request; trim trước length; response đọc service/schema |
| datasets/dto | update-dataset | Request rename, trim trước length; upload không có DTO body tại đây; response đọc service/schema |
| data-view/dto | query-records, update-cell | Request query/patch; cursor response ở shared pagination, ColumnStatsResult ở service |
| lineage/dto | lineage | Có LineageGraphResponse/UpstreamResponse/DownstreamResponse/VerifyIntegrityResponse schemas + type; Node/Edge schemas; ưu tiên nguồn này cho response |

Không import backend DTO module trực tiếp vào browser bundle khi nó kéo runtime dependency/server code. FE type/validator boundary phải bám schema đã đọc, chỉ gọi là generated khi thật sự có pipeline gen. Schema source vẫn cần đối chiếu instance đang chạy trước tuyên bố runtime verified.

Response content schema trong snapshot: **0**; `components.schemas`: **0**. Không sinh DTO response giả từ Swagger. `shared/interceptors/transform.interceptor.ts` trong source bọc response thường thành `{ success: true, data: T }`; `shared/filters/all-exceptions.filter.ts` trả `{ success: false, error: { code, message, timestamp, path } }`. `message` có thể là string hoặc dữ liệu validation.

Trong plan module, ký hiệu `T` là payload bên trong envelope theo source, không phải response runtime đã quan sát. Mongoose document có `_id`; login/register có mapping `id` riêng. FE dùng DTO/mapper rõ ràng, không đoán mọi resource đều có `id`, không unwrap lặp các object có trường data.

Thứ tự lỗi: phiên/consent theo policy đã chốt → lỗi quyền/resource → validation → transport/server error. Không tự retry mutation. Error 400/401/403/409 không tự đồng nghĩa outage. Query cache có account scope và ignore response của phiên cũ.

## 4. Khoảng trống ảnh hưởng plan

| Phát hiện | Bằng chứng static/runtime | Hệ quả và hướng xử lý |
|---|---|---|
| Response schema trống | OpenAPI runtime | Đọc service/schema; xác nhận fixture sạch dữ liệu nhạy cảm trước implementation |
| Register nhận `role: admin/analyst` | Register DTO và auth service | Không expose role selector hoặc tự test tạo admin; cần BE xác nhận policy public register trước phát hành |
| Access token strategy chưa kiểm tra revoked session | JwtStrategy đọc user, không thấy lookup session; refresh có lookup session | Không hứa revoke sẽ vô hiệu hóa ngay access token cũ; gate kiểm thử/trao đổi BE |
| Workspace context/ownership cần kiểm chứng | CASL cần workspaceId/workspaceRole; JWT strategy đã đọc không gắn hai trường; controller dùng policy string | Chưa chứng minh analyst/member truy cập được đúng; không dùng admin test để kết luận phân quyền đúng |
| Soft delete workspace/project không cascade trong service đã đọc | Service gọi softDelete resource | Không mô tả như cascade spec cũ; xác nhận BE trước UI hứa xóa toàn bộ cây |
| Upload thiếu request body schema | OpenAPI runtime, Busboy controller | multipart thực tế cần đối chiếu/test file đã duyệt; không hứa datasetName được nhận |
| Parser gọi CSV dù nhận diện extension xlsx/json | datasets.service.ts | Không coi hỗ trợ Excel/JSON là đã chạy; gate format/size/row/column limits |
| DTO sort có nhưng service sort row_index | DataView DTO/service | Không bật sort toàn dataset theo cột tùy chọn |
| Cell edit chưa dùng version/If-Match | DataView controller/service | Không queue edit, không hứa chống lost update |
| Replay chưa có đủ contract | Upload/delete không thấy operation id/reconcile/version guard | Lưu draft và replay là hai giai đoạn; không tự gửi lại mutation mù |
| Lineage là projection Neo4j | Lineage service, backend outbox | Upload ACK chưa chứng minh graph có ngay; graph 404 không xóa dataset cache |
| Transformation/export/history/rollback vắng | Không có path tương ứng trong snapshot | Chỉ lập plan phụ thuộc, không đặt endpoint/payload thực thi |

Đây là điểm cần xác minh, không phải báo cáo penetration test hoặc kết luận đã xảy ra lỗi dữ liệu. Không sửa BE trong batch tài liệu.

## 5. Tổ chức bộ plan và thứ tự

1. [Auth](01-auth.md) và shared foundation — FE A, FE B review.
2. [User](02-user.md), [Workspace](03-workspace.md), [Project](04-project.md) — FE A.
3. [Dataset](05-dataset.md), [Visualization](06-visualization.md) — FE B sau shared boundary; có thể song song nhóm 2.
4. [Transformation](07-transformation.md), [Version/Lineage](08-version-lineage.md), [Export](09-export.md) — chỉ định owner/reviewer trước batch; module chưa có API dừng ở gate.

3D và IndexedDB/sync theo architecture/master plan; trong module chỉ ghi giao tiếp và gate liên quan, không tự chốt mapping/quota/retention/lock constants.

## 6. Nghiệm thu tài liệu

- Đối chiếu đủ 36 operation, 9 module và trạng thái chờ; phân biệt runtime tài liệu với static source và chưa thực thi nghiệp vụ.
- Test case là tiêu chí tương lai, không có số test pass giả. Case blocked không có expected HTTP do suy đoán.
- Prompt không tự cấp phép sinh code; mỗi batch implementation phải được duyệt riêng.
- File `.env`, source, manifest/lock và dữ liệu BE không thay đổi trong batch này.
