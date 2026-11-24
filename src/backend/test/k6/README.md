# `test/k6/` — 5 script tải trọng (k6, không phải Jest)

k6 không chạy trong `pnpm test`. Chạy riêng khi cần đo hiệu năng staging/local. Triết lý ngưỡng chung (ghi trong đầu mỗi file): **401/403/404/429 là kết quả đúng** (thiếu token/dữ liệu/dính rate-limit) → chỉ fail khi **5xx** hoặc `checks` rớt dưới ngưỡng.

## Chạy (chép từ `package.json`)

```bash
pnpm test:perf          # smoke + journey + load + stress (không gồm latency)
pnpm test:perf:smoke     # k6 run test/k6/smoke.js
pnpm test:perf:journey   # k6 run test/k6/full-journey.js
pnpm test:perf:load      # k6 run test/k6/load.js
pnpm test:perf:stress    # k6 run test/k6/stress.js
pnpm test:perf:latency   # k6 run test/k6/analysis-latency.js (riêng)
pnpm test:perf:staging   # bash scripts/perf-report.sh
```

Biến môi trường: `API_BASE` (mặc định `http://localhost:3000/api/v1`), `STAGING_TOKEN`, `WORKSPACE_ID/PROJECT_ID/DATASET_ID/ANALYSIS_ID`, `ITERATIONS` (riêng latency, mặc định 5).

## Từng script — số chép từ `thresholds` thật trong code

| File | Cấu hình thật | Ngưỡng thật trong code |
|---|---|---|
| `smoke.js` (69 dòng) | 5 VU, 30s: health/login/workspaces/records | `checks rate>0.99`, `health p95<100`, `login p95<500`, `workspaces p95<500`, `records p95<1000` |
| `full-journey.js` (156 dòng) | 3 VU, 1m full 84 endpoint: health→auth→ws→prj→ds→dataview→analysis→issues→feedback→notif→overview | `checks rate>0.99`, `health p95<200`, `auth/ws/prj/issues/feedback/notif/overview p95<800`, `datasets p95<1200`, `dataview p95<1500`, `analysis p95<9000` |
| `load.js` (63 dòng) | ramp 0→20 VU (1m) → 50 VU (3m) → 0 (1m). Chỉ GET đọc (không tạo rác): ws/prj/dataview/overview/notif/issues | `checks rate>0.99`, `ws/prj/overview/notif p95<1000`, `dataview p95<2000` |
| `stress.js` (124 dòng, chỉ staging) | 3 scenario song song: `read_records` 50 VU 2m + `upload_10mb` 20 VU 2m (start 10s) + `dq01_50k` 10 VU 2m (start 20s) | `checks rate>0.98` (không phải 0.99), `read_records p95<2000`, `dq01_50k p95<120000`. Không đặt ngưỡng cho `upload_10mb` |
| `analysis-latency.js` (65 dòng) | 1 VU x `ITERATIONS` (mặc định 5), `POST /projects/:id/analysis` đơn lẻ | `checks rate>0.99`, `http_req_duration p95<8000` cho 100k dòng — đây mới là ngưỡng nghiệp vụ đúng |

Hiểu lầm hay gặp (ghi ngay trong comment đầu `stress.js`): p95 cao ở `stress.js` không có nghĩa là hỏng — do 10 VU xếp hàng trên Node đơn luồng (độ trễ đơn ~6.4s × 10 → p95 ~64s). Muốn biết 1 request mất bao lâu thì đọc `analysis-latency.js`. GĐ12: vượt `ANALYSIS_MAX_CONCURRENCY` thì API trả **429 + `Retry-After`** — đó là kết quả đúng, không phải lỗi.
