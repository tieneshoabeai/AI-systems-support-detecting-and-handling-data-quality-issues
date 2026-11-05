# BÁO CÁO 06: KIỂM THỬ VÀ ĐẢM BẢO CHẤT LƯỢNG PHẦN MỀM
## HỆ THỐNG AI HỖ TRỢ PHÁT HIỆN VÀ XỬ LÝ VẤN ĐỀ CHẤT LƯỢNG DỮ LIỆU
### (Full-Stack Data Quality Management Platform with AI Assistance)

---

## 1. CHIẾN LƯỢC KIỂM THỬ PHẦN MỀM TOÀN DIỆN (TESTING STRATEGY)

Để đảm bảo hệ thống đạt độ tin cậy cấp doanh nghiệp (Production-grade), dự án triển khai chiến lược kiểm thử đa tầng dựa trên mô hình **Kim tự tháp Kiểm thử (Testing Pyramid)**:
- **Tầng 1 - Kiểm thử Tĩnh (Static Analysis & Type Verification):** Thực thi kiểm tra kiểu tĩnh khắt khe của TypeScript Compiler (`strict: true`) kết hợp với bộ kiểm thử tự động quét toàn bộ cây cú pháp trừu tượng (AST) để đảm bảo tuân thủ nguyên tắc **Zero Any tuyệt đối**.
- **Tầng 2 - Kiểm thử Đơn vị (Unit Tests):** Kiểm tra tính đúng đắn của các thuật toán xử lý dữ liệu độc lập: băm mật mã học Merkle DAG, mã hóa luồng AES-256-GCM, phân giải User-Agent nhận diện thiết bị, che giấu dữ liệu nhạy cảm PII, và động cơ kiểm tra luật làm sạch.
- **Tầng 3 - Kiểm thử Tích hợp (Integration Tests):** Kiểm tra sự tương tác giữa các tầng ứng dụng (Controllers $\leftrightarrow$ Guards $\leftrightarrow$ Services $\leftrightarrow$ Database Mongoose/Neo4j), xác thực tính toàn vẹn của giao dịch Transactional Outbox.
- **Tầng 4 - Kiểm thử An ninh & Phân quyền (Security & ABAC Tests):** Kiểm thử ma trận phân quyền hạt mịn CASL ABAC theo 4 vai trò người dùng và quét độ bao phủ của các bộ lọc bảo vệ (Guard Coverage).

Hệ thống sử dụng khung kiểm thử tiêu chuẩn công nghiệp: **Jest 29+**, **ts-jest**, và **Supertest**.

---

## 2. DANH MỤC 16 BỘ KIỂM THỬ TỰ ĐỘNG (16 AUTOMATED TEST SUITES)

Toàn bộ các ca kiểm thử được lưu trữ có cấu trúc trong thư mục `src/backend/test/` bao gồm **16 tệp kiểm thử chuyên biệt**:

| STT | Tệp Kiểm thử (`test/*.spec.ts`) | Phạm vi & Trách nhiệm Kiểm thử | Mục tiêu Đảm bảo Chất lượng |
|:---:|---|---|---|
| 1 | **`zero-any.spec.ts`** | Quét toàn bộ mã nguồn (`src/`, `test/`, `scripts/`) tìm kiếm các khai báo `: any`, `as any`, `<any>`. | Cam kết **Zero Any Policy** đạt $100\%$, loại bỏ hoàn toàn các lỗ hổng kiểu dữ liệu thời gian chạy. |
| 2 | **`casl.spec.ts`** | Kiểm thử ma trận phân quyền dựa trên thuộc tính **CASL ABAC** theo 4 vai trò: `admin`, `owner`, `editor`, `viewer`. | Xác thực quyền hạn thao tác tài nguyên theo đúng ngữ cảnh Workspace, chặn triệt để tấn công leo thang ngang IDOR. |
| 3 | **`guard-coverage.spec.ts`** | Quét toàn bộ các Controllers và Endpoints trong hệ thống. | Đảm bảo $100\%$ các API đều được bảo vệ bởi `JwtAuthGuard` hoặc được khai báo tường minh `@Public()`. |
| 4 | **`crypto.spec.ts`** | Kiểm tra hàm băm mật khẩu Argon2id, dẫn xuất khóa PBKDF2 (100,000 vòng) và hàm băm chuỗi Merkle SHA-256. | Xác thực tính ngẫu nhiên của Salt, IV và độ vững chắc của các thuật toán mật mã học. |
| 5 | **`exports.spec.ts`** | Kiểm thử luồng xuất CSV sạch và luồng mã hóa bảo vệ tệp bằng mật khẩu AES-256-GCM. | Xác minh tính nguyên vẹn của tệp xuất, tính hợp lệ của Authentication Tag (16 bytes) và giải mã chính xác. |
| 6 | **`datasets-ingestion.spec.ts`** | Kiểm thử quá trình nạp dữ liệu Multipart qua luồng Busboy, suy luận kiểu Schema và phân đoạn lô 1,000 dòng. | Đảm bảo bộ nhớ RAM $\le 50\text{MB}$ khi nạp tệp và tính toán Checksum SHA-256 chính xác on-the-fly. |
| 7 | **`data-view.spec.ts`** | Kiểm thử phân trang Keyset/Cursor Virtual Grid và tính năng In-place Cell Edit. | Xác thực tốc độ truy vấn $\le 10\text{ms}$ qua toán tử so sánh `row_index > cursor` và cập nhật ô dữ liệu chính xác. |
| 8 | **`clean-rules.spec.ts`** | Kiểm thử 4 nhóm luật làm sạch: `null_handling`, `standardization`, `deduplication`, `regex`. | Xác thực chế độ chạy thử Sandbox Dry-run trên 100 dòng mẫu không ghi đè CSDL và chế độ Apply ghi nhận đúng. |
| 9 | **`versions.spec.ts`** | Kiểm thử Commit phiên bản, tạo snapshot CSV nén, tính toán Merkle Hash và khôi phục tại chỗ In-place Rollback. | Đảm bảo tính nhất quán của chuỗi phiên bản $v_1 \rightarrow v_2 \rightarrow v_3$ và khả năng phục hồi dữ liệu hoàn hảo. |
| 10 | **`lineage.spec.ts`** | Kiểm thử đồng bộ đồ thị Neo4j DAG, truy vết ngược nguồn gốc (Root Cause) và phân tích tác động lan truyền. | Xác thực thuật toán duyệt đồ thị Cypher và cấu trúc payload JSON tương thích thư viện React Flow. |
| 11 | **`mask-pii.spec.ts`** | Kiểm thử thuật toán làm mờ thông tin định danh nhạy cảm (Email, Số điện thoại, CCCD/CMND, Thẻ tín dụng). | Đảm bảo dữ liệu gửi lên các mô hình AI hoặc xuất báo cáo không làm lộ thông tin cá nhân của người dùng. |
| 12 | **`device-detector.spec.ts`** | Kiểm thử bóc tách chuỗi User-Agent thành tên thiết bị, hệ điều hành và trình duyệt. | Nhận diện chính xác các thiết bị phổ biến (macOS, Windows, Linux, iOS, Android, Postman). |
| 13 | **`workspaces.spec.ts`** | Kiểm thử vòng đời không gian làm việc: tạo mới, cập nhật, xóa mềm, thêm/xóa thành viên. | Đảm bảo tính toàn vẹn dữ liệu multi-tenant và kiểm soát quyền sở hữu Workspace Owner. |
| 14 | **`projects.spec.ts`** | Kiểm thử quản lý dự án dữ liệu trực thuộc Workspace và cờ trạng thái `has_dataset`. | Đảm bảo dự án chỉ liên kết với 1 tập dữ liệu duy nhất tại một thời điểm. |
| 15 | **`storage.spec.ts`** | Kiểm thử adapter Cloudflare R2 / S3 Client, cơ chế sinh Presigned URL và xử lý lỗi mạng. | Xác thực tính tương thích của tệp lưu trữ và khả năng fallback an toàn khi gặp sự cố đám mây. |
| 16 | **`zod-openapi.spec.ts`** | Kiểm thử tính đồng bộ giữa Zod Validation Schemas và tài liệu Swagger OpenAPI 3.0. | Đảm bảo tài liệu API Swagger luôn phản ánh chính xác các quy tắc kiểm tra kiểu dữ liệu của mã nguồn. |

---

## 3. NGUYÊN TẮC ZERO ANY TUYỆT ĐỐI VÀ KIỂM THỬ TĨNH (STATIC ANALYSIS)

### 3.1. Bản chất Kỹ thuật của Quy tắc Zero Any
Trong TypeScript, kiểu `any` là nguyên nhân hàng đầu gây ra các lỗi sập chương trình thời gian chạy (Runtime Crashes) do phá vỡ hoàn toàn hệ thống kiểm tra kiểu tĩnh của trình biên dịch. Dự án thiết lập nguyên tắc **Zero Any tuyệt đối** (Mục 13 WORKING RULE):
- Cấm hoàn toàn: Không `: any`, không ép kiểu `as any`, không dùng generic `<any>`, không dùng `Record<string, any>`.
- Khối bắt lỗi `try...catch`: Bắt buộc sử dụng `catch (err: unknown)` và thu hẹp kiểu an toàn qua Type Guard:
  ```typescript
  const message = err instanceof Error ? err.message : String(err);
  ```
- Dữ liệu chưa xác định cấu trúc: Bắt buộc dùng `unknown`, Generics `<T>`, hoặc Zod Inferred Schema (`z.infer<typeof Schema>`).

### 3.2. Cơ chế Thực thi Kiểm thử Tự động trong `zero-any.spec.ts`
Để ngăn chặn lập trình viên vô tình đưa kiểu `any` vào mã nguồn, tệp `test/zero-any.spec.ts` tự động quét đệ quy toàn bộ thư mục `src/`, `test/`, và `scripts/`:
1. Phân tích từng dòng tệp mã nguồn TypeScript bằng biểu thức chính quy khắt khe nhằm phát hiện:
   - `:\s*any\b`
   - `as\s+any\b`
   - `<\s*any\s*>`
   - `Record<\s*string\s*,\s*any\s*>`
2. Bỏ qua các vị trí trong comment hoặc chuỗi ký tự hợp lệ.
3. Nếu phát hiện bất kỳ vị trí nào vi phạm, bài kiểm thử sẽ lập tức báo lỗi đỏ (Fail Test), chỉ ra chính xác tệp tin và số dòng vi phạm, ngăn chặn việc commit mã nguồn không đạt chuẩn vào Git repository.

---

## 4. MA TRẬN KIỂM THỬ PHÂN QUYỀN CASL ABAC (`test/casl.spec.ts`)

Bài kiểm thử `test/casl.spec.ts` xác thực toàn diện ma trận phân quyền dựa trên thuộc tính:

| Hành vi Kiểm thử Nghiệp vụ | Admin | Workspace Owner | Workspace Editor | Workspace Viewer | Kết quả Mong đợi |
|---|:---:|:---:|:---:|:---:|:---:|
| **Quản trị toàn hệ thống (`Action.Manage, 'all'`)** | **Cho phép** | Từ chối | Từ chối | Từ chối | Pass 100% |
| **Quản lý Workspace (`Action.Manage, 'Workspace'`)** | **Cho phép** | **Cho phép** | Từ chối | Từ chối | Pass 100% |
| **Tạo Dataset mới trong Workspace** | **Cho phép** | **Cho phép** | **Cho phép** | Từ chối | Pass 100% |
| **Áp dụng Luật làm sạch (`Action.Execute, 'CleanRule'`)** | **Cho phép** | **Cho phép** | **Cho phép** | Từ chối | Pass 100% |
| **Xóa Dataset (`Action.Delete, 'Dataset'`)** | **Cho phép** | **Cho phép** | Từ chối | Từ chối | Pass 100% |
| **Xem Dữ liệu & Đồ thị Phả hệ (`Action.Read`)** | **Cho phép** | **Cho phép** | **Cho phép** | **Cho phép** | Pass 100% |
| **Truy cập tài nguyên thuộc Workspace khác (IDOR Test)** | **Cho phép** | **Chặn (403)** | **Chặn (403)** | **Chặn (403)** | Pass 100% |

---

## 5. KẾT LUẬN VÀ TIÊU CHUẨN NGHIỆM THU CHẤT LƯỢNG

Bộ kiểm thử tự động của dự án mang lại 3 giá trị bảo đảm kỹ thuật cốt lõi:
1. **Độ tin cậy hồi quy (Regression Resilience):** Mọi sự thay đổi về mặt logic hoặc nâng cấp phiên bản thư viện đều được kiểm chứng qua 16 bộ test suites; nếu có bất kỳ sự sai lệch nào về hợp đồng dữ liệu API hoặc công thức băm Merkle, hệ thống kiểm thử sẽ phát hiện tức thời.
2. **An toàn bảo mật đa tầng:** Đảm bảo $100\%$ các endpoint nhạy cảm đều được bảo vệ bởi Guards, loại bỏ hoàn toàn các lỗ hổng quên gắn middleware xác thực.
3. **Mã nguồn sạch và dễ bảo trì:** Việc loại bỏ hoàn toàn kiểu `any` giúp mã nguồn có tính tự tài liệu hóa (Self-documenting), hỗ trợ tính năng tự động gợi ý code (IntelliSense) hoàn hảo và an toàn tuyệt đối khi tái cấu trúc (Refactoring).
