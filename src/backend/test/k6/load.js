import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * K6 — Load (tải đọc nặng, chạy ở staging).
 * Ramp: 0 -> 20 VU (1m) -> giữ 50 VU (3m) -> giảm về 0 (1m).
 * Chỉ đánh endpoint ĐỌC (GET) để tránh tạo rác dữ liệu:
 * workspaces / projects / datasets+records / overview / notifications / issues.
 * 401/403/404/429 là kết quả đúng khi thiếu token/dữ liệu -> chỉ fail khi 5xx.
 */
export const options = {
  stages: [
    { duration: '1m', target: 20 },
    { duration: '3m', target: 50 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    checks: ['rate>0.99'],
    'http_req_duration{scenario:workspaces}': ['p(95)<1000'],
    'http_req_duration{scenario:projects}': ['p(95)<1000'],
    'http_req_duration{scenario:dataview}': ['p(95)<2000'],
    'http_req_duration{scenario:overview}': ['p(95)<1000'],
    'http_req_duration{scenario:notifications}': ['p(95)<1000'],
  },
};

const BASE = __ENV.API_BASE || 'http://localhost:3000/api/v1';
const ROOT = BASE.replace('/api/v1', '');
function cleanToken(v) {
  if (!v) return '';
  let s = String(v).trim().replace(/^["'<\s]+|["'>\s]+$/g, '').trim().replace(/[\r\n\t]+/g, '');
  if (!s || s === '<access_token>') return '';
  if (/[\x00-\x1F\x7F]/.test(s) || /\s/.test(s)) return '';
  return s;
}
const TOKEN = cleanToken(__ENV.STAGING_TOKEN);
const H = TOKEN ? { Authorization: 'Bearer ' + TOKEN } : {};
const WSID = (__ENV.WORKSPACE_ID || '').trim();
const PRJID = (__ENV.PROJECT_ID || '').trim();
const DSID = (__ENV.DATASET_ID || '').trim();

function get(url, scenario, accept) {
  const r = http.get(url, { headers: H, tags: { scenario } });
  check(r, { [scenario + ' khong 5xx']: (x) => x.status < 500 });
  check(r, { [scenario + ' status hop le']: (x) => accept.includes(x.status) });
  return r;
}

export default function () {
  get(ROOT + '/health', 'workspaces', [200]);
  get(BASE + '/workspaces?limit=15', 'workspaces', [200, 401, 403, 429]);
  get(BASE + '/projects?limit=15', 'projects', [200, 401, 403, 429]);
  get(BASE + '/overview/workspaces', 'overview', [200, 401, 403, 429]);
  get(BASE + '/notifications?limit=10', 'notifications', [200, 401, 403, 429]);
  get(BASE + '/issues?limit=10', 'notifications', [200, 401, 403, 429]);
  if (WSID) get(BASE + '/workspaces/' + WSID + '/overview', 'overview', [200, 401, 403, 404, 429]);
  if (PRJID) get(BASE + '/projects/' + PRJID, 'projects', [200, 401, 403, 404, 429]);
  if (DSID) {
    get(BASE + '/datasets/' + DSID + '/records?limit=50', 'dataview', [200, 401, 403, 404, 429]);
    get(BASE + '/datasets/' + DSID + '/charts?top_n=5', 'dataview', [200, 401, 403, 404, 429]);
  }
  sleep(0.5);
}
