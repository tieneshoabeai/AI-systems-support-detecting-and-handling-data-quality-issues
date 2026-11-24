# Module `feedback` — Phản Hồi Và Chất Lượng AI

Thu thập nhận xét của người dùng cho từng phát hiện và từng lần phân tích, đồng thời tính chỉ số chất lượng AI. Là đầu vào cho RAG/few-shot của module `analysis`. Dạng phẳng 9 tệp + index, không CQRS.

## 1. Vị trí và vai trò

- Đường dẫn: `src/backend/src/modules/feedback/`
- Loại kiến trúc: phẳng/service-based (controller + service + repository + schema + mapper + utils + types).
- Sở hữu: collection `finding_feedbacks`.
- Cung cấp: `FEEDBACK_REPOSITORY_PORT`, `FeedbackService`, `FEEDBACK_LABELS/SEVERITIES`, `requiresReason`, Zod schema.
- Được dùng bởi: `analysis` (đọc feedback để dựng few-shot, tính trust score, lọc mẫu cũ 180 ngày).

## 2. Từng tệp làm gì (10 tệp)

| Tệp | Vai trò chi tiết |
|---|---|
| `feedback.controller.ts` | `@Controller()` bare, 7 route đường dẫn đầy đủ. Định nghĩa luôn `CreateFeedbackSchema`, `UpdateFeedbackSchema`, `ListFeedbackQuerySchema` (Zod) ngay trong controller để dùng cho `@ApiZodBody/Query` và Swagger. Kiểm tra JWT toàn cục, chặn `admin` ở một số route. |
| `feedback.service.ts` | `createFindingFeedback/createRunFeedback` (gán `analysisId/findingId/projectId/workspaceId`, kiểm tra label), `listFindingFeedback/listRunFeedback` (phân trang keyset), `updateMine` (chỉ chủ sở hữu), `remove` (chủ/owner/system-admin kiểm duyệt), `aiQualityMetrics` (tỉ lệ false_positive, điểm tin cậy, theo project). Gọi `RAG_FEW_SHOT_PORT` của analysis để lưu mẫu few-shot khi feedback là `correct/false_positive/missed_issue`. |
| `feedback.repository.ts` | Hiện thực `FEEDBACK_REPOSITORY_PORT` bằng Mongoose: `create/findById/listByFinding/listByRun/update/delete/aggregateMetrics`. Index `(analysis_id, finding_id, created_at)`. |
| `finding-feedback.schema.ts` | Schema `FindingFeedback`: `analysis_id, finding_id (nullable cho run-level), project_id, workspace_id, author_id, label, severity, reason, ai_rationale, created_at`. `finding_id` rỗng nghĩa là nhận xét cả lần chạy. |
| `feedback.types.ts` | Thực thể `Feedback`, `FEEDBACK_LABELS = [correct, false_positive, missed_issue, unclear]`, `FEEDBACK_SEVERITIES`, `LABELS_REQUIRING_REASON` (`false_positive` bắt buộc `reason`), `MAX_FEEDBACK_REASON_LENGTH`, sự kiện `FEEDBACK_EVENTS`. |
| `feedback.mapper.ts` | Map Mongoose -> `Feedback` an toàn, ẩn trường nội bộ, đổi `_id` -> `id`. |
| `feedback.utils.ts` | `requiresReason(label)`, chuẩn hóa truy vấn list, tính trust score, lọc theo ngôn ngữ tiếng Việt. |
| `feedback.module.ts` | Khai báo controller/service/repository, import `AnalysisModule` để lấy `RAG_FEW_SHOT_PORT` (chiều `feedback -> analysis`, không ngược). |
| `index.ts` | Public contract: PORT, kiểu, hằng, entity, service, repository, Zod schema. |

## 3. Route đầy đủ (7 route)

| Phương thức | Đường dẫn đầy đủ | Mô tả |
|---|---|---|
| POST | `/api/v1/analyses/:analysisId/findings/:findingId/feedback` | Nhận xét một phát hiện (FB-01, 201). Body: `label + reason + severity`. |
| POST | `/api/v1/analyses/:analysisId/feedback` | Nhận xét cả lần phân tích (FB-02, 201). |
| GET | `/api/v1/analyses/:analysisId/findings/:findingId/feedback` | Xem nhận xét của một phát hiện, phân trang keyset (FB-03). |
| GET | `/api/v1/analyses/:analysisId/feedback` | Xem nhận xét của một lần phân tích (FB-04). |
| PATCH | `/api/v1/feedback/:id` | Sửa nhận xét của chính mình. System Admin bị chặn 403 (FB-05). |
| DELETE | `/api/v1/feedback/:id` | Xóa: chủ sở hữu, owner xử lý vi phạm, hoặc system-admin kiểm duyệt (FB-05). |
| GET | `/api/v1/projects/:projectId/ai-quality-metrics` | Thống kê chất lượng AI theo project: tổng feedback, tỉ lệ từng label, xu hướng. System Admin bị chặn (FB-06). |

## 4. Luồng RAG/few-shot (cơ chế T1)

1. User gửi `false_positive` kèm `reason` bắt buộc -> `FeedbackService` lưu DB.
2. Service gọi `RagFewShotService.buildFewShotBlockFromText` qua `RAG_FEW_SHOT_PORT`: vector hóa `reason` bằng embedding cục bộ (Qwen3-Embedding, deterministic), chuẩn hóa, gắn `error_type + trust score`.
3. Kho tối đa 50000 mẫu (FIFO), `top_k=5`, `min_trust=0.6`, mẫu quá 180 ngày bị loại.
4. Lần phân tích sau, `BuildPromptForJobHandler` lấy top-k mẫu cùng loại lỗi để gắn vào prompt ("Các trường hợp đã biết"), giúp AI bớt ảo giác.

## 5. Bất biến

- `false_positive` bắt buộc `reason` (FB-01..FB-06); thiếu trả 400 với payload field+message.
- Admin bị chặn 403 ở `PATCH /feedback/:id` và `GET ai-quality-metrics` để tránh tự chấm điểm.
- Feedback không sửa kết quả analysis đã lưu — chỉ dùng cho RAG và thống kê.
- Mọi route đều JWT; kiểm tra sở hữu: chỉ chủ mới sửa, xóa mở rộng cho owner/admin theo quy tắc kiểm duyệt.

## 6. Test liên quan

`test/unit/feedback/` (2 tệp: label/reason, metrics), `test/e2e/feedback-notifications-overview.e2e-spec.ts` (luồng feedback -> metrics -> overview).
