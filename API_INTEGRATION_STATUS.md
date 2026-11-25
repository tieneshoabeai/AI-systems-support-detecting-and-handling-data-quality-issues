# Tích hợp trên TaiFE — 25/11/2026

## Phạm vi và thứ tự ưu tiên

Code được cập nhật trực tiếp trên `TaiFE`, giữ nền giao diện tại `511f5f9`; chọn lọc phần API từ `b2c80bb` trên nhánh tích hợp và cập nhật theo Swagger server mới. Thứ tự xử lý: hợp đồng full stack trong `API_ANSWER_24-11.md` → luồng nghiệp vụ/gộp nút từ `frontend` → hình thức và thao tác đặc trưng của TaiFE. Tài liệu trả lời full stack và thư mục yêu cầu riêng không được đưa vào commit.

- Giữ theme Sáng/Tối/Theo hệ thống, bố cục Management/Processing, avatar, nền/vật liệu/mô hình 3D, Kính/Nền trắng, kéo/đổi kích thước/khôi phục panel, toàn màn hình, tách/ghép mô hình, camera và Đăng xuất.
- Gộp Detection vào Data Analysis; khối cam vẫn mở phần phân tích. Giữ ba tab Tổng quan, Data View và Data Analysis, không thêm nút chạy Detection trùng chức năng.
- Bỏ lưu/tải cấu hình phân tích, chọn cột/vai trò cột và chỉnh PII theo quyết định full stack. Bốn tham số phương pháp đi trực tiếp trong body chạy phân tích. PII là thông tin đọc.
- Feedback gắn với lần chạy/phát hiện đang xem, không yêu cầu nhập ID thủ công. Kết quả có tổng quan chất lượng, thống kê và ma trận tương quan. PDF đọc trạng thái thực, báo lỗi khi `failed`; job retry theo dõi ID mới.
- Thành viên Project được tải khi mở dialog; không tải thêm roster Workspace cho Viewer. Admin giữ hai tab TaiFE, tải theo trang với nút Tải thêm.
- File nháp được nối vào wizard và màn upload: khôi phục/xóa nháp, giữ khi upload lỗi, dọn sau ACK, tiếp tục Project đã tạo dở. Dữ liệu Project/dataset/phân tích/PDF đã tải được lưu theo tài khoản và API origin; ngoại tuyến chỉ đọc trong phiên hợp lệ. Cache không thay thế lỗi 401/403/404, không chứa mật khẩu/refresh token hoặc trang Admin.
- Production có service worker chỉ cache tài nguyên tĩnh để reload khi mất mạng. API và dữ liệu tài khoản dùng IndexedDB riêng. Mục chưa xem/tải khi có mạng không tự có bản ngoại tuyến.

## Server QA hiện tại và kết quả đã xác minh

[Swagger mới](https://sustained-folder-europe-invest.trycloudflare.com/api/v1/docs), origin `https://sustained-folder-europe-invest.trycloudflare.com`, prefix `/api/v1`. Đã cập nhật `.env` local và sinh lại snapshot/type từ `/api/v1/docs-json`: **84 thao tác HTTP**. Con số này là inventory hợp đồng, **không phải 84 ca live đã đạt ngày 25/11**.

- `/health` và `/health/ready`: 200; profile không đăng nhập: 401; Analyst gọi Admin: 403. CORS từ origin local được chấp nhận.
- Dùng hai tài khoản Analyst QA tạm và CSV tổng hợp. Đã xác minh đăng ký/đăng nhập, guard, đổi màu, khôi phục phiên, đăng xuất và cờ session bị thu hồi trên server.
- Luồng production Workspace/Project đã qua: tạo, sửa tên, reload kiểm tra persistence, wizard upload CSV, đọc đúng dòng/cột, truy vấn records, đổi tên Project, xóa tài nguyên test và kiểm tra Workspace đối chứng còn nguyên.
- Phân quyền API đã qua: người ngoài Workspace bị chặn; Viewer đọc được nhưng không sửa/chạy phân tích; owner đổi Viewer sang Member bằng expectedVersion; gỡ membership Project trở về Viewer kế thừa Workspace; gỡ Workspace thì mất quyền đọc Project.
- Data View gọi stats/charts 200. Data Analysis trả kết quả cho CSV có dòng trùng, thiếu dữ liệu và ngoại lệ; gửi/đọc lại feedback thành công. Tạo tổng kết trước khi yêu cầu PDF; đã nhận và tải tệp có chữ ký `%PDF-`.
- Ca production với API thật đã qua toàn bộ assertion chức năng ngoại tuyến: reload, xem records/phân tích, tải PDF đã lưu, mở danh sách Project và kết nối lại. Tuy nhiên test vẫn báo đỏ ở teardown do timeout DELETE tài nguyên QA; đã dọn riêng thành công sau đó. Chưa coi cả suite live là xanh ổn định.
- Worker AI có ca trả trạng thái `failed`, attempt 3, thông báo `fetch failed`. Frontend đã hiển thị trạng thái này; chưa nghiệm thu AI chạy thành công đầu cuối.
- Chưa có tài khoản Admin để nghiệm thu các ca quản trị dương tính; chưa nghiệm thu OTP nhận qua email thật và OAuth Google hoàn chỉnh. Unit test không thay các ca này.

## Kiểm chứng local và cách xem lại

Build production và kiểm tra TypeScript E2E đã qua. Đã chụp sáu màn TaiFE trên Chrome (Workspace, Project, Kính, Analysis tối/sáng/mobile). Test production với API mô phỏng đã qua bảy tình huống: tải/lưu online, reload offline, bản ghi, kết quả phân tích, tải PDF, danh sách Project và kết nối lại. Các bằng chứng này tách khỏi E2E server thật.

Lượt local cuối: **978/978 test qua, 0 lỗi**; hồi quy bốn suite UI liên quan 94/94. Build production và TypeScript E2E qua. Lint phần thay đổi: 79 tệp, 0 lỗi, 78 cảnh báo. Lượt chạy cùng nhiều Chrome trước đó có 5 timeout; chạy lại tuần tự đã qua toàn bộ, không tăng timeout của Vitest để che lỗi.

Đã xóa hai tài khoản Analyst QA tạm và các tài nguyên test còn lại theo ID/owner đã xác minh; credential tạm đã được xóa khỏi env và file trạng thái. Bản xem production tại `http://127.0.0.1:5179/` nối backend mới, yêu cầu tài khoản của người xem.

Artifact kiểm thử nằm trong thư mục local bị ignore `temp/frontend-integration/` và `src/frontend/temp/`. Không commit credential, `.env`, trace hay dữ liệu QA riêng. Hướng dẫn thực hiện lại nằm trong [MANUAL_QA_GUIDE.md](MANUAL_QA_GUIDE.md). Phần dưới là báo cáo lịch sử ngày 24/11 trên tunnel cũ, không dùng thay kết quả ngày 25/11.

---

# Báo cáo tích hợp API — 24/11/2026

## 1. Toàn bộ API trong Swagger và kết quả ngày 24/11

- [Swagger QA](https://headquarters-qualification-fighter-cio.trycloudflare.com/api/v1/docs) và [OpenAPI JSON](https://headquarters-qualification-fighter-cio.trycloudflare.com/api/v1/docs-json) trả HTTP `200`. Inventory lấy trực tiếp từ JSON ngày 24/11.
- **84/84 API** trong Swagger có mã HTTP ngày 24/11. **81** có status Network từ DataVerse (trong đó **79** có ít nhất một lần `2xx`). **3** chỉ thử trực tiếp; các ca âm tính hoặc chưa xác nhận đầu cuối có ghi chú riêng.
- Môi trường UI: DataVerse qua Vite `http://127.0.0.1:5178`, Chrome, hai analyst QA và một admin. Cấu hình origin frontend trỏ tới tunnel QA mới. Request CORS preflight không được tính là đã kiểm tra endpoint.
- Mã `304` là xác thực cache. Mã `4xx` chỉ chứng minh đã gửi request; cần đọc ngữ cảnh luồng trước khi kết luận sai cách nối.

| API | Màn hình hoặc consumer | Network DataVerse | Gọi kiểm tra trực tiếp |
|---|---|---|---|
| `GET /health` | Health service kiểm tra MongoDB trước khi gia hạn session; không phải màn nghiệp vụ | 200 | 200 |
| `GET /health/ready` | Cài đặt → System → Trạng thái hệ thống (đã nối) | 200 | — |
| `GET /api/v1/users/me` | Bootstrap/khôi phục hồ sơ hiện tại sau đăng nhập | 200 | — |
| `PATCH /api/v1/users/me` | Settings → Hồ sơ cá nhân, lưu profile | 200 | — |
| `DELETE /api/v1/users/me` | Cài đặt → Hồ sơ → Xóa tài khoản (thử với tài khoản tạm) | 200 | — |
| `GET /api/v1/admin/users` | Quản lý → Quản trị → Tài khoản, danh sách user | 200 | — |
| `GET /api/v1/admin/users/{id}` | Mở hồ sơ user trong trang quản trị | 200 | — |
| `POST /api/v1/auth/register` | Form đăng ký account | 201 | — |
| `POST /api/v1/auth/login` | Form đăng nhập | 200 | — |
| `POST /api/v1/auth/refresh` | Gia hạn phiên sau consent | 200 | — |
| `POST /api/v1/auth/forgot-password` | Form quên mật khẩu, gửi OTP | 200 | — |
| `POST /api/v1/auth/reset-password` | Form đặt lại mật khẩu bằng OTP | 400 | — |
| `POST /api/v1/auth/change-password` | Settings → Bảo mật → Đổi mật khẩu | 200 | — |
| `GET /api/v1/auth/google` | Nút đăng nhập Google, bắt đầu OAuth redirect | 302 | — |
| `GET /api/v1/auth/google/callback` | Callback Google, hoàn tất đăng nhập/redirect | — | 401 |
| `POST /api/v1/auth/logout` | Menu account/đăng xuất, thu hồi session hiện tại | 200 | — |
| `GET /api/v1/auth/sessions` | Settings → Đăng nhập & phiên, danh sách thiết bị | 200 | — |
| `GET /api/v1/auth/sessions/me` | Chi tiết session hiện tại | 200 | — |
| `GET /api/v1/auth/sessions/{id}` | Mở chi tiết một session | 200 | — |
| `DELETE /api/v1/auth/sessions/{id}` | Thu hồi một session khác | 200 | — |
| `POST /api/v1/workspaces` | Dialog Tạo Workspace | 201 | — |
| `GET /api/v1/workspaces` | Bootstrap và danh sách Workspace | 200 | — |
| `GET /api/v1/workspaces/{id}` | Mở chi tiết Workspace | 200 | — |
| `PATCH /api/v1/workspaces/{id}` | Lưu thông tin Workspace | 200 | — |
| `DELETE /api/v1/workspaces/{id}` | Xóa mềm Workspace sau xác nhận | 204 | — |
| `GET /api/v1/workspaces/{id}/members` | Danh sách thành viên trong Workspace | 200 | — |
| `POST /api/v1/workspaces/{id}/members` | Thêm thành viên Workspace | 201 | — |
| `DELETE /api/v1/workspaces/{id}/members/{userId}` | Gỡ thành viên Workspace | 200 | — |
| `POST /api/v1/workspaces/{id}/transfer-owner` | Chuyển quyền owner Workspace | 201 | — |
| `POST /api/v1/workspaces/{id}/leave` | Rời Workspace | 201 | — |
| `POST /api/v1/workspaces/{workspaceId}/projects` | Wizard Tạo Project trong Workspace | 201 | — |
| `GET /api/v1/workspaces/{workspaceId}/projects` | Danh sách Project theo Workspace, fallback tương thích | — | 200 |
| `GET /api/v1/projects` | Processing/Projects, danh sách Project toàn hệ thống | 200 | — |
| `GET /api/v1/projects/{id}` | Mở Project overview | 200 | — |
| `PATCH /api/v1/projects/{id}` | Cập nhật Project | 200 | — |
| `DELETE /api/v1/projects/{id}` | Xóa mềm Project sau xác nhận | 204 | — |
| `PUT /api/v1/projects/{id}/snapshot` | Hoàn tất Project/snapshot | 200 | — |
| `GET /api/v1/projects/{id}/members` | Thành viên Project | 200 | — |
| `POST /api/v1/projects/{id}/members` | Thêm thành viên Project | 201 | — |
| `PATCH /api/v1/projects/{id}/members/{userId}` | Đổi role thành viên Project | 200 | — |
| `DELETE /api/v1/projects/{id}/members/{userId}` | Gỡ thành viên Project | 200 | — |
| `POST /api/v1/projects/{id}/transfer-owner` | Chuyển quyền owner Project | 201 | — |
| `POST /api/v1/projects/{projectId}/datasets/upload` | Wizard upload CSV vào Project | 201 | — |
| `GET /api/v1/projects/{projectId}/datasets` | Tải dataset của Project | 200 | — |
| `GET /api/v1/datasets/{id}` | Đọc metadata dataset | 200 | — |
| `DELETE /api/v1/datasets/{id}` | Xóa mềm dataset sau xác nhận | 204 | — |
| `GET /api/v1/datasets/{id}/file` | Data View → Tải CSV gốc | 200 | — |
| `GET /api/v1/datasets/{id}/schema` | Data View/Data Analysis, dựng cột và kiểu dữ liệu | 200, 404 | — |
| `GET /api/v1/datasets/{datasetId}/records` | Data View, tải trang bản ghi cursor | 200, 404 | — |
| `POST /api/v1/datasets/{datasetId}/records/query` | Data View, tìm kiếm/lọc/sắp xếp rồi Áp dụng | 200 | — |
| `GET /api/v1/datasets/{datasetId}/columns/{columnKey}/stats` | Data View → Thống kê cột đã chọn | 200 | — |
| `GET /api/v1/datasets/{datasetId}/charts` | Data View → Phân bố dữ liệu, histogram và các tứ phân vị | 200 | 200 |
| `POST /api/v1/projects/{projectId}/analysis` | Project → Data Analysis → Chạy phân tích | 201 | — |
| `GET /api/v1/projects/{projectId}/analysis/result` | Data Analysis → Tải kết quả | 404, 200 | — |
| `GET /api/v1/analysis/jobs/{jobId}` | Data Analysis → Xem trạng thái AI job | 200 | — |
| `POST /api/v1/analysis/jobs/{jobId}/retry` | Data Analysis → Thử lại job | 202 | — |
| `POST /api/v1/analysis/jobs/{jobId}/result` | Endpoint nhận kết quả nội bộ, UI theo dõi qua GET job | — | 404 |
| `POST /api/v1/projects/{projectId}/summary` | Data Analysis → Tạo tổng kết | 201 | — |
| `GET /api/v1/projects/{projectId}/summary` | Data Analysis → Tải tổng kết | 200 | — |
| `POST /api/v1/projects/{projectId}/report` | Data Analysis → Yêu cầu PDF | 202 | — |
| `GET /api/v1/projects/{projectId}/report/{reportId}/file` | Data Analysis → Tải PDF/poll trạng thái | 202 | — |
| `GET /api/v1/notifications` | Chuông/trang thông báo, danh sách cá nhân | 200 | — |
| `GET /api/v1/notifications/unread-count` | Badge số thông báo chưa đọc | 200 | — |
| `GET /api/v1/notifications/{id}` | Mở chi tiết thông báo | 200 | — |
| `PATCH /api/v1/notifications/{id}/read` | Đánh dấu thông báo đã đọc | 200 | — |
| `PATCH /api/v1/users/me/notification-preferences` | Settings thông báo, bật/tắt nhận | 200 | — |
| `POST /api/v1/issues` | Gửi báo cáo vấn đề từ UI | 201 | — |
| `GET /api/v1/issues` | Danh sách báo cáo vấn đề của user | 200 | — |
| `POST /api/v1/issues/{id}/attachments` | Upload file đính kèm issue | 201 | — |
| `GET /api/v1/issues/{id}/attachments/{attachmentId}` | Tải file đính kèm issue | 200 | — |
| `GET /api/v1/issues/{id}` | Mở chi tiết issue của user | 200 | — |
| `PATCH /api/v1/issues/{id}` | Sửa issue khi backend cho phép | 200 | — |
| `GET /api/v1/admin/issues` | Quản trị → Báo cáo vấn đề, danh sách | 200 | — |
| `GET /api/v1/admin/issues/{id}` | Quản trị → Chi tiết issue | 200 | — |
| `PATCH /api/v1/admin/issues/{id}/status` | Quản trị → Cập nhật trạng thái issue | 200, 401 | — |
| `POST /api/v1/analyses/{analysisId}/findings/{findingId}/feedback` | Data Analysis → Gửi feedback cho finding | 201 | — |
| `GET /api/v1/analyses/{analysisId}/findings/{findingId}/feedback` | Data Analysis → Xem feedback finding | 200 | — |
| `POST /api/v1/analyses/{analysisId}/feedback` | Data Analysis → Gửi feedback lần chạy | 201 | — |
| `GET /api/v1/analyses/{analysisId}/feedback` | Data Analysis → Xem feedback lần chạy | 200 | — |
| `PATCH /api/v1/feedback/{id}` | Data Analysis → Cập nhật feedback | 200 | — |
| `DELETE /api/v1/feedback/{id}` | Data Analysis → Xóa feedback | 200 | — |
| `GET /api/v1/projects/{projectId}/ai-quality-metrics` | Data Analysis → Chỉ số chất lượng AI | 200 | — |
| `GET /api/v1/overview/workspaces` | Home/Activity Overview, tổng quan workspace của user | 200 | — |
| `GET /api/v1/workspaces/{id}/overview` | Workspace Detail, cards và phân bố trạng thái | 200 | — |

## 2. API chưa có kết nối từ DataVerse

- `POST /api/v1/analysis/jobs/{jobId}/result`. Endpoint nhận kết quả nội bộ, UI theo dõi qua GET job.

## 3. API đã nối nhưng chưa có mã HTTP từ UI

- `GET /api/v1/auth/google/callback` — Callback Google, hoàn tất đăng nhập/redirect.
- `GET /api/v1/workspaces/{workspaceId}/projects` — Danh sách Project theo Workspace, fallback tương thích.

## 4. API có nhưng chưa có thao tác UI tương ứng

- `GET /api/v1/datasets/{datasetId}/charts` **đã nối** vào Data View. Lượt kiểm tra bổ sung đã xác nhận Box Plot và Top N bằng dữ liệu backend QA. Giá trị phân loại được ẩn nếu backend đánh dấu `masked` hoặc cột được đánh dấu PII. Xem kết quả chi tiết ở cuối báo cáo.
- `POST /api/v1/analysis/jobs/{jobId}/result`: endpoint ghi kết quả nội bộ. Worker gọi `IngestAiResultHandler` trong `src/backend/src/modules/analysis/application/services/ai-worker.service.ts`; người dùng xem trạng thái hoặc thử lại từ Data Analysis.
- `GET /health/ready` **đã có UI** ở `src/frontend/src/views/management/settings/system-status.tsx`, nên không nằm trong nhóm này.

## 5. Rà soát màn hình có tính năng thiếu API

- **Đăng nhập/đăng ký:** nút Microsoft và GitHub bị khóa trong `src/frontend/src/views/auth/login/sections/auth-provider-buttons.tsx`; Swagger không có OAuth cho hai nhà cung cấp. Google có API riêng.
- **Processing → Data Analysis:** nút tải/lưu cấu hình gọi `GET`/`POST /analysis/config` qua `analysis.service.ts`. Hai route có trong checkout backend nhưng vắng ở Swagger QA. Xem kết quả ngày 24/11 bên dưới.
- **Processing → Data View:** đánh dấu PII gọi `PATCH /datasets/{id}/columns/pii` qua `dataset.service.ts`. Route có trong checkout backend nhưng vắng ở Swagger QA.
- **Processing → thanh công cụ project:** nút Tải file kết quả cần `result.download` trong `project-data-actions.tsx`; chưa có adapter live cho file dữ liệu sau xử lý. Tải CSV gốc và yêu cầu/xuất PDF đã có API riêng.
- **Workspace:** thêm/gỡ/chuyển owner đã có contract. Dropdown sửa role thành viên ở chế độ live bị khóa; `setWorkspaceMemberRole` là `unsupported` trong `management.store.ts`. Yêu thích workspace chỉ cập nhật state trong phiên, không có hợp đồng lưu trên server.
- **Workspace → ảnh/biểu tượng:** `workspace-detail-dialogs.tsx` gọi `saveResourceAvatar` từ `use-resource-avatar.ts`. Đây là lưu trên client, Swagger không có endpoint đồng bộ ảnh/biểu tượng qua tài khoản.
- **Thông báo:** nút xóa bị khóa trong `notification-center.tsx` và `notifications.view.tsx`; Swagger chỉ có danh sách, chi tiết, số chưa đọc và đánh dấu đọc.
- **Cài đặt → Hồ sơ:** trường Đơn vị bị khóa ở chế độ API; backend không có `organization` trong `update-user.dto.ts`. Chế độ màu lưu theo thiết bị từ UI, không cần API trừ khi phải đồng bộ tài khoản.
- **Báo cáo vấn đề:** gửi, xem, tải tệp và sửa khi cần bổ sung đã có contract. Swagger chưa có endpoint xóa issue hay tệp, nên QA cần dữ liệu tạo riêng và chấp nhận lưu bản ghi. **Quản trị** có API xem tài khoản và cập nhật issue, không dùng quyền analyst để kết luận lỗi.
- **Home, menu tài khoản, phiên đăng nhập, thông báo, Settings, danh sách Workspace/Project, wizard CSV, Data View/Data Analysis và trạng thái hệ thống** đã được đối chiếu handler trong source. Thao tác nào thực sự phát request được ghi ở bảng đầu. Chế độ 3D và mở CSV cục bộ xử lý hiển thị tại trình duyệt; bản ghi upload mới dùng API dataset.

### Sai khác OpenAPI frontend so với Swagger deploy

- `PATCH /api/v1/datasets/{id}/columns/pii`: 404.
- `POST /api/v1/projects/{projectId}/analysis/config`: chưa thu HTTP từ UI.
- `GET /api/v1/projects/{projectId}/analysis/config`: 404.

## 6. Kết quả luồng, dữ liệu QA và việc backend cần hỗ trợ

- Các luồng chính đã thao tác trong Chrome: tài khoản, gia hạn/thu hồi phiên, quản lý Workspace/Project, upload/lọc/tải/xóa CSV, phân tích/AI/PDF/feedback, thông báo, báo cáo vấn đề và quản trị. Phản hồi từng bước nằm trong inventory.
- Dữ liệu QA đã tạo, dọn hoặc cập nhật: `workspace` `6b050b0d00f66f78bb734c80` `QA24-mwu5xekc`.
- Dữ liệu QA đã tạo, dọn hoặc cập nhật: `project` `6b050b2000f66f78bb734c81`.
- Dữ liệu QA đã tạo, dọn hoặc cập nhật: `dataset` `e5a8c359e06e82c93060de70`.
- Dữ liệu QA đã tạo, dọn hoặc cập nhật: `feedback` `6b050ba200f66f78bb734c95`.
- Dữ liệu QA đã tạo, dọn hoặc cập nhật: `đã xóa feedback` `6b050ba200f66f78bb734c95`.
- Dữ liệu QA đã tạo, dọn hoặc cập nhật: `issue QA lưu lại vì không có DELETE` `6b050bed00f66f78bb734c97`.
- Dữ liệu QA đã tạo, dọn hoặc cập nhật: `finding feedback` `6b050dd400f66f78bb734ca6`.
- Dữ liệu QA đã tạo, dọn hoặc cập nhật: `đã xóa finding feedback` `6b050dd400f66f78bb734ca6`.
- Dữ liệu QA đã tạo, dọn hoặc cập nhật: `đã xóa dataset` `e5a8c359e06e82c93060de70`.
- Dữ liệu QA đã tạo, dọn hoặc cập nhật: `đã xóa tài khoản tạm` `6b050bfd00f66f78bb734c99`.
- Dữ liệu QA đã tạo, dọn hoặc cập nhật: `dataset kiểm tra lại` `8ebe063ac080507cd6e39f50`.
- Dữ liệu QA đã tạo, dọn hoặc cập nhật: `issue QA đã đánh dấu resolved` `6b050bed00f66f78bb734c97`.
- Dữ liệu QA đã tạo, dọn hoặc cập nhật: `đã xóa dataset kiểm tra lại` `8ebe063ac080507cd6e39f50`.
- Dữ liệu QA đã tạo, dọn hoặc cập nhật: `đã xóa project` `6b050b2000f66f78bb734c81`.
- Dữ liệu QA đã tạo, dọn hoặc cập nhật: `đã xóa workspace` `6b050b0d00f66f78bb734c80`.

### Sửa frontend và kiểm tra lại

- **Cấu hình QA:** cập nhật `.env` của frontend sang origin `https://headquarters-qualification-fighter-cio.trycloudflare.com` và giữ prefix `/api/v1`. Dev server QA mới và preflight đăng nhập trả `200`/`204`; đăng nhập của hai analyst và một admin trả `200` qua form.
- **Data View → Phân bố dữ liệu:** trước khi sửa, màn hình chỉ gọi thống kê cột. Gọi trực tiếp `/charts?columns=c1` trên CSV QA trả `200`, với `charts[].histogram.bins` và `box_plot`. `dataset.service.ts`, `live-dataset-panel.tsx` và `dataset-distribution.tsx` đã được nối theo phản hồi này. Lượt UI sau sửa trả `200` cho `/charts`, vẽ histogram, hiển thị trung vị, đổi được sang Tỷ trọng. API thống kê cột vẫn cấp các số tổng hợp và là fallback khi API charts lỗi.
- **Thành viên Project:** mở project trực tiếp từ Processing chưa có roster của workspace, làm nút thêm không tìm được thành viên đã tham gia. `project-members-dialog.tsx` và `management.store.ts` đã bổ sung tải roster và ghép thông tin hiển thị/email theo ID, giữ role của Project. Sau sửa, `GET` roster `200`, thêm `201`, sửa role `200`, gỡ `200`. Chuyển owner Project sang analyst thứ hai rồi chuyển lại đều `201`.
- **Xóa dataset:** lần đầu `DELETE` trả `204` nhưng khi cache preview bị vô hiệu hóa trước lúc Project tải lại, Data View còn gửi `GET schema/records` trên ID vừa xóa (`404`). Đã chặn tải dataset cũ ngay sau `DELETE` và đổi thứ tự làm mới Project/cache. Upload lại CSV tạm `201`, xóa `204`, màn hình về trạng thái chưa có dataset và Network không ghi thêm GET trên ID vừa xóa.
- **Kiểm tra dọn fixture:** xóa dataset, Project và Workspace của lượt test đều trả `204`; xóa feedback và tài khoản tạm trả `200`. Issue QA và tệp tổng hợp vẫn tồn tại vì Swagger không có route xóa, issue đã được admin chuyển `resolved` với HTTP `200` từ phiên mới. Lượt `401` của phiên admin trước đó xảy ra khi phiên hết hạn.

### Việc cần backend hoặc môi trường QA hỗ trợ

1. **Google OAuth.** Request từ nút Google trả `302` với `redirect_uri=http://localhost:3000/api/v1/auth/google/callback`. Gọi trực tiếp callback thiếu code trả `401` và chỉ xác nhận nhánh từ chối. Backend cần cập nhật `GOOGLE_REDIRECT_URI` và đăng ký cùng URL HTTPS ở Google Cloud Console. Sau đó mới thử được đăng nhập Google đầu cuối và xác nhận role.
2. **Cấu hình phân tích và PII.** `GET /analysis/config` và `PATCH /columns/pii` đều trả `404` từ UI. Bên deploy thiếu các route này trong Swagger, trong khi `AnalysisController` và `DatasetsController` ở checkout có khai báo. Backend cần triển khai đúng bản có routes và đồng bộ Swagger nếu đã thống nhất cung cấp. Nút lưu cấu hình bị khóa sau GET `404` nên chưa có Network cho `POST /analysis/config`. Chạy phân tích vẫn `201`; đọc kết quả `404` trước lần chạy đầu và `200` sau khi có kết quả là hành vi phù hợp với fixture.
3. **OTP.** `POST /auth/forgot-password` trả `200` cho tài khoản tạm. Reset với mã không hợp lệ trả `400`. Cần mailbox QA nhận OTP thật để kiểm tra giao mã và reset thành công. Đổi mật khẩu tài khoản tạm trả `200`, đăng nhập lại bằng mật khẩu mới thành công và sau đó đã xóa tài khoản tạm qua UI.
4. **Ghi kết quả từ AI worker.** `POST /analysis/jobs/{jobId}/result` gọi trực tiếp với ID job không tồn tại trả `404`. Luồng tạo và xem job/retry trên UI đã có status riêng. Cần fixture hoặc log worker để xác nhận nhánh ghi kết quả thành công cho endpoint nội bộ nếu backend còn gọi nó qua HTTP.
5. **Fallback danh sách theo workspace.** `GET /workspaces/{workspaceId}/projects` trả `200` khi gọi trực tiếp bằng workspace QA. UI dùng `GET /projects` bình thường, không có Network cho nhánh fallback trong phiên này.
6. **Các tính năng chưa có hợp đồng.** Xác nhận phạm vi sản phẩm trước khi backend thêm API cho xóa thông báo, đồng bộ yêu thích/ảnh Workspace, trường Đơn vị hoặc xuất CSV sau xử lý. Phần giao diện và lý do cho từng mục nằm ở trên.
7. **Đồng bộ contract biểu đồ.** `/charts` hoạt động trên tunnel và đã qua UI. Route chưa có trong `DataViewController` của checkout backend và OpenAPI snapshot frontend. Backend cần công bố schema phản hồi của endpoint trong Swagger, gồm `histogram`, `box_plot` và quy tắc che dữ liệu phân loại, để frontend có thể sinh kiểu từ cùng contract.

Nhật ký Network đã bỏ query, header, credential và nội dung response. Chỉ các fixture tạo trong lượt ngày 24/11 được dùng cho thao tác xóa. CSV và tệp ảnh đính kèm dùng dữ liệu tổng hợp.

### Kiểm tra bổ sung Data View trên Chrome — 24/11/2026

- Dùng DataVerse qua Vite và một CSV tổng hợp 78 bản ghi trong fixture `QA-CHARTS-mwu9gc9b`. Chrome Network ghi `POST /auth/login 200`, tạo Workspace/Project/upload `201`, thống kê cột và `GET /datasets/{datasetId}/charts` đều `200` cho cột số, cột phân loại và cột boolean (các path API nghiệp vụ có tiền tố `/api/v1`).
- **Box Plot:** UI hiển thị râu dưới `10`, Q1 `13,25`, trung vị `17`, Q3 `21`, râu trên `25`, và `1/78` điểm ngoài râu, khớp với phản hồi QA. Đã thao tác nút Tỷ trọng. Kiểm tra tự động dùng nhãn cũ của histogram nên chưa xác nhận lại toàn bộ nội dung ở chế độ Tỷ trọng trong lượt bổ sung.
- **Top N:** cột `nhom` hiển thị 5 nhóm và nhóm **Các giá trị còn lại**, mỗi nhóm có 13 bản ghi và tỷ trọng `16,67%`. Cột boolean hiển thị 2 nhóm, khớp số lượng và tỷ trọng trong response. Ở viewport 480 px, khung Top N có `clientWidth = scrollWidth = 377 px`, không ghi nhận tràn ngang. Kiểm tra chuyển sáng/tối của biểu đồ chưa hoàn tất.
- **Trạng thái che giá trị:** dùng phản hồi mô phỏng chỉ cho ca `masked: true`. UI hiển thị thông báo ẩn giá trị và không hiện nhãn hoặc danh sách. Ca này kiểm tra cách render của frontend, không tính mã mô phỏng là kết quả backend.
- **Dọn fixture:** dataset `8f1555eaceaa97c5b51b3382`, Project `6b0522214ea9b99a53a81422`, Workspace `6b05221b4ea9b99a53a81421` đều được xóa qua UI, Network trả `204` cho từng thao tác.
- **Đổi mật khẩu tài khoản người dùng:** chưa thực hiện trong lượt này. Đăng nhập bằng form vẫn trả `200`. Kết quả đổi mật khẩu `200` trong inventory thuộc phép thử trước đó trên tài khoản tạm.
