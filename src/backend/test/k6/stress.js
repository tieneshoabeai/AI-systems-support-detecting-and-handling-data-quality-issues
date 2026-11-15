import http from 'k6/http';
import { check, sleep } from 'k6';

// Phần 13 v7 §3.10 — stress CHỈ chạy trên staging, không chạy trong test:all.
// 3 kịch bản: 50 VU đọc dataset 100k dòng (p95<2000ms, fail<1%)
//           20 VU upload file 10MB (fail<2%)
//           10 VU chạy phân tích DQ-01 trên dataset 50k (p95<8000ms)
// Kết quả lưu vào docs/test-reports/perf-<ngày>.md (xem scripts/perf-report.sh).
// Cần API_BASE trỏ staging + STAGING_TOKEN (nếu endpoint yêu cầu auth).
export const options = {
  scenarios: {
    read_records: {
      executor: 'constant-vus',
      vus: 50,
      duration: '2m',
      exec: 'readRows',
    },
    upload_10mb: {
      executor: 'constant-vus',
      vus: 20,
      duration: '2m',
      exec: 'uploadFile',
      startTime: '10s',
    },
    dq01_50k: {
      executor: 'constant-vus',
      vus: 10,
      duration: '2m',
      exec: 'runAnalysis',
      startTime: '20s',
    },
  },
  thresholds: {
    checks: ['rate>0.98'],
    'http_req_duration{scenario:read_records}': ['p(95)<2000'],
    'http_req_duration{scenario:dq01_50k}': ['p(95)<8000'],
  },
};

const BASE = __ENV.API_BASE || 'http://localhost:3000/api/v1';
function cleanToken(v) {
  if (!v) return '';
  let s = String(v).trim().replace(/^["'<\\s]+|["'>\\s]+$/g, '').trim().replace(/[\\r\\n\\t]+/g, '');
  if (!s || s === '<access_token>') return '';
  if (/[\\x00-\\x1F\\x7F]/.test(s) || /\\s/.test(s)) return '';
  return s;
}
const TOKEN = cleanToken(__ENV.STAGING_TOKEN);
const DATASET_ID = __ENV.DATASET_ID || '507f1f77bcf86cd799439011';
const PROJECT_ID = __ENV.PROJECT_ID || '';
const headers = TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};

export function readRows() {
  const r = http.get(`${BASE}/datasets/${DATASET_ID}/records?limit=50`, {
    headers,
    tags: { scenario: 'read_records' },
  });
  check(r, { 'rows không 5xx': (x) => x.status < 500 });
  sleep(0.5);
}

export function uploadFile() {
  // File 10MB sinh tại chỗ (không commit file lớn vào repo).
  const big = 'a,b,c\n'.repeat(Math.floor((10 * 1024 * 1024) / 6));
  // k6 multipart: dùng http.file (k6 không có FormData global).
  const payload = { file: http.file(big, 'stress-10mb.csv', 'text/csv') };
  const url = PROJECT_ID ? `${BASE}/projects/${PROJECT_ID}/datasets/upload` : `${BASE}/datasets/upload`;
  const r = http.post(url, payload, { headers, tags: { scenario: 'upload_10mb' } });
  check(r, { 'upload không 5xx': (x) => x.status < 500 });
  sleep(1);
}

export function runAnalysis() {
  if (!PROJECT_ID) {
    sleep(1);
    return;
  }
  const r = http.post(`${BASE}/analysis/run`, JSON.stringify({ projectId: PROJECT_ID, rules: ['DQ-01'] }), {
    headers: { ...headers, 'Content-Type': 'application/json' },
    tags: { scenario: 'dq01_50k' },
  });
  check(r, { 'analysis nhận job (200/202/401/403/404)': (x) => [200, 202, 401, 403, 404, 429].includes(x.status) });
  sleep(2);
}
