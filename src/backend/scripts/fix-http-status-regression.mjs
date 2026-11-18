/**
 * Rà soát & sửa regression HTTP status sau codemod Bước 2.
 *
 * Vấn đề: codemod thay `new XxxException({ error: 'CODE' })` bằng
 * `new DomainError(ERROR_CODES.CODE, ...)`. Nhưng **HTTP status** của
 * exception NestJS có thể **khác** status mặc định của mã lỗi:
 *
 *   `UnauthorizedException` (401) + `error: 'VALIDATION_ERROR'` → mặc định 400 ❌
 *
 * → phải dùng `StatusError` để giữ status gốc.
 *
 * Script này:
 *   1. Đọc bản gốc của file (git) để biết exception + payload gốc.
 *   2. Ghép từng `new DomainError(ERROR_CODES.X, '<msg>')` hiện tại với
 *      `new XxxException({ message: '<msg>', error: 'X' })` gốc.
 *   3. Nếu status gốc ≠ status mặc định của mã → chuyển sang `StatusError`.
 *
 *   node scripts/fix-http-status-regression.mjs [--dry-run]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const DRY_RUN = process.argv.includes('--dry-run');

/** Exception NestJS → HTTP status gốc. */
const STATUS_BY_EXCEPTION = {
  BadRequestException: 400,
  NotFoundException: 404,
  ConflictException: 409,
  ForbiddenException: 403,
  UnauthorizedException: 401,
  PayloadTooLargeException: 413,
  NotImplementedException: 501,
  ServiceUnavailableException: 503,
  HttpException: null, // status tường minh — xử lý riêng
};

/** Mã lỗi nghiệp vụ → HTTP status mặc định (bám `error-http-mapping.ts`). */
const STATUS_BY_CODE = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  TOKEN_INVALID: 401,
  TOKEN_EXPIRED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  DUPLICATE_RESOURCE: 409,
  LIMIT_EXCEEDED: 429,
  FILE_TOO_LARGE: 413,
  ATTACHMENT_TOO_LARGE: 400,
  UNSUPPORTED_FILE_TYPE: 400,
  UNSUPPORTED_MEDIA_TYPE: 400,
  DEPENDENCY_UNAVAILABLE: 503,
  DEPENDENCY_NOT_CONFIGURED: 501,
  INTERNAL_ERROR: 500,
};

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : e.name.endsWith('.ts') ? [full] : [];
  });
}

/** Trả về nội dung gốc (HEAD) của file, hoặc null nếu file mới. */
function originalContent(relFromRepo) {
  try {
    return execFileSync('git', ['show', `HEAD:${relFromRepo}`], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

/**
 * Trích danh sách `{ exception, code, message }` từ nội dung gốc.
 * Bỏ qua qua các `throw` dạng chuỗi đơn giản (đã map đúng theo mặc định).
 */
function extractOriginalThrows(content) {
  const out = [];
  const re = /new (BadRequest|NotFound|Conflict|Forbidden|Unauthorized|PayloadTooLarge|NotImplemented|ServiceUnavailable|Http)Exception\s*\(\s*\{/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const exc = `${m[1]}Exception`;
    // Lấy khối object.
    const open = content.indexOf('{', m.index);
    let depth = 0;
    let quote = null;
    let end = -1;
    for (let i = open; i < content.length; i++) {
      const ch = content[i];
      if (quote) {
        if (ch === '\\') i++;
        else if (ch === quote) quote = null;
        continue;
      }
      if (ch === "'" || ch === '"' || ch === '`') {
        quote = ch;
        continue;
      }
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end < 0) continue;
    const body = content.slice(open + 1, end);
    const codeMatch = /error\s*:\s*['"]([A-Z_]+)['"]/.exec(body);
    const msgMatch = /message\s*:\s*(['"`][\s\S]*?['"`])/.exec(body);
    out.push({
      exception: exc,
      code: codeMatch ? codeMatch[1] : null,
      message: msgMatch ? msgMatch[1] : null,
    });
  }
  return out;
}

const changes = [];

for (const file of walk(SRC)) {
  const relFromSrc = path.relative(SRC, file).split(path.sep).join('/');
  if (!/^modules\/[^/]+\/(application|infrastructure|presentation)\//.test(relFromSrc)) continue;

  const current = fs.readFileSync(file, 'utf8');
  if (!current.includes('DomainError(ERROR_CODES.')) continue;

  // Bản gốc: tìm trong git theo các đường dẫn có thể (đã đổi tên ở Bước 1).
  const candidates = [
    `src/backend/src/${relFromSrc}`,
    `src/backend/src/${relFromSrc.replace('/presentation/', '/infrastructure/http/')}`,
    `src/backend/src/${relFromSrc.replace('/presentation/controllers/', '/infrastructure/http/')}`,
    `src/backend/src/${relFromSrc.replace('/presentation/dtos/', '/infrastructure/http/dtos/')}`,
    `src/backend/src/${relFromSrc.replace('/application/', '/infrastructure/')}`,
  ];
  let original = null;
  for (const c of candidates) {
    original = originalContent(c);
    if (original) break;
  }
  if (!original) continue;

  const originalThrows = extractOriginalThrows(original);
  const byMessage = new Map();
  for (const t of originalThrows) {
    if (t.message) byMessage.set(t.message, t);
  }

  let updated = current;
  let fileChanged = false;

  // Tìm mọi `new DomainError(ERROR_CODES.CODE, 'msg'...)` và đối chiếu.
  const re = /new DomainError\(\s*ERROR_CODES\.([A-Z_]+)\s*,\s*(['"`][\s\S]*?['"`])/g;
  let m;
  while ((m = re.exec(updated)) !== null) {
    const code = m[1];
    const message = m[2];
    const orig = byMessage.get(message);
    if (!orig || !orig.code) continue;
    if (orig.code !== code) continue;

    const origStatus = STATUS_BY_EXCEPTION[orig.exception];
    if (origStatus === null || origStatus === undefined) continue;

    const defaultStatus = STATUS_BY_CODE[code];
    if (defaultStatus === undefined || origStatus === defaultStatus) continue;

    // ── Mismatch → chuyển sang `StatusError` giữ status gốc.
    const replacement =
      `new StatusError(${origStatus}, ERROR_CODES.${code}, ${message}`;
    updated = updated.slice(0, m.index) + replacement + updated.slice(m.index + m[0].length);
    re.lastIndex = m.index + replacement.length;
    fileChanged = true;
    changes.push({
      file: relFromSrc,
      message: message.slice(0, 70),
      code,
      origException: orig.exception,
      origStatus,
      defaultStatus,
    });
  }

  if (fileChanged) {
    // Thêm import `StatusError`.
    const appErrorsPath = `${'../'.repeat(path.relative(SRC, path.dirname(file)).split(path.sep).length)}shared/application/errors`;
    if (!updated.includes(`from '${appErrorsPath}'`)) {
      updated = updated.replace(
        /(import\s*\{[^}]*\}\s*from\s*'[^']*shared\/domain\/errors';)/,
        `$1\nimport { StatusError } from '${appErrorsPath}';`,
      );
    }
    if (!DRY_RUN) fs.writeFileSync(file, updated);
  }
}

console.log(`${DRY_RUN ? '[DRY-RUN] ' : ''}Sửa ${changes.length} chỗ lệch HTTP status:`);
for (const c of changes) {
  console.log(
    `  - ${c.file}\n      ${c.origException}(${c.origStatus}) + ${c.code} → mặc định ${c.defaultStatus} ❌ → StatusError(${c.origStatus})\n      msg: ${c.message}`,
  );
}
