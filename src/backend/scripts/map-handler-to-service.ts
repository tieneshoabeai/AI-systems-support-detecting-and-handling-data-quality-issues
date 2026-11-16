/**
 * CODEMOD — Suy ra mapping `handler → service gốc` cho từng handler đã sinh.
 *
 * Vì sao cần:
 * Tên class handler (`DispatchHandler`) không suy ra được tên service gốc
 * (`NotificationsService`) — service có thể chứa nhiều UC không liên quan tên.
 * Nhưng tên FILE handler chính là kebab-case của tên method trong service gốc
 * (`dispatch.handler.ts` ← `dispatch()` của `NotificationsService`).
 *
 * Cách làm:
 *  1. Parse mọi `application/*.service.ts` → danh sách (serviceName, methodNames).
 *  2. Với mỗi file handler: camelCase(base file) → tìm service có method đó.
 *     - Nếu nhiều service khớp → ưu tiên service có tiền tố tên khớp với
 *       tiền tố của tên handler (vd `get-report-file-meta` → `ReportService`).
 *  3. Ghi lại `.handler-manifest.json` ở dạng có `serviceName`.
 *
 * Chạy: pnpm ts-node scripts/map-handler-to-service.ts
 */
import fs from 'fs';
import path from 'path';
import ts from 'typescript';

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src/modules');
const MANIFEST = path.join(ROOT, '.handler-manifest.json');

function kebabToCamel(k: string): string {
  return k.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

interface ServiceInfo {
  name: string;
  file: string;
  methods: string[];
}

function parseServices(appDir: string): ServiceInfo[] {
  const out: ServiceInfo[] = [];
  if (!fs.existsSync(appDir)) return out;
  for (const f of fs.readdirSync(appDir)) {
    if (!f.endsWith('.service.ts')) continue;
    const abs = path.join(appDir, f);
    const sf = ts.createSourceFile(abs, fs.readFileSync(abs, 'utf8'), ts.ScriptTarget.Latest, true);
    for (const stmt of sf.statements) {
      if (!ts.isClassDeclaration(stmt) || !stmt.name) continue;
      const methods: string[] = [];
      for (const m of stmt.members) {
        if (!ts.isMethodDeclaration(m) || !m.name) continue;
        const mods = ts.canHaveModifiers(m) ? ts.getModifiers(m) : undefined;
        if (mods?.some((x) => x.kind === ts.SyntaxKind.PrivateKeyword)) continue;
        methods.push(m.name.getText(sf));
      }
      out.push({ name: stmt.name.getText(sf), file: f, methods });
    }
  }
  return out;
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) as Record<string, string[]>;
const outManifest: Record<string, unknown[]> = {};
let unmapped = 0;

for (const [moduleName, rels] of Object.entries(manifest)) {
  const appDir = path.join(SRC, moduleName, 'application');
  const services = parseServices(appDir);
  const entries: unknown[] = [];

  for (const rel of rels) {
    const base = path.basename(rel, '.handler.ts');
    const methodName = kebabToCamel(base);

    // Tìm service chứa method này.
    let candidates = services.filter((s) => s.methods.includes(methodName));

    if (candidates.length > 1) {
      // Ưu tiên service có tiền tố tên khớp: `get-report-file-meta` → `ReportService`.
      const prefix = base.split('-')[0] ?? '';
      const scored = candidates
        .map((s) => {
          const sn = s.name.replace(/Service$/, '').toLowerCase();
          let score = 0;
          if (sn.startsWith(prefix)) score += 10;
          // handler có chứa tên service (vd `update-project-member-role` → `ProjectService`)
          const words = base.split('-');
          if (words.some((w) => w.length > 3 && sn.includes(w))) score += 2;
          return { s, score };
        })
        .sort((a, b) => b.score - a.score);
      const best = scored[0]?.s ?? candidates[0];
      if (best) candidates = [best];
    }

    const service = candidates[0];
    if (!service) {
      unmapped += 1;
      console.log(`  ⚠️  ${moduleName}/${rel}: không tìm thấy service chứa method '${methodName}'`);
      continue;
    }

    const handlerAbs = path.join(appDir, rel);
    const sf = ts.createSourceFile(handlerAbs, fs.readFileSync(handlerAbs, 'utf8'), ts.ScriptTarget.Latest, true);
    let className = '';
    for (const stmt of sf.statements) {
      if (ts.isClassDeclaration(stmt) && stmt.name) {
        className = stmt.name.getText(sf);
        break;
      }
    }

    entries.push({
      rel,
      className,
      methodName,
      serviceName: service.name,
    });
  }

  outManifest[moduleName] = entries;
}

fs.writeFileSync(MANIFEST, JSON.stringify(outManifest, null, 2), 'utf8');
console.log(`\nĐã cập nhật manifest với mapping service.`);
if (unmapped > 0) console.log(`⚠️  ${unmapped} handler không map được service gốc.`);
