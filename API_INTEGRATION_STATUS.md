# Trạng thái tích hợp API Backend - Frontend

## Hiện trạng ngày 22/11/2026

- Backend Swagger: `https://devoted-suites-jefferson-closest.trycloudflare.com/api/v1/docs`.
- Swagger UI và `/api/v1/docs-json`: `200`; OpenAPI công bố **84 operations**. `GET /health` và `GET /health/ready` nằm ngoài `/api/v1`.
- Frontend browser test: `http://127.0.0.1:5210`, cấu hình API truyền qua process environment; không sửa `.env`.
- Tài khoản kiểm thử: admin `admin@school.local`. Không ghi token hoặc mật khẩu vào báo cáo.
- Dataset có sẵn trong Project QA: `shopping_trends_corrupted_10pct.csv`, 3.900 dòng, 18 cột. Không tạo dataset mới.
- Nhánh: `origin/backend` ở `10aea5a` là tổ tiên của `TaiFE` `2a7f839`; fetch không thấy commit backend mới cần merge.

## Cách đọc

- **Swagger** là các response code được khai báo trong OpenAPI, không phải bằng chứng server đã trả code đó.
- **Frontend** cho biết có service/client caller trong source; “Không” nghĩa là không tìm thấy caller hiện tại. Caller không tự chứng minh endpoint chạy được.
- **Live 22/11** chỉ ghi HTTP status thật đã nhận trong lượt kiểm tra này. `—` nghĩa là chưa phát request hợp lệ trong lượt này, không suy đoán từ Swagger. Status `404` với ID giả được ghi rõ vì đó là phản hồi thật của route, không phải success.
- Các API ghi có thể làm thay đổi dữ liệu được để `—` nếu chưa được chạy. Response code trong cột Swagger chỉ là contract khai báo.

## Inventory đầy đủ từ Swagger mới

### Health, Users và Admin

| Method | Endpoint | Swagger | Frontend | Live 22/11 |
|---|---|---:|---|---:|
| GET | `/health` | 200 | Có, health service | **200** |
| GET | `/health/ready` | 200, 503 | Không | **200** |
| GET | `/api/v1/users/me` | 200 | Có | **200** |
| PATCH | `/api/v1/users/me` | 200 | Có | — |
| DELETE | `/api/v1/users/me` | 200 | Có service; không chạy vì xóa account | — |
| GET | `/api/v1/admin/users` | 200 | Có | **200** |
| GET | `/api/v1/admin/users/{id}` | 200 | Có | **200** |

### Auth và Sessions

| Method | Endpoint | Swagger | Frontend | Live 22/11 |
|---|---|---:|---|---:|
| POST | `/api/v1/auth/register` | 201 | Có | — |
| POST | `/api/v1/auth/login` | 200 | Có | **200** |
| POST | `/api/v1/auth/refresh` | 200 | Có | — |
| POST | `/api/v1/auth/forgot-password` | 200 | Có | — |
| POST | `/api/v1/auth/reset-password` | 200 | Có | — |
| POST | `/api/v1/auth/change-password` | 200 | Có | — |
| GET | `/api/v1/auth/google` | 302, 501 | Có | — |
| GET | `/api/v1/auth/google/callback` | 200, 302, 401, 409 | Có callback flow | — |
| POST | `/api/v1/auth/logout` | 200 | Có | **200** |
| GET | `/api/v1/auth/sessions` | 200 | Có | **200** |
| GET | `/api/v1/auth/sessions/me` | 200, 404 | Có | **200** |
| GET | `/api/v1/auth/sessions/{id}` | 200, 404 | Có | **200** với session ID thật |
| DELETE | `/api/v1/auth/sessions/{id}` | 200 | Có; không thu hồi session khác | — |

### Workspaces

| Method | Endpoint | Swagger | Frontend | Live 22/11 |
|---|---|---:|---|---:|
| POST | `/api/v1/workspaces` | 201 | Có | — |
| GET | `/api/v1/workspaces` | 200 | Có | **200** |
| GET | `/api/v1/workspaces/{id}` | 200 | Có | **200** |
| PATCH | `/api/v1/workspaces/{id}` | 200 | Có | — |
| DELETE | `/api/v1/workspaces/{id}` | 204 | Có; chưa xóa workspace thật | — |
| GET | `/api/v1/workspaces/{id}/members` | 200 | Có | **200** |
| POST | `/api/v1/workspaces/{id}/members` | 201 | Có | — |
| DELETE | `/api/v1/workspaces/{id}/members/{userId}` | 200 | Có | — |
| POST | `/api/v1/workspaces/{id}/transfer-owner` | 201 | Có | — |
| POST | `/api/v1/workspaces/{id}/leave` | 201 | Có | — |

### Projects

| Method | Endpoint | Swagger | Frontend | Live 22/11 |
|---|---|---:|---|---:|
| POST | `/api/v1/workspaces/{workspaceId}/projects` | 201 | Có | — |
| GET | `/api/v1/workspaces/{workspaceId}/projects` | 200 | Có, fallback khi cần | — |
| GET | `/api/v1/projects` | 200 | Có | **200** |
| GET | `/api/v1/projects/{id}` | 200 | Có | **200** |
| PATCH | `/api/v1/projects/{id}` | 200 | Có | — |
| DELETE | `/api/v1/projects/{id}` | 204 | Có; chưa xóa Project QA | — |
| PUT | `/api/v1/projects/{id}/snapshot` | 200 | Có | — |
| GET | `/api/v1/projects/{id}/members` | 200 | Có | **200** |
| POST | `/api/v1/projects/{id}/members` | 201 | Có | — |
| PATCH | `/api/v1/projects/{id}/members/{userId}` | 200 | Có | — |
| DELETE | `/api/v1/projects/{id}/members/{userId}` | 200 | Có | — |
| POST | `/api/v1/projects/{id}/transfer-owner` | 201 | Có | — |

### Datasets và Data View

| Method | Endpoint | Swagger | Frontend | Live 22/11 |
|---|---|---:|---|---:|
| POST | `/api/v1/projects/{projectId}/datasets/upload` | 201 | Có | — |
| GET | `/api/v1/projects/{projectId}/datasets` | 200 | Có | **200** |
| GET | `/api/v1/datasets/{id}` | 200 | Có | **200** |
| DELETE | `/api/v1/datasets/{id}` | 204 | Có; chưa xóa dataset QA | — |
| GET | `/api/v1/datasets/{id}/file` | 200 | Có | **200** |
| GET | `/api/v1/datasets/{id}/schema` | 200 | Có | **200** |
| GET | `/api/v1/datasets/{datasetId}/records` | 200 | Có | **200** |
| POST | `/api/v1/datasets/{datasetId}/records/query` | 200 | Có | **200**; truy vấn theo `Customer ID` với `Ohio` trả rỗng đúng phạm vi cột đã chọn |
| GET | `/api/v1/datasets/{datasetId}/columns/{columnKey}/stats` | 200 | Có | **200** |
| GET | `/api/v1/datasets/{datasetId}/charts` | 200 | **Không có caller** | **200** khi gọi trực tiếp read-only; chưa nối vào UI |

### Analysis, Summary và Report

| Method | Endpoint | Swagger | Frontend | Live 22/11 |
|---|---|---:|---|---:|
| POST | `/api/v1/projects/{projectId}/analysis` | 201 | Có | **201** trên Project QA; tạo analysis run và AI job |
| GET | `/api/v1/projects/{projectId}/analysis/result` | 200 | Có | **200** |
| GET | `/api/v1/analysis/jobs/{jobId}` | 200 | Có | **200**, job `pending` lúc kiểm tra |
| POST | `/api/v1/analysis/jobs/{jobId}/retry` | 202 | Có service; chưa chạy retry | — |
| POST | `/api/v1/analysis/jobs/{jobId}/result` | 200 | **Không có runtime caller**; chỉ có generated types | — |
| POST | `/api/v1/projects/{projectId}/summary` | 201 | Có | **201** trên Project QA |
| GET | `/api/v1/projects/{projectId}/summary` | 200 | Có | **404** trước khi có summary; **200** sau khi tạo |
| POST | `/api/v1/projects/{projectId}/report` | 202 | Có | **202**, worker nhận yêu cầu |
| GET | `/api/v1/projects/{projectId}/report/{reportId}/file` | 200, 202 | Có | **202**, PDF chưa sẵn sàng |

### Notifications và Issues

| Method | Endpoint | Swagger | Frontend | Live 22/11 |
|---|---|---:|---|---:|
| GET | `/api/v1/notifications` | 200 | Có | **200** |
| GET | `/api/v1/notifications/unread-count` | 200 | Có | **200** |
| GET | `/api/v1/notifications/{id}` | 200 | Có | **404** với ID không tồn tại |
| PATCH | `/api/v1/notifications/{id}/read` | 200 | Có | — |
| PATCH | `/api/v1/users/me/notification-preferences` | 200 | Có | — |
| POST | `/api/v1/issues` | 201 | Có | — |
| GET | `/api/v1/issues` | 200 | Có | **200** |
| POST | `/api/v1/issues/{id}/attachments` | 201 | Có | — |
| GET | `/api/v1/issues/{id}/attachments/{attachmentId}` | 200 | Có | — |
| GET | `/api/v1/issues/{id}` | 200 | Có | **404** với ID không tồn tại |
| PATCH | `/api/v1/issues/{id}` | 200 | Có | — |
| GET | `/api/v1/admin/issues` | 200 | Có | **200** |
| GET | `/api/v1/admin/issues/{id}` | 200 | Có | **404** với ID không tồn tại |
| PATCH | `/api/v1/admin/issues/{id}/status` | 200 | Có | — |

### Feedback và Overview

| Method | Endpoint | Swagger | Frontend | Live 22/11 |
|---|---|---:|---|---:|
| POST | `/api/v1/analyses/{analysisId}/findings/{findingId}/feedback` | 201 | Có | **403**; role System Admin không có quyền feedback |
| GET | `/api/v1/analyses/{analysisId}/findings/{findingId}/feedback` | 200 | Có | **403**; role System Admin không có quyền feedback |
| POST | `/api/v1/analyses/{analysisId}/feedback` | 201 | Có | **403**; role System Admin không có quyền feedback |
| GET | `/api/v1/analyses/{analysisId}/feedback` | 200 | Có | **403**; role System Admin không có quyền feedback |
| PATCH | `/api/v1/feedback/{id}` | 200 | Có | **404** với feedback ID QA không tồn tại |
| DELETE | `/api/v1/feedback/{id}` | 200 | Có | **404** với feedback ID QA không tồn tại |
| GET | `/api/v1/projects/{projectId}/ai-quality-metrics` | 200 | Có | **403**; role System Admin không có quyền feedback |
| GET | `/api/v1/overview/workspaces` | 200 | Có | **200** |
| GET | `/api/v1/workspaces/{id}/overview` | 200, 404 | Có | **200** |

## API có caller trong source nhưng deployment không cung cấp

| Method | Endpoint | Frontend | Live 22/11 | Kết luận |
|---|---|---|---:|---|
| GET | `/api/v1/projects/{projectId}/analysis/config` | Có | **404** | Có trong source backend và `api-specification.md`, không có trong Swagger deployment |
| POST | `/api/v1/projects/{projectId}/analysis/config` | Có | **404** | Có trong source backend và `api-specification.md`, không có trong Swagger deployment |
| PATCH | `/api/v1/datasets/{id}/columns/pii` | Có | **404** | Có trong source backend, không có trong Swagger deployment |

Frontend hiện xử lý hai loại lệch trên: analysis vẫn tải schema, khóa phần lưu cấu hình không được deployment hỗ trợ, và chỉ gửi các field được schema live cho phép khi chạy. PII action bị ẩn sau `404`, không lặp request. `GET /datasets/{datasetId}/charts` ngược lại chỉ có trong Swagger deployment; chưa có source route ở branch, API spec hay client caller.

## Tổng kết trạng thái

- **Đã nối và có status live thành công:** login/logout, profile read, workspaces/projects/datasets read, members, overview, Data View, stats/file, notifications/issues list, admin reads, sessions, analysis run/result/job, summary và report request/poll. Status cụ thể nằm trong inventory trên.
- **Có caller nhưng chưa xác nhận live trong lượt này:** các mutation tài khoản/workspace/project/member/dataset/notification/issue/session, auth refresh/register/password reset, Google OAuth callback, AI retry/ingest. `—` không có nghĩa là API hỏng; chưa phát request.
- **Có caller nhưng thất bại với quyền test hiện tại:** nhóm feedback và AI-quality metrics trả `403` cho System Admin.
- **Lệch contract deployment:** hai analysis-config route và PII patch trả `404`; frontend đã giảm lỗi dây chuyền cho các luồng này.
- **Có trên deployment nhưng chưa nối frontend:** charts endpoint trả `200` khi gọi trực tiếp, nhưng chưa có client caller.
- **Không thuộc 84 live operations:** các route đổi tên dataset/cột/reset cột đã bị gỡ khỏi source/live Swagger; không ghi như API hiện hành.

## Dữ liệu kiểm thử và giới hạn

Đã dùng dataset QA sẵn có, không tạo dataset mới. Lượt test có tạo một analysis run, một summary và một yêu cầu report trên Project QA; report còn `pending`. Deployment không có endpoint xóa tương ứng cho các tài nguyên này, nên chúng vẫn là dữ liệu QA. Không xóa account/workspace/project/dataset, không sửa profile/password, không thay đổi preference, không thu hồi session thật, không gửi email/OTP, không chuyển owner và không retry job.

`GET /health` và `GET /health/ready` hiện trả `200`; Swagger JSON hiện trả `200`. Điều đó xác nhận tunnel phản hồi tại lần kiểm tra cuối, không chứng minh tình trạng ở thời điểm khác. `api-specification.md` là tài liệu source/contract cũ hơn; inventory hiện hành trong báo cáo này lấy từ Swagger deployment ngày 22/11/2026.# Trạng thái nối API Backend - Frontend/UI

## Kiểm thử tunnel mới ngày 22/11/2026

Backend được kiểm tra: `https://devoted-suites-jefferson-closest.trycloudflare.com/api/v1`; Swagger UI và `/api/v1/docs-json` trả `200`, OpenAPI công bố 84 operations. UI chạy tạm tại `http://127.0.0.1:5210` với API origin truyền qua environment của terminal, không sửa `.env`. Đăng nhập bằng tài khoản admin test qua form trả `200`; đăng xuất phiên QA trả `200` và phiên local đã được dọn.

### Nhánh backend

Sau `git fetch origin backend`, `origin/backend` ở `10aea5a` là tổ tiên của `HEAD` (`2a7f839`). `git log HEAD..FETCH_HEAD` rỗng, không có commit backend mới cần merge; thay đổi backend hiện có đã nằm trong lịch sử `TaiFE`. Không sửa hoặc commit thư mục yêu cầu riêng tư.

### Status Network/UI mới

Các status dưới đây là HTTP response thật từ browser; các nhóm nhiều ID lặp lại đã được gom. Dataset kiểm thử có sẵn `shopping_trends_corrupted_10pct.csv` trong Project QA, 3.900 dòng/18 cột; không tạo dataset mới.

| API hoặc nhóm | Status | Bằng chứng |
| --- | ---: | --- |
| Swagger JSON, `GET /health`, `GET /health/ready` | `200` | Tải OpenAPI và gọi health qua browser |
| `POST /api/v1/auth/login`, `POST /api/v1/auth/logout` | `200` | Form login UI; logout phiên test trên browser |
| `GET /api/v1/users/me`, `GET /api/v1/workspaces`, `GET /api/v1/projects` | `200` | Bootstrap UI sau đăng nhập |
| `GET /api/v1/workspaces/{id}`, `/members`, `/overview`, `GET /api/v1/overview/workspaces` | `200` | Workspace QA và overview dùng dữ liệu backend |
| `GET /api/v1/projects/{id}`, `/members`, `/datasets` | `200` | Mở Project QA và tải dữ liệu liên quan |
| `GET /api/v1/datasets/{id}`, `/schema`, `/records?limit=50` | `200` | Data View hiển thị schema 18 cột và 50 dòng/trang |
| `POST /api/v1/datasets/{id}/records/query` | `200` | Thao tác tìm kiếm và áp dụng phát request thật; lần tìm `Ohio` khi `Customer ID` được chọn trả danh sách rỗng. Kết quả sau khi đổi sang `Location` chưa được xác nhận trong browser |
| `GET /api/v1/datasets/{id}/columns/c0/stats`, `GET /api/v1/datasets/{id}/file` | `200` | Thống kê cột và tải CSV gốc từ UI |
| `GET /api/v1/notifications`, `/unread-count`, `GET /api/v1/issues` | `200` | Bootstrap UI |
| `GET /api/v1/admin/users`, `/admin/users/{id}`, `/admin/issues` | `200` | Đọc danh sách admin và hồ sơ QA |
| `GET /api/v1/auth/sessions`, `/sessions/me`, `/sessions/{id}` | `200` | Settings → Đăng nhập & phiên và kiểm tra session hiện tại |
| `POST /api/v1/projects/{id}/analysis` | `201` | Chạy phân tích trên dataset QA; xử lý xong 3.900 dòng, tạo analysis run và AI job |
| `GET /api/v1/projects/{id}/analysis/result`, `GET /api/v1/analysis/jobs/{jobId}` | `200` | Đọc kết quả và job vừa tạo; job ở trạng thái `pending` |
| `GET /api/v1/projects/{id}/summary` trước khi có summary | `404` | Chưa có summary trước lần tạo đầu |
| `POST /api/v1/projects/{id}/summary`, sau đó `GET` cùng route | `201`, `200` | Tạo và đọc summary trên Project QA |
| `POST /api/v1/projects/{id}/report`, `GET /report/{reportId}/file` | `202`, `202` | Worker nhận yêu cầu; PDF chưa sẵn sàng tại thời điểm poll |
| `GET /api/v1/analyses/{analysisId}/feedback`, feedback finding, hai lệnh tạo feedback, `GET .../ai-quality-metrics` | `403` | Account System Admin không có quyền nhóm feedback theo lỗi trả về backend |
| `PATCH /api/v1/feedback/{id}`, `DELETE /api/v1/feedback/{id}` với ID QA không tồn tại | `404` | Không tìm thấy feedback; không tạo hoặc sửa dữ liệu |
| `GET /api/v1/datasets/{datasetId}/charts` | `200` | Route có trong Swagger deployment; gọi read-only với giới hạn rows/top N |
| `GET` detail notification/issue/session với ID giả | `404` | Kiểm tra phản hồi khi tài nguyên không tồn tại |

### Lệch Swagger, source và client

1. Swagger deployment **không công bố** `GET/POST /api/v1/projects/{projectId}/analysis/config`; cả hai request trên Project QA trả `404`. Ngược lại, source backend hiện tại và `api-specification.md` khai báo hai route này. Live run-analysis chỉ công bố `correlation_method`, `outlier_method`, `top_n` và `additionalProperties: false`, không có `selected_columns`. Frontend đã được sửa để nếu config GET trả `404` thì vẫn nạp schema, khóa chức năng lưu/chọn cấu hình không có trên deployment, và không gửi `selected_columns`; chạy phân tích với các field Swagger hỗ trợ vẫn trả `201`.
2. `PATCH /api/v1/datasets/{id}/columns/pii` có trong source backend nhưng không có trong Swagger mới; UI gọi thử trên dataset QA nhận `404` và dữ liệu không đổi. Frontend hiện ẩn thao tác sau `404` để tránh lặp request.
3. Swagger deployment có `GET /api/v1/datasets/{datasetId}/charts` và trả `200`, nhưng route này không có trong source backend đang merge, `api-specification.md` hay service/caller frontend. Ghi nhận đây là endpoint riêng của deployment; chưa thêm client caller khi chưa có contract trong branch/spec.
4. `api-specification.md` mô tả 82 operations, trong khi Swagger mới công bố 84. Cần đồng bộ tài liệu/source với backend deployment; không thể khắc phục sai khác route server bằng đổi URL phía client.

### Giới hạn và dữ liệu

Đã tạo một analysis run, một summary và một yêu cầu PDF trên Project QA; report còn `pending`. Các thao tác này không có route xóa riêng và được giữ như dữ liệu kiểm thử trong project QA. Không xóa dataset/project/workspace, không đổi hồ sơ hoặc mật khẩu, không thu hồi session thật, không đăng ký/xóa account, không kích hoạt OTP/email, không chuyển/rời owner và không retry AI job đang pending. Các endpoint mutation không có tài nguyên test phù hợp và hành động nội bộ AI chưa được chạy. Vì vậy status của chúng không được suy đoán từ OpenAPI; các `200` ở phần lịch sử bên dưới vẫn là chứng cứ từ những lần kiểm thử trước, không phải lần chạy ngày 22/11.

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
