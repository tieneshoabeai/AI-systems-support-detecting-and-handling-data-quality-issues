/**
 * CODEMOD — Tách `application/*.service.ts` thành `application/commands/` + `application/queries/`
 * theo `5_ports_adapters_design_v2.md` §3.10 (Command/Query pattern, KHÔNG dùng CQRS framework).
 *
 * Mỗi use case (public method) → 1 handler class trong file riêng:
 *   application/commands/<verb>-<noun>.handler.ts   (thay đổi trạng thái)
 *   application/queries/<verb>-<noun>.handler.ts    (chỉ đọc)
 *
 * Cơ chế:
 *  1. Parse service bằng TypeScript AST.
 *  2. Trích constructor deps (giữ nguyên decorator @Inject/@Optional + kiểu) và property phụ.
 *  3. Với mỗi public method, xác định `this.X`:
 *     - `this.<dep>`              → inject lại dep (kèm decorator).
 *     - `this.<private helper>`   → copy helper vào handler.
 *     - `this.<public method khác>`→ inject handler của method đó (property tên = tên method gốc).
 *  4. Gom file-level declarations (interface/type/function/const) vào:
 *     - `application/<module>.types.ts`  (interface + type alias + const)
 *     - `application/<module>.utils.ts`  (function thuần)
 *  5. Sinh handler files.
 *
 * Cờ:
 *   --dry-run        chỉ in kế hoạch, không ghi file
 *   --module=<name>  chỉ xử lý 1 module
 *   --write-index   ghi đè `application/<module>.index.ts` (danh sách handler)
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import ts from 'typescript';

const SRC = path.resolve(__dirname, '../src/modules');

// ── Phân loại command vs query ──────────────────────────────────────────────
/**
 * Tiền tố method → use case chỉ đọc.
 * LƯU Ý: danh sách này là heuristic; các method được gọi nội bộ từ method khác
 * vẫn được tách riêng, nhưng handler được inject chéo (không gọi trực tiếp).
 */
const QUERY_PREFIXES = [
  'get', 'list', 'find', 'count', 'read', 'search', 'resolve', 'check', 'exists',
  'fetch', 'preview', 'stat', 'stats', 'summary', 'summarize', 'download', 'view',
  'detail', 'total', 'average', 'compare', 'inspect', 'export', 'validate',
];

/** Method luôn là command (ghi trạng thái) dù có tiền tố "get/list". */
const FORCE_COMMAND = new Set([
  'getDetail', 'getRecords', 'getProjectById', 'getWorkspaceById',
]);

function classify(name: string): 'command' | 'query' {
  if (FORCE_COMMAND.has(name)) return 'command';
  const lower = name.charAt(0).toLowerCase() + name.slice(1);
  for (const p of QUERY_PREFIXES) {
    if (lower.startsWith(p)) return 'query';
  }
  return 'command';
}

// ── Helpers ──────────────────────────────────────────────────────────────────

interface Dep {
  name: string;
  typeText: string;
  decorators: string[];
  /** Token DI cần import (vd `NOTIFICATION_REPOSITORY_PORT`). */
  tokens: string[];
}

interface MethodInfo {
  name: string;
  text: string;
  visibility: 'public' | 'private' | 'protected';
  usedThis: Set<string>;
}

interface ParsedService {
  absPath: string;
  moduleName: string;
  className: string;
  deps: Dep[];
  extraProps: { name: string; text: string }[];
  methods: Map<string, MethodInfo>;
  importLines: string[];
  /** interface + type alias + const ở cấp file. */
  typeDecls: string[];
  /** function ở cấp file. */
  funcDecls: string[];
}

function getDecorators(node: ts.Node, sf: ts.SourceFile): string[] {
  const out: string[] = [];
  if (ts.canHaveDecorators(node)) {
    const mods = ts.getDecorators(node);
    if (mods) for (const d of mods) out.push(d.getText(sf).replace(/\s+/g, ' '));
  }
  return out;
}

function visibilityOf(node: ts.Node): 'public' | 'private' | 'protected' {
  const mods = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  if (mods?.some((m) => m.kind === ts.SyntaxKind.PrivateKeyword)) return 'private';
  if (mods?.some((m) => m.kind === ts.SyntaxKind.ProtectedKeyword)) return 'protected';
  return 'public';
}

function collectThisRefs(node: ts.Node, into: Set<string>): void {
  const visit = (n: ts.Node): void => {
    if (ts.isPropertyAccessExpression(n) && n.expression.kind === ts.SyntaxKind.ThisKeyword) {
      into.add(n.name.getText());
    }
    ts.forEachChild(n, visit);
  };
  visit(node);
}

function parseService(absPath: string, moduleName: string): ParsedService | null {
  const content = fs.readFileSync(absPath, 'utf8');
  const sf = ts.createSourceFile(absPath, content, ts.ScriptTarget.Latest, true);

  let classDecl: ts.ClassDeclaration | undefined;
  const importLines: string[] = [];
  const typeDecls: string[] = [];
  const funcDecls: string[] = [];

  for (const stmt of sf.statements) {
    if (ts.isImportDeclaration(stmt)) {
      importLines.push(stmt.getText(sf));
    } else if (ts.isInterfaceDeclaration(stmt) || ts.isTypeAliasDeclaration(stmt)) {
      typeDecls.push(stmt.getText(sf));
    } else if (ts.isVariableStatement(stmt)) {
      typeDecls.push(stmt.getText(sf));
    } else if (ts.isFunctionDeclaration(stmt)) {
      funcDecls.push(stmt.getText(sf));
    } else if (ts.isClassDeclaration(stmt) && stmt.name) {
      classDecl = stmt;
    }
  }
  if (!classDecl?.name) return null;

  const deps: Dep[] = [];
  const extraProps: { name: string; text: string }[] = [];
  const methods = new Map<string, MethodInfo>();

  const ctor = classDecl.members.find(
    (m): m is ts.ConstructorDeclaration => ts.isConstructorDeclaration(m),
  );
  if (ctor) {
    for (const p of ctor.parameters) {
      const decorators = getDecorators(p, sf);
      const tokens: string[] = [];
      for (const d of decorators) {
        const m = d.match(/@Inject\(([^)]+)\)/);
        if (m?.[1]) tokens.push(m[1]);
      }
      deps.push({
        name: p.name.getText(sf),
        typeText: p.type ? p.type.getText(sf) : 'unknown',
        decorators,
        tokens,
      });
    }
  }

  for (const member of classDecl.members) {
    if (ts.isPropertyDeclaration(member) && member.name) {
      const nm = member.name.getText(sf);
      if (!deps.some((d) => d.name === nm)) {
        extraProps.push({ name: nm, text: member.getText(sf) });
      }
      continue;
    }
    if (ts.isMethodDeclaration(member) && member.name) {
      const nm = member.name.getText(sf);
      const usedThis = new Set<string>();
      collectThisRefs(member, usedThis);
      methods.set(nm, {
        name: nm,
        text: member.getText(sf),
        visibility: visibilityOf(member),
        usedThis,
      });
    }
  }

  return {
    absPath,
    moduleName,
    className: classDecl.name.getText(sf),
    deps,
    extraProps,
    methods,
    importLines,
    typeDecls,
    funcDecls,
  };
}

// ── Đặt tên ──────────────────────────────────────────────────────────────────

function kebab(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

function handlerName(method: string): string {
  return method.charAt(0).toUpperCase() + method.slice(1) + 'Handler';
}

// ── Lập kế hoạch handler ────────────────────────────────────────────────────

interface HandlerPlan {
  kind: 'command' | 'query';
  fileName: string;
  handlerClass: string;
  method: MethodInfo;
  neededDeps: Dep[];
  helperNames: string[];
  crossCalls: string[];
  neededProps: { name: string; text: string }[];
}

function planHandler(svc: ParsedService, method: MethodInfo): HandlerPlan {
  const helperNames: string[] = [];
  const crossCalls: string[] = [];
  const neededDeps: Dep[] = [];
  const neededProps: { name: string; text: string }[] = [];

  const visit = (name: string, seen: Set<string>): void => {
    if (seen.has(name)) return;
    seen.add(name);

    const dep = svc.deps.find((d) => d.name === name);
    if (dep) {
      if (!neededDeps.some((d) => d.name === dep.name)) neededDeps.push(dep);
      return;
    }
    const prop = svc.extraProps.find((p) => p.name === name);
    if (prop) {
      if (!neededProps.some((p) => p.name === prop.name)) neededProps.push(prop);
      return;
    }
    const other = svc.methods.get(name);
    if (!other) return;
    if (other.visibility === 'private') {
      if (!helperNames.includes(name)) helperNames.push(name);
      for (const n of other.usedThis) visit(n, seen);
      return;
    }
    if (!crossCalls.includes(name)) crossCalls.push(name);
  };

  const seen = new Set<string>();
  for (const n of method.usedThis) visit(n, seen);

  return {
    kind: classify(method.name),
    fileName: `${kebab(method.name)}.handler.ts`,
    handlerClass: handlerName(method.name),
    method,
    neededDeps,
    helperNames,
    crossCalls,
    neededProps,
  };
}

// ── Render ───────────────────────────────────────────────────────────────────

function renderHandler(
  svc: ParsedService,
  plan: HandlerPlan,
  helperBodies: Map<string, MethodInfo>,
  sharedTypeNames: string[],
  sharedFuncNames: string[],
): string {
  const bodyParts = [plan.method.text];
  for (const h of plan.helperNames) {
    const m = helperBodies.get(h);
    if (m) bodyParts.push(m.text);
  }
  const bodyText = bodyParts.join('\n');

  const lines: string[] = [];
  lines.push('/**');
  lines.push(` * ${plan.handlerClass} — Use case: \`${plan.method.name}()\``);
  lines.push(
    ` * (${plan.kind === 'command' ? 'thay đổi trạng thái' : 'chỉ đọc'}) — theo §3.10 Command/Query pattern.`,
  );
  lines.push(' *');
  lines.push(' * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.');
  lines.push(' * Dependency chỉ qua port token — không inject adapter cụ thể.');
  lines.push(' */');

  // ── Imports ──
  const importStmts: string[] = [];
  const addImport = (s: string): void => {
    if (!importStmts.includes(s)) importStmts.push(s);
  };

  // @nestjs/common
  const common = new Set<string>();
  common.add('Injectable');
  if (plan.neededDeps.some((d) => d.decorators.some((x) => x.includes('Inject')))) {
    common.add('Inject');
  }
  if (plan.neededDeps.some((d) => d.decorators.some((x) => x.includes('Optional')))) {
    common.add('Optional');
  }
  for (const exc of [
    'NotFoundException', 'ConflictException', 'BadRequestException',
    'ForbiddenException', 'PayloadTooLargeException', 'UnauthorizedException',
  ]) {
    if (bodyText.includes(`${exc}(`)) common.add(exc);
  }
  if (plan.neededProps.some((p) => p.name === 'logger')) common.add('Logger');
  addImport(`import { ${[...common].sort().join(', ')} } from '@nestjs/common';`);

  // Các import khác — giữ symbol thực sự dùng:
  //   - token DI (trong decorator @Inject(...))
  //   - kiểu của dependency (trong constructor)
  //   - symbol xuất hiện trong body
  const usedTokens = new Set(plan.neededDeps.flatMap((d) => d.tokens));
  const usedTypes = new Set(plan.neededDeps.map((d) => d.typeText));
  for (const imp of svc.importLines) {
    if (/from '@nestjs\/common'/.test(imp)) continue;
    const names = extractImportedNames(imp);
    const kept = names.filter((n) => {
      if (usedTokens.has(n)) return true;
      if (usedTypes.has(n)) return true;
      return new RegExp(`\\b${escapeRe(n)}\\b`).test(bodyText);
    });
    if (kept.length === 0) continue;
    addImport(filterImportStatement(imp, kept));
  }

  // Shared types / utils của module
  if (sharedTypeNames.length > 0) {
    addImport(
      `import { ${sharedTypeNames.join(', ')} } from '../${svc.moduleName}.types';`,
    );
  }
  if (sharedFuncNames.length > 0) {
    addImport(
      `import { ${sharedFuncNames.join(', ')} } from '../${svc.moduleName}.utils';`,
    );
  }

  // Handler chéo (cùng module → đường dẫn tương đối)
  for (const c of plan.crossCalls) {
    const targetKind = classify(c);
    const dir = targetKind === 'command' ? 'commands' : 'queries';
    addImport(`import { ${handlerName(c)} } from '../${dir}/${kebab(c)}.handler';`);
  }

  lines.push(...importStmts);
  lines.push('');

  // ── Class ──
  lines.push('@Injectable()');
  lines.push(`export class ${plan.handlerClass} {`);
  for (const p of plan.neededProps) {
    lines.push(`  ${p.text.replace(/\n/g, '\n  ')}`);
  }

  const ctorParams: string[] = [];
  for (const d of plan.neededDeps) {
    for (const dec of d.decorators) ctorParams.push(`    ${dec}`);
    ctorParams.push(`    private readonly ${d.name}: ${d.typeText},`);
  }
  for (const c of plan.crossCalls) {
    ctorParams.push(`    private readonly ${c}Handler: ${handlerName(c)},`);
  }
  if (ctorParams.length > 0) {
    lines.push('  constructor(');
    lines.push(...ctorParams);
    lines.push('  ) {}');
  }

  for (const h of plan.helperNames) {
    const m = helperBodies.get(h);
    if (!m) continue;
    lines.push('');
    lines.push(indent(m.text));
  }

  // Đổi tên method chính thành `execute` (chuẩn Command/Query handler).
  let mainText = plan.method.text.replace(
    new RegExp(`\\b${escapeRe(plan.method.name)}\\s*\\(`),
    'execute(',
  );
  // Cross-handler call → this.<handler>.execute(
  for (const c of plan.crossCalls) {
    mainText = mainText.replace(
      new RegExp(`\\bthis\\.${escapeRe(c)}\\s*\\(`, 'g'),
      `this.${c}Handler.execute(`,
    );
  }
  lines.push('');
  lines.push(indent(mainText));
  lines.push('}');

  return lines.join('\n') + '\n';
}

/**
 * Format file vừa sinh bằng Prettier (nếu có) — giúp output ổn định,
 * tránh khác biệt whitespace giữa các lần chạy codemod.
 */
function formatWithPrettier(absPath: string): void {
  try {
    execFileSync(
      'npx',
      ['prettier', '--write', '--log-level', 'silent', absPath],
      { cwd: path.resolve(__dirname, '..'), stdio: 'ignore' },
    );
  } catch {
    // Prettier không khả dụng → giữ nguyên output thô.
  }
}

function indent(text: string): string {
  return text
    .split('\n')
    .map((l) => (l.trim() === '' ? '' : '  ' + l))
    .join('\n');
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractImportedNames(stmt: string): string[] {
  const m = stmt.match(/\{([^}]*)\}/);
  if (!m) return [];
  return (m[1] ?? '')
    .split(',')
    .map((raw) => {
      // Bỏ prefix `type ` và lấy tên local (sau `as`).
      const cleaned = raw.trim().replace(/^type\s+/, '');
      return (cleaned.split(/\s+as\s+/).pop() ?? '').trim();
    })
    .filter(Boolean);
}

function filterImportStatement(stmt: string, names: string[]): string {
  const m = stmt.match(/^import\s+\{([^}]*)\}\s+from\s+(.+?);?$/s);
  if (!m) return stmt;
  const orig = (m[1] ?? '')
    .split(',')
    .map((raw) => {
      const cleaned = raw.trim().replace(/^type\s+/, '');
      const local = (cleaned.split(/\s+as\s+/).pop() ?? '').trim();
      return { raw: raw.trim(), local, isType: /^type\s/.test(raw.trim()) };
    })
    .filter((x) => x.local !== '');
  const kept = names.map((n) => {
    const hit = orig.find((x) => x.local === n);
    if (!hit) return n;
    // Giữ nguyên `type ` prefix nếu bản gốc có.
    return hit.isType ? `type ${hit.raw.replace(/^type\s+/, '')}` : hit.raw;
  });
  return `import { ${kept.join(', ')} } from ${m[2]};`;
}

// ── Main ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const moduleFilter = (args.find((a) => a.startsWith('--module=')) ?? '').split('=')[1];

/** Service KHÔNG tách (là service kỹ thuật / worker, không phải use case orchestration). */
const SKIP = new Set([
  'analysis/application/report-worker.service.ts',
  'analysis/application/services/ai-worker.service.ts',
  'analysis/application/services/rag-few-shot.service.ts',
  'datasets/application/services/schema-inference.service.ts',
  'realtime/application/realtime.service.ts',
  'realtime/application/realtime-auth.service.ts',
]);

const moduleDirs = fs
  .readdirSync(SRC, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

let totalHandlers = 0;
const manifest: Record<string, string[]> = {};

for (const moduleName of moduleDirs) {
  const appDir = path.join(SRC, moduleName, 'application');
  if (!fs.existsSync(appDir)) continue;
  if (moduleFilter && moduleFilter !== moduleName) continue;

  const serviceFiles = fs
    .readdirSync(appDir)
    .filter((f) => f.endsWith('.service.ts'))
    .map((f) => `application/${f}`)
    .filter((f) => !SKIP.has(`${moduleName}/${f}`));

  if (serviceFiles.length === 0) continue;

  const handlers: string[] = [];

  for (const rel of serviceFiles) {
    const abs = path.join(SRC, moduleName, rel);
    const svc = parseService(abs, moduleName);
    if (!svc) {
      console.error(`✗ Không parse được ${moduleName}/${rel}`);
      continue;
    }

    const helperBodies = new Map<string, MethodInfo>();
    for (const m of svc.methods.values()) {
      if (m.visibility === 'private') helperBodies.set(m.name, m);
    }

    // Gom các declaration cấp file vào file shared của module.
    const typeBody: string[] = [];
    const funcBody: string[] = [];
    for (const d of svc.typeDecls) {
      const names = declaredNames(d);
      if (names.some((n) => namesInBody(svc, n))) typeBody.push(d);
    }
    for (const d of svc.funcDecls) {
      const names = declaredNames(d);
      if (names.some((n) => namesInBody(svc, n))) funcBody.push(d);
    }

    const publicMethods = [...svc.methods.values()].filter(
      (m) => m.visibility === 'public' && !m.name.startsWith('onModule') && !m.name.startsWith('handle'),
    );

    for (const m of publicMethods) {
      const plan = planHandler(svc, m);
      const dir = path.join(appDir, plan.kind === 'command' ? 'commands' : 'queries');
      const outAbs = path.join(dir, plan.fileName);

      // Symbol từ file-level declarations mà handler này dùng.
      const handlerText = [m.text, ...plan.helperNames.map((h) => helperBodies.get(h)?.text ?? '')].join('\n');
      const typeNames = typeBody
        .flatMap((d) => declaredNames(d))
        .filter((n) => new RegExp(`\\b${escapeRe(n)}\\b`).test(handlerText));
      const funcNames = funcBody
        .flatMap((d) => declaredNames(d))
        .filter((n) => new RegExp(`\\b${escapeRe(n)}\\b`).test(handlerText));

      const content = renderHandler(svc, plan, helperBodies, typeNames, funcNames);
      if (!dryRun) {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(outAbs, content, 'utf8');
        formatWithPrettier(outAbs);
      }
      handlers.push(`${plan.kind === 'command' ? 'commands' : 'queries'}/${plan.fileName}`);
      totalHandlers += 1;
    }

    console.log(`▸ ${moduleName}/${rel} → ${publicMethods.length} handler`);
  }

  if (handlers.length > 0) {
    manifest[moduleName] = handlers.sort();
    // Ghi file shared types/utils nếu có.
    const allTypes = new Map<string, string>();
    const allFuncs = new Map<string, string>();
    for (const rel of serviceFiles) {
      const svc = parseService(path.join(SRC, moduleName, rel), moduleName);
      if (!svc) continue;
      for (const d of svc.typeDecls) {
        for (const n of declaredNames(d)) allTypes.set(n, d);
      }
      for (const d of svc.funcDecls) {
        for (const n of declaredNames(d)) allFuncs.set(n, d);
      }
    }
    if (allTypes.size > 0 && !dryRun) {
      fs.writeFileSync(
        path.join(appDir, `${moduleName}.types.ts`),
        renderSharedTypes(allTypes, moduleName),
        'utf8',
      );
    }
    if (allFuncs.size > 0 && !dryRun) {
      fs.writeFileSync(
        path.join(appDir, `${moduleName}.utils.ts`),
        renderSharedFuncs(allFuncs, moduleName),
        'utf8',
      );
    }
  }
}

function declaredNames(decl: string): string[] {
  const out: string[] = [];
  const m = decl.match(/^\s*(?:export\s+)?(?:declare\s+)?(interface|type|const|function|class)\s+([A-Za-z0-9_]+)/);
  if (m?.[2]) out.push(m[2]);
  // const a = ..., b = ...
  const vars = decl.match(/^\s*(?:export\s+)?const\s+(.+)$/s);
  if (vars?.[1]) {
    for (const part of vars[1].split(',')) {
      const n = part.trim().split(/[:=]/)[0]?.trim();
      if (n && /^[A-Za-z_][A-Za-z0-9_]*$/.test(n)) out.push(n);
    }
  }
  return out;
}

function namesInBody(svc: ParsedService, name: string): boolean {
  const re = new RegExp(`\\b${escapeRe(name)}\\b`);
  for (const m of svc.methods.values()) {
    if (re.test(m.text)) return true;
  }
  return false;
}

function renderSharedTypes(types: Map<string, string>, moduleName: string): string {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const d of types.values()) {
    if (seen.has(d)) continue;
    seen.add(d);
    parts.push(d);
  }
  return (
    '/**\n' +
    ` * ${moduleName.toUpperCase()} — Kiểu dữ liệu tầng application (input/output contract).\n` +
    ' *\n' +
    ' * Tách ra khỏi service gốc khi áp dụng §3.10 Command/Query pattern.\n' +
    ' * Không import HTTP, không import infrastructure.\n' +
    ' */\n\n' +
    parts.join('\n\n') +
    '\n'
  );
}

function renderSharedFuncs(funcs: Map<string, string>, moduleName: string): string {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const d of funcs.values()) {
    if (seen.has(d)) continue;
    seen.add(d);
    parts.push(d);
  }
  return (
    '/**\n' +
    ` * ${moduleName.toUpperCase()} — Hàm thuần dùng chung cho handlers.\n` +
    ' *\n' +
    ' * Tách ra khỏi service gốc khi áp dụng §3.10 Command/Query pattern.\n' +
    ' */\n\n' +
    parts.join('\n\n') +
    '\n'
  );
}

console.log(
  `\nTỔNG: ${totalHandlers} handler${dryRun ? ' (dry-run, chưa ghi file)' : ''}`,
);
if (!dryRun) {
  fs.writeFileSync(
    path.resolve(__dirname, '../.handler-manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf8',
  );
  console.log('Đã ghi .handler-manifest.json');
}
