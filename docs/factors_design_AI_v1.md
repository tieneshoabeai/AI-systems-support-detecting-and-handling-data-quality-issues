# THIẾT KẾ KIẾN TRÚC MÔ HÌNH AI ĐA TẦNG (LAYERED AI ARCHITECTURE SPECIFICATION)
**Dự án:** Nền tảng Full-stack Quản lý & Giám sát Chất lượng Dữ liệu có AI Hỗ trợ  
**Tập tin:** `docs/factors_design_AI.md`  
**Phiên bản:** v1.0  
**Ngày lập:** 19/10/2026  
**Trạng thái tài liệu:** Tài liệu thiết kế kỹ thuật chính thức cho phân hệ AI  

---

## 1. Cơ sở lý luận: Tại sao bắt buộc phải phân tách thành 3 Tầng?

Trong việc ứng dụng AI vào quản lý chất lượng dữ liệu, hai sai lầm kiến trúc phổ biến nhất là:
1. **Quá phụ thuộc vào LLM (LLM-Centric):** Đẩy dữ liệu thô vào mô hình ngôn ngữ lớn để tìm lỗi. Kết quả: Tắc nghẽn bộ nhớ đệm (Context Window), chi phí token bùng nổ, độ trễ tính bằng phút, và LLM thường xuyên bị ảo giác (Hallucination) đối với các phép tính số học và thống kê cơ bản.
2. **Đồng nhất Luật cứng và Máy học (Monolithic Detection):** Gộp toàn bộ kiểm tra vào một tầng duy nhất. Kết quả: Không phân biệt được giữa "Lỗi cú pháp tuyệt đối" và "Điểm nghi vấn thống kê", dẫn đến hiện tượng báo động giả tràn lan (False Positive Fatigue) hoặc xóa nhầm dữ liệu nghiệp vụ quan trọng.

Để giải quyết triệt để, kiến trúc AI của hệ thống được chuẩn hóa thành **3 tầng chuyên biệt**, phân tách dựa trên bản chất toán học, tài nguyên tính toán và tính chất của kết quả đầu ra:

```
┌────────────────────────────────────────────────────────────────────────┐
│ DỮ LIỆU ĐẦU VÀO (CSV, Excel, JSON, RDBMS, RabbitMQ Stream)            │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ TẦNG 1: ĐỘNG CƠ LUẬT CỨNG (Deterministic Rule-Based Engine)           │
│ - Phạm vi: Đơn dòng (Row-level / Stateless)                           │
│ - Kết quả: Nhị phân tuyệt đối (ĐÚNG hoặc SAI)                          │
│ - Độ phức tạp: O(1) mỗi dòng, O(N) toàn file                           │
│ - Mục tiêu: Loại bỏ rác cú pháp, vi phạm schema, định dạng sai         │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ TẦNG 2: MÁY HỌC & THỐNG KÊ CỤC BỘ (Local ML & Statistical Engine)      │
│ - Phạm vi: Toàn cục bộ dữ liệu (Dataset-level / Stateful)             │
│ - Kết quả: Xác suất / Điểm nghi vấn (Anomaly Score, Confidence)        │
│ - Độ phức tạp: O(N log N) đến O(N x D)                                │
│ - Mục tiêu: Phát hiện ngoại lai đơn/đa biến, trùng lặp mờ, trôi dạt    │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                   [ Trích xuất Metadata & 20-30 Dòng Mẫu Lỗi ]
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ TẦNG 3: TRÍ TUỆ SUY LUẬN & KÊ ĐƠN (Cognitive Reasoning - Cloud LLM)    │
│ - Phạm vi: Bối cảnh nghiệp vụ tổng thể (Contextual / Semantic)        │
│ - Kết quả: Giải thích nguyên nhân & Kế hoạch hành động (JSON Schema)   │
│ - Giao thức: Prompting chuyên biệt với ràng buộc cấu trúc đầu ra       │
│ - Mục tiêu: Diễn giải ngữ nghĩa, đề xuất chiến lược làm sạch tối ưu    │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
[ NGƯỜI DÙNG DUYỆT (Human-in-the-loop) ] ➔ [ THỰC THI & LƯU PHIÊN BẢN ]
```

---

## 2. Đặc tả chi tiết từng Tầng Kiến trúc

### 2.1. Tầng 1: Động cơ Luật cứng (Deterministic Rule Engine)
- **Bản chất kỹ thuật:** Kiểm tra xác định (Deterministic), độc lập theo từng dòng (Stateless).
- **Môi trường thực thi:** Backend NestJS (chế độ Online) hoặc Web Worker trên Frontend Vite/React (chế độ Offline).
- **Độ phức tạp & Hiệu năng:** $O(1)$ cho mỗi bản ghi; xử lý 100,000 dòng trong $< 150\text{ ms}$.
- **Các nhóm thuật toán & Quy tắc kiểm tra:**
  1. *Schema & Type Validation:* Ép kiểu dữ liệu nghiêm ngặt. Xác định các trường hợp sai lệch kiểu (ví dụ: chuỗi ký tự nằm trong cột số nguyên).
  2. *Completeness Check (Tính đầy đủ):* Bắt các giá trị `NULL`, chuỗi rỗng `""`, khoảng trắng `   `, hoặc các giá trị quy ước rác như `N/A`, `NaN`, `null`, `None`, `-`.
  3. *Validity Check (Tính hợp lệ):* Kiểm định biểu thức chính quy (Regex) theo quy chuẩn quốc tế:
     - Email: RFC 5322 regex.
     - Số điện thoại: Chuẩn E.164 hoặc quy chuẩn viễn thông Việt Nam.
     - Ngày tháng: ISO-8601 (`YYYY-MM-DD`), chuẩn ngày tháng định dạng cụ thể.
     - Miền giá trị (Range Check): $V_{\min} \le x \le V_{\max}$ (ví dụ: Phần trăm $\in [0, 100]$, Điểm $\in [0, 10]$).
  4. *Uniqueness Check (Tính duy nhất):* Sử dụng bảng băm (Hash Set với SHA-256) trên tập các cột khóa chính (Composite Keys) để phát hiện trùng lặp bản ghi $100\%$.

### 2.2. Tầng 2: Máy học và Thống kê cục bộ (Local ML & Statistical Engine)
- **Bản chất kỹ thuật:** Đánh giá phân phối toàn cục (Stateful), tính toán ma trận thống kê và học không giám sát (Unsupervised Learning).
- **Môi trường thực thi:** Python Data Worker hoặc Module thuật toán chuyên biệt trên Node.js/Wasm. Chạy hoàn toàn nội bộ (Local), không phụ thuộc mạng.
- **Độ phức tạp & Hiệu năng:** $O(N \log N)$ đến $O(N \times D)$ với $D$ là số chiều; xử lý 100,000 dòng trong $0.5 - 2.5\text{ giây}$.
- **Các nhóm thuật toán chuyên biệt:**
  1. *Phát hiện ngoại lai đơn biến (Univariate Outlier Detection):*
     - Phân phối chuẩn (Gaussian): Sử dụng **Z-Score** ($|Z| > 3.0$) hoặc **Modified Z-Score dựa trên MAD (Median Absolute Deviation)** nhằm triệt tiêu ảnh hưởng của chính các giá trị ngoại lai cực đoan lên giá trị trung bình.
     - Phân phối lệch (Skewed Distribution): Sử dụng **IQR (Interquartile Range)** với hàng rào Tukey:
       $$\text{Lower Bound} = Q_1 - 1.5 \times IQR, \quad \text{Upper Bound} = Q_3 + 1.5 \times IQR$$
  2. *Phát hiện ngoại lai đa biến (Multivariate Outlier Detection):*
     - Thuật toán **Isolation Forest:** Phân tách ngẫu nhiên các điểm dữ liệu trong không gian đa chiều $D$. Các điểm dị biệt đa biến (ví dụ: `Tuổi = 18` kết hợp với `Kinh nghiệm = 20 năm`) sẽ bị cô lập ở độ sâu cây (Tree Depth) ngắn hơn rất nhiều so với các điểm dữ liệu thông thường.
     - Thuật toán **Local Outlier Factor (LOF):** Đánh giá mật độ cục bộ của một điểm so với các điểm láng giềng k-NN để tìm các cụm dữ liệu bất thường.
  3. *Phát hiện trùng lặp mờ (Fuzzy Deduplication):*
     - Thuật toán đo khoảng cách chuỗi ký tự: **Levenshtein Distance**, **Jaro-Winkler Metric** kết hợp mã hóa ngữ âm **Double Metaphone**.
     - Phát hiện các thực thể tương đồng viết sai chính tả, khác biệt dấu câu hoặc viết tắt (ví dụ: `TP. Hồ Chí Minh` vs `Tp Ho Chi Minh` vs `TP HCM`).
  4. *Phát hiện trôi dạt dữ liệu (Data Drift / Distribution Shift):*
     - Kiểm định **Kolmogorov-Smirnov (KS-Test)** cho biến liên tục.
     - Chỉ số ổn định tổng thể **PSI (Population Stability Index)**:
       $$PSI = \sum \left( (P_i - Q_i) \times \ln\left(\frac{P_i}{Q_i}\right) \right)$$
       Cảnh báo trôi dạt khi $PSI > 0.2$.

### 2.3. Tầng 3: Trí tuệ Suy luận & Kê đơn hành động (Cognitive Reasoning - Cloud LLM)
- **Bản chất kỹ thuật:** Phân tích ngữ cảnh, suy luận nhân quả và lập kế hoạch xử lý (Planning) sử dụng mô hình nền tảng (Gemini API).
- **Môi trường thực thi:** Dịch vụ AI Cloud.
- **Ràng buộc an toàn tuyệt đối:** **Không truyền dữ liệu bảng thô**. Chỉ truyền bản tóm tắt siêu dữ liệu và mẫu lỗi ẩn danh.
- **Quy trình hoạt động:**
  1. *Lọc thông tin nhạy cảm (PII Masking Filter):* Tự động che mờ CCCD, tên riêng, số thẻ trong dữ liệu mẫu bằng token `[REDACTED]`.
  2. *Xây dựng Prompt ngữ cảnh (Contextual Prompt Construction):* Kết hợp Data Dictionary, bảng tổng hợp phân phối của Tầng 1 và danh sách điểm nghi vấn của Tầng 2.
  3. *Sinh kế hoạch làm sạch (Prescriptive Action Plan):* LLM đóng vai trò chuyên gia tư vấn dữ liệu, giải thích lý do xuất hiện lỗi và đề xuất thuật toán làm sạch phù hợp với tính chất phân phối.

---

## 3. Hợp đồng Giao tiếp Tầng 3 (Data Contract & Structured Output)

Để loại trừ hoàn toàn rủi ro văn bản tự do không thể parse bằng code, Tầng 3 giao tiếp thông qua **Strict JSON Schema**.

### 3.1. Dữ liệu đầu vào gửi tới LLM (Input Payload Schema)
```json
{
  "dataset_metadata": {
    "total_rows": 150000,
    "total_columns": 12,
    "target_column": "salary",
    "data_type": "float64"
  },
  "distribution_summary": {
    "min": -5000.0,
    "max": 250000000.0,
    "mean": 18500000.0,
    "median": 15000000.0,
    "std_dev": 24000000.0,
    "null_count": 450,
    "null_rate": 0.003
  },
  "layer1_layer2_signals": {
    "syntax_errors": ["Negative values detected: 12 rows"],
    "univariate_outliers": "184 rows exceed Upper Tukey Fence (IQR)",
    "multivariate_anomalies": "45 rows flagged by Isolation Forest when correlated with 'job_title'"
  },
  "error_samples": [
    { "row_id": 412, "job_title": "Intern", "experience_years": 0.5, "salary": 250000000.0 },
    { "row_id": 8901, "job_title": "Junior Developer", "experience_years": 1.0, "salary": -5000.0 }
  ]
}
```

### 3.2. Dữ liệu phản hồi chuẩn hóa từ LLM (Strict Output Action Plan)
```json
{
  "issue_id": "ISS_SALARY_001",
  "severity": "CRITICAL",
  "root_cause_analysis": "Cột lương xuất hiện giá trị âm phi lý do lỗi nhập liệu hệ thống cũ và giá trị cực đoan 250 triệu ở cấp bậc Thực tập sinh do lỗi gõ thừa số 0.",
  "recommended_strategy": "HYBRID_CLEANING",
  "actions": [
    {
      "step": 1,
      "action_type": "DROP_ROWS",
      "target_column": "salary",
      "parameters": {
        "condition": "salary < 0"
      },
      "justification": "Lương âm là giá trị vi phạm quy chuẩn nghiệp vụ bắt buộc, không thể phục hồi."
    },
    {
      "step": 2,
      "action_type": "CAP_PERCENTILE",
      "target_column": "salary",
      "parameters": {
        "method": "WINSORIZATION",
        "upper_threshold_percentile": 0.99,
        "group_by": "job_title"
      },
      "justification": "Cắt ngưỡng phân vị theo từng chức danh công việc giúp giữ nguyên kích thước mẫu mà không làm lệch độ lệch chuẩn."
    }
  ],
  "impact_estimation": {
    "rows_affected": 196,
    "data_loss_percentage": 0.008,
    "variance_reduction_percentage": 68.5
  },
  "confidence_score": 0.94
}
```

---

## 4. Cơ chế Suy thoái Ngoại tuyến (Offline Fallback & Degradation Matrix)

Khi mất kết nối Internet hoặc Backend bị ngắt kết nối:
- **Tầng 1 & Tầng 2:** Tiếp tục thực thi cục bộ 100% trên môi trường nội bộ.
- **Tầng 3 (LLM):** Tự động chuyển đổi sang **Ma trận Luật Khuyến nghị Định sẵn (Deterministic Fallback Matrix)**:

| Loại lỗi phát hiện | Điều kiện kích hoạt | Hành động khuyến nghị ngoại tuyến (Offline Action) | Tham số mặc định |
|---|---|---|---|
| **Khuyết thiếu (Missing)** | Cột số, tỷ lệ rỗng $< 5\%$, phân phối đối xứng ($|\text{Skewness}| < 0.5$) | `IMPUTE_MEAN` | Giá trị trung bình của cột |
| **Khuyết thiếu (Missing)** | Cột số, tỷ lệ rỗng $< 5\%$, phân phối lệch ($|\text{Skewness}| \ge 0.5$) | `IMPUTE_MEDIAN` | Giá trị trung vị của cột |
| **Khuyết thiếu (Missing)** | Cột phân loại (Categorical), tỷ lệ rỗng $< 10\%$ | `IMPUTE_MODE` | Giá trị xuất hiện nhiều nhất |
| **Khuyết thiếu trầm trọng** | Bất kỳ cột nào có tỷ lệ rỗng $> 60\%$ | `RECOMMEND_DROP_COLUMN` | Loại bỏ cột khỏi phân tích |
| **Ngoại lai (Outlier)** | Cột số, phát hiện qua IQR hoặc Z-Score | `WINSORIZE_OUTLIERS` | Cắt ngưỡng tại phân vị 1% và 99% |
| **Trùng lặp mờ (Fuzzy Dup)** | Độ tương đồng Levenshtein $\ge 88\%$ | `MERGE_RECORDS` | Giữ bản ghi có độ đầy đủ cao nhất |

---

## 5. Bảng so sánh Đánh đổi Kiến trúc (Trade-offs & Alternatives)

| Giải pháp cân nhắc | Lý do loại trừ | Đánh đổi chấp nhận khi chọn Kiến trúc 3 Tầng hiện tại |
|---|---|---|
| **1. Tự Fine-tune mô hình nhỏ (Local LLM: Llama-3, Mistral)** | Tốn từ 8GB–16GB VRAM để chạy suy luận; làm sập các máy tính cá nhân phát triển đồ án; khả năng tổng quát hóa schema mới kém hơn mô hình biên giới (Frontier Models). | Chấp nhận phụ thuộc kết nối Internet cho Tầng 3 khi muốn có giải thích ngôn ngữ tự nhiên chất lượng cao nhất. |
| **2. Multi-Agent Frameworks (CrewAI, AutoGen)** | Sinh ra độ trễ quá lớn ($20 - 45\text{s}$ cho mỗi lần hội chẩn); tiêu tốn gấp 6 lần chi phí API; nguy cơ phát sinh vòng lặp vô hạn giữa các Agent. | Giảm thiểu xuống mô hình Single-turn Reasoning có cấu trúc (Strict JSON), phản hồi trong $1 - 2\text{s}$, độ ổn định đạt 100%. |
| **3. Monolithic Rule-based (Chỉ dùng Tầng 1)** | Bỏ sót hoàn toàn các lỗi ngoại lai đa biến phức tạp và không hỗ trợ giải thích trực quan cho người dùng. | Chấp nhận độ phức tạp cao hơn trong việc tích hợp nhiều thuật toán ở Tầng 2 và Tầng 3. |

---

## 6. Rủi ro kỹ thuật còn lại và Biện pháp kiểm soát (Risk Mitigation)

1. **Rủi ro Ảo giác Tham số từ LLM (Hallucinated Parameters):**
   - *Nguy cơ:* LLM có thể đề xuất một `action_type` không tồn tại trong mã nguồn Backend (ví dụ: `QUANTUM_INTERPOLATION`).
   - *Kiểm soát:* Phía Backend NestJS triển khai bộ lọc **Whitelist Action Validator (sử dụng Zod Schema)**. Mọi JSON từ LLM bắt buộc phải khớp chính xác với danh sách Enums thuật toán được định nghĩa trong hệ thống. Bất kỳ tham số lạ nào đều bị từ chối và tự động fallback về Ma trận Luật định sẵn.
2. **Rủi ro Rò rỉ Dữ liệu Riêng tư (Data Privacy / Compliance):**
   - *Nguy cơ:* Các mẫu dữ liệu gửi lên API chứa dữ liệu cá nhân nhạy cảm (PII).
   - *Kiểm soát:* Tích hợp thư viện lọc và ẩn danh hóa (Anonymizer Engine) chạy ở cuối Tầng 1. Mọi trường thông tin khớp regex số điện thoại, số thẻ ngân hàng, CCCD đều bị thay thế thành chuỗi mặt nạ `[REDACTED]` trước khi payload rời khỏi máy chủ.
