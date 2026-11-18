/**
 * Khôi phục đường dẫn import trong `test/` sau khi tái cấu trúc Bước 1.
 *
 * Bản ánh xạ lấy từ bảng §3.4 của Phần 16 (`shared/`) và §3.5 (`modules/`).
 *
 *   node scripts/fix-test-import-paths.mjs [--dry-run]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEST_DIR = path.join(ROOT, 'test');
const DRY_RUN = process.argv.includes('--dry-run');

/** `shared/<cũ>` → `shared/<mới>` (Bước 1 §3.4). */
const SHARED_MAP = {
  'shared/crypto': 'shared/domain/crypto',
  'shared/pagination': 'shared/domain/pagination',
  'shared/utils': 'shared/domain/utils',
  'shared/validation': 'shared/domain/validation',
  'shared/ports': 'shared/application/ports',
  'shared/database': 'shared/infrastructure/database',
  'shared/events': 'shared/infrastructure/events',
  'shared/application/outbox': 'shared/infrastructure/outbox',
  'shared/storage': 'shared/infrastructure/storage',
  'shared/adapters': 'shared/infrastructure/adapters',
  'shared/config': 'shared/infrastructure/config',
  'shared/casl': 'shared/interfaces/casl',
  'shared/decorators': 'shared/interfaces/decorators',
  'shared/filters': 'shared/interfaces/filters',
  'shared/guards': 'shared/interfaces/guards',
  'shared/interceptors': 'shared/interfaces/interceptors',
  'shared/middleware': 'shared/interfaces/middleware',
  'shared/pipes': 'shared/interfaces/pipes',
  'shared/swagger': 'shared/interfaces/swagger',
};

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : e.name.endsWith('.ts') ? [full] : [];
  });
}

const changed = [];

for (const file of walk(TEST_DIR)) {
  let src = fs.readFileSync(file, 'utf8');
  const original = src;

  // 1. `shared/<cũ>` → `shared/<mới>`.
  for (const [oldPath, newPath] of Object.entries(SHARED_MAP)) {
    const re = new RegExp(`(\\.\\./src/)${oldPath.replace('/', '\\/')}`, 'g');
    src = src.replace(re, `$1${newPath}`);
  }

  // 2. `modules/<m>/infrastructure/http/dtos/*` → `modules/<m>/presentation/dtos/*`.
  src = src.replace(
    /(\.\.\/src\/modules\/[a-z-]+)\/infrastructure\/http\/dtos\//g,
    '$1/presentation/dtos/',
  );

  // 3. `modules/<m>/infrastructure/http/*` (controller) → `modules/<m>/presentation/controllers/*`.
  src = src.replace(
    /(\.\.\/src\/modules\/[a-z-]+)\/infrastructure\/http\/(?!dtos)/g,
    '$1/presentation/controllers/',
  );

  if (src === original) continue;
  if (!DRY_RUN) fs.writeFileSync(file, src);
  changed.push(path.relative(ROOT, file));
}

console.log(`${DRY_RUN ? '[DRY-RUN] ' : ''}Sửa đường dẫn import ở ${changed.length} file test:`);
for (const f of changed) console.log(`  - ${f}`);
