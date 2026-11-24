/**
 * CODEMOD — Rebase đường dẫn import tương đối trong các file handler mới.
 *
 * Vì sao cần:
 * Codemod `split-commands-queries.ts` copy nguyên văn các import statement từ
 * service gốc (`application/<x>.service.ts`) sang handler (`application/commands/…`).
 * Handler nằm sâu hơn 1 cấp thư mục ⇒ mọi đường dẫn tương đối bị lệch
 * (vd `../domain/ports/x.port` → `../../domain/ports/x.port`).
 *
 * Cách sửa (không cần biết handler sinh từ service nào):
 *   Với mỗi import tương đối `raw` trong handler:
 *     1. Thử resolve `raw` từ thư mục của TẤT CẢ service gốc ở `application/*.service.ts`.
 *        Service gốc nằm cùng cấp `application/` với handler's parent ⇒ đây là
 *        "đường dẫn chuẩn" của codebase.
 *     2. Nếu resolve được → `target` là file thật ⇒ tính lại đường dẫn tương đối
 *        từ thư mục handler tới `target`.
 *     3. Không resolve được ở service nào → giữ nguyên và báo cáo.
 *
 * Chạy: pnpm ts-node scripts/rebase-handler-imports.ts
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import ts from 'typescript';

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src/modules');
const MANIFEST = path.join(ROOT, '.handler-manifest.json');

function formatWithPrettier(absPath: string): void {
  try {
    execFileSync('npx', ['prettier', '--write', '--log-level', 'silent', absPath], {
      cwd: ROOT,
      stdio: 'ignore',
    });
  } catch {
    // Bỏ qua.
  }
}

/** Resolve một đường dẫn (không/kèm extension) tới file TypeScript thật. */
function resolveFile(p: string): string | null {
  if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  for (const ext of ['.ts', '.tsx', '/index.ts']) {
    const cand = `${p}${ext}`;
    if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return cand;
  }
  return null;
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) as Record<string, string[]>;

let changedFiles = 0;
const unresolved: string[] = [];

for (const [moduleName, relPaths] of Object.entries(manifest)) {
  const appDir = path.join(SRC, moduleName, 'application');
  if (!fs.existsSync(appDir)) continue;

  // Thư mục "gốc" để tính đường dẫn chuẩn: thư mục chứa service gốc.
  const baseDirs = new Set<string>([appDir]);
  for (const f of fs.readdirSync(appDir)) {
    if (f.endsWith('.service.ts')) baseDirs.add(appDir);
  }

  for (const relPath of relPaths) {
    const handlerAbs = path.join(appDir, relPath);
    if (!fs.existsSync(handlerAbs)) continue;
    const handlerDir = path.dirname(handlerAbs);

    const content = fs.readFileSync(handlerAbs, 'utf8');
    const sf = ts.createSourceFile(handlerAbs, content, ts.ScriptTarget.Latest, true);

    const edits: { start: number; end: number; text: string }[] = [];

    for (const stmt of sf.statements) {
      if (!ts.isImportDeclaration(stmt)) continue;
      const spec = stmt.moduleSpecifier;
      if (!ts.isStringLiteral(spec)) continue;
      const raw = spec.text;
      if (!raw.startsWith('.')) continue;

      // 1) Thử resolve từ chính thư mục handler — nếu được thì import đã đúng.
      const self = resolveFile(path.resolve(handlerDir, raw));
      if (self) continue;

      // 2) Thử resolve từ các thư mục gốc (application/) — đường dẫn chuẩn của codebase.
      let target: string | null = null;
      for (const base of baseDirs) {
        const cand = resolveFile(path.resolve(base, raw));
        if (cand) {
          target = cand;
          break;
        }
      }
      if (!target) {
        unresolved.push(`${moduleName}/${relPath}: không resolve được '${raw}'`);
        continue;
      }

      let newPath = path.relative(handlerDir, target);
      if (!newPath.startsWith('.')) newPath = `./${newPath}`;
      newPath = newPath.split(path.sep).join('/');
      // Bỏ extension `.ts` — codebase dùng import không extension.
      newPath = newPath.replace(/\.ts$/, '');
      if (newPath !== raw) {
        edits.push({ start: spec.getStart(sf) + 1, end: spec.getEnd() - 1, text: newPath });
      }
    }

    if (edits.length === 0) continue;
    let out = content;
    for (const e of edits.sort((a, b) => b.start - a.start)) {
      out = out.slice(0, e.start) + e.text + out.slice(e.end);
    }
    fs.writeFileSync(handlerAbs, out, 'utf8');
    formatWithPrettier(handlerAbs);
    changedFiles += 1;
  }
}

console.log(`Đã rebase ${changedFiles} file handler.`);
if (unresolved.length > 0) {
  console.log(`\n⚠️  ${unresolved.length} import không resolve được:`);
  for (const u of unresolved.slice(0, 40)) console.log(`   - ${u}`);
}
