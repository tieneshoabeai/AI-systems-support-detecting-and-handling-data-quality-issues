# Benchmark M3 — qwen3:8b (8B Q4_K_M)

- Ngày: 2026-11-25T18:09:29.210Z
- Họ model: qwen3 | Think mode: false
- Ghi chú: Nhẹ nhất trong họ Qwen3.

## 9 chỉ số

| Trọng số | Chỉ số | Giá trị | Ngưỡng | Đạt |
|---|---|---|---|---|
| 30 | F1 phát hiện (micro) | 0.435 | ≥ 0.75 | ❌ |
| 10 | F1 macro theo DQ-01→DQ-05 | 0.205 | ≥ 0.7 | ❌ |
| 12 | Tỉ lệ JSON hợp lệ | 0.800 | ≥ 0.98 | ❌ |
| 10 | Tỉ lệ ảo giác (grounding) | 0.000 | ≤ 0.02 | ✅ |
| 13 | Chất lượng giải thích tiếng Việt | 3.050 | ≥ 4 | ❌ |
| 10 | p95 latency / 1 job | 105909.150 | ≤ 180000 | ✅ |
| 5 | Throughput (tok/s) | 7.204 | ≥ 4 | ✅ |
| 5 | RSS đỉnh | 6060072960.000 | ≤ 11811160064 | ✅ |
| 5 | Độ ổn định (% lỗi/retry) | 0.000 | ≤ 0.02 | ✅ |

**Ngưỡng tuyệt đối bị rớt:** f1_micro, f1_macro, json_valid_rate, explanation_quality

## Mean ± std theo lần lặp

| Lần | F1 micro | JSON | Ảo giác | p95 (ms) | tok/s | Lỗi |
|---|---|---|---|---|---|---|
| 1 | 0.435 | 0.800 | 0.000 | 105909.150 | 7.204 | 0.000 |

Thời gian chạy: 1225.6s | Số lượt đo: 20

> ⚠️ **4/20 lượt bị Ollama cắt cụt** (`done_reason=length`) → JSON không parse được. Cần tăng `num_predict` (hiện 640).

## Chi tiết mẫu

| Mẫu | Loại | Thực tế | Dự đoán | Đúng | FP | Bỏ sót | Claim | Loại bởi grounding | Điểm judge |
|---|---|---|---|---|---|---|---|---|---|
| G001 | dq | có vấn đề | không | ❌ | - | MISS | 0 | 0 | 3 |
| G002 | dq | có vấn đề | không | ❌ | - | MISS | 0 | 0 | 4 |
| G003 | corr | có vấn đề | có | ✅ | - | - | 2 | 0 | 3 |
| G004 | clean | sạch | không | ✅ | - | - | 0 | 0 | 3 |
| G005 | dq | có vấn đề | không | ❌ | - | MISS | 0 | 0 | 4 |
| G006 | dq | có vấn đề | không | ❌ | - | MISS | 0 | 0 | 4 |
| G007 | corr | có vấn đề | có | ✅ | - | - | 3 | 0 | 3 |
| G008 | corr | có vấn đề | không | ❌ | - | MISS | 0 | 0 | 3 |
| G009 | corr | có vấn đề | có | ✅ | - | - | 2 | 0 | 3 |
| G010 | dq | có vấn đề | không | ❌ | - | MISS | 0 | 0 | 4 |
| G011 | clean | sạch | có | ❌ | FP | - | 0 | 0 | 4 |
| G012 | corr | có vấn đề | không | ❌ | - | MISS | 0 | 0 | 2 |
| G013 | corr | có vấn đề | không | ❌ | - | MISS | 0 | 0 | 2 |
| G014 | corr | có vấn đề | có | ✅ | - | - | 2 | 0 | 4 |
| G015 | clean | sạch | có | ❌ | FP | - | 2 | 0 | 2 |
| G016 | corr | sạch | không | ✅ | - | - | 0 | 0 | 2 |
| G017 | dq | có vấn đề | có | ✅ | - | - | 0 | 0 | 3 |
| G018 | clean | sạch | có | ❌ | FP | - | 0 | 0 | 3 |
| G019 | corr | có vấn đề | không | ❌ | - | MISS | 0 | 0 | 2 |
| G020 | clean | sạch | có | ❌ | FP | - | 0 | 0 | 3 |
