/**
 * Dọn import trùng/sai trong `test/` sau codemod Bước 2.
 *
 *   - Gộp các import `DomainError` class từ cùng một module thành 1 dòng.
 *   - Sửa đường dẫn sai (`../../shared/...` thay vì `../src/shared/...`).
 *
 *   node scripts/dedupe-test-error-imports.mjs [--dry-run]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEST_DIR = path.join(ROOT, 'test');
const DRY_RUN = process.argv.includes('--dry-run');

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

  // ── 1. Chuẩn hoá đường dẫn import lỗi (`../../shared/…` → `../src/shared/…`) ──
  src = src.replace(/from '\.\.\/\.\.\/shared\//g, "from '../src/shared/");

  // ── 2. Gộp import DomainError class trùng module ─────────────────────────
  const importRe = /import\s*\{([^}]*)\}\s*from\s*'([^']*shared\/domain\/errors)';/g;
  const merged = new Map();
  let m;
  while ((m = importRe.exec(src)) !== null) {
    const names = m[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const mod = m[2];
    const set = merged.get(mod) ?? new Set();
    for (const n of names) set.add(n);
    merged.set(mod, set);
  }

  if (merged.size > 0) {
    // Gỡ hết các import domain/errors cũ.
    src = src.replace(importRe, '');
    // Chèn lại 1 import cho mỗi module, ngay sau block import đầu tiên.
    const lines = src.split('\n');
    let lastImportIdx = -1;
    for (let i = 0; i < lines.length && i < 60; i++) {
      if (/^\s*import\s/.test(lines[i]) || /^\s*\}\s*from\s*'/.test(lines[i])) lastImportIdx = i;
    }
    const add = [];
    for (const [mod, set] of merged) {
      add.push(`import { ${[...set].sort().join(', ')} } from '${mod}';`);
    }
    lines.splice(lastImportIdx + 1, 0, ...add);
    src = lines.join('\n');
  }

  // ── 3. Gỡ dòng import trống dư ──────────────────────────────────────────
  src = src.replace(/^\s*\n(?=\s*import)/gm, '');

  if (src === original) continue;
  if (!DRY_RUN) fs.writeFileSync(file, src);
  changed.push(path.relative(ROOT, file));
}

console.log(`${DRY_RUN ? '[DRY-RUN] ' : ''}Dọn import ở ${changed.length} file test:`);
for (const f of changed) console.log(`  - ${f}`);
