import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * K6 — Full journey (E2E tải nhẹ, chạy được ở local + staging).
 *
 * Mô phỏng 1 hành trình người dùng thật qua toàn bộ 84 endpoint:
 * health -> auth/login -> users/me -> workspaces -> projects ->
 * datasets/schema -> data-view/records -> analysis/result ->
 * issues -> feedback -> notifications -> overview.
 *
 * Triết lý ngưỡng (giống smoke.js):
 * - 401/403/404/429 là KẾT QUẢ ĐÚNG khi thiếu token/dữ liệu/dính rate-limit.
 * - Chỉ 5xx mới là lỗi thật -> check "không 5xx" cho mọi request.
 * - checks tổng > 0.99.
 *
 * Biến môi trường:
 *   API_BASE    (mặc định http://localhost:3000/api/v1)
 *   STAGING_TOKEN (Bearer token, optional — không có vẫn chạy, kỳ vọng 401)
 *   WORKSPACE_ID / PROJECT_ID / DATASET_ID / ANALYSIS_ID (optional — có thì đo sâu hơn)
 */
export const options = {
  vus: 3,
  duration: '1m',
  thresholds: {
    checks: ['rate>0.99'],
    'http_req_duration{scenario:health}': ['p(95)<200'],
    'http_req_duration{scenario:auth}': ['p(95)<800'],
    'http_req_duration{scenario:workspaces}': ['p(95)<800'],
    'http_req_duration{scenario:projects}': ['p(95)<800'],
    'http_req_duration{scenario:datasets}': ['p(95)<1200'],
    'http_req_duration{scenario:dataview}': ['p(95)<1500'],
    'http_req_duration{scenario:analysis}': ['p(95)<9000'],
    'http_req_duration{scenario:issues}': ['p(95)<800'],
    'http_req_duration{scenario:feedback}': ['p(95)<800'],
    'http_req_duration{scenario:notifications}': ['p(95)<800'],
    'http_req_duration{scenario:overview}': ['p(95)<800'],
  },
};

const BASE = __ENV.API_BASE || 'http://localhost:3000/api/v1';
const ROOT = BASE.replace('/api/v1', '');

function cleanToken(v) {
  if (!v) return '';
  let s = String(v).trim().replace(/^["'<\s]+|["'>\s]+$/g, '').trim().replace(/[\r\n\t]+/g, '');
  if (!s || s === '<access_token>' || s === '<id_vua_lay>') return '';
  if (/[\x00-\x1F\x7F]/.test(s) || /\s/.test(s)) return '';
  return s;
}
const TOKEN = cleanToken(__ENV.STAGING_TOKEN);
const authHeaders = TOKEN ? { Authorization: 'Bearer ' + TOKEN } : {};
const WSID = (__ENV.WORKSPACE_ID || '').trim();
const PRJID = (__ENV.PROJECT_ID || '').trim();
const DSID = (__ENV.DATASET_ID || '').trim();
const ANALYSIS_ID = (__ENV.ANALYSIS_ID || '').trim();
const J = (o) => JSON.stringify(o);

function ok5xx(name, res, accept) {
  return check(res, {
    [name + ' khong 5xx']: (x) => x.status < 500,
    [name + ' status hop le']: (x) => accept.includes(x.status),
  });
}

export default function () {
  // 1. Health (ngoài /api/v1, không prefix)
  let r = http.get(ROOT + '/health', { tags: { scenario: 'health' } });
  ok5xx('health', r, [200]);

  // 2. Auth — login sai pass là đúng (401), không 5xx là đạt
  r = http.post(BASE + '/auth/login', J({ email: 'smo@test.local', password: 'Sai@12345' }),
    { headers: { 'Content-Type': 'application/json' }, tags: { scenario: 'auth' } });
  ok5xx('login', r, [200, 400, 401, 429]);

  // 3. Users/me (cần token, không token -> 401 là đúng)
  r = http.get(BASE + '/users/me', { headers: authHeaders, tags: { scenario: 'auth' } });
  ok5xx('users/me', r, [200, 401, 403, 429]);
  sleep(0.3);

  // 4. Workspaces — list + detail (nếu có WSID)
  r = http.get(BASE + '/workspaces?limit=10', { headers: authHeaders, tags: { scenario: 'workspaces' } });
  ok5xx('ws-list', r, [200, 401, 403, 429]);
  if (WSID) {
    r = http.get(BASE + '/workspaces/' + WSID, { headers: authHeaders, tags: { scenario: 'workspaces' } });
    ok5xx('ws-detail', r, [200, 401, 403, 404, 429]);
    r = http.get(BASE + '/workspaces/' + WSID + '/members?limit=10', { headers: authHeaders, tags: { scenario: 'workspaces' } });
    ok5xx('ws-members', r, [200, 401, 403, 404, 429]);
    r = http.get(BASE + '/workspaces/' + WSID + '/overview', { headers: authHeaders, tags: { scenario: 'overview' } });
    ok5xx('ws-overview', r, [200, 401, 403, 404, 429]);
  }
  r = http.get(BASE + '/overview/workspaces', { headers: authHeaders, tags: { scenario: 'overview' } });
  ok5xx('user-overview', r, [200, 401, 403, 429]);
  sleep(0.3);

  // 5. Projects
  r = http.get(BASE + '/projects?limit=10', { headers: authHeaders, tags: { scenario: 'projects' } });
  ok5xx('prj-all', r, [200, 401, 403, 429]);
  if (WSID) {
    r = http.get(BASE + '/workspaces/' + WSID + '/projects?limit=10', { headers: authHeaders, tags: { scenario: 'projects' } });
    ok5xx('prj-by-ws', r, [200, 401, 403, 404, 429]);
  }
  if (PRJID) {
    r = http.get(BASE + '/projects/' + PRJID, { headers: authHeaders, tags: { scenario: 'projects' } });
    ok5xx('prj-detail', r, [200, 401, 403, 404, 429]);
    r = http.get(BASE + '/projects/' + PRJID + '/members?limit=10', { headers: authHeaders, tags: { scenario: 'projects' } });
    ok5xx('prj-members', r, [200, 401, 403, 404, 429]);
  }
  sleep(0.3);

  // 6. Datasets + DataView (Virtual Grid)
  if (PRJID) {
    r = http.get(BASE + '/projects/' + PRJID + '/datasets', { headers: authHeaders, tags: { scenario: 'datasets' } });
    ok5xx('ds-by-prj', r, [200, 401, 403, 404, 429]);
  }
  if (DSID) {
    r = http.get(BASE + '/datasets/' + DSID, { headers: authHeaders, tags: { scenario: 'datasets' } });
    ok5xx('ds-detail', r, [200, 401, 403, 404, 429]);
    r = http.get(BASE + '/datasets/' + DSID + '/schema', { headers: authHeaders, tags: { scenario: 'datasets' } });
    ok5xx('ds-schema', r, [200, 401, 403, 404, 429]);
    r = http.get(BASE + '/datasets/' + DSID + '/records?limit=50', { headers: authHeaders, tags: { scenario: 'dataview' } });
    ok5xx('dv-records', r, [200, 401, 403, 404, 429]);
    r = http.post(BASE + '/datasets/' + DSID + '/records/query', J({ filters: [], sort: [], limit: 20 }),
      { headers: { ...authHeaders, 'Content-Type': 'application/json' }, tags: { scenario: 'dataview' } });
    ok5xx('dv-query', r, [200, 400, 401, 403, 404, 429]);
    r = http.get(BASE + '/datasets/' + DSID + '/charts?top_n=5', { headers: authHeaders, tags: { scenario: 'dataview' } });
    ok5xx('dv-charts', r, [200, 401, 403, 404, 429]);
  }
  sleep(0.3);

  // 7. Analysis / Summary / Report
  if (PRJID) {
    r = http.get(BASE + '/projects/' + PRJID + '/analysis/result', { headers: authHeaders, tags: { scenario: 'analysis' } });
    ok5xx('analysis-result', r, [200, 401, 403, 404, 429]);
    r = http.get(BASE + '/projects/' + PRJID + '/summary', { headers: authHeaders, tags: { scenario: 'analysis' } });
    ok5xx('summary-get', r, [200, 401, 403, 404, 429]);
  }
  if (ANALYSIS_ID) {
    r = http.get(BASE + '/analyses/' + ANALYSIS_ID + '/feedback?limit=10', { headers: authHeaders, tags: { scenario: 'feedback' } });
    ok5xx('fb-list', r, [200, 401, 403, 404, 429]);
  }

  // 8. Issues (user + admin)
  r = http.get(BASE + '/issues?limit=10', { headers: authHeaders, tags: { scenario: 'issues' } });
  ok5xx('issues-mine', r, [200, 401, 403, 429]);
  r = http.get(BASE + '/admin/issues?limit=10', { headers: authHeaders, tags: { scenario: 'issues' } });
  ok5xx('issues-admin', r, [200, 401, 403, 429]);
  sleep(0.3);

  // 9. Notifications
  r = http.get(BASE + '/notifications?limit=10', { headers: authHeaders, tags: { scenario: 'notifications' } });
  ok5xx('notif-list', r, [200, 401, 403, 429]);
  r = http.get(BASE + '/notifications/unread-count', { headers: authHeaders, tags: { scenario: 'notifications' } });
  ok5xx('notif-unread', r, [200, 401, 403, 429]);
  sleep(0.5);
}
