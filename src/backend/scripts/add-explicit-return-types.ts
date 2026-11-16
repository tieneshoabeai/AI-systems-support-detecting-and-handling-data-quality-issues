/**
 * Codemod — thêm return type cho mọi function/method/arrow còn thiếu.
 *
 * Dùng TypeScript Compiler API để:
 *   1. Suy luận return type thực (qua `checker`) — kể cả `Promise<T>` cho hàm async.
 *   2. Chèn `: <type>` vào đúng vị trí (sau parameter list, trước body).
 *
 * Bỏ qua (cần sửa tay):
 *   - Hàm đã có return type.
 *   - Setter / constructor / overload signature (không có body).
 *   - Return type chứa `import("...")` — cần thêm import thủ công.
 *   - Return type là `any` — không tự động đoán (tránh đẩy lỗi sang rule khác).
 *
 * Chạy: `npx ts-node scripts/add-explicit-return-types.ts [--dry]`
 */
import * as ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs';

const DRY = process.argv.includes('--dry');
const ROOT = path.resolve(__dirname, '..');

const tsconfigPath = path.join(ROOT, 'tsconfig.json');
const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
if (configFile.error) {
  console.error('Không đọc được tsconfig.json:', configFile.error.messageText);
  process.exit(1);
}
const parsed = ts.parseJsonConfigFileContent(
  configFile.config,
  ts.sys,
  ROOT,
  undefined,
  tsconfigPath,
);

const program = ts.createProgram(parsed.fileNames, { ...parsed.options, noEmit: true });
const checker = program.getTypeChecker();

interface Edit {
  file: string;
  pos: number;
  text: string;
  reason?: string;
}

const editsByFile = new Map<string, Edit[]>();
/** Import type cần thêm: Map<file, Map<modulePath, Set<exportName>>> */
const typeImportsByFile = new Map<string, Map<string, Set<string>>>();
const skipped: Array<{ file: string; line: number; reason: string }> = [];

/**
 * Thay các `import("module").Name` trong type string bằng `Name` tên thường,
 * đồng thời ghi nhận cần import type gì từ module nào.
 *
 * @returns type string đã rút gọn, hoặc null nếu không có pattern nào khớp.
 */
function resolveInlineImports(
  typeStr: string,
  fileName: string,
): { simplified: string; imports: Map<string, Set<string>> } | null {
  const imports = new Map<string, Set<string>>();
  const pattern = /import\("([^"]+)"\)\.([A-Za-z0-9_$]+)/g;
  let match = pattern.exec(typeStr);
  if (!match) return null;

  let simplified = typeStr;
  while (match !== null) {
    const modulePath = match[1] ?? '';
    const exportName = match[2] ?? '';
    if (modulePath.length === 0 || exportName.length === 0) break;
    const names = imports.get(modulePath) ?? new Set<string>();
    names.add(exportName);
    imports.set(modulePath, names);
    simplified = simplified.replace(match[0], exportName);
    match = pattern.exec(typeStr);
  }

  // Ghi nhận vào file tương ứng.
  const fileImports = typeImportsByFile.get(fileName) ?? new Map<string, Set<string>>();
  for (const [mod, names] of imports) {
    const existing = fileImports.get(mod) ?? new Set<string>();
    for (const n of names) existing.add(n);
    fileImports.set(mod, existing);
  }
  typeImportsByFile.set(fileName, fileImports);

  return { simplified, imports };
}

/** Trả về vị trí token `=>` (độ sâu 0) của một arrow function. */
function findArrowTokenPos(source: string, node: ts.ArrowFunction): number {
  const start = node.getStart();
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth--;
    else if (ch === '=' && source[i + 1] === '>' && depth === 0) return i;
  }
  return -1;
}

function collect(node: ts.Node, source: string, fileName: string): void {
  // ── Function / Method declaration ────────────────────────────────────
  if (
    ts.isFunctionDeclaration(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isFunctionExpression(node)
  ) {
    // Bỏ qua hàm đã có return type.
    if (node.body && !node.type) {
      const signature = checker.getSignatureFromDeclaration(node);
      if (signature) {
        const returnType = checker.getReturnTypeOfSignature(signature);
        let typeStr = checker.typeToString(returnType, node, ts.TypeFormatFlags.NoTruncation);
        const line = source.slice(0, node.getStart()).split('\n').length;

        if (typeStr === 'any') {
          skipped.push({ file: fileName, line, reason: 'return type là any' });
        } else if (typeStr.includes('import(')) {
          const resolved = resolveInlineImports(typeStr, fileName);
          if (resolved) {
            typeStr = resolved.simplified;
            const edits = editsByFile.get(fileName) ?? [];
            edits.push({ file: fileName, pos: node.body.pos, text: `: ${typeStr}` });
            editsByFile.set(fileName, edits);
          } else {
            skipped.push({ file: fileName, line, reason: `cần import thủ công: ${typeStr}` });
          }
        } else {
          const insertPos = node.body.pos;
          const edits = editsByFile.get(fileName) ?? [];
          edits.push({ file: fileName, pos: insertPos, text: `: ${typeStr}` });
          editsByFile.set(fileName, edits);
        }
      }
    }
    return;
  }

  // ── Arrow function ────────────────────────────────────────────────────
  if (ts.isArrowFunction(node)) {
    // Bỏ qua arrow đã có return type.
    if (node.type) return;
    const signature = checker.getSignatureFromDeclaration(node);
    if (!signature) return;
    const returnType = checker.getReturnTypeOfSignature(signature);
    let typeStr = checker.typeToString(returnType, node, ts.TypeFormatFlags.NoTruncation);
    const line = source.slice(0, node.getStart()).split('\n').length;

    if (typeStr === 'any') {
      skipped.push({ file: fileName, line, reason: 'return type là any' });
      return;
    }
    if (typeStr.includes('import(')) {
      const resolved = resolveInlineImports(typeStr, fileName);
      if (!resolved) {
        skipped.push({ file: fileName, line, reason: `cần import thủ công: ${typeStr}` });
        return;
      }
      typeStr = resolved.simplified;
    }
    const arrowPos = findArrowTokenPos(source, node);
    if (arrowPos < 0) {
      skipped.push({ file: fileName, line, reason: 'không tìm thấy token `=>`' });
      return;
    }
    const edits = editsByFile.get(fileName) ?? [];
    edits.push({ file: fileName, pos: arrowPos, text: `: ${typeStr} ` });
    editsByFile.set(fileName, edits);
    return;
  }

  ts.forEachChild(node, (child) => collect(child, source, fileName));
}

let totalEdits = 0;
for (const sf of program.getSourceFiles()) {
  if (sf.isDeclarationFile) continue;
  const rel = path.relative(ROOT, sf.fileName);
  // Chỉ xử lý mã nguồn ứng dụng (rule này đã tắt cho test/ và scripts/).
  if (!rel.startsWith('src' + path.sep)) continue;

  const source = sf.getFullText();
  let hasMissing = false;
  const visit = (node: ts.Node): void => {
    if (
      (ts.isFunctionDeclaration(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isArrowFunction(node) ||
        ts.isFunctionExpression(node) ||
        ts.isGetAccessorDeclaration(node)) &&
      !node.type
    ) {
      hasMissing = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  if (!hasMissing) continue;

  collect(sf, source, sf.fileName);
  totalEdits += (editsByFile.get(sf.fileName) ?? []).length;
}

// ── Áp dụng (theo thứ tự pos giảm dần để không lệch chỉ số) ─────────────
let changedFiles = 0;
for (const [file, edits] of editsByFile) {
  const source = fs.readFileSync(file, 'utf8');
  const sorted = [...edits].sort((a, b) => b.pos - a.pos);
  let out = source;
  for (const e of sorted) {
    out = out.slice(0, e.pos) + e.text + out.slice(e.pos);
  }

  // Chèn `import type { ... } from '...'` cho các module cần thiết.
  const fileImports = typeImportsByFile.get(file);
  if (fileImports && fileImports.size > 0) {
    const importLines: string[] = [];
    for (const [mod, names] of fileImports) {
      const sortedNames = [...names].sort();
      importLines.push(`import type { ${sortedNames.join(', ')} } from '${mod}';`);
    }
    // Chèn sau block import đầu tiên, hoặc đầu file.
    const matches = [...out.matchAll(/^import .*?;$/gm)];
    const lastImport = matches.length > 0 ? matches[matches.length - 1] : undefined;
    const insertAt =
      lastImport && lastImport.index !== undefined
        ? lastImport.index + (lastImport[0] ?? '').length + 1
        : 0;
    out = out.slice(0, insertAt) + importLines.join('\n') + '\n' + out.slice(insertAt);
  }

  if (!DRY) fs.writeFileSync(file, out, 'utf8');
  changedFiles++;
}

console.log(
  `${DRY ? '[DRY-RUN] ' : ''}Đã thêm return type cho ${totalEdits} hàm ở ${changedFiles} file.`,
);
if (skipped.length > 0) {
  console.log(`\nBỏ qua ${skipped.length} hàm (cần sửa tay):`);
  for (const s of skipped) {
    console.log(`  - ${path.relative(ROOT, s.file)}:${s.line} — ${s.reason}`);
  }
}
