import http from 'k6/http';
import { check, sleep } from 'k6';

// Phan 13 v7 S3.10 - smoke chay truoc moi lan len staging, khong chay trong test:all.
// Nguong: health p95<100ms; login p95<500ms; workspaces p95<500ms; dataset rows p95<1000ms.
//
// LUU Y ve http_req_failed: k6 mac dinh tinh moi response 4xx (401/403/429) la "failed",
// nhung voi API co auth thi 401/403/429 la KET QUA DUNG (khong token, sai pass, dinh rate-limit).
// Vi vay smoke KHONG dat nguong global http_req_failed nua - thay bang `checks`
// (assert tuong minh tung status). 5xx moi la loi that va da nam trong cac check "khong 5xx".
export const options = {
  vus: 5,
  duration: '30s',
  thresholds: {
    checks: ['rate>0.99'],
    'http_req_duration{scenario:health}': ['p(95)<100'],
    'http_req_duration{scenario:login}': ['p(95)<500'],
    'http_req_duration{scenario:workspaces}': ['p(95)<500'],
    'http_req_duration{scenario:records}': ['p(95)<1000'],
  },
};

const BASE = __ENV.API_BASE || 'http://localhost:3000/api/v1';
const ROOT = BASE.replace('/api/v1', '');
const DATASET_ID = (__ENV.DATASET_ID || '').trim();

// STAGING_TOKEN hay bị dính ký tự không hợp lệ khi copy (xuống dòng, ngoặc <>, dấu quote).
// Go net/http sẽ từ chối ngay tại client: 'invalid header field value for "Authorization"'.
// Làm sạch ở đây: token rỗng/invalid -> không gửi header (server trả 401 là đúng).
function cleanToken(v) {
  if (!v) return '';
  let s = String(v).trim().replace(/^["'<\s]+|["'>\s]+$/g, '').trim().replace(/[\r\n\t]+/g, '');
  if (!s || s === '<access_token>' || s === '<id_vua_lay>') return '';
  if (/[\x00-\x1F\x7F]/.test(s) || /\s/.test(s)) return '';
  return s;
}
const TOKEN = cleanToken(__ENV.STAGING_TOKEN);
const authHeaders = TOKEN ? { Authorization: 'Bearer ' + TOKEN } : {};

export default function () {
  let r = http.get(ROOT + '/health', { tags: { scenario: 'health' } });
  check(r, { 'health 200': (x) => x.status === 200 });
  sleep(1);

  // Login chi thu 1 lan o vong dau de tranh dinh rate-limit (login throttle 10 req/gio).
  if (__ITER === 0) {
    r = http.post(
      BASE + '/auth/login',
      JSON.stringify({ email: 'smo@test.local', password: 'Sai@12345' }),
      { headers: { 'Content-Type': 'application/json' }, tags: { scenario: 'login' } },
    );
    check(r, { 'login 200/400/401/429 (khong 5xx)': (x) => [200, 400, 401, 429].includes(x.status) });
    sleep(1);
  }

  r = http.get(BASE + '/workspaces?limit=10', { headers: authHeaders, tags: { scenario: 'workspaces' } });
  check(r, { 'ws 200/401/403/429 (khong 5xx)': (x) => [200, 401, 403, 429].includes(x.status) });
  sleep(1);

  if (DATASET_ID) {
    r = http.get(BASE + '/datasets/' + DATASET_ID + '/records?limit=50', {
      headers: authHeaders,
      tags: { scenario: 'records' },
    });
    check(r, { 'rows 200/401/403/404/429 (khong 5xx)': (x) => [200, 401, 403, 404, 429].includes(x.status) });
    sleep(1);
  }
}
