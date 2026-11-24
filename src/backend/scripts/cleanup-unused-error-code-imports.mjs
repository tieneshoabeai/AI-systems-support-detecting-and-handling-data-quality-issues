/**
 * Dọn import `ERROR_CODES` không còn dùng trong `src/`.
 *
 * Chạy sau `normalize-domain-error-classes.mjs` — script đó có thể để lại
 * `ERROR_CODES` trong import dù đã không còn dùng (TS6133).
 *
 *   node scripts/cleanup-unused-error-code-imports.mjs [--dry-run]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const DRY_RUN = process.argv.includes('--dry-run');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : e.name.endsWith('.ts') ? [full] : [];
  });
}

const changed = [];

for (const file of walk(SRC)) {
  let src = fs.readFileSync(file, 'utf8');
  const original = src;

  const importRe = /import\s*\{([^}]*)\}\s*from\s*'([^']*shared\/domain\/errors)';/g;
  let m;
  while ((m = importRe.exec(src)) !== null) {
    const names = m[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const outside = src.slice(0, m.index) + src.slice(m.index + m[0].length);
    const kept = names.filter((n) => new RegExp(`\\b${n}\\b`).test(outside));
    if (kept.length === names.length) continue;
    const replacement = kept.length ? `import { ${kept.join(', ')} } from '${m[2]}';` : '';
    src = src.slice(0, m.index) + replacement + src.slice(m.index + m[0].length);
    importRe.lastIndex = m.index + replacement.length;
  }

  if (src === original) continue;
  if (!DRY_RUN) fs.writeFileSync(file, src);
  changed.push(path.relative(SRC, file));
}

console.log(`${DRY_RUN ? '[DRY-RUN] ' : ''}Dọn import ở ${changed.length} file:`);
for (const f of changed) console.log(`  - ${f}`);
