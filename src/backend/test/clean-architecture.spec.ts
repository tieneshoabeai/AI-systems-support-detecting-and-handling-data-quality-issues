import * as fs from 'fs';
import * as path from 'path';
import {
  ImportEdge,
  SourceFile,
  buildImportGraph,
  findNestjsHttpExceptionImports,
  formatViolations,
  isForbiddenInApplication,
  isInfraPackage,
  layerOf,
  loadSourceFiles,
  moduleOf,
  parseImports,
  relFromSrc,
} from './helpers/resolve-import';

/**
 * Architectural Test: Clean Architecture Rules (CA1 – CA11)
 *
 * Kiểm tra tự động nguyên tắc "Dependency Rule" của Robert C. Martin:
 *   "Mũi tên phụ thuộc luôn hướng vào trong" — infrastructure → application → domain.
 *
 * Chi tiết quy tắc: edit/03_yeu_cau_chat_luong_code_clean_architecture.md §3.4
 *
 * ── Cơ chế baseline ────────────────────────────────────────────────────────
 * Nhiều vi phạm đã tồn tại sẵn trong codebase (nợ kỹ thuật). Thay vì để test
 * báo động đỏ ngay (và chặn tiến độ), ta ghi nhận chúng vào
 * `test/fixtures/arch-baseline.json`.
 *
 *   - Vi phạm ĐÃ có trong baseline → chỉ log cảnh báo (nợ kỹ thuật đang được theo dõi).
 *   - Vi phạm MỚI (không có trong baseline) → FAIL CI.
 *   - Vi phạm đã được sửa (có trong baseline nhưng không còn tồn tại) → cảnh báo
 *     "nên gỡ khỏi baseline".
 *
 * Nhờ vậy, mỗi lần refactor làm giảm nợ kỹ thuật sẽ được ghi nhận tự động,
 * đồng thời vẫn chặn được việc phá vỡ ranh giới tầng.
 */

const files: SourceFile[] = loadSourceFiles();
const edges: ImportEdge[] = buildImportGraph(files);

interface Baseline {
  [rule: string]: string[] | undefined;
}

const baselinePath = path.resolve(__dirname, 'fixtures', 'arch-baseline.json');
const baseline: Baseline = fs.existsSync(baselinePath)
  ? (JSON.parse(fs.readFileSync(baselinePath, 'utf8')) as Baseline)
  : {};

const baselineSet = new Map<string, Set<string>>();
for (const [rule, list] of Object.entries(baseline)) {
  baselineSet.set(rule, new Set(Array.isArray(list) ? list : []));
}

/** Vi phạm mới (chưa có trong baseline) → chặn CI. */
const newViolations: string[] = [];
/** Vi phạm đã được sửa → gợi ý gỡ khỏi baseline. */
const fixedViolations: string[] = [];
/** Tất cả vi phạm (để báo cáo). */
const allViolations: string[] = [];

function record(rule: string, message: string): void {
  allViolations.push(`[${rule}] ${message}`);
  const known = baselineSet.get(rule);
  if (known?.has(message)) {
    fixedViolations.push(`[${rule}] ${message}`);
    return;
  }
  newViolations.push(`[${rule}] ${message}`);
}

/** Gọi khi một quy tắc hoàn toàn không có vi phạm (để phát hiện baseline thừa). */
function markRuleClean(rule: string, messages: string[]): void {
  for (const m of messages) {
    const known = baselineSet.get(rule);
    if (known?.has(m)) {
      fixedViolations.push(`[${rule}] ${m}`);
    }
  }
}

describe('Clean Architecture — Dependency Rule', () => {
  it('thu thập được đồ thị import nội bộ', () => {
    expect(files.length).toBeGreaterThan(0);
    expect(edges.length).toBeGreaterThan(0);
  });

  // ── CA1: domain cách ly tuyệt đối với framework & tầng ngoài ────────────
  describe('CA1 — domain không import framework / tầng ngoài', () => {
    it('domain không được import application, infrastructure hay framework', () => {
      const violations: string[] = [];

      for (const edge of edges) {
        if (layerOf(relFromSrc(edge.from.relPath)) !== 'domain') continue;
        const toLayer = layerOf(relFromSrc(edge.to.relPath));
        if (toLayer === 'application' || toLayer === 'infrastructure') {
          violations.push(`${edge.from.relPath} → ${edge.to.relPath}`);
        }
      }

      // Framework / hạ tầng: kiểm tra trực tiếp trên source (kể cả package ngoài repo).
      for (const file of files) {
        if (layerOf(relFromSrc(file.relPath)) !== 'domain') continue;
        for (const imp of parseImports(file.content)) {
          if (isInfraPackage(imp.raw)) {
            violations.push(`${file.relPath} → '${imp.raw}'`);
          }
        }
      }

      // CA1 chưa có nợ kỹ thuật → bất kỳ vi phạm nào cũng chặn CI.
      expect(formatViolations(violations)).toBe(formatViolations([]));
    });
  });

  // ── CA2: application không import infrastructure ──────────────────────────
  describe('CA2 — application không import infrastructure', () => {
    it('application không được import tầng infrastructure hay hạ tầng thực sự', () => {
      const violations: string[] = [];

      for (const edge of edges) {
        if (layerOf(relFromSrc(edge.from.relPath)) !== 'application') continue;
        if (layerOf(relFromSrc(edge.to.relPath)) === 'infrastructure') {
          violations.push(`${edge.from.relPath} → ${edge.to.relPath}`);
        }
      }

      // Hạ tầng thực sự (DB/S3/Kafka/Socket.IO) — không được chạm từ application.
      // `@nestjs/common` được phép vì decorator/Logger là ngôn ngữ của framework.
      for (const file of files) {
        if (layerOf(relFromSrc(file.relPath)) !== 'application') continue;
        for (const imp of parseImports(file.content)) {
          if (isForbiddenInApplication(imp.raw)) {
            violations.push(`${file.relPath} → '${imp.raw}'`);
          }
        }
      }

      expect(formatViolations(violations)).toBe(formatViolations([]));
    });
  });

  // ── CA3: infrastructure không import domain/application của module khác ───
  describe('CA3 — infrastructure không chạm tầng trong của module khác', () => {
    it('infrastructure của module A không import domain/application của module B', () => {
      const violations: string[] = [];

      for (const edge of edges) {
        if (layerOf(relFromSrc(edge.from.relPath)) !== 'infrastructure') continue;
        const fromModule = moduleOf(relFromSrc(edge.from.relPath));
        const toModule = moduleOf(relFromSrc(edge.to.relPath));
        if (fromModule === null || toModule === null || fromModule === toModule) continue;
        const toLayer = layerOf(relFromSrc(edge.to.relPath));
        if (toLayer === 'domain' || toLayer === 'application') {
          violations.push(`${edge.from.relPath} → ${edge.to.relPath}`);
        }
      }

      for (const v of violations) record('CA3', v);
      markRuleClean('CA3', []);

      expect(formatViolations(newViolations.filter((v) => v.startsWith('[CA3]')))).toBe(
        formatViolations([]),
      );
    });
  });

  // ── CA4: domain của module A không import domain của module B ─────────────
  describe('CA4 — domain không phụ thuộc domain của module khác', () => {
    it('không có import domain chéo module', () => {
      const violations: string[] = [];

      for (const edge of edges) {
        const fromModule = moduleOf(relFromSrc(edge.from.relPath));
        const toModule = moduleOf(relFromSrc(edge.to.relPath));
        if (fromModule === null || toModule === null || fromModule === toModule) continue;
        if (layerOf(relFromSrc(edge.from.relPath)) !== 'domain') continue;
        if (layerOf(relFromSrc(edge.to.relPath)) !== 'domain') continue;
        violations.push(`${edge.from.relPath} → ${edge.to.relPath}`);
      }

      expect(formatViolations(violations)).toBe(formatViolations([]));
    });
  });

  // ── CA5: shared không được biết module nghiệp vụ ─────────────────────────
  describe('CA5 — shared là lớp cross-cutting, không biết module nghiệp vụ', () => {
    it('shared không import từ modules/', () => {
      const violations: string[] = [];

      for (const edge of edges) {
        if (layerOf(relFromSrc(edge.from.relPath)) !== 'shared') continue;
        if (moduleOf(relFromSrc(edge.to.relPath)) === null) continue;
        violations.push(`${edge.from.relPath} → ${edge.to.relPath}`);
      }

      for (const v of violations) record('CA5', v);

      expect(formatViolations(newViolations.filter((v) => v.startsWith('[CA5]')))).toBe(
        formatViolations([]),
      );
    });
  });

  // ── CA6: không import schema Mongoose của module khác (vi phạm R3) ───────
  describe('CA6 — không truy cập chéo collection qua schema Mongoose', () => {
    it('infrastructure không import schema của module khác', () => {
      const violations: string[] = [];

      for (const edge of edges) {
        const fromModule = moduleOf(relFromSrc(edge.from.relPath));
        const toModule = moduleOf(relFromSrc(edge.to.relPath));
        if (fromModule === null || toModule === null || fromModule === toModule) continue;
        if (!edge.to.absPath.endsWith('.schema.ts')) continue;
        violations.push(`${edge.from.relPath} → ${edge.to.relPath}`);
      }

      for (const v of violations) record('CA6', v);

      expect(formatViolations(newViolations.filter((v) => v.startsWith('[CA6]')))).toBe(
        formatViolations([]),
      );
    });
  });

  // ── CA7: không import service class của module khác (vi phạm R2) ─────────
  describe('CA7 — không gọi trực tiếp service của module khác', () => {
    it('application không import *Service class của module khác', () => {
      const violations: string[] = [];

      for (const edge of edges) {
        const fromModule = moduleOf(relFromSrc(edge.from.relPath));
        const toModule = moduleOf(relFromSrc(edge.to.relPath));
        if (fromModule === null || toModule === null || fromModule === toModule) continue;
        if (layerOf(relFromSrc(edge.to.relPath)) !== 'application') continue;
        if (!/\.service\.ts$/.test(edge.to.absPath)) continue;
        violations.push(`${edge.from.relPath} → ${edge.to.relPath}`);
      }

      for (const v of violations) record('CA7', v);

      expect(formatViolations(newViolations.filter((v) => v.startsWith('[CA7]')))).toBe(
        formatViolations([]),
      );
    });
  });

  // ── CA8: cross-module import phải qua public contract (index.ts) ─────────
  describe('CA8 — cross-module import phải đi qua public contract', () => {
    it('không import sâu vào file nội bộ của module khác', () => {
      const violations: string[] = [];

      for (const edge of edges) {
        const fromModule = moduleOf(relFromSrc(edge.from.relPath));
        const toModule = moduleOf(relFromSrc(edge.to.relPath));
        if (fromModule === null || toModule === null || fromModule === toModule) continue;
        // Qua `index.ts` công khai → hợp lệ.
        if (edge.to.absPath.endsWith(`${path.sep}index.ts`)) continue;
        // `*.module.ts` là composition root của NestJS — import module chéo là hợp lệ.
        if (edge.to.absPath.endsWith('.module.ts')) continue;
        violations.push(`${edge.from.relPath} → ${edge.to.relPath}`);
      }

      for (const v of violations) record('CA8', v);

      expect(formatViolations(newViolations.filter((v) => v.startsWith('[CA8]')))).toBe(
        formatViolations([]),
      );
    });
  });

  // ── CA9: không có vòng phụ thuộc giữa các module ─────────────────────────
  describe('CA9 — đồ thị phụ thuộc module không có chu trình', () => {
    it('không tồn tại chu trình phụ thuộc giữa các module', () => {
      // Dựng đồ thị module → module, bỏ qua import type-only (chỉ là hợp đồng).
      const graph = new Map<string, Set<string>>();
      for (const edge of edges) {
        if (!edge.isRuntime) continue;
        const fromModule = moduleOf(relFromSrc(edge.from.relPath));
        const toModule = moduleOf(relFromSrc(edge.to.relPath));
        if (fromModule === null || toModule === null || fromModule === toModule) continue;
        const set = graph.get(fromModule) ?? new Set<string>();
        set.add(toModule);
        graph.set(fromModule, set);
      }

      // DFS phát hiện chu trình.
      const WHITE = 0;
      const GREY = 1;
      const BLACK = 2;
      const color = new Map<string, number>();
      const stack: string[] = [];
      const cycles: string[] = [];

      const visit = (node: string): void => {
        color.set(node, GREY);
        stack.push(node);
        for (const next of graph.get(node) ?? []) {
          const c = color.get(next) ?? WHITE;
          if (c === WHITE) {
            visit(next);
          } else if (c === GREY) {
            const start = stack.indexOf(next);
            cycles.push([...stack.slice(start), next].join(' → '));
          }
        }
        stack.pop();
        color.set(node, BLACK);
      };

      for (const node of graph.keys()) {
        if ((color.get(node) ?? WHITE) === WHITE) visit(node);
      }

      // CA9 chưa có nợ kỹ thuật → chặn CI ngay nếu có chu trình.
      expect(formatViolations(cycles)).toBe(formatViolations([]));
    });
  });

  // ── CA10: không import SDK AI bên ngoài ───────────────────────────────────
  describe('CA10 — không phụ thuộc SDK AI bên ngoài', () => {
    it('không có import tới SDK AI/LLM bên thứ ba', () => {
      const aiPackages = [
        'openai',
        '@anthropic',
        '@google/generative-ai',
        '@google-cloud/vertexai',
        'langchain',
        'llamaindex',
        'cohere-ai',
        'ollama',
        '@azure/openai',
        'ai-sdk',
        '@ai-sdk/',
        'genai',
        '@google/genai',
      ];

      const violations: string[] = [];
      for (const file of files) {
        for (const imp of parseImports(file.content)) {
          if (aiPackages.some((p) => imp.raw === p || imp.raw.startsWith(p))) {
            violations.push(`${file.relPath} → '${imp.raw}'`);
          }
        }
      }

      expect(formatViolations(violations)).toBe(formatViolations([]));
    });
  });

  // ── CA11: domain không được kéo framework vào qua shared ─────────────────
  describe('CA11 — domain không phụ thuộc shared/ mang framework', () => {
    it('domain không import từ shared/ (ngoại trừ utility thuần)', () => {
      // Các thư mục shared được phép dùng bởi domain: chỉ chứa hàm thuần (không framework).
      //
      // Lưu ý (Bước 1 — Phần 16 §3.4): các utility thuần đã được **di chuyển**
      // vào `shared/domain/utils/` (vì chúng là logic nghiệp vụ thuần, không
      // phải hạ tầng). Vì vậy allowlist ở đây dùng đường dẫn mới.
      const PURE_SHARED_DIRS = [
        'shared/domain/utils/',
        'shared/domain/validation/',
        'shared/domain/crypto/',
        // Lớp lỗi nghiệp vụ (Bước 2) — thuần TypeScript, không framework.
        'shared/domain/errors/',
        // Lớp cơ sở entity + domain event (Bước 3) — thuần TypeScript.
        'shared/domain/entities/',
      ];
      const violations: string[] = [];

      for (const edge of edges) {
        if (layerOf(relFromSrc(edge.from.relPath)) !== 'domain') continue;
        if (layerOf(relFromSrc(edge.to.relPath)) !== 'shared') continue;
        const toRel = relFromSrc(edge.to.relPath);
        const isPure = PURE_SHARED_DIRS.some((d) => toRel.startsWith(d));
        if (!isPure) violations.push(`${edge.from.relPath} → ${edge.to.relPath}`);
      }

      for (const v of violations) record('CA11', v);

      expect(formatViolations(newViolations.filter((v) => v.startsWith('[CA11]')))).toBe(
        formatViolations([]),
      );
    });
  });

  // ── CA20: tầng application không được phụ thuộc HTTP của framework ──────
  describe('CA20 — application không import exception/HTTP status của NestJS', () => {
    it('tầng application không dùng HttpException / HttpStatus', () => {
      const violations: string[] = [];

      for (const file of files) {
        const srcRel = relFromSrc(file.relPath);
        if (layerOf(srcRel) !== 'application') continue;

        const found = findNestjsHttpExceptionImports(file.content);
        for (const name of found) {
          violations.push(`${srcRel} → ${name}`);
        }
      }

      for (const v of violations) record('CA20', v);

      expect(formatViolations(newViolations.filter((v) => v.startsWith('[CA20]')))).toBe(
        formatViolations([]),
      );
    });
  });

  // ── Báo cáo tổng hợp ─────────────────────────────────────────────────────
  it('báo cáo nợ kỹ thuật kiến trúc (để theo dõi tiến độ L3a)', () => {
    if (allViolations.length > 0) {
      console.warn(
        `\n[Clean Architecture] ${allViolations.length} vi phạm ` +
          `(${newViolations.length} mới, ${fixedViolations.length} đã được sửa):\n` +
          formatViolations(allViolations),
      );
    }
    expect(true).toBe(true);
  });
});
