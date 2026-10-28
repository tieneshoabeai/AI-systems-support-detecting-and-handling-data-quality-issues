# BÁO CÁO 05: CƠ CHẾ KỸ THUẬT CỐT LÕI, MẬT MÃ HỌC VÀ TOÀN VẸN DỮ LIỆU
## HỆ THỐNG AI HỖ TRỢ PHÁT HIỆN VÀ XỬ LÝ VẤN ĐỀ CHẤT LƯỢNG DỮ LIỆU
### (Full-Stack Data Quality Management Platform with AI Assistance)

---

## 1. KIẾN TRÚC XỬ LÝ DỮ LIỆU DẠNG LUỒNG VÀ AN TOÀN BỘ NHỚ (STREAMING & MEMORY SAFETY)

Một trong những thách thức kỹ thuật lớn nhất của các hệ thống xử lý dữ liệu bảng là nguy cơ tràn bộ nhớ máy chủ (Out-Of-Memory - OOM). Hệ thống loại bỏ hoàn toàn phương pháp tải tệp vào bộ đệm RAM (In-Memory Buffer), thay vào đó triển khai kiến trúc **Node.js Native Stream Pipeline** xuyên suốt từ khâu nạp dữ liệu (Ingestion) đến khâu xuất dữ liệu (Export).

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        STREAMING INGESTION PIPELINE (RAM <= 50MB)                      │
│                                                                                        │
│   HTTP Multipart Request Stream (Client)                                               │
│                         │                                                              │
│                         ▼ (Busboy Multipart Stream Parser)                             │
│               [ Readable File Stream ]                                                 │
│                         │                                                              │
│        ┌────────────────┴──────────────────────────┐                                   │
│        ▼ (PassThrough Stream A)                    ▼ (PassThrough Stream B)            │
│  ┌──────────────────────────────┐            ┌──────────────────────────────┐          │
│  │    Cloudflare R2 Uploader    │            │    On-the-fly CSV Parser     │          │
│  │   (@aws-sdk/lib-storage)     │            │         (csv-parser)         │          │
│  │  - Upload tệp thô lên Cloud  │            │  - Suy luận Schema & kiểu    │          │
│  │  - Tính Checksum SHA-256     │            │  - Đếm tỷ lệ Missing Count   │          │
│  │  - Zero Egress Cost          │            │  - Batch Insert 1,000 rows   │          │
│  └──────────────────────────────┘            └──────────────┬───────────────┘          │
│                                                             ▼                          │
│                                              ┌──────────────────────────────┐          │
│                                              │      MongoDB Atlas CSDL      │          │
│                                              │      (dataset_records)       │          │
│                                              └──────────────────────────────┘          │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1.1. Luồng Nạp Dữ liệu Bất đồng bộ (Streaming Ingestion)
- Khi máy khách tải lên tệp CSV/Excel dung lượng hàng trăm Megabytes:
  1. Thư viện `busboy` bóc tách luồng nhị phân ngay khi các gói tin TCP đầu tiên cập bến máy chủ mà không đợi toàn bộ tệp được tải xong.
  2. Dữ liệu được rẽ nhánh thành 2 luồng song song qua `stream.PassThrough`:
     - *Nhánh A:* Truyền trực tiếp lên kho đối tượng Cloudflare R2 bằng `@aws-sdk/lib-storage` với cơ chế Multipart Upload phân đoạn 5MB. Đồng thời luồng này tính toán mã băm SHA-256 của tệp gốc (on-the-fly checksum).
     - *Nhánh B:* Truyền vào động cơ phân tích cú pháp `csv-parser`. Tại đây, hệ thống suy luận kiểu dữ liệu (`string`, `number`, `boolean`, `date`), tính toán số ô rỗng (`missing_count`) và gom nhóm thành từng lô 1,000 bản ghi để thực thi `insertMany` vào collection `dataset_records`.
- **Kết quả đo lường định lượng:** Mức tiêu thụ bộ nhớ RAM máy chủ duy trì ổn định ở mức **$\le 50\text{MB}$**, loại bỏ $100\%$ nguy cơ sập dịch vụ do OOM.

### 1.2. Luồng Xuất Dữ liệu Trực tiếp (Streaming Export)
- Khi người dùng xuất dữ liệu sạch (`GET /datasets/:id/export/csv`):
  1. Mở một `Mongoose Cursor` duyệt tuần tự từng tài liệu từ cơ sở dữ liệu MongoDB mà không nạp toàn bộ danh sách bản ghi vào mảng JavaScript.
  2. Dữ liệu từ Cursor được pipe trực tiếp qua bộ định dạng `fast-csv`.
  3. Dữ liệu định dạng được truyền thẳng vào đối tượng `express.Response` với cơ chế HTTP Chunked Transfer Encoding.
- Bộ nhớ RAM tiêu thụ trong toàn bộ quá trình xuất tệp luôn duy trì **$\le 20\text{MB}$**.

---

## 2. KIỂM TOÁN MẬT MÃ HỌC MERKLE DAG (TAMPER-EVIDENT AUDIT TRAIL)

Để biến lịch sử làm sạch dữ liệu thành một sổ cái kiểm toán bất biến (Tamper-evident Audit Ledger), hệ thống áp dụng cấu trúc băm **Merkle Directed Acyclic Graph (Merkle DAG)** tương tự cơ chế của Git và Blockchain.

```
                  ┌────────────────────────────────────────┐
                  │          PHIÊN BẢN GỐC (v1)            │
                  │ parent_hash = '0000...0000' (64 zeros) │
                  │ rules_hash  = '0000...0000' (Khởi tạo) │
                  │ data_checksum = SHA256(Raw Data)       │
                  │ version_hash = SHA256(v1 Root)         │
                  └───────────────────┬────────────────────┘
                                      │
                                      ▼ [ Áp dụng Luật làm sạch Lô 1 ]
                  ┌────────────────────────────────────────┐
                  │          PHIÊN BẢN MỚI (v2)            │
                  │ parent_hash = version_hash(v1)         │
                  │ rules_hash  = SHA256(Rule_1 + Rule_2)  │
                  │ data_checksum = SHA256(Clean Data v2)  │
                  │ version_hash = SHA256(v2 Root)         │
                  └───────────────────┬────────────────────┘
                                      │
                                      ▼ [ Áp dụng Luật làm sạch Lô 2 ]
                  ┌────────────────────────────────────────┐
                  │          PHIÊN BẢN MỚI (v3)            │
                  │ parent_hash = version_hash(v2)         │
                  │ rules_hash  = SHA256(Rule_3)           │
                  │ data_checksum = SHA256(Clean Data v3)  │
                  │ version_hash = SHA256(v3 Root)         │
                  └────────────────────────────────────────┘
```

### 2.1. Công thức Băm Mật mã học 3 Thành phần
Tại mỗi cột mốc commit phiên bản dữ liệu (`dataset_versions`), mã băm gốc của phiên bản `version_hash` được tính toán bằng hàm băm SHA-256 từ 3 thành phần cấu thành:
$$\text{version\_hash} = \text{SHA-256}(\text{parent\_hash} + \text{rules\_hash} + \text{data\_checksum})$$

Trong đó:
1. `parent_hash`: Mã băm `version_hash` của phiên bản cha liền trước (phiên bản 1 sử dụng chuỗi 64 ký tự `0`).
2. `rules_hash`: Mã băm đại diện cho danh sách các quy tắc làm sạch và tham số cấu hình đã được thực thi để tạo ra phiên bản này:
   $$\text{rules\_hash} = \text{SHA-256}\left(\sum_{i=1}^{k} \text{SHA-256}(\text{rule}_i.\text{category} + \text{rule}_i.\text{action} + \text{JSON.stringify}(\text{rule}_i.\text{parameters}))\right)$$
3. `data_checksum`: Mã băm SHA-256 của tệp snapshot dữ liệu sạch tương ứng được lưu trên Cloudflare R2.

### 2.2. Cơ chế Phát hiện Gian lận và Can thiệp Trái phép
- Khi kích hoạt API đối soát toàn vẹn (`/lineage/verify-integrity/:dataset_id`), hệ thống duyệt dọc theo chuỗi mắt xích từ phiên bản đầu tiên đến phiên bản hiện tại:
  - Tính toán lại toàn bộ `version_hash` tại từng bước và so sánh với giá trị đã lưu trong CSDL.
  - Nếu bất kỳ ai can thiệp trực tiếp vào database để sửa lén một giá trị ô dữ liệu, mã băm `data_checksum` sẽ thay đổi $\rightarrow$ `version_hash` bị sai lệch $\rightarrow$ Toàn bộ chuỗi băm phía sau bị đứt gãy.
  - Hệ thống sẽ trả về cảnh báo vi phạm kèm chính xác mã phiên bản và vị trí xảy ra sai lệch dữ liệu.

---

## 3. BẢO MẬT ĐỊNH DANH VÀ BĂM MẬT KHẨU (IDENTITY & PASSWORD SECURITY)

### 3.1. Thuật toán Băm Mật khẩu Argon2id
- **Lý do lựa chọn:** Dự án sử dụng **Argon2id** (phiên bản chiến thắng cuộc thi Password Hashing Competition - PHC), vượt trội hoàn toàn so với bcrypt, PBKDF2 hay scrypt.
- **Đặc tính kỹ thuật:**
  - Là thuật toán **Memory-hard**: Yêu cầu dung lượng bộ nhớ lớn trong quá trình tính toán mã băm, làm tê liệt khả năng tấn công vét cạn (Brute-Force) bằng phần cứng chuyên dụng như GPU hoặc chip đào ASIC.
  - Kết hợp cơ chế chống tấn công kênh bên (Side-channel attacks của Argon2d) và tấn công đánh đổi thời gian/bộ nhớ (Trade-off attacks của Argon2i).
- **Cấu hình bảo mật:** `memoryCost: 65536` (64MB RAM), `timeCost: 3` (3 vòng lặp), `parallelism: 4` luồng tính toán.

### 3.2. Cơ chế Nhận diện Thiết bị Tự động (Auto Device Detection)
- Khi người dùng đăng nhập, hệ thống phân tích tiêu đề `User-Agent` bằng module `device-detector.util.ts`:
  - Bóc tách Hệ điều hành (Linux, Windows, macOS, Android, iOS).
  - Bóc tách Trình duyệt / Ứng dụng khách (Chrome, Edge, Firefox, Safari, Postman).
  - Tự động gán nhãn thân thiện (ví dụ: `"Chrome on macOS"`, `"Safari on iPhone"`) và ghi nhận địa chỉ IP thực từ `X-Forwarded-For`.
- Cho phép người dùng theo dõi các phiên làm việc bất thường và kích hoạt API thu hồi phiên làm việc từ xa (`DELETE /auth/sessions/:id`).

---

## 4. MÃ HÓA LUỒNG DỮ LIỆU ĐẦU RA AES-256-GCM (SECURE EXPORT PIPELINE)

Để bảo vệ các tập dữ liệu nhạy cảm (thông tin tài chính, y tế, thông tin định danh cá nhân PII) khi truyền qua Internet hoặc chia sẻ cho đối tác, hệ thống cung cấp tính năng **Xuất dữ liệu mã hóa luồng bằng mật khẩu bảo vệ** (`POST /datasets/:id/export/secure`).

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                      AES-256-GCM STREAMING ENCRYPTION ARCHITECTURE                     │
│                                                                                        │
│   Passphrase (Client Input)                                                            │
│       │                                                                                │
│       ▼ + Salt ngẫu nhiên 16 bytes (crypto.randomBytes)                                │
│   [ Dẫn xuất khóa PBKDF2 ] (100,000 vòng lặp HMAC-SHA256)                              │
│       │                                                                                │
│       ▼ 256-bit Key                                                                    │
│   [ Cipheriv ('aes-256-gcm') ] <── Vector khởi tạo ngẫu nhiên IV 12 bytes             │
│       │                                                                                │
│       │  Dữ liệu dòng CSV (Mongoose Cursor Stream)                                     │
│       │        │                                                                       │
│       ▼        ▼                                                                       │
│   ┌────────────────────────────────────────────────────────┐                           │
│   │   ĐÓNG GÓI CẤU TRÚC NHỊ PHÂN AN TOÀN CHO TỆP (.enc)   │                           │
│   ├─────────────────┬──────────────────┬───────────────────┤                           │
│   │ Header 28 bytes │ Body (Dữ liệu)   │ Footer 16 bytes   │                           │
│   ├─────────────────┼──────────────────┼───────────────────┤                           │
│   │ [16 Bytes Salt] │ [Bản mã Cipher]  │ [16 Bytes Tag]    │                           │
│   │ [12 Bytes IV]   │ (AES-256-GCM)    │ (Authentication)  │                           │
│   └─────────────────┴──────────────────┴───────────────────┘                           │
│                         │                                                              │
│                         ▼ (Pipe song song)                                             │
│       ┌─────────────────┴──────────────────┐                                           │
│       ▼                                    ▼                                           │
│  Lưu trữ Cloudflare R2             HTTP Response Stream                                │
│  (Lưu vết kiểm toán)               (Tải tệp về máy khách)                              │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.1. Quy trình Dẫn xuất Khóa PBKDF2
1. Tạo một chuỗi muối bảo mật ngẫu nhiên 16 bytes (`Salt`) bằng hàm `crypto.randomBytes(16)`.
2. Tạo một vector khởi tạo ngẫu nhiên 12 bytes (`IV`) theo chuẩn Galois/Counter Mode (GCM).
3. Sử dụng thuật toán dẫn xuất khóa chuẩn quốc tế **PBKDF2 (Password-Based Key Derivation Function 2)** với:
   - Thuật toán băm: `HMAC-SHA256`
   - Số vòng lặp băm kéo dài (Key Stretching): **$100,000$ vòng lặp**.
   - Độ dài khóa sinh ra: **$32$ bytes ($256$ bits)**.

### 4.2. Cơ chế Mã hóa Xác thực Authenticated Encryption (AEAD)
- **AES-256-GCM** là chuẩn mã hóa đối xứng cấp quân sự cung cấp cả 2 tính năng đồng thời:
  - *Tính bảo mật (Confidentiality):* Bản mã hoàn toàn không thể đọc được nếu không có khóa.
  - *Tính toàn vẹn (Integrity & Authenticity):* Tự động sinh một thẻ xác thực **Authentication Tag (16 bytes)** ở cuối luồng mã hóa.
- Nếu tệp mã hóa bị bất kỳ ai chỉnh sửa dù chỉ 1 bit trong quá trình truyền tải, thuật toán giải mã sẽ lập tức phát hiện thẻ Tag không khớp và từ chối mở tệp, ngăn ngừa hoàn toàn các cuộc tấn công thay đổi bản mã (Ciphertext Tampering).

### 4.3. Cấu trúc Đóng gói Tệp Nhị phân Độc lập (`.enc`)
Tệp xuất khẩu mã hóa được đóng gói theo định dạng nhị phân độc lập, cho phép người dùng giải mã bằng bất kỳ ngôn ngữ nào (Node.js, Python, OpenSSL) chỉ với mật khẩu ban đầu:
- **Bytes 0 – 15 (16 bytes):** Muối bảo mật `Salt` (phục vụ tái tạo khóa PBKDF2).
- **Bytes 16 – 27 (12 bytes):** Vector khởi tạo `IV`.
- **Bytes 28 – $(N - 16)$:** Toàn bộ nội dung bản mã của tệp CSV.
- **16 bytes cuối cùng:** Thẻ xác thực `Authentication Tag`.

---

## 5. MÔ HÌNH ĐỒNG BỘ ĐA CSDL QUA TRANSACTIONAL OUTBOX PATTERN

Để đảm bảo tính nhất quán dữ liệu giữa CSDL Document (MongoDB) và CSDL Đồ thị (Neo4j AuraDB), hệ thống không gọi trực tiếp cả 2 database trong luồng request (tránh lỗi Dual-Write). Thay vào đó, áp dụng **Transactional Outbox Pattern**:

1. **Giai đoạn Giao dịch Cục bộ (Local ACID Transaction):**
   Khi người dùng thực thi một quy tắc làm sạch, trong cùng một MongoDB ClientSession:
   - Cập nhật dữ liệu vào `dataset_records`.
   - Tạo phiên bản mới trong `dataset_versions`.
   - Ghi một bản ghi sự kiện vào collection `outbox_events` với trạng thái `PENDING`.
   - Commit transaction. Bước này đảm bảo: Nếu ứng dụng sập, cả dữ liệu và sự kiện đều không được lưu; nếu thành công, cả hai đều được lưu chắc chắn.
2. **Giai đoạn Xử lý Bất đồng bộ (Outbox Polling Dispatcher):**
   - Tiến trình nền (Worker) quét các sự kiện `PENDING` theo chỉ mục `{ status: 1, retry_count: 1, created_at: 1 }`.
   - Thực thi câu lệnh Cypher lũy kết (`MERGE`) đẩy node và edge phả hệ lên **Neo4j AuraDB**.
   - Cập nhật trạng thái sự kiện thành `PROCESSED`.
   - Nếu mạng Neo4j gặp sự cố, worker kích hoạt thuật toán Exponential Backoff và thử lại ở chu kỳ tiếp theo, đảm bảo tính toàn vẹn phân tán đạt chuẩn **At-Least-Once Delivery**.
