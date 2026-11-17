# 05. YÊU CẦU PHI CHỨC NĂNG (NON-FUNCTIONAL REQUIREMENTS)

**Phân nhóm theo:** ISO/IEC 25010
**Nguồn:** [feature_spec_v4](../feature_spec_v4.md), [report_overview_v5](../report_overview_v5.md), [01_business_context](../01_business_context_and_objectives.md), [05_core_mechanisms](../05_core_mechanisms_and_cryptography.md), [06_testing](../06_testing_and_quality_assurance.md), [README](../../README.md)
**Quyết định đã chốt:** bcrypt salt 12; độ trễ Data Grid < 100 ms (xem [01_boi-canh](01_boi-canh.md), [02_pham-vi](02_pham-vi.md)).

---

## 5.1. Bảo mật (Security) — `SEC`

| ID | Yêu cầu | Chỉ số / Điều kiện đạt | Cách kiểm chứng | Nguồn |
|---|---|---|---|---|
| NFR-SEC-01 | Mật khẩu được băm một chiều trước khi lưu, không bao giờ trả về client | bcrypt, salt rounds = 12; trường hash có `select: false` | Unit test; kiểm tra response API | Quyết định nhóm, README |
| NFR-SEC-02 | Xác thực bằng JWT có thời hạn ngắn, kèm refresh token gắn với phiên | Access token 15 phút; refresh token 7 ngày; chỉ lưu SHA-256 của refresh token | Test hết hạn token → `401` | Spec F1.2, F1.6 |
| NFR-SEC-03 | Token đặt lại mật khẩu dùng một lần và có hạn | 32 byte ngẫu nhiên, lưu SHA-256, hạn 15 phút, `used = true` sau khi dùng | Test dùng lại token → `400` | Spec F1.4, F1.5 |
| NFR-SEC-04 | Chống dò tìm tài khoản (user enumeration) | Đăng nhập sai luôn cùng một thông báo; quên mật khẩu luôn `200` cùng một thông báo | So sánh response email có/không tồn tại | Spec F1.2, F1.4 |
| NFR-SEC-05 | Phân quyền theo thuộc tính (ABAC), cô lập dữ liệu giữa người dùng | 0 trường hợp truy cập được tài nguyên của người khác (IDOR) | Bộ test phân quyền (`casl.spec.ts`) | Báo cáo 01, 06 |
| NFR-SEC-06 | Mọi endpoint phải được bảo vệ bằng xác thực hoặc khai báo công khai tường minh | 100% endpoint | Test tự động quét controller (`guard-coverage.spec.ts`) | README |
| NFR-SEC-07 | Thu hồi quyền truy cập tức thì khi khóa tài khoản / đặt lại mật khẩu | Mọi phiên bị hủy; refresh sau đó → `401`/`403` | Test tích hợp | Spec F1.5, F2.6 |
| NFR-SEC-08 | Mã hóa kênh truyền | HTTPS/TLS qua cổng 443 (Cloudflare Tunnel); header HSTS `max-age=31536000; includeSubDomains; preload` | Kiểm tra header response | README |
| NFR-SEC-09 | Mã hóa tệp xuất khi người dùng yêu cầu | AES-256-GCM; khóa dẫn xuất PBKDF2-HMAC-SHA256 100.000 vòng, 32 byte; salt 16 byte, IV 12 byte, auth tag 16 byte | Giải mã thử; sửa 1 byte → giải mã thất bại | Spec F9.1, báo cáo 05 |
| NFR-SEC-10 | Chống injection CSDL | 100% truy vấn MongoDB qua query builder, 100% Cypher dùng tham số `$param` | Review code | README |
| NFR-SEC-11 | Che thông tin cá nhân (PII) trong log | Email, số điện thoại, CCCD bị che (vd. `us***@gmail.com`); không log token/mật khẩu | Test `mask-pii.spec.ts` | README |
| NFR-SEC-12 | Không lưu bí mật trong mã nguồn | Mọi khóa/mật khẩu qua biến môi trường; `.env` bị loại khỏi git | Review `.gitignore`, quét repo | README |
| NFR-SEC-13 | Giới hạn tần suất gọi API (rate limiting) cho các endpoint xác thực | Nhóm xác thực (đăng ký, đăng nhập, quên mật khẩu): 5 request/phút/IP; API còn lại: 100 request/phút/người dùng; vượt ngưỡng → `429` | Test gửi vượt ngưỡng → `429` | Quyết định nhóm (README backend có ThrottlerGuard nhưng không ghi số liệu) |

## 5.2. Hiệu năng (Performance Efficiency) — `PERF`

| ID | Yêu cầu | Chỉ số | Cách kiểm chứng | Nguồn |
|---|---|---|---|---|
| NFR-PERF-01 | Truy vấn Data Grid nhanh | < 100 ms mỗi trang (pageSize ≤ 200) trên Dataset ≤ 200.000 dòng | Đo thời gian API / k6 | Spec F6.1 |
| NFR-PERF-02 | Nạp và xuất tệp không phụ thuộc kích thước tệp về bộ nhớ | RAM tiến trình ≤ 50 MB khi nạp/xuất tệp ở giới hạn tối đa | Theo dõi heap khi upload tệp 50 MB | Báo cáo 01, 05 |
| NFR-PERF-03 | Xuất tệp đọc dữ liệu theo lô | Cursor MongoDB, lô 1.000 dòng, ghi trực tiếp ra luồng | Review code, đo RAM | Spec F9.1 |
| NFR-PERF-04 | Phép biến đổi dữ liệu hoàn tất nhanh | < 5 giây với Dataset ≤ 200.000 dòng | Đo thời gian API F7.1 | Report v5 mục 5 |
| NFR-PERF-05 | Danh sách người dùng không suy giảm khi dữ liệu lớn | Phân trang con trỏ, không dùng `skip()` | Review code | Spec F2.4 |

## 5.3. Độ tin cậy & toàn vẹn (Reliability) — `REL`

| ID | Yêu cầu | Chỉ số | Cách kiểm chứng | Nguồn |
|---|---|---|---|---|
| NFR-REL-01 | Mọi phiên bản có mã băm liên kết với phiên bản cha | 100% phiên bản có `version_hash`, `parent_hash` (v1 dùng 64 ký tự `0`) | API F8.4 trả `isChainValid = true` | Spec F8.1, F8.4; báo cáo 05 |
| NFR-REL-02 | Phát hiện sửa đổi trái phép trực tiếp trong CSDL | Sửa 1 ô dữ liệu/phiên bản → F8.4 báo `brokenVersion` đúng vị trí | Test cố ý sửa CSDL | Spec F8.4 |
| NFR-REL-03 | Không mất cập nhật khi thao tác đồng thời | Khóa lạc quan theo `currentVersion` → `409` khi lệch | Test 2 request song song | Spec F7.1 |
| NFR-REL-04 | Đồng bộ nhất quán giữa MongoDB và Neo4j | Ghi MongoDB và sự kiện outbox trong cùng transaction; worker đồng bộ sang Neo4j có thử lại | Test ngắt Neo4j rồi khôi phục: lineage vẫn đầy đủ | Báo cáo 05 mục 5 |
| NFR-REL-05 | Dữ liệu có thể khôi phục sau khi xóa | Xóa mềm bằng `deleted_at`; unique index chỉ áp dụng với bản ghi chưa xóa | Test xóa → khôi phục | Spec v4.1, README |
| NFR-REL-06 | Kiểm tra toàn vẹn tệp tải lên | `fileChecksum` SHA-256 tính khi đọc luồng | So sánh với `sha256sum` của tệp | Spec F5.1 |
| NFR-REL-07 | Tính sẵn sàng của hệ thống | Không cam kết SLA; độ sẵn sàng phụ thuộc SLA của MongoDB Atlas, Neo4j AuraDB, Cloudflare (gói miễn phí). Yêu cầu: hệ thống chạy ổn định suốt buổi demo/nghiệm thu; endpoint `/health` dùng để giám sát | Gọi `/health` trước và trong buổi demo | Quyết định nhóm |

## 5.4. Khả dụng (Usability) — `USA`

| ID | Yêu cầu | Chỉ số | Cách kiểm chứng | Nguồn |
|---|---|---|---|---|
| NFR-USA-01 | Ngôn ngữ giao diện và thông báo lỗi bằng tiếng Việt, dễ hiểu | 100% thông báo lỗi nghiệp vụ có nội dung tiếng Việt | Review UI/API | Spec (các message) |
| NFR-USA-02 | Xem trước tác động trước khi thay đổi dữ liệu (Human-in-the-loop) | Có dry-run trước biến đổi, preview trước khi xuất | Kịch bản kiểm thử UI | Spec F7.2, F9.3; report v5 |
| NFR-USA-03 | Hoạt động khi mất kết nối backend | Không hiển thị lỗi gây gián đoạn; bản nháp lưu IndexedDB; client xử lý ≤ 20.000 dòng offline | Ngắt mạng khi đang thao tác | Report v5 mục 2, 5 |
| NFR-USA-04 | Hiển thị bảng dữ liệu mượt | Tối đa 100 cột; phân trang 10–200 dòng | Kiểm thử UI | Report v5 mục 5 |
| NFR-USA-05 | Nhận diện thiết bị thân thiện trong danh sách phiên | Nhãn dạng "Chrome on macOS" từ User-Agent | Kiểm tra F1.10 | Báo cáo 05 mục 3.2 |

## 5.5. Khả năng bảo trì (Maintainability) — `MAIN`

| ID | Yêu cầu | Chỉ số | Cách kiểm chứng | Nguồn |
|---|---|---|---|---|
| NFR-MAIN-01 | An toàn kiểu tuyệt đối | 0 khai báo `any` trong mã nguồn, scripts, tests; TypeScript `strict` | Test `zero-any.spec.ts` | Báo cáo 01, 06 |
| NFR-MAIN-02 | Kiến trúc module hóa | Backend chia module theo nghiệp vụ (controller → service → repository); frontend tách view / hook / service / repository / graphics / math | Review cấu trúc thư mục | README, kiến trúc FE |
| NFR-MAIN-03 | Tài liệu API tự sinh | Swagger/OpenAPI sinh từ Zod schema | Mở `/api/v1/docs` | README |
| NFR-MAIN-04 | Sẵn sàng tích hợp AI mà không refactor | Có sẵn trường `ai_profile`, `ai_recommendations`, interface `IDataTransformationEngine` | Review schema/interface | Report v5 mục 3 |
| NFR-MAIN-05 | Có kiểm thử tự động | Backend: Jest; frontend: Vitest; các bộ test bắt buộc pass trước khi nghiệm thu | Chạy `pnpm test`, `yarn test` | Báo cáo 06 |

## 5.6. Tương thích & khả chuyển (Compatibility / Portability) — `COMP`, `PORT`

| ID | Yêu cầu | Chỉ số | Cách kiểm chứng | Nguồn |
|---|---|---|---|---|
| NFR-COMP-01 | Hỗ trợ định dạng dữ liệu phổ biến | Nhập/xuất CSV (UTF-8, có BOM khi xuất), XLSX, JSON | Upload/download từng định dạng | Spec F5.1, F9.1 |
| NFR-COMP-02 | API REST thống nhất | Tiền tố `/api/v1`, JSON, mã HTTP chuẩn | Review Swagger | Spec |
| NFR-PORT-01 | Chạy trên trình duyệt hiện đại | Chrome, Edge, Firefox — 2 phiên bản mới nhất trên desktop (cần IndexedDB, WebGL); Safari hỗ trợ ở mức tốt nhất có thể | Kiểm thử thủ công trên 3 trình duyệt | Quyết định nhóm |
| NFR-PORT-02 | Hạ tầng đám mây thay thế được | Lưu trữ đối tượng qua API tương thích S3; để trống `S3_ENDPOINT` thì dùng thư mục cục bộ | Chạy với 2 cấu hình | README, `.env.example` |

## 5.7. Giới hạn dữ liệu (ràng buộc hệ thống)

Xem bảng chi tiết tại [02_pham-vi, mục 2.5](02_pham-vi.md#25-giới-hạn-dữ-liệu-data-boundaries). Các giới hạn này là ngưỡng cứng; vượt ngưỡng hệ thống phải từ chối với `400` (dung lượng, định dạng) hoặc `422` (số dòng, số cột).
