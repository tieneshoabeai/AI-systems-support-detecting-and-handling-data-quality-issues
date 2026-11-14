# Bộ kế hoạch tái cấu trúc backend

## Cách sử dụng

- Số đầu tên file là thứ tự thực hiện các phần của quá trình tái cấu trúc, không phải thứ tự tạo tài liệu.
- Danh sách dưới đây là khung làm việc ban đầu; các thiết kế chi tiết chưa được phê duyệt chỉ vì đã có file.
- Hoàn thiện lần đầu từng phần trong file v1 tương ứng. Sau vòng đầu, thay đổi kế hoạch được ghi thành file v2, v3... cùng số thứ tự và tên phần; giữ bản trước để đối chiếu.
- Ví dụ: `1_architecture_direction_v1.md` → `1_architecture_direction_v2.md`.
- Mỗi phần ghi quyết định đã xác nhận, nội dung còn mở, lý do, trade-off, rủi ro và lịch sử thay đổi. Phiên bản lớn nhất không mặc định là bản đã phê duyệt.
- Cần xác nhận kết quả trước khi chuyển sang phần phụ thuộc. Khi thay đổi một phần, rà lại các phần phía sau bị ảnh hưởng.
- Phần 13 xác định test trước implementation; phần 14 thực hiện code và test theo từng đợt; phần 15 tổng hợp đánh giá cuối. Không đợi tới phần 15 mới kiểm thử.
- README này là mục lục điều hướng, không phải một phần kế hoạch có số thứ tự.
- Mỗi phần ghi rõ cách kế thừa/tinh chỉnh/không áp dụng và lý do phù hợp với Data Quality, dựa trên các thông lệ kỹ thuật phổ biến. Xem nguyên tắc đầy đủ tại phần 1; không mặc định chọn toàn bộ stack của bất kỳ hệ thống tham chiếu nào.

## Báo cáo xuất ra (Word)

Tài liệu Markdown trong thư mục này được xuất thành **mỗi phần một file `.docx` riêng** trong `docs/reports/`.

**Sinh lại toàn bộ báo cáo:**

```bash
python3 -m venv .venv-doc && .venv-doc/bin/pip install python-docx
.venv-doc/bin/python docs/_build_reference.py .venv-doc/reference.docx
python3 docs/generate_reports.py
```

| File báo cáo | Nguồn Markdown |
|---|---|
| `01-luong-nghiep-vu-va-use-case.docx` | `3_business_workflows_v5.md` |
| `02-thiet-ke-ports-and-adapters.docx` | `5_ports_adapters_design_v2.md` |
| `03-hop-dong-api.docx` | `7_api_contracts_v4.md` |
| `04-cong-nghe-ky-thuat.docx` | `_cong_nghe_ky_thuat.md` (tổng hợp từ Phần 1–14) |
| `05-danh-muc-tinh-nang.docx` | `2_feature_catalog_v9.md` |
| `06-ranh-gioui-module.docx` | `4_module_boundaries_v4.md` |
| `07-xac-thuc-va-phan-quyen.docx` | `6_security_authorization_v5.md` |
| `08-du-lieu-va-database-schema.docx` | `8_database_schema_v4.md` |
| `09-tich-hop-su-kien-va-worker.docx` | `9_integrations_events_workers_v3.md` |
| `10-van-hanh-va-quan-sat.docx` | `10_runtime_operations_v5.md` |
| `11-chuyen-doi-du-lieu-va-rollback.docx` | `11_migration_compatibility_v4.md` |
| `12-logic-xu-ly-du-lieu-va-ai.docx` | `12_processing_logic_ai_v6.md` |
| `13-chien-luoc-kiem-thu.docx` | `13_testing_acceptance_plan_v6.md` |
| `14-ke-hoach-thuc-hien.docx` | `14_implementation_plan_v6.md` |

Báo cáo kỹ thuật và công nghệ (file 04) là báo cáo **tổng hợp**, nguồn nằm ở `_cong_nghe_ky_thuat.md` — liên kết các quyết định công nghệ rải rác trong Phần 1–14 về một tài liệu thống nhất: stack, hạ tầng dữ liệu, tích hợp AI, vận hành, bảo mật, hiệu năng và công cụ kiểm thử.

## Thứ tự thực hiện

1. [Định hướng, mục tiêu và quy trình](1_architecture_direction_v1.md) — đã thống nhất hướng kiến trúc và phạm vi; còn các câu hỏi được hoãn.
2. [Danh sách tính năng backend](2_feature_catalog_v9.md) — **v9 đang dùng** (giữ để đối chiếu: [v8](2_feature_catalog_v8.md), [v7](2_feature_catalog_v7.md), [v6](2_feature_catalog_v6.md), [v5](2_feature_catalog_v5.md), [v4](2_feature_catalog_v4.md), [v3](2_feature_catalog_v3.md), [v2](2_feature_catalog_v2.md), [v1](2_feature_catalog_v1.md)). **85 tính năng** sau khi áp dụng quyết định **dữ liệu bất biến**, 5 quyết định kiến trúc v2, **v7: DQ-05 kích hoạt có điều kiện + ma trận tương quan/VIF do AI đánh giá** và **v8: breakdown thiếu pairwise + cảnh báo mất mẫu VIF + date bị loại + worker AI corr-v1**.
3. [Luồng nghiệp vụ và use case](3_business_workflows_v6.md) — **v6 đang dùng** (giữ để đối chiếu: [v5](3_business_workflows_v5.md), [v4](3_business_workflows_v4.md), [v3](3_business_workflows_v3.md), [v2](3_business_workflows_v2.md), [v1](3_business_workflows_v1.md)). **66 use case**: đã gỡ `UC-09` (chọn sheet), `UC-11` (xoá dòng), `UC-18` (sửa ô), `UC-28`→`UC-30` (clean-rules, lineage, exports), `UC-58`/`UC-59` (lịch sử phiên bản project); thêm **nhóm 11** `UC-68`→`UC-72` cho nhận xét kết quả. Kèm ma trận quyền và các vòng đời trạng thái.
4. [Ranh giới module và phân tích ảnh hưởng](4_module_boundaries_v4.md) — **v4 đang dùng** (giữ để đối chiếu: [v3](4_module_boundaries_v3.md), [v2](4_module_boundaries_v2.md), [v1](4_module_boundaries_v1.md)). **21 module** sau khi gỡ 5 module LEGACY (`versions`, `cell-edit`, `clean-rules`, `lineage`, `exports`) và thêm module `feedback` — mô hình **read-only**: dữ liệu bất biến, không có đường ghi nào ngoài Import.
5. [Thiết kế Ports and Adapters](5_ports_adapters_design_v2.md) — **v2 đang dùng** (giữ để đối chiếu: [v1](5_ports_adapters_design_v1.md)). Cấu trúc tầng + quy tắc chiều dependency, Rich Domain Model với `create()`/`reconstitute()`, vị trí port (`domain/ports` + `application/ports`), Symbol DI token, 1 handler/use case, trường `version` cho optimistic locking, **cursor pagination**, luồng gom domain event → transactional outbox → Kafka, nội dung `packages/core` + `packages/contracts`.
6. [Xác thực, phân quyền và bảo vệ dữ liệu](6_security_authorization_v6.md) — **v6 đang dùng** (giữ để đối chiếu: [v5](6_security_authorization_v5.md), [v4](6_security_authorization_v4.md), [v3](6_security_authorization_v3.md), [v2](6_security_authorization_v2.md), [v1](6_security_authorization_v1.md)). Mô hình **5 vai trò**, ma trận quyền đầy đủ **66 use case**, quyền cho nhóm nhận xét `UC-68`→`UC-72`, quyền kết nối **Socket.IO**, chính sách bảo mật cho **AI chạy nội bộ**; đã gỡ toàn bộ quyền liên quan đến sheet (chỉ còn `.csv`).
7. [Thiết kế hợp đồng API](7_api_contracts_v6.md) — **v6 đang dùng** (giữ để đối chiếu: [v5](7_api_contracts_v5.md), [v4](7_api_contracts_v4.md), [v3](7_api_contracts_v3.md), [v2](7_api_contracts_v2.md), [v1](7_api_contracts_v1.md)). Quyết định hợp đồng (response thẳng dữ liệu, camelCase, lỗi `{ error: { code, message, details? } }`, REST URL, **cursor pagination** `{ items, nextCursor, hasMore }`, 202 Accepted, download stream) và **bảng 85 HTTP endpoint + 1 kết nối WS**.
8. [Thiết kế dữ liệu và database schema](8_database_schema_v6.md) — **v6 đang dùng** (giữ để đối chiếu: [v5](8_database_schema_v5.md), [v4](8_database_schema_v4.md), [v3](8_database_schema_v3.md), [v2](8_database_schema_v2.md), [v1](8_database_schema_v1.md)). Thiết kế **21 collection** đầy đủ kèm index/unique constraint; gộp `dataset_sheet` vào `dataset` (chỉ `.csv`), thêm `finding_feedback` + `feedback_example`; `ai_job` cập nhật cho Kafka + model; **ràng buộc insert-only cho `dataset_record`**.
9. [Tích hợp, sự kiện và worker](9_integrations_events_workers_v4.md) — **v4 đang dùng** (giữ để đối chiếu: [v3](9_integrations_events_workers_v3.md), [v2](9_integrations_events_workers_v2.md), [v1](9_integrations_events_workers_v1.md)). **Kafka** (5 topic, 6 consumer group, DLQ) + **Socket.IO** realtime; cơ chế outbox 2 kênh; consumer idempotent qua `processed_event`; 6 nhóm sự kiện realtime.
10. [Cấu hình, vận hành và quan sát hệ thống](10_runtime_operations_v6.md) — **v6 đang dùng** (giữ để đối chiếu: [v5](10_runtime_operations_v5.md), [v4](10_runtime_operations_v4.md), [v3](10_runtime_operations_v3.md), [v2](10_runtime_operations_v2.md), [v1](10_runtime_operations_v1.md)). Docker Compose với container `ai-engine`; RAM guard; biến môi trường AI cục bộ, Kafka, realtime; 3 cấp độ health check; log JSON; backup 2 tầng; quy trình deploy + rollback; 35 quy tắc O1–O35.
11. [Chuyển đổi dữ liệu, tương thích và rollback](11_migration_compatibility_v4.md) — **v4 đang dùng** (giữ để đối chiếu: [v3](11_migration_compatibility_v3.md), [v2](11_migration_compatibility_v2.md), [v1](11_migration_compatibility_v1.md)). 15 quyết định migration; **17 collection cũ → 21 collection mới**; xoá `dataset_sheet`, bỏ qua dataset có `file_format != 'csv'`; script xoá 7 collection LEGACY; smoke test; 29 quy tắc M1–M29.
12. [Logic xử lý dữ liệu và phạm vi AI](12_processing_logic_ai_v8.md) — **v8 đang dùng** (giữ để đối chiếu: [v7](12_processing_logic_ai_v7.md), [v6](12_processing_logic_ai_v6.md), [v5](12_processing_logic_ai_v5.md), [v4](12_processing_logic_ai_v4.md), [v3](12_processing_logic_ai_v3.md), [v2](12_processing_logic_ai_v2.md), [v1](12_processing_logic_ai_v1.md)). Logic AI **cục bộ** (che PII, không egress), cơ chế **học lại RAG T1**, ngưỡng ảnh hưởng, bất biến dữ liệu (`input_fingerprint`) và **quy trình benchmark 5 model / 9 chỉ số** với đường Pareto, kiểm định thống kê và định tuyến hai tầng.
13. [Chiến lược kiểm thử và tiêu chí nghiệm thu](13_testing_acceptance_plan_v7.md) — **v7 đang dùng** (giữ để đối chiếu: [v6](13_testing_acceptance_plan_v6.md), [v5](13_testing_acceptance_plan_v5.md), [v4](13_testing_acceptance_plan_v4.md), [v3](13_testing_acceptance_plan_v3.md), [v2](13_testing_acceptance_plan_v2.md), [v1](13_testing_acceptance_plan_v1.md)). **9 tầng test** (thêm **Tầng 9 — Benchmark AI & học lại**); **ma trận truy xuất ngược 125 quy tắc**; 3 bảng mapping (**85 tính năng / 66 use case / 85 endpoint**); **48 tình huống** phân quyền tự động.
14. [Kế hoạch thực hiện tái cấu trúc](14_implementation_plan_v7.md) — **v7 đang dùng** (giữ để đối chiếu: [v6](14_implementation_plan_v6.md), [v5](14_implementation_plan_v5.md), [v4](14_implementation_plan_v4.md), [v3](14_implementation_plan_v3.md), [v2](14_implementation_plan_v2.md), [v1](14_implementation_plan_v1.md)). Chiến lược Hybrid; monorepo pnpm; **7 đợt giao hàng** (thêm Đợt 7 — Feedback & học lại, Đợt 5 gồm benchmark 5 model); ước lượng **~189,5 ngày công** ↔ ~53–71 đơn vị thực thi; 15 rủi ro R1–R15.
15. [Đánh giá cuối và bàn giao backend](15_evaluation_handover_v1.md) — khung chờ thảo luận.

## Quyết định kiến trúc v2: 5 thay đổi — 2026-11-05

Sau quyết định *dữ liệu bất biến*, bộ tài liệu được nâng phiên bản theo **5 quyết định kiến trúc mới**:

| # | Quyết định | Nội dung | Tài liệu ảnh hưởng |
|---|---|---|---|
| 1 | **Phản hồi & học lại (Human-in-the-Loop, RAG T1)** | Mỗi kết quả có khối đánh giá cho người dùng nhận xét (`verdict`, `confidence`, `issueCategory`, `comment`, `correctedExplanation`, `evidenceRefs`, `rating`, `responseTimeMs`). Lưu append-only vào `finding_feedback`; mẫu đã khử định danh sang `feedback_example`, embed bằng Qwen3-Embedding-0.6B, inject **top-5 mẫu few-shot động** vào prompt. | 2 (v5), 3 (v4), 4 (v4), 6 (v5), 8 (v4), 11 (v4), 12 (v4), 13 (v4), 14 (v4) |
| 2 | **AI cục bộ (không API bên ngoài)** | Engine **vLLM** (prod) / **Ollama** (dev). **v6 — năm ứng viên benchmark:** `Qwen3-14B` · `Gemma-3-12B` · `Qwen3-8B` · `Llama-3.1-8B` · `Vistral-7B`. Model chốt theo **9 chỉ số + đường Pareto** trên CPU thật, không chốt trước. Embedding `Qwen3-Embedding-0.6B`. Dữ liệu không rời host. | 2 (v6), 6 (v5), 8 (v4), 9 (v3), 10 (v5), 12 (v5), 13 (v5), 14 (v4) |
| 3 | **Kafka + Socket.IO** | Kafka (KRaft single-node) làm event bus + hàng đợi nền: 5 topic, 6 consumer group, DLQ. Socket.IO đẩy thông báo/tiến độ tới client tại `/api/v1/realtime?token=…`. | 4 (v4), 6 (v5), 7 (v3), 9 (v3), 10 (v4), 13 (v4), 14 (v4) |
| 4 | **Cursor pagination** | Keyset pagination thay offset: `{ items, nextCursor, hasMore }`, cursor base64url ký HMAC. Không còn `offset`/`page`/`total`. | 5 (v2), 7 (v3), 8 (v4), 13 (v4), 14 (v4) |
| 5 | **Chỉ `.csv`** | Bỏ `.xlsx`/`.xls` và khái niệm sheet (`dataset_sheet` bị gỡ, gộp vào `dataset`). Tệp không phải CSV → HTTP 415 trước khi ghi vào R2. | 2 (v5), 3 (v4), 4 (v4), 6 (v5), 7 (v3), 8 (v4), 11 (v4), 13 (v4), 14 (v4) |

**Số liệu chuẩn hiện hành:** **85 tính năng** · **66 use case** · **85 HTTP endpoint + 1 WS** · **21 collection** · **21 module** · **125 quy tắc kiểm thử** (9 tầng) · **48 tình huống phân quyền** · **7 đợt giao hàng** · **~189,5 ngày công**.

Tài liệu đồng bộ: Phần 2 (v7), 3 (v5), 4 (v4), 5 (v2), 6 (v5), 7 (v4), 8 (v4), 9 (v3), 10 (v5), 11 (v4), 12 (v6), 13 (v6), 14 (v6) + `_cong_nghe_ky_thuat.md` (v3) + `tech.md` (v3).

## Quyết định kiến trúc: dữ liệu bất biến (chỉ đọc) — 2026-11-05

Toàn bộ bộ tài liệu đã được đồng bộ theo một quyết định nghiệp vụ: **hệ thống không bao giờ sửa, xoá hay thay đổi dòng dữ liệu hoặc giá trị ô dữ liệu.**

| Hạng mục | Nội dung |
|---|---|
| **Nguyên tắc** | `dataset_record` là **insert-only**. Đường ghi duy nhất là Import (lô 5.000 bản ghi, upsert idempotent theo `{ dataset_id, sheet_id, row_index }`). Không có `updateOne`, `deleteMany`, `findOneAndUpdate`, không soft-delete. |
| **Dữ liệu thiếu / không hợp lệ** | Chỉ bị **loại khỏi phép tính thống kê cụ thể**, không bị xoá khỏi dataset. Tổng kết luôn nêu rõ số lượng và lý do bị loại. |
| **Thao tác còn giữ** | Đổi **tên cột** (metadata cột), chọn cột phân tích, đánh dấu cột nhãn, cấu hình ngưỡng. Đây là metadata, không phải thay đổi giá trị. |
| **Reset Dataset** | Thu hẹp: chỉ đặt lại **tên cột** về đúng tên trong file gốc. |
| **AI** | Giữ 4 vai trò (phát hiện, giải thích, gợi ý xử lý, nhận xét chất lượng) nhưng **không có đường thực thi** — không endpoint tự sửa, không worker tự ghi. |
| **Module bị gỡ** | `versions`, `cell-edit`, `clean-rules`, `lineage`, `exports` (5 module) → còn **20 module**. |
| **Collection bị gỡ** | `dataset_version` → còn **21 collection**. |
| **Số liệu toàn bộ** | **77 tính năng** · **62 use case** · **80 endpoint** · **93 quy tắc kiểm thử** · **34 tình huống phân quyền** · **~146 ngày công**. |

Tài liệu bị ảnh hưởng và đã được nâng phiên bản: Phần 2 (v4), 3 (v3), 4 (v3), 6 (v4), 7 (v2), 8 (v3), 9 (v2), 10 (v3), 11 (v2), 12 (v3), 13 (v2), 14 (v2).

## Trạng thái hiện tại

> **Lưu ý:** phần này là **nhật ký lịch sử** các lần cập nhật tài liệu. Các số liệu trong những đoạn ghi cũ (84 tính năng, 67 use case, 85 endpoint, 92 quy tắc, 22 collection, 21 module, 154,5 ngày công…) là số liệu **tại thời điểm đó**, đã bị thay thế bởi số liệu chuẩn hiện hành nêu ở bảng *Quyết định kiến trúc v2* ở trên: **85 tính năng · 66 use case · 85 endpoint · 120 quy tắc · 21 collection · 21 module · ~181 ngày công**.

Đã tạo bộ khung v1 theo yêu cầu ngày 2026-11-02. Chưa bắt đầu implementation. Định hướng đã chọn là Modular Monolith với Ports and Adapters, API chạy chung và chỉ tách worker theo nhu cầu đã xác định. Phạm vi là backend.

**Cập nhật 2026-11-04:** phần 2 đã hoàn thành vòng thảo luận đầu tiên và được nâng lên v2 (mục 3.25–3.31 ghi nhận các quyết định mới: giới hạn dung lượng, quy ước đọc file, cấu trúc bảng không hợp lệ, sắp xếp/tìm kiếm, dấu vân tay đầu vào, ngưỡng ảnh hưởng, gợi ý nhãn và múi giờ, bằng chứng mức ô/lưu trữ file/phạm vi AI/phạm vi module/sửa ô). Phần 6 và phần 12 được nâng lên v2 theo các quyết định đó.

**Cập nhật 2026-11-04 (lần 2):** đã chốt thêm 3 câu chặn — bộ lọc giữ dạng phẳng (không nhóm lồng nhau) với quy tắc so khớp chi tiết (phần 2 mục 3.13, 6.2b); thư viện phân tích là `simple-statistics` + `ml-matrix` (phần 12 mục 3.14).

**Cập nhật 2026-11-04 (lần 3):** phần 3 đã hoàn thành v1 với 31 use case. Còn 1 câu hỏi nghiệp vụ đang mở cần xác nhận (hệ quả của quyết định "chỉ Owner được import file" — mục 3.8 và 6.2 của phần 3).

**Cập nhật 2026-11-05:** phần 2 được nâng lên **v3** sau khi đối chiếu 52 tính năng trong file đầu vào `feature_nescessary.xlsx` với danh mục v2, 31 use case của phần 3 và mã nguồn hiện tại. Kết quả: bảng đối chiếu đầy đủ tại mục 3.32, thêm 6 nhóm tính năng mới (`AUTH-*`, `USER-*`/`ADMIN-*`, `WS-*`, `PROJ-*`, `NOTIF-*`, `ISSUE-*`) tại mục 3.33–3.38, chia đợt giao hàng tại mục 3.39, và 20 quyết định mới được ghi tại mục 6.2c. Tổng danh mục: **84 tính năng** (28 lõi Data Quality + 56 mới).

**Chia đợt giao hàng (mục 3.39 của phần 2):**
- **Đợt 1** — auth/tài khoản: đăng ký, đăng nhập, phiên đăng nhập, OTP, hồ sơ, thông báo, báo cáo sự cố, workspace/project cơ bản.
- **Đợt 2** — lõi Data Quality (import → Data Views → Analysis & Detection → Tổng kết → PDF) + Google login.
- **Đợt 3** — ~~lịch sử phiên bản (module `versions`)~~ → **đã gỡ** theo quyết định dữ liệu bất biến (2026-11-05); đợt này được gộp lại vào đợt 4.

Tác động cần đồng bộ (chưa thực hiện trong đợt này, theo quyết định `part2_only`):
- **Phần 3:** cần bổ sung khoảng 20 use case cho các tính năng mới.
- **Phần 6:** cần nâng lên v3 để thêm vai trò `admin` hệ thống (mục 3.34.1) và chốt quyền cho các tính năng mới.
- **Phần 4:** ~~xác định module mới `notifications`, `issues`, `admin`~~ → **đã xong ở lần cập nhật 3**: module mới là `notifications`, `issues`, `audit` (không có `admin`); `versions` được kéo vào phạm vi giao hàng và viết lại.
- **Phần 8:** trường mới `project.status`, `user.phone`, `user.bio`, `user.notifications_enabled`, `workspace.last_accessed_at`, collection `notification`, `issue_report`.

**Cập nhật 2026-11-05 (lần 2):** phần 3 được nâng lên **v2** — bổ sung **36 use case** (UC-32 → UC-67) cho các tính năng mới trong phần 2 v3, theo 4 nhóm mới: xác thực/tài khoản, workspace/project bổ sung, thông báo, báo cáo sự cố. Bổ sung 2 mã lỗi mới (`TOKEN_INVALID`, `TOKEN_EXPIRED`), ký hiệu actor `SYS-ADMIN` và `SELF`, ma trận quyền v2, và 4 vòng đời trạng thái mới (phiên đăng nhập, OTP, báo cáo sự cố, trạng thái project).

Tiếp theo: **phần 15 — Đánh giá cuối và bàn giao**. Các câu hỏi mở còn lại (đã lọc bỏ những cái đã đóng ở phần 4, 6, 10 và 11): ngưỡng lớp quá ít mẫu, giới hạn tinh chỉnh tham số, số kỳ tối thiểu của phân tích thời gian, bố cục và mức chi tiết báo cáo PDF, chỉ số thứ 5 của tổng quan workspace, giới hạn dung lượng tệp đính kèm báo cáo sự cố, chính sách giữ thông báo, và có gửi email cho thông báo bắt buộc hay không. Câu hỏi về module `exports` và cơ chế vai trò workspace đã đóng ở Phần 13 và Phần 11. Chưa tự chốt API, schema, migration, công nghệ mới hoặc ngưỡng test.

**Cập nhật 2026-11-05 (lần 3):** phần 4 đã hoàn thành v1. Các quyết định nền tảng:
- **Viết lại toàn bộ backend** trong monorepo pnpm mới (`apps/api`, `apps/worker`, `packages/core`, `packages/contracts`), thay cho tái cấu trúc tại chỗ. NestJS 11, Mongoose 9, Zod 4, BullMQ + Redis, PDFKit, giữ R2 qua port `StoragePort`, URL mới `/api/v1/...`.
- **21 module** với quy tắc "mỗi module sở hữu duy nhất collection của nó", giao tiếp qua port, không import chéo service, không truy vấn chéo collection.
- **Không có module `admin`** — `ADMIN-01` vào module `users`, `ISSUE-04` vào module `issues`.
- **Vai trò project** ở collection riêng `project_member` (`owner|member|viewer`), tách biệt với `WS-OWNER` trong `workspace.members[]`.
- **Cơ chế sự kiện**: transactional outbox → BullMQ; listener phải idempotent.
- **3 module LEGACY bị xoá** (`clean-rules`, `lineage`, `exports`); `versions` được viết lại và vào phạm vi Đợt 3.
- **Có migration dữ liệu** từ schema cũ sang schema mới — phần 11 trở thành phần bắt buộc.
- Phần 2 mục 3.31.4 (job table MongoDB + polling) **bị thay thế** bằng BullMQ — cần cập nhật phần 2 và phần 12.

**Cập nhật 2026-11-05 (lần 4):** phần 6 được nâng lên **v3**. Quyết định chính:
- **Mô hình 5 vai trò**: `SYS-ADMIN` (hệ thống, tách biệt hoàn toàn) + `WS-OWNER`/`WS-MEMBER` (workspace) + `PROJ-OWNER`/`PROJ-MEMBER`/`PROJ-VIEWER` (project). `WS-MEMBER` chỉ **đọc** ở cấp workspace.
- **`SYS-ADMIN` chỉ có 3 quyền**: `ADMIN-01`, `ISSUE-04`, xem audit log. Không đọc dữ liệu nghiệp vụ, không phải thành viên workspace/project.
- **Ma trận quyền đầy đủ 67 use case** có cột `SYS-ADMIN`.
- **Đăng ký công khai**; vai trò `admin` chỉ cấp qua database/bootstrap (bỏ trường `role` khỏi DTO đăng ký).
- **Token**: access 15 phút, refresh 7 ngày (rotation + reuse detection → thu hồi toàn bộ phiên), phiên TTL 30 ngày.
- **Audit log**: module riêng `apps/api/src/modules/audit/`, 8 hành động bắt buộc ghi log; `SYS-ADMIN` xem toàn cục, `WS-OWNER` xem trong workspace của họ.
- **Rate-limit Redis** (dùng chung BullMQ) cho login/OTP/đổi mật khẩu/đăng ký.
- **CASL thay cho `can(Action.Manage, 'all')`**; vai trò workspace/project đọc từ DB mỗi request, không nhúng vào JWT.
- **`PROJ-VIEWER` được tải file gốc** — ranh giới an toàn là "quyền ghi vào dữ liệu làm việc", không phải "quyền tải".
- **Không có 2FA** ở đợt này (6 biện pháp thay thế). **Không xoá tự động** bằng chứng/dữ liệu ở đợt này.
- Danh sách **11 điểm sửa bắt buộc** trong code hiện tại + **36 tình huống truy cập trái phép** bắt buộc kiểm thử.

**Cập nhật 2026-11-05 (lần 5):** phần 5 đã hoàn thành v1. Chốt 12 quyết định:
- **Rich Domain Model** — entity là class có hành vi, `private constructor` + `static create()` / `static reconstitute()`, state riêng tư, invariant tự bảo vệ.
- **Port**: `domain/ports/` = port repository của aggregate; `application/ports/` = port hạ tầng (`StoragePort`, `EmailSenderPort`, `AiAnalyzerPort`, `JobQueuePort`, `AuditLogPort`).
- **DI token dùng Symbol** + `useExisting` (theo thông lệ DI token).
- **1 handler class / use case** trong `application/commands/` hoặc `application/queries/`; controller chỉ validate → gọi handler → map response.
- **`packages/core`** chứa `BaseEntity`, `DomainEvent`, lỗi domain, VO, pagination, `stats/` — thuần TS, không framework, dùng chung `api` + `worker`.
- **`packages/contracts`** chứa schema Zod của DTO — một nguồn cho cả validate và OpenAPI.
- **Optimistic locking bằng trường `version`** — bắt buộc cho `PROJ-12`, `WS-09`, `PROJ-10`, `PROJ-11`, `ISSUE-04`.
- **Offset pagination** (`page`, `limit`), trả kèm `total`/`totalPages`.
- **Luồng sự kiện**: entity gom domain event → handler `dispatchDomainEvents()` → ghi `outbox_event` trong cùng transaction → relay publish BullMQ → consumer idempotent.
- **Không dùng** `@nestjs/cqrs`, `EventEmitter2`, `If-Match`/ETag, cursor pagination.
- 12 quy tắc kiểm tra dependency **R1–R12**; 14 điểm sửa bắt buộc trong code hiện tại.

**Cập nhật 2026-11-05 (lần 14):** bổ sung Phần 14 sau khi người dùng chốt "không cần chia đợt, làm nhanh nhất có thể":
- **Quyết định 15:** 6 đợt giữ làm **đơn vị công việc logic** (checkpoint nghiệm thu), **không phải mốc thời gian**. Cổng nghiệm thu 9 mục vẫn bắt buộc — bỏ ràng buộc lịch không đồng nghĩa bỏ tiêu chí chất lượng.
- **Quyết định 16:** ước lượng tính theo mô hình **người + AI cùng làm** — 154,5 ngày công chuẩn hóa (1 người, 8h/ngày) ↔ **~45–60 đơn vị thực thi**. Con số 154,5 giữ nguyên giá trị như đơn vị so sánh giữa các đợt.
- Thêm quy tắc K19 (được phép dừng giữa đợt, luôn giữ trạng thái chạy được) và K20 (ước lượng phải ghi kèm ngày đo).

**Cập nhật 2026-11-05 (lần 13):** phần 14 đã hoàn thành v1. Chốt 14 quyết định triển khai:
- **Chiến lược Hybrid** (không phải Big Bang) — dựng nền tảng trước, chuyển module theo nhóm nghiệp vụ. API cũ vẫn chạy cho tới khi nhóm module mới sẵn sàng, nên **không có giai đoạn giữa không dùng được** như Big Bang.
- **Chuyển traffic bằng feature flag theo module**, lưu trong collection `feature_flag` (3 trạng thái `legacy`/`canary`/`new`) — tắt cờ là rollback trong vài giây, không cần deploy.
- **Monorepo pnpm**: `apps/api`, `apps/worker`, `packages/core`, `packages/contracts`, `packages/config`.
- **6 đợt giao hàng**, mỗi đợt có scope + quy tắc test + tiêu chí nghiệm thu riêng: Đợt 1 nền tảng & hạ tầng test → Đợt 2 tài khoản & phiên → Đợt 3 không gian làm việc → Đợt 4 dữ liệu → Đợt 5 phân tích & AI → Đợt 6 hoàn tất & cutover.
- **Ước lượng 154,5 ngày công** (22 hạ tầng + 119 module + 13,5 migration & bàn giao), trong đó ~38 ngày là test — khớp với ước lượng Phần 13.
- **Cảnh báo lệch lịch**: quyết định "1 tuần/đợt" × 6 đợt = 6 tuần, nhưng thực tế cần ~36 tuần làm việc của 1 người. Tài liệu đưa 3 phương án: thêm 1 người (~22 tuần) · cắt phạm vi (~28 tuần, không khuyến nghị vì tạo nợ kỹ thuật) · chấp nhận 36 tuần. **Cần chốt trước khi bắt đầu Đợt 1.**
- **Nhánh `Hoa24102026`**, không nhánh con, commit Conventional Commits với scope module, body tham chiếu UC + quy tắc test. PR đính kèm báo cáo test + checklist 12 mục.
- **Migrate dữ liệu theo từng nhóm module** — cắt nhỏ 8 bước của Phần 11 thành 5 lần cutover riêng, giảm blast radius.
- **92 quy tắc test phân bổ theo đợt**: Đợt 1 chiếm 43 quy tắc (kiến trúc + contract + outbox/inbox + env).

**Cập nhật 2026-11-05 (lần 12):** phần 13 đã hoàn thành v1. Chốt 14 quyết định kiểm thử:
- **8 tầng test đầy đủ**: contract → domain → use case → adapter → E2E → kiến trúc → bảo mật → hiệu năng, chạy theo thứ tự rẻ trước đắn sau.
- **Môi trường E2E**: container **Mongo replica set** 1 node + Redis + MinIO. Đây là điểm quan trọng — Atlas M0 (môi trường dev) không có replica set nên không thể test transaction + change stream, tức là không test được outbox/inbox/idempotency.
- **Ma trận truy xuất ngược 92 quy tắc** đã rải rác ở 11 phần trước (S/C/I/O/M) — mỗi quy tắc gắn tầng test + file test cụ thể. 85 tự động, 7 thủ công.
- **Bảng mapping đầy đủ**: 84 tính năng, 67 use case, 85 endpoint, mỗi endpoint ≥ 2 ca test, endpoint nhạy cảm ≥ 4 ca.
- **Coverage theo tầng**: domain ≥ 90%, application ≥ 80%, infrastructure ≥ 60%, contracts ≥ 95%, tổng ≥ 70% — cao hơn hệ thống tham chiếu (47%) vì code viết lại từ đầu, không có di sản.
- **Ranh giới kiến trúc tự động**: script `check-architecture.mjs` với 12 quy tắc A1–A12 (domain không import NestJS/Mongoose, không import chéo module, cấm `any`...).
- **36 tình huống truy cập trái phép** (Phần 6 v3) → test tự động, assert cả status, mã lỗi và không có side effect.
- **AI luôn mock** — không bao giờ gọi Gemini thật trong test.
- **CI chỉ là script `pnpm test:all` chạy local** — không GitHub Actions, không auto-deploy. Nhưng gate **chặn**: test fail hoặc coverage dưới ngưỡng thì không commit, không deploy.
- **Bằng chứng nghiệm thu**: báo cáo tự động 6 mục (`docs/test-reports/`) + phần kết luận do người viết.
- **Ước tính ~850 test / ~38 ngày công** — khối lượng test lớn hơn code, đánh đổi được chấp nhận vì đợt này viết lại toàn bộ backend.

**Hai câu hỏi treo đã đóng:** module `exports` LEGACY **xoá hẳn** (chốt ở Phần 13, áp dụng mục 3.7.4 của Phần 11); cơ chế bảo trì vai trò workspace `owner|editor|viewer` → `owner|member` **có chạy migration** (đã chốt ở Phần 11 mục 3.6.3).

**Cập nhật 2026-11-05 (lần 11):** phần 11 đã hoàn thành v1. Chốt 13 quyết định migration:
- **Chiến lược "collection mới song song"** — migrate sang tên collection mới, giữ collection cũ 30 ngày. Đánh đổi: dung lượng tạm thời × 2, nhưng đổi lại rollback mức 1 luôn khả dụng vì collection cũ không bị sửa.
- **Bulk write theo lô** 5.000 docs/lần, `ordered: false`, có checkpoint để resume — chạy lại 2 lần cho kết quả giống hệt.
- **Sinh ULID mới** cho mọi `_id`, lưu bảng `id_map` (unique `(entity_type, old_id)`) — cần cho rollback và tra cứu hậu kiểm.
- **Không dual-write** — cutover là một thời điểm cắt, có maintenance window 30 phút – 2 giờ.
- Map vai trò workspace `editor|viewer` → `member`; `project.status` suy ra từ **`dataset.status`** (có `READY`/`INGESTING` → `in_progress`).
- Công cụ: 8 script `ts-node` theo pattern chuẩn, 3 chế độ `--dry-run`/`--apply`/`--verify` (mặc định dry-run).
- Kiểm chứng **4 mức**: số lượng theo công thức kỳ vọng, hash mẫu ngẫu nhiên 1%, referential integrity 20 quan hệ, kiểm tra quyền 6 tiêu chí.
- Rollback 3 mức (code / kèm dữ liệu / restore từ backup) kèm ma trận quyết định.
- **Xoá module `lineage` hoàn toàn** — gỡ `neo4j.service.ts`, gỡ 3 biến `NEO4J_*`, xoá graph trên AuraDB, huỷ instance. Bỏ 1 dependency.
- Xoá 5 collection LEGACY (`clean_rules`, `lineage`, `lineage_nodes`, `exports`, `export_tasks`) ngay sau khi cutover thành công.

**Phát hiện quan trọng:** module `lineage` hiện tại dùng **Neo4j AuraDB** (không phải MongoDB) — cần 9 bước gỡ riêng, không chỉ xoá collection.

**Một điểm cần sửa ở Phần 10:** quy tắc "deploy thường dừng `api`, giữ `worker` chạy" **không đúng** cho cutover migration — phải dừng **cả 2**, vì worker cũ có thể ghi vào collection cũ trong lúc migrate gây sai lệch số lượng. Job BullMQ vẫn an toàn (Redis `appendonly yes`). Sẽ cập nhật ở Phần 10 v2.

**Cập nhật 2026-11-05 (lần 10):** phần 10 đã hoàn thành v1. Chốt 9 quyết định vận hành:
- **Docker Compose trên VPS** — 2 container (`api`, `worker`) + Redis; MongoDB dùng Atlas, không chạy container DB.
- **Observability tối giản** — log JSON ra stdout + 3 cấp độ health endpoint; không Prometheus/Grafana/Sentry.
- **Log JSON structured** (`nestjs-pino`) với danh sách redact cố định và 4 quy tắc dữ liệu nhạy cảm.
- **Atlas M0 cho dev, M10 cho production** — M0 không có replica set nên thiết kế **3 tầng fallback**: đầy đủ (transaction + change stream) → giả lập (chỉ polling) → tự phát hiện. Production **refuse to start** nếu không có transaction.
- **Quota theo workspace** (500 MB) với cơ chế cập nhật `storage_used_bytes` trong transaction.
- **Không DLQ** — dựa vào `removeOnFail` của BullMQ + `outbox_event.status='failed'` + log cảnh báo.
- **Secret trong `.env`**, `chmod 600` ở production, không commit.
- **Redis 1 instance** cho BullMQ + rate-limit, AOF bật, `maxmemory-policy noeviction` (không xoá job đang chờ).
- Giữ cấu hình R2 hiện có, bật versioning; backup 2 tầng: Atlas Continuous Backup + snapshot R2 hằng ngày.
- Quy trình deploy 7 bước + 3 mức rollback; 24 quy tắc kiểm thử O1–O24.

**Cảnh báo quan trọng:** Atlas M0 **không có tính năng backup và không có SLA** — chỉ dùng cho dữ liệu test/fixture, cần seed script để tạo lại trong < 5 phút.

**Cập nhật 2026-11-05 (lần 9):** đồng bộ chéo sau khi chốt Phần 9:
- **Phần 4 → v2:** tên sự kiện nội bộ chuyển sang `dot.camelCase` (khớp Phần 7 mục 3.3 và Phần 9 mục 3.3.2); bảng sự kiện mở rộng 7 → **13**; module `shared` sở hữu `outbox_event` + `processed_event`; `workspaces` sở hữu thêm `workspace_member` (tách collection, bỏ mảng nhúng `members[]`); sửa lý do unique index Owner.
- **Phần 8 → v2:** 21 → **22 collection**. `outbox_event.status` thêm `publishing` + `lease_expires_at` + index partial; `notification.source_event_id` kèm unique partial `(user_id, source_event_id)`; thêm collection `processed_event` (inbox, TTL 7 ngày); thêm quy tắc S16–S18.
- Lý do thêm `publishing`: nếu chỉ có `pending`/`published` và đánh dấu `published` trước khi publish, worker chết giữa chừng ⇒ event mồ côi mà polling không thấy. `lease_expires_at` cho phép polling nhận ra và phát lại.

**Cập nhật 2026-11-05 (lần 8):** phần 9 đã hoàn thành v1. Chốt 8 quyết định hạ tầng:
- **Relay 2 kênh**: Change Stream (chính, độ trễ ~ms) + polling fallback 30 giây quét event mồ côi — không mất event khi worker restart.
- **Một hàng đợi BullMQ** `domain-events`, `jobId = eventId` chặn enqueue trùng.
- **Inbox pattern** với collection `processed_event` — unique `(consumer_name, event_id)`, lease 30 giây, stale reclaim.
- **At-least-once an toàn** qua trạng thái trung gian `publishing` + `lease_expires_at` — giải quyết lỗ hổng "đánh dấu published trước rồi chết".
- **SMTP/Nodemailer** cho OTP, lời mời, thông báo bắt buộc — gửi bất đồng bộ qua BullMQ.
- **Sinh PDF ở worker** (PDFKit), trả 202 + `pollUrl`.
- **Job cleanup hằng ngày 02:00 giờ VN** — dọn dữ liệu quá hạn + file R2, idempotent, không xoá bản ghi còn tham chiếu.
- **Chỉ `apps/worker` chạy consumer** — API không chạy nền, scale độc lập.
- 13 sự kiện nội bộ với envelope chuẩn; tên event dùng `dot.camelCase`.

**Mâu thuẫn cần lưu ý:** Phần 4 mục 3.5 và Phần 8 mục 3.8.5 dùng tên sự kiện `snake_case` (`issue.status_changed`) — Phần 9 chốt `dot.camelCase` (`issue.statusChanged`). Hai tài liệu trước cần cập nhật ở version tiếp theo.

**Cập nhật 2026-11-05 (lần 7):** phần 8 đã hoàn thành v1. Chốt 10 quyết định schema:
- **Khóa chính**: String có tiền tố `<prefix>_<ULID26>` (`usr_`, `ws_`, `prj_`, `ds_`…) — không dùng ObjectId.
- **Thành viên workspace/project tách collection riêng** (`workspace_member`, `project_member`) — unique partial theo `{workspace_id, user_id}`.
- **`dataset_record`**: 1 document = 1 dòng, gom theo sheet; `props` dùng key ổn định `c0`/`c1`… nên sửa tên cột không phải viết lại bản ghi.
- **Lọc/sắp xếp Data View thực hiện trong JS**, không query `props.c*` — ngưỡng 200.000 dòng/sheet.
- **Soft delete** cho thực thể nghiệp vụ; collection log dùng TTL index.
- **`version` cho mọi resource** — optimistic locking thống nhất.
- **`outbox_event` do `shared` sở hữu**; `audit_log` + `audit_change` tách 2 collection.
- **Index chuẩn**, không text index (tìm kiếm substring bằng regex).
- Transaction boundary xác định cho 19 use case; import dataset dùng 5 bước (không transaction cho toàn bộ lô).
- Layout R2: `raw_files/{wsId}/{prjId}/{dsId}.{ext}` — giữ đúng extension gốc, bucket không public.

**Cập nhật 2026-11-05 (lần 6):** phần 7 đã hoàn thành v1. Chốt 10 quyết định:
- **Response thành công trả thẳng dữ liệu** — bỏ key `message`, bỏ key bọc (`{ workspace: {...} }` → `{...}`).
- **JSON camelCase**, MongoDB `snake_case` — tách biệt, mapper lo chuyển đổi.
- **Lỗi**: `{ error: { code, message, details? } }` — `code` là mã ổn định, `message` tiếng Việt để hiển thị.
- **URL REST tài nguyên** lồng theo phân cấp, `/api/v1/...`.
- **Phân trang**: `{ items: [...], meta: { page, limit, total, totalPages } }`.
- **Upload không idempotent** — mỗi lần upload là dataset mới.
- **Bất đồng bộ**: `202 Accepted` + `{ jobId, status, pollUrl }`.
- **Download**: stream trực tiếp, kiểm tra quyền trước, bucket R2 không public.
- **Bộ lọc Data Views** dùng `POST /records/query` (body JSON) để không vượt giới hạn URL.
- **Không cần chạy song song 2 phiên bản API** — backend cũ/mới chạy ở cổng khác nhau.
- Bảng **80 endpoint** phủ đủ **77 tính năng**, mỗi endpoint có cột quyền lấy từ ma trận Phần 6 v4 (đã cập nhật ở v2 của Phần 7).

**Tác động cần đồng bộ (chưa thực hiện):**
- **Phần 2:** cập nhật mục 3.31.4 (BullMQ), mục 3.31.5 (không còn module `admin`), mục 3.32/3.39 (đợt giao hàng và vai trò `versions`).
- ~~**Phần 6:** nâng lên v3~~ → **đã xong ở lần cập nhật 4** (v3 hoàn chỉnh).
- **Phần 12:** cập nhật cơ chế job AI từ polling sang BullMQ.
- **Phần 11:** trở thành phần bắt buộc (migration vai trò workspace `editor`→`member`, thêm `project_member`, đổi `has_dataset`→`status`).
- **Phần 8:** quyết định sinh `id` cho entity mới (câu hỏi mở #5 của phần 5) — ảnh hưởng kiểu khóa chính của **21 collection**.
- **Phần 9:** ~~thiết kế chi tiết outbox relay, BullMQ queue, consumer idempotent, cơ chế phục hồi job~~ — **đã xong trong lần 8**. Cần **cập nhật Phần 8 thành v2**: `outbox_event.status` thêm trạng thái `publishing` + `lease_expires_at`; `notification` thêm `source_event_id` (unique partial với `user_id`); thêm collection `processed_event`.
- **Phần 10:** nâng lên **v2 trong lần 11** — ngoại lệ cutover + backup bắt buộc + biến `MIGRATION_*` + quy tắc O25–O28.
- **Phần 14:** ~~kế hoạch thực hiện~~ — **đã xong trong lần 13**. Phần 15 dùng 6 đợt của Phần 14 làm đơn vị đánh giá và ma trận 92 quy tắc của Phần 13 làm tiêu chí đánh giá cuối; chỉ merge `main` sau khi Phần 15 xác nhận.
- **Phần 13:** ~~chiến lược kiểm thử, ma trận quy tắc, tiêu chí nghiệm thu~~ — **đã xong trong lần 12**. Phần 14 phải tham chiếu ma trận 92 quy tắc và đặt **hạ tầng test là đợt 0**; mỗi đợt giao hàng phải kèm tiêu chí nghiệm thu theo mục 3.13.3.
- **Phần 11:** ~~chiến lược migration, quy trình cutover, quy tắc ánh xạ dữ liệu, kiểm chứng, rollback~~ — **đã xong trong lần 11**. Phần 14 phải đặt migration **sau** khi deploy được code mới trên schema mới (collection rỗng), và cần số liệu `dataset_record` thực tế trước khi chốt lịch cutover.
- **Phần 10:** ~~bảng biến môi trường, docker-compose, health check, logging, metrics, backup/restore, deploy/rollback~~ — **đã xong trong lần 10**. Phần 11 phải tuân thủ 7 quy tắc migration của phần 10 mục 3.10.4 (`up`/`down`, idempotent, không xoá dữ liệu cũ) và bảng đối chiếu schema của Phần 8 v2 mục 3.12.
- **Phần 8:** ~~21 collection + index + unique constraint~~ — **đã xong trong lần 7**, nâng lên **v2 trong lần 9** (thêm `publishing`, `source_event_id`, `processed_event`).
- **Phần 12:** cập nhật mục 3.14 (chuyển thư viện thống kê sang `packages/core/src/stats/`), mục 3.9 (BullMQ thay job table MongoDB).
- ~~**Phần 5:** thiết kế chi tiết port theo ranh giới đã chốt ở phần 4 mục 3.4~~ → **đã xong ở lần cập nhật 5** (v1 hoàn chỉnh).

**Cập nhật 2026-11-05 (lần 15 — quyết định dữ liệu bất biến):** toàn bộ 12 phần bị ảnh hưởng đã được **nâng phiên bản và đồng bộ số liệu** — xem bảng tổng hợp ở mục *Quyết định kiến trúc: dữ liệu bất biến* phía trên. Các mục "Tác động cần đồng bộ" ở trên là **nhật ký của các lần trước**, đã được xử lý xong.

**Cập nhật 2026-11-05 (lần 16 — 5 quyết định kiến trúc v2):** toàn bộ 14 phần đã được **nâng phiên bản và đồng bộ** theo 5 quyết định mới (phản hồi & học lại · AI cục bộ · Kafka + Socket.IO · cursor pagination · chỉ `.csv`) — xem bảng ở mục *Quyết định kiến trúc v2* phía trên. Các thay đổi đáng chú ý:
- **Đảo ngược 4 quyết định cũ**: Gemini API → AI cục bộ (`Qwen3-14B`/`Qwen3-8B`) · BullMQ/Redis → Kafka (5 topic, 6 consumer group, DLQ) · offset pagination → cursor (keyset) · CSV+Excel → **chỉ CSV**.
- **Thêm mới**: module `feedback` (`FB-01`→`FB-06`) với 2 collection `finding_feedback` (append-only) + `feedback_example` (kho mẫu few-shot đã khử định danh) · Socket.IO realtime gateway · port `AiInferencePort`/`EmbeddingPort`/`FeedbackVectorSearchPort`/`RealtimeGatewayPort` · `EventPublisherPort` (Kafka).
- **Gỡ**: `dataset_sheet` collection (gộp vào `dataset`) · mọi endpoint/tham số `offset`/`page`/`total` · mọi tham chiếu `.xlsx`/`.xls` · `GEMINI_API_KEY` (thay bằng `AI_INFERENCE_BASE_URL`, `AI_MODEL_ID`, `KAFKA_BROKERS`).
- **Số liệu chuẩn**: 85 tính năng · 66 use case · 85 HTTP endpoint + 1 WS · 21 collection · 21 module · 120 quy tắc kiểm thử (9 tầng) · 48 tình huống phân quyền · 7 đợt giao hàng · ~189,5 ngày công.
- **Quan trọng về vận hành**: RAM 15 GB của VPS là ràng buộc số 1 — `Qwen3-14B-Q4_K_M` chiếm ~10 GB, nên `ai-engine` có **RAM guard** dừng job AI mới khi RSS vượt 85% host memory.

**Cập nhật 2026-11-06 (lần 17 — benchmark 5 model AI):** quyết định **chọn model AI trở thành quyết định có số liệu**, không chốt trước:
- **5 model ứng viên** theo *giả thuyết* (không theo xếp hạng cảm tính): `Qwen3-14B` (quy mô thắng) · `Gemma-3-12B` (QAT bù thiếu tham số) · `Qwen3-8B` (một nửa tham số có đủ?) · `Llama-3.1-8B` (baseline ngành) · `Vistral-7B` (chuyên biệt tiếng Việt).
- **Loại trước benchmark:** `Qwen3-30B-A3B` (vượt RAM) · `DeepSeek-R1-Distill-Qwen-14B` (p95 quá cao) · `Phi-4-mini` / `PhoGPT-4B` (quá nhỏ).
- **9 chỉ số / 5 nhóm** với ngưỡng tuyệt đối + trọng số 100: F1 micro (30), F1 macro 5 loại DQ (10), JSON hợp lệ (12), ảo giác (10), chất lượng giải thích tiếng Việt (13), p95 latency (10), throughput (5), RSS (5), độ ổn định (5).
- **Kiểm định thống kê bắt buộc:** McNemar + Wilcoxon; chỉ tuyên bố thắng khi **ΔF1 ≥ 0,03 và p < 0,05**; chọn theo **đường Pareto**, không chọn điểm chất lượng tuyệt đối cao nhất.
- **Bỏ judge `Qwen3-32B`** (vượt RAM 15 GB) → **chấm chéo** giữa model 8–14B khác họ để tránh self-preference bias.
- **Kiến trúc định tuyến hai tầng** do benchmark quyết định: tầng nhanh (gợi ý nhãn / phân loại / JSON ngắn) + tầng sâu (giải thích / gợi ý xử lý / nhận xét), fallback → suy giảm có kiểm soát.
- Tài liệu ảnh hưởng: Phần 2 (**v6**), 10 (**v5**), 12 (**v5**), 13 (**v5**), 14 (**v5**) + `_cong_nghe_ky_thuat.md` (**v3**) + `tech.md` (**v3**).


**Cập nhật 2026-11-06 (lần 18 — DQ-05 có điều kiện + ma trận tương quan/VIF do AI đánh giá):** DQ-05 mặc định `unassessed`, kích hoạt khi có quy tắc được xác nhận (checklist 5 điểm, kiểm tra theo dòng); hệ thống tạo ma trận tương quan + bảng VIF (VIF>5 tham khảo, >10 cao); AI diễn giải trên số đã có, cấm suy quy tắc/kết luận nhân quả/yêu cầu xóa cột (Phần 2 v7, 12 v6, 3 v5, 7 v4, 13 v6, 14 v6). Quy tắc kiểm thử 120 → 125 (S24/C14/I22/I23/O36); tổng ~189,5 ngày công.

## Quyết định đồng bộ ngày 14 tháng 11 năm 2026

[Xem các quyết định APPROVED và đề xuất PROPOSED](quyet-dinh-dong-bo-2026-11-14.md). Tổng chính thức hiện hành: **64 Use Case**; kiểm kê mới xác định 62 mã hợp lệ triển khai, 2 mã còn OPEN. Không dùng UC-31 LEGACY hoặc UC-57 đang mâu thuẫn để lấp số. Snapshot lưu cả phân tích/hiển thị; lịch sử feedback collection riêng; PDF/CSV/JSON; thông báo TTL90 và chính chủ được xóa. Các bảng66UC/21collection và diễn giải cũ giữ làm lịch sử; không phải kết quả kiểm kê sau đồng bộ. C10/C11 OPEN. Báo cáo01 v1.2 Under Review; chưa có Báo cáo02.
