# BÁO CÁO TỔNG QUAN HỆ THỐNG (SYSTEM OVERVIEW REPORT)
**Dự án:** Nền tảng Full-stack Quản lý & Giám sát Chất lượng Dữ liệu có AI Hỗ trợ  
*(Full-Stack Data Management & Quality Assurance Platform with AI Assistance)*  
**Phiên bản:** v2.0  
**Ngày lập:** 18/10/2026  
**Trạng thái tài liệu:** Tài liệu giới thiệu tổng quan hệ thống (Cập nhật định vị Full-stack)

---

## Lịch sử thay đổi (Change Log v1.0 ➔ v2.0)
- **Thay đổi gì:** Tái định vị hệ thống từ góc nhìn thuần công cụ AI sang **Nền tảng Full-stack hoàn chỉnh** phục vụ quản lý dữ liệu. Phân định rõ AI là một **tiểu hệ thống hỗ trợ thông minh (AI Copilot / Assistant)**, đồng thời mở rộng và phân rã các phân hệ nghiệp vụ cốt lõi khác của hệ thống.
- **Lý do:** Tránh hiểu nhầm hệ thống chỉ là một wrapper gọi AI API; xác lập đầy đủ kiến trúc của một ứng dụng Full-stack toàn diện (Frontend, Backend, Database, Message Queue, Security, Offline Cache, User Management, Data Catalog).
- **Ảnh hưởng đến đâu:** Ảnh hưởng trực tiếp đến cấu trúc phân rã tính năng (Feature Matrix) ở bước tiếp theo và mô hình kiến trúc kỹ thuật tổng thể.

---

## 1. Định vị và Bản chất của Hệ thống

Đây là một **hệ thống Full-stack hướng dữ liệu (Data-Intensive Application)** được thiết kế chuyên nghiệp cho các nhà phân tích dữ liệu (Data Analysts) và đội ngũ kỹ thuật. 

Hệ thống giải quyết bài toán quản trị dữ liệu từ đầu đến cuối (End-to-End Data Management): từ khâu tiếp nhận đa nguồn, quản lý không gian làm việc, thiết lập luật nghiệp vụ thủ công, cho đến việc tự động hóa kiểm định và làm sạch dữ liệu.

Trong bức tranh tổng thể này:
- **Hệ thống Full-stack (Core Platform):** Đóng vai trò là xương sống vận hành. Chịu trách nhiệm bảo mật, kết nối dữ liệu, quản lý phiên bản, trực quan hóa giao diện, ghi nhận nhật ký (audit log), và đảm bảo hệ thống vẫn phản hồi mượt mà ngay cả khi mất kết nối máy chủ.
- **AI (AI Assistant / Copilot):** Đóng vai trò là **công cụ gia tăng giá trị (Value-added Tool)**. AI hoạt động như một "trợ lý thông minh" bên cạnh người dùng: tự động đọc các mẫu hình bất thường (anomalies), diễn giải ý nghĩa của lỗi dữ liệu bằng ngôn ngữ tự nhiên và đề xuất chiến lược khắc phục tối ưu mà các luật cứng (hardcoded rules) có thể bỏ sót.

---

## 2. Bức tranh toàn cảnh: Các phân hệ nghiệp vụ của Hệ thống (The Full-Stack Ecosystem)

Hệ thống được tổ chức thành **8 phân hệ nghiệp vụ hoàn chỉnh**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       GIAO DIỆN NGƯỜI DÙNG (FRONTEND)                       │
│        Vite + React (Dashboard, Data Grid, Lineage Graph, Offline Cache)    │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTPS / WSS
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                        MÁY CHỦ TRUNG TÂM (BACKEND API)                      │
│                  NestJS Modular Architecture & Orchestration                │
│                                                                             │
│  ┌───────────────────────┐  ┌───────────────────────┐  ┌─────────────────┐ │
│  │ 1. Auth & Phân quyền  │  │ 2. Data Connectors    │  │ 3. Data Catalog │ │
│  └───────────────────────┘  └───────────────────────┘  └─────────────────┘ │
│  ┌───────────────────────┐  ┌───────────────────────┐  ┌─────────────────┐ │
│  │ 4. Quality Engine     │  │ 5. Versioning (Undo)  │  │ 6. Reporting    │ │
│  │    (Rules + AI Sub)   │  │    & Transformation   │  │    & Exporter   │ │
│  └───────────────────────┘  └───────────────────────┘  └─────────────────┘ │
│  ┌───────────────────────┐  ┌───────────────────────┐                       │
│  │ 7. Audit & Alerting   │  │ 8. Offline Sync Layer │                       │
│  └───────────────────────┘  └───────────────────────┘                       │
└───────────────────┬─────────────────────┬───────────────────┬───────────────┘
                    │                     │                   │
         ┌──────────▼────────┐   ┌────────▼─────────┐   ┌─────▼───────┐
         │ MongoDB (Primary) │   │ Neo4j (Lineage)  │   │ RabbitMQ    │
         └───────────────────┘   └──────────────────┘   └─────────────┘
```

### Phân hệ 1: Quản trị Tài khoản & Phân quyền (Identity, Authentication & RBAC)
- Đăng ký, đăng nhập an toàn với chuẩn JWT (Access Token & Refresh Token).
- Phân quyền người dùng (Role-Based Access Control): Quản trị viên (Admin), Chuyên viên phân tích (Analyst), Khách (Viewer).
- Quản lý phiên làm việc, mã hóa mật khẩu bằng thuật toán an toàn (Bcrypt/Argon2).

### Phân hệ 2: Quản lý Nguồn & Tiếp nhận Dữ liệu (Data Ingestion Hub)
- **Tải tệp đa định dạng (Batch Ingestion):** Quản lý upload các file CSV, Excel (`.xlsx`), JSON; xác thực kích thước file và cấu trúc dữ liệu thô.
- **Kết nối cơ sở dữ liệu quan hệ (RDBMS Connectors):** Thiết lập và lưu trữ an toàn chuỗi kết nối (Connection Strings) tới PostgreSQL, MySQL, SQLite; hỗ trợ kiểm tra kết nối (Ping test) và trích xuất schema tự động.
- **Thu nạp luồng thời gian thực (Streaming Ingestion):** Đăng ký lắng nghe các tin nhắn từ hàng đợi RabbitMQ, tiếp nhận và kiểm tra dữ liệu theo lô thời gian thực.

### Phân hệ 3: Quản lý Không gian làm việc & Danh mục dữ liệu (Workspace & Data Catalog)
- Tổ chức các tập dữ liệu theo từng Dự án / Không gian làm việc (Workspaces).
- Quản lý siêu dữ liệu (Data Dictionary / Metadata): Cho biết mỗi bộ dữ liệu có bao nhiêu dòng, bao nhiêu cột, kiểu dữ liệu từng cột (String, Number, Date, Boolean), và tóm tắt thống kê ban đầu.
- Giao diện bảng dữ liệu tương tác (Interactive Data Grid): Cho phép lọc, tìm kiếm, sắp xếp và xem nhanh nội dung dữ liệu.

### Phân hệ 4: Động cơ Đánh giá Chất lượng Dữ liệu kết hợp (Hybrid Quality Engine)
Đây là phân hệ kết hợp sức mạnh giữa thuật toán xác định và trí tuệ nhân tạo:
- **Động cơ Luật cứng (Rule-based Engine):** Cho phép người dùng tự thiết lập các ràng buộc nghiệp vụ (Business Rules) như: Cột A không được rỗng, Cột B phải có giá trị trong khoảng [0, 100], Cột C phải khớp biểu thức chính quy (Regex).
- **Tiểu hệ thống AI Hỗ trợ (AI Assistant Subsystem):** 
  - Tự động nhận diện các vấn đề tiềm ẩn mà luật cứng không quét tới (phân tích bất thường phân phối, giá trị ngoại lai đa chiều).
  - Đọc báo cáo thống kê và "kê đơn": Đưa ra các gợi ý cụ thể kèm lý lẽ rõ ràng (ví dụ: giải thích vì sao nên dùng phép nội suy KNN thay vì xóa bản ghi).

### Phân hệ 5: Thực thi Làm sạch, Quản lý Phiên bản & Hoàn tác (Remediation & Versioning)
- Cho phép người dùng chọn thực thi theo các gợi ý của AI hoặc tự chọn thao tác thủ công (xóa dòng, điền giá trị thiếu, thay thế chuỗi, cắt tỉa ngoại lai).
- **Cơ chế An toàn dữ liệu (Data Versioning & Rollback):**
  - Mọi thay đổi đều được ghi lại thành các phiên bản tuần tự (v1 $\to$ v2 $\to$ v3).
  - Cho phép người dùng xem lại lịch sử thay đổi (Changelog) và thực hiện **Hoàn tác từng bước (Step-by-step Undo/Redo)** quay về bất kỳ mốc nào mà không lo mất dữ liệu ban đầu.

### Phân hệ 6: Trực quan hóa, Xuất dữ liệu & Báo cáo (Analytics & Reporting)
- Biểu đồ trực quan hóa phân phối dữ liệu và các chỉ số đo lường chất lượng dữ liệu (Completeness, Validity, Uniqueness, Accuracy).
- Xem trước (Preview) vài chục dòng dữ liệu sạch sau xử lý.
- Tải về bộ dữ liệu đã làm sạch dưới nhiều định dạng (CSV, JSON, Excel).
- **Xuất Báo cáo PDF chuyên nghiệp:** Tổng hợp tình trạng dữ liệu trước và sau khi làm sạch, các lỗi đã phát hiện, biện pháp đã thực hiện để phục vụ báo cáo quản lý.

### Phân hệ 7: Giám sát, Nhật ký & Cảnh báo (Audit Trail, Notification & Mailer)
- Nhật ký kiểm toán (Audit Trail): Ghi nhận toàn bộ thao tác ai đã làm gì, vào thời điểm nào, tác động lên tập dữ liệu nào.
- Dịch vụ gửi Email tự động: Gửi thông báo khi hoàn thành quét dữ liệu, phát hiện lỗi nghiêm trọng vượt ngưỡng cảnh báo hoặc gửi kèm file báo cáo định kỳ.

### Phân hệ 8: Tầng Thích ứng Ngoại tuyến (Offline-First Resilience Layer)
- Tích hợp công nghệ lưu trữ phía trình duyệt (**IndexedDB**) để lưu tạm trạng thái người dùng và bản nháp phân tích khi mất kết nối Backend.
- Giao diện áp dụng cơ chế suy thoái nhẹ nhàng (Graceful Degradation): Không báo lỗi sập hệ thống, chuyển các tính năng phụ thuộc server sang chế độ chờ và đồng bộ ngầm khi kết nối phục hồi.

---

## 3. Vai trò chính xác của AI trong Hệ thống

Để định nghĩa ranh giới kỹ thuật rõ ràng:

| Trách nhiệm | AI Assistant Subsystem đảm nhiệm | Core Full-stack Platform đảm nhiệm |
|---|---|---|
| **Phát hiện lỗi (Detection)** | Phân tích bất thường ngữ cảnh, lỗi mờ (fuzzy anomalies), gợi ý các mẫu lỗi bất thường. | Kiểm tra ràng buộc cứng: Schema types, Null check, Regex, Unique key, Foreign key. |
| **Gợi ý (Recommendation)** | Diễn giải nguyên nhân lỗi bằng ngôn ngữ tự nhiên, đề xuất giải pháp xử lý phù hợp ngữ cảnh. | Liệt kê các thuật toán khả dụng (Drop, Mean, Median, Mode, Clip) và kiểm tra tính hợp lệ của tham số. |
| **Thực thi (Execution)** | Không trực tiếp sửa database. AI chỉ tạo ra công thức/hướng dẫn biến đổi (Transformation Recipe). | Nhận công thức được người dùng duyệt, thực thi tính toán trên dữ liệu, ghi log, lưu version mới vào Database. |
| **Quyết định (Authority)** | Đóng vai trò tham vấn (Advisory). | Người dùng (Data Analyst) nắm quyền kiểm soát tối cao (Human-in-the-loop). |

---

## 4. Kiến trúc Công nghệ Tổng thể

| Thành phần | Công nghệ lựa chọn | Vai trò trong hệ sinh thái | Lý do lựa chọn |
|---|---|---|---|
| **Frontend** | **React + Vite (TypeScript)** | Toàn bộ giao diện người dùng, xử lý trạng thái bảng dữ liệu, tương tác offline qua IndexedDB. | Build nhanh, tối ưu render DOM cho dữ liệu lớn, linh hoạt cấu hình Client Cache. |
| **Backend** | **NestJS (TypeScript)** | Cung cấp RESTful APIs, điều phối các luồng xử lý dữ liệu, kiểm tra quyền, quản lý tác vụ nền. | Kiến trúc module hóa theo chuẩn Enterprise, Dependency Injection rõ ràng, dễ bảo trì và mở rộng. |
| **Primary DB** | **MongoDB** | Lưu trữ người dùng, không gian làm việc, siêu dữ liệu tệp tải lên, báo cáo chất lượng, snapshot phiên bản. | Khả năng chứa dữ liệu dạng Document không ràng buộc schema cứng, phù hợp với sự thay đổi cột của các file upload. |
| **Graph DB** | **Neo4j** | Lưu trữ và trực quan hóa **Data Lineage**: Nguồn $\to$ Bộ dữ liệu $\to$ Luật kiểm tra $\to$ Bước làm sạch $\to$ Kết quả. | Chuyên biệt hóa cho bài toán duyệt quan hệ đồ thị đa tầng, tối ưu hơn bảng quan hệ truyền thống. |
| **Message Broker** | **RabbitMQ** | Tiếp nhận và điều phối luồng dữ liệu thời gian thực (Data Streaming). | Nhẹ, tiêu tốn ít tài nguyên bộ nhớ hơn Kafka, tích hợp sẵn trong hệ sinh thái NestJS Microservices. |
| **Bảo mật & Máy chủ** | **HTTPS (Port 443) + Cloudflare SSL** | Bảo vệ lưu lượng mạng, chống tấn công DDoS, mã hóa kênh truyền. | Tiêu chuẩn bắt buộc cho ứng dụng web hiện đại. |
| **Kiểm thử** | **Jest + Supertest + k6** | Kiểm thử đơn vị (Unit), kiểm thử tích hợp (E2E) và kiểm thử chịu tải (Performance Test). | Đảm bảo tính toàn vẹn của logic làm sạch và độ chịu tải của API khi xử lý dữ liệu lớn. |

---

## 5. Đánh giá rủi ro, điểm yếu và Trade-offs kỹ thuật

Một hệ thống Full-stack toàn diện luôn phải đối mặt với các bài toán kỹ thuật phức tạp:

1. **Rủi ro ranh giới giữa AI và Logic nghiệp vụ:**
   - *Điểm yếu:* Nếu phụ thuộc quá nhiều vào AI để phát hiện lỗi, hệ thống sẽ chậm (High Latency) và có thể phát sinh chi phí token lớn.
   - *Biện pháp:* Ưu tiên chạy Động cơ luật cứng (Rule-based Engine) trước để lọc sạch 80% các lỗi thông thường với độ trễ tính bằng mili-giây; chỉ chuyển các trường hợp nghi ngờ phức tạp cho AI Assistant phân tích.
2. **Rủi ro xung đột dữ liệu khi Offline (Offline Sync Conflicts):**
   - *Điểm yếu:* Cho phép thao tác cục bộ khi Backend ngắt kết nối có nguy cơ dữ liệu tại máy người dùng bị lệch so với trạng thái mới nhất trên máy chủ.
   - *Biện pháp:* Áp dụng chính sách "Chỉ đọc / Lưu bản nháp cục bộ" (Draft Mode); chỉ kích hoạt tiến trình commit dữ liệu chính thức khi kết nối máy chủ được xác thực toàn vẹn.
3. **Áp lực tài nguyên máy chủ phát triển (Resource Footprint):**
   - *Điểm yếu:* Chạy đồng thời MongoDB, Neo4j, RabbitMQ, NestJS và Vite có thể chiếm tới 3GB–5GB RAM.
   - *Biện pháp:* Khống chế tài nguyên nghiêm ngặt trong `docker-compose.yml` (MongoDB: 512MB, Neo4j: 1GB, RabbitMQ: 512MB).
4. **Sự đánh đổi trong cơ chế lưu phiên bản dữ liệu (Storage vs Latency):**
   - *Điểm yếu:* Lưu toàn bộ bảng dữ liệu sau mỗi thao tác sẽ gây cạn kiệt dung lượng đĩa (Storage Bloat). Ngược lại, nếu chỉ lưu công thức mà tính lại từ đầu thì thời gian bấm Hoàn tác (Undo) sẽ rất lâu.
   - *Biện pháp:* Áp dụng cơ chế **Hybrid Checkpointing**: Lưu nhật ký biến đổi (Transformation Changelog) cho các bước nhỏ và tạo bản chụp dữ liệu (Checkpoint Snapshot) ở các mốc quan trọng.

---

## 6. Lộ trình phát triển tiếp theo

```
[ Giai đoạn 1: User Requirement ] ──▶ ĐÃ HOÀN THÀNH (Thể hiện qua báo cáo v2.0 này)
             │
             ▼
[ Giai đoạn 2: Feature Design ]   ──▶ BƯỚC TIẾP THEO (Phân rã chi tiết 8 phân hệ thành các User Stories & Specs)
             │
             ▼
[ Giai đoạn 3: Tech Solution ]    ──▶ Thiết kế Data Model (Mongo + Neo4j), API Contracts, Docker Architecture
             │
             ▼
[ Giai đoạn 4: Logic / AI ]       ──▶ Thiết kế thuật toán Profiling, Transformation Engine & AI Prompt Templates
             │
             ▼
[ Giai đoạn 5: Implementation ]   ──▶ Lập trình Backend (NestJS), Frontend (Vite/React), Modules, Tests
             │
             ▼
[ Giai đoạn 6: Evaluation ]       ──▶ Đo lường chất lượng làm sạch dữ liệu, Benchmark hiệu năng k6
```

---
*Tài liệu này là bản đặc tả tổng quan phiên bản v2.0, phản ánh đầy đủ kiến trúc của một hệ thống Full-stack quản lý chất lượng dữ liệu.*
