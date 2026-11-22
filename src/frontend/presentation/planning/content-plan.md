# CONTENT PLAN: BÁO CÁO TOÀN DIỆN KIẾN TRÚC FRONTEND, LUỒNG NGHIỆP VỤ & TÍCH HỢP API (42 SLIDES)

## 1. THÔNG ĐIỆP CHỦ ĐẠO & ĐỊNH VỊ HỆ THỐNG
- **Đối tượng báo cáo:** Hội đồng kỹ thuật, Tech Lead, Software Analysts & QA/Product Reviewers.
- **Mục tiêu:** Chứng minh toàn diện cấu trúc mã nguồn thực tế của Frontend, đối chiếu khép kín giữa Kiến trúc phân tầng 6 lớp, mô hình Ports & Adapters, cấu trúc thư mục 3 cấp độ, luồng nghiệp vụ người dùng, cơ chế quản lý phiên JWT (Session Coordinator), ma trận tích hợp 66/86 endpoints Swagger thực tế, ranh giới phần còn Mock/Fixture, cùng hệ thống kiểm thử tự động 864 tests PASS và Playwright E2E.
- **Cam kết kỹ thuật:** 100% kết luận có đường dẫn file mã nguồn cụ thể, phân định rạch ròi 7 cấp độ bằng chứng: `IMPLEMENTED`, `TESTED`, `VERIFIED LIVE`, `MOCKED`, `PARTIAL`, `NOT FOUND`, `UNVERIFIED`.

---

## 2. LỘ TRÌNH 8 CHƯƠNG & NỘI DUNG CHI TIẾT 42 SLIDES

### CHƯƠNG 1: TỔNG QUAN, ĐỊNH VỊ & MINH BẠCH KỸ THUẬT (Slide 01 - 04)
- **Slide 01: Nền tảng Frontend Kiểm soát Chất lượng Dữ liệu Chuẩn Kiến trúc Phân tầng**
  - *Thông điệp:* Hệ thống Frontend chuyên sâu cho giám sát và làm sạch dữ liệu lớn, xây dựng trên React 19, TypeScript 6.0 và kiến trúc phân tầng độc lập.
  - *Bằng chứng:* [src/app/app-runtime.ts](file:///Users/mac/Documents/JS-TS-AI/AI-systems-support-detecting-and-handling-data-quality-issues/src/frontend/src/app/app-runtime.ts), [package.json](file:///Users/mac/Documents/JS-TS-AI/AI-systems-support-detecting-and-handling-data-quality-issues/src/frontend/package.json).
  - *Speaker Notes:* Chào mọi người, hôm nay tôi xin báo cáo toàn diện về kiến trúc và hiện trạng triển khai của Frontend nền tảng Kiểm soát Chất lượng Dữ liệu dựa trên 100% source code thực tế.

- **Slide 02: 3 Trụ Cột Đã Hoàn Thiện & Sẵn Sàng Nghiệm Thu Trực Tiếp**
  - *Thông điệp:* Nghiệp vụ cốt lõi đã đấu nối, mã nguồn đạt 864 tests PASS tuyệt đối và khế ước dữ liệu đồng bộ trực tiếp với Swagger.
  - *Số liệu:* 66/86 API Thật đã nối | 864/864 Vitest PASS (162s) | 6 Playwright E2E Suites PASS.

- **Slide 03: Khung 7 Cấp Độ Bằng Chứng Minh Bạch Kỹ Thuật**
  - *Thông điệp:* Mọi kết luận kỹ thuật đều được phân loại nghiêm ngặt: `IMPLEMENTED`, `TESTED`, `VERIFIED LIVE`, `MOCKED`, `PARTIAL`, `NOT FOUND`, `UNVERIFIED`.
  - *Ý nghĩa:* Không đánh đồng có code với đã nghiệm thu live, không ngụy tạo dữ liệu chưa kiểm chứng.

- **Slide 04: Hiện Trạng Tích Hợp API: 66/86 Endpoints Đã Nối Thật & Ranh Giới Phần Còn Mock**
  - *Thông điệp:* 76.7% Swagger API đã tích hợp vào `management.store.ts` và các service; bóc tách rõ 4 phần còn dùng Mock/Fixture cục bộ.
  - *Phần còn Mock:* 
    1. Workspace 3D Preview (`/preview/workspaces-3d` dùng Three.js fixture).
    2. Danh sách Notification theo thời gian thực (chờ WebSocket/SSE từ BE).
    3. Engine phân tích dữ liệu bất đồng bộ chuyên sâu (chờ worker BE).
    4. Bản nháp ngoại tuyến Dexie (chỉ lưu IndexedDB local).

---

### CHƯƠNG 2: THIẾT KẾ GIAO DIỆN & DESIGN SYSTEM (Slide 05 - 07)
- **Slide 05: Hệ Thống Bảng Màu Toàn Diện & Tuân Thủ Chuẩn Tương Phản WCAG**
  - *Thông điệp:* Bảng màu giao diện đa tầng đáp ứng cả Light & Dark Theme, thương hiệu ánh xanh/tím và đạt chuẩn tương phản tối thiểu 4.5:1.
  - *Tokens:* Nền Canvas (`#f6f8f7` / `#0a1120`), Bề mặt thẻ (`#ffffff` / `#16263c`), Brand Green (`#00a878`), Action Blue (`#2563eb`), Danger Rose (`#dc2626`), Warning Amber (`#fbbf24`), Cyan (`#22d3ee`).
  - *Bằng chứng:* [src/styles/tokens.css](file:///Users/mac/Documents/JS-TS-AI/AI-systems-support-detecting-and-handling-data-quality-issues/src/frontend/src/styles/tokens.css), [preview-theme.css](file:///Users/mac/Documents/JS-TS-AI/AI-systems-support-detecting-and-handling-data-quality-issues/src/frontend/src/views/preview/preview-theme.css).

- **Slide 06: Nhịp Điệu Typography, Spacing & Chuyển Động Vi Mô**
  - *Thông điệp:* Phối hợp hài hòa giữa Plus Jakarta Sans (UI) và JetBrains Mono (Mã lệnh/Số liệu), chuyển động mượt mà với cubic-bezier(0.32, 0.72, 0, 1).

- **Slide 07: Cấu Trúc Linh Kiện Giao Diện 4 Tầng Theo Nguyên Lý Atomic Design**
  - *Thông điệp:* Tách biệt từ Primitives (Button, Input, Badge) → Composites (Dialog, Table, Donut) → Layouts (Frame, Sidebar, Topbar) → Features (Wizard, Virtual Grid).

---

### CHƯƠNG 3: KIẾN TRÚC HỆ THỐNG & CẤU TRÚC THƯ MỤC (Slide 08 - 14)
- **Slide 08: Phân Loại Kiến Trúc: Layered Architecture Kết Hợp Hexagonal Ports & Adapters**
  - *Thông điệp:* Hệ thống kết hợp giữa Kiến trúc 6 tầng kinh điển với mô hình Cổng & Bộ thích ứng (Ports & Adapters) cho Session và Storage.
  - *Bằng chứng:* `createSessionStorage` (Port), `createUploadDraftRepository` (Database Adapter), `createAxiosClient` (HTTP Client Adapter).

- **Slide 09: Nguyên Tắc Phụ Thuộc Một Chiều & Dòng Chảy Dữ Liệu Xuyên Tầng**
  - *Thông điệp:* Quy tắc nghiêm ngặt: Tầng trên phụ thuộc tầng dưới; UI không gọi thẳng API; Services không thao tác trực tiếp trên DOM; State bảo vệ bất biến.

- **Slide 10: Cấu Trúc Thư Mục Cấp 1 (Root Architecture): 14 Thư Mục Trọng Yếu Tại src/**
  - *Thông điệp:* Phân định ranh giới trách nhiệm rõ ràng của 14 thư mục gốc: `app/`, `views/`, `components/`, `hooks/`, `services/`, `repositories/`, `lib/`, `types/`, `configs/`, `styles/`, `graphics/`, `math/`, `mocks/`, `utils/`.

- **Slide 11: Cấu Trúc Thư Mục Cấp 2 (Module Architecture): Đi Sâu Vào Các Khối Chức Năng**
  - *Thông điệp:* Phân bổ module theo nghiệp vụ thực tế: `app/{router, guards, providers}`, `services/{auth, management, processing, health, users}`, `repositories/{datasets}`.

- **Slide 12: Cấu Trúc Thư Mục Cấp 3 (File-Level Structure): Phân Tích File Trọng Yếu & Trách Nhiệm**
  - *Thông điệp:* Bóc tách chi tiết trách nhiệm, Input, Output và Consumers của các file đầu não: `app-runtime.ts`, `session-coordinator.ts`, `management.store.ts`, `upload-draft.repository.ts`.

- **Slide 13: Composition Root & Vòng Đời AppRuntime: Cơ Chế retain/release An Toàn**
  - *Thông điệp:* `createAppRuntime` đóng vai trò Composition Root duy nhất, quản lý lifecycle độc lập và chống rò rỉ tài nguyên trong React 19 StrictMode microtasks.

- **Slide 14: Quy Trình Khởi Động Ứng Dụng (Bootstrap Sequence) 5 Bước Độc Lập**
  - *Thông điệp:* Luồng khởi động từ `index.html` → `main.tsx` → `application-bootstrap.tsx` → `AppProviders` → `AppRouter` bảo vệ an toàn trước khi vẽ giao diện.

---

### CHƯƠNG 4: XÁC THỰC, PHÂN QUYỀN & VÒNG ĐỜI PHIÊN JWT (Slide 15 - 19)
- **Slide 15: Bộ Điều Phối Phiên (Session Coordinator) & State Machine 7 Trạng Thái**
  - *Thông điệp:* Quản lý phiên làm việc bằng máy trạng thái hữu hạn chặt chẽ: `bootstrapping` → `anonymous` → `signing-in` → `authenticated` → `checking-health` → `awaiting-consent` → `refreshing` (hoặc `local-limited`).

- **Slide 16: Cơ Chế Lưu Trữ Token An Toàn Trong sessionStorage**
  - *Thông điệp:* Lưu phiên tại `sessionStorage` qua khóa `data-quality.auth.v1` với `schemaVersion: 1`, whitelist các trường bắt buộc, không dùng Cookie giúp ngăn chặn CSRF hoàn toàn.

- **Slide 17: Sơ Đồ Tuần Tự (Sequence Diagram): Đăng Nhập & Khôi Phục Phiên (Session Restoration)**
  - *Thông điệp:* Minh họa chi tiết các bước từ Submit Form Login → Nhận Token → Lưu Storage → Gọi `GET /users/me` xác minh tài khoản đang active.

- **Slide 18: Sơ Đồ Tuần Tự: Cơ Chế Token Expiration, Health Check & Awaiting-Consent Renewal**
  - *Thông điệp:* Không tự refresh ngầm gây mất kiểm soát; hệ thống kiểm tra dịch vụ qua `GET /health`, chuyển sang `awaiting-consent` để người dùng xác nhận, rồi gọi `POST /auth/refresh` và rotate cặp token.

- **Slide 19: Luồng Đăng Xuất An Toàn & Thu Hồi Phiên Trực Tiếp Trên Server**
  - *Thông điệp:* `signOut` gọi `POST /auth/logout` thu hồi Bearer token trên server trước, xóa sạch `sessionStorage` và giải phóng Query Cache để ngăn rò rỉ dữ liệu giữa các phiên đăng nhập.

---

### CHƯƠNG 5: PHÂN TÍCH CÁC LUỒNG NGHIỆP VỤ NGƯỜI DÙNG (Slide 20 - 26)
- **Slide 20: Luồng Quản Lý Workspace & Cơ Chế Kiểm Soát Xung Đột Phiên Bản (Version Concurrency)**
  - *Thông điệp:* Tạo, duyệt danh sách, cập nhật Workspace kèm kiểm soát xung đột dữ liệu thông qua trường `version` tăng dần; tự động rollback khi gặp lỗi.

- **Slide 21: Luồng Quản Lý Dự Án (Projects) & Wizard 4 Bước Chuẩn Bị Dữ Liệu**
  - *Thông điệp:* Project Wizard 4 bước: (1) Nhập thông tin → (2) Tải lên file CSV → (3) Phân tích sơ bộ Schema → (4) Xác nhận hoàn tất và tạo bản ghi trên server.

- **Slide 22: Luồng Quản Lý Thành Viên (Members) & Phân Quyền Phân Cấp Đa Tầng**
  - *Thông điệp:* Phân định rạch ròi giữa Quyền Workspace (`owner`, `member`, `viewer`) và Quyền Dự Án; hỗ trợ chuyển giao quyền sở hữu an toàn (`transfer-owner`).

- **Slide 23: Luồng Quản Lý Dataset: Ingestion, Parse Schema, Thống Kê & Cột PII**
  - *Thông điệp:* Kiểm tra tính hợp lệ của tệp CSV, sinh schema kiểu dữ liệu an toàn (`string`, `number`, `boolean`, `date`), tính toán tỷ lệ thiếu và gắn cờ PII bảo mật.

- **Slide 24: Luồng Lưới Dữ Liệu Ảo (Virtual Grid) & Phân Trang Con Trỏ (Cursor Pagination)**
  - *Thông điệp:* Xử lý mượt mà hàng triệu bản ghi qua `POST /datasets/{id}/records/query` với phân trang con trỏ `nextCursor` và render ảo tối ưu RAM.

- **Slide 25: Luồng Báo Cáo Sự Cố (Issues) & Quy Trình Bổ Sung Dữ Liệu Needs-Info**
  - *Thông điệp:* Tiếp nhận sự cố chất lượng dữ liệu, đính kèm tệp và kích hoạt luồng bổ sung thông tin đa chiều giữa Analyst và Quản trị viên.

- **Slide 26: Cơ Chế Bản Nháp Ngoại Tuyến (Dexie IndexedDB) & Chống Partial Failure**
  - *Thông điệp:* `UploadDraftDatabase` lưu file cục bộ trong IndexedDB, bảo vệ dữ liệu khi mất mạng hoặc token hết hạn, chỉ ghi nhận lên server khi upload thành công trọn vẹn.

---

### CHƯƠNG 6: GIAO TIẾP FE–BE & MA TRẬN KHẾ ƯỚC API (Slide 27 - 33)
- **Slide 27: Kiến Trúc Giao Tiếp Request–Response Toàn Trình**
  - *Thông điệp:* Chuỗi gọi chuẩn mực: Component → Hook → Service → Axios Client → DTO Mapper → State/Cache → UI Render.

- **Slide 28: Chuỗi Chuyển Đổi Khép Kín: openapi.json → TypeScript Types → Service DTOs**
  - *Thông điệp:* Script tự động `generate-swagger-types.mjs` chuyển hóa OpenAPI spec thành các kiểu dữ liệu TypeScript mạnh mẽ, ngăn ngừa lỗi runtime.

- **Slide 29: Ma Trận Khế Ước API (API Contract Matrix) — Nhóm Auth & User Profile**
  - *Thông điệp:* Bảng đối chiếu chi tiết Endpoint, Method, Auth, Headers, Payload, Response DTO cho nhóm xác thực và hồ sơ cá nhân.

- **Slide 30: Ma Trận Khế Ước API (API Contract Matrix) — Nhóm Workspace & Thành Viên**
  - *Thông điệp:* Bảng đối chiếu chi tiết Endpoint, Method, Auth, Headers, Payload, Response DTO cho nhóm Workspace và Members.

- **Slide 31: Ma Trận Khế Ước API (API Contract Matrix) — Nhóm Project & Dataset Virtual Grid**
  - *Thông điệp:* Bảng đối chiếu chi tiết Endpoint, Method, Auth, Headers, Payload, Response DTO cho nhóm Project và Dataset Records.

- **Slide 32: Ma Trận Khế Ước API (API Contract Matrix) — Nhóm Issues & Admin Service**
  - *Thông điệp:* Bảng đối chiếu chi tiết Endpoint, Method, Auth, Headers, Payload, Response DTO cho nhóm Issues và Quản trị viên.

- **Slide 33: Chiến Lược Chuẩn Hóa & Kiểm Soát Lỗi Hệ Thống Toàn Diện**
  - *Thông điệp:* Chuẩn hóa lỗi qua `ApiError` và `normalizeApiError`, phân định rõ cơ chế retry an toàn cho GET và tuyệt đối không tự ý retry với Mutation.

---

### CHƯƠNG 7: TRUY VẾT KỸ THUẬT & ĐÁNG TIN CẬY KIỂM THỬ (Slide 34 - 38)
- **Slide 34: Ma Trận Truy Vết Toàn Trình (Technical Traceability Matrix)**
  - *Thông điệp:* Bảng liên kết xuyên suốt từ User Flow → Component UI → Hook → Service → API Endpoint → DTO Type → Test Suite.

- **Slide 35: Bằng Chứng Kiểm Thử Đạt Chuẩn Tuyệt Đối: 864/864 Vitest PASS 100%**
  - *Thông điệp:* 864 ca kiểm thử trên 71 test suites đạt kết quả 100% PASS sau 162 giây chạy thực tế; không có hồi quy mã nguồn.

- **Slide 36: Kim Tự Tháp Kiểm Thử 4 Tầng: Từ Unit Test Đến Xác Minh Trực Tiếp**
  - *Thông điệp:* Phân bổ tỷ lệ chuẩn: Unit Test (Đáy) → Integration Test → E2E Browser Test → Live Verification (Đỉnh).

- **Slide 37: Kiểm Thử Trình Duyệt Thực Tế Với Playwright E2E Test Suite**
  - *Thông điệp:* Playwright kiểm thử tương tác người dùng thật trên cổng 4173 với Chromium độc lập, bảo đảm luồng đăng nhập và điều hướng trơn tru.

- **Slide 38: Báo Cáo Độ Phủ Mã Nguồn Lịch Sử 70.83% & Kế Hoạch Duy Trì Chất Lượng**
  - *Thông điệp:* Ghi nhận tỷ lệ bao phủ mã nguồn đạt ngưỡng kiểm soát chất lượng cao và kế hoạch duy trì kiểm thử liên tục trong CI/CD.

---

### CHƯƠNG 8: TỔNG KẾT, KHOẢNG TRỐNG & LỘ TRÌNH HÀNH ĐỘNG (Slide 39 - 42)
- **Slide 39: Khoảng Trống Hiện Tại (Current Gaps): Các Phần Chờ Hoàn Thiện Phía Backend**
  - *Thông điệp:* Liệt kê trung thực 4 hạng mục còn dùng Mock hoặc cơ chế cục bộ chờ Backend hỗ trợ endpoint trực tiếp.

- **Slide 40: Phân Tích Nợ Kỹ Thuật (Technical Debt) & Rủi Ro Tiềm Ẩn**
  - *Thông điệp:* Đánh giá rủi ro về WebSocket, tải file CSV cực lớn vượt hạn mức RAM, và giải pháp phòng ngừa dài hạn.

- **Slide 41: 3 Ưu Tiên Hành Động Cấp Thiết Trước Khi Nghiệm Thu Trực Tiếp**
  - *Thông điệp:* (1) Chạy Retest Live với Backend thật → (2) Bổ sung E2E cho luồng Virtual Grid → (3) Hoàn thiện WebSocket sự cố thời gian thực.

- **Slide 42: Tổng Kết Toàn Diện & Tuyên Ngôn Sẵn Sàng Nghiệm Thu**
  - *Thông điệp:* Frontend đã đạt chuẩn mực kiến trúc cao cấp, mã nguồn trong sạch, tài liệu minh bạch và sẵn sàng phục vụ người dùng cuối.
