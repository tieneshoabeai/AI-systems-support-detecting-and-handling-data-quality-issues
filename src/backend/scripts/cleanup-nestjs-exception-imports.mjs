/**
 * Dọn import `@nestjs/common` sau khi codemod Bước 2.
 *
 * Codemod `codemod-domain-error.mjs` chỉ xử lý được import block **một dòng**.
 * Với import block **nhiều dòng** (`import {\n  A,\n  B,\n} from '@nestjs/common'`),
 * các exception class đã bị thay đổi vẫn còn sót lại → gây lỗi
 * `TS6133: declared but its value is never read`.
 *
 * Script này quét lại toàn bộ file trong `modules/<m>/{application,infrastructure}/`
 * và gỡ mọi exception class của NestJS không còn được dùng.
 *
 *   node scripts/cleanup-nestjs-exception-imports.mjs [--dry-run]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const DRY_RUN = process.argv.includes('--dry-run');

/** Tên exception của NestJS không được tồn tại ở tầng application/infrastructure. */
const NESTJS_EXCEPTIONS = [
  'BadRequestException',
  'NotFoundException',
  'ConflictException',
  'ForbiddenException',
  'UnauthorizedException',
  'PayloadTooLargeException',
  'NotImplementedException',
  'ServiceUnavailableException',
  'HttpException',
  'UnprocessableEntityException',
  'InternalServerErrorException',
];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : e.name.endsWith('.ts') ? [full] : [];
  });
}

/** Đếm số lần xuất hiện của một identifier ngoài phần import đang xét. */
function countUsages(body, name) {
  const re = new RegExp(`\\b${name}\\b`, 'g');
  return (body.match(re) ?? []).length;
}

const changed = [];

for (const file of walk(SRC)) {
  const rel = path.relative(SRC, file).split(path.sep).join('/');
  if (!/^modules\/[^/]+\/(application|infrastructure)\//.test(rel)) continue;

  let src = fs.readFileSync(file, 'utf8');
  const original = src;

  // Tìm tất cả import block từ '@nestjs/common' (kể cả nhiều dòng).
  const importRe = /import\s*\{([\s\S]*?)\}\s*from\s*'@nestjs\/common';/g;
  let m;
  while ((m = importRe.exec(src)) !== null) {
    const names = m[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const used = names.filter((name) => {
      if (!NESTJS_EXCEPTIONS.includes(name)) return true;
      // Đếm usage ngoài chính block import này.
      const outside = src.slice(0, m.index) + src.slice(m.index + m[0].length);
      return countUsages(outside, name) > 0;
    });

    if (used.length === names.length) continue;

    const replacement = used.length
      ? `import { ${used.join(', ')} } from '@nestjs/common';`
      : '';
    src = src.slice(0, m.index) + replacement + src.slice(m.index + m[0].length);
    importRe.lastIndex = m.index + replacement.length;
  }

  if (src === original) continue;
  if (!DRY_RUN) fs.writeFileSync(file, src);
  changed.push(rel);
}

console.log(`${DRY_RUN ? '[DRY-RUN] ' : ''}Đã dọn import ở ${changed.length} file:`);
for (const f of changed) console.log(`  - ${f}`);
