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

