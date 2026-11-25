# BÁO CÁO TỔNG QUAN DỰ ÁN TOÀN DIỆN (COMPREHENSIVE PROJECT OVERVIEW REPORT)
**Dự án:** Nền tảng Full-stack Quản lý & Giám sát Chất lượng Dữ liệu có AI Hỗ trợ  
*(Full-Stack Data Management & Quality Assurance Platform with AI Assistance)*   
**Trạng thái tài liệu:** Tài liệu tổng hợp toàn diện dự án (Đóng gói hoàn chỉnh Giai đoạn User Requirement)

---

## 1. Giá trị Cốt lõi

### 1.1. Bản chất hệ thống
Hệ thống là một **Nền tảng Full-Stack Quản lý & Giám sát Chất lượng Dữ liệu Toàn diện**, **`AI`** sẽ là phần hỗ trợ cho hệ thống


### 1.2. Vị trí chính của AI trong hệ sinh thái
- **Hệ thống Full-stack (Core Platform):** Là khung xương sống đảm bảo vận hành ổn định: Quản trị tài khoản, phân quyền ABAC, kết nối đa nguồn dữ liệu, lưu trữ phiên bản dữ liệu (Versioning), truy vết nguồn gốc (Data Lineage trên Neo4j), trực quan hóa dữ liệu và xuất báo cáo PDF.
- **AI (AI Copilot / Assistant Subsystem):** Đóng vai trò là **công cụ trợ lý chuyên sâu**. AI không thay thế con người mà hỗ trợ con người: tự động nhận diện các bất thường phân phối phức tạp, đọc hiểu ngữ cảnh nghiệp vụ, diễn giải nguyên nhân lỗi bằng ngôn ngữ tự nhiên và đề xuất chiến lược làm sạch tối ưu.
- **Nguyên tắc bất biến:** **Human-in-the-loop (Con người có quyền quyết định tối cao)**. AI chỉ đề xuất và lập kế hoạch (Action Plan); quyết định thực thi và ghi nhận thay đổi luôn thuộc về người dùng.

---

## 2. Bức tranh Toàn cảnh: 8 Phân hệ Nghiệp vụ Full-Stack

Hệ sinh thái được tổ chức thành 8 phân hệ nghiệp vụ hoàn chỉnh, vận hành theo cấu trúc module hóa cao (Modular Architecture):

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       GIAO DIỆN NGƯỜI DÙNG (FRONTEND)                       │
│        Vite + React (Dashboard, Data Grid, Lineage Graph, Offline Cache)    │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTPS (Port 443) / Cloudflare SSL
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                        MÁY CHỦ TRUNG TÂM (BACKEND API)                      │
│                  NestJS Modular Architecture & Orchestration                │
│                                                                             │
│  ┌───────────────────────┐  ┌───────────────────────┐  ┌─────────────────┐  │
│  │ 1. Auth & Phân quyền  │  │ 2. Data Connectors    │  │ 3. Data Catalog │  │
│  │    (JWT, RBAC)        │  │    (File, DB, Stream) │  │    & Workspaces │  │
│  └───────────────────────┘  └───────────────────────┘  └─────────────────┘  │
│  ┌───────────────────────┐  ┌───────────────────────┐  ┌─────────────────┐  │
│  │ 4. Quality Engine     │  │ 5. Versioning (Undo)  │  │ 6. Reporting    │  │
│  │    (Rules + 4-Tier AI)│  │    & Transformation   │  │    & PDF Export │  │
│  └───────────────────────┘  └───────────────────────┘  └─────────────────┘  │
│  ┌───────────────────────┐  ┌───────────────────────┐                       │
│  │ 7. Audit & Alerting   │  │ 8. Offline Sync Layer │                       │
│  │    (Logs, Email)      │  │    (IndexedDB Engine) │                       │
│  └───────────────────────┘  └───────────────────────┘                       │
└───────────────────┬─────────────────────┬───────────────────┬───────────────┘
                    │                     │                   │
         ┌──────────▼────────┐   ┌────────▼─────────┐   ┌─────▼───────┐
         │ MongoDB (Primary) │   │ Neo4j (Lineage)  │   │ RabbitMQ    │
         └───────────────────┘   └──────────────────┘   └─────────────┘
```

1. **Phân hệ 1: Quản trị Tài khoản & Phân quyền (Auth & ABAC):** Đăng ký, đăng nhập bảo mật với JWT (Access/Refresh Token); phân quyền nghiêm ngặt theo vai trò: Admin, Data Analyst, Viewer.
2. **Phân hệ 2: Quản lý Nguồn & Tiếp nhận Đa kênh (Data Ingestion Hub):**
   - *Batch File:* Tải tệp CSV, Excel (`.xlsx`), JSON.
   - *RDBMS Connectors:* Kết nối an toàn qua Connection Pool tới PostgreSQL, MySQL, SQLite.
   - *Streaming Ingestion:* Đăng ký tiêu thụ luồng tin nhắn sự kiện thời gian thực từ RabbitMQ.
3. **Phân hệ 3: Không gian làm việc & Danh mục Dữ liệu (Workspace & Data Catalog):** Tổ chức dữ liệu theo dự án; hiển thị từ điển dữ liệu (Data Dictionary); bảng tương tác dữ liệu (Interactive Data Grid) hỗ trợ lọc, tìm kiếm và xem nhanh dữ liệu lớn.
4. **Phân hệ 4: Động cơ Đánh giá Chất lượng Kết hợp (Hybrid Quality Engine):** Vận hành bộ máy kiểm tra kép gồm Động cơ Luật cứng nghiệp vụ kết hợp Phân hệ AI 4 tầng toàn diện.
5. **Phân hệ 5: Thực thi Làm sạch, Quản lý Phiên bản & Hoàn tác (Remediation, Versioning & Rollback):**
   - Áp dụng các phép biến đổi dữ liệu (xóa dòng, điền khuyết thiếu, cắt ngoại lai, chuẩn hóa chuỗi) dựa trên gợi ý AI hoặc cấu hình thủ công.
   - Lưu trữ lịch sử phiên bản dữ liệu (Data Versioning) cho phép **Hoàn tác từng bước (Undo/Redo)** an toàn.
6. **Phân hệ 6: Trực quan hóa, Xuất dữ liệu & Báo cáo (Analytics, PDF & Data Exporter):**
   - Dashboard đo lường **Data Quality Score (0–100%)** theo 6 chiều chất lượng.
   - Xem trước (Preview) vài chục dòng dữ liệu sạch; tải về file sạch hoàn chỉnh; xuất báo cáo đối chiếu Before/After ra file PDF chuyên nghiệp.
7. **Phân hệ 7: Giám sát, Nhật ký Kiểm toán & Cảnh báo (Audit Trail, Notification & Mailer):** Lưu vết toàn bộ lịch sử thao tác của người dùng; tự động kích hoạt gửi email cảnh báo khi điểm chất lượng dữ liệu tụt dốc hoặc khi hoàn thành tiến trình xử lý lớn.
8. **Phân hệ 8: Tầng Thích ứng Ngoại tuyến (Offline-First Resilience Layer):** Ứng dụng IndexedDB tại trình duyệt giúp duy trì trải nghiệm liền mạch khi Backend ngắt kết nối (Graceful Degradation); hỗ trợ đồng bộ dữ liệu khi mạng phục hồi.

---

## 3. Bản chất Dữ liệu Đầu vào & Đầu ra

### 3.1. Phân loại dữ liệu tiếp nhận
- **Structured Data (Dữ liệu có cấu trúc):** CSV, Excel, RDBMS Tables $\implies$ Cấu trúc bảng phẳng (Tabular Data) với kiểu dữ liệu định sẵn.
- **Semi-structured Data (Dữ liệu bán cấu trúc):** JSON, MongoDB BSON, RabbitMQ Payloads $\implies$ Cấu trúc phân cấp động, có mảng và đối tượng lồng nhau, schema có thể thay đổi linh hoạt giữa các bản ghi.
- **Loại trừ Unstructured Data (Video, Audio, Ảnh):** Tránh phân tán tài nguyên tính toán sang các pipeline thị giác máy tính/âm thanh nặng nề, tập trung tối đa cho nhu cầu phân tích dữ liệu bảng của Data Analyst.

### 3.2. Dữ liệu đầu ra bàn giao cho người dùng
- **Báo cáo trực quan trên Web & Tệp PDF:** Trực quan hóa 6 chiều chất lượng dữ liệu, đối chiếu số liệu Before/After.
- **Dữ liệu đã làm sạch:** Xem trước (preview) vài chục dòng đầu trên Data Grid, lưu vào cơ sở dữ liệu mới và xuất tệp tải về (CSV, JSON, Excel).
- **Hệ thống cảnh báo:** Gửi email tổng hợp kết quả kiểm tra hoặc cảnh báo dị biệt vượt ngưỡng.

---

## 4. Kiến trúc Phân hệ Xử lý Dữ liệu & AI 4 Tầng Toàn diện (4-Tier Engine)

Để xử lý bình đẳng và hiệu quả cả dữ liệu có cấu trúc (Structured) lẫn dữ liệu bán cấu trúc (Semi-structured), hệ thống chuẩn hóa quy trình kiểm định thành **4 Tầng chuyên biệt nối tiếp nhau**:

```
[ DỮ LIỆU BÁN CẤU TRÚC (JSON / RabbitMQ) hoặc BẢNG PHẲNG (CSV / RDBMS) ]
                               │
                               ▼
┌────────────────────────────────────────────────────────────────────────┐
│ TẦNG 0: CHUẨN HÓA CẤU TRÚC & PHẲNG HÓA (Schema Normalization Layer)    │
│ - Phạm vi: Toàn bộ cấu trúc phân cấp tài liệu JSON / Message payload   │
│ - Bản chất: Xác định cấu trúc & Chuyển đổi trung gian                  │
│ - Trách nhiệm:                                                         │
│   1. Tự động suy diễn Schema hợp nhất (Union Schema Discovery).        │
│   2. Bóc tách mảng (Array Aggregation & Unnesting).                    │
│   3. Làm phẳng phân cấp theo Dot-notation (ví dụ: `customer.age`).     │
│   4. Phát hiện trôi dạt cấu trúc (Schema Drift) & Đột biến kiểu.       │
│   5. Kiểm soát bùng nổ số lượng trường (Max Nesting Depth = 3).        │
│ - Tốc độ: 0.2 - 0.5 giây cho 100,000 JSON documents                    │
└──────────────────────────────┬─────────────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────────────┐
│ TẦNG 1: ĐỘNG CƠ LUẬT CỨNG (Deterministic Rule-Based Engine)            │
│ - Phạm vi: Đơn dòng (Row-level / Stateless), O(1) mỗi dòng             │
│ - Bản chất kết quả: Nhị phân tuyệt đối (ĐÚNG hoặc SAI 100%)            │
│ - Trách nhiệm: Kiểm định JSON Schema (AJV), bắt lỗi Missing Key vs Null│
│   Value, kiểm tra Regex định dạng, ép kiểu dữ liệu, bắt trùng lặp băm. │
│ - Tốc độ: < 150 mili-giây cho 100,000 dòng                             │
└──────────────────────────────┬─────────────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────────────┐
│ TẦNG 2: MÁY HỌC & THỐNG KÊ CỤC BỘ (Local ML & Statistical Engine)      │
│ - Phạm vi: Toàn cục bộ dữ liệu (Dataset-level / Stateful), O(N log N)  │
│ - Bản chất kết quả: Xác suất / Điểm số nghi vấn (Anomaly Score 0 - 1)  │
│ - Trách nhiệm: Ngoại lai đơn biến (IQR, Z-Score, Modified Z-Score MAD),│
│   ngoại lai đa biến (Isolation Forest, LOF), trùng lặp mờ chuỗi ký tự  │
│   (Jaro-Winkler, Levenshtein), kiểm định trôi dạt dữ liệu (KS, PSI).   │
│ - Tốc độ: 0.5 - 2.5 giây cho 100,000 dòng (Chạy 100% Offline)          │
└──────────────────────────────┬─────────────────────────────────────────┘
                               │
                               │
                               ▼
┌────────────────────────────────────────────────────────────────────────┐
│ TẦNG 3: TRÍ TUỆ SUY LUẬN & KÊ ĐƠN (Cognitive Reasoning - Cloud LLM)    │
│ - Phạm vi: Toàn cảnh ngữ nghĩa nghiệp vụ                               │
│ - Bản chất kết quả: Bản giải thích nguyên nhân gốc rễ và Kế hoạch      │
│   hành động làm sạch có cấu trúc (Strict JSON Action Plan).            │
│ - Nguyên tắc: Ẩn danh hóa PII, không gửi dữ liệu thô, dùng Gemini API. │
│ - Tốc độ: 1 - 2 giây | Fallback về Ma trận luật khi Offline            │
└────────────────────────────────────────────────────────────────────────┘
```

## 5. Ràng buộc Kỹ thuật và Giới hạn Dữ liệu (Data Boundaries)

Để đảm bảo hệ thống vận hành trơn tru trên môi trường máy tính cá nhân và không bị crash bộ nhớ, các ngưỡng giới hạn cứng được thiết lập toàn diện cho cả dữ liệu bảng và dữ liệu bán cấu trúc:

| Nhóm thông số | Chỉ số giới hạn | Ngưỡng quy định cứng | Cơ sở kỹ thuật và Lý do bắt buộc |
|---|---|---|---|
| **Giới hạn Tệp tổng thể** | Dung lượng tệp CSV / JSON | **Tối đa 50 MB** | Tránh tràn bộ nhớ đệm Buffer của Node.js khi upload và phân tích chuỗi. |
| | Dung lượng tệp Excel (`.xlsx`) | **Tối đa 20 MB** | Tệp Excel nén cấu trúc XML; khi bung vào RAM sẽ tốn dung lượng gấp 5–10 lần file gốc. |
| **Quy mô Xử lý Dòng** | Số dòng xử lý trên Server (Online) | **Tối đa 200,000 dòng** | Đảm bảo các thuật toán Tầng 1 và 2 hoàn tất trong thời gian dưới 5 giây. |
| | Số dòng xử lý trên Client (Offline) | **Tối đa 20,000 dòng** | Trình duyệt chạy V8 Engine có giới hạn RAM cho tab; vượt quá sẽ gây đơ giao diện (UI Freeze). |
| | Số lượng cột tối đa (Columns) | **Tối đa 100 cột** | Đảm bảo hiệu năng ảo hóa danh sách (Virtual Scrolling) của bảng dữ liệu trên React. |
| **Giới hạn Semi-structured (JSON/Stream)** | Độ sâu lồng nhau (Max Nesting Depth) | **Tối đa 3 cấp** | Cấu trúc sâu hơn cấp 3 (`a.b.c.d...`) sẽ làm bùng nổ số cột khi làm phẳng, gây treo Tầng 2. Các cấp sâu hơn cấp 3 được gom thành chuỗi JSON thô. |
| | Độ dài mảng (Max Array Elements) | **Tối đa 500 phần tử / mảng** | Ngăn chặn việc một bản ghi chứa mảng hàng nghìn object làm cạn kiệt bộ nhớ khi duyệt qua. |
| | Khóa phẳng tối đa (Max Flattened Keys) | **Tối đa 100 trường** | Khi hợp nhất Union Schema từ nhiều document JSON khác nhau, tổng số thuộc tính phẳng không được vượt quá 100 trường. |
| | Ngưỡng trôi dạt Schema (Schema Drift Alert) | **Cảnh báo khi $> 5\%$ trường lạ** | Khi các message từ RabbitMQ xuất hiện các khóa mới nằm ngoài Schema đăng ký ban đầu vượt ngưỡng 5%, hệ thống kích hoạt cảnh báo trôi dạt cấu trúc. |
| **Nguồn ngoài & AI** | Truy vấn CSDL nguồn (RDBMS) | **Tối đa 50,000 dòng / lần**<br>Timeout: **30 giây** | Tránh câu lệnh `SELECT *` không giới hạn làm cạn kiệt Connection Pool của CSDL doanh nghiệp. |
| | Bản tin Streaming (RabbitMQ) | - Kích thước: **Tối đa 1 MB / msg**<br>- Throughput: **500 - 1,000 msgs/s** | Bảo vệ bộ nhớ của RabbitMQ Broker và consumer NestJS không bị nghẽn CPU. |
| | Gói tin gửi tới AI (LLM Context) | **Chỉ gửi Metadata + 20-30 dòng mẫu** | Tiết kiệm 95% chi phí token API, giảm độ trễ dưới 2 giây và bảo mật dữ liệu khách hàng. |

---

## 6. Kiến trúc Công nghệ & Hạ tầng (Technology Stack Blueprint)

| Thành phần | Công nghệ lựa chọn | Lý do lựa chọn (Giải trình kỹ thuật) | Các phương án đã loại trừ và lý do |
|---|---|---|---|
| **Frontend Web** | **React + Vite (TypeScript)** | Render DOM cực nhanh cho dữ liệu lớn, tích hợp xuất sắc với IndexedDB cho kiến trúc Offline-first. | Next.js (hướng tới SSR/SEO, không tối ưu bằng Vite SPA cho dashboard thao tác dữ liệu client-heavy). |
| **Backend API** | **NestJS (TypeScript)** | Kiến trúc Module hóa chuẩn doanh nghiệp, Dependency Injection rõ ràng, Type-safety toàn diện. | Express thuần (quá tự do, khó duy trì cấu trúc khi dự án mở rộng quy mô). |
| **Primary Database** | **MongoDB** | Lưu trữ tài liệu JSON (BSON) linh hoạt (Schemaless), phù hợp với cấu trúc cột thay đổi liên tục của file upload và dữ liệu semi-structured. | RDBMS thuần (PostgreSQL/MySQL) làm bảng chính (gặp khó khăn lớn khi schema của file upload biến đổi liên tục). |
| **Graph Database** | **Neo4j** | Lưu trữ và hiển thị trực quan mạng lưới **Data Lineage**: Nguồn $\to$ Bộ dữ liệu $\to$ Luật kiểm tra $\to$ Bước sửa $\to$ Dữ liệu sạch. | Lưu đồ thị vào bảng quan hệ SQL (truy vấn đệ quy đa cấp cực kỳ chậm và phức tạp). |
| **Message Broker** | **RabbitMQ** | Hàng đợi tin nhắn nhẹ, ổn định cao, tiết kiệm RAM, tích hợp sẵn với NestJS Microservices. | Apache Kafka (quá nặng, ngốn nhiều GB RAM tĩnh, phức tạp vượt mức cần thiết cho môi trường đồ án). |
| **Mô hình AI** | **Hybrid: Local ML + Cloud Gemini API** | Local ML xử lý số liệu nhanh và offline; Gemini API phân tích ngữ cảnh, giải thích và kê đơn xử lý. | Tự train LLM từ đầu hoặc Fine-tune (tốn hàng nghìn USD phần cứng, không khả thi trong đồ án). |
| **Hạ tầng & Bảo mật** | **HTTPS (Port 443) + Cloudflare SSL** | Mã hóa lưu lượng toàn trình, phòng chống tấn công mạng, tối ưu CDN. | HTTP không mã hóa (không đạt chuẩn bảo mật). |
| **Test** | **Uni test + E2E + Test case + k6** | Đảm bảo tính đúng đắn của logic tính toán (Unit/E2E) và đo lường độ chịu tải của API (Performance). | Kiểm thử thủ công (dễ sót lỗi và không đo lường được khả năng chịu tải). |

---

## 7. Ma trận Quản trị Rủi ro Kỹ thuật (Risk Management Matrix)

| STT | Rủi ro nhận diện | Hệ quả kỹ thuật tiềm ẩn | Giải pháp kiểm soát chính thức |
|:---:|---|---|---|
| **1** | **Xung đột đồng bộ Offline (Data Sync Conflict)** | Tạo tài khoản hoặc dữ liệu mới lúc offline bị trùng với server khi kết nối lại, gây lỗi 409 và mồ côi dữ liệu. | **Không cho phép tạo tài khoản mới khi offline**; chỉ cho phép người dùng đã đăng nhập làm việc ở chế độ "Bản nháp cục bộ" (Draft Mode) với dữ liệu đã lưu sẵn. |
| **2** | **Quá tải tài nguyên máy phát triển (RAM Overhead)** | Chạy đồng thời MongoDB, Neo4j, RabbitMQ, NestJS, Vite ngốn 4GB–6GB RAM, gây tràn bộ nhớ và treo máy. | Cấu hình giới hạn RAM cứng trực tiếp trong `docker-compose.yml`: MongoDB tối đa 512MB, Neo4j tối đa 1GB, RabbitMQ tối đa 512MB. |
| **3** | **Bùng nổ dung lượng khi lưu phiên bản (Storage Bloat)** | Lưu bản chụp (Full Snapshot) toàn bộ bảng dữ liệu sau mỗi thao tác làm sạch khiến dung lượng DB tăng theo cấp số nhân. | Áp dụng mô hình **Hybrid Checkpointing**: Chỉ lưu công thức biến đổi (Changelog) cho các bước nhỏ; chỉ chụp snapshot toàn phần ở các mốc phiên bản lớn. |
| **4** | **Ảo giác tham số từ LLM (Hallucinated Parameters)** | LLM đề xuất một hàm làm sạch hoặc tham số không có thực trong mã nguồn Backend. | Triển khai bộ lọc **Whitelist Action Validator (sử dụng Zod Schema)** tại Backend; từ chối mọi output không khớp danh mục thuật toán cho phép. |
| **5** | **Rò rỉ dữ liệu cá nhân (PII Leakage)** | Mẫu dữ liệu gửi lên Cloud LLM API vô tình chứa số điện thoại, CCCD, số thẻ ngân hàng. | Tích hợp bộ lọc **PII Masking Filter** tự động quét regex và che mờ các trường nhạy cảm thành `[REDACTED]` trước khi payload rời máy chủ. |

---

## 8. Quy chuẩn Quản lý Dự án và Lộ trình Tiếp theo

### 8.1. Quy chuẩn cấu trúc và tài liệu hóa
- **Mỗi Module trong hệ thống:** Phải có thư mục riêng biệt, tệp `README.md` mô tả chức năng, theo dõi chỉ số phiên bản (Semantic Versioning), và lưu nhật ký Prompt AI (AI Prompting Log) cho từng phân đoạn phát triển.
