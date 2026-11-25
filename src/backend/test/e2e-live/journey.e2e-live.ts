/**
 * E2E toàn hệ thống — hành trình chính (kế hoạch kiểm thử mục 3.2).
 * Chạy: docker compose -f deploy/docker-compose.e2e.yml up -d --build
 *       pnpm exec jest --config ./test/jest-e2e-live.json --runInBand
 * Các bước phụ thuộc nhau, chạy tuần tự.
 */
import request from 'supertest';
import { ROOT, api, bearer, createProject, createWorkspace, login, registerAndLogin, uploadCsv, waitFor, type Session } from './helpers';

describe('E2E live — hành trình chính', () => {
  let owner: Session;
  let workspaceId: string;
  let projectId: string;
  let datasetId: string;
  let analysisRunId: string;
  let jobId: string;

  it('0. Hệ thống sẵn sàng (GET /health/ready)', async () => {
    const res = await request(ROOT).get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.data.checks.mongodb.status).toBe('ok');
  });

  it('1. Đăng ký + đăng nhập (FR-01)', async () => {
    owner = await registerAndLogin('owner');
    expect(owner.token.split('.')).toHaveLength(3);
    expect(owner.refresh.length).toBeGreaterThan(20);
  });

  it('2. Tạo workspace và project (FR-07, FR-08)', async () => {
    workspaceId = await createWorkspace(owner);
    projectId = await createProject(owner, workspaceId);
    expect(projectId).toMatch(/^[0-9a-f]{24}$/);
  });

  it('3. Upload CSV → dataset READY (FR-09)', async () => {
    const res = await uploadCsv(owner, projectId);
    expect(res.status).toBe(201);
    const ds = res.body.data.dataset as { id: string; status: string; columns: unknown[] };
    expect(ds.status).toBe('READY');
    expect(ds.columns.length).toBeGreaterThan(0);
    datasetId = ds.id;
  });

  it('4. Upload lần 2 vào cùng project → 409 CONFLICT (1 dataset/project)', async () => {
    const res = await uploadCsv(owner, projectId);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('5. Xem dữ liệu phân trang keyset (FR-10)', async () => {
    const p1 = await api().get(`/datasets/${datasetId}/records`).query({ limit: 1 }).set(bearer(owner));
    expect(p1.status).toBe(200);
    const d1 = p1.body.data as { items: Array<{ rowIndex: number }>; meta: { nextCursor: string | null; hasMore: boolean } };
    expect(d1.items).toHaveLength(1);
    expect(d1.meta.hasMore).toBe(true);
    const p2 = await api()
      .get(`/datasets/${datasetId}/records`)
      .query({ limit: 1, cursor: d1.meta.nextCursor })
      .set(bearer(owner));
    expect(p2.status).toBe(200);
    const d2 = p2.body.data as { items: Array<{ rowIndex: number }> };
    expect(d2.items).toHaveLength(1);
    expect(d2.items[0]?.rowIndex).not.toBe(d1.items[0]?.rowIndex);
  });

  it('6. Chạy phân tích → 201, thống kê đồng bộ + job AI (FR-11, FR-12, FR-13)', async () => {
    const res = await api().post(`/projects/${projectId}/analysis`).set(bearer(owner)).send({});
    expect(res.status).toBe(201);
    const d = res.body.data as { analysisRunId: string; pollUrl: string; dqSummary: unknown; dq05: { status: string } };
    expect(d.dqSummary).toBeDefined();
    expect(d.dq05.status).toBe('unassessed');
    expect(d.pollUrl).toMatch(/^\/api\/v1\/analysis\/jobs\/[0-9a-f]{24}$/);
    analysisRunId = d.analysisRunId;
    jobId = d.pollUrl.split('/').pop() as string;
  });

  it('7. Theo dõi job AI qua pollUrl (FR-13)', async () => {
    const res = await api().get(`/analysis/jobs/${jobId}`).set(bearer(owner));
    expect(res.status).toBe(200);
    // AI_WORKER_ENABLED=false (mặc định compose) → job giữ pending; bật AI thì có thể running/succeeded/failed
    expect(['pending', 'running', 'succeeded', 'failed', 'skipped']).toContain(res.body.data.status);
  });

  it('8. Gửi phản hồi cho một phát hiện (FR-14)', async () => {
    const res = await api()
      .post(`/analyses/${analysisRunId}/findings/${encodeURIComponent('DQ-01:Email')}/feedback`)
      .set(bearer(owner))
      .send({ label: 'correct' });
    expect(res.status).toBe(201);
  });

  it('9. Tổng kết → yêu cầu PDF (202) → tải PDF (FR-16)', async () => {
    expect((await api().post(`/projects/${projectId}/summary`).set(bearer(owner))).status).toBe(201);
    const req = await api().post(`/projects/${projectId}/report`).set(bearer(owner));
    expect(req.status).toBe(202);
    const reportId = req.body.data.reportId as string;
    let pdf: request.Response | undefined;
    const ok = await waitFor(async () => {
      pdf = await api().get(`/projects/${projectId}/report/${reportId}/file`).set(bearer(owner)).buffer(true);
      return pdf.status === 200;
    }, 60000);
    expect(ok).toBe(true);
    expect(pdf?.headers['content-type']).toContain('application/pdf');
  });

  it('10. Xoay vòng refresh token; dùng lại token cũ → 401 TOKEN_INVALID (FR-02)', async () => {
    const s = await login(owner.email);
    const r1 = await api().post('/auth/refresh').send({ refresh_token: s.refresh });
    expect(r1.status).toBe(200);
    expect(r1.body.data.refresh_token).not.toBe(s.refresh);
    const reuse = await api().post('/auth/refresh').send({ refresh_token: s.refresh });
    expect(reuse.status).toBe(401);
    expect(reuse.body.error.code).toBe('TOKEN_INVALID');
  });

  it('11. Xoá project → dataset bị xoá lan truyền qua outbox (≤ 60 s)', async () => {
    const fresh = await login(owner.email);
    expect((await api().delete(`/projects/${projectId}`).set(bearer(fresh))).status).toBe(204);
    const gone = await waitFor(async () => {
      const r = await api().get(`/datasets/${datasetId}`).set(bearer(fresh));
      return r.status === 404;
    }, 60000);
    expect(gone).toBe(true);
  });
});
