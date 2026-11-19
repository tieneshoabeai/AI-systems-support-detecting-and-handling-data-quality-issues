/**
 * Architectural Test: **Hợp đồng API khớp 1-1 với mã nguồn**.
 *
 * Đối chiếu route trong mã nguồn (decorator `@Get/@Post/@Put/@Patch/@Delete`
 * trong mọi `*.controller.ts`) với bảng route của hợp đồng
 * `docs/restructures/7_api_contracts_v8.md` §3.13.
 *
 * **Vì sao cần test này?** Trước đó, thêm một endpoint mới mà quên cập nhật
 * hợp đồng (hoặc ngược lại — xoá route mà không dọn hợp đồng) sẽ **không ai
 * phát hiện** cho tới khi frontend gọi vào route không tồn tại. Lỗi này chỉ lộ
 * ra ở production.
 *
 * Ba loại lệch bị chặn:
 *   1. **Thiếu** — hợp đồng có, mã nguồn không → client gọi vào 404.
 *   2. **Thừa** — mã nguồn có, hợp đồng không → frontend không biết endpoint tồn tại.
 *   3. **Route chết** — controller có endpoint nhưng trả `NotImplementedException`.
 *
 * Script CLI tương ứng: `node scripts/check-api-coverage.cjs` (cùng logic,
 * exit code 1 khi lệch — dùng cho CI).
 *
 * Lịch sử: mục #5 của `docs/restructures/17_api_gap_analysis_v1.md` (để trống
 * từ 2026-11-18) → đóng 2026-11-19.
 */
import * as fs from 'fs';
import * as path from 'path';

const BACKEND_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(BACKEND_ROOT, '..', '..');
const SRC_DIR = path.join(BACKEND_ROOT, 'src');
const CONTRACT_PATH = path.join(REPO_ROOT, 'docs', 'restructures', '7_api_contracts_v8.md');

// ── 1. Route từ mã nguồn ────────────────────────────────────────────────────

function collectControllerFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) {
      out.push(...collectControllerFiles(full));
    } else if (entry.endsWith('.controller.ts')) {
      out.push(full);
    }
  }
  return out;
}

const METHODS = ['Get', 'Post', 'Put', 'Patch', 'Delete'];

/** Method + path chuẩn hoá (`/datasets/:id` → `GET /datasets/:x`). */
function normalizePath(raw: string): string {
  return raw
    .replace(/\{[^}]+\}/g, ':x')
    .replace(/:[A-Za-z0-9_]+/g, ':x')
    .replace(/\/$/, '');
}

function collectRoutesFromSource(): Map<string, string> {
  const routes = new Map<string, string>();
  const files = collectControllerFiles(SRC_DIR);

  for (const file of files) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    const prefixMatch = lines.find((l) => /@Controller\(/.test(l));
    const prefix = prefixMatch
      ? (prefixMatch.match(/@Controller\(\s*['"`]([^'"`]*)['"`]/) ?? [])[1] ?? ''
      : '';

    for (const line of lines) {
      const m = line.match(
        new RegExp('@(' + METHODS.join('|') + ')\\(\\s*(?:[\'"`]([^\'"`]*)[\'"`])?\\s*\\)'),
      );
      if (!m) continue;
      const method = m[1];
      const seg = m[2] ?? '';
      if (!method) continue;
      let full = prefix ? '/' + prefix : '';
      if (seg) full += '/' + seg.replace(/^\//, '');
      if (full === '') full = '/';
      const key = method.toUpperCase() + ' ' + normalizePath(full);
      routes.set(key, full);
    }
  }

  return routes;
}

// ── 2. Route từ hợp đồng (chỉ bảng §3.13) ──────────────────────────────────

function collectRoutesFromContract(): Map<string, string> {
  const docLines = fs.readFileSync(CONTRACT_PATH, 'utf8').split('\n');

  const startIdx = docLines.findIndex((l) => l.startsWith('### 3.13.'));
  expect(startIdx).toBeGreaterThanOrEqual(0);

  const endIdx = docLines.findIndex((l, i) => i > startIdx && /^### 3\.1[4-9]/.test(l));
  const section = docLines.slice(startIdx, endIdx > startIdx ? endIdx : undefined);

  const routes = new Map<string, string>();
  for (const line of section) {
    // | 57 | `ANALYSIS-02` Chạy phân tích | POST | `/projects/{projectId}/analysis` | PROJ-MEMBER+ |
    const m = line.match(/\|\s*[^|]*\|\s*(GET|POST|PUT|PATCH|DELETE)\s*\|\s*`(\/[^`]*)`\s*\|/);
    if (!m) continue;
    const method = m[1];
    const routePath = m[2];
    if (!method || !routePath) continue;
    const key = method.toUpperCase() + ' ' + normalizePath(routePath);
    routes.set(key, routePath);
  }

  return routes;
}

// ── 3. So sánh ─────────────────────────────────────────────────────────────

describe('API contract coverage — hợp đồng §3.13 khớp mã nguồn', () => {
  const sourceRoutes = collectRoutesFromSource();
  const contractRoutes = collectRoutesFromContract();

  it('hợp đồng có bảng route §3.13 và đọc được', () => {
    expect(contractRoutes.size).toBeGreaterThan(0);
    expect(sourceRoutes.size).toBeGreaterThan(0);
  });

  it('KHÔNG có route thiếu (hợp đồng có, mã nguồn chưa implement)', () => {
    const missing = [...contractRoutes.keys()].filter((k) => !sourceRoutes.has(k)).sort();
    expect(missing).toEqual([]);
  });

  it('KHÔNG có route thừa (mã nguồn có, hợp đồng chưa khai báo)', () => {
    const extra = [...sourceRoutes.keys()].filter((k) => !contractRoutes.has(k)).sort();
    expect(extra).toEqual([]);
  });

  it('không có endpoint chết (NotImplementedException trong controller)', () => {
    const offenders: string[] = [];
    for (const file of collectControllerFiles(SRC_DIR)) {
      const src = fs.readFileSync(file, 'utf8');
      if (src.includes('NotImplementedException')) {
        offenders.push(path.relative(REPO_ROOT, file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it('không có TODO/FIXME trong mã nguồn nghiệp vụ', () => {
    const offenders: string[] = [];
    for (const file of collectControllerFiles(SRC_DIR)) {
      const src = fs.readFileSync(file, 'utf8');
      if (/\b(TODO|FIXME)\b/.test(src)) {
        offenders.push(path.relative(REPO_ROOT, file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it('báo cáo số route đối chiếu (để theo dõi)', () => {
    console.info(
      `[API contract] Hợp đồng §3.13: ${contractRoutes.size} | Mã nguồn: ${sourceRoutes.size}`,
    );
    expect(contractRoutes.size).toBe(sourceRoutes.size);
  });
});
