# BÁO CÁO CÁC YẾU TỐ CỐT LÕI VÀ RÀNG BUỘC KỸ THUẬT (SYSTEM FACTORS REPORT)
**Dự án:** Nền tảng Full-stack Quản lý & Giám sát Chất lượng Dữ liệu có AI Hỗ trợ  
**Tập tin:** `docs/factors_v1.md`  
**Phiên bản:** v1.0  
**Ngày lập:** 19/10/2026  
**Mục đích tài liệu:** Xác lập 5 yếu tố kỹ thuật nền tảng làm căn cứ thiết kế tính năng, mô hình dữ liệu và giải pháp công nghệ; phục vụ rà soát và bổ sung liên tục giữa người phát triển và chuyên gia.

---

## 1. Bản chất dữ liệu tiếp nhận (Data Typology)

Hệ thống giới hạn phạm vi xử lý vào hai nhóm dữ liệu có cấu trúc và bán cấu trúc, phục vụ trực tiếp cho đối tượng Data Analyst:

### 1.1. Dữ liệu có cấu trúc (Structured Data) - Trọng tâm số 1
- **Định dạng tiếp nhận:** Tệp CSV, bảng tính Excel (`.xlsx`), dữ liệu bảng trích xuất từ CSDL quan hệ (PostgreSQL, MySQL, SQLite).
- **Đặc trưng:** Có cấu trúc hàng/cột cố định (Tabular Data), kiểu dữ liệu (Data Types) xác định rõ ràng trên từng cột (Integer, Float, String, Date, Boolean).
- **Bài toán chất lượng tập trung:** Kiểm tra ô trống (Missing values), dị biệt thống kê (Numerical/Categorical Outliers), dữ liệu trùng lặp (Exact/Fuzzy Duplicates), sai định dạng quy chuẩn (Format Inconsistency), vi phạm ràng buộc miền giá trị (Domain Range Violations).

### 1.2. Dữ liệu bán cấu trúc (Semi-structured Data) - Trọng tâm số 2
- **Định dạng tiếp nhận:** Tệp JSON (JSON Array, JSON Lines), các bản tin sự kiện (Event Payloads) thu nạp từ hàng đợi RabbitMQ.
- **Đặc trưng:** Cấu trúc phân cấp động (Nested Objects, Arrays), không bắt buộc phải có schema cố định cho mọi bản ghi.
- **Bài toán chất lượng tập trung:** Trôi dạt cấu trúc (Schema Drift), thiếu khóa bắt buộc (Missing Keys), sai kiểu dữ liệu trường lồng nhau (Nested Type Mismatch).

### 1.3. Loại trừ dữ liệu phi cấu trúc (Unstructured Data)
- **Phạm vi loại trừ:** Video, âm thanh (Audio), hình ảnh, tài liệu văn bản dài tự do (PDF/Word không cấu trúc bảng).
- **Lý do loại trừ:** Đánh giá chất lượng hình ảnh/âm thanh đòi hỏi các pipeline chuyên biệt (Computer Vision/Audio Signal Processing) và tài nguyên tính toán GPU khổng lồ. Việc gộp vào hệ thống này sẽ làm phân tán trọng tâm và không phục vụ đúng nghiệp vụ phân tích dữ liệu nghiệp vụ của Data Analyst.
- **Quy ước văn bản tự do trong bảng:** Các cột văn bản dạng chuỗi ngắn (như địa chỉ, ghi chú, phản hồi) chỉ được xử lý ở góc độ chuỗi: kiểm tra độ dài, regex, chuỗi rác, tính duy nhất hoặc so khớp ngữ nghĩa cơ bản.

---

## 2. Chiến lược mô hình AI (AI Model Architecture Strategy)

Hệ thống áp dụng mô hình **Lai (Hybrid AI Architecture)**, phân định ranh giới rõ ràng giữa thuật toán cục bộ và dịch vụ trí tuệ nhân tạo đám mây:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                             HYBRID AI ENGINE                             │
├─────────────────────────────────────────┬────────────────────────────────┤
│    TẦNG TÍNH TOÁN & PHÁT HIỆN LỖI       │    TẦNG SUY LUẬN & GỢI Ý       │
│    (Local ML & Statistics)              │    (Cloud LLM API: Gemini)     │
├─────────────────────────────────────────┼────────────────────────────────┤
│ - Z-Score, IQR, Isolation Forest        │ - Đọc bản tóm tắt Data Profile │
│ - KNN Imputer, K-Means Clustering       │ - Giải thích nguyên nhân lỗi   │
│ - Levenshtein / Fuzzy Matching          │ - Đề xuất chiến lược làm sạch  │
│ - Chạy 100% Offline, mili-giây          │ - Sinh công thức Regex / Code  │
└─────────────────────────────────────────┴────────────────────────────────┘
```

### 2.1. Tầng Tính toán & Phát hiện bất thường (Local ML & Statistical Engine)
- **Công nghệ:** Thuật toán thống kê và thư viện máy học chạy nội bộ (Scikit-learn, ONNX Runtime, thư viện toán học trên Backend NestJS hoặc Python Microservice).
- **Vai trò:** Quét trực tiếp trên toàn bộ các dòng của dữ liệu để phát hiện điểm dị biệt, tính ma trận khoảng cách, tính độ lệch phân phối.
- **Ưu điểm:** Tốc độ thực thi cực nhanh (vài mili-giây), kết quả mang tính xác định (Deterministic), hoạt động hoàn toàn ngoại tuyến (Offline), không tốn chi phí vận hành.

### 2.2. Tầng Suy luận & Đề xuất hành động (Cloud LLM API Engine)
- **Công nghệ:** Kéo API từ các mô hình ngôn ngữ lớn (Gemini API / OpenAI API).
- **Vai trò:** Nhận siêu dữ liệu (Metadata), bảng tóm tắt phân phối (Data Profile) và một tập mẫu nhỏ chứa các bản ghi lỗi đại diện. Đóng vai trò là "chuyên gia tư vấn": giải thích nguyên nhân lỗi bằng ngôn ngữ tự nhiên và đề xuất công thức xử lý.
- **Ưu điểm:** Khả năng suy luận ngữ cảnh cao mà không cần viết các hàm logic phức tạp; sinh văn bản giải thích thân thiện cho Data Analyst.
- **Nhược điểm & Cơ chế phòng ngừa:** Phụ thuộc mạng Internet và tốn phí token. Khi mất mạng (Offline), hệ thống tự động ngắt tầng LLM và kích hoạt cơ chế dự phòng: xuất các mẫu khuyến nghị tĩnh được định nghĩa sẵn (Rule-based Templates).

### 2.3. Giải trình việc không tự huấn luyện mô hình (No Train From Scratch)
- Việc tự train một mô hình ngôn ngữ từ đầu đòi hỏi chi phí phần cứng hàng triệu USD và hàng tháng tính toán. Đây là cách làm phi thực tế cho phạm vi một đồ án. Hệ thống chỉ tận dụng năng lực suy luận của các mô hình nền tảng có sẵn kết hợp thuật toán máy học chuyên biệt.

---

## 3. Định vị vai trò hệ thống và Vị trí của AI

### 3.1. Bản chất hệ thống
- Hệ thống là một **Nền tảng Full-Stack Quản lý Dữ liệu Toàn diện (Full-Stack Data Management Platform)**.
- Xương sống của hệ thống đảm bảo vận hành độc lập: Quản trị người dùng, phân quyền RBAC, tiếp nhận dữ liệu đa nguồn (File, DB, Stream), quản lý không gian làm việc, bộ máy thực thi luật kiểm tra cứng, lưu trữ phiên bản dữ liệu (Versioning), trực quan hóa bảng dữ liệu, xuất báo cáo PDF và bảo mật kênh truyền.

### 3.2. Vị trí chính xác của AI
- AI là một **Module trợ lý thông minh (AI Copilot / Assistant Subsystem)** nằm bên trong hệ thống.
- **Ranh giới an toàn:** AI **không sở hữu quyền hạn tối cao** trong việc tự ý ghi đè hoặc sửa đổi dữ liệu. AI chỉ đóng vai trò phân tích và đề xuất phương án. Quyết định thực thi luôn thuộc về người dùng (Nguyên tắc **Human-in-the-loop**).
- Nếu vô hiệu hóa hoàn toàn module AI, hệ thống vẫn là một phần mềm quản trị và làm sạch dữ liệu hoạt động 100% dựa trên các luật nghiệp vụ cứng (Hardcoded Rules).

---

## 4. Nghiệp vụ cốt lõi (Core Business Proposition)

Nghiệp vụ trọng tâm tạo nên giá trị sống còn của hệ thống là **Vòng lặp Quản lý & Bảo chứng Chất lượng Dữ liệu (Verifiable Data Quality Lifecycle)** gồm 4 giai đoạn:

```
[ 1. Đo lường định lượng ] ──▶ [ 2. Chẩn đoán đa tầng ] ──▶ [ 3. Kê đơn hành động ] ──▶ [ 4. Thực thi an toàn ]
     (Data Quality Score)          (Rule cứng + Local ML)        (AI Recommendations)        (Undo / Versioning)
```

1. **Đo lường định lượng (Quantifiable Audit):** Chuyển đổi trạng thái dữ liệu thô thành chỉ số tin cậy rõ ràng thông qua **Data Quality Score (0–100%)** dựa trên 6 chiều tiêu chuẩn công nghiệp:
   - *Completeness (Tính đầy đủ):* Tỷ lệ bản ghi không bị khuyết thiếu.
   - *Accuracy (Tính chính xác):* Dữ liệu phản ánh đúng thực tế khách quan.
   - *Validity (Tính hợp lệ):* Khớp với quy chuẩn kiểu dữ liệu, định dạng, dải giá trị.
   - *Consistency (Tính nhất quán):* Dữ liệu đồng nhất giữa các bảng và nguồn dữ liệu liên quan.
   - *Uniqueness (Tính duy nhất):* Không xuất hiện bản ghi trùng lặp phi lý.
   - *Timeliness (Tính kịp thời):* Độ mới của dữ liệu so với thời gian phát sinh nghiệp vụ.
2. **Chẩn đoán đa tầng (Multi-tier Diagnosis):** Kết hợp kiểm tra vi phạm ràng buộc cứng (Rule-based) và tìm kiếm các dị biệt ẩn (Anomaly Detection) mà con người không lường trước.
3. **Kê đơn hành động (Prescriptive Recommendations):** Không dừng lại ở việc gắn cờ báo lỗi, mà cung cấp giải pháp khắc phục chi tiết (Phương pháp xử lý, tham số đề xuất, tác động ước lượng lên phân phối dữ liệu sau khi sửa).
4. **Thực thi và Bảo toàn dữ liệu (Safe Remediation & Traceability):** Áp dụng thay đổi mà không gây rủi ro mất dữ liệu gốc thông qua cây phả hệ biến đổi (Data Lineage trên Neo4j) và cơ chế hoàn tác từng bước (Undo/Redo).

---

## 5. Ràng buộc và Giới hạn dữ liệu (Data Constraints & Boundaries)

Để đảm bảo hệ thống vận hành ổn định trong môi trường máy tính phát triển cục bộ và đồ án học phần, các giới hạn kỹ thuật cứng được thiết lập:

| Tham số giới hạn | Ngưỡng quy định | Cơ sở kỹ thuật và Rủi ro nếu vượt ngưỡng |
|---|---|---|
| **Dung lượng tệp CSV / JSON** | **Tối đa 50 MB** | Tránh nghẽn băng thông upload và cạn kiệt bộ nhớ đệm Node.js buffer khi parse dữ liệu. |
| **Dung lượng tệp Excel (`.xlsx`)** | **Tối đa 20 MB** | Tệp Excel có cấu trúc nén XML dạng zip; khi bung ra bộ nhớ RAM để parse có thể phình to gấp 5–10 lần dung lượng thực trên đĩa. |
| **Số dòng xử lý trên Server (Online)** | **Tối đa 200,000 dòng** | Đảm bảo các thuật toán profiling và anomaly detection hoàn thành trong khoảng thời gian chấp nhận được (dưới 10 giây). |
| **Số dòng xử lý trên Client (Offline)** | **Tối đa 20,000 dòng** | Trình duyệt chạy V8 Engine có giới hạn RAM cho từng tab. Vượt ngưỡng này khi xử lý bằng JavaScript client sẽ làm đông cứng giao diện (UI Freeze). |
| **Số cột tối đa (Columns)** | **Tối đa 100 cột** | Vượt quá 100 cột sẽ gây suy giảm nghiêm trọng hiệu năng render DOM của bảng dữ liệu (Data Grid) trên Frontend. |
| **Truy vấn CSDL ngoài (RDBMS Query)** | **Tối đa 50,000 dòng / lần**<br>Timeout: **30 giây** | Ngăn chặn câu truy vấn quét toàn bộ bảng (Full Table Scan) làm treo kết nối đến CSDL nguồn của doanh nghiệp. |
| **Bản tin Streaming (RabbitMQ)** | - Kích thước: **Tối đa 1 MB / message**<br>- Throughput: **500 - 1,000 msgs/giây** | Đảm bảo hàng đợi tin nhắn không bị tràn RAM và consumer của NestJS xử lý kịp thời. |
| **Giới hạn dữ liệu gửi tới AI (LLM)** | **Tuyệt đối KHÔNG gửi dữ liệu thô**.<br>Chỉ gửi: **Metadata + Mẫu lỗi (20–50 dòng)** | Tiết kiệm 95% chi phí token API, giảm độ trễ phản hồi xuống dưới 2 giây và bảo mật dữ liệu khách hàng. |

---

## 6. Điểm yếu kỹ thuật, Rủi ro và Giải pháp phòng ngừa

1. **Rủi ro lệch ngữ cảnh khi chỉ gửi mẫu lỗi (Sampling Bias in LLM):**
   - *Điểm yếu:* Vì chỉ gửi 20–50 dòng đại diện lên LLM, mô hình AI có thể đưa ra nhận định mang tính phiến diện nếu mẫu được chọn không đại diện đúng cho phân phối tổng thể.
   - *Giải pháp:* Tầng thống kê cục bộ (Local Profiling) phải tính toán đầy đủ các chỉ số toàn cục (Min, Max, Mean, Median, Tỷ lệ Null, Tần suất xuất hiện) và gửi kèm bộ chỉ số này vào prompt của AI để bù đắp sự thiếu hụt ngữ cảnh.
2. **Suy giảm hiệu năng giao diện khi duyệt dữ liệu lớn (Frontend Lag):**
   - *Điểm yếu:* Ngay cả khi giới hạn 200,000 dòng, việc hiển thị toàn bộ lên màn hình React sẽ làm crash tab trình duyệt.
   - *Giải pháp:* Áp dụng kỹ thuật **Virtual Scrolling (Ảo hóa danh sách - chỉ render những dòng đang hiển thị trong tầm mắt)** kết hợp phân trang server-side (Server-side Pagination).
3. **Mâu thuẫn phiên bản khi người dùng thao tác song song:**
   - *Điểm yếu:* Nếu hai phiên làm việc cùng can thiệp sửa một tập dữ liệu, cơ chế Undo/Redo có thể ghi đè làm mất dữ liệu của nhau.
   - *Giải pháp:* Áp dụng cơ chế khóa lạc quan (Optimistic Concurrency Control) thông qua trường `version` trong document của MongoDB.

---

## 7. Các điểm mở cần tiếp tục thảo luận (Open Discussion Points)

Các vấn đề sau đây được ghi nhận để người dùng và AI tiếp tục tinh chỉnh trong các phiên thảo luận tiếp theo:
- Cơ chế lựa chọn mẫu dữ liệu lỗi (Sampling Strategy): Chọn ngẫu nhiên (Random Sampling) hay chọn theo điểm bất thường cao nhất (Stratified Anomaly Sampling)?
- Khi người dùng xuất báo cáo PDF, cần những biểu đồ trực quan cụ thể nào (Biểu đồ phân phối, biểu đồ tương quan, hay bảng đối chiếu Before/After)?
- Có cần cơ chế cảnh báo khi một bộ dữ liệu có Data Quality Score tụt xuống dưới một ngưỡng sàn định trước (ví dụ < 60%) hay không?
