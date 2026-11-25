# 3. Luồng nghiệp vụ và use case

- **Version:** v1
- **Ngày tạo:** 2026-11-02
- **Cập nhật gần nhất:** 2026-11-04
- **Trạng thái:** Đã đặc tả 31 use case theo 6 nhóm nghiệp vụ, bao gồm 4 use case cho module LEGACY. Mỗi use case có Actor, tiền điều kiện, input, luồng chính, luồng lỗi, hậu điều kiện và quyền thực hiện.
- **Giai đoạn:** Feature
- **Thứ tự thực hiện:** Phần 3; sử dụng kết quả đã xác nhận của phần 1, 2 (v2), 6 (v2), 12 (v2).
- **Quan hệ với các phần khác:** mọi quy tắc nghiệp vụ trong tài liệu này đều truy về `2_feature_catalog_v2.md` và `6_security_authorization_v2.md`; phần này **không** tạo quy tắc mới ngoài các quy tắc đã chốt, chỉ diễn giải chúng thành luồng thực thi.

## 1. Mục tiêu

Làm rõ và thống nhất luồng nghiệp vụ và use case cho đợt tái cấu trúc backend, làm đầu vào trực tiếp cho thiết kế hợp đồng API (phần 7), thiết kế domain/port (phần 5) và schema dữ liệu (phần 8).

## 2. Nội dung cần bàn luận

- Actor, đầu vào, kết quả, tiền điều kiện và hậu điều kiện của từng use case.
- Luồng thành công, luồng lỗi, ngoại lệ và vòng đời trạng thái.
- Quy tắc nghiệp vụ, quyền thực hiện và tình huống đồng thời cần xử lý.

## 3. Quyết định và thiết kế chi tiết

### 3.1. Quy ước chung

**Actor.** Bốn vai trò nghiệp vụ đã chốt tại phần 6, mục 3:

| Ký hiệu | Vai trò | Phạm vi |
|---|---|---|
| `WS-OWNER` | Workspace Owner | Toàn quyền trên workspace và mọi project bên trong, kể cả sau khi đã giao Project Owner |
| `WS-MEMBER` | Workspace Member | Mặc định là `PROJ-VIEWER` trong mọi project; không có vai trò riêng ở cấp workspace ngoài quyền rời workspace |
| `PROJ-OWNER` | Project Owner | Quản lý thành viên project; chỉ một người cho mỗi project |
| `PROJ-MEMBER` | Project Member | Thao tác dữ liệu, phân tích, lưu trong project |
| `PROJ-VIEWER` | Project Viewer | Chỉ xem; không thao tác |

Danh sách actor trong mỗi use case ghi đúng tên vai trò, không ghi "ai có quyền" chung chung.

**Mẫu use case.** Mỗi use case ghi theo 7 trường cố định: Actor → Tiền điều kiện → Input → Luồng chính → Luồng lỗi → Hậu điều kiện → Quyền thực hiện.

**Quy ước lỗi.** Mọi lỗi nghiệp vụ trả về dạng thống nhất, tách **mã lỗi** khỏi **thông điệp hiển thị**:
- `VALIDATION_ERROR` — input sai định dạng hoặc vi phạm ràng buộc.
- `NOT_FOUND` — không tìm thấy tài nguyên, hoặc tài nguyên không thuộc phạm vi truy cập của người gọi.
- `FORBIDDEN` — người gọi có quyền xem nhưng không có quyền thao tác.
- `CONFLICT` — xung đột trạng thái (ví dụ lưu trên bản cũ khi đã có bản mới).
- `PRECONDITION_FAILED` — điều kiện nghiệp vụ chưa thoả (ví dụ sheet còn lỗi tên cột, đầu vào đã thay đổi).
- `LIMIT_EXCEEDED` — vượt giới hạn dung lượng/quota.
- `DEPENDENCY_UNAVAILABLE` — dịch vụ ngoài lỗi (Gemini, R2, Neo4j).

Nguyên tắc: **không dùng `NOT_FOUND` để che giấu việc tài nguyên tồn tại nhưng người gọi không có quyền xem** — trả `FORBIDDEN` khi người gọi có quyền xem trong project nhưng không có quyền thao tác; trả `NOT_FOUND` khi thực sự không tồn tại.

**Phân tách trạng thái.** Ba khái niệm phải phân biệt rõ trong mọi use case:
- **Trạng thái làm việc** (working state) — trạng thái đang thao tác trên sheet hiện tại trong phiên làm việc: dòng đã xoá, tên cột đã sửa, ô đã sửa, cấu hình phân tích, bộ lọc/sắp xếp/tìm kiếm/trang.
- **Bản lưu hiện hành** (saved snapshot) — bản được lưu gần nhất của project, gắn với sheet đã lưu. Chỉ có **một** bản lưu hiện hành cho mỗi project, không giữ bản riêng cho từng sheet.
- **Kết quả phân tích** — thuộc bản lưu hiện hành, gắn với `input_fingerprint` của lần chạy.

**Quy tắc nhất quán cho thao tác trạng thái.** Mọi thao tác thay đổi trạng thái làm việc đều **không tự động lưu**. Việc lưu chỉ xảy ra qua UC-25.

**Tính bất biến của file gốc.** Không use case nào ghi đè file gốc đã upload. Thao tác trên dữ liệu (xoá dòng, sửa ô, đổi tên cột) chỉ tác động trạng thái làm việc.

### 3.2. Nhóm 1 — Workspace và Project

#### UC-01. Tạo workspace

- **Actor:** `WS-OWNER` (người tạo trở thành Workspace Owner duy nhất).
- **Tiền điều kiện:** người gọi đã đăng nhập và có tài khoản hoạt động.
- **Input:** tên workspace (bắt buộc, 1–100 ký tự sau trim), mô tả tuỳ chọn.
- **Luồng chính:**
  1. Kiểm tra tên hợp lệ và không trùng tên trùng với workspace của chính người gọi.
  2. Tạo workspace với `owner_id = người gọi`.
  3. Trả về workspace kèm vai trò `owner` của người gọi.
- **Luồng lỗi:**
  - Tên rỗng/quá dài → `VALIDATION_ERROR`.
  - Trùng tên trong phạm vi người gọi → `CONFLICT`.
  - Người gọi chưa đăng nhập → `UNAUTHORIZED`.
- **Hậu điều kiện:** workspace tồn tại; người gọi là Workspace Owner; chưa có project nào.
- **Quyền thực hiện:** bất kỳ user đã đăng nhập nào cũng tạo được workspace cho chính mình. Không có vai trò hệ thống `admin` nào vượt qua được quy tắc này.

#### UC-02. Cập nhật thông tin workspace

- **Actor:** `WS-OWNER`.
- **Tiền điều kiện:** workspace tồn tại; người gọi là Workspace Owner.
- **Input:** tên mới (tuỳ chọn), mô tả mới (tuỳ chọn).
- **Luồng chính:** kiểm tra tính hợp lệ → cập nhật → trả về workspace đã cập nhật.
- **Luồng lỗi:** `VALIDATION_ERROR` khi sai định dạng; `CONFLICT` khi tên trùng; `NOT_FOUND` khi workspace không tồn tại; `FORBIDDEN` khi người gọi không phải Owner.
- **Hậu điều kiện:** workspace được cập nhật; **không** ảnh hưởng tới project và bản lưu bên trong.
- **Quyền thực hiện:** `WS-OWNER`.

#### UC-03. Thêm thành viên workspace

- **Actor:** `WS-OWNER`.
- **Tiền điều kiện:** workspace tồn tại; người được thêm đã có tài khoản trong hệ thống.
- **Input:** email hoặc `user_id` của người được thêm.
- **Luồng chính:**
  1. Kiểm tra người được thêm chưa là thành viên workspace.
  2. Thêm với vai trò `member` (workspace chỉ có `owner` và `member`).
  3. Người được thêm mặc định là `PROJ-VIEWER` trong mọi project của workspace.
- **Luồng lỗi:** `VALIDATION_ERROR` khi email sai định dạng; `CONFLICT` khi đã là thành viên; `NOT_FOUND` khi không tìm thấy user; `FORBIDDEN` khi người gọi không phải Owner.
- **Hậu điều kiện:** người được thêm có quyền xem các project của workspace ở mức Viewer.
- **Quyền thực hiện:** `WS-OWNER`.

#### UC-04. Xóa thành viên workspace

- **Actor:** `WS-OWNER`.
- **Tiền điều kiện:** workspace tồn tại; người bị xóa **không** phải Workspace Owner (Owner phải dùng UC-07 để chuyển quyền trước).
- **Input:** `user_id` của người bị xóa.
- **Luồng chính:**
  1. Gỡ vai trò thành viên workspace của người bị xóa.
  2. **Thu hồi toàn bộ quyền truy cập** các project thuộc workspace, bất kể vai trò project trước đó. Không chuyển thành `PROJ-VIEWER`.
  3. Nếu người bị xóa đang là `PROJ-OWNER` của project nào → `WS-OWNER` tiếp quản vai trò Project Owner của các project đó; mỗi project vẫn chỉ có một Owner.
- **Luồng lỗi:** `CONFLICT` khi cố xóa chính Workspace Owner; `NOT_FOUND` khi người đó không phải thành viên; `FORBIDDEN` khi người gọi không phải Owner.
- **Hậu điều kiện:** người bị xóa mất toàn bộ quyền truy cập workspace và các project bên trong. Dữ liệu và bản lưu của project **không** bị xóa.
- **Quyền thực hiện:** `WS-OWNER`.

#### UC-05. Tạo project và chỉ định Project Owner

- **Actor:** `WS-OWNER`.
- **Tiền điều kiện:** workspace tồn tại; người được chỉ định là thành viên của workspace hoặc chính Workspace Owner.
- **Input:** workspace id, tên project (bắt buộc), mô tả tuỳ chọn, `owner_id` của Project Owner.
- **Luồng chính:**
  1. Kiểm tra tên project hợp lệ.
  2. Tạo project gắn `workspace_id`.
  3. Gán vai trò `owner` cho `owner_id` được chỉ định trong project.
  4. Người tạo (`WS-OWNER`) vẫn giữ toàn quyền quản trị với project này **không cần** là Project Owner.
- **Luồng lỗi:** `VALIDATION_ERROR` khi thiếu/sai tên; `NOT_FOUND` khi workspace hoặc người được chỉ định không tồn tại; `FORBIDDEN` khi người gọi không phải Workspace Owner.
- **Hậu điều kiện:** project tồn tại với đúng một Project Owner; chưa có dataset nào.
- **Quyền thực hiện:** **chỉ `WS-OWNER`**. `WS-MEMBER` không tạo được project (quyết định đã chốt ở phần 6, mục 3).
- **Rủi ro cần lưu ý:** xem mục 3.8.

#### UC-06. Quản lý thành viên project

- **Actor:** `PROJ-OWNER` (và `WS-OWNER` với toàn quyền quản trị đã chốt).
- **Tiền điều kiện:** project tồn tại; người gọi là Project Owner hoặc Workspace Owner.
- **Input:** `user_id` đích, hành động (`grant-member` | `revoke-member` | `transfer-owner` | `grant-viewer`).
- **Luồng chính — theo hành động:**
  1. **`grant-member`:** nâng vai trò `WS-MEMBER` từ Viewer lên Member trong project. Người được nâng **phải** là Workspace Member (quy tắc: Workspace Member mặc định là Viewer trong mọi project; Project Owner cấp quyền Member cho họ trong project mình quản lý).
  2. **`revoke-member`:** hạ `PROJ-MEMBER` về `PROJ-VIEWER`. Người đó vẫn truy cập được project vì vẫn là Workspace Member. Vai trò ở workspace không đổi.
  3. **`transfer-owner`:** Project Owner chuyển quyền Owner cho người khác → Project Owner cũ trở thành `PROJ-MEMBER`; nếu người nhận là `WS-OWNER` thì người đó vẫn giữ quyền quản trị workspace, và Project Owner cũ trở thành `PROJ-MEMBER` (không phải Viewer, vì hành động do chủ sở hữu project tự thực hiện).
  4. **`grant-viewer`:** đưa một `PROJ-MEMBER` về `PROJ-VIEWER`.
- **Luồng lỗi:**
  - `CONFLICT` khi `transfer-owner` và project đã có Owner khác nhận — mỗi project chỉ có một Owner; chuyển quyền phải là hành động nguyên tử.
  - `VALIDATION_ERROR` khi hạ quyền chính Project Owner qua `revoke-member` — phải dùng `transfer-owner` hoặc `WS-OWNER` tiếp quản.
  - `NOT_FOUND` khi người đích không thuộc workspace.
  - `FORBIDDEN` khi người gọi không phải Project Owner/Workspace Owner.
- **Hậu điều kiện:** bảng vai trò project được cập nhật; project vẫn có đúng một Project Owner.
- **Quyền thực hiện:** `PROJ-OWNER`, `WS-OWNER`.

#### UC-07. Rời workspace

- **Actor:** `WS-MEMBER` (tự rời) hoặc `WS-OWNER` (tự rời).
- **Tiền điều kiện:** người gọi là thành viên workspace.
- **Input:** không có (rời workspace là hành động trên chính bản thân).
- **Luồng chính — `WS-MEMBER` tự rời:**
  1. Gỡ thành viên workspace.
  2. Mất toàn bộ quyền truy cập các project thuộc workspace.
  3. Nếu đang là `PROJ-OWNER` → `WS-OWNER` tiếp quản các project đó.
- **Luồng chính — `WS-OWNER` tự rời:**
  1. Phải **chuyển quyền Workspace Owner** cho người khác trước. Không được rời khi chưa hoàn tất chuyển quyền.
  2. Sau khi chuyển quyền, quy tắc thu hồi và tiếp quản áp dụng như trên, với Workspace Owner mới là người tiếp quản.
- **Luồng lỗi:** `CONFLICT` khi `WS-OWNER` cố rời mà chưa chuyển quyền; `FORBIDDEN` khi người gọi không phải thành viên.
- **Hậu điều kiện:** người rời mất toàn bộ quyền truy cập workspace và project bên trong; dữ liệu và bản lưu được giữ nguyên.
- **Quyền thực hiện:** thành viên workspace (tự hành động); `WS-OWNER` không thể xóa chính mình bằng UC-04.

### 3.3. Nhóm 2 — Dataset và Sheet

#### UC-08. Import file dữ liệu vào project

- **Actor:** `WS-OWNER`, `PROJ-OWNER`.
- **Tiền điều kiện:** project tồn tại; project **chưa có** dataset (mỗi project chỉ chứa một file dữ liệu, không cho thay thế file).
- **Input:** file `.xlsx` hoặc `.csv` (tối đa 50 MB, hard-cap 500 MB/workspace).
- **Luồng chính:**
  1. Kiểm tra định dạng, dung lượng và quota workspace.
  2. Lưu file gốc vào Storage qua port Storage (R2, có local fallback) với **đúng extension gốc**.
  3. Đọc và phân tích cấu trúc: với `.xlsx` đọc tất cả sheet (gồm sheet ẩn); với `.csv` nhận diện delimiter.
  4. Kiểm tra tên cột **của tất cả sheet**: tên rỗng hoặc trùng → ghi cảnh báo theo từng sheet, **không chặn import**.
  5. Tách bản ghi dữ liệu vào cơ sở dữ liệu (streaming cho CSV; `.xlsx` nạp vào bộ nhớ do giới hạn 50 MB).
  6. Gắn dataset vào project, mặc định chọn sheet đầu tiên là sheet làm việc.
- **Luồng lỗi:**
  - `VALIDATION_ERROR` — định dạng không hỗ trợ (`.xls`), file Excel có mật khẩu, CSV không xác định được delimiter, dòng đầu không phải header hợp lệ (mục 3.26).
  - `LIMIT_EXCEEDED` — vượt 50 MB/file hoặc 500 MB/workspace.
  - `CONFLICT` — project đã có dataset.
  - `DEPENDENCY_UNAVAILABLE` — lỗi Storage. **File tạm phải được dọn** khỏi bucket nếu thất bại giữa chừng.
- **Hậu điều kiện:**
  - File gốc được lưu với đúng extension; dataset gắn vào project.
  - Tồn tại danh sách cảnh báo tên cột theo từng sheet.
  - **Chưa** tạo bản lưu hiện hành; trạng thái làm việc = trạng thái mặc định.
- **Quyền thực hiện:** `WS-OWNER`, `PROJ-OWNER`. **`PROJ-MEMBER` không được import** (quyết định đã chốt ở lượt thảo luận này).
- **Hệ quả cần lưu ý:** xem mục 3.8.

#### UC-09. Chọn sheet làm việc

- **Actor:** `WS-OWNER`, `PROJ-OWNER`, `PROJ-MEMBER`.
- **Tiền điều kiện:** project có dataset đã import thành công.
- **Input:** `sheet_id` (bao gồm sheet ẩn).
- **Luồng chính:**
  1. Nếu sheet thuộc bản lưu hiện hành → khôi phục trạng thái làm việc của sheet đó (dữ liệu làm việc, cấu hình, kết quả phân tích nếu có).
  2. Nếu sheet **không** thuộc bản lưu hiện hành → bắt đầu từ dữ liệu gốc và trạng thái mặc định (không khôi phục bản lưu cũ của sheet đó).
  3. Nếu sheet rỗng hoàn toàn → vẫn mở, hiển thị thông báo "không có dữ liệu", người dùng tự đổi sheet.
  4. Nếu sheet chỉ có header, không có dòng dữ liệu → mở bình thường; các phép phân tích báo "không có dữ liệu để đánh giá".
- **Luồng lỗi:** `NOT_FOUND` khi `sheet_id` không thuộc dataset của project.
- **Hậu điều kiện:** sheet được đặt là sheet làm việc; trạng thái làm việc của sheet mới được nạp vào phiên.
- **Quyền thực hiện:** mọi vai trò có quyền xem project.
- **Vòng đời liên quan:** chuyển sheet khởi động lại vòng đời kết quả phân tích tương ứng (mục 3.3 của phần 2).

#### UC-10. Nhập hoặc chỉnh sửa tên cột rỗng/trùng

- **Actor:** `WS-OWNER`, `PROJ-OWNER`, `PROJ-MEMBER`.
- **Tiền điều kiện:** sheet làm việc có ít nhất một cột rỗng hoặc trùng tên.
- **Input:** danh sách `{ column_index, new_name }`.
- **Luồng chính:**
  1. Kiểm tra tên mới không rỗng và không trùng với tên cột khác **trong cùng sheet** (so sánh phân biệt hoa/thường và khoảng trắng, không tự trim hay đổi hoa/thường).
  2. Ghi tên mới vào trạng thái làm việc — **không** sửa file gốc.
  3. Chạy lại kiểm tra tên cột của sheet.
- **Luồng lỗi:**
  - `VALIDATION_ERROR` — tên mới rỗng hoặc trùng.
  - `PRECONDITION_FAILED` — không có lỗi tên cột nào để sửa (yêu cầu thừa).
  - `FORBIDDEN` — `PROJ-VIEWER` không được sửa tên cột (chỉ xem cảnh báo).
- **Hậu điều kiện:** lỗi tên cột của sheet làm việc được giải quyết → **mở khoá phân tích** (UC-15). Tên đã sửa là một phần của trạng thái làm việc, được lưu cùng bản project tại UC-25.
- **Quyền thực hiện:** `WS-OWNER`, `PROJ-OWNER`, `PROJ-MEMBER`.

#### UC-11. Xóa dòng

- **Actor:** `WS-OWNER`, `PROJ-OWNER`, `PROJ-MEMBER`.
- **Tiền điều kiện:** dataset đã import; sheet làm việc có dữ liệu.
- **Input:** danh sách **số dòng file gốc** — một dòng, nhiều dòng chọn, hoặc một khoảng dòng `[from, to]`.
- **Luồng chính:**
  1. Xác thực các số dòng nằm trong phạm vi sheet làm việc.
  2. Đánh dấu các dòng bị xóa trong trạng thái làm việc (giữ **số dòng gốc** làm định danh tham chiếu).
  3. Tổng số dòng bị xóa được thể hiện trong Tổng kết.
- **Luồng lỗi:**
  - `VALIDATION_ERROR` — số dòng không hợp lệ, `from > to`, khoảng chứa dòng đã xóa.
  - `NOT_FOUND` — số dòng không tồn tại trong sheet.
  - `FORBIDDEN` — `PROJ-VIEWER` không được xóa dòng.
- **Hậu điều kiện:**
  - Dữ liệu làm việc không còn chứa các dòng đã xóa; **file gốc giữ nguyên**.
  - `input_fingerprint` thay đổi → kết quả phân tích đã lưu trở thành **stale** (không bị xóa khỏi database).
- **Quyền thực hiện:** `WS-OWNER`, `PROJ-OWNER`, `PROJ-MEMBER`.

#### UC-12. Reset Dataset (sheet đang làm việc)

- **Actor:** `WS-OWNER`, `PROJ-OWNER`, `PROJ-MEMBER`.
- **Tiền điều kiện:** project có dataset; sheet đang làm việc có thay đổi trong trạng thái làm việc.
- **Input:** không có (reset toàn bộ trạng thái làm việc của sheet hiện tại).
- **Luồng chính:**
  1. Khôi phục dữ liệu làm việc về dữ liệu gốc của sheet (khôi phục các dòng đã xóa, hoàn tác ô đã sửa).
  2. Khôi phục tên cột từ file gốc → các lỗi tên cột **hiển thị lại**.
  3. Xóa cấu hình phân tích, bộ lọc, sắp xếp, tìm kiếm và trang đang xem của sheet.
  4. **Không** thay đổi bản lưu hiện hành.
- **Luồng lỗi:** `NOT_FOUND` khi project chưa có dataset.
- **Hậu điều kiện:**
  - Trạng thái làm việc = trạng thái mặc định của sheet.
  - Bản lưu hiện hành vẫn giữ nguyên cho tới lần Lưu thành công tiếp theo (UC-25).
- **Quyền thực hiện:** `WS-OWNER`, `PROJ-OWNER`, `PROJ-MEMBER`.

#### UC-13. Xem thông tin dataset và schema

- **Actor:** mọi vai trò có quyền xem project.
- **Tiền điều kiện:** project có dataset.
- **Input:** không có.
- **Luồng chính:** trả về tên dataset (lấy từ tên file), danh sách sheet kèm trạng thái ẩn/hiện, cột của sheet làm việc kèm kiểu đã nhận diện, cảnh báo tên cột theo từng sheet, số dòng gốc và số dòng đang làm việc.
- **Luồng lỗi:** `NOT_FOUND` khi project chưa có dataset.
- **Hậu điều kiện:** không thay đổi trạng thái.
- **Quyền thực hiện:** mọi vai trò có quyền xem project.

### 3.4. Nhóm 3 — Data Views

#### UC-14. Xem bảng dữ liệu

- **Actor:** mọi vai trò có quyền xem project.
- **Tiền điều kiện:** project có dataset; đã chọn sheet làm việc.
- **Input:** `page` (mặc định 1), `page_size` (mặc định 50, tối đa 200), `cursor` tuỳ chọn.
- **Luồng chính:**
  1. Áp bộ lọc đang lưu trên trạng thái làm việc.
  2. Áp sắp xếp và tìm kiếm đang lưu.
  3. Trả về trang dữ liệu kèm tổng số khớp, kèm **số dòng gốc** của mỗi bản ghi để thao tác xóa/sửa tham chiếu đúng.
- **Luồng lỗi:** `VALIDATION_ERROR` khi tham số phân trang sai; `NOT_FOUND` khi chưa có dataset/sheet.
- **Hậu điều kiện:** không thay đổi trạng thái. Bộ lọc/sắp xếp/tìm kiếm/trang là **một phần** của trạng thái làm việc và được lưu cùng bản project.
- **Quyền thực hiện:** mọi vai trò có quyền xem project (kể cả `PROJ-VIEWER`).

#### UC-15. Lọc dữ liệu

- **Actor:** mọi vai trò có quyền xem project.
- **Tiền điều kiện:** đã có dataset và sheet làm việc.
- **Input:** danh sách điều kiện `{ column, operator, value }` — cấu trúc **phẳng**: OR trong cùng một cột, AND giữa các cột.
- **Luồng chính:**
  1. Xác thực toán tử theo loại cột: văn bản (`contains`/`equals`/`startsWith`/`endsWith`), số/ngày (`equals`/`gt`/`lt`/`between`), ô trống (`isEmpty`/`isNotEmpty`).
  2. Áp bộ lọc lên dữ liệu làm việc → cập nhật trạng thái bộ lọc.
  3. Đặt lại trang đang xem về trang 1.
- **Luồng lỗi:**
  - `VALIDATION_ERROR` — toán tử không hợp lệ với kiểu cột; `min > max` trong `between`; cột chưa có kiểu định lượng/thời gian đã cấu hình mà dùng toán tử số/ngày.
  - `NOT_FOUND` — cột không tồn tại trong sheet.
- **Hậu điều kiện:** bộ lọc chỉ thay đổi **hiển thị**; không sửa dữ liệu, **không** giới hạn phạm vi phân tích (phân tích luôn dùng toàn bộ sheet đang làm việc sau khi xóa dòng).
- **Quyền thực hiện:** mọi vai trò có quyền xem project.

#### UC-16. Sắp xếp

- **Actor:** mọi vai trò có quyền xem project.
- **Tiền điều kiện:** đã có dataset và sheet làm việc.
- **Input:** `column`, `direction` (`asc` | `desc`).
- **Luồng chính:**
  1. Xác thực cột tồn tại và có kiểu đã cấu hình. Cột chưa có kiểu → báo "không sắp xếp được cột đó" thay vì trộn kiểu âm thầm.
  2. Sắp xếp theo kiểu đã cấu hình; **giá trị trống luôn xếp cuối** bất kể tăng/giảm.
  3. Đặt lại trang đang xem về trang 1.
- **Luồng lỗi:** `VALIDATION_ERROR` khi direction sai; `NOT_FOUND` khi cột không tồn tại; `PRECONDITION_FAILED` khi cột chưa có kiểu.
- **Hậu điều kiện:** chỉ thay đổi hiển thị; **không** đổi số dòng tham chiếu dùng để xóa dùng. Chỉ hỗ trợ **một cột tại một thời điểm**.
- **Quyền thực hiện:** mọi vai trò có quyền xem project.

#### UC-17. Tìm kiếm

- **Actor:** mọi vai trò có quyền xem project.
- **Tiền điều kiện:** đã có dataset và sheet làm việc.
- **Input:** `query` (chuỗi), `match_type` (`contains` | `equals`).
- **Luồng chính:**
  1. Tìm trên **toàn bảng** của sheet làm việc. `contains` không phân biệt hoa/thường; `equals` khớp chính xác, có phân biệt.
  2. Kết hợp với bộ lọc theo quy tắc AND.
  3. Cập nhật trạng thái tìm kiếm, đặt lại trang về 1.
- **Luồng lỗi:** `VALIDATION_ERROR` khi `match_type` không hợp lệ.
- **Hậu điều kiện:** chỉ thay đổi hiển thị.
- **Quyền thực hiện:** mọi vai trò có quyền xem project.

#### UC-18. Sửa ô

- **Actor:** `WS-OWNER`, `PROJ-OWNER`, `PROJ-MEMBER`.
- **Tiền điều kiện:** đã có dataset và sheet làm việc; ô đích tồn tại.
- **Input:** `row_index` (số dòng gốc), `column_name`, `value` mới.
- **Luồng chính:**
  1. Xác thực ô tồn tại trong sheet làm việc.
  2. Ghi giá trị mới vào **dữ liệu làm việc**; **không** ghi đè file gốc.
  3. Cập nhật trạng thái làm việc.
- **Luồng lỗi:**
  - `VALIDATION_ERROR` — giá trị không hợp lệ với kiểu cột đã cấu hình.
  - `NOT_FOUND` — ô không tồn tại.
  - `FORBIDDEN` — `PROJ-VIEWER` không được sửa ô.
- **Hậu điều kiện:**
  - Ô lưu giá trị mới trong dữ liệu làm việc; file gốc không đổi.
  - Sửa ô **không** làm mất hiệu lực kết quả phân tích theo cơ chế `stale` (quy tắc `keep` + `warn_only`): hệ thống **cảnh báo** "kết quả phân tích đã lưu có thể không còn khớp" và vẫn cho phép tạo Tổng kết từ kết quả hiện có.
  - Sửa ô là một thay đổi đầu vào của dữ liệu làm việc → phải được ghi vào trạng thái lưu/khôi phục của project.
- **Quyền thực hiện:** `WS-OWNER`, `PROJ-OWNER`, `PROJ-MEMBER`.

### 3.5. Nhóm 4 — Phân tích

#### UC-19. Cấu hình cột phân tích

- **Actor:** `WS-OWNER`, `PROJ-OWNER`, `PROJ-MEMBER`.
- **Tiền điều kiện:** sheet làm việc **không** còn lỗi tên cột rỗng/trùng.
- **Input:** tập cột được chọn phân tích (mặc định toàn bộ), cột nhãn tuỳ chọn, và cấu hình theo cột: kiểu dữ liệu, vai trò phân tích (`categorical` | `numerical` | `identifier` | `temporal` | `text`), định dạng số/ngày, phương pháp tương quan, phương pháp outlier, mức tổng hợp thời gian, múi giờ, giá trị `Top N`.
- **Luồng chính:**
  1. Kiểm tra điều kiện chặn: tên cột hợp lệ (nếu chưa → `PRECONDITION_FAILED`).
  2. Hệ thống gợi ý cột nhãn theo tiêu chí đã chốt: vai trò `categorical`, ≥ 2 lớp, ≤ 50 lớp, tỷ lệ lớp lớn nhất < 80%. Cột vai trò `identifier` không được gợi ý. Người dùng có thể chọn thủ công hoặc bỏ chọn — **hệ thống không tự gán nhãn**.
  3. Ghi cấu hình vào trạng thái làm việc.
  4. Đánh dấu kết quả phân tích đã lưu là **stale** (vì `input_fingerprint` đổi).
- **Luồng lỗi:**
  - `PRECONDITION_FAILED` — sheet còn lỗi tên cột; chưa có dataset.
  - `VALIDATION_ERROR` — cột không tồn tại; cột nhãn liên tục; giá trị `Top N` ngoài khoảng 1–20; cấu hình múi giờ thiếu khi cột thời gian có offset.
  - `FORBIDDEN` — `PROJ-VIEWER` không được tinh chỉnh.
- **Hậu điều kiện:** cấu hình nằm trong trạng thái làm việc, được lưu cùng bản project và thể hiện trong Tổng kết/PDF.
- **Quyền thực hiện:** `WS-OWNER`, `PROJ-OWNER`, `PROJ-MEMBER`.

#### UC-20. Chạy Data Analysis & Detection

- **Actor:** `WS-OWNER`, `PROJ-OWNER`, `PROJ-MEMBER`.
- **Tiền điều kiện:** sheet làm việc hợp lệ; đã cấu hình cột phân tích; không có lần phân tích đang chạy cho sheet này.
- **Input:** cấu hình phân tích hiện tại (lấy từ trạng thái làm việc).
- **Luồng chính — phần hệ thống (đồng bộ):**
  1. Tính `input_fingerprint` của cấu hình hiện tại.
  2. Chạy các phép tính: thống kê mô tả, DQ-01..DQ-04, liên hệ/VIF, mất cân bằng lớp, phân tích thời gian.
  3. Lưu kết quả cùng `input_fingerprint`; sinh bằng chứng mức ô vào collection riêng.
  4. Trả kết quả hệ thống **ngay** cho người gọi.
  5. Tạo job AI (nếu AI được bật) để chạy nền.
- **Luồng chính — phần AI (bất đồng bộ):**
  6. Worker nền nhận job → dựng payload (thống kê tổng hợp + tối đa 20 ô lỗi/cột **đã che PII**) → gọi Gemini (timeout 60s, retry tối đa 2 lần cho lỗi tạm thời).
  7. Kiểm chứng phản hồi: đúng schema → không vượt quyền backend về mức ảnh hưởng/trạng thái xác minh → mọi tham chiếu bằng chứng tồn tại → số liệu khớp thống kê đã gửi.
  8. Lưu phần AI hợp lệ vào kết quả; đánh dấu trạng thái job.
- **Luồng lỗi — phần hệ thống:**
  - `PRECONDITION_FAILED` — sheet còn lỗi tên cột; đầu vào đã thay đổi so với kết quả đang xem.
  - `CONFLICT` — đã có lần phân tích đang chạy cho sheet này.
  - Không đủ số mẫu → **không phải lỗi**: từng phép tính báo "không tính được" kèm lý do cụ thể.
- **Luồng lỗi — phần AI:**
  - Timeout, 429, 5xx → retry tối đa 2 lần; hết lượt → job `failed`.
  - 4xx do payload không hợp lệ → không retry, job `failed`.
  - AI lỗi **không chặn Tổng kết**: Tổng kết hiển thị kết quả hệ thống kèm thông báo lỗi có kiểm soát, không có phần giải thích/đề xuất của AI.
  - Phản hồi hợp lệ một phần → giữ phần hợp lệ, loại phần không đạt, báo "phần nhận xét AI chưa đầy đủ".
- **Hậu điều kiện:** kết quả hệ thống đã lưu; job AI ở trạng thái `pending`/`running`/`succeeded`/`failed`. Kết quả phân tích **không** tự động trở thành bản lưu project.
- **Quyền thực hiện:** `WS-OWNER`, `PROJ-OWNER`, `PROJ-MEMBER`.

#### UC-21. Xem trạng thái job AI

- **Actor:** `WS-OWNER`, `PROJ-OWNER`, `PROJ-MEMBER`.
- **Tiền điều kiện:** có job AI được tạo từ lần phân tích gần nhất.
- **Input:** `analysis_id` hoặc `job_id`.
- **Luồng chính:** trả về trạng thái job, số lần đã retry, thời điểm bắt đầu/kết thúc và thông báo lỗi nếu thất bại. Nếu job thành công, trả kèm phần phát hiện AI đã kiểm chứng.
- **Luồng lỗi:** `NOT_FOUND` khi không có job tương ứng.
- **Hậu điều kiện:** không thay đổi trạng thái.
- **Quyền thực hiện:** người có quyền xem kết quả phân tích.

#### UC-22. Thử lại AI

- **Actor:** `WS-OWNER`, `PROJ-OWNER`, `PROJ-MEMBER`.
- **Tiền điều kiện:** có kết quả phân tích hệ thống đã lưu; phần AI lỗi hoặc người dùng muốn làm lại; **dữ liệu và cấu hình phân tích không đổi** (`input_fingerprint` khớp).
- **Input:** `analysis_id`.
- **Luồng chính:**
  1. Kiểm tra `input_fingerprint` hiện tại khớp kết quả đã lưu → nếu lệch thì `PRECONDITION_FAILED` và yêu cầu chạy lại phân tích.
  2. Tạo job AI mới dựng lại payload từ kết quả hệ thống đã lưu (không chạy lại phần hệ thống).
  3. Worker xử lý như UC-20.
- **Luồng lỗi:** `PRECONDITION_FAILED` khi fingerprint lệch; `NOT_FOUND` khi chưa có kết quả phân tích.
- **Hậu điều kiện:** kết quả hệ thống **không** bị thay thế; chỉ phần AI được cập nhật.
- **Quyền thực hiện:** người có quyền chạy phân tích.

### 3.6. Nhóm 5 — Tổng kết, lưu và xuất

#### UC-23. Tạo Tổng kết

- **Actor:** `WS-OWNER`, `PROJ-OWNER`, `PROJ-MEMBER`.
- **Tiền điều kiện:** đã có kết quả phân tích hệ thống **chạy với đầu vào hiện tại** (`input_fingerprint` khớp).
- **Input:** không có (Tổng kết lấy từ kết quả phân tích đã lưu).
- **Luồng chính:**
  1. Nếu chưa có phân tích → yêu cầu người dùng chạy Data Analysis & Detection, **không** tự chạy thay.
  2. Nếu kết quả đã lưu stale (đầu vào đã đổi) → từ chối tạo Tổng kết mới.
  3. Nếu có cảnh báo "kết quả có thể không còn khớp" do sửa ô → cho phép tạo Tổng kết từ kết quả hiện có kèm cảnh báo.
  4. Gom nội dung Tổng kết: tổng quan dữ liệu, các thao tác trước phân tích (chỉ thay đổi cuối cùng còn hiệu lực), danh sách vấn đề kèm mức độ ảnh hưởng và trạng thái xác minh, bằng chứng (mức ô), đề xuất xử lý theo thứ tự ưu tiên, và phần giải thích/đề xuất của AI nếu có.
- **Luồng lỗi:**
  - `PRECONDITION_FAILED` — chưa phân tích, hoặc kết quả stale.
  - `FORBIDDEN` — `PROJ-VIEWER` không được tạo Tổng kết mới.
- **Hậu điều kiện:** nội dung Tổng kết sẵn sàng hiển thị và xuất PDF; **không** tự lưu project.
- **Quyền thực hiện:** `WS-OWNER`, `PROJ-OWNER`, `PROJ-MEMBER`.

#### UC-24. Xem bằng chứng mức ô

- **Actor:** mọi vai trò có quyền xem project, kể cả `PROJ-VIEWER`.
- **Tiền điều kiện:** có phát hiện với bằng chứng mức ô.
- **Input:** `finding_id`, `page` (mặc định 1), `page_size` (mặc định 50, tối đa 200).
- **Luồng chính:**
  1. Trả về trang bằng chứng: cột, **giá trị ô**, số dòng gốc, lý do.
  2. Trả về tổng số bằng chứng của phát hiện (đầy đủ, không phân trang).
- **Luồng lỗi:** `NOT_FOUND` khi phát hiện không tồn tại hoặc không có bằng chứng.
- **Hậu điều kiện:** không thay đổi trạng thái.
- **Quyền thực hiện:** **mọi vai trò có quyền xem project** — quyết định đã chốt ở lượt thảo luận này. Bằng chứng là dữ liệu đã nằm trong hệ thống (người dùng đã upload), khác với dữ liệu gửi ra ngoài cho AI.

#### UC-25. Lưu trạng thái project

- **Actor:** `WS-OWNER`, `PROJ-OWNER`, `PROJ-MEMBER`.
- **Tiền điều kiện:** project có dataset; nút Lưu ở Tổng kết đang hoạt động.
- **Input:** không có (lưu toàn bộ trạng thái làm việc của sheet làm việc).
- **Luồng chính:**
  1. Kiểm tra xung đột: nếu bản lưu hiện hành đã bị người khác cập nhật (so sánh phiên bản) → `CONFLICT`, thông báo có bản mới và yêu cầu tải lại; **không** ghi đè bản mới từ trạng thái cũ.
  2. Ghi bản lưu mới chứa: sheet làm việc; trạng thái dữ liệu làm việc kèm số dòng gốc đã xóa và các ô đã sửa; tên cột trong trạng thái làm việc; tập cột được chọn phân tích và cột nhãn; kết quả Data Analysis & Detection; nội dung Tổng kết; bộ lọc, sắp xếp, tìm kiếm và trang đang xem.
  3. Bản lưu mới trở thành **bản lưu hiện hành duy nhất**, gắn với sheet vừa lưu. Không giữ bản riêng cho từng sheet.
- **Luồng lỗi:**
  - `CONFLICT` — xung đột bản lưu như trên.
  - `FORBIDDEN` — `PROJ-VIEWER` không được lưu.
  - `NOT_FOUND` — project không tồn tại.
- **Hậu điều kiện:** bản lưu hiện hành đã cập nhật; mở lại project khôi phục đúng sheet và trạng thái này. File gốc giữ nguyên.
- **Quyền thực hiện:** `WS-OWNER`, `PROJ-OWNER`, `PROJ-MEMBER`.

#### UC-26. Tải báo cáo PDF

- **Actor:** mọi vai trò có quyền xem project, kể cả `PROJ-VIEWER`.
- **Tiền điều kiện:** có nội dung Tổng kết hợp lệ để xuất.
- **Input:** không có.
- **Luồng chính:**
  1. Dựng báo cáo từ nội dung Tổng kết hiện tại — **không cần lưu project trước**.
  2. Trả file PDF tải xuống.
- **Luồng lỗi:**
  - `PRECONDITION_FAILED` — chưa có Tổng kết hợp lệ.
  - `NOT_FOUND` — project không tồn tại.
- **Hậu điều kiện:** xuất PDF **không** tự lưu và **không** thay thế bản lưu project hiện hành.
- **Quyền thực hiện:** mọi vai trò có quyền xem project. Quyền tải là **ngoại lệ** đã chốt: không cấp quyền chạy phân tích, tạo Tổng kết mới hay lưu project cho `PROJ-VIEWER`.

#### UC-27. Khôi phục project

- **Actor:** mọi vai trò có quyền xem project.
- **Tiền điều kiện:** project có bản lưu hiện hành.
- **Input:** không có.
- **Luồng chính:**
  1. Nạp bản lưu hiện hành và sheet tương ứng.
  2. Khôi phục đầy đủ: dữ liệu làm việc, tên cột, cấu hình phân tích, kết quả phân tích, nội dung Tổng kết, bộ lọc/sắp xếp/tìm kiếm/trang.
- **Luồng lỗi:** `NOT_FOUND` khi project không tồn tại.
- **Hậu điều kiện:** trạng thái làm việc = bản lưu hiện hành.
- **Quyền thực hiện:** mọi vai trò có quyền xem project.

### 3.7. Nhóm 6 — Module LEGACY

Các use case dưới đây mô tả hành vi **đang chạy** của các module `clean-rules`, `versions`, `lineage`, `exports`. Chúng được đặc tả ở đây để không mất dấu vết nghiệp vụ khi tái cấu trúc, **nhưng không nằm trong phạm vi nghiệm thu đợt tái cấu trúc này** (mục 3.31.5 của phần 2). Việc chuyển chúng vào kiến trúc mới hoặc thu hồi khỏi phạm vi sản phẩm là quyết định còn mở.

#### UC-28. Xem, xem trước và áp dụng clean rules

- **Actor:** theo ma trận quyền CASL hiện tại — `admin` toàn quyền; workspace `owner` toàn quyền; `editor` được `create/read/update/execute/export` nhưng **không** được `delete` Dataset.
- **Tiền điều kiện:** dataset tồn tại.
- **Input:** danh sách rule (loại rule, cột, tham số), chế độ `preview` hoặc `apply`.
- **Luồng chính (preview):** chạy rule trên bản sao, trả về số dòng bị ảnh hưởng và giá trị trước/sau — không ghi vào dataset.
- **Luồng chính (apply):** ghi thay đổi vào dataset, ghi lại số dòng gốc bị tác động.
- **Luồng lỗi:** `VALIDATION_ERROR` khi rule không hợp lệ với cột; `NOT_FOUND` khi dataset không tồn tại; lỗi thực thi rule → báo lỗi kèm số dòng bị tác động.
- **Hậu điều kiện (apply):** dataset đã thay đổi; dữ liệu gốc trên Storage **không** đổi.
- **Ghi chú phạm vi:** chức năng này trùng với phạm vi DQ-05 đã **hoãn** (mục 3.5.5 của phần 2). Cần chốt giữ ngoài phạm vi nghiệm thu hay thu hồi khỏi phạm vi sản phẩm.

#### UC-29. Phiên bản dataset: commit, diff, rollback

- **Actor:** theo ma trận quyền CASL hiện tại (`owner`/`editor` được `create/read/update/execute`).
- **Tiền điều kiện:** dataset tồn tại.
- **Input:** số phiên bản (cho diff/rollback), danh sách phiên bản.
- **Luồng chính:**
  - `commit` — chụp snapshot trạng thái dataset, sinh số phiên bản tăng dần.
  - `list` — trả về danh sách phiên bản.
  - `get` — trả về nội dung một phiên bản.
  - `diff` — so sánh hai phiên bản, trả về tập khác biệt.
  - `rollback` — khôi phục dataset về một phiên bản đã chọn.
- **Luồng lỗi:** `NOT_FOUND` khi dataset hoặc số phiên bản không tồn tại; `VALIDATION_ERROR` khi số phiên bản không hợp lệ.
- **Hậu điều kiện:** rollback đưa dataset về trạng thái phiên bản đã chọn; dữ liệu gốc trên Storage không đổi.
- **Ghi chú phạm vi:** cơ chế snapshot Merkle **không** được đưa vào kiến trúc mới ở đợt này; mục đích sử dụng lại còn mở.

#### UC-30. Xem đồ thị lineage và kiểm tra toàn vẹn

- **Actor:** theo ma trận quyền CASL hiện tại (`owner`/`editor` được `read`/`execute`).
- **Tiền điều kiện:** dataset có dữ liệu lineage đã ghi vào Neo4j.
- **Input:** `dataset_id`, `node_id` (cho upstream/downstream).
- **Luồng chính:**
  - `getLineageGraph` — trả về đồ thị lineage của dataset.
  - `getUpstream` / `getDownstream` — trả về chuỗi nguồn/đích của một node.
  - `verifyIntegrity` — kiểm tra tính toàn vẹn của lineage, trả kết quả kiểm tra.
- **Luồng lỗi:** `NOT_FOUND` khi dataset/node không tồn tại; `DEPENDENCY_UNAVAILABLE` khi Neo4j không sẵn sàng.
- **Hậu điều kiện:** không thay đổi trạng thái.
- **Ghi chú phạm vi:** đồ thị Neo4j **không** được đưa vào kiến trúc mới ở đợt này. Worker `outbox-processor` đồng bộ lineage sang Neo4j là hạ tầng của module LEGACY.

#### UC-31. Xuất CSV, xuất bảo mật và lịch sử xuất

- **Actor:** theo ma trận quyền CASL hiện tại (`owner`/`editor` được `export`).
- **Tiền điều kiện:** dataset tồn tại.
- **Input:** định dạng xuất, tham số lọc/tùy chọn (cho CSV); mã hoặc khoá công khai (cho xuất bảo mật).
- **Luồng chính:**
  - `exportCsvStream` — stream CSV của dataset về client.
  - `exportSecureStream` — sinh tệp mã hoá/ký, ghi lịch sử xuất.
  - `getExportHistory` — trả lịch sử các lần xuất.
- **Luồng lỗi:** `NOT_FOUND` khi dataset không tồn tại; `VALIDATION_ERROR` khi tham số xuất không hợp lệ; `DEPENDENCY_UNAVAILABLE` khi lưu trữ file xuất lỗi.
- **Hậu điều kiện:** file xuất được lưu trên Storage; lịch sử xuất được ghi lại.
- **Ghi chú phạm vi:** module `exports` được đánh dấu LEGACY. Tính năng xuất báo cáo PDF của sản phẩm mới (UC-26) là **chức năng khác**, thuộc module `reports` mới, không thuộc module này.

### 3.8. Ma trận quyền theo use case và hệ quả đã biết

| Use case | WS-OWNER | PROJ-OWNER | PROJ-MEMBER | PROJ-VIEWER |
|---|---|---|---|---|
| UC-01 Tạo workspace | ✔ (trở thành Owner) | — | — | — |
| UC-02 Sửa workspace | ✔ | — | — | — |
| UC-03 Thêm thành viên workspace | ✔ | — | — | — |
| UC-04 Xóa thành viên workspace | ✔ | — | — | — |
| UC-05 Tạo project | ✔ | — | — | — |
| UC-06 Quản lý thành viên project | ✔ | ✔ | — | — |
| UC-07 Rời workspace | ✔ (chuyển quyền trước) | — | ✔ (tự rời) | — |
| UC-08 Import file | ✔ | ✔ | — | — |
| UC-09 Chọn sheet | ✔ | ✔ | ✔ | ✔ |
| UC-10 Sửa tên cột | ✔ | ✔ | ✔ | — (chỉ xem cảnh báo) |
| UC-11 Xóa dòng | ✔ | ✔ | ✔ | — |
| UC-12 Reset Dataset | ✔ | ✔ | ✔ | — |
| UC-13 Xem thông tin dataset | ✔ | ✔ | ✔ | ✔ |
| UC-14 Xem bảng dữ liệu | ✔ | ✔ | ✔ | ✔ |
| UC-15 Lọc | ✔ | ✔ | ✔ | ✔ |
| UC-16 Sắp xếp | ✔ | ✔ | ✔ | ✔ |
| UC-17 Tìm kiếm | ✔ | ✔ | ✔ | ✔ |
| UC-18 Sửa ô | ✔ | ✔ | ✔ | — |
| UC-19 Cấu hình cột phân tích | ✔ | ✔ | ✔ | — |
| UC-20 Chạy phân tích | ✔ | ✔ | ✔ | — |
| UC-21 Xem trạng thái job AI | ✔ | ✔ | ✔ | ✔ |
| UC-22 Thử lại AI | ✔ | ✔ | ✔ | — |
| UC-23 Tạo Tổng kết | ✔ | ✔ | ✔ | — |
| UC-24 Xem bằng chứng ô | ✔ | ✔ | ✔ | ✔ |
| UC-25 Lưu project | ✔ | ✔ | ✔ | — |
| UC-26 Tải PDF | ✔ | ✔ | ✔ | ✔ |
| UC-27 Khôi phục project | ✔ | ✔ | ✔ | ✔ |

**Hệ quả đã biết của quyết định "chỉ Owner được import file" (UC-08).** Cần người dùng xác nhận lại trước khi chốt Phần 3:

1. **Project Member có thể vào project hoàn toàn trống.** Vì chỉ `WS-OWNER`/`PROJ-OWNER` được import, một `PROJ-MEMBER` được thêm vào project chưa có dataset sẽ **không có gì để làm** cho tới khi Owner import. Điều này làm suy yếu ý nghĩa của quyền thao tác dữ liệu của `PROJ-MEMBER`.
2. **Không có đường nâng quyền nếu Project Owner vắng mặt.** Chỉ `WS-OWNER` tạo project và chỉ `WS-OWNER`/`PROJ-OWNER` import → nếu Project Owner rời workspace, `WS-OWNER` tiếp quản nên vẫn import được; nhưng nếu `WS-OWNER` cũng rời (sau khi chuyển quyền), người mới làm Workspace Owner kế thừa toàn quyền → vẫn import được. Rủi ro thực tế là thấp.
3. **Phương án thay thế nếu muốn `PROJ-MEMBER` import:** cho phép `PROJ-MEMBER` import nhưng **chỉ khi project đã có dataset** (tức chỉ được thay thế khi file đã tồn tại?) — không khả thi vì quy tắc "không cho thay thế file". Hoặc: cho phép `PROJ-MEMBER` import **sheet đầu tiên** rồi `PROJ-OWNER` xác nhận — phức tạp. Hoặc giữ nguyên quyết định hiện tại và coi `PROJ-MEMBER` là vai trò "thao tác sau khi Owner đã nạp dữ liệu".
4. **Rủi ro bảo mật:** hạn chế import ở Owner giảm bề mặt tấn công (file upload là vector rủi ro) — đây là lý do hợp lý cho quyết định này.

**Hệ quả của việc `PROJ-VIEWER` xem được bằng chứng mức ô (UC-24).** Bằng chứng chứa giá trị ô của dữ liệu nghiệp vụ đã nằm trong hệ thống. `PROJ-VIEWER` vốn đã được quyền xem toàn bộ bảng dữ liệu tại Data Views (UC-14), nên việc cho xem bằng chứng ô **không mở rộng đáng kể** phạm vi dữ liệu họ thấy. Ranh giới quan trọng là: bằng chứng **không** được gửi ra ngoài cho AI nếu chưa che PII (mục 3.10 của phần 12).

**Quy ước lỗi xuyên suốt.** Mọi use case đều tuân thủ nguyên tắc: lỗi nghiệp vụ trả về mã lỗi ổn định (mục 3.1) để frontend và test không phải phân tích message. Trường hợp "chưa đủ điều kiện để tính" (ví dụ thiếu số mẫu tối thiểu) **không phải lỗi** — trả về kết quả kèm trạng thái "không tính được" và lý do cụ thể.

### 3.9. Vòng đời trạng thái

**Vòng đời kết quả phân tích (UC-20, UC-22, UC-23).**

```
Chưa phân tích
   └─(UC-20)→ Đang chạy → Đã phân tích (fresh)
                    │            │
                    │            ├─(đổi đầu vào: xóa dòng, sửa cấu hình, đổi sheet, đổi tập cột…)
                    │            │         └─→ Đã phân tích (stale) ──(UC-20 lại)→ Đang chạy
                    │            │
                    │            └─(AI lỗi)→ Đã phân tích, thiếu phần AI ──(UC-22)→ AI đang chạy nền
                    │
                    └─(lỗi phân tích hệ thống)→ Lỗi ──(UC-20 lại)→ Đang chạy
```

- **fresh** — `input_fingerprint` khớp đầu vào hiện tại → có thể tạo Tổng kết mới.
- **stale** — fingerprint lệch → **không** xóa khỏi database; mở Data Analysis & Detection yêu cầu chạy lại; mở Tổng kết bị từ chối tạo mới.
- **cảnh báo sửa ô** — khi có sửa ô sau lần phân tích, kết quả **giữ** và cho phép tạo Tổng kết kèm cảnh báo "kết quả có thể không còn khớp" (quy tắc `keep` + `warn_only`). Trạng thái này **không** là stale theo fingerprint.

**Vòng đời job AI (UC-20, UC-21, UC-22).**

```
pending ──(worker nhận)──→ running ──→ succeeded
   │                          │
   │                          ├─(lỗi tạm thời, attempt < 2)──→ pending (retry)
   │                          │
   │                          └─(lỗi 4xx, hoặc hết lượt retry)──→ failed
   └─(API restart, job quá hạn)──→ pending (đếm lại attempt) | failed
```

**Vòng đời bản lưu project (UC-25, UC-27).**

- Chỉ có **một** bản lưu hiện hành cho mỗi project.
- Lưu B thay bản hiện hành A → B trở thành hiện hành; quay lại A **không** khôi phục bản A cũ mà bắt đầu từ dữ liệu gốc, trạng thái mặc định.
- Reset (UC-12) **không** đổi bản lưu hiện hành; chỉ lần Lưu thành công tiếp theo mới cập nhật.

**Vòng đời tên cột (UC-10, UC-12).**

- Import (UC-08) → phát hiện lỗi tên cột theo từng sheet → **phân tích bị chặn** cho tới khi sửa (UC-10) → mở khoá phân tích.
- Reset (UC-12) → khôi phục tên từ file gốc → lỗi tên cột hiển thị lại → phân tích bị chặn lại.

## 4. Đầu vào và đầu ra

- **Đầu vào:** yêu cầu người dùng, kết quả các phần trước (phần 1, phần 2 v2, phần 6 v2, phần 12 v2) và mã nguồn/tài liệu hiện trạng liên quan.
- **Đầu ra:** kế hoạch lần đầu trong file v1 này; ghi rõ quyết định, lý do, phương án khác, trade-off, rủi ro, giới hạn và ảnh hưởng liên quan.

## 5. Điều kiện hoàn tất phần này

Mỗi tính năng có use case và quy tắc đủ rõ để thiết kế API, domain và test.

**Trạng thái:** đã đạt cho 27 use case của sản phẩm mới (UC-01 → UC-27) và 4 use case LEGACY (UC-28 → UC-31). Trước khi chuyển sang Phần 4 cần chốt 4 câu hỏi ở mục 6.2, trong đó câu 1 (hệ quả của quyết định import) là rủi ro nghiệp vụ đang mở.

## 6. Câu hỏi và phụ thuộc còn mở

### 6.1. Đã chốt ở v1

- Phạm vi UC, actor cho từng use case và ma trận quyền tại mục 3.8.
- Mức chi tiết use case: đầy đủ 7 trường (actor, tiền điều kiện, input, luồng chính, luồng lỗi, hậu điều kiện, quyền).
- `PROJ-VIEWER` được xem bằng chứng mức ô (UC-24).
- Import file chỉ do `WS-OWNER`/`PROJ-OWNER` thực hiện (UC-08).
- Module LEGACY **có** use case trong Phần 3 (UC-28 → UC-31), nằm ngoài phạm vi nghiệm thu đợt này.

### 6.2. Còn mở

1. **Hệ quả của quyết định "chỉ Owner được import file" (UC-08):** `PROJ-MEMBER` vào project trống sẽ không có gì để làm. Cần xác nhận giữ nguyên quyết định (với lý do giảm bề mặt tấn công của file upload) hay mở rộng cho `PROJ-MEMBER`. Xem mục 3.8.
2. **Thứ tự ưu tiên phát hiện trong Tổng kết (UC-23):** thứ tự ưu tiên hiện được ghi "theo mức độ ảnh hưởng" nhưng chưa chốt cụ thể — theo mức ảnh hưởng rồi theo số lượng ô lỗi, hay theo nhóm DQ, hay theo tần suất kiểm tra?
3. **Đơn vị cấu hình cho ngưỡng và tinh chỉnh tham số:** các ngưỡng có thể chỉnh được (IQR multiplier, Modified Z-score, tỷ lệ thiếu, IR, VIF) lấy đơn vị và phạm vi giá trị cụ thể — liên quan mục 6.2 phần 2 và mục 6.2 phần 6.
4. **Bố cục báo cáo PDF (UC-26):** số phát hiện tối đa, có phân trang bằng chứng trong PDF không, có phụ lục thống kê đầy đủ không.

### 6.3. Phụ thuộc bên ngoài

- Phụ thuộc vào `GEMINI_API_KEY`, cấu hình S3/R2 và MongoDB cho UC-08, UC-20, UC-21, UC-22.
- Phụ thuộc vào Neo4j cho UC-30 (module LEGACY).
- Phụ thuộc vào quyết định cuối cùng về module LEGACY ở mục 6.2 phần 2 (giữ ngoài phạm vi hay thu hồi).

## 7. Prompting log và lịch sử thay đổi

- **Xác nhận v1 / 2026-11-04:** `PROJ-VIEWER` được xem bằng chứng mức ô / Theo lựa chọn người dùng / Chốt UC-24 và dòng tương ứng trong ma trận quyền; ghi nhận rằng phạm vi dữ liệu không mở rộng so với quyền xem Data Views.
- **Xác nhận v1 / 2026-11-04:** Chỉ `WS-OWNER`/`PROJ-OWNER` được import file; `PROJ-MEMBER` không được / Theo lựa chọn người dùng / Chốt UC-08 và actor của UC-08; ghi nhận hệ quả tại mục 3.8 và câu hỏi mở tại mục 6.2.
- **Xác nhận v1 / 2026-11-04:** Module LEGACY **có** use case trong Phần 3 / Theo lựa chọn người dùng / Bổ sung nhóm 6 với UC-28 → UC-31, mô tả hành vi hiện hữu và ghi rõ nằm ngoài phạm vi nghiệm thu.
- **Xác nhận v1 / 2026-11-04:** Mức chi tiết use case đầy đủ 7 trường / Theo lựa chọn người dùng / Áp dụng cho toàn bộ 31 use case.
- **Yêu cầu:** Người dùng yêu cầu liệt kê toàn bộ các phần theo thứ tự thực hiện, tạo sẵn file v1, lần lượng hoàn thiện vòng đầu rồi tạo v2 khi có thay đổi tiếp theo.
- **v1 / 2026-11-02:** Tạo khung phần 3 / Chuẩn bị thảo luận tuần tự / Chỉ tạo tài liệu, chưa thực thi thay đổi backend hoặc dữ liệu.
