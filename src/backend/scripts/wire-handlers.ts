/**
 * CODEMOD — Cập nhật `<module>.module.ts` và controller sau khi tách commands/queries.
 *
 * 1. Module: thay `XxxService` trong `providers` bằng danh sách handler đã sinh.
 * 2. Controller: thay `private readonly xxxService: XxxService` bằng các handler
 *    tương ứng (mỗi handler 1 tham số constructor), và
 *    `this.xxxService.<method>(` → `this.<method>Handler.execute(`.
 *
 * Input: `.handler-manifest.json` (do `map-handler-to-service.ts` sinh) —
 *        mỗi entry: { rel, className, methodName, serviceName }.
 *
 * Idempotent: chạy lại nhiều lần cho cùng kết quả.
 * Cờ: --dry-run
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src/modules');
const MANIFEST = path.join(ROOT, '.handler-manifest.json');

const dryRun = process.argv.includes('--dry-run');

interface HandlerInfo {
  rel: string;
  className: string;
  methodName: string;
  serviceName: string;
}

function formatWithPrettier(absPath: string): void {
  try {
    execFileSync('npx', ['prettier', '--write', '--log-level', 'silent', absPath], {
      cwd: ROOT,
      stdio: 'ignore',
    });
  } catch {
    // Bỏ qua nếu Prettier không khả dụng.
  }
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const raw = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) as Record<string, HandlerInfo[]>;

// ── 1. Module ────────────────────────────────────────────────────────────────

function updateModule(moduleName: string, handlers: HandlerInfo[]): void {
  const modPath = path.join(SRC, moduleName, `${moduleName}.module.ts`);
  if (!fs.existsSync(modPath)) return;
  let content = fs.readFileSync(modPath, 'utf8');

  const byService = new Map<string, HandlerInfo[]>();
  for (const h of handlers) {
    if (!byService.has(h.serviceName)) byService.set(h.serviceName, []);
    byService.get(h.serviceName)?.push(h);
  }

  for (const [svcName, hs] of byService) {
    const importLines = hs
      .map((h) => `import { ${h.className} } from './application/${h.rel.replace(/\.ts$/, '')}';`)
      .sort();
    const providerLines = hs.map((h) => `    ${h.className},`).sort();
    void providerLines;

    // Xóa import service cũ.
    content = content.replace(
      new RegExp(`^import \\{ ${escapeRe(svcName)} \\} from '\\./application/[a-z-]+\\.service';\\n`, 'm'),
      '',
    );

    // Xóa import handler cũ (idempotent).
    for (const h of hs) {
      const rel = h.rel.replace(/\.ts$/, '');
      content = content.replace(
        new RegExp(`^import \\{ ${escapeRe(h.className)} \\} from '\\./application/${escapeRe(rel)}';\\n`, 'm'),
        '',
      );
    }

    // Chèn import handler sau import cuối cùng ở đầu file.
    const moduleStart = content.search(/^@Module\(/m);
    if (moduleStart < 0) continue;
    const importRe = /^import [\s\S]*?from '[^']*';\n/gm;
    let lastEnd = -1;
    let im: RegExpExecArray | null;
    while ((im = importRe.exec(content)) !== null) {
      lastEnd = im.index + im[0].length;
    }
    if (lastEnd >= 0) {
      content =
        content.slice(0, lastEnd) +
        importLines.join('\n') +
        '\n' +
        content.slice(lastEnd);
    }

    // Thay service trong `providers` bằng các handler (hỗ trợ cả mảng inline lẫn multi-line).
    content = content.replace(
      new RegExp(`(providers:\\s*\\[)([^\\]]*)(\\])`, 'g'),
      (_m, open: string, body: string, close: string) => {
        const items = body
          .split(',')
          .map((x) => x.trim())
          .filter((x) => x !== '');
        if (!items.includes(svcName)) return `${open}${body}${close}`;
        const idx = items.indexOf(svcName);
        items.splice(idx, 1, ...hs.map((h) => h.className));
        const multiline = body.includes('\n');
        const sep = multiline ? ',\n    ' : ', ';
        return `${open}${items.join(sep)}${close}`;
      },
    );


    // Xóa service khỏi `exports` (nếu còn) — xử lý theo từng phần tử của mảng.
    content = content.replace(
      new RegExp(`(exports:\\s*\\[)([^\\]]*)(\\])`, 'g'),
      (_m, open: string, body: string, close: string) => {
        const items = body
          .split(',')
          .map((x) => x.trim())
          .filter((x) => x !== '' && x !== svcName);
        const sep = items.length > 3 ? ',\n    ' : ', ';
        return `${open}${items.join(sep)}${close}`;
      },
    );
  }

  if (!dryRun) {
    fs.writeFileSync(modPath, content, 'utf8');
    formatWithPrettier(modPath);
  }
  console.log(`  ▸ module ${moduleName}.module.ts`);
}

// ── 2. Controller ────────────────────────────────────────────────────────────

function updateControllers(moduleName: string, handlers: HandlerInfo[]): void {
  const infraDir = path.join(SRC, moduleName, 'infrastructure/http');
  if (!fs.existsSync(infraDir)) return;

  const files = fs
    .readdirSync(infraDir)
    .filter((f) => f.endsWith('.controller.ts'))
    .map((f) => path.join(infraDir, f));

  const byService = new Map<string, HandlerInfo[]>();
  for (const h of handlers) {
    if (!byService.has(h.serviceName)) byService.set(h.serviceName, []);
    byService.get(h.serviceName)?.push(h);
  }

  for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    const original = content;
    const newImports: string[] = [];

    // 2a. Thay lời gọi `this.<x>Service.<method>(` → `this.<method>Handler.execute(`.
    //     Hỗ trợ multi-line (`this.svc\n  .method(`).
    for (const [, hs] of byService) {
      for (const h of hs) {
        content = content.replace(
          new RegExp(
            `this\\.\\w+Service\\s*\\.\\s*${escapeRe(h.methodName)}\\s*\\(`,
            'g',
          ),
          `this.${h.methodName}Handler.execute(`,
        );
      }
    }

    for (const [svcName, hs] of byService) {
      // 2b. Thay param constructor `private readonly x: XxxService` → các handler
      //     THỰC SỰ được dùng trong controller này.
      const ctorRe = new RegExp(`constructor\\s*\\(([\\s\\S]*?)\\)\\s*\\{`, 'm');
      const ctorMatch = ctorRe.exec(content);
      if (!ctorMatch) continue;
      const paramsBody = ctorMatch[1] ?? '';
      const paramRe = new RegExp(
        `^(\\s*)private readonly (\\w+): ${escapeRe(svcName)}(,?)`,
        'm',
      );
      const pm = paramRe.exec(paramsBody);
      if (!pm || pm[1] === undefined) continue;

      const used = hs.filter((h) => content.includes(`this.${h.methodName}Handler.`));
      const indent = pm[1];
      let newParamsBody: string;
      if (used.length === 0) {
        // Service được inject nhưng không dùng → gỡ hẳn param.
        newParamsBody = paramsBody.replace(paramRe, '').replace(/,\s*,/g, ',').replace(/^\s*,\s*/m, '');
      } else {
        const replacement =
          used
            .map((h) => `${indent}private readonly ${h.methodName}Handler: ${h.className}`)
            .join(',\n') + (pm[3] ?? '');
        newParamsBody = paramsBody.replace(paramRe, replacement);
      }
      content =
        content.slice(0, ctorMatch.index) +
        `constructor(${newParamsBody}) {` +
        content.slice(ctorMatch.index + ctorMatch[0].length);

      // 2c. Thu thập import handler cần thiết.
      for (const h of used) {
        const rel = h.rel.replace(/\.ts$/, '');
        const importPath = `../../application/${rel}`;
        const importLine = `import { ${h.className} } from '${importPath}';`;
        if (content.includes(importLine)) continue;
        newImports.push(importLine);
      }
    }

    // 2d. Xóa import service cũ (chỉ khi không còn tham chiếu), chèn import handler.
    for (const [svcName] of byService) {
      if (new RegExp(`this\\.\\w*Service\\b`).test(content)) continue;
      content = content.replace(
        new RegExp(`^import \\{ ${escapeRe(svcName)} \\} from '\\.\\./\\.\\./application/[a-z-]+\\.service';\\n`, 'm'),
        '',
      );
    }
    if (newImports.length > 0) {
      const importRe = /^import [\s\S]*?from '[^']*';\n/gm;
      let lastEnd = -1;
      let im: RegExpExecArray | null;
      while ((im = importRe.exec(content)) !== null) {
        lastEnd = im.index + im[0].length;
      }
      if (lastEnd >= 0) {
        content =
          content.slice(0, lastEnd) +
          [...new Set(newImports)].sort().join('\n') +
          '\n' +
          content.slice(lastEnd);
      }
    }

    if (content !== original) {
      if (!dryRun) {
        fs.writeFileSync(file, content, 'utf8');
        formatWithPrettier(file);
      }
      console.log(`  ▸ controller ${path.basename(file)}`);
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

for (const [moduleName, handlers] of Object.entries(raw)) {
  console.log(`\n▸ ${moduleName}`);
  updateModule(moduleName, handlers);
  updateControllers(moduleName, handlers);
}
console.log(dryRun ? '\n(dry-run)' : '\nXong');
