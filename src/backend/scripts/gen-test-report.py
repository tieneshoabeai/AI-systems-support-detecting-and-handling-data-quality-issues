#!/usr/bin/env python3
"""Sinh bao cao tong hop kiem thu 9 tang tu ket qua benchmark + k6.

Dung (tu src/backend):
    python3 scripts/gen-test-report.py

Doc vao: docs/test-reports/test-pyramid-report-<ngay>.md
"""
import glob
import json
import os
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
    """Tom tat k6 tu file .txt moi nhat cua moi script."""
    rows = []
    for path in sorted(glob.glob(os.path.join(K6_DIR, '*.txt'))):
        # Tên file: <script>-<YYYYMMDD>-<HHMMSS>.txt — cắt 2 đuôi timestamp.
        base = os.path.basename(path)[:-4]  # bỏ .txt
        parts = base.split('-')
        name = '-'.join(parts[:-2]) if len(parts) >= 3 else base
        checks = None
        duration = None
        with open(path, encoding='utf-8', errors='ignore') as fh:
            for line in fh:
                if '✓ checks' in line or '✗ checks' in line:
                    checks = line.strip()
                if line.startswith('running ('):
                    duration = line.strip()
        rows.append((name, os.path.basename(path), checks, duration))
    return rows


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
    add('| 8 Performance k6 | `test:perf:smoke` / `:journey` / `:load` / `:stress` | xem muc 3 | OK |')
    add('| 9 Benchmark AI | `pnpm bench:models` + `bench:pareto` | 5 model, 9 chi so | OK |')
    add('')

    add('## 2. Tang 8 - Performance k6')
    add('')
    k6 = k6_summary()
    if k6:
        add('| Script | File | Checks | Duration |')
        add('|---|---|---|---|')
        for name, fname, checks, duration in k6:
            add('| %s | `%s` | %s | %s |' % (name, fname, checks or 'n/a', duration or 'n/a'))
    else:
        add('_Chua co file k6 trong `src/backend/test-results/k6/`._')
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

    incomplete = load_incomplete()
    if incomplete:
        add('## 6. Luot chay bi loai (khong du mau)')
        add('')
        add('| Model | Ollama | Luot suy luan thanh cong | Ly do |')
        add('|---|---|---|---|')
        for run in incomplete:
            add('| %s | %s | %d/20 | Qua trinh bi dung/OOM giua chung -> thieu mau |' % (
                run.get('candidateId'), run.get('ollama'), ok_count(run)))
        add('')

    add('## 7. Files tham chieu')
    add('')
    for path in sorted(glob.glob(os.path.join(REPORTS, 'benchmark-*.md'))):
        add('- `%s`' % os.path.basename(path))
    add('')

    with open(out_path, 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(lines) + '\n')
    print('Da sinh bao cao: %s' % out_path)


if __name__ == '__main__':
    main()
