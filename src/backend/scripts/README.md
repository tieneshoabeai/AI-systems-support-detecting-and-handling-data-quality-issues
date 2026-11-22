# Script Van Hanh & Bao Tri

Cac script phuc vu van hanh, kiem thu, benchmark va bao tri code. Phan lon la **codemod** - chay mot lan trong qua trinh refactor, khong phai chay hang ngay.

> Moi script deu nen chay tu `src/backend` va dung `pnpm exec tsx <file>` hoac `node <file>` theo loai.

---

## 1. Kiem Tra Kien Truc

| Script | Cong | Dung khi |
|---|---|---|
| `check-api-coverage.cjs` | Do khớp hop dong API §3.13 voi ma nguon | Truoc khi merge, sau moi thay doi route |
| `extract-routes.cjs` | Trich danh sach route tu controller | Sinh tai lieu hop dong |
| `list-cross-module-imports.ts` | Liet ke import cheo giua module | Phat hien vi pham CA8 |
| `generate-arch-baseline.ts` | Sinh baseline kien truc (`test/fixtures/arch-baseline.json`) | Sau khi refactor co chu dich |
| `verify-di-graph.ts` | Xac nhan do thi phu thuoc DI | Khi them module/provider |
| `status-audit.cjs` | Tong hop trang thai cac muc checklist | Theo doi tien do |

Lenh bao loi cua cac script nay cung duoc goi qua `pnpm`:

```bash
pnpm arch:api-coverage
pnpm arch:cross-imports
pnpm arch:baseline
pnpm arch:verify-di
```

---

## 2. Codemod & Refactor

Cac script nay **tu dong sua ma nguon**. Luon review bang `git diff` truoc khi commit, va chay tren nhanh rieng truoc.

| Script | Tac dung |
|---|---|
| `codemod-domain-error.mjs` | Chuyen `throw new Error` -> `DomainError` co ma loi |
| `normalize-domain-error-classes.mjs` | Chuoi hoa lop loi domain |
| `codemod-test-domain-error.mjs` | Sua assertion trong test theo loi moi |
| `codemod-test-assertions-multiline.mjs` | Format assertion test xuong dong |
| `dedupe-test-error-imports.mjs` | Loai import trung lap trong test |
| `cleanup-nestjs-exception-imports.mjs` | Loai import `HttpException` thua |
| `cleanup-presentation-error-imports.mjs` | Don dep import loi o tang presentation |
| `cleanup-unused-error-code-imports.mjs` | Loai import ma loi khong dung |
| `fix-http-status-regression.mjs` | Sua regression HTTP status |
| `fix-test-import-paths.mjs` | Sua duong dan import trong test |
| `split-commands-queries.ts` | Tach handler thanh command / query |
| `wire-handlers.ts` | Gien provider + controller goi handler |
| `rebase-handler-imports.ts` | Chuan hoa import cua handler |
| `map-handler-to-service.ts` | Sinh bang anh handler -> service |
| `add-explicit-return-types.ts` | Them kieu tra ve tuong minh |
| `fix-shared-app-files.ts` | Sua file trong `shared/application` |
| `update-module-index.py` | Cap nhat `modules/index.ts` (public contract) |
| `update-tests-for-handlers.py` | Sinh/sua test theo handler moi |
| `generate-test-handlers.py` | Sinh test handler boilerplate |
| `cleanup-old-services.py` | Xoa service da thay the |
| `restore-step4-modules.py` | Khoi phuc module buoc 4 |
| `_refactor_b1.py` | Refactor B1 |

---

## 3. Ha Tang & Dich Vu

| Script | Cong |
|---|---|
| `test-infra-up.sh` | Khoi dong MongoDB replica set + Redis + MinIO cho test |
| `test-infra-down.sh` | Tat va don dep ha tang test |
| `verify-external-services.ts` | Kiem tra dich vu ben ngoai (Mongo, Redis, S3) co hoat dong khong |
| `bootstrap-database.ts` | Tao collection + index can thiet |
| `seed-initial-data.ts` | Nap du lieu mau |
| `migrate-coerce-and-orphans.ts` | Ep kieu du lieu & don orphan |
| `backup-mongo.sh` / `restore-mongo.sh` | Sao luu / khoi phuc MongoDB |
| `backup-storage.sh` | Sao luu storage |
| `generate-ssl-certs.sh` | Sinh chung thu SSL tu ky |
| `install-cloudflared.sh` | Cai cloudflared |
| `start-cloudflare-tunnel.sh` | Khoi dong Cloudflare Tunnel |
| `perf-report.sh` | Tong hop bao cao hieu nang |

---

## 4. Benchmark

| Script | Cong |
|---|---|
| `benchmark/` | Thu muc cac script benchmark mo hinh AI |
| `lib/` | Tien ich dung chung cho benchmark |

```bash
pnpm bench:models    # Chay benchmark mo hinh
pnpm bench:gold     # Mo ta bo du lieu vang
pnpm bench:stats    # So sanh ket qua
pnpm bench:pareto   # Phan tich duong Pareto
```

---

## 5. Luu Y Khi Chay Codemod

1. **Lam viec tren nhanh rieng** - khong chay truc tiep tren nhanh chinh.
2. **Commit/backup truoc khi chay** - de rollback duoc.
3. **Review `git diff` sau khi chay** - codemod co the cham sai cho.
4. **Chay `pnpm type-check && pnpm lint && pnpm test`** ngay sau.
5. **Khong chay codemod lap lai** tren code da qua codemod - de sinh thay doi sai lan thu hai.
