# SLIDE DESIGN PLAN: BỐ CỤC & PHÂN CẤP THỊ GIÁC TOÀN DIỆN (42 SLIDES)

## 1. NGUYÊN TẮC THIẾT KẾ & PHÂN CẤP THỊ GIÁC
- **Tỉ lệ Canvas chuẩn:** 16:9 (1280 × 720 px, tự động scale co giãn fluid trên mọi màn hình).
- **Phân bổ Layout:** Không dùng một layout đơn điệu; xen kẽ giữa Hero, 3-Column Cards, Split Process, Flowcharts, Sequence Diagrams, Matrix Tables và Big Data Metrics.
- **Hệ thống màu Design Tokens:** Áp dụng bảng màu đa tầng kết hợp `--pv-bg-0`, `--pv-surface`, Brand Green `#00a878`, Action Blue `#2563eb`, Danger Rose `#dc2626`, Warning Amber `#fbbf24`, Cyan `#22d3ee`, kiểm soát tương phản WCAG tối thiểu 4.5:1.
- **Visual Dominance:** Mỗi slide có ít nhất 55% diện tích cho sơ đồ kỹ thuật vector, bảng số liệu hoặc luồng tương tác thực tế.

---

## 2. MA TRẬN QUY HOẠCH BỐ CỤC 42 SLIDE

| Slide | Chương | Tiêu Đề Hành Động (Action Title) | Kiểu Bố Cục (Layout Type) | Thành Phần Trực Quan Chủ Đạo |
|---|---|---|---|---|
| **01** | 1 | Nền Tảng Giám Sát & Xử Lý Dữ Liệu Chuẩn Kiến Trúc Phân Tầng | **Hero Visual** | 3D Holographic Cube & Status Chips |
| **02** | 1 | 3 Trụ Cột Đã Hoàn Thiện: Nghiệp Vụ, Kiểm Thử & Tích Hợp | **3-Column Feature Cards** | 3 Thẻ Metric kèm số thứ tự lớn |
| **03** | 1 | Cam Kết Minh Bạch Kỹ Thuật: Khung 7 Nhãn Bằng Chứng | **Evidence Matrix** | Bảng màu 7 Badge kiểm chứng |
| **04** | 1 | Hiện Trạng Tích Hợp: 66/86 API Thật & Ranh Giới Phần Còn Mock | **Split Comparison Table** | 2 Cột: Đã nối Live vs Còn Mock/Offline |
| **05** | 2 | Hệ Thống Bảng Màu Toàn Diện & Chuẩn Tương Phản WCAG | **Palette Grid Showcase** | Bảng 12 dải màu Design Tokens thực tế |
| **06** | 2 | Nhịp Điệu Typography, Spacing & Chuyển Động Vi Mô | **Specimen & Motion Split** | Plus Jakarta Sans + JetBrains Mono Specs |
| **07** | 2 | Cấu Trúc Linh Kiện 4 Tầng Theo Nguyên Lý Atomic Design | **Pyramid Layered Stack** | Kim tự tháp phân cấp 4 tầng Atomic UI |
| **08** | 3 | Phân Loại Kiến Trúc: Layered Kết Hợp Hexagonal Ports & Adapters | **Full-width Architecture** | Sơ đồ kiến trúc phân tầng 6 lớp |
| **09** | 3 | Nguyên Tắc Phụ Thuộc Một Chiều & Dòng Chảy Dữ Liệu Xuyên Tầng | **Data Flow Pipeline** | Sơ đồ luồng dữ liệu 2 chiều kèm ranh giới |
| **10** | 3 | Cấu Trúc Thư Mục Cấp 1 (Root Architecture): 14 Thư Mục Gốc | **Folder Hierarchy Tree** | Cây thư mục 14 folder gốc tại `src/` |
| **11** | 3 | Cấu Trúc Thư Mục Cấp 2 (Module Architecture): Các Khối Nghiệp Vụ | **Module Grid Showcase** | Lưới 4 khối: app, services, repos, views |
| **12** | 3 | Cấu Trúc Thư Mục Cấp 3 (File-Level Structure): Trách Nhiệm File | **File Trace Matrix** | Bảng chi tiết: Path, Role, Input, Output |
| **13** | 3 | Composition Root & Vòng Đời AppRuntime: Cơ Chế retain/release | **Runtime Lifecycle Flow** | Sơ đồ quản lý vòng đời bộ nhớ runtime |
| **14** | 3 | Quy Trình Khởi Động Ứng Dụng (Bootstrap Sequence) 5 Bước | **Step Pipeline Flow** | 5 Trạm khởi động độc lập từ main.tsx |
| **15** | 4 | Bộ Điều Phối Phiên (Session Coordinator) & State Machine 7 Trạng Thái | **State Machine Flowchart** | Máy trạng thái 7 pha (bootstrapping... auth) |
| **16** | 4 | Cơ Chế Lưu Trữ Token An Toàn Trong sessionStorage | **Storage Security Matrix** | Bảng so sánh sessionStorage vs Cookie/Local |
| **17** | 4 | Sơ Đồ Tuần Tự: Đăng Nhập & Khôi Phục Phiên (Session Restoration) | **Sequence Diagram** | Client → Interceptor → Server → GetMe |
| **18** | 4 | Sơ Đồ Tuần Tự: Token Expiration, Health Ping & Awaiting-Consent | **Sequence Diagram** | Sơ đồ 10 bước rotate refresh token |
| **19** | 4 | Luồng Đăng Xuất An Toàn & Thu Hồi Phiên Trực Tiếp Trên Server | **Sequence Process Flow** | Luồng thu hồi token & giải phóng cache |
| **20** | 5 | Luồng Quản Lý Workspace & Kiểm Soát Xung Đột Phiên Bản | **Activity Flow & Table** | Luồng CRUD Workspace + Optimistic Lock |
| **21** | 5 | Luồng Quản Lý Dự Án (Projects) & Wizard 4 Bước Chuẩn Bị Dữ Liệu | **Step Process Bar** | 4 Bước Wizard kèm khả năng rollback |
| **22** | 5 | Luồng Quản Lý Thành Viên & Phân Quyền Phân Cấp Đa Tầng | **Role Matrix Layout** | Bảng ma trận Workspace Role vs Project Role |
| **23** | 5 | Luồng Quản Lý Dataset: Ingestion, Schema, Stats & Cột PII | **Data Grid & Split** | Bảng Schema mẫu có gắn cờ PII đỏ |
| **24** | 5 | Luồng Lưới Dữ Liệu Ảo (Virtual Grid) & Phân Trang Con Trỏ | **Virtual Grid Wireframe** | Sơ đồ phân trang con trỏ `nextCursor` |
| **25** | 5 | Luồng Báo Cáo Sự Cố (Issues) & Xử Lý Trạng Thái Needs-Info | **Interactive Flowchart** | Luồng trao đổi sự cố giữa User và Admin |
| **26** | 5 | Cơ Chế Bản Nháp Ngoại Tuyến (Dexie DB) & Chống Partial Failure | **Database Architecture** | Sơ đồ IndexedDB lưu file chống mất mạng |
| **27** | 6 | Kiến Trúc Giao Tiếp Request–Response Toàn Trình | **End-to-End Flowchart** | UI → Hook → Service → Axios → State |
| **28** | 6 | Chuỗi Chuyển Đổi Khép Kín: Swagger Spec → TypeScript DTOs | **Contract Pipeline** | openapi.json → generate script → Types |
| **29** | 6 | Ma Trận Khế Ước API: Nhóm Authentication & User Profile | **API Contract Table** | Bảng 6 API xác thực & thông tin người dùng |
| **30** | 6 | Ma Trận Khế Ước API: Nhóm Workspace & Thành Viên | **API Contract Table** | Bảng 12 API quản lý không gian làm việc |
| **31** | 6 | Ma Trận Khế Ước API: Nhóm Project & Dataset Virtual Grid | **API Contract Table** | Bảng 18 API dự án, schema và virtual grid |
| **32** | 6 | Ma Trận Khế Ước API: Nhóm Issues & Quản Trị Hệ Thống (Admin) | **API Contract Table** | Bảng 14 API báo cáo lỗi và bảng quản trị |
| **33** | 6 | Chiến Lược Chuẩn Hóa & Kiểm Soát Lỗi Hệ Thống Toàn Diện | **Error Code Tree** | Cây xử lý mã lỗi 400, 401, 403, 404, 409, 500 |
| **34** | 7 | Ma Trận Truy Vết Toàn Trình (Technical Traceability Matrix) | **Full Traceability Matrix**| Bảng liên kết từ UI → Hook → API → Test |
| **35** | 7 | Bằng Chứng Kiểm Thử Đạt Chuẩn Tuyệt Đối: 864/864 Vitest PASS | **Big Data Metric Card** | Khối số liệu 864 Tests PASS / 71 Suites |
| **36** | 7 | Kim Tự Tháp Kiểm Thử 4 Tầng: Từ Unit Đến Xác Minh Trực Tiếp | **Pyramid Visual** | Hình tháp 4 tầng phân bổ tỷ trọng test |
| **37** | 7 | Kiểm Thử Trình Duyệt Thực Tế Với Playwright E2E Suite | **Browser Execution Mockup**| Giao diện Chromium test tự động 6 suites |
| **38** | 7 | Báo Cáo Độ Phủ Mã Nguồn Lịch Sử 70.83% & Kế Hoạch CI/CD | **Gauge Metric & Chart** | Biểu đồ đo lường tỷ lệ coverage thực tế |
| **39** | 8 | Khoảng Trống Hiện Tại: Các Phần Chờ Hoàn Thiện Phía Backend | **Gap Analysis Split** | 4 Hạng mục đang chờ kết nối Backend |
| **40** | 8 | Phân Tích Nợ Kỹ Thuật (Technical Debt) & Rủi Ro Tiềm Ẩn | **Risk & Mitigation Table** | Bảng phân tích rủi ro & giải pháp kỹ thuật |
| **41** | 8 | 3 Ưu Tiên Hành Động Cấp Thiết Trước Khi Nghiệm Thu Trực Tiếp | **Numbered Action Cards** | 3 Khối hành động kỹ thuật ưu tiên cao nhất |
| **42** | 8 | Tổng Kết Toàn Diện & Tuyên Ngôn Sẵn Sàng Nghiệm Thu | **Executive Conclusion** | Tóm lược giá trị và cam kết chất lượng |
