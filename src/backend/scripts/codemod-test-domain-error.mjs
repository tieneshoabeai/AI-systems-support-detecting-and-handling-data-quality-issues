/**
 * Codemod test — Bước 2: cập nhật assertion từ exception NestJS sang `DomainError`.
 *
 * CHỈ thay trong ngữ cảnh assertion:
 *   `rejects.toThrow(NotFoundException)`      → `rejects.toThrow(NotFoundError)`
 *   `rejects.toBeInstanceOf(BadRequestException)` → `rejects.toBeInstanceOf(ValidationError)`
 *
 * KHÔNG đụng:
 *   - `new XxxException({...})` trong test (cần sửa tay — payload khác nhau).
 *   - Chuỗi mô tả trong `it('...')`.
 *
 *   node scripts/codemod-test-domain-error.mjs [--dry-run]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEST_DIR = path.join(ROOT, 'test');
const SRC_DIR = path.join(ROOT, 'src');
const DRY_RUN = process.argv.includes('--dry-run');

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

/** Đường dẫn import tương đối từ file test tới `src/shared/domain/errors`. */
function relImportPath(file) {
  const depth = path.relative(SRC_DIR, path.dirname(file)).split(path.sep).length;
  return `${'../'.repeat(depth)}shared/domain/errors`;
}

const changed = [];

for (const file of walk(TEST_DIR)) {
  let src = fs.readFileSync(file, 'utf8');
  const original = src;
  const used = new Set();

  // ── 1. Thay trong assertion ────────────────────────────────────────────
  for (const [exc, cls] of Object.entries(CLASS_BY_EXCEPTION)) {
    const re = new RegExp(`(\\.to(?:Throw|BeInstanceOf)\\()${exc}(\\))`, 'g');
    if (!re.test(src)) continue;
    src = src.replace(re, `$1${cls}$2`);
    used.add(cls);
  }

  if (src === original) continue;

  // ── 2. Gỡ exception class khỏi import '@nestjs/common' ──────────────────
  const importRe = /import\s*\{([\s\S]*?)\}\s*from\s*'@nestjs\/common';/g;
  let m;
  while ((m = importRe.exec(src)) !== null) {
    const names = m[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const excNames = Object.keys(CLASS_BY_EXCEPTION);
    // Chỉ gỡ nếu exception đó không còn được dùng ở đâu khác trong file.
    const stillUsed = names.filter((n) => {
      if (!excNames.includes(n)) return true;
      const outside = src.slice(0, m.index) + src.slice(m.index + m[0].length);
      return new RegExp(`\\b${n}\\b`).test(outside);
    });
    const replacement = stillUsed.length
      ? `import { ${stillUsed.join(', ')} } from '@nestjs/common';`
      : '';
    src = src.slice(0, m.index) + replacement + src.slice(m.index + m[0].length);
    importRe.lastIndex = m.index + replacement.length;
  }

  // ── 3. Thêm import DomainError classes ──────────────────────────────────
  if (used.size) {
    const imp = `import { ${[...used].sort().join(', ')} } from '${relImportPath(file)}';`;
    if (!src.includes(imp)) {
      // Chèn sau block import đầu tiên (sau dòng import cuối cùng ở đầu file).
      const lines = src.split('\n');
      let lastImportIdx = -1;
      for (let i = 0; i < lines.length && i < 60; i++) {
        if (/^\s*import\s/.test(lines[i]) || /^\s*\}\s*from\s*'/.test(lines[i])) lastImportIdx = i;
      }
      lines.splice(lastImportIdx + 1, 0, imp);
      src = lines.join('\n');
    }
  }

  if (!DRY_RUN) fs.writeFileSync(file, src);
  changed.push(path.relative(ROOT, file));
}

console.log(`${DRY_RUN ? '[DRY-RUN] ' : ''}Cập nhật ${changed.length} file test:`);
for (const f of changed) console.log(`  - ${f}`);
