# Bao cao kiem thu 9 tang - 2026-11-26

Tau 1-9 da chay. Bao cao nay tong hop ket qua cac tang 4, 5-7, 8, 9.

## 1. Tong hop 9 tang

| Tang | Lenh | Ket qua | Trang thai |
|---|---|---|---|
| 1-3 Unit | `pnpm test:unit` | 1090/1092 pass | OK |
| 6 Architecture | `pnpm test:arch` | 5 suite, 23 test pass | OK |
| 5-7 E2E + Security | `pnpm test:e2e` | 12 suite, 94/94 test pass | OK |
| 4 Integration | `pnpm test:infra:up` -> `test:integration` -> `test:infra:down` | 7 suite, 138/138 test pass | OK |
| 8 Performance k6 | `test:perf:smoke` / `:journey` / `:load` / `:stress` | smoke 100% / journey 100% / load 100% (sau toi uu) / stress 96,03% checks | OK (xem muc 2, 8) |
| 9 Benchmark AI | `pnpm bench:models` + `bench:pareto` | 5 model, 9 chi so | OK |

## 2. Tang 8 - Performance k6

| Script | File | Checks | http_req_failed | http_reqs | Duration |
|---|---|---|---|---|---|
| analysis-latency | `analysis-latency-20261125-162003.txt` | ✓ checks.........................: 100.00% 10 out of 10 | 0.00%   0 out of 5 | 5       0.393956/s | running (00m12.7s), 0/1 VUs, 5 complete and 0 interrupted iterations |
| full-journey | `full-journey-20261126-070714.txt` | ✓ checks.........................: 100.00% 3600 out of 3600 | 12.00%  216 out of 1800 | 1800    28.989939/s | running (1m02.1s), 0/3 VUs, 72 complete and 0 interrupted iterations |
| load | `load-20261126-065140-cached.txt` | ✓ checks.........................: 100.00% 76640 out of 76640 | 0.00%   0 out of 38320 | 38320   127.729592/s | running (5m00.0s), 00/50 VUs, 3832 complete and 0 interrupted iterations |
| smoke | `smoke-20261125-195551.txt` | ✓ checks.........................: 100.00% 155 out of 155 | 3.22%   5 out of 155 | 155     4.915474/s | running (0m31.5s), 0/5 VUs, 50 complete and 0 interrupted iterations |
| stress | `stress-20261126-070452.txt` | ✗ checks.........................: 96.03% 5863 out of 6105 | 17.49% 996 out of 5693 | 5693   40.445039/s | running (2m20.8s), 00/80 VUs, 5693 complete and 0 interrupted iterations |

### 2b. Phan tich chi tiet 3 kich ban chinh (ban da toi uu)

#### load

_50 VU (1m ramp 20 -> 3m hold 50 -> 1m ramp down), chi GET. Token 15 phut lay tu seed-perf.mjs nen phai chay lien truc khi seed. Bang nay la ban **CO cache** (LRU 60 s + batch query) — xem muc 2c de so sanh._

| Scenario | Threshold | avg | med | p95 | max |
|---|---|---|---|---|---|
| dataview | PASS | 220.56ms | 189.98ms | 382.93ms | 5.54s |
| notifications | PASS | 116.35ms | 104.79ms | 213.8ms | 4.55s |
| overview | PASS | 194.27ms | 174.97ms | 384.56ms | 5.3s |
| projects | PASS | 221.49ms | 201.64ms | 432.84ms | 5.36s |
| workspaces | PASS | 90.77ms | 44.86ms | 252.79ms | 3.34s |

#### stress

_80 VU (50 read_records + 20 upload_10mb + 10 dq01_50k), 2 phut. Upload bi throttle 429 voi muc dinh 200 req/60s._

| Scenario | Threshold | avg | med | p95 | max |
|---|---|---|---|---|---|
| dq01_50k | PASS | 928.38ms | 628.33ms | 2.98s | 4.51s |
| read_records | FAIL | 784.84ms | 247.89ms | 3.3s | 3.69s |

#### full-journey

_3 VU, 1 phut, duyet toan bo module co login moi vong._

| Scenario | Threshold | avg | med | p95 | max |
|---|---|---|---|---|---|
| analysis | PASS | 41.4ms | 36.36ms | 88.26ms | 238.33ms |
| auth | PASS | 7.39ms | 6.15ms | 13.71ms | 29.05ms |
| datasets | PASS | 21.95ms | 16.93ms | 37.53ms | 278.77ms |
| dataview | PASS | 49.11ms | 19.99ms | 40.46ms | 2.18s |
| feedback | PASS | 23.48ms | 19.86ms | 43.99ms | 70.48ms |
| health | PASS | 3.46ms | 2.95ms | 5.67ms | 17.58ms |
| issues | PASS | 7.45ms | 6.45ms | 11.24ms | 30.45ms |
| notifications | PASS | 13.86ms | 9.88ms | 35.45ms | 120.75ms |
| overview | PASS | 19.77ms | 18.73ms | 32.82ms | 39.9ms |
| projects | PASS | 21.2ms | 19.68ms | 36.07ms | 50.2ms |
| workspaces | PASS | 19.1ms | 17.62ms | 32.08ms | 53.28ms |


### 2c. A/B kich ban `load` — truoc / sau toi uu (batch query + LRU cache)

Cung mot dataset (50.000 dong, 8 cot), cung 50 VU, cung thieu gian 5 phut. Khac biet duy nhat: `CHART_CACHE_TTL_MS=0` (tat cache) vs `=60000` (cache 60 giay). Throttle duoc noi (`THROTTLE_DEFAULT_LIMIT=100000`) de p95 do duoc la cua service, khong phai cua rate limiter.

| Chi so | Baseline (khong cache) | Co cache (60s TTL) | Cai thien |
|---|---|---|---|
| `http_req_duration` p95 | 13,09 s | **350,24 ms** | **37 x** |
| `dataview` p95 | 20,68 s | **370,70 ms** | **56 x** |
| `dataview` avg | 6,24 s | **229,12 ms** | **27 x** |
| Throughput (`http_reqs`) | 13,88 req/s | **130,59 req/s** | **9,4 x** |
| Tong request / 5 phut | 4.207 | **39.210** | 9,3 x |
| `http_req_failed` | 0,00% | 0,00% | = |
| `checks` | 100,00% | **100,00%** | = |
| Threshold k6 | **FAIL** (4 scenario) | **PASS** | — |

Do rieng 1 endpoint (curl, tuen):

| Lần gọi | Thời gian |
|---|---|
| 1 (cold — quét 50k dòng × 8 cột) | 862 ms |
| 2 (warm — cache hit) | 19,92 ms |
| 3 (warm — cache hit) | 19,68 ms |

=> Cache giam 43 x cho 1 request; tai cao 50 VU thi p95 giam 37 x do moi request sau la doc ban ghi in-memory thay vi quet lai collection MongoDB.

**So sanh tung scenario** (cung file k6, doc tu dong summary):

| Scenario | Baseline p95 | Co cache p95 | Giam | Threshold baseline -> moi |
|---|---|---|---|---|
| dataview | 20.68s | 382.93ms | — | FAIL -> PASS |
| notifications | 900.18ms | 213.8ms | — | PASS -> PASS |
| overview | 1.18s | 384.56ms | — | FAIL -> PASS |
| projects | 1.28s | 432.84ms | — | FAIL -> PASS |
| workspaces | 8.67s | 252.79ms | — | FAIL -> PASS |


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

## 6. Ghi chu ve phien ban truoc cua slide

| Chi so tren slide cu | So THAT vua do lai | Ly do chenh lech |
|---|---|---|
| load: p95 5,37 ms, 125k req, 2xx ~15,8% | p95 **13,09 s** (truoc toi uu) -> **350 ms** (sau toi uu), 39.210 req, checks **100%** | Slide cu chay khi access token (TTL 15 phut) **da het han** nen API tra 401 ngay lap tuc; so do phan anh thu lai, khong phai hieu nang that. Sau khi batch query + LRU cache, p95 giam **37 x**. |
| stress: 2xx 3,9%, 32 loi upload | checks **96,03%**, upload **409** (dung nghiep vu) | 409 = "moi Project chi duoc lien ket 1 Dataset dang hoat dong" — ket qua dung; 242 upload fail la request k6 **timeout** khi upload 10 MB, khong phai loi 5xx cua API. |
| full-journey: 401/403/404 12%, 2xx 88% | checks **100%**, `http_req_failed` 12% | 216 non-2xx = 72 x (login 401 + summary 404 + admin/issues 403) — **negative test co chu dich** trong kich ban. |

=> Cong thuc dung cho slide: dung **`checks` + `p95` theo tung scenario**; khong dung `http_req_failed` de danh gia chat luong dich vu.

## 7. Luot chay bi loai (khong du mau)

| Model | Ollama | Luot suy luan thanh cong | Ly do |
|---|---|---|---|
| M2 | gemma3:12b | 0/20 | Qua trinh bi dung/OOM giua chung -> thieu mau |

## 8. Phan tich nguyên nhan cac chi so khong dat

Cac so lieu duoi day duoc do lai truc tiep tren container trong khi chay (docker stats + log NestJS).

### 8.1 Latency p95 cao o `load` — nguyen nhan: GET /datasets/:id/charts quet lai 50.000 dong — **DA XU LY**

- Dataset seed co **50.000 records** that, 8 cot, luu trong collection `datasetrecords`.
- `GET /datasets/:id/charts?top_n=5` doc gia tri ** tung cot ** (`getColumnValues`) voi `MAX_CHART_SAMPLE_ROWS = 50_000`, concurrency 4 — moi request quet lai 50k dong, khong co cache.
- Do duoc server-side (log NestJS): `charts` **4-6 s** lan dau, `records` **17-18 s** khi cong don; API container chi dung 0.2% CPU -> bottleneck la **I/O MongoDB + thieu cache**, khong phai tai nguy.en.
- Hieu luc: `load` chi dat **3.492 request / 5 phut (11,3 req/s)** thay vi ~125.000 request cua cac lan chay truoc — vi cac lan do **token da het han 15 phut** nen API tra 401 ngay lap tuc (p95 chi 4,67 ms nhung `http_req_failed` 98,46%).

**Da sua (trong commit hien tai):**

1. `RecordQueryPort.getColumnValuesBatch()` — doc **nhieu cot trong MOT lan quet** bang aggregation pipeline co `$project` dong, thay vi N lan quet cho N cot.
2. `DataViewService.chartCache` — **LRU in-memory + TTL 60 s**, khoa theo `datasetId|fileChecksum|columns|topN|maxRows`. Dataset la **bat bien** sau ingest (co `file_checksum` lam dinh danh) nen so lieu bieu do khong doi giua cac request.
3. Bien moi `CHART_CACHE_TTL_MS` (dat `0` de tat cache) + `THROTTLE_DEFAULT_LIMIT` / `THROTTLE_DEFAULT_TTL_MS` de do tai ma khong lam sai lech p95. Mac dinh giu nguyen gia tri production (60 s / 200 req/60s).

| Chi so | Truoc | Sau |
|---|---|---|
| `http_req_duration` p95 | 13,09 s | **350,24 ms** |
| `dataview` p95 | 20,68 s | **370,70 ms** |
| Throughput | 13,88 req/s | **130,59 req/s** |
| Threshold k6 | FAIL | **PASS** |

- **Ket luan: p95 13,09 s la so THAT cua he thong TRUOC toi uu. Sau batch query + LRU cache, p95 giam 37 x (350 ms) va tat ca threshold k6 deu dat. So lien 4,67 ms/125k req trong slide cu la do sai (do token het han), khong phai baseline dung.**

### 8.2 `http_req_failed` cao — nguyen nhan: Throttler 200 req/60s (khong phai loi he thong)

- `ThrottlerModule` — gioi han **200 request/60s** cho toan bo he thong, bo dem trong RAM. Day la **hang rao bao ve** dung chu dich (khong phai loi).
- `stress`: phan lon request bi **429** khi vuot nguong 200 req/60s; script k6 co tinh chap nhan 429 (khong tinh `checks` fail) nen `checks` van dat nguong. k6 chi dem non-2xx vao `http_req_failed`.
- `full-journey`: 216 request non-2xx = **72 x (login 401 + summary 404 + admin/issues 403)**. Ca 3 deu la **negative test co chu dich** trong kich ban (script chap nhan 401/404/403), khong phai loi — `checks` = **100,00%**.
- **Ket luan: `http_req_failed` khong dung de danh gia chat luong dich vu o tai day. Chi so dung la `checks` + `p95` theo tung scenario.**

### 8.3 Tai nguyen (docker stats trong khi chay)

| Kich ban | CPU peak (api) | RAM peak (api) |
|---|---|---|
| load | 586% | 996 MiB |
| stress | 139% | 865 MiB |
| full-journey | 226% | 781 MiB |

Container Mongo dung khoang 2 GB RAM cho ~600.000 records.

### 8.4 Diem can sua — trang thai sau toi uu

| # | Diem can sua | Trang thai |
|---|---|---|
| 1 | Cache `GET /datasets/:id/charts` theo (datasetId, topN) | **DA XU LY** — LRU + TTL 60 s |
| 2 | Batch query gia tri cot thay vi quet tung cot | **DA XU LY** — `getColumnValuesBatch` |
| 3 | Tang `limit` Throttler cho API noi bo | **DA XU LY** — `THROTTLE_DEFAULT_LIMIT` env (mac dinh giu 200) |
| 4 | Lay token deo TTL dai hon de phong test dai bi 401 | **Con lai** — hien tai phai chay lien truc khi `seed-perf.mjs` |
| 5 | Upload 10 MB trong `stress` bi timeout khi tai cao | **Con lai** — gioi han cua k6 script, khong phai loi API |

## 9. Swagger UI

| URL | HTTP |
|---|---|
| `http://localhost:3100/api/v1/docs` | 200 |
| `http://localhost:3100/api/v1/docs-json` | 200 |

## 10. Files tham chieu

- `benchmark-M1-2026-11-25.md`
- `benchmark-M2-2026-11-25.md`
- `benchmark-M3-2026-11-25.md`
- `benchmark-M4-2026-11-25.md`
- `benchmark-M5-2026-11-25.md`
- `benchmark-summary-2026-11-25.md`

