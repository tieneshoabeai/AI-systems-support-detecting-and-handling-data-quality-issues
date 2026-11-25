# Benchmark M5 — mistral:7b (7B Q4_K_M)

- Ngày: 2026-11-25T21:19:53.408Z
- Họ model: mistral | Think mode: false
- Ghi chú: Nhẹ nhất, làm mốc sàn về chi phí tài nguyên.

## 9 chỉ số

| Trọng số | Chỉ số | Giá trị | Ngưỡng | Đạt |
|---|---|---|---|---|
| 30 | F1 phát hiện (micro) | 0.235 | ≥ 0.75 | ❌ |
| 10 | F1 macro theo DQ-01→DQ-05 | 0.000 | ≥ 0.7 | ❌ |
| 12 | Tỉ lệ JSON hợp lệ | 1.000 | ≥ 0.98 | ✅ |
| 10 | Tỉ lệ ảo giác (grounding) | 0.308 | ≤ 0.02 | ❌ |
| 13 | Chất lượng giải thích tiếng Việt | 3.250 | ≥ 4 | ❌ |
| 10 | p95 latency / 1 job | 202414.100 | ≤ 180000 | ❌ |
| 5 | Throughput (tok/s) | 7.894 | ≥ 4 | ✅ |
| 5 | RSS đỉnh | 3771449344.000 | ≤ 11811160064 | ✅ |
| 5 | Độ ổn định (% lỗi/retry) | 0.000 | ≤ 0.02 | ✅ |

**Ngưỡng tuyệt đối bị rớt:** f1_micro, f1_macro, hallucination_rate, explanation_quality, p95_latency_ms

## Mean ± std theo lần lặp

| Lần | F1 micro | JSON | Ảo giác | p95 (ms) | tok/s | Lỗi |
|---|---|---|---|---|---|---|
| 1 | 0.235 | 1.000 | 0.308 | 202414.100 | 7.894 | 0.000 |

Thời gian chạy: 1953.7s | Số lượt đo: 20

## Chi tiết mẫu

| Mẫu | Loại | Thực tế | Dự đoán | Đúng | FP | Bỏ sót | Claim | Loại bởi grounding | Điểm judge |
|---|---|---|---|---|---|---|---|---|---|
| G001 | dq | có vấn đề | không | ❌ | - | MISS | 0 | 0 | 3 |
| G002 | dq | có vấn đề | có | ✅ | - | - | 5 | 1 | 4 |
| G003 | corr | có vấn đề | không | ❌ | - | MISS | 0 | 0 | 3 |
| G004 | clean | sạch | không | ✅ | - | - | 0 | 0 | 3 |
| G005 | dq | có vấn đề | không | ❌ | - | MISS | 0 | 0 | 4 |
| G006 | dq | có vấn đề | không | ❌ | - | MISS | 0 | 0 | 4 |
| G007 | corr | có vấn đề | không | ❌ | - | MISS | 0 | 0 | 3 |
| G008 | corr | có vấn đề | không | ❌ | - | MISS | 0 | 0 | 3 |
| G009 | corr | có vấn đề | không | ❌ | - | MISS | 0 | 0 | 3 |
| G010 | dq | có vấn đề | có | ✅ | - | - | 7 | 1 | 4 |
| G011 | clean | sạch | không | ✅ | - | - | 0 | 0 | 3 |
| G012 | corr | có vấn đề | không | ❌ | - | MISS | 0 | 0 | 3 |
| G013 | corr | có vấn đề | không | ❌ | - | MISS | 0 | 0 | 3 |
| G014 | corr | có vấn đề | không | ❌ | - | MISS | 0 | 0 | 3 |
| G015 | clean | sạch | không | ✅ | - | - | 0 | 0 | 3 |
| G016 | corr | sạch | có | ❌ | FP | - | 1 | 2 | 3 |
| G017 | dq | có vấn đề | không | ❌ | - | MISS | 0 | 0 | 4 |
| G018 | clean | sạch | không | ✅ | - | - | 0 | 0 | 3 |
| G019 | corr | có vấn đề | không | ❌ | - | MISS | 0 | 0 | 3 |
| G020 | clean | sạch | không | ✅ | - | - | 0 | 0 | 3 |
