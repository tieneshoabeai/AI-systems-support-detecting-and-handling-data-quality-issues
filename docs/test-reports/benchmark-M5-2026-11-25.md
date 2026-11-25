# Benchmark M5 — mistral:7b (7B Q4_K_M)

- Ngày: 2026-11-25T15:47:09.191Z
- Họ model: mistral | Think mode: false
- Ghi chú: Nhẹ nhất, làm mốc sàn về chi phí tài nguyên.

## 9 chỉ số

| Trọng số | Chỉ số | Giá trị | Ngưỡng | Đạt |
|---|---|---|---|---|
| 30 | F1 phát hiện (micro) | 0.400 | ≥ 0.75 | ❌ |
| 10 | F1 macro theo DQ-01→DQ-05 | 0.000 | ≥ 0.7 | ❌ |
| 12 | Tỉ lệ JSON hợp lệ | 1.000 | ≥ 0.98 | ✅ |
| 10 | Tỉ lệ ảo giác (grounding) | 0.167 | ≤ 0.02 | ❌ |
| 13 | Chất lượng giải thích tiếng Việt | 3.800 | ≥ 4 | ❌ |
| 10 | p95 latency / 1 job | 59462.200 | ≤ 180000 | ✅ |
| 5 | Throughput (tok/s) | 9.600 | ≥ 4 | ✅ |
| 5 | RSS đỉnh | 3475767296.000 | ≤ 11811160064 | ✅ |
| 5 | Độ ổn định (% lỗi/retry) | 0.000 | ≤ 0.02 | ✅ |

**Ngưỡng tuyệt đối bị rớt:** f1_micro, f1_macro, hallucination_rate, explanation_quality

## Mean ± std theo lần lặp

| Lần | F1 micro | JSON | Ảo giác | p95 (ms) | tok/s | Lỗi |
|---|---|---|---|---|---|---|
| 1 | 0.400 | 1.000 | 0.167 | 59462.200 | 9.600 | 0.000 |

Thời gian chạy: 187.8s | Số lượt đo: 5

## Chi tiết mẫu

| Mẫu | Loại | Thực tế | Dự đoán | Đúng | FP | Bỏ sót | Claim | Loại bởi grounding | Điểm judge |
|---|---|---|---|---|---|---|---|---|---|
| G001 | dq | có vấn đề | không | ❌ | - | MISS | 0 | 0 | 3 |
| G002 | dq | có vấn đề | có | ✅ | - | - | 6 | 1 | 4 |
| G003 | corr | có vấn đề | không | ❌ | - | MISS | 0 | 0 | 4 |
| G004 | clean | sạch | không | ✅ | - | - | 0 | 0 | 4 |
| G005 | dq | có vấn đề | không | ❌ | - | MISS | 0 | 0 | 4 |
