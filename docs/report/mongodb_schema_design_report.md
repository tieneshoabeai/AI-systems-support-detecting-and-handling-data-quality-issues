# BÁO CÁO THIẾT KẾ SCHEMA CƠ SỞ DỮ LIỆU MONGODB
## HỆ THỐNG AI HỖ TRỢ PHÁT HIỆN VÀ XỬ LÝ VẤN ĐỀ CHẤT LƯỢNG DỮ LIỆU
### (Full-Stack Data Quality Management Platform with AI Assistance)

---

## 1. NGUYÊN TẮC THIẾT KẾ SCHEMA NOSQL DOCUMENT

### Các nguyên tắc cốt lõi:
1. **Chiến lược Xóa mềm (Soft Delete Lifecycle):** Mọi tài liệu nghiệp vụ kế thừa từ `BaseEntity` đều sở hữu trường `deleted_at: Date | null`. Thao tác xóa không thực thi lệnh `deleteOne/deleteMany` vật lý mà chỉ gán nhãn thời gian xóa, bảo toàn tính lịch sử và bằng chứng kiểm toán phả hệ dữ liệu.
2. **Partial Unique Indexes:** Các ràng buộc duy nhất (Unique Constraints như `email` hay `version_number`) chỉ áp dụng cho các tài liệu đang hoạt động (`partialFilterExpression: { deleted_at: null }`), cho phép người dùng đăng ký lại cùng email nếu tài khoản cũ đã bị xóa mềm.
3. **Giới hạn kích thước tài liệu BSON (16MB Limit Protection):** Dữ liệu bảng (table rows) có thể lên tới hàng triệu dòng, tuyệt đối không được nhúng trực tiếp vào tài liệu `Dataset`. Toàn bộ các dòng được chuẩn hóa thành từng tài liệu độc lập trong collection `dataset_records` kết hợp với chỉ mục phức hợp để phân trang Keyset siêu tốc.

---

## 2. CHI TIẾT 10 COLLECTIONS TRONG HỆ THỐNG

---

### COLLECTION 1: `users`
- **Mục đích lưu trữ:** Lưu trữ thông tin định danh người dùng, hồ sơ cá nhân, phân quyền hệ thống và thông tin bảo mật tài khoản.
- **Mô hình liên kết:** Độc lập (Root Entity). Được tham chiếu bởi các collection khác qua `Types.ObjectId`.

#### Bảng đặc tả trường dữ liệu (Attributes Specification):
| Tên trường | Kiểu dữ liệu | Bắt buộc | Mặc định | Mô tả nghiệp vụ |
|---|---|:---:|:---:|---|
| `_id` | `ObjectId` | Có | Tự sinh | Khóa chính duy nhất của người dùng |
| `email` | `String` | Có | Không | Địa chỉ email duy nhất dùng để đăng nhập (lowercase, trim) |
| `password_hash` | `String` | Không | Không | Mã băm mật khẩu bằng thuật toán Argon2id (`select: false` để bảo mật) |
| `google_id` | `String` | Không | `null` | Khóa định danh liên kết SSO Google OAuth2 (sparse index) |
| `first_name` | `String` | Có | Không | Tên người dùng (tối đa 50 ký tự) |
| `last_name` | `String` | Có | Không | Họ và tên đệm của người dùng (tối đa 50 ký tự) |
| `avatar_url` | `String` | Không | `null` | Đường dẫn ảnh đại diện cá nhân |
| `role` | `String` | Có | `'analyst'` | Phân quyền cấp hệ thống: `'admin'` hoặc `'analyst'` |
| `status` | `String` | Có | `'active'` | Trạng thái tài khoản: `'active'` (hoạt động) hoặc `'blocked'` (bị khóa) |
| `password_reset_token_hash` | `String` | Không | `null` | Mã băm token khôi phục mật khẩu (`select: false`) |
| `password_reset_expires_at` | `Date` | Không | `null` | Thời điểm hết hạn của token khôi phục mật khẩu |
| `deleted_at` | `Date` | Không | `null` | Thời điểm xóa mềm (nếu `null` là tài khoản đang hoạt động) |
| `created_at` | `Date` | Có | Tự sinh | Thời điểm tài khoản được khởi tạo |
| `updated_at` | `Date` | Có | Tự sinh | Thời điểm cập nhật hồ sơ gần nhất |

#### Chiến lược Chỉ mục (Indexing Strategy):
- `{ email: 1 }` (Unique, `partialFilterExpression: { deleted_at: null }`): Đảm bảo tính duy nhất của email giữa các tài khoản chưa bị xóa mềm.
- `{ google_id: 1 }` (Unique, Sparse): Tối ưu truy vấn đăng nhập nhanh bằng tài khoản Google.
- `{ created_at: -1, _id: -1 }`: Hỗ trợ phân trang Cursor danh sách người dùng cho Quản trị viên.
- `{ role: 1 }`, `{ status: 1 }`, `{ deleted_at: 1 }`: Tối ưu lọc người dùng theo trạng thái và phân quyền.

---

### COLLECTION 2: `user_sessions`
- **Mục đích lưu trữ:** Quản lý các phiên đăng nhập (Refresh Token Sessions), thiết bị và địa chỉ IP truy cập; hỗ trợ tự động hủy phiên hết hạn.
- **Mô hình liên kết:** Tham chiếu tới `users._id` qua trường `user_id`.

#### Bảng đặc tả trường dữ liệu:
| Tên trường | Kiểu dữ liệu | Bắt buộc | Mặc định | Mô tả nghiệp vụ |
|---|---|:---:|:---:|---|
| `_id` | `ObjectId` | Có | Tự sinh | Khóa chính của phiên làm việc |
| `user_id` | `ObjectId` | Có | Không | Tham chiếu `User._id` của chủ sở hữu phiên |
| `refresh_token_hash` | `String` | Có | Không | Mã băm SHA-256 của Refresh Token (`select: false`) |
| `device_name` | `String` | Không | `'Unknown Device'` | Tên thiết bị nhận diện tự động từ User-Agent (ví dụ: "macOS 15 - Chrome 133") |
| `ip_address` | `String` | Không | `null` | Địa chỉ IP của máy khách khi đăng nhập |
| `user_agent` | `String` | Không | `null` | Chuỗi User-Agent đầy đủ gửi từ trình duyệt |
| `is_revoked` | `Boolean` | Có | `false` | Cờ đánh dấu phiên đã bị thu hồi từ xa hay chưa |
| `expires_at` | `Date` | Có | Không | Thời điểm hết hạn của phiên (thời gian sống 7 ngày) |
| `created_at` | `Date` | Có | Tự sinh | Thời điểm khởi tạo phiên đăng nhập |
| `updated_at` | `Date` | Có | Tự sinh | Thời điểm gia hạn token gần nhất |

#### Chiến lược Chỉ mục (Indexing Strategy):
- `{ expires_at: 1 }` (TTL Index, `expires: '7d'`): **Cơ chế Time-To-Live tự động dọn dẹp**. MongoDB ngầm xóa các bản ghi phiên đã quá hạn 7 ngày, giải phóng bộ nhớ mà không cần viết cron job dọn rác.
- `{ user_id: 1, is_revoked: 1 }`: Tối ưu truy vấn kiểm tra tính hợp lệ của phiên khi gọi API `/auth/refresh` và `/auth/sessions`.

---

### COLLECTION 3: `workspaces`
- **Mục đích lưu trữ:** Định nghĩa Không gian làm việc (Multi-tenant Tenant Workspace), nhóm dự án và danh sách thành viên cộng tác.
- **Mô hình liên kết:**
  - `owner_id`: Tham chiếu `users._id`.
  - `members`: **Mô hình Nhúng (Embedded Sub-document Array)** chứa thông tin vai trò của thành viên trong workspace.

#### Bảng đặc tả trường dữ liệu:
| Tên trường | Kiểu dữ liệu | Bắt buộc | Mặc định | Mô tả nghiệp vụ |
|---|---|:---:|:---:|---|
| `_id` | `ObjectId` | Có | Tự sinh | Khóa chính của Không gian làm việc |
| `name` | `String` | Có | Không | Tên không gian làm việc (tối đa 100 ký tự) |
| `description` | `String` | Không | `''` | Mô tả phạm vi nghiệp vụ của workspace |
| `owner_id` | `ObjectId` | Có | Không | Tham chiếu `User._id` của người sở hữu |
| `members` | `Array<IWorkspaceMember>`| Có | `[]` | Mảng nhúng các thành viên và vai trò cộng tác |
| `↳ members.user_id` | `ObjectId` | Có | Không | Tham chiếu `User._id` của thành viên |
| `↳ members.role` | `String` | Có | `'viewer'` | Vai trò: `'owner'`, `'editor'`, hoặc `'viewer'` |
| `↳ members.joined_at` | `Date` | Có | `Date.now` | Thời điểm tham gia workspace |
| `deleted_at` | `Date` | Không | `null` | Nhãn xóa mềm workspace |
| `created_at` | `Date` | Có | Tự sinh | Thời điểm tạo workspace |
| `updated_at` | `Date` | Có | Tự sinh | Thời điểm cập nhật gần nhất |

#### Lý do chọn kỹ thuật Nhúng (Embedding) cho `members`:
Số lượng thành viên trong một Workspace thường dưới 100 người (quan hệ 1:Few). Việc nhúng trực tiếp danh sách thành viên giúp kiểm tra quyền hạn thuộc tính (CASL ABAC Authorization) ngay trong một truy vấn duy nhất mà không cần thực hiện `$lookup` tốn kém.

#### Chiến lược Chỉ mục (Indexing Strategy):
- `{ owner_id: 1, deleted_at: 1 }`: Tối ưu tìm kiếm workspace do người dùng sở hữu.
- `{ 'members.user_id': 1, deleted_at: 1 }`: Tối ưu tìm kiếm các workspace mà người dùng tham gia làm thành viên.

---

### COLLECTION 4: `projects`
- **Mục đích lưu trữ:** Quản lý dự án chất lượng dữ liệu thuộc về một Workspace, theo dõi trạng thái đã có tập dữ liệu (`has_dataset`) hay chưa.
- **Mô hình liên kết:** Tham chiếu `workspaces._id` qua `workspace_id`, và `users._id` qua `created_by`.

#### Bảng đặc tả trường dữ liệu:
| Tên trường | Kiểu dữ liệu | Bắt buộc | Mặc định | Mô tả nghiệp vụ |
|---|---|:---:|:---:|---|
| `_id` | `ObjectId` | Có | Tự sinh | Khóa chính của dự án |
| `workspace_id` | `ObjectId` | Có | Không | Tham chiếu `Workspace._id` cha chứa dự án |
| `name` | `String` | Có | Không | Tên dự án (tối đa 100 ký tự) |
| `description` | `String` | Không | `''` | Mô tả mục tiêu của dự án dữ liệu |
| `has_dataset` | `Boolean` | Có | `false` | Cờ chỉ định dự án đã nạp tập dữ liệu vào hay chưa |
| `created_by` | `ObjectId` | Có | Không | Tham chiếu `User._id` người tạo dự án |
| `deleted_at` | `Date` | Không | `null` | Nhãn xóa mềm dự án |
| `created_at` | `Date` | Có | Tự sinh | Thời điểm khởi tạo dự án |
| `updated_at` | `Date` | Có | Tự sinh | Thời điểm cập nhật dự án |

#### Chiến lược Chỉ mục (Indexing Strategy):
- `{ workspace_id: 1, deleted_at: 1 }`: Tối ưu lọc danh sách dự án còn hoạt động trong một workspace.
- `{ workspace_id: 1, name: 1, deleted_at: 1 }`: Hỗ trợ tìm kiếm nhanh theo tên dự án trong workspace.

---

### COLLECTION 5: `datasets`
- **Mục đích lưu trữ:** Quản lý Metadata của tập dữ liệu tải lên (kích thước, định dạng, checksum SHA-256, vị trí lưu trữ Cloudflare R2, số dòng, cấu trúc cột).
- **Mô hình liên kết:** Tham chiếu `projects._id` qua `project_id`, `workspaces._id` qua `workspace_id`. Nhúng mảng cấu trúc schema cột `columns`.

#### Bảng đặc tả trường dữ liệu:
| Tên trường | Kiểu dữ liệu | Bắt buộc | Mặc định | Mô tả nghiệp vụ |
|---|---|:---:|:---:|---|
| `_id` | `ObjectId` | Có | Tự sinh | Khóa chính của tập dữ liệu |
| `project_id` | `ObjectId` | Có | Không | Tham chiếu `Project._id` trực thuộc |
| `workspace_id` | `ObjectId` | Có | Không | Tham chiếu `Workspace._id` |
| `name` | `String` | Có | Không | Tên tập dữ liệu (tối đa 100 ký tự) |
| `original_file_name` | `String` | Có | Không | Tên tệp gốc được người dùng tải lên |
| `file_format` | `String` | Có | Không | Định dạng tệp: `'csv'`, `'xlsx'`, hoặc `'json'` |
| `file_size_bytes` | `Number` | Có | `0` | Dung lượng tệp gốc tính theo bytes |
| `file_checksum` | `String` | Có | Không | Mã băm SHA-256 kiểm toán toàn vẹn tệp nạp vào |
| `storage_key` | `String` | Có | Không | Khóa định danh vị trí lưu trữ trên bucket Cloudflare R2 |
| `row_count` | `Number` | Có | `0` | Tổng số dòng dữ liệu thực tế |
| `column_count` | `Number` | Có | `0` | Tổng số cột của tập dữ liệu |
| `columns` | `Array<IColumnDefinition>`| Có | `[]` | Mảng nhúng cấu trúc Schema các cột |
| `↳ columns.name` | `String` | Có | Không | Tên chuẩn hóa của cột (dùng làm key trong data record) |
| `↳ columns.data_type` | `String` | Có | `'string'` | Kiểu dữ liệu suy luận: `'string'`, `'number'`, `'boolean'`, `'date'` |
| `↳ columns.original_name`| `String` | Có | Không | Tên gốc của cột trong header tệp tải lên |
| `↳ columns.missing_count`| `Number` | Có | `0` | Số lượng ô dữ liệu bị trống (NULL) trong cột |
| `current_version` | `Number` | Có | `1` | Phiên bản làm sạch hiện hành (khởi tạo v1) |
| `status` | `String` | Có | `'INGESTING'`| Trạng thái nạp dữ liệu: `'INGESTING'`, `'READY'`, `'FAILED'` |
| `deleted_at` | `Date` | Không | `null` | Nhãn xóa mềm tập dữ liệu |
| `created_at` | `Date` | Có | Tự sinh | Thời điểm tải lên |
| `updated_at` | `Date` | Có | Tự sinh | Thời điểm cập nhật metadata |

#### Chiến lược Chỉ mục (Indexing Strategy):
- `{ project_id: 1, deleted_at: 1 }`: Đảm bảo truy vấn lấy tập dữ liệu của một dự án luôn trả kết quả tức thì.
- `{ workspace_id: 1, deleted_at: 1 }`: Hỗ trợ thống kê dung lượng lưu trữ toàn bộ workspace.
- `{ file_checksum: 1 }`: Nhận diện các tệp tải lên bị trùng lặp nội dung.

---

### COLLECTION 6: `dataset_records`
- **Mục đích lưu trữ:** Lưu trữ từng dòng dữ liệu (Rows/Records) của tập dữ liệu, phục vụ hiển thị lưới bảng ảo Virtual Grid và chỉnh sửa ô dữ liệu.
- **Mô hình liên kết:** Tham chiếu `datasets._id` qua `dataset_id`.

#### Bảng đặc tả trường dữ liệu:
| Tên trường | Kiểu dữ liệu | Bắt buộc | Mặc định | Mô tả nghiệp vụ |
|---|---|:---:|:---:|---|
| `_id` | `ObjectId` | Có | Tự sinh | Khóa chính của dòng dữ liệu |
| `dataset_id` | `ObjectId` | Có | Không | Tham chiếu `Dataset._id` chứa dòng này |
| `row_index` | `Number` | Có | Không | Chỉ số thứ tự dòng trong bảng ($0, 1, 2, \dots$) |
| `data` | `Record<string, unknown>` | Có | Không | Đối tượng linh hoạt (Mixed BSON) chứa các cặp `{ ten_cot: gia_tri }` |
| `version_number` | `Number` | Có | `1` | Số phiên bản ghi nhận sự thay đổi gần nhất của dòng này |
| `deleted_at` | `Date` | Không | `null` | Nhãn xóa mềm dòng dữ liệu |
| `created_at` | `Date` | Có | Tự sinh | Thời điểm nạp dòng |
| `updated_at` | `Date` | Có | Tự sinh | Thời điểm sửa đổi ô gần nhất |

#### Thiết kế Zero Any trên trường `data`:
Mặc dù trường `data` có cấu trúc linh hoạt theo từng tệp CSV khác nhau (Schema-less row data), codebase khai báo kiểu TypeScript là `Record<string, unknown>` (thay vì `any`). Mọi thao tác trích xuất và biến đổi giá trị đều phải qua các hàm Type Guard (`typeof`, `instanceof`) hoặc Zod schema validator.

#### Chiến lược Chỉ mục (Indexing Strategy):
- `{ dataset_id: 1, row_index: 1, deleted_at: 1 }` (Chỉ mục phức hợp cốt lõi - Compound Index): **Phục vụ kỹ thuật Keyset/Cursor Pagination**. Cho phép truy vấn nhảy trang `WHERE dataset_id = ... AND row_index > cursor LIMIT 50` đạt độ phức tạp $O(\log N)$, loại bỏ hoàn toàn tình trạng Full Table Scan.
- `{ dataset_id: 1, deleted_at: 1 }`: Hỗ trợ đếm hoặc xóa toàn bộ dòng khi xóa Dataset.

---

### COLLECTION 7: `dataset_versions`
- **Mục đích lưu trữ:** Lưu trữ các phiên bản dữ liệu phục vụ kiểm toán mật mã học Merkle DAG, hỗ trợ tính năng So sánh sai khác (Diff) và Khôi phục tại chỗ (Rollback).
- **Mô hình liên kết:** Tham chiếu `datasets._id`, `dataset_versions._id` (parent), và `users._id` (created_by).

#### Bảng đặc tả trường dữ liệu:
| Tên trường | Kiểu dữ liệu | Bắt buộc | Mặc định | Mô tả nghiệp vụ |
|---|---|:---:|:---:|---|
| `_id` | `ObjectId` | Có | Tự sinh | Khóa chính của bản ghi phiên bản |
| `dataset_id` | `ObjectId` | Có | Không | Tham chiếu `Dataset._id` |
| `version_number` | `Number` | Có | Không | Số thứ tự phiên bản ($1, 2, 3, \dots$) |
| `parent_hash` | `String` | Có | Không | Mã băm của phiên bản cha (phiên bản 1 dùng `'0'.repeat(64)`) |
| `parent_version_id` | `ObjectId` | Không | `null` | Tham chiếu ID phiên bản cha liền trước |
| `rules_hash` | `String` | Có | `'0'.repeat(64)` | Mã băm SHA-256 của danh sách các luật đã áp dụng |
| `data_checksum` | `String` | Có | Không | Mã băm SHA-256 toàn vẹn của nội dung dữ liệu tại phiên bản này |
| `version_hash` | `String` | Có | Không | **Mã băm Merkle Node**: $\text{SHA-256}(\text{parent} + \text{rules} + \text{data})$ |
| `snapshot_storage_key`| `String` | Có | Không | Đường dẫn tải tệp snapshot CSV lưu trên Cloudflare R2 |
| `record_count` | `Number` | Có | `0` | Tổng số dòng dữ liệu tại thời điểm commit |
| `change_summary` | `Object` | Có | Không | Tóm tắt lý do commit (`description` và danh sách `rule_ids`) |
| `created_by` | `ObjectId` | Có | Không | Tham chiếu `User._id` người thực hiện commit |
| `deleted_at` | `Date` | Không | `null` | Nhãn xóa mềm phiên bản |
| `created_at` | `Date` | Có | Tự sinh | Thời điểm commit |
| `updated_at` | `Date` | Có | Tự sinh | Thời điểm cập nhật |

#### Chiến lược Chỉ mục (Indexing Strategy):
- `{ dataset_id: 1, version_number: 1 }` (Unique, `partialFilterExpression: { deleted_at: null }`): Ngăn chặn việc tạo trùng lặp số phiên bản trong cùng một tập dữ liệu.
- `{ version_hash: 1 }`: Tối ưu đối soát và tìm kiếm nhanh khi xác minh chuỗi băm chống giả mạo.

---

### COLLECTION 8: `clean_rules`
- **Mục đích lưu trữ:** Lưu trữ định nghĩa và tham số của các quy tắc làm sạch dữ liệu (Null Handling, Standardization, Deduplication, Regex).
- **Mô hình liên kết:** Tham chiếu `datasets._id`, `workspaces._id`, và `users._id`.

#### Bảng đặc tả trường dữ liệu:
| Tên trường | Kiểu dữ liệu | Bắt buộc | Mặc định | Mô tả nghiệp vụ |
|---|---|:---:|:---:|---|
| `_id` | `ObjectId` | Có | Tự sinh | Khóa chính của quy tắc làm sạch |
| `dataset_id` | `ObjectId` | Có | Không | Tham chiếu `Dataset._id` áp dụng luật |
| `workspace_id` | `ObjectId` | Có | Không | Tham chiếu `Workspace._id` quản lý |
| `name` | `String` | Có | Không | Tên mô tả của luật (ví dụ: "Loại bỏ khoảng trắng thừa cột Email") |
| `category` | `String` | Có | Không | Nhóm quy tắc: `'null_handling'`, `'standardization'`, `'deduplication'`, `'regex'` |
| `action` | `String` | Có | Không | Hành động cụ thể: `'drop_rows'`, `'fill_median'`, `'uppercase'`, `'trim'`, v.v. |
| `target_column` | `String` | Không | `null` | Cột đơn lẻ chịu tác động |
| `target_columns` | `Array<String>` | Có | `[]` | Danh sách cột chịu tác động (dùng cho deduplication nhiều cột) |
| `parameters` | `Record<string, unknown>` | Có | `{}` | Tham số bổ sung (giá trị điền thay thế, mẫu regex, v.v.) |
| `is_active` | `Boolean` | Có | `true` | Trạng thái kích hoạt của luật |
| `created_by` | `ObjectId` | Có | Không | Tham chiếu `User._id` người thiết lập luật |
| `deleted_at` | `Date` | Không | `null` | Nhãn xóa mềm quy tắc |
| `created_at` | `Date` | Có | Tự sinh | Thời điểm tạo luật |
| `updated_at` | `Date` | Có | Tự sinh | Thời điểm sửa đổi luật |

#### Chiến lược Chỉ mục (Indexing Strategy):
- `{ dataset_id: 1, deleted_at: 1 }`: Tối ưu lấy toàn bộ danh sách luật của tập dữ liệu để chuẩn bị cho quá trình Preview hoặc Apply.
- `{ workspace_id: 1, deleted_at: 1 }`: Hỗ trợ tái sử dụng bộ luật trong cùng một không gian làm việc.

---

### COLLECTION 9: `export_tasks`
- **Mục đích lưu trữ:** Theo dõi và kiểm toán lịch sử các tác vụ xuất dữ liệu, định dạng xuất, mã băm tệp và trạng thái mã hóa AES-256-GCM.
- **Mô hình liên kết:** Tham chiếu `datasets._id`, `workspaces._id`, và `users._id`.

#### Bảng đặc tả trường dữ liệu:
| Tên trường | Kiểu dữ liệu | Bắt buộc | Mặc định | Mô tả nghiệp vụ |
|---|---|:---:|:---:|---|
| `_id` | `ObjectId` | Có | Tự sinh | Khóa chính của tác vụ xuất dữ liệu |
| `dataset_id` | `ObjectId` | Có | Không | Tham chiếu `Dataset._id` được xuất |
| `workspace_id` | `ObjectId` | Có | Không | Tham chiếu `Workspace._id` |
| `export_type` | `String` | Có | Không | Định dạng xuất: `'csv'` (thuần văn bản) hoặc `'aes256_gcm'` (mã hóa) |
| `file_name` | `String` | Có | Không | Tên tệp xuất tải về (ví dụ: `sales_data_clean.csv.enc`) |
| `storage_key` | `String` | Có | Không | Đường dẫn lưu trữ tệp xuất trên Cloudflare R2 |
| `file_size_bytes` | `Number` | Có | `0` | Dung lượng tệp xuất |
| `record_count` | `Number` | Có | `0` | Số lượng dòng dữ liệu được xuất ra |
| `checksum_sha256` | `String` | Có | Không | Mã băm SHA-256 xác thực tính toàn vẹn của tệp xuất |
| `is_encrypted` | `Boolean` | Có | `false` | Cờ chỉ định tệp có được bảo vệ bằng mật khẩu hay không |
| `created_by` | `ObjectId` | Có | Không | Tham chiếu `User._id` người thực hiện lệnh xuất |
| `deleted_at` | `Date` | Không | `null` | Nhãn xóa mềm tác vụ |
| `created_at` | `Date` | Có | Tự sinh | Thời điểm xuất dữ liệu |
| `updated_at` | `Date` | Có | Tự sinh | Thời điểm cập nhật trạng thái |

#### Chiến lược Chỉ mục (Indexing Strategy):
- `{ dataset_id: 1, deleted_at: 1 }`: Tối ưu hiển thị bảng kiểm toán xuất dữ liệu cho từng tập dữ liệu.
- `{ workspace_id: 1, deleted_at: 1 }`: Kiểm soát việc rò rỉ dữ liệu ở quy mô Không gian làm việc.

---

### COLLECTION 10: `outbox_events`
- **Mục đích lưu trữ:** Hiện thực hóa **Transactional Outbox Pattern**, đảm bảo độ tin cậy đồng bộ dữ liệu giữa MongoDB Atlas và Neo4j AuraDB / Message Queues mà không bị mất mát sự kiện khi có sự cố mạng.
- **Mô hình liên kết:** Lưu vết bất đồng bộ, độc lập.

#### Bảng đặc tả trường dữ liệu:
| Tên trường | Kiểu dữ liệu | Bắt buộc | Mặc định | Mô tả nghiệp vụ |
|---|---|:---:|:---:|---|
| `_id` | `ObjectId` | Có | Tự sinh | Khóa chính của sự kiện Outbox |
| `aggregate_type` | `String` | Có | Không | Loại thực thể phát sinh sự kiện: `'DATASET'`, `'DATASET_VERSION'`, `'TRANSFORMATION'` |
| `aggregate_id` | `String` | Có | Không | Mã ID của thực thể tương ứng |
| `event_type` | `String` | Có | Không | Tên sự kiện (ví dụ: `'VERSION_COMMITTED'`, `'DATASET_INGESTED'`) |
| `payload` | `Record<string, unknown>` | Có | Không | Dữ liệu sự kiện chi tiết được serialized |
| `status` | `String` | Có | `'PENDING'` | Trạng thái xử lý sự kiện: `'PENDING'`, `'PROCESSED'`, `'FAILED'` |
| `retry_count` | `Number` | Có | `0` | Số lần đã thử lại khi gặp lỗi gửi sang Neo4j/Worker |
| `error_message` | `String` | Không | `null` | Thông điệp lỗi chi tiết nếu xử lý thất bại |
| `processed_at` | `Date` | Không | `null` | Thời điểm sự kiện được xử lý thành công |
| `created_at` | `Date` | Có | Tự sinh | Thời điểm phát sinh sự kiện |
| `updated_at` | `Date` | Có | Tự sinh | Thời điểm cập nhật trạng thái retry |

#### Chiến lược Chỉ mục (Indexing Strategy):
- `{ status: 1, retry_count: 1, created_at: 1 }` (Chỉ mục phức hợp polling): **Tối ưu hóa tác vụ Outbox Polling Worker**. Giúp worker tìm nạp các sự kiện `PENDING` có số lần thử lại thấp nhất với tốc độ cực nhanh mà không gây khóa cơ sở dữ liệu.

---

## 3. CÁC MẪU THIẾT KẾ DỮ LIỆU ĐẶC BIỆT ĐƯỢC ÁP DỤNG

### 3.1. Keyset / Cursor Pagination Pattern (Tối ưu Lưới Bảng Ảo)
- **Vấn đề của Offset/Skip:** Lệnh `skip(100000).limit(50)` buộc cơ sở dữ liệu phải duyệt tuần tự qua 100,000 bản ghi BSON rồi mới lấy 50 dòng, tiêu tốn $O(N)$ thời gian và gây nghẽn CPU.
- **Giải pháp Keyset:** Tận dụng chỉ mục phức hợp `{ dataset_id: 1, row_index: 1, deleted_at: 1 }`. Truy vấn trang tiếp theo luôn bắt đầu bằng điều kiện so sánh trực tiếp:
  ```typescript
  const filter = {
    dataset_id: new Types.ObjectId(datasetId),
    row_index: { $gt: cursor },
    deleted_at: null,
  };
  return this.recordModel.find(filter).sort({ row_index: 1 }).limit(limit);
  ```
  Nhờ đó, tốc độ truy vấn trang thứ 1 hay trang thứ 10,000 đều phản hồi tức thời dưới **10ms**.

### 3.2. Transactional Outbox Pattern (Đảm bảo Tính Toàn vẹn Phân tán)
- **Vấn đề Dual-Write:** Khi người dùng áp dụng một luật làm sạch, hệ thống vừa phải cập nhật các dòng dữ liệu trong MongoDB, vừa phải thêm Node và Edge trên đồ thị Neo4j. Nếu ứng dụng bị sập giữa 2 bước, dữ liệu giữa 2 CSDL sẽ bị bất đồng bộ nghiêm trọng.
- **Giải pháp Outbox:** Trong cùng một **MongoDB ACID Transaction**, hệ thống đồng thời lưu dữ liệu làm sạch và ghi một bản ghi vào `outbox_events`. Một tiến trình nền (Outbox Dispatcher Worker) sẽ đọc các sự kiện này và đồng bộ sang Neo4j. Nếu mạng đứt, cơ chế retry tự động thử lại, đảm bảo nguyên lý **At-Least-Once Delivery**.

### 3.3. Git-like Merkle Tree Hash Versioning
- Mỗi phiên bản dữ liệu lưu trữ 3 thành phần mật mã học:
  1. `parent_hash`: Mã băm của phiên bản cha trước đó.
  2. `rules_hash`: Mã băm danh sách các luật biến đổi đã áp dụng.
  3. `data_checksum`: Mã băm nội dung của toàn bộ tệp snapshot dữ liệu sạch.
- Từ đó tổng hợp nên `version_hash = SHA256(parent_hash + rules_hash + data_checksum)`. Cấu trúc này hình thành một chuỗi **Merkle DAG** không thể đảo ngược, bất kỳ hành vi sửa lén một giá trị ô dữ liệu nào trong database đều lập tức làm sai lệch `data_checksum` và bị hệ thống phát hiện đứt gãy ngay lập tức khi chạy tính năng đối soát F8.4.

---

## 4. TỔNG KẾT VÀ ĐÁNH GIÁ CHẤT LƯỢNG THIẾT KẾ

Thiết kế Schema MongoDB của hệ thống giải quyết trọn vẹn các thách thức lớn nhất của một nền tảng xử lý dữ liệu quy mô doanh nghiệp:
- **Tính toán vẹn và an toàn:** Áp dụng nghiêm ngặt Soft Delete kết hợp Partial Unique Index, ngăn ngừa mất mát dữ liệu do sơ suất của người dùng.
- **Hiệu năng vượt bậc:** Phân chia ranh giới rõ ràng giữa dữ liệu bảng (`dataset_records`) và dữ liệu metadata (`datasets`), tận dụng triệt để Keyset Indexing và Streaming Processing.
- **An toàn kiểu dữ liệu (Zero Any):** Sự kết hợp giữa TypeScript Strict Typing, Zod Validation Schemas và Mongoose Schemas loại bỏ hoàn toàn các lỗi runtime do sai lệch cấu trúc dữ liệu (`null/undefined dereference`).
- **Sẵn sàng mở rộng (Horizontal Scalability):** Các collection dung lượng lớn (`dataset_records`, `outbox_events`) được thiết kế với Shard Key tự nhiên (`dataset_id`, `created_at`), sẵn sàng kích hoạt cơ chế Sharding trên MongoDB Atlas khi dung lượng dữ liệu vượt ngưỡng hàng trăm triệu dòng.
