/**
 * CODEMOD — Sửa file `application/<module>.types.ts` và `application/<module>.utils.ts`
 * do `split-commands-queries.ts` sinh ra.
 *
 * Vấn đề cần sửa:
 *  1. `utils.ts` sinh ra có thể chứa function/const **không có `export`** ⇒ file không
 *     phải là "module" ⇒ `import { x } from './x.utils'` báo TS2306.
 *  2. Các symbol bên ngoài (vd `maskCell` từ `domain/`) mà utils dùng bị mất import.
 *  3. `types.ts` có thể chứa `const` (vd `DEFAULT_LIMIT`) cần `export` để handler import được.
 *
 * Cách sửa:
 *  - Thêm `export` cho mọi `function`/`const`/`interface`/`type` ở cấp file chưa có export.
 *  - Quét lại các symbol bên ngoài được dùng → tìm trong service gốc để lấy import statement
 *    tương ứng → chèn vào file utils/types.
 *
 * Chạy: pnpm ts-node scripts/fix-shared-app-files.ts
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import ts from 'typescript';

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src/modules');

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

/** Tất cả service gốc trong 1 module. */
function serviceFiles(appDir: string): string[] {
  if (!fs.existsSync(appDir)) return [];
  return fs
    .readdirSync(appDir)
    .filter((f) => f.endsWith('.service.ts'))
    .map((f) => path.join(appDir, f));
}

/** Symbol ngoài file được dùng (chưa được khai báo/import trong file). */
function externalSymbolsUsed(content: string, localNames: Set<string>): string[] {
  // Lấy tất cả identifier dùng trong file.
  const sf = ts.createSourceFile('x.ts', content, ts.ScriptTarget.Latest, true);
  const used = new Set<string>();
  const visit = (n: ts.Node): void => {
    if (ts.isIdentifier(n)) used.add(n.text);
    ts.forEachChild(n, visit);
  };
  visit(sf);

  const builtins = new Set([
    'string', 'number', 'boolean', 'unknown', 'any', 'void', 'never', 'object',
    'Promise', 'Date', 'Map', 'Set', 'Array', 'Record', 'Partial', 'Readonly',
    'Buffer', 'Error', 'JSON', 'Math', 'Object', 'Symbol', 'RegExp', 'URL',
    'Null', 'Undefined', 'true', 'false', 'null', 'this', 'super', 'void',
    'unknown', 'never', 'bigint', 'symbol', 'console', 'process', 'global',
  ]);
  return [...used].filter(
    (n) => !localNames.has(n) && !builtins.has(n) && /^[A-Z]/.test(n),
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

const appDirs = fs
  .readdirSync(SRC, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => path.join(SRC, d.name, 'application'))
  .filter((p) => fs.existsSync(p));

let changed = 0;

for (const appDir of appDirs) {
  const moduleName = path.basename(path.dirname(appDir));
  const services = serviceFiles(appDir);

  for (const f of fs.readdirSync(appDir)) {
    if (!/\.(types|utils)\.ts$/.test(f)) continue;
    const abs = path.join(appDir, f);
    let content = fs.readFileSync(abs, 'utf8');
    const original = content;

    // 1) Thêm `export` cho declaration cấp file chưa export.
    const sf = ts.createSourceFile(abs, content, ts.ScriptTarget.Latest, true);
    const localNames = new Set<string>();
    const needExport: ts.Node[] = [];
    for (const stmt of sf.statements) {
      const isDecl =
        ts.isFunctionDeclaration(stmt) ||
        ts.isInterfaceDeclaration(stmt) ||
        ts.isTypeAliasDeclaration(stmt) ||
        ts.isClassDeclaration(stmt) ||
        ts.isEnumDeclaration(stmt);
      if (isDecl && stmt.name) {
        localNames.add(stmt.name.getText(sf));
        const mods = ts.canHaveModifiers(stmt) ? ts.getModifiers(stmt) : undefined;
        const hasExport = mods?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
        if (!hasExport) needExport.push(stmt);
      }
      if (ts.isVariableStatement(stmt)) {
        const mods = ts.canHaveModifiers(stmt) ? ts.getModifiers(stmt) : undefined;
        const hasExport = mods?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
        if (!hasExport) needExport.push(stmt);
        for (const d of stmt.declarationList.declarations) {
          if (ts.isIdentifier(d.name)) localNames.add(d.name.getText(sf));
        }
      }
    }

    // Áp dụng export từ cuối về đầu.
    const edits: { start: number; end: number; text: string }[] = [];
    for (const node of needExport) {
      edits.push({ start: node.getStart(sf), end: node.getStart(sf), text: 'export ' });
    }
    for (const e of edits.sort((a, b) => b.start - a.start)) {
      content = content.slice(0, e.start) + e.text + content.slice(e.end);
    }

    // 2) Tìm symbol ngoài dùng trong file → thêm import từ service gốc.
    const external = externalSymbolsUsed(content, localNames);
    const addImports = new Map<string, { raw: string; names: string[] }>();

    for (const sym of external) {
      for (const svc of services) {
        const svcContent = fs.readFileSync(svc, 'utf8');
        const svcSf = ts.createSourceFile(svc, svcContent, ts.ScriptTarget.Latest, true);
        for (const stmt of svcSf.statements) {
          if (!ts.isImportDeclaration(stmt)) continue;
          const spec = stmt.moduleSpecifier;
          if (!ts.isStringLiteral(spec)) continue;
          const raw = spec.text;
          if (!raw.startsWith('.')) continue;
          if (!/(domain|shared)\//.test(raw)) continue;
          const clause = stmt.importClause;
          if (!clause?.namedBindings || !ts.isNamedImports(clause.namedBindings)) continue;
          for (const el of clause.namedBindings.elements) {
            if (el.name.text !== sym) continue;
            const isType = el.isTypeOnly || clause.isTypeOnly;
            const local = el.name.text;
            const imported = el.propertyName?.text ?? local;
            const text = imported === local
              ? `${isType ? 'type ' : ''}${local}`
              : `${isType ? 'type ' : ''}${imported} as ${local}`;
            // Tính đường dẫn tương đối từ appDir (file utils/types nằm ở appDir).
            const target = path.resolve(path.dirname(svc), raw);
            let rel = path.relative(appDir, target);
            if (!rel.startsWith('.')) rel = `./${rel}`;
            rel = rel.split(path.sep).join('/');
            if (!addImports.has(rel)) addImports.set(rel, { raw: rel, names: [] });
            addImports.get(rel)?.names.push(text);
          }
        }
      }
    }

    if (addImports.size > 0) {
      const importLines = [...addImports.values()].map(
        (v) => `import { ${v.names.sort().join(', ')} } from '${v.raw}';`,
      );
      // Chèn sau header comment.
      const headerEnd = content.indexOf('*/');
      const insertAt = headerEnd >= 0 ? headerEnd + 3 : 0;
      content =
        content.slice(0, insertAt) +
        '\n' +
        importLines.join('\n') +
        '\n' +
        content.slice(insertAt);
    }

    if (content !== original) {
      fs.writeFileSync(abs, content, 'utf8');
      formatWithPrettier(abs);
      changed += 1;
      console.log(`  ▸ ${moduleName}/${f}`);
    }
  }
}

console.log(`\nĐã sửa ${changed} file types/utils.`);
