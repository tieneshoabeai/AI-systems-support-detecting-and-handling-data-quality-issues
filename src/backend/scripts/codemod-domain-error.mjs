/**
 * Codemod Bước 2 — chuyển `HttpException` (NestJS) → `DomainError` (tầng domain).
 *
 * Chạy 1 lần, sau đó rà soát thủ công phần còn lại.
 *   node scripts/codemod-domain-error.mjs --dry-run
 *   node scripts/codemod-domain-error.mjs
 *
 * Nguyên tắc:
 *   - Chỉ đụng file trong `modules/<m>/application/` và `modules/<m>/infrastructure/`.
 *   - Chỉ đụng biểu thức `new XxxException(...)` — không đụng logic khác.
 *   - `HttpException` (status tường minh) → `StatusError` ở `shared/application/errors`.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const DRY_RUN = process.argv.includes('--dry-run');

/** Exception NestJS → mã lỗi nghiệp vụ mặc định. */
const CODE_BY_EXCEPTION = {
  BadRequestException: 'VALIDATION_ERROR',
  NotFoundException: 'NOT_FOUND',
  ConflictException: 'CONFLICT',
  ForbiddenException: 'FORBIDDEN',
  UnauthorizedException: 'UNAUTHENTICATED',
  PayloadTooLargeException: 'FILE_TOO_LARGE',
};

/** Exception NestJS → lớp DomainError tương ứng. */
const CLASS_BY_EXCEPTION = {
  BadRequestException: 'ValidationError',
  NotFoundException: 'NotFoundError',
  ConflictException: 'ConflictError',
  ForbiddenException: 'ForbiddenError',
  UnauthorizedException: 'UnauthenticatedError',
  PayloadTooLargeException: 'FileTooLargeError',
};

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : e.name.endsWith('.ts') ? [full] : [];
  });
}

/** Đường dẫn import tương đối từ file hiện tại tới một thư mục trong `src/`. */
function relImportPath(file, target) {
  const depth = path.relative(SRC, path.dirname(file)).split(path.sep).length;
  return `${'../'.repeat(depth)}${target}`;
}

/**
 * Quét từ `openParenIdx` (dấu `(`) để tìm dấu `)` đóng khớp, bỏ qua
 * nội dung trong chuỗi và template literal.
 */
function findCallEnd(src, openParenIdx) {
  let depth = 0;
  let quote = null;
  for (let i = openParenIdx; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '(' || ch === '{' || ch === '[') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Tách danh sách đối số cấp ngoài cùng theo dấu phẩy. */
function splitTopLevel(args) {
  const out = [];
  let depth = 0;
  let quote = null;
  let start = 0;
  for (let i = 0; i < args.length; i++) {
    const ch = args[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '(' || ch === '{' || ch === '[') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth--;
    else if (ch === ',' && depth === 0) {
      out.push(args.slice(start, i));
      start = i + 1;
    }
  }
  out.push(args.slice(start));
  return out.map((s) => s.trim()).filter((s) => s.length > 0);
}

/**
 * Phân tích object literal `{ message, error, details }` thành các trường.
 * Chỉ xử lý được khi các giá trị là biểu thức đơn giản (string/template/biến).
 *
 * Ghi chú: payload của NestJS thường có đuôi `as never` (để vượt kiểu
 * `objectOrError`), nên phải bóc tách đuôi này trước khi parse.
 */
function parseObjectLiteral(text) {
  let trimmed = text.trim();
  // Bỏ đuôi ép kiểu: `} as never` / `} as SomeType` / `} satisfies T`.
  const castMatch = /\}\s*(?:as\s+[\w.<>[\]|& ]+|satisfies\s+[\w.<>[\]|& ]+)$/.exec(trimmed);
  if (castMatch) {
    trimmed = trimmed.slice(0, castMatch.index + 1).trim();
  }
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
  const inner = trimmed.slice(1, -1);
  const parts = splitTopLevel(inner);
  const fields = {};
  for (const part of parts) {
    const idx = part.indexOf(':');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim().replace(/^['"]|['"]$/g, '');
    const value = part.slice(idx + 1).trim();
    fields[key] = value;
  }
  if (!fields.message) return null;
  return {
    messageExpr: fields.message,
    errorCode: fields.error ? fields.error.replace(/^['"]|['"]$/g, '') : null,
    details: fields.details ?? null,
  };
}

const changedFiles = [];
const unresolved = [];

for (const file of walk(SRC)) {
  const rel = path.relative(SRC, file).split(path.sep).join('/');
  if (!/^modules\/[^/]+\/(application|infrastructure)\//.test(rel)) continue;

  let src = fs.readFileSync(file, 'utf8');
  const original = src;

  const usedDomain = new Set();
  let usedStatusError = false;

  const EXC_RE = /new (BadRequest|NotFound|Conflict|Forbidden|Unauthorized|PayloadTooLarge|Http)Exception\s*\(/g;
  let m;
  while ((m = EXC_RE.exec(src)) !== null) {
    const excName = `${m[1]}Exception`;
    const openParen = src.indexOf('(', m.index + m[0].length - 1);
    const end = findCallEnd(src, openParen);
    if (end < 0) continue;
    const args = src.slice(openParen + 1, end);
    const trimmed = args.trim();

    let replacement;
    if (excName === 'HttpException') {
      const argList = splitTopLevel(args);
      if (argList.length < 2) {
        unresolved.push(`${rel}: HttpException với ${argList.length} đối số — cần sửa tay`);
        continue;
      }
      const obj = parseObjectLiteral(argList[0]);
      if (!obj) {
        unresolved.push(`${rel}: HttpException không parse được body`);
        continue;
      }
      const statusArg = argList[1];
      const statusName = /HttpStatus\.([A-Z_]+)/.exec(statusArg)?.[1];
      const code = statusName === 'TOO_MANY_REQUESTS' ? 'LIMIT_EXCEEDED' : 'VALIDATION_ERROR';
      usedDomain.add('ERROR_CODES');
      usedStatusError = true;
      replacement =
        `new StatusError(${statusArg}, ERROR_CODES.${code}, ${obj.messageExpr}` +
        `${obj.details ? `, ${obj.details}` : ''})`;
    } else {
      const cls = CLASS_BY_EXCEPTION[excName];
      const defaultCode = CODE_BY_EXCEPTION[excName];
      if (trimmed.startsWith('{')) {
        const obj = parseObjectLiteral(trimmed);
        if (!obj) {
          unresolved.push(`${rel}: ${excName} không parse được object payload`);
          continue;
        }
        const finalCode = obj.errorCode ?? defaultCode;
        usedDomain.add('ERROR_CODES');
        usedDomain.add('DomainError');
        replacement =
          `new DomainError(ERROR_CODES.${finalCode}, ${obj.messageExpr}` +
          `${obj.details ? `, ${obj.details}` : ''})`;
      } else {
        usedDomain.add(cls);
        replacement = `new ${cls}(${trimmed})`;
      }
    }

    src = src.slice(0, m.index) + replacement + src.slice(end + 1);
    EXC_RE.lastIndex = m.index + replacement.length;
  }

  if (src === original) continue;

  // ── Cập nhật block import ────────────────────────────────────────────────
  const lines = src.split('\n');
  const excNames = [...Object.keys(CLASS_BY_EXCEPTION), 'HttpException'];

  const importLineIdx = lines.findIndex((l) => l.includes("from '@nestjs/common'"));
  if (importLineIdx >= 0) {
    const inner = /import\s*\{([^}]*)\}\s*from\s*'@nestjs\/common';/.exec(lines[importLineIdx]);
    if (inner) {
      const kept = inner[1]
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s && !excNames.includes(s));
      if (kept.length) lines[importLineIdx] = `import { ${kept.join(', ')} } from '@nestjs/common';`;
      else lines.splice(importLineIdx, 1);
    }
  }

  const addImports = [];
  if (usedDomain.size) {
    addImports.push(
      `import { ${[...usedDomain].sort().join(', ')} } from '${relImportPath(file, 'shared/domain/errors')}';`,
    );
  }
  if (usedStatusError) {
    addImports.push(
      `import { StatusError } from '${relImportPath(file, 'shared/application/errors')}';`,
    );
  }

  // Chèn sau dòng import cuối cùng.
  let lastImportIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*import\s/.test(lines[i]) || /^\s*}\s*from\s*'/.test(lines[i])) lastImportIdx = i;
  }
  lines.splice(lastImportIdx + 1, 0, ...addImports);

  src = lines.join('\n');

  if (!DRY_RUN) fs.writeFileSync(file, src);
  changedFiles.push(rel);
}

console.log(`${DRY_RUN ? '[DRY-RUN] ' : ''}Đã xử lý ${changedFiles.length} file:`);
for (const f of changedFiles) console.log(`  - ${f}`);
if (unresolved.length) {
  console.log(`\n⚠ ${unresolved.length} chỗ cần sửa tay:`);
  for (const u of unresolved) console.log(`  - ${u}`);
}
