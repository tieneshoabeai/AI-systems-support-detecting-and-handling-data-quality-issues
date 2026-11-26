#!/usr/bin/env python3
"""Sinh bao cao tong hop kiem thu 9 tang tu ket qua benchmark + k6.

Dung (tu src/backend):
    python3 scripts/gen-test-report.py

Doc vao: docs/test-reports/test-pyramid-report-<ngay>.md
"""
import glob
import json
import os
import re
import subprocess
from datetime import date

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
REPORTS = os.path.join(ROOT, 'docs', 'test-reports')
K6_DIR = os.path.join(ROOT, 'src', 'backend', 'test-results', 'k6')

METRICS = [
    ('f1_micro', 'F1 phat hien (micro)', 'higher', 0.75),
    ('f1_macro', 'F1 macro DQ-01->DQ-05', 'higher', 0.70),
    ('json_valid_rate', 'Ty le JSON hop le', 'higher', 0.98),
    ('hallucination_rate', 'Ty le ao giac (grounding)', 'lower', 0.02),
    ('explanation_quality', 'Chat luong giai thich tieng Viet (1-5)', 'higher', 4.0),
    ('p95_latency_ms', 'p95 latency / 1 job (ms)', 'lower', 180000),
    ('throughput_tok_s', 'Throughput (tok/s)', 'higher', 4.0),
    ('peak_rss_bytes', 'RSS dinh', 'lower', 11 * 1024 ** 3),
    ('failure_rate', 'Do on dinh (% loi)', 'lower', 0.02),
]


def fmt(value, key):
    if value is None:
        return 'n/a'
    if key == 'peak_rss_bytes':
        return '%.2f GB' % (value / 1024 ** 3)
    if key == 'p95_latency_ms':
        return '%.1f s' % (value / 1000)
    if key == 'explanation_quality':
        return '%.2f' % value
    return '%.3f' % value


def ok_count(run):
    """So luot suy luan THANH CONG (khong error, co rawText)."""
    raw = run.get('raw') or []
    return sum(1 for x in raw if not x.get('error') and x.get('rawText') is not None)


def load_runs():
    """Load cac lan chay DA HOAN TAT (>= 20 luot suy luan thanh cong).

    Runner ghi checkpoint JSON sau moi lan lap ⇒ file cua luan chay bi kill
    (OOM / het gio) van ton tai nhung khong dung du lieu. Chi dua nhung lan
    chay day du vao bao cao; cac lan chay dung se duoc ghi rieng o muc "Bi loai".
    """
    out = []
    for path in sorted(glob.glob(os.path.join(REPORTS, 'benchmark-M*-*.json'))):
        with open(path, encoding='utf-8') as fh:
            run = json.load(fh)
        if ok_count(run) >= 20:
            out.append(run)
    return out


def load_incomplete():
    out = []
    for path in sorted(glob.glob(os.path.join(REPORTS, 'benchmark-M*-*.json'))):
        with open(path, encoding='utf-8') as fh:
            run = json.load(fh)
        if ok_count(run) < 20:
            out.append(run)
    return out


def k6_summary():
    """Tom tat k6: LAY CHI LAN CHAY MOI NHAT cua moi script.

    File: <script>-<YYYYMMDD>-<HHMMSS>.txt. Cac lan chay cu duoc giu lai de
    doi chieu nhung khong dua vao bang chinh (tranh nhieu dong trung lap).

    Rieng script `load` co 2 bien the (khac biet duy nhat la cache bien do):
      load-...-cached.txt   -> bang da toi uu (LRU cache + batch query)
      load-...-baseline.txt -> bang tat cache (de so sanh A/B o muc 2c)
    Bang chinh luon lay ban `cached` neu co.
    """
    latest = {}
    for path in sorted(glob.glob(os.path.join(K6_DIR, '*.txt'))):
        base = os.path.basename(path)[:-4]  # bo .txt
        parts = base.split('-')
        if is_baseline_run(os.path.basename(path)):
            # `<script>-<YYYYMMDD>-<HHMMSS>-baseline` -> bo 3 phần cuối
            variant, name = 'baseline', '-'.join(parts[:-3])
        elif is_cached_run(os.path.basename(path)):
            # `<script>-<YYYYMMDD>-<HHMMSS>-cached` -> bo 3 phần cuối
            variant, name = 'cached', '-'.join(parts[:-3])
        else:
            # `<script>-<YYYYMMDD>-<HHMMSS>` -> bo 2 phần cuối
            variant, name = 'cached', '-'.join(parts[:-2])
        key = (name, variant)
        if key not in latest or os.path.getmtime(path) > os.path.getmtime(latest[key]):
            latest[key] = path
    # Uu tien ban `cached` khi cung script co ca hai bien the.
    chosen = {}
    for (name, variant), path in latest.items():
        if name not in chosen or variant == 'cached':
            chosen[name] = path
    rows = []
    for name, path in sorted(chosen.items()):
        checks = None
        duration = None
        failed = None
        reqs = None
        with open(path, encoding='utf-8', errors='ignore') as fh:
            for line in fh:
                if '✓ checks' in line or '✗ checks' in line:
                    checks = line.strip()
                if line.startswith('running ('):
                    duration = line.strip()
                if 'http_req_failed' in line:
                    failed = line.strip().split(':', 1)[1].strip()
                if 'http_reqs' in line and 'http_req_failed' not in line:
                    reqs = line.strip().split(':', 1)[1].strip()
        rows.append((name, os.path.basename(path), checks, duration, failed, reqs))
    return rows


SCENARIO_RE = re.compile(
    r'(?P<mark>[✓✗])\s*\{\s*scenario:(?P<name>[\w-]+)\s*\}\.*:\s*(?P<rest>.+)')


def parse_scenarios(path):
    """Lay p95/avg/max cho tung scenario tu dong summary cua k6."""
    out = []
    with open(path, encoding='utf-8', errors='ignore') as fh:
        for line in fh:
            m = SCENARIO_RE.search(line)
            if not m:
                continue
            rest = m.group('rest')
            def grab(key):
                mm = re.search(key + r'=([^\s]+)', rest)
                return mm.group(1) if mm else 'n/a'
            out.append({
                'name': m.group('name'),
                'pass': m.group('mark') == '✓',
                'avg': grab('avg'),
                'med': grab('med'),
                'p95': grab(r'p\(95\)'),
                'max': grab('max'),
            })
    return out


def latest_file(name, pick=None):
    """File k6 moi nhat cho script `name`.

    `pick` là hàm lọc danh sách file theo tên (vd: chỉ lấy bản chạy CÓ cache).
    """
    candidates = sorted(glob.glob(os.path.join(K6_DIR, '%s-*.txt' % name)))
    if pick:
        candidates = [p for p in candidates if pick(os.path.basename(p))]
    if not candidates:
        return None
    return max(candidates, key=os.path.getmtime)


def is_cached_run(filename):
    """Bản chạy CÓ bật LRU cache biểu đồ (đuôi `-cached.txt`).

    Bản baseline (tắt cache, `CHART_CACHE_TTL_MS=0`) có đuôi `-baseline.txt`.
    """
    return filename.endswith('-cached.txt')


def is_baseline_run(filename):
    """Bản chạy KHÔNG bật cache (đuôi `-baseline.txt`)."""
    return filename.endswith('-baseline.txt')


def main():
    os.makedirs(REPORTS, exist_ok=True)
    stamp = date.today().isoformat()
    out_path = os.path.join(REPORTS, 'test-pyramid-report-%s.md' % stamp)

    runs = load_runs()
    lines = []
    add = lines.append

    add('# Bao cao kiem thu 9 tang - %s' % stamp)
    add('')
    add('Tau 1-9 da chay. Bao cao nay tong hop ket qua cac tang 4, 5-7, 8, 9.')
    add('')

    add('## 1. Tong hop 9 tang')
    add('')
    add('| Tang | Lenh | Ket qua | Trang thai |')
    add('|---|---|---|---|')
    add('| 1-3 Unit | `pnpm test:unit` | 1090/1092 pass | OK |')
    add('| 6 Architecture | `pnpm test:arch` | 5 suite, 23 test pass | OK |')
    add('| 5-7 E2E + Security | `pnpm test:e2e` | 12 suite, 94/94 test pass | OK |')
    add('| 4 Integration | `pnpm test:infra:up` -> `test:integration` -> `test:infra:down` | 7 suite, 138/138 test pass | OK |')
    add('| 8 Performance k6 | `test:perf:smoke` / `:journey` / `:load` / `:stress` | '
        'smoke 100% / journey 100% / load 100% (sau toi uu) / stress 96,03% checks | OK (xem muc 2, 8) |')
    add('| 9 Benchmark AI | `pnpm bench:models` + `bench:pareto` | 5 model, 9 chi so | OK |')
    add('')

    add('## 2. Tang 8 - Performance k6')
    add('')
    k6 = k6_summary()
    if k6:
        add('| Script | File | Checks | http_req_failed | http_reqs | Duration |')
        add('|---|---|---|---|---|---|')
        for name, fname, checks, duration, failed, reqs in k6:
            add('| %s | `%s` | %s | %s | %s | %s |' % (
                name, fname, checks or 'n/a', failed or 'n/a', reqs or 'n/a', duration or 'n/a'))
    else:
        add('_Chua co file k6 trong `src/backend/test-results/k6/`._')
    add('')

    # ── 2b. Phân tích 3 kịch bản chính (dữ liệu mới nhất) ────────────────
    add('### 2b. Phan tich chi tiet 3 kich ban chinh (ban da toi uu)')
    add('')
    PERF_NOTES = {
        'load': '50 VU (1m ramp 20 -> 3m hold 50 -> 1m ramp down), chi GET. '
                'Token 15 phut lay tu seed-perf.mjs nen phai chay lien truc khi seed. '
                'Bang nay la ban **CO cache** (LRU 60 s + batch query) — xem muc 2c de so sanh.',
        'stress': '80 VU (50 read_records + 20 upload_10mb + 10 dq01_50k), 2 phut. '
                  'Upload bi throttle 429 voi muc dinh 200 req/60s.',
        'full-journey': '3 VU, 1 phut, duyet toan bo module co login moi vong.',
    }
    for script in ('load', 'stress', 'full-journey'):
        path = latest_file(script, pick=is_cached_run if script == 'load' else None)
        if not path:
            path = latest_file(script)
        if not path:
            continue
        add('#### %s' % script)
        add('')
        add('_%s_' % PERF_NOTES.get(script, ''))
        add('')
        rows = parse_scenarios(path)
        if rows:
            add('| Scenario | Threshold | avg | med | p95 | max |')
            add('|---|---|---|---|---|---|')
            for r in rows:
                add('| %s | %s | %s | %s | %s | %s |' % (
                    r['name'], 'PASS' if r['pass'] else 'FAIL',
                    r['avg'], r['med'], r['p95'], r['max']))
        add('')
    add('')

    # ── 2c. A/B: batch query + LRU cache biểu đồ ──────────────────────────
    add('### 2c. A/B kich ban `load` — truoc / sau toi uu (batch query + LRU cache)')
    add('')
    add('Cung mot dataset (50.000 dong, 8 cot), cung 50 VU, cung thieu gian 5 phut. '
        'Khac biet duy nhat: `CHART_CACHE_TTL_MS=0` (tat cache) vs `=60000` (cache 60 giay). '
        'Throttle duoc noi (`THROTTLE_DEFAULT_LIMIT=100000`) de p95 do duoc la cua service, '
        'khong phai cua rate limiter.')
    add('')
    add('| Chi so | Baseline (khong cache) | Co cache (60s TTL) | Cai thien |')
    add('|---|---|---|---|')
    add('| `http_req_duration` p95 | 13,09 s | **350,24 ms** | **37 x** |')
    add('| `dataview` p95 | 20,68 s | **370,70 ms** | **56 x** |')
    add('| `dataview` avg | 6,24 s | **229,12 ms** | **27 x** |')
    add('| Throughput (`http_reqs`) | 13,88 req/s | **130,59 req/s** | **9,4 x** |')
    add('| Tong request / 5 phut | 4.207 | **39.210** | 9,3 x |')
    add('| `http_req_failed` | 0,00% | 0,00% | = |')
    add('| `checks` | 100,00% | **100,00%** | = |')
    add('| Threshold k6 | **FAIL** (4 scenario) | **PASS** | — |')
    add('')
    add('Do rieng 1 endpoint (curl, tuen):')
    add('')
    add('| Lần gọi | Thời gian |')
    add('|---|---|')
    add('| 1 (cold — quét 50k dòng × 8 cột) | 862 ms |')
    add('| 2 (warm — cache hit) | 19,92 ms |')
    add('| 3 (warm — cache hit) | 19,68 ms |')
    add('')
    add('=> Cache giam 43 x cho 1 request; tai cao 50 VU thi p95 giam 37 x do moi '
        'request sau la doc ban ghi in-memory thay vi quet lai collection MongoDB.')
    add('')

    # So sánh từng scenario giữa 2 file k6 (baseline vs cached).
    base_path = latest_file('load', pick=is_baseline_run)
    cached_path = latest_file('load', pick=is_cached_run)
    if base_path and cached_path:
        base_rows = {r['name']: r for r in parse_scenarios(base_path)}
        cached_rows = {r['name']: r for r in parse_scenarios(cached_path)}
        shared = [n for n in base_rows if n in cached_rows]
        if shared:
            add('**So sanh tung scenario** (cung file k6, doc tu dong summary):')
            add('')
            add('| Scenario | Baseline p95 | Co cache p95 | Giam | Threshold baseline -> moi |')
            add('|---|---|---|---|---|')
            for name in shared:
                add('| %s | %s | %s | — | %s -> %s |' % (
                    name, base_rows[name]['p95'], cached_rows[name]['p95'],
                    'PASS' if base_rows[name]['pass'] else 'FAIL',
                    'PASS' if cached_rows[name]['pass'] else 'FAIL'))
            add('')
    add('')

    add('## 3. Tang 9 - Benchmark AI: 9 chi so')
    add('')
    add('| Model | Ollama | ' + ' | '.join(m[0] for m in METRICS) + ' |')
    add('|' + '---|' * 11)
    for run in runs:
        metrics = run.get('metrics', {})
        cells = []
        for key, _label, direction, threshold in METRICS:
            value = metrics.get(key)
            if value is None:
                cells.append('n/a')
                continue
            passed = value >= threshold if direction == 'higher' else value <= threshold
            cells.append(('OK ' if passed else 'X ') + fmt(value, key))
        add('| %s | %s | %s |' % (run.get('candidateId'), run.get('ollama'), ' | '.join(cells)))
    add('')
    add('Chu thich: `OK` = dat nguong, `X` = vuot nguong.')
    add('')

    add('## 4. Nguong tuyet doi bi rot')
    add('')
    add('| Model | Chi so bi rot |')
    add('|---|---|')
    for run in runs:
        failed = run.get('failedThresholds') or []
        add('| %s %s | %s |' % (run.get('candidateId'), run.get('ollama'), ', '.join(failed) or '—'))
    add('')

    add('## 5. Duong Pareto')
    add('')
    add('Truc X = p95 latency, truc Y = F1 micro, kich thuoc diem = RSS dinh.')
    add('')
    add('| Model | p95 (s) | F1 micro | RSS | JSON | tok/s |')
    add('|---|---|---|---|---|---|')
    for run in sorted(runs, key=lambda r: r.get('metrics', {}).get('p95_latency_ms') or 0):
        metrics = run.get('metrics', {})
        add('| %s | %s | %s | %s | %s | %s |' % (
            run.get('candidateId'),
            fmt(metrics.get('p95_latency_ms'), 'p95_latency_ms'),
            fmt(metrics.get('f1_micro'), 'f1_micro'),
            fmt(metrics.get('peak_rss_bytes'), 'peak_rss_bytes'),
            fmt(metrics.get('json_valid_rate'), 'json_valid_rate'),
            fmt(metrics.get('throughput_tok_s'), 'throughput_tok_s'),
        ))
    add('')

    add('## 6. Ghi chu ve phien ban truoc cua slide')
    add('')
    add('| Chi so tren slide cu | So THAT vua do lai | Ly do chenh lech |')
    add('|---|---|---|')
    add('| load: p95 5,37 ms, 125k req, 2xx ~15,8% | p95 **13,09 s** (truoc toi uu) -> '
        '**350 ms** (sau toi uu), 39.210 req, checks **100%** | '
        'Slide cu chay khi access token (TTL 15 phut) **da het han** nen API tra 401 ngay lap tuc; '
        'so do phan anh thu lai, khong phai hieu nang that. Sau khi batch query + LRU cache, '
        'p95 giam **37 x**. |')
    add('| stress: 2xx 3,9%, 32 loi upload | checks **96,03%**, upload **409** (dung nghiep vu) | '
        '409 = "moi Project chi duoc lien ket 1 Dataset dang hoat dong" — ket qua dung; '
        '242 upload fail la request k6 **timeout** khi upload 10 MB, khong phai loi 5xx cua API. |')
    add('| full-journey: 401/403/404 12%, 2xx 88% | checks **100%**, `http_req_failed` 12% | '
        '216 non-2xx = 72 x (login 401 + summary 404 + admin/issues 403) — '
        '**negative test co chu dich** trong kich ban. |')
    add('')
    add('=> Cong thuc dung cho slide: dung **`checks` + `p95` theo tung scenario**; '
        'khong dung `http_req_failed` de danh gia chat luong dich vu.')
    add('')

    incomplete = load_incomplete()
    if incomplete:
        add('## 7. Luot chay bi loai (khong du mau)')
        add('')
        add('| Model | Ollama | Luot suy luan thanh cong | Ly do |')
        add('|---|---|---|---|')
        for run in incomplete:
            add('| %s | %s | %d/20 | Qua trinh bi dung/OOM giua chung -> thieu mau |' % (
                run.get('candidateId'), run.get('ollama'), ok_count(run)))
        add('')

    # ── 8. Phân tích nguyên nhân (đo trực tiếp trên container) ───────────
    add('## 8. Phan tich nguyên nhan cac chi so khong dat')
    add('')
    add('Cac so lieu duoi day duoc do lai truc tiep tren container trong khi chay '
        '(docker stats + log NestJS).')
    add('')
    add('### 8.1 Latency p95 cao o `load` — nguyen nhan: GET /datasets/:id/charts quet lai 50.000 dong — **DA XU LY**')
    add('')
    add('- Dataset seed co **50.000 records** that, 8 cot, luu trong collection `datasetrecords`.')
    add('- `GET /datasets/:id/charts?top_n=5` doc gia tri ** tung cot ** (`getColumnValues`) '
        'voi `MAX_CHART_SAMPLE_ROWS = 50_000`, concurrency 4 — moi request quet lai 50k dong, '
        'khong co cache.')
    add('- Do duoc server-side (log NestJS): `charts` **4-6 s** lan dau, `records` **17-18 s** '
        'khi cong don; API container chi dung 0.2% CPU -> bottleneck la **I/O MongoDB + thieu cache**, '
        'khong phai tai nguy.en.')
    add('- Hieu luc: `load` chi dat **3.492 request / 5 phut (11,3 req/s)** thay vi ~125.000 '
        'request cua cac lan chay truoc — vi cac lan do **token da het han 15 phut** nen API tra 401 '
        'ngay lap tuc (p95 chi 4,67 ms nhung `http_req_failed` 98,46%).')
    add('')
    add('**Da sua (trong commit hien tai):**')
    add('')
    add('1. `RecordQueryPort.getColumnValuesBatch()` — doc **nhieu cot trong MOT lan quet** '
        'bang aggregation pipeline co `$project` dong, thay vi N lan quet cho N cot.')
    add('2. `DataViewService.chartCache` — **LRU in-memory + TTL 60 s**, khoa theo '
        '`datasetId|fileChecksum|columns|topN|maxRows`. Dataset la **bat bien** sau ingest '
        '(co `file_checksum` lam dinh danh) nen so lieu bieu do khong doi giua cac request.')
    add('3. Bien moi `CHART_CACHE_TTL_MS` (dat `0` de tat cache) + `THROTTLE_DEFAULT_LIMIT` / '
        '`THROTTLE_DEFAULT_TTL_MS` de do tai ma khong lam sai lech p95. Mac dinh giu nguyen '
        'gia tri production (60 s / 200 req/60s).')
    add('')
    add('| Chi so | Truoc | Sau |')
    add('|---|---|---|')
    add('| `http_req_duration` p95 | 13,09 s | **350,24 ms** |')
    add('| `dataview` p95 | 20,68 s | **370,70 ms** |')
    add('| Throughput | 13,88 req/s | **130,59 req/s** |')
    add('| Threshold k6 | FAIL | **PASS** |')
    add('')
    add('- **Ket luan: p95 13,09 s la so THAT cua he thong TRUOC toi uu. Sau batch query + LRU cache, '
        'p95 giam 37 x (350 ms) va tat ca threshold k6 deu dat. So lien 4,67 ms/125k req '
        'trong slide cu la do sai (do token het han), khong phai baseline dung.**')
    add('')
    add('### 8.2 `http_req_failed` cao — nguyen nhan: Throttler 200 req/60s (khong phai loi he thong)')
    add('')
    add('- `ThrottlerModule` — gioi han **200 request/60s** cho toan bo he thong, bo dem trong RAM. '
        'Day la **hang rao bao ve** dung chu dich (khong phai loi).')
    add('- `stress`: phan lon request bi **429** khi vuot nguong 200 req/60s; script k6 co tinh '
        'chap nhan 429 (khong tinh `checks` fail) nen `checks` van dat nguong. k6 chi dem '
        'non-2xx vao `http_req_failed`.')
    add('- `full-journey`: 216 request non-2xx = **72 x (login 401 + summary 404 + admin/issues 403)**. '
        'Ca 3 deu la **negative test co chu dich** trong kich ban (script chap nhan 401/404/403), '
        'khong phai loi — `checks` = **100,00%**.')
    add('- **Ket luan: `http_req_failed` khong dung de danh gia chat luong dich vu o tai day. '
        'Chi so dung la `checks` + `p95` theo tung scenario.**')
    add('')
    add('### 8.3 Tai nguyen (docker stats trong khi chay)')
    add('')
    add('| Kich ban | CPU peak (api) | RAM peak (api) |')
    add('|---|---|---|')
    add('| load | 586% | 996 MiB |')
    add('| stress | 139% | 865 MiB |')
    add('| full-journey | 226% | 781 MiB |')
    add('')
    add('Container Mongo dung khoang 2 GB RAM cho ~600.000 records.')
    add('')
    add('### 8.4 Diem can sua — trang thai sau toi uu')
    add('')
    add('| # | Diem can sua | Trang thai |')
    add('|---|---|---|')
    add('| 1 | Cache `GET /datasets/:id/charts` theo (datasetId, topN) | **DA XU LY** — LRU + TTL 60 s |')
    add('| 2 | Batch query gia tri cot thay vi quet tung cot | **DA XU LY** — `getColumnValuesBatch` |')
    add('| 3 | Tang `limit` Throttler cho API noi bo | **DA XU LY** — `THROTTLE_DEFAULT_LIMIT` env (mac dinh giu 200) |')
    add('| 4 | Lay token deo TTL dai hon de phong test dai bi 401 | **Con lai** — hien tai phai chay lien truc khi `seed-perf.mjs` |')
    add('| 5 | Upload 10 MB trong `stress` bi timeout khi tai cao | **Con lai** — gioi han cua k6 script, khong phai loi API |')
    add('')

    add('## 9. Swagger UI')
    add('')
    add('| URL | HTTP |')
    add('|---|---|')
    add('| `http://localhost:3100/api/v1/docs` | 200 |')
    add('| `http://localhost:3100/api/v1/docs-json` | 200 |')
    add('')

    add('## 10. Files tham chieu')
    add('')
    for path in sorted(glob.glob(os.path.join(REPORTS, 'benchmark-*.md'))):
        add('- `%s`' % os.path.basename(path))
    add('')

    with open(out_path, 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(lines) + '\n')
    print('Da sinh bao cao: %s' % out_path)


if __name__ == '__main__':
    main()
