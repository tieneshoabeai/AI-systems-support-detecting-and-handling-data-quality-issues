# 08. MA TRẬN TRUY VẾT (TRACEABILITY MATRIX)

**Mục đích:** chứng minh mỗi chức năng có yêu cầu, mỗi yêu cầu được hiện thực bởi ít nhất một API hoặc luồng, và mỗi API phục vụ ít nhất một yêu cầu.
**Nguồn:** [03_chuc-nang](03_chuc-nang.md), [04_yeu-cau-chuc-nang](04_yeu-cau-chuc-nang.md), [05_yeu-cau-phi-chuc-nang](05_yeu-cau-phi-chuc-nang.md), [06_luong-nghiep-vu](06_luong-nghiep-vu.md), [07_api](07_api/00_quy-uoc-chung.md).

---

## 8.1. Chức năng ↔ FR ↔ API ↔ Luồng ↔ NFR

Ưu tiên: **B** = Bắt buộc, **Đ** = Đề xuất thêm.

| Chức năng | FR | Ưu tiên | API | Endpoint | Use case | Luồng tổng thể | NFR liên quan |
|---|---|:---:|---|---|---|---|---|
| F1.1 Đăng ký | FR-1.1 | B | [API-01](07_api/01_auth.md#api-01-đăng-ký-bằng-email-f11) | `POST /auth/register` | UC-1.1 | — | SEC-01, SEC-13 |
| F1.2 Đăng nhập email | FR-1.2 | B | [API-02](07_api/01_auth.md#api-02-đăng-nhập-bằng-email-f12) | `POST /auth/login` | UC-1.2 | BF-2 | SEC-02, SEC-04, SEC-13 |
| F1.3 Đăng nhập Google | FR-1.3 | B | [API-03](07_api/01_auth.md#api-03-đăng-nhập-bằng-google-f13) | `POST /auth/google` | UC-1.3 | BF-2 | SEC-02 |
| F1.4 Quên mật khẩu | FR-1.4 | B | [API-04](07_api/01_auth.md#api-04-quên-mật-khẩu-f14) | `POST /auth/forgot-password` | UC-1.4 | BF-3 | SEC-03, SEC-04, SEC-13 |
| F1.5 Đặt lại mật khẩu | FR-1.5 | B | [API-05](07_api/01_auth.md#api-05-đặt-lại-mật-khẩu-f15) | `POST /auth/reset-password` | UC-1.5 | BF-3 | SEC-03, SEC-07 |
| F1.6 Làm mới token | FR-1.6 | B | [API-06](07_api/01_auth.md#api-06-làm-mới-access-token-f16) | `POST /auth/refresh-token` | UC-1.6 | BF-2 | SEC-02 |
| F1.7 Đăng xuất | FR-1.7 | B | [API-07](07_api/01_auth.md#api-07-đăng-xuất-f17) | `POST /auth/logout` | UC-1.7 | BF-2 | SEC-02 |
| F1.8 Thu hồi phiên | FR-1.8 | B | [API-08](07_api/01_auth.md#api-08-thu-hồi-phiên-từ-xa-f18) | `DELETE /auth/sessions/:sessionId` | UC-1.8 | BF-2 | SEC-07 |
| F1.9 Lấy quyền | FR-1.9 | B | [API-09](07_api/01_auth.md#api-09-lấy-quyền-hiện-tại-f19) | `GET /auth/permissions` | UC-1.9 | BF-2, BF-4 | SEC-05 |
| F1.10 Danh sách phiên | FR-1.10 | Đ | [API-10](07_api/01_auth.md#api-10-danh-sách-phiên-đang-hoạt-động-f110) | `GET /auth/sessions` | UC-1.10 | — | USA-05 |
| F2.1 Xem hồ sơ | FR-2.1 | B | [API-11](07_api/02_users.md#api-11-lấy-hồ-sơ-hiện-tại-f21) | `GET /users/me` | UC-2.1 | BF-2 | SEC-01 |
| F2.2 Cập nhật hồ sơ | FR-2.2 | B | [API-12](07_api/02_users.md#api-12-cập-nhật-hồ-sơ-f22) | `PATCH /users/me` | UC-2.2 | — | SEC-05 |
| F2.3 Đổi mật khẩu | FR-2.3 | B | [API-13](07_api/02_users.md#api-13-đổi-mật-khẩu-f23) | `POST /users/me/change-password` | UC-2.3 | — | SEC-01 |
| F2.4 Danh sách người dùng | FR-2.4 | B | [API-14](07_api/02_users.md#api-14-danh-sách-người-dùng--phân-trang-con-trỏ-f24) | `GET /users` | UC-2.4 | BF-4 | PERF-05, SEC-05 |
| F2.5 Chi tiết người dùng | FR-2.5 | B | [API-15](07_api/02_users.md#api-15-chi-tiết-người-dùng-theo-id-f25) | `GET /users/:userId` | UC-2.5 | BF-4 | SEC-05 |
| F2.6 Khóa tài khoản | FR-2.6 | B | [API-16](07_api/02_users.md#api-16-khóa-tài-khoản-f26) | `PATCH /users/:userId/block` | UC-2.6 | BF-4 | SEC-07 |
| F2.7 Mở khóa tài khoản | FR-2.7 | B | [API-17](07_api/02_users.md#api-17-mở-khóa-tài-khoản-f27) | `PATCH /users/:userId/unblock` | UC-2.7 | BF-4 | — |
| F3.1 Tạo Workspace | FR-3.1 | B | [API-18](07_api/03_workspaces.md#api-18-tạo-workspace-f31) | `POST /workspaces` | UC-3.1 | BF-1 | REL-05 |
| F3.2 Danh sách Workspace | FR-3.2 | B | [API-19](07_api/03_workspaces.md#api-19-danh-sách-workspace-f32) | `GET /workspaces` | UC-3.2 | BF-1 | SEC-05 |
| F3.3 Chi tiết Workspace | FR-3.3 | B | [API-20](07_api/03_workspaces.md#api-20-chi-tiết-workspace-f33) | `GET /workspaces/:workspaceId` | UC-3.3 | BF-1 | SEC-05 |
| F3.4 Cập nhật Workspace | FR-3.4 | B | [API-21](07_api/03_workspaces.md#api-21-cập-nhật-workspace-f34) | `PATCH /workspaces/:workspaceId` | UC-3.4 | — | SEC-05 |
| F3.5 Xóa mềm Workspace | FR-3.5 | B | [API-22](07_api/03_workspaces.md#api-22-xóa-mềm-workspace-f35) | `DELETE /workspaces/:workspaceId` | UC-3.5 | BF-5 | REL-05 |
| F3.6 Khôi phục Workspace | FR-3.6 | Đ | [API-23](07_api/03_workspaces.md#api-23-khôi-phục-workspace-f36) | `POST /workspaces/:workspaceId/restore` | UC-3.6 | BF-5 | REL-05 |
| F4.1 Tạo Project | FR-4.1 | B | [API-24](07_api/04_projects.md#api-24-tạo-project-f41) | `POST /workspaces/:workspaceId/projects` | UC-4.1 | BF-1 | REL-05 |
| F4.2 Danh sách Project | FR-4.2 | B | [API-25](07_api/04_projects.md#api-25-danh-sách-project-trong-workspace-f42) | `GET /workspaces/:workspaceId/projects` | UC-4.2 | BF-1 | SEC-05 |
| F4.3 Chi tiết Project | FR-4.3 | B | [API-26](07_api/04_projects.md#api-26-chi-tiết-project-f43) | `GET /projects/:projectId` | UC-4.3 | BF-1 | SEC-05 |
| F4.4 Cập nhật Project | FR-4.4 | B | [API-27](07_api/04_projects.md#api-27-cập-nhật-project-f44) | `PATCH /projects/:projectId` | UC-4.4 | — | SEC-05 |
| F4.5 Xóa mềm Project | FR-4.5 | B | [API-28](07_api/04_projects.md#api-28-xóa-mềm-project-f45) | `DELETE /projects/:projectId` | UC-4.5 | BF-5 | REL-05 |
| F4.6 Khôi phục Project | FR-4.6 | Đ | [API-29](07_api/04_projects.md#api-29-khôi-phục-project-f46) | `POST /projects/:projectId/restore` | UC-4.6 | BF-5 | REL-05 |
| F5.1 Upload Dataset | FR-5.1 | B | [API-30](07_api/05_datasets.md#api-30-tải-tệp-dữ-liệu-lên-project-f51) | `POST /projects/:projectId/datasets/upload` | UC-5.1 | BF-1, BF-6 | PERF-02, REL-04, REL-06, COMP-01 |
| F5.2 Xem Dataset | FR-5.2 | B | [API-31](07_api/05_datasets.md#api-31-lấy-thông-tin-dataset-của-project-f52) | `GET /projects/:projectId/dataset` | UC-5.2 | BF-1 | SEC-05 |
| F5.3 Xóa mềm Dataset | FR-5.3 | B | [API-32](07_api/05_datasets.md#api-32-xóa-mềm-dataset-của-project-f53) | `DELETE /projects/:projectId/dataset` | UC-5.3 | BF-5 | REL-05 |
| F6.1 Data Grid | FR-6.1 | B | [API-33](07_api/06_visualization.md#api-33-truy-vấn-data-grid-f61) | `POST /datasets/:datasetId/query` | UC-6.1 | BF-1 | PERF-01, USA-04, SEC-10 |
| F6.2 Thống kê cột | FR-6.2 | B | [API-34](07_api/06_visualization.md#api-34-thống-kê-mô-tả-cột-f62) | `GET /datasets/:datasetId/columns/:columnName/profile` | UC-6.2 | BF-1 | — |
| F7.1 Thực thi biến đổi | FR-7.1 | B | [API-35](07_api/07_transformations.md#api-35-thực-thi-biến-đổi-f71) | `POST /datasets/:datasetId/transformations` | UC-7.1 | BF-1 | PERF-04, REL-01, REL-03, REL-04 |
| F7.2 Chạy thử biến đổi | FR-7.2 | Đ | [API-36](07_api/07_transformations.md#api-36-chạy-thử-biến-đổi-f72) | `POST /datasets/:datasetId/transformations/dry-run` | UC-7.2 | BF-1 | USA-02 |
| F8.1 Lịch sử phiên bản | FR-8.1 | B | [API-37](07_api/08_versions-lineage.md#api-37-lịch-sử-phiên-bản-f81) | `GET /datasets/:datasetId/versions` | UC-8.1 | BF-1 | REL-01 |
| F8.2 Rollback | FR-8.2 | B | [API-38](07_api/08_versions-lineage.md#api-38-rollback-về-phiên-bản-f82) | `POST /datasets/:datasetId/rollback` | UC-8.2 | BF-1 | REL-01 |
| F8.3 Đồ thị lineage | FR-8.3 | Đ | [API-39](07_api/08_versions-lineage.md#api-39-đồ-thị-lineage-f83) | `GET /datasets/:datasetId/lineage` | UC-8.3 | BF-1 | REL-04, SEC-10 |
| F8.4 Kiểm tra toàn vẹn | FR-8.4 | Đ | [API-40](07_api/08_versions-lineage.md#api-40-kiểm-tra-toàn-vẹn-chuỗi-phiên-bản-f84) | `POST /datasets/:datasetId/versions/verify-integrity` | UC-8.4 | BF-1 | REL-01, REL-02 |
| F9.1 Tải tệp | FR-9.1 | B | [API-41](07_api/09_exports.md#api-41-tải-tệp-dữ-liệu-về-máy-f91) | `GET /datasets/:datasetId/export/download` | UC-9.1 | BF-1 | SEC-09, PERF-02, PERF-03, COMP-01 |
| F9.2 Lưu Dataset mới | FR-9.2 | B | [API-42](07_api/09_exports.md#api-42-lưu-thành-dataset-mới-f92) | `POST /datasets/:datasetId/export/save-as-new` | UC-9.2 | BF-1 | REL-01, REL-04 |
| F9.3 Xem trước xuất | FR-9.3 | Đ | [API-43](07_api/09_exports.md#api-43-xem-trước-dữ-liệu-trước-khi-xuất-f93) | `GET /datasets/:datasetId/export/preview` | UC-9.3 | BF-1 | USA-02 |

Mã NFR viết tắt bỏ tiền tố `NFR-` (vd. `SEC-01` = `NFR-SEC-01`).

## 8.2. FR chung và FR giao diện ↔ API / Luồng

| FR | Hiện thực bởi | Luồng | NFR |
|---|---|---|---|
| FR-0.1 Bắt buộc access token | Mọi API trừ API-01 → API-06 ([quy ước chung](07_api/00_quy-uoc-chung.md)) | EC-1, BF-2 | SEC-02, SEC-06 |
| FR-0.2 Cô lập theo chủ sở hữu | *Bước kiểm tra* Workspace / Project / Dataset trong 07_api | EC-2 | SEC-05 |
| FR-0.3 Kiểm tra input theo schema | Mọi API có input (`400`) | EC-3 | MAIN-03 |
| FR-0.4 Xóa mềm | API-22, API-28, API-32 (khôi phục: API-23, API-29) | BF-5 | REL-05 |
| FR-0.5 Cấu trúc phản hồi thống nhất | [Quy ước chung, mục 2](07_api/00_quy-uoc-chung.md#2-cấu-trúc-phản-hồi) | — | USA-01, COMP-02 |
| FR-FE.1 Chặn trang riêng tư | API-11 (xác minh phiên) | BF-2 bước 2 | — |
| FR-FE.2 Gia hạn phiên có đồng ý | API-06 | BF-2 bước 6 | SEC-02 |
| FR-FE.3 Dọn dẹp khi kết thúc phiên | API-07 | BF-2 bước 7, BF-6 E3 | — |
| FR-FE.4 Bản nháp IndexedDB | API-30 | BF-6 | USA-03 |
| FR-FE.5 Ẩn/hiện chức năng quản trị | API-09 | BF-2 bước 4, BF-4 | SEC-05 |

## 8.3. Kiểm tra độ phủ

| Tiêu chí | Kết quả |
|---|---|
| Mỗi chức năng F có đúng 1 FR | 43/43 |
| Mỗi FR module có ≥ 1 API | 43/43 (FR-1.1 → FR-9.3) |
| Mỗi FR chung / FR giao diện có ≥ 1 API hoặc luồng | 10/10 |
| Mỗi API có ≥ 1 FR | 43/43 (API-01 → API-43) |
| Mỗi FR có ≥ 1 use case / luồng | 53/53 |
| API "đề xuất thêm" | 7: API-10, 23, 29, 36, 39, 40, 43 |
| Mục `[CẦN XÁC NHẬN]` còn mở | 0 |

## 8.4. Danh sách giả định còn lại (`[GIẢ ĐỊNH]`)

Các điểm spec không quy định, nhóm đã điền theo hướng hợp lý nhất. Không chặn việc vẽ hình hay nghiệm thu tài liệu, nhưng cần đối chiếu khi cài đặt/kiểm thử.

| Nhóm | Nội dung | Vị trí |
|---|---|---|
| Mã lỗi bổ sung | `404` khi user/phiên bản/cột không tồn tại; `409` khi đổi tên trùng (Workspace, Project); `409` khôi phục Project khi Workspace cha đã xóa; `400`/`404` rollback | 02_users, 03, 04, 06, 08; FR-4.6, FR-6.2, FR-8.2 |
| Nội dung thông báo | Message `409` đăng ký, trùng mật khẩu cũ, khôi phục Project | 01_auth, 02_users, 04_projects |
| Tham số chi tiết | `parameters` của 6 `actionType`; danh sách `operator` lọc; số bin histogram / số top category (10) | 06_visualization, 07_transformations |
| Hành vi hệ thống | Gửi mail lỗi vẫn trả `200`; tệp hỏng → `400`; xóa tệp storage khi rollback upload; cách chọn mẫu dry-run; đánh số phiên bản sau rollback; `503` khi Neo4j lỗi | 01_auth, 05_datasets, 07, 08 |

## 8.5. Quyết định đã chốt trong quá trình viết

| Quyết định | Áp dụng tại |
|---|---|
| Spec `feature_spec_v4` là nguồn chuẩn, gồm cả tính năng đề xuất | Toàn bộ |
| bcrypt salt rounds = 12 | NFR-SEC-01, API-01/05/13 |
| Độ trễ Data Grid < 100 ms | NFR-PERF-01, API-33 |
| Mã vai trò theo spec `ADMIN` / `DATA_ANALYST` (code dùng `admin` / `analyst`) | 01–03, 07_api/02 |
| F4.6 đặc tả theo mẫu F3.6 | FR-4.6, API-29 |
| Rate limit: 5 req/phút/IP nhóm xác thực; 100 req/phút/người dùng; vượt → `429` | NFR-SEC-13, 07_api/00 |
| Không cam kết SLA; ổn định suốt demo; giám sát qua `/health` | NFR-REL-07 |
| Trình duyệt: Chrome, Edge, Firefox 2 bản mới nhất; Safari best-effort | NFR-PORT-01 |
| Khôi phục Workspace/Project **không** khôi phục Dataset | FR-3.6, FR-4.6, BF-5, API-23, API-29 |
| Khôi phục trùng tên bản ghi đang hoạt động → `409`, không tự đổi tên | FR-3.6, FR-4.6, BF-5, API-23, API-29 |
| API-25 trả `pagination` theo mẫu API-19 | FR-4.2, API-25 |
