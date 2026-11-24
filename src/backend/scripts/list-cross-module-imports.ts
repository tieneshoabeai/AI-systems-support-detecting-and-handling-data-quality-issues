/**
 * Script liệt kê mọi import chéo module (dùng để refactor L2/L3a/L4).
 * Chạy: pnpm ts-node scripts/list-cross-module-imports.ts
 */
import * as fs from 'fs';
import * as path from 'path';

const SRC = path.resolve(__dirname, '..', 'src');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full));
    else if (e.name.endsWith('.ts')) out.push(full);
  }
  return out;
}

const IMPORT_RE = /^[ \t]*import\s+(?:type\s+)?([\s\S]*?)\s*from\s*['"]([^'"]+)['"]/gm;
const EXPORT_RE = /^[ \t]*export\s+(?:type\s+)?(?:\*|\{[\s\S]*?\})\s*from\s*['"]([^'"]+)['"]/gm;

function moduleOf(p: string): string | null {
  const rel = path.relative(SRC, p);
  const parts = rel.split(path.sep);
  return parts[0] === 'modules' ? parts[1] ?? null : null;
}

const files = walk(SRC);
const rows: string[] = [];

for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  const raws: string[] = [];
  IMPORT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = IMPORT_RE.exec(content)) !== null) raws.push(m[2] ?? '');
  EXPORT_RE.lastIndex = 0;
  while ((m = EXPORT_RE.exec(content)) !== null) raws.push(m[2] ?? '');

  for (const raw of raws) {
    if (!raw.startsWith('.')) continue;
    const base = path.resolve(path.dirname(f), raw);
    let target: string | null = null;
    for (const c of [base, `${base}.ts`, path.join(base, 'index.ts')]) {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) { target = c; break; }
    }
    if (!target) continue;
    const fromMod = moduleOf(f);
    const toMod = moduleOf(target);
    if (!fromMod || !toMod || fromMod === toMod) continue;
    rows.push(`${path.relative(SRC, f)} -> ${path.relative(SRC, target)}`);
  }
}

rows.sort();
console.log(rows.join('\n'));
console.log(`\nTOTAL: ${rows.length}`);
