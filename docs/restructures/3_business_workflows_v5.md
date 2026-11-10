# 3. Luồng nghiệp vụ và use case

- **Version:** v5
- **Ngày tạo:** 2026-11-02
- **Cập nhật gần nhất:** 2026-11-06 (v5)
- **Trạng thái:** Đã đặc tả **66 use case** theo **11 nhóm nghiệp vụ** + **v5 bổ sung DQ-05 kích hoạt có điều kiện và AI đánh giá ma trận tương quan/VIF (UC-20 mở rộng, theo Phần 2 v7).**
- **Giai đoạn:** Feature
- **Thứ tự thực hiện:** Phần 3; sử dụng kết quả đã xác nhận của phần 1, 2 (v4), 6 (v3), 12 (v2).
- **Quan hệ với các phần khác:** mọi quyết định nghiệp vụ trong tài liệu này đều truy về `2_feature_catalog_v4.md` và `6_security_authorization_v3.md`; phần này **không** tạo quy tắc mới ngoài các quy tắc đã chốt, chỉ diễn giải chúng thành luồng thực thi.
- **Quan hệ với v1/v2/v3:** các bản cũ được giữ nguyên để đối chiếu. **v3 áp dụng quyết định thu hẹp phạm vi nghiệp vụ ngày 2026-11-05: hệ thống chỉ đọc và phân tích, không sửa/xóa/thay đổi bất kỳ dòng hay giá trị nào.** Năm use case bị gỡ (`UC-11`, `UC-18`, `UC-28`, `UC-29`, `UC-30`), `UC-12` được thu hẹp. **v4 áp dụng thêm 4 quyết định ngày 2026-11-05:** (1) **chỉ làm việc với file `.csv`** → gỡ `UC-09` (chọn sheet); (2) **phân trang cursor** thay offset; (3) **thêm nhóm 11 — Nhận xét kết quả** (`UC-68` → `UC-72`); (4) **AI chạy nội bộ** bằng model cục bộ, không gọi API bên ngoài. Xem mục 3.14.

> ### ⚠ 3.0. Quyết định nền tảng — hệ thống chỉ đọc (2026-11-05)
>
> Toàn bộ luồng nghiệp vụ trong tài liệu này được viết theo một nguyên tắc duy nhất: **hệ thống không bao giờ ghi vào dữ liệu người dùng**. Dữ liệu tải lên là bất biến; hệ thống đọc, phân tích, phát hiện vấn đề và báo cáo.
>
> | Use case | Xử lý 2026-11-05 |
> |---|---|
> | `UC-11` Xóa dòng | ❌ **Gỡ** |
> | `UC-12` Reset Dataset | ⚠️ **Thu hẹp** — chỉ khôi phục tên cột gốc |
> | `UC-18` Sửa ô | ❌ **Gỡ** |
> | `UC-28` Xem/xem trước/áp dụng clean rules | ❌ **Gỡ** |
> | `UC-29` Phiên bản dataset: commit/diff/rollback | ❌ **Gỡ** |
> | `UC-30` Đồ thị lineage + kiểm tra toàn vẹn | ❌ **Gỡ** |
>
> Chi tiết đầy đủ tại mục 3.14.

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

Danh sách actor trong mỗng use case ghi đúng tên vai trò, không ghi "ai có quyền" chung chung.

**Bổ sung ở v2 — vai trò hệ thống.** Nhóm xác thực (mục 3.10) bổ sung hai ký hiệu actor không thuộc phân cấp workspace/project:

| Ký hiệu | Ý nghĩa |
|---|---|
| `SYS-ADMIN` | Quản trị viên hệ thống (`user.role = 'admin'`). Chỉ dùng cho `ADMIN-01` và `ISSUE-04`. Không đọc dữ liệu/dataset/kết quả phân tích của project nào, không phải thành viên workspace, không nâng quyền nghiệp vụ |
| `SELF` | Chính người đang đăng nhập, thao tác trên tài khoản/phiên/thông báo/báo cáo sự cố của chính mình |

Các vai trò nghiệp vụ (`WS-OWNER`, `WS-MEMBER`, `PROJ-OWNER`, `PROJ-MEMBER`, `PROJ-VIEWER`) giữ nguyên ý nghĩa như v1, **trừ một bổ sung ở v2**: `WS-MEMBER` có quyền **đọc** ở cấp workspace (xem thông tin workspace, danh sách thành viên, tổng quan, danh sách project) — chốt ở phần 2 v3, mục 6.2c.

**Mẫu use case.** Mỗi use case ghi theo 7 trường cố định: Actor → Tiền điều kiện → Input → Luồng chính → Luồng lỗi → Hậu điều kiện → Quyền thực hiện.

**Quy ước lỗi.** Mọi lỗi nghiệp vụ trả về dạng thống nhất, tách **mã lỗi** khỏi **thông điệp hiển thị**:
- `VALIDATION_ERROR` — input sai định dạng hoặc vi phạm ràng buộc.
- `NOT_FOUND` — không tìm thấy tài nguyên, hoặc tài nguyên không thuộc phạm vi truy cập của người gọi.
- `FORBIDDEN` — người gọi có quyền xem nhưng không có quyền thao tác.
- `CONFLICT` — xung đột trạng thái (ví dụ lưu trên bản cũ khi đã có bản mới).
- `PRECONDITION_FAILED` — điều kiện nghiệp vụ chưa thoả (ví dụ sheet còn lỗi tên cột, đầu vào đã thay đổi).
- `LIMIT_EXCEEDED` — vượt giới hạn dung lượng/quota.
- `DEPENDENCY_UNAVAILABLE` — dịch vụ/phụ thuộc lỗi (AI engine cục bộ, R2, Kafka, dịch vụ gửi email).

Hai mã lỗi bổ sung ở v2 cho nhóm xác thực:
- `TOKEN_INVALID` — mã xác thực (OTP, token đặt lại mật khẩu, refresh token) không hợp lệ: sai mã, đã dùng, đã bị vô hiệu hoá hoặc đã bị thu hồi.
- `TOKEN_EXPIRED` — mã xác thực đã hết hạn.

`TOKEN_EXPIRED` tách khỏi `TOKEN_INVALID` để frontend biết chính xác hành động cần làm: hết hạn thì yêu cầu gửi mã mới, sai mã thì báo sai và đếm số lần thử.

Ngoài ra nhóm xác thực dùng thêm hai mã chuẩn của lớp xác thực, đã có trong mã nguồn hiện tại:
- `UNAUTHENTICATED` — chưa đăng nhập, access token không hợp lệ hoặc đã hết hạn.

Nguyên tắc: **không dùng `NOT_FOUND` để che giấu việc tài nguyên tồn tại nhưng người gọi không có quyền xem** — trả `FORBIDDEN` khi người gọi có quyền xem trong project nhưng không có quyền thao tác; trả `NOT_FOUND` khi thực sự không tồn tại.

**Phân tách trạng thái.** Ba khái niệm phải phân biệt rõ trong mọi use case:
- **Trạng thái làm việc** (working state) — trạng thái đang thao tác trên sheet hiện tại trong phiên làm việc: dòng đã xoá, tên cột đã sửa, ô đã sửa, cấu hình phân tích, bộ lọc/sắp xếp/tìm kiếm/trang.
- **Bản lưu hiện hành** (saved snapshot) — bản được lưu gần nhất của project, gắn với sheet đã lưu. Chỉ có **một** bản lưu hiện hành cho mỗi project, không giữ bản riêng cho từng sheet.
- **Kết quả phân tích** — thuộc bản lưu hiện hành, gắn với `input_fingerprint` của lần chạy.

**Quy tắc nhất quán cho thao tác trạng thái.** Mọi thao tác thay đổi trạng thái làm việc đều **không tự động lưu**. Việc lưu chỉ xảy ra qua UC-25.

**Tính bất biến của dữ liệu.** **Cập nhật 2026-11-05:** không use case nào ghi đè file gốc đã upload, **và không use case nào ghi vào dữ liệu nào cả**. Dữ liệu tải lên là bất biến trong suốt vòng đời project. Thao tác duy nhất còn lại trên dữ liệu là **đổi tên cột** (metadata, không phải giá trị ô) và **lọc/sắp xếp/tìm kiếm** (chỉ đổi hiển thị).

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
- **Input:** file **`.csv`** (tối đa 50 MB, hard-cap 500 MB/workspace).
- **Luồng chính:**
  1. Kiểm tra định dạng, dung lượng và quota workspace.
  2. Lưu file gốc vào Storage qua port Storage (R2, có local fallback) với extension `.csv`.
  3. Đọc và phân tích cấu trúc: nhận diện delimiter trong `,` `;` `\t` `|`; bỏ BOM; hỗ trợ `\r\n` và `\n`.
  4. Kiểm tra tên cột **của toàn bộ cột**: tên rỗng hoặc trùng → ghi cảnh báo, **không chặn import**.
  5. Tách bản ghi dữ liệu vào cơ sở dữ liệu bằng **streaming**, chèn lô 5.000 bản ghi (không nạp toàn bộ file vào RAM).
  6. Gắn dataset vào project. **Không có khái niệm sheet** — toàn bộ file là bảng làm việc.
- **Luồng lỗi:**
  - `VALIDATION_ERROR` — **định dạng không phải `.csv`** (thông báo rõ yêu cầu xuất sang CSV), CSV không xác định được delimiter, dòng đầu không phải header hợp lệ (mục 3.26).
  - `LIMIT_EXCEEDED` — vượt 50 MB/file hoặc 500 MB/workspace.
  - `CONFLICT` — project đã có dataset.
  - `DEPENDENCY_UNAVAILABLE` — lỗi Storage. **File tạm phải được dọn** khỏi bucket nếu thất bại giữa chừng.
- **Hậu điều kiện:**
  - File gốc được lưu với extension `.csv`; dataset gắn vào project.
  - Tồn tại danh sách cảnh báo tên cột.
  - **Chưa** tạo bản lưu hiện hành; trạng thái làm việc = trạng thái mặc định.
- **Quyền thực hiện:** `WS-OWNER`, `PROJ-OWNER`. **`PROJ-MEMBER` không được import** (quyết định đã chốt ở lượt thảo luận này).
- **Hệ quả cần lưu ý:** xem mục 3.8.

#### ~~UC-09. Chọn sheet làm việc~~ — **GỠ KHỎI PHẠM VI (2026-11-05)**

> **Quyết định:** Hệ thống **chỉ làm việc với file `.csv`** → một file CSV là một bảng duy nhất → **không còn khái niệm sheet**, không còn thao tác chọn sheet.
>
> - Không còn endpoint chọn sheet, không còn collection `dataset_sheet` (đã gộp vào `dataset` — Phần 8 v4).
> - Không còn trạng thái "sheet đang làm việc" → chỉ còn **"dataset đang làm việc"** của project.
> - **Cách thay thế:** người dùng có dữ liệu nhiều bảng thì tách thành nhiều project, mỗi project một file CSV — phù hợp với nguyên tắc "mỗi project chỉ chứa một file dữ liệu" đã chốt.

#### UC-10. Nhập hoặc chỉnh sửa tên cột rỗng/trùng

- **Actor:** `WS-OWNER`, `PROJ-OWNER`, `PROJ-MEMBER`.
- **Tiền điều kiện:** dataset đang làm việc có ít nhất một cột rỗng hoặc trùng tên.
- **Input:** danh sách `{ column_index, new_name }`.
- **Luồng chính:**
  1. Kiểm tra tên mới không rỗng và không trùng với tên cột khác **trong cùng dataset** (so sánh phân biệt hoa/thường và khoảng trắng, không tự trim hay đổi hoa/thường).
  2. Ghi tên mới vào trạng thái làm việc — **không** sửa file gốc.
  3. Chạy lại kiểm tra tên cột của dataset.
- **Luồng lỗi:**
  - `VALIDATION_ERROR` — tên mới rỗng hoặc trùng.
  - `PRECONDITION_FAILED` — không có lỗi tên cột nào để sửa (yêu cầu thừa).
  - `FORBIDDEN` — `PROJ-VIEWER` không được sửa tên cột (chỉ xem cảnh báo).
- **Hậu điều kiện:** lỗi tên cột được giải quyết → **mở khoá phân tích** (UC-15). Tên đã sửa là một phần của trạng thái làm việc, được lưu cùng bản project tại UC-25.
- **Quyền thực hiện:** `WS-OWNER`, `PROJ-OWNER`, `PROJ-MEMBER`.

#### ~~UC-11. Xóa dòng~~ — **GỠ KHỎI PHẠM VI (2026-11-05)**

> **Quyết định:** Xóa dòng bị **gỡ hoàn toàn**. Xem mục 3.14.
>
> - Không còn endpoint, không còn quyền `delete` trên dữ liệu, không còn test.
> - **Cách thay thế:** người dùng cần loại bỏ dòng thì xử lý ở hệ thống nguồn rồi tải lại file — hệ thống chỉ đọc và báo cáo.
> - Dữ liệu trong hệ thống **bất biến**: một bản ghi `dataset_record` chỉ được ghi đúng một lần lúc Import và không bao giờ bị sửa hay xoá.
> - Vì không có xóa dòng, các quy tắc phân tích loại giá trị thiếu/không hợp lệ **khỏi phép tính** (không khỏi dataset) trở nên đơn giản và minh bạch hơn.

#### UC-12. Reset Dataset — **THU HẸP (2026-11-05)**

- **Actor:** `WS-OWNER`, `PROJ-OWNER`, `PROJ-MEMBER`.
- **Tiền điều kiện:** project có dataset; dataset đang làm việc có **tên cột đã chỉnh sửa** trong trạng thái làm việc.
- **Input:** không có (reset trạng thái làm việc của dataset hiện tại).
- **Luồng chính:**
  1. **Khôi phục tên cột từ file gốc** → các lỗi tên cột rỗng/trùng **hiển thị lại**.
  2. Xóa cấu hình phân tích, bộ lọc, sắp xếp, tìm kiếm và trang đang xem.
  3. **Không** thay đổi bản lưu hiện hành.
- **Luồng lỗi:** `NOT_FOUND` khi project chưa có dataset.
- **Hậu điều kiện:**
  - Tên cột trong trạng thái làm việc bằng tên gốc từ file gốc; **dữ liệu không thay đổi** (dữ liệu luôn bằng dữ liệu gốc).
  - **Không** làm mất hiệu lực kết quả phân tích: `input_fingerprint` không chứa tên cột, nên Reset không làm đổi fingerprint.
  - Bản lưu hiện hành vẫn giữ nguyên cho tới lần Lưu thành công tiếp theo (UC-25).
- **Quyền thực hiện:** `WS-OWNER`, `PROJ-OWNER`, `PROJ-MEMBER`.
- **Phần bị gỡ so với v2 (2026-11-05):** khôi phục các dòng đã xóa (không còn dòng đã xóa) và hoàn tác ô đã sửa (không còn ô đã sửa).

#### UC-13. Xem thông tin dataset và schema

- **Actor:** mọi vai trò có quyền xem project.
- **Tiền điều kiện:** project có dataset.
- **Input:** không có.
- **Luồng chính:** trả về tên dataset (lấy từ tên file), kiểu dữ liệu đã nhận diện, danh sách cột kèm kiểu, cảnh báo tên cột, tổng số dòng.
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
  3. Trả về trang dữ liệu kèm tổng số khớp, kèm **số dòng gốc** của mỗi bản ghi để tham chiếu bằng chứng và vị trí lỗi chính xác.
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
- **Hậu điều kiện:** bộ lọc chỉ thay đổi **hiển thị**; không sửa dữ liệu, **không** giới hạn phạm vi phân tích (phân tích luôn dùng toàn bộ sheet đang làm việc).
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

#### ~~UC-18. Sửa ô~~ — **GỠ KHỎI PHẠM VI (2026-11-05)**

> **Quyết định:** Sửa ô bị **gỡ hoàn toàn**. Xem mục 3.14.
>
> - Không còn endpoint `PATCH .../records/{rowIndex}`, không còn module `cell-edit`, không còn quyền ghi ô.
> - **Cách thay thế:** người dùng sửa ở hệ thống nguồn rồi tải lại file — hệ thống chỉ đọc và báo cáo.
> - Mọi quy tắc liên quan đến sửa ô đều mất hiệu lực, gồm: quy tắc `keep` + `warn_only` khi kết quả phân tích không còn khớp; việc ghi sửa ô vào trạng thái lưu/khôi phục project; quyền `PROJ-MEMBER` được sửa ô.
> - **Hệ quả tích cực:** không còn trạng thái "kết quả phân tích không còn khớp với dữ liệu", vì dữ liệu không bao giờ đổi. Cơ chế `stale` chỉ còn một nguyên nhân: đổi cấu hình phân tích hoặc đổi sheet/cột.

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
  2. Chạy các phép tính: thống kê mô tả, DQ-01..DQ-04, **DQ-05 có điều kiện** (`unassessed` khi chưa có quy tắc được xác nhận; `assessed` kiểm theo từng dòng khi đã có quy tắc — Phần 2 v7 mục 3.5.5), **ma trận tương quan + VIF** (Phần 2 v7 mục 3.23.1–3.23.2), mất cân bằng lớp, phân tích thời gian.
  3. Lưu kết quả cùng `input_fingerprint`; sinh bằng chứng mức ô vào collection riêng. Ma trận tương quan và bảng VIF là một phần của kết quả đã lưu (đầu vào bắt buộc cho AI đánh giá).
  4. Trả kết quả hệ thống **ngay** cho người gọi.
  5. Tạo job AI (nếu AI được bật) để chạy nền — payload gồm thống kê + ma trận/VIF + kết quả kiểm tra quy tắc DQ-05 (nếu có) + tối đa 20 ô lỗi/cột **đã che PII**.
- **Luồng chính — phần AI (bất đồng bộ):**
  6. Worker nền nhận job từ topic Kafka `ai.jobs` → dựng payload (thống kê tổng hợp + **ma trận tương quan + bảng VIF** + tối đa 20 ô lỗi/cột **đã che PII**) → gọi **AI cục bộ** qua `AiInferencePort` (`Qwen3-14B`, timeout 180s, retry tối đa 2 lần cho lỗi tạm thời).
  6b. AI trả thêm **nhận xét ma trận tương quan/VIF** (cặp đáng chú ý, cột VIF > 5/> 10, cảnh báo giới hạn, gợi ý bước tiếp theo — cấm kết luận nhân quả/DQ-05/yêu cầu xóa cột; Phần 2 v7 mục 3.23.3).
  7. Kiểm chứng phản hồi: đúng schema → không vượt quyền backend về mức ảnh hưởng/trạng thái xác minh → mọi tham chiếu bằng chứng **và mọi số trích từ ma trận/VIF** tồn tại → số liệu khớp thống kê đã gửi.
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
  3. Nếu có cảnh báo "kết quả có thể không còn khớp" → cho phép tạo Tổng kết từ kết quả hiện có kèm cảnh báo.
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
  2. Ghi bản lưu mới chứa: sheet làm việc; **tên cột** trong trạng thái làm việc; tập cột được chọn phân tích và cột nhãn; kết quả Data Analysis & Detection; nội dung Tổng kết; bộ lọc, sắp xếp, tìm kiếm và trang đang xem. ~~trạng thái dữ liệu làm việc kèm số dòng gốc đã xóa và các ô đã sửa~~ — **gỡ 2026-11-05**, dữ liệu luôn bằng dữ liệu gốc.
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
  2. Khôi phục đầy đủ: tên cột, cấu hình phân tích, kết quả phân tích, nội dung Tổng kết, bộ lọc/sắp xếp/tìm kiếm/trang. Dữ liệu được đọc từ nguồn bất biến nên không cần khôi phục.
- **Luồng lỗi:** `NOT_FOUND` khi project không tồn tại.
- **Hậu điều kiện:** trạng thái làm việc = bản lưu hiện hành.
- **Quyền thực hiện:** mọi vai trò có quyền xem project.

### 3.7. Nhóm 6 — Module LEGACY

Các use case dưới đây mô tả hành vi **đang chạy** của các module `exports` (và, trước đây, `clean-rules`, `versions`, `lineage`).

**Cập nhật 2026-11-05:** ba module `clean-rules`, `versions`, `lineage` đã bị **gỡ khỏi phạm vi sản phẩm** (mục 3.14). Các use case `UC-28`, `UC-29`, `UC-30` tương ứng bị gỡ — chúng mô tả thao tác **ghi vào dữ liệu** (áp dụng rule, rollback) hoặc phục vụ cơ chế khôi phục dữ liệu (lineage toàn vẹn). Chỉ còn `UC-31` (xuất CSV) được giữ là LEGACY.

Các use case bị gỡ được giữ lại **dưới dạng lịch sử**, để không mất dấu vết nghiệp vụ khi tái cấu trúc.

#### ~~UC-28. Xem, xem trước và áp dụng clean rules~~ — **GỠ KHỎI PHẠM VI (2026-11-05)**

> **Quyết định:** Module `clean-rules` bị **xoá hoàn toàn**. Xem mục 3.14.
>
> - Luồng `apply` (ghi thay đổi vào dataset) vi phạm nguyên tắc dữ liệu bất biến → bị gỡ.
> - Luồng `preview` cũng **không được giữ**: ngay cả khi không ghi, nó dựa trên khái niệm "rule làm sạch dữ liệu" — một khái niệm không còn tồn tại trong phạm vi mới. Hệ thống **phát hiện vấn đề** và **đề xuất** (mục 3.31.7 của phần 2), nhưng không định nghĩa và không áp dụng rule.
> - Điều này cũng giải quyết triệt để câu hỏi DQ-05 đã **hoãn** từ lâu (mục 3.5.5 của phần 2): DQ-05 vẫn được phát hiện ở mức **phát hiện vấn đề**, nhưng **không có tính năng nhập/cấu hình/aply rule** — phạm vi sản phẩm không bao gồm rule engine.
> - Hệ quả kỹ thuật: xoá `POST /datasets/:id/rules/preview` và `POST /datasets/:id/rules/apply`; xoá module `clean-rules` khỏi monorepo mới.

#### ~~UC-29. Phiên bản dataset: commit, diff, rollback~~ — **GỠ KHỎI PHẠM VI (2026-11-05)**

> **Quyết định:** Module `versions` bị **xoá hoàn toàn**. Xem mục 3.14.
>
> - `rollback` là thao tác **ghi đè dữ liệu** → vi phạm nguyên tắc dữ liệu bất biến.
> - `commit`/`diff` chỉ có nghĩa nếu có nhiều trạng thái dữ liệu để so sánh. Với dữ liệu bất biến, **mọi lần phân tích đều mô tả cùng một tập dữ liệu** → không có gì để snapshot hay diff.
> - **Hệ quả kỹ thuật:** xoá `POST /datasets/:id/versions`, `GET /datasets/:id/versions`, `GET /datasets/:id/versions/:n`, `POST /datasets/:id/versions/:n/rollback`; xoá collection `dataset_version`; xoá cơ chế hash Merkle (`version_hash`); gỡ `PROJ-06`/`PROJ-07`/`PROJ-08` khỏi danh mục tính năng.
> - **Thay thế bằng gì:** audit log vẫn ghi "ai đã làm gì" (hoạt động người dùng, thay đổi quyền) — nhưng không phải snapshot dữ liệu. Người dùng xem được lịch sử hành động, không có "phiên bản dữ liệu" để quay lại.

#### ~~UC-30. Xem đồ thị lineage và kiểm tra toàn vẹn~~ — **GỠ KHỎI PHẠM VI (2026-11-05)**

> **Quyết định:** Module `lineage` bị **xoá hoàn toàn**. Xem mục 3.14.
>
> - Đồ thị lineage mô tả quan hệ giữa các **phiên bản dữ liệu** (dữ liệu này sinh ra từ phiên bản nào). Không có phiên bản → không có lineage.
> - `verifyIntegrity` kiểm tra hash chuỗi phiên bản (Merkle) — cơ chế này không còn tồn tại.
> - **Hệ quả kỹ thuật:** xoá toàn bộ hạ tầng Neo4j khỏi kiến trúc mới; worker đồng bộ lineage không được xây dựng; không còn collection liên quan.
> - Tính năng tương đương trong phạm vi mới: **bằng chứng mức ô** (mục 3.31.1 của phần 2) cho biết vấn đề nằm ở dòng/cột nào — nhưng đây là bằng chứng trong **một** lần phân tích, không phải chuỗi nguồn–đích qua nhiều phiên bản.

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
| UC-10 Sửa tên cột | ✔ | ✔ | ✔ | — (chỉ xem cảnh báo) |
| UC-12 Reset Dataset (chỉ khôi phục tên cột) | ✔ | ✔ | ✔ | — |
| UC-13 Xem thông tin dataset | ✔ | ✔ | ✔ | ✔ |
| UC-14 Xem bảng dữ liệu | ✔ | ✔ | ✔ | ✔ |
| UC-15 Lọc | ✔ | ✔ | ✔ | ✔ |
| UC-16 Sắp xếp | ✔ | ✔ | ✔ | ✔ |
| UC-17 Tìm kiếm | ✔ | ✔ | ✔ | ✔ |
| UC-19 Cấu hình cột phân tích | ✔ | ✔ | ✔ | — |
| UC-20 Chạy phân tích | ✔ | ✔ | ✔ | — |
| UC-21 Xem trạng thái job AI | ✔ | ✔ | ✔ | ✔ |
| UC-22 Thử lại AI | ✔ | ✔ | ✔ | — |
| UC-23 Tạo Tổng kết | ✔ | ✔ | ✔ | — |
| UC-24 Xem bằng chứng ô | ✔ | ✔ | ✔ | ✔ |
| UC-25 Lưu project | ✔ | ✔ | ✔ | — |
| UC-26 Tải PDF | ✔ | ✔ | ✔ | ✔ |
| UC-27 Khôi phục project | ✔ | ✔ | ✔ | ✔ |

**Ma trận quyền bổ sung ở v2** — nhóm 7 đến nhóm 10. Cột `WS-MEMBER` ở đây ghi quyền **đọc** cấp workspace đã chốt ở v2 (xem thông tin workspace, danh sách thành viên, tổng quan, danh sách project).

| Use case | WS-OWNER | WS-MEMBER | PROJ-OWNER | PROJ-MEMBER | PROJ-VIEWER |
|---|---|---|---|---|---|
| UC-32 Đăng ký tài khoản | công khai | công khai | công khai | công khai | công khai |
| UC-33 Đăng nhập email/mật khẩu | công khai | công khai | công khai | công khai | công khai |
| UC-34 Đăng nhập Google | công khai | công khai | công khai | công khai | công khai |
| UC-35 Ghi nhớ đăng nhập | công khai | công khai | công khai | công khai | công khai |
| UC-36 Quên mật khẩu (gửi OTP) | công khai | công khai | công khai | công khai | công khai |
| UC-37 Đặt lại mật khẩu | công khai | công khai | công khai | công khai | công khai |
| UC-38 Thay đổi mật khẩu | — | — | — | — | — |
| UC-39 Xem phiên đăng nhập | — | — | — | — | — |
| UC-40 Chi tiết phiên đăng nhập | — | — | — | — | — |
| UC-41 Đăng xuất thiết bị khác | — | — | — | — | — |
| UC-42 Đăng xuất thiết bị hiện tại | — | — | — | — | — |
| UC-43 Làm mới access token | công khai | công khai | công khai | công khai | công khai |
| UC-44 Xem hồ sơ cá nhân | — | — | — | — | — |
| UC-45 Cập nhật hồ sơ cá nhân | — | — | — | — | — |
| UC-46 Xem hồ sơ người dùng | — | — | — | — | — |
| UC-47 Danh sách workspace | ✔ | ✔ (đọc) | ✔ | ✔ | ✔ |
| UC-48 Chi tiết workspace | ✔ | ✔ (đọc) | ✔ | ✔ | ✔ |
| UC-49 Xóa workspace | ✔ | — | — | — | — |
| UC-50 Danh sách thành viên workspace | ✔ | ✔ (đọc) | ✔ | ✔ | ✔ |
| UC-51 Nhượng quyền Workspace Owner | ✔ | — | — | — | — |
| UC-52 Danh sách project | ✔ | ✔ | ✔ | ✔ | ✔ |
| UC-53 Thông tin cơ bản project | ✔ | ✔ | ✔ | ✔ | ✔ |
| UC-54 Cập nhật project | ✔ | — | ✔ | — | — |
| UC-55 Xóa project | ✔ | — | — | — | — |
| UC-56 Tìm thành viên trong project | ✔ | — | ✔ | — | — |
| UC-57 Lịch sử phiên bản project | ✔ | ✔ | ✔ | ✔ | ✔ |
| UC-58 Chi tiết phiên bản project | ✔ | ✔ | ✔ | ✔ | ✔ |
| UC-59 Quay lại phiên bản project | ✔ | — | ✔ | — | — |
| UC-60 Trung tâm thông báo | — | — | — | — | — |
| UC-61 Chi tiết thông báo | — | — | — | — | — |
| UC-62 Bật/tắt thông báo | — | — | — | — | — |
| UC-63 Nhận thông báo | hệ thống | hệ thống | hệ thống | hệ thống | hệ thống |
| UC-64 Tạo báo cáo sự cố | — | — | — | — | — |
| UC-65 Danh sách báo cáo của tôi | — | — | — | — | — |
| UC-66 Chi tiết báo cáo | ✔ (`SYS-ADMIN`) | ✔ (`SYS-ADMIN`) | ✔ (`SYS-ADMIN`) | ✔ (`SYS-ADMIN`) | ✔ (`SYS-ADMIN`) |
| UC-67 Duyệt báo cáo | ✔ (`SYS-ADMIN`) | ✔ (`SYS-ADMIN`) | ✔ (`SYS-ADMIN`) | ✔ (`SYS-ADMIN`) | ✔ (`SYS-ADMIN`) |

**Quy tắc đọc ma trận v2.**
- Dấu `—` ở các use case tài khoản (UC-38 → UC-45, UC-60 → UC-62, UC-64, UC-65) nghĩa là thao tác **tự thao tác trên chính mình** — ai đang đăng nhập cũng làm được, không phụ thuộc vai trò workspace/project. Không phải "không ai được phép".
- Các use case `công khai` (UC-32 → UC-34, UC-36, UC-37, UC-43) không cần access token.
- UC-39 → UC-43 và UC-44, UC-45: chỉ người đang đăng nhập, và **chỉ trên dữ liệu của chính mình**. `SYS-ADMIN` không có quyền xem phiên đăng nhập hoặc hồ sơ của người khác.
- UC-55 (xóa project): **chỉ `WS-OWNER`**. `PROJ-OWNER` không tự xoá được project của mình.
- UC-67 (duyệt báo cáo): chỉ `SYS-ADMIN`. Không có vai trò nghiệp vụ nào trong workspace/project thay thế được.

**Hệ quả đã biết của quyết định "chỉ Owner được import file" (UC-08).** Cần người dùng xác nhận lại trước khi chốt Phần 3:

1. **Project Member có thể vào project hoàn toàn trống.** Vì chỉ `WS-OWNER`/`PROJ-OWNER` được import, một `PROJ-MEMBER` được thêm vào project chưa có dataset sẽ **không có gì để làm** cho tới khi Owner import. Điều này làm suy yếu ý nghĩa của quyền thao tác dữ liệu của `PROJ-MEMBER`.
2. **Không có đường nâng quyền nếu Project Owner vắng mặt.** Chỉ `WS-OWNER` tạo project và chỉ `WS-OWNER`/`PROJ-OWNER` import → nếu Project Owner rời workspace, `WS-OWNER` tiếp quản nên vẫn import được; nhưng nếu `WS-OWNER` cũng rời (sau khi chuyển quyền), người mới làm Workspace Owner kế thừa toàn quyền → vẫn import được. Rủi ro thực tế là thấp.
3. **Phương án thay thế nếu muốn `PROJ-MEMBER` import:** cho phép `PROJ-MEMBER` import nhưng **chỉ khi project đã có dataset** (tức chỉ được thay thế khi file đã tồn tại?) — không khả thi vì quy tắc "không cho thay thế file". Hoặc: cho phép `PROJ-MEMBER` import **sheet đầu tiên** rồi `PROJ-OWNER` xác nhận — phức tạp. Hoặc giữ nguyên quyết định hiện tại và coi `PROJ-MEMBER` là vai trò "thao tác sau khi Owner đã nạp dữ liệu".
4. **Rủi ro bảo mật:** hạn chế import ở Owner giảm bề mặt tấn công (file upload là vector rủi ro) — đây là lý do hợp lý cho quyết định này.

**Hệ quả của việc `PROJ-VIEWER` xem được bằng chứng mức ô (UC-24).** Bằng chứng chứa giá trị ô của dữ liệu nghiệp vụ đã nằm trong hệ thống. `PROJ-VIEWER` vốn đã được quyền xem toàn bộ bảng dữ liệu tại Data Views (UC-14), nên việc cho xem bằng chứng ô **không mở rộng đáng kể** phạm vi dữ liệu họ thấy. Ranh giới quan trọng là: bằng chứng **không** được gửi ra ngoài cho AI nếu chưa che PII (mục 3.10 của phần 12).

**Ghi chú về mẫu 7 trường ở v1.** Các UC-06, UC-07, UC-20 dùng tiêu đề biến thể ("Luồng chính — theo hành động", "Luồng lỗi — phần AI"…) để tách nhiều nhánh trong cùng một trường — vẫn đủ 7 trường. Bốn UC LEGACY (UC-28 → UC-31) thay trường "Quyền thực hiện" bằng "Ghi chú phạm vi" vì chúng nằm ngoài phạm vi nghiệm thu và không gắn với mô hình vai trò workspace/project. **Giữ nguyên như v1** — chốt quyền cho các UC LEGACY sẽ thuộc phạm vi thu hồi module LEGACY (phần 2 v3, mục 6.2).

**Quy ước lỗi xuyên suốt.** Mọi use case đều tuân thủ nguyên tắc: lỗi nghiệp vụ trả về mã lỗi ổn định (mục 3.1) để frontend và test không phải phân tích message. Trường hợp "chưa đủ điều kiện để tính" (ví dụ thiếu số mẫu tối thiểu) **không phải lỗi** — trả về kết quả kèm trạng thái "không tính được" và lý do cụ thể.

### 3.9. Vòng đời trạng thái

**Vòng đời kết quả phân tích (UC-20, UC-22, UC-23).**

```
Chưa phân tích
   └─(UC-20)→ Đang chạy → Đã phân tích (fresh)
                    │            │
                    │            ├─(đổi đầu vào: sửa cấu hình, đổi sheet, đổi tập cột…)
                    │            │         └─→ Đã phân tích (stale) ──(UC-20 lại)→ Đang chạy
                    │            │
                    │            └─(AI lỗi)→ Đã phân tích, thiếu phần AI ──(UC-22)→ AI đang chạy nền
                    │
                    └─(lỗi phân tích hệ thống)→ Lỗi ──(UC-20 lại)→ Đang chạy
```

- **fresh** — `input_fingerprint` khớp đầu vào hiện tại → có thể tạo Tổng kết mới.
- **stale** — fingerprint lệch → **không** xóa khỏi database; mở Data Analysis & Detection yêu cầu chạy lại; mở Tổng kết bị từ chối tạo mới.
- ~~**cảnh báo sửa ô**~~ — **Gỡ 2026-11-05.** Không còn sửa ô nên không còn trạng thái "kết quả có thể không còn khớp". Chỉ còn hai trạng thái: `fresh` và `stale`.

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

**Vòng đời phiên đăng nhập (UC-33, UC-41, UC-42, UC-43).**

```
active ──(đăng xuất: thiết bị hiện tại / thiết bị khác)──→ revoked
   │
   └─(làm mới token)──→ revoked (phiên cũ) + active (phiên mới, rotation)
```

- Phiên `active` dùng được để làm mới access token. Phiên `revoked` không.
- Khi rotation phát hiện refresh token đã bị thu hồi lại được dùng → **thu hồi toàn bộ phiên** của tài khoản (dấu hiệu token bị lộ).
- TTL 7 ngày → phiên hết hạn tự động.

**Vòng đời OTP đặt lại mật khẩu (UC-36, UC-37).**

```
(gửi) → pending (hết hạn 10 phút) → used
                │                        │
                ├─(hết hạn)→ expired     └─(dùng xong)→ xoá + thu hồi toàn bộ phiên
                ├─(sinh OTP mới)→ pending (OTP cũ vô hiệu hoá)
                └─(sai ≥ 3 lần)→ invalid (yêu cầu gửi lại)
```

**Vòng đời báo cáo sự cố (UC-64, UC-67).**

```
new ──(Admin chuyển in_progress)──→ in_progress ──→ resolved ──→ closed
 │                                        │
 └────────────────────────────────────────┘
   (Admin chuyển lại new = "Cần bổ sung" → người dùng sửa và gửi lại → về new)
```

- `new` — trạng thái khởi tạo khi người dùng gửi báo cáo. Cũng là trạng thái "Cần bổ sung" khi Admin yêu cầu bổ sung.
- Chuyển sang `new` từ `in_progress` tạo **thông báo bắt buộc** cho người gửi báo cáo.
- Người dùng được sửa và gửi lại báo cáo khi trạng thái là `new` → báo cáo cập nhật và trở về `new` với thời điểm cập nhật mới.

**Vòng đời trạng thái project (UC-01, UC-05, UC-08, UC-25, UC-59).**

```
not_started ──(import dataset thành công)──→ in_progress ──(lưu project thành công)──→ completed
      ↑                                            │                                        │
      └────────────(xoá dataset)──────────────────┘                                        │
```

- Trạng thái **dẫn xuất từ sự kiện hệ thống**, người dùng không tự đánh dấu.

**Vòng đời tên cột (UC-10, UC-12).**

- Import (UC-08) → phát hiện lỗi tên cột theo từng sheet → **phân tích bị chặn** cho tới khi sửa (UC-10) → mở khoá phân tích.
- Reset (UC-12) → khôi phục tên từ file gốc → lỗi tên cột hiển thị lại → phân tích bị chặn lại.

### 3.10. Nhóm 7 — Xác thực, tài khoản và phiên đăng nhập

Nhóm này đặc tả các tính năng `AUTH-*`, `USER-*`, `ADMIN-*` từ phần 2 v3 (mục 3.33–3.34). Đây là nhóm thuộc **Đợt 1** theo mục 3.39 của phần 2 v3.

**Bổ sung vai trò hệ thống.** Phần 2 v3 (mục 3.34.1) chốt giữ vai trò `admin` hệ thống theo mã nguồn hiện tại (`user.role: 'admin' | 'analyst'`), nằm **ngoài** phân cấp workspace/project. Trong nhóm này, ký hiệu actor dùng:

| Ký hiệu | Vai trò | Phạm vi |
|---|---|---|
| `SYS-ADMIN` | Quản trị viên hệ thống | Duyệt báo cáo sự cố (`ISSUE-04`), xem hồ sơ người dùng (`ADMIN-01`). Không đọc dữ liệu/dataset/kết quả phân tích của bất kỳ project nào; không phải thành viên workspace |
| `SELF` | Chính người đang đăng nhập | Các thao tác trên tài khoản, phiên đăng nhập, thông báo và báo cáo sự cố của chính mình |

`SYS-ADMIN` **không** thay thế bất kỳ vai trò nghiệp vụ nào. Người có vai trò `SYS-ADMIN` mà cũng là thành viên workspace thì vẫn chịu đúng quyền workspace/project tương ứng — vai trò hệ thống không nâng quyền nghiệp vụ.

**Bổ sung mã lỗi.** Hai mã lỗi mới cho nhóm xác thực, bổ sung vào mục 3.1:

- `TOKEN_INVALID` — mã xác thực (OTP, token đặt lại mật khẩu) không hợp lệ: sai mã, đã dùng, hoặc đã bị vô hiệu hoá.
- `TOKEN_EXPIRED` — mã xác thực đã hết hạn.

`TOKEN_EXPIRED` tách khỏi `TOKEN_INVALID` để frontend hiển thị đúng hành động: hết hạn thì yêu cầu gửi mã mới, sai mã thì báo sai và đếm số lần.

#### UC-32. Đăng ký tài khoản

- **Actor:** `SELF` (khách trước đăng ký, chưa có tài khoản).
- **Tiền điều kiện:** email chưa tồn tại trong hệ thống; mật khẩu mới hợp lệ theo `PasswordSchema`.
- **Input:** email, mật khẩu, họ (`first_name`), tên (`last_name`).
- **Luồng chính:**
  1. Kiểm tra email hợp lệ và chưa tồn tại. Email được chuẩn hoá về chữ thường và cắt khoảng trắng thừa trước khi so sánh.
  2. Kiểm tra họ/tên không rỗng, không quá 50 ký tự, đã cắt khoảng trắng thừa.
  3. Tạo tài khoản với vai trò hệ thống `analyst`, trạng thái `active`. **Không** nhận vai trò từ người dùng — `admin` không thể tự đăng ký.
  4. Lưu mật khẩu dạng băm; không ghi mật khẩu thô vào log.
  5. Trả thông báo đăng ký thành công. Không tự đăng nhập — người dùng phải đăng nhập qua UC-33 để có phiên.
  6. Nếu có cấu hình gửi email, gửi email chào mừng (không bắt buộc thành công; lỗi gửi không làm đăng ký thất bại).
- **Luồng lỗi:** `VALIDATION_ERROR` khi email/mật khẩu/họ tên sai định dạng; `CONFLICT` khi email đã tồn tại; `DEPENDENCY_UNAVAILABLE` khi gặp lỗi hệ thống khi ghi dữ liệu.
- **Hậu điều kiện:** tài khoản tồn tại ở trạng thái `active`, chưa có workspace nào. Người dùng **không** tự động là thành viên của bất kỳ workspace nào — muốn vào workspace phải được `WS-OWNER` thêm (UC-03).
- **Quyền thực hiện:** công khai (không cần xác thực).

#### UC-33. Đăng nhập bằng email và mật khẩu

- **Actor:** `SELF`.
- **Tiền điều kiện:** tài khoản tồn tại và có trạng thái `active`.
- **Input:** email, mật khẩu.
- **Luồng chính:**
  1. Chuẩn hoá email (chữ thường, cắt khoảng trắng) rồi tìm tài khoản.
  2. Nếu không tìm thấy tài khoản → trả `VALIDATION_ERROR` với thông điệp chung chung, **không** tiết lộ email nào đã tồn tại (chống dò email).
  3. Xác minh mật khẩu. Sai → trả `VALIDATION_ERROR` chung chung, tăng bộ đếm thử (UC-45).
  4. Nếu trạng thái tài khoản là `blocked` → trả `FORBIDDEN` với thông điệp cho biết tài khoản bị khoá.
  5. Tạo access token (ngắn hạn) và refresh token (dài hạn); refresh token được lưu dạng hash trong `user_session`.
  6. Ghi phiên mới với `device_name`, `ip_address`, `user_agent` lấy từ request.
  7. Trả access token, refresh token, thông tin người dùng và thời điểm hết hạn.
- **Luồng lỗi:** `VALIDATION_ERROR` khi sai email/mật khẩu; `FORBIDDEN` khi tài khoản bị khoá; `LIMIT_EXCEEDED` khi vượt giới hạn thử đăng nhập; `DEPENDENCY_UNAVAILABLE` khi không tạo được phiên.
- **Hậu điều kiện:** tồn tại một phiên đăng nhập mới, đang hoạt động. Số lần thử sai được đặt lại về 0.
- **Quyền thực hiện:** công khai.

#### UC-34. Đăng nhập bằng Google

- **Actor:** `SELF`.
- **Tiền điều kiện:** cấu hình `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REDIRECT_URI` tồn tại và còn hiệu lực; Google trả về `email_verified = true`.
- **Input:** authorization code hoặc id token do Google cấp.
- **Luồng chính:**
  1. Xác thực mã ủy quyền với Google, lấy `google_id`, `email`, họ tên, và cờ `email_verified`.
  2. Nếu `email_verified` không đúng → trả `VALIDATION_ERROR`; không tạo hay liên kết tài khoản.
  3. Nếu `google_id` đã gắn với một tài khoản → **đăng nhập tài khoản đó** bằng access/refresh token mới, không hỏi mật khẩu, không hỏi thông tin thêm. Nếu tài khoản bị `blocked` → trả `FORBIDDEN`.
  4. Nếu `google_id` chưa gắn **nhưng** email đã có tài khoản → trả `CONFLICT` với thông điệp yêu cầu đăng nhập bằng mật khẩu để liên kết. **Không** tự gắn `google_id` — tránh chiếm đoạt tài khoản.
  5. Nếu cả hai đều mới → tạo tài khoản với `google_id`, `email`, họ tên lấy từ profile Google, vai trò hệ thống `analyst`, trạng thái `active`.
  6. Tạo phiên đăng nhập và trả token như UC-33.
- **Luồng lỗi:** `VALIDATION_ERROR` khi mã ủy quyền không hợp lệ hoặc email chưa được xác minh; `CONFLICT` khi email đã có tài khoản chưa liên kết Google; `FORBIDDEN` khi tài khoản bị khoá; `DEPENDENCY_UNAVAILABLE` khi không gọi được Google.
- **Hậu điều kiện:** tồn tại phiên đăng nhập mới. Không có mật khẩu nào được tạo cho tài khoản đăng nhập bằng Google.
- **Quyền thực hiện:** công khai.
- **Rủi ro cần lưu ý:** bước 4 là ranh giới bảo mật chính của luồng này. Xem phần 2 v3, mục 3.33 (`AUTH-03`).

#### UC-35. Ghi nhớ đăng nhập

- **Actor:** `SELF`.
- **Tiền điều kiện:** người dùng đã đăng nhập thành công ít nhất một lần trên thiết bị này.
- **Input:** không có (hành động phía client).
- **Luồng chính:**
  1. Client lưu **email** đã dùng để đăng nhập vào bộ nhớ cục bộ của thiết bị.
  2. Lần sau mở màn hình đăng nhập, client điền sẵn email và **không** điền sẵn mật khẩu.
  3. Server **không** nhận, **không** lưu và **không** ghi log mật khẩu dưới bất kỳ hình thức nào (thô, mã hoa hay có thể khôi phục).
- **Luồng lỗi:** không có — tính năng hoàn toàn phía client.
- **Hậu điều kiện:** không có thay đổi nào trên server.
- **Quyền thực hiện:** công khai.
- **Rủi ro cần lưu ý:** yêu cầu gốc nêu "ghi nhớ email **và** password". Đã thu hẹp còn email-only theo quyết định v3 / 2026-11-05; lưu mật khẩu phía server sẽ biến tính năng này thành đăng nhập không mật khẩu. Xem phần 2 v3, mục 3.33 (`AUTH-04`).

#### UC-36. Quên mật khẩu — gửi OTP

- **Actor:** `SELF`.
- **Tiền điều kiện:** cấu hình dịch vụ gửi email khả dụng; tài khoản tồn tại và không bị `blocked`.
- **Input:** email.
- **Luồng chính:**
  1. Chuẩn hoá email rồi tìm tài khoản.
  2. Kiểm tra số lần gửi trong 1 giờ: tối đa **5** cho cùng một email. Vượt → trả `LIMIT_EXCEEDED` kèm thời gian chờ.
  3. Sinh OTP gồm 6 chữ số (dùng bộ sinh số ngẫu nhiên an toàn, không dùng `Math.random`).
  4. Lưu **hash** của OTP vào tài khoản cùng `password_reset_expires_at = now + 10 phút`.
  5. Gửi OTP qua email kèm thời điểm hết hạn.
  6. Trả phản hồi **giống hệt nhau** trong mọi trường hợp (kể cả khi email không tồn tại): "Nếu email này đã có tài khoản, chúng tôi đã gửi mã xác nhận". Không tiết lộ email nào đã đăng ký.
- **Luồng lỗi:** `VALIDATION_ERROR` khi email sai định dạng; `LIMIT_EXCEEDED` khi vượt giới hạn gửi; `DEPENDENCY_UNAVAILABLE` khi dịch vụ gửi email lỗi — **không** im lặng; phải nêu rõ mã lỗi cho frontend hiển thị "không gửi được mã, vui lòng thử lại sau".
- **Hậu điều kiện:** nếu tài khoản tồn tại thì có OTP đang chờ, hết hạn sau 10 phút. OTP cũ đã bị vô hiệu hoá khi sinh OTP mới.
- **Quyền thực hiện:** công khai.

#### UC-37. Đặt lại mật khẩu bằng OTP

- **Actor:** `SELF`.
- **Tiền điều kiện:** tài khoản có OTP đang chờ; mật khẩu mới hợp lệ.
- **Input:** email, OTP, mật khẩu mới, xác nhận mật khẩu mới.
- **Luồng chính:**
  1. Kiểm tra OTP có tồn tại và còn hiệu lực.
  2. So khớp hash OTP. Sai → tăng bộ đếm nhập sai; tối đa **3** lần sai thì vô hiệu hoá OTP hiện tại và yêu cầu gửi lại. Lần thứ 4 trở đi trả `TOKEN_INVALID`.
  3. Kiểm tra thời gian hết hạn. Quá hạn → trả `TOKEN_EXPIRED` (frontend yêu cầu gửi mã mới).
  4. Kiểm tra mật khẩu mới và mật khẩu xác nhận khớp nhau.
  5. Cập nhật mật khẩu mới (dạng băm), xoá `password_reset_token_hash`, đặt `password_reset_expires_at = null`.
  6. **Thu hồi toàn bộ phiên đăng nhập** đang hoạt động của tài khoản — kể cả phiên hiện tại.
  7. Trả thông báo thành công; người dùng phải đăng nhập lại.
- **Luồng lỗi:** `TOKEN_INVALID` khi OTP sai, đã dùng hoặc đã vô hiệu hoá; `TOKEN_EXPIRED` khi quá hạn; `VALIDATION_ERROR` khi mật khẩu mới không khớp xác nhận hoặc sai định dạng.
- **Hậu điều kiện:** mật khẩu đã đổi, OTP đã xoá, không còn phiên đăng nhập nào hoạt động.
- **Quyền thực hiện:** công khai.
- **Rủi ro cần lưu ý:** bước 6 là bắt buộc — nếu không thu hồi phiên cũ thì kẻ đã chiếm phiên vẫn truy cập được sau khi nạn nhân đổi mật khẩu.

#### UC-38. Thay đổi mật khẩu

- **Actor:** `SELF`.
- **Tiền điều kiện:** đang đăng nhập; mật khẩu hiện tại đúng.
- **Input:** mật khẩu hiện tại, mật khẩu mới, xác nhận mật khẩu mới.
- **Luồng chính:**
  1. Xác minh mật khẩu hiện tại.
  2. Kiểm tra hai lần nhập mật khẩu mới khớp nhau.
  3. Kiểm tra mật khẩu mới khác mật khẩu hiện tại.
  4. Cập nhật mật khẩu (dạng băm).
  5. **Giữ phiên hiện tại** (người dùng không bị đăng xuất) nhưng **thu hồi toàn bộ phiên còn lại**.
  6. Trả thông báo thành công.
- **Luồng lỗi:** `VALIDATION_ERROR` khi mật khẩu hiện tại sai, mật khẩu mới không khớp xác nhận, mật khẩu mới bằng mật khẩu hiện tại, hoặc sai định dạng; `LIMIT_EXCEEDED` khi vượt giới hạn 5 lần/giờ.
- **Hậu điều kiện:** mật khẩu đã đổi; chỉ còn phiên hiện tại hoạt động.
- **Quyền thực hiện:** người đang đăng nhập.

#### UC-39. Xem danh sách phiên đăng nhập

- **Actor:** `SELF`.
- **Tiền điều kiện:** đang đăng nhập.
- **Input:** không có.
- **Luồng chính:**
  1. Truy vấn toàn bộ `user_session` của tài khoản, gồm cả phiên đã thu hồi.
  2. Trả từng phiên: thiết bị, địa chỉ IP, user agent, thời điểm tạo, thời điểm hết hạn, trạng thái đã thu hồi.
  3. Đánh dấu rõ phiên của thiết bị hiện tại để frontend hiển thị "phiên này".
  4. **Không** trả `refresh_token_hash` ra ngoài.
- **Luồng lỗi:** `UNAUTHENTICATED` khi access token không hợp lệ hoặc hết hạn.
- **Hậu điều kiện:** không có thay đổi nào.
- **Quyền thực hiện:** người đang đăng nhập, chỉ trên phiên của chính mình. Không có endpoint xem phiên của người khác — kể cả `SYS-ADMIN` cũng không được xem.

#### UC-40. Xem chi tiết phiên đăng nhập

- **Actor:** `SELF`.
- **Tiền điều kiện:** đang đăng nhập; phiên cần xem thuộc tài khoản của người gọi.
- **Input:** session id.
- **Luồng chính:** trả chi tiết một phiên theo cùng trường như UC-39, không kèm `refresh_token_hash`.
- **Luồng lỗi:** `NOT_FOUND` khi phiên không tồn tại **hoặc** thuộc tài khoản khác (không phân biệt hai trường hợp, tránh lộ sự tồn tại của id); `UNAUTHENTICATED` khi chưa đăng nhập.
- **Hậu điều kiện:** không có thay đổi nào.
- **Quyền thực hiện:** người đang đăng nhập, chỉ trên phiên của chính mình.

#### UC-41. Đăng xuất khỏi thiết bị khác

- **Actor:** `SELF`.
- **Tiền điều kiện:** đang đăng nhập; phiên cần thu hồi thuộc tài khoản của người gọi.
- **Input:** session id.
- **Luồng chính:**
  1. Đánh dấu `is_revoked = true` cho phiên đó và ghi `revoked_at`.
  2. Nếu phiên đã bị thu hồi → trả kết quả idempotent kèm thông báo "phiên đã đăng xuất", **không** phải lỗi.
  3. Trả thông báo thành công.
- **Luồng lỗi:** `NOT_FOUND` khi phiên không tồn tại hoặc thuộc tài khoản khác; `UNAUTHENTICATED` khi chưa đăng nhập.
- **Hậu điều kiện:** phiên đó không còn dùng được để làm mới access token. Access token đã cấp vẫn còn hiệu lực tới hết hạn — client phải bỏ qua token sau khi thu hồi.
- **Quyền thực hiện:** người đang đăng nhập, chỉ trên phiên của chính mình.

#### UC-42. Đăng xuất ở thiết bị hiện tại

- **Actor:** `SELF`.
- **Tiền điều kiện:** đang đăng nhập.
- **Input:** không có (hoặc session id hiện tại).
- **Luồng chính:**
  1. Đánh dấu phiên hiện tại `is_revoked = true`, ghi `revoked_at`.
  2. Trả thông báo thành công.
- **Luồng lỗi:** `UNAUTHENTICATED` khi chưa đăng nhập.
- **Hậu điều kiện:** refresh token của phiên này không dùng được nữa. Client xoá access token và refresh token ở bộ nhớ cục bộ.
- **Quyền thực hiện:** người đang đăng nhập.

#### UC-43. Làm mới access token

- **Actor:** `SELF`.
- **Tiền điều kiện:** có refresh token còn hiệu lực.
- **Input:** refresh token.
- **Luồng chính:**
  1. Tìm phiên theo hash của refresh token. Không tồn tại → `TOKEN_INVALID`.
  2. Kiểm tra phiên chưa bị thu hồi và chưa hết hạn. Đã thu hồi → `TOKEN_INVALID`.
  3. **Rotation:** thu hồi phiên cũ, sinh refresh token mới và tạo phiên mới với cùng thông tin thiết bị.
  4. Trả access token mới và refresh token mới.
- **Luồng lỗi:** `TOKEN_INVALID` khi token không khớp, đã dùng hoặc đã thu hồi; `TOKEN_EXPIRED` khi phiên đã hết hạn.
- **Hậu điều kiện:** phiên cũ đã bị thu hồi, phiên mới đang hoạt động.
- **Quyền thực hiện:** công khai (dựa trên refresh token).
- **Rủi ro cần lưu ý:** phải có **phát hiện tái sử dụng** — nếu refresh token đã bị thu hồi (tức là sau rotation) lại được dùng, hệ thống coi đây là dấu hiệu token bị lộ và **thu hồi toàn bộ phiên** của tài khoản, buộc đăng nhập lại. Không có cơ chế này thì refresh token bị đánh cắp vẫn dùng được mãi.

#### UC-44. Xem hồ sơ cá nhân

- **Actor:** `SELF`.
- **Tiền điều kiện:** đang đăng nhập.
- **Input:** không có.
- **Luồng chính:** trả ảnh đại diện, họ tên, email, vai trò hệ thống, số điện thoại, giới thiệu, trạng thái tài khoản, thời điểm tạo. Không trả `password_hash`, `password_reset_token_hash`, `google_id`.
- **Luồng lỗi:** `UNAUTHENTICATED` khi chưa đăng nhập.
- **Hậu điều kiện:** không có thay đổi nào.
- **Quyền thực hiện:** người đang đăng nhập, chỉ hồ sơ của chính mình.

#### UC-45. Cập nhật hồ sơ cá nhân

- **Actor:** `SELF`.
- **Tiền điều kiện:** đang đăng nhập.
- **Input:** ảnh đại diện (tuỳ chọn), họ, tên, số điện thoại (tuỳ chọn), giới thiệu (tuỳ chọn).
- **Luồng chính:**
  1. Kiểm tra định dạng và độ dài họ/tên (1–50 ký tự, cắt khoảng trắng thừa), định dạng số điện thoại, độ dài giới thiệu.
  2. Cập nhật các trường được cung cấp; trường không được cung cấp giữ nguyên.
  3. **Không** cập nhật `role`, `status` hay `email` qua luồng này — vai trò hệ thống do `SYS-ADMIN` quản lý, email cần xác minh mới.
  4. Trả hồ sơ đã cập nhật.
- **Luồng lỗi:** `VALIDATION_ERROR` khi dữ liệu sai định dạng; `UNAUTHENTICATED` khi chưa đăng nhập.
- **Hậu điều kiện:** hồ sơ cá nhân được cập nhật; không ảnh hưởng quyền trong workspace/project.
- **Quyền thực hiện:** người đang đăng nhập, chỉ hồ sơ của chính mình.

#### UC-46. Xem hồ sơ người dùng (quản trị)

- **Actor:** `SYS-ADMIN`.
- **Tiền điều kiện:** tài khoản có vai trò hệ thống `admin`.
- **Input:** email (tuỳ chọn), `role` (tuỳ chọn), `status` (tuỳ chọn), trang, kích thước trang.
- **Luồng chính:**
  1. Truy vấn danh sách tài khoản với bộ lọc và phân trang. Mặc định sắp xếp theo thời điểm tạo giảm dần.
  2. Với chi tiết một tài khoản: trả hồ sơ đầy đủ **trừ** `password_hash` và `password_reset_token_hash`.
  3. **Ghi log** mỗi lần truy cập danh sách hoặc chi tiết hồ sơ người dùng: `actor_id`, `action`, bộ lọc, `timestamp`.
  4. Không trả nội dung dữ liệu, dataset, kết quả phân tích hay báo cáo PDF của bất kỳ project nào.
- **Luồng lỗi:** `FORBIDDEN` khi người gọi không có vai trò `admin`; `VALIDATION_ERROR` khi tham số lọc sai.
- **Hậu điều kiện:** không có thay đổi nào trên dữ liệu người dùng. Có một bản ghi log cho mỗi lần truy cập.
- **Quyền thực hiện:** `SYS-ADMIN`. Quyền **chỉ đọc** — không sửa hồ sơ người khác, không khóa/mở khóa tài khoản, không xoá tài khoản, không xem phiên đăng nhập của người khác.
- **Rủi ro cần lưu ý:** đây là tính năng có rủi ro lạm dụng cao nhất trong nhóm. Giới hạn "chỉ đọc" và bắt buộc ghi log là hai biện pháp bắt buộc, không phải tuỳ chọn.

### 3.11. Nhóm 8 — Workspace và Project bổ sung

Nhóm này bổ sung các tính năng `WS-*` và `PROJ-*` chưa có use case trong nhóm 1 (UC-01 → UC-07) của phần 3 v1.

#### UC-47. Xem danh sách workspace

- **Actor:** `WS-OWNER`, `WS-MEMBER`.
- **Tiền điều kiện:** đang đăng nhập.
- **Input:** từ khoá tìm kiếm (tuỳ chọn), vai trò lọc (`owner | member`, tuỳ chọn), trường sắp xếp, hướng sắp xếp, trang, kích thước trang.
- **Luồng chính:**
  1. Truy vấn các workspace mà người gọi là thành viên. Workspace đã soft-delete không xuất hiện.
  2. Lọc theo từ khoá trên tên workspace — không phân biệt hoa/thường, so khớp "chứa".
  3. Lọc theo vai trò nếu có. **Không có giá trị `viewer`** ở cấp workspace.
  4. Sắp xếp theo: truy cập gần nhất (mặc định), tham gia gần nhất, cập nhật gần nhất, tên A→Z, tên Z→A.
  5. Trả kèm vai trò của người gọi trong từng workspace và tổng số bản ghi khớp điều kiện.
- **Luồng lỗi:** `VALIDATION_ERROR` khi tham số sắp xếp hoặc phân trang sai; `UNAUTHENTICATED` khi chưa đăng nhập.
- **Hậu điều kiện:** không có thay đổi nào.
- **Quyền thực hiện:** mọi thành viên workspace, chỉ trên workspace của chính mình.
- **Phụ thuộc:** cần trường `workspace.last_accessed_at` để hỗ trợ sắp xếp "truy cập gần nhất" (phần 2 v3, mục 3.36).

#### UC-48. Xem chi tiết workspace

- **Actor:** `WS-OWNER`, `WS-MEMBER`.
- **Tiền điều kiện:** đang đăng nhập; người gọi là thành viên workspace.
- **Input:** workspace id.
- **Luồng chính:** trả tên, mô tả, người tạo, ngày tạo, cập nhật gần nhất, **số lượng thành viên**, **số lượng project**, vai trò của người gọi.
- **Luồng lỗi:** `NOT_FOUND` khi workspace không tồn tại hoặc người gọi không phải thành viên; `UNAUTHENTICATED` khi chưa đăng nhập.
- **Hậu điều kiện:** không có thay đổi nào.
- **Quyền thực hiện:** mọi thành viên workspace (quyền đọc cấp workspace, chốt ở v3 / 2026-11-05).

#### UC-49. Xóa workspace

- **Actor:** `WS-OWNER`.
- **Tiền điều kiện:** đang đăng nhập; người gọi là Workspace Owner của workspace đó.
- **Input:** workspace id.
- **Luồng chính:**
  1. Đặt `deleted_at` (soft delete). Không xoá vật lý bất kỳ dữ liệu nào.
  2. Workspace không còn xuất hiện trong danh sách và không truy cập được.
  3. **Không** kéo theo soft-delete các project bên trong — mỗi project có `deleted_at` riêng.
- **Luồng lỗi:** `NOT_FOUND` khi workspace không tồn tại; `FORBIDDEN` khi người gọi không phải Owner.
- **Hậu điều kiện:** workspace ở trạng thái đã xoá; dữ liệu bên trong được giữ nguyên để có thể khôi phục.
- **Quyền thực hiện:** `WS-OWNER`.

#### UC-50. Xem danh sách thành viên workspace

- **Actor:** `WS-OWNER`, `WS-MEMBER`.
- **Tiền điều kiện:** đang đăng nhập; người gọi là thành viên workspace.
- **Input:** từ khoá tìm kiếm (tuỳ chọn), vai trò lọc (tuỳ chọn), trang, kích thước trang.
- **Luồng chính:**
  1. Truy vấn danh sách thành viên: tên, email, vai trò, ngày tham gia.
  2. Tìm kiếm theo tên hoặc email — không phân biệt hoa/thường, so khớp "chứa".
  3. Lọc theo vai trò `owner | member` nếu có.
  4. Trả kèm tổng số bản ghi khớp điều kiện.
- **Luồng lỗi:** `VALIDATION_ERROR` khi tham số sai; `NOT_FOUND` khi workspace không tồn tại hoặc người gọi không phải thành viên.
- **Hậu điều kiện:** không có thay đổi nào.
- **Quyền thực hiện:** `WS-OWNER` và `WS-MEMBER` (quyền đọc cấp workspace, chốt ở v3 / 2026-11-05).
- **Rủi ro cần lưu ý:** danh sách này lộ email của thành viên workspace — chỉ trả cho người đã là thành viên cùng workspace, không trả cho người ngoài.

#### UC-51. Nhượng quyền Workspace Owner

- **Actor:** `WS-OWNER` (hiện tại).
- **Tiền điều kiện:** đang đăng nhập; người gọi là Workspace Owner; người nhận là thành viên workspace khác.
- **Input:** user id của người nhận.
- **Luồng chính:**
  1. Kiểm tra người nhận không phải chính người gọi và đang là thành viên workspace.
  2. Trong **một giao dịch nguyên tử**: đặt vai trò `owner` cho người nhận; đặt vai trò `member` cho người gọi.
  3. Người gọi **giữ nguyên vai trò project** đang có — nếu đang là `PROJ-OWNER` của project nào thì vẫn là `PROJ-OWNER` của project đó.
  4. Người nhận kế thừa toàn quyền quản trị của Workspace Owner với mọi project trong workspace.
  5. **Ghi log** hành động nhượng quyền: `actor_id`, `action`, `target`, `timestamp`.
- **Luồng lỗi:** `VALIDATION_ERROR` khi người nhận không hợp lệ; `NOT_FOUND` khi người nhận không phải thành viên; `FORBIDDEN` khi người gọi không phải Owner.
- **Hậu điều kiện:** workspace có đúng một Owner. Người nhận có toàn quyền quản trị; người gọi là `WS-MEMBER` nhưng giữ vai trò project cũ.
- **Quyền thực hiện:** `WS-OWNER`.
- **Rủi ro cần lưu ý:** phải là giao dịch nguyên tử — không để trạng thái trung gian có 0 Owner hoặc 2 Owner. Khác biệt với UC-07 (rời workspace): người **rời** mất toàn bộ quyền project, người **nhượng quyền** giữ nguyên.

#### UC-52. Xem danh sách project

- **Actor:** `WS-OWNER`, `PROJ-OWNER`, `PROJ-MEMBER`, `PROJ-VIEWER`.
- **Tiền điều kiện:** đang đăng nhập.
- **Input:** workspace id (tuỳ chọn — bỏ trống nghĩa là "tất cả project của tôi"), từ khoá tìm kiếm (tuỳ chọn), trạng thái lọc (`not_started | in_progress | completed`, tuỳ chọn), trường sắp xếp, hướng sắp xếp, trang, kích thước trang.
- **Luồng chính:**
  1. Xác định tập project người gọi có quyền xem: nếu có `workspace_id` → các project của workspace đó mà người gọi là thành viên; nếu không → mọi project người gọi tham gia.
  2. Lọc theo từ khoá trên tên project — không phân biệt hoa/thường, so khớp "chứa".
  3. Lọc theo `status` nếu có.
  4. Sắp xếp theo: truy cập gần nhất (mặc định), tham gia gần nhất, cập nhật gần nhất, tên A→Z, tên Z→A.
  5. Mỗi dòng trả: tên, tên workspace, `status`, vai trò của người gọi trong project, ngày tạo, cập nhật gần nhất.
  6. Project đã soft-delete không xuất hiện.
- **Luồng lỗi:** `NOT_FOUND` khi workspace id không tồn tại; `VALIDATION_ERROR` khi tham số lọc/sắp xếp sai.
- **Hậu điều kiện:** không có thay đổi nào.
- **Quyền thực hiện:** mọi vai trò, mỗi vai trò chỉ thấy các project mình có quyền xem.
- **Phụ thuộc:** trường `project.status` và `project.last_accessed_at`.

#### UC-53. Xem thông tin cơ bản project

- **Actor:** `WS-OWNER`, `PROJ-OWNER`, `PROJ-MEMBER`, `PROJ-VIEWER`.
- **Tiền điều kiện:** đang đăng nhập; người gọi có quyền xem project.
- **Input:** project id.
- **Luồng chính:** trả tên, mô tả, tên workspace, ngày tạo, cập nhật gần nhất, `status`, vai trò của người gọi, số sheet và trạng thái dataset (nếu có) để frontend biết có thể vào Data Views hay chưa.
- **Luồng lỗi:** `NOT_FOUND` khi project không tồn tại hoặc người gọi không có quyền xem.
- **Hậu điều kiện:** không có thay đổi nào.
- **Quyền thực hiện:** mọi vai trò có quyền xem project.

#### UC-54. Cập nhật thông tin cơ bản project

- **Actor:** `PROJ-OWNER`, `WS-OWNER`.
- **Tiền điều kiện:** đang đăng nhập; người gọi là Project Owner hoặc Workspace Owner của workspace chứa project.
- **Input:** project id, tên (tuỳ chọn), mô tả (tuỳ chọn).
- **Luồng chính:**
  1. Kiểm tra độ dài tên (1–100 ký tự) và mô tả (tối đa 500 ký tự); tên duy nhất trong workspace.
  2. Cập nhật các trường được cung cấp.
  3. Không ảnh hưởng dataset, trạng thái làm việc hay bản lưu.
- **Luồng lỗi:** `VALIDATION_ERROR` khi dữ liệu sai định dạng hoặc tên trùng; `NOT_FOUND` khi project không tồn tại; `FORBIDDEN` khi không có quyền quản trị.
- **Hậu điều kiện:** thông tin project được cập nhật.
- **Quyền thực hiện:** `PROJ-OWNER`, `WS-OWNER`.

#### UC-55. Xóa project

- **Actor:** `WS-OWNER`.
- **Tiền điều kiện:** đang đăng nhập; người gọi là Workspace Owner.
- **Input:** project id.
- **Luồng chính:**
  1. Đặt `deleted_at` (soft delete).
  2. Không xoá dataset, bản lưu hay kết quả phân tích — giữ để khôi phục được.
  3. Thông báo cho các thành viên project rằng project đã bị xoá.
- **Luồng lỗi:** `NOT_FOUND` khi project không tồn tại; `FORBIDDEN` khi người gọi không phải Workspace Owner.
- **Hậu điều kiện:** project ở trạng thái đã xoá, không hiển thị trong danh sách và không truy cập được.
- **Quyền thực hiện:** **chỉ `WS-OWNER`** — `PROJ-OWNER` không tự xoá được project của mình.
- **Rủi ro cần lưu ý:** mã nguồn hiện tại cho phép `owner` (theo nghĩa workspace) xoá — cần khớp với quy tắc mới.

#### UC-56. Tìm kiếm thành viên trong project

- **Actor:** `PROJ-OWNER`, `WS-OWNER`.
- **Tiền điều kiện:** đang đăng nhập; người gọi có quyền quản lý thành viên project.
- **Input:** từ khoá tìm kiếm (tên hoặc email), project id.
- **Luồng chính:**
  1. Tìm trong phạm vi **thành viên workspace** của project — **không** tìm toàn hệ thống.
  2. Loại bỏ những người đã là thành viên project.
  3. Trả tối đa 20 kết quả: tên, email, vai trò workspace, vai trò project hiện tại.
- **Luồng lỗi:** `VALIDATION_ERROR` khi từ khoá quá ngắn (dưới 2 ký tự) hoặc quá dài; `NOT_FOUND` khi project không tồn tại; `FORBIDDEN` khi không có quyền quản lý thành viên.
- **Hậu điều kiện:** không có thay đổi nào.
- **Quyền thực hiện:** `PROJ-OWNER`, `WS-OWNER`.
- **Rủi ro cần lưu ý:** lọc theo workspace **trước khi** trả về là bắt buộc — trả cả danh sách toàn hệ thống sẽ lộ email của người không thuộc workspace.

#### UC-57. Xem lịch sử hoạt động của project

- **Actor:** `WS-OWNER`, `PROJ-OWNER`, `PROJ-MEMBER`, `PROJ-VIEWER`.
- **Tiền điều kiện:** đang đăng nhập; người gọi có quyền xem project; project đã có dataset.
- **Input:** project id, trang, kích thước trang.
- **Luồng chính:**
  1. Truy vấn các phiên bản dataset của project từ collection `dataset_version`, mới nhất trước.
  2. Mỗi dòng: số phiên bản, thời điểm tạo, người tạo, số bản ghi, số dòng đã xoá.
  3. Trả kèm tổng số phiên bản.
- **Luồng lỗi:** `NOT_FOUND` khi project không tồn tại hoặc người gọi không có quyền xem; `PRECONDITION_FAILED` khi project chưa có dataset.
- **Hậu điều kiện:** không có thay đổi nào.
- **Quyền thực hiện:** mọi vai trò có quyền xem project.
- **Phạm vi:** xem lịch sử **dataset**, không phải lịch sử bản lưu project. Phân biệt ở phần 2 v3, mục 3.32.1.

#### UC-58. Xem chi tiết một phiên bản của project

- **Actor:** `WS-OWNER`, `PROJ-OWNER`, `PROJ-MEMBER`, `PROJ-VIEWER`.
- **Tiền điều kiện:** đang đăng nhập; người gọi có quyền xem project; phiên bản tồn tại.
- **Input:** project id, số phiên bản.
- **Luồng chính:** trả ai đã tạo, nội dung thay đổi, thời điểm, số bản ghi, số dòng đã xoá; kèm phần diff so với phiên bản trước nếu có.
- **Luồng lỗi:** `NOT_FOUND` khi project hoặc phiên bản không tồn tại.
- **Hậu điều kiện:** không có thay đổi nào.
- **Quyền thực hiện:** mọi vai trò có quyền xem project.

#### ~~UC-59. Quay lại phiên bản của project~~ — **GỠ KHỎI PHẠM VI (2026-11-05)**

> **Quyết định:** Gỡ cùng module `versions` và các tính năng `PROJ-06`/`PROJ-07`/`PROJ-08`. Xem mục 3.14.
>
> - Rollback là thao tác **ghi đè dữ liệu** → vi phạm nguyên tắc dữ liệu bất biến.
> - Không còn phiên bản dữ liệu để quay lại: với dữ liệu bất biến, mọi lần phân tích đều mô tả cùng một tập dữ liệu.
> - **Cách thay thế:** nếu người dùng cần phân tích lại dữ liệu đã thay đổi ở nguồn, họ tải lên file mới trong một project mới (quy tắc "mỗi project một dataset" giữ nguyên).
> - Hệ quả liên quan: không còn cảnh báo "dữ liệu đang làm việc sẽ thay đổi" (bước 1 cũ), không còn hạ `project.status` do rollback, không còn thông báo cho thành viên do rollback.

### 3.12. Nhóm 9 — Thông báo

Nhóm này đặc tả `NOTIF-*` từ phần 2 v3 (mục 3.37). Thuộc **Đợt 1**.

#### UC-60. Xem trung tâm thông báo

- **Actor:** `SELF`.
- **Tiền điều kiện:** đang đăng nhập.
- **Input:** bộ lọc đã đọc (`true | false | all`, mặc định `all`), số lượng lấy cho chế độ "mới nhất" (mặc định 5), trang, kích thước trang.
- **Luồng chính:**
  1. Truy vấn thông báo của chính người gọi, sắp xếp giảm dần theo thời điểm tạo.
  2. Lọc theo trạng thái đã đọc nếu có.
  3. Mỗi dòng: tiêu đề, nội dung tóm tắt, loại thông báo, trạng thái đã đọc, thời gian, liên kết tới đối tượng liên quan (project hoặc báo cáo sự cố) nếu có.
  4. Trả **số thông báo chưa đọc** kèm mọi lần gọi để frontend hiển thị badge.
  5. Phân trang offset, mặc định 10 item/trang.
- **Luồng lỗi:** `VALIDATION_ERROR` khi tham số phân trang sai; `UNAUTHENTICATED` khi chưa đăng nhập.
- **Hậu điều kiện:** không có thay đổi nào; xem thông báo **không** tự đánh dấu đã đọc (chỉ UC-61 mới đánh dấu).
- **Quyền thực hiện:** người đang đăng nhập, chỉ thông báo của chính mình.

#### UC-61. Xem chi tiết thông báo

- **Actor:** `SELF`.
- **Tiền điều kiện:** đang đăng nhập; thông báo thuộc người gọi.
- **Input:** notification id.
- **Luồng chính:**
  1. Trả nội dung đầy đủ của thông báo.
  2. Nếu chưa đọc → đặt `read_at = now`.
- **Luồng lỗi:** `NOT_FOUND` khi thông báo không tồn tại hoặc thuộc người khác; `UNAUTHENTICATED` khi chưa đăng nhập.
- **Hậu điều kiện:** thông báo được đánh dấu đã đọc; số thông báo chưa đọc giảm tương ứng.
- **Quyền thực hiện:** người đang đăng nhập, chỉ thông báo của chính mình.

#### UC-62. Bật hoặc tắt thông báo

- **Actor:** `SELF`.
- **Tiền điều kiện:** đang đăng nhập.
- **Input:** trạng thái mong muốn (`enabled: boolean`).
- **Luồng chính:**
  1. Đặt `notifications_enabled` trên hồ sơ người dùng (mặc định `true`).
  2. Một công tắc **chung** cho mọi loại thông báo.
  3. Tắt **không** xoá thông báo đã có và **không** chặn thông báo loại bắt buộc (xem UC-63).
- **Luồng lỗi:** `VALIDATION_ERROR` khi giá trị không phải boolean; `UNAUTHENTICATED` khi chưa đăng nhập.
- **Hậu điều kiện:** cài đặt được lưu.
- **Quyền thực hiện:** người đang đăng nhập, chỉ hồ sơ của chính mình.

#### UC-63. Nhận thông báo từ sự kiện hệ thống

- **Actor:** hệ thống (không phải thao tác của người dùng).
- **Tiền điều kiện:** có sự kiện hệ thống phát sinh thông báo.
- **Input:** sự kiện (loại thông báo, người nhận, dữ liệu liên quan).
- **Luồng chính:**
  1. Xác định loại thông báo theo bảng sự kiện tại phần 2 v3, mục 3.37.1: `project` (tạo/xoá project), `issue` (báo cáo sự cố cần bổ sung / đã xử lý), `analysis` (AI job hoàn tất / phân tích thất bại), `conflict` (bản lưu bị ghi đè).
  2. Kiểm tra công tắc `notifications_enabled` của người nhận. Nếu đang tắt → **bỏ qua**, trừ khi thông báo thuộc nhóm bắt buộc.
  3. Nhóm bắt buộc gồm **đúng 2 loại**: báo cáo sự cố chuyển sang trạng thái "Cần bổ sung"; bản lưu project bị ghi đè bởi người khác. Hai loại này **luôn** được tạo dù công tắc đã tắt.
  4. Tạo bản ghi thông báo với `read_at = null`.
  5. Kênh phân phối trong đợt này là **chỉ in-app** — không gửi email thông báo.
- **Luồng lỗi:** không trả lỗi ra ngoài — lỗi tạo thông báo phải được ghi log và **không** làm hỏng thao tác nghiệp vụ đã thành công (ví dụ project vẫn được tạo dù thông báo tạo lỗi).
- **Hậu điều kiện:** thông báo tồn tại trong trung tâm thông báo của người nhận (trừ khi bị tắt và không thuộc nhóm bắt buộc).
- **Quyền thực hiện:** hệ thống.
- **Phụ thuộc:** module `notifications` phải có cơ chế tạo thông báo từ sự kiện; các điểm phát sự kiện nằm ở module `projects`, `issues`, `analysis`.

### 3.13. Nhóm 10 — Báo cáo sự cố

Nhóm này đặc tả `ISSUE-*` từ phần 2 v3 (mục 3.38). Thuộc **Đợt 1**.

**Phân biệt với `REPORT-01`.** `REPORT-01` là xuất báo cáo PDF kết quả phân tích dữ liệu — thuộc phạm vi lõi Data Quality. Nhóm này là **phản hồi về hệ thống** (người dùng báo lỗi/góp ý), hoàn toàn khác.

#### UC-64. Tạo báo cáo sự cố

- **Actor:** `SELF`.
- **Tiền điều kiện:** đang đăng nhập.
- **Input:** loại vấn đề, tiêu đề, mô tả chi tiết, tệp đính kèm (tuỳ chọn, tối đa 3 tệp).
- **Luồng chính:**
  1. Kiểm tra loại vấn đề thuộc danh sách cho phép: lỗi chức năng, lỗi hiển thị, lỗi dữ liệu, góp ý tính năng, khác.
  2. Kiểm tra tiêu đề và mô tả không rỗng, độ dài trong giới hạn.
  3. Với tệp đính kèm: kiểm tra kích thước (đề xuất 10 MB/tệp), kiểm tra mime type **thực** chứ không tin mime type do client khai, chặn file thực thi. Lưu qua port Storage, **không** phục vụ file tĩnh trực tiếp cho người chưa xác thực.
  4. Tạo báo cáo với `user_id`, `workspace_id` nếu người gọi đang ở trong một workspace, và ngữ cảnh: đường dẫn API, thông báo lỗi, thời điểm.
  5. Trạng thái khởi tạo `new`.
  6. Trả mã báo cáo.
- **Luồng lỗi:** `VALIDATION_ERROR` khi dữ liệu sai định dạng; `LIMIT_EXCEEDED` khi vượt giới hạn dung lượng hoặc số tệp; `DEPENDENCY_UNAVAILABLE` khi lưu tệp lên storage lỗi.
- **Hậu điều kiện:** báo cáo tồn tại ở trạng thái `new`. Không tự động gửi email thông báo cho Admin — Admin xem trong danh sách.
- **Quyền thực hiện:** người đang đăng nhập.

#### UC-65. Xem danh sách báo cáo của tôi

- **Actor:** `SELF`.
- **Tiền điều kiện:** đang đăng nhập.
- **Input:** lọc theo trạng thái (`new | in_progress | resolved | closed`, tuỳ chọn), trang, kích thước trang.
- **Luồng chính:**
  1. Truy vấn các báo cáo do chính người gọi tạo, mới nhất trước.
  2. Lọc theo trạng thái nếu có.
  3. Mỗi dòng: mã báo cáo, tiêu đề, loại vấn đề, thời điểm tạo, cập nhật cuối, trạng thái.
  4. Phân trang offset, mặc định 10 item/trang.
- **Luồng lỗi:** `VALIDATION_ERROR` khi trạng thái lọc không hợp lệ; `UNAUTHENTICATED` khi chưa đăng nhập.
- **Hậu điều kiện:** không có thay đổi nào.
- **Quyền thực hiện:** người đang đăng nhập, chỉ báo cáo của chính mình.

#### UC-66. Xem chi tiết báo cáo

- **Actor:** `SELF`, `SYS-ADMIN`.
- **Tiền điều kiện:** đang đăng nhập; báo cáo thuộc người gọi (với `SELF`) hoặc bất kỳ báo cáo nào (với `SYS-ADMIN`).
- **Input:** mã báo cáo.
- **Luồng chính:** trả mã báo cáo, tiêu đề, loại vấn đề, thời điểm tạo, cập nhật cuối, trạng thái, mô tả chi tiết, danh sách tệp đính kèm (qua URL có thời hạn, không phải URL công khai).
- **Luồng lỗi:** `NOT_FOUND` khi báo cáo không tồn tại hoặc thuộc người khác (với `SELF`); `FORBIDDEN` khi người gọi không phải `SYS-ADMIN` và không sở hữu báo cáo.
- **Hậu điều kiện:** không có thay đổi nào.
- **Quyền thực hiện:** `SELF` trên báo cáo của chính mình; `SYS-ADMIN` trên mọi báo cáo.

#### UC-67. Duyệt báo cáo từ người dùng

- **Actor:** `SYS-ADMIN`.
- **Tiền điều kiện:** tài khoản có vai trò hệ thống `admin`; báo cáo tồn tại.
- **Input:** mã báo cáo, trạng thái đích, ghi chú nội bộ (tuỳ chọn).
- **Luồng chính:**
  1. Kiểm tra chuyển trạng thái hợp lệ: `new` → `in_progress` → `resolved` → `closed`; và `in_progress` → `new` (yêu cầu bổ sung).
  2. **Không** sửa nội dung báo cáo của người dùng (tiêu đề, mô tả, tệp đính kèm).
  3. Cập nhật trạng thái và ghi chú nội bộ.
  4. Khi chuyển sang `new` (Cần bổ sung) → tạo thông báo loại **bắt buộc** cho người gửi báo cáo.
  5. **Ghi log** mọi thay đổi trạng thái: `actor_id`, `action`, mã báo cáo, trạng thái nguồn, trạng thái đích, `timestamp`.
- **Luồng lỗi:** `FORBIDDEN` khi không có vai trò `admin`; `NOT_FOUND` khi báo cáo không tồn tại; `VALIDATION_ERROR` khi chuyển trạng thái không hợp lệ.
- **Hậu điều kiện:** trạng thái báo cáo được cập nhật; có bản ghi log; nếu chuyển sang `new` thì người gửi nhận được thông báo bắt buộc.
- **Quyền thực hiện:** `SYS-ADMIN`.
- **Phạm vi luồng:** luồng **đơn giản** — Admin chỉ đổi trạng thái. Không có nội dung phản hồi bằng văn bản cho người dùng, không gán người xử lý, không ghi chú trao đổi hai chiều, không SLA thời gian. Đánh đổi đã được người dùng chấp nhận (phần 2 v3, mục 3.38).

### 3.13b. Nhóm 11 — Nhận xét kết quả và học lại cho AI

> **Quyết định 2026-11-05 (v4):** Mỗi kết quả hệ thống trả ra cho người dùng **đều kèm phần đánh giá để người dùng nhận xét**. Nhận xét được lưu lại và làm nguồn dữ liệu cho vòng lặp học lại của AI (Phần 12 mục 3.16). Chi tiết cấu trúc: Phần 12 v4, mục 3.16.2.

#### UC-68. Nhận xét một phát hiện

- **Actor:** mọi vai trò có quyền xem project, kể cả `PROJ-VIEWER`.
- **Tiền điều kiện:** có phát hiện (finding) thuộc một lần phân tích đã lưu.
- **Input:** `finding_id`; `label` (`correct` · `partially_correct` · `false_positive` · `missed_issue` · `other`); `reason` (bắt buộc với `false_positive`/`missed_issue`/`other`, tối đa 2.000 ký tự); `suggested_severity` (tuỳ chọn).
- **Luồng chính:**
  1. Kiểm tra `finding_id` tồn tại và thuộc project mà người dùng có quyền.
  2. Lưu nhận xét kèm `user_id`, thời điểm, và **ảnh chụp `ai_confidence` + `ai_rationale` tại thời điểm nhận xét** (để sau này đánh giá model nào đúng).
  3. Nhận xét được ghi vào kho mẫu học lại sau khi chuẩn hoá (Phần 12 mục 3.16.4).
- **Luồng lỗi:**
  - `NOT_FOUND` — không có phát hiện.
  - `VALIDATION_ERROR` — nhãn không hợp lệ, hoặc thiếu `reason` khi nhãn bắt buộc, hoặc `reason` quá 2.000 ký tự.
  - `FORBIDDEN` — không có quyền xem project chứa phát hiện.
- **Hậu điều kiện:** nhận xét đã lưu. **Kết quả phân tích không thay đổi** (dữ liệu bất biến — nhận xét là lớp đánh giá tách biệt).
- **Quyền thực hiện:** mọi vai trò có quyền xem project.

#### UC-69. Nhận xét cả lần phân tích

- **Actor:** mọi vai trò có quyền xem project.
- **Tiền điều kiện:** có lần phân tích đã lưu.
- **Input:** `analysis_id`; `label`; `reason`; `suggested_severity` (tuỳ chọn).
- **Luồng chính:** như UC-68 nhưng gắn ở cấp lần phân tích — dùng để người dùng nói "lần này phát hiện nhiều quá" hoặc "thiếu loại lỗi X".
- **Luồng lỗi:** `NOT_FOUND`, `VALIDATION_ERROR`, `FORBIDDEN` như UC-68.
- **Hậu điều kiện:** nhận xét đã lưu; kết quả phân tích không thay đổi.
- **Quyền thực hiện:** mọi vai trò có quyền xem project.

#### UC-70. Xem nhận xét của một phát hiện hoặc lần phân tích

- **Actor:** mọi vai trò có quyền xem project.
- **Tiền điều kiện:** có phát hiện hoặc lần phân tích.
- **Input:** `finding_id` hoặc `analysis_id`; `cursor` tuỳ chọn; `limit` (mặc định 20, tối đa 100).
- **Luồng chính:** trả về danh sách nhận xét (nhãn, lý do, gợi ý mức ảnh hưởng, người nhận xét, thời điểm) kèm **chỉ số tổng hợp**: số `correct` / `false_positive` / `missed_issue`, và **tỉ lệ xác nhận**.
- **Luồng lỗi:** `NOT_FOUND`; `FORBIDDEN`.
- **Hậu điều kiện:** không thay đổi trạng thái.
- **Quyền thực hiện:** mọi vai trò có quyền xem project.

#### UC-71. Sửa hoặc xóa nhận xét của chính mình

- **Actor:** người đã nhận xét.
- **Tiền điều kiện:** có nhận xét do chính mình tạo.
- **Input:** `feedback_id`; nội dung sửa (`label`, `reason`, `suggested_severity`).
- **Luồng chính:**
  1. Kiểm tra người gọi là chủ sở hữu nhận xét → nếu không thì `FORBIDDEN`.
  2. Cập nhật nhận xét. Nhận xét đã dùng làm mẫu học lại sẽ được **chuẩn hoá lại** ở lần đồng bộ kho mẫu kế tiếp.
- **Luồng lỗi:** `NOT_FOUND`; `FORBIDDEN` — không phải chủ nhận xét.
- **Hậu điều kiện:** nhận xét đã được cập nhật.
- **Quyền thực hiện:** người đã nhận xét.
- **Lý do cho phép sửa:** nhãn sai sẽ ô nhiễm kho mẫu học lại và làm sai lệch đánh giá model. Không cho sửa thì dữ liệu học lại sẽ nhiễu.

#### UC-72. Xem thống kê chất lượng AI (chỉ số học lại)

- **Actor:** `WS-OWNER`, `PROJ-OWNER`, `PROJ-MEMBER`.
- **Tiền điều kiện:** project có ít nhất một lần phân tích đã có nhận xét.
- **Input:** khoảng thời gian tuỳ chọn.
- **Luồng chính:** trả về theo từng model đã dùng (`model_id`): tỉ lệ `false_positive`, tỉ lệ `missed_issue`, tỉ lệ xác nhận, số nhận xét, và **điểm F1 trên bộ benchmark** nếu có. Đây là cơ sở để quyết định có nên đổi model hay không (Phần 12 mục 3.15.5).
- **Luồng lỗi:** `NOT_FOUND` — chưa có dữ liệu.
- **Hậu điều kiện:** không thay đổi trạng thái.
- **Quyền thực hiện:** `WS-OWNER`, `PROJ-OWNER`, `PROJ-MEMBER`.

### 3.13c. Ma trận quyền nhóm 11 — Nhận xét kết quả (v4)

| Use case | WS-OWNER | WS-MEMBER | PROJ-OWNER | PROJ-MEMBER | PROJ-VIEWER |
|---|---|---|---|---|---|
| UC-68 Nhận xét một phát hiện | ✔ | ✔ | ✔ | ✔ | ✔ |
| UC-69 Nhận xét cả lần phân tích | ✔ | ✔ | ✔ | ✔ | ✔ |
| UC-70 Xem nhận xét | ✔ | ✔ | ✔ | ✔ | ✔ |
| UC-71 Sửa/xóa nhận xét của chính mình | ✔ (của mình) | ✔ (của mình) | ✔ (của mình) | ✔ (của mình) | ✔ (của mình) |
| UC-72 Xem thống kê chất lượng AI | ✔ | — | ✔ | ✔ | — |

**Ghi chú về UC-72:** `WS-MEMBER` không có quyền vì đây là chỉ số quản trị chất lượng AI ở cấp project, không phải chỉ số workspace. `PROJ-VIEWER` không có quyền vì đây là số liệu quản trị.

**Quy tắc bổ sung cho nhóm 11:**
- **Ai cũng được nhận xét** — kể cả `PROJ-VIEWER`. Lý do: nhận xét là đóng góp chất lượng, không phải hành động phá huỷ dữ liệu; hạn chế quyền nhận xét sẽ làm giảm chất lượng dữ liệu học lại.
- **Nhận xét không sửa dữ liệu** — nên không vi phạm nguyên tắc bất biến dữ liệu (mục 3.14).
- **Chỉ sửa được nhận xét của chính mình.** `PROJ-OWNER` có thể xoá nhận xét vi phạm của thành viên — nếu không, một nhận xét sai sẽ sống vĩnh viễn và ô nhiễm kho mẫu học lại.

### 3.14. Tác động của quyết định "chỉ đọc" đến luồng nghiệp vụ (2026-11-05)

> **Bổ sung v4 (2026-11-05):** Nhận xét người dùng (nhóm 11) **không làm mất tính bất biến của dữ liệu**. Nhận xét là **lớp đánh giá tách biệt**, ghi vào collection riêng (`finding_feedback`, append-only), không ghi vào `dataset_record`, không sửa `analysis_result`, không ảnh hưởng `input_fingerprint`.

#### 3.14.1. Nguyên tắc áp dụng

Mọi luồng trong tài liệu này tuân thủ một quy tắc duy nhất: **hệ thống không ghi vào dữ liệu người dùng**. Dữ liệu được ghi đúng một lần lúc Import và không bao giờ bị sửa hay xoá.

#### 3.14.2. Bảng tổng hợp thay đổi

| Use case | Trạng thái v2 | Trạng thái v3 | Lý do |
|---|---|---|---|
| `UC-11` Xóa dòng | Có | ❌ **Gỡ** | Ghi dữ liệu |
| `UC-12` Reset Dataset | Reset toàn bộ trạng thái làm việc | ⚠️ **Thu hẹp** — chỉ khôi phục tên cột gốc | Không còn trạng thái dữ liệu để khôi phục |
| `UC-18` Sửa ô | Có | ❌ **Gỡ** | Ghi dữ liệu |
| `UC-28` Clean rules | Có (LEGACY) | ❌ **Gỡ** | `apply` ghi dữ liệu; `preview` dựa trên khái niệm "làm sạch" |
| `UC-29` Phiên bản dataset | Có (LEGACY) | ❌ **Gỡ** | Rollback ghi đè dữ liệu; commit/diff vô nghĩa khi dữ liệu bất biến |
| `UC-30` Đồ thị lineage | Có (LEGACY) | ❌ **Gỡ** | Mô tả chuỗi phiên bản dữ liệu — không còn phiên bản |
| `UC-58` Chi tiết phiên bản project | Có | ❌ **Gỡ** | Cùng lý do `UC-29` |
| `UC-59` Quay lại phiên bản project | Có | ❌ **Gỡ** | Cùng lý do `UC-29` |

**Tổng: 66 use case còn hiệu lực** (v2: 67; v3: 62; v4: gỡ `UC-09` → 61, thêm nhóm 11 `UC-68`→`UC-72` → **66**).

#### 3.14.3. Quy tắc nghiệp vụ được đơn giản hóa

| Quy tắc cũ | Quy tắc mới |
|---|---|
| "Xóa dòng chỉ tác động dữ liệu làm việc, file gốc giữ nguyên" | Không còn khái niệm "dữ liệu làm việc khác dữ liệu gốc" — chúng **luôn bằng nhau** |
| "Sửa ô không làm mất hiệu lực kết quả phân tích (`keep` + `warn_only`)" | Bỏ hẳn — mọi thay đổi đầu vào đều gây `stale` |
| "Giá trị thiếu/không hợp lệ bị loại khỏi phép tính, không xóa khỏi dataset" | Giữ nguyên — nay là quy tắc duy nhất, không còn nhánh "đã xóa dòng" |
| "Reset Dataset khôi phục trạng thái làm việc về ban đầu" | "Reset Dataset khôi phục **tên cột** về tên gốc" |
| "Bản lưu gồm trạng thái dữ liệu sau khi xóa dòng" | "Bản lưu gồm **cấu hình + kết quả phân tích + Tổng kết**" |
| "AI có thể đề xuất xử lý" | Giữ nguyên — nhưng đề xuất **không có đường dẫn thực thi** (mục 3.14.4) |

#### 3.14.4. Đề xuất của AI — không có đường dẫn thực thi

- AI giữ 4 vai trò: phát hiện vấn đề bổ sung, giải thích, **đề xuất xử lý**, nhận xét chất lượng dữ liệu.
- Không có endpoint "apply suggestion", không có worker tự động sửa dữ liệu.
- Đề xuất trình bày dưới dạng: **mô tả vấn đề + hướng xử lý gợi ý + tham chiếu bằng chứng**.
- AI không được ghi đè mức ảnh hưởng do backend quyết định.

#### 3.14.5. Đường ghi dữ liệu còn lại

Sau khi thu hẹp, toàn hệ thống chỉ còn **một** đường ghi vào `dataset_record`:

```
Upload file → Storage (giữ nguyên file gốc, bất biến)
            → Parse & validate
            → Bulk insert dataset_record (ghi 1 lần, không bao giỏ sửa/xoá)
            → Ghi dataset
```

Mọi đường ghi khác vào dữ liệu người dùng đều bị gỡ. Điều này loại bỏ hẳn các nhóm lỗi: ghi đè dữ liệu, mất dữ liệu do transaction lỗi giữa chừng, race condition khi sửa ô đồng thời.

#### 3.14.6. Đánh đổi và rủi ro mới

| Mặt | Nội dung |
|---|---|
| **Mất** | Sửa nhanh tại chỗ; khôi phục dữ liệu; lịch sử phiên bản dataset; đồ thị lineage; preview rule |
| **Được** | Kết quả phân tích luôn mô tả đúng dữ liệu đang có; không có trạng thái trung gian gây nhầm lẫn; ít đường ghi hơn = ít bề mặt lỗi |
| **Rủi ro mới** | Người dùng có thể mong đợi hệ thống sửa giúp → cần thông điệp UI rõ: *"Hệ thống chỉ phát hiện và báo cáo — không tự sửa dữ liệu"* |

#### 3.14.7. Đồng bộ chéo

Quyết định này được áp dụng đồng bộ sang: Phần 2 (mục 3.40), Phần 4, Phần 6, Phần 7, Phần 8, Phần 9, Phần 11, Phần 12, Phần 13, Phần 14, `tech.md` và các tài liệu công nghệ.

### 3.15. Tác động của 4 quyết định v4 (2026-11-05)

#### 3.15.1. Chỉ làm việc với file `.csv`

| Được | Mất |
|---|---|
| Gỡ toàn bộ logic đọc `.xlsx` (chọn sheet, sheet ẩn, ô công thức, ô gộp, file có mật khẩu, giải nén ZIP) | Chọn sheet (`UC-09`) — CSV chỉ có 1 bảng |
| Rủi ro parsing giảm rõ rệt; test đơn giản hơn nhiều | Người dùng phải export từ Excel sang CSV |
| Import **streaming** — không nạp toàn bộ file vào RAM | Tính năng "nhiều bảng trong 1 file" |
| Collection `dataset_sheet` gộp vào `dataset` → **21 → 20 collection** | — |

**Quy tắc bù trừ:** người dùng có nhiều bảng → tách thành nhiều project (mỗi project 1 file CSV), phù hợp nguyên tắc đã chốt.

#### 3.15.2. Phân trang cursor thay offset

Áp dụng cho **toàn bộ** danh sách có thể dài: bảng dữ liệu, bằng chứng mức ô, danh sách workspace/project, thành viên, thông báo, báo cáo sự cố, nhận xét.

| | Offset (v3) | Cursor (v4) |
|---|---|---|
| Trang 2 lặp/mất dòng khi có bản ghi mới | ✔ xảy ra | ❌ không |
| Truy vấn DB | `skip`+`limit` → chậm dần | keyset `(sortKey, id)` → luôn O(log n) |
| Tổng số (`total`, `totalPages`) | ✔ | ❌ không có (thay bằng `hasMore`) |
| Chia sẻ link tới trang N | ✔ | ❌ phải dùng cursor |

**Đánh đổi:** mất `total`/`totalPages` và mất khả năng nhảy tới trang N. Đổi lại danh sách ổn định — điều kiện chuyển đổi đã ghi ở Phần 5 v3 ("danh sách vượt 10.000 bản ghi") nay **đã đạt** với `dataset_record`.

#### 3.15.3. Nhận xét người dùng và học lại

- Thêm nhóm 11 (`UC-68`→`UC-72`), thêm collection `finding_feedback` (append-only) và kho mẫu học lại.
- **Không vi phạm bất biến dữ liệu** — nhận xét là lớp đánh giá tách biệt.
- Mở đường cho việc đo chất lượng AI theo thời gian và quyết định đổi model có căn cứ.

#### 3.15.4. AI chạy nội bộ

- `UC-20` (chạy phân tích) và `UC-21`/`UC-22` (trạng thái/thử lại AI) giữ nguyên luồng, chỉ đổi **hạ tầng phía sau**: job đi qua Kafka thay vì job table MongoDB + polling; adapter gọi engine suy luận nội bộ thay vì HTTP ra Internet.
- **Timeout tăng 60s → 180s**; thêm trạng thái `skipped`.
- Rủi ro mới: AI lỗi nhiều hơn vì CPU-only chậm → đã bù bằng cơ chế hàng đợi + trạng thái `skipped` + kiểm thử benchmark bắt buộc trước khi chốt model.

## 4. Đầu vào và đầu ra

- **Đầu vào:** yêu cầu người dùng, kết quả các phần trước (phần 1, phần 2 v2, phần 6 v2, phần 12 v2) và mã nguồn/tài liệu hiện trạng liên quan.
- **Đầu ra:** kế hoạch lần đầu trong file v1 này; ghi rõ quyết định, lý do, phương án khác, trade-off, rủi ro, giới hạn và ảnh hưởng liên quan.

## 5. Điều kiện hoàn tất phần này

Mỗi tính năng có use case và quy tắc đủ rõ để thiết kế API, domain và test.

**Trạng thái v3:** đạt cho **62 use case**: 26 use case sản phẩm mới của v1 (UC-01 → UC-27, trừ `UC-11` và `UC-18`), **1** use case LEGACY (`UC-31`) và **36 use case mới** (UC-32 → UC-67, trừ `UC-58` và `UC-59`) cho các tính năng mới trong phần 2 v4 — nhóm 7 xác thực (UC-32 → UC-46), nhóm 8 workspace/project bổ sung (UC-47 → UC-57), nhóm 9 thông báo (UC-60 → UC-63), nhóm 10 báo cáo sự cố (UC-64 → UC-67).

**Cập nhật 2026-11-05:** 5 use case bị gỡ theo quyết định "chỉ đọc" (`UC-11`, `UC-18`, `UC-28`, `UC-29`, `UC-30`, `UC-58`, `UC-59` — tính cả 2 use case nhóm 8), `UC-12` được thu hẹp. Chi tiết tại mục 3.14.

**Đối chiếu với phần 2 v3:** 36 use case mới phủ đúng 35 tính năng cần thiết kế mới hoàn toàn, cộng `UC-63` (nhận thông báo từ sự kiện hệ thống) là use case hệ thống không có endpoint trực tiếp. 10 tính năng đã có UC sẵn ở v1 không viết lại: `PROJ-01`, `PROJ-10`, `PROJ-11`, `PROJ-12`, `PROJ-13`, `WS-01`, `WS-07`, `WS-10`.

**Việc cần làm ở phần sau, do v2 sinh ra:**
- **Phần 6 (quyền):** nâng lên v3 để thêm vai trò `admin` hệ thống và chốt quyền cụ thể cho 36 use case mới — đặc biệt các điểm mới: `WS-MEMBER` có quyền đọc cấp workspace (UC-47, UC-48, UC-50), chỉ `WS-OWNER` xóa project (UC-55), `PROJ-MEMBER` không rollback phiên bản (UC-59), `SYS-ADMIN` không xem phiên đăng nhập của người khác (UC-39 → UC-42), `SYS-ADMIN` không đọc dữ liệu project.
- **Phần 4 (ranh giới module):** xác định module mới `notifications`, `issues`, `admin`; ghi nhận `versions` được kéo vào phạm vi giao hàng (Đợt 3).
- **Phần 8 (schema):** trường mới `project.status`, `project.last_accessed_at`, `workspace.last_accessed_at`, `user.phone`, `user.bio`, `user.notifications_enabled`, `user.password_reset_otp_hash`, `user.password_reset_otp_expires_at`, `user.password_reset_otp_attempts`, collection `notification`, collection `issue_report`.
- **Phần 7 (hợp đồng API):** 36 endpoint mới, gồm 5 endpoint công khai, 10 endpoint tài khoản tự thao tác và 21 endpoint có phân quyền.

Trước khi chuyển sang Phần 4 cần chốt các câu hỏi ở mục 6.2.

## 6. Câu hỏi và phụ thuộc còn mở

### 6.1. Đã chốt ở v1

- Phạm vi UC, actor cho từng use case và ma trận quyền tại mục 3.8.
- Mức chi tiết use case: đầy đủ 7 trường (actor, tiền điều kiện, input, luồng chính, luồng lỗi, hậu điều kiện, quyền).
- `PROJ-VIEWER` được xem bằng chứng mức ô (UC-24).
- Import file chỉ do `WS-OWNER`/`PROJ-OWNER` thực hiện (UC-08).
- ~~Module LEGACY **có** use case trong Phần 3 (UC-28 → UC-31)~~ — **cập nhật 2026-11-05**: chỉ còn `UC-31` (xuất CSV). `UC-28`/`UC-29`/`UC-30` đã bị gỡ cùng module `clean-rules`/`versions`/`lineage` (mục 3.14).

### 6.1b. Đã chốt ở v2 (bổ sung 2026-11-05)

- **Vai trò `admin` hệ thống:** giữ theo mã nguồn hiện tại, nằm ngoài phân cấp workspace/project; chỉ dùng cho UC-46 và UC-67. Không đọc dữ liệu project, không phải thành viên workspace, không nâng quyền nghiệp vụ (phần 2 v3, mục 3.34.1).
- **Quyền `WS-MEMBER` ở cấp workspace:** chỉ **đọc** — UC-47, UC-48, UC-50.
- **Xóa project:** chỉ `WS-OWNER` (UC-55).
- **Rollback phiên bản:** `PROJ-OWNER` và `WS-OWNER`; `PROJ-MEMBER` không được (UC-59).
- **Ghi nhớ đăng nhập:** chỉ nhớ email, không lưu mật khẩu (UC-35).
- **Quên mật khẩu:** OTP 6 số, hết hạn 10 phút, tối đa 5 lần gửi/giờ, 3 lần nhập sai (UC-36, UC-37).
- **Reset mật khẩu:** thu hồi toàn bộ phiên (UC-37). **Đổi mật khẩu:** giữ phiên hiện tại, thu hồi phiên khác (UC-38).
- **Rotation refresh token:** có phát hiện tái sử dụng → thu hồi toàn bộ phiên (UC-43).
- **Thông báo:** chỉ từ sự kiện hệ thống, một công tắc bật/tắt chung, nhóm bắt buộc gồm đúng 2 loại (UC-60 → UC-63).
- **Báo cáo sự cố:** luồng đơn giản, Admin chỉ đổi trạng thái, không có phản hồi bằng văn bản (UC-64 → UC-67).
- **Audit log:** chỉ ghi cho hành động nhạy cảm mới — UC-46, UC-51, UC-67 và các thay đổi vai trò thành viên.

### 6.2. Còn mở

1. **Hệ quả của quyết định "chỉ Owner được import file" (UC-08):** `PROJ-MEMBER` vào project trống sẽ không có gì để làm. Cần xác nhận giữ nguyên quyết định (với lý do giảm bề mặt tấn công của file upload) hay mở rộng cho `PROJ-MEMBER`. Xem mục 3.8.
2. **Thứ tự ưu tiên phát hiện trong Tổng kết (UC-23):** thứ tự ưu tiên hiện được ghi "theo mức độ ảnh hưởng" nhưng chưa chốt cụ thể — theo mức ảnh hưởng rồi theo số lượng ô lỗi, hay theo nhóm DQ, hay theo tần suất kiểm tra?
3. **Đơn vị cấu hình cho ngưỡng và tinh chỉnh tham số:** các ngưỡng có thể chỉnh được (IQR multiplier, Modified Z-score, tỷ lệ thiếu, IR, VIF) lấy đơn vị và phạm vi giá trị cụ thể — liên quan mục 6.2 phần 2 và mục 6.2 phần 6.
4. **Bố cục báo cáo PDF (UC-26):** số phát hiện tối đa, có phân trang bằng chứng trong PDF không, có phụ lục thống kê đầy đủ không.
5. **Số lượng tệp đính kèm tối đa và định dạng được phép của báo cáo sự cố (UC-64):** đề xuất 10 MB/tệp, tối đa 3 tệp; cần chốt danh sách mime type được phép.
6. **Chính sách giữ lại thông báo (UC-60):** giữ N ngày hay tối đa M bản ghi; cần chốt giá trị.
7. **Cơ chế thu hồi quyền khi đổi mật khẩu (UC-38):** đã chốt giữ phiên hiện tại và thu hồi phiên khác — cần chốt xem có cần hiển thị cảnh báo "đăng xuất ở thiết bị khác" cho người dùng không.
8. **Số lần thử đăng nhập tối đa (UC-33):** mục 3.1 đã nêu 5 lần/giờ/IP+email theo phần 2 v3 (`AUTH-13`); cần chốt xem có tách ngưỡng theo email và theo IP hay dùng chung một ngưỡng.

### 6.3. Phụ thuộc bên ngoài

- Phụ thuộc vào **AI engine cục bộ** (`AI_ENGINE_URL`, `AI_MODEL_ID`), cấu hình S3/R2, Kafka và MongoDB cho UC-08, UC-20, UC-21, UC-22.
- Phụ thuộc vào quyết định cuối cùng về module LEGACY ở mục 6.2 phần 2 (giữ ngoài phạm vi hay thu hồi).
- **Dịch vụ gửi email** — cần cho UC-36 (gửi OTP), UC-37 và lời mời thành viên workspace (UC-03, UC-07). Yêu cầu port `EmailSender` với adapter SMTP; thiếu cấu hình thì trả `DEPENDENCY_UNAVAILABLE` chứ không im lặng.
- **Google OAuth client** — `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` cho UC-34. Cần HTTPS cho redirect URI.
- **Hạ tầng rate-limit** — UC-33, UC-36, UC-38 cần cơ chế đếm theo IP/email; in-memory chỉ hiệu quả với một instance, cần ghi nhận trong Phần 10.
- **Port Storage** — cho tệp đính kèm của báo cáo sự cố (UC-64).

## 7. Prompting log và lịch sử thay đổi

- **Xác nhận v2 / 2026-11-05:** Bổ sung 36 use case mới (UC-32 → UC-67) trong 4 nhóm: xác thực/tài khoản (UC-32 → UC-46), workspace/project bổ sung (UC-47 → UC-59), thông báo (UC-60 → UC-63), báo cáo sự cố (UC-64 → UC-67) / Theo phần 2 v3 mục 3.32–3.38 và quyết định `part2_only` đã được duyệt / Bổ sung mục 3.10–3.13, ma trận quyền v2 tại mục 3.8, 4 vòng đời trạng thái mới tại mục 3.9, 2 mã lỗi mới (`TOKEN_INVALID`, `TOKEN_EXPIRED`) tại mục 3.1.
- **Xác nhận v2 / 2026-11-05:** Thêm ký hiệu actor `SYS-ADMIN` và `SELF` cho nhóm xác thực, thông báo và báo cáo sự cố / Theo phần 2 v3 mục 3.34.1 / Bổ sung bảng vai trò hệ thống tại mục 3.1; `SYS-ADMIN` không nâng quyền nghiệp vụ.
- **Xác nhận v2 / 2026-11-05:** `WS-MEMBER` có quyền đọc cấp workspace (UC-47, UC-48, UC-50) / Theo quyết định `read_only` của người dùng / Ghi vào ma trận quyền v2.
- **Xác nhận v2 / 2026-11-05:** UC-55 xóa project chỉ `WS-OWNER`; ~~UC-59 rollback phiên bản chỉ `PROJ-OWNER`/`WS-OWNER`~~ — **UC-59 đã bị gỡ 2026-11-05** (mục 3.14). / Theo phần 2 v3 mục 3.36 / Ghi vào ma trận quyền v2 và quy tắc đọc ma trận.
- **Xác nhận v2 / 2026-11-05:** Chia đợt giao hàng — nhóm xác thực, thông báo, báo cáo sự cố thuộc Đợt 1; `PROJ-06`→`PROJ-08` thuộc Đợt 3 / Theo phần 2 v3 mục 3.39 / Ghi rõ trong từng use case và ở mục 5.
- **Yêu cầu:** Người dùng đồng ý bổ sung use case cho Phần 3 sau khi hoàn thành Phần 2 v3.
- **Xác nhận v1 / 2026-11-04:** `PROJ-VIEWER` được xem bằng chứng mức ô / Theo lựa chọn người dùng / Chốt UC-24 và dòng tương ứng trong ma trận quyền; ghi nhận rằng phạm vi dữ liệu không mở rộng so với quyền xem Data Views.
- **Xác nhận v1 / 2026-11-04:** Chỉ `WS-OWNER`/`PROJ-OWNER` được import file; `PROJ-MEMBER` không được / Theo lựa chọn người dùng / Chốt UC-08 và actor của UC-08; ghi nhận hệ quả tại mục 3.8 và câu hỏi mở tại mục 6.2.
- **Xác nhận v1 / 2026-11-04:** Module LEGACY **có** use case trong Phần 3 / Theo lựa chọn người dùng / Bổ sung nhóm 6 với UC-28 → UC-31, mô tả hành vi hiện hữu và ghi rõ nằm ngoài phạm vi nghiệm thu. **Cập nhật 2026-11-05:** 3 trong 4 use case LEGACY này đã bị gỡ (mục 3.14).
- **Xác nhận v1 / 2026-11-04:** Mức chi tiết use case đầy đủ 7 trường / Theo lựa chọn người dùng / Áp dụng cho toàn bộ 31 use case.
- **Yêu cầu:** Người dùng yêu cầu liệt kê toàn bộ các phần theo thứ tự thực hiện, tạo sẵn file v1, lần lượng hoàn thiện vòng đầu rồi tạo v2 khi có thay đổi tiếp theo.
- **v1 / 2026-11-02:** Tạo khung phần 3 / Chuẩn bị thảo luận tuần tự / Chỉ tạo tài liệu, chưa thực thi thay đổi backend hoặc dữ liệu.
- **Xác nhận v5 / 2026-11-06:** UC-20 chạy DQ-05 có điều kiện + ma trận/VIF + nhận xét AI tương quan (mục 3.5 Phần 2 v7) / Theo yêu cầu người dùng / Mở rộng luồng hệ thống + AI và kiểm chứng trích dẫn số.
