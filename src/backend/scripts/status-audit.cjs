/**
 * Quét tự động: đối chiếu HTTP status THỰC TẾ của từng route với `@ApiResponse`
 * khai báo trong Swagger.
 *
 * Vì sao cần script này:
 *   NestJS mặc định `@Post` → **201**, `@Get/@Patch/@Put/@Delete` → **200**, trừ
 *   khi route có `@HttpCode(...)`. Swagger lại chỉ hiển thị status khai trong
 *   `@ApiResponse({ status })` — nếu route không có decorator này, Swagger hiện
 *   mặc định **200**, dù server thực tế trả **201**. Đó chính là lệch pha mà
 *   người dùng gặp phải khi test API.
 *
 * Chạy: `node scripts/status-audit.cjs`
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', 'src', 'modules');

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.controller.ts')) out.push(p);
  }
  return out;
}

/** Status mặc định của NestJS theo HTTP method (POST → 201, còn lại → 200). */
const NEST_DEFAULT = { GET: 200, POST: 201, PUT: 200, PATCH: 200, DELETE: 200 };

/** Map `HttpStatus.X` → số. */
const HTTP_STATUS = {
  OK: 200, CREATED: 201, ACCEPTED: 202, NO_CONTENT: 204,
  BAD_REQUEST: 400, UNAUTHORIZED: 401, FORBIDDEN: 403, NOT_FOUND: 404,
  CONFLICT: 409, UNPROCESSABLE_ENTITY: 422, TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500, NOT_IMPLEMENTED: 501, SERVICE_UNAVAILABLE: 503,
};

const ROUTE_RE = /^\s*@(Get|Post|Put|Patch|Delete)\(\s*['"`]([^'"`]*)['"`]?\s*\)/;
/** Dấu hiệu bắt đầu thân handler → kết thúc vùng decorator của route. */
const HANDLER_RE = /^\s{2}(async\s+)?[A-Za-z_$][\w$]*\s*\(/;

const routes = [];
for (const file of walk(ROOT)) {
  const src = fs.readFileSync(file, 'utf8');
  const lines = src.split('\n');
  const controllerBase = ((src.match(/@Controller\(([^)]*)\)/) || [])[1] || '').replace(/['"]/g, '');

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(ROUTE_RE);
    if (!m) continue;
    const method = m[1].toUpperCase();
    const subPath = m[2] || '';
    const route = `/${controllerBase}/${subPath}`.replace(/\/+/g, '/').replace(/\/$/, '') || '/';

    // Decorator có thể nằm TRƯỚC hoặc SAU `@Get/@Post/...` → gom cả hai chiều,
    // dừng khi gặp route trước đó hoặc thân handler.
    const block = [];
    let sawHandler = false;
    for (let j = i + 1; j < lines.length; j++) {
      if (ROUTE_RE.test(lines[j])) break;
      if (!sawHandler && HANDLER_RE.test(lines[j])) sawHandler = true;
      // Sau khi vào thân handler, dừng ở dòng đóng hàm cấp class.
      if (sawHandler && /^\s{2}\}/.test(lines[j])) break;
      block.push(lines[j]);
    }
    for (let j = i - 1; j >= 0; j--) {
      if (ROUTE_RE.test(lines[j])) break;
      if (lines[j].trim().startsWith('}') || lines[j].trim() === '') break;
      block.push(lines[j]);
    }

    let actual = NEST_DEFAULT[method];
    let httpCodeName = null;
    let usesRes = false;
    let usesResPassthrough = false;
    const swagger = [];

    // `@ApiResponse` có thể viết nhiều dòng → quét trên toàn bộ block gộp lại.
    const blockText = block.join('\n');
    for (const match of blockText.matchAll(/@ApiResponse\(\s*\{[\s\S]*?status:\s*(\d+)/g)) {
      swagger.push(Number(match[1]));
    }

    for (const l of block) {
      const hc = l.match(/@HttpCode\(\s*HttpStatus\.([A-Z_]+)\s*\)/);
      if (hc && httpCodeName === null) {
        httpCodeName = hc[1];
        actual = HTTP_STATUS[hc[1]] ?? actual;
      }
      // `@ApiResponse` có thể viết nhiều dòng → gộp cả block rồi match toàn cục.
      if (/@Res\(\)/.test(l)) usesRes = true;
      if (/@Res\(\{\s*passthrough:\s*true\s*\}\)/.test(l)) usesResPassthrough = true;
    }

    routes.push({
      file: path.relative(ROOT, file),
      line: i + 1,
      method,
      route,
      actual,
      httpCodeName,
      usesRes,
      usesResPassthrough,
      swagger: [...new Set(swagger)],
    });
  }
}

/** Phân loại: route có lệch pha status hay không. */
function classify(r) {
  // Route dùng `@Res()` (không passthrough) → Nest KHÔNG tự set status;
  // controller tự gọi res.status()/res.json()/res.redirect() → không suy ra được.
  if (r.usesRes && !r.usesResPassthrough) return 'MANUAL';
  if (r.swagger.length === 0) return 'THIEU_SWAGGER';
  if (!r.swagger.includes(r.actual)) return 'LECH';
  return 'OK';
}

const problems = routes.map((r) => ({ ...r, kind: classify(r) })).filter((r) => r.kind !== 'OK');

const counts = problems.reduce((acc, p) => {
  acc[p.kind] = (acc[p.kind] ?? 0) + 1;
  return acc;
}, {});

console.log('=== TONG SO ROUTE QUET ===', routes.length);
console.log('=== PHAN LOAI VAN DE ===');
console.log(JSON.stringify(counts, null, 2));
console.log('\n=== CHI TIET ===');
for (const p of problems) {
  console.log(`${p.kind.padEnd(14)} ${p.method.padEnd(6)} ${p.route}`);
  const detail =
    p.kind === 'THIEU_SWAGGER'
      ? 'thuc te=' + p.actual + ' (chua khai @ApiResponse)'
      : p.kind === 'LECH'
        ? `thuc te=${p.actual} vs swagger=[${p.swagger}]`
        : 'controller tu set status qua @Res()';
  console.log(`               ${detail}   [${p.file}:${p.line}]`);
}
