# Tổng hợp benchmark 5 model AI — 2026-11-25

- Số mẫu vàng: 20
- Phân bổ loại mẫu: {"dq":6,"corr":9,"clean":5}
- Phân bổ mức ảnh hưởng: {"low":2,"medium":3,"high":1}
- Mẫu bẫy: {"missed_issue":2,"false_positive":5}

## Điểm 9 chỉ số

| Model | f1_micro | f1_macro | json_valid_rate | hallucination_rate | explanation_quality | p95_latency_ms | throughput_tok_s | peak_rss_bytes | failure_rate | Rớt ngưỡng |
|---|---|---|---|---|---|---|---|---|---|---|
| M5 mistral:7b | 0.235 | 0.000 | 1.000 | 0.308 | 3.250 | 202414.100 | 7.894 | 3771449344.000 | 0.000 | f1_micro, f1_macro, hallucination_rate, explanation_quality, p95_latency_ms |

## Ngưỡng tuyệt đối

| Chỉ số | Ngưỡng | Trọng số |
|---|---|---|
| F1 phát hiện (micro) | ≥ 0.75 | 30 |
| F1 macro theo DQ-01→DQ-05 | ≥ 0.7 | 10 |
| Tỉ lệ JSON hợp lệ | ≥ 0.98 | 12 |
| Tỉ lệ ảo giác (grounding) | ≤ 0.02 | 10 |
| Chất lượng giải thích tiếng Việt | ≥ 4 | 13 |
| p95 latency / 1 job | ≤ 180000 | 10 |
| Throughput (tok/s) | ≥ 4 | 5 |
| RSS đỉnh | ≤ 11811160064 | 5 |
| Độ ổn định (% lỗi/retry) | ≤ 0.02 | 5 |

## Báo cáo từng model

- benchmark-M5-2026-11-25.md

## Đường Pareto

Trục X = p95 latency (ms), trục Y = F1 micro, kích thước điểm = RSS đỉnh.

| Model | p95 (ms) | F1 micro | RSS |
|---|---|---|---|
| M5 | 202414.100 | 0.235 | 3.51GB |