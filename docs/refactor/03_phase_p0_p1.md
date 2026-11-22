# 3. Phase P0 + P1 — Baseline & công cụ enforce

> **Thời gian:** 5 giờ (P0: 2h · P1: 3h)
> **Mục tiêu:** Đóng băng baseline + tạo công cụ chứng minh ranh giới module (MM2/MM5).

---

## 3.1. P0 — Đóng băng baseline (2 giờ)

### P0.1 Tạo tag baseline (15 phút)

```bash
cd "<repo-root>"
git add -A && git commit -m "chore(refactor): baseline trước tái cấu trúc modular monolith"
git tag -a v1.1.0-baseline -m "Baseline trước refactor: Clean Architecture 4 tầng"
```

> **Điểm tựa:** Từ giờ trở đi, `git reset --hard v1.1.0-baseline` luôn đưa bạn về trạng thái sạch.

### P0.2 Ghi số liệu baseline vào `notes.md` (20 phút)

Tạo `docs/refactor/notes.md`:

```markdown
# Ghi chú quá trình refactor

## Baseline (2026-11-21)
- File .ts src/modules: 339 · LOC: 31 076 · thư mục con: ~60
- Handler: 107 (61 cmd + 46 query) · Route: 84 · Test: 1 277 / 79 suite
- Coverage stmts: 71.03%

## Quyết định
| Phase | Quyết định | Lý do |
|---|---|---|
| P0 | Giữ nguyên `shared/` | rủi ro cao, không đóng góp M1–M4 |
| P0 | Giữ `index.ts` của mỗi module | đã enforce tốt (116 import qua index.ts) |

## Kết quả từng phase
| Phase | File | LOC | Ghi chú |
|---|---|---|---|
```

### P0.3 Viết ADR (1 giờ)

Tạo `docs/adr/0001-modular-monolith.md` — xem mẫu ở §3.2.

### P0.4 Vẽ sơ đồ kiến trúc trước/sau (25 phút)

Tạo `docs/refactor/architecture-diagram.md` với 2 Mermaid diagram:
- **Trước:** 4 tầng lồng nhau
- **Sau:** vertical slice + shared kernel

---

## 3.2. ADR — mẫu (dùng để viết nhanh)

```markdown
# ADR-0001: Chuyển từ Clean Architecture sang Modular Monolith

- **Trạng thái:** Đã chấp nhận
- **Ngày:** 2026-11-21
- **Người quyết định:** <tên>

## Bối cảnh
Backend dùng Clean Architecture 4 tầng (domain / application / infrastructure / presentation)
cho 14 module. Hệ quả:
- 339 file `.ts`, 31 076 LOC trong `src/modules/`
- Người mới cần 4 lần grep ở 4 thư mục để hiểu 1 request
- 107 command/query handler, phần lớn là wrapper 1-1 được sinh bằng codemod
- 14 luật kiến trúc (CA1–CA14) phải đồng bộ cùng mỗi đổi cấu trúc
- Đồ án yêu cầu kiến trúc modular monolith

## Quyết định
Chuyển sang **Modular Monolith (vertical slice)**:
- Mỗi module = 1 thư mục phẳng: routes + service + schema + types
- Ranh giới module giữ nguyên, enforce bằng ESLint + arch test
- `shared/` giữ nguyên vai trò shared kernel
- Hành vi bên ngoài bất biến: 84 route, response shape, DB schema, 1 277 test

## Các lựa chọn đã cân nhắc
| Lựa chọn | Lý do bị loại |
|---|---|
| A. Rewrite toàn bộ | Rủi ro cao, mất rollback, không kịp 30 giờ |
| B. Giữ 4 tầng, chỉ gộp file | Không đáp ứng rõ ràng yêu cầu modular monolith |
| C. **Vertical slice (chọn)** | Đạt yêu cầu, giải quyết nỗi đau người mới, rủi ro thấp |
| D. Đóng băng, gộp theo cơ hội | An toàn nhất nhưng không đáp ứng yêu cầu đồ án trong 30h |

## Đánh đổi
| Mất | Bù |
|---|---|
| Linh hoạt khi đổi hạ tầng (MongoDB → Postgres) | Chưa cần; có thể thêm interface khi thực sự cần |
| Compile-time check hợp đồng giữa module | ESLint + arch test + integration test |
| Khả năng tách module thành microservice | Còn nguyên ranh giới module → tách sau khi scale |

## Trạng thái ký sinh
Đã đo: 339 file → mục tiêu ~180 file; 31 076 LOC → ~20 000 LOC.
```

---

## 3.3. P1 — Công cụ enforce ranh giới module (3 giờ)

### P1.1 ESLint rule: cấm deep cross-module import (1 giờ)

Thêm vào `eslint.config.mjs` — khối cho `src/modules/**`:

```js
{
  files: ['src/modules/**/*.ts'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            // Import trực tiếp vào file của module KHÁC (bỏ qua index.ts).
            // Module chỉ được biết nhau qua public contract: ../<module> hoặc ../../<module>
            group: [
              '../*/domain/**',
              '../*/application/**',
              '../*/infrastructure/**',
              '../*/presentation/**',
              '../../*/domain/**',
              '../../*/application/**',
              '../../*/infrastructure/**',
              '../../*/presentation/**',
              '../../../*/domain/**',
              '../../../*/application/**',
              '../../../*/infrastructure/**',
              '../../../*/presentation/**',
            ],
            message:
              'Module không được import trực tiếp file của module khác. ' +
              'Chỉ import qua public contract: `../<ten-module>`. (Modular Monolith — MM2)',
          },
        ],
      },
    ],
  },
},
```

> **Lưu ý:** Pattern `'../*/domain/**'` bắt được import như `../datasets/domain/...`. Import hợp lệ `../datasets` (resolve về `index.ts`) **không** bị chặn.
>
> **Phải chạy `eslint --fix` trước** — nếu không sẽ có hàng trăm lỗi mới.

### P1.2 Arch test: MM5 — module tự chứa đủ (1 giờ)

Tạo `test/modular-monolith.spec.ts`:

```ts
import * as fs from 'fs';
import * as path from 'path';
import { loadSourceFiles, moduleOf } from './helpers/resolve-import';

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

  it('mỗi module không còn thư mục con (trừ assets/)', () => {
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
```

### P1.3 Arch test: service không dùng HTTP exception (30 phút)

Bổ sung vào `test/modular-monolith.spec.ts` — thay thế CA20:

```ts
describe('MM6 — service không phụ thuộc HTTP của framework', () => {
  it('file service không import HttpException / HttpStatus', () => {
    const violations: string[] = [];
    for (const f of loadSourceFiles()) {
      if (!f.path.includes('/modules/')) continue;
      if (!/\.service\.ts$/.test(f.path)) continue;
      if (/HttpException|HttpStatus/.test(f.content)) {
        violations.push(f.path);
      }
    }
    expect(violations).toEqual([]);
  });
});
```

> **Lưu ý:** Rule này chỉ áp dụng **sau P3**. Ở P1, các file còn tên `*.handler.ts` nên test sẽ pass (trống). Ghi chú: điều kiện `.service.ts` khiến test pass ngay.

### P1.4 Viết `scripts/measure-refactor.sh` (20 phút)

Xem mẫu ở `02_inventory_and_metrics.md` §2.5. Tạo file và `chmod +x`.

### P1.5 Cổng kiểm soát P1 (20 phút)

```bash
cd src/backend
pnpm type-check          # 0 lỗi
pnpm lint                # 0 cảnh báo  ← nếu có lỗi mới từ MM2, chạy --fix
pnpm exec jest --maxWorkers=2 --testPathPatterns 'modular-monolith|clean-architecture'
```

**Điều kiện qua:** type-check 0 lỗi · lint 0 cảnh báo · arch test xanh.

---

## 3.4. Cổng kiểm soát chung — áp dụng MỌI phase

```bash
cd src/backend

# 1. TypeScript
pnpm type-check                       # phải: 0 lỗi

# 2. Lint
pnpm lint                             # phải: 0 cảnh báo

# 3. Unit + architecture
pnpm exec jest --maxWorkers=2         # phải: 67 suites / 1 069 tests

# 4. Contract API
pnpm arch:api-coverage                # phải: 84 | 84 | thiếu 0 | thừa 0

# 5. Đo lại
bash scripts/measure-refactor.sh      # ghi vào notes.md
```

> **Nếu bất kỳ bước nào đỏ:**
> 1. `git status` xem đã sửa gì
> 2. Sửa ≤ 15 phút → tiếp tục
> 3. Sửa > 15 phút → `git reset --hard <tag gần nhất>` → ghi vào `notes.md` → sang phase sau
>
> **Tuyệt đối không** commit khi test đỏ (R2).

---

## 3.5. Output của phase này

| Artifact | Đường dẫn |
|---|---|
| ADR | `docs/adr/0001-modular-monolith.md` |
| Ghi chú | `docs/refactor/notes.md` |
| Sơ đồ | `docs/refactor/architecture-diagram.md` |
| ESLint rule | `eslint.config.mjs` (khối `src/modules/**`) |
| Arch test | `test/modular-monolith.spec.ts` |
| Script đo | `scripts/measure-refactor.sh` |
| Tag | `v1.1.0-baseline` → `v1.2.0-p1` |
