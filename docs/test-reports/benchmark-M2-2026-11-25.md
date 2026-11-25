# Benchmark M2 — gemma3:12b (12B Q4_K_M)

- Ngày: 2026-11-25T20:01:37.644Z
- Họ model: gemma3 | Think mode: false
- Ghi chú: Gemma-3-12B-IT, import từ GGUF HuggingFace (Ollama Registry trả 412).

## 9 chỉ số

| Trọng số | Chỉ số | Giá trị | Ngưỡng | Đạt |
|---|---|---|---|---|
| 30 | F1 phát hiện (micro) | 0.000 | ≥ 0.75 | ❌ |
| 10 | F1 macro theo DQ-01→DQ-05 | 0.000 | ≥ 0.7 | ❌ |
| 12 | Tỉ lệ JSON hợp lệ | 0.000 | ≥ 0.98 | ❌ |
| 10 | Tỉ lệ ảo giác (grounding) | 0.000 | ≤ 0.02 | ✅ |
| 13 | Chất lượng giải thích tiếng Việt | n/a | ≥ 4 | n/a |
| 10 | p95 latency / 1 job | 14966.600 | ≤ 180000 | ✅ |
| 5 | Throughput (tok/s) | n/a | ≥ 4 | n/a |
| 5 | RSS đỉnh | n/a | ≤ 11811160064 | n/a |
| 5 | Độ ổn định (% lỗi/retry) | 1.000 | ≤ 0.02 | ❌ |

**Ngưỡng tuyệt đối bị rớt:** f1_micro, f1_macro, json_valid_rate, explanation_quality, throughput_tok_s, peak_rss_bytes, failure_rate

## Mean ± std theo lần lặp

| Lần | F1 micro | JSON | Ảo giác | p95 (ms) | tok/s | Lỗi |
|---|---|---|---|---|---|---|
| 1 | 0.000 | 0.000 | 0.000 | 14966.600 | n/a | 1.000 |

Thời gian chạy: 280.6s | Số lượt đo: 20

## Chi tiết mẫu

| Mẫu | Loại | Thực tế | Dự đoán | Đúng | FP | Bỏ sót | Claim | Loại bởi grounding | Điểm judge |
|---|---|---|---|---|---|---|---|---|---|
| G001 | dq | có vấn đề | không | ❌ | - | MISS | 0 | 0 | - |
| G002 | dq | có vấn đề | không | ❌ | - | MISS | 0 | 0 | - |
| G003 | corr | có vấn đề | không | ❌ | - | MISS | 0 | 0 | - |
| G004 | clean | sạch | không | ✅ | - | - | 0 | 0 | - |
| G005 | dq | có vấn đề | không | ❌ | - | MISS | 0 | 0 | - |
| G006 | dq | có vấn đề | không | ❌ | - | MISS | 0 | 0 | - |
| G007 | corr | có vấn đề | không | ❌ | - | MISS | 0 | 0 | - |
| G008 | corr | có vấn đề | không | ❌ | - | MISS | 0 | 0 | - |
| G009 | corr | có vấn đề | không | ❌ | - | MISS | 0 | 0 | - |
| G010 | dq | có vấn đề | không | ❌ | - | MISS | 0 | 0 | - |
| G011 | clean | sạch | không | ✅ | - | - | 0 | 0 | - |
| G012 | corr | có vấn đề | không | ❌ | - | MISS | 0 | 0 | - |
| G013 | corr | có vấn đề | không | ❌ | - | MISS | 0 | 0 | - |
| G014 | corr | có vấn đề | không | ❌ | - | MISS | 0 | 0 | - |
| G015 | clean | sạch | không | ✅ | - | - | 0 | 0 | - |
| G016 | corr | sạch | không | ✅ | - | - | 0 | 0 | - |
| G017 | dq | có vấn đề | không | ❌ | - | MISS | 0 | 0 | - |
| G018 | clean | sạch | không | ✅ | - | - | 0 | 0 | - |
| G019 | corr | có vấn đề | không | ❌ | - | MISS | 0 | 0 | - |
| G020 | clean | sạch | không | ✅ | - | - | 0 | 0 | - |

## Lỗi ghi nhận

| # | Lỗi |
|---|---|
| 1 | an error was encountered while running the model: unexpected EOF |
| 2 | an error was encountered while running the model: unexpected EOF |
| 3 | an error was encountered while running the model: unexpected EOF |
| 4 | an error was encountered while running the model: unexpected EOF |
| 5 | connect ECONNREFUSED 127.0.0.1:11434 |
| 6 | connect ECONNREFUSED 127.0.0.1:11434 |
| 7 | connect ECONNREFUSED 127.0.0.1:11434 |
| 8 | connect ECONNREFUSED 127.0.0.1:11434 |
| 9 | connect ECONNREFUSED 127.0.0.1:11434 |
| 10 | connect ECONNREFUSED 127.0.0.1:11434 |
| 11 | connect ECONNREFUSED 127.0.0.1:11434 |
| 12 | connect ECONNREFUSED 127.0.0.1:11434 |
| 13 | connect ECONNREFUSED 127.0.0.1:11434 |
| 14 | connect ECONNREFUSED 127.0.0.1:11434 |
| 15 | connect ECONNREFUSED 127.0.0.1:11434 |
| 16 | connect ECONNREFUSED 127.0.0.1:11434 |
| 17 | connect ECONNREFUSED 127.0.0.1:11434 |
| 18 | connect ECONNREFUSED 127.0.0.1:11434 |
| 19 | connect ECONNREFUSED 127.0.0.1:11434 |
| 20 | connect ECONNREFUSED 127.0.0.1:11434 |
