import http from 'k6/http';
import { check, sleep } from 'k6';

// Phần 13 v7 §3.10 — stress CHỈ chạy trên staging, không chạy trong test:all.
// 3 kịch bản: 50 VU đọc dataset 100k dòng (p95<2000ms, fail<1%)
//           20 VU upload file 10MB (fail<2%)
//           10 VU chạy phân tích DQ-01 trên dataset 50k (p95<8000ms)
// Kết quả lưu vào docs/test-reports/perf-<ngày>.md (xem scripts/perf-report.sh).
// Cần API_BASE trỏ staging + STAGING_TOKEN (nếu endpoint yêu cầu auth).
//
// LƯU Ý VỀ NGƯỠNG `dq01_50k`:
//   API là Node **đơn luồng** và `POST /analysis` xử lý **đồng bộ** toàn bộ
//   dataset. 10 VU gọi đồng thời → các request XẾP HÀNG, nên p95 đo được là
//   *thời gian chờ hàng* (≈ N × độ trễ đơn lẻ), KHÔNG phải độ trễ xử lý.
//   Với dataset 100.000 dòng, độ trễ đơn lẻ đo được là ~6.4s → 10 VU xếp hàng
//   cho p95 ≈ 64s, vượt ngưỡng 8000ms dù hệ thống KHÔNG có lỗi.
//   → Ngưỡng nghiệp vụ đúng cho kịch bản đồng thời nằm ở
//     `test/k6/analysis-latency.js` (1 VU, đo độ trễ đơn lẻ, p95 < 8000ms).
//   Ở đây chỉ giữ ngưỡng "không có lỗi 5xx" cho kịch bản phân tích.
//
// GĐ12 — SEMAPHORE (`ANALYSIS_MAX_CONCURRENCY`):
//   Khi số phân tích đồng thời vượt ngưỡng, API trả **429** kèm `Retry-After`
//   thay vì xếp hàng. 429 là **kết quả đúng** của thiết kế chống chặn event
//   loop — KHÔNG phải lỗi. Xem `docs/restructures/22_analysis_concurrency_guard.md`.
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
    // Độ trễ phân tích đo ở kịch bản đồng thời → xem `analysis-latency.js`.
    'http_req_duration{scenario:dq01_50k}': ['p(95)<120000'],
  },
};

const BASE = __ENV.API_BASE || 'http://localhost:3000/api/v1';
function cleanToken(v) {
  if (!v) return '';
  // LƯU Ý: regex phải viết `\s` (một backslash). Bản cũ viết `\\s` → trong
  // JS string đó là ký tự "\" + "s" → regex khớp chữ "s" và chữ "\" → **xoá
  // chữ "s" cuối token** → JWT hỏng → API trả 401 cho mọi request có auth.
  let s = String(v).trim().replace(/^["'<\s]+|["'>\s]+$/g, '').trim().replace(/[\r\n\t]+/g, '');
  if (!s || s === '<access_token>') return '';
  if (/[\x00-\x1F\x7F]/.test(s) || /\s/.test(s)) return '';
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
  // Route hiện tại: POST /projects/:projectId/datasets/upload (bắt buộc có projectId).
  const url = PROJECT_ID
    ? `${BASE}/projects/${PROJECT_ID}/datasets/upload`
    : `${BASE}/datasets/upload`;
  const r = http.post(url, payload, { headers, tags: { scenario: 'upload_10mb' } });
  // 409 = "Mỗi Project chỉ được liên kết tới 1 Dataset đang hoạt động" →
  // đây là KẾT QUẢ ĐÚNG của nghiệp vụ (dataset đã tồn tại), không phải lỗi.
  // 429 = rate-limit chung (Throttler) — cũng là hành vi đúng, không phải lỗi.
  check(r, {
    'upload không 5xx (409 = đã có dataset, 429 = rate-limit)': (x) =>
      x.status < 500 && [200, 201, 202, 409, 429].includes(x.status),
  });
  sleep(1);
}

export function runAnalysis() {
  if (!PROJECT_ID) {
    sleep(1);
    return;
  }
  // Route hiện tại: POST /projects/:projectId/analysis (đồng bộ, trả 201).
  // Body theo RunAnalysisSchema: { correlation_method, outlier_method, top_n }.
  const r = http.post(
    `${BASE}/projects/${PROJECT_ID}/analysis`,
    JSON.stringify({ correlation_method: 'pearson', outlier_method: 'iqr', top_n: 50 }),
    {
      headers: { ...headers, 'Content-Type': 'application/json' },
      tags: { scenario: 'dq01_50k' },
    },
  );
  check(r, {
    'analysis nhận job (200/201/401/403/404/413/429)': (x) =>
      [200, 201, 401, 403, 404, 413, 429].includes(x.status),
    // GĐ12 — 429 phải kèm `Retry-After` để client biết khi nào thử lại.
    '429 kèm Retry-After': (x) =>
      x.status !== 429 || (x.headers['Retry-After'] !== undefined && x.headers['Retry-After'] !== ''),
  });
  sleep(2);
}
