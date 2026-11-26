# Outline slide — System Design (Backend)

> Phạm vi: Thiết kế API · Pipeline phân tích dataset · Quy trình hoạt động · Module Auth · Module Analysis
> Mỗi phần theo khung: **Giới thiệu → Yêu cầu → Kiến thức áp dụng → Thiết kế rút ra**
> Quy ước: ✅ đã làm · ⚠️ làm một phần · ❌ chưa làm · 🎯 đích thiết kế (chưa triển khai)
> Mọi khẳng định đều có file/dòng code hoặc link nguồn đã kiểm.

---

## PHẦN 0 — MỞ ĐẦU (2 slide)

**S1. Tiêu đề**
- Tên đề tài: AI hỗ trợ phát hiện & xử lý vấn đề chất lượng dữ liệu
- Chủ đề buổi này: System Design phía Backend

**S2. Nội dung & khung trình bày**
- 5 phần: API · Pipeline phân tích · Quy trình · Auth · Analysis
- Mỗi phần: Giới thiệu → Yêu cầu → Kiến thức → Thiết kế

---

## PHẦN 1 — YÊU CẦU HỆ THỐNG (3 slide)

**S3. Bài toán**
- "Garbage in → garbage out": dữ liệu thiếu, trùng, sai kiểu, ngoại lai
- Đối tượng: người phân tích dữ liệu (Data Analyst) — *feature catalog v9 §3.1*

**S4. Yêu cầu chức năng chính** — *feature catalog v9*
- Upload **1 file CSV / project**, kiểm tra ngay khi tải lên (§3.2)
- Phát hiện 5 nhóm lỗi DQ-01..05 (thiếu, trùng, sai kiểu, ngoại lai, quy tắc nghiệp vụ) (§3.5)
- Chọn cột, cột nhãn, phân tích theo thời gian, tương quan/VIF
- AI giải thích & đề xuất (không tự sửa dữ liệu); người dùng phản hồi → AI học lại
- Xuất báo cáo PDF; cộng tác theo Workspace/Project

**S5. Yêu cầu phi chức năng** — *README, Phần 12 v8*
- Dữ liệu **chỉ đọc** (không sửa/xoá dòng, ô)
- AI **chạy cục bộ**, dữ liệu không rời hệ thống; che PII trước khi gửi AI
- Phân quyền theo vai trò trong Workspace/Project; bảo mật phiên đăng nhập
- AI lỗi **không được** làm hỏng kết quả phân tích của hệ thống

---

## PHẦN 2 — THIẾT KẾ API (5 slide)

**S6. Giới thiệu**
- REST API, NestJS, 82 endpoint (80 nghiệp vụ + 2 health), 12 module; tài liệu Swagger tại `/api/v1/docs`

**S7. Yêu cầu đối với API**
- Dễ hiểu theo nghiệp vụ, thống nhất response/lỗi, có phiên bản
- Duyệt dữ liệu lớn (hàng triệu dòng) mà không chậm
- Chặn truy cập trái phép ở mọi endpoint

**S8. Kiến thức áp dụng**
- ByteByteGo — 8 tips thiết kế API hiệu quả: https://bytebytego.com/guides/guides/8-tips-for-efficient-api-design/
- RFC 9110 (HTTP Semantics) — §9.2.2 phương thức idempotent, §15 status code: https://www.rfc-editor.org/rfc/rfc9110.html

**S9. Đối chiếu 8 tips với hệ thống**
| # | Tip | | Bằng chứng |
|---|---|---|---|
| 1 | Domain-model driven | ✅ | `workspaces/:id/projects`, `projects/:projectId/datasets`, `projects/:projectId/analysis` |
| 2 | HTTP method phù hợp | ✅ | GET/POST/PATCH/PUT/DELETE; vài action dạng động từ: `transfer-owner`, `leave`, `jobs/:id/retry` |
| 3 | Idempotency | ⚠️ | `PUT projects/:id/snapshot`; `input_fingerprint` cho lần phân tích; chưa có header `Idempotency-Key` |
| 4 | Status code | ✅ | 200/201/202/204 qua `@HttpCode`; lỗi gom về `AllExceptionsFilter` |
| 5 | Versioning | ✅ | prefix `/api/v1` — `main.ts:96` |
| 6 | Semantic paths | ⚠️ | chưa thống nhất: `analysis/jobs` và `analyses/:analysisId/feedback` |
| 7 | Batch | ❌ | chưa có endpoint `/bulk` |
| 8 | Query language | ✅ | phân trang cursor/keyset + lọc/sắp xếp: `datasets/:id/records/query` |

**S10. Thiết kế rút ra**
- Cây tài nguyên: Workspace → Project → Dataset → Analysis → Feedback / Report
- Response chuẩn `{ success, data, meta }` (`transform.interceptor.ts`); lỗi chuẩn `{ code, message, details }` (`all-exceptions.filter.ts`)
- Việc chạy lâu (AI, PDF) trả về **202 Accepted** kèm job id, client hỏi trạng thái qua `GET .../jobs/:id`

---

## PHẦN 3 — PIPELINE PHÂN TÍCH DATASET (6 slide)

**S11. Giới thiệu**
- Một lần bấm "Phân tích" = `POST /projects/:projectId/analysis`
- Mã nguồn: `AnalysisService.runAnalysis` — `analysis.service.ts:81`

**S12. Yêu cầu**
- Kết quả hệ thống phải có trước, AI chỉ bổ sung sau và không chặn kết quả
- Có bằng chứng tới từng ô, có trạng thái theo dõi được, biết kết quả nào đã cũ

**S13. Kiến thức áp dụng**
- Hexagonal (ports & adapters): phần tính toán là hàm thuần trong `domain/`; AI gọi qua `AiInferencePort` → `LocalInferenceAdapter` — https://alistair.cockburn.us/hexagonal-architecture/
- RAG + few-shot cho AI — Lewis et al. 2020: https://arxiv.org/abs/2005.11401

**S14. Các bước — phần đồng bộ (trong request)**
1. Kiểm tra project/dataset, đọc cấu hình đã lưu (cột chọn, nhãn, thời gian)
2. Phân vai cột (số / phân loại / loại trừ), tính `input_fingerprint`
3. Tạo `analysis_run` (status `running`)
4. DQ-01 thiếu · DQ-02 trùng · DQ-03 sai kiểu · DQ-04 ngoại lai; DQ-05 để `unassessed`
5. Thống kê mô tả, mất cân bằng nhãn, phân tích thời gian
6. Ma trận tương quan + VIF
7. Lưu bằng chứng theo ô (≤ 20/cột, đã che PII)
8. Lưu kết quả, đánh dấu kết quả cũ là `stale`, tạo AI job `pending`, đẩy sự kiện realtime

**S15. Các bước — phần bất đồng bộ (AI worker)**
- Worker poll MongoDB, nhận job bằng `findOneAndUpdate` nguyên tử (`pending → running`) + lease/heartbeat — `analysis.repository.ts:220`
- Dựng prompt `corr-v1` (đã che PII + few-shot từ feedback) → gọi model cục bộ (vLLM/Ollama, timeout 180s)
- Grounding: kiểm schema bằng Zod; hệ số AI lệch quá 0.01 so với hệ thống thì loại — `ai-grounding.util.ts`
- Lỗi tạm thời retry tối đa 2 lần → `failed`; hết lease → `skipped`
- 🎯 Đích thiết kế: đẩy job qua **Outbox → Kafka topic `ai.jobs`** (Phần 9 v4, Phần 12 v8 §3.9) — chưa triển khai

**S16. Thiết kế rút ra (sơ đồ)**
- Sơ đồ 2 làn: Request (đồng bộ) | Worker (bất đồng bộ), nối với nhau qua bảng `ai_jobs`

---

## PHẦN 4 — QUY TRÌNH HOẠT ĐỘNG (5 slide)

**S17. Giới thiệu**
- 2 góc nhìn: luồng nghiệp vụ (người dùng làm gì) và luồng request (hệ thống xử lý ra sao)

**S18. Kiến thức áp dụng**
- Modular Monolith — Fowler, *MonolithFirst*: https://martinfowler.com/bliki/MonolithFirst.html
- Transactional Outbox — https://microservices.io/patterns/data/transactional-outbox.html

**S19. Luồng nghiệp vụ end-to-end**
- Đăng ký/đăng nhập → tạo Workspace/Project → upload CSV → xem lưới dữ liệu → cấu hình cột → chạy phân tích → AI đánh giá → người dùng feedback → xuất PDF

**S20. Luồng request kỹ thuật**
- Client → Cloudflare Tunnel (TLS) → Helmet/CORS → `ThrottlerGuard` (200 req/60s) → `JwtAuthGuard` → `PoliciesGuard` (CASL) → `ZodValidationPipe` → Controller → Service → Repository (MongoDB) → Outbox → Kafka / Socket.IO

**S21. Thiết kế rút ra**
- 12 module trong 1 ứng dụng, mỗi module chia `domain / application / infrastructure`
- Sự kiện ghi vào outbox cùng thao tác nghiệp vụ, relay đẩy sang Kafka (ví dụ `DATASET_INGESTED` — `datasets.service.ts:320`)

---

## PHẦN 5 — MODULE AUTH (4 slide)

**S22. Giới thiệu & yêu cầu**
- Đăng ký, đăng nhập, Google OAuth, refresh token, quên/đổi mật khẩu bằng OTP, xem/thu hồi phiên
- 11 endpoint `/auth/*` — `auth.controller.ts`

**S23. Kiến thức áp dụng**
- OWASP Authentication Cheat Sheet — thông báo lỗi chung chung, hash mật khẩu, giới hạn số lần đăng nhập, khóa tài khoản: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- RFC 9700 §4.14.2 — xoay vòng refresh token; token cũ bị dùng lại thì thu hồi: https://datatracker.ietf.org/doc/html/rfc9700

**S24. Thiết kế — đăng nhập & refresh (sequence)**
- Login: tìm user → kiểm tra bị khóa → bcrypt compare → cấp access + refresh, lưu phiên (hash token)
- Lỗi chung chung "Email hoặc mật khẩu không chính xác" — `auth.service.ts:66-69`
- Refresh: thu hồi phiên cũ, tạo phiên mới; token đã thu hồi bị dùng lại thì **thu hồi toàn bộ phiên** của user — `auth.service.ts:101-122`

**S25. Thiết kế — bảo vệ thêm & cấu trúc**
- OTP quên mật khẩu: hạn 10 phút, sai quá 3 lần thì vô hiệu — `auth.service.ts:159-196`
- Giới hạn tần suất riêng cho từng endpoint auth (`@Throttle` 5–10 lần/giờ)
- Port/adapter: `PasswordHasherPort` → bcrypt, JWT issuer, users lookup/session

---

## PHẦN 6 — MODULE ANALYSIS (4 slide)

**S26. Giới thiệu & yêu cầu**
- 11 endpoint: config (2), run, result, job, retry, nhận kết quả AI, summary (2), report PDF (2)
- Yêu cầu: tách tính toán khỏi AI; AI lỗi không chặn; tái lập được kết quả

**S27. Kiến thức áp dụng**
- Hexagonal (ports & adapters), RAG — gom chung với S13 (không lặp nguồn)

**S28. Kiến trúc module**
- `domain/`: hàm thuần (dq, stats, correlation, vif, pii-mask, rag-few-shot, ai-grounding) + port repository
- `application/`: AnalysisService, AiWorkerService, RagFewShotService, Report/Summary
- `infrastructure/`: controller, MongoDB schema/repository, `LocalInferenceAdapter`

**S29. Vòng đời trạng thái**
- `analysis_run`: pending → running → succeeded / failed
- `ai_job`: pending → running → succeeded / failed / skipped
- `report_job`: pending → running → succeeded / failed (POST trả 202)
- Kết quả cũ chuyển `is_stale` khi chạy lại với cấu hình mới

---

## PHẦN 7 — KẾT (2 slide)

**S30. Hạn chế & hướng cải tiến**
- Thêm `Idempotency-Key` cho POST; thêm endpoint bulk; thống nhất path số ít/số nhiều
- Pipeline phân tích đang chạy đồng bộ trong request → đẩy sang job nền
- AI job: chuyển từ poll MongoDB sang Kafka `ai.jobs` qua Outbox

**S31. Tài liệu tham khảo**
- ByteByteGo 8 tips · RFC 9110 · RFC 9700 · OWASP Authentication Cheat Sheet
- Fowler MonolithFirst · Cockburn Hexagonal · microservices.io Transactional Outbox · Lewis et al. 2020 (RAG)
