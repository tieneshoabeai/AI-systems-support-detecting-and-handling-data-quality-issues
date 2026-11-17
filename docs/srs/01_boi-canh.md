# 01. BỐI CẢNH DỰ ÁN

**Hệ thống:** Hệ thống AI hỗ trợ phát hiện và xử lý vấn đề chất lượng dữ liệu
*(Data Quality Management Platform with AI Assistance)*
**Nguồn chính:** [feature_spec_v4](../feature_spec_v4.md), [report_overview_v5](../report_overview_v5.md), [01_business_context](../01_business_context_and_objectives.md)

---

## 1.1. Bối cảnh chung

Trong quá trình chuyển đổi số, dữ liệu là tài sản chiến lược của tổ chức và là đầu vào trực tiếp cho báo cáo BI và mô hình AI/ML. Tuy nhiên, dữ liệu thu thập từ các hệ thống vận hành (CRM, ERP, IoT, web, API bên thứ ba) thường là dữ liệu thô và mắc các lỗi chất lượng:

| Loại lỗi | Ví dụ |
|---|---|
| Giá trị khuyết thiếu (Missing values) | Ô `salary` để trống |
| Định dạng dị thường (Format anomalies) | Ngày lúc `2026-10-19`, lúc `19/10/26` |
| Sai kiểu dữ liệu (Type mutations) | Cột số chứa chuỗi `"N/A"` |
| Trùng lặp (Duplicates) | Cùng một khách hàng xuất hiện nhiều lần |
| Ngoại lai (Outliers) | Tuổi = 250 |
| Khoảng trắng / hoa-thường không nhất quán | `" Hà Nội"`, `"HÀ NỘI"` |

Dữ liệu sai đưa vào phân tích sẽ dẫn tới kết luận sai — hiện tượng **"Garbage In, Garbage Out" (GIGO)**. Theo tài liệu dự án, chuyên viên dữ liệu thường dành 60–80% thời gian cho việc làm sạch thủ công.

## 1.2. Hiện trạng và vấn đề cần giải quyết

| # | Vấn đề | Hệ quả |
|---|---|---|
| P1 | Làm sạch dữ liệu thủ công trên bảng tính, không có quy trình chuẩn | Tốn thời gian, dễ sai sót, khó lặp lại |
| P2 | Công cụ web/bảng tính thông thường tải toàn bộ tệp vào RAM | Treo máy hoặc sập server (OOM) với tệp lớn; Excel giới hạn 1.048.576 dòng |
| P3 | Biến đổi dữ liệu ghi đè lên tệp gốc hoặc lưu thành nhiều tệp rời (`data_v2_final.csv`) | Mất dấu vết: không biết ai sửa, sửa gì, khi nào; không quay lui (rollback) được |
| P4 | Không có bằng chứng kiểm toán dữ liệu | Không chứng minh được dữ liệu không bị can thiệp trái phép |
| P5 | Làm việc nhóm không có phân quyền theo không gian làm việc | Rủi ro truy cập chéo dữ liệu (IDOR) |
| P6 | Tệp xuất ra không được bảo vệ | Lộ dữ liệu nhạy cảm khi chia sẻ |

### So sánh với giải pháp hiện có

| Tiêu chí | Microsoft Excel | OpenRefine | Great Expectations | Hệ thống đề xuất |
|---|---|---|---|---|
| Quy mô dữ liệu | ≤ 1.048.576 dòng | Giới hạn bởi RAM máy trạm | Code-first | Nạp dạng luồng (streaming) |
| Giao diện | Bảng tính | Web cục bộ, 1 người dùng | Không có UI | Web, Data Grid phân trang |
| Làm việc nhóm, phân quyền | Không | Không | Không | Workspace + phân quyền theo thuộc tính (CASL ABAC) |
| Lịch sử / Rollback | Không | Lịch sử phẳng | Data Docs tĩnh | Phiên bản + đồ thị nguồn gốc (Neo4j) |
| Kiểm toán toàn vẹn | Không | Không | Checksum tệp | Chuỗi băm SHA-256 giữa các phiên bản |
| Bảo mật tệp xuất | Mật khẩu zip | Không | Không | Mã hóa AES-256-GCM |

## 1.3. Ý tưởng giải pháp

Xây dựng **nền tảng web full-stack** cho phép người dùng:

1. Tổ chức dữ liệu theo cấp **Người dùng → Workspace → Project → Dataset** (mỗi Project chứa đúng 1 Dataset).
2. Tải tệp CSV / Excel / JSON lên, hệ thống tự suy luận cấu trúc cột (schema).
3. Khám phá dữ liệu qua bảng (Data Grid) có tìm kiếm, lọc, sắp xếp, phân trang và thống kê mô tả từng cột.
4. Áp dụng các phép làm sạch (xóa dòng rỗng, điền giá trị, chuẩn hóa chuỗi, thay thế regex, xóa/đổi tên cột), có **chạy thử (dry-run)** trước khi áp dụng thật.
5. Mỗi lần biến đổi tạo một **phiên bản** mới có mã băm liên kết với phiên bản cha; có thể **rollback**, xem **đồ thị nguồn gốc (lineage)** và **kiểm tra toàn vẹn** chuỗi phiên bản.
6. Xuất dữ liệu sạch (CSV/XLSX/JSON, tùy chọn mã hóa) hoặc lưu thành Dataset mới.
7. **Giai đoạn 2:** tích hợp AI để tự động phát hiện bất thường, giải thích và gợi ý cách xử lý; con người vẫn là người phê duyệt cuối cùng (**Human-in-the-loop**).

## 1.4. Mục tiêu

### Mục tiêu nghiệp vụ
- MT1: Rút ngắn thời gian phát hiện và làm sạch dữ liệu so với làm thủ công.
- MT2: Minh bạch hóa toàn bộ lịch sử thay đổi dữ liệu: ai, làm gì, khi nào, có thể quay lui.
- MT3: Hỗ trợ làm việc nhóm an toàn, cô lập dữ liệu giữa các Workspace.
- MT4: Bảo vệ dữ liệu nhạy cảm khi lưu trữ, truyền tải và chia sẻ.

### Mục tiêu kỹ thuật (chỉ số định lượng theo tài liệu dự án)

| Mã | Mục tiêu | Chỉ số |
|---|---|---|
| KT1 | An toàn bộ nhớ khi nạp/xuất tệp | RAM tiến trình ≤ 50 MB, không phụ thuộc kích thước tệp |
| KT2 | Tốc độ truy vấn Data Grid | < 100 ms mỗi trang (spec F6.1); mục tiêu ≤ 10 ms/50 dòng (báo cáo 01) |
| KT3 | Toàn vẹn & kiểm toán | 100% lần biến đổi có mã băm SHA-256 và nút lineage |
| KT4 | An toàn kiểu | 0 khai báo `any` trong mã nguồn |
| KT5 | Bảo mật | Không có lỗ hổng IDOR giữa các Workspace; tệp xuất mã hóa AES-256-GCM, khóa PBKDF2 100.000 vòng |

> **Đã chốt:** KT2 lấy **< 100 ms** theo spec F6.1 làm yêu cầu chính thức; con số ≤ 10 ms/50 dòng trong báo cáo 01 chỉ để tham khảo.

## 1.5. Các bên liên quan (Stakeholders)

| Bên liên quan | Vai trò | Mối quan tâm |
|---|---|---|
| Nhóm phát triển (sinh viên UTH) | Phân tích, thiết kế, lập trình, kiểm thử | Hoàn thành đồ án đúng phạm vi, chất lượng |
| Giảng viên hướng dẫn / Hội đồng | Đánh giá, nghiệm thu | Tính đúng đắn, đầy đủ tài liệu, demo chạy được |
| Người dùng cuối | Sử dụng hệ thống (xem mục 1.6) | Dễ dùng, nhanh, an toàn dữ liệu |
| Quản trị hệ thống | Quản lý tài khoản | Kiểm soát truy cập, khóa/mở khóa tài khoản |

## 1.6. Tác nhân (Actor)

Tác nhân dùng trong toàn bộ bộ tài liệu, lấy theo spec:

| Actor | Mô tả | Persona tương ứng (báo cáo 01) |
|---|---|---|
| **Guest** (Khách) | Chưa đăng nhập; được đăng ký, đăng nhập, quên/đặt lại mật khẩu | — |
| **Authenticated User** | Bất kỳ người dùng đã đăng nhập (đủ để xem hồ sơ, đổi mật khẩu, đăng xuất, quản lý phiên) | Tất cả |
| **Data Analyst** | Vai trò mặc định khi đăng ký (`role = DATA_ANALYST`); tạo Workspace, Project, tải Dataset, làm sạch, quản lý phiên bản, xuất dữ liệu trên tài nguyên mình sở hữu | Data Engineer, Data Analyst, Data Steward |
| **Workspace Owner** | Data Analyst đang sở hữu Workspace đó; có quyền sửa/xóa/khôi phục Workspace | Workspace Admin |
| **Admin** | Quản trị hệ thống (`role = ADMIN`); có toàn bộ quyền của Data Analyst, cộng thêm quản lý người dùng (xem danh sách, khóa/mở khóa) | — |
| **Hệ thống AI** (giai đoạn 2) | Tác nhân hệ thống: phân tích dữ liệu, đề xuất xử lý; không tự áp dụng thay đổi | — |

> **Đã chốt:** Mã vai trò dùng theo spec: `ADMIN` / `DATA_ANALYST`. Code backend hiện đang dùng `admin` / `analyst`, khác với tài liệu.

## 1.7. Định nghĩa thuật ngữ

| Thuật ngữ | Giải thích |
|---|---|
| Workspace | Không gian làm việc, chứa nhiều Project |
| Project | Dự án trong Workspace, chứa **duy nhất 1** Dataset |
| Dataset | Tập dữ liệu dạng bảng được tải lên |
| Version | Phiên bản của Dataset sau mỗi lần biến đổi; phiên bản đầu tiên là v1 |
| Transformation | Phép biến đổi/làm sạch áp dụng lên Dataset |
| Dry-run | Chạy thử biến đổi trên mẫu, không ghi dữ liệu thật |
| Rollback | Quay con trỏ phiên bản hiện hành về một phiên bản cũ |
| Lineage | Đồ thị nguồn gốc: phiên bản nào sinh ra từ phiên bản nào, bằng phép biến đổi gì |
| Version hash | Mã SHA-256 liên kết phiên bản với phiên bản cha để phát hiện giả mạo |
| Soft delete | Xóa mềm bằng cách ghi thời điểm vào `deleted_at`, có thể khôi phục |
| Access / Refresh token | Token JWT ngắn hạn để gọi API / token dài hạn để cấp lại access token |
| Human-in-the-loop | Mọi thay đổi dữ liệu (kể cả do AI đề xuất) phải được người dùng phê duyệt |
