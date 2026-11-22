/**
 * Codemod: chèn `@ApiResponse({ status: <đúng status thực tế> })` cho các route
 * còn thiếu, để Swagger khớp với status server thực sự trả về.
 *
 * Cơ chế: NestJS mặc định `@Post` → 201, `@Get/@Patch/@Put/@Delete` → 200, trừ
 * khi route có `@HttpCode(...)`. Swagger chỉ hiển thị status khai trong
 * `@ApiResponse` — thiếu decorator thì Swagger hiện 200 trong khi server trả
 * 201. Codemod này đọc đúng status thực tế rồi chèn decorator tương ứng.
 *
 * Chạy: `node scripts/fix-status-codemod.cjs [--dry-run]`
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', 'src', 'modules');
const DRY_RUN = process.argv.includes('--dry-run');

const NEST_DEFAULT = { GET: 200, POST: 201, PUT: 200, PATCH: 200, DELETE: 200 };
const HTTP_STATUS = {
  OK: 200, CREATED: 201, ACCEPTED: 202, NO_CONTENT: 204,
};
/** Mô tả tiếng Việt cho từng status, dùng trong description. */
const DESC = {
  200: 'Thành công',
  201: 'Tạo mới thành công',
  202: 'Đã tiếp nhận yêu cầu (xử lý bất đồng bộ)',
  204: 'Thành công, không có nội dung phản hồi',
};

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.controller.ts')) out.push(p);
  }
  return out;
}

const ROUTE_RE = /^\s*@(Get|Post|Put|Patch|Delete)\(\s*['"`]([^'"`]*)['"`]?\s*\)/;
const HANDLER_RE = /^\s{2}(async\s+)?[A-Za-z_$][\w$]*\s*\(/;

let changedFiles = 0;
let inserted = 0;

for (const file of walk(ROOT)) {
  let src = fs.readFileSync(file, 'utf8');
  const lines = src.split('\n');
  const insertions = []; // { atLine, text }

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(ROUTE_RE);
    if (!m) continue;
    const method = m[1].toUpperCase();

    // Gom decorator của route (cả trước và sau dòng @Route).
    const block = [];
    let sawHandler = false;
    for (let j = i + 1; j < lines.length; j++) {
      if (ROUTE_RE.test(lines[j])) break;
      if (!sawHandler && HANDLER_RE.test(lines[j])) sawHandler = true;
      if (sawHandler && /^\s{2}\}/.test(lines[j])) break;
      block.push(lines[j]);
    }
    for (let j = i - 1; j >= 0; j--) {
      if (ROUTE_RE.test(lines[j])) break;
      if (lines[j].trim().startsWith('}') || lines[j].trim() === '') break;
      block.push(lines[j]);
    }

    // Đã có @ApiResponse → bỏ qua (không đụng vào route đã cấu hình thủ công).
    if (block.some((l) => /@ApiResponse\(/.test(l))) continue;
    // Route dùng `@Res()` (không passthrough) → controller tự set status.
    const usesRes = block.some((l) => /@Res\(\)/.test(l));
    const usesResPassthrough = block.some((l) => /@Res\(\{\s*passthrough:\s*true\s*\}\)/.test(l));
    if (usesRes && !usesResPassthrough) continue;

    // Xác định status thực tế.
    let status = NEST_DEFAULT[method];
    for (const l of block) {
      const hc = l.match(/@HttpCode\(\s*HttpStatus\.([A-Z_]+)\s*\)/);
      if (hc) {
        status = HTTP_STATUS[hc[1]] ?? status;
        break;
      }
    }

    // Vị trí chèn: ngay trước thân handler (để giữ decorator gom cục).
    let handlerLine = -1;
    for (let j = i + 1; j < lines.length; j++) {
      if (ROUTE_RE.test(lines[j])) break;
      if (HANDLER_RE.test(lines[j])) {
        handlerLine = j;
        break;
      }
    }
    if (handlerLine === -1) continue;

    const indent = (lines[handlerLine].match(/^\s*/) ?? [''])[0];
    insertions.push({
      atLine: handlerLine,
      text: `${indent}@ApiResponse({ status: ${status}, description: '${DESC[status] ?? 'Thành công'}' })`,
    });
    inserted++;
  }

  if (!insertions.length) continue;

  // Chèn từ cuối lên đầu để không làm lệch chỉ số dòng.
  insertions.sort((a, b) => b.atLine - a.atLine);
  for (const ins of insertions) {
    lines.splice(ins.atLine, 0, ins.text);
  }
  const out = lines.join('\n');
  changedFiles++;
  if (DRY_RUN) {
    console.log(`[dry-run] ${path.relative(ROOT, file)}: +${insertions.length} @ApiResponse`);
  } else {
    fs.writeFileSync(file, out, 'utf8');
    console.log(`[fixed] ${path.relative(ROOT, file)}: +${insertions.length} @ApiResponse`);
  }
}

console.log(`\nTong: ${inserted} decorator tren ${changedFiles} file.`);

// ── Bước 2: bảo đảm mỗi file đã chèn đều import `ApiResponse` từ @nestjs/swagger.
const SWAGGER_IMPORT_RE = /^import \{([^}]*)\} from '@nestjs\/swagger';$/m;

for (const file of walk(ROOT)) {
  let src = fs.readFileSync(file, 'utf8');
  if (!/@ApiResponse\(/.test(src)) continue;
  if (/^import \{[^}]*\bApiResponse\b[^}]*\} from '@nestjs\/swagger';$/m.test(src)) continue;

  const m = src.match(SWAGGER_IMPORT_RE);
  if (!m) {
    console.log(`[warn] ${path.relative(ROOT, file)}: khong tim thay import @nestjs/swagger de them ApiResponse`);
    continue;
  }
  const names = m[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!names.includes('ApiResponse')) names.push('ApiResponse');
  // Giữ thứ tự alphabet như convention hiện có trong codebase.
  names.sort((a, b) => a.localeCompare(b));
  const replacement = `import { ${names.join(', ')} } from '@nestjs/swagger';`;
  const out = src.replace(SWAGGER_IMPORT_RE, replacement);
  if (DRY_RUN) {
    console.log(`[dry-run] them import ApiResponse: ${path.relative(ROOT, file)}`);
  } else {
    fs.writeFileSync(file, out, 'utf8');
    console.log(`[fixed] them import ApiResponse: ${path.relative(ROOT, file)}`);
  }
}
