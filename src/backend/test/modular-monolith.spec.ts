import * as fs from 'fs';
import * as path from 'path';
import { loadSourceFiles } from './helpers/resolve-import';

const SRC = path.resolve(__dirname, '..', 'src');

/**
 * Modular Monolith — MM5: mỗi module tự chứa đủ.
 *
 * Sau khi flatten, mỗi module KHÔNG được có thư mục con nào.
 * Mọi file nằm phẳng ở gốc module (ngoại trừ `assets/` — file tĩnh).
 */
describe('Modular Monolith — MM5: module là vertical slice phẳng', () => {
  const moduleDirs = fs
    .readdirSync(path.join(SRC, 'modules'), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  // P1–P4 chuyển tiếp: cho phép 4 tầng cũ (domain/application/infrastructure/presentation)
  // + assets. Chỉ báo vi phạm khi có thư mục lạ ngoài 5 tên này.
  // Siêt FINAL (0 thư mục con) được bật ở P5 — xem test 'FINAL' bị skip bên dưới.
  it('mỗi module không còn thư mục con (trừ assets/)', () => {
    const allowed = new Set([
      'domain',
      'application',
      'infrastructure',
      'presentation',
      'assets',
    ]);
    const violations: string[] = [];
    for (const mod of moduleDirs) {
      const modDir = path.join(SRC, 'modules', mod);
      for (const entry of fs.readdirSync(modDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        if (allowed.has(entry.name)) continue;
        violations.push(`modules/${mod}/${entry.name}/`);
      }
    }
    expect(violations).toEqual([]);
  });

  // FINAL P5: mỗi module phẳng hoàn toàn (trừ assets/). Bật bằng cách bỏ .skip ở P5.
  it.skip('FINAL P5 — mỗi module phẳng hoàn toàn (trừ assets/)', () => {
    const violations: string[] = [];
    for (const mod of moduleDirs) {
      const modDir = path.join(SRC, 'modules', mod);
      for (const entry of fs.readdirSync(modDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        if (entry.name === 'assets') continue;
        violations.push(`modules/${mod}/${entry.name}/`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('mỗi module có đúng 1 file .module.ts ở gốc', () => {
    const violations: string[] = [];
    for (const mod of moduleDirs) {
      const modDir = path.join(SRC, 'modules', mod);
      const modules = fs
        .readdirSync(modDir)
        .filter((f) => f.endsWith('.module.ts'));
      if (modules.length !== 1) {
        violations.push(`modules/${mod}: ${modules.length} file .module.ts`);
      }
    }
    expect(violations).toEqual([]);
  });
});

describe('MM6 — service không phụ thuộc HTTP của framework', () => {
  it('file service không import HttpException / HttpStatus', () => {
    const violations: string[] = [];
    for (const f of loadSourceFiles()) {
      if (!f.relPath.includes('/modules/')) continue;
      if (!/\.service\.ts$/.test(f.relPath)) continue;
      if (/HttpException|HttpStatus/.test(f.content)) {
        violations.push(f.relPath);
      }
    }
    expect(violations).toEqual([]);
  });
});
