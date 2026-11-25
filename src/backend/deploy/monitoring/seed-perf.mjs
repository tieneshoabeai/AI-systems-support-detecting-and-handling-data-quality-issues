#!/usr/bin/env node
// Chuẩn bị dữ liệu cho k6: tài khoản + workspace + project + dataset (mặc định large-50k.csv) + 1 lần phân tích.
// In ra các lệnh export để dùng với deploy/monitoring/k6.sh.
// Dùng (từ src/backend):
//   eval "$(node deploy/monitoring/seed-perf.mjs)"
//   SEED_API=http://localhost:3000/api/v1 SEED_CSV=test/fixtures/valid-simple.csv node deploy/monitoring/seed-perf.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

const API = process.env.SEED_API ?? 'http://localhost:3100/api/v1';
// test/fixtures/large-50k.csv trong repo chỉ là placeholder 1 dòng → tự sinh file thật (bị gitignore).
const CSV = process.env.SEED_CSV ?? 'test-results/perf-data/large-50k.csv';
const ROWS = Number(process.env.SEED_ROWS ?? 50000);

if (!process.env.SEED_CSV && !existsSync(CSV)) {
  // Sinh tất định (LCG seed cố định) để các lần đo dùng cùng dữ liệu.
  let x = 20261125;
  const rnd = () => ((x = (x * 1103515245 + 12345) % 2147483648) / 2147483648);
  const cities = ['Ha Noi', 'TP HCM', 'Da Nang', 'Can Tho', 'Hai Phong', 'Hue'];
  const lines = ['ma_kh,ten,tuoi,thu_nhap,ngay_dang_ky,thanh_pho,email,diem'];
  for (let i = 1; i <= ROWS; i++) {
    const r = rnd();
    let tuoi = String(18 + Math.floor(rnd() * 50));
    let thuNhap = String(Math.round(5e6 + rnd() * 3e7));
    if (r < 0.03) tuoi = '';                                  // DQ-01: thiếu
    else if (r < 0.04) tuoi = 'khong ro';                     // DQ-03: sai kiểu
    if (rnd() < 0.005) thuNhap = String(Math.round(5e8 + rnd() * 1e9)); // DQ-04: ngoại lai
    const d = new Date(Date.UTC(2023, 0, 1) + Math.floor(rnd() * 900) * 864e5).toISOString().slice(0, 10);
    const row = [`KH${String(i).padStart(6, '0')}`, `Khach hang ${i}`, tuoi, thuNhap, d,
      cities[Math.floor(rnd() * cities.length)], rnd() < 0.02 ? '' : `kh${i}@example.com`, (rnd() * 10).toFixed(2)].join(',');
    lines.push(row);
    if (rnd() < 0.01 && i < ROWS) { lines.push(row); i++; }   // DQ-02: dòng trùng (giữ tổng = ROWS)
  }
  mkdirSync(dirname(CSV), { recursive: true });
  writeFileSync(CSV, lines.join('\n') + '\n');
  console.error(`# đã sinh ${CSV} (${ROWS} dòng)`);
}
const email = `perf-${randomUUID().slice(0, 8)}@e2e-live.local`;
const password = 'Perf@123456';

async function call(method, path, { token, json, form } = {}) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  let body;
  if (json) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
  if (form) body = form;
  const res = await fetch(API + path, { method, headers, body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(data)}`);
  return data.data;
}

await call('POST', '/auth/register', { json: { email, password, first_name: 'Perf', last_name: 'Seed' } });
const { access_token: token } = await call('POST', '/auth/login', { json: { email, password } });
const ws = (await call('POST', '/workspaces', { token, json: { name: 'WS perf' } })).workspace.id;
const prj = (await call('POST', `/workspaces/${ws}/projects`, { token, json: { name: 'PR perf' } })).project.id;
const form = new FormData();
form.append('file', new Blob([readFileSync(CSV)], { type: 'text/csv' }), basename(CSV));
const ds = (await call('POST', `/projects/${prj}/datasets/upload`, { token, form })).dataset;
const an = await call('POST', `/projects/${prj}/analysis`, { token, json: {} });

console.error(`# seed xong: ${email} — dataset ${ds.rowCount} dòng (${basename(CSV)}); access token hết hạn sau 15 phút`);
console.log([
  `export STAGING_TOKEN='${token}'`,
  `export WORKSPACE_ID='${ws}'`,
  `export PROJECT_ID='${prj}'`,
  `export DATASET_ID='${ds.id}'`,
  `export ANALYSIS_ID='${an.analysisRunId}'`,
].join('\n'));
