/**
 * Codemod test (bước 2) — xử lý assertion **nhiều dòng**.
 *
 * Codemod `codemod-test-domain-error.mjs` chỉ bắt được assertion 1 dòng:
 *   `rejects.toThrow(NotFoundException)`
 *
 * Còn assertion nhiều dòng:
 *   ```
 *   await expect(x).rejects.toBeInstanceOf(
 *     NotFoundException,
 *   );
 *   ```
 *
 * Script này quét mọi vị trí `.toThrow(` / `.toBeInstanceOf(` rồi thay tên
 * exception **bên trong ngoặc** — không quan tâm xuống dòng hay không.
 *
 *   node scripts/codemod-test-assertions-multiline.mjs [--dry-run]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEST_DIR = path.join(ROOT, 'test');
const SRC_DIR = path.join(ROOT, 'src');
const DRY_RUN = process.argv.includes('--dry-run');

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

function relImportPath(file) {
  const depth = path.relative(SRC_DIR, path.dirname(file)).split(path.sep).length;
  return `${'../'.repeat(depth)}shared/domain/errors`;
}

/** Tìm vị trí đóng ngoặc `)` khớp với `(` tại `openIdx`. */
function matchParen(src, openIdx) {
  let depth = 0;
  let quote = null;
  for (let i = openIdx; i < src.length; i++) {
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
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

const changed = [];

for (const file of walk(TEST_DIR)) {
  let src = fs.readFileSync(file, 'utf8');
  const original = src;
  const used = new Set();

  // Tìm mọi `.toThrow(` / `.toBeInstanceOf(` rồi thay bên trong ngoặc.
  const callRe = /\.(toThrow|toBeInstanceOf)\s*\(/g;
  let m;
  while ((m = callRe.exec(src)) !== null) {
    const openIdx = m.index + m[0].length - 1;
    const closeIdx = matchParen(src, openIdx);
    if (closeIdx < 0) continue;
    const inner = src.slice(openIdx + 1, closeIdx);
    let newInner = inner;
    for (const [exc, cls] of Object.entries(CLASS_BY_EXCEPTION)) {
      const re = new RegExp(`\\b${exc}\\b`, 'g');
      if (!re.test(newInner)) continue;
      newInner = newInner.replace(re, cls);
      used.add(cls);
    }
    if (newInner === inner) continue;
    src = src.slice(0, openIdx + 1) + newInner + src.slice(closeIdx);
    callRe.lastIndex = openIdx + newInner.length + 1;
  }

  if (src === original) continue;

  // Gỡ exception class không còn dùng khỏi import '@nestjs/common'.
  const importRe = /import\s*\{([\s\S]*?)\}\s*from\s*'@nestjs\/common';/g;
  let im;
  while ((im = importRe.exec(src)) !== null) {
    const names = im[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const excNames = Object.keys(CLASS_BY_EXCEPTION);
    const kept = names.filter((n) => {
      if (!excNames.includes(n)) return true;
      const outside = src.slice(0, im.index) + src.slice(im.index + im[0].length);
      return new RegExp(`\\b${n}\\b`).test(outside);
    });
    const replacement = kept.length ? `import { ${kept.join(', ')} } from '@nestjs/common';` : '';
    src = src.slice(0, im.index) + replacement + src.slice(im.index + im[0].length);
    importRe.lastIndex = im.index + replacement.length;
  }

  // Thêm import DomainError classes.
  if (used.size) {
    const imp = `import { ${[...used].sort().join(', ')} } from '${relImportPath(file)}';`;
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
  changed.push(path.relative(ROOT, file));
}

console.log(`${DRY_RUN ? '[DRY-RUN] ' : ''}Cập nhật ${changed.length} file test:`);
for (const f of changed) console.log(`  - ${f}`);
