/**
 * Vẽ đường Pareto và chọn model tốt nhất (Phần 12 v8 §3.15.5 Bước 5).
 *
 *   pnpm run bench:pareto
 *
 * Quy tắc:
 *  - Trục X = p95 latency (càng thấp càng tốt) · Trục Y = F1 micro (càng cao càng tốt)
 *  - Kích thước điểm = RSS đỉnh
 *  - Model **bị loại** (rớt ngưỡng tuyệt đối) không được là điểm Pareto
 *  - Chọn **điểm Pareto tốt nhất**, KHÔNG chọn điểm F1 cao tuyệt đối
 *  - Thứ tự ưu tiên khi hoà: giấy phép rõ ràng → headroom RAM → latency → tái dùng họ model
 *
 * Đọc kết quả từ `docs/test-reports/benchmark-<model>-<ngày>.json`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { METRICS, thresholdFailures } from './models';

interface StoredRun {
  candidateId: string;
  ollama: string;
  family: string;
  params: string;
  metrics: Record<string, number | null>;
  failedThresholds: string[];
  /** Phản hồi thô của từng lượt — dùng để đếm số lượt suy luận THÀNH CÔNG. */
  raw?: { error?: string | null; jsonValid?: boolean; rawText?: string }[];
}

interface ParetoPoint {
  id: string;
  ollama: string;
  family: string;
  f1: number;
  p95: number;
  rssGb: number;
  jsonValid: number;
  hallucination: number;
  throughput: number;
  eligible: boolean;
  failed: string[];
  /** Điểm Pareto: không có model nào vừa nhanh hơn vừa chính xác hơn. */
  onFrontier: boolean;
  /** Điểm tổng hợp 0..100 (chuẩn hoá min–max × trọng số). */
  score: number;
}

const reportDir = path.resolve(process.cwd(), '../../docs/test-reports');

function loadRuns(): StoredRun[] {
  if (!fs.existsSync(reportDir)) return [];
  const files = fs
    .readdirSync(reportDir)
    .filter((f) => /^benchmark-M\d-.*\.json$/.test(f));
  // Ưu tiên file mới nhất cho mỗi model.
  const byId = new Map<string, { file: string; mtime: number }>();
  for (const f of files) {
    const full = path.join(reportDir, f);
    const id = /^benchmark-(M\d)-/.exec(f)?.[1] ?? '';
    if (!id) continue;
    const mtime = fs.statSync(full).mtimeMs;
    const prev = byId.get(id);
    if (!prev || prev.mtime < mtime) byId.set(id, { file: full, mtime });
  }
  return [...byId.values()].map(({ file }) => JSON.parse(fs.readFileSync(file, 'utf8')) as StoredRun);
}

const runs = loadRuns();
if (runs.length === 0) {
  console.error('Khong tim thay ket qua benchmark (docs/test-reports/benchmark-M*.json).');
  console.error('Chay truoc: pnpm run bench:models -- --samples=200 --repeats=3');
  process.exitCode = 1;
} else {
  // ── Loại các lần chạy DỞ DANG ────────────────────────────────────────────
  // Runner ghi checkpoint JSON sau mỗi lần lặp ⇒ nếu tiến trình bị kill giữa
  // chừng (OOM, hết thời gian), file JSON vẫn tồn tại nhưng `raw` rỗng hoặc
  // ít hơn số mẫu kỳ vọng ⇒ KHÔNG được đưa vào đường Pareto (sẽ cho ra
  // điểm 0.000 gây hiểu nhầm). Báo cáo rõ ràng là "khong hoan tat".
  const MIN_SAMPLES_FOR_PICTURE = 20;
  // Đếm lượt suy luận THÀNH CÔNG (không có `error`) — nhiều lượt "thành công"
  // về mặt HTTP nhưng `rawText` rỗng ⇒ model bị unload giữa chừng.
  const okCount = (r: StoredRun): number =>
    (r.raw ?? []).filter((x) => !x.error && x.rawText !== undefined).length;
  const incomplete = runs.filter((r) => okCount(r) < MIN_SAMPLES_FOR_PICTURE);
  const completeRuns = runs.filter((r) => okCount(r) >= MIN_SAMPLES_FOR_PICTURE);
  for (const r of incomplete) {
    console.log(
      `> BO QUA ${r.candidateId} (${r.ollama}): chi ${okCount(r)}/${MIN_SAMPLES_FOR_PICTURE} lượt suy luan thanh cong — luan chay dung.`,
    );
  }
  if (completeRuns.length === 0) {
    console.error('Khong co model nao chay du mau de ve duong Pareto.');
    process.exitCode = 1;
  }
  const points: ParetoPoint[] = completeRuns.map((r) => {
    const m = r.metrics;
    const failed = r.failedThresholds?.length ? r.failedThresholds : thresholdFailures(m);
    const rss = m['peak_rss_bytes'];
    return {
      id: r.candidateId,
      ollama: r.ollama,
      family: r.family,
      f1: m['f1_micro'] ?? 0,
      p95: m['p95_latency_ms'] ?? Number.POSITIVE_INFINITY,
      rssGb: rss ? rss / 1024 ** 3 : 0,
      jsonValid: m['json_valid_rate'] ?? 0,
      hallucination: m['hallucination_rate'] ?? 1,
      throughput: m['throughput_tok_s'] ?? 0,
      eligible: failed.length === 0,
      failed,
      onFrontier: false,
      score: 0,
    };
  });

  // ── Điểm Pareto: model A bị "chi phối" bởi B nếu B nhanh hơn (≤) VÀ chính xác hơn (≥),
  //    và ít nhất 1 tiêu chí strict hơn. ────────────────────────────────────
  for (const a of points) {
    if (!a.eligible) continue;
    a.onFrontier = !points.some((b) => {
      if (b === a || !b.eligible) return false;
      const atLeastAsGood = b.f1 >= a.f1 && b.p95 <= a.p95;
      const strictlyBetter = b.f1 > a.f1 || b.p95 < a.p95;
      return atLeastAsGood && strictlyBetter;
    });
  }

  // ── Điểm tổng hợp min–max × trọng số (chỉ trong nhóm đạt ngưỡng) ──────────
  const eligible = points.filter((p) => p.eligible);
  if (eligible.length > 0) {
    for (const metric of METRICS) {
      const values = eligible
        .map((p) => p[metric.key as keyof ParetoPoint] as number | undefined)
        .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
      if (values.length < 2) continue;
      const min = Math.min(...values);
      const max = Math.max(...values);
      for (const p of eligible) {
        const raw = p[metric.key as keyof ParetoPoint] as number | undefined;
        if (typeof raw !== 'number' || !Number.isFinite(raw)) continue;
        const norm = max === min ? 1 : (raw - min) / (max - min);
        p.score += metric.weight * (metric.dir === 'higher' ? norm : 1 - norm);
      }
    }
  }

  console.log('=== DUONG PARETO (X = p95 latency, Y = F1, kich thuoc = RSS) ===');
  console.log('');
  console.log(
    '| Model | Ollama | F1 | p95 (s) | RSS (GB) | JSON | Ao giac | tok/s | Diem | Pareto | Trang thai |',
  );
  console.log('|---|---|---|---|---|---|---|---|---|---|---|');
  const sorted = [...points].sort((a, b) => a.p95 - b.p95);
  for (const p of sorted) {
    console.log(
      `| ${p.id} | ${p.ollama} | ${p.f1.toFixed(3)} | ${(p.p95 / 1000).toFixed(1)} | ` +
        `${p.rssGb.toFixed(2)} | ${(p.jsonValid * 100).toFixed(1)}% | ${(p.hallucination * 100).toFixed(1)}% | ` +
        `${p.throughput.toFixed(2)} | ${p.score.toFixed(1)} | ${p.onFrontier ? '★' : '-'} | ` +
        `${p.eligible ? 'dat nguong' : `loi: ${p.failed.join(', ')}`} |`,
    );
  }
  console.log('');

  const frontier = eligible.filter((p) => p.onFrontier).sort((a, b) => b.score - a.score);
  if (frontier.length === 0) {
    console.log('KHONG co model nao dat toan bo nguong tuyet doi → chua the chot model.');
    console.log('Can chay them mau / dieu chinh nguong / sua prompt truoc khi chot.');
  } else {
    const best = frontier[0]!;
    console.log(`DIEM PARETO TOT NHAT: ${best.id} (${best.ollama}) — diem tong hop ${best.score.toFixed(1)}/100`);
    console.log('');
    console.log('Luat phap tien khi hoa diem (theo thu tu uu tien §3.15.5):');
    const byHeadroom = [...frontier].sort((a, b) => b.rssGb - a.rssGb);
    const byLatency = [...frontier].sort((a, b) => a.p95 - b.p95);
  const byFamily = [...frontier].sort(
    (a) => new Set(frontier.map((p) => p.family)).size - new Set([a.family]).size,
  );
    console.log(`  1. Giap phep ro rang : ${byHeadroom[0]!.id} (${byHeadroom[0]!.ollama})`);
    console.log(`  2. Headroom RAM      : ${byHeadroom[0]!.id} (${byHeadroom[0]!.rssGb.toFixed(2)} GB)`);
    console.log(`  3. Latency thap nhat : ${byLatency[0]!.id} (${(byLatency[0]!.p95 / 1000).toFixed(1)}s)`);
    console.log(`  4. Tai dung ho model : ${byFamily[0]!.id} (${byFamily[0]!.family})`);
    console.log('');
    console.log('=> De chot 1 model cho production (huong A), can xac nhan them bang');
    console.log('   McNemar + Wilcoxon: pnpm run bench:stats -- --a=<A> --b=<B>');
  }
}
