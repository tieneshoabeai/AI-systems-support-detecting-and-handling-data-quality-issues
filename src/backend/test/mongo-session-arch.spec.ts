import * as fs from 'fs';
import * as path from 'path';
import { MODULES_DIR, ROOT_DIR, getTsFiles } from './helpers/resolve-import';

/**
 * Architectural Test: OPEN-09 — mọi thao tác GHI MongoDB phải mang `session`.
 *
 * ── Vì sao cần test này? ───────────────────────────────────────────────────
 * `TransactionPort.runInTransaction()` mở một `ClientSession` và gắn nó vào
 * `MongoSessionContext` (AsyncLocalStorage). Các repository gọi
 * `resolveMongoSession(undefined)` để lấy session đó và truyền vào
 * `{ session: s }`.
 *
 * Nếu một repository mới (hoặc một method cũ bị sửa) quên truyền `session`,
 * lệnh ghi sẽ **chạy ngoài transaction** → không rollback → dữ liệu mất
 * trạng thái nhất quán. Đây là loại bug rất dễ tái phát và rất khó phát hiện
 * bằng test chức năng, nên ta chặn bằng test kiến trúc.
 *
 * ── Quy tắc ────────────────────────────────────────────────────────────────
 * Trong mọi file `infrastructure/persistence/**` và `shared/infrastructure/**`:
 *   1. Mọi lệnh ghi (`updateOne`, `updateMany`, `findOneAndUpdate`,
 *      `findOneAndDelete`, `insertMany`, `bulkWrite`, `deleteMany`, `deleteOne`,
 *      `replaceOne`, `save()`) phải truyền `session`.
 *   2. File có ghi thì phải import `resolveMongoSession` (trừ khi dùng
 *      `session` tham số rõ ràng — `base-mongo.repository.ts` dùng
 *      `resolveMongoSession(session)`).
 *
 * Ngoại lệ duy nhất được chấp nhận: `bulkInsertRecords` của datasets
 * (ghi 50k dòng vượt trần 16 MB của MongoDB transaction) — đã được ghi rõ
 * bằng chú thích `@transaction-excluded` trong mã nguồn.
 */

/** Các phương thức Mongoose thực hiện thao tác GHI. */
const WRITE_METHODS = [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'findOneAndDelete',
  'findOneAndReplace',
  'insertMany',
  'bulkWrite',
  'deleteMany',
  'deleteOne',
  'replaceOne',
];

/**
 * Marker cho phép một method bỏ qua session (phải nằm trong docblock của
 * method đó). Dùng cho các thao tác ghi cố ý **nằm ngoài** transaction, ví dụ
 * `bulkInsertRecords` — khối lượng 50k dòng vượt trần 16 MB của MongoDB
 * transaction nên bắt buộc phải ghi ngoài transaction.
 */
const EXEMPT_MARKER = '@transaction-excluded';

/**
 * Tập các file persistence cần kiểm tra:
 *   - `src/modules/&lt;module&gt;/infrastructure/persistence/` (mọi module)
 *   - `src/shared/infrastructure/**`
 */
function collectPersistenceFiles(): string[] {
  const out: string[] = [];

  const modulesPersistence = path.join(MODULES_DIR);
  for (const moduleDir of fs.existsSync(modulesPersistence) ? fs.readdirSync(modulesPersistence) : []) {
    const dir = path.join(modulesPersistence, moduleDir, 'infrastructure', 'persistence');
    if (!fs.existsSync(dir)) continue;
    out.push(...getTsFiles(dir));
  }

  const sharedInfra = path.join(ROOT_DIR, 'src', 'shared', 'infrastructure');
  if (fs.existsSync(sharedInfra)) out.push(...getTsFiles(sharedInfra));

  return out.filter((f) => !f.endsWith('.d.ts')).sort();
}

/**
 * Tách source thành các "lệnh ghi" — mỗi lệnh là một đoạn text từ vị trí
 * method được gọi tới khi đóng ngoặc tròn cân bằng (bao gồm cả ngoặc trong
 * chuỗi — dùng heuristic đơn giản bỏ qua string).
 */
function splitWriteCalls(content: string, method: string): Array<{ start: number; text: string }> {
  const calls: Array<{ start: number; text: string }> = [];
  const re = new RegExp(`\\.${method}\\s*\\(`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const openIdx = content.indexOf('(', m.index);
    let depth = 0;
    let i = openIdx;
    let inStr: string | null = null;
    for (; i < content.length; i += 1) {
      const ch = content[i];
      if (inStr) {
        if (ch === '\\') {
          i += 1;
          continue;
        }
        if (ch === inStr) inStr = null;
        continue;
      }
      if (ch === "'" || ch === '"' || ch === '`') {
        inStr = ch;
        continue;
      }
      if (ch === '(') depth += 1;
      else if (ch === ')') {
        depth -= 1;
        if (depth === 0) {
          i += 1;
          break;
        }
      }
    }
    calls.push({ start: m.index, text: content.slice(m.index, i) });
    re.lastIndex = i;
  }
  return calls;
}

/** Tìm docblock/comment ngay trên method để tìm marker `@transaction-excluded`. */
function hasExemptMarkerBefore(content: string, callStart: number): boolean {
  // Vị trí khai báo method chứa lệnh ghi (để tìm docblock phía trên).
  const before = content.slice(0, callStart);
  const declMatches = [...before.matchAll(/\basync\s+([A-Za-z0-9_]+)\s*\(/g)];
  const decl = declMatches[declMatches.length - 1];
  const declStart = decl?.index ?? Math.max(0, callStart - 400);
  const window = content.slice(Math.max(0, declStart - 1200), declStart);
  return window.includes(EXEMPT_MARKER);
}

/** Lấy tên method đang chứa lệnh ghi (để báo cáo dễ hiểu). */
function enclosingMethod(content: string, callStart: number): string {
  const before = content.slice(0, callStart);
  const matches = [...before.matchAll(/\basync\s+([A-Za-z0-9_]+)\s*\(/g)];
  const last = matches[matches.length - 1];
  return last?.[1] ?? '(unknown)';
}

describe('OPEN-09 — mọi thao tác ghi MongoDB phải mang session', () => {
  const files = collectPersistenceFiles();

  it('đã quét được các file persistence', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('mọi lệnh ghi đều truyền `session`', () => {
    const violations: string[] = [];

    for (const absPath of files) {
      const relPath = path.relative(ROOT_DIR, absPath).split(path.sep).join('/');
      const content = fs.readFileSync(absPath, 'utf8');

      for (const method of WRITE_METHODS) {
        for (const call of splitWriteCalls(content, method)) {
          const hasSession = /session\s*:/.test(call.text);
          if (hasSession) continue;

          if (hasExemptMarkerBefore(content, call.start)) continue;

          violations.push(
            `${relPath} → .${method}() trong method \`${enclosingMethod(content, call.start)}\` không truyền session`,
          );
        }
      }

      // `save()` — dạng `await inst.save()` hoặc `await inst.save({ session: s })`.
      const saveRe = /\.save\s*\(/g;
      let sm: RegExpExecArray | null;
      while ((sm = saveRe.exec(content)) !== null) {
        const openIdx = content.indexOf('(', sm.index);
        let depth = 0;
        let i = openIdx;
        let inStr: string | null = null;
        for (; i < content.length; i += 1) {
          const ch = content[i];
          if (inStr) {
            if (ch === '\\') {
              i += 1;
              continue;
            }
            if (ch === inStr) inStr = null;
            continue;
          }
          if (ch === "'" || ch === '"' || ch === '`') {
            inStr = ch;
            continue;
          }
          if (ch === '(') depth += 1;
          else if (ch === ')') {
            depth -= 1;
            if (depth === 0) {
              i += 1;
              break;
            }
          }
        }
        const text = content.slice(sm.index, i);
        if (/session\s*:/.test(text)) continue;
        if (hasExemptMarkerBefore(content, sm.index)) continue;
        violations.push(
          `${relPath} → .save() trong method \`${enclosingMethod(content, sm.index)}\` không truyền session`,
        );
      }
    }

    if (violations.length > 0) {
      throw new Error(
        `Phát hiện ${violations.length} lệnh ghi MongoDB thiếu session:\n` +
          violations.map((v) => `  - ${v}`).join('\n'),
      );
    }
    expect(true).toBe(true);
  });

  it('mọi file persistence có ghi đều dùng resolveMongoSession hoặc tham số session tường minh', () => {
    const violations: string[] = [];

    for (const absPath of files) {
      const relPath = path.relative(ROOT_DIR, absPath).split(path.sep).join('/');
      const content = fs.readFileSync(absPath, 'utf8');

      const hasWrite = WRITE_METHODS.some((m) => content.includes(`.${m}(`)) ||
        /\.save\s*\(/.test(content);
      if (!hasWrite) continue;

      const usesAmbient =
        content.includes('resolveMongoSession') || content.includes('session?: ClientSession');
      if (!usesAmbient) {
        violations.push(`${relPath} — có thao tác ghi nhưng không dùng session nào`);
      }
    }

    if (violations.length > 0) {
      throw new Error(
        `Phát hiện ${violations.length} file persistence không dùng session:\n` +
          violations.map((v) => `  - ${v}`).join('\n'),
      );
    }
    expect(true).toBe(true);
  });
});
