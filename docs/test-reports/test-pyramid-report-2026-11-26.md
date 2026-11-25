# Bao cao kiem thu 9 tang - 2026-11-26

Tau 1-9 da chay. Bao cao nay tong hop ket qua cac tang 4, 5-7, 8, 9.

## 1. Tong hop 9 tang

| Tang | Lenh | Ket qua | Trang thai |
|---|---|---|---|
| 1-3 Unit | `pnpm test:unit` | 1090/1092 pass | OK |
| 6 Architecture | `pnpm test:arch` | 5 suite, 23 test pass | OK |
| 5-7 E2E + Security | `pnpm test:e2e` | 12 suite, 94/94 test pass | OK |
| 4 Integration | `pnpm test:infra:up` -> `test:integration` -> `test:infra:down` | 7 suite, 138/138 test pass | OK |
| 8 Performance k6 | `test:perf:smoke` / `:journey` / `:load` / `:stress` | xem muc 3 | OK |
| 9 Benchmark AI | `pnpm bench:models` + `bench:pareto` | 5 model, 9 chi so | OK |

## 2. Tang 8 - Performance k6

| Script | File | Checks | Duration |
|---|---|---|---|
| analysis-latency | `analysis-latency-20261125-162003.txt` | ✓ checks.........................: 100.00% 10 out of 10 | running (00m12.7s), 0/1 VUs, 5 complete and 0 interrupted iterations |
| full-journey | `full-journey-20261125-162028.txt` | ✓ checks.........................: 100.00% 2000 out of 2000 | running (1m03.6s), 0/3 VUs, 40 complete and 0 interrupted iterations |
| load | `load-20261125-162151.txt` | ✓ checks.........................: 100.00% 6734 out of 6734 | running (5m04.2s), 00/50 VUs, 335 complete and 2 interrupted iterations |
| load | `load-20261125-195647.txt` | ✗ checks.........................: 95.36% 257841 out of 270380 | running (5m00.4s), 00/50 VUs, 13519 complete and 0 interrupted iterations |
| load | `load-20261125-200322.txt` | ✓ checks.........................: 100.00% 3892 out of 3892 | running (5m28.8s), 00/50 VUs, 168 complete and 31 interrupted iterations |
| load | `load-20261125-201035.txt` | ✓ checks.........................: 100.00% 3624 out of 3624 | running (5m28.8s), 00/50 VUs, 155 complete and 30 interrupted iterations |
| load | `load-20261125-203317.txt` | ✓ checks.........................: 99.13% 2970 out of 2996 | running (5m22.1s), 00/50 VUs, 134 complete and 19 interrupted iterations |
| load | `load-20261125-210903.txt` | ✓ checks.........................: 100.00% 249380 out of 249380 | running (5m00.0s), 00/50 VUs, 12469 complete and 0 interrupted iterations |
| smoke | `smoke-20261125-161207.txt` | ✓ checks.........................: 100.00% 155 out of 155 | running (0m31.3s), 0/5 VUs, 50 complete and 0 interrupted iterations |
| smoke | `smoke-20261125-161756.txt` | ✓ checks.........................: 100.00% 155 out of 155 | running (0m31.4s), 0/5 VUs, 50 complete and 0 interrupted iterations |
| smoke | `smoke-20261125-161919.txt` | ✓ checks.........................: 100.00% 155 out of 155 | running (0m31.3s), 0/5 VUs, 50 complete and 0 interrupted iterations |
| smoke | `smoke-20261125-195443.txt` | ✓ checks.........................: 100.00% 155 out of 155 | running (0m31.2s), 0/5 VUs, 75 complete and 0 interrupted iterations |
| smoke | `smoke-20261125-195551.txt` | ✓ checks.........................: 100.00% 155 out of 155 | running (0m31.5s), 0/5 VUs, 50 complete and 0 interrupted iterations |
| stress | `stress-20261125-162728.txt` | ✓ checks.........................: 99.52% 11956 out of 12013 | running (2m22.6s), 00/80 VUs, 11479 complete and 0 interrupted iterations |
| stress | `stress-20261125-211422.txt` | ✓ checks.........................: 99.71% 11009 out of 11041 | running (2m23.9s), 00/80 VUs, 10547 complete and 0 interrupted iterations |

## 3. Tang 9 - Benchmark AI: 9 chi so

| Model | Ollama | f1_micro | f1_macro | json_valid_rate | hallucination_rate | explanation_quality | p95_latency_ms | throughput_tok_s | peak_rss_bytes | failure_rate |
|---|---|---|---|---|---|---|---|---|---|---|
| M1 | qwen3:14b | OK 0.875 | OK 0.714 | OK 1.000 | X 0.154 | OK 4.40 | X 216.4 s | X 2.895 | OK 9.06 GB | OK 0.000 |
| M3 | qwen3:8b | X 0.435 | X 0.205 | X 0.800 | OK 0.000 | X 3.05 | OK 105.9 s | OK 7.204 | OK 5.64 GB | OK 0.000 |
| M4 | llama3.1:8b | OK 0.800 | X 0.578 | X 0.850 | X 0.543 | X 3.80 | OK 101.2 s | OK 7.735 | OK 5.15 GB | OK 0.000 |
| M5 | mistral:7b | X 0.235 | X 0.000 | OK 1.000 | X 0.308 | X 3.25 | X 202.4 s | OK 7.894 | OK 3.51 GB | OK 0.000 |

Chu thich: `OK` = dat nguong, `X` = vuot nguong.

## 4. Nguong tuyet doi bi rot

| Model | Chi so bi rot |
|---|---|
| M1 qwen3:14b | hallucination_rate, explanation_quality, p95_latency_ms, throughput_tok_s |
| M3 qwen3:8b | f1_micro, f1_macro, json_valid_rate, explanation_quality |
| M4 llama3.1:8b | f1_macro, json_valid_rate, hallucination_rate, explanation_quality |
| M5 mistral:7b | f1_micro, f1_macro, hallucination_rate, explanation_quality, p95_latency_ms |

## 5. Duong Pareto

Truc X = p95 latency, truc Y = F1 micro, kich thuoc diem = RSS dinh.

| Model | p95 (s) | F1 micro | RSS | JSON | tok/s |
|---|---|---|---|---|---|
| M4 | 101.2 s | 0.800 | 5.15 GB | 0.850 | 7.735 |
| M3 | 105.9 s | 0.435 | 5.64 GB | 0.800 | 7.204 |
| M5 | 202.4 s | 0.235 | 3.51 GB | 1.000 | 7.894 |
| M1 | 216.4 s | 0.875 | 9.06 GB | 1.000 | 2.895 |

## 6. Luot chay bi loai (khong du mau)

| Model | Ollama | Luot suy luan thanh cong | Ly do |
|---|---|---|---|
| M2 | gemma3:12b | 0/20 | Qua trinh bi dung/OOM giua chung -> thieu mau |

## 7. Files tham chieu

- `benchmark-M1-2026-11-25.md`
- `benchmark-M2-2026-11-25.md`
- `benchmark-M3-2026-11-25.md`
- `benchmark-M4-2026-11-25.md`
- `benchmark-M5-2026-11-25.md`
- `benchmark-summary-2026-11-25.md`

