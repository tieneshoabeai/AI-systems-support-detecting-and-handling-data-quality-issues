# 03. DANH SÁCH CHỨC NĂNG

**Nguồn chính:** [feature_spec_v4](../feature_spec_v4.md) (mã chức năng `F<m>.<n>` giữ nguyên theo spec), [README frontend](../../src/frontend/README.md)
**Quy ước:** Ưu tiên **B** = Bắt buộc, **Đ** = Đề xuất thêm (vẫn nằm trong phạm vi). Mã API theo bảng tổng kết của spec (xem [00_muc-luc](00_muc-luc.md)).

---

## 3.1. Sơ đồ phân rã chức năng (dùng để vẽ Functional Decomposition Diagram)

```
HỆ THỐNG QUẢN LÝ CHẤT LƯỢNG DỮ LIỆU
├── M1. Xác thực & phân quyền
│   ├── F1.1 Đăng ký email          ├── F1.6 Làm mới access token
│   ├── F1.2 Đăng nhập email        ├── F1.7 Đăng xuất
│   ├── F1.3 Đăng nhập Google       ├── F1.8 Thu hồi phiên từ xa
│   ├── F1.4 Quên mật khẩu          ├── F1.9 Lấy quyền hiện tại
│   └── F1.5 Đặt lại mật khẩu       └── F1.10 Danh sách phiên đang hoạt động
├── M2. Quản lý người dùng
│   ├── F2.1 Xem hồ sơ              ├── F2.5 Xem chi tiết người dùng (Admin)
│   ├── F2.2 Cập nhật hồ sơ         ├── F2.6 Khóa tài khoản (Admin)
│   ├── F2.3 Đổi mật khẩu           └── F2.7 Mở khóa tài khoản (Admin)
│   └── F2.4 Danh sách người dùng (Admin)
├── M3. Workspace:  F3.1 Tạo · F3.2 Danh sách · F3.3 Chi tiết · F3.4 Sửa · F3.5 Xóa mềm · F3.6 Khôi phục
├── M4. Project:    F4.1 Tạo · F4.2 Danh sách · F4.3 Chi tiết · F4.4 Sửa · F4.5 Xóa mềm · F4.6 Khôi phục
├── M5. Dataset:    F5.1 Tải tệp lên · F5.2 Xem thông tin · F5.3 Xóa mềm
├── M6. Trực quan hóa: F6.1 Truy vấn Data Grid · F6.2 Thống kê & biểu đồ cột
├── M7. Biến đổi:   F7.1 Thực thi làm sạch · F7.2 Chạy thử (dry-run)
├── M8. Phiên bản & nguồn gốc: F8.1 Lịch sử · F8.2 Rollback · F8.3 Đồ thị lineage · F8.4 Kiểm tra toàn vẹn
└── M9. Xuất bản:   F9.1 Tải tệp về · F9.2 Lưu thành Dataset mới · F9.3 Xem trước
```

## 3.2. Bảng chức năng chi tiết

### M1. Xác thực & phân quyền (Auth)

| Mã | Chức năng | Mô tả ngắn | Actor | Ưu tiên | API |
|---|---|---|---|:---:|:---:|
| F1.1 | Đăng ký bằng email | Tạo tài khoản mới bằng email, mật khẩu, họ tên; vai trò mặc định `DATA_ANALYST` | Guest | B | API-01 |
| F1.2 | Đăng nhập bằng email | Xác thực email/mật khẩu, tạo phiên, cấp access + refresh token | Guest | B | API-02 |
| F1.3 | Đăng nhập bằng Google | Xác thực Google ID token; tự tạo tài khoản nếu chưa có | Guest | B | API-03 |
| F1.4 | Quên mật khẩu | Gửi email chứa liên kết đặt lại mật khẩu (hạn 15 phút), luôn trả cùng một thông báo | Guest | B | API-04 |
| F1.5 | Đặt lại mật khẩu | Đổi mật khẩu bằng token khôi phục, hủy mọi phiên đang mở | Guest | B | API-05 |
| F1.6 | Làm mới access token | Cấp access token mới từ refresh token hợp lệ | Authenticated User | B | API-06 |
| F1.7 | Đăng xuất | Hủy phiên hiện tại | Authenticated User | B | API-07 |
| F1.8 | Thu hồi phiên từ xa | Hủy một phiên trên thiết bị khác của chính mình | Authenticated User | B | API-08 |
| F1.9 | Lấy quyền hiện tại | Trả vai trò và danh sách mã quyền để giao diện hiển thị có điều kiện | Authenticated User | B | API-09 |
| F1.10 | Danh sách phiên hoạt động | Liệt kê thiết bị đang đăng nhập (IP, trình duyệt, phiên hiện tại) | Authenticated User | Đ | API-10 |

### M2. Quản lý người dùng (Users)

| Mã | Chức năng | Mô tả ngắn | Actor | Ưu tiên | API |
|---|---|---|---|:---:|:---:|
| F2.1 | Xem hồ sơ cá nhân | Xem thông tin tài khoản đang đăng nhập | Authenticated User | B | API-11 |
| F2.2 | Cập nhật hồ sơ | Sửa họ tên, ảnh đại diện (không sửa email/vai trò) | Authenticated User | B | API-12 |
| F2.3 | Đổi mật khẩu | Đổi mật khẩu khi biết mật khẩu hiện tại | Authenticated User | B | API-13 |
| F2.4 | Danh sách người dùng | Liệt kê tài khoản, tìm kiếm, lọc trạng thái, phân trang theo con trỏ | Admin | B | API-14 |
| F2.5 | Xem chi tiết người dùng | Xem một tài khoản kèm số Workspace | Admin | B | API-15 |
| F2.6 | Khóa tài khoản | Khóa tài khoản (không tự khóa chính mình), hủy mọi phiên của tài khoản đó | Admin | B | API-16 |
| F2.7 | Mở khóa tài khoản | Mở lại tài khoản bị khóa | Admin | B | API-17 |

### M3. Không gian làm việc (Workspace)

| Mã | Chức năng | Mô tả ngắn | Actor | Ưu tiên | API |
|---|---|---|---|:---:|:---:|
| F3.1 | Tạo Workspace | Tạo mới; tên không trùng với Workspace chưa xóa của chính mình | Data Analyst, Admin | B | API-18 |
| F3.2 | Danh sách Workspace | Liệt kê Workspace của mình (phân trang, tìm theo tên, kèm số Project) | Data Analyst, Admin | B | API-19 |
| F3.3 | Chi tiết Workspace | Xem thông tin và danh sách Project trực thuộc | Data Analyst, Admin | B | API-20 |
| F3.4 | Cập nhật Workspace | Sửa tên, mô tả | Workspace Owner, Admin | B | API-21 |
| F3.5 | Xóa mềm Workspace | Chuyển vào thùng rác, xóa mềm dây chuyền Project và Dataset con | Workspace Owner, Admin | B | API-22 |
| F3.6 | Khôi phục Workspace | Đưa Workspace và Project con ra khỏi thùng rác | Workspace Owner, Admin | Đ | API-23 |

### M4. Dự án (Project)

| Mã | Chức năng | Mô tả ngắn | Actor | Ưu tiên | API |
|---|---|---|---|:---:|:---:|
| F4.1 | Tạo Project | Tạo Project trong Workspace; tên không trùng trong cùng Workspace | Data Analyst, Admin | B | API-24 |
| F4.2 | Danh sách Project | Liệt kê Project của một Workspace, kèm trạng thái có Dataset | Data Analyst, Admin | B | API-25 |
| F4.3 | Chi tiết Project | Xem thông tin Project và tóm tắt Dataset (nếu có) | Data Analyst, Admin | B | API-26 |
| F4.4 | Cập nhật Project | Sửa tên, mô tả | Data Analyst, Admin | B | API-27 |
| F4.5 | Xóa mềm Project | Chuyển Project và Dataset trực thuộc vào thùng rác | Data Analyst, Admin | B | API-28 |
| F4.6 | Khôi phục Project | Đưa Project ra khỏi thùng rác (đặc tả theo mẫu F3.6) | Data Analyst, Admin | Đ | API-29 |

### M5. Tập dữ liệu (Dataset)

| Mã | Chức năng | Mô tả ngắn | Actor | Ưu tiên | API |
|---|---|---|---|:---:|:---:|
| F5.1 | Tải tệp dữ liệu lên | Tải CSV/XLSX/JSON vào Project chưa có Dataset; đọc dạng luồng, tính checksum SHA-256, suy luận cột, tạo phiên bản v1 | Data Analyst, Admin | B | API-30 |
| F5.2 | Xem thông tin Dataset | Xem metadata, danh sách cột, phiên bản hiện hành | Data Analyst, Admin | B | API-31 |
| F5.3 | Xóa mềm Dataset | Xóa Dataset, giải phóng Project để tải tệp mới | Data Analyst, Admin | B | API-32 |

### M6. Trực quan hóa (Visualization)

| Mã | Chức năng | Mô tả ngắn | Actor | Ưu tiên | API |
|---|---|---|---|:---:|:---:|
| F6.1 | Truy vấn Data Grid | Xem dữ liệu bảng theo phiên bản: phân trang, sắp xếp, tìm kiếm toàn cục, lọc theo cột | Data Analyst, Admin | B | API-33 |
| F6.2 | Thống kê & biểu đồ cột | Cột số: min/max/mean/median/độ lệch chuẩn, histogram; cột chuỗi: top giá trị; kèm số/tỷ lệ ô rỗng | Data Analyst, Admin | B | API-34 |

### M7. Biến đổi dữ liệu (Transformation)

| Mã | Chức năng | Mô tả ngắn | Actor | Ưu tiên | API |
|---|---|---|---|:---:|:---:|
| F7.1 | Thực thi làm sạch | Áp dụng 1 trong 6 phép: `DROP_NULL_ROWS`, `IMPUTE_VALUE`, `SANITIZE_STRING`, `REPLACE_REGEX`, `DROP_COLUMN`, `RENAME_COLUMN`; khóa lạc quan theo phiên bản; tạo phiên bản mới | Data Analyst, Admin | B | API-35 |
| F7.2 | Chạy thử (dry-run) | Xem 10 dòng trước/sau và số dòng ước tính bị ảnh hưởng, không ghi dữ liệu | Data Analyst | Đ | API-36 |

### M8. Phiên bản & nguồn gốc (Version & Lineage)

| Mã | Chức năng | Mô tả ngắn | Actor | Ưu tiên | API |
|---|---|---|---|:---:|:---:|
| F8.1 | Lịch sử phiên bản | Liệt kê các phiên bản kèm mã băm, phép biến đổi, số dòng | Data Analyst, Admin | B | API-37 |
| F8.2 | Rollback | Quay phiên bản hiện hành về một phiên bản cũ hơn | Data Analyst, Admin | B | API-38 |
| F8.3 | Đồ thị lineage | Trả về nút (phiên bản) và cạnh (phép biến đổi) để vẽ sơ đồ nguồn gốc | Data Analyst | Đ | API-39 |
| F8.4 | Kiểm tra toàn vẹn | Tính lại chuỗi băm SHA-256, phát hiện phiên bản bị sửa trái phép | Data Analyst, Admin | Đ | API-40 |

### M9. Xuất bản (Export)

| Mã | Chức năng | Mô tả ngắn | Actor | Ưu tiên | API |
|---|---|---|---|:---:|:---:|
| F9.1 | Tải tệp về máy | Tải dữ liệu của một phiên bản dạng CSV/XLSX/JSON; tùy chọn mã hóa AES-256-GCM bằng mật khẩu | Data Analyst, Admin | B | API-41 |
| F9.2 | Lưu thành Dataset mới | Sao chép một phiên bản sang Project đích chưa có Dataset | Data Analyst, Admin | B | API-42 |
| F9.3 | Xem trước khi xuất | Xem tối đa 50 dòng (mặc định 20) trước khi tải | Data Analyst | Đ | API-43 |

## 3.3. Chức năng phía giao diện (Frontend) không gắn với một API riêng

| Mã | Chức năng | Mô tả | Liên quan |
|---|---|---|---|
| FE-1 | Bảo vệ route | Trang riêng tư chỉ truy cập khi đã đăng nhập; trang đăng nhập không truy cập được khi đã đăng nhập; quay lại trang đích sau khi đăng nhập | F1.2, F1.3 |
| FE-2 | Gia hạn phiên có xác nhận | Khi access token sắp hết hạn, hiển thị hộp thoại "Tiếp tục phiên / Hủy"; chỉ gọi refresh khi người dùng đồng ý | F1.6 |
| FE-3 | Hiển thị theo quyền | Ẩn/hiện menu, nút quản trị dựa trên kết quả lấy quyền | F1.9 |
| FE-4 | Bản nháp tải lên ngoại tuyến | Lưu tệp đang chuẩn bị tải lên vào IndexedDB theo từng tài khoản (giới hạn 50 MiB/tệp, 200 MiB/tài khoản, 500 MiB/ứng dụng); bị khóa khi đăng xuất | F5.1 |
| FE-5 | Bản đồ tài nguyên 3D | Hiển thị Workspace → Project → Dataset dạng cảnh 3D để điều hướng | F3.2, F4.2, F5.2 |
| FE-6 | Xử lý mất kết nối | Không hiển thị lỗi gây gián đoạn khi backend mất kết nối; thông báo trạng thái rõ ràng | NFR khả dụng |

> Nguồn FE-4: `src/frontend/src/configs/upload-draft.config.ts` và handoff frontend. Spec v4 không đặc tả các chức năng FE-x; mục này lấy từ tài liệu và mã nguồn frontend.

## 3.4. Use case theo actor (dùng để vẽ Use Case Diagram)

| Actor | Use case |
|---|---|
| **Guest** | UC-1.1 Đăng ký · UC-1.2 Đăng nhập email · UC-1.3 Đăng nhập Google · UC-1.4 Quên mật khẩu · UC-1.5 Đặt lại mật khẩu |
| **Authenticated User** | UC-1.6 Làm mới phiên · UC-1.7 Đăng xuất · UC-1.8 Thu hồi phiên từ xa · UC-1.9 Xem quyền · UC-1.10 Xem phiên hoạt động · UC-2.1 Xem hồ sơ · UC-2.2 Cập nhật hồ sơ · UC-2.3 Đổi mật khẩu |
| **Data Analyst** (kế thừa Authenticated User) | UC-3.1 → UC-3.3 · UC-4.1 → UC-4.6 · UC-5.1 → UC-5.3 · UC-6.1, UC-6.2 · UC-7.1, UC-7.2 · UC-8.1 → UC-8.4 · UC-9.1 → UC-9.3 |
| **Workspace Owner** (là Data Analyst sở hữu Workspace) | UC-3.4 Sửa · UC-3.5 Xóa mềm · UC-3.6 Khôi phục Workspace |
| **Admin** (kế thừa Data Analyst) | UC-2.4 Danh sách người dùng · UC-2.5 Xem chi tiết · UC-2.6 Khóa · UC-2.7 Mở khóa; cùng toàn bộ use case của Data Analyst và Workspace Owner |

### Quan hệ giữa các use case
- `<<include>>`: UC-7.1 Thực thi làm sạch **include** tạo phiên bản mới và cập nhật lineage; UC-5.1 Tải tệp lên **include** tạo phiên bản v1.
- `<<extend>>`: UC-7.2 Chạy thử **extend** UC-7.1; UC-9.3 Xem trước **extend** UC-9.1; UC-1.10 Xem phiên **extend** UC-1.8 Thu hồi phiên.
- `<<extend>>`: UC-1.4 Quên mật khẩu **extend** UC-1.2 Đăng nhập; UC-1.5 nối tiếp UC-1.4 qua liên kết trong email.
- Kế thừa actor: Admin → Data Analyst → Authenticated User.
