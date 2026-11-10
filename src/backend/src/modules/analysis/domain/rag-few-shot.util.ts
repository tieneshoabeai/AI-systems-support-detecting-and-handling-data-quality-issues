/**
 * Phan 12 v8 §3.16.4 — Co che T1: RAG tu nhan xet nguoi dung.
 *
 * Quyet dinh nhom C: Vector store cho kho mau (T1) = COSINE SIMILARITY THUAN TRONG MONGODB
 * (khong them ha tang Vector Search rieng). Cap toi da 50.000 mau (FIFO).
 *
 * - Truy van vector bang embedding CHAY CUC BO (Qwen3-Embedding-0.6B) — khong dung API ngoai.
 * - Top-k = 5, loc theo loai loi + ngon ngu (tieng Viet).
 * - Diem tin cay >= AI_RAG_MIN_TRUST_SCORE (mac dinh 0.6) moi duoc dung.
 * - Mau cu hon 180 ngay → can danh gia lai (loai khoi kho).
 */

export interface FewShotExample {
  /** loai loi DQ-01..DQ-05 */
  errorType: string;
  /** dac tinh cot (chuoi da chuan hoa, khong PII) */
  columnTraits: string;
  /** mo ta tinh huong */
  description: string;
  /** nhan nho: 'correct' | 'false_positive' | 'missed_issue' */
  label: 'correct' | 'false_positive' | 'missed_issue';
  /** vector embedding */
  embedding: number[];
  /** diem tin cay 0..1 */
  trustScore: number;
  language: string;
  createdAt: Date;
}

export interface RagQuery {
  embedding: number[];
  errorType?: string;
  language?: string;
  topK?: number;
  minTrustScore?: number;
  maxAgeDays?: number;
}

/** Gioi han kho mau (FIFO) — nhom C: cap 50.000 mau. */
export const MAX_FEW_SHOT_STORE = 50000;

/** Do tin cay mac dinh (AI_RAG_MIN_TRUST_SCORE). */
export const DEFAULT_MIN_TRUST_SCORE = 0.6;

/** So ngay toi da truoc khi mau bi loai khoi kho. */
export const DEFAULT_MAX_AGE_DAYS = 180;

/** Top-k mac dinh. */
export const DEFAULT_TOP_K = 5;

/**
 * Tinh do giong nhat cosine giua 2 vector.
 * Vector rong / khac chieu duong → 0.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || a.length !== b.length) {
    return 0;
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (!Number.isFinite(x) || !Number.isFinite(y)) return 0;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  if (normA <= 0 || normB <= 0) return 0;
  const sim = dot / (Math.sqrt(normA) * Math.sqrt(normB));
  if (!Number.isFinite(sim)) return 0;
  return Math.min(1, Math.max(-1, sim));
}

/**
 * Loc theo dieu kien roi cham diem giong nhat, tra toi da topK mau tot nhat.
 * Mang lai dung thu tu (score giam dan).
 */
export function rankFewShot(
  examples: FewShotExample[],
  query: RagQuery,
): FewShotExample[] {
  const topK = query.topK ?? DEFAULT_TOP_K;
  const minTrust = query.minTrustScore ?? DEFAULT_MIN_TRUST_SCORE;
  const maxAgeDays = query.maxAgeDays ?? DEFAULT_MAX_AGE_DAYS;
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

  const scored: { example: FewShotExample; score: number }[] = [];
  for (const ex of examples) {
    if (ex.trustScore < minTrust) continue;
    if (ex.createdAt.getTime() < cutoff) continue;
    if (query.errorType && ex.errorType !== query.errorType) continue;
    if (query.language && ex.language !== query.language) continue;
    scored.push({ example: ex, score: cosineSimilarity(query.embedding, ex.embedding) });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map((s) => s.example);
}

/**
 * Chuan hoa mau truoc khi luu vao kho: bo PII, bo so lieu cu the cu dataset.
 * Chi giu dac tinh nguyen ty.
 */
export function normalizeExample(input: {
  errorType: string;
  columnTraits: string;
  description: string;
  label: FewShotExample['label'];
  embedding: number[];
  trustScore?: number;
  language?: string;
  createdAt?: Date;
}): FewShotExample {
  return {
    errorType: input.errorType,
    columnTraits: stripIdentifiers(input.columnTraits),
    description: stripIdentifiers(input.description),
    label: input.label,
    embedding: input.embedding,
    trustScore: input.trustScore ?? DEFAULT_MIN_TRUST_SCORE,
    language: input.language ?? 'vi',
    createdAt: input.createdAt ?? new Date(),
  };
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_RE = /\+?\d[\d .-]{7,}\d/g;

/** Bo thong tin dinh danh ca nhan + so lieu cu the. */
export function stripIdentifiers(text: string): string {
  return text
    .replace(EMAIL_RE, '***')
    .replace(PHONE_RE, '***')
    .replace(/\b\d{9,13}\b/g, '***')
    .trim();
}

/**
 * Render khoi "Cac truong hop da biet" cho prompt.
 * KHONG chen nhan cua bo benchmark (tranh ro ri dap an).
 */
export function renderFewShotBlock(examples: FewShotExample[]): string {
  if (examples.length === 0) return '';
  const lines = examples.map((ex, i) => {
    const kind =
      ex.label === 'correct'
        ? 'Mau dung'
        : ex.label === 'false_positive'
          ? 'Mau sai (khong phai loi)'
          : 'Mau bi bo sot';
    return `${i + 1}. [${kind}] ${ex.description} (dac tinh cot: ${ex.columnTraits})`;
  });
  return ['Cac truong hop da biet (chi tham khao, khong co so lieu cua dataset hien tai):', ...lines].join(
    '\n',
  );
}

/** Tien ich T1 mo rong (Full T1): embedding cuc bo + anh xa nhan + trust. */

/** Nguon DQ hop le cho kho mau. */
export const KNOWN_ERROR_TYPES = ['DQ-01', 'DQ-02', 'DQ-03', 'DQ-04', 'DQ-05'] as const;

/**
 * Trich loai loi tu findingId dang 'DQ-01:ten-cot' hoac 'DQ-03'.
 * Khong nhan dien duoc → 'general' (van cho phep luu/truy xuat, khong loc theo loai).
 */
export function extractErrorType(findingId: string | null | undefined): string {
  if (!findingId || typeof findingId !== 'string') return 'general';
  const head = findingId.trim().split(':')[0].trim().toUpperCase();
  const m = /^DQ-0([1-5])$/.exec(head);
  if (m) return `DQ-0${m[1]}`;
  const m2 = /DQ-0?([1-5])/.exec(head);
  if (m2) return `DQ-0${m2[1]}`;
  return 'general';
}

/** Nhan feedback → nhan mau kho. 'partially_correct' coi nhu 'correct' (mau dung mot phan). */
export function mapFeedbackLabelToExampleLabel(
  label: string,
): FewShotExample['label'] | null {
  if (label === 'correct' || label === 'partially_correct') return 'correct';
  if (label === 'false_positive') return 'false_positive';
  if (label === 'missed_issue') return 'missed_issue';
  return null;
}

/**
 * Diem tin cay theo so nguoi dong y (agreement_count = so tac gia khac nhau cung nhan).
 * >= 3 nguoi → >= 0.8 (du dieu kien vao kho theo §3.16.4). Ham don dieu, bi chan 0..1.
 */
export function computeTrustScore(agreementCount: number): number {
  const n = Number.isFinite(agreementCount) ? Math.floor(agreementCount) : 0;
  if (n >= 5) return 0.95;
  if (n === 4) return 0.9;
  if (n === 3) return 0.8;
  if (n === 2) return 0.65;
  if (n === 1) return 0.5;
  return 0.4;
}

/** Nguong du dieu kien vao kho: agreement >= 3 hoac trust >= 0.6. */
export function isEligibleForStore(agreementCount: number, trustScore: number): boolean {
  return agreementCount >= 3 || trustScore >= DEFAULT_MIN_TRUST_SCORE;
}

/**
 * Embedding cuc bo xac dinh (deterministic, khong goi API ngoai).
 * Bam token theo char-code + tron vi tri de vector on dinh theo dim.
 * Vector duoc chuan hoa L2 (cosine chi can huong). Text rong → vector 0.
 */
export function embedText(text: string, dim = 64): number[] {
  const d = Number.isFinite(dim) && dim > 0 ? Math.min(Math.floor(dim), 4096) : 64;
  const vec: number[] = new Array(d).fill(0);
  if (!text || typeof text !== 'string') return vec;
  const s = text.trim().toLowerCase();
  if (s.length === 0) return vec;
  const tokens = s.split(/[\s|\/,_;:\-]+/).filter((x) => x.length > 0);
  const items = tokens.length > 0 ? tokens : [s];
  for (const tok of items) {
    let h1 = 2166136261;
    let h2 = 987643211;
    for (let i = 0; i < tok.length; i++) {
      const c = tok.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 16777619);
      h2 = Math.imul(h2 ^ (c + 31), 1597334677);
    }
    const h = (h1 >>> 0) ^ ((h2 >>> 0) * 2654435761 % 4294967296);
    const idx = Math.abs(h) % d;
    const signSource = (h1 >>> 7) & 1;
    const w = 1 + (tok.length % 5) / 5;
    vec[idx] += (signSource === 0 ? 1 : -1) * w;
    vec[(idx + 7) % d] += w * 0.5;
  }
  let norm = 0;
  for (let i = 0; i < d; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (!(norm > 0)) return vec;
  for (let i = 0; i < d; i++) vec[i] = vec[i] / norm;
  return vec;
}
