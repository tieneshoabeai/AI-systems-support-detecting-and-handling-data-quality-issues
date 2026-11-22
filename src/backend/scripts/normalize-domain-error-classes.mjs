/**
 * Chuẩn hoá `new DomainError(ERROR_CODES.X, …)` → `new XError(…)`.
 *
 * Vì sao?
 *   `DomainError` là lớp **cơ sở**. Mỗi mã lỗi nghiệp vụ có một subclass
 *   riêng (`ValidationError`, `NotFoundError`, …). Dùng subclass thay vì lớp
 *   cơ sở giúp:
 *     - Code rõ ràng hơn khi đọc code (`throw new NotFoundError(...)` rõ hơn
 *       `throw new DomainError(ERROR_CODES.NOT_FOUND, ...)`).
 *     - Test có thể assert `toThrow(NotFoundError)` — đúng tinh thần.
 *
 *   Chỉ giữ `DomainError` cho các mã **không có** subclass tương ứng
 *   (VD: `TOKEN_EXPIRED`, `TOKEN_INVALID`, `UNSUPPORTED_FILE_TYPE`…).
 *
 *   node scripts/normalize-domain-error-classes.mjs [--dry-run]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const DRY_RUN = process.argv.includes('--dry-run');

/** Mã lỗi → subclass `DomainError` tương ứng. */
const CLASS_BY_CODE = {
  VALIDATION_ERROR: 'ValidationError',
  NOT_FOUND: 'NotFoundError',
  CONFLICT: 'ConflictError',
  FORBIDDEN: 'ForbiddenError',
  UNAUTHENTICATED: 'UnauthenticatedError',
  LIMIT_EXCEEDED: 'RateLimitExceededError',
  FILE_TOO_LARGE: 'FileTooLargeError',
  DEPENDENCY_UNAVAILABLE: 'DependencyUnavailableError',
  DUPLICATE_RESOURCE: 'DuplicateResourceError',
};

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : e.name.endsWith('.ts') ? [full] : [];
  });
}

const changed = [];

for (const file of walk(SRC)) {
  const rel = path.relative(SRC, file).split(path.sep).join('/');
  if (!/^modules\/[^/]+\/(application|infrastructure)\//.test(rel)) continue;

  let src = fs.readFileSync(file, 'utf8');
  const original = src;
  const used = new Set();

  for (const [code, cls] of Object.entries(CLASS_BY_CODE)) {
    const re = new RegExp(`new DomainError\\(\\s*ERROR_CODES\\.${code}\\s*,`, 'g');
    if (!re.test(src)) continue;
    src = src.replace(re, `new ${cls}(`);
    used.add(cls);
  }

  if (src === original) continue;

  // Cập nhật import: thêm subclass, gỡ `DomainError` nếu không còn dùng.
  const importRe = /import\s*\{([^}]*)\}\s*from\s*'([^']*shared\/domain\/errors)';/g;
  let m;
  while ((m = importRe.exec(src)) !== null) {
    const names = m[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const outside = src.slice(0, m.index) + src.slice(m.index + m[0].length);
    const kept = names.filter((n) => {
      if (n === 'DomainError') return new RegExp('\\bDomainError\\b').test(outside);
      return true;
    });
    for (const cls of used) if (!kept.includes(cls)) kept.push(cls);
    const replacement = `import { ${kept.sort().join(', ')} } from '${m[2]}';`;
    src = src.slice(0, m.index) + replacement + src.slice(m.index + m[0].length);
    importRe.lastIndex = m.index + replacement.length;
  }

  if (!DRY_RUN) fs.writeFileSync(file, src);
  changed.push(rel);
}

console.log(`${DRY_RUN ? '[DRY-RUN] ' : ''}Chuẩn hoá ở ${changed.length} file:`);
for (const f of changed) console.log(`  - ${f}`);
