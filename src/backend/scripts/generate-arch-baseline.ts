/**
 * Sinh lại baseline nợ kỹ thuật Clean Architecture.
 *
 * Dùng khi đã refactor xong một nhóm vi phạm: chạy script này để đồng bộ
 * `test/fixtures/arch-baseline.json` với hiện trạng thực tế.
 *
 * Lưu ý: script này GHI LẠI cả vi phạm mới. Luôn review diff trước khi commit.
 *
 * Dùng: pnpm run arch:baseline
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  ROOT_DIR,
  buildImportGraph,
  layerOf,
  loadSourceFiles,
  moduleOf,
  relFromSrc,
} from '../test/helpers/resolve-import';

const files = loadSourceFiles();
const edges = buildImportGraph(files);

const baseline: Record<string, string[]> = {
  CA3: [],
  CA5: [],
  CA6: [],
  CA7: [],
  CA8: [],
  CA11: [],
};

const push = (rule: string, value: string): void => {
  baseline[rule]?.push(value);
};

// CA3 — infrastructure → domain/application của module khác
for (const edge of edges) {
  if (layerOf(relFromSrc(edge.from.relPath)) !== 'infrastructure') continue;
  const fromModule = moduleOf(relFromSrc(edge.from.relPath));
  const toModule = moduleOf(relFromSrc(edge.to.relPath));
  if (fromModule === null || toModule === null || fromModule === toModule) continue;
  const toLayer = layerOf(relFromSrc(edge.to.relPath));
  if (toLayer === 'domain' || toLayer === 'application') {
    push('CA3', `${edge.from.relPath} → ${edge.to.relPath}`);
  }
}

// CA5 — shared → module nghiệp vụ
for (const edge of edges) {
  if (layerOf(relFromSrc(edge.from.relPath)) !== 'shared') continue;
  if (moduleOf(relFromSrc(edge.to.relPath)) === null) continue;
  push('CA5', `${edge.from.relPath} → ${edge.to.relPath}`);
}

// CA6 — import schema Mongoose của module khác
for (const edge of edges) {
  const fromModule = moduleOf(relFromSrc(edge.from.relPath));
  const toModule = moduleOf(relFromSrc(edge.to.relPath));
  if (fromModule === null || toModule === null || fromModule === toModule) continue;
  if (!edge.to.absPath.endsWith('.schema.ts')) continue;
  push('CA6', `${edge.from.relPath} → ${edge.to.relPath}`);
}

// CA7 — import *Service class của module khác
for (const edge of edges) {
  const fromModule = moduleOf(relFromSrc(edge.from.relPath));
  const toModule = moduleOf(relFromSrc(edge.to.relPath));
  if (fromModule === null || toModule === null || fromModule === toModule) continue;
  if (layerOf(relFromSrc(edge.to.relPath)) !== 'application') continue;
  if (!/\.service\.ts$/.test(edge.to.absPath)) continue;
  push('CA7', `${edge.from.relPath} → ${edge.to.relPath}`);
}

// CA8 — import sâu vào file nội bộ của module khác
for (const edge of edges) {
  const fromModule = moduleOf(relFromSrc(edge.from.relPath));
  const toModule = moduleOf(relFromSrc(edge.to.relPath));
  if (fromModule === null || toModule === null || fromModule === toModule) continue;
  // `index.ts` công khai → hợp lệ.
  if (edge.to.absPath.endsWith(`${path.sep}index.ts`)) continue;
  // `*.module.ts` là "composition root" của NestJS — import module chéo là hợp lệ.
  if (edge.to.absPath.endsWith('.module.ts')) continue;
  push('CA8', `${edge.from.relPath} → ${edge.to.relPath}`);
}

// CA11 — domain → shared/ không thuần
const PURE_SHARED_DIRS = ['utils', 'validation', 'crypto'];
for (const edge of edges) {
  if (layerOf(relFromSrc(edge.from.relPath)) !== 'domain') continue;
  if (layerOf(relFromSrc(edge.to.relPath)) !== 'shared') continue;
  const toRel = relFromSrc(edge.to.relPath);
  const isPure = PURE_SHARED_DIRS.some((d) => toRel.startsWith(`shared/${d}/`));
  if (!isPure) push('CA11', `${edge.from.relPath} → ${edge.to.relPath}`);
}

for (const key of Object.keys(baseline)) {
  baseline[key] = [...new Set(baseline[key])].sort();
}

const out = {
  _comment:
    'Baseline nợ kỹ thuật Clean Architecture. Mỗi vi phạm đã biết được liệt kê để test không báo động. Vi phạm MỚI (không có trong file này) sẽ FAIL CI. Cập nhật file bằng: pnpm run arch:baseline',
  ...baseline,
};

const target = path.join(ROOT_DIR, 'test', 'fixtures', 'arch-baseline.json');
fs.writeFileSync(target, `${JSON.stringify(out, null, 2)}\n`, 'utf8');

const total = Object.values(baseline).reduce((sum, arr) => sum + arr.length, 0);
process.stdout.write(`Đã cập nhật ${path.relative(ROOT_DIR, target)} — tổng ${total} vi phạm.\n`);
for (const [rule, arr] of Object.entries(baseline)) {
  process.stdout.write(`  ${rule}: ${arr.length}\n`);
}
