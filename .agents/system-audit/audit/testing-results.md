# Testing results — Frontend

> **Snapshot lịch sử 17/11.** Cập nhật 19/11/2026 tại [frontend-api-revalidation.md](frontend-api-revalidation.md): build PASS; 402 test PASS/26 file; connected-api 13 PASS có overlap; E2E thật trước ghép 6 PASS/1 FAIL, cleanup fixture chưa retest. Health prefix đã xử lý; generated request aliases có consumer, members cursor/lifecycle đã bổ sung. Nội dung lịch sử dưới đây không thay thế trạng thái mới.


Ngày: 17/11/2026. Snapshot bổ sung: `fef6bab`. Không đổi source/test assertion/config khi chạy.

| Lượt | Phạm vi | Kết quả / diễn giải |
|---|---|---|
| Mới nhất | tsc app noEmit incremental:false | PASS |
| Mới nhất | tsc node/config noEmit incremental:false | PASS |
| Mới nhất | Vitest management + auth + foundation/api | 20 file, 315 test PASS; 32,41 giây |
| Mới nhất | ESLint fix:false 18 file | 0 error, 24 warning (22 migration, 2 indent) |
| Phase 5 | Vitest foundation/API | 1 file, 55/55 PASS, 1,51 giây; gồm empty 204; subset trùng scope 315 |
| Chưa chạy lại | Full Vitest suite và coverage | UNVERIFIED cho snapshot hiện tại |
| Chưa chạy lại | Production FE build | UNVERIFIED cho snapshot hiện tại |
| Chưa chạy | Playwright 3 demo specs trong lượt bổ sung | UNVERIFIED |
| Chưa chạy | Live FE–API E2E | UNVERIFIED; không dùng mock test thay thế |

Lint scope gồm services/management, ManagementDataProvider, ApplicationFrame, use-preview-store, use-preview-session, Axios client, api.types, ProjectWizard, project-data-actions và management tests. Đây không phải full repo lint.

Các test mới nhất thay ApiClient/Axios adapter hoặc store port; provider/UI/store thực trong một số integration tests nhưng API server không thực. Case có ý nghĩa: online error không lộ fixture; rotated token/account mismatch; không publish load cũ sau session end; CSV file thật trong FormData; partial upload retry; write rejection không fake success; email/member role preflight.

Lịch sử trước khi source FE được cập nhật: full suite 863 pass/1 timeout trên 864 tests, file đó rerun riêng 25/25 pass; coverage statements 69,78%, branches 63,10%, functions 69,61%, lines 70,83%. **Chỉ là lịch sử**, không phải coverage của `fef6bab`. Report tại `validation/frontend-coverage/coverage-summary.json` thuộc lượt cũ. Cảnh báo canvas/jsdom hoặc Three CJS không phải WebGL visual verification.

Kết quả BE của phase cũ không được đưa vào báo cáo FE này. Không có screenshot/performance capture mới, không có số E2E live pass hoặc SLA được tự tạo.

Chi tiết phương pháp và testing pyramid: [chương VI](../06-software-testing.md).
