# ĐẶC TẢ TÍNH NĂNG HỆ THỐNG - GIAI ĐOẠN 1 (CORE PLATFORM FEATURE SPECIFICATION)
**Dự án:** Nền tảng Full-stack Quản lý & Giám sát Chất lượng Dữ liệu có AI Hỗ trợ  
**Tập tin:** `docs/feature_spec_v1.md`  
**Phiên bản:** v1.0  
**Giai đoạn áp dụng:** Giai đoạn 1 (Core Platform MVP - Khung nền tảng chạy độc lập)  
**Ngày lập:** 19/10/2026  
**Trạng thái tài liệu:** Bản đặc tả chi tiết danh mục tính năng, luồng người dùng và tiêu chí nghiệm thu  

---

## 1. Mục tiêu và Phạm vi của Giai đoạn 1 (Core Platform MVP)

### 1.1. Mục tiêu cốt lõi
Xây dựng hoàn chỉnh một ứng dụng Full-stack có khả năng vận hành độc lập, ổn định 100%, phục vụ đầy đủ vòng đời làm việc cơ bản của Data Analyst:
1. Tiếp nhận dữ liệu từ các tệp tin phổ biến (CSV, Excel, JSON).
2. Quản lý tài khoản, phân quyền và tổ chức dữ liệu theo Không gian làm việc (Workspaces).
3. Khám phá dữ liệu qua Bảng tương tác ảo hóa (Virtual Data Grid) và Biểu đồ thống kê phân phối (Visualization).
4. Cung cấp bộ công cụ biến đổi, làm sạch dữ liệu thủ công với cơ chế an toàn: Lưu phiên bản (Data Versioning) và Hoàn tác từng bước (Undo/Redo).
5. Xuất dữ liệu sạch ra tệp tải về và lưu trữ vào MongoDB.
6. Thiết lập sẵn các trường dữ liệu dự phòng và Interface trừu tượng để sẵn sàng cắm Động cơ AI vào ở Giai đoạn 2.

### 1.2. Phạm vi loại trừ ở Giai đoạn 1 (Sẽ thực hiện ở Giai đoạn 2)
- Chưa tích hợp Động cơ Máy học Unsupervised ML (Isolation Forest, LOF, KS-Test).
- Chưa tích hợp Cloud LLM API (Gemini API) để sinh báo cáo giải thích bằng ngôn ngữ tự nhiên.
- Chưa kết nối trực tiếp CSDL ngoài (RDBMS Connectors) và luồng tin nhắn sự kiện (RabbitMQ Streaming).
- Chưa xuất báo cáo PDF tổng hợp tự động.

---

## 2. Ma trận Tính năng Toàn diện Giai đoạn 1 (Feature Matrix)

| Mã tính năng | Tên tính năng | Phân hệ trực thuộc | Mức độ ưu tiên | Mô tả tóm tắt |
|:---:|---|---|:---:|---|
| **AUTH-01** | Đăng ký & Đăng nhập JWT | Phân hệ 1: Auth & Access Control | P0 (Bắt buộc) | Xác thực người dùng, cấp phát cặp Access Token (15m) và Refresh Token (7d). |
| **AUTH-02** | Quản lý Phiên & Đăng xuất | Phân hệ 1: Auth & Access Control | P0 (Bắt buộc) | Thu hồi Refresh Token, làm mới phiên làm việc tự động qua Axios Interceptor. |
| **WS-01** | Quản lý Không gian làm việc | Phân hệ 3: Workspace & Catalog | P0 (Bắt buộc) | Tạo, đổi tên, xóa Workspace; gom nhóm các tập dữ liệu theo dự án. |
| **FILE-01** | Upload tệp đa định dạng | Phân hệ 2: Data Ingestion Hub | P0 (Bắt buộc) | Tải lên CSV, Excel (`.xlsx`), JSON qua kéo thả; kiểm tra kích thước và MIME type. |
| **FILE-02** | Trích xuất Metadata & Schema | Phân hệ 2: Data Ingestion Hub | P0 (Bắt buộc) | Phân tích cú pháp tệp, đếm số dòng, số cột, phỏng đoán kiểu dữ liệu từng cột. |
| **FILE-03** | Chuẩn hóa JSON lồng nhau | Phân hệ 2: Data Ingestion Hub | P1 (Quan trọng) | Làm phẳng JSON phân cấp theo Dot-notation (giới hạn độ sâu tối đa 3 cấp). |
| **GRID-01** | Bảng dữ liệu tương tác ảo hóa | Phân hệ 3: Workspace & Catalog | P0 (Bắt buộc) | Render hàng chục nghìn dòng mượt mà qua Virtual Scrolling; hỗ trợ phân trang server. |
| **GRID-02** | Tìm kiếm, Lọc & Sắp xếp | Phân hệ 3: Workspace & Catalog | P1 (Quan trọng) | Lọc bản ghi theo cột, tìm kiếm từ khóa toàn cục, sắp xếp tăng/giảm dần. |
| **VIS-01** | Thẻ tóm tắt chỉ số cột | Phân hệ 4: Data Visualization | P0 (Bắt buộc) | Hiển thị Min, Max, Mean, Median, Tỷ lệ Null, Số lượng giá trị duy nhất (Cardinality). |
| **VIS-02** | Biểu đồ phân phối cột | Phân hệ 4: Data Visualization | P1 (Quan trọng) | Vẽ Histogram cho cột số, Bar Chart cho cột danh mục (Categorical). |
| **TRANS-01**| Xử lý giá trị khuyết thiếu | Phân hệ 5: Transformation Engine | P0 (Bắt buộc) | Bỏ dòng null, điền giá trị cố định, điền giá trị trung bình/trung vị/yếu vị. |
| **TRANS-02**| Chuẩn hóa chuỗi ký tự | Phân hệ 5: Transformation Engine | P1 (Quan trọng) | Cắt khoảng trắng thừa (Trim), đổi chữ hoa/thường, tìm kiếm và thay thế chuỗi. |
| **TRANS-03**| Xóa/Đổi tên cột dữ liệu | Phân hệ 5: Transformation Engine | P1 (Quan trọng) | Loại bỏ các cột không sử dụng, đổi tên trường dữ liệu chuẩn hóa. |
| **VER-01**  | Tự động tạo phiên bản dữ liệu | Phân hệ 5: Versioning & Rollback | P0 (Bắt buộc) | Tạo mốc phiên bản mới ($v_1 \to v_2$) kèm nhật ký biến đổi (Changelog) sau mỗi thao tác. |
| **VER-02**  | Hoàn tác từng bước (Undo/Redo)| Phân hệ 5: Versioning & Rollback | P0 (Bắt buộc) | Cho phép hoàn tác về trạng thái trước đó an toàn mà không mất dữ liệu gốc. |
| **VER-03**  | Ghi nhận đồ thị Lineage | Phân hệ 5: Versioning & Rollback | P1 (Quan trọng) | Ghi nhận quan hệ biến đổi giữa các phiên bản vào cơ sở dữ liệu Neo4j. |
| **EXP-01**  | Xem trước & Tải tệp sạch | Phân hệ 6: Data Exporter | P0 (Bắt buộc) | Xem trước 20–50 dòng kết quả; tải về toàn bộ tệp sạch dạng CSV, Excel, JSON. |
| **EXP-02**  | Lưu dữ liệu sạch vào Database | Phân hệ 6: Data Exporter | P1 (Quan trọng) | Lưu tệp sạch thành một tập dữ liệu chính thức mới trong MongoDB. |
| **OFF-01**  | Cảnh báo trạng thái Ngoại tuyến | Phân hệ 8: Offline Resilience | P1 (Quan trọng) | Hiển thị Banner trạng thái mạng (Online/Offline), không crash giao diện khi BE tắt. |

---

## 3. Đặc tả Chi tiết từng Module Tính năng (Detailed Specifications)

### Module 1: Quản trị Tài khoản & Phân quyền (AUTH)

#### AUTH-01: Đăng ký & Đăng nhập bảo mật
- **Luồng người dùng (User Flow):**
  1. Người dùng truy cập `/register`, nhập Họ tên, Email, Mật khẩu (tối thiểu 8 ký tự, có chữ hoa, số và ký tự đặc biệt).
  2. Backend kiểm tra tính duy nhất của Email. Mật khẩu được băm bằng thuật toán `bcrypt` (Salt round = 10) trước khi lưu vào MongoDB collection `users`.
  3. Người dùng truy cập `/login`, nhập Email và Mật khẩu.
  4. Backend xác thực, sinh ra:
     - `accessToken` (JWT, hạn dùng 15 phút, chứa `userId`, `email`, `role`).
     - `refreshToken` (JWT, hạn dùng 7 ngày, lưu mã băm vào MongoDB để kiểm soát thu hồi).
  5. Frontend lưu `accessToken` vào Memory (hoặc Cookie httpOnly) và điều hướng vào trang Dashboard.
- **Tiêu chí nghiệm thu (Acceptance Criteria):**
  - Không chấp nhận email trùng lặp (trả về lỗi `409 Conflict`).
  - Mật khẩu sai quá 5 lần liên tiếp sẽ bị khóa tạm thời 15 phút.
  - Token hết hạn sẽ tự động được làm mới ngầm bằng `refreshToken` qua Axios Interceptor mà không làm gián đoạn phiên người dùng.

---

### Module 2 & 3: Quản lý Không gian làm việc & Tiếp nhận Tệp dữ liệu (WS & FILE)

#### WS-01: Quản lý Workspace
- Cho phép người dùng tạo các thư mục dự án riêng biệt (ví dụ: "Dự án Khảo sát Nhân sự 2026", "Phân tích Doanh số Q4").
- Mỗi tập dữ liệu tải lên bắt buộc phải thuộc về một Workspace cụ thể.

#### FILE-01 & FILE-02: Upload tệp & Trích xuất Metadata
- **Luồng người dùng (User Flow):**
  1. Trong Workspace, người dùng bấm nút **"Tải lên tệp mới" (Upload Dataset)** hoặc kéo thả file vào khung quy định.
  2. Frontend kiểm tra nhanh phía Client: Định dạng file phải là `.csv`, `.xlsx`, `.json`; dung lượng $\le 50\text{MB}$ (với CSV/JSON) hoặc $\le 20\text{MB}$ (với Excel). Nếu vi phạm, hiển thị thông báo từ chối ngay lập tức.
  3. File được truyền tải lên Backend NestJS qua `multipart/form-data` (sử dụng thư viện `multer`).
  4. Backend lưu file tạm vào vùng đệm, kích hoạt luồng bóc tách (Streaming Parser):
     - File CSV: Sử dụng `csv-parser` hoặc `papaparse`.
     - File Excel: Sử dụng thư viện `exceljs` đọc dữ liệu theo từng dòng (Streaming Reader) để tiết kiệm RAM.
     - File JSON: Kiểm tra tính hợp lệ cú pháp JSON. Nếu có cấu trúc lồng nhau, kích hoạt bộ làm phẳng **Schema Normalizer** theo quy ước Dot-notation (tối đa 3 cấp).
  5. Backend lưu thông tin tệp vào MongoDB collection `datasets` với `version = 1`.
- **Dữ liệu Metadata sinh ra:**
  - Tên tệp, dung lượng thực tế, số lượng bản ghi (rows), số lượng cột (columns).
  - Danh sách cột kèm kiểu dữ liệu phỏng đoán ban đầu (`integer`, `float`, `string`, `date`, `boolean`).
  - **Trường dự phòng AI:** Khởi tạo sẵn `ai_profile: null`, `ai_recommendations: []` (đáp ứng nguyên tắc AI-Ready).

---

### Module 4: Khám phá Dữ liệu & Trực quan hóa (GRID & VIS)

#### GRID-01 & GRID-02: Bảng dữ liệu tương tác ảo hóa (Virtual Data Grid)
- **Vấn đề kỹ thuật:** Render 100,000 dòng dữ liệu trên bảng HTML thông thường sẽ làm crash tab trình duyệt.
- **Giải pháp kiến trúc:**
  - Frontend sử dụng kỹ thuật **Virtual Scrolling** (sử dụng thư viện `@tanstack/react-virtual` hoặc `ag-grid-react` bản Community).
  - Chỉ render đúng 25–30 phần tử DOM đang hiển thị trong khung nhìn (Viewport) của màn hình. Khi người dùng cuộn chuột, các dòng mới được cập nhật nội dung tức thì.
  - Hỗ trợ phân trang Server-side: Mỗi lần gọi API lấy về 100 dòng (`limit=100`, `skip=0`).
- **Tính năng tương tác:**
  - Tìm kiếm nhanh từ khóa (Global Search).
  - Lọc dữ liệu theo từng cột (ví dụ: Lọc `Lương > 10,000,000` hoặc Lọc `Trạng thái == 'COMPLETED'`).
  - Sắp xếp tăng/giảm dần theo cột số hoặc bảng chữ cái.

#### VIS-01 & VIS-02: Thống kê mô tả & Biểu đồ phân phối
- Khi người dùng nhấp vào tiêu đề của một cột trên bảng, hệ thống hiển thị bảng điều khiển phụ (Drawer / Modal):
  - **Với cột số (Numerical):** Hiển thị thẻ tóm tắt (Min, Max, Mean, Median, Tỷ lệ Null). Vẽ biểu đồ **Histogram** biểu diễn phân phối tần suất của cột (sử dụng thư viện `Recharts` hoặc `Chart.js`).
  - **Với cột danh mục (Categorical):** Hiển thị Top 5 giá trị xuất hiện nhiều nhất và vẽ biểu đồ thanh ngang (**Bar Chart**).

---

### Module 5 & 6: Bộ công cụ Xử lý Dữ liệu, Quản lý Phiên bản & Hoàn tác (TRANS & VER)

Đây là phân hệ nghiệp vụ cốt lõi tạo ra giá trị làm sạch dữ liệu của hệ thống:

```
[ DỮ LIỆU GỐC (v1) ] ──▶ [ CHỌN PHÉP BIẾN ĐỔI ] ──▶ [ XEM PREVIEW ] ──▶ [ XÁC NHẬN commit ]
                                                                                │
                                                                                ▼
[ HOÀN TÁC (Undo) ] ◀────────────────────────────────────────────────── [ TẠO BẢN v2 ]
(Khôi phục lại v1 an toàn)                                               (Lưu vết MongoDB + Neo4j)
```

#### TRANS-01: Xử lý Giá trị Khuyết thiếu (Missing Value Handler)
Người dùng chọn cột cần xử lý và chọn một trong các hành động:
1. `DROP_ROWS_WITH_NULL`: Xóa toàn bộ các dòng có ô trống tại cột được chọn.
2. `FILL_CUSTOM_VALUE`: Điền một giá trị cố định do người dùng nhập (ví dụ: `"Chưa xác định"`, `0`).
3. `IMPUTE_STATISTICAL`: Điền bằng chỉ số thống kê của cột:
   - Điền giá trị trung bình (Mean).
   - Điền giá trị trung vị (Median - khuyến nghị khi dữ liệu có ngoại lai lệch).
   - Điền giá trị yếu vị (Mode - giá trị xuất hiện nhiều nhất, áp dụng cho cột chuỗi).

#### TRANS-02: Chuẩn hóa Chuỗi ký tự (String Sanitizer)
- `TRIM_WHITESPACE`: Loại bỏ khoảng trắng thừa ở đầu, cuối và khoảng trắng kép ở giữa chuỗi.
- `CHANGE_CASE`: Chuyển đổi toàn bộ thành chữ hoa (`UPPERCASE`), chữ thường (`lowercase`), hoặc viết hoa chữ cái đầu (`Capitalize`).
- `REGEX_REPLACE`: Tìm kiếm theo chuỗi hoặc biểu thức chính quy để thay thế (ví dụ: loại bỏ ký tự tiền tệ `$` hoặc dấu phẩy trong cột số).

#### VER-01 & VER-02: Cơ chế Lưu Phiên bản & Hoàn tác an toàn (Undo/Redo Engine)
- **Kiến trúc lưu trữ phiên bản:** Áp dụng mô hình **Changelog Recipe + Snapshot Checkpoint**:
  - Mỗi khi thực thi một phép biến đổi thành công, hệ thống tăng chỉ số phiên bản: $v_{\text{current}} = v_{\text{previous}} + 1$.
  - Lưu vào collection `dataset_versions`:
    ```json
    {
      "dataset_id": "dataset_001",
      "version": 2,
      "previous_version": 1,
      "transformation_recipe": {
        "action": "IMPUTE_STATISTICAL",
        "target_column": "salary",
        "parameters": { "method": "median", "value": 15000000 }
      },
      "rows_affected": 45,
      "created_at": "2026-10-19T20:30:00Z"
    }
    ```
- **Thao tác Hoàn tác (Undo):**
  - Người dùng bấm nút **"Hoàn tác" (Undo)** trên thanh công cụ.
  - Hệ thống chuyển con trỏ phiên bản hiện tại về $v_1$. Dữ liệu hiển thị trên bảng lập tức quay lại trạng thái trước khi thực hiện phép biến đổi trong vòng chưa đầy 1 giây.
- **Ghi nhận Lineage trên Neo4j (VER-03):**
  - Hệ thống tự động tạo Node và Relationship trên Neo4j:
    `(:DatasetVersion {v: 1}) -[:TRANSFORMED_BY {action: 'IMPUTE_MEDIAN'}]-> (:DatasetVersion {v: 2})`.

---

### Module 7: Xuất bản Dữ liệu (EXP)

#### EXP-01 & EXP-02: Tải về và Lưu trữ Dữ liệu Sạch
- Người dùng có thể:
  1. Bấm **"Xem trước kết quả" (Preview Clean Data)**: Hiển thị 20 dòng đầu tiên của tập dữ liệu sau khi đã trải qua chuỗi biến đổi.
  2. Bấm **"Tải về máy" (Download Export)**: Chọn định dạng xuất bản:
     - CSV (mã hóa UTF-8 có BOM để mở tiếng Việt không bị lỗi font trên Excel).
     - Excel (`.xlsx`).
     - JSON Array.
  3. Bấm **"Lưu thành tập dữ liệu mới" (Save as New Dataset)**: Nhân bản dữ liệu sạch thành một Dataset độc lập trong Workspace để phục vụ các dự án phân tích tiếp theo.

---

### Module 8: Tầng Ngoại tuyến Cơ bản (OFF)

#### OFF-01: Chế độ Suy thoái Nhẹ nhàng (Graceful Degradation)
- Frontend tích hợp listener theo dõi sự kiện mạng `window.addEventListener('online')` và `offline`.
- Khi Backend NestJS bị ngắt hoặc máy mất mạng:
  - Một thanh thông báo màu vàng (**Offline Banner**) xuất hiện ở đầu màn hình: *"Mất kết nối tới máy chủ. Hệ thống đang chuyển sang chế độ xem ngoại tuyến"*.
  - Người dùng vẫn có thể xem lại dữ liệu của bảng hiện tại đã được nạp vào bộ nhớ đệm (IndexedDB).
  - Các nút hành động cần gọi Backend (như bấm Lưu phiên bản mới, Upload file mới) sẽ hiển thị trạng thái vô hiệu hóa (Disabled) kèm tooltip giải thích nhẹ nhàng, **tuyệt đối không để ứng dụng crash hoặc văng lỗi màn hình đỏ**.

---

## 4. Điểm yếu, Đánh đổi Kỹ thuật và Biện pháp Phòng ngừa trong Giai đoạn 1

| Tính năng | Điểm yếu / Rủi ro kỹ thuật tiềm ẩn | Giải pháp kiểm soát chính thức |
|---|---|---|
| **Virtual Data Grid** | Nếu người dùng mở trên trình duyệt di động hoặc máy cấu hình yếu, việc tính toán vị trí cuộn có thể bị giật khung hình (FPS Drop). | Giới hạn số lượng cột hiển thị mặc định tối đa 15 cột; các cột còn lại cho phép ẩn/hiện tùy chọn qua menu chọn cột. |
| **Phân tích File Excel lớn** | Đọc file Excel `.xlsx` dung lượng 20MB có thể làm tốn 150MB–200MB RAM máy chủ nếu dùng thư viện đọc toàn bộ (DOM-based parser). | Bắt buộc sử dụng cơ chế đọc luồng (Streaming Reader với `exceljs`) để phân tích từng dòng một mà không nạp toàn bộ file vào RAM. |
| **Lưu trữ Lịch sử Phiên bản** | Nếu mỗi bước làm sạch đều nhân bản toàn bộ bảng dữ liệu trong MongoDB, dung lượng ổ cứng sẽ tăng rất nhanh. | Áp dụng cơ chế **Delta Logging**: Chỉ lưu tập các dòng bị thay đổi (Modified Rows) và công thức biến đổi; chỉ chụp Full Snapshot khi người dùng chủ động bấm "Lưu mốc cố định". |
| **Xung đột phiên làm việc** | Nếu người dùng mở 2 tab cùng sửa một bộ dữ liệu, bước Undo của tab A có thể xung đột với bước làm sạch của tab B. | Sử dụng cơ chế khóa lạc quan (**Optimistic Locking**) dựa trên trường `version` trong MongoDB. Nếu phiên bản trên server lệch với phiên bản client đang giữ, hệ thống yêu cầu tải lại dữ liệu mới nhất. |

---

## 5. Tiêu chí Đánh giá Hoàn thành Giai đoạn 1 (Definition of Done - DoD)

Giai đoạn 1 được coi là hoàn thành thành công và sẵn sàng chuyển sang tích hợp AI khi đạt đủ 6 tiêu chí sau:
1. **Chức năng toàn vẹn:** Người dùng có thể đăng ký, đăng nhập, tải lên 1 file CSV/Excel 50,000 dòng, xem mượt mà trên Data Grid, thực hiện bỏ dòng null, điền trung vị, bấm Undo và tải về file sạch hoàn chỉnh.
2. **Kiểm thử Đơn vị (Unit Test):** Toàn bộ các hàm biến đổi dữ liệu (Drop, Impute, Trim, Replace) đạt độ bao phủ kiểm thử (Test Coverage) tối thiểu **80%** qua Jest.
3. **Kiểm thử Tích hợp (E2E Test):** Luồng người dùng từ Upload $\to$ Transform $\to$ Export chạy thành công tự động qua Supertest.
4. **Kiểm tra rò rỉ bộ nhớ (Memory Leak):** Quá trình upload và xử lý file 200,000 dòng không làm tăng RAM của Backend NestJS vượt quá 512MB sau khi hoàn tất tác vụ (đã qua cơ chế dọn rác Garbage Collection).
5. **Cấu trúc AI-Ready:** Các trường dữ liệu dự phòng cho AI đã tồn tại sẵn trong Document MongoDB mà không phát sinh lỗi validation.
6. **Tài liệu hóa Module:** Mỗi module Backend đều có thư mục riêng, tài liệu `README.md` mô tả các endpoints API, input/output payload.
