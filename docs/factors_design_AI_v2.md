# TÀI LIỆU THIẾT KẾ TOÀN DIỆN PHÂN HỆ AI (COMPREHENSIVE AI SUBSYSTEM SPECIFICATION)
**Dự án:** Nền tảng Full-stack Quản lý & Giám sát Chất lượng Dữ liệu có AI Hỗ trợ  
**Tập tin:** `docs/factor_design_AI_v2.md`  
**Phiên bản:** v2.0  
**Ngày lập:** 19/10/2026  
**Trạng thái tài liệu:** Tài liệu thiết kế kỹ thuật chính thức và toàn diện nhất cho Phân hệ AI  

---

## Lịch sử thay đổi (Change Log v1.0 ➔ v2.0)
- **Thay đổi gì:**
  1. Bổ sung cơ chế thích ứng dữ liệu bán cấu trúc (**Semi-structured Data Normalizer & Dynamic Flattener**) trước khi đưa vào các tầng xử lý AI.
  2. Chuẩn hóa sơ đồ luồng hoạt động toàn trình 5 bước (từ Bước 0: Ingestion đến Bước 4: Execution).
  3. Bổ sung **Ví dụ thực tế bao quát (End-to-End Case Study)** với dữ liệu JSON phức tạp, minh họa cụ thể kết quả đầu ra tại từng tầng.
  4. Hoàn thiện các hợp đồng dữ liệu nghiêm ngặt (Strict JSON Contracts), bộ lọc an toàn PII và cơ chế phòng chống ảo giác tham số.
  5. Bổ sung mục **3.2.1: Bản chất huấn luyện máy học không giám sát tại Tầng 2**, giải thích cặn kẽ câu hỏi *"Train để làm gì?"* và sự khác biệt giữa mô hình tự thích ứng động với lập trình điều kiện `if/else` thủ công.
- **Lý do:** Làm rõ khả năng tương thích của hệ thống khi xử lý đồng thời cả dữ liệu bảng phẳng (Structured) và dữ liệu bán cấu trúc (Semi-structured); giải ảo bản chất huấn luyện của thuật toán Unsupervised ML để xóa bỏ mơ hồ về khái niệm AI/ML trong dự án.
- **Ảnh hưởng đến đâu:** Là tài liệu quy chuẩn kỹ thuật cho việc lập trình Backend NestJS, Data Processing Workers và tích hợp AI APIs ở các giai đoạn sau.

---

## 1. Định vị và Nguyên tắc Cốt lõi của AI trong Hệ thống

Trong nền tảng Full-stack này, AI không phải là toàn bộ hệ thống mà đóng vai trò là một **Tiểu hệ thống Trợ lý Thông minh (AI Copilot / Assistant Subsystem)**:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   HỆ THỐNG FULL-STACK CORE PLATFORM                    │
│  (Quản trị User, Workspace, RDBMS/RabbitMQ Connectors, Data Versioning,│
│   Undo/Redo, Data Lineage Neo4j, MongoDB, Render UI, PDF Exporter)     │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ Kích hoạt khi cần phân tích chuyên sâu
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     TIỂU HỆ THỐNG AI (AI SUBSYSTEM)                     │
│  (Chuẩn hóa Semi-structured, Lọc cú pháp, Học máy phân phối & LLM)     │
└────────────────────────────────────────────────────────────────────────┘
```

### 3 Nguyên tắc bất biến khi tích hợp AI:
1. **Nguyên tắc "Con người nắm quyền kiểm soát" (Human-in-the-loop):** AI tuyệt đối không có quyền tự ý sửa đổi hoặc ghi đè dữ liệu gốc trong cơ sở dữ liệu. AI chỉ đóng vai trò chẩn đoán và đề xuất (Prescriptive Advisory). Quyết định thực thi luôn thuộc về người dùng (Data Analyst).
2. **Nguyên tắc "Tách biệt tính toán và suy luận":** Các phép tính số học, thống kê, đếm số lượng được giao hoàn toàn cho thuật toán xác định và Machine Learning cục bộ. LLM chỉ được dùng cho việc hiểu ngữ nghĩa, suy luận nhân quả và diễn giải ngôn ngữ tự nhiên.
3. **Nguyên tắc "Bảo mật dữ liệu tuyệt đối":** Không bao giờ gửi toàn bộ tệp dữ liệu thô lên các mô hình AI đám mây. Chỉ gửi siêu dữ liệu thống kê (Data Profile) và một lượng nhỏ bản ghi lỗi đại diện đã được ẩn danh hóa.

---

## 2. Tầng thích ứng Đa định dạng: Xử lý Structured và Semi-Structured Data

Hệ thống tiếp nhận cả hai nguồn dữ liệu: **Structured** (CSV, Excel, RDBMS) và **Semi-structured** (JSON, RabbitMQ message payloads). 

### 2.1. Thách thức kỹ thuật của Semi-structured Data
- Cấu trúc phân cấp lồng nhau (Nested Objects, Arrays) không thể đưa trực tiếp vào các mô hình số học Tầng 2 (như Isolation Forest, Z-score).
- Hiện tượng **Trôi dạt cấu trúc (Schema Drift):** Mỗi bản ghi JSON có thể có số lượng trường khác nhau, thiếu trường (Missing Key), hoặc một trường bị đột biến kiểu dữ liệu giữa các bản ghi (Type Mutation).

### 2.2. Cơ chế giải quyết: Schema Normalizer & Dynamic Flattener
Trước khi đưa vào quy trình kiểm định AI, dữ liệu bán cấu trúc phải đi qua bộ chuyển đổi:
1. **Suy diễn Schema hợp nhất (Union Schema Discovery):** Quét mẫu dữ liệu để tổng hợp toàn bộ các trường thuộc tính khả dĩ.
2. **Làm phẳng theo quy ước Dot-notation:** Chuyển đổi `{ "customer": { "age": 25 } }` thành trường phẳng `customer.age`.
3. **Chống bùng nổ số lượng trường (Anti-Field Explosion):** Thiết lập giới hạn cứng:
   - **Độ sâu lồng nhau tối đa (Max Nesting Depth) = 3 cấp**.
   - Nếu vượt quá cấp 3, cấu trúc con sẽ được giữ nguyên dưới dạng chuỗi JSON thô (Raw JSON String) thay vì tiếp tục phân tách.
   - Các mảng đối tượng dài (Arrays of Objects) sẽ được trích xuất thành các thuộc tính tổng hợp: `array_length`, `min_value`, `max_value`.

---

## 3. Kiến trúc AI 3 Tầng Chuyên biệt (Layered Architecture)

```
┌────────────────────────────────────────────────────────────────────────┐
│ TẦNG 1: ĐỘNG CƠ LUẬT CỨNG (Deterministic Rule-Based Engine)           │
│ - Trọng tâm: Cú pháp, kiểu dữ liệu, định dạng, ràng buộc logic cứng    │
│ - Cơ chế: Đơn dòng (Row-level / Stateless), O(1) mỗi dòng              │
│ - Tính chất kết quả: Nhị phân tuyệt đối (ĐÚNG hoặc SAI 100%)           │
│ - Tốc độ: < 150 mili-giây cho 100,000 dòng                             │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ TẦNG 2: MÁY HỌC & THỐNG KÊ CỤC BỘ (Local ML & Statistical Engine)      │
│ - Trọng tâm: Phân phối toàn cục, ngoại lai đơn/đa biến, trùng lặp mờ   │
│ - Cơ chế: Toàn cục (Dataset-level / Stateful), O(N log N)              │
│ - Tính chất kết quả: Điểm số xác suất nghi vấn (Anomaly Score 0.0 - 1.0)│
│ - Tốc độ: 0.5 - 2.5 giây cho 100,000 dòng (Chạy 100% Offline)         │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                   [ Trích xuất Metadata & 20-30 Dòng Mẫu Lỗi ]
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ TẦNG 3: TRÍ TUỆ SUY LUẬN & KÊ ĐƠN (Cognitive Reasoning - Cloud LLM)    │
│ - Trọng tâm: Ngữ nghĩa nghiệp vụ, suy luận nguyên nhân, lập kế hoạch   │
│ - Cơ chế: Prompting theo ngữ cảnh, trả về Strict JSON Action Plan      │
│ - Tính chất kết quả: Hướng dẫn làm sạch định kiểu kèm giải thích       │
│ - Tốc độ: 1 - 2 giây | Fallback về Ma trận luật khi Offline            │
└────────────────────────────────────────────────────────────────────────┘
```

### 3.1. Đặc tả kỹ thuật Tầng 1 (Deterministic Rule Engine)
- **Công nghệ:** TypeScript Engine trên NestJS (hoặc Web Worker trên Vite khi chạy offline).
- **Thuật toán & Kiểm tra:**
  - *Schema Validation:* Kiểm định cấu trúc JSON Schema (sử dụng AJV Engine) và kiểu dữ liệu (Type assertion).
  - *Missing Analysis:* Phân biệt chính xác giữa **Missing Key** (thuộc tính không tồn tại trong JSON) và **Null Value** (thuộc tính tồn tại nhưng giá trị là `null`/chuỗi rỗng).
  - *Format Verification (Regex):* Kiểm tra định dạng Email (RFC 5322), Số điện thoại (E.164), Ngày tháng (ISO-8601), Mã định danh nghiệp vụ.
  - *Domain Range Boundaries:* Ràng buộc giá trị biên ($V_{\min} \le x \le V_{\max}$).
  - *Exact Deduplication:* Băm dữ liệu SHA-256 trên tập khóa chính để tìm bản ghi trùng lặp $100\%$.

### 3.2. Đặc tả kỹ thuật Tầng 2 (Local ML & Statistical Engine)
- **Công nghệ:** Python Data Worker / Scikit-learn / Node-Wasm.
- **Thuật toán & Kiểm tra:**
  - *Ngoại lai đơn biến (Univariate Outliers):*
    - Phân phối chuẩn: **Z-Score** ($|Z| > 3.0$) hoặc **Modified Z-Score (MAD)** chống nhiễu:
      $$M_i = \frac{0.6745 \cdot (x_i - \tilde{x})}{\text{MAD}}$$
    - Phân phối lệch: **IQR (Interquartile Range)** với hàng rào Tukey:
      $$[Q_1 - 1.5 \times IQR, \quad Q_3 + 1.5 \times IQR]$$
  - *Ngoại lai đa biến (Multivariate Outliers):*
    - **Isolation Forest:** Phân lập các điểm dị biệt trong không gian đa chiều (ví dụ: tương quan giữa `Tuổi` và `Lương`). Điểm bất thường được tính dựa trên độ dài đường dẫn trung bình $h(x)$ trên tập cây ngẫu nhiên:
      $$s(x, n) = 2^{-\frac{E(h(x))}{c(n)}}$$
      Khi $s \to 1$, bản ghi được coi là dị biệt rõ rệt.
  - *Trùng lặp mờ (Fuzzy Deduplication):*
    - Kết hợp khoảng cách chuỗi **Jaro-Winkler Metric** và **Levenshtein Distance** để tìm các chuỗi bị lỗi gõ sai, lệch dấu tiếng Việt hoặc khác biệt từ viết tắt.
  - *Trôi dạt dữ liệu (Data Drift):*
    - Kiểm định hai mẫu **Kolmogorov-Smirnov (KS-Test)** và chỉ số **Population Stability Index (PSI)** cảnh báo khi dữ liệu mới nạp bị lệch phân phối so với mốc chuẩn ($PSI > 0.2$).

### 3.2.1. Bản chất Huấn luyện tại Tầng 2: "Train để làm gì?" và Cơ chế Học không giám sát (Unsupervised Learning)

Một thắc mắc kỹ thuật phổ biến là: *Nếu không gán nhãn dữ liệu từ trước và không lưu trữ trọng số mô hình cố định, tại sao Tầng 2 lại được gọi là Machine Learning và bước "Train" thực chất dùng để làm gì?*

#### 1. Tại sao KHÔNG THỂ "train trước" một con AI cho mọi loại dữ liệu?
Trong thực tế, người dùng có thể tải lên bất kỳ loại file nào: hôm nay là `benh_an_tim_mach.csv` (nhịp tim, huyết áp), ngày mai là `don_hang_thuong_mai.json` (phí vận chuyển, số lượng), ngày mốt là `cam_bien_iot.csv` (điện áp, nhiệt độ).
- Không tồn tại một tập dữ liệu gán nhãn vạn năng bao quát toàn bộ các ngành nghề trên thế giới.
- Nếu gán nhãn cứng để train một mô hình có giám sát (Supervised Learning) trên dữ liệu bệnh án, mô hình đó sẽ **hoàn toàn vô dụng** khi áp vào dữ liệu đơn hàng Shopee do số cột, tên trường và phân phối khác biệt 100%.

#### 2. Bước Train diễn ra ở đâu trong mã nguồn?
Bước huấn luyện của Tầng 2 không diễn ra trong quá khứ mà **diễn ra trực tiếp trong bộ nhớ RAM tại thời điểm người dùng nạp dữ liệu**:
```python
# 1. Khởi tạo thuật toán Học không giám sát (Unsupervised ML)
model = IsolationForest(n_estimators=100, contamination='auto', random_state=42)

# 2. ĐÂY CHÍNH LÀ BƯỚC HUẤN LUYỆN ĐỘNG (TRAINING / FITTING STEP):
model.fit(X_dataset)  # <-- Máy tự học cấu trúc hình học của chính tập dữ liệu vừa nạp

# 3. BƯỚC SUY LUẬN (INFERENCE STEP):
anomaly_scores = model.decision_function(X_dataset)
```

#### 3. "Train để làm gì?" — 3 mục tiêu mà lập trình thủ công (if/else) không thể làm được
Nếu không có bước Train, lập trình viên sẽ phải ngồi viết hàng nghìn câu lệnh `if/else` thủ công (`if tuổi < 22 && lương > 50tr`). Cách này sụp đổ ngay khi bảng có từ 5 cột trở lên vì số lượng tổ hợp tương quan bùng nổ hàng triệu nhánh. 

Bước `model.fit(X)` giải quyết 3 bài toán:
1. **Tự động tìm ranh giới đa chiều (Non-linear Decision Boundaries):** 
   - Với 5–10 cột tương quan, các bản ghi bình thường sẽ tụ lại thành một "đám mây" hình học phức tạp trong không gian đa chiều.
   - Bước `fit()` sử dụng 100 cây quyết định ngẫu nhiên để **tự động cắt tỉa và vẽ ra đường ranh giới bao quanh đám mây bình thường đó**. Máy tự hiểu ranh giới mà không cần con người viết code điều kiện.
2. **Tự động thích ứng với từng tập dữ liệu (Data-Adaptive Baseline):**
   - Mức lương 30 triệu/tháng ở một xưởng may là **cực kỳ bất thường**, nhưng ở một công ty công nghệ lại là **hoàn toàn bình thường**.
   - Bước `fit()` giúp máy tính tự động "học" khái niệm *thế nào là bình thường của chính tập dữ liệu đó*: nạp file xưởng may thì máy học chuẩn xưởng may, nạp file công ty công nghệ thì máy học chuẩn công ty công nghệ.
3. **Lập bản đồ mật độ (Density Distribution Map):**
   - Bước Train giống như việc đi dạo khắp thành phố để ghi nhớ khu vực nào đông đúc, khu vực nào hẻo lánh.
   - Khi đã có bản đồ mật độ, bất kỳ dòng dữ liệu nào nằm trơ trọi ở vùng mật độ cực thấp (độ sâu cây cắt ngắn) sẽ bị phát hiện và gắn cờ Anomaly Score cao ($> 0.85$).

### 3.3. Đặc tả kỹ thuật Tầng 3 (Cognitive Reasoning Engine)
- **Công nghệ:** Gemini API (Cloud LLM) với cơ chế Single-turn Structured Prompting.
- **Quy trình bảo vệ dữ liệu:**
  1. *PII Masking Filter:* Quét regex tự động thay thế số điện thoại, CCCD, thẻ tín dụng thành `[REDACTED]`.
  2. *Sampling Strategy:* Lấy mẫu phân tầng (Stratified Anomaly Sampling) gồm 20–30 dòng đại diện có điểm bất thường cao nhất từ Tầng 2.
  3. *Prompt Construction:* Ghép nối Metadata + Tín hiệu lỗi Tầng 1, 2 + Dòng mẫu lỗi.
  4. *Enforced JSON Output:* Yêu cầu LLM trả về cấu trúc JSON chặt chẽ (xem Mục 5).

---

## 4. Luồng hoạt động toàn trình (Step-by-Step Operational Workflow)

```
[ BƯỚC 0: TIẾP NHẬN & CHUẨN HÓA ]
  │ - Đọc CSV, Excel hoặc JSON từ Upload / DB / RabbitMQ
  │ - Kích hoạt Schema Normalizer: Làm phẳng trường lồng nhau (Dot-notation)
  ▼
[ BƯỚC 1: LỌC CÚ PHÁP CỨNG (TẦNG 1) ]
  │ - Quét nhanh toàn bộ dòng: Bắt lỗi type, null, regex, missing keys
  │ - Phân loại: Dòng sạch cơ bản vs Dòng vi phạm cú pháp
  ▼
[ BƯỚC 2: PHÂN TÍCH PHÂN PHỐI & MÁY HỌC (TẦNG 2) ]
  │ - Tính toán toàn cục Data Profile (Min, Max, Mean, Quantiles, Sparsity)
  │ - Chạy Isolation Forest, MAD, IQR, Jaro-Winkler
  │ - Gán Anomaly Score cho các bản ghi nghi vấn
  ▼
[ BƯỚC 3: HỘI CHẨN & KÊ ĐƠN XỬ LÝ (TẦNG 3) ]
  │ - Đóng gói: Metadata Profile + Tín hiệu lỗi + 20 dòng mẫu (Đã che PII)
  │ - Gửi tới Gemini API ➔ Nhận về Kế hoạch hành động (JSON Action Plan)
  │ - (Nếu Offline: Kích hoạt Ma trận Khuyến nghị Định sẵn)
  ▼
[ BƯỚC 4: NGƯỜI DÙNG DUYỆT & THỰC THI (REMEDIATION) ]
  │ - Data Analyst xem báo cáo trực quan Before/After, bấm duyệt
  │ - Backend Transformation Engine thực thi làm sạch
  │ - Lưu phiên bản mới (Data Versioning) trong MongoDB
  │ - Cập nhật đồ thị truy vết (Data Lineage) trong Neo4j
```

---

## 5. Hợp đồng Giao tiếp Tầng 3 (Data Contracts)

### 5.1. Cấu trúc Gói tin gửi tới LLM (Input Prompt Payload)
```json
{
  "dataset_info": {
    "name": "ecommerce_orders.json",
    "total_records": 100000,
    "flattened_fields": ["order_id", "customer.name", "customer.phone", "customer.age", "total_amount", "status"]
  },
  "layer1_signals": {
    "missing_required_keys": { "status": 120 },
    "regex_violations": { "customer.phone": 45 },
    "type_mutations": { "customer": 15, "total_amount": 85 }
  },
  "layer2_signals": {
    "univariate_outliers": { "total_amount": "32 records exceed upper fence (IQR)" },
    "multivariate_anomalies": { "features": ["customer.age", "total_amount"], "flagged_count": 18 },
    "fuzzy_duplicates": { "cluster_count": 12, "similarity_threshold": 0.88 }
  },
  "anonymized_error_samples": [
    { "order_id": "ORD-002", "customer.name": "[NAME_A]", "customer.phone": "abc-0909", "total_amount": -50000.0, "status": null },
    { "order_id": "ORD-003", "customer.name": "[NAME_B]", "customer.phone": "[PHONE_B]", "customer.age": 3, "total_amount": 500000000.0, "status": "COMPLETED" },
    { "order_id": "ORD-004", "customer": "[NAME_C]", "total_amount": "2,500,000 đ", "status": "DELIVERED" }
  ]
}
```

### 5.2. Cấu trúc Kế hoạch Hành động do LLM trả về (Strict Output Action Plan)
```json
{
  "plan_id": "PLAN-20261019-01",
  "data_quality_assessment": "Bộ dữ liệu chứa lỗi đa dạng: Dính ký tự tiền tệ gây sai kiểu dữ liệu, vi phạm giá trị âm, và bất thường đa biến tương quan Tuổi/Số tiền.",
  "actions": [
    {
      "step": 1,
      "target_field": "total_amount",
      "action_type": "SANITIZE_STRING_TO_NUMERIC",
      "parameters": {
        "strip_characters": "[^0-9.]",
        "cast_to": "float64"
      },
      "justification": "Loại bỏ ký tự tiền tệ và dấu phẩy để đưa cột về đúng định dạng số chuẩn."
    },
    {
      "step": 2,
      "target_field": "total_amount",
      "action_type": "DROP_OR_QUARANTINE",
      "parameters": {
        "condition": "total_amount <= 0"
      },
      "justification": "Số tiền âm vi phạm quy chuẩn nghiệp vụ đơn hàng, không thể tự suy luận để bù đắp."
    },
    {
      "step": 3,
      "target_field": "customer.age",
      "action_type": "FLAG_FOR_MANUAL_REVIEW",
      "parameters": {
        "condition": "customer.age < 12 AND total_amount > 100000000"
      },
      "justification": "Trẻ em 3 tuổi đặt đơn 500 triệu là bất thường đa biến nghiêm trọng; giữ nguyên đơn hàng nhưng chuyển bộ phận kiểm duyệt xác minh trước khi quyết định sửa."
    }
  ],
  "expected_score_improvement": {
    "before_score": 62.5,
    "after_score": 95.8
  }
}
```

---

## 6. Ví dụ Thực tế Bao quát Toàn bộ Hoạt động (End-to-End Case Study)

### 6.1. Dữ liệu thô ban đầu (`orders_batch.json`)
```json
[
  {
    "order_id": "ORD-001",
    "customer": { "name": "Nguyễn Văn An", "phone": "0912345678", "age": 28 },
    "total_amount": 1500000,
    "status": "COMPLETED"
  },
  {
    "order_id": "ORD-002",
    "customer": { "name": "Trần Thị Bình", "phone": "abc-0909", "age": 32 },
    "total_amount": -50000
  },
  {
    "order_id": "ORD-003",
    "customer": { "name": "Nguyen Van An", "phone": "0912345678", "age": 3 },
    "total_amount": 500000000,
    "status": "COMPLETED"
  },
  {
    "order_id": "ORD-004",
    "customer": "Lê Văn Cường",
    "total_amount": "2,500,000 đ",
    "status": "DELIVERED"
  }
]
```

### 6.2. Diễn biến cụ thể qua từng phân đoạn của Hệ thống

#### Bước 0: Chuẩn hóa Schema & Làm phẳng
- Chuyển đổi cấu trúc thành các cột phẳng: `order_id`, `customer.name`, `customer.phone`, `customer.age`, `total_amount`, `status`.
- **Phát hiện:** Tại bản ghi `ORD-004`, trường `customer` là chuỗi đơn thuần chứ không phải là một Object $\implies$ Đánh dấu lỗi **Type Mutation**.

#### Bước 1: Tầng 1 - Quét Cú pháp Cứng
- `ORD-002`:
  - `customer.phone` = `"abc-0909"` $\implies$ Lỗi Regex điện thoại.
  - `total_amount` = `-50000` $\implies$ Lỗi miền giá trị âm.
  - Không có trường `status` $\implies$ Lỗi Missing Required Key.
- `ORD-004`:
  - `total_amount` = `"2,500,000 đ"` $\implies$ Lỗi sai kiểu dữ liệu (String nằm trong cột Float).

#### Bước 2: Tầng 2 - Máy học & Thống kê Cục bộ
- `ORD-003`:
  - Phân tích IQR trên `total_amount`: `500,000,000` vượt xa hàng rào Tukey Upper Fence $\implies$ Ngoại lai giá trị cực đại.
  - Phân tích đa biến qua **Isolation Forest**: Tương quan `customer.age = 3` và `total_amount = 500,000,000` bị cô lập ở độ sâu cây cực ngắn $\implies$ Gắn cờ Anomaly Score = $0.94$.
- So khớp cặp `ORD-001` và `ORD-003` qua **Jaro-Winkler**:
  - Trùng số điện thoại $100\%$, tên trùng $95\%$ (khác biệt dấu tiếng Việt) $\implies$ Gắn cờ: Trùng lặp mờ khách hàng (Fuzzy Duplicate).

#### Bước 3: Tầng 3 - LLM Phân tích & Đề xuất Kế hoạch
- LLM tiếp nhận siêu dữ liệu tóm tắt và 3 bản ghi lỗi mẫu đã che PII.
- LLM sinh ra Action Plan:
  - *Bước 1:* Dùng biểu thức làm sạch chuỗi để chuyển `"2,500,000 đ"` thành số thực `2500000.0`.
  - *Bước 2:* Cách ly đơn `ORD-002` vào bảng lỗi do số tiền âm và số điện thoại rác.
  - *Bước 3:* Chuẩn hóa tên `ORD-003` theo `ORD-001`, gắn cờ cảnh báo đơn hàng giá trị cao của tài khoản nghi ngờ để kiểm tra thủ công.

#### Bước 4: Thực thi, Đánh giá & Lưu trữ Phiên bản
1. **Giao diện người dùng:** Data Analyst xem bảng so sánh Before / After trực quan và ấn nút **"Áp dụng tất cả" (Apply All)**.
2. **Thực thi:** Transformation Engine chạy các phép chuyển đổi:
   - Dữ liệu lỗi được làm sạch và cách ly đúng quy trình.
   - **Data Quality Score** của tập dữ liệu tăng từ **55% lên 98%**.
3. **Lưu trữ & Truy vết:**
   - Tạo **Version 2** trong MongoDB lưu snapshot dữ liệu sạch.
   - Ghi nhận vào đồ thị **Neo4j**:
     `orders_v1` $\xrightarrow{\text{Action: SANITIZE & ISOLATE}}$ `orders_v2`.
   - Nếu phát hiện nhầm lẫn, Data Analyst có thể bấm **Hoàn tác (Undo)** để quay lại `orders_v1` ngay lập tức.

---

## 7. Cơ chế Dự phòng Ngoại tuyến (Offline Fallback & Degradation Matrix)

Khi Backend bị ngắt kết nối hoặc mất Internet, Tầng 3 (LLM) tự động tắt và chuyển sang **Ma trận Khuyến nghị Định sẵn (Deterministic Rule-based Matrix)**:

| Loại lỗi phát hiện | Điều kiện kích hoạt từ Tầng 1 & 2 | Hành động khuyến nghị ngoại tuyến | Tham số tự động áp dụng |
|---|---|---|---|
| **Chuỗi chứa ký tự số** | Cột số bị dính ký tự tiền tệ/dấu phẩy | `SANITIZE_TO_NUMERIC` | Regex: `[^0-9.]` |
| **Giá trị âm phi lý** | Cột định lượng tài chính/tuổi $< 0$ | `QUARANTINE_RECORD` | Di chuyển vào bảng rác |
| **Khuyết thiếu số học** | Tỷ lệ Null $< 5\%$, phân phối lệch | `IMPUTE_MEDIAN` | Giá trị trung vị cột |
| **Khuyết thiếu số học** | Tỷ lệ Null $< 5\%$, phân phối chuẩn | `IMPUTE_MEAN` | Giá trị trung bình cột |
| **Khuyết thiếu danh mục** | Cột phân loại (Categorical) bị Null | `IMPUTE_MODE` | Giá trị xuất hiện nhiều nhất |
| **Ngoại lai đơn biến** | Vượt hàng rào Tukey (IQR) | `WINSORIZE_OUTLIERS` | Cắt tại phân vị 1% và 99% |
| **Trùng lặp mờ** | Độ tương đồng Jaro-Winkler $\ge 90\%$ | `MERGE_RECORDS` | Giữ bản ghi đầy đủ nhất |

---

## 8. Quản trị Rủi ro Kỹ thuật và An toàn Hệ thống (Safety & Governance)

1. **Kiểm soát Ảo giác Tham số từ LLM (Anti-Hallucination via Whitelist):**
   - Mọi JSON từ LLM bắt buộc phải đi qua bộ kiểm tra **Zod Schema Validator** tại Backend NestJS.
   - Nếu trường `action_type` không nằm trong danh sách các Enum thuật toán mà hệ sinh thái hỗ trợ, hệ thống lập tức từ chối và tự động fallback về Ma trận ngoại tuyến.
2. **Bảo vệ Thông tin Định danh Cá nhân (PII Protection):**
   - Bộ lọc **PII Masking Filter** sử dụng tập regex chuẩn quốc tế để che mờ dữ liệu trước khi gửi request ra khỏi máy chủ, đảm bảo tuân thủ các quy định bảo vệ dữ liệu cá nhân.
3. **Phòng chống Treo Giao diện (Frontend Freezing Prevention):**
   - Áp dụng kỹ thuật **Virtual Scrolling (Ảo hóa danh sách)** trên bảng dữ liệu React, chỉ render tối đa 30 dòng hiển thị trong tầm mắt của người dùng dù tập dữ liệu có tới 200,000 dòng.
