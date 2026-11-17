# 02. PHẠM VI DỰ ÁN

**Nguồn chính:** [feature_spec_v4](../feature_spec_v4.md), [report_overview_v5](../report_overview_v5.md)

---

## 2.1. Phân kỳ triển khai

| Giai đoạn | Tên | Nội dung | Phạm vi bộ tài liệu này |
|---|---|---|---|
| **Giai đoạn 1** | Core Platform MVP | 9 module nghiệp vụ, 43 API (spec v4) và giao diện web tương ứng | **Đặc tả chi tiết** |
| **Giai đoạn 2** | AI Integration | Động cơ AI 4 tầng, kết nối CSDL ngoài, RabbitMQ, báo cáo PDF, email | Chỉ nêu định hướng (mục 2.4) |

## 2.2. Phạm vi chức năng (In-scope) — Giai đoạn 1

| Module | Tên | Nội dung chính | Số API |
|---|---|---|:---:|
| M1 | Xác thực & phân quyền (Auth) | Đăng ký, đăng nhập email/Google, quên/đặt lại mật khẩu, refresh token, đăng xuất, quản lý và thu hồi phiên, lấy quyền hiện tại | 10 |
| M2 | Quản lý người dùng (Users) | Hồ sơ cá nhân, đổi mật khẩu; Admin: danh sách, xem chi tiết, khóa/mở khóa tài khoản | 7 |
| M3 | Không gian làm việc (Workspace) | Tạo, xem, sửa, xóa mềm, khôi phục | 6 |
| M4 | Dự án (Project) | Tạo, xem, sửa, xóa mềm, khôi phục Project trong Workspace | 6 |
| M5 | Tập dữ liệu (Dataset) | Tải tệp lên (ràng buộc 1 Project = 1 Dataset), xem thông tin, xóa mềm | 3 |
| M6 | Trực quan hóa (Visualization) | Data Grid: truy vấn, phân trang, sắp xếp, tìm kiếm, lọc; thống kê và biểu đồ cột | 2 |
| M7 | Biến đổi dữ liệu (Transformation) | Thực thi 6 loại làm sạch; chạy thử (dry-run) | 2 |
| M8 | Phiên bản & nguồn gốc (Version & Lineage) | Lịch sử phiên bản, rollback, đồ thị lineage, kiểm tra toàn vẹn chuỗi băm | 4 |
| M9 | Xuất bản (Export) | Tải tệp CSV/XLSX/JSON (tùy chọn mã hóa), lưu thành Dataset mới, xem trước | 3 |
| | **Tổng** | | **43** |

Trong đó có **7 API "đề xuất thêm"** (F1.10, F3.6, F4.6, F7.2, F8.3, F8.4, F9.3) — vẫn thuộc phạm vi đặc tả theo quyết định chọn spec làm chuẩn.

> `[CẦN XÁC NHẬN]` F4.6 (khôi phục Project – `POST /projects/:projectId/restore`) có trong bảng tổng kết và change log của spec nhưng **không có mục đặc tả chi tiết**. Tài liệu sẽ đặc tả tương tự F3.6 (khôi phục Workspace).

### Phạm vi giao diện (Frontend)
- Ứng dụng web SPA (React + Vite + TypeScript) cho toàn bộ chức năng M1–M9.
- Tầng thích ứng ngoại tuyến (Offline-first): lưu bản nháp tải lên trong IndexedDB của trình duyệt, không hiển thị lỗi gây gián đoạn khi backend mất kết nối.
- Phiên đăng nhập chỉ được gia hạn khi người dùng đồng ý (không tự refresh âm thầm).
- Bản đồ tài nguyên 3D (Workspace → Project → Dataset) là hướng trình bày được nhóm FE lựa chọn.

### Định dạng dữ liệu hỗ trợ
CSV, Excel (`.xlsx`), JSON — cho cả nhập và xuất.

## 2.3. Ngoài phạm vi (Out-of-scope) của Giai đoạn 1

| # | Hạng mục | Ghi chú |
|---|---|---|
| O1 | Phát hiện bất thường và gợi ý xử lý bằng AI (Machine Learning, LLM Gemini) | Giai đoạn 2 |
| O2 | Kết nối CSDL quan hệ ngoài (PostgreSQL, MySQL, SQLite), nhận luồng RabbitMQ | Giai đoạn 2 |
| O3 | Xuất báo cáo chất lượng Before/After ra PDF | Giai đoạn 2 |
| O4 | Gửi email tự động / thông báo | Giai đoạn 2 |
| O5 | Cộng tác thời gian thực (nhiều người cùng sửa một Dataset) | Không có trong spec |
| O6 | Ứng dụng di động native | Không có trong spec |
| O7 | Tạo tài khoản hoặc dữ liệu mới khi đang offline | Bị loại trừ có chủ đích để tránh xung đột đồng bộ |
| O8 | Một Project chứa nhiều Dataset | Ràng buộc 1:1 theo spec |

## 2.4. Định hướng Giai đoạn 2 (chỉ mô tả, không đặc tả)

Động cơ AI 4 tầng: (0) chuẩn hóa/phẳng hóa schema JSON, (1) luật cứng (thiếu khóa, regex, ép kiểu, trùng lặp), (2) học máy cục bộ (Isolation Forest, Jaro-Winkler, KS-Test/PSI), (3) LLM sinh kế hoạch xử lý dạng JSON (dữ liệu mẫu được che PII). Kiến trúc giai đoạn 1 đã chừa sẵn trường `ai_profile`, `ai_recommendations` và interface `IDataTransformationEngine` để cắm AI không phải refactor.

## 2.5. Giới hạn dữ liệu (Data Boundaries)

| Thông số | Ngưỡng |
|---|---|
| Dung lượng tệp CSV / JSON | ≤ 50 MB |
| Dung lượng tệp Excel (`.xlsx`) | ≤ 20 MB |
| Số dòng xử lý trên server | ≤ 200.000 dòng |
| Số dòng xử lý trên client (offline) | ≤ 20.000 dòng |
| Số cột | ≤ 100 cột |
| JSON: độ sâu lồng nhau | ≤ 3 cấp (sâu hơn gom thành chuỗi JSON) |
| JSON: số phần tử mảng | ≤ 500 / mảng |
| JSON: số khóa sau khi làm phẳng | ≤ 100 |
| Kích thước trang Data Grid | 10 – 200 dòng |
| Xem trước khi xuất | mặc định 20, tối đa 50 dòng |

## 2.6. Ràng buộc

### Ràng buộc kỹ thuật
- Backend: NestJS 11 + TypeScript strict (không dùng `any`); frontend: React + Vite + TypeScript.
- Lưu trữ: MongoDB (dữ liệu chính, bản ghi Dataset, phiên bản), Neo4j (đồ thị lineage), lưu trữ đối tượng tương thích S3 (Cloudflare R2) cho tệp gốc và tệp xuất.
- Giao tiếp qua HTTPS (TLS, cổng 443 qua Cloudflare Tunnel); REST API tiền tố `/api/v1`.
- Xác thực JWT (access token + refresh token theo phiên); mật khẩu băm bằng bcrypt.
- Xóa mềm thống nhất bằng trường `deleted_at` (không dùng cờ boolean).

> `[CẦN XÁC NHẬN]` Thuật toán băm mật khẩu: spec ghi **bcrypt (salt 10)**, README ghi bcrypt salt 12, báo cáo 01 ghi Argon2id. Tài liệu theo spec: bcrypt.

### Ràng buộc nghiệp vụ
- Mỗi Project chứa tối đa **1 Dataset** chưa bị xóa.
- Người dùng chỉ thao tác trên tài nguyên mình sở hữu; riêng Admin có thêm quyền quản lý người dùng.
- Biến đổi dữ liệu dùng khóa lạc quan (optimistic locking) theo số phiên bản để tránh ghi đè.
- Mọi thao tác xử lý dữ liệu phải được người dùng xác nhận (Human-in-the-loop).

### Ràng buộc dự án
- Đồ án môn học (Lập trình JS & TS nâng cao, UTH); nhóm nhỏ, thời gian giới hạn theo học kỳ.
- Hạ tầng dùng gói miễn phí (MongoDB Atlas M0, Neo4j AuraDB Free, Cloudflare R2).

## 2.7. Giả định

- A1: Người dùng có trình duyệt hiện đại hỗ trợ IndexedDB và kết nối Internet khi đăng nhập.
- A2: Tệp tải lên có dòng tiêu đề (header) ở dòng đầu (CSV/XLSX) hoặc là mảng object (JSON).
- A3: Dịch vụ đám mây (MongoDB Atlas, Neo4j AuraDB, R2) sẵn sàng trong thời gian demo.
- A4: Đăng nhập Google dùng ID token do Google cấp phía client.
