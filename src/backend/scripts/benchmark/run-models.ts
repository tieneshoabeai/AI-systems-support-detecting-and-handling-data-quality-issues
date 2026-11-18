/**
 * Runner benchmark 5 model AI — Phần 12 v8 §3.15.5.
 *
 * Cách dùng:
 *   pnpm run bench:models                      # chạy đủ 5 model, ghi báo cáo
 *   pnpm run bench:models -- --model=M3        # chỉ 1 model
 *   pnpm run bench:models -- --samples=20 --repeats=1   # chạy nhanh để thử
 *   pnpm run bench:models -- --judge=false     # bỏ qua LLM-as-judge
 *
 * Nguyên tắc:
 *  - Cùng prompt template, cùng tham số suy luận cho mọi model.
 *  - Chạy trên đúng phần cứng production (CPU-only).
 *  - Mỗi model chạy REPEATS lần → mean ± std.
 *  - Lượt warm-up bị loại khỏi phép đo latency.
 *  - RAM Guard chặn nhận job mới khi RAM không đủ.
 */
import fs from 'node:fs';
import path from 'node:path';
import { extractJsonObject } from '../../src/modules/analysis/application/ports/ai-inference.port';
import { generateGoldSet, describeGoldSet, type GoldSample } from './gold-set';
import {
  CANDIDATES,
  GOLD_SIZE,
  INFERENCE_PARAMS,
  METRICS,
  OLLAMA_BASE_URL,
  REPEATS,
  REQUEST_TIMEOUT_MS,
  thresholdFailures,
  type CandidateModel,
} from './models';
import { buildBenchmarkPrompt } from './prompt';
import { evaluateRamStatus, readEngineRssBytes } from './ram-guard';
import { postJson } from './http-client';
import { aggregate, scoreSample, type InferenceOutcome, type ScoredSample } from './scorer';
import { judgeExplanations, resolveJudgeModel } from './judge';

const args = parseArgs(process.argv.slice(2));

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const a of argv) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    if (!m?.[1]) continue;
    out[m[1]] = m[2] ?? true;
  }
  return out;
}

interface OllamaChatResponse {
  message?: { role?: string; content?: string; thinking?: string };
  error?: string;
  done?: boolean;
  done_reason?: string;
  eval_count?: number;
  prompt_eval_count?: number;
  eval_duration?: number;
  total_duration?: number;
  load_duration?: number;
}

interface OllamaGenerateResponse {
  response?: string;
  thinking?: string;
  error?: string;
  done?: boolean;
  done_reason?: string;
  eval_count?: number;
  prompt_eval_count?: number;
  eval_duration?: number;
  total_duration?: number;
  load_duration?: number;
  message?: { role?: string; content?: string; thinking?: string };
}

/** Gọi Ollama `/api/generate` với tham số cố định của benchmark. */
/**
 * Gọi Ollama `/api/chat` với tham số cố định của benchmark.
 *
 * Dùng `/api/chat` (không phải `/api/generate`) vì **chỉ `/api/chat` mới hỗ trợ
 * tham số `think`** — đây là cơ chế bật/tắt thinking mode của hướng A.
 * `/api/generate` bỏ qua `think` → Qwen3 vẫn sinh thinking tokens → latency
 * và throughput vượt ngưỡng không phải do model.
 */
async function callOllama(
  model: string,
  prompt: string,
  think: boolean,
): Promise<{ ok: boolean; data?: OllamaGenerateResponse; error?: string; durationMs: number }> {
  // Dùng `node:http` thay `fetch`: undici mặc định headersTimeout = 300s →
  // mọi lượt suy luận CPU-only dài hơn 5 phút đều bị fail (xem http-client.ts).
  const res = await postJson(
    `${OLLAMA_BASE_URL}/api/chat`,
    {
      model,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      format: 'json',
      think,
      options: {
        temperature: INFERENCE_PARAMS.temperature,
        top_p: INFERENCE_PARAMS.top_p,
        seed: INFERENCE_PARAMS.seed,
        num_predict: INFERENCE_PARAMS.num_predict,
        num_ctx: INFERENCE_PARAMS.num_ctx,
      },
    },
    REQUEST_TIMEOUT_MS,
  );
  if (res.error !== null) {
    return { ok: false, error: res.error, durationMs: res.durationMs };
  }
  let data: OllamaChatResponse;
  try {
    data = JSON.parse(res.body) as OllamaChatResponse;
  } catch {
    return {
      ok: false,
      error: `response khong phai JSON (HTTP ${res.status}): ${res.body.slice(0, 200)}`,
      durationMs: res.durationMs,
    };
  }
  if (res.status < 200 || res.status >= 300) {
    return {
      ok: false,
      error: data.error ?? `HTTP ${res.status}`,
      durationMs: res.durationMs,
    };
  }
  const content = data.message?.content ?? '';
  const thinking = data.message?.thinking ?? '';
  // `done_reason = 'length'` ⇒ Ollama cắt cụt output → JSON thường KHÔNG parse được.
  // Ghi nhận để báo cáo phân biệt "model trả sai" với "bị cắt do giới hạn token".
  if (data.done_reason === 'length') {
    return {
      ok: true,
      data: {
        ...data,
        response: content,
        thinking,
        error: `output_truncated: done_reason=length (num_predict=${INFERENCE_PARAMS.num_predict})`,
        eval_count: data.eval_count ?? (thinking ? countTokens(thinking) : 0),
      },
      durationMs: res.durationMs,
    };
  }
  return {
    ok: true,
    data: {
      ...data,
      response: content,
      thinking,
      eval_count: data.eval_count ?? (thinking ? countTokens(thinking) : 0),
    },
    durationMs: res.durationMs,
  };
}

/** Ước lượng số token của phần thinking (chỉ để thống kê, không cần chính xác tuyệt đối). */
function countTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.round(text.length / 4));
}

/** Thời gian chờ trước khi retry (ms) — cho engine giải phóng KV cache. */
const RETRY_BACKOFF_MS = Number(process.env.BENCH_RETRY_BACKOFF_MS ?? 5000);

/**
 * Số lần retry khi gặp lỗi HẠ TẦNG (engine bị OOM-killer giết).
 *
 * Sau OOM, Ollama cần vài chục giây để khởi động lại và nạp lại model
 * ⇒ retry ngay sẽ thất bại lần nữa.
 */
const MAX_INFRA_RETRIES = Number(process.env.BENCH_MAX_INFRA_RETRIES ?? 2);

/** Thời gian chờ giữa các lần retry lỗi hạ tầng (ms). */
const INFRA_RETRY_BACKOFF_MS = Number(process.env.BENCH_INFRA_BACKOFF_MS ?? 60000);

/** Ngủ không chặn event loop. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Phân biệt lỗi HẠ TẦNG (OOM / engine chết) với lỗi của model.
 *
 * Engine bị OOM-killer giết ⇒ socket đóng đột ngột (`socket hang up` /
 * `ECONNRESET`). Đây **không phải** lỗi model ⇒ không tính vào `failure_rate`.
 */
export { isInfraError } from './infra-error';

/** Chuyển phản hồi Ollama thành `InferenceOutcome`. */
function toOutcome(res: {
  ok: boolean;
  data?: OllamaGenerateResponse;
  error?: string;
  durationMs: number;
}): InferenceOutcome {
  const engineRssBytes = readEngineRssBytes();
  if (!res.ok || !res.data) {
    const message = res.error ?? 'unknown_error';
    return {
      durationMs: res.durationMs,
      evalTokens: 0,
      promptTokens: 0,
      tokensPerSecond: 0,
      rawText: '',
      jsonValid: false,
      parsed: null,
      error: message,
      retryable:
        /abort|timeout|ECONN|EPIPE|socket hang up|fetch failed|OOM|memory|ECONNRESET/i.test(
          message,
        ),
      engineRssBytes,
      infraError: isInfraError(message),
    };
  }
  const d = res.data;
  const rawText = d.response ?? '';
  const evalNs = d.eval_duration ?? 0;
  const evalTokens = d.eval_count ?? 0;
  const tokensPerSecond = evalNs > 0 ? evalTokens / (evalNs / 1e9) : 0;
  const parsed = extractJsonObject(rawText);
  // Phản hồi bị cắt cụt → JSON không parse được nhưng KHÔNG phải lỗi của model.
  // Đánh dấu riêng để không tính nhầm vào `failure_rate` (độ ổn định vận hành).
  const truncated = d.done_reason === 'length';
  return {
    durationMs: res.durationMs,
    evalTokens,
    promptTokens: d.prompt_eval_count ?? 0,
    tokensPerSecond,
    rawText,
    jsonValid: parsed !== null,
    parsed: parsed as Record<string, unknown> | null,
    error: truncated ? null : (d.error ?? null),
    retryable: false,
    engineRssBytes,
    truncated,
  };
}

export interface ModelRunResult {
  candidate: CandidateModel;
  think: boolean;
  scored: ScoredSample[];
  outcomes: InferenceOutcome[];
  repeats: {
    repeat: number;
    f1_micro: number | null;
    json_valid_rate: number | null;
    hallucination_rate: number | null;
    p95_latency_ms: number | null;
    throughput_tok_s: number | null;
    failure_rate: number | null;
  }[];
  metrics: Record<string, number | null>;
  failedThresholds: string[];
  elapsedMs: number;
}

/** Chạy 1 model trên toàn bộ tập vàng, `repeats` lần. */
async function runModel(
  candidate: CandidateModel,
  samples: GoldSample[],
  repeats: number,
  think: boolean,
  ramGuardEnabled: boolean,
  onProgress: (done: number, total: number) => void,
  /** Gọi sau mỗi lần lặp để lưu checkpoint (full benchmark có thể chạy nhiều ngày). */
  onCheckpoint?: (partial: ModelRunResult) => void,
): Promise<ModelRunResult> {
  const started = Date.now();
  const allScored: ScoredSample[] = [];
  const allOutcomes: InferenceOutcome[] = [];
  const perRepeat: ModelRunResult['repeats'] = [];

  // Warm-up: 1 lượt với mẫu đầu — loại khỏi phép đo (chi phí nạp KV cache).
  await callOllama(candidate.ollama, buildBenchmarkPrompt(samples[0]!.payload), think);

  for (let r = 1; r <= repeats; r++) {
    const repeatScored: ScoredSample[] = [];
    const repeatOutcomes: InferenceOutcome[] = [];
    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i]!;
      const ram = evaluateRamStatus({
        ramGuardPercent: Number(process.env.AI_RAM_GUARD_PERCENT ?? 85),
        minRamGb: Number(process.env.AI_MIN_RAM_GB ?? 12),
        skip: !ramGuardEnabled,
      });
      if (ram.blocked) {
        const blockedOutcome: InferenceOutcome = {
          durationMs: 0,
          evalTokens: 0,
          promptTokens: 0,
          tokensPerSecond: 0,
          rawText: '',
          jsonValid: false,
          parsed: null,
          error: `ram_guard_blocked: ${ram.reason}`,
          retryable: true,
          engineRssBytes: ram.engineRssBytes,
        };
        repeatOutcomes.push(blockedOutcome);
        repeatScored.push(scoreSample(sample, blockedOutcome));
        onProgress(i + 1, samples.length);
        continue;
      }
      const prompt = buildBenchmarkPrompt(sample.payload);
      const res = await callOllama(candidate.ollama, prompt, think);
      let outcome = toOutcome(res);
      if (outcome.error !== null && outcome.retryable) {
        // Backoff ngắn trước khi thử lại: engine đang giải phóng KV cache
        // sau lượt trước, gọi lại ngay thường bị "socket hang up".
        await sleep(RETRY_BACKOFF_MS);
        const retry = await callOllama(candidate.ollama, prompt, think);
        const retryOutcome = toOutcome(retry);
        outcome = retryOutcome.error === null ? retryOutcome : { ...outcome, retryable: true };
      }
      // Lỗi hạ tầng (engine bị OOM-killer giết) cần thời gian để Ollama
      // khởi động lại ⇒ retry chậm hơn, tối đa `MAX_INFRA_RETRIES` lần.
      let infraAttempts = 0;
      while (outcome.infraError === true && infraAttempts < MAX_INFRA_RETRIES) {
        infraAttempts += 1;
        console.log(
          `\n  [infra] loi ha tang tang (${outcome.error}) — cho engine khoi dong lai ${INFRA_RETRY_BACKOFF_MS / 1000}s`,
        );
        await sleep(INFRA_RETRY_BACKOFF_MS);
        const retry = await callOllama(candidate.ollama, prompt, think);
        const retryOutcome = toOutcome(retry);
        outcome = retryOutcome.error === null ? retryOutcome : retryOutcome;
      }
      repeatOutcomes.push(outcome);
      repeatScored.push(scoreSample(sample, outcome));
      onProgress(i + 1, samples.length);
    }
    const agg = aggregate(repeatScored, repeatOutcomes);
    perRepeat.push({
      repeat: r,
      f1_micro: agg.f1_micro,
      json_valid_rate: agg.json_valid_rate,
      hallucination_rate: agg.hallucination_rate,
      p95_latency_ms: agg.p95_latency_ms,
      throughput_tok_s: agg.throughput_tok_s,
      failure_rate: agg.failure_rate,
    });
    allScored.push(...repeatScored);
    allOutcomes.push(...repeatOutcomes);
    // Checkpoint sau mỗi lần lặp: full benchmark có thể chạy ~15 ngày trên CPU-only
    // ⇒ không được để mất kết quả nếu tiến trình bị kill giữa chừng.
    onCheckpoint?.({
      candidate,
      think,
      scored: [...allScored],
      outcomes: [...allOutcomes],
      repeats: [...perRepeat],
      metrics: buildMetrics(allScored, allOutcomes),
      failedThresholds: [],
      elapsedMs: Date.now() - started,
    });
  }

  const agg = aggregate(allScored, allOutcomes) as unknown as Record<string, number | null>;
  const metrics: Record<string, number | null> = {};
  for (const m of METRICS) metrics[m.key] = agg[m.key] ?? null;
  return {
    candidate,
    think,
    scored: allScored,
    outcomes: allOutcomes,
    repeats: perRepeat,
    metrics,
    failedThresholds: thresholdFailures(metrics),
    elapsedMs: Date.now() - started,
  };
}

/** Gom 9 chỉ số từ tập kết quả đã chấm (dùng cho checkpoint). */
function buildMetrics(scored: ScoredSample[], outcomes: InferenceOutcome[]): Record<string, number | null> {
  const agg = aggregate(scored, outcomes) as unknown as Record<string, number | null>;
  const metrics: Record<string, number | null> = {};
  for (const m of METRICS) metrics[m.key] = agg[m.key] ?? null;
  return metrics;
}

/** Chạy LLM-as-judge chấm chéo (thang 1..5) cho các mẫu có giải thích. */
async function applyJudge(
  result: ModelRunResult,
  judgeModel: string,
  samples: GoldSample[],
): Promise<void> {
  const index = new Map(samples.map((s) => [s.id, s]));
  const targets = result.scored
    .map((s) => ({ scored: s, sample: index.get(s.sampleId) }))
    .filter((x): x is { scored: ScoredSample; sample: GoldSample } => Boolean(x.sample));
  if (targets.length === 0) return;
  const scores = await judgeExplanations(
    judgeModel,
    targets.map((t) => ({
      sampleId: t.scored.sampleId,
      explanation: t.scored.explanation,
      stats: t.sample.payload.stats,
    })),
  );
  for (const t of targets) {
    const v = scores.get(t.scored.sampleId);
    if (v !== undefined) t.scored.judgeScore = v;
  }
  const agg = aggregate(result.scored, result.outcomes);
  result.metrics['explanation_quality'] = agg.explanation_quality ?? null;
}

async function main(): Promise<void> {
  const modelFilter = typeof args['model'] === 'string' ? String(args['model']) : null;
  const samples = Number(args['samples'] ?? GOLD_SIZE);
  const repeats = Number(args['repeats'] ?? REPEATS);
  const useJudge = args['judge'] !== 'false' && args['judge'] !== false;
  const think = args['think'] === 'true' || args['think'] === true;
  const requestedJudgeModel = typeof args['judgeModel'] === 'string' ? String(args['judgeModel']) : null;
  /**
   * RAM Guard: mặc định BẬT theo đặc tả (85% / 12 GB).
   * Trên máy dev dùng chung (Cursor/Firefox chiếm >12 GB) cần tắt để chạy được:
   *   `--ram-guard=off` hoặc `AI_RAM_GUARD=off`.
   * Khi tắt, báo cáo vẫn ghi lại trạng thái RAM tại thời điểm chạy.
   */
  const ramGuardEnabled =
    args['ram-guard'] !== 'off' &&
    args['ram-guard'] !== false &&
    process.env.AI_RAM_GUARD !== 'off';

  const goldSet = generateGoldSet(samples);
  const distribution = describeGoldSet(goldSet);

  console.log('=== BENCHMARK 5 MODEL AI (Phan 12 v8 muc 3.15.5) ===');
  console.log(`Tau mau: ${goldSet.length} | Repeats: ${repeats} | Think: ${think}`);
  console.log(`Phan bo: ${JSON.stringify(distribution)}`);
  console.log('');

  const targets = modelFilter
    ? CANDIDATES.filter((c) => c.id === modelFilter || c.ollama === modelFilter)
    : CANDIDATES;
  if (targets.length === 0) {
    console.error(`Khong tim thay model "${modelFilter}"`);
    process.exitCode = 1;
    return;
  }

  const results: ModelRunResult[] = [];
  const outDir = path.resolve(process.cwd(), '../../docs/test-reports');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);

  for (const candidate of targets) {
    console.log(`--- ${candidate.id} (${candidate.ollama}) ---`);
    const result = await runModel(
      candidate,
      goldSet,
      repeats,
      think,
      ramGuardEnabled,
      (done, total) => {
        if (done % 10 === 0 || done === total) {
          process.stdout.write(`  ${done}/${total}\r`);
        }
      },
      // Checkpoint: ghi báo cáo tăng dần sau mỗi lần lặp để không mất kết quả
      // khi full benchmark chạy nhiều ngày.
      (partial) => {
        writeJsonResult(partial, outDir, stamp);
      },
    );
    process.stdout.write('\n');
    if (useJudge) {
      // Judge phải KHÁC HỌ với model đang được chấm (chấm chéo theo §3.15.5).
      const judge = resolveJudgeModel(requestedJudgeModel, candidate);
      if (judge !== requestedJudgeModel) {
        console.log(
          `  [judge] ${requestedJudgeModel} cung họ voi ${candidate.id} → dung ${judge} de cham cheo`,
        );
      }
      await applyJudge(result, judge, goldSet);
    }
    results.push(result);
    const m = result.metrics;
    console.log(
      `  F1=${fmt(m['f1_micro'])} JSON=${fmt(m['json_valid_rate'])} aoGiac=${fmt(m['hallucination_rate'])} ` +
        `p95=${fmt(m['p95_latency_ms'])}ms tok/s=${fmt(m['throughput_tok_s'])} RSS=${fmtGb(m['peak_rss_bytes'])} ` +
        `fail=${fmt(m['failure_rate'])} judge=${fmt(m['explanation_quality'])}`,
    );
    console.log(`  Nguong that bai: ${result.failedThresholds.join(', ') || 'khong co'}`);
    console.log('');
    // Ghi báo cáo cuối cho model vừa xong (kể cả khi có judge).
    writeModelReport(result, outDir, stamp);
    writeJsonResult(result, outDir, stamp);
  }

  const perModel = results.map((r) => path.join(outDir, `benchmark-${r.candidate.id}-${stamp}.md`));
  writeSummaryReport(results, perModel, outDir, stamp, distribution);

  console.log('=== HOAN TAT ===');
  console.log(`Bao cao: ${outDir}`);
}

function fmt(v: number | null | undefined): string {
  if (v === null || v === undefined) return 'n/a';
  return v.toFixed(3);
}

function fmtGb(v: number | null | undefined): string {
  if (v === null || v === undefined) return 'n/a';
  return `${(v / 1024 ** 3).toFixed(2)}GB`;
}

function writeModelReport(result: ModelRunResult, outDir: string, stamp: string): string {
  const c = result.candidate;
  const file = path.join(outDir, `benchmark-${c.id}-${stamp}.md`);
  const lines: string[] = [];
  lines.push(`# Benchmark ${c.id} — ${c.ollama} (${c.params} ${c.quant})`);
  lines.push('');
  lines.push(`- Ngày: ${new Date().toISOString()}`);
  lines.push(`- Họ model: ${c.family} | Think mode: ${result.think}`);
  lines.push(`- Ghi chú: ${c.note}`);
  lines.push('');
  lines.push('## 9 chỉ số');
  lines.push('');
  lines.push('| Trọng số | Chỉ số | Giá trị | Ngưỡng | Đạt |');
  lines.push('|---|---|---|---|---|');
  for (const m of METRICS) {
    const v = result.metrics[m.key];
    const ok =
      v === null || v === undefined
        ? 'n/a'
        : m.dir === 'higher'
          ? v >= m.threshold
            ? '✅'
            : '❌'
          : v <= m.threshold
            ? '✅'
            : '❌';
    lines.push(
      `| ${m.weight} | ${m.label} | ${fmt(v)} | ${m.dir === 'higher' ? '≥' : '≤'} ${m.threshold} | ${ok} |`,
    );
  }
  lines.push('');
  lines.push(`**Ngưỡng tuyệt đối bị rớt:** ${result.failedThresholds.join(', ') || 'không có'}`);
  lines.push('');
  lines.push('## Mean ± std theo lần lặp');
  lines.push('');
  lines.push('| Lần | F1 micro | JSON | Ảo giác | p95 (ms) | tok/s | Lỗi |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const r of result.repeats) {
    lines.push(
      `| ${r.repeat} | ${fmt(r.f1_micro)} | ${fmt(r.json_valid_rate)} | ${fmt(r.hallucination_rate)} | ${fmt(r.p95_latency_ms)} | ${fmt(r.throughput_tok_s)} | ${fmt(r.failure_rate)} |`,
    );
  }
  lines.push('');
  lines.push(`Thời gian chạy: ${(result.elapsedMs / 1000).toFixed(1)}s | Số lượt đo: ${result.outcomes.length}`);
  const truncatedCount = result.outcomes.filter((o) => o.truncated === true).length;
  if (truncatedCount > 0) {
    lines.push('');
    lines.push(
      `> ⚠️ **${truncatedCount}/${result.outcomes.length} lượt bị Ollama cắt cụt** (\`done_reason=length\`) → JSON không parse được. ` +
        `Cần tăng \`num_predict\` (hiện ${INFERENCE_PARAMS.num_predict}).`,
    );
  }
  lines.push('');
  lines.push('## Chi tiết mẫu');
  lines.push('');
  lines.push('| Mẫu | Loại | Thực tế | Dự đoán | Đúng | FP | Bỏ sót | Claim | Loại bởi grounding | Điểm judge |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const s of result.scored) {
    lines.push(
      `| ${s.sampleId} | ${s.kind} | ${s.truthPositive ? 'có vấn đề' : 'sạch'} | ${s.predPositive ? 'có' : 'không'} | ${s.correct ? '✅' : '❌'} | ${s.falsePositive ? 'FP' : '-'} | ${s.missedIssue ? 'MISS' : '-'} | ${s.totalClaims} | ${s.droppedClaims} | ${s.judgeScore ?? '-'} |`,
    );
  }
  lines.push('');
  const errors = result.outcomes
    .map((o, i) => ({ i, error: o.error }))
    .filter((x): x is { i: number; error: string } => x.error !== null);
  if (errors.length > 0) {
    lines.push('## Lỗi ghi nhận');
    lines.push('');
    lines.push('| # | Lỗi |');
    lines.push('|---|---|');
    for (const e of errors.slice(0, 20)) {
      lines.push(`| ${e.i + 1} | ${e.error.replace(/\|/g, '\\|')} |`);
    }
    if (errors.length > 20) lines.push(`| … | còn ${errors.length - 20} lỗi |`);
    lines.push('');
  }
  fs.writeFileSync(file, lines.join('\n'));
  return file;
}

function writeJsonResult(result: ModelRunResult, outDir: string, stamp: string): string {
  const c = result.candidate;
  const file = path.join(outDir, `benchmark-${c.id}-${stamp}.json`);
  const payload = {
    candidateId: c.id,
    ollama: c.ollama,
    family: c.family,
    params: c.params,
    quant: c.quant,
    think: result.think,
    generatedAt: new Date().toISOString(),
    metrics: result.metrics,
    failedThresholds: result.failedThresholds,
    repeats: result.repeats,
    /** Phản hồi thô của từng lượt — dùng chẩn đoán vì sao JSON không parse được. */
    raw: result.outcomes.map((o) => ({
      durationMs: o.durationMs,
      evalTokens: o.evalTokens,
      promptTokens: o.promptTokens,
      tokensPerSecond: o.tokensPerSecond,
      jsonValid: o.jsonValid,
      error: o.error,
      rawText: o.rawText,
    })),
    scored: result.scored.map((s) => ({
      sampleId: s.sampleId,
      kind: s.kind,
      truthPositive: s.truthPositive,
      predPositive: s.predPositive,
      correct: s.correct,
      falsePositive: s.falsePositive,
      missedIssue: s.missedIssue,
      droppedClaims: s.droppedClaims,
      totalClaims: s.totalClaims,
      correctPairs: s.correctPairs,
      claimedPairs: s.claimedPairs,
      truthPairs: s.truthPairs,
      correctVif: s.correctVif,
      truthVif: s.truthVif,
      correctIssues: s.correctIssues,
      claimedIssues: s.claimedIssues,
      truthIssues: s.truthIssues,
      classScores: s.classScores,
      judgeScore: s.judgeScore,
    })),
  };
  fs.writeFileSync(file, JSON.stringify(payload, null, 2));
  return file;
}

function writeSummaryReport(
  results: ModelRunResult[],
  perModelFiles: string[],
  outDir: string,
  stamp: string,
  distribution: ReturnType<typeof describeGoldSet>,
): string {
  const file = path.join(outDir, `benchmark-summary-${stamp}.md`);
  const lines: string[] = [];
  lines.push(`# Tổng hợp benchmark 5 model AI — ${stamp}`);
  lines.push('');
  lines.push(`- Số mẫu vàng: ${distribution.total}`);
  lines.push(`- Phân bổ loại mẫu: ${JSON.stringify(distribution.byKind)}`);
  lines.push(`- Phân bổ mức ảnh hưởng: ${JSON.stringify(distribution.bySeverity)}`);
  lines.push(`- Mẫu bẫy: ${JSON.stringify(distribution.byTrap)}`);
  lines.push('');
  lines.push('## Điểm 9 chỉ số');
  lines.push('');
  lines.push('| Model | ' + METRICS.map((m) => m.key).join(' | ') + ' | Rớt ngưỡng |');
  lines.push('|---|' + METRICS.map(() => '---').join('|') + '|---|');
  for (const r of results) {
    lines.push(
      `| ${r.candidate.id} ${r.candidate.ollama} | ` +
        METRICS.map((m) => fmt(r.metrics[m.key])).join(' | ') +
        ` | ${r.failedThresholds.join(', ') || '—'} |`,
    );
  }
  lines.push('');
  lines.push('## Ngưỡng tuyệt đối');
  lines.push('');
  lines.push('| Chỉ số | Ngưỡng | Trọng số |');
  lines.push('|---|---|---|');
  for (const m of METRICS) {
    lines.push(`| ${m.label} | ${m.dir === 'higher' ? '≥' : '≤'} ${m.threshold} | ${m.weight} |`);
  }
  lines.push('');
  lines.push('## Báo cáo từng model');
  lines.push('');
  for (const f of perModelFiles) lines.push(`- ${path.basename(f)}`);
  lines.push('');
  lines.push('## Đường Pareto');
  lines.push('');
  lines.push('Trục X = p95 latency (ms), trục Y = F1 micro, kích thước điểm = RSS đỉnh.');
  lines.push('');
  lines.push('| Model | p95 (ms) | F1 micro | RSS |');
  lines.push('|---|---|---|---|');
  for (const r of results) {
    lines.push(
      `| ${r.candidate.id} | ${fmt(r.metrics['p95_latency_ms'])} | ${fmt(r.metrics['f1_micro'])} | ${fmtGb(r.metrics['peak_rss_bytes'])} |`,
    );
  }
  fs.writeFileSync(file, lines.join('\n'));
  return file;
}

/**
 * Chỉ chạy benchmark khi file được thực thi trực tiếp.
 *
 * `require.main === module` chống việc `import` file này vào test sẽ vô tình
 * kích hoạt cả benchmark (tốn hàng giờ suy luận CPU-only).
 */
if (require.main === module) {
  void main().catch((err: unknown) => {
    const msg = err instanceof Error ? (err.stack ?? err.message) : String(err);
    console.error(msg);
    process.exitCode = 1;
  });
}
