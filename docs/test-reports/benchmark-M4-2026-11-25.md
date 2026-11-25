# Benchmark M4 — llama3.1:8b (8B Q4_K_M)

- Ngày: 2026-11-25T18:36:25.269Z
- Họ model: llama3 | Think mode: false
- Ghi chú: Họ khác tokenizer — kiểm tra chi phí chuyển đổi token.

## 9 chỉ số

| Trọng số | Chỉ số | Giá trị | Ngưỡng | Đạt |
|---|---|---|---|---|
| 30 | F1 phát hiện (micro) | 0.800 | ≥ 0.75 | ✅ |
| 10 | F1 macro theo DQ-01→DQ-05 | 0.578 | ≥ 0.7 | ❌ |
| 12 | Tỉ lệ JSON hợp lệ | 0.850 | ≥ 0.98 | ❌ |
| 10 | Tỉ lệ ảo giác (grounding) | 0.543 | ≤ 0.02 | ❌ |
| 13 | Chất lượng giải thích tiếng Việt | 3.800 | ≥ 4 | ❌ |
| 10 | p95 latency / 1 job | 101220.250 | ≤ 180000 | ✅ |
| 5 | Throughput (tok/s) | 7.735 | ≥ 4 | ✅ |
| 5 | RSS đỉnh | 5533016064.000 | ≤ 11811160064 | ✅ |
| 5 | Độ ổn định (% lỗi/retry) | 0.000 | ≤ 0.02 | ✅ |

**Ngưỡng tuyệt đối bị rớt:** f1_macro, json_valid_rate, hallucination_rate, explanation_quality

## Mean ± std theo lần lặp

| Lần | F1 micro | JSON | Ảo giác | p95 (ms) | tok/s | Lỗi |
|---|---|---|---|---|---|---|
| 1 | 0.800 | 0.850 | 0.543 | 101220.250 | 7.735 | 0.000 |

Thời gian chạy: 1336.3s | Số lượt đo: 20

> ⚠️ **3/20 lượt bị Ollama cắt cụt** (`done_reason=length`) → JSON không parse được. Cần tăng `num_predict` (hiện 640).

## Chi tiết mẫu

| Mẫu | Loại | Thực tế | Dự đoán | Đúng | FP | Bỏ sót | Claim | Loại bởi grounding | Điểm judge |
|---|---|---|---|---|---|---|---|---|---|
| G001 | dq | có vấn đề | có | ✅ | - | - | 2 | 3 | 4 |
| G002 | dq | có vấn đề | có | ✅ | - | - | 15 | 9 | 5 |
| G003 | corr | có vấn đề | có | ✅ | - | - | 5 | 6 | 3 |
| G004 | clean | sạch | không | ✅ | - | - | 0 | 0 | 3 |
| G005 | dq | có vấn đề | có | ✅ | - | - | 12 | 5 | 5 |
| G006 | dq | có vấn đề | có | ✅ | - | - | 2 | 2 | 4 |
| G007 | corr | có vấn đề | không | ❌ | - | MISS | 0 | 0 | 3 |
| G008 | corr | có vấn đề | có | ✅ | - | - | 13 | 1 | 5 |
| G009 | corr | có vấn đề | có | ✅ | - | - | 6 | 1 | 5 |
| G010 | dq | có vấn đề | có | ✅ | - | - | 12 | 4 | 4 |
| G011 | clean | sạch | có | ❌ | FP | - | 9 | 6 | 3 |
| G012 | corr | có vấn đề | không | ❌ | - | MISS | 0 | 0 | 3 |
| G013 | corr | có vấn đề | có | ✅ | - | - | 10 | 2 | 3 |
| G014 | corr | có vấn đề | có | ✅ | - | - | 9 | 1 | 4 |
| G015 | clean | sạch | không | ✅ | - | - | 0 | 0 | 3 |
| G016 | corr | sạch | có | ❌ | FP | - | 6 | 9 | 4 |
| G017 | dq | có vấn đề | có | ✅ | - | - | 2 | 2 | 4 |
| G018 | clean | sạch | có | ❌ | FP | - | 7 | 7 | 4 |
| G019 | corr | có vấn đề | có | ✅ | - | - | 4 | 1 | 4 |
| G020 | clean | sạch | có | ❌ | FP | - | 2 | 4 | 3 |
