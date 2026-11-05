# BÁO CÁO 01: BỐI CẢNH DỰ ÁN, BÀI TOÁN NGHIỆP VỤ VÀ MỤC TIÊU HỆ THỐNG
## HỆ THỐNG AI HỖ TRỢ PHÁT HIỆN VÀ XỬ LÝ VẤN ĐỀ CHẤT LƯỢNG DỮ LIỆU
### (Full-Stack Data Quality Management Platform with AI Assistance)

---

## 1. BỐI CẢNH RA ĐỜI VÀ 3 CÂU HỎI CỐT LÕI

Trong kỷ nguyên chuyển đổi số và bùng nổ Trí tuệ Nhân tạo (AI/ML), dữ liệu được xem là tài sản chiến lược của mọi tổ chức. Tuy nhiên, dữ liệu thu thập từ các hệ thống vận hành thực tế (CRM, ERP, IoT, Web Scraping, Third-party APIs) hầu hết là dữ liệu thô, thường xuyên gặp phải các vấn đề nghiêm trọng về chất lượng: khuyết thiếu (Missing values), định dạng dị thường (Format anomalies), sai lệch kiểu (Type mutations), trùng lặp (Duplicates), hoặc vi phạm ràng buộc toàn vẹn.

Hệ thống được nghiên cứu và phát triển nhằm giải quyết triệt để bài toán này, định vị thông qua **3 câu hỏi cốt lõi**:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 3 CÂU HỎI CỐT LÕI (CORE PRINCIPLES)                    │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. ĐANG LÀM GÌ?                                                                        │
│    Xây dựng một nền tảng Full-Stack cấp doanh nghiệp (Enterprise-Grade Data Quality    │
│    Platform) có khả năng tiếp nhận tập dữ liệu quy mô lớn, phân tích cấu trúc,         │
│    thực thi các bộ luật làm sạch đa tầng, lưu trữ phiên bản bất biến (Data Versioning), │
│    truy vết dòng chảy dữ liệu trên đồ thị (Data Lineage), và tích hợp Trợ lý AI       │
│    hỗ trợ phát hiện dị thường tự động.                                                 │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 2. CHO AI?                                                                             │
│    Dành cho các Kỹ sư Dữ liệu (Data Engineers), Chuyên viên Phân tích (Data Analysts), │
│    Quản trị viên Dữ liệu (Data Stewards) và các Tổ chức cần một quy trình kiểm chuẩn   │
│    dữ liệu nghiêm ngặt trước khi nạp vào Kho Dữ liệu (Data Warehouse) hoặc huấn luyện  │
│    các mô hình Trí tuệ Nhân tạo.                                                       │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 3. ĐỂ LÀM GÌ?                                                                          │
│    - Loại bỏ hiện tượng "Rác vào, Rác ra" (Garbage In, Garbage Out) trong phân tích.   │
│    - Xóa bỏ điểm nghẽn tràn bộ nhớ máy chủ (OOM) khi xử lý tệp dữ liệu hàng triệu dòng.│
│    - Minh bạch hóa lịch sử can thiệp dữ liệu bằng mật mã học Merkle DAG chống giả mạo. │
│    - Đảm bảo an toàn thông tin nhạy cảm qua mã hóa luồng chuẩn quân sự AES-256-GCM.    │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. THÁCH THỨC THỰC TIỄN TRONG QUẢN LÝ CHẤT LƯỢNG DỮ LIỆU

### 2.1. Hiện tượng "Garbage In, Garbage Out" (GIGO)
Dữ liệu sai lệch đưa vào các mô hình Machine Learning hoặc hệ thống báo cáo Business Intelligence (BI) sẽ dẫn đến các quyết định kinh doanh sai lầm nghiêm trọng. Nghiên cứu thực tế chỉ ra rằng các Data Scientist thường phải dành tới **60% - 80% thời gian** cho các tác vụ thủ công: lọc giá trị rỗng, chuẩn hóa kiểu ngày tháng, xử lý ngoại lai (outliers) và khử trùng lặp.

### 2.2. Điểm nghẽn quá tải bộ nhớ (Out-Of-Memory - OOM)
Hầu hết các framework web truyền thống tải toàn bộ tệp nạp vào bộ nhớ RAM trước khi xử lý. Khi người dùng tải lên một tệp CSV có kích thước vài trăm Megabytes chứa hàng triệu dòng, tiến trình Node.js/Python dễ dàng vượt ngưỡng cấp phát heap memory dẫn đến sập toàn bộ dịch vụ (Crash Server).

### 2.3. Thiếu khả năng truy vết và kiểm toán (Lack of Lineage & Auditability)
Khi dữ liệu bị làm sạch hoặc biến đổi, phần lớn các công cụ hiện nay ghi đè trực tiếp lên tệp nguồn hoặc lưu thành nhiều tệp rời rạc không có liên kết (`data_v1.csv`, `data_v2_final.csv`). Điều này dẫn đến sự mất mát dấu vết:
- Không biết dòng dữ liệu này do ai sửa, sửa bằng thuật toán nào, vào thời điểm nào.
- Khi phát hiện một bước làm sạch bị lỗi, không có cơ chế quay lui (Rollback) an toàn tại chỗ mà phải làm lại từ đầu.
- Thiếu bằng chứng kiểm toán độc lập để chứng minh dữ liệu không bị can thiệp trái phép trực tiếp vào database.

### 2.4. So sánh với các giải pháp hiện hành

| Tiêu chí so sánh | Microsoft Excel | OpenRefine | Great Expectations | Nền tảng của Dự án |
|---|---|---|---|---|
| **Giới hạn số dòng** | $1,048,576$ dòng | Bị giới hạn bởi RAM máy trạm | Không giới hạn (Code-first) | **Hàng triệu dòng (Streaming)** |
| **Tiêu thụ RAM máy chủ** | Ngốn toàn bộ RAM máy khách | Tải toàn bộ vào RAM | Phụ thuộc runtime Python | **Cố định $\le 50\text{MB}$ RAM** |
| **Giao diện người dùng** | Đồ họa trực quan bảng tính | Web cục bộ đơn người dùng | Không có UI (Chỉ cấu hình code) | **Virtual Grid Keyset Pagination** |
| **Cộng tác nhóm (Multi-tenant)** | Không hỗ trợ phân quyền | Đơn người dùng cục bộ | Không có tích hợp sẵn | **CASL ABAC đa không gian làm việc** |
| **Đồ thị Phả hệ (Lineage)** | Hoàn toàn không có | Lưu lịch sử biến đổi phẳng | Data Docs tĩnh | **Neo4j AuraDB DAG tương tác** |
| **Kiểm toán Mật mã học** | Không có | Không có | Checksum tệp đơn giản | **Chuỗi băm Merkle DAG SHA-256** |
| **Bảo mật đầu ra** | Đặt mật khẩu file zip thô | Xuất tệp không mã hóa | Lưu trữ raw tệp | **Mã hóa luồng AES-256-GCM PBKDF2** |

---

## 3. ĐỐI TƯỢNG SỬ DỤNG VÀ CHÂN DUNG NGHIỆP VỤ (PERSONAS)

Hệ thống được thiết kế phục vụ 4 nhóm đối tượng chính:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                USER PERSONAS MATRIX                              │
├──────────────────────┬──────────────────────┬────────────────────────────────────┤
│ Vai trò (Persona)    │ Nhiệm vụ trọng tâm   │ Nhu cầu sử dụng trên nền tảng      │
├──────────────────────┼──────────────────────┼────────────────────────────────────┤
│ 1. Data Engineer     │ Xây dựng Data        │ - Nạp dữ liệu Streaming tốc độ cao │
│                      │ Pipeline & Ingestion │ - Tự động suy luận kiểu Schema     │
│                      │                      │ - Giám sát tính toàn vẹn Merkle    │
├──────────────────────┼──────────────────────┼────────────────────────────────────┤
│ 2. Data Analyst      │ Khám phá & Làm sạch  │ - Lưới dữ liệu ảo cuộn mượt mà     │
│                      │ dữ liệu bảng         │ - Thử nghiệm luật Sandbox Preview  │
│                      │                      │ - Trợ lý AI gợi ý xử lý dị thường  │
├──────────────────────┼──────────────────────┼────────────────────────────────────┤
│ 3. Data Steward /    │ Kiểm toán tuân thủ & │ - Đồ thị truy vết nguồn gốc Neo4j  │
│    Auditor           │ Quản trị chất lượng  │ - Phân tích tác động lan truyền    │
│                      │                      │ - Xuất dữ liệu mã hóa AES-256-GCM  │
├──────────────────────┼──────────────────────┼────────────────────────────────────┤
│ 4. Workspace Admin   │ Quản lý nhân sự &    │ - Phân quyền hạt mịn CASL ABAC     │
│                      │ Phân chia dự án      │ - Quản lý không gian làm việc      │
│                      │                      │ - Giám sát và thu hồi phiên từ xa  │
└──────────────────────┴──────────────────────┴────────────────────────────────────┘
```

---

## 4. MỤC TIÊU HỆ THỐNG VÀ CÁC CHỈ SỐ ĐO LƯỜNG ĐỊNH LƯỢNG (QUANTITATIVE KPIS)

Hệ thống đặt ra và đã đạt được các chỉ tiêu định lượng khắt khe:

1. **Hiệu năng Bộ nhớ (Memory Safety):**
   - Mức tiêu thụ bộ nhớ RAM tối đa của tiến trình nạp tệp (Ingestion) và xuất tệp (Export) luôn duy trì **$\le 50\text{MB}$**, hoàn toàn không phụ thuộc vào kích thước tệp tải lên (đã kiểm chứng với tệp hàng trăm MB).
2. **Độ trễ Hiển thị Giao diện (Grid Latency):**
   - Tốc độ phản hồi của API phân trang dữ liệu lưới bảng ảo (Virtual Grid) đạt **$\le 10\text{ms}$** trên mỗi cụm 50 dòng nhờ giải pháp Keyset Cursor Pagination trên chỉ mục phức hợp MongoDB.
3. **Tính Toàn vẹn & Khả năng Kiểm toán (Integrity & Auditability):**
   - $100\%$ các lần áp dụng luật làm sạch đều được gắn mã băm Merkle Root $\text{SHA-256}$ và lưu vết trên cả 2 cơ sở dữ liệu: MongoDB (bản ghi phiên bản) và Neo4j (nút biến đổi phả hệ).
   - Phát hiện chính xác vị trí đứt gãy nếu có bất kỳ sự can thiệp dữ liệu trái phép nào xảy ra ngoài luồng ứng dụng.
4. **An toàn Kiểu Dữ liệu (Strict Type Safety):**
   - Đạt tiêu chuẩn **Zero Any tuyệt đối**: $0\%$ khai báo `any` trong toàn bộ mã nguồn ứng dụng, scripts và kiểm thử.
5. **Bảo mật & Phân quyền (Security & Compliance):**
   - Áp dụng mô hình **CASL ABAC**, triệt tiêu $100\%$ nguy cơ tấn công leo thang đặc quyền ngang (IDOR) giữa các Workspace.
   - Toàn bộ mật khẩu được băm bằng Argon2id; các tệp xuất dữ liệu nhạy cảm được mã hóa luồng bằng AES-256-GCM với khóa dẫn xuất PBKDF2 (100,000 vòng lặp).

---

## 5. CHIẾN LƯỢC PHÂN KỲ TRIỂN KHAI (STAGED ROLLOUT ROADMAP)

Hệ thống áp dụng triết lý kiến trúc **"Rock-Solid Core First, AI-Ready Always"**:

```
[ SPRINT B1 ] ──> [ SPRINT B2 ] ──> [ SPRINT B3 ] ──> [ SPRINT B4 ]
Nền tảng & ABAC     Streaming & Lưới    Merkle & Phả hệ     AI Engine Copilot
(Hoàn thành 100%)  (Hoàn thành 100%)  (Hoàn thành 100%)   (Kế hoạch chuẩn hóa)
```

- **Sprint B1 (Core Data Infrastructure & ABAC Security):** Thiết lập nền tảng NestJS 11, TypeScript Strict, MongoDB Atlas, hệ thống phiên làm việc tự động nhận diện thiết bị và ma trận phân quyền dựa trên thuộc tính CASL ABAC.
- **Sprint B2 (Streaming Data Pipeline & Virtual Grid Engine):** Hiện thực hóa cơ chế nạp luồng Busboy, phân trang Keyset Virtual Grid, bộ lọc thống kê cột Histogram 10 khoảng và Động cơ luật làm sạch Dry-run Sandbox.
- **Sprint B3 (Cryptographic Audit, Neo4j Lineage & Secure Export):** Xây dựng chuỗi băm mật mã học Merkle DAG, đồng bộ sự kiện Transactional Outbox sang đồ thị Neo4j AuraDB, và xuất dữ liệu mã hóa AES-256-GCM.
- **Sprint B4 (AI Copilot & Multi-layer Anomaly Detection):** Tích hợp Trợ lý Trí tuệ Nhân tạo Google Gemini, chuẩn hóa dữ liệu bán cấu trúc (Semi-structured Flattener) và cơ chế phát hiện dị thường đa tầng phục vụ gợi ý quy tắc làm sạch tự động.
