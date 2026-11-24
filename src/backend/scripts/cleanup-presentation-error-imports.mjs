/**
 * Dọn import `@nestjs/common` + thêm import `DomainError` trong
 * `modules/<m>/presentation/` và `modules/<m>/infrastructure/`.
 *
 *   node scripts/cleanup-presentation-error-imports.mjs [--dry-run]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
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

function relImportPath(file, target) {
  const depth = path.relative(SRC, path.dirname(file)).split(path.sep).length;
  return `${'../'.repeat(depth)}${target}`;
}

const changed = [];

for (const file of walk(SRC)) {
  const rel = path.relative(SRC, file).split(path.sep).join('/');
  if (!/^modules\/[^/]+\/(presentation|infrastructure)\//.test(rel)) continue;

  let src = fs.readFileSync(file, 'utf8');
  const original = src;
  const used = new Set();

  // 1. Thay `new XxxException(` → `new XxxError(`.
  for (const [exc, cls] of Object.entries(CLASS_BY_EXCEPTION)) {
    const re = new RegExp(`new ${exc}\\(`, 'g');
    if (!re.test(src)) continue;
    src = src.replace(re, `new ${cls}(`);
    used.add(cls);
  }

  // 1b. Phát hiện `new XxxError(` đã có sẵn (đã thay tay) → cần import tương ứng.
  for (const cls of Object.values(CLASS_BY_EXCEPTION)) {
    if (new RegExp(`new ${cls}\\(`).test(src)) used.add(cls);
  }

  if (src === original && used.size === 0) continue;

  // 2. Gỡ exception class không còn dùng khỏi import '@nestjs/common'.
  const importRe = /import\s*\{([\s\S]*?)\}\s*from\s*'@nestjs\/common';/g;
  let m;
  while ((m = importRe.exec(src)) !== null) {
    const names = m[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const outside = src.slice(0, m.index) + src.slice(m.index + m[0].length);
    const kept = names.filter((n) => {
      if (!Object.keys(CLASS_BY_EXCEPTION).includes(n)) return true;
      return new RegExp(`\\b${n}\\b`).test(outside);
    });
    const replacement = kept.length ? `import { ${kept.join(', ')} } from '@nestjs/common';` : '';
    src = src.slice(0, m.index) + replacement + src.slice(m.index + m[0].length);
    importRe.lastIndex = m.index + replacement.length;
  }

  // 3. Thêm import DomainError classes.
  if (used.size) {
    const imp = `import { ${[...used].sort().join(', ')} } from '${relImportPath(file, 'shared/domain/errors')}';`;
    if (!src.includes(imp)) {
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
  changed.push(rel);
}
console.log(`${DRY_RUN ? '[DRY-RUN] ' : ''}Cập nhật ${changed.length} file:`);
for (const f of changed) console.log(`  - ${f}`);
