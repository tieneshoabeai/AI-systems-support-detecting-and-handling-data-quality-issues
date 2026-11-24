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
| `feedback.service.ts` | `createFindingFeedback/createRunFeedback` (gán `analysisId/findingId/projectId/workspaceId`, kiểm tra label), `listFindingFeedback/listRunFeedback` (phân trang keyset), `updateMine` (chỉ chủ sở hữu, còn quyền xem project), `remove` (chủ/owner/system-admin kiểm duyệt, có audit), `aiQualityMetrics` (tỉ lệ false_positive, điểm tin cậy, theo project). `syncFindingExample` đồng bộ mẫu few-shot theo khuôn mỗi khi tạo, sửa hoặc xoá nhận xét phát hiện (mục 4). |
| `feedback.repository.ts` | Hiện thực `FEEDBACK_REPOSITORY_PORT` bằng Mongoose: `create/findById/listByFinding/listByRun/update/delete/aggregateMetrics`. Index `(analysis_id, finding_id, created_at)`. |
| `finding-feedback.schema.ts` | Schema `FindingFeedback`: `analysis_id, finding_id (nullable cho run-level), project_id, workspace_id, author_id, label, severity, reason, ai_rationale, created_at`. `finding_id` rỗng nghĩa là nhận xét cả lần chạy. |
| `feedback.types.ts` | Thực thể `Feedback`, `FEEDBACK_LABELS = [correct, partially_correct, false_positive, missed_issue, other]`, `FEEDBACK_SEVERITIES`, `LABELS_REQUIRING_REASON` (`false_positive`, `missed_issue`, `other` bắt buộc `reason`), `MAX_FEEDBACK_REASON_LENGTH`, sự kiện `FEEDBACK_EVENTS`. |
| `feedback.mapper.ts` | Map Mongoose -> `Feedback` an toàn, ẩn trường nội bộ, đổi `_id` -> `id`. |
| `feedback.utils.ts` | `requiresReason(label)`, chuẩn hóa truy vấn list, tính trust score, lọc theo ngôn ngữ tiếng Việt. |
| `feedback.module.ts` | Khai báo controller/service/repository, import `AnalysisModule` để lấy `RAG_FEW_SHOT_PORT` (chiều `feedback -> analysis`, không ngược). |
| `index.ts` | Public contract: PORT, kiểu, hằng, entity, service, repository, Zod schema. |

## 3. Route đầy đủ (7 route)

| Phương thức | Đường dẫn đầy đủ | Mô tả |
|---|---|---|
| POST | `/api/v1/analyses/:analysisId/findings/:findingId/feedback` | Nhận xét một phát hiện (FB-01, 201). Body: `label + reason + severity`. Run phải `succeeded`, nếu không → 409. |
| POST | `/api/v1/analyses/:analysisId/feedback` | Nhận xét cả lần phân tích (FB-02, 201). Run phải `succeeded` hoặc `failed`, nếu không → 409. |
| GET | `/api/v1/analyses/:analysisId/findings/:findingId/feedback` | Xem nhận xét của một phát hiện, phân trang keyset (FB-03). Trả `meta.limit`; `summary` đếm toàn phạm vi, không theo `?label`. |
| GET | `/api/v1/analyses/:analysisId/feedback` | Xem nhận xét của một lần phân tích (FB-04). |
| PATCH | `/api/v1/feedback/:id` | Sửa nhận xét của chính mình. System Admin bị chặn 403 (FB-05). ID sai định dạng → 400; chủ nhận xét không còn quyền xem project (không còn là thành viên project **và** workspace) → 403, project đã xoá → 404. Thành viên workspace bị gỡ khỏi project vẫn có quyền xem nên vẫn sửa được. |
| DELETE | `/api/v1/feedback/:id` | Xóa: chủ sở hữu (còn quyền xem project), owner xử lý vi phạm, hoặc system-admin kiểm duyệt (FB-05). |
| GET | `/api/v1/projects/:projectId/ai-quality-metrics` | Thống kê chất lượng AI theo project: tổng feedback, tỉ lệ từng label, xu hướng. System Admin bị chặn (FB-06). |

## 4. Luồng RAG/few-shot (cơ chế T1)

1. User tạo, sửa hoặc xoá nhận xét một phát hiện -> `FeedbackService` lưu DB rồi gọi `syncFindingExample`.
2. Mô tả mẫu sinh **theo khuôn** từ loại lỗi (lấy từ `findingId`), đặc tính cột (đã làm sạch, ≤ 80 ký tự) và nhãn mẫu. **Không** dùng `reason` của người dùng, để văn bản tự do không vào prompt AI (chống prompt injection). Cùng (phát hiện, nhãn mẫu) luôn ra cùng mô tả nên tự gom trùng.
3. `correct` và `partially_correct` cùng ánh xạ nhãn mẫu `correct`. Số người đồng thuận được đếm trên cả nhóm nhãn đó (`countDistinctAuthors` với `labels`), rồi `computeTrustScore` tính trust. Mẫu chỉ vào kho khi **≥ 3 người và trust ≥ 0,6**; mẫu tụt dưới 3 người (do sửa/xoá) bị loại khi truy xuất. Embedding cục bộ qua `RAG_FEW_SHOT_PORT`.
4. Kho tối đa 50000 mẫu (FIFO), `top_k=5`, `min_trust=0.6`, mẫu quá 180 ngày bị loại.
5. Lần phân tích sau, `BuildPromptForJobHandler` lấy top-k mẫu cùng loại lỗi để gắn vào prompt ("Các trường hợp đã biết"), giúp AI bớt ảo giác. Lỗi RAG không chặn luồng nhận xét.

## 5. Bất biến

- `false_positive`, `missed_issue`, `other` bắt buộc `reason` (FB-01..FB-06); thiếu trả 400 với payload field+message, kể cả khi `PATCH` đổi sang các nhãn này.
- Admin bị chặn 403 ở `PATCH /feedback/:id` và `GET ai-quality-metrics` để tránh tự chấm điểm.
- Feedback không sửa kết quả analysis đã lưu — chỉ dùng cho RAG và thống kê.
- Mọi route đều JWT; kiểm tra sở hữu: chỉ chủ mới sửa, xóa mở rộng cho owner/admin theo quy tắc kiểm duyệt.
- Audit qua `AUDIT_LOGGER_PORT`: `FEEDBACK_UPDATED` (giá trị trước/sau), `FEEDBACK_MODERATION_DELETED` (kèm nội dung bị xoá).
- Hợp đồng chi tiết: Phần 7 v14 mục 3.24 (FB-R1…FB-R12), Phần 12 v16 mục 3.24 (T1-1…T1-6); kế hoạch: `docs/modules/feedback_plan.md`.

## 6. Test liên quan

`test/unit/feedback/` (entity, wave7, `feedback-v14.spec.ts`: RAG theo khuôn, ngưỡng, quyền, trạng thái run, audit), `test/integration/repositories-domain.spec.ts` (`countDistinctAuthors` trên MongoDB thật), `test/e2e/feedback-notifications-overview.e2e-spec.ts` (luồng feedback -> metrics -> overview).
