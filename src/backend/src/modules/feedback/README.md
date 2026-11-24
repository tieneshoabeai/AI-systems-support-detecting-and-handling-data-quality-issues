# MÔ-ĐUN `feedback` — Nhận xét AI (Template: Simple)

> **P3.5 (2026-11-24):** Flatten từ Hexagonal → Simple Monolith theo ADR-0002.
> - Vì sao Simple: 7 use-case CRUD + thống kê, không transaction/outbox phức tạp.
> - Bất biến: `ensureNotAdmin(role)` — admin bị `ForbiddenError` với FB-*; 2 entity (`Feedback` aggregate + `FindingFeedback` helper) chung 1 repo/model `FindingFeedback`; tương thích camel/snake/ObjectId + `deleted_at: null` mọi query; chữ ký 4 tham số quá tải của `updateMine` giữ nguyên; RAG/few-shot promote best-effort (try/catch, không chặn feedback).
> - Cấu trúc mới: `feedback.service.ts (7 method) + feedback.controller.ts (controller + 3 DTO gộp) + feedback.types.ts (2 entity + VO + events + port + input) + feedback.utils.ts (toPlain) + feedback.mapper.ts + finding-feedback.schema.ts + feedback.repository.ts + index.ts + feedback.module.ts`.
> - Cấm: đổi Symbol port (TC-03), đổi thứ tự/tham số method (BC), làm sạch nhánh camel/snake (TC-06/BC-04), bỏ `ensureNotAdmin`.

---
# MÔ-ĐUN `feedback` — Phản hồi & Vòng lặp học lại

> **Đặc tả mô-đun & Tài liệu kỹ thuật**

## 1. Thông tin phiên bản

- **Phiên bản hiện tại:** v1.2.0
- **Cập nhật lần cuối:** 2026-11-24
- **Đường dẫn mô-đun:** `src/backend/src/modules/feedback` (21 tệp TypeScript)
- **Tầng kiến trúc:** Clean Architecture 4 tầng (`domain` → `application` → `infrastructure` → `presentation`)
- **Quy tắc tầng:** CA1–CA14 — xem [`../README.md`](../README.md)

## 2. Mục đích & Phạm vi nghiệp vụ

Mô-đun hiện thực **vòng lặp Human-in-the-Loop**: người dùng đánh giá kết quả AI, phản hồi được lưu **bất biến** và dùng làm **ví dụ few-shot** cho các lần chạy AI sau.

```text
Kết quả AI ---> Người dùng đánh giá ---> Phản hồi (bất biến) ---> RAG few-shot
                                                                        |
                                              prompt lần chạy sau <----+
```

### 2.1. Tính năng thuộc phạm vi

| Chức năng | Nội dung |
|---|---|
| Phản hồi mức finding | Đánh giá **một** phát hiện cụ thể |
| Phản hồi mức lần chạy | Đánh giá **toàn bộ** kết quả một lần phân tích |
| Quản lý phản hồi | Sửa / xoá phản hồi **của tôi** |
| Chỉ số chất lượng AI | Tính tỉ lệ đúng / sai / bỏ qua theo project |

### 2.2. Cấu trúc thư mục

> **v1.2.0:** sơ đồ dưới đây là cấu trúc trước khi gộp Template Simple. Hiện tại module gồm `feedback.controller.ts` (route + DTO Zod), `feedback.service.ts`, `feedback.types.ts` (entity `Feedback`, port, input), `feedback.repository.ts`, `feedback.mapper.ts`, `finding-feedback.schema.ts`, `feedback.utils.ts`, `feedback.module.ts`, `index.ts`.

```text
feedback/
|-- domain/
|   |-- entities/
|   |   |-- feedback.entity.ts           # phản hồi mức lần chạy
|   |   `-- finding-feedback.entity.ts   # phản hồi mức finding
|   |-- value-objects/feedback-label.vo.ts
|   |-- events/feedback-events.ts
|   `-- ports/feedback.repository.port.ts
|-- application/
|   |-- commands/                        # 5 command handler
|   |-- queries/                         # 2 query handler
|   |-- feedback.types.ts
|   `-- feedback.utils.ts
|-- infrastructure/persistence/
|   |-- feedback.schema.ts
|   |-- finding-feedback.schema.ts
|   |-- feedback.repository.ts
|   `-- feedback.mapper.ts
`-- presentation/controllers/feedback.controller.ts
```

## 3. Nhật ký Prompting & Quyết định kỹ thuật

- **Yêu cầu người dùng / Ý đồ nghiệp vụ:** Khép kín vòng lặp giữa người dùng và AI: mỗi phản hồi của người dùng phải **biên dịch** thành ví dụ mẫu giúp AI làm tốt hơn ở lần sau, mà không cần huấn luyện lại mô hình.

- **Lập luận kỹ thuật & Quyết định:**

1. **Hai cấp phản hồi.** `FindingFeedback` (đánh giá một phát hiện: "cột này không bị thiếu") và `Feedback` (đánh giá cả lần chạy: "kết quả chung nhìn ổn"). Cả hai dùng chung bộ nhãn và mức độ nghiêm trọng. Cấp chi tiết hữu ích cho giao diện; cấp tổng hợp hữu ích cho báo cáo.

2. **Nhãn bắt buộc có lý do.** `LABELS_REQUIRING_REASON = ['false_positive', 'missed_issue', 'other']`. `assertReasonForLabel` báo lỗi nếu chọn một trong ba nhãn này mà không ghi lý do. Lý do cụ thể mới giúp AI học được; nhãn không kèm lý do chỉ là tín hiệu nhiễu.

3. **Mức độ nghiêm trọng của người đánh giá tách khỏi mức độ nghiêm trọng do AI gắn.** Hai khái niệm khác nhau: "vấn đề này nghiêm trọng" (AI) so với "tôi nghĩ vấn đề này nghiêm trọng" (người dùng). Mức độ của người dùng tính `trust_score` cho RAG.

4. **`trust_score` theo số người đồng thuận (v1.2.0).** `computeTrustScore(n)` với n = số tác giả khác nhau cùng nhãn trên cùng finding trong workspace: 0→0,4 · 1→0,5 · 2→0,55 · 3→0,8 · 4→0,9 · ≥5→0,95. Mẫu vào kho khi **≥ 3 người** và trust ≥ 0,6; trust < 0,6 bị loại khi truy xuất (Phần 12 v15 §3.24).

5. **Phản hồi bất biến về nghiệp vụ.** `updateMine` chỉ cho phép sửa **phản hồi của chính người gọi**, và người gọi phải **còn quyền xem project** (v1.2.0). Tài khoản System Admin bị cấm tạo/sửa phản hồi (`ensureNotAdmin`) nhưng được phép xoá kiểm duyệt. Lịch sử sửa được ghi vào audit log (`FEEDBACK_UPDATED`, trước/sau); xoá vi phạm ghi `FEEDBACK_MODERATION_DELETED` kèm nội dung.

6. **RAG lọc theo `max_age_days`.** Phản hồi cũ không còn đúng với mô hình hiện tại. Lọc theo tuổi là chất lượng dữ liệu, không phải làm mất dữ liệu.

7. **Mẫu học lại theo khuôn, không dùng `reason` (v1.2.0).** Mô tả mẫu sinh từ (loại lỗi, đặc tính cột, nhãn) — nội dung tự do của người dùng **không** vào prompt AI (Phần 6 §3.5b, Phần 12 §3.16.2; chặn prompt injection). Đặc tính cột lấy từ `findingId`, qua `stripIdentifiers` + bỏ ký tự điều khiển, ≤ 80 ký tự. Cùng (finding, nhãn) luôn ra cùng mô tả nên tự gom trùng; sửa/xoá nhận xét đếm lại đồng thuận.

8. **Tổng hợp theo phạm vi thay vì giới hạn 1.000 bản ghi.** `summaryByScope` dùng aggregation `$group` theo nhãn nên đếm chính xác toàn bộ, không bị cắt cụt.

- **Hiện vật đã tạo / đã sửa:**

- `domain/value-objects/feedback-label.vo.ts` — `FEEDBACK_LABELS` (5 nhãn), `FEEDBACK_SEVERITIES` (4 mức), `LABELS_REQUIRING_REASON`, `assertReasonForLabel`.
- `domain/entities/finding-feedback.entity.ts` — phản hồi mức finding.
- `domain/entities/feedback.entity.ts` — phản hồi mức lần chạy.
- `application/commands/update-mine.handler.ts` — chỉ sửa phản hồi của tôi, cấm admin.
- `application/commands/ai-quality-metrics.handler.ts` — chỉ số chất lượng AI theo project.

## 4. Đặc tả giao tiếp kỹ thuật

### 4.1. Điểm cuối (Endpoints)

| Phương thức | Đường dẫn | Chính sách | Mô tả |
|---|---|---|---|
| `POST` | `/api/v1/analyses/:analysisId/findings/:findingId/feedback` | `Action.Create` | Đánh giá một finding |
| `GET` | `/api/v1/analyses/:analysisId/findings/:findingId/feedback` | `Action.Read` | Đọc đánh giá của finding |
| `POST` | `/api/v1/analyses/:analysisId/feedback` | `Action.Create` | Đánh giá cả lần chạy |
| `GET` | `/api/v1/analyses/:analysisId/feedback` | `Action.Read` | Danh sách đánh giá của lần chạy |
| `PATCH` | `/api/v1/feedback/:id` | Chủ phản hồi | Sửa phản hồi của tôi |
| `DELETE` | `/api/v1/feedback/:id` | Chủ phản hồi | Xoá phản hồi của tôi |
| `GET` | `/api/v1/projects/:projectId/ai-quality-metrics` | `Action.Read` | Chỉ số chất lượng AI |

### 4.2. Giao diện / Provider được xuất ra ngoài

`src/backend/src/modules/feedback/index.ts` xuất hợp đồng công khai:

| Tên xuất | Vai trò |
|---|---|
| `FeedbackModule` | Mô-đun Nest |
| `Feedback`, `FindingFeedback` entities | Hợp đồng domain |
| `FeedbackLabel`, `FeedbackSeverity` | Hợp đồng domain |
| `FEEDBACK_REPOSITORY_PORT` | Cổng truy vấn phản hồi |

### 4.3. Sự kiện domain phát ra

| Sự kiện | Khi nào | Mục đích |
|---|---|---|
| `feedback.created` | Tạo phản hồi | Realtime tới phòng `project:` và `analysis:` — payload chỉ `feedbackId`, `label`, id phạm vi (không `reason`) |

> Entity `Feedback` có domain event `feedback.submitted` / `feedback.promoted` nhưng hiện **không** được dispatch (chưa có nơi tiêu thụ). Không phát `feedback.updated` / `feedback.deleted`.

## 5. Ràng buộc & Tiêu chuẩn bất biến

### 5.1. Bất biến nghiệp vụ

| Nhãn | Bắt buộc có lý do |
|---|---|
| `correct` | Không |
| `partially_correct` | Không |
| `false_positive` | **Có** |
| `missed_issue` | **Có** |
| `other` | **Có** |

- Mức độ nghiêm trọng phải thuộc `{ low, medium, high, critical }`.
- `trust_score` phải được chuẩn hoá về khoảng [0, 1].
- Chỉ sửa / xoá **phản hồi của chính người gọi**, khi còn quyền xem project; admin bị cấm tạo/sửa.
- Nhận xét phát hiện chỉ khi lần phân tích `succeeded`; nhận xét cả lần chạy khi `succeeded` / `failed`; khác → `CONFLICT`.
- Phản hồi có `trust_score` dưới ngưỡng hoặc quá `max_age_days` **không** được dùng làm few-shot.
- Mẫu few-shot **không** chứa `reason` của người dùng; đặc tính cột phải qua `stripIdentifiers`.
- Chỉ số chất lượng AI phải tính được trên **tập phản hồi đã lọc** cho project đó, dùng aggregation.

### 5.2. Xoá mềm (Soft Delete)

- **Chuẩn:** `deleted_at: Date | null` — trường này **null** nghĩa là bản ghi đang hoạt động.
- **Quy tắc truy vấn:** mọi truy vấn mặc định luôn lọc `deleted_at: null`. Repository nền (`shared/infrastructure/database/base-mongo.repository.ts`) áp dụng điều này tự động.
- **Chơi index Partial Unique:** `partialFilterExpression: { deleted_at: null }` — cho phép tài khoản / tên / email đã xoá mềm được tạo lại.

### 5.3. Bảo mật

| Vấn đề | Cách xử lý |
|---|---|
| Sửa phản hồi của người khác | Entity `updateByAuthor` kiểm tra tác giả + cấm admin |
| Xoá phản hồi của người khác | Chỉ PROJ-OWNER / WS-OWNER / SYS-ADMIN (kiểm duyệt), bắt buộc audit log kèm nội dung |
| Cựu thành viên sửa/xoá phản hồi cũ | `resolveProjectAccess` → 403 / 404 |
| PII / prompt injection qua ví dụ few-shot | Mẫu theo khuôn, không dùng `reason`; đặc tính cột qua `stripIdentifiers` |
| Thao túng `trust_score` để AI học sai | `trust_score` tính ở domain, client không truyền trực tiếp |
| Đọc phản hồi của project khác | `resolveProjectAccess` (service) kiểm tra quyền project của lần phân tích |

### 5.4. Phân quyền

| Tuyến đường | Chính sách |
|---|---|
| `POST /analyses/:analysisId/findings/:findingId/feedback` | `Action.Create` trên `FindingFeedback` |
| `GET /analyses/:analysisId/findings/:findingId/feedback` | `Action.Read` |
| `POST /analyses/:analysisId/feedback` | `Action.Create` |
| `GET /analyses/:analysisId/feedback` | `Action.Read` |
| `PATCH /feedback/:id`, `DELETE /feedback/:id` | Chủ phản hồi (theo `userId` trong bản ghi) |
| `GET /projects/:projectId/ai-quality-metrics` | `Action.Read` trên `Project` |

## 6. Lịch sử thay đổi

### 2026-11-24
- **v1.2.0** / 2026-11-24 / Mẫu RAG theo khuôn (không dùng `reason`), ngưỡng ≥ 3 người, đồng bộ mẫu khi sửa/xoá; sửa/xoá cần còn quyền project; chặn tạo nhận xét theo trạng thái lần phân tích; audit log khi sửa và xoá vi phạm; `meta.limit`, `summary` toàn phạm vi, `findingId` ≤ 200 ở GET, tên tác giả bằng `findByIds`; `promptVersion` lấy từ đánh giá AI / Rà soát module (Phần 7 v14 §3.24, Phần 12 v15 §3.24, Phần 13 v16 §3.29) / `modules/feedback`, `modules/analysis` (`rag-few-shot.util.ts`), `modules/audit` (2 action mới)

### 2026-11-21
- **v1.1.0** / 2026-11-21 / Viết lại README mô-đun đầy đủ theo chuẩn 6 phần / Yêu cầu tái đọc / Tài liệu mẫu chuẩn

### 2026-11-XX
- **v1.0.0** / 2026-11-XX / Bổ sung `ai-quality-metrics.handler.ts` và `GET /projects/:projectId/ai-quality-metrics` / Cảnh báo chất lượng AI trước khi đưa vào sử dụng / `modules/feedback`
- **v0.8.0** / 2026-11-XX / Bổ sung `RAG_FEW_SHOT_PORT` và `stripIdentifiers` / AI học lại mà không lộ PII / `modules/feedback`, `modules/analysis`
- **v0.5.0** / 2026-11-XX / Bổ sung `LABELS_REQUIRING_REASON` và `assertReasonForLabel` / Chất lượng dữ liệu phản hồi / `modules/feedback`
- **v0.3.0** / 2026-11-XX / Tách 2 cấp phản hồi (finding / run) / Vượt qua nhu cầu đánh giá chi tiết và tổng hợp / `modules/feedback`
- **v0.1.0** / 2026-11-XX / Tạo mô-đun / Vòng lặp Human-in-the-Loop / `modules/feedback`

- **Định dạng:** `[Phiên bản] / [Ngày] / [Thay đổi gì] / [Lý do] / [Ảnh hưởng đến đâu]`
