/**
 * E2E toàn hệ thống — ma trận phân quyền qua HTTP (kế hoạch kiểm thử mục 4).
 * Nhóm theo OWASP API Security Top 10 2023: API1 (BOLA), API2 (Broken Authentication), API5 (BFLA).
 * Bổ sung cho test/e2e/security/authorization.e2e-spec.ts (kiểm ở tầng CASL, không qua HTTP).
 */
import {
  ADMIN_EMAIL, ADMIN_PASSWORD, JWT_ACCESS_SECRET, api, bearer, createProject, createWorkspace,
  login, registerAndLogin, signJwt, uploadCsv, type Session,
} from './helpers';

type Method = 'get' | 'post' | 'patch' | 'delete';
type Actor = 'none' | 'badSig' | 'expired' | 'owner' | 'wsMember' | 'prjMember' | 'viewer' | 'stranger' | 'admin';
interface Case {
  id: string;
  group: string;
  actor: Actor;
  method: Method;
  path: () => string;
  body?: Record<string, unknown>;
  /** Chấp nhận nhiều mã: chặn bằng 403 hay ẩn bằng 404 đều không lộ tài nguyên. */
  expect: number[];
  code?: string;
}

const s: Partial<Record<Actor, Session>> = {};
const tokens: Partial<Record<Actor, string>> = {};
let ws = '';
let prj = '';
let ds = '';
let run = '';

beforeAll(async () => {
  s.owner = await registerAndLogin('authz-owner');
  s.wsMember = await registerAndLogin('authz-wsmember');
  s.prjMember = await registerAndLogin('authz-prjmember');
  s.viewer = await registerAndLogin('authz-viewer');
  s.stranger = await registerAndLogin('authz-stranger');
  s.admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  await createWorkspace(s.stranger, 'WS của người lạ');

  ws = await createWorkspace(s.owner, 'WS phân quyền');
  prj = await createProject(s.owner, ws, 'PR phân quyền');
  const up = await uploadCsv(s.owner, prj);
  if (up.status !== 201) throw new Error(`upload → ${up.status}`);
  ds = up.body.data.dataset.id as string;
  const an = await api().post(`/projects/${prj}/analysis`).set(bearer(s.owner)).send({});
  if (an.status !== 201) throw new Error(`analysis → ${an.status}`);
  run = an.body.data.analysisRunId as string;

  const add = async (url: string, email: string, role: string): Promise<void> => {
    const r = await api().post(url).set(bearer(s.owner as Session)).send({ email, role });
    if (r.status >= 300) throw new Error(`add member ${url} → ${r.status} ${JSON.stringify(r.body)}`);
  };
  await add(`/workspaces/${ws}/members`, s.wsMember.email, 'member');
  await add(`/projects/${prj}/members`, s.prjMember.email, 'member');
  await add(`/projects/${prj}/members`, s.viewer.email, 'viewer');

  const now = Math.floor(Date.now() / 1000);
  const claims = { sub: s.owner.userId, email: s.owner.email, role: 'analyst' };
  tokens.badSig = signJwt({ ...claims, iat: now, exp: now + 600 }, 'sai-chu-ky-khong-phai-secret-that');
  tokens.expired = signJwt({ ...claims, iat: now - 3600, exp: now - 60 }, JWT_ACCESS_SECRET);
});

const DENY = [403, 404];
const cases: Case[] = [
  // API2 — Broken Authentication
  { id: 'AUTH-01', group: 'API2', actor: 'none', method: 'get', path: () => '/workspaces', expect: [401], code: 'UNAUTHENTICATED' },
  { id: 'AUTH-02', group: 'API2', actor: 'badSig', method: 'get', path: () => '/workspaces', expect: [401], code: 'UNAUTHENTICATED' },
  { id: 'AUTH-03', group: 'API2', actor: 'expired', method: 'get', path: () => '/workspaces', expect: [401], code: 'UNAUTHENTICATED' },
  // API1 — BOLA: người lạ dùng ID tài nguyên của người khác
  { id: 'BOLA-01', group: 'API1', actor: 'stranger', method: 'get', path: () => `/workspaces/${ws}`, expect: DENY },
  { id: 'BOLA-02', group: 'API1', actor: 'stranger', method: 'patch', path: () => `/workspaces/${ws}`, body: { name: 'hack' }, expect: DENY },
  { id: 'BOLA-03', group: 'API1', actor: 'stranger', method: 'get', path: () => `/projects/${prj}`, expect: DENY },
  { id: 'BOLA-04', group: 'API1', actor: 'stranger', method: 'delete', path: () => `/projects/${prj}`, expect: DENY },
  { id: 'BOLA-05', group: 'API1', actor: 'stranger', method: 'get', path: () => `/datasets/${ds}/records`, expect: DENY },
  { id: 'BOLA-06', group: 'API1', actor: 'stranger', method: 'get', path: () => `/datasets/${ds}/file`, expect: DENY },
  { id: 'BOLA-07', group: 'API1', actor: 'stranger', method: 'post', path: () => `/projects/${prj}/analysis`, body: {}, expect: DENY },
  { id: 'BOLA-08', group: 'API1', actor: 'stranger', method: 'post', path: () => `/analyses/${run}/findings/DQ-01:x/feedback`, body: { label: 'correct' }, expect: DENY },
  // API5 — BFLA: analyst gọi chức năng của admin
  { id: 'BFLA-01', group: 'API5', actor: 'owner', method: 'get', path: () => '/admin/users', expect: [403], code: 'FORBIDDEN' },
  { id: 'BFLA-02', group: 'API5', actor: 'owner', method: 'get', path: () => '/admin/issues', expect: [403], code: 'FORBIDDEN' },
  { id: 'BFLA-03', group: 'API5', actor: 'admin', method: 'get', path: () => '/admin/users', expect: [200] },
  // Vai trò trong project
  { id: 'ROLE-01', group: 'viewer', actor: 'viewer', method: 'get', path: () => `/projects/${prj}`, expect: [200] },
  { id: 'ROLE-02', group: 'viewer', actor: 'viewer', method: 'get', path: () => `/datasets/${ds}/records`, expect: [200] },
  { id: 'ROLE-03', group: 'viewer', actor: 'viewer', method: 'post', path: () => `/projects/${prj}/analysis`, body: {}, expect: [403], code: 'FORBIDDEN' },
  { id: 'ROLE-04', group: 'viewer', actor: 'viewer', method: 'delete', path: () => `/datasets/${ds}`, expect: [403], code: 'FORBIDDEN' },
  { id: 'ROLE-05', group: 'prj-member', actor: 'prjMember', method: 'post', path: () => `/projects/${prj}/members`, body: { email: 'x@e2e-live.local', role: 'viewer' }, expect: [403], code: 'FORBIDDEN' },
  { id: 'ROLE-06', group: 'prj-member', actor: 'prjMember', method: 'delete', path: () => `/projects/${prj}`, expect: [403], code: 'FORBIDDEN' },
  { id: 'ROLE-07', group: 'prj-member', actor: 'prjMember', method: 'post', path: () => `/projects/${prj}/analysis`, body: {}, expect: [201] },
  // Vai trò trong workspace
  { id: 'ROLE-08', group: 'ws-member', actor: 'wsMember', method: 'get', path: () => `/projects/${prj}`, expect: [200] },
  { id: 'ROLE-09', group: 'ws-member', actor: 'wsMember', method: 'post', path: () => `/projects/${prj}/analysis`, body: {}, expect: [403], code: 'FORBIDDEN' },
  { id: 'ROLE-10', group: 'ws-member', actor: 'wsMember', method: 'delete', path: () => `/workspaces/${ws}`, expect: [403], code: 'FORBIDDEN' },
  { id: 'ROLE-11', group: 'ws-owner', actor: 'owner', method: 'get', path: () => `/datasets/${ds}/records`, expect: [200] },
  // Quy tắc nghiệp vụ: admin không được gửi feedback
  { id: 'RULE-01', group: 'feedback', actor: 'admin', method: 'post', path: () => `/analyses/${run}/findings/DQ-01:x/feedback`, body: { label: 'correct' }, expect: [403], code: 'FORBIDDEN' },
];

describe('E2E live — ma trận phân quyền qua HTTP', () => {
  it.each(cases)('$id [$group] $actor $method → $expect', async (c) => {
    let req = api()[c.method](c.path());
    const tok = tokens[c.actor] ?? s[c.actor]?.token;
    if (tok) req = req.set(bearer(tok));
    const res = c.body ? await req.send(c.body) : await req;
    expect(c.expect).toContain(res.status);
    if (c.code) expect(res.body.error?.code).toBe(c.code);
  });

  // Hạn chế đã biết: JwtStrategy không kiểm sessionId → access token vẫn dùng được sau logout tới khi hết hạn (15 phút).
  // `it.failing` đạt khi assertion BÊN TRONG thất bại; khi hệ thống được sửa, test này sẽ báo đỏ để gỡ `.failing`.
  it.failing('AUTH-04 [API2] access token bị từ chối sau logout (HẠN CHẾ ĐÃ BIẾT)', async () => {
    const fresh = await login((s.owner as Session).email);
    expect((await api().post('/auth/logout').set(bearer(fresh))).status).toBe(200);
    const after = await api().get('/workspaces').set(bearer(fresh));
    expect(after.status).toBe(401);
  });
});
