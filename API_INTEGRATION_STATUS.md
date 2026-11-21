# Trạng thái nối API Backend - Frontend/UI

## Đối chiếu nhánh backend và Swagger ngày 21/11/2026

- `origin/backend` đã tiến từ `a7af214` lên `10aea5a` (`fix(analysis): chong OOM do ma tran Cramer V day`). Đã merge vào `TaiFE` bằng merge commit `04a8915`; thay đổi chỉ nằm trong `analysis` và tài liệu/test đi kèm. Theo phạm vi yêu cầu, không chạy test hoặc gọi API `analysis`.
- Đã đối chiếu danh sách endpoint trên [Swagger tunnel mới](https://templates-giant-revenues-positions.trycloudflare.com/api/v1/docs) với `api-specification.md`, source nhánh backend và frontend. Trong source nhánh, các route nghiệp vụ ngoài `analysis` đều có service và UI caller tương ứng; `/health` và `/health/ready` là endpoint vận hành, không thuộc UI. Tuy nhiên Swagger tunnel có route charts chỉ xuất hiện ở môi trường deploy, được ghi riêng bên dưới. Status Network UI `200` trong báo cáo vẫn là bằng chứng đã ghi nhận ngày 19/11/2026, không phải kết quả kiểm tra mới hôm nay.
- Swagger tunnel hiện khai báo thêm `GET /api/v1/datasets/{datasetId}/charts` (histogram/box plot/Top N), nhưng endpoint này không có trong source backend tại `10aea5a`, không có trong `api-specification.md`/OpenAPI types của frontend và không có frontend service/caller. Đây là lệch giữa Swagger đang triển khai và nhánh backend; chưa thể xác nhận API dùng được hoặc response contract.
- Không có browser Network page được chia sẻ trong lượt này. Theo yêu cầu không phát request/chạy thao tác để tránh ảnh hưởng server, không có status Network mới được thu thập; route `charts` giữ trạng thái chưa xác minh. Các status cũ được giữ nguyên, không suy diễn thành bằng chứng mới.

## Cập nhật kiểm thử live ngày 19/11/2026

Backend được kiểm tra: `https://temporarily-xml-sys-healthcare.trycloudflare.com/api/v1`. Swagger JSON trả `200`, xác nhận có `GET /api/v1/projects` (PROJ-02b), hai route overview và `DELETE /api/v1/datasets/{id}`. UI được chạy riêng tại `http://127.0.0.1:5202` bằng biến môi trường runtime; không sửa `.env`.

Đăng nhập UI bằng tài khoản admin test thành công. Network thực tế từ UI ghi nhận:

| API hoặc nhóm | Status | Bằng chứng |
| --- | ---: | --- |
| `POST /api/v1/auth/login` | `200` | Submit form đăng nhập UI |
| `POST /api/v1/auth/refresh` | `200` | Gia hạn phiên bằng hộp thoại tiếp tục phiên |
| `GET /api/v1/workspaces`, `GET /api/v1/projects` | `200` | Bootstrap UI; route project tổng phát request thật và danh sách Project hiển thị dữ liệu backend |
| `GET /api/v1/users/me`, `GET /api/v1/issues`, `GET /api/v1/notifications`, `GET /api/v1/notifications/unread-count` | `200` | Bootstrap UI |
| `GET /api/v1/workspaces/{id}/members`, `GET /api/v1/projects/{id}/members`, `GET /api/v1/projects/{id}/datasets` | `200` | Bootstrap Project/Workspace |
| `GET /api/v1/projects/{id}`, `GET /api/v1/datasets/{id}`, `GET /api/v1/datasets/{id}/schema`, `GET /api/v1/datasets/{id}/records` | `200` | Mở Project có CSV thật; Overview hiển thị metadata, Data View hiển thị 100.000 dòng, 7 cột |
| `POST /api/v1/datasets/{id}/records/query` | `200` | Dùng ô tìm kiếm và nút Áp dụng trong Data View |
| `GET /api/v1/datasets/{id}/columns/{columnKey}/stats` | `200` | Bấm “Thống kê cột đã chọn” |
| `GET /api/v1/datasets/{id}/file` | `200` | Bấm “Tải CSV gốc”; response `text/csv; charset=utf-8` |
| `GET /api/v1/overview/workspaces`, `GET /api/v1/workspaces/{id}/overview` | `200` | Mở Home/Workspace Detail; route overview chi tiết được nối vào stat cards và donut |
| `GET /api/v1/admin/users`, `GET /api/v1/admin/users/{id}`, `GET /api/v1/admin/issues` | `200` | Mở trang Quản lý và hồ sơ QA Diag với admin |
| `GET /api/v1/auth/sessions`, `GET /api/v1/auth/sessions/me` | `200` | Mở Settings → Đăng nhập & phiên → Chi tiết phiên hiện tại |

Không phát request thuộc `analysis`, `summary`, PDF report, feedback hoặc AI-quality metrics trong lượt kiểm tra live này. Các API analysis, summary/report và feedback đã được nối vào frontend sau lượt kiểm tra, nhưng chưa phát request; status live là `__`. Không chạy mutation trên dữ liệu thật trong lượt này. `DELETE /api/v1/datasets/{id}` đã có caller UI kèm xác nhận và unit test contract; chưa bấm xác nhận xóa trên tunnel. Các thao tác ghi hồ sơ, issue, notification preferences/read, tạo tài nguyên, upload, đổi PII, chuyển owner, thu hồi session và xóa account cũng chưa được live-test. Google OAuth, OTP/password reset cần luồng/đích nhận riêng nên chưa xác nhận thành công.

Kết quả Network ở phần này là lần kiểm tra mới nhất; các bảng bên dưới lưu lại lịch sử từ tunnel/phiên trước. Nơi nào ghi “chưa capture” trong lịch sử nhưng đã có bằng chứng phía trên thì ưu tiên bằng chứng ngày 19/11/2026.

## Cập nhật trên `TaiFE` ngày 18/11/2026

| API hoặc nhóm chức năng | Thay đổi | Kết quả kiểm tra |
| --- | --- | --- |
| `GET /api/v1/projects` | Trang Processing và danh sách Project dùng route tổng. Frontend gửi `limit` và nối trang bằng `meta.nextCursor`, đồng thời giữ các project mà API cấp quyền xem. Route theo workspace được dùng khi backend cũ trả `404` cho route tổng. | Request do UI Processing phát trả **`200`** và trang hiển thị project thật. Gọi API trực tiếp với `limit=2` cho hai trang `200` với ID không trùng. |
| `GET /api/v1/workspaces`, `GET /api/v1/workspaces/{id}/members`, `GET /api/v1/projects/{id}` | Tải không gian làm việc, thành viên và chi tiết Project. | Các request UI trả `200`. |
| `GET /api/v1/projects/{id}/members`, `GET /api/v1/projects/{id}/datasets` | Tải thành viên và dataset của Project. | Các request UI trả `200`. |
| `GET /api/v1/datasets/{id}/schema`, `GET /api/v1/datasets/{id}/records`, `POST /api/v1/datasets/{id}/records/query`, `GET /api/v1/datasets/{id}/columns/{columnKey}/stats` | Data View tải schema, bản ghi, tìm kiếm và thống kê cột. | Các thao tác trên UI phát request và nhận `200`. |
| `PATCH /api/v1/datasets/{id}/columns/pii` | Data View hiển thị và cập nhật metadata PII theo quyền của backend. Backend mới đã gỡ API đổi tên dataset, đổi tên cột và khôi phục tên cột. | Gọi API trực tiếp trên CSV mẫu. Bật và tắt PII đều `200`. Đọc lại schema xác nhận cờ đã lưu. Nút trên UI chưa được xác minh bằng thao tác cập nhật. |
| `POST /api/v1/workspaces/{id}/projects`, `POST /api/v1/projects/{id}/datasets/upload` | Trang `/processing/new` mở wizard tạo Project và nhập CSV hiện có. | Hai API trả `201` trong lượt gọi trực tiếp với dữ liệu mẫu. Workspace, Project và dataset QA đã được dọn bằng các route xóa mềm, tất cả trả `204`. Wizard từ `/processing/new` chưa được thử lại trong trình duyệt. |
| `POST /api/v1/auth/login`, `GET /api/v1/users/me`, `GET /api/v1/auth/sessions/me` | Đăng nhập admin, khôi phục phiên và đọc phiên hiện tại. | Đăng nhập qua UI thành công. `GET /users/me` từ UI trả `200`. Gọi trực tiếp `POST /auth/login` và `GET /auth/sessions/me` đều `200`. |
| `GET /api/v1/auth/google`, `GET /api/v1/auth/google/callback` | Nút Google khởi tạo OAuth. Frontend dọn fragment và xác minh hồ sơ bằng `GET /users/me` trước khi lưu phiên. | Endpoint bắt đầu trả `302` sang Google. Callback `access_denied` trả `302` về `http://localhost:5173/`. Origin này khác UI thử tại cổng `5200`. Cần chạy UI đúng origin cấu hình và dùng tài khoản Google để xác minh đăng nhập thành công. |
| `GET /api/v1/issues`, `GET /api/v1/notifications`, `GET /api/v1/notifications/unread-count` | Tải báo cáo và thông báo cá nhân. | Các request UI trả `200`. |
| `GET /api/v1/datasets/{id}`, `PATCH /api/v1/users/me`, `PATCH /api/v1/issues/{id}` | Caller đọc metadata Dataset, cập nhật hồ sơ và bổ sung báo cáo đã có trong frontend. | Chưa xác minh trực tiếp các thao tác này qua UI trên tunnel hiện tại. |

Frontend được thử ở `http://127.0.0.1:5200`, dùng backend `https://sec-gig-wma-introduces.trycloudflare.com/api/v1`. Frontend cũng đã khởi động tại `http://localhost:5173` để khớp đích callback Google. Đã đối chiếu `api-specification.md` với OpenAPI của tunnel. Mã `200` trong các dòng UI được ghi từ response HTTP thật của trình duyệt qua Axios. Công cụ điều khiển Chrome dừng ở bước mở Network, nên lượt này chưa có bản chụp từ DevTools. Các thay đổi sau lượt UI gồm giữ thứ tự danh sách Project theo API, mở wizard tạo Project từ Processing và xử lý callback Google. Những thay đổi này cần xác minh lại trên UI.

`MERGE_HEAD` của `TaiFE` trùng `origin/backend` tại `a7af214`. `git ls-files -u` không còn file xung đột. Merge chưa được commit. `origin/TaiFE` vẫn ở `8970d5f` và chưa nhận thay đổi của lượt này.

Frontend build thành công với `npm --prefix src/frontend run build`. Analysis và các API phụ thuộc Analysis ngoài phạm vi lượt này. Unit test, E2E và kiểm thử hiệu năng do thành viên phụ trách thực hiện.

## Kết quả Network ghi nhận ở môi trường trước

Ngày kiểm tra: 18/11/2026  
Môi trường: Frontend HTTPS tại `https://localhost:5200`, backend tại `https://raise-rod-bloomberg-absence.trycloudflare.com/api/v1`, tài khoản test `admin@school.local`.

Tài liệu này chỉ ghi API đã được phát request qua UI hoặc đã được xác minh bằng Network của trình duyệt. Không coi Swagger/OpenAPI khai báo là bằng chứng live.

## API được coi là nối thành công

| API | ID/nhóm dữ liệu đã kiểm tra | Status Network UI | Trạng thái |
|---|---|---:|---|
| `POST /api/v1/auth/login` | Phiên admin | `200` | Thành công qua form đăng nhập |
| `GET /api/v1/users/me` | Hồ sơ System Admin | `200` | Thành công |
| `GET /api/v1/workspaces?page=1&limit=100` | 4 workspace | `200` | Thành công |
| `GET /api/v1/workspaces/{workspaceId}` | `testin`: `6afd2dc5e6d6b365e0d622d3` | `200` | Thành công |
| `GET /api/v1/workspaces/{workspaceId}/members` | Workspace `testin` | `200` | Thành công |
| `GET /api/v1/workspaces/{workspaceId}/projects?page=1&limit=100` | Workspace `testin` | `200` | Thành công |
| `GET /api/v1/workspaces/{workspaceId}/overview` | Workspace `testin` | `200` | Thành công khi mở trang overview/workspace |
| `GET /api/v1/overview/workspaces` | Tổng: 4 workspace, 4 project | `200` | Thành công trong Activity Overview |
| `GET /api/v1/projects/{projectId}/members` | Project `Ai data quality testing`: `6afd2df2e6d6b365e0d622d4` | `200` | Thành công |
| `GET /api/v1/projects/{projectId}/datasets` | Dataset `olist_order_reviews_dataset.csv` | `200` | Thành công |
| `GET /api/v1/datasets/{datasetId}/records` | 100.000 dòng, 7 cột | `200` | Xác nhận qua UI ngày 19/11/2026; Data View hiển thị dữ liệu thật |
| `POST /api/v1/datasets/{datasetId}/records/query` | Tìm kiếm trong Data View | `200` | Xác nhận qua thao tác tìm kiếm và áp dụng ngày 19/11/2026 |
| `GET /api/v1/datasets/{datasetId}/schema` | 7 cột | `200` | Xác nhận khi mở Project có CSV thật ngày 19/11/2026 |
| `GET /api/v1/datasets/{datasetId}/columns/{columnKey}/stats` | Thống kê cột Data View | `200` | Xác nhận khi bấm “Thống kê cột đã chọn” ngày 19/11/2026 |
| `GET /api/v1/datasets/{datasetId}/file` | Tải CSV gốc | `200` | Xác nhận khi bấm “Tải CSV gốc”; response `text/csv; charset=utf-8` ngày 19/11/2026 |
| `GET /api/v1/notifications/unread-count` | Tài khoản admin | `200` | Thành công |
| `GET /api/v1/notifications?limit=100` | Danh sách thông báo | `200` | Thành công; tài khoản hiện không còn thông báo chưa đọc |
| `GET /api/v1/notifications/{id}` | ID thông báo cụ thể | `__` | Chưa phát request; tài khoản test không có notification để mở |
| `PATCH /api/v1/notifications/{id}/read` | ID thông báo cụ thể | `__` | Chưa phát request; tài khoản test không có notification để đánh dấu |
| `GET /api/v1/issues?limit=100` | Danh sách issue của tài khoản | `200` | Thành công, danh sách rỗng |
| `GET /api/v1/issues/{id}` | ID issue cụ thể | `__` | Chưa phát request; tài khoản test không có issue để mở |
| `PATCH /api/v1/issues/{id}` | Cập nhật issue của mình | `__` | Chưa phát request; không có issue để thử mutation |
| `POST /api/v1/issues/{id}/attachments` | Đính kèm issue | `__` | Chưa phát request; không có issue và không thử tạo dữ liệu |
| `GET /api/v1/issues/{id}/attachments/{attachmentId}` | Tệp đính kèm | `__` | Chưa phát request; không có attachment dữ liệu test |
| `GET /api/v1/admin/users` | 7 tài khoản | `200` | Thành công trong panel Quản trị |
| `GET /api/v1/admin/users/{id}` | QA Diag: `6afc2ba5c37b4d662e5537b3` | `200` | Thành công khi mở chi tiết tài khoản |
| `GET /api/v1/admin/issues?limit=10&sortBy=createdAt&sortOrder=desc` | Danh sách báo cáo issue | `200` | Thành công; danh sách rỗng |
| `GET /api/v1/admin/issues/{id}` | ID issue cụ thể | `__` | Chưa phát request; không có issue để mở |
| `PATCH /api/v1/admin/issues/{id}/status` | Cập nhật trạng thái issue | `__` | Chưa phát request; không có issue và không thử ghi dữ liệu |
| `GET /api/v1/auth/sessions` | 31 phiên | `200` | Thành công trong Settings → Đăng nhập & phiên |
| `GET /api/v1/auth/sessions/{id}` | ID phiên cụ thể | `__` | Route đã có caller; chưa mở chi tiết một phiên trong UI |
| `DELETE /api/v1/auth/sessions/{id}` | Thu hồi một phiên | `__` | Chưa phát mutation; không thu hồi phiên đang dùng/phiên thật trong bài kiểm tra |
| `POST /api/v1/auth/change-password` | Đổi mật khẩu | `__` | Caller đã có; không thao tác đổi mật khẩu tài khoản test trong lượt kiểm tra |

## Các API chưa có status live xác nhận

| Nhóm/API | Status live | Lý do | Bằng chứng hiện có |
|---|---:|---|---|
| `/api/v1/projects/{projectId}/summary` và `/api/v1/projects/{projectId}/report...` | `__` | Chưa test live | Đã nối frontend sau lượt kiểm tra live; chưa phát request |
| Các route `/api/v1/analysis/...`, `/api/v1/analyses/{analysisId}/.../feedback`, `/api/v1/feedback/{id}` | `__` | Chưa test live | Đã nối frontend sau lượt kiểm tra live; chưa phát request |
| `/api/v1/auth/google` và `/api/v1/auth/google/callback` | `302` (lượt 18/11) | Chưa xác minh đăng nhập OAuth thành công | Endpoint bắt đầu trả `302` sang Google; callback `access_denied` trả `302` về origin cấu hình |
| `POST /api/v1/auth/register` | `__` | Chưa test live | Không đăng ký tài khoản mới để tránh làm thay đổi dữ liệu backend |
| `POST /api/v1/auth/forgot-password`, `/api/v1/auth/reset-password` | `__` | Chưa test live | Không kích hoạt reset OTP để tránh làm thay đổi trạng thái tài khoản |
| `DELETE /api/v1/users/me` | `__` | Chưa test live | Không thực thi thao tác phá hủy để bảo toàn tài khoản test |
| `PATCH /api/v1/users/me/notification-preferences` | `__` | Chưa test live | Không thay preference của tài khoản test |
| `POST /api/v1/workspaces` | `__` | Chưa test live | Không tạo tài nguyên mới trong lượt Network vừa test |
| `PATCH/DELETE /api/v1/workspaces/{id}` | `__` | Chưa test live | Không sửa hoặc xóa workspace thật |
| `POST/DELETE /api/v1/workspaces/{id}/members` | `__` | Chưa test live | Chưa có dữ liệu thành viên test được cấp để mutate |
| Đổi role thành viên workspace | `__` | Không có endpoint backend | Swagger không khai báo endpoint đổi role workspace; cần backend bổ sung contract/route |
| `DELETE /api/v1/notifications/{id}` | `__` | Không có endpoint backend | Swagger/backend không khai báo route xóa notification |
| `POST /api/v1/workspaces/{workspaceId}/projects` | `201` | UI wizard chưa test live | Gọi trực tiếp với dữ liệu mẫu ngày 18/11; tài nguyên QA đã được dọn bằng API `204` |
| `POST /api/v1/projects/{id}/datasets/upload` | `201` | UI wizard chưa test live | Gọi trực tiếp với dữ liệu mẫu ngày 18/11; dataset QA đã được dọn bằng API `204` |
| `PATCH/DELETE /api/v1/projects/{id}` | `__` | Chưa test live | Không sửa hoặc xóa project thật trong lượt kiểm tra |
| Rename, reset/delete dataset | `__` | Chưa test live | Không ghi vào project/dataset test để tránh làm thay đổi dữ liệu |
| `PUT /api/v1/projects/{id}/snapshot` | `__` | Chưa test live | Không đánh dấu project hoàn thành trong lượt test |
| Project member add/update/remove/transfer | `__` | Chưa test live | Không thay đổi membership project thật |
| `PATCH /api/v1/datasets/{id}/columns`, reset columns, delete dataset | `__` | Chưa test live | Không thử ghi dữ liệu trong lượt kiểm tra |

## Giới hạn chứng cứ

1. `200` trong bảng này chỉ dùng cho request thực sự xuất hiện trong Network/UI hoặc response được thu thập trực tiếp bằng Playwright.
2. Một route xuất hiện trong Swagger hoặc source frontend không tự động được liệt kê là “nối thành công”.
3. Không chạy mutation để thay đổi tài khoản, workspace, project, dataset, issue, notification hoặc session của backend.
4. Dữ liệu tài khoản test không có notification và issue, nên các route chi tiết/attachment/issue/update/admin issue chưa thể phát request có dữ liệu thật.
5. API `/health` không còn nằm trong phạm vi theo yêu cầu; không cần nối hoặc fix route health.
6. Nhóm `analysis`, summary/report, feedback và AI quality metrics không được gọi hay thay đổi.

## Kết luận ngắn

Các luồng đã được xác nhận live qua UI chủ yếu gồm đăng nhập, hồ sơ, workspace/project/dataset đọc, overview, notification list/count, issue list, session list và admin user/issue list. Một số route detail đã có caller trong frontend nhưng chưa phát request vì thiếu tài nguyên test. Các mutation chưa được chạy vì yêu cầu xác nhận phải không làm thay đổi dữ liệu khi kiểm tra network.
