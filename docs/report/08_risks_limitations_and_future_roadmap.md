# BÁO CÁO 08: ĐÁNH GIÁ RỦI RO KỸ THUẬT, GIỚI HẠN HỆ THỐNG VÀ LỘ TRÌNH PHÁT TRIỂN
## HỆ THỐNG AI HỖ TRỢ PHÁT HIỆN VÀ XỬ LÝ VẤN ĐỀ CHẤT LƯỢNG DỮ LIỆU
### (Full-Stack Data Quality Management Platform with AI Assistance)

---

## 1. MA TRẬN RỦI RO KỸ THUẬT VÀ PHƯƠNG ÁN PHÒNG NGỪA (TECHNICAL RISK MATRIX)

Mọi giải pháp công nghệ đều đi kèm các đánh đổi (Trade-offs). Dưới đây là bảng phân tích toàn diện các rủi ro kỹ thuật chính trong hệ thống và phương án kiểm soát tương ứng:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               TECHNICAL RISK ASSESSMENT MATRIX                         │
├────────────────────┬──────────┬───────────┬────────────────────────────────────────────┤
│ Tên Rủi ro Kỹ thuật│ Khả năng │ Mức độ    │ Biện pháp Phòng ngừa & Khắc phục           │
│                    │ xảy ra   │ ảnh hưởng │ (Mitigation Strategies)                    │
├────────────────────┼──────────┼───────────┼────────────────────────────────────────────┤
│ 1. Độ trễ đồng bộ  │ Trung    │ Trung     │ - Tầng nhận Neo4j áp dụng Cypher MERGE     │
│    Outbox Pattern  │ bình     │ bình      │   đảm bảo tính lũy kế (Idempotency).       │
│    (Inconsistency) │          │           │ - Giao diện Web hiển thị trạng thái Syncing│
│                    │          │           │   kèm cơ chế Polling ngắn hạn.             │
├────────────────────┼──────────┼───────────┼────────────────────────────────────────────┤
│ 2. Nghẽn CPU khi   │ Thấp     │ Cao       │ - Tận dụng Node.js Native Crypto C++ Engine│
│    tính Merkle     │          │           │ - Tính Checksum trực tiếp trên luồng       │
│    Hash hàng loạt  │          │           │   (on-the-fly) song song với thao tác nạp. │
├────────────────────┼──────────┼───────────┼────────────────────────────────────────────┤
│ 3. Vượt hạn ngạch  │ Trung    │ Trung     │ - Kiến trúc 3 tầng: Tầng 1 và Tầng 2 xử lý │
│    và độ trễ của   │ bình     │ bình      │   cục bộ, chỉ gọi Gemini khi cần ngữ nghĩa.│
│    Cloud AI API    │          │           │ - Bộ nhớ đệm Profile Cache tránh gọi trùng.│
│                    │          │           │ - Token Bucket Rate Limiter + Fallback.    │
├────────────────────┼──────────┼───────────┼────────────────────────────────────────────┤
│ 4. Tấn công dò     │ Cao      │ Nghiêm    │ - Băm mật khẩu bằng Argon2id (Memory-hard) │
│    mật khẩu & DoS  │          │ trọng     │ - ThrottlerGuard giới hạn 10 req/phút.     │
│                    │          │           │ - Tự động phát hiện thiết bị và IP thực.   │
├────────────────────┼──────────┼───────────┼────────────────────────────────────────────┤
│ 5. Rò rỉ dữ liệu   │ Thấp     │ Nghiêm    │ - Mã hóa luồng chuẩn quân sự AES-256-GCM.  │
│    khi truyền tệp  │          │ trọng     │ - Dẫn xuất khóa PBKDF2 (100,000 vòng lặp). │
│                    │          │           │ - Presigned URL tự động hết hạn sau 15p.   │
└────────────────────┴──────────┴───────────┴────────────────────────────────────────────┘
```

---

## 2. GIỚI HẠN VÀ ĐIỂM NGHẼN KỸ THUẬT HIỆN TẠI (CURRENT SYSTEM LIMITATIONS)

Nhìn nhận một cách khách quan, hệ thống hiện tại tồn tại các giới hạn công nghệ cần lưu ý:

### 2.1. Giới hạn Quy mô Cụm MongoDB Đơn lẻ (Single-Cluster Limit)
- Hiện tại, tầng lưu trữ `dataset_records` được triển khai trên cụm MongoDB Atlas Replica Set (Primary - Secondary), chưa kích hoạt tính năng **Sharding phân tán**.
- *Hệ quả:* Khi một tập dữ liệu vượt quá $10\text{ triệu dòng}$ (dung lượng BSON vượt quá $10\text{GB}$ cho một bảng), các câu truy vấn Keyset Pagination vẫn duy trì được tốc độ nhanh nhờ Index, nhưng các tác vụ tổng hợp thống kê phân phối toàn bảng (`$facet` tính Histogram) sẽ tiêu tốn đáng kể tài nguyên CPU và RAM của máy chủ cơ sở dữ liệu.

### 2.2. Giới hạn của Bộ Chuẩn hóa Dữ liệu Bán cấu trúc (Dynamic Flattener)
- Để bảo vệ giao diện lưới bảng ảo khỏi hiện tượng bùng nổ cột (Field Explosion), bộ chuyển đổi bán cấu trúc thiết lập giới hạn cứng:
  - Độ sâu lồng nhau tối đa: **3 cấp**.
  - Số lượng cột phẳng tối đa: **100 cột**.
- *Hạn chế:* Các tệp JSON có cấu trúc cây lồng sâu hơn 3 cấp hoặc chứa hàng trăm thuộc tính động sẽ bị cắt xén hoặc gom vào trường chuỗi `_unstructured_extra`, làm giảm khả năng phân tích chi tiết của các thuật toán số học ở Tầng 2.

### 2.3. Sự Phụ thuộc vào Mạng Đám mây (Cloud Network Dependency)
- Hệ thống áp dụng mô hình Polyglot Persistence đám mây: Neo4j AuraDB đặt tại vùng hạ tầng đám mây công cộng và Cloudflare R2 Object Storage.
- *Hạn chế:* Nếu môi trường triển khai bị mất kết nối Internet quốc tế hoặc gặp sự cố cáp quang biển, thao tác đồng bộ Outbox sang Neo4j và tải snapshot R2 sẽ bị đình trệ (mặc dù MongoDB cục bộ vẫn lưu trữ được dữ liệu an toàn).

---

## 3. CÁC ĐIỂM YẾU VỀ MẶT THIẾT KẾ CẦN CẢI THIỆN (TECHNICAL DEBT)

1. **Hiện tượng Phình to Bảng Outbox (Outbox Table Bloat):**
   - Collection `outbox_events` hiện lưu trữ toàn bộ các sự kiện lịch sử để phục vụ kiểm toán. Trong môi trường vận hành sản xuất lâu dài, bảng này sẽ tăng trưởng liên tục. Cần bổ sung cơ chế tự động chuyển lưu trữ (Archiving) hoặc gắn TTL Index để dọn dẹp các sự kiện đã có trạng thái `PROCESSED` quá 30 ngày.
2. **Cơ chế Giao tiếp Máy khách còn phụ thuộc HTTP Polling:**
   - Hiện tại, tiến trình nạp tệp lớn và tiến trình kiểm tra trạng thái đồng bộ phả hệ vẫn dựa vào các lệnh gọi HTTP tuần tự từ Client (`GET /health`, `GET /lineage`). Hệ thống chưa tích hợp WebSocket Gateway để truyền tải tiến độ (Progress Stream) theo thời gian thực (Real-time).

---

## 4. LỘ TRÌNH PHÁT TRIỂN TIẾP THEO (FUTURE ROADMAP)

Dự án được định hướng phát triển mở rộng theo 4 giai đoạn chiến lược:

```
[ GIAI ĐOẠN 1 ] ──────> [ GIAI ĐOẠN 2 ] ──────> [ GIAI ĐOẠN 3 ] ──────> [ GIAI ĐOẠN 4 ]
Hoàn thiện AI           WebSocket Real-time     MongoDB Sharding        Enterprise Connectors
(Google Gemini API)     (Live Progress Stream)  (Quy mô 100M+ dòng)     (Kafka, Snowflake)
```

### Giai đoạn 1: Hiện thực hóa Toàn diện Sprint B4 (Google Gemini AI Engine)
- Tích hợp chính thức Google Gemini API (`@google/genai` hoặc `@google/generative-ai`) theo đúng đặc tả thiết kế tại Báo cáo 07.
- Hoàn thiện bộ kiểm thử tự động với Mock AI Responses để đánh giá độ chính xác của các luật do AI đề xuất.

### Giai đoạn 2: Tích hợp WebSocket Gateway (NestJS Gateway / Socket.io)
- Nâng cấp kênh truyền thông hai chiều giữa máy khách và máy chủ:
  - Hiển thị thanh tiến trình nạp tệp (Upload Progress Bar: $0\% \rightarrow 100\%$) theo thời gian thực.
  - Tự động đẩy sự kiện cập nhật đồ thị phả hệ (`LINEAGE_UPDATED`) về giao diện Web ngay khi Outbox Dispatcher hoàn thành ghi nhận trên Neo4j.

### Giai đoạn 3: Phân vùng Dữ liệu Cụm Lớn (MongoDB Sharding)
- Cấu hình Shard Key phức hợp `{ workspace_id: 1, dataset_id: 1, _id: 1 }` trên collection `dataset_records`.
- Cho phép mở rộng ngang (Horizontal Scaling) cụm cơ sở dữ liệu lên hàng chục máy chủ lưu trữ, đáp ứng các tập dữ liệu Big Data vượt ngưỡng $100\text{ triệu dòng}$.

### Giai đoạn 4: Mở rộng Cổng Kết nối Doanh nghiệp (Enterprise Data Connectors)
- Xây dựng các Connector đọc luồng dữ liệu trực tiếp từ các kho dữ liệu hiện đại:
  - **Relational Databases:** PostgreSQL, MySQL, Oracle.
  - **Cloud Data Warehouses:** Snowflake, Google BigQuery, AWS Redshift.
  - **Event Streams:** Apache Kafka, RabbitMQ Event Bus.
- Tự động hóa quy trình kiểm chuẩn chất lượng dữ liệu định kỳ (Scheduled Data Quality Pipelines) phục vụ báo cáo quản trị tự động.
