import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * Phần 13 v7 §3.10 — **độ trễ phân tích đơn lẻ** (không tải đồng thời).
 *
 * Vì sao tách riêng `stress.js`?
 *  - `stress.js` chạy 10 VU gọi `POST /projects/:id/analysis` **đồng thời** trên
 *    cùng một dataset 100k dòng. API là Node **đơn luồng** → các request xếp
 *    hàng, p95 đo được là **thời gian chờ hàng**, không phải độ trễ xử lý.
 *  - Ngưỡng nghiệp vụ cần đo là: **một** yêu cầu phân tích mất bao lâu.
 *
 * Script này đo đúng thứ đó: 1 VU, `ITERATIONS` lần phân tích liên tiếp,
 * mỗi lần trên cùng một project (dataset đã có sẵn → không tính thời gian upload).
 *
 * Ngưỡng: p95 < 8000ms cho dataset 100.000 dòng.
 *
 * Biến môi trường:
 *   API_BASE       (mặc định http://localhost:3000/api/v1)
 *   STAGING_TOKEN  (bắt buộc nếu endpoint yêu cầu auth)
 *   PROJECT_ID     (bắt buộc)
 *   ITERATIONS     (mặc định 5)
 */
export const options = {
  vus: 1,
  iterations: Number(__ENV.ITERATIONS || 5),
  thresholds: {
    checks: ['rate>0.99'],
    http_req_duration: ['p(95)<8000'],
  },
};

const BASE = __ENV.API_BASE || 'http://localhost:3000/api/v1';
const PROJECT_ID = __ENV.PROJECT_ID || '';
const ITERATIONS = Number(__ENV.ITERATIONS || 5);

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
const headers = TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};

export default function () {
  const r = http.post(
    `${BASE}/projects/${PROJECT_ID}/analysis`,
    JSON.stringify({ correlation_method: 'pearson', outlier_method: 'iqr', top_n: 50 }),
    {
      headers: { ...headers, 'Content-Type': 'application/json' },
      tags: { scenario: 'analysis_single' },
    },
  );
  check(r, {
    'analysis 201 (tạo run thành công)': (x) => x.status === 201,
    'analysis không 5xx': (x) => x.status < 500,
  });
  sleep(1);
}
