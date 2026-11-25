/**
 * Helper cho E2E toàn hệ thống (black-box): gọi HTTP vào app đang chạy thật.
 * Mặc định trỏ vào stack `deploy/docker-compose.e2e.yml` (cổng 3100).
 */
import { createHmac, randomUUID } from 'node:crypto';
import path from 'node:path';
import request from 'supertest';

export const API = process.env.E2E_API_BASE ?? 'http://localhost:3100/api/v1';
/** Gốc không có prefix (dùng cho /health). */
export const ROOT = API.replace(/\/api\/v1\/?$/, '');
export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@e2e.local';
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'Admin@12345';
/** Trùng giá trị mặc định trong docker-compose.e2e.yml — chỉ dùng để ký token hết hạn trong test. */
export const JWT_ACCESS_SECRET =
  process.env.E2E_JWT_ACCESS_SECRET ?? 'e2e-access-secret-change-me-0123456789';
export const FIXTURE_CSV = path.join(__dirname, '..', 'fixtures', 'valid-simple.csv');
const PASSWORD = 'E2eLive@12345';

export const api = (): ReturnType<typeof request> => request(API);

export interface Session {
  email: string;
  userId: string;
  token: string;
  refresh: string;
}

export const bearer = (s: Session | string): Record<string, string> => ({
  Authorization: `Bearer ${typeof s === 'string' ? s : s.token}`,
});

export const uniqueEmail = (tag: string): string =>
  `${tag}-${randomUUID().slice(0, 8)}@e2e-live.local`;

export async function login(email: string, password = PASSWORD): Promise<Session> {
  const res = await api().post('/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`login ${email} → ${res.status} ${JSON.stringify(res.body)}`);
  const d = res.body.data as { access_token: string; refresh_token: string; user: { id: string } };
  return { email, userId: d.user.id, token: d.access_token, refresh: d.refresh_token };
}

export async function registerAndLogin(tag: string): Promise<Session> {
  const email = uniqueEmail(tag);
  const res = await api()
    .post('/auth/register')
    .send({ email, password: PASSWORD, first_name: 'E2E', last_name: tag });
  if (res.status !== 201) throw new Error(`register ${email} → ${res.status} ${JSON.stringify(res.body)}`);
  return login(email);
}

export async function createWorkspace(s: Session, name = 'WS e2e-live'): Promise<string> {
  const res = await api().post('/workspaces').set(bearer(s)).send({ name });
  if (res.status !== 201) throw new Error(`create workspace → ${res.status} ${JSON.stringify(res.body)}`);
  return (res.body.data.workspace as { id: string }).id;
}

export async function createProject(s: Session, workspaceId: string, name = 'PR e2e-live'): Promise<string> {
  const res = await api().post(`/workspaces/${workspaceId}/projects`).set(bearer(s)).send({ name });
  if (res.status !== 201) throw new Error(`create project → ${res.status} ${JSON.stringify(res.body)}`);
  return (res.body.data.project as { id: string }).id;
}

export async function uploadCsv(s: Session, projectId: string): Promise<request.Response> {
  return api().post(`/projects/${projectId}/datasets/upload`).set(bearer(s)).attach('file', FIXTURE_CSV);
}

/** Ký JWT HS256 thủ công (để tạo token sai chữ ký / hết hạn). */
export function signJwt(payload: Record<string, unknown>, secret: string): string {
  const b64 = (o: unknown): string => Buffer.from(JSON.stringify(o)).toString('base64url');
  const head = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}`;
  return `${head}.${createHmac('sha256', secret).update(head).digest('base64url')}`;
}

/** Lặp `fn` tới khi trả true hoặc hết thời gian. */
export async function waitFor(fn: () => Promise<boolean>, timeoutMs: number, everyMs = 2000): Promise<boolean> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, everyMs));
  }
  return false;
}
