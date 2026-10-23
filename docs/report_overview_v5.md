# BÁO CÁO TỔNG QUAN DỰ ÁN TOÀN DIỆN (COMPREHENSIVE PROJECT OVERVIEW REPORT)
**Dự án:** Nền tảng Full-stack Quản lý & Giám sát Chất lượng Dữ liệu có AI Hỗ trợ  
*(Full-Stack Data Management & Quality Assurance Platform with AI Assistance)*  
**Tập tin:** `docs/report_overview_v5.md`  
**Phiên bản:** v5.0  
**Ngày lập:** 19/10/2026  
**Trạng thái tài liệu:** Tài liệu tổng hợp toàn diện dự án (Chiến lược Phân kỳ: Core Platform MVP trước, Tích hợp AI sau)

---

## Lịch sử thay đổi (Change Log v4.0 ➔ v5.0)
- **Thay đổi gì:**
  1. Phân kỳ chiến lược phát triển thành 2 giai đoạn rõ rệt:
     - **Giai đoạn 1 (Core Platform MVP - Triển khai ngay):** Xây dựng khung hệ thống nền tảng hoàn chỉnh chạy được ngay với các chức năng cốt lõi: Xác thực tài khoản (Login/Register/Auth), Tiếp nhận và Xuất dữ liệu tệp (Import/Export CSV, Excel, JSON), Trực quan hóa dữ liệu (Data Visualization, Dashboard & Data Grid), Các thao tác xử lý/làm sạch dữ liệu cơ bản (Data Handling/Transformations), và Cơ chế lưu phiên bản dữ liệu (Data Versioning & Undo/Redo).
     - **Giai đoạn 2 (AI Multi-Tier Integration - Nâng cấp sau khi Core ổn định):** Kích hoạt Động cơ AI 4 tầng toàn diện (Tầng 0: Chuẩn hóa Schema JSON; Tầng 1: Động cơ Luật cứng; Tầng 2: Học máy phát hiện ngoại lai không giám sát; Tầng 3: LLM suy luận ngữ cảnh và kê đơn xử lý), đồng thời mở rộng kết nối CSDL quan hệ ngoài và RabbitMQ stream.
  2. Áp dụng nguyên tắc thiết kế **AI-Ready Architecture & Schemas**: Thiết lập sẵn các trường dữ liệu dự phòng trong MongoDB/Neo4j và các Interface trừu tượng ngay từ Giai đoạn 1 để đảm bảo khi cắm AI vào không phải cấu trúc lại (refactor) mã nguồn hay di chuyển (migrate) cơ sở dữ liệu.
  3. Xác định nguồn dữ liệu ưu tiên số 1 cho Giai đoạn 1: Tập trung hoàn thiện trọn vẹn luồng **File Upload (CSV, Excel, JSON)** trước khi mở rộng sang RDBMS và RabbitMQ.
- **Lý do:** Giảm thiểu rủi ro kỹ thuật, đảm bảo hệ thống có sản phẩm chạy được (Working Software) sớm nhất để kiểm thử thực tế và nghiệm thu đồ án, sau đó mới tích hợp phân hệ AI trên một nền tảng đã ổn định 100%.
- **Ảnh hưởng đến đâu:** Định hình trực tiếp phạm vi đặc tả tính năng của bước tiếp theo: **2. Feature Design**, tập trung phân rã chi tiết danh mục tính năng cho Giai đoạn 1.

---

## 1. Định vị và Giá trị Cốt lõi của Hệ thống

### 1.1. Bản chất hệ thống
Hệ thống là một **Nền tảng Full-Stack Quản lý Dữ liệu Toàn diện**, cung cấp môi trường làm việc tập trung cho các chuyên viên phân tích dữ liệu (**Data Analyst**).

Hệ thống cho phép người dùng nạp dữ liệu thô, khám phá cấu trúc qua bảng và biểu đồ tương tác, thực hiện các phép xử lý làm sạch dữ liệu, quản lý lịch sử phiên bản và xuất dữ liệu sạch ra các định dạng chuẩn.

### 1.2. Vị trí của AI trong lộ trình phát triển
- **Giai đoạn 1 (Khung nền tảng - Core Platform):** Đảm bảo toàn bộ khung xương sống vận hành ổn định không phụ thuộc vào AI: Xác thực tài khoản, quản lý không gian làm việc, xem và chỉnh sửa dữ liệu trên Data Grid, biến đổi dữ liệu cơ bản, lưu lịch sử phiên bản trên MongoDB và đồ thị trên Neo4j.
- **Giai đoạn 2 (Trợ lý thông minh - AI Copilot Integration):** Sau khi khung nền tảng chạy ổn định, AI sẽ được "cắm" (plug-in) vào như một phân hệ gia tăng giá trị: Tự động quét phân phối, tìm các điểm dị biệt ẩn bằng Machine Learning không giám sát, và dùng Cloud LLM để giải thích nguyên nhân cũng như gợi ý chiến lược xử lý.
- **Nguyên tắc bất biến:** **Human-in-the-loop (Con người có quyền quyết định tối cao)**. Mọi thao tác xử lý dữ liệu dù do người dùng tự chọn hay do AI đề xuất đều phải qua bước phê duyệt trước khi ghi nhận chính thức.

---

## 2. Bức tranh Toàn cảnh: 8 Phân hệ Nghiệp vụ Full-Stack

Hệ sinh thái được tổ chức thành 8 phân hệ nghiệp vụ hoàn chỉnh, vận hành theo kiến trúc module hóa (Modular Architecture):

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
│  │    (JWT, RBAC/ABAC)   │  │    (File, DB, Stream) │  │    & Workspaces │  │
│  └───────────────────────┘  └───────────────────────┘  └─────────────────┘  │
│  ┌───────────────────────┐  ┌───────────────────────┐  ┌─────────────────┐  │
│  │ 4. Quality Engine     │  │ 5. Versioning (Undo)  │  │ 6. Reporting    │  │
│  │    (Rules + 4-Tier AI)│  │    & Transformation   │  │    & Exporter   │  │
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

### Chi tiết 8 phân hệ và phân kỳ triển khai:
1. **Phân hệ 1: Quản trị Tài khoản & Phân quyền (Auth & Access Control):** *(Giai đoạn 1)*  
   Đăng ký, đăng nhập bảo mật với JWT (Access/Refresh Token); mã hóa mật khẩu bằng bcrypt; quản lý phiên làm việc.
2. **Phân hệ 2: Quản lý Nguồn & Tiếp nhận Dữ liệu (Data Ingestion Hub):**  
   - *Giai đoạn 1:* Tải tệp đa định dạng: CSV, Excel (`.xlsx`), JSON. Kiểm tra tính toàn vẹn và cấu trúc file thô.
   - *Giai đoạn 2:* Mở rộng kết nối cơ sở dữ liệu quan hệ (PostgreSQL, MySQL, SQLite) và tiếp nhận luồng tin nhắn sự kiện từ RabbitMQ.
3. **Phân hệ 3: Không gian làm việc & Danh mục Dữ liệu (Workspace & Data Catalog):** *(Giai đoạn 1)*  
   Tổ chức dữ liệu theo dự án; từ điển dữ liệu (Data Dictionary); bảng dữ liệu tương tác (Interactive Data Grid) với khả năng ảo hóa (Virtual Scrolling) hỗ trợ duyệt hàng trăm nghìn dòng mượt mà.
4. **Phân hệ 4: Trực quan hóa Dữ liệu (Data Visualization & Profiling):** *(Giai đoạn 1)*  
   Hiển thị biểu đồ phân phối dữ liệu (Histogram, Bar Chart), tỷ lệ giá trị khuyết thiếu (Null Rate), thống kê mô tả (Min, Max, Mean, Median).
5. **Phân hệ 5: Xử lý Dữ liệu, Quản lý Phiên bản & Hoàn tác (Transformation, Versioning & Rollback):** *(Giai đoạn 1)*  
   - Cung cấp bộ công cụ làm sạch dữ liệu: Bỏ dòng null, điền giá trị mặc định/trung vị, cắt tỉa khoảng trắng (trim), chuẩn hóa chữ hoa/chữ thường, lọc bản ghi theo điều kiện.
   - Cơ chế lưu trữ phiên bản dữ liệu (Data Versioning): Hỗ trợ **Hoàn tác từng bước (Step-by-step Undo/Redo)** quay lại trạng thái trước đó bất cứ lúc nào.
6. **Phân hệ 6: Xuất bản Dữ liệu (Data Exporter):**  
   - *Giai đoạn 1:* Xem trước vài chục dòng dữ liệu sạch; lưu tập dữ liệu mới vào cơ sở dữ liệu MongoDB; tải về tệp dữ liệu đã làm sạch dưới định dạng CSV, JSON, Excel.
   - *Giai đoạn 2:* Xuất báo cáo tổng kết chất lượng dữ liệu Before/After ra tệp PDF chuyên nghiệp.
7. **Phân hệ 7: Giám sát & Nhật ký Kiểm toán (Audit Trail & Logging):** *(Giai đoạn 1 & 2)*  
   Ghi nhận nhật ký lịch sử thao tác của người dùng. *(Giai đoạn 2: Tích hợp dịch vụ gửi email tự động)*.
8. **Phân hệ 8: Tầng Thích ứng Ngoại tuyến (Offline-First Resilience Layer):** *(Giai đoạn 1)*  
   Lưu trữ dữ liệu nháp tại IndexedDB của trình duyệt; giao diện không báo lỗi đỏ khi Backend ngắt kết nối (Graceful Degradation).

---

## 3. Kiến trúc Đón đầu AI (AI-Ready Architecture & Data Schemas)

Mặc dù AI được triển khai ở Giai đoạn 2, nhưng toàn bộ kiến trúc mã nguồn và cơ sở dữ liệu ở Giai đoạn 1 được **thiết kế sẵn các cổng kết nối (Interfaces)** để việc tích hợp sau này diễn ra liền mạch:

### 3.1. Thiết kế sẵn Schema trong MongoDB
Các Document lưu trữ tập dữ liệu và kết quả kiểm định trong MongoDB được chừa sẵn các trường dự phòng cho AI:
```json
{
  "_id": "dataset_6713a01",
  "workspace_id": "ws_001",
  "name": "sales_data_oct2026.csv",
  "version": 1,
  "row_count": 50000,
  "columns": [
    {
      "name": "salary",
      "type": "float64",
      "null_count": 12,
      "ai_profile": {
        "is_univariate_outlier": null,    // Để sẵn cho Tầng 2 ML điền vào sau
        "isolation_score": null,          // Để sẵn cho Isolation Forest
        "suggested_imputation": null      // Để sẵn cho Tầng 3 LLM
      }
    }
  ],
  "ai_recommendations": [],               // Mảng chứa các Action Plan của LLM sau này
  "ai_prompt_logs": []                    // Lưu vết các lần gọi prompt AI
}
```

### 3.2. Thiết kế sẵn Plugin Interface trong Backend NestJS
Backend sử dụng mẫu thiết kế **Strategy Pattern**:
```typescript
// Interface trừu tượng được định nghĩa ngay từ Giai đoạn 1:
export interface IDataTransformationEngine {
  execute(datasetId: string, recipe: TransformationRecipe): Promise<DatasetVersion>;
}

// Giai đoạn 1: Dùng BasicTransformationEngine (chạy bằng code TypeScript/Mongo thuần)
// Giai đoạn 2: Bổ sung AiAssistedTransformationEngine mà không cần sửa code controller
```

---

## 4. Tầm nhìn Kiến trúc AI 4 Tầng Toàn diện (Sẽ tích hợp ở Giai đoạn 2)

Khi hệ thống Core Platform đã vận hành ổn định, phân hệ AI 4 tầng sẽ được kích hoạt:

```
[ BẢNG PHẲNG (CSV / Excel) hoặc DỮ LIỆU BÁN CẤU TRÚC (JSON) ]
                               │
                               ▼
┌────────────────────────────────────────────────────────────────────────┐
│ TẦNG 0: CHUẨN HÓA CẤU TRÚC & PHẲNG HÓA (Schema Normalizer)             │
│ - Tự động suy diễn Union Schema, làm phẳng Dot-notation (max depth = 3)│
└──────────────────────────────┬─────────────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────────────┐
│ TẦNG 1: ĐỘNG CƠ LUẬT CỨNG (Deterministic Rule-Based Engine)           │
│ - Quét cú pháp nhị phân: Missing Key, Regex, Type Casting, Hash Dup    │
└──────────────────────────────┬─────────────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────────────┐
│ TẦNG 2: MÁY HỌC & THỐNG KÊ CỤC BỘ (Local ML Engine - Chạy Offline)     │
│ - Học không giám sát qua lệnh `model.fit(X)` trực tiếp trên RAM        │
│ - Phát hiện ngoại lai đa biến (Isolation Forest), trùng lặp mờ chuỗi   │
│   (Jaro-Winkler) và kiểm định trôi dạt dữ liệu (KS-Test, PSI)          │
└──────────────────────────────┬─────────────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────────────┐
│ TẦNG 3: TRÍ TUỆ SUY LUẬN & KÊ ĐƠN (Cognitive Reasoning - Cloud LLM)    │
│ - Gửi Metadata + 20-30 dòng mẫu lỗi (che PII) lên Gemini API           │
│ - Sinh Kế hoạch hành động định dạng Strict JSON Action Plan            │
│ - Cơ chế dự phòng: Tự động chuyển sang Ma trận luật khi mất mạng       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Ràng buộc Kỹ thuật và Giới hạn Dữ liệu (Data Boundaries)

Để đảm bảo hệ thống vận hành mượt mà trên môi trường máy tính cá nhân, các ngưỡng giới hạn cứng được thiết lập:

| Nhóm thông số | Chỉ số giới hạn | Ngưỡng quy định cứng | Cơ sở kỹ thuật và Lý do bắt buộc |
|---|---|---|---|
| **Giới hạn Tệp** | Dung lượng tệp CSV / JSON | **Tối đa 50 MB** | Tránh tràn bộ nhớ đệm Buffer của Node.js khi upload và phân tích chuỗi. |
| | Dung lượng tệp Excel (`.xlsx`) | **Tối đa 20 MB** | Tệp Excel nén cấu trúc XML; khi bung vào RAM sẽ tốn dung lượng gấp 5–10 lần file gốc. |
| **Quy mô Dòng** | Số dòng xử lý trên Server (Online) | **Tối đa 200,000 dòng** | Đảm bảo các thao tác biến đổi dữ liệu hoàn tất trong thời gian dưới 5 giây. |
| | Số dòng xử lý trên Client (Offline) | **Tối đa 20,000 dòng** | Trình duyệt chạy V8 Engine có giới hạn RAM cho tab; vượt quá sẽ gây đơ giao diện. |
| | Số lượng cột tối đa (Columns) | **Tối đa 100 cột** | Đảm bảo hiệu năng ảo hóa danh sách (Virtual Scrolling) của bảng dữ liệu trên React. |
| **Semi-structured (JSON)** | Độ sâu lồng nhau (Max Nesting Depth) | **Tối đa 3 cấp** | Cấu trúc sâu hơn cấp 3 (`a.b.c.d...`) gom thành chuỗi JSON thô để chống bùng nổ số cột. |
| | Độ dài mảng (Max Array Elements) | **Tối đa 500 phần tử / mảng** | Ngăn chặn việc một bản ghi chứa mảng hàng nghìn object làm cạn kiệt bộ nhớ. |
| | Khóa phẳng tối đa (Max Flattened Keys) | **Tối đa 100 trường** | Tổng số thuộc tính sau khi làm phẳng không được vượt quá 100 trường. |

---

## 6. Kiến trúc Công nghệ & Hạ tầng (Technology Stack Blueprint)

| Thành phần | Công nghệ lựa chọn | Vai trò trong hệ sinh thái | Lý do lựa chọn (Giải trình kỹ thuật) |
|---|---|---|---|
| **Frontend Web** | **React + Vite (TypeScript)** | Giao diện người dùng, Data Grid, Biểu đồ thống kê, Offline cache | Tốc độ xây dựng cực nhanh, tối ưu render bảng dữ liệu lớn, hỗ trợ tốt IndexedDB. |
| **Backend API** | **NestJS (TypeScript)** | RESTful API, xác thực, điều phối pipeline biến đổi dữ liệu | Khung làm việc hướng module chặt chẽ (Modular Architecture), tính đóng gói cao, type-safety mạnh mẽ. |
| **Primary Database** | **MongoDB** | Lưu trữ tài khoản, metadata tập dữ liệu, các snapshot phiên bản dữ liệu | Lưu trữ tài liệu JSON (BSON) linh hoạt (Schemaless), phù hợp với cấu trúc cột thay đổi liên tục của file upload. |
| **Graph Database** | **Neo4j** | Lưu trữ và hiển thị đồ thị nguồn gốc dữ liệu (**Data Lineage**) | Tối ưu tuyệt đối cho bài toán truy vết quan hệ: Bộ dữ liệu gốc $\to$ Các bước biến đổi $\to$ Bộ dữ liệu đích. |
| **Hạ tầng & Bảo mật** | **HTTPS (Port 443) + Cloudflare SSL** | Bảo vệ lưu lượng mạng, mã hóa kênh truyền | Tiêu chuẩn bắt buộc cho ứng dụng web hiện đại. |
| **Kiểm thử** | **Jest + Supertest + k6** | Kiểm thử đơn vị (Unit), kiểm thử tích hợp (E2E) và kiểm thử chịu tải (Performance) | Đảm bảo tính toàn vẹn của logic biến đổi dữ liệu và độ chịu tải của API khi xử lý dữ liệu lớn. |

---

## 7. Ma trận Quản trị Rủi ro Kỹ thuật (Risk Management Matrix)

| STT | Rủi ro nhận diện | Hệ quả tiềm ẩn | Giải pháp kiểm soát chính thức |
|:---:|---|---|---|
| **1** | **Xung đột đồng bộ Offline (Data Sync Conflict)** | Tạo tài khoản hoặc dữ liệu mới lúc offline bị trùng với server khi kết nối lại, gây lỗi 409. | **Không cho phép tạo tài khoản mới khi offline**; chỉ cho phép người dùng đã đăng nhập làm việc ở chế độ "Bản nháp cục bộ" (Draft Mode) với dữ liệu đã lưu sẵn. |
| **2** | **Quá tải tài nguyên máy phát triển (RAM Overhead)** | Chạy đồng thời MongoDB, Neo4j, NestJS, Vite ngốn nhiều RAM gây đơ máy. | Cấu hình giới hạn RAM cứng trực tiếp trong `docker-compose.yml`: MongoDB tối đa 512MB, Neo4j tối đa 1GB. |
| **3** | **Bùng nổ dung lượng khi lưu phiên bản (Storage Bloat)** | Lưu bản chụp (Full Snapshot) toàn bộ bảng dữ liệu sau mỗi thao tác làm sạch làm đầy ổ cứng. | Áp dụng mô hình **Hybrid Checkpointing**: Chỉ lưu công thức biến đổi (Changelog) cho các bước nhỏ; chỉ chụp snapshot toàn phần ở các mốc phiên bản lớn. |
| **4** | **Phức tạp hóa khi cắm AI sau này (Refactoring Risk)** | Thiết kế Core ban đầu không tính đến AI dẫn đến việc phải viết lại toàn bộ code sau này. | Định nghĩa sẵn **AI-Ready Schemas** trong MongoDB và **Plugin Interfaces** trong NestJS ngay từ Giai đoạn 1. |

---

## 8. Lộ trình Triển khai Dự án Cụ thể

```
[ Giai đoạn 1: User Requirement ] ──▶ ĐÃ HOÀN THÀNH (Đóng gói tại báo cáo v5.0 này)
             │
             ▼
[ Giai đoạn 2: Feature Design ]   ──▶ BƯỚC TIẾP THEO (Phân rã chi tiết danh mục tính năng cho Core Platform MVP)
             │                        - Auth & Session Flow
             │                        - File Ingestion & Data Grid Explorer
             │                        - Basic Transformations & Versioning
             ▼
[ Giai đoạn 3: Tech Solution ]    ──▶ Thiết kế Data Model (MongoDB, Neo4j), API Specs, Docker Compose
             │
             ▼
[ Giai đoạn 4: Implementation ]   ──▶ Lập trình Backend (NestJS), Frontend (Vite/React), Modules, Tests
             │
             ▼
[ Giai đoạn 5: Core Testing ]     ──▶ Kiểm thử hoàn chỉnh Core Platform chạy ổn định 100%
             │
             ▼
[ Giai đoạn 6: AI Integration ]   ──▶ Tích hợp Phân hệ AI 4 Tầng & Benchmark k6
```

---
*Tài liệu này là bản đặc tả tổng quan hoàn chỉnh và chuẩn xác nhất của toàn bộ dự án ở phiên bản v5.0, xác lập lộ trình triển khai Core Platform trước và tích hợp AI sau.*
