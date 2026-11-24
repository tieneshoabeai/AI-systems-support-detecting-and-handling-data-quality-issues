# 13. Chiến lược kiểm thử và tiêu chí nghiệm thu

- **Version:** v18
- **Ngày tạo:** 2026-11-02
- **Cập nhật gần nhất:** 2026-11-25 (v18)
- **Thay đổi v18 (2026-11-25):** bổ sung mục 3.31 — Test đợt đóng việc còn mở của data-view, feedback, analysis (DLT-*, FST-*, NTT-*, ứng với Phần 7 v16 mục 3.26, Phần 12 v17 mục 3.24, Phần 11 v5) + sửa 2 e2e lỗi biên dịch có sẵn. Trạng thái: xem mục 3.31.
- **Thay đổi v17 (2026-11-24):** mục 3.27 (đợt K) đổi trạng thái sang "Đã thực hiện" (v15/v16 chép sót); bổ sung mục 3.30 — Test đợt vá sau rà soát commit (VAT-01…VAT-08, ứng với Phần 7 v15 mục 3.25) + quy ước test phụ thuộc môi trường. Trạng thái: xem mục 3.30.
- **Thay đổi v16 (2026-11-24):** bổ sung mục 3.29 — Test đợt sửa module `feedback` (ứng với Phần 7 v14 mục 3.24, Phần 12 v15 mục 3.24, checklist `src/backend/test/unit_test/13_feedback.md`). Trạng thái: xem mục 3.29.
- **Thay đổi v15 (2026-11-24):** bổ sung mục 3.28 — Test đợt sửa module `data-view` (ứng với Phần 7 v13 mục 3.23, checklist `src/backend/test/unit_test/07_data_view.md`). Trạng thái: xem mục 3.28.
- **Thay đổi v14 (2026-11-24):** bổ sung mục 3.26 — Port test đợt A–I module analysis sau refactor P1–P6 (merge `origin/backend`) và mục 3.27 — Test đợt K (sửa lỗi đúng đắn sau merge). Nguồn: `docs/modules/analysis_plan.md` v1.10 mục 7h + bộ test offline `local_VQD` chạy lại trên code sau merge. Trạng thái: xem mục 3.26.
- **Thay đổi v13 (2026-11-24):** hợp nhất hai nhánh phiên bản sau khi merge `origin/backend` vào `Vqd_BE` (commit `131e14c`): nhánh `Vqd_BE` (tới v12 — module analysis đợt A–I) và nhánh `backend` (tới v9 — Bước 1–6, GĐ, OPEN-01..10, refactor P1–P6). Giữ đủ mục của cả hai nhánh, **không đổi nghiệp vụ**. Hai nhánh cùng dùng số v8–v9: file cùng tên trong thư mục này là bản của `backend`, bản cùng số của `Vqd_BE` lưu ở [`_nhanh_vqd_be/`](_nhanh_vqd_be/). Đường dẫn mã nguồn trong các mục đợt A–I là trước refactor (vd `analysis.service.ts`, `project-access.service.ts`) — bảng đối chiếu sang handler mới ở `docs/modules/analysis_plan.md` v1.9 mục 7g. Chỗ hai nhánh mô tả khác nhau thì **mã nguồn hiện hành và bảng route Phần 7 §3.13 là chuẩn** — vd route `GET/POST projects/{id}/analysis/config` nêu trong các mục đợt A–E đã bị gỡ ở nhánh `backend` (OPEN-06, Phần 7 v8.4: cấu hình phân tích bất biến, `POST projects/{id}/analysis` nhận body rỗng).
- **Thay đổi v12 (2026-11-18):** bổ sung mục 3.25 — Test đợt I module analysis. Nguồn: file `local_VQD/MISSED_ERRORS*.md` sau đợt H (16 lỗi còn lại đều thuộc DQ-05) + `docs/modules/analysis_plan.md` v1.7. Trạng thái: Đã thực hiện 2026-11-18 (đợt I).
- **Thay đổi v11 (2026-11-18):** bổ sung mục 3.24 — Test đợt H module analysis. Nguồn: bộ edge-cases `local_VQD/edge-cases` (11 file có bẫy dựng sẵn, file `MISSED_ERRORS_edge-cases.md`) + `docs/modules/analysis_plan.md` v1.6. Trạng thái: Đã thực hiện 2026-11-18 (đợt H).
- **Thay đổi v10 (2026-11-17):** bổ sung mục 3.23 — Test đợt G module analysis. Nguồn: bộ test offline `local_VQD` (oracle độc lập + tiêm lỗi, file `MISSED_ERRORS.md`) + `docs/modules/analysis_plan.md` v1.5. Trạng thái: Đã thực hiện 2026-11-17 (đợt G).
- **Thay đổi v9 (2026-11-17):** bổ sung mục 3.22 — Test đợt F module analysis. Nguồn: demo offline Titanic 2026-11-17 + `docs/modules/analysis_plan.md` v1.4. Trạng thái: Đã thực hiện 2026-11-17 (đợt F).
- **Thay đổi v8 (2026-11-17):** bổ sung mục 3.20 — Test bổ sung cho hoàn thiện module analysis. Nguồn: Kế hoạch hoàn thiện module `analysis` (`docs/modules/analysis_plan.md`). Trạng thái: đã thực hiện. **Bổ sung đợt D/E:** mục 3.21 — Test bổ sung đợt D/E module analysis (đã thực hiện).
- **Trạng thái:** Đã chốt 17 quyết định kiểm thử và thiết kế chi tiết **9 tầng test** (thêm **Tầng 9 — Benchmark AI & học lại**), ma trận truy xuất ngược **143 quy tắc kiểm thử** (S/C/I/O/M) + **85 tính năng** + 66 use case + **84 route HTTP thực thi**, ngưỡng coverage theo tầng, checker kiến trúc tự động, `k6` cho hiệu năng, factory + seed cho dữ liệu test, **48** tình huống phân quyền tự động, và quy trình nghiệm thu 3 bước. **v9 (2026-11-16):** đồng bộ với mã nguồn sau Bước 1–6 (Remember-me, Issue `needs_info`, Keyset cursor, Search/Overview/Profile/Project Owner, Clean Architecture 107 command/query handler, Google OAuth 2.0 thật, ESLint `--max-warnings 0`) — bổ sung **14 quy tắc mới** (S25–S29, C16–C21, I24–I25, O37–O39), 5 bộ test mới (**83 ca**), cập nhật bảng mapping theo **85 tính năng / 84 route HTTP**.
- **Thay đổi v2 (2026-11-05):** đồng bộ theo quyết định **dữ liệu bất biến (chỉ đọc)** — bỏ toàn bộ test cho xoá dòng, sửa ô, clean-rules, rollback phiên bản, lineage; bổ sung test **insert-only** cho `dataset_record`; số liệu toàn tài liệu cập nhật (93 quy tắc / 77 tính năng / 62 use case / 80 endpoint / 21 collection / 34 tình huống phân quyền).
- **Thay đổi v4 (2026-11-05):** áp dụng 4 quyết định kiến trúc. (1) **Cursor pagination** — thêm bộ test phân trang keyset (C9–C13) + quy tắc kiến trúc A15. (2) **Kafka + Socket.IO** — thêm container Kafka vào môi trường test, bộ test luồng sự kiện (I15–I21) và test realtime. (3) **AI cục bộ** — quyết định 8 viết lại (mock adapter, không bao giờ gọi network ra ngoài), thêm **Tầng 9 — Benchmark AI & học lại** (quyết định 15–17). (4) **Chỉ `.csv`** — test từ chối `.xlsx` (C13) + quy tắc A16. Ngoài ra: số liệu cập nhật (120 quy tắc / 79 tính năng / 66 use case / 85 endpoint / 48 tình huống phân quyền).
- **Giai đoạn:** Chuẩn bị implementation/evaluation
- **Thứ tự thực hiện:** Phần 13; sử dụng kết quả đã xác nhận của các phần trước.
- **Quan hệ với các phần khác:** gom và kiểm chứng toàn bộ quy tắc đã chốt ở Phần 5 v3 (ports/adapters — có `GOOGLE_OAUTH_PORT`), Phần 6 v7 (phân quyền), Phần 7 v8.4 (contract — 84 route HTTP), Phần 8 v7 (schema), Phần 9 v3 (integration), Phần 10 v7 (vận hành), Phần 11 v4 (migration), Phần 12 v6 (logic AI + DQ-05 có điều kiện + AI đánh giá tương quan/VIF); là điều kiện tiên quyết cho Phần 14.
- **Thay đổi v8 (2026-11-15):** đồng bộ với Phần 7 v7 — `GET /workspaces` và `GET /workspaces/{workspaceId}/projects` đã hiện thực hoá **keyset cursor** (bỏ `page`/`total`, thêm `cursor`/`limit`, `meta` có `nextCursor`+`hasMore`+`limit`). Bổ sung quy tắc **C14** (cursor ràng buộc theo `sort`) và **C15** (quy tắc kiến trúc A15 mở rộng: cấm `countDocuments`/`skip` cho endpoint list workspace/project); cập nhật ma trận 120 → **122 quy tắc**. Xem mục 3.11.2b.
- **Thay đổi v9 (2026-11-16):** đồng bộ toàn bộ tài liệu với mã nguồn sau **Bước 1–6** của `edit/02_ke_hoach_thuc_thien.md`. (1) **Tái kiến trúc Clean Architecture** — 107 command/query handler tách từ service, mỗi handler có test riêng; ESLint siết `--max-warnings 0`. (2) **Google OAuth 2.0 thật** (`AUTH-03`) — 10 unit + 3 E2E ca. (3) **Remember-me** (`AUTH-14`) — 11 unit ca. (4) **Issue `needs_info`** (`ISSUE-05`) — 5 unit ca. (5) **Keyset cursor** (`C14`–`C15`) — 23 ca. (6) **Search / Overview / Profile / Project Owner** (Nhóm E–H) — 34 ca. Ma trận 122 → **143 quy tắc**; bảng mapping cập nhật **85 tính năng / 84 route HTTP**. Xem mục **3.11.2c** và **3.12.4**.

## 1. Mục tiêu

Xác định bộ kiểm thử và tiêu chí nghiệm thu để chứng minh đợt tái cấu trúc backend đạt đúng thiết kế đã chốt, trước khi bắt đầu viết code (Phần 14).

## 2. Nội dung cần bàn luận

- Các tầng test cần thiết và ranh giới trách nhiệm giữa chúng.
- Ánh xạ tính năng / use case / endpoint / quy tắc sang test case.
- Môi trường test, dữ liệu thử, mock và dịch vụ thật.
- Ngưỡng đạt, lệnh kiểm tra và bằng chứng nghiệm thu.

## 3. Quyết định và thiết kế chi tiết

### 3.1. Các quyết định nền tảng

| # | Quyết định | Ghi chú |
|---|---|---|
| 1 | Module `exports` (LEGACY): **xoá hẳn** — gỡ khỏi code, xoá collection, không thêm tính năng mới | Đóng câu hỏi treo từ Phần 11 mục 6.2 #3 |
| 2 | Môi trường E2E: **container Mongo replica set** (1 node, docker-compose riêng) | Có transaction + change stream thật, test đúng production |
| 3 | **8 tầng test** đầy đủ | domain, use case, adapter, contract, E2E, architecture, security, performance |
| 4 | Coverage: **theo tầng** — domain ≥ 90%, application ≥ 80%, infrastructure ≥ 60%, tổng ≥ 70% | Buộc chất lượng ở tầng quan trọng nhất |
| 5 | Ranh giới kiến trúc: **script checker tự động** (`check-module.mjs` kiểu chuẩn) | Chạy trong `test:all` |
| 6 | Hiệu năng: **k6** (`smoke.js` + `stress.js`), chạy thủ công trước release | Không chặn CI |
| 7 | Dữ liệu test E2E: **test factory + seed script** có seed cố định | Lặp lại được, không phụ thuộc dữ liệu thật |
| 8 | Test AI: **luôn mock** — không bao giờ gọi engine suy luận thật trong test tầng 1–8 | Nhanh, ổn định, không tốn tài nguyên CPU; **tầng 9** là ngoại lệ (quyết định 15–16) |
| 9 | Bảo mật: **48 tình huống truy cập trái phép** chuyển thành test tự động | Khớp trực tiếp ma trận quyền Phần 6 v5 |
| 10 | Bằng chứng nghiệm thu: **cả hai** — báo cáo tự động + phần kết luận do người viết | Tự động cho số liệu, người cho phán đoán |
| 11 | CI: **chỉ script `pnpm test:all` chạy local** — không GitHub Actions | Không có auto-deploy |
| 12 | Ngưỡng đạt: **chặn** — test fail hoặc coverage dưới ngưỡng thì không commit, không deploy | Dù chưa có CI, gate áp dụng ở quy trình local |
| 13 | Bảng mapping: **đầy đủ** — **85 tính năng** + 66 use case + **84 route HTTP** + **143 quy tắc** | Dùng làm danh sách nghiệm thu |
| 14 | Test hợp đồng API: **cả hai** — snapshot OpenAPI + validate runtime Zod trong E2E | Bắt được cả thay đổi ngoài ý muốn lẫn lỗi runtime |
| 15 | **Tầng 9 — Benchmark AI & học lại**: bộ benchmark cố định đánh giá **5 model cục bộ** (`Qwen3-14B` / `Gemma-3-12B` / `Qwen3-8B` / `Llama-3.1-8B` / `Vistral-7B`) trên cùng tập mẫu, 9 chỉ số, kiểm định thống kê và đường Pareto → chọn model tối ưu | Quyết định chọn model phải dựa trên **số liệu**, không cảm tính |
| 16 | Benchmark **chạy thủ công** (không trong `test:all`) — cần engine thật, thời gian dài | Model cục bộ trên CPU rất chậm; CI không có model |
| 17 | Vòng lặp học lại (feedback → `feedback_example` → truy xuất → cải thiện) có **test tích hợp riêng** | Cơ chế RAG T1 là điểm khác biệt chính của hệ thống |

### 3.2. Tổng quan 8 tầng test

```
                     ────────────────────────────────────────────────────────────────────────────────
                     TẦNG 9  Benchmark AI & học lại     ─ chạy thủ công, cần engine thật
                     TẦNG 8  Hiệu năng (k6)              ─ chạy thủ công trước release
                     ────────────────────────────────────────────────────────────────
                     TẦNG 7  Bảo mật & phân quyền        ─ 48 tình huống, tự động
                     ────────────────────────────────────────────────────────────────
                     TẦNG 6  Kiến trúc (architecture)    ─ script checker tĩnh
                     ────────────────────────────────────────────────────────────────
                     TẦNG 5  E2E / hợp đồng API        ─ container Mongo replica set
                     ────────────────────────────────────────────────────────────────
                     TẦNG 4  Adapter (integration)       ─ Mongo/Redis/R2 thật trong container
                     ────────────────────────────────────────────────────────────────
                     TẦNG 3  Use case (application)      ─ port được mock, logic thật
                     ────────────────────────────────────────────────────────────────
                     TẦNG 2  Domain                     ─ thuần TS, không framework
                     ────────────────────────────────────────────────────────────────
                     TẦNG 1  Hợp đồng API (snapshot)    ─ so khớp openapi.json
```

**Quy tắc về thứ tự chạy (rẻ trước đắn sau):**

| Thứ tự | Tầng | Lý do |
|---|---|---|
| 1 | Tầng 2 (domain) | Nhanh nhất, phát hiện lỗi logic thuần |
| 2 | Tầng 3 (use case) | Vẫn nhanh, không cần I/O |
| 3 | Tầng 1 + 6 (snapshot + architecture) | Tĩnh, mili giây |
| 4 | Tầng 4 (adapter) | Cần container |
| 5 | Tầng 5 (E2E) | Chậm nhất trong nhóm tự động |
| 6 | Tầng 7 (security) | Chạy cùng E2E (dùng chung fixture) |
| 7 | Tầng 8 (k6) | Tách, chạy thủ công |
| 8 | Tầng 9 (benchmark AI) | Tách, chạy thủ công — cần `ai-engine` thật |

**Quy tắc bắt buộc:**
1. Tầng 2 và 3 **không được** chạm MongoDB, Redis, R2, Kafka, engine AI — không mock cũng không. Vi phạm = test không đáng tin.
2. Tầng 2 **không** import NestJS hay Mongoose — cùng quy tắc với mã production (Phần 5).
3. Một test chỉ thuộc **một tầng**. Không trộn unit test với assertion E2E trong cùng file.
4. Test AI **không bao giờ** gọi network ra ngoài (quyết định 8). Tầng 9 là **ngoại lệ duy nhất** — nó gọi `ai-engine` **cục bộ** trong container, không gọi ra internet (quyết định 16).
5. Test E2E **không** dùng dữ liệu thật của bất kỳ workspace nào.

### 3.3. Tầng 1 — Hợp đồng API (snapshot)

**Mục đích:** phát hiện API đổi ngoài ý muốn trước khi deploy.

**Cơ chế:**

```
1. Từ Zod schema trong packages/contracts, sinh OpenAPI schema
2. Ghi ra docs/contracts/openapi.json
3. Commit file này vào repo
4. Trong test:all, sinh lại schema và so khớp với file đã commit
   → lệch → FAIL, kèm diff
```

**Quy tắc bắt buộc:**

| # | Quy tắc |
|---|---|
| 1 | `openapi.json` là **artifact có version** — commit cùng code, thay đổi contract = thay đổi file + PR ghi rõ |
| 2 | Test **không** tự cập nhật file — nếu lệch thì fail, người lập trình chủ động regenerate và commit |
| 3 | Lệnh regenerate: `pnpm contracts:openapi` |
| 4 | Kiểm tra thêm: **không có endpoint trong OpenAPI mà không có trong bảng 84 route HTTP** của Phần 7 và ngược lại |
| 5 | Kiểm tra: mọi response có trường `error.code` thuộc danh mục mã lỗi đã chốt ở Phần 7 |

**Phạm vi kiểm tra:**

| Hạng mục | Nguồn |
|---|---|
| 84 route HTTP, method, path, query param | Phần 7 mục 3.x |
| Tên trường response (`camelCase`) | Phần 7 mục 3.3 |
| Mã lỗi | Phần 7 mục 3.4 |
| Shape của `meta` phân trang | Phần 7 mục 3.5 |
| Quy ước 202 Accepted cho job bất đồng bộ | Phần 7 mục 3.7 |

### 3.4. Tầng 2 — Domain test

**Phạm vi:** `packages/core` và tầng `domain/` của mọi module trong `apps/api`.

**Nguyên tắc:** test thuần TypeScript, **không** NestJS, **không** Mongoose, **không** I/O.

**Quy trình bắt buộc (Rich Domain Model — Phần 5):**

Mọi aggregate phải có **2 nhóm test**:

| Nhóm | Cách test | Ví dụ |
|---|---|---|
| **Hợp lệ** | `create()` với input hợp lệ → trả về aggregate đúng trạng thái | Tạo workspace với tên hợp lệ → `status = 'active'`, `version = 1` |
| **Không hợp lệ** | `create()` / method thay đổi với input vi phạm → **ném lỗi domain** | Đổi vai trò Owner → ném `DomainError`; tạo project với tên rỗng → ném lỗi |

**Phạm vi test bắt buộc theo aggregate:**

| Aggregate | Nhóm test bắt buộc |
|---|---|
| `User` | Tạo hợp lệ; email không hợp lệ; tài khoản `blocked` không đăng nhập được; `notifications_enabled` |
| `Workspace` | Tạo; đổi tên vi phạm độ dài; chuyển Owner; `storage_used_bytes` vượt quota; xoá |
| `Project` | Tạo; đổi trạng thái theo vòng đời hợp lệ; **không** chuyển trạng thái sai (`draft` → `completed` khi chưa có dataset) |
| `Dataset` | Tạo; `content_fingerprint` đúng định dạng; `row_count` khớp sheet |
| `DatasetSheet` | Tạo; `columns` có key `c0`/`c1` liên tục, không trùng |
| `DatasetRecord` | Tạo; `props` chỉ chứa key hợp lệ; giá trị `null` khác "thiếu key" |
| `IssueReport` | Tạo; chuyển trạng thái theo vòng đời; Admin duyệt không được tự duyệt |
| `AnalysisRun` | Tạo; `status` theo vòng đời; `input_fingerprint` |
| `AiJob` | Tạo; `attempt` tăng; trạng thái terminal |
| `Notification` | Tạo; `is_mandatory` không tắt được |
| `Session` | Tạo; `revoked_at`; hết hạn |

**Quy tắc về ngưỡng domain ≥ 90%:**

| # | Quy tắc |
|---|---|
| 1 | Coverage tính **riêng** cho `packages/core` + `*/domain/**` — không gộp với application |
| 2 | Ngưỡng: lines ≥ 90%, branches ≥ 85%, functions ≥ 90% |
| 3 | Dưới ngưỡng → `test:all` **fail** → không commit, không deploy (quyết định 12) |
| 4 | Mọi `DomainError` có nhánh test tương ứng — **không** có `catch` trần nào trong domain không được test |

**Đặc biệt — kiểm thử thuật toán thống kê (`packages/core/src/stats/`):**

Vì dùng `simple-statistics` + `ml-matrix` (Phần 12 mục 3.14), các hàm wrapper của chúng phải có test cho:

| Hàm | Ca test bắt buộc |
|---|---|
| `detectOutliersIQR` | Dữ liệu bình thường (không outlier); dữ liệu có outlier rõ; dữ liệu toàn hằng (IQR = 0 → tránh chia 0); mẫu rỗng; mẫu 1 phần tử |
| `detectOutliersModifiedZ` | Tương tự + trường hợp MAD = 0 |
| `computeMissingRate` | Cột không thiếu; cột thiếu một phần; cột thiếu toàn bộ |
| `computeImbalanceRatio` | Cân bằng; mất cân bằng nhẹ; mất cân bằng nặng |
| `computeVIF` | Không đa cộng tuyến; đa cộng tuyến; ma trận không khả nghịch → trả `null` chứ không ném |
| `computeCorrelation` | Hoàn toàn tương quan; tương quan âm; hằng số → `null` |
| `describeColumn` | Ngày; số; chuỗi; boolean; cột rỗng |

**Quy tắc bắt buộc:** mỗi hàm thống kê phải có **ít nhất 1 ca biên** (edge case) — giá trị 0, 1 phần tử, toàn hằng, rỗng. Đây là nơi bug thường nằm.

### 3.5. Tầng 3 — Use case (application) test

**Phạm vi:** `*/application/**` — 1 handler cho mỗi use case (Phần 5).

**Nguyên tắc:** logic use case thật, **port** (repository, storage, AI, email) được mock.

**Cơ chế mock — quyết định quan trọng:**

| Loại port | Cách mock | Ghi chú |
|---|---|---|
| Repository | **In-memory implementation thật** viết trong `test/fakes/` | Không dùng `jest.mock()` — mock theo interface, giữ hành vi thật (soft delete, optimistic locking) |
| Storage (R2) | Fake adapter ghi vào thư mục tạm | Test được logic upload/download path |
| AI (suy luận cục bộ) | Fake adapter trả phản hồi định sẵn | **Không** gọi network (quyết định 8) |
| Embedding (cục bộ) | Fake adapter trả vector định sẵn | **Không** gọi network |
| Kafka producer | Fake producer ghi vào mảng | **Không** gọi broker thật |
| Socket.IO gateway | Fake gateway ghi event vào mảng | **Không** mở cổng thật |
| Email (SMTP) | Fake adapter ghi vào mảng | Assert được nội dung email |
| Outbox | Fake collector — gom event đã phát | Assert được event đúng trường |

**Vì sao không dùng `jest.mock()`:** mock theo interface giữ được hành vi thật của repository, nên test use case phát hiện được cả lỗi logic lẫn lỗi hợp đồng port. `jest.mock()` che giấu sự khác biệt giữa interface và implementation thật.

**Phạm vi test bắt buộc cho mỗi use case:**

| Nhóm | Nội dung |
|---|---|
| **Happy path** | Input hợp lệ → kết quả mong đợi, side effect đúng (outbox event phát đúng loại, đúng payload) |
| **Không đủ quyền** | Actor sai vai trò → ném `ForbiddenError` hoặc trả 403, **không** có side effect nào |
| **Không tìm thấy** | ID không tồn tại → `NotFoundError` / 404 |
| **Xung đột phiên bản** | `version` không khớp → `ConflictError` / 409 — kiểm tra optimistic locking (Phần 5 mục 3.9) |
| **Lỗi hạ tầng** | Port ném lỗi → use case phải **chuyển đổi** thành lỗi domain, không rò lỗi hạ tầng ra ngoài |
| **Bất biến** | Sau khi thực hiện, bất biến nghiệp vụ vẫn đúng (VD: workspace có đúng 1 Owner) |

**Ngưỡng application ≥ 80%:** lines ≥ 80%, branches ≥ 75%, functions ≥ 80%.

**Số lượng use case cần test:** **66 use case** (Phần 3 v4) — mỗi use case ít nhất 1 ca happy path + 1 ca không đủ quyền. Đây là phần lớn khối lượng công việc của Đợt 1.

### 3.6. Tầng 4 — Adapter (integration) test

**Phạm vi:** `*/infrastructure/**` — adapter MongoDB, Redis, R2.

**Nguyên tắc:** dùng **dịch vụ thật trong container**, không mock.

**Môi trường:**

| Dịch vụ | Cấu hình | Lý do |
|---|---|---|
| MongoDB | Container **replica set 1 node** | Cần transaction + change stream — Atlas M0 không có (quyết định 2) |
| Redis | Container `redis:7-alpine` | cache + Socket.IO adapter + rate-limit |
| Kafka | Container `kafka:3.7` KRaft single-node | Test luồng sự kiện, DLQ, consumer group thật |
| R2 | MinIO container (S3-compatible) | Test được đường dẫn S3 thật mà không tốn phí R2 |

**File `docker-compose.test.yml`:**

```yaml
name: dq-test

services:
  mongo:
    image: mongo:7
    command: ["--replSet", "rs0", "--bind_ip_all"]
    ports:
      - "27018:27017"
    healthcheck:
      test: >
        mongosh --eval "
          try { rs.status().ok }
          catch (e) { rs.initiate({_id:'rs0',members:[{_id:0,host:'mongo:27017'}]}).ok }
        "
      interval: 3s
      timeout: 10s
      retries: 15
      start_period: 10s

  redis:
    image: redis:7-alpine
    ports:
      - "6380:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 3s
      retries: 10

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: testuser
      MINIO_ROOT_PASSWORD: testpassword
    ports:
      - "9000:9000"
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 5s
      retries: 10

  minio-init:
    image: minio/mc:latest
    depends_on:
      minio:
        condition: service_healthy
    entrypoint: >
      /bin/sh -c "
      mc alias set local http://minio:9000 testuser testpassword &&
      mc mb --ignore-existing local/dq-test
      "
```

**Ghi chú về replica set:** container dùng `host: mongo:27017` trong `rs.initiate` — hostname phải khớp với tên service để các client kết nối từ host máy dev vẫn nhận diện được replica set. `MONGODB_URI` cho test: `mongodb://localhost:27018/dq-test?replicaSet=rs0&directConnection=false`.

**Phạm vi test bắt buộc:**

| Adapter | Ca test bắt buộc |
|---|---|
| Mongo repository | CRUD cơ bản; soft delete lọc đúng; `version` increment; unique partial index chặn trùng; TTL index hoạt động |
| Mongo transaction | Rollback khi lỗi giữa chứng; outbox ghi cùng transaction; phát hiện lỗi khi chạy ngoài transaction |
| Outbox relay | Claim → publish → `published`; publish fail → reset `pending` + `retry_count`; lease hết hạn → polling thu hồi |
| Inbox (`processed_event`) | Claim → `completed`; claim lại khi lease hết hạn; unique `(consumer_name, event_id)` chặn trùng |
| Kafka producer/consumer | Publish → consume; message fail → retry theo backoff; message vượt số lần retry → vào topic `dlq.dead-letter` |
| Kafka consumer group | 2 consumer cùng group chia tải message (không xử lý trùng); consumer chết → rebalance, message được đọc lại |
| Inbox chống trùng khi redeliver | Message bị redeliver (offset chưa commit) → consumer **không** xử lý lần 2 nhờ `processed_event` |
| Redis rate-limit | Đếm đúng; reset sau window; trả 429 |
| R2 adapter | Upload → download trùng khớp; multipart upload file lớn; xoá; sinh presigned URL hết hạn |
| Storage local fallback | Ghi/đọc/xoá file trong thư mục tạm |

**Ngưỡng infrastructure ≥ 60%:** lines ≥ 60%, branches ≥ 50%, functions ≥ 60%.

**Quy tắc bắt buộc:**
1. Mỗi test tầng 4 phải **tự dọn dẹp** dữ liệu (`beforeEach` xoá collection, `afterAll` flush Redis + xoá bucket) — không để dữ liệu rò sang test sau.
2. Test phải chạy được **song song** (`--maxWorkers`) → dữ liệu test phải cô lập theo database, không dùng chung collection namespace.
3. Không có test nào phụ thuộc thứ tự chạy.
4. Container phải **dừng sạch** sau khi test (`docker compose -f docker-compose.test.yml down -v`).

### 3.7. Tầng 5 — E2E / hợp đồng API

**Phạm vi:** gọi HTTP thật vào NestJS app đang chạy.

**Cơ chế:**

```
1. Dựng app NestJS (Test.createTestingModule với module thật)
2. Kết nối Mongo replica set container + Redis container + MinIO
3. Seed dữ liệu
4. Gọi HTTP bằng supertest
5. Assert trên status, body, header
```

**Dữ liệu test — quyết định 7 (factory + seed):**

```
test/
├── factories/
│   ├── user.factory.ts        # sinh user với email/số điện thoại có seed cố định
│   ├── workspace.factory.ts
│   ├── project.factory.ts
│   ├── dataset.factory.ts     # sinh dataset với N dòng × M cột, seed cố định
│   └── ...
├── seed/
│   ├── dev.seed.ts            # dữ liệu cho môi trường dev (Phần 10 mục 3.9.2)
│   └── e2e.seed.ts            # dữ liệu nền cho E2E
└── fixtures/
    ├── valid-simple.csv       # file import hợp lệ
    ├── valid-multi-sheet.xlsx # file có nhiều sheet
    ├── invalid-duplicate-col.csv
    ├── invalid-empty-col.csv
    ├── invalid-bad-encoding.csv
    └── large-50k.csv          # để test hiệu năng import
```

**Quy tắc factory bắt buộc:**

| # | Quy tắc |
|---|---|
| 1 | Mỗi factory nhận `seed` và `overrides` — cùng seed ⇒ **cùng dữ liệu** |
| 2 | Seed mặc định cố định (VD `42`) — test lặp lại cho kết quả giống nhau |
| 3 | Email sinh tự động có hậu tố `@test.local` — không dùng email thật, không gửi được email thật |
| 4 | Dữ liệu sinh **không chứa PII thật** — số điện thoại dùng dải `0900000000`+ |
| 5 | File factory tạo tệp tạm, tự xoá sau test |

**Cơ chế seed `e2e.seed.ts` — nội dung tối thiểu:**

| Dữ liệu | Số lượng | Mục đích |
|---|---|---|
| Admin hệ thống | 1 | Test `SYS-ADMIN` |
| User thường | 5 | Test quyền cơ bản |
| Workspace + 3 thành viên | 2 | Test `WS-OWNER` / `WS-MEMBER` |
| Project (draft / in_progress / completed) | 6 | Test vòng đời `status` |
| Dataset đã import | 4 | Test Data View, lọc, tìm kiếm |
| Dataset lỗi tên cột | 1 | Test chặn phân tích |
| Báo cáo sự cố | 3 | Test `issues` |

**Phạm vi test bắt buộc — theo 84 route HTTP:**

| Nhóm endpoint | Số | Mức test |
|---|---|---|
| `auth` | 13 | Đầy đủ — happy path + lỗi + rate-limit |
| `users` | 2 | Đầy đủ |
| `workspaces` | 10 | Đầy đủ |
| `projects` | 12 | Đầy đủ |
| `datasets` | 4 | Đầy đủ |
| `data-view` | 6 | Đầy đủ |
| `analysis` | 7 | Đầy đủ |
| `ai` | 1 | Đầy đủ |
| `summary` | 3 | Đầy đủ |
| `reports` | 1 | Đầy đủ |
| `notifications` | 3 | Đầy đủ |
| `issues` | 4 | Đầy đủ |
| `admin` | 1 | Đầy đủ |
| `versions` | 3 | Đầy đủ |
| `audit` | 3 | Đầy đủ |
| `health` | 3 | Đầy đủ — live/ready/deep |
| **Tổng** | **80** | |

**Mỗi endpoint tối thiểu 2 ca:** happy path + 1 ca lỗi (403 hoặc 404).

**Validate runtime Zod (quyết định 14 — phần 2):**

Mỗi response E2E được validate bằng schema Zod tương ứng trong `packages/contracts`:

```typescript
const response = await request(app.getHttpServer())
  .get(`/api/v1/workspaces/${workspaceId}`)
  .set('Authorization', `Bearer ${token}`);

expect(response.status).toBe(200);
const body = WorkspaceResponseSchema.parse(response.body);  // throw nếu sai shape
expect(body.data.name).toBe('Workspace mẫu');
```

**Quy tắc bắt buộc:**
1. Response **phải** parse được bằng schema — nếu không, test fail.
2. Assert cả **format lỗi**: `{ error: { code, message, details? } }` — `code` phải thuộc danh mục mã lỗi.
3. Assert header `X-Request-Id` tồn tại (Phần 10 mục 3.7.1).
4. **v4** Test phân trang: kiểm tra `meta` có `nextCursor` + `hasMore` + `limit`; **không** có `total`/`offset`.
5. Test 202 Accepted: kiểm tra response có `Location` header trỏ tới endpoint trạng thái job.
6. Test upload: kiểm tra file thực sự lên R2/MinIO và `storage_key` trả về đúng.

### 3.8. Tầng 6 — Kiểm tra kiến trúc

**Quyết định 5:** script checker tự động, theo pattern `check-module.mjs` thông dụng.

**Script:** `scripts/check-architecture.mjs`

**Các quy tắc kiểm tra:**

| # | Quy tắc | Cách kiểm tra |
|---|---|---|
| A1 | `domain/` không import NestJS | grep `from '@nestjs/` trong `*/domain/**` |
| A2 | `domain/` không import Mongoose | grep `from 'mongoose'` |
| A3 | `domain/` không import `infrastructure/` hoặc `application/` | phân tích import path |
| A4 | `application/` không import `infrastructure/` cụ thể — chỉ qua port | grep đường dẫn adapter |
| A5 | Module A không import trực tiếp module B | kiểm tra cross-module import giữa `src/modules/*` |
| A6 | Mọi module có đủ 6 thư mục tầng | kiểm tra cấu trúc thư mục |
| A7 | Mọi file trong `domain/` không dùng `any` | ESLint `no-explicit-any` trên đường dẫn |
| A8 | `packages/core` không import từ `apps/` | kiểm tra đường dẫn import |
| A9 | `packages/contracts` không import từ `apps/` hoặc `packages/core` | kiểm tra đường dẫn import |
| A10 | Mỗi module sở hữu đúng 1 phần schema | script so sánh danh sách schema với bảng sở hữu ở Phần 4 |
| A11 | Không có import từ `node_modules` trực tiếp trong `domain/` | ngoài danh sách cho phép |
| A12 | `apps/worker` không import `apps/api` | tách app rõ ràng |
| A13 | Không route/controller nào ghi vào `dataset_record` ngoài luồng Import | grep `updateOne`/`findOneAndUpdate`/`deleteMany`/`deleteOne`/`bulkWrite` trên repository `dataset_record` |
| A14 | Không tồn tại controller/route cho xoá dòng, sửa ô, clean-rules hay rollback phiên bản | kiểm tra danh mục route trong `packages/contracts` + `apps/api` |
| A15 | **v4** Không có `countDocuments`/`skip()` trong repository — mọi list query dùng **keyset pagination** | grep `countDocuments`/`\.skip(` trong `*/infrastructure/**` |
| A16 | **v4** Không có dependency/import tới SDK AI bên ngoài (`@google/generative-ai`, `openai`, `anthropic`) | grep trong `package.json` + mã nguồn |
| A17 | **v4** Chỉ adapter duy nhất được phép gọi engine suy luận (`AiInferencePort`) — module khác không import HTTP client của engine | kiểm tra import path trong `apps/worker` |
| A18 | **v4** Không có import `xlsx`/`exceljs`/`sheetjs` — hệ thống chỉ đọc CSV | grep trong `package.json` + mã nguồn |

**Quy tắc bắt buộc:**

| # | Quy tắc |
|---|---|
| 1 | Script **fail** (exit ≠ 0) khi có bất kỳ vi phạm nào — cùng cơ chế với test |
| 2 | Chạy trong `test:all` — không phải script tùy chọn |
| 3 | Danh sách ngoại lệ phải **ghi rõ lý do** trong file cấu hình `architecture.config.json`, không được suppress inline |
| 4 | Script có chế độ `--report` in ra bảng: quy tắc | số file kiểm tra | số vi phạm |
| 5 | Không có ngoại lệ "tạm" — ngoại lệ là cam kết lâu dài |

**Quy tắc cấm `any` (A7):**

Hệ thống tham chiếu đã có script `verify-montache.mjs` (kiểm tra `any`); Data Quality sẽ có quy tắc tương tự nhưng **chặt hơn**: `any` bị cấm trong toàn bộ `src/` và `packages/`, trừ 2 file khai báo `eslint-disable` có lý do ghi rõ.

### 3.9. Tầng 7 — Bảo mật và phân quyền

**Quyết định 9:** 48 tình huống truy cập trái phép (Phần 6 v5 mục 3.17) → test tự động.

**Cơ chế:** mỗi tình huống là 1 test E2E gọi API thật với token của vai trò khác.

**Bảng ánh xạ — 48 tình huống (nhóm theo loại tấn công):**

| Nhóm | Số | Mô tả |
|---|---|---|
| **Truy cập chéo workspace** | 8 | User của workspace A thử truy cập tài nguyên workspace B |
| **Truy cập chéo project** | 6 | User của project A thử truy cập project B cùng workspace |
| **Vai trò không đủ** | 6 | `PROJ-MEMBER` thử thao tác của `PROJ-OWNER` |
| **`SYS-ADMIN` vượt phạm vi** | 4 | Admin hệ thống thử đọc dữ liệu nghiệp vụ |
| **Không đăng nhập** | 4 | Gọi API không có token / token sai / token hết hạn |
| **Token bị thu hồi** | 3 | Dùng refresh token đã rotate; dùng session đã revoke |
| **Đối tượng đã xoá** | 3 | Truy cập tài nguyên soft-deleted |

**Bỏ 2 tình huống (2026-11-05):** 2 ca thuộc nhóm *Vai trò không đủ* là thao tác sửa ô / xoá dòng — đã bị gỡ khỏi phạm vi theo quyết định dữ liệu bất biến.

**Quy tắc bắt buộc:**

| # | Quy tắc |
|---|---|
| 1 | Mỗi tình huống assert **status đúng** (401 / 403 / 404) **và** `error.code` đúng |
| 2 | Assert **không có side effect** — dữ liệu không bị thay đổi sau request bị từ chối |
| 3 | Test đi qua **tầng HTTP thật** (guard + CASL + repository), không gọi thẳng service — nếu gọi thẳng service thì guard bị bỏ qua và test vô nghĩa |
| 4 | Mỗi tình huống ghi rõ mã UC và vai trò trong `describe` để truy xuất khi có sự cố |
| 5 | Bổ sung test **IDOR** — đổi ID trong URL của tài nguyên không thuộc phạm vi mình → 403/404 |

**Bộ test bổ sung bắt buộc:**

| Nhóm | Nội dung |
|---|---|
| Rate-limit | Đăng nhập sai 5 lần → 429; upload 21 lần → 429; register 4 lần → 429 |
| Refresh token rotation | Dùng lại refresh token cũ → thu hồi **toàn bộ** phiên |
| OTP | Sai 3 lần → khoá; hết hạn 10 phút → từ chối; tối đa 5 lần gửi/giờ |
| Che PII trong log | Response lỗi không chứa stack trace; log không chứa giá trị ô dữ liệu |
| Upload | File quá 50 MB → 413/400; mime type không hợp lệ → 415; path traversal trong tên file → chặn |
| XSS / injection | Tên project chứa `<script>` → lưu và trả về escaped; truy vấn chứa `$ne` → không rò dữ liệu |

### 3.10. Tầng 8 — Hiệu năng

**Quyết định 6:** k6, chạy thủ công trước release.

**File:** `test/k6/smoke.js`, `test/k6/stress.js` — theo pattern chuẩn.

**Kịch bản smoke:**

| Endpoint | Ngưỡng |
|---|---|
| `GET /api/v1/health/live` | p95 < 100 ms |
| `POST /api/v1/auth/login` | p95 < 500 ms |
| `GET /api/v1/workspaces` | p95 < 500 ms |
| `GET /api/v1/datasets/:id/rows` | p95 < 1000 ms (`limit` 50, không `offset`) |

**Kịch bản stress:**

| Kịch bản | Ngưỡng |
|---|---|
| 50 VU đồng thời đọc dataset 100k dòng | p95 < 2000 ms, `http_req_failed` < 1% |
| 20 VU đồng thời upload file 10 MB | `http_req_failed` < 2% |
| 10 VU chạy phân tích DQ-01 trên dataset 50k dòng | p95 < 8000 ms |

**Quy tắc bắt buộc:**

| # | Quy tắc |
|---|---|
| 1 | Chạy trên **staging**, không phải production — tránh nhiễu dữ liệu thật |
| 2 | Kết quả lưu vào `docs/test-reports/perf-<ngày>.md` — kèm số liệu p50/p95/p99 |
| 3 | Nếu vượt ngưỡng → **không release** cho tới khi tìm ra nguyên nhân hoặc điều chỉnh ngưỡng có ghi nhận |
| 4 | Ngưỡng số liệu trong ngưỡng hiệu năng của Phần 10 mục 3.8.2 (p99 < 5000 ms) là **mức cảnh báo**, không thay thế ngưỡng k6 |
| 5 | Không chạy k6 trong `test:all` — tách lệnh `pnpm test:perf` |

### 3.10b. Tầng 9 — Benchmark AI & học lại

**Quyết định 15–17.** Tầng này **duy nhất** gọi engine suy luận thật, và **chạy thủ công** — không nằm trong `test:all`.

**Mục tiêu:** chọn model AI cục bộ **tối ưu** bằng **số liệu đo được**, không bằng cảm tính; và xác minh vòng lặp học lại (feedback → mẫu → truy xuất → cải thiện) hoạt động.

#### 3.10b.1. Bộ benchmark model

**Tập mẫu:** file `test/benchmark/eval-set.jsonl` — **cố định**, version trong git.

| Thuộc tính | Yêu cầu |
|---|---|
| Số mẫu | **150–200** phát hiện đã được người dùng đánh giá (`label` trong `finding_feedback`) |
| Nguồn | Nhận xét **chưa** dùng làm `feedback_example` — tránh đánh giá ảo (Phần 8 v4 mục 3.7.6 quy tắc 4) |
| Phân bố | Cân bằng 5 nhóm `DQ-01`…`DQ-05`; có cả mẫu `false_positive` và `missed_issue` |
| Ngôn ngữ | Tiếng Việt (đúng miền dữ liệu thật) |
| Khoá | Mẫu **không** nằm trong kho `feedback_example` — kiểm tra tự động trước khi chạy |

**Năm model được so sánh (bắt buộc đủ cả 5):**

| Mã | Model | Tham số | Giả thuyết được kiểm chứng |
|---|---|---|---|
| `M1` | `Qwen3-14B-Q4_K_M` | 14B | Quy mô + đa ngữ thắng (~10 GB RSS) |
| `M2` | `Gemma-3-12B-IT` (QAT Q4) | 12B | Lượng tử QAT bù được phần thiếu tham số (~8 GB RSS) |
| `M3` | `Qwen3-8B-Q4_K_M` | 8B | Một nửa tham số có đủ cho tác vụ có cấu trúc? (~6 GB RSS) |
| `M4` | `Llama-3.1-8B-Instruct-Q4_K_M` | 8B | Baseline hệ sinh thái lớn (~6 GB RSS) |
| `M5` | `Vistral-7B-Chat-Q4_K_M` | 7B | Chuyên biệt tiếng Việt thắng quy mô? (~5 GB RSS) |

**Model bị loại trước benchmark (phải ghi trong báo cáo):** `Qwen3-30B-A3B` (18 GB > RAM), `DeepSeek-R1-Distill-Qwen-14B` (p95 vượt 180 s), `Phi-4-mini` / `PhoGPT-4B` (quá nhỏ cho giải thích tiếng Việt).

> **Model chấm điểm (LLM-as-judge):** `Qwen3-32B` **không khả thi** trên 15 GB RAM. Chấm **chéo** giữa model khác họ (M2 chấm M1, M4 chấm M3) để giảm self-preference bias.

**Chạy benchmark:** `pnpm test:benchmark -- --model=M-A --set=eval-set.jsonl`

#### 3.10b.2. Chín chỉ số đánh giá (5 nhóm) và quy tắc quyết định

| # | Nhóm | Chỉ số | Cách đo | Ngưỡng tuyệt đối | Trọng số |
|---|---|---|---|---|---|
| 1 | Chất lượng | F1 phát hiện (micro) | `2PR/(P+R)` trên 200 mẫu | ≥ 0,75 | 30 |
| 2 | Chất lượng | F1 macro theo DQ-01→05 | trung bình 5 lớp | ≥ 0,70 | 10 |
| 3 | Tuân thủ | Tỉ lệ JSON hợp lệ | % parse được ngay, không sửa | ≥ 98 % | 12 |
| 4 | Tuân thủ | Tỉ lệ ảo giác (grounding) | % số liệu trích dẫn **lệch** | ≤ 2 % | 10 |
| 5 | Ngôn ngữ | Chất lượng giải thích tiếng Việt | LLM-as-judge chấm chéo, 1–5 | ≥ 4,0 | 13 |
| 6 | Hiệu năng | p95 latency / 1 job | 3 lần chạy, bỏ warm-up | ≤ 180 s | 10 |
| 7 | Hiệu năng | Throughput | tok/s sinh | ≥ 4 tok/s | 5 |
| 8 | Tài nguyên | RSS đỉnh | `docker stats` khi chạy benchmark | ≤ 11 GB | 5 |
| 9 | Vận hành | Độ ổn định | % job lỗi / retry trên 200 mẫu | ≤ 2 % | 5 |

Tổng trọng số = **100**. Chuẩn hoá min–max trên 5 model; đảo nghịch chỉ số #4, #6, #8, #9. **Rớt bất kỳ ngưỡng tuyệt đối → loại model**, không cần tính điểm.

**Quy tắc quyết định (bắt buộc):**

| # | Quy tắc |
|---|---|
| 1 | Model chỉ được coi là "tối ưu" nếu **đạt tất cả 9 ngưỡng tuyệt đối** |
| 2 | Chênh lệch F1 **< 0,03** giữa hai model → **không coi là khác biệt**, chuyển sang so #3–#9 (model rẻ/ổn định hơn thắng) |
| 3 | Cặp đúng/sai phát hiện → **McNemar test**; điểm judge → **Wilcoxon signed-rank**; chỉ tuyên bố thắng khi **ΔF1 ≥ 0,03 và p < 0,05** |
| 4 | Chọn theo **đường Pareto** (p95 × F1, kích thước = RSS) — không chọn điểm chất lượng tuyệt đối cao nhất |
| 5 | Benchmark chạy **trên đúng phần cứng production** (CPU-only, cùng VPS); chạy trên máy có GPU rồi deploy CPU-only là sai lầm phổ biến |
| 6 | `temperature=0.2`, `top_p=0.9`, `seed` cố định, `max_tokens` cố định; mỗi model chạy **3 lần** → báo cáo mean ± std |
| 7 | Mẫu benchmark **không** nằm trong kho `feedback_example` — kiểm tra tự động trước khi chạy (chống rò rỉ đáp án) |
| 8 | Báo cáo lưu tại `docs/test-reports/benchmark-<model>-<ngày>.md` — **bắt buộc** trước khi chốt model production; ghi kèm điểm 9 chỉ số, giá trị p, đường Pareto |
| 9 | Benchmark chạy lại **bắt buộc** khi: đổi model / phiên bản model / prompt template / engine suy luận / cập nhật kho few-shot |
| 10 | Kết quả benchmark quyết định **cặp model cho kiến trúc định tuyến hai tầng** (tầng nhanh: gợi ý nhãn/phân loại/JSON ngắn; tầng sâu: giải thích/gợi ý/nhận xét) — Phần 12 v5 mục 3.15.6 |
| 11 | Tầng 9 **không** thuộc `test:all` và **không** là tiêu chí nghiệm thu đợt 1 — chạy thủ công trước khi chốt model production |

#### 3.10b.3. Test vòng lặp học lại (RAG T1)

**Kịch bản tích hợp (tầng 4, chạy tự động — dùng fake embedding adapter):**

```
1. Tạo 5 feedback với label `false_positive` cho cùng 1 loại lỗi
2. Worker chuẩn hoá → sinh `feedback_example` (trust_score = 0.6 → chưa đủ 3 người)
3. Thêm 2 feedback nữa từ 2 người khác → trust_score ≥ 0.6 → is_active = true
4. Truy xuất vector top-5 theo `column_profile` → phải trả về mẫu đó
5. Inject 5 mẫu vào prompt của lượt suy luận tiếp theo → assert prompt **chứa** mẫu
6. Xoá 1 feedback nguồn → mẫu tương ứng vẫn tồn tại (đã ẩn danh hoá)
7. Mẫu cũ hơn 180 ngày → bị TTL dọn
```

**Quy tắc bắt buộc:**

| # | Quy tắc |
|---|---|
| 1 | Mẫu được inject **chỉ khi** `is_active = true` **và** `trust_score ≥ 0,6` |
| 2 | Prompt **không được** chứa PII — mẫu đã ẩn danh hoá (kiểm tra bằng regex email/SĐT/tên) |
| 3 | Số mẫu inject tối đa **5** — không được làm phình context (giới hạn RAM) |
| 4 | Mẫu **không** được dùng làm ground truth của bộ benchmark |
| 5 | Xoá project → mẫu ẩn danh hoá **được giữ**, feedback gốc bị xoá |

### 3.11. Ma trận truy xuất ngược — 143 quy tắc kiểm thử

Đây là **trái tim** của Phần 13: gom 143 quy tắc đã rải rác ở 11 phần trước về một bảng, mỗi quy tắc gắn với tầng test và file test cụ thể.

> **Cập nhật 2026-11-05 (dữ liệu bất biến):** bổ sung **S19** (ràng buộc insert-only cho `dataset_record`) và **A13–A14** (cấm route ghi dữ liệu ngoài import). Các quy tắc liên quan xoá dòng / sửa ô / clean-rules / rollback phiên bản đã bị gỡ khỏi ma trận.

**Cấu trúc bảng:** `| Mã | Nội dung rút gọn | Tầng | File test | Trạng thái |`

#### 3.11.1. Quy tắc schema — S1–S19 (Phần 8 v3)

| Mã | Nội dung rút gọn | Tầng | File test | Trạng thái |
|---|---|---|---|---|
| S1 | `_id` có tiền tố đúng + ULID26 | 2 | `core/id-generator.spec.ts` | ☐ |
| S2 | Collection có đúng trường bắt buộc | 4 | `infrastructure/schema-contract.spec.ts` | ☐ |
| S3 | Mọi collection nghiệp vụ có `created_at`/`updated_at` | 4 | `infrastructure/schema-contract.spec.ts` | ☐ |
| S4 | `deleted_at` mặc định `null` | 4 | `infrastructure/schema-contract.spec.ts` | ☐ |
| S5 | Soft delete lọc đúng ở mọi query | 3, 4 | `mongo-repository.spec.ts` | ☐ |
| S6 | Unique partial index chặn trùng khi `deleted_at = null` | 4 | `mongo-repository.spec.ts` | ☐ |
| S7 | `version` tăng đúng khi update | 3, 4 | `mongo-repository.spec.ts` | ☐ |
| S8 | `dataset_record.props` chỉ chứa key hợp lệ | 2, 4 | `dataset-record.spec.ts` | ☐ |
| S9 | `dataset_sheet.columns` key `c0`/`c1` liên tục | 2, 4 | `dataset-sheet.spec.ts` | ☐ |
| S10 | Index compound phục vụ đúng truy vấn | 4 | `index-contract.spec.ts` | ☐ |
| S11 | TTL index dọn đúng thời hạn | 4 | `ttl-index.spec.ts` | ☐ |
| S12 | Transaction boundary đúng cho 19 use case | 3, 4 | `transaction-boundary.spec.ts` | ☐ |
| S13 | R2 key structure đúng quy ước | 4 | `r2-storage.spec.ts` | ☐ |
| S14 | `storage_key` không lộ ra response | 5 | `contract-no-leak.spec.ts` | ☐ |
| S15 | Soft delete không áp cho collection log | 4 | `schema-contract.spec.ts` | ☐ |
| S16 | `outbox_event.status` chỉ 4 giá trị hợp lệ | 4 | `outbox-relay.spec.ts` | ☐ |
| S17 | `processed_event` unique `(consumer_name, event_id)` | 4 | `inbox.spec.ts` | ☐ |
| S18 | `notification.source_event_id` unique partial | 4 | `notification.spec.ts` | ☐ |
| S19 | `dataset_record` **insert-only** — không có `updateOne`/`deleteMany`/`findOneAndUpdate`, không có `deleted_at`, không nằm trong danh sách soft-delete | 2, 4 | `dataset-record-immutable.spec.ts` | ☐ |
| S20 | **v4** `dataset_sheet` **không tồn tại** — cột nằm trực tiếp trong `dataset.columns[]` | 2, 4 | `schema-contract.spec.ts` | ☐ |
| S21 | **v4** `dataset.columns[].key` = `c{i}` liên tục, bất biến khi đổi tên cột | 2, 4 | `dataset-columns.spec.ts` | ☐ |
| S22 | **v4** `finding_feedback` là **append-only** — không có `deleted_at` xoá cứng; `author_role_at_time` không bị ghi lại | 2, 4 | `feedback-immutable.spec.ts` | ☐ |
| S23 | **v4** `feedback_example.trust_score < 0,6` → `is_active = false`; `expires_at` TTL 180 ngày | 4 | `feedback-example.spec.ts` | ☐ |

#### 3.11.2. Quy tắc contract — C1–C15 (Phần 7 v7)

| Mã | Nội dung rút gọn | Tầng | File test | Trạng thái |
|---|---|---|---|---|
| C1 | Response trả dữ liệu thẳng, không bọc | 5 | `api-contract.spec.ts` | ☐ |
| C2 | Trường response `camelCase` | 1, 5 | `api-contract.spec.ts` | ☐ |
| C3 | Lỗi theo `{ error: { code, message, details? } }` | 5 | `api-error-format.spec.ts` | ☐ |
| C4 | `meta` phân trang đúng cấu trúc | 5 | `api-pagination.spec.ts` | ☐ |
| C5 | Upload không yêu cầu idempotency key | 5 | `api-upload.spec.ts` | ☐ |
| C6 | Job bất đồng bộ trả 202 + `Location` | 5 | `api-async.spec.ts` | ☐ |
| C7 | Download trả stream, không nhúng base64 | 5 | `api-download.spec.ts` | ☐ |
| C8 | Mọi endpoint có trong OpenAPI | 1 | `openapi-snapshot.spec.ts` | ☐ |
| C9 | **v4** Phân trang cursor: `meta` có `nextCursor` + `hasMore`, **không** có `total`/`offset` | 5 | `api-cursor-pagination.spec.ts` | ☐ |
| C10 | **v4** Cursor là **opaque** — client không được tự parse; cursor sai định dạng → `VALIDATION_ERROR` | 5 | `api-cursor-pagination.spec.ts` | ☐ |
| C11 | **v4** Duyệt trang bằng cursor → **không trùng, không thiếu, không lệch thứ tự** so với offset (đối chiếu offline) | 5 | `api-cursor-pagination.spec.ts` | ☐ |
| C12 | **v4** Chèn/xoá bản ghi giữa 2 lần đọc → cursor cũ vẫn đọc được dữ liệu **không bị bỏ sót** (tính chất keyset) | 5 | `api-cursor-pagination.spec.ts` | ☐ |
| C13 | **v4** Upload file không phải `.csv` → `400` `UNSUPPORTED_FILE_TYPE` | 5 | `api-upload.spec.ts` | ☐ |
| C14 | **v8** Cursor **ràng buộc theo `sort`** — sinh từ `sort=A` không dùng được cho `sort=B` → `VALIDATION_ERROR` (HTTP 400) | 1, 5 | `keyset-pagination.spec.ts`, `api-cursor-pagination.spec.ts` | ☑ |
| C15 | **v8** Endpoint list workspace/project **không** dùng `countDocuments`/`skip` — `hasMore` suy ra từ `limit + 1` (tính chất keyset) | 1 | `clean-architecture.spec.ts` (A15) | ☑ |

#### 3.11.2b. Bộ test keyset cursor — hiện thực hoá (v8, 2026-11-15)

**Bộ test đã viết:** `test/keyset-pagination.spec.ts` (18 ca) + cập nhật `test/workspaces.spec.ts` (+2 ca) và `test/projects.spec.ts` (+2 ca).

| Nhóm | Ca test | Phủ quy tắc |
|---|---|---|
| Encode / decode con trỏ | round-trip payload; cursor hỏng → `null`; cursor là base64url thuần (không lộ JSON) | C10 |
| Parse con trỏ | `undefined` → trang đầu; cursor hợp lệ; cursor hỏng → `InvalidCursorError`; cursor sai `sort` → `InvalidCursorError` | C10, C14 |
| Điều kiện MongoDB | sort ngày tăng/giảm dần xử lý đúng `null`; sort chuỗi dùng `$gt`/`$lt` + tiebreaker `_id`; `buildKeysetSort` luôn kèm `_id` | C11, C12 |
| Trích giá trị sort | Date → ISO-8601; `null` → cờ `isNull`; chuỗi giữ nguyên | C11 |
| Ánh xạ sort | mã hợp lệ → đặc tả; mã lạ → fallback mặc định | C14 |
| In-memory (đường admin) | so sánh theo `name_asc`/`last_accessed`; `null` nằm cuối khi sort giảm dần; `isAfterCursor` lọc đúng; tiebreaker `_id` | C11, C12 |
| Service layer | `meta` có `nextCursor`/`hasMore`/`limit`; **không** có `total`; cursor sai `sort` → `BadRequestException`; cursor hỏng → `BadRequestException` | C4, C9, C14 |

**Kết quả chạy (2026-11-15):** 218 unit test + 52 E2E test + 16 test kiến trúc — tất cả PASS. ESLint: 0 error.

**Kết quả thực thi trên MongoDB thật (cần chạy tay):** ma trận C11/C12 ở tầng 5 yêu cầu dữ liệu ≥ 3 trang để đối chiếu. Xem "Quy trình kiểm thử thủ công" trong `edit/06_buoc_2_a_bao_cao.md`.

#### 3.11.2c. Bộ test mới hiện thực hoá ở Bước 1–6 (v9, 2026-11-16)

**Bối cảnh.** Trong Bước 1 → Bước 6 (`edit/02_ke_hoach_thuc_thien.md`), mã nguồn backend đã hiện thực hoá thêm các tính năng mà v8 chỉ mô tả trong thiết kế. Bảng dưới liệt kê **5 bộ test mới — 83 ca** — kèm quy tắc được phủ.

| Bộ test | Số ca | Tầng | Nội dung phủ | Quy tắc |
|---|---|---|---|---|
| `test/step6-google-oauth.spec.ts` | 11 | 2, 3 | Luồng chính (tạo tk mới / đăng nhập tk đã gắn `google_id`); email đã có tài khoản → **liên kết tự động** (2026-11-17) + trường hợp `google_id` bị tài khoản khác chiếm → `409`; email chưa xác minh → `401`; tài khoản `blocked` → `403`; `state` không khớp → `401`; adapter thiếu credential → `501 DEPENDENCY_UNAVAILABLE`; adapter build URL đúng endpoint Google | C17, I24, I25, O37 |
| `test/external-services-email-push.spec.ts` | 22 | 2, 3 | Template email (escape HTML, OTP 6 số hạn 10 phút, lời mời workspace, 7 loại email còn lại); adapter SMTP fail an toàn (thiếu cấu hình → `isConfigured()=false`, `send()=false`, **không ném lỗi**); adapter ntfy (`NTFY_ENABLED=false` → bỏ qua); mapper notification → email; `DispatchHandler` gửi cả email lẫn push, lỗi email **không** fail thao tác chính; `ForgotPasswordHandler` sinh OTP **lưu dạng hash**, gửi email, giới hạn 5 lần/giờ → 429 | O39, C40 |
| `test/e2e/security/google-oauth.e2e-spec.ts` | 3 | 5 | `GET /auth/google` → `302` kèm cookie `google_oauth_state` httpOnly; thiếu credential → `501`; `GET /auth/google/callback?error=access_denied` → `401 VALIDATION_ERROR` | C16, C17, O37 |
| `test/step1-remember-me-and-issue-needs-info.spec.ts` | 16 | 2, 3 | `parseDurationMs` (đơn vị/fallback); TTL 7 ngày vs 30 ngày (`REFRESH_TOKEN_TTL_MS` / `REMEMBER_ME_REFRESH_TOKEN_TTL_MS` / `SESSION_TTL_MS` / `REMEMBER_ME_SESSION_TTL_MS`); `sessionExpiry`; DTO login `remember_me` (mặc định `false`, nhận cả `remember_me` lẫn `rememberMe`); trạng thái `needs_info` + `ALLOWED_ISSUE_TRANSITIONS` + `isUserEditableIssueStatus`; DTO issue (`ListIssuesQuerySchema`, `UpdateIssueStatusSchema`, `UpdateMyIssueSchema`) | S26, C18, C19, O38 |
| `test/step3-efgh.spec.ts` | 34 | 3 | Nhóm E (tìm kiếm/lọc thành viên + 2 endpoint tổng quan); Nhóm F (chỉ định Project Owner khi tạo project); Nhóm G (`phone` + `bio` và DTO profile); Nhóm H (`member_emails` khi tạo workspace); util keyset generic in-memory | C20, C21, S25, S27, S28, S29 |
| `test/workspace-invitation-email.spec.ts` | 7 | 2, 3 | WS-07: email đã có tài khoản → thêm thành viên trực tiếp (**không** gửi email); email chưa có tài khoản → **gửi lời mời** (không lỗi 400); lỗi gửi email / chưa cấu hình SMTP → **không** fail thao tác chính; đã là thành viên → `409`; WS-01: tạo workspace kèm email chưa có tài khoản → gửi lời mời thay vì báo lỗi 400 | O40 |
| `test/keyset-pagination.spec.ts` | 23 | 1, 3 | Encode/decode con trỏ; cursor sai `sort` → `InvalidCursorError`; điều kiện MongoDB (null, tiebreaker `_id`); trích giá trị sort; ánh xạ mã sort; so sánh in-memory; service layer (`meta` đúng cấu trúc, **không** có `total`) | C9–C15 |

**Kết quả chạy thực tế (2026-11-16):**

| Lệnh | Kết quả | Thời gian |
|---|---|---|
| `pnpm run test:unit` | **246 ca PASS / 20 suite** | 48,5 s |
| `pnpm run test:arch` | **16 ca PASS / 4 suite** (`zero-any`, `guard-coverage`, `zod-openapi`, `clean-architecture`) | 13,5 s |
| **Tổng tự động** | **1 277 ca PASS — 0 fail** (1 069 unit/arch + 138 integration + 70 e2e) | ~62 s |

> **Ghi chú vận hành:** `jest` báo *"A worker process has failed to exit gracefully"* — do `IngestDatasetStreamHandler` giữ timer khi chạy. Đây là cảnh báo teardown, **không** làm fail test. Ghi nhận vào backlog dọn tài nguyên (không dùng `jest.retryTimes()` để che — quy tắc 3 mục 3.15).

**Quy tắc mới sinh ra từ các bộ test trên:**

| Mã | Nội dung rút gọn | Tầng | File test | Trạng thái |
|---|---|---|---|---|
| S25 | `user.auth_provider` enum `local` \| `google`, mặc định `local`; `google_id` unique sparse; `phone` unique partial; `bio` ≤ 500 ký tự | 2, 4 | `step6-google-oauth.spec.ts`, `step3-efgh.spec.ts` | ☑ |
| S26 | `user_session.remember_me` boolean mặc định `false`; `last_used_at` cập nhật khi refresh | 2, 3 | `step1-remember-me-and-issue-needs-info.spec.ts` | ☑ |
| S27 | TTL index `user_session` theo `expires_at` **thật** (`expireAfterSeconds: 0`) — không dùng `index: { expires: '7d' }` (sẽ xoá sớm phiên 30 ngày) | 2, 4 | `step1-remember-me-and-issue-needs-info.spec.ts` | ☑ |
| S28 | `issue_report.status` có giá trị `needs_info` trong enum; `version` tăng khi người dùng sửa báo cáo | 2, 3 | `step1-remember-me-and-issue-needs-info.spec.ts` | ☑ |
| S29 | `user.phone` unique partial (`partialFilterExpression: { phone: { $type: 'string' } }`); `user.bio` maxlength 500 | 2, 4 | `step3-efgh.spec.ts` | ☑ |
| C16 | `GET /auth/google` → `302` redirect kèm `state`; cookie `google_oauth_state` **httpOnly** + `SameSite=Lax` + maxAge 10 phút | 5 | `google-oauth.e2e-spec.ts` | ☑ |
| C17 | Hợp đồng OAuth: callback trả `200` (payload đăng nhập) / `401` / `403` / `409` / `501`; mã lỗi `DEPENDENCY_UNAVAILABLE` khi thiếu credential | 3, 5 | `step6-google-oauth.spec.ts`, `google-oauth.e2e-spec.ts` | ☑ |
| C18 | `POST /auth/login` nhận `remember_me` (mặc định `false`); hạn refresh token theo `JWT_REFRESH_EXPIRATION` / `JWT_REFRESH_REMEMBER_EXPIRATION` | 2, 3 | `step1-remember-me-and-issue-needs-info.spec.ts` | ☑ |
| C19 | `PATCH /issues/{issueId}` — chỉ chủ báo cáo, chỉ khi `status === 'needs_info'`, **bắt buộc** `expectedVersion` | 2, 3 | `step1-remember-me-and-issue-needs-info.spec.ts` | ☑ |
| C20 | Endpoint tổng quan trả **đúng số chỉ số**: `GET /overview/workspaces` → 5 chỉ số; `GET /workspaces/{id}/overview` → 7 chỉ số | 3, 5 | `step3-efgh.spec.ts` | ☑ |
| C21 | Danh sách thành viên trả `{ items, meta: { nextCursor, hasMore, limit } }` — **không** có `total`/`page`; `search` không phân biệt hoa/thường | 3 | `step3-efgh.spec.ts` | ☑ |
| I24 | **Không tự động liên kết** Google với email đã tồn tại → `409 CONFLICT` (chống chiếm đoạt tài khoản) | 3 | `step6-google-oauth.spec.ts` | ☑ |
| I25 | `state` CSRF không khớp → `401` và **không** tạo tài khoản, **không** tạo phiên | 3 | `step6-google-oauth.spec.ts` | ☑ |
| O37 | Thiếu `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` → `501 DEPENDENCY_UNAVAILABLE` — coi là "tính năng chưa bật", **không** phải crash tiến trình | 3, 5 | `step6-google-oauth.spec.ts`, `google-oauth.e2e-spec.ts` | ☑ |
| O38 | `JWT_REFRESH_EXPIRATION` mặc định `7d`; `JWT_REFRESH_REMEMBER_EXPIRATION` mặc định `30d`; parse được `ms/s/m/h/d/w` | 2 | `step1-remember-me-and-issue-needs-info.spec.ts` | ☑ |
| O39 | `GOOGLE_REDIRECT_URI` phải là **URL hợp lệ** (`z.string().url()`); thiếu bất kỳ biến nào trong 3 biến Google → `501` | 2, 5 | `env.validation` + `step6-google-oauth.spec.ts` | ☑ |

#### 3.11.3. Quy tắc integration — I1–I14 (Phần 9 v2)

| Mã | Nội dung rút gọn | Tầng | File test | Trạng thái |
|---|---|---|---|---|
| I1 | Event ghi trong cùng transaction với thay đổi | 4 | `transaction-boundary.spec.ts` | ☐ |
| I2 | Relay claim → publish → `published` | 4 | `outbox-relay.spec.ts` | ☐ |
| I3 | Event kẹt `publishing` được polling thu hồi | 4 | `outbox-relay.spec.ts` | ☐ |
| I4 | `retry_count` tăng khi publish fail | 4 | `outbox-relay.spec.ts` | ☐ |
| I5 | `retry_count > 5` → `failed` | 4 | `outbox-relay.spec.ts` | ☐ |
| I6 | Inbox chặn xử lý trùng | 4 | `inbox.spec.ts` | ☐ |
| I7 | Inbox lease hết hạn được chiếm lại | 4 | `inbox.spec.ts` | ☐ |
| I8 | Consumer chỉ chạy ở `apps/worker` | 6 | `architecture.spec.ts` | ☐ |
| I9 | Job Kafka retry đúng số lần (backoff) | 4 | `kafka-consumer.spec.ts` | ☐ |
| I10 | Message bị redeliver sau khi consumer chết → được xử lý lại | 4 | `kafka-consumer.spec.ts` | ☐ |
| I11 | Job AI timeout 180s (v4 — CPU-only) | 4 | `ai-job.spec.ts` | ☐ |
| I12 | Che PII trước khi gửi tới engine suy luận cục bộ | 2, 4 | `pii-masking.spec.ts` | ☐ |
| I13 | PDF sinh ở worker, không ở API | 6 | `architecture.spec.ts` | ☐ |
| I14 | Cleanup job chạy 02:00 VN, xoá đúng retention | 4 | `cleanup-job.spec.ts` | ☐ |
| I15 | **v4** Outbox relay publish ra **Kafka topic đúng** (`domain.events` / `ai.jobs` / `notification.dispatch` / `realtime.push`) | 4 | `kafka-producer.spec.ts` | ☐ |
| I16 | **v4** Message vượt số lần retry → vào topic `dlq.dead-letter` kèm header `x-original-topic` | 4 | `kafka-dlq.spec.ts` | ☐ |
| I17 | **v4** Consumer group: 2 consumer cùng group **không** xử lý trùng message | 4 | `kafka-consumer.spec.ts` | ☐ |
| I18 | **v4** Consumer chết → partition rebalance → message được đọc lại, xử lý đúng 1 lần (nhờ inbox) | 4 | `kafka-consumer.spec.ts` | ☐ |
| I19 | **v4** Sự kiện `analysis.completed` → publish `realtime.push` → Socket.IO emit đúng room (`analysis:{id}`, `project:{id}`, `user:{id}`) | 4, 5 | `realtime-push.spec.ts` | ☐ |
| I20 | **v4** Sự kiện `notification.created` → publish `notification.dispatch` → gửi email **đúng 1 lần** (idempotent qua `source_event_id`) | 4 | `notification-dispatch.spec.ts` | ☐ |
| I21 | **v4** Job AI publish `ai.jobs` → worker consume → gọi engine cục bộ → ghi `ai_job` với `model_id` + `kafka_offset` | 4 | `ai-job-kafka.spec.ts` | ☐ |

#### 3.11.4. Quy tắc vận hành — O1–O28 (Phần 10 v3)

| Mã | Nội dung rút gọn | Tầng | File test | Trạng thái |
|---|---|---|---|---|
| O1 | Thiếu biến môi trường → refuse to start | 5 | `env-validation.spec.ts` | ☐ |
| O2 | Production không có transaction → refuse to start | 5 | `env-validation.spec.ts` | ☐ |
| O3 | Probe tự phát hiện đúng tầng fallback | 4 | `db-capability.spec.ts` | ☐ |
| O4 | Tầng giả lập ghi outbox vẫn hoạt động | 4 | `db-capability.spec.ts` | ☐ |
| O5 | `/health/live` 200 khi Mongo chết | 5 | `health.spec.ts` | ☐ |
| O6 | `/health/ready` 503 khi Mongo/Redis lỗi | 5 | `health.spec.ts` | ☐ |
| O7 | Health không lộ connection string | 5 | `health.spec.ts` | ☐ |
| O8 | `/health/deep` báo đúng AI + R2 | 5 | `health.spec.ts` | ☐ |
| O9 | Log JSON hợp lệ, mỗi dòng parse được | 4 | `logger.spec.ts` | ☐ |
| O10 | Không log giá trị trường redact | 4 | `logger.spec.ts` | ☐ |
| O11 | Không log giá trị ô dữ liệu | 4 | `logger.spec.ts` | ☐ |
| O12 | `X-Request-Id` trả về và có trong log | 5 | `request-id.spec.ts` | ☐ |
| O13 | Metrics snapshot đúng 1 giờ 1 lần, không chứa dữ liệu người dùng | 4 | `metrics.spec.ts` | ☐ |
| O14 | Script backup exit ≠ 0 khi `mongodump` fail | 5 | `backup-script.spec.ts` | ☐ |
| O15 | Restore được thử trên staging | — | *thủ công, ghi log deploy* | ☐ |
| O16 | Deploy script dừng khi thiếu biến bắt buộc | 5 | `deploy-script.spec.ts` | ☐ |
| O17 | Migration idempotent — chạy 2 lần giống nhau | 5 | `migration-idempotent.spec.ts` | ☐ |
| O18 | Worker restart không mất message Kafka (offset chưa commit) | 4 | `kafka-consumer.spec.ts` | ☐ |
| O19 | Container chạy user không phải root | — | *kiểm tra `docker inspect` khi deploy* | ☐ |
| O20 | Image không chứa secret | — | *kiểm tra `docker history` khi build* | ☐ |
| O21 | Redis > 80% → cảnh báo | 4 | `alert-threshold.spec.ts` | ☐ |
| O22 | Outbox pending > 300s → cảnh báo | 4 | `alert-threshold.spec.ts` | ☐ |
| O23 | Cleanup giảm đúng `storage_used_bytes` | 4 | `cleanup-job.spec.ts` | ☐ |
| O24 | Upload vượt quota bị chặn trước khi ghi file | 4, 5 | `storage-quota.spec.ts` | ☐ |
| O25 | Cutover dừng cả `api` và `worker` | — | *kiểm tra trong quy trình cutover* | ☐ |
| O26 | Message Kafka còn nguyên sau khi dừng worker | 4 | `kafka-consumer.spec.ts` | ☐ |
| O27 | Deploy `--mode=migration` chạy backup trước | 5 | `deploy-script.spec.ts` | ☐ |
| O28 | `MIGRATION_CONFIRM=yes` bắt buộc để ghi | 5 | `migration-idempotent.spec.ts` | ☐ |
| O29 | **v4** Không container nào publish port engine AI (`:8000`) hay Kafka (`:9092`) ra host | — | *kiểm tra `docker compose config` khi deploy* | ☐ |
| O30 | **v4** Checksum SHA-256 file model khớp `AI_MODEL_PRIMARY_SHA256` — entrypoint từ chối nạp nếu lệch | 4 | `model-checksum.spec.ts` | ☐ |
| O31 | **v4** Tổng RSS các container ≤ 90% RAM máy | — | *kiểm tra `docker stats` khi deploy* | ☐ |
| O32 | **v4** Tất cả consumer group Kafka có **lag = 0** khi ổn định; `dlq.dead-letter` không có message mới | 4 | `kafka-lag.spec.ts` | ☐ |
| O33 | **v4** Engine suy luận trả 200 ở `/health` sau khi nạp model; nếu không, API vẫn phục vụ được phần không-AI | 5 | `health.spec.ts` | ☐ |
| O34 | **v4** Upload file không phải `.csv` bị từ chối `UNSUPPORTED_FILE_TYPE` | 5 | `api-upload.spec.ts` | ☐ |
| O35 | **v4** Không có lời gọi `countDocuments` trong mã nguồn (kiểm tra tĩnh) | 6 | `architecture.spec.ts` | ☐ |

**Ghi chú:** O15, O19, O20, O25 là kiểm tra **thủ công** — không tự động hoá được (cần thao tác hạ tầng). Đánh dấu bằng ghi chú thay vì ô ☐ để phân biệt "chưa làm" với "làm thủ công".

#### 3.11.5. Quy tắc migration — M1–M24 (Phần 11 v2)

| Mã | Nội dung rút gọn | Tầng | File test | Trạng thái |
|---|---|---|---|---|
| M1 | `migrate` mặc định dry-run | 5 | `migration-idempotent.spec.ts` | ☐ |
| M2 | `--apply` yêu cầu xác nhận | 5 | `migration-idempotent.spec.ts` | ☐ |
| M3 | Chạy 2 lần cho kết quả giống nhau | 5 | `migration-idempotent.spec.ts` | ☐ |
| M4 | `verify` không ghi vào collection nghiệp vụ | 5 | `migration-verify.spec.ts` | ☐ |
| M5 | Đối chiếu số lượng khớp công thức | 5 | `migration-verify.spec.ts` | ☐ |
| M6 | Hash mẫu 1% — sai lệch 0 | 5 | `migration-verify.spec.ts` | ☐ |
| M7 | Referential integrity — 0 orphan | 5 | `migration-verify.spec.ts` | ☐ |
| M8 | Mỗi workspace đúng 1 Owner | 5 | `migration-permission.spec.ts` | ☐ |
| M9 | Mỗi project đúng 1 Owner | 5 | `migration-permission.spec.ts` | ☐ |
| M10 | Thành viên workspace có `project_member` | 5 | `migration-permission.spec.ts` | ☐ |
| M11 | Không membership trùng | 5 | `migration-permission.spec.ts` | ☐ |
| M12 | Collection cũ không bị sửa | 5 | `migration-idempotent.spec.ts` | ☐ |
| M13 | `cell_evidence.value_masked` đã che PII | 5 | `migration-verify.spec.ts` | ☐ |
| M14 | `props` dùng key `c0`/`c1` | 5 | `migration-verify.spec.ts` | ☐ |
| M15 | Đảo ngược `props` → `data` giống hệt | 5 | `migration-verify.spec.ts` | ☐ |
| M16 | `project.status` khớp quy tắc | 5 | `migration-verify.spec.ts` | ☐ |
| M17 | Số bản ghi bị bỏ qua ≤ 1% | 5 | `migration-verify.spec.ts` | ☐ |
| M18 | `id_map` unique `(entity_type, old_id)` | 4 | `id-map.spec.ts` | ☐ |
| M19 | `outbox_event.status` 4 giá trị hợp lệ | 4 | `outbox-relay.spec.ts` | ☐ |
| M20 | Script drop từ chối khi chưa verify | 5 | `migration-verify.spec.ts` | ☐ |
| M21 | Script drop chỉ xoá **7** collection LEGACY | 5 | `migration-verify.spec.ts` | ☐ |
| M22 | Sau cutover request trả đúng dữ liệu | 5 | `cutover-smoke.spec.ts` | ☐ |
| M23 | Rollback mức 1 < 5 phút | — | *thủ công, đo thời gian* | ☐ |
| M24 | Backup trước cutover đã restore thử | — | *thủ công, ghi log deploy* | ☐ |
| M25 | `dataset_versions` **không** được migrate — không có bản ghi nào sang `dataset_version` (collection không còn tồn tại) | 5 | `migration-verify.spec.ts` | ☐ |
| M26 | Sau cutover, `dataset_record` chỉ chứa dữ liệu từ file gốc — không có bản ghi sinh ra từ thao tác sửa/xoá | 5 | `migration-verify.spec.ts` | ☐ |
| M27 | **v4** `dataset_sheet` không tồn tại trong collection mới sau cutover | 5 | `migration-verify.spec.ts` | ☐ |
| M28 | **v4** Mọi `dataset.file_format` = `csv` — dataset Excel cũ bị bỏ qua kèm cảnh báo | 5 | `migration-verify.spec.ts` | ☐ |
| M29 | **v4** `finding_feedback` + `feedback_example` tồn tại và có đủ index (kể cả vector index) | 5 | `migration-verify.spec.ts` | ☐ |

**Tổng kết ma trận (v9):**

| Nhóm | Tổng | Tự động | Thủ công | Ghi chú |
|---|---|---|---|---|
| S (schema) | 29 | 29 | 0 | +S24 (DQ-05), **+S25…S29** (OAuth, remember-me, TTL, needs_info, phone/bio) |
| C (contract) | 21 | 21 | 0 | +C14…C15 (cursor), **+C16…C21** (OAuth, remember-me, needs_info, overview, members) |
| I (integration) | 25 | 25 | 0 | +I15…I21 (Kafka), +I22…I23 (VIF/grounding), **+I24…I25** (không tự liên kết Google, CSRF state) |
| O (operations) | 39 | 34 | 5 | +O29…O35 (AI), +O36 (DQ-05), **+O37…O39** (Google credential, remember-me TTL, redirect URI) |
| M (migration) | 29 | 26 | 3 | +M27…M29, M21 5→7 collection |
| **Tổng** | **143** | **135** | **8** | +21 quy tắc so với v8 (122) |

> **Đối chiếu:** v8 ghi **122**; v9 cộng thêm **21** quy tắc (14 quy tắc mới ở mục 3.11.2c + 4 quy tắc v6 ở mục 3.11b — `S24`, `I22`, `I23`, `O36` — vốn chưa được cộng vào bảng tổng kết của v8). Tổng chốt: **143 quy tắc**.

**Quy tắc bắt buộc:**
1. 112 quy tắc tự động phải có **file test cụ thể** — không có ngoại lệ "test sau".
2. 8 quy tắc thủ công phải có **dòng ghi nhận** trong báo cáo nghiệm thu kèm người thực hiện và ngày.
3. Ma trận này là **nguồn sự thật duy nhất** về trạng thái kiểm thử — cập nhật cùng lúc khi thêm test.

### 3.11b. Quy tắc bổ sung v6 — DQ-05 có điều kiện + ma trận tương quan/VIF + AI đánh giá (mới)

| Mã | Nội dung rút gọn | Tầng | File test |
|---|---|---|---|
| S24 | `analysis_result.dq05.status` chỉ nhận `unassessed/assessed`; `assessed` bắt buộc có `ruleId/version` | 2, 4 | `dq05-status.spec.ts` |
| C14 | `GET analysis/result` trả `correlationMatrix + vif + aiCorrelationAssessment` đúng schema mục 3.13b Phần 7 v4 | 5 | `api-analysis-result.spec.ts` |
| I22 | Ma trận không khả nghịch → VIF `null` + thông báo phụ thuộc tuyến tính hoàn hảo, không ném | 2, 4 | `vif-singular.spec.ts` |
| I23 | AI trích số không tồn tại trong ma trận/VIF → bị loại; AI lỗi không chặn kết quả hệ thống | 3, 4 | `ai-corr-grounding.spec.ts` |
| O36 | Tương quan cao/VIF cao **không** tự sinh quy tắc DQ-05 (kiểm tra tĩnh + test hành vi) | 6 | `architecture.spec.ts` |

**Tổng sau v6: 120 → 125 quy tắc (112 → 117 tự động).** *(Số liệu cuối cùng của v9: **143 quy tắc** — xem bảng tổng kết tại mục 3.11.5.)*

### 3.12. Bảng mapping tính năng / use case / endpoint

**Quyết định 13:** bảng đầy đủ.

**Cấu trúc:** 3 bảng riêng, mỗi bảng có cột `Tầng test` và `Trạng thái`.

#### 3.12.1. Mapping 85 tính năng → tầng test

**Nguồn:** Phần 2 v11 (danh mục tính năng). Con số **85** = 79 tính năng ở v10 + **6 mã mới** cấp ở v11 (`AUTH-14`, `USER-03`, `USER-04`, `WS-11`, `PROJ-13`, `PROJ-14`, `PROJ-15`, `ISSUE-05`, `FILE-03`, `FB-07` — đồng thời `AUTH-03` chuyển từ "thiết kế" sang "đã hiện thực hoá").

| Nhóm tính năng | Mã | Số | Tầng test chính | Ghi chú |
|---|---|---|---|---|
| Xác thực | `AUTH-01`→`AUTH-14` | 14 | 2, 3, 5, 7 | Nhiều ca lỗi — bảo mật nhạy cảm. `AUTH-03` (Google OAuth) + `AUTH-14` (remember-me) đã có test |
| Hồ sơ người dùng | `USER-01`→`USER-04` | 4 | 2, 3, 5 | `USER-03` (xoá tài khoản), `USER-04` (`phone` + `bio`) |
| Quản trị hệ thống | `ADMIN-01` | 1 | 5, 7 | Chỉ `SYS-ADMIN` |
| Workspace | `WS-01`→`WS-11` | 11 | 3, 5, 7 | `WS-08` + `WS-11` (tổng quan) cần dữ liệu tổng quan |
| Project | `PROJ-01`→`PROJ-15` (trừ `PROJ-06`→`PROJ-08`) | 12 | 2, 3, 5, 7 | `PROJ-13` (tổng quan workspace), `PROJ-14` (tìm kiếm thành viên), `PROJ-15` (chỉ định Project Owner) |
| Dataset | `FILE-01`→`FILE-03`, `DATA-02` | 4 | 3, 4, 5 | Import là luồng phức tạp nhất — `DATA-01` (xoá dòng) đã gỡ |
| Data View | `VIEW-01`→`VIEW-08` | 8 | 3, 5 | Lọc/sort/tìm kiếm — nhiều ca |
| Phân tích | `ANALYSIS-01`→`ANALYSIS-07` | 7 | 2, 3, 5 | Thuật toán ở tầng 2 |
| Phát hiện DQ | `DQ-01`→`DQ-05` | 5 | 2, 3, 5 | `DQ` tách riêng trong Phần 2 |
| AI | `AI-01`, `AI-02` | 2 | 2, 4, 5 | Luôn mock ở tầng 1–8; `AI-02` = **Thử lại AI** |
| **Feedback & học lại** | `FB-01`→`FB-07` | 7 | 2, 3, 4, 5, 9 | `FB-05` (kho mẫu học lại) cần **tầng 9**; `FB-07` (xoá nhận xét) |
| Tổng kết | `SUMMARY-01` | 1 | 3, 5 | |
| Báo cáo PDF | `REPORT-01` | 1 | 4, 5 | Sinh ở worker |
| Thông báo | `NOTIF-01`→`NOTIF-03` | 3 | 3, 4, 5 | Idempotent qua `source_event_id` |
| Báo cáo sự cố | `ISSUE-01`→`ISSUE-05` | 5 | 2, 3, 5, 7 | `ISSUE-05` (sửa báo cáo khi `needs_info`) |
| **Tổng** | | **85** | | |

**Cột trạng thái:** mỗi tính năng có 1 trong 4 trạng thái: `☐ chưa test` · `◐ test đang viết` · `☑ đã test` · `⊘ ngoài phạm vi`.

#### 3.12.2. Mapping 66 use case → tầng test

| Nhóm UC | Mã | Số | Tầng test chính | Ca bắt buộc |
|---|---|---|---|---|
| Sản phẩm mới | `UC-01`→`UC-27` (trừ `UC-11`) | 26 | 3, 5 | happy + không đủ quyền |
| LEGACY (đã bỏ) | `UC-28`→`UC-31` | 4 | — | `⊘` — xoá khỏi phạm vi (quyết định 1) |
| Xác thực / tài khoản | `UC-32`→`UC-46` | 15 | 3, 5, 7 | + token reuse, rate-limit |
| Workspace/project bổ sung | `UC-47`→`UC-59` (trừ `UC-58`, `UC-59`) | 11 | 3, 5, 7 | + quyền xoá tài nguyên (không còn rollback phiên bản) |
| Thông báo | `UC-60`→`UC-63` | 4 | 3, 4, 5 | + idempotent |
| Báo cáo sự cố | `UC-64`→`UC-67` | 4 | 3, 5, 7 | + upload, quyền Admin |
| **Nhận xét kết quả** | `UC-68`→`UC-72` | 5 | 2, 3, 4, 5, 9 | + quyền theo vai trò, snapshot `ai_confidence`, vòng lặp học lại |
| **Tổng** | | **66** | |
**Ghi chú (2026-11-05):**
- `UC-11` (xoá dòng), `UC-18` (sửa ô), `UC-28`→`UC-30` (clean-rules, lineage, exports), `UC-29` (lịch sử phiên bản), `UC-30` (lineage), `UC-58`/`UC-59` (lịch sử phiên bản project) — **bị gỡ khỏi phạm vi** do quyết định dữ liệu bất biến.
- `UC-12` (Reset Dataset) được **thu hẹp**: chỉ còn đặt lại **tên cột** về đúng tên trong file gốc — không đụng tới dữ liệu.
- 5 use case bị gỡ → 67 → 62.

#### 3.12.3. Mapping 84 route HTTP thực thi → tầng test

**Nguồn:** Phần 7 v8 mục 3.13 — bảng được **đối chiếu 1-1 với mã nguồn thực thi** (quét decorator `@Get/@Post/@Patch/@Put/@Delete` trong `src/backend/src/modules/**/infrastructure/http/*.controller.ts`).

| Nhóm endpoint | Số route | Tầng | Ghi chú |
|---|---|---|---|
| `auth` | 12 | 5, 7 | 2 route Google OAuth (`GET /auth/google`, `GET /auth/google/callback`) |
| `users` | 3 | 5 | `GET`/`PATCH`/`DELETE /users/me` — `DELETE` là `USER-03` |
| `admin` | 3 | 5, 7 | `GET /admin/users`, `GET /admin/users/{userId}`, `GET /admin/issues` + `PATCH /admin/issues/{id}/status` → **4 route** |
| `workspaces` | 10 | 5, 7 | + `GET /workspaces/{id}/overview` (`PROJ-13`) |
| `overview` | 1 | 5 | `GET /overview/workspaces` (`WS-11`) — tiền tố tách khỏi `workspaces` để tránh xung đột `@Get(':id')` |
| `projects` | 11 | 5, 7 | + `GET /projects/{id}/members` (`PROJ-14`) |
| `datasets` | 8 | 5 | + `PATCH /datasets/{id}`, `DELETE /datasets/{id}`, `PATCH /datasets/{id}/columns`, `POST /datasets/{id}/columns/reset` (`FILE-03`) |
| `data-view` | 4 | 5 | `/records`, `/records/query`, `/columns/{key}/stats`, `/schema` |
| `analysis` | 9 | 5 | + `POST /analysis/jobs/{jobId}/result` (kênh AI nội bộ) |
| `summary` | 2 | 5 | `POST`/`GET /projects/{projectId}/summary` |
| `reports` | 2 | 5 | `POST /report` (202) + `GET /report/{id}/file` |
| `notifications` | 5 | 5 | + `PATCH /users/me/notification-preferences` |
| `issues` | 8 | 5, 7 | + `PATCH /issues/{issueId}` (`ISSUE-05`) |
| `feedback` | 7 | 3, 5, 7 | + `DELETE /feedback/{feedbackId}` (`FB-07`) |
| `health` | 2 | 5 | `/health` + `/health/ready` — **ngoài** prefix `/api/v1` |
| **Tổng** | **86** | | Mỗi endpoint ≥ 2 ca test |

**Kênh WebSocket (không tính vào 86):** `/api/v1/realtime` — `REALTIME-01`, cần test tầng 5 (tương tác handshake + room).

**Endpoint bị gỡ (2026-11-05):** `POST /datasets/{id}/records/delete`, `PATCH /datasets/{id}/records/{rowIndex}`, `POST /datasets/{id}/versions`, `GET /datasets/{id}/versions/diff`, `GET /datasets/{id}/versions/{versionNumber}` — tổng 85 → 80.

**Endpoint hiện thực hoá lại ở Bước 1–3 (v9):** `PATCH /datasets/{id}` và `DELETE /datasets/{id}` — v7 ghi "Bỏ", nhưng mã nguồn **vẫn có** và đã hiện thực hoá (`FILE-03`).

**Quy tắc bắt buộc:**
1. Mỗi endpoint có **ít nhất 2 ca**: happy path + 1 ca lỗi.
2. Endpoint nhạy cảm (audit, admin, issues, users, feedback) có **ít nhất 4 ca**: thêm 2 ca phân quyền.
3. Bảng mapping được cập nhật **mỗi khi** thêm endpoint mới ở Phần 7 hoặc thêm test.
4. **v4:** Mọi endpoint trả danh sách phải có test phân trang **cursor** (C9–C12) — không dùng `offset`.

#### 3.12.4. Bảng mapping tính năng mới ↔ route HTTP ↔ bộ test (v9, 2026-11-16)

**Mục đích.** Bảng này là **bằng chứng truy vết** cho 11 tính năng hiện thực hoá ở Bước 1–6: mỗi tính năng đều dẫn được tới (1) route HTTP thật, (2) file test cụ thể, (3) quy tắc trong ma trận 3.11.

| Tính năng | Route HTTP thực thi | File test | Quy tắc | Bước | Ca test |
|---|---|---|---|---|---|
| `AUTH-03` Google OAuth 2.0 | `GET /auth/google`, `GET /auth/google/callback` | `step6-google-oauth.spec.ts`, `e2e/security/google-oauth.e2e-spec.ts` | C16, C17, I24, I25, O37, O39 | 6 | 13 |
| `AUTH-14` Remember-me | `POST /auth/login` | `step1-remember-me-and-issue-needs-info.spec.ts` | S26, C18, O38 | 1 | 5 (nhóm policy) |
| `USER-03` Xoá tài khoản của tôi | `DELETE /users/me` | `step1-services.spec.ts` | — | 1 | (đã có) |
| `USER-04` `phone` + `bio` | `PATCH /users/me`, `GET /users/me` | `step3-efgh.spec.ts` | S29 | 3 | 8 (Nhóm G) |
| `WS-11` Tổng quan workspace của tôi | `GET /overview/workspaces` | `step3-efgh.spec.ts` | C20 | 3 | 1 |
| `PROJ-13` Tổng quan 1 workspace | `GET /workspaces/{workspaceId}/overview` | `step3-efgh.spec.ts` | C20 | 3 | 2 |
| `PROJ-14` Tìm kiếm & quản lý thành viên project | `GET /projects/{projectId}/members` | `step3-efgh.spec.ts` | C21 | 3 | 3 |
| `PROJ-15` Chỉ định Project Owner | `POST /workspaces/{workspaceId}/projects` | `step3-efgh.spec.ts` | — | 3 | 5 (Nhóm F) |
| `ISSUE-05` Sửa báo cáo của tôi | `PATCH /issues/{issueId}` | `step1-remember-me-and-issue-needs-info.spec.ts` | S28, C19 | 1 | 5 (nhóm D) |
| `FILE-03` Quản lý metadata dataset | `PATCH /datasets/{id}`, `DELETE /datasets/{id}`, `PATCH /datasets/{id}/columns`, `POST /datasets/{id}/columns/reset` | `datasets-wave4.spec.ts`, `datasets-ingestion.spec.ts` | — | 1 | (đã có) |
| `FB-07` Xoá nhận xét của tôi | `DELETE /feedback/{feedbackId}` | `feedback-wave7.spec.ts` | — | 1 | (đã có) |

**Quy tắc bắt buộc (bổ sung cho v9):**
1. Mỗi tính năng mới phải có **ít nhất 1 file test** trỏ tới — không được để trạng thái "đã code, chưa test".
2. Tính năng có **hợp đồng HTTP công khai** (`AUTH-03`, `USER-04`, `WS-11`, `PROJ-13`, `PROJ-14`, `ISSUE-05`) bắt buộc có test **tầng 5 (E2E)** — không chỉ unit.
3. Tính năng có **rủi ro bảo mật** (`AUTH-03`, `ISSUE-05`) bắt buộc có ca âm: email đã tồn tại, `state` sai, tài khoản `blocked`, người khác sửa báo cáo.
4. Khi thêm route mới ở Phần 7 → cập nhật **đồng thời** bảng 3.12.3 và bảng 3.12.4 này.

### 3.13. Ngưỡng đạt và quy trình kiểm tra

#### 3.13.1. Lệnh kiểm tra

```json
{
  "scripts": {
    "test:unit": "jest --config jest.unit.json",
    "test:domain": "jest --config jest.unit.json --selectProjects domain",
    "test:app": "jest --config jest.unit.json --selectProjects application",
    "test:infra": "jest --config jest.unit.json --selectProjects infrastructure",
    "test:contract": "jest --config jest.unit.json --selectProjects contract",
    "test:e2e": "jest --config test/jest-e2e.json --runInBand",
    "test:security": "jest --config test/jest-e2e.json --selectProjects security",
    "test:arch": "node scripts/check-architecture.mjs",
    "test:coverage": "jest --coverage",
    "test:perf": "k6 run test/k6/smoke.js && k6 run test/k6/stress.js",
    "test:all": "pnpm test:unit && pnpm test:contract && pnpm test:arch && pnpm test:e2e && pnpm test:security",
    "test:report": "node scripts/generate-test-report.mjs"
  }
}
```

**Quy tắc bắt buộc:**

| # | Quy tắc |
|---|---|
| 1 | `test:all` là lệnh **duy nhất** dùng để quyết định "đủ điều kiện commit" — không ghép lệnh thủ công |
| 2 | `test:all` **không** chạy `test:perf` (k6 cần app chạy thật + staging) |
| 3 | `test:all` **tự bật/tắt** container test — người dùng chỉ cần `pnpm test:all` |
| 4 | Mọi lỗi test phải **fail** script — không dùng `--passWithNoTests` |
| 5 | `test:coverage` chạy **sau** `test:all` để không chậm bước phát hiện lỗi sớm |

#### 3.13.2. Ngưỡng coverage theo tầng

| Tầng | Đường dẫn | lines | branches | functions | statements |
|---|---|---|---|---|---|
| Domain | `packages/core/src/**`, `*/domain/**` | **≥ 90%** | ≥ 85% | ≥ 90% | ≥ 90% |
| Application | `*/application/**` | **≥ 80%** | ≥ 75% | ≥ 80% | ≥ 80% |
| Infrastructure | `*/infrastructure/**` | **≥ 60%** | ≥ 50% | ≥ 60% | ≥ 60% |
| Contracts | `packages/contracts/src/**` | ≥ 95% | ≥ 90% | ≥ 95% | ≥ 95% |
| **Tổng** | toàn bộ `src/` + `packages/` | **≥ 70%** | ≥ 65% | ≥ 70% | ≥ 70% |

**Quy tắc bắt buộc:**
1. Ngưỡng áp dụng **riêng từng tầng** — domain đạt 90% nhưng tổng dưới 70% vẫn fail.
2. Ngưỡng **có hiệu lực ngay** khi module được viết — không có "giai đoạn đầu cho qua".
3. File bị loại khỏi coverage phải khai báo lý do trong `jest.config.js` (`coveragePathIgnorePatterns`), không được bỏ âm thầm.
4. Ngưỡng chỉ có thể **nới** bằng một quyết định ghi trong tài liệu kèm lý do và thời điểm hẹn sửa.

**Đối chiếu:** hệ thống tham chiếu đặt ngưỡng global thấp hơn nhiều (lines 47% / functions 42% / branches 32%). Data Quality đặt **cao hơn** vì:
- Code mới viết lại từ đầu — không có "di sản" để biện minh cho coverage thấp.
- Tầng domain là nơi chứa logic nghiệp vụ — chi phí sửa bug cao nhất, nên coverage cao nhất.

#### 3.13.3. Gate chặn (quyết định 12)

**Áp dụng khi nào:**

| Mốc | Gate |
|---|---|
| Trước khi commit | `pnpm test:all` phải xanh |
| Trước khi deploy lên staging | `pnpm test:all` + `pnpm test:coverage` đạt ngưỡng |
| Trước khi deploy lên production | Tất cả mục trên + `pnpm test:perf` đạt ngưỡng + smoke test cutover |
| Trước cutover migration | Tất cả mục trên + verify migration 4 mức pass |

**Không có GitHub Actions (quyết định 11) nên gate chạy thủ công.** Để giảm rủi ro quên chạy, có thể thêm **git hook** (`husky` `pre-commit`) chạy `pnpm test:unit && pnpm test:arch` — phần nhanh, chặn lỗi sớm. Đây là tuỳ chọn, không phải yêu cầu bắt buộc.

**Quy tắc bắt buộc:**
1. Test fail ⇒ **không commit, không deploy**. Không có ngoại lệ "chạy lại có thể pass".
2. Coverage dưới ngưỡng ⇒ không deploy.
3. Không dùng `--force` để bypass.
4. Nếu một test đang lỗi tạm thời (vd fake AI adapter sai) → sửa test, **không** xoá assertion.

#### 3.13.4. Quy trình 3 bước

```
  BƯỚC 1              BƯỚC 2                    BƯỚC 3
┌──────────────┐   ┌──────────────────┐   ┌────────────────────────┐
│ CHẠY TEST    │   │ KIỂM CHỨNG       │   │ LẬP BÁO CÁO            │
│              │   │                  │   │                        │
│ pnpm test:all│──►│ Ngưỡng đạt?      │──►│ Báo cáo tự động        │
│ pnpm test:cov│   │ 135/143 quy tắc   │   │ + Kết luận của người   │
│ test:perf    │   │ 85 tính năng      │   │ + Cập nhật ma trận     │
│              │   │ 62 UC / 80 EP    │   │                        │
└──────────────┘   └──────────────────┘   └────────────────────────┘
     FAIL                FAIL                     FAIL
       ↓                   ↓                        ↓
   KHÔNG COMMIT      KHÔNG DEPLOY            KHÔNG NGHIỆM THU
```

### 3.14. Bằng chứng nghiệm thu

**Quyết định 10:** cả báo cáo tự động lẫn phần kết luận của người.

#### 3.14.1. Báo cáo tự động

**Script:** `scripts/generate-test-report.mjs` → ghi `docs/test-reports/<đợt>-<ngày>.md`.

**Cấu trúc báo cáo:**

```markdown
# Báo cáo kiểm thử — Đợt 1 — 2026-11-20

## 1. Tổng quan
| Hạng mục | Kết quả |
|---|---|
| Tổng test | 1.284 |
| Pass | 1.271 |
| Fail | 13 |
| Skip | 0 |
| Thời gian | 4 phút 12 giây |

## 2. Coverage theo tầng
| Tầng | lines | branches | functions | Ngưỡng | Kết quả |
|---|---|---|---|---|---|
| Domain | 91.2% | 86.4% | 92.0% | 90/85/90 | ✅ Đạt |
| Application | 82.1% | 77.3% | 84.5% | 80/75/80 | ✅ Đạt |
| Infrastructure | 64.8% | 52.1% | 63.2% | 60/50/60 | ✅ Đạt |
| Contracts | 96.1% | 91.0% | 97.3% | 95/90/95 | ✅ Đạt |
| Tổng | 73.4% | 68.9% | 74.8% | 70/65/70 | ✅ Đạt |

## 3. Quy tắc kiểm thử
| Nhóm | Tổng | Đạt | Chưa đạt | Thủ công |
|---|---|---|---|---|
| S | 18 | 18 | 0 | 0 |
| C | 8 | 8 | 0 | 0 |
| I | 14 | 14 | 0 | 0 |
| O | 28 | 24 | 0 | 4 |
| M | 24 | 21 | 0 | 3 |

## 4. Test fail (chi tiết)
| File | Test | Thông báo |
|---|---|---|

## 5. Hiệu năng (k6)
| Endpoint | p50 | p95 | p99 | Ngưỡng | Kết quả |

## 6. Ma trận tính năng
| Nhóm | Số | Đã test | Chưa test | Ngoài phạm vi |
```

**Quy tắc bắt buộc:**
1. Báo cáo sinh tự động — **không** sửa tay phần số liệu (phần kết luận của người viết ở mục 2 nằm trong file riêng hoặc phần cuối).
2. Báo cáo **commit vào repo** cùng code — là bằng chứng nghiệm thu theo thời điểm.
3. File báo cáo không bị ghi đè — mỗi lần chạy tạo file mới theo ngày.

#### 3.14.2. Kết luận của người (phần bổ sung)

Nằm ở cuối file báo cáo, viết tay:

```markdown
## 7. Kết luận nghiệm thu

**Phạm vi đã kiểm thử:** Đợt 1 — auth, workspace, project cơ bản.

**Đánh giá:** Đạt. 13 test fail đều là lỗi dữ liệu fixture, không phải lỗi logic — đã sửa fixture.

**Hạng chế đã biết:**
- Chưa có test hiệu năng cho import file 50MB.
- Endpoint `GET /audit-logs` mới thêm chưa có ca lỗi 403.

**Người đánh giá:** <tên> — 2026-11-20
```

#### 3.14.3. Cấu trúc thư mục bằng chứng

```
docs/test-reports/
├── 2026-11-20-dot-1.md
├── 2026-11-28-dot-2.md
├── 2026-12-10-dot-3.md
├── perf-2026-11-25.md
└── index.md                    ← bảng tổng hợp các đợt
```

**Quy tắc:** `index.md` liệt kê từng đợt: ngày, phạm vi, kết quả, link báo cáo. Đây là tài liệu bàn giao chính cho Phần 15.

### 3.15. Xử lý test không ổn định (flaky)

**Định nghĩa:** test pass/fail ngẫu nhiên giữa các lần chạy giống nhau.

**Quy tắc bắt buộc:**

| # | Quy tắc |
|---|---|
| 1 | Mọi test flaky phải được ghi nhận vào `docs/test-reports/flaky.md` kèm lý do |
| 2 | Nguyên nhân phổ biến nhất ở dự án này: **race condition** với Kafka consumer/worker, **thứ tự chạy test**, **dữ liệu dùng chung** |
| 3 | Sửa triệt để, không dùng `jest.retryTimes()` để che |
| 4 | Test E2E chạy `--runInBand` — tránh tranh chấp dữ liệu |
| 5 | Test adapter phải tự dọn dẹp — không dựa vào `afterAll` của test khác |
| 6 | Nếu một test flaky > 3 lần liên tiếp → **tạm `skip` có ghi chú** và ghi vào backlog sửa — không để xanh giả |

### 3.16. Quy tắc kiểm thử vận hành

| # | Kiểm tra |
|---|---|
| T1 | `pnpm test:all` chạy một lệnh, tự bật/tắt container, trả exit code đúng |
| T2 | Test thiếu biến môi trường → **fail**, không skip âm thầm |
| T3 | Coverage dưới ngưỡng tầng → **fail** |
| T4 | Coverage tổng dưới 70% → **fail** |
| T5 | Test AI không bao giờ gọi network ra ngoài — kiểm tra bằng mock network |
| T6 | Mọi file test có đúng 1 tầng — không trộn unit với E2E |
| T7 | Test tầng 2/3 không import Mongoose/NestJS — kiểm tra bằng script kiến trúc |
| T8 | Test E2E tự dọn dẹp dữ liệu — chạy lại 2 lần cho kết quả giống nhau |
| T9 | Test không phụ thuộc thứ tự chạy — chạy với `--randomize` (Jest 30) vẫn xanh |
| T10 | 48 tình huống phân quyền đều assert status **và** mã lỗi **và** không có side effect |
| T11 | Mọi endpoint có ≥ 2 ca test; endpoint nhạy cảm có ≥ 4 ca |
| T12 | Mọi quy tắc trong ma trận 93 có file test cụ thể hoặc đánh dấu thủ công |
| T13 | `openapi.json` đã commit khớp với schema sinh ra |
| T14 | Migration test chạy trên dữ liệu fixture mô phỏng dữ liệu lệch (thiếu Owner, nhiều Owner) |
| T15 | Báo cáo test sinh tự động chứa đủ 6 mục bắt buộc |
| T16 | `test:perf` không chạy trong `test:all` |
| T17 | Không có test nào dùng dữ liệu thật của workspace thật |
| T18 | Test có PII luôn dùng dải số giả (`0900000000`+) và email `@test.local` |

### 3.17. Đối chiếu với code hiện tại (cập nhật v9, 2026-11-16)

**Hiện trạng thực tế (đã đo, không phải thiết kế):**

| Hạng mục | v8 (thiết kế) | **v9 (thực tế)** |
|---|---|---|
| Số file `*.spec.ts` | 16 | **23 file** (21 unit + 2 kiến trúc tích hợp trong `test/`, cộng 3 file E2E trong `test/e2e/`) |
| Tổng số ca test (`it(`) | — | **233 ca** trong `test/` + **4 ca E2E** (`health`, `authorization`, `google-oauth`) |
| Tầng unit tách biệt | `jest.unit.json` với 4 project | **Chưa tách project** — dùng `jest` trong `package.json` (`testRegex: .*\.spec\.ts$`) + script tách bằng `--testPathIgnorePatterns` |
| Test kiến trúc | `scripts/check-architecture.mjs` | **Đã có** — 4 suite: `zero-any`, `guard-coverage`, `zod-openapi`, `clean-architecture` (16 ca) |
| Coverage threshold | có | **Chưa** — `collectCoverageFrom` đã có nhưng chưa đặt `coverageThreshold` |
| E2E | `test/jest-e2e.json` + project `security` | **Đã có** — `test/jest-e2e.json` (`testRegex: .e2e-spec.ts$`), script `test:security` tách riêng |
| Hiệu năng | `test/k6/smoke.js` + `stress.js` | **Đã có** — `test/k6/smoke.js`, `test/k6/stress.js`, script `test:perf` |
| Benchmark AI | `test/benchmark/run-benchmark.mjs` + `eval-set.jsonl` | **Đã có** |
| ESLint | — | **Siết `--max-warnings 0`** (Bước 7) — `lint`, `lint:ci` đều fail nếu có warning |
| Lệnh tổng hợp | `test:all` | **Đã có** — `pnpm run test:all` = `test:unit` → `test:arch` → `test:e2e` |

**Kết quả chạy thực tế (2026-11-16):**

| Lệnh | Suite | Ca test | Kết quả | Thời gian |
|---|---|---|---|---|
| `pnpm run test:unit` | 20 | **246** | ✅ PASS | 48,5 s |
| `pnpm run test:arch` | 4 | **16** | ✅ PASS | 13,5 s |
| **Tổng tự động (chưa kèm E2E)** | **24** | **262** | **✅ 0 fail** | **~62 s** |

**Khoảng cách còn lại so với thiết kế v8 (nợ kỹ thuật cần ghi nhận):**

| # | Khoảng cách | Mức độ | Ghi chú |
|---|---|---|---|
| 1 | `jest.unit.json` với 4 `projects` (domain/application/infrastructure/contract) **chưa** tách | Trung bình | Hiện dùng `--testPathIgnorePatterns` để tách tạm — chạy song song chưa tối ưu |
| 2 | `coverageThreshold` theo tầng **chưa** đặt | Cao | Chưa có số liệu coverage baseline |
| 3 | `test/factories/`, `test/fixtures/`, `test/seed/` mới chỉ có `test/factories/` và `test/fixtures/` | Thấp | Chưa có seed script |
| 4 | Test E2E cần Mongo thật — `test:e2e:full` yêu cầu `test:infra:up` | Trung bình | Đã có script `test:infra:up` / `test:infra:down` |
| 5 | Tổng ca test **262** so với ước tính **~850** của thiết kế | Cao | Còn khoảng 590 ca, tập trung ở tầng 4 (adapter) và tầng 7 (48 tình huống phân quyền) |

**Quyết định về vị trí file test — theo hệ thống tham chiếu (giữ nguyên từ v8):**

| Loại | Vị trí | Lý do |
|---|---|---|
| Unit / domain / application | `test/*.spec.ts` (gộp theo nhóm tính năng) | Hiện tại chưa tách cạnh file — chấp nhận tạm, cần tách khi lên tầng 4 đầy đủ |
| E2E | `test/e2e/*.e2e-spec.ts` | Tách biệt, chạy bằng config riêng |
| Adapter | `test/integration/*.spec.ts` | Cần container, tách khỏi unit để chạy nhanh |
| Security | `test/e2e/security/*.e2e-spec.ts` | Chạy cùng E2E nhưng project riêng (`test:security`) |
| Fixture / factory | `test/factories/`, `test/fixtures/` | Tái sử dụng nhiều nơi |

**Đối chiếu với mô hình kiểm thử thông dụng (cập nhật v9):**

| Khả năng của mẫu | Có dùng không | Lý do |
|---|---|---|
| `jest.config.js` với `projects` | ⚠️ **Mới một phần** — `jest` key trong `package.json`, chưa tách 4 project | Tạm dùng `--testPathIgnorePatterns` |
| `test/jest-e2e.json` riêng | ✅ Có | E2E cần `runInBand` + timeout dài |
| `coverageThreshold` | ❌ **Chưa** | Cần baseline coverage trước khi đặt ngưỡng |
| `test/setup-env.ts` | ✅ Có | Nạp biến test, reset trạng thái |
| `test/factories/`, `test/fixtures/` | ✅ Có (chưa có `test/seed/`) | Quyết định 7 |
| `scripts/check-module.mjs` | ✅ Có — mở rộng thành `clean-architecture.spec.ts` + `verify-di-graph.ts` + `generate-arch-baseline.ts` | Quyết định 5 |
| `test/k6/smoke.js` + `stress.js` | ✅ Có | Quyết định 6 |
| `test:outbox`, `test:inbox`, `test:replica-set` script riêng | ✅ Có — gộp vào `test:all` | Tránh phải nhớ chạy |
| `check:duplication` (jscpd) | ❌ **Không dùng** | Đo trùng lặp code, không phải tiêu chí nghiệm thu |
| `security-check.mjs` | ✅ Có — gộp vào tầng 6 | Phù hợp quyết định 5 |
| `verify:montache.mjs` (check `any`) | ✅ Có — `test/zero-any.spec.ts` | Quy tắc A7: cấm `any` trong `src/` |

### 3.18. Ước tính khối lượng công việc kiểm thử

| Tầng | Số test ước tính | Thời gian viết |
|---|---|---|
| 1 — Contract | ~20 | 2 ngày công |
| 2 — Domain | ~250 (nhiều ca cho `create()` + biên) | 5 ngày công |
| 3 — Use case | ~185 (62 UC × 2–3 ca) | 8 ngày công |
| 4 — Adapter | ~120 | 5 ngày công |
| 5 — E2E | ~200 (84 route HTTP × 2–4 ca) | 9 ngày công |
| 6 — Architecture | ~12 quy tắc trong 1 script | 2 ngày công |
| 7 — Security | ~62 (48 tình huống + bộ bổ sung) | 4 ngày công |
| 8 — Performance | 2 script k6 | 1 ngày công |
| Hạ tầng test | compose, factories, seed, fixtures, script báo cáo | 4 ngày công |
| **Tổng** | **~850 test** | **~38 ngày công** |

**Ghi chú:** tổng ~850 test nhưng phần lớn là ca nhỏ, viết nhanh. Ước tính này **chưa** gồm thời gian viết code production tương ứng (Phần 14).

**Rủi ro:** khối lượng test lớn hơn code. Đây là hệ quả của quyết định 3 (đầy đủ 8 tầng) + 13 (mapping đầy đủ) + 9 (34 tình huống tự động). Đánh đổi được chấp nhận vì đợt này là **viết lại toàn bộ backend** — không có test sẽ không có cách chứng minh tính đúng đắn.

### 3.19. Điều kiện hoàn tất phần này

Bộ kiểm thử và tiêu chí nghiệm thu đã thống nhất trước khi thực thi kế hoạch implementation.

**Trạng thái v9 (2026-11-16):** 17 quyết định kiểm thử đã chốt. **9 tầng test** với ngưỡng coverage riêng; ma trận **143 quy tắc** (135 tự động + 8 thủ công); bảng mapping **85 tính năng / 66 use case / 84 route HTTP thực thi**; quy trình 3 bước với gate chặn; báo cáo tự động 6 mục + kết luận của người; 18 quy tắc kiểm thử T1–T18. **Đã hiện thực hoá:** 74 file test, **1 277 ca PASS** (1 069 unit/arch + 138 integration + 70 e2e). Còn 2 câu hỏi mở tại mục 6.2.

### 3.20. Test bổ sung cho hoàn thiện module analysis (v8)

- **Trạng thái:** Đã thực hiện 2026-11-17 — code + test xong (xem Phần 14 v8 mục 3.16). Các test thêm vào `src/backend/test/analysis-*.spec.ts` / spec cạnh service.

| Mã | Mô tả | Kỳ vọng |
|---|---|---|
| AN-01 | Đổi config sau khi phân tích → `createSummary` | `409 ANALYSIS_RESULT_STALE` |
| AN-02 | `getResult` sau khi đổi config | `isStale = true`, `staleReason = config_changed` |
| AN-03 | Report job với save A, sau đó tạo save B → worker dựng PDF | PDF dùng save A |
| AN-04 | Model trả text không phải JSON, còn lượt | job về `pending`, `attempt+1`, không `failed` |
| AN-05 | Hết lượt retry | job `failed`, assessment `failed` |
| AN-06 | Retry job `succeeded`/`running` | `409 AI_JOB_NOT_RETRYABLE` |
| AN-07 | Retry khi kết quả stale | `409 ANALYSIS_RESULT_STALE` |
| AN-08 | User workspace khác gọi `GET /analysis/jobs/{id}` | `404` |
| AN-09 | Report job `running` quá lease | trả về `pending` / `failed` sau 2 lần |
| AN-10 | `top_n = 5` | Tổng kết/PDF tối đa 5 phát hiện |

### 3.21. Test bổ sung đợt D/E module analysis

- **Trạng thái:** Đã thực hiện 2026-11-17 (đợt D/E, ghi tiếp vào phiên bản của đợt A/B/C). Nguồn: rà soát sau đợt A/B/C, `docs/modules/analysis_plan.md` v1.2.

| Mã | Mô tả | Kỳ vọng |
|---|---|---|
| AN-11 | Người ngoài project gọi các route `projects/{id}/analysis*`, `summary`, `report` | 404 |
| AN-12 | Viewer: GET config/result/summary, POST report, GET file | thành công |
| AN-13 | Viewer: POST config/analysis/summary | 403 |
| AN-14 | Đổi tên cột sau khi lưu cấu hình | cấu hình vẫn đúng cột (theo key) |
| AN-15 | Đổi tên cột sau khi phân tích → GET result / tạo Tổng kết | `isStale`, `dataset_changed` / 409 |
| AN-16 | Histogram, box plot, Top N + "Khác", `chart_top_n` ngoài 1–20 | đúng số liệu / 400 |
| AN-17 | Mức ảnh hưởng tại biên 1%, 10%, 0,5%, 5% và cột 0 dòng | đúng mức / `no_data` |
| AN-18 | Thứ tự ưu tiên trong Tổng kết | cao → trung bình → thấp, cùng mức theo tỷ lệ |
| AN-19 | Phân tích thành công/lỗi, AI xong/hết lượt | ghi đúng sự kiện outbox |
| AN-20 | `rowCount > ANALYSIS_MAX_ROWS` | 413 `ANALYSIS_TOO_LARGE`, không nạp dữ liệu |
| AN-21 | Tương thích hợp đồng: `top_n` = 101; `summary.recommendations` | 400 (tối đa 100, mặc định 50); `recommendations` là `string[]` đã sắp ưu tiên, cấu trúc ở `recommendation_items` |

### 3.22. Test đợt F module analysis

- **Trạng thái:** Đã thực hiện 2026-11-17 (đợt F). Nguồn: demo offline Titanic 2026-11-17 + `docs/modules/analysis_plan.md` v1.4. File: `src/backend/test/analysis-wave7.spec.ts` (mock nội bộ, không qua HTTP/CASL).
- **Kết quả 2026-11-17:** tsc/nest build sạch; unit 208/208 (thêm 20 test cho đợt F), kiến trúc 3/3, e2e 52/52; demo Titanic: tương quan còn 8 cột / 28 cặp (loại PassengerId, Name, Ticket, Cabin), VIF chỉ Age/Fare, prompt có mẫu ô lỗi, cặp đường chéo bị loại, PDF 7 → 4 trang.

| Mã | Kiểm tra |
|---|---|
| AN-22 | Suy vai trò trên dữ liệu kiểu Titanic: `PassengerId` identifier; `Name`/`Ticket` text; `Survived`/`Pclass`/`Sex`/`Embarked` category; `Age`/`Fare` measure; cột số category có `uncertain` |
| AN-23 | `column_roles` ghi đè (`source = user`); key lạ → 400; `measure` cho cột chữ → 400 |
| AN-24 | Tương quan loại identifier/text kèm lý do; `Survived`~`Sex` dùng Cramér's V |
| AN-25 | VIF không có cột nhãn và cột identifier |
| AN-26 | DQ-04 bỏ qua cột category dạng số |
| AN-27 | `maskForAi`: `***` (PII đánh dấu/regex), dạng mẫu (identifier/text), giá trị thật (còn lại), cắt 40 ký tự |
| AN-28 | Mẫu prompt chỉ gồm ô lỗi, ≤ 20/cột, có mẫu khi có lỗi |
| AN-28b | Biểu đồ theo vai trò: không có Top N cho định danh/văn bản/cột PII |
| AN-29 | `value_masked` của bằng chứng theo chính sách mới |
| AN-30 | Grounding loại cặp X~X |
| AN-31 | Prompt chỉ có tam giác trên |
| AN-32 | Bảng PDF: mỗi cặp một lần, không đường chéo, đúng thứ tự |
| AN-33 | `PATCH` cột với `is_pii` đổi fingerprint → kết quả lỗi thời; đổi `column_roles` cũng vậy |

- Service datasets (`is_pii` không đổi tên khi chỉ gửi cờ): thêm vào `test/datasets-wave4.spec.ts`.
- Chạy lại script demo offline trên `titanic.csv` và xem PDF bằng mắt.

### 3.23. Test đợt G module analysis

- **Trạng thái:** Đã thực hiện 2026-11-17 (đợt G). Nguồn: bộ test offline `local_VQD` (oracle độc lập + tiêm lỗi, file `MISSED_ERRORS.md`) + `docs/modules/analysis_plan.md` v1.5. File: `src/backend/test/analysis-wave8.spec.ts`.
- **Kết quả 2026-11-17:** tsc/nest build sạch; unit 221/221 (thêm 13 test đợt G), kiến trúc 3/3, e2e 52/52; bộ test offline `local_VQD` (9 dataset): nhóm A (bỏ sót trong phạm vi DQ-01..04) 5 → 0, taxis hết FAIL phủ cột và báo trùng giả, tiêm lỗi vào cột ngày bắt 60/60, ký hiệu thiếu / hoa-thường / khoảng trắng ở cột chữ được báo ở nhóm Nghi vấn 106/106 mỗi loại; còn lại chỉ RC-01 (DQ-05, để đợt sau).

| Mã | Kiểm tra |
|---|---|
| AN-34 | Cột ngày có trong `dqSummary` khi không chọn cột; ô ngày trống vào DQ-01 |
| AN-35 | Hai dòng chỉ khác cột ngày → không bị báo trùng |
| AN-36 | `parseStrictDate`: định dạng hợp lệ; 30/02, tháng 13, `March 5` sai |
| AN-37 | Xác định DD/MM, MM/DD, mơ hồ → nghi vấn `ambiguous_date_format` |
| AN-38 | Cột chữ có `NA`/`?` → DQ-03 = 0 + nghi vấn `missing_token`; cột số có `?` → DQ-03 |
| AN-39 | Nghi vấn hoa/thường và khoảng trắng |
| AN-40 | Nghi vấn sentinel và cột hằng |
| AN-41 | Tổng kết có `suspicions` ngoài `issues`; PDF có mục nghi vấn |
| AN-42 | Ví dụ trong nghi vấn được che PII |
| AN-43 | Năm + tháng → `reason`, `timePartColumns` |
| AN-44 | Số thập phân ít giá trị → `measure`; số nguyên ít giá trị vẫn `category` |
| AN-45 | API kết quả phân tích không có `suspicions` |

- Chạy lại bộ test offline `local_VQD/runner/run-all.ts` trên 9 dataset.

### 3.24. Test đợt H module analysis

- **Trạng thái:** Đã thực hiện 2026-11-18 (đợt H). File `src/backend/test/analysis-wave9.spec.ts`.
- **Kết quả 2026-11-18:** tsc/nest build sạch; unit 238/238 (thêm 17 test đợt H), kiến trúc 3/3, e2e 52/52; bộ edge-cases `local_VQD/edge-cases` (11 file, 28 bẫy): 10 → 26 bẫy được báo đúng, chỉ còn E14/E15 (DQ-05, để đợt sau); bộ 9 dataset mẫu không đổi (chỉ còn RC-01), Nghi vấn mới không báo thừa trên dữ liệu mẫu.
| Mã | Kiểm tra |
|---|---|
| AN-46 | `saveConfig` nhận nhãn là cột số; nhãn là cột ngày vẫn `400` |
| AN-47 | Nhãn 0/1 (346/54) → `imbalance.status = evaluated`, IR ≈ 6,4, có cảnh báo |
| AN-48 | Nhãn là cột định lượng hoặc bị người dùng ghi đè vai trò `measure` → `not_applicable_continuous` + lý do, không lỗi |
| AN-49 | Cột chữ có `NA`: mất cân bằng đủ lớp, `missingLabelRows = 0`; tương quan dùng đủ dòng |
| AN-50 | Cột số có `?` vẫn bị loại khỏi tương quan (không hồi quy) |
| AN-51 | `identifier_not_unique` (mã đơn lặp) |
| AN-52 | `duplicate_key` (email khác hoa/thường + cùng điện thoại); dòng giống hệt không bị báo ở đây |
| AN-53 | `locale_number_format` (`1.200,50`, `$1,200`); `abc` không bị coi là số theo vùng |
| AN-54 | `conditional_missing` (ngày thanh toán ↔ trạng thái); cột trống ngẫu nhiên không bị báo |
| AN-55 | `leading_zero_numeric` (mã bưu chính) |
| AN-56 | Sentinel -999 xuất hiện 1 lần ở cột dương được báo; cột có giá trị âm thật thì không |
| AN-57 | `timeAnalysis.dateOrder`, `dateOrderAmbiguous`; PDF có câu cảnh báo khi mơ hồ |
| AN-58 | `skewness` + lý do DQ-04 có cảnh báo lệch; mức ảnh hưởng không đổi |
| AN-59 | `symbolMissingCount` và lý do DQ-03 tách ký hiệu thiếu |
| AN-60 | `descriptive` của cột định danh: số liệu định lượng = `null`, số đếm giữ nguyên |
| AN-61 | Cột giá trị là định danh → bị bỏ khỏi thời gian, có `valueColumnIgnoredReason` |
| AN-62 | API kết quả không có `suspicions`; Tổng kết và PDF hiển thị các loại mới |

- **Kiểm thử offline:** `local_VQD/runner/run-all.ts --dir edge-cases` — kỳ vọng chỉ còn 2 bẫy DQ-05; chạy lại bộ 9 dataset mẫu để kiểm Nghi vấn mới không báo nhầm hàng loạt.


### 3.25. Test đợt I module analysis

- **Trạng thái:** Đã thực hiện 2026-11-18 (đợt I). File `src/backend/test/analysis-wave10.spec.ts`.
- **Kết quả 2026-11-18:** tsc/nest build sạch; unit 244/244 (thêm 6 test đợt I), kiến trúc 3/3, e2e 52/52; bộ test `local_VQD` chạy đầy đủ (9 CSV mẫu + tiêm lỗi, 11 CSV edge-cases, 0 FAIL): lỗi bỏ sót 16 → 5 (còn thứ tự hai cột ×2, tốc độ, x/y/z ≤ 12 mm, công thức depth — ngoài phạm vi); tiêm giá trị âm bắt 100%; 8 Nghi vấn mới trên dữ liệu sạch đều là lỗi thật, không báo thừa.
| Mã | Kiểm tra |
|---|---|
| AN-63 | Số âm ≤ 5% trong cột dương → báo; cột > 5% số âm → không; sentinel -999 không bị báo trùng |
| AN-64 | Số 0 ≤ 3% trong cột dương → báo; cột nhiều số 0 (36%) → không; cột số vai trò phân loại → báo; cột định danh → không |
| AN-65 | Dòng trống mọi cột định lượng → báo đúng số dòng; dataset 1 cột định lượng → không |
| AN-66 | `missing_in_filled_group`: nhóm paid có 10 ô trống; không có mẫu thiếu theo nhóm thì không báo |
| AN-67 | DQ-05 vẫn `unassessed`; API kết quả không có `suspicions`; PDF mục 3b có nhãn mới |
| AN-68 | Cột < 20 giá trị → không báo dấu |


### 3.26. Port test đợt A–I module analysis sau refactor P1–P6 (v14)

- **Trạng thái:** Đã thực hiện 2026-11-24 (giai đoạn 3, `docs/modules/analysis_plan.md` mục 7h). Thư mục `src/backend/test/analysis-vqd-port/` (6 file spec + `legacy-analysis-facade.ts`). Không đổi `src/`.
- **Bối cảnh:** merge `origin/backend` (commit `131e14c`) lấy code của nhánh `backend`. Nhánh này chép tay logic đợt F–I rồi refactor sang command/query handler. Sáu file test của `Vqd_BE` (`analysis-completion`, `analysis-wave6`…`wave10`, 96 test, AN-01 → AN-68) gọi các service đã gỡ, nên không còn trong bộ test; `backend` chỉ viết lại 26 test (`analysis-wave6-10.spec.ts`).
- **Cách port (giữ ràng buộc TC-01 của `docs/refactor/13_refactor_constraints.md` — chỉ đổi phần khởi tạo/import, không sửa assert):**
  1. `test/helpers/legacy-analysis-facade.ts` — lớp tương thích giữ tên hàm cũ (`runAnalysis`, `buildPromptForJob`, `ingestAiResult`, `getResult`, `retryJob`, `createSummary`…) và gọi handler mới.
  2. Mỗi file cũ → `test/analysis-vqd-port-<tên cũ>.spec.ts`, giữ nguyên mã AN-xx và tên test.
  3. Mỗi test xếp vào một nhóm:

| Nhóm | Nghĩa | Cách ghi trong file test |
|---|---|---|
| **B — còn hiệu lực** | Hành vi vẫn có ở code hiện hành | `it(...)` — phải đạt |
| ~~C — hồi quy~~ | **Đã bỏ 2026-11-24** — người dùng chốt đánh giá tính đúng đắn của code mới thay vì ép theo logic cũ; 25 ca chuyển sang A (xem Kết quả) | — |
| **A — lỗi thời** | Tính năng đã gỡ theo quyết định OPEN (`24_open_decisions_resolved.md`) | Không port; ghi mã AN-xx + lý do trong bảng kết quả bên dưới |

- **Không đổi `src/` ở mục này.** Lỗi thật phát hiện được sửa ở đợt K (mục 3.27).
- **Bộ test offline `local_VQD`:** `runner/engine.ts` dựng lại bằng handler + port bộ nhớ (bản cũ ở `local_VQD/archive/`). Kết quả dùng làm bằng chứng khi đánh giá từng khác biệt (lỗi thật hay thay đổi thiết kế).
- **Kết quả 2026-11-24 (sau khi người dùng chốt cách đánh giá):** 6 file cũ = 98 định nghĩa test = **100 ca** (mở rộng `it.each`). Nguyên tắc chốt: **code sau merge là chuẩn**; test cũ chỉ giữ khi còn đúng với hành vi hiện hành — **không** dùng test cũ để ép code quay về logic cũ.

| Nhóm | Số ca | Xử lý |
|---|---|---|
| B — còn hiệu lực | **48** | `it`, đạt trên code hiện hành |
| A — không port | **52** | Ghi lý do tại chỗ (`[Nhóm A — không port]`) |

Nhóm A gồm ba loại:
1. **Đã gỡ theo quyết định OPEN / refactor (27 ca):** D2 "lỗi thời", `column_roles`, chọn cột, `PATCH is_pii` (OPEN-03/06); kiểm quyền chuyển sang guard CASL + policy loader (AN-08, AN-11–13 — chưa đối chiếu lại ma trận quyền); `markAiFailed`; trình dựng PDF thay bằng pdfkit.
2. **Thay đổi thiết kế của nhánh `backend`, chấp nhận (14 ca):** retry tạo job mới thay vì từ chối (AN-06 ×3); `top_n` mặc định 10; DQ-04 không ghi `outlierSkippedReason`; mẫu gửi AI là giá trị bất kỳ đã che PII (AN-28, AN-29, AN-31b); grounding không lọc thêm đường chéo (AN-30); không còn gợi ý năm + tháng, `excluded_invalid_dates_N`, `dateOrder` (AN-43, AN-43b, AN-57); `describeColumn` không theo vai trò (AN-60); `valueColumnIgnoredReason` (AN-61). Danh sách đầy đủ: `docs/modules/analysis_plan.md` mục 7i.
3. **Lỗi thật K1–K5, assert cũ gắn cơ chế đã đổi (11 ca):** AN-04 (K1), AN-34 / AN-35 / AN-62 (K2), AN-18 / AN-58 (K3), AN-47 (K4), AN-09 (K5), AN-19a–c (K6 — ngoài phạm vi). Test mới viết theo hành vi hiện hành ở mục 3.27.

- Toàn bộ: type-check 0, lint 0, `test:arch` 23/23, `test:unit` 2 lỗi `/proc/meminfo` (chỉ có trên Linux, có từ mốc ban đầu).
- **`local_VQD` — mốc mới:** oracle / bẫy gắn logic cũ thuộc loại 2 được đánh dấu "đã chấp nhận" (không tính lỗi). Còn lại đúng các lỗi thật: bộ mẫu 5 bỏ sót RC-14 (K2, taxis); edge-cases 23/28 bẫy — thiếu E15, E16 (K2), E11, E12, E25 (K4).


### 3.27. Test đợt K — sửa lỗi đúng đắn sau merge (v14)

- **Trạng thái:** Đã thực hiện 2026-11-24 (commit `8dde61a`, `1da618e` — kết quả ở `docs/modules/analysis_plan.md` mục 7i). File `src/backend/test/analysis-dot-k.spec.ts` + `test/integration/report-lease.spec.ts`. Quy tắc: Phần 9 v6 mục 3.13, Phần 12 v14 mục 3.23, Phần 8 v13 mục 3.20. *(v17: v15/v16 chép sót trạng thái "đang thực hiện".)*

| Mã | Kiểm tra |
|---|---|
| AK-01 | K1 — AI trả không phải JSON, còn lượt → job `pending`, `attempt+1`, **không** gọi ingest, không ghi đánh giá AI |
| AK-02 | K1 — hết lượt → job `failed` `AI_FAILED`; `aiCorrelationAssessment.status = failed` kèm lỗi; không đi qua grounding |
| AK-03 | K2 — cột ngày có trong `dq_summary.columns`: ô trống → DQ-01, ngày không tồn tại → DQ-03; vẫn loại khỏi tương quan (`date_column_excluded_from_correlation_vif`) |
| AK-04 | K2 — hai dòng chỉ khác cột ngày → `duplicateRowCount = 0` |
| AK-05 | K3 — Tổng kết: `outlierBreakdown.both > 0` → DQ-04 "Cao"; chỉ IQR 1,5× → "Thấp"; không có phân rã → "Thấp" |
| AK-06 | K4 — nhãn số 0/1 vai trò `category` → `imbalance.status = evaluated`, đủ lớp + IR; cột số vai trò khác → `not_applicable_continuous` |
| AK-07 | K5 — `tick()` nhận job qua `claimPendingReport(600000)`; repository nhận lại job `running` hết lease (`attempt < 3`), đặt lease mới, `attempt+1`; đủ 3 lượt → `failed` `REPORT_LEASE_EXPIRED` |
| AK-08 | Hồi quy toàn bộ: `local_VQD` bộ mẫu 0 bỏ sót; edge-cases bắt E11, E12, E15, E16, E25 |


### 3.28. Test đợt sửa module data-view (v15)

- **Trạng thái:** Đã thực hiện 2026-11-24 — unit 84/84 (`data-view`, `chart-data`, `record-keyset-cursor`), integration `record-query.spec.ts` 56/56 (28 cũ + 28 mới) trên Mongo thật; toàn bộ `test:unit` không có lỗi mới (chỉ 2 lỗi `/proc/meminfo` đã biết), integration 167/170 (3 lỗi MinIO đã biết).
- **Hợp đồng:** Phần 7 v13 mục 3.23 (DV-1…DV-17). **Checklist:** `src/backend/test/unit_test/07_data_view.md`.
- **Nguyên tắc:** chỉ thêm ca mới; ca cũ chỉ đổi kỳ vọng khi hành vi đổi có chủ đích và đã ghi trong hợp đồng (DV-5).

| Mã | Ca kiểm thử | Tầng | File | Quy tắc |
|---|---|---|---|---|
| DVT-01 | Duyệt hết trang khi sort cột number/date/string, `asc`/`desc`, có trùng + null, `limit = 2` → hợp các trang = kết quả một lần, không sót/lặp; null ở cuối | Integration (Mongo thật) | `test/integration/record-query.spec.ts` | DV-2, DV-5, VIEW-015 |
| DVT-02 | Cursor hỏng (base64/JSON/thiếu `row_index`) ở `POST /records/query` → `VALIDATION_ERROR` | Unit | `test/data-view.spec.ts` | DV-3, VIEW-005 |
| DVT-03 | Cursor không sort dùng cho truy vấn có sort, cursor sort khác → `VALIDATION_ERROR` | Unit | `test/data-view.spec.ts`, `test/record-keyset-cursor.spec.ts` | DV-3 |
| DVT-04 | Encode/decode cursor khứ hồi, giá trị `Date` khôi phục đúng kiểu | Unit | `test/record-keyset-cursor.spec.ts` | DV-2 |
| DVT-05 | `value` object / mảng chứa object → Zod từ chối; `limit = 500` nhận, `501` từ chối | Unit | `test/data-view.spec.ts` | DV-1, DV-6, VIEW-004, VIEW-007 |
| DVT-06 | Port nhận key `cN` đã quy đổi; lọc `c0` + tên hiển thị cùng cột → OR | Unit + Integration | `test/data-view.spec.ts`, `test/integration/record-query.spec.ts` | DV-8, VIEW-013 |
| DVT-07 | So sánh thứ tự với số / ngày sai → lỗi rõ ràng, không trả cả bảng; `equals` chuỗi thô trên cột số khớp ô sai kiểu | Integration | `test/integration/record-query.spec.ts` | DV-7, VIEW-010 |
| DVT-08 | `date between`, `date in`, `boolean in` | Integration | `test/integration/record-query.spec.ts` | DV-9, VIEW-011 |
| DVT-09 | `contains` / `search` trên cột số đã lưu dạng số | Integration | `test/integration/record-query.spec.ts` | DV-10 |
| DVT-10 | `isEmpty` / `isNotEmpty` với `'   '`; `null_count` tính chuỗi trống | Integration | `test/integration/record-query.spec.ts` | DV-11, VIEW-012 |
| DVT-11 | `stats` cột hằng số → 1 bucket; cột số thường → min/max/average/10 bucket đúng như trước | Integration | `test/integration/record-query.spec.ts` | DV-13, VIEW-018 |
| DVT-12 | `charts`: `missing_count` tính whitespace; boolean legacy gộp nhóm; chỉ cột đầu đếm tổng, các cột sau nhận `knownTotal` | Unit | `test/chart-data.spec.ts` | DV-11, DV-15 |

### 3.29. Test đợt sửa module feedback (v16)

- **Trạng thái:** Đã thực hiện 2026-11-24 — unit `test/feedback-v14.spec.ts` 28/28 (FBT-01…FBT-11) + `corr-vif-ai.spec.ts` (FBT-12); integration `repositories-domain.spec.ts` + `repositories-analysis.spec.ts` 56/56 (FBT-13 thêm 3 ca); `test:unit` toàn bộ không có lỗi mới (chỉ 2 lỗi `/proc/meminfo` đã biết), integration toàn bộ 170/173 (3 lỗi MinIO đã biết).
- **Hợp đồng:** Phần 7 v14 mục 3.24 (FB-R1…FB-R12), Phần 12 v15 mục 3.24 (T1-1…T1-6). **Checklist:** `src/backend/test/unit_test/13_feedback.md`.
- **Nguyên tắc:** chỉ thêm ca mới; ca cũ chỉ đổi kỳ vọng khi hành vi đổi có chủ đích và đã ghi trong hợp đồng (T1-4: `computeTrustScore(2)`).

| Mã | Ca kiểm thử | Tầng | File | Quy tắc |
|---|---|---|---|---|
| FBT-01 | Chủ nhận xét đã bị gỡ khỏi project sửa/xoá → `FORBIDDEN`; project đã xoá → `NOT_FOUND`; `feedbackId` sai định dạng → `VALIDATION_ERROR` | Unit | `test/feedback-v14.spec.ts` | FB-R6, FB-R7, FB-007, FB-008 |
| FBT-02 | Tạo nhận xét phát hiện khi run `pending`/`running`/`failed` → `CONFLICT`; nhận xét cả run khi `failed` → tạo được, khi `pending` → `CONFLICT` | Unit | `test/feedback-v14.spec.ts` | FB-R4, FB-006 |
| FBT-03 | `meta.limit` có trong cả 2 route GET; `summary` đủ mọi nhãn khi lọc `?label` | Unit | `test/feedback-v14.spec.ts` | FB-R1, FB-R2, FB-009 |
| FBT-04 | `findingId` 200 ký tự nhận / 201 ký tự từ chối ở cả `POST` và `GET`; chỉ khoảng trắng → từ chối | Unit | `test/feedback-v14.spec.ts` | FB-R3, FB-003 |
| FBT-05 | Tên tác giả lấy bằng **một** lần `findByIds`; tác giả không còn → `authorDisplayName = null` | Unit | `test/feedback-v14.spec.ts` | FB-009 |
| FBT-06 | RAG: 2 người → không lưu mẫu; 3 người khác `reason` → đúng **1** mẫu, mô tả **không** chứa `reason`, người sau chỉ cập nhật trust | Unit | `test/feedback-v14.spec.ts` | FB-R11, T1-1, T1-3, T1-4, FB-012, FB-013 |
| FBT-07 | RAG: đổi nhãn / xoá nhận xét → cập nhật trust mẫu của nhãn cũ; RAG ném lỗi → nhận xét vẫn lưu | Unit | `test/feedback-v14.spec.ts` | T1-5, T1-6, FB-013 |
| FBT-08 | Đặc tính cột chứa xuống dòng / chuỗi dài / email → bị làm sạch, ≤ 80 ký tự | Unit | `test/feedback-v14.spec.ts` | T1-2 |
| FBT-09 | Owner xoá vi phạm → audit `FEEDBACK_MODERATION_DELETED` có nội dung; chủ sửa → audit `FEEDBACK_UPDATED` có trước/sau; tự xoá → không ghi audit kiểm duyệt | Unit | `test/feedback-v14.spec.ts` | FB-R8, FB-R9 |
| FBT-10 | `promptVersion` lấy từ đánh giá AI, không có → `null` | Unit | `test/feedback-v14.spec.ts` | FB-R10 |
| FBT-11 | Realtime `feedback.created` không chứa `reason` | Unit | `test/feedback-v14.spec.ts` | FB-R12, FB-014 |
| FBT-12 | `computeTrustScore` / `isEligibleForStore` theo bảng T1-4 | Unit | `src/modules/analysis/domain/corr-vif-ai.spec.ts` | T1-4 |
| FBT-13 | `summaryByScope` đếm theo phạm vi run/finding; `listByScope` cursor `asc`/`desc` duyệt hết không sót/lặp | Integration (Mongo thật) | `test/integration/repositories-domain.spec.ts` | FB-R2, FB-009 |

### 3.30. Test đợt vá sau rà soát commit (v17)

- **Trạng thái:** Đã thực hiện 2026-11-24 — `tsc` 0 lỗi, `lint` 0 cảnh báo, `test:arch` 23/23, `arch:api-coverage` 84/84; `test:unit` **không đặt biến môi trường** 73/73 suite (1180 đạt, 3 skip — gồm 2 test chỉ chạy trên Linux); integration **không đặt `TEST_MONGODB_URI`** 175/178 (3 lỗi MinIO — OPEN-T-01); E2E 70/70. **Sau khi kéo `origin/backend` (2026-11-25):** `test:unit` 74/74 suite (1197 đạt, 3 skip); integration 175/178; E2E 10/12 suite, 87/87 ca — 2 suite e2e mới của `backend` lỗi biên dịch có sẵn từ `origin/backend` (`docs/modules/analysis_plan.md` mục 7k).
- **Hợp đồng:** Phần 7 v15 mục 3.25 (VA-1…VA-4), Phần 12 v16 mục 3.24 (T1-3, T1-5).
- **Đường dẫn test sau khi kéo `origin/backend` (2026-11-25):** nhánh `backend` gom test unit theo module (commit `cc3090a`): `test/<tên>.spec.ts` → `test/unit/<module>/<tên>.spec.ts`; bộ port đợt A–I `test/analysis-vqd-port/` → `test/unit/analysis/vqd-port/`. Bảng dưới dùng đường dẫn mới; các mục 3.20–3.29 giữ đường dẫn tại thời điểm thực hiện — tra theo tên file trong `src/backend/test/README.md`.

| Mã | Ca kiểm thử | Tầng | File | Quy tắc |
|---|---|---|---|---|
| VAT-01 | 3 người `correct` + 1 người `partially_correct` → trust mẫu "đúng" **không** giảm; `countDistinctAuthors` nhận đủ nhóm nhãn `[correct, partially_correct]` | Unit | `test/unit/feedback/feedback-v14.spec.ts` | VA-4, T1-3 |
| VAT-02 | Đổi nhãn `correct` ↔ `partially_correct` → chỉ đồng bộ mẫu 1 lần | Unit | `test/unit/feedback/feedback-v14.spec.ts` | T1-5 |
| VAT-03 | `countDistinctAuthors` với `labels` đếm tác giả khác nhau trên cả nhóm nhãn; `findingId` null/rỗng → 0 | Integration (Mongo thật) | `test/integration/repositories-domain.spec.ts` | VA-4 |
| VAT-04 | Tên tác giả thật qua `findByIds` ở bộ test cũ (mock bổ sung) | Unit | `test/unit/feedback/feedback-wave7.spec.ts` | FB-009 |
| VAT-05 | `in: []` qua port trên cột number / boolean / date → 0 dòng | Integration (Mongo thật) | `test/integration/record-query.spec.ts` | VA-3 |
| VAT-06 | Chỉ SYS-ADMIN có `can(Manage, 'all')` (WS-OWNER, PROJ-OWNER, PROJ-MEMBER đều `false`); `NODE_ENV=production` → `NOT_FOUND`, kể cả khi module không cung cấp `ConfigService` (đọc dự phòng `process.env.NODE_ENV`) | Unit | `test/unit/analysis/analysis-ai-result-guard.spec.ts` | VA-1 |
| VAT-07 | `retry` ghi audit `AI_JOB_RETRIED`, `result` ghi `AI_RESULT_INGESTED` | Unit | `test/unit/analysis/analysis-ai-result-guard.spec.ts` | VA-2 |
| VAT-08 | Test phụ thuộc môi trường chạy được ngoài Linux / không cần biến môi trường: 2 test `/proc/meminfo` chỉ chạy trên Linux; Redis multi-instance tự dùng `127.0.0.1:6380`, `redis-server` thiếu → bỏ qua ngay; URI Mongo test mặc định có `directConnection=true` | Unit + Integration | `test/unit/infra/ai-adapters-outbox.spec.ts`, `scripts/benchmark/benchmark.spec.ts`, `test/unit/infra/group1-infra.spec.ts`, `test/helpers/test-infra.ts` | — |

**OPEN-T-01:** 3 ca `test/integration/redis-minio.spec.ts` cần MinIO — image `minio/minio` đã bị gỡ khỏi Docker Hub (và `quay.io` trả 401), chưa chọn image thay thế.

### 3.31. Test đợt đóng việc còn mở của data-view, feedback, analysis (v18)

- **Trạng thái:** Đề xuất 2026-11-25.
- **Hợp đồng:** Phần 7 v16 mục 3.26 (DL-1…DL-5, NT-1…NT-7); Phần 12 v17 mục 3.24 (OPEN-FB-01); Phần 11 v5 (migration `scrub-few-shot`); Phần 9 v7 (người nhận thông báo phân tích).
- **E2E có sẵn bên `backend`:** `test/e2e/feedback-notifications-overview.e2e-spec.ts`, `test/e2e/dataset-dataview.e2e-spec.ts` lỗi biên dịch TS18048 (mock khai `Record<string, jest.Mock>` khi bật `noUncheckedIndexedAccess`) → bỏ chú thích kiểu. Sau sửa: E2E 12/12 suite, 94/94 ca.

**Data Views (DLT):**

| Mã | Ca kiểm thử | Tầng | File | Quy tắc |
|---|---|---|---|---|
| DLT-01 | Mã băm truy vấn không đổi khi đổi thứ tự `filters` / `search.columns`; đổi toán tử, giá trị, cột hoặc `search.value` → mã băm khác | Unit | `test/unit/shared/record-keyset-cursor.spec.ts` | DL-1 |
| DLT-02 | Bọc rồi gỡ cursor cùng truy vấn, trong 24 giờ → trả lại cursor trong | Unit | `test/unit/shared/record-keyset-cursor.spec.ts` | DL-3 |
| DLT-03 | Quá 24 giờ, hoặc cursor dạng cũ (`{ row_index }`, `{ v: 1, … }`) → `ValidationError` `details.reason = 'cursor_expired'`; thời điểm cấp ở tương lai xa / sai kiểu → cursor không hợp lệ | Unit | `test/unit/shared/record-keyset-cursor.spec.ts` | DL-2, DL-4 |
| DLT-04 | Mã băm lệch → `details.reason = 'cursor_query_mismatch'` | Unit | `test/unit/shared/record-keyset-cursor.spec.ts` | DL-1 |
| DLT-05 | `GET /records` và `POST /records/query`: cursor của truy vấn khác → `VALIDATION_ERROR`; `nextCursor` trả về là cursor đã bọc; trang 2 gửi đúng cursor trong xuống port | Unit | `test/unit/datasets/data-view.spec.ts` | DL-1, DL-3 |
| DLT-06 | Duyệt hết các trang qua `DataViewService` với bộ lọc + sort trên Mongo thật → đủ dòng, không trùng; đổi bộ lọc giữa chừng → `VALIDATION_ERROR` | Integration (Mongo thật) | `test/integration/record-query.spec.ts` | DL-1 |
| DLT-07 | Chuỗi ngày legacy không múi giờ (`'2024-01-01'`, `'2024-01-01 08:00'`) khớp `equals` / `between` / `in` như `Date` nạp chuẩn (UTC+7); chuỗi có `Z` giữ UTC; chuỗi rác → không khớp, xếp cuối khi sort; sort trộn chuỗi legacy với `Date` đúng thứ tự | Integration (Mongo thật) | `test/integration/record-query.spec.ts` | DL-5 |
| DLT-08 | `lessThan` / `lessThanOrEqual` / `greaterThan` trên cột số và cột ngày không trả ô trống / không đọc được (fixture dòng `age = "abc"`, `joined = null`) | Integration (Mongo thật) | `test/integration/record-query.spec.ts` | DL-6 |

**Mẫu RAG cũ (FST):**

| Mã | Ca kiểm thử | Tầng | File | Quy tắc |
|---|---|---|---|---|
| FST-01 | `isTemplatedDescription`: mẫu đúng khuôn → `true`; mô tả là `reason`, `"partially_correct cho DQ-01:age"`, đặc tính cột chưa làm sạch → `false` | Unit | `test/unit/feedback/feedback-example-template.spec.ts` | T1-1 |
| FST-02 | Quét: mẫu sai khuôn và mẫu dưới ngưỡng (2 người, trust 0,65) bị xoá mềm; mẫu đúng khuôn đủ ngưỡng giữ nguyên | Integration (Mongo thật) | `test/integration/few-shot-scrub.spec.ts` | OPEN-FB-01 |
| FST-03 | Dựng lại: nhóm ≥ 3 người cùng nhóm nhãn → đúng 1 mẫu theo khuôn, đồng thuận + trust đúng; nhóm < 3 người → không có mẫu | Integration (Mongo thật) | `test/integration/few-shot-scrub.spec.ts` | OPEN-FB-01, T1-3 |
| FST-04 | Chế độ mặc định (dry-run) không ghi gì; chạy apply lần 2 → 0 thay đổi; verify → 0 mẫu sai khuôn | Integration (Mongo thật) | `test/integration/few-shot-scrub.spec.ts` | Phần 11 v5 |

**Thông báo phân tích (NTT):**

| Mã | Ca kiểm thử | Tầng | File | Quy tắc |
|---|---|---|---|---|
| NTT-01 | `dispatchNotificationViaPorts`: tắt công tắc + không bắt buộc → không tạo; tạo được → phát `notification.created`; trùng `sourceEventId` (repo trả `null`) → không phát | Unit | `test/unit/notifications/notification-dispatch.spec.ts` | NT-5, NT-6 |
| NTT-02 | Lần phân tích thành công → `analysis_completed` cho `started_by`, `sourceEventId = analysis_completed:<runId>`, `payload.targetType = 'analysis_run'` | Unit | `test/unit/analysis/analysis-k6-notifications.spec.ts` | NT-1, NT-4 |
| NTT-03 | Lần phân tích lỗi → `analysis_failed`, summary không chứa thông điệp lỗi gốc; handler vẫn ném lỗi gốc | Unit | `test/unit/analysis/analysis-k6-notifications.spec.ts` | NT-2 |
| NTT-04 | `started_by = null` → không tạo; tạo thông báo lỗi → luồng phân tích vẫn thành công | Unit | `test/unit/analysis/analysis-k6-notifications.spec.ts` | NT-6, NT-7 |
| NTT-05 | Ingest kết quả AI `succeeded` / grounding `failed` → `ai_analysis_ready` với summary tương ứng, `sourceEventId = ai_analysis_ready:<jobId>:<attempt>` | Unit | `test/unit/analysis/analysis-k6-notifications.spec.ts` | NT-3, NT-5 |
| NTT-06 | Worker AI hết lượt → `ai_analysis_ready` (`AI_FAILED`); còn lượt → không tạo | Unit | `test/unit/analysis/analysis-k6-notifications.spec.ts` | NT-3 |

## 4. Đầu vào và đầu ra

**Đầu vào**
- Phần 3 v4 — 66 use case, ma trận quyền, vòng đời trạng thái.
- Phần 4 v3 — 20 module, ranh giới sở hữu, 5 module LEGACY.
- Phần 5 v1 — Rich Domain Model (`create()`/`reconstitute()`), quy tắc chiều dependency, optimistic locking, luồng outbox.
- Phần 6 v5 — 48 tình huống truy cập trái phép, ma trận quyền 5 vai trò + nhóm `FB-*`, chính sách token/rate-limit, bảo mật Socket.IO, ranh giới AI cục bộ.
- Phần 7 v8.4 — 84 route HTTP, quy ước response/lỗi/phân trang cursor, mã lỗi.
- Phần 8 v3 — 21 collection, 19 quy tắc S1–S19.
- Phần 9 v2 — 13 sự kiện, outbox/inbox, 14 quy tắc I1–I14.
- Phần 10 v3 — 28 quy tắc O1–O28, biến môi trường, health check.
- Phần 11 v2 — 26 quy tắc M1–M26, quy trình cutover.
- Phần 12 v3 — ngưỡng ảnh hưởng, che PII, thư viện thống kê, bất biến dữ liệu.
- Mã nguồn hiện tại — 16 file `test/*.spec.ts` gọi Mongo thật, không có `jest.config.js`, không có coverage threshold.
- Mô hình kiểm thử thông dụng — `jest.config.js` có `projects`, `test/jest-e2e.json`, `test/factories/`, `test/fixtures/`, `test/k6/`, `scripts/check-module.mjs`, `scripts/security-check.mjs`, `scripts/verify-montache.mjs`, 9 script `test:*` chuyên biệt.
- Quyết định của người dùng — 14 lựa chọn kiểm thử (2026-11-05).

**Đầu ra**
- 14 quyết định kiểm thử nền tảng.
- 8 tầng test với ranh giới trách nhiệm rõ ràng và thứ tự chạy tối ưu.
- Cơ chế mock tầng 3 — fake implementation theo interface thay vì `jest.mock()`, kèm lý do.
- `docker-compose.test.yml` với Mongo replica set 1 node + Redis + MinIO.
- Quy tắc test bắt buộc cho từng aggregate domain, đặc biệt 7 hàm thống kê với ca biên bắt buộc.
- 14 quy tắc kiến trúc A1–A14 trong `scripts/check-architecture.mjs`.
- 48 tình huống phân quyền theo 9 nhóm + 6 nhóm test bổ sung.
- **Ma trận truy xuất ngược 143 quy tắc** (S/C/I/O/M) → tầng test + file test cụ thể.
- Bảng mapping **85 tính năng**, 66 use case, **84 route HTTP thực thi** với cột trạng thái.
- **Bảng truy vết tính năng mới ↔ route HTTP ↔ bộ test** (mục 3.12.4) — bằng chứng cho 11 tính năng hiện thực hoá ở Bước 1–6.
- Ngưỡng coverage theo 5 nhóm tầng (domain 90% / application 80% / infrastructure 60% / contracts 95% / tổng 70%).
- 12 lệnh `test:*` + quy tắc `test:all` là lệnh duy nhất quyết định đủ điều kiện commit.
- Quy trình nghiệm thu 3 bước với gate chặn ở 4 mốc.
- Cấu trúc báo cáo tự động 6 mục + mẫu kết luận của người + cấu trúc `docs/test-reports/`.
- Quy tắc xử lý test flaky (6 quy tắc).
- Bảng đối chiếu code hiện tại — 6 vấn đề và cách xử lý; bảng đối chiếu hệ thống tham chiếu 12 dòng (giữ 11, bỏ 1 `jscpd`).
- Ước tính ~850 test / ~38 ngày công.
- **Số liệu thực thi:** 74 file test · **1 277 ca PASS** (1 069 unit/arch + 138 integration + 70 e2e) · 5 bộ test mới 83 ca.
- 18 quy tắc kiểm thử T1–T18.

## 5. Điều kiện hoàn tất phần này

Bộ kiểm thử và tiêu chí đạt được thống nhất trước khi thực thi kế hoạch implementation.

**Trạng thái v9:** 17 quyết định đã chốt; **9 tầng**; ma trận **143 quy tắc**; 4 bảng mapping (3 bảng + bảng truy vết 3.12.4); ngưỡng theo tầng; quy trình 3 bước; 18 quy tắc T1–T18. Còn 2 câu hỏi mở tại mục 6.2.

## 6. Câu hỏi và phụ thuộc còn mở

### 6.1. Đã chốt ở v1

| # | Câu hỏi | Kết quả |
|---|---|---|
| 1 | Module `exports` (LEGACY) | **Xoá hẳn** — đóng câu hỏi treo từ Phần 11 (mục 3.7.4) |
| 2 | Môi trường E2E | **Container Mongo replica set** + Redis + MinIO (mục 3.6) |
| 3 | Các tầng test | **8 tầng đầy đủ** (mục 3.2) |
| 4 | Ngưỡng coverage | **Theo tầng** — domain 90 / app 80 / infra 60 / tổng 70 (mục 3.13.2) |
| 5 | Kiểm tra kiến trúc | **Script tự động** 14 quy tắc (mục 3.8) |
| 6 | Test hiệu năng | **k6** thủ công (mục 3.10) |
| 7 | Dữ liệu test E2E | **Factory + seed script** (mục 3.7) |
| 8 | Test AI | **Luôn mock** — không gọi engine suy luận thật ở tầng 1–8 (mục 3.5) |
| 9 | Test bảo mật | **48 tình huống tự động** (mục 3.9) |
| 10 | Bằng chứng nghiệm thu | **Cả hai** — báo cáo tự động + kết luận của người (mục 3.14) |
| 11 | CI | **Chỉ script `pnpm test:all` local** — không GitHub Actions (mục 3.13.1) |
| 12 | Gate | **Chặn** — fail thì không commit, không deploy (mục 3.13.3) |
| 13 | Bảng mapping | **Đầy đủ** — 85 / 66 / 86 / 143 (mục 3.11, 3.12) |
| 14 | Test hợp đồng API | **Cả hai** — snapshot OpenAPI + validate runtime Zod (mục 3.3, 3.7) |

### 6.2. Đã chốt ở v7 (2026-11-07)

| # | Câu hỏi | Ảnh hưởng | Nơi xử lý |
|---|---|---|---|
| 1 | ~~git hook husky pre-commit?~~ **Đã chốt v7: CÓ — `husky` pre-commit chạy `pnpm test:unit && pnpm test:arch`** | Đã chốt | Phần 14 v7 |
| 2 | ~~Soak test vài giờ trước release?~~ **Đã chốt v7: CHƯA — chỉ stress ngắn; soak khi kịch bản stress ổn định** | Đã chốt | Phần 14 v7 |

### 6.3. Phụ thuộc bên ngoài

- **Docker** — cần cho `docker-compose.test.yml` (Mongo replica set, Redis, MinIO).
- **k6** — cài riêng, không nằm trong `package.json`; chỉ cần khi chạy `test:perf`.
- **MongoDB Atlas M0** — dùng cho môi trường dev; **không** dùng cho test (thiếu replica set).
- **R2 / MinIO** — MinIO container trong test để không tốn phí và không phụ thuộc mạng.
- **Engine suy luận cục bộ** — **không** dùng ở tầng 1–8 (luôn mock); chỉ tầng 9 gọi engine trong container.

### 6.4. Phụ thuộc chéo với Phần 14

| Phụ thuộc | Mô tả |
|---|---|
| **Bắt buộc** | Phần 14 phải tham chiếu ma trận 143 quy tắc và bảng mapping để xác định test nào viết trước, test nào sau |
| **Bắt buộc** | Mỗi đợt giao hàng trong Phần 14 phải kèm tiêu chí nghiệm thu theo mục 3.13.3 |
| **Bắt buộc** | Phần 14 phải có bước "viết test" **đi kèm** bước "viết code" trong cùng đợt — không viết code xong mới viết test |
| **Ràng buộc** | Phần 14 phải đặt **hạ tầng test** (compose, factory, seed, checker) là đợt 0 — trước mọi module khác |
| **Ràng buộc** | Ngưỡng coverage áp dụng **ngay khi module đầu tiên được viết** — không có giai đoạn đầu cho qua |
| **Ghi nhận** | Câu hỏi mở #3 ở Phần 11 (số lượng `dataset_record` thực tế) vẫn còn — ảnh hưởng kịch bản k6 và thời gian chạy test import |

## 7. Prompting log và lịch sử thay đổi
- **Đề xuất v18 / 2026-11-25:** Test đợt đóng việc còn mở (mục 3.31: DLT-01…08, FST-01…04, NTT-01…06) + sửa 2 e2e lỗi biên dịch / Người dùng nhận 3 module data-view, feedback, analysis và duyệt plan / Thêm mục 3.31; docs trước code.
- **Bổ sung v17 / 2026-11-25:** Kéo `origin/backend` (8 commit, gom test theo module) trước khi push / Người dùng yêu cầu kéo code `backend` về trước khi push / Bảng mục 3.30 đổi sang đường dẫn `test/unit/<module>/`; thêm ghi chú đối chiếu cho mục 3.20–3.29; VAT-06 thêm ca không có `ConfigService`.
- **Thực hiện v17 / 2026-11-24:** Hoàn tất VAT-01…VAT-08 / Người dùng duyệt plan / Đổi trạng thái mục 3.30 sang đã thực hiện.
- **Đề xuất v17 / 2026-11-24:** Test đợt vá sau rà soát commit (mục 3.30, VAT-01…VAT-08) + sửa trạng thái mục 3.27 / Người dùng yêu cầu kiểm tra bản audit commit / Thêm mục 3.30; docs trước code.
- **Thực hiện v16 / 2026-11-24:** Hoàn tất FBT-01…FBT-13 / Người dùng duyệt plan / Đổi trạng thái mục 3.29 sang đã thực hiện; ca FBT-01…FBT-11 đặt ở file mới `test/feedback-v14.spec.ts` (helper mock đầy đủ hơn, không sửa `build()` của `feedback-wave7.spec.ts`).
- **Đề xuất v16 / 2026-11-24:** Test đợt sửa module `feedback` (mục 3.29, FBT-01…FBT-13) / Người dùng duyệt plan sửa `feedback` / Thêm mục 3.29; docs trước code.
- **Thực hiện v15 / 2026-11-24:** Hoàn tất 12 nhóm ca DVT-01…DVT-12 / Người dùng duyệt plan / Đổi trạng thái mục 3.28 sang đã thực hiện.
- **Đề xuất v15 / 2026-11-24:** Test đợt sửa module `data-view` (mục 3.28, DVT-01…DVT-12) / Người dùng duyệt plan sửa `data-view` / Thêm mục 3.28; docs trước code.
- **Đề xuất v14 (bổ sung) / 2026-11-24:** Test đợt K (mục 3.27) / Người dùng duyệt sửa lỗi K1–K5 / Thêm mục 3.27; docs trước code.
- **Điều chỉnh v14 / 2026-11-24:** Bỏ nhóm C (`it.failing`) — 25 ca chuyển sang nhóm A (14 thay đổi thiết kế được chấp nhận + 11 lỗi thật viết lại test ở mục 3.27); đặt lại mốc `local_VQD` / Người dùng chốt: đánh giá tính đúng đắn của code mới, không ép theo test logic cũ / Viết lại kết quả mục 3.26.
- **Thực hiện v14 / 2026-11-24:** Port xong 100 ca — B 48 đạt, C 25 `it.failing`, A 27 không port; `local_VQD` dựng lại bằng handler / Người dùng yêu cầu giai đoạn 3 / Điền kết quả mục 3.26.
- **Đề xuất v14 / 2026-11-24:** Port test đợt A–I module analysis sau refactor / Merge `origin/backend` làm mất 95/96 test của `Vqd_BE`; người dùng yêu cầu giai đoạn 3 (dựng lại `local_VQD` + rà test) / Thêm mục 3.26; docs trước code.

- **Hợp nhất v13 / 2026-11-24:** Hợp nhất nhánh `Vqd_BE` v12 với nhánh `backend` v9 / Merge `origin/backend` vào `Vqd_BE` (commit `131e14c`), người dùng yêu cầu đồng bộ docs (giai đoạn 2) / Gộp 3 chiều từ bản gốc chung; giữ mục của cả hai nhánh; dòng Trạng thái lấy của `backend`.
- **v9 / 2026-11-16 (Nhóm B/D/E/F/G/H — đồng bộ sau Bước 1–6):** đồng bộ toàn bộ tài liệu với mã nguồn thực thi. (1) **Ma trận 122 → 143 quy tắc** — thêm 14 quy tắc mới (`S25`–`S29`, `C16`–`C21`, `I24`–`I25`, `O37`–`O39`) và cộng lại 4 quy tắc v6 (`S24`, `I22`, `I23`, `O36`) vốn chưa được tính vào bảng tổng kết. (2) **Mục 3.11.2c mới** — bảng 5 bộ test mới (83 ca) kèm quy tắc được phủ + kết quả chạy thực tế (1 069 unit/arch + 138 integration + 70 e2e = **1 277 ca PASS**, 0 fail). (3) **Bảng mapping 3.12.1 / 3.12.3** — cập nhật **85 tính năng** (từ 79) và **84 route HTTP thực thi** (từ 85 → 90 → 84), bổ sung nhóm `overview`, `admin` 4 route, `datasets` 8 route, `analysis` 9 route. (4) **Mục 3.12.4 mới** — bảng truy vết 11 tính năng mới ↔ route ↔ file test ↔ quy tắc. (5) **Mục 3.17 viết lại** — đối chiếu bằng **số liệu đo thật** (74 file test, 1 277 ca PASS) + danh sách 5 khoảng cách còn lại. (6) **Mục 3.19 / 4 / 5** — cập nhật trạng thái và số liệu đầu ra. Nguồn: `edit/02_ke_hoach_thuc_thien.md` Bước 1–6 + Phần 2 v11 + Phần 7 v8.


- **Thực hiện đợt I / 2026-11-18:** Hoàn tất code + test / Người dùng duyệt plan đợt I / Đổi trạng thái sang đã thực hiện; điều chỉnh khi cài: kiểm tra dấu áp cho cả cột số vai trò phân loại (vd `passengers` 0–6), không chỉ cột định lượng.
- **Đề xuất v12 / 2026-11-18:** Test đợt I module analysis / Người dùng chọn tự phát hiện → Nghi vấn, không khai báo quy tắc (vá lỗi còn lại trong `local_VQD/MISSED_ERRORS*.md`) / Thêm mục 3.25; docs trước code.
- **Thực hiện đợt H / 2026-11-18:** Hoàn tất code + test / Người dùng duyệt plan đợt H / Đổi trạng thái sang đã thực hiện; điều chỉnh khi cài: sentinel đơn lẻ không xét hàng rào IQR, cột khóa của `duplicate_key` phải có ≥ 80% giá trị khác nhau, `dateOrder = null` khi cột chỉ có ngày ISO.
- **Đề xuất v11 / 2026-11-18:** Test đợt H module analysis / Người dùng vấn đáp nghiệp vụ và duyệt plan đợt H (vá lỗi bỏ sót trong `local_VQD/MISSED_ERRORS_edge-cases.md`) / Thêm mục 3.24; docs trước code.
- **Thực hiện đợt G / 2026-11-17:** Hoàn tất code + test / Người dùng duyệt plan đợt G / Đổi trạng thái sang đã thực hiện.
- **Đề xuất v10 / 2026-11-17:** Test đợt G module analysis / Người dùng vấn đáp nghiệp vụ và duyệt plan đợt G (sửa lỗi bỏ sót trong `local_VQD/MISSED_ERRORS.md`) / Thêm mục 3.23; docs trước code.
- **Thực hiện đợt F / 2026-11-17:** Hoàn tất code + test / Người dùng duyệt và yêu cầu thực thi đợt F / Đổi trạng thái sang đã thực hiện.
- **Đề xuất v9 / 2026-11-17:** Test đợt F module analysis / Người dùng duyệt plan đợt F (sửa 6 lỗi phát hiện khi demo Titanic) / Thêm mục 3.22; docs trước code.
- **Điều chỉnh / 2026-11-17:** Thêm AN-21 (tương thích hợp đồng `top_n` tối đa 100, `recommendations` giữ `string[]`) / Đồng bộ với commit `52df5b7` / Bổ sung bảng mục 3.21.
- **Thực hiện đợt D/E / 2026-11-17:** Hoàn tất code + test cho mục 3.21 / Người dùng yêu cầu thực thi D, E (sau khi commit A/B/C) / Đổi trạng thái mục 3.21 sang đã thực hiện.
- **Đề xuất đợt D/E / 2026-11-17:** Test bổ sung đợt D/E module analysis / Rà soát sau đợt A/B/C, người dùng yêu cầu ghi tiếp vào phiên bản hiện tại / Thêm mục 3.21; chờ duyệt trước khi sửa code.
- **Thực hiện / 2026-11-17:** Hoàn tất code + test cho mục 3.20 / Người dùng yêu cầu thực thi đợt A, B, C / Đổi trạng thái mục 3.20 sang đã thực hiện.
- **Đề xuất v8 / 2026-11-17:** Test bổ sung cho hoàn thiện module analysis / Rà soát code module analysis theo yêu cầu người dùng / Thêm mục 3.20; chờ duyệt trước khi sửa code.
- **v8 / 2026-11-15 (Nhóm A — keyset cursor):** `GET /workspaces` và `GET /workspaces/{workspaceId}/projects` chuyển sang keyset cursor (bỏ `page`/`total`, thêm `cursor`/`limit`, `meta` có `nextCursor`+`hasMore`+`limit`); thêm quy tắc **C14** (cursor ràng buộc theo `sort`) và **C15** (cấm `countDocuments`/`skip` cho list workspace/project); ma trận 120 → **122 quy tắc**; bộ test `test/keyset-pagination.spec.ts` (18 ca) / Theo quyết định Q0.1 (`edit/02_ke_hoach_thuc_thien.md` Nhóm A) / Cập nhật mục 3.11.2, thêm mục 3.11.2b, quy tắc 4 (bảng mapping), bảng tổng kết ma trận.
- **Yêu cầu:** Người dùng yêu cầu liệt kê toàn bộ các phần theo thứ tự thực hiện, tạo sẵn file v1, lần lượt hoàn thiện vòng đầu rồi tạo v2 khi có thay đổi tiếp theo.
- **v1 / 2026-11-02:** Tạo khung phần 13 / Chuẩn bị thảo luận tuần tự / Chỉ tạo tài liệu, chưa thực thi thay đổi backend hoặc dữ liệu.
- **v5 / 2026-11-06:** Tầng 9 nâng từ **4 model / 9 chỉ số rời** thành **5 model theo giả thuyết + 9 chỉ số trên 5 nhóm** có ngưỡng tuyệt đối, trọng số 100, kiểm định thống kê (McNemar/Wilcoxon), đường Pareto và 11 quy tắc quyết định; bỏ judge `Qwen3-32B` (vượt RAM) → chấm chéo; quyết định benchmark chọn **cặp model** cho kiến trúc định tuyến hai tầng (Phần 12 v5 mục 3.15.6) / Theo yêu cầu người dùng ngày 2026-11-06 / Cập nhật mục 3.10b.1–3.10b.2 và quyết định 15.
- **v4 / 2026-11-05:** Áp dụng 4 quyết định kiến trúc. (1) **Cursor pagination**: thêm quy tắc C9–C12 (cursor opaque, không trùng/thiếu, chống bỏ sót khi chèn dữ liệu) + quy tắc kiến trúc A15 (cấm `countDocuments`/`skip`). (2) **Kafka + Socket.IO**: thêm container Kafka vào môi trường test tầng 4; thêm quy tắc I15–I21 (publish đúng topic, DLQ, consumer group, rebalance, realtime push, notification dispatch, job AI qua Kafka); bỏ nhóm test BullMQ (I9, I10, O18, O26 chuyển sang Kafka). (3) **AI cục bộ**: quyết định 8 viết lại (luôn mock ở tầng 1–8, không bao giờ gọi network ra ngoài); thêm **Tầng 9 — Benchmark AI & học lại** (quyết định 15–17) với bộ benchmark 4 model, 9 chỉ số, quy tắc quyết định chọn model, và 7 bước test vòng lặp RAG T1. Thêm quy tắc kiến trúc A16–A18 (cấm SDK AI bên ngoài, cấm import trực tiếp engine ngoài port, cấm thư viện Excel). (4) **Chỉ `.csv`**: thêm C13, O34, A18, M27–M28. Ngoài ra: thêm S20–S23 (CSV columns, feedback append-only), M29 (2 collection feedback có index); số liệu 93 → **120 quy tắc** (112 tự động + 8 thủ công), 77 → **79 tính năng**, 62 → **66 use case**, 80 → **85 endpoint**, 34 → **48 tình huống phân quyền**, 8 → **9 tầng test**.
- **v2 / 2026-11-05:** Đồng bộ theo quyết định **dữ liệu bất biến (chỉ đọc)**. (1) Bỏ toàn bộ test cho xoá dòng, sửa ô, clean-rules, rollback phiên bản và lineage; (2) bổ sung quy tắc **S19** (ràng buộc insert-only cho `dataset_record`) và **M25–M26** (`dataset_versions` không migrate; dữ liệu sau cutover chỉ đến từ file gốc); (3) bổ sung quy tắc kiến trúc **A13–A14** (cấm route ghi dữ liệu ngoài import); (4) giảm 2 tình huống phân quyền (36 → 34) do thu hẹp quyền `PROJ-MEMBER`/`PROJ-OWNER`/`WS-OWNER`; (5) cập nhật toàn bộ số liệu: 92 → **93 quy tắc** (86 tự động + 7 thủ công), 84 → **77 tính năng**, 67 → **62 use case**, 85 → **80 endpoint**; (6) đồng bộ tham chiếu Phần 3 v3, 6 v4, 7 v2, 8 v3, 9 v2, 10 v3, 11 v2, 12 v3.
- **v1 / 2026-11-05:** Hoàn thiện vòng đầu. Chốt 14 quyết định kiểm thử; thiết kế 8 tầng test với ranh giới trách nhiệm và thứ tự chạy tối ưu; cơ chế fake port thay `jest.mock()`; `docker-compose.test.yml` với Mongo replica set + Redis + MinIO; 12 quy tắc kiến trúc A1–A12; 36 tình huống phân quyền theo 7 nhóm; **ma trận truy xuất ngược 92 quy tắc** (S/C/I/O/M) với cột tầng test và file test cụ thể; 3 bảng mapping (84 tính năng / 67 use case / 85 endpoint); ngưỡng coverage 5 nhóm theo tầng; 12 lệnh `test:*` với `test:all` là lệnh duy nhất; quy trình nghiệm thu 3 bước + gate chặn ở 4 mốc; cấu trúc báo cáo tự động 6 mục + kết luận của người; quy tắc xử lý test flaky; bảng đối chiếu code hiện tại và hệ thống tham chiếu; ước tính ~850 test / ~38 ngày công; 18 quy tắc T1–T18.
