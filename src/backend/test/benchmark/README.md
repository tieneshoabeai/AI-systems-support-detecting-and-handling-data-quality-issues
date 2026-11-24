# `test/benchmark/` — 2 file: benchmark AI thủ công (không phải Jest)

| File | Nội dung thật |
|---|---|
| `eval-set.jsonl` (2 dòng thật) | `{"id":"s0","dq":"DQ-01","label":"true_positive",...}` + `{"id":"s1","dq":"DQ-02","label":"false_positive",...}` — không phải 150–200 mẫu, chỉ là mẫu tối thiểu để chạy thử |
| `run-benchmark.mjs` (18 dòng) | Chạy: `node test/benchmark/run-benchmark.mjs --model=M1 --set=eval-set.jsonl`. Nếu thiếu set thì tự tạo 5 dòng mẫu (`s0..s4`, `DQ-01..DQ-05`). Ghi kết quả ra `docs/test-reports/benchmark-<model>-<ngày>.md` (code dùng đường dẫn tương đối `../../docs/test-reports/` tính từ cwd — chạy đúng `node test/benchmark/run-benchmark.mjs` hoặc `pnpm test:benchmark` từ `src/backend/` thì ra `docs/test-reports/` ở workspace root; chạy từ thư mục khác sẽ lệch) |

Quy tắc (ghi trong 2 dòng comment đầu file): mẫu benchmark KHÔNG nằm trong kho `feedback_example`; `temperature=0.2/top_p=0.9/seed` cố định; chạy 3 lần. Ngưỡng in ra file kết quả: F1>=0.75, JSON>=98%, ảo giác<=2%, vi>=4.0, p95<=180s, tok/s>=4, RSS<=11GB, lỗi<=2%. Hiện tại chỉ là **chạy thử** — cần engine thật + đủ 150–200 mẫu + đủ 9 chỉ số mới chốt (comment trong code: `can thay bang 150-200 mau that truoc khi chot production`).

Liên quan: `pnpm test:benchmark` + `scripts/benchmark/` (mở rộng) + `docs/test-reports/`.
