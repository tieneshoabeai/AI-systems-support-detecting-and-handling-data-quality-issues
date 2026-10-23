import * as fs from 'fs';
import * as path from 'path';

/**
 * Architectural Test: Zero Any Policy Enforcement
 * Quét toàn bộ mã nguồn của dự án (src/, scripts/, test/)
 * Đảm bảo tuyệt đối KHÔNG có bất kỳ khai báo hoặc ép kiểu 'any' nào tồn tại.
 */
describe('Architectural Type Safety (Zero Any Policy)', () => {
  const rootDir = path.resolve(__dirname, '..');
  const targetDirs = [
    path.join(rootDir, 'src'),
    path.join(rootDir, 'scripts'),
    path.join(rootDir, 'test'),
  ];

  function getTsFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...getTsFiles(fullPath));
      } else if (
        entry.isFile() &&
        entry.name.endsWith('.ts') &&
        !entry.name.endsWith('.d.ts') &&
        entry.name !== 'zero-any.spec.ts' // Loại trừ chính file test này
      ) {
        files.push(fullPath);
      }
    }
    return files;
  }

  it('no TypeScript file in src/, scripts/, or test/ may contain the "any" type keyword', () => {
    const allTsFiles = targetDirs.flatMap((dir) => getTsFiles(dir));
    expect(allTsFiles.length).toBeGreaterThan(0);

    // Regex phát hiện các pattern vi phạm kiểu any:
    // 1. : any (khai báo kiểu biến, tham số, thuộc tính)
    // 2. as any (ép kiểu)
    // 3. <any> hoặc <any, hoặc , any> (generic arguments)
    // 4. Record<string, any> hoặc Array<any>
    const anyPattern = /(:|\bas\b|<|,)\s*any(\[\])?\b|\bArray<any>|\bRecord<[^,]+,\s*any>/;

    const violations: string[] = [];

    for (const filePath of allTsFiles) {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        const trimmed = line.trim();
        // Bỏ qua dòng comment
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
          return;
        }

        if (anyPattern.test(line)) {
          const relativePath = path.relative(rootDir, filePath);
          violations.push(`${relativePath}:${index + 1}: ${trimmed}`);
        }
      });
    }

    if (violations.length > 0) {
      throw new Error(
        `Phát hiện ${violations.length} vi phạm nguyên tắc Zero Any Policy:\n` +
          violations.join('\n')
      );
    }

    expect(violations).toHaveLength(0);
  });
});
