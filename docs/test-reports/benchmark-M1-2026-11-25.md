# Benchmark M1 — qwen3:14b (14B Q4_K_M)

- Ngày: 2026-11-25T16:31:07.905Z
- Họ model: qwen3 | Think mode: false
- Ghi chú: Ứng viên chính của hướng A (bật/tắt thinking mode).

## 9 chỉ số

| Trọng số | Chỉ số | Giá trị | Ngưỡng | Đạt |
|---|---|---|---|---|
| 30 | F1 phát hiện (micro) | 0.875 | ≥ 0.75 | ✅ |
| 10 | F1 macro theo DQ-01→DQ-05 | 0.714 | ≥ 0.7 | ✅ |
| 12 | Tỉ lệ JSON hợp lệ | 1.000 | ≥ 0.98 | ✅ |
| 10 | Tỉ lệ ảo giác (grounding) | 0.154 | ≤ 0.02 | ❌ |
| 13 | Chất lượng giải thích tiếng Việt | 4.400 | ≥ 4 | ✅ |
| 10 | p95 latency / 1 job | 216365.900 | ≤ 180000 | ❌ |
| 5 | Throughput (tok/s) | 2.895 | ≥ 4 | ❌ |
| 5 | RSS đỉnh | 9726763008.000 | ≤ 11811160064 | ✅ |
| 5 | Độ ổn định (% lỗi/retry) | 0.000 | ≤ 0.02 | ✅ |

**Ngưỡng tuyệt đối bị rớt:** hallucination_rate, explanation_quality, p95_latency_ms, throughput_tok_s

## Mean ± std theo lần lặp

| Lần | F1 micro | JSON | Ảo giác | p95 (ms) | tok/s | Lỗi |
|---|---|---|---|---|---|---|
| 1 | 0.875 | 1.000 | 0.154 | 216365.900 | 2.895 | 0.000 |

Thời gian chạy: 2258.8s | Số lượt đo: 20

## Chi tiết mẫu

| Mẫu | Loại | Thực tế | Dự đoán | Đúng | FP | Bỏ sót | Claim | Loại bởi grounding | Điểm judge |
|---|---|---|---|---|---|---|---|---|---|
| G001 | dq | có vấn đề | có | ✅ | - | - | 0 | 0 | 5 |
| G002 | dq | có vấn đề | có | ✅ | - | - | 0 | 0 | 4 |
| G003 | corr | có vấn đề | có | ✅ | - | - | 5 | 2 | 3 |
| G004 | clean | sạch | có | ❌ | FP | - | 0 | 0 | 5 |
| G005 | dq | có vấn đề | có | ✅ | - | - | 0 | 0 | 4 |
| G006 | dq | có vấn đề | có | ✅ | - | - | 2 | 0 | 5 |
| G007 | corr | có vấn đề | có | ✅ | - | - | 3 | 0 | 5 |
| G008 | corr | có vấn đề | có | ✅ | - | - | 3 | 0 | 5 |
| G009 | corr | có vấn đề | có | ✅ | - | - | 3 | 0 | 5 |
| G010 | dq | có vấn đề | có | ✅ | - | - | 5 | 0 | 4 |
| G011 | clean | sạch | không | ✅ | - | - | 0 | 1 | 3 |
| G012 | corr | có vấn đề | có | ✅ | - | - | 3 | 0 | 5 |
| G013 | corr | có vấn đề | có | ✅ | - | - | 3 | 0 | 4 |
| G014 | corr | có vấn đề | có | ✅ | - | - | 3 | 0 | 5 |
| G015 | clean | sạch | có | ❌ | FP | - | 0 | 0 | 5 |
| G016 | corr | sạch | có | ❌ | FP | - | 0 | 0 | 5 |
| G017 | dq | có vấn đề | có | ✅ | - | - | 6 | 3 | 4 |
| G018 | clean | sạch | có | ❌ | FP | - | 0 | 0 | 5 |
| G019 | corr | có vấn đề | có | ✅ | - | - | 3 | 0 | 4 |
| G020 | clean | sạch | không | ✅ | - | - | 0 | 0 | 3 |
