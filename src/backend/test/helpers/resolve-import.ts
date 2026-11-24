import * as fs from 'fs';
import * as path from 'path';

/**
 * Helpers cho test kiến trúc Clean Architecture.
 *
 * Nhiệm vụ: phân tích import/export của mọi file `.ts` trong `src/`,
 * sau đó phân loại theo **tầng** và **module** để kiểm tra quy tắc dependency.
 *
 * Không dùng thư viện AST (không có dependency) — dùng regex có kiểm soát.
 * Phạm vi file trong dự án đã được chuẩn hoá: import luôn nằm ở đầu file,
 * dạng `import { a, b } from '...'`, `import x from '...'`, `import type { ... } from '...'`.
 */

export const ROOT_DIR = path.resolve(__dirname, '..', '..');
export const SRC_DIR = path.join(ROOT_DIR, 'src');
export const MODULES_DIR = path.join(SRC_DIR, 'modules');
export const SHARED_DIR = path.join(SRC_DIR, 'shared');

export type Layer =
  | 'domain'
  | 'application'
  | 'infrastructure'
  | 'module-root'
  | 'shared'
  | 'app-root'
  | 'other';

export interface SourceFile {
  /** Đường dẫn tuyệt đối */
  absPath: string;
  /** Đường dẫn tương đối so với repo (dùng để báo cáo) */
  relPath: string;
  /** Nội dung file */
  content: string;
}

export interface ImportEdge {
  /** File đang import */
  from: SourceFile;
  /** File được import (đã resolve) */
  to: SourceFile;
  /** Chuỗi import gốc */
  raw: string;
  /** Có phải `import type` (type-only) không */
  typeOnly: boolean;
  /** Có phải import chạy được lúc runtime không */
  isRuntime: boolean;
}

// ── Thu thập file ────────────────────────────────────────────────────────────

export function getTsFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...getTsFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out.sort();
}

export function loadSourceFiles(): SourceFile[] {
  return getTsFiles(SRC_DIR).map((absPath) => ({
    absPath,
    relPath: path.relative(ROOT_DIR, absPath),
    content: fs.readFileSync(absPath, 'utf8'),
  }));
}

// ── Phân loại tầng & module ─────────────────────────────────────────────────

export function layerOf(relFromSrc: string): Layer {
  const p = relFromSrc.split(path.sep).join('/');
  if (p.startsWith('modules/')) {
    const parts = p.split('/');
    // modules/<name>/<layer>/...
    if (parts.length >= 3) {
      const layer = parts[2];
      if (layer === 'domain') return 'domain';
      if (layer === 'application') return 'application';
      if (layer === 'infrastructure') return 'infrastructure';
    }
    return 'module-root';
  }
  if (p.startsWith('shared/')) return 'shared';
  if (!p.includes('/')) return 'app-root';
  return 'other';
}

/** Tên module sở hữu file (ví dụ `analysis`), hoặc `null` nếu không thuộc module nào. */
export function moduleOf(relFromSrc: string): string | null {
  const p = relFromSrc.split(path.sep).join('/');
  if (!p.startsWith('modules/')) return null;
  const parts = p.split('/');
  return parts[1] ?? null;
}

// ── Trích xuất import ───────────────────────────────────────────────────────

const IMPORT_RE =
  /^[ \t]*import\s+(?:type\s+)?([\s\S]*?)\s*from\s*['"]([^'"]+)['"]/gm;
const BARE_IMPORT_RE = /^[ \t]*import\s+['"]([^'"]+)['"]/gm;
const EXPORT_FROM_RE =
  /^[ \t]*export\s+(?:type\s+)?(?:\*|\{[\s\S]*?\})\s*from\s*['"]([^'"]+)['"]/gm;

/** Trả về danh sách import của file: { raw, typeOnly } */
export function parseImports(content: string): Array<{ raw: string; typeOnly: boolean }> {
  const out: Array<{ raw: string; typeOnly: boolean }> = [];

  // `import type { X } from '...'` → type-only
  IMPORT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = IMPORT_RE.exec(content)) !== null) {
    const clause = m[1] ?? '';
    const raw = m[2] ?? '';
    const isTypeOnly = /\bimport\s+type\b/.test(m[0]) || /^type\s*\{/.test(clause.trim());
    out.push({ raw, typeOnly: isTypeOnly });
  }

  // `import 'side-effect'`
  BARE_IMPORT_RE.lastIndex = 0;
  while ((m = BARE_IMPORT_RE.exec(content)) !== null) {
    out.push({ raw: m[1] ?? '', typeOnly: false });
  }

  // `export ... from '...'` — cũng là một dependency
  EXPORT_FROM_RE.lastIndex = 0;
  while ((m = EXPORT_FROM_RE.exec(content)) !== null) {
    out.push({ raw: m[1] ?? '', typeOnly: false });
  }

  return out;
}

/** Resolve chuỗi import thành file thật trong repo (null nếu là package ngoài). */
export function resolveImport(fromFile: SourceFile, raw: string): SourceFile | null {
  if (!raw.startsWith('.')) return null; // package ngoài repo

  const base = path.resolve(path.dirname(fromFile.absPath), raw);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
  ];

  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) {
      return {
        absPath: c,
        relPath: path.relative(ROOT_DIR, c),
        content: fs.readFileSync(c, 'utf8'),
      };
    }
  }
  return null;
}

/** Build toàn bộ cạnh import nội bộ của repo. */
export function buildImportGraph(files: SourceFile[]): ImportEdge[] {
  const edges: ImportEdge[] = [];
  for (const file of files) {
    for (const imp of parseImports(file.content)) {
      const to = resolveImport(file, imp.raw);
      if (!to) continue;
      edges.push({
        from: file,
        to,
        raw: imp.raw,
        typeOnly: imp.typeOnly,
        isRuntime: !imp.typeOnly,
      });
    }
  }
  return edges;
}

// ── Tiện ích ────────────────────────────────────────────────────────────────

export function relFromSrc(relFromRoot: string): string {
  return path.relative(SRC_DIR, path.join(ROOT_DIR, relFromRoot)).split(path.sep).join('/');
}

/**
 * Package/thư viện bên ngoài mang framework hoặc hạ tầng.
 *
 * Ghi chú về ranh giới tầng:
 *   - Tầng `domain` KHÔNG được import bất kỳ package nào trong danh sách này
 *     (domain phải thuần tuyệt đối).
 *   - Tầng `application` được phép dùng `@nestjs/common` (`@Injectable()`, `Logger`…)
 *     vì decorator là ngôn ngữ của framework; nhưng KHÔNG được chạm hạ tầng thực sự
 *     (database, S3, Kafka, Socket.IO…) — đó là phần việc của `infrastructure`.
 */
export const INFRA_PACKAGES = [
  '@nestjs/',
  'mongoose',
  '@aws-sdk/',
  'kafkajs',
  'socket.io',
  'ioredis',
  'bcrypt',
  'busboy',
  'passport',
  'express',
];

/** Hạ tầng thực sự — application tuyệt đối không được chạm trực tiếp. */
export const APP_FORBIDDEN_PACKAGES = [
  'mongoose',
  '@aws-sdk/',
  'kafkajs',
  'socket.io',
  'ioredis',
  'busboy',
];

export function isInfraPackage(raw: string): boolean {
  return INFRA_PACKAGES.some((p) => raw === p || raw.startsWith(p));
}

/** Kiểm tra package có bị `application` cấm hay không. */
export function isForbiddenInApplication(raw: string): boolean {
  return APP_FORBIDDEN_PACKAGES.some((p) => raw === p || raw.startsWith(p));
}

// ── CA20 — Ứng dụng không được phụ thuộc HTTP của framework ────────────────

/**
 * Exception class của NestJS — **không** được dùng ở tầng `application`.
 *
 * Bước 2 (Phần 16) thay toàn bộ `HttpException` bằng `DomainError`:
 *   - `BadRequestException`    → `ValidationError`    (400 / `VALIDATION_ERROR`)
 *   - `NotFoundException`      → `NotFoundError`      (404 / `NOT_FOUND`)
 *   - `ConflictException`      → `ConflictError`      (409 / `CONFLICT`)
 *   - `ForbiddenException`     → `ForbiddenError`     (403 / `FORBIDDEN`)
 *   - `UnauthorizedException`  → `UnauthenticatedError` (401 / `UNAUTHENTICATED`)
 *   - `PayloadTooLargeException` → `FileTooLargeError` (413 / `FILE_TOO_LARGE`)
 *
 * Lý do: tầng `application` là **tầng trung** — nó mô tả nghiệp vụ, không
 * mô tả giao thức. Khi để nó biết HTTP, mọi endpoint mới đều phải viết lại
 * logic lỗi thay vì dùng chung.
 */
export const NESTJS_HTTP_EXCEPTIONS = [
  'BadRequestException',
  'NotFoundException',
  'ConflictException',
  'ForbiddenException',
  'UnauthorizedException',
  'PayloadTooLargeException',
  'NotImplementedException',
  'ServiceUnavailableException',
  'UnprocessableEntityException',
  'InternalServerErrorException',
  'HttpException',
];

/**
 * Kiểm tra một file `application` có import exception class của NestJS không.
 *
 * @param content Nội dung file nguồn.
 * @returns Danh sách tên exception bị import (rỗng nếu sạch).
 */
export function findNestjsHttpExceptionImports(content: string): string[] {
  const found = new Set<string>();
  const importRe = /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]@nestjs\/common['"]/g;
  let m: RegExpExecArray | null;
  while ((m = importRe.exec(content)) !== null) {
    const names = (m[1] ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const n of names) {
      if (NESTJS_HTTP_EXCEPTIONS.includes(n)) found.add(n);
    }
  }
  // `import { HttpStatus } from '@nestjs/common'` — HTTP status cũng là giao thức.
  const statusRe = /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]@nestjs\/common['"]/g;
  while ((m = statusRe.exec(content)) !== null) {
    const names = (m[1] ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const n of names) {
      if (n === 'HttpStatus') found.add(n);
    }
  }
  return [...found];
}

/** Định dạng danh sách vi phạm để in ra lỗi test. */
export function formatViolations(violations: string[]): string {
  return `Phát hiện ${violations.length} vi phạm:\n` + violations.map((v) => `  - ${v}`).join('\n');
}
