# 04. YÊU CẦU CHỨC NĂNG (FUNCTIONAL REQUIREMENTS)

**Nguồn chính:** [feature_spec_v4](../feature_spec_v4.md)
**Quy ước:** `FR-<m>.<n>` ánh xạ 1-1 với chức năng `F<m>.<n>` trong [03_chuc-nang](03_chuc-nang.md). Ưu tiên **B** = Bắt buộc, **Đ** = Đề xuất thêm. Tiêu chí chấp nhận (AC) viết sao cho kiểm thử được. `[GIẢ ĐỊNH]` = tiêu chí do nhóm bổ sung, spec không ghi rõ.

---

## FR chung (áp dụng mọi module)

| ID | Yêu cầu | Tiêu chí chấp nhận |
|---|---|---|
| FR-0.1 | Mọi API (trừ nhóm công khai F1.1–F1.6) phải yêu cầu header `Authorization: Bearer <accessToken>` hợp lệ | Thiếu, sai hoặc hết hạn token → `401` |
| FR-0.2 | Người dùng chỉ thao tác trên Workspace/Project/Dataset mình sở hữu; Admin được thao tác trên mọi tài nguyên | Truy cập tài nguyên của người khác → `403` (hoặc `404` nếu tài nguyên không tồn tại/đã xóa) |
| FR-0.3 | Dữ liệu đầu vào được kiểm tra theo schema trước khi xử lý | Sai định dạng → `400` kèm mô tả trường lỗi |
| FR-0.4 | Xóa tài nguyên là xóa mềm (`deleted_at = now()`); tài nguyên đã xóa mềm không xuất hiện trong danh sách/chi tiết | Không có bản ghi nào bị xóa vật lý khi gọi API xóa |
| FR-0.5 | Mọi phản hồi theo một cấu trúc thống nhất; lỗi trả mã HTTP đúng ngữ nghĩa và thông điệp tiếng Việt dễ hiểu | Không trả stack trace hay thông tin nội bộ cho client |

## M1. Xác thực & phân quyền

| ID | Ưu tiên | Yêu cầu (Hệ thống phải …) | Tiêu chí chấp nhận |
|---|:---:|---|---|
| FR-1.1 | B | Cho phép Guest đăng ký bằng `email`, `password`, `fullName` | AC1: email được trim + chuyển chữ thường. AC2: mật khẩu 8–64 ký tự, có ≥ 1 chữ hoa, 1 chữ thường, 1 chữ số, 1 ký tự đặc biệt; `fullName` 2–100 ký tự. AC3: email đã tồn tại → `409`. AC4: thành công → `201`, vai trò `DATA_ANALYST`, trạng thái `ACTIVE`, không trả hash mật khẩu |
| FR-1.2 | B | Cho phép đăng nhập bằng email và mật khẩu | AC1: sai email hoặc mật khẩu → `401` với cùng thông báo "Email hoặc mật khẩu không chính xác". AC2: tài khoản bị khóa → `403`. AC3: thành công → tạo phiên (lưu SHA-256 của refresh token, IP, user agent, hạn) và trả `accessToken` (15 phút), `refreshToken` (7 ngày), `sessionId`, `user` |
| FR-1.3 | B | Cho phép đăng nhập bằng Google ID token | AC1: token không hợp lệ → `401`. AC2: `email_verified ≠ true` → `400`. AC3: email chưa có → tự tạo tài khoản `DATA_ANALYST` không mật khẩu. AC4: email đã có → cập nhật `googleId`, `avatarUrl`; tài khoản bị khóa → `403`. AC5: thành công trả như FR-1.2 kèm `avatarUrl` |
| FR-1.4 | B | Cho phép yêu cầu đặt lại mật khẩu qua email | AC1: luôn trả `200` cùng một thông báo dù email có tồn tại hay không. AC2: nếu email tồn tại và không bị khóa → sinh token ngẫu nhiên 32 byte, lưu SHA-256 với hạn 15 phút, gửi email chứa liên kết đặt lại |
| FR-1.5 | B | Cho phép đặt lại mật khẩu bằng token khôi phục | AC1: token không tồn tại, hết hạn hoặc đã dùng → `400` "Mã khôi phục không hợp lệ hoặc đã hết hạn". AC2: mật khẩu mới tuân thủ độ phức tạp FR-1.1. AC3: thành công → token đánh dấu đã dùng và **toàn bộ phiên** của tài khoản bị hủy |
| FR-1.6 | B | Cấp access token mới từ refresh token | AC1: refresh token không tồn tại/hết hạn → `401`. AC2: tài khoản bị khóa → xóa phiên, `403`. AC3: thành công → `accessToken` mới, `expiresIn = 900` |
| FR-1.7 | B | Cho phép đăng xuất phiên hiện tại | AC1: không truyền `sessionId` → hủy phiên gắn với access token. AC2: sau đăng xuất, refresh token của phiên đó không dùng được |
| FR-1.8 | B | Cho phép thu hồi một phiên theo `sessionId` | AC1: phiên không tồn tại → `404`. AC2: phiên của người khác (và người gọi không phải Admin) → `403`. AC3: sau thu hồi, thiết bị dùng phiên đó gọi API → `401` |
| FR-1.9 | B | Trả vai trò và danh sách mã quyền của tài khoản hiện tại | AC1: trả `role`, `permissions[]`, `isAdmin`. AC2: quyền đọc từ CSDL tại thời điểm gọi (không lấy từ cache token) |
| FR-1.10 | Đ | Liệt kê các phiên đang hoạt động của tài khoản | AC: mỗi phiên có `sessionId`, `ipAddress`, `userAgent`, `isCurrentSession`, `createdAt`, `lastActiveAt` |

## M2. Quản lý người dùng

| ID | Ưu tiên | Yêu cầu (Hệ thống phải …) | Tiêu chí chấp nhận |
|---|:---:|---|---|
| FR-2.1 | B | Trả hồ sơ người dùng đang đăng nhập | AC: trả `id`, `email`, `fullName`, `role`, `avatarUrl`, `isBlocked`, `createdAt`; không trả hash mật khẩu |
| FR-2.2 | B | Cho phép cập nhật `fullName` (2–100 ký tự) và `avatarUrl` (URL hợp lệ) | AC1: gửi `email` hoặc `role` không làm thay đổi hai trường này. AC2: trả `updatedAt` mới |
| FR-2.3 | B | Cho phép đổi mật khẩu khi biết mật khẩu hiện tại | AC1: sai mật khẩu hiện tại → `400` "Mật khẩu hiện tại không đúng". AC2: mật khẩu mới trùng mật khẩu cũ → `400`. AC3: mật khẩu mới tuân thủ độ phức tạp |
| FR-2.4 | B | Cho Admin liệt kê người dùng theo phân trang con trỏ | AC1: người gọi không phải Admin → `403`. AC2: `limit` mặc định 20, tối đa 100. AC3: lọc `search` (email/họ tên), `status` (`ACTIVE`/`BLOCKED`). AC4: sắp xếp `createdAt` giảm dần, không dùng `skip`; trả `pageInfo.hasNextPage`, `nextCursor` |
| FR-2.5 | B | Cho Admin xem chi tiết một người dùng | AC1: không tìm thấy → `404`. AC2: trả kèm `workspaceCount` |
| FR-2.6 | B | Cho Admin khóa tài khoản | AC1: Admin tự khóa mình → `400`. AC2: thành công → `isBlocked = true` và **mọi phiên** của tài khoản bị hủy ngay |
| FR-2.7 | B | Cho Admin mở khóa tài khoản | AC: `isBlocked = false`; người dùng đăng nhập lại được |

## M3. Workspace

| ID | Ưu tiên | Yêu cầu (Hệ thống phải …) | Tiêu chí chấp nhận |
|---|:---:|---|---|
| FR-3.1 | B | Cho phép tạo Workspace với `name` (3–100 ký tự), `description` (≤ 500 ký tự) | AC1: trùng tên với Workspace chưa xóa của chính mình → `409`. AC2: `ownerId` lấy từ token. AC3: trả `201`, `projectCount = 0` |
| FR-3.2 | B | Liệt kê Workspace của người dùng | AC1: chỉ Workspace có `ownerId = userId` và chưa xóa. AC2: `page` mặc định 1, `limit` mặc định 10, `search` theo tên. AC3: mỗi phần tử có `projectCount`; trả `pagination { page, limit, totalItems, totalPages }` |
| FR-3.3 | B | Trả chi tiết Workspace kèm danh sách Project chưa xóa | AC1: không tồn tại hoặc đã xóa → `404`. AC2: không phải chủ sở hữu/Admin → `403`. AC3: mỗi Project có `projectId`, `name`, `hasDataset`, `updatedAt` |
| FR-3.4 | B | Cho chủ sở hữu/Admin sửa `name`, `description` | AC: ràng buộc độ dài như FR-3.1; trả `updatedAt` mới |
| FR-3.5 | B | Xóa mềm Workspace theo dây chuyền | AC1: Workspace ghi `deleted_at`, `deletedBy`. AC2: mọi Project và Dataset con được ghi `deleted_at`. AC3: không xóa vật lý |
| FR-3.6 | Đ | Khôi phục Workspace đã xóa mềm | AC1: `deleted_at = null` cho Workspace và các Project con. AC2 (đã chốt): Dataset **không** được khôi phục. AC3 (đã chốt): chủ sở hữu đã có Workspace chưa xóa cùng tên → `409`, không tự đổi tên |

## M4. Project

| ID | Ưu tiên | Yêu cầu (Hệ thống phải …) | Tiêu chí chấp nhận |
|---|:---:|---|---|
| FR-4.1 | B | Cho phép tạo Project trong Workspace mình sở hữu | AC1: Workspace không tồn tại → `404`; không phải chủ sở hữu → `403`. AC2: `name` 3–100 ký tự, trùng tên trong cùng Workspace (chưa xóa) → `409`. AC3: khởi tạo `datasetId = null`, trả `201`, `hasDataset = false` |
| FR-4.2 | B | Liệt kê Project của một Workspace | AC1: chỉ Project chưa xóa; hỗ trợ `page`, `limit`, `search`; mỗi phần tử có `hasDataset`, `datasetId`. AC2 (đã chốt): trả `pagination { page, limit, totalItems, totalPages }` như FR-3.2 |
| FR-4.3 | B | Trả chi tiết Project | AC1: không tồn tại/đã xóa → `404`. AC2: `dataset` là tóm tắt `{ datasetId, name, rowCount, columnCount, currentVersion }` hoặc `null` |
| FR-4.4 | B | Cho phép sửa `name`, `description` của Project | AC: trả `updatedAt` mới |
| FR-4.5 | B | Xóa mềm Project và Dataset trực thuộc | AC: Project và Dataset (nếu có) được ghi `deleted_at` |
| FR-4.6 | Đ | Khôi phục Project đã xóa mềm (theo mẫu FR-3.6) | AC1: `deleted_at = null` cho Project. AC2 `[GIẢ ĐỊNH]`: Workspace cha đang bị xóa → `409`, không cho khôi phục. AC3 (đã chốt): Dataset không được khôi phục; trùng tên Project đang hoạt động → `409`. Nội dung suy ra từ F3.6, xem [02_pham-vi](02_pham-vi.md) |

## M5. Dataset

| ID | Ưu tiên | Yêu cầu (Hệ thống phải …) | Tiêu chí chấp nhận |
|---|:---:|---|---|
| FR-5.1 | B | Cho phép tải tệp `.csv`, `.xlsx`, `.json` vào Project | AC1: Project đã có Dataset chưa xóa → `409` với thông báo yêu cầu xóa Dataset cũ hoặc tạo Project mới. AC2: sai định dạng hoặc vượt dung lượng (CSV/JSON > 50 MB, XLSX > 20 MB) → `400`. AC3: vượt 100 cột hoặc 200.000 dòng → `422`. AC4: JSON lồng nhau được làm phẳng dạng dot-notation tối đa 3 cấp. AC5: tệp được đọc dạng luồng, đồng thời tính `fileChecksum` SHA-256. AC6: thành công → `201`, tạo phiên bản v1 có `version_hash` (MongoDB + Neo4j), cập nhật `project.datasetId`, `hasDataset = true`; trả danh sách cột `{ name, dataType, nullCount, nullRate }` |
| FR-5.2 | B | Trả thông tin Dataset của Project | AC: Project chưa có Dataset hoặc Dataset đã xóa → `404` |
| FR-5.3 | B | Xóa mềm Dataset của Project | AC1: Dataset ghi `deleted_at`. AC2: `project.datasetId = null`, `hasDataset = false`. AC3: sau đó tải tệp mới vào Project thành công |

## M6. Trực quan hóa

| ID | Ưu tiên | Yêu cầu (Hệ thống phải …) | Tiêu chí chấp nhận |
|---|:---:|---|---|
| FR-6.1 | B | Truy vấn dữ liệu bảng của Dataset theo phiên bản | AC1: `version` mặc định là phiên bản hiện hành. AC2: `page ≥ 1`, `pageSize` 10–200, ngoài khoảng → `400`. AC3: hỗ trợ `sortBy` + `sortDirection` (`asc`/`desc`), `searchKeyword` toàn cục, `filters[] { column, operator, value }`. AC4: trả `page`, `pageSize`, `totalMatchingRows`, `totalPages`, `rows[]` có `_rowId`. AC5: Dataset không tồn tại/đã xóa → `404` |
| FR-6.2 | B | Trả thống kê mô tả của một cột | AC1: cột số → `nullCount`, `nullRate`, `uniqueCount`, `statistics { min, max, mean, median, stdDev }`, `histogram[] { binRange, frequency }`. AC2: cột chuỗi → `nullCount`, `uniqueCount`, `topCategories[] { value, count, percentage }`. AC3 `[GIẢ ĐỊNH]`: cột không tồn tại → `404` |

## M7. Biến đổi dữ liệu

| ID | Ưu tiên | Yêu cầu (Hệ thống phải …) | Tiêu chí chấp nhận |
|---|:---:|---|---|
| FR-7.1 | B | Thực thi một phép làm sạch trên Dataset | AC1: `actionType` ∈ {`DROP_NULL_ROWS`, `IMPUTE_VALUE`, `SANITIZE_STRING`, `REPLACE_REGEX`, `DROP_COLUMN`, `RENAME_COLUMN`}, khác → `400`. AC2: `currentVersion` ≠ phiên bản hiện hành trong CSDL → `409` (khóa lạc quan). AC3: thành công → ghi dữ liệu, tạo phiên bản mới lưu công thức biến đổi, thêm cạnh lineage `(v_old)-[:TRANSFORMED_BY]->(v_new)`, tăng `currentVersion`. AC4: trả `previousVersion`, `newVersion`, `actionExecuted`, `rowsAffected`, `newRowCount` |
| FR-7.2 | Đ | Chạy thử phép làm sạch trên mẫu mà không ghi dữ liệu | AC1: input giống FR-7.1. AC2: trả `sampleBefore` (10 dòng), `sampleAfter` (10 dòng), `estimatedRowsAffected`. AC3: sau khi gọi, `currentVersion` và dữ liệu không đổi |

## M8. Phiên bản & nguồn gốc

| ID | Ưu tiên | Yêu cầu (Hệ thống phải …) | Tiêu chí chấp nhận |
|---|:---:|---|---|
| FR-8.1 | B | Trả lịch sử phiên bản của Dataset | AC: trả `currentVersion` và `history[] { versionId, versionNumber, versionHash, parentHash, actionType, targetColumn, rowsAffected, rowCount, createdAt }` |
| FR-8.2 | B | Rollback về một phiên bản cũ | AC1: `targetVersionNumber` phải thỏa 1 ≤ target < `currentVersion` và tồn tại; ngược lại `[GIẢ ĐỊNH]` → `400` (ngoài khoảng) hoặc `404` (không tồn tại). AC2: thành công → `currentVersion = targetVersionNumber`; truy vấn Data Grid sau đó trả dữ liệu của phiên bản đích |
| FR-8.3 | Đ | Trả đồ thị lineage của Dataset | AC: `nodes[] { id, version, label, rowCount, versionHash }`, `edges[] { source, target, action }` |
| FR-8.4 | Đ | Kiểm tra toàn vẹn chuỗi phiên bản | AC1: tính lại `SHA256(parent_hash + version_number + operations_json + data_checksum)` cho v1 → `currentVersion`, so với `version_hash` đã lưu. AC2: tất cả khớp → `isChainValid = true`, `brokenVersion = null`. AC3: có phiên bản lệch → `isChainValid = false`, `brokenVersion` = phiên bản đầu tiên lệch |

> Công thức băm theo spec F8.4. Báo cáo 05 và README ghi công thức 3 thành phần `SHA-256(parent_hash + rules_hash + data_checksum)`. Theo nguyên tắc spec là chuẩn, FR dùng công thức của spec.

## M9. Xuất bản

| ID | Ưu tiên | Yêu cầu (Hệ thống phải …) | Tiêu chí chấp nhận |
|---|:---:|---|---|
| FR-9.1 | B | Cho phép tải dữ liệu một phiên bản về máy | AC1: `format` ∈ {`csv`, `xlsx`, `json`}. AC2: CSV mã hóa UTF-8 có BOM. AC3: `encrypt = true` mà thiếu `password` hoặc `password` < 8 ký tự → `400`. AC4: tên tệp `{dataset_name}_v{version}.{format}` (thêm `.enc` nếu mã hóa); tệp mã hóa trả `application/octet-stream`. AC5: đọc dữ liệu dạng luồng theo lô 1.000 dòng, mã hóa AES-256-GCM trực tiếp trên luồng |
| FR-9.2 | B | Lưu một phiên bản thành Dataset mới trong Project đích | AC1: `newDatasetName` 3–100 ký tự, `targetProjectId` bắt buộc. AC2: không có quyền đọc Dataset nguồn hoặc quyền ghi Project đích → `403`. AC3: Project đích đã có Dataset → `409`. AC4: thành công → `201`, Dataset mới có `currentVersion = 1`, Project đích `hasDataset = true` |
| FR-9.3 | Đ | Xem trước dữ liệu trước khi xuất | AC: `limit` mặc định 20, tối đa 50; trả `totalRows`, `previewRows[]` |

## FR phía giao diện

| ID | Yêu cầu | Tiêu chí chấp nhận |
|---|---|---|
| FR-FE.1 | Chặn truy cập trang riêng tư khi chưa đăng nhập, đưa về trang đăng nhập rồi quay lại trang đích | Mở URL riêng tư khi chưa đăng nhập → chuyển sang đăng nhập; đăng nhập xong → về đúng URL ban đầu |
| FR-FE.2 | Chỉ gia hạn phiên khi người dùng đồng ý | Hộp thoại "Tiếp tục phiên / Hủy"; Escape hoặc chờ hết hạn = Hủy; bấm nền không đóng hộp thoại |
| FR-FE.3 | Khi đăng xuất/kết thúc phiên: xóa token, thông tin người dùng, cache dữ liệu; bản nháp chưa gửi được giữ nhưng bị khóa | Đăng nhập tài khoản khác không thấy bản nháp của tài khoản trước |
| FR-FE.4 | Lưu bản nháp tải lên vào IndexedDB theo tài khoản | Vượt 50 MiB/tệp, 200 MiB/tài khoản hoặc 500 MiB/ứng dụng → từ chối lưu kèm thông báo |
| FR-FE.5 | Ẩn/hiện chức năng quản trị theo kết quả FR-1.9 | Data Analyst không thấy menu quản lý người dùng |
