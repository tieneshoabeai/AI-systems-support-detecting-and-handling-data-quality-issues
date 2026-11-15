# BÁO CÁO TỔNG QUAN HỆ THỐNG (SYSTEM OVERVIEW REPORT)
**Dự án:** Hệ thống AI hỗ trợ phát hiện và xử lý vấn đề về chất lượng dữ liệu  
*(AI-Driven Data Quality Management and Remediation Platform)*  
**Phiên bản:** v1.0  
**Ngày lập:** 18/10/2026  
**Trạng thái tài liệu:** Tài liệu giới thiệu tổng quan dự án (Dành cho mọi đối tượng tiếp cận)

---

## 1. Đặt vấn đề và Mục tiêu cốt lõi

### 1.1. Vấn đề thực tế
Trong kỷ nguyên dữ liệu và trí tuệ nhân tạo, quy luật bất biến là **"Rác vào thì Rác ra" (Garbage In, Garbage Out)**. Dữ liệu thô khi thu thập từ thực tế thường xuyên gặp các lỗi:
- Thiếu thông tin (Missing values - các ô trống).
- Sai lệch, dị biệt (Outliers - ví dụ: tuổi bằng 250 hoặc lương âm).
- Dữ liệu bị trùng lặp (Duplicates).
- Bất nhất định dạng (Inconsistent formats - ví dụ: cùng là ngày tháng nhưng chỗ ghi `DD/MM/YYYY`, chỗ ghi `YYYY-MM-DD`).
- Lỗi logic ngữ nghĩa (Semantic errors - ví dụ: địa chỉ ghi ở Hà Nội nhưng mã bưu điện của TP.HCM).

Nếu các nhà phân tích dữ liệu (Data Analysts) hoặc kỹ sư phải tìm và sửa từng lỗi này bằng tay trên file Excel hoặc viết các câu lệnh SQL rời rạc, quá trình này sẽ ngốn từ **60% đến 80% thời gian** của toàn bộ dự án phân tích, đồng thời rất dễ bỏ sót lỗi nghiêm trọng.

### 1.2. Mục tiêu của hệ thống
Hệ thống được xây dựng như một **"Bác sĩ chuyên khoa khám và chữa bệnh cho dữ liệu"**. Mục tiêu là tự động hóa toàn diện quá trình:
1. Tiếp nhận dữ liệu từ nhiều nguồn khác nhau.
2. Quét, chẩn đoán và chấm điểm "sức khỏe" chất lượng dữ liệu.
3. Ứng dụng AI để phân tích nguyên nhân và đề xuất các giải pháp khắc phục thông minh.
4. Hỗ trợ người dùng thực thi làm sạch dữ liệu với cơ chế hoàn tác an toàn, lưu vết phiên bản và xuất báo cáo kết quả.

---

## 2. Hệ thống hoạt động như thế nào? (Góc nhìn người dùng)

Để dễ hình dung, vòng đời xử lý một bộ dữ liệu trong hệ thống diễn ra qua 5 bước liền mạch:

```
[ Nguồn Dữ Liệu ] (File / Database / Stream)
       │
       ▼
[ 1. Tiếp Nhận & Khám Sơ Bộ ] (Profiling & Ingestion)
       │
       ▼
[ 2. Chẩn Đoán Lỗi Bằng AI & Rule ] (Detection & Scoring)
       │
       ▼
[ 3. Kê Đơn Giải Pháp ] (AI Recommendations)
       │
       ▼
[ 4. Điều Trị & Lưu Vết ] (Remediation & Versioning) ── (Hỗ trợ Undo / Redo)
       │
       ▼
[ 5. Xuất Viện & Báo Cáo ] (PDF Report / Clean Data / Email Alert)
```

### Bước 1: Nạp dữ liệu vào hệ thống (Data Ingestion)
Người dùng (Data Analyst) có thể cấp dữ liệu cho hệ thống qua 3 hình thức:
- Tải file từ máy tính lên: Hỗ trợ định dạng phổ biến như CSV, Excel (`.xlsx`), JSON.
- Kết nối trực tiếp vào cơ sở dữ liệu: Hệ thống kết nối an toàn tới PostgreSQL, MySQL, SQLite để lấy dữ liệu bảng.
- Lắng nghe luồng dữ liệu thời gian thực: Tiếp nhận các bản ghi liên tục thông qua hàng đợi tin nhắn (RabbitMQ).

### Bước 2: Quét lỗi tự động và chấm điểm (Data Profiling & Detection)
Ngay khi nhận dữ liệu, hệ thống tự động phân tích toàn diện:
- Kiểm tra tính đầy đủ: Cột nào bị thiếu bao nhiêu phần trăm?
- Kiểm tra tính hợp lệ: Cột email có đúng định dạng `@` không? Cột số điện thoại có đúng cấu trúc số không?
- Kiểm tra tính dị biệt: Tìm các giá trị ngoại lai bất thường bằng thống kê và thuật toán máy học.
- Đưa ra **Data Quality Score (Điểm chất lượng dữ liệu)** từ 0 đến 100% để người dùng biết ngay dữ liệu của mình đang ở mức tốt, trung bình hay nguy hiểm.

### Bước 3: AI gợi ý giải pháp (AI Recommendations)
Thay vì chỉ báo lỗi rồi để mặc người dùng tự xoay xở, AI của hệ thống sẽ đọc tình trạng lỗi và đưa ra lời khuyên cụ thể kèm lý do:
- *Ví dụ:* "Cột `Tuổi` bị thiếu 5% dữ liệu. Phân phối của cột này có dạng chuẩn, khuyến nghị: Điền giá trị trung bình (Mean Imputation) thay vì xóa dòng để giữ nguyên kích thước mẫu."
- *Ví dụ:* "Cột `Thu nhập` có 3 giá trị ngoại lai gấp 100 lần trung bình. Khuyến nghị: Cắt ngưỡng phân vị 99% (Winsorization) để tránh làm lệch mô hình phân tích."

### Bước 4: Thực thi làm sạch và quản lý lịch sử (Remediation & Versioning)
- Người dùng có thể:
  - Chọn đồng ý với khuyến nghị của AI để hệ thống **tự động sửa**.
  - Hoặc tự tay chọn phương pháp xử lý theo ý muốn nghiệp vụ.
- **Tính năng an toàn tuyệt đối:** Mỗi lần can thiệp sửa đổi, hệ thống sẽ lưu lại một phiên bản dữ liệu mới. Nếu người dùng nhận thấy thao tác vừa rồi không ưng ý, hoàn toàn có thể bấm **Hoàn tác (Undo)** để quay trở lại trạng thái trước đó mà không bao giờ sợ làm hỏng dữ liệu gốc ban đầu.

### Bước 5: Báo cáo và bàn giao kết quả (Reporting & Delivery)
Sau khi dữ liệu đã sạch:
- Xem trước (Preview) vài chục dòng dữ liệu sạch trực tiếp trên màn hình.
- Tải bộ dữ liệu hoàn chỉnh đã làm sạch về máy tính hoặc lưu vào cơ sở dữ liệu mới.
- Xuất toàn bộ quá trình kiểm tra, so sánh dữ liệu trước/sau làm sạch ra file **PDF chuyên nghiệp** để gửi cho cấp quản lý.
- Tự động gửi email thông báo kèm tóm tắt kết quả kiểm tra.

---

## 3. Kiến trúc công nghệ và Lý do lựa chọn

Hệ thống được thiết kế theo các tiêu chuẩn kỹ thuật hiện đại, đảm bảo tính mở rộng, ổn định và hiệu năng:

| Thành phần | Công nghệ lựa chọn | Lý do lựa chọn (Giải trình kỹ thuật) | Phương án đã loại bỏ và lý do |
|---|---|---|---|
| **Backend API** | **NestJS (TypeScript)** | Khung làm việc hướng module chặt chẽ (Modular Architecture), tính đóng gói cao, type-safety mạnh mẽ với TypeScript, chuẩn hóa cho ứng dụng doanh nghiệp. | Express thuần (quá tự do, khó duy trì cấu trúc dự án khi mở rộng quy mô lớn). |
| **Frontend Web** | **React + Vite** | Tốc độ xây dựng ứng dụng (build time) cực nhanh, tối ưu render cho các bảng dữ liệu lớn của Data Analyst, hỗ trợ hoàn hảo cho việc xử lý dữ liệu ngoại tuyến (Offline-first/IndexedDB). | Next.js (hướng tới SEO/SSR là chính, không tối ưu bằng Vite SPA cho dashboard tương tác dữ liệu nặng ở client). |
| **Primary Database** | **MongoDB** | Dữ liệu người dùng tải lên có cấu trúc cột thay đổi liên tục theo từng file; cơ chế lưu trữ tài liệu JSON linh hoạt (Schemaless) của MongoDB phù hợp nhất để lưu metadata, báo cáo kiểm tra và lịch sử phiên bản. | RDBMS thuần (PostgreSQL/MySQL) làm bảng chính (gặp khó khăn khi cấu trúc cột của file tải lên thay đổi liên tục). |
| **Graph Database** | **Neo4j** | Cơ sở dữ liệu đồ thị chuyên biệt để biểu diễn **Data Lineage (Nguồn gốc dữ liệu)**: Giúp trực quan hóa chuỗi quan hệ: Bảng gốc $\to$ Cột A $\to$ Luật kiểm tra B $\to$ Bước sửa C $\to$ Bảng đích. | Lưu đồ thị vào bảng SQL/NoSQL (truy vấn duyệt nhiều cấp cực kỳ chậm và phức tạp). |
| **Message Broker** | **RabbitMQ** | Hàng đợi tin nhắn nhẹ, độ tin cậy cao, quản lý luồng dữ liệu stream ổn định, tiêu tốn ít RAM máy tính, tích hợp tự nhiên với NestJS Microservices. | Apache Kafka (quá nặng, tốn nhiều GB RAM tĩnh, phức tạp vượt mức cần thiết cho môi trường đồ án). |
| **Hạ tầng & Bảo mật** | **Cloudflare SSL + Nginx (HTTPS:443)** | Mã hóa dữ liệu truyền tải toàn trình, chống tấn công tầng mạng, tối ưu phân phối nội dung tĩnh. | HTTP không mã hóa (không đạt tiêu chuẩn bảo mật hiện đại). |
| **Kiểm thử** | **Jest (Unit/E2E) + k6 (Performance)** | Đảm bảo tính đúng đắn của logic tính toán chất lượng dữ liệu và kiểm tra sức chịu tải của hệ thống dưới áp lực nhiều người dùng đồng thời. | Kiểm thử thủ công bằng tay (không đo lường được hiệu năng và dễ sót lỗi hồi quy). |

---

## 4. Điểm đặc biệt: Khả năng thích ứng khi mất kết nối (Offline-first Experience)

Một trong những tiêu chí đặc thù của hệ thống là **Không để trải nghiệm người dùng bị sập khi Backend gặp sự cố**:
- Khi máy chủ Backend bị ngắt kết nối:
  - Giao diện Frontend vẫn duy trì hiển thị bình thường, không văng lỗi màn hình đỏ hay mất giao diện.
  - Các thao tác cơ bản (như nhập form thông tin, lưu dữ liệu nháp) sẽ được lưu tạm thời vào cơ sở dữ liệu nội tại của trình duyệt (**IndexedDB**).
  - Đối với các tính năng bắt buộc phải có máy chủ (như kết nối cơ sở dữ liệu ngoài, nhận dữ liệu stream từ RabbitMQ), giao diện sẽ hiển thị thông báo trạng thái nhẹ nhàng: *"Hệ thống đang ở chế độ ngoại tuyến, chức năng này sẽ tạm dừng cho đến khi kết nối lại"*.
  - Khi Backend online trở lại, hệ thống sẽ tự động kích hoạt tiến trình đồng bộ dữ liệu ngầm.

---

## 5. Những rủi ro, hạn chế kỹ thuật và giải pháp xử lý

Một hệ thống tốt cần nhìn thẳng vào các giới hạn thực tế để có phương án phòng ngừa:

1. **Rủi ro xung đột dữ liệu khi Offline (Offline Sync Conflicts):**
   - *Hạn chế:* Nếu người dùng thao tác offline tạo dữ liệu mới bị trùng với dữ liệu trên máy chủ (ví dụ trùng tài khoản), khi kết nối lại sẽ sinh lỗi xung đột.
   - *Giải pháp:* Không cho phép tạo định danh tài khoản mới khi offline; chỉ cho phép người dùng đã đăng nhập làm việc ở chế độ bản nháp (Draft Mode) với dữ liệu đã được tải về từ trước.
2. **Gánh nặng tài nguyên khi chạy môi trường phát triển (Resource Overhead):**
   - *Hạn chế:* Việc chạy đồng thời MongoDB, Neo4j, RabbitMQ, NestJS và Vite có thể tiêu tốn từ 3GB đến 5GB RAM, dễ gây đơ máy tính có cấu hình tầm trung (8GB–16GB RAM).
   - *Giải pháp:* Cấu hình giới hạn RAM cứng (Resource Limits) trực tiếp trong file `docker-compose.yml` (giới hạn MongoDB 512MB, Neo4j 1GB, RabbitMQ 512MB) để bảo vệ hiệu năng máy tính.
3. **Sự đánh đổi về dung lượng lưu trữ phiên bản dữ liệu (Storage Bloat vs. Latency):**
   - *Hạn chế:* Nếu mỗi bước sửa dữ liệu đều copy nguyên cả bảng dữ liệu mới, dung lượng ổ cứng sẽ tăng vọt theo cấp số nhân. Nhưng nếu chỉ lưu công thức mà không lưu dữ liệu thì khi bấm Hoàn tác (Undo), hệ thống sẽ phải tính toán lại từ đầu gây chậm trễ.
   - *Giải pháp:* Sử dụng cơ chế lai (**Hybrid Checkpointing**): Lưu công thức biến đổi cho các bước nhỏ và chỉ chụp lại bản snapshot dữ liệu sau mỗi mốc thao tác lớn (3–5 bước).
4. **Rủi ro "Ảo giác dữ liệu" của AI (AI Hallucination & Over-imputation):**
   - *Hạn chế:* Nếu trao toàn quyền cho AI tự động sửa, có nguy cơ AI điền các dữ liệu sai lệch làm méo mó bản chất thực của bộ dữ liệu gốc.
   - *Giải pháp:* Luôn áp dụng nguyên tắc **Human-in-the-loop (Con người có quyền kiểm soát tối cao)**: AI chỉ đóng vai trò phân tích và đề xuất; việc áp dụng phải có xác nhận của người dùng hoặc tuân thủ các ngưỡng an toàn định trước.

---

## 6. Lộ trình triển khai các bước tiếp theo

Hệ thống được phát triển theo quy trình kỹ thuật nghiêm ngặt gồm 6 giai đoạn:

```
[ Giai đoạn 1: User Requirement ] ──▶ ĐÃ HOÀN THÀNH (Thể hiện qua báo cáo này)
             │
             ▼
[ Giai đoạn 2: Feature Design ]   ──▶ BƯỚC TIẾP THEO (Phân rã chi tiết từng chức năng, màn hình)
             │
             ▼
[ Giai đoạn 3: Tech Solution ]    ──▶ Thiết kế Data Model, API Specs, Kiến trúc hệ thống
             │
             ▼
[ Giai đoạn 4: Logic / AI ]       ──▶ Thiết kế thuật toán thống kê, luật kiểm tra & Prompt AI
             │
             ▼
[ Giai đoạn 5: Implementation ]   ──▶ Viết code chuẩn mực cho Backend, Frontend, Testing
             │
             ▼
[ Giai đoạn 6: Evaluation ]       ──▶ Đo lường chất lượng, kiểm thử hiệu năng k6, hoàn thiện
```

---
*Tài liệu này là bản đặc tả tổng quan mức cao (High-level Overview). Mọi sửa đổi hoặc bổ sung sau này sẽ được cập nhật và nâng cấp lên phiên bản `report_overview_v2.md` theo quy định quản lý phiên bản của dự án.*
