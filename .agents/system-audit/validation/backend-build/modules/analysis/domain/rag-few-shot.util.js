"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KNOWN_ERROR_TYPES = exports.DEFAULT_TOP_K = exports.DEFAULT_MAX_AGE_DAYS = exports.DEFAULT_MIN_TRUST_SCORE = exports.MAX_FEW_SHOT_STORE = void 0;
exports.cosineSimilarity = cosineSimilarity;
exports.rankFewShot = rankFewShot;
exports.normalizeExample = normalizeExample;
exports.stripIdentifiers = stripIdentifiers;
exports.renderFewShotBlock = renderFewShotBlock;
exports.extractErrorType = extractErrorType;
exports.mapFeedbackLabelToExampleLabel = mapFeedbackLabelToExampleLabel;
exports.computeTrustScore = computeTrustScore;
exports.isEligibleForStore = isEligibleForStore;
exports.embedText = embedText;
exports.MAX_FEW_SHOT_STORE = 50000;
exports.DEFAULT_MIN_TRUST_SCORE = 0.6;
exports.DEFAULT_MAX_AGE_DAYS = 180;
exports.DEFAULT_TOP_K = 5;
function cosineSimilarity(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || a.length !== b.length) {
        return 0;
    }
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        const x = a[i];
        const y = b[i];
        if (!Number.isFinite(x) || !Number.isFinite(y))
            return 0;
        dot += x * y;
        normA += x * x;
        normB += y * y;
    }
    if (normA <= 0 || normB <= 0)
        return 0;
    const sim = dot / (Math.sqrt(normA) * Math.sqrt(normB));
    if (!Number.isFinite(sim))
        return 0;
    return Math.min(1, Math.max(-1, sim));
}
function rankFewShot(examples, query) {
    const topK = query.topK ?? exports.DEFAULT_TOP_K;
    const minTrust = query.minTrustScore ?? exports.DEFAULT_MIN_TRUST_SCORE;
    const maxAgeDays = query.maxAgeDays ?? exports.DEFAULT_MAX_AGE_DAYS;
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    const scored = [];
    for (const ex of examples) {
        if (ex.trustScore < minTrust)
            continue;
        if (ex.createdAt.getTime() < cutoff)
            continue;
        if (query.errorType && ex.errorType !== query.errorType)
            continue;
        if (query.language && ex.language !== query.language)
            continue;
        scored.push({ example: ex, score: cosineSimilarity(query.embedding, ex.embedding) });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).map((s) => s.example);
}
function normalizeExample(input) {
    return {
        errorType: input.errorType,
        columnTraits: stripIdentifiers(input.columnTraits),
        description: stripIdentifiers(input.description),
        label: input.label,
        embedding: input.embedding,
        trustScore: input.trustScore ?? exports.DEFAULT_MIN_TRUST_SCORE,
        language: input.language ?? 'vi',
        createdAt: input.createdAt ?? new Date(),
    };
}
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_RE = /\+?\d[\d .-]{7,}\d/g;
function stripIdentifiers(text) {
    return text
        .replace(EMAIL_RE, '***')
        .replace(PHONE_RE, '***')
        .replace(/\b\d{9,13}\b/g, '***')
        .trim();
}
function renderFewShotBlock(examples) {
    if (examples.length === 0)
        return '';
    const lines = examples.map((ex, i) => {
        const kind = ex.label === 'correct'
            ? 'Mau dung'
            : ex.label === 'false_positive'
                ? 'Mau sai (khong phai loi)'
                : 'Mau bi bo sot';
        return `${i + 1}. [${kind}] ${ex.description} (dac tinh cot: ${ex.columnTraits})`;
    });
    return ['Cac truong hop da biet (chi tham khao, khong co so lieu cua dataset hien tai):', ...lines].join('\n');
}
exports.KNOWN_ERROR_TYPES = ['DQ-01', 'DQ-02', 'DQ-03', 'DQ-04', 'DQ-05'];
function extractErrorType(findingId) {
    if (!findingId || typeof findingId !== 'string')
        return 'general';
    const head = findingId.trim().split(':')[0].trim().toUpperCase();
    const m = /^DQ-0([1-5])$/.exec(head);
    if (m)
        return `DQ-0${m[1]}`;
    const m2 = /DQ-0?([1-5])/.exec(head);
    if (m2)
        return `DQ-0${m2[1]}`;
    return 'general';
}
function mapFeedbackLabelToExampleLabel(label) {
    if (label === 'correct' || label === 'partially_correct')
        return 'correct';
    if (label === 'false_positive')
        return 'false_positive';
    if (label === 'missed_issue')
        return 'missed_issue';
    return null;
}
function computeTrustScore(agreementCount) {
    const n = Number.isFinite(agreementCount) ? Math.floor(agreementCount) : 0;
    if (n >= 5)
        return 0.95;
    if (n === 4)
        return 0.9;
    if (n === 3)
        return 0.8;
    if (n === 2)
        return 0.65;
    if (n === 1)
        return 0.5;
    return 0.4;
}
function isEligibleForStore(agreementCount, trustScore) {
    return agreementCount >= 3 || trustScore >= exports.DEFAULT_MIN_TRUST_SCORE;
}
function embedText(text, dim = 64) {
    const d = Number.isFinite(dim) && dim > 0 ? Math.min(Math.floor(dim), 4096) : 64;
    const vec = new Array(d).fill(0);
    if (!text || typeof text !== 'string')
        return vec;
    const s = text.trim().toLowerCase();
    if (s.length === 0)
        return vec;
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
    for (let i = 0; i < d; i++)
        norm += vec[i] * vec[i];
    norm = Math.sqrt(norm);
    if (!(norm > 0))
        return vec;
    for (let i = 0; i < d; i++)
        vec[i] = vec[i] / norm;
    return vec;
}
//# sourceMappingURL=rag-few-shot.util.js.map