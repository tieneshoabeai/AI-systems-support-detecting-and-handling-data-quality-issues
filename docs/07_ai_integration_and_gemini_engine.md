# BÁO CÁO 07: THIẾT KẾ PHÂN HỆ TRÍ TUỆ NHÂN TẠO GOOGLE GEMINI VÀ PHÁT HIỆN DỊ THƯỜNG
## HỆ THỐNG AI HỖ TRỢ PHÁT HIỆN VÀ XỬ LÝ VẤN ĐỀ CHẤT LƯỢNG DỮ LIỆU
### (Full-Stack Data Quality Management Platform with AI Assistance)

---

## 1. ĐỊNH VỊ VÀ 3 NGUYÊN TẮC BẤT BIẾN CỦA AI TRONG HỆ THỐNG

Trong nền tảng Full-stack Quản lý Chất lượng Dữ liệu, Trí tuệ Nhân tạo không phải là toàn bộ hệ thống mà đóng vai trò là một **Tiểu hệ thống Trợ lý Thông minh (AI Copilot / Assistant Subsystem)** hỗ trợ chuyên viên phân tích:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   HỆ THỐNG FULL-STACK CORE PLATFORM                    │
│  (Quản trị User, Workspace, Streaming Ingestion, Data Versioning,      │
│   Merkle Hash Audit, Data Lineage Neo4j, Virtual Grid, Export Pipeline) │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ Kích hoạt khi cần phân tích chuyên sâu
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     TIỂU HỆ THỐNG AI (AI SUBSYSTEM)                     │
│  (Chuẩn hóa Semi-structured, Lọc cú pháp, Học máy phân phối & LLM)     │
└────────────────────────────────────────────────────────────────────────┘
```

### 3 Nguyên tắc Bất biến khi Tích hợp AI:
1. **Nguyên tắc "Con người nắm quyền kiểm soát" (Human-in-the-loop):**
   AI tuyệt đối **không có quyền tự ý sửa đổi hoặc ghi đè** dữ liệu gốc trong cơ sở dữ liệu. AI chỉ đóng vai trò chẩn đoán dị thường và đề xuất quy tắc làm sạch (Prescriptive Advisory). Quyết định kích hoạt và áp dụng luật làm sạch luôn thuộc về người dùng (Data Analyst).
2. **Nguyên tắc "Tách biệt tính toán và suy luận":**
   Các phép toán số học chính xác (tính tổng, trung bình, độ lệch chuẩn, phân vị, đếm số lượng ô rỗng) được giao hoàn toàn cho thuật toán xác định và Machine Learning cục bộ. Mô hình ngôn ngữ lớn (LLM) chỉ được sử dụng cho các tác vụ suy luận ngữ nghĩa, phát hiện mâu thuẫn bối cảnh và diễn giải ngôn ngữ tự nhiên.
3. **Nguyên tắc "Bảo mật dữ liệu tuyệt đối":**
   Hệ thống không bao giờ gửi toàn bộ tệp dữ liệu thô lên các mô hình AI đám mây (Cloud AI APIs). Chỉ siêu dữ liệu thống kê tổng hợp (Data Profile) và một lượng nhỏ bản ghi lỗi đại diện đã được **ẩn danh hóa thông tin cá nhân (PII Masking)** mới được chuyển đến mô hình AI.

---

## 2. BỘ CHUẨN HÓA DỮ LIỆU BÁN CẤU TRÚC (SEMI-STRUCTURED DATA FLATTENER)

Hệ thống tiếp nhận cả hai nguồn dữ liệu: **Dữ liệu có cấu trúc** (Structured: CSV, Excel) và **Dữ liệu bán cấu trúc** (Semi-structured: JSON payloads, NoSQL documents).

### 2.1. Thách thức Kỹ thuật của Dữ liệu Bán cấu trúc
- Cấu trúc phân cấp lồng nhau (Nested Objects, Arrays) không thể đưa trực tiếp vào các mô hình số học kiểm định chất lượng (như Isolation Forest, Z-score).
- Hiện tượng **Trôi dạt cấu trúc (Schema Drift):** Các bản ghi JSON có thể có số lượng trường khác nhau, thiếu trường (Missing Key), hoặc một trường bị đột biến kiểu dữ liệu giữa các dòng (Type Mutation).

### 2.2. Cơ chế Giải quyết: Normalizer & Dynamic Flattener
Trước khi đưa vào quy trình phân tích chất lượng AI, dữ liệu bán cấu trúc phải đi qua bộ chuyển đổi:
1. **Suy diễn Schema hợp nhất (Union Schema Discovery):** Quét mẫu dữ liệu để tổng hợp toàn bộ các trường thuộc tính khả dĩ của tập dữ liệu.
2. **Làm phẳng theo quy ước Dot-notation:** Chuyển đổi đối tượng lồng nhau `{ "customer": { "age": 25 } }` thành trường phẳng `customer.age`.
3. **Chống bùng nổ số lượng trường (Anti-Field Explosion):** Thiết lập giới hạn cứng:
   - **Độ sâu lồng nhau tối đa (Max Nesting Depth) = 3 cấp**.
   - **Số lượng cột phẳng tối đa = 100 cột**. Các trường vượt ngưỡng sẽ được gom vào trường tổng hợp `_unstructured_extra` dạng JSON String.

---

## 3. KIẾN TRÚC PHÁT HIỆN DỊ THƯỜNG ĐA TẦNG (MULTI-LAYER ANOMALY DETECTION)

Quy trình phát hiện dị thường dữ liệu được tổ chức thành **3 tầng lọc tuần tự**, từ chi phí thấp đến chi phí cao:

```
                          [ DỮ LIỆU ĐẦU VÀO ]
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ TẦNG 1: KIỂM ĐỊNH CÚ PHÁP XÁC ĐỊNH (HEURISTIC & SYNTAX CHECK)       │
│  - Phát hiện giá trị NULL / Empty String / Whitespace thừa           │
│  - Kiểm tra đột biến kiểu dữ liệu (Type Mutation via Regex)         │
│  - Khử trùng lặp bản ghi hoàn toàn (Exact Duplicates)               │
│  - Chi phí tính toán: O(N) - Tốc độ tức thời                        │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │ (Các trường dữ liệu số & phân phối)
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ TẦNG 2: MÁY HỌC THỐNG KÊ KHÔNG GIÁM SÁT (UNSUPERVISED ML ENGINE)    │
│  - Phát hiện ngoại lai số học: Z-Score (|Z| > 3.0) & IQR Rule       │
│  - Thuật toán Isolation Forest: Cô lập điểm dị biệt đa chiều       │
│  - Phân tích phân phối Histogram 10 khoảng tự động                  │
│  - Chi phí tính toán: Trung bình (Xử lý hoàn toàn trong máy chủ)    │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │ (Dữ liệu Profile + Mẫu dị thường PII Masked)
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ TẦNG 3: TRÍ TUỆ NGỮ NGHĨA GOOGLE GEMINI (SEMANTIC LLM INTELLIGENCE) │
│  - Phát hiện mâu thuẫn ngữ nghĩa (ví dụ: Tuổi = 5, Nghề = "Bác sĩ") │
│  - Phát hiện bất hợp lý địa lý (Mã bưu chính không khớp Tỉnh/Thành) │
│  - Tự động sinh mã quy tắc làm sạch tương thích CleanRules Schema   │
│  - Diễn giải nguyên nhân lỗi bằng ngôn ngữ tự nhiên tiếng Việt      │
└─────────────────────────────────────────────────────────────────────┘
```

### Bản chất của Tầng 2: Máy học Không giám sát
Thuật toán máy học Tầng 2 (như Isolation Forest) không cần gán nhãn dữ liệu trước. Thuật toán tự thích ứng với phân phối thực tế của từng cột dữ liệu:
- Nhận diện các điểm dữ liệu cô lập nhanh hơn các điểm bình thường trong không gian phân chia ngẫu nhiên.
- Tự động phát hiện các điểm ngoại lai tinh vi mà lập trình viên không thể viết hết bằng các câu lệnh `if/else` cố định.

---

## 4. KỸ THUẬT PROMPT ENGINEERING VÀ BỘ LỌC AN TOÀN PII

### 4.1. Bộ Lọc Làm mờ Dữ liệu Nhạy cảm (PII Masking Layer)
Trước khi bất kỳ dòng dữ liệu mẫu nào được đưa vào Prompt của Google Gemini, hệ thống tự động quét và làm mờ các trường nhạy cảm thông qua `mask-pii.util.ts`:
- **Email:** `nguyenvana@gmail.com` $\rightarrow$ `n***a@gmail.com`
- **Số điện thoại:** `0912345678` $\rightarrow$ `091****678`
- **Số Căn cước / CMND:** `079199001234` $\rightarrow$ `079******1234`
- **Thẻ tín dụng:** `4111222233334444` $\rightarrow$ `4111-****-****-4444`

### 4.2. Hợp đồng Dữ liệu Nghiêm ngặt (Strict JSON Contracts) & Chống Ảo giác
Để ngăn chặn hiện tượng mô hình AI sinh ra các quy tắc làm sạch bịa đặt hoặc sai cú pháp (AI Hallucination):
1. **Ép buộc định dạng phản hồi JSON:** Sử dụng tính năng Structured Outputs của Google Gemini API (`responseMimeType: "application/json"`).
2. **Thẩm định Schema tức thời bằng Zod:** Phản hồi từ Gemini bắt buộc phải khớp chính xác với `AiSuggestionSchema`. Nếu có trường tham số bị sai kiểu hoặc hành động (`action`) không nằm trong danh mục cho phép của `CleanRulesController`, hệ thống sẽ loại bỏ gợi ý đó ngay lập tức.

```typescript
// Cấu trúc hợp đồng dữ liệu chuẩn Zod Schema cho phản hồi từ AI:
export const AiSuggestionSchema = z.object({
  anomaly_type: z.enum(['semantic_conflict', 'format_irregularity', 'unusual_distribution']),
  column_name: z.string(),
  description: z.string().describe('Giải thích lý do dị thường bằng tiếng Việt'),
  confidence_score: z.number().min(0).max(1),
  recommended_rule: z.object({
    category: z.enum(['null_handling', 'standardization', 'deduplication', 'regex']),
    action: z.string(),
    parameters: z.record(z.unknown()),
  }),
});
```

---

## 5. QUẢN LÝ LƯU LƯỢNG, BỘ NHỚ ĐỆM VÀ PHỤC HỒI LỖI (RATE LIMITING & FALLBACK)

1. **Bộ nhớ đệm Kết quả Phân tích (Profile Cache):**
   Hệ thống tính toán mã băm SHA-256 trên bản tóm tắt phân phối dữ liệu (Data Profile Hash). Nếu người dùng yêu cầu phân tích một tập dữ liệu có cùng đặc trưng phân phối, kết quả gợi ý từ AI được trả về ngay từ cache mà không tốn chi phí gọi lại API Google Gemini.
2. **Kiểm soát Tần suất Gọi API (Token Bucket Rate Limiting):**
   Tích hợp bộ điều phối hàng đợi để kiểm soát số lượng token và số lượng request/phút gửi đến Google Gemini API, đảm bảo không vượt quá hạn ngạch (Quota limits) và tránh mã lỗi `429 Too Many Requests`.
3. **Cơ chế Phục hồi Lỗi (Graceful Fallback):**
   Trong trường hợp mất kết nối Internet, Cloudflare Tunnel bị gián đoạn hoặc API Google Gemini phản hồi chậm quá thời gian chờ (Timeout 10s):
   - Hệ thống tự động chuyển sang chế độ **Fallback Offline**.
   - Bảng điều khiển vẫn hiển thị đầy đủ kết quả phát hiện dị thường từ **Tầng 1 (Cú pháp)** và **Tầng 2 (Thống kê số học)**.
   - Giao diện người dùng hiển thị thông báo rõ ràng: *"Đang hoạt động ở chế độ phân tích cục bộ do dịch vụ AI đám mây tạm thời không khả dụng"*, đảm bảo quy trình làm việc của chuyên viên không bao giờ bị đình trệ.
