# Ban Kiem thu - Backend

Toan bo kiem thu backend nam trong thu muc nay. Cac file spec duoc chia theo 4 tang, moi tang co dac diem rieng.

---

## 1. Bo cuc

```text
test/
├── *.spec.ts              # Unit + Architecture (65 file) - chay mac dinh
├── integration/           # Integration (7 file) - chay rieng, --runInBand
├── e2e/                   # E2E (5 file)
│   ├── health.e2e-spec.ts
│   └── security/          # E2E security suite
├── k6/                    # Kich ban tai chong (k6)
│   ├── smoke.js
│   ├── stress.js
│   └── analysis-latency.js
├── fixtures/              # Du lieu mau
│   ├── valid-simple.csv
│   ├── large-50k.csv
│   └── arch-baseline.json
├── helpers/               # Tien ich dung chung cho test
│   ├── module-handlers.ts
│   ├── test-infra.ts
│   └── transaction.ts
├── jest-integration.json  # Cau hinh Jest rieng cho integration
├── jest-e2e.json          # Cau hinh Jest rieng cho E2E
├── unit_test/             # Checklist kich ban kiem thu (20 file .md)
└── helpers/
```

> **Lưu ý về số liệu.** Ngoài `test/` còn có 2 file spec nằm ngoài thư mục này:
> `src/modules/analysis/domain/corr-vif-ai.spec.ts` (unit test cho thuật toán tương quan/VIF)
> và `scripts/benchmark/*.spec.ts`. Tổng cộng là **74 file spec**.
>
> Ba tầng được chạy bởi **ba lệnh khác nhau**, nên số test của từng tầng không cộng trực tiếp
> vào `pnpm test`:
>
> | Lệnh | Tầng | Suite | Test |
> |---|---|---|---|
> | `pnpm test` | unit + arch | 67 | 1 069 |
> | `pnpm test:integration` | integration | 7 | 138 |
> | `pnpm test:e2e` | e2e | 5 | 70 |
> | **Tổng** | | **79** | **1 277** |

---

## 2. Bon tang kiem thu

| Tang | Vi du | Can ha tang? | Lenh chay |
|---|---|---|---|
| **Unit** | `datasets-wave4.spec.ts`, `policies-guard.spec.ts` | Khong | `pnpm test` |
| **Architecture** | `clean-architecture.spec.ts`, `mongo-session-arch.spec.ts` | Khong | `pnpm test:arch` |
| **Integration** | `integration/repositories.spec.ts`, `integration/record-query.spec.ts` | **Co** | `pnpm test:integration` |
| **E2E** | `e2e/health.e2e-spec.ts`, `e2e/security/*.e2e-spec.ts` | **Co** | `pnpm test:e2e` |

### 2.1 Vì sao tach integration rieng?

`package.json` khai bao `testPathIgnorePatterns` chua `<rootDir>/test/integration/`. Cac test integration dung **chung mot database MongoDB test**. Neu chay song song nhieu worker, chung se tranh chap khi xoa collection - ket qua la test hong g lan.

`pnpm test:integration` chay rieng voi `--runInBand` va timeout rieng.

---

## 3. Lenh chay

```bash
# Mac dinh: unit + arch, bo qua integration
pnpm test

# Unit thuan
pnpm test:unit

# Architecture
pnpm test:arch

# Integration (can ha tang)
pnpm test:infra:up
pnpm test:integration
pnpm test:infra:down

# E2E
pnpm test:e2e

# E2E security
pnpm test:security

# Toan bo
pnpm test:all
pnpm test:all:infra

# Do phu
pnpm test:cov
```

---

## 4. Ket qua hien tai

| Chi so | Gia tri |
|---|---|
| Test pass | **1 277 / 1 277** |
| Suite | 79 (67 unit/arch + 7 integration + 5 e2e) |
| File spec | 74 (72 trong `test/` + 1 trong `src/` + 1 trong `scripts/benchmark/`) |
| Phu cau lenh | 71.03% (8 796 / 12 383) |
| Phu dong | 72.05% (7 708 / 10 697) |
| Phu nhanh | 58.33% (4 091 / 7 013) |
| Phu ham | 62.06% (1 361 / 2 193) |

---

## 5. Ha tang cho integration

```bash
pnpm test:infra:up     # MongoDB replica set + Redis + MinIO
pnpm test:infra:down   # Don dep
```

`scripts/test-infra-up.sh` khoi dong MongoDB replica set bang `systemd-run --user` (fallback `--fork`) de tranh tien trinh bi keo theo khi lenh ket thuc - vi du khi chay trong CI runner.

`helpers/test-infra.ts` va `helpers/transaction.ts` cung cap fixture cho test can replica set (transaction yeu cau replica set, standalone MongoDB khong ho tro).

---

## 6. Quy tac viet test

### 6.1 Test handler

- Fake repository/port tra fixture **co kiem soat**: success / null / throw / conflict.
- Assert **ca** output/error **va** thao tac ghi/phat event duoc phep, **va** thao tac tuyet doi khong duoc goi.
- Khong chi assert mock duoc goi ma bo qua payload, scope, du lieu tra ve.

### 6.2 Test ham thong ke / crypto

Dung **thuat toan that** voi dap an **doc lap**. Tuyệt doi khong mock chinh ham dang test de sinh expected value.

### 6.3 Fake clock

Dong ho, random ID, timer, provider/model va network deu dung fake/mock. Test lease, TTL va retry phai dung fake clock de khong phu thuoc thoi gian that.

### 6.4 Phan biet unit va integration

| Khai bao | Ghi chu |
|---|---|
| "Gia tri duoc truyen dung vao port, handler tra ve dung ten" | Unit test |
| "MongoDB that luu va doc lai ten moi" | Integration test (INT-002) |

### 6.5 Khong tu suy dien

Ca co nhan GAP / OPEN / RISK **khong** duoc xem la hành vi dang dung. Characterization test mo ta code hien tai, khong thay the acceptance test theo yeu cau.

---

## 7. Test kien truc

| File | Kiem tra |
|---|---|
| `clean-architecture.spec.ts` | 14 quy tac CA1-CA14 |
| `mongo-session-arch.spec.ts` | Truyen session MongoDB qua AsyncLocalStorage |

| Lenh | Kiem tra |
|---|---|
| `pnpm arch:cross-imports` | Import cheo module ngoai public contract |
| `pnpm arch:api-coverage` | Hop dong API §3.13 khop ma nguon (84/84) |
| `pnpm arch:baseline` | So sanh voi baseline da luu (`fixtures/arch-baseline.json`) |

---

## 8. E2E Security

| File | Pham vi |
|---|---|
| `e2e/security/authorization.e2e-spec.ts` | IDOR, phan quyen 2 tang |
| `e2e/security/cookie-parser-regression.e2e-spec.ts` | Regression cookie parser |
| `e2e/security/google-oauth.e2e-spec.ts` | Luong OAuth 2.0 |
| `e2e/security/google-oauth-cookie.e2e-spec.ts` | Cookie trong luong OAuth |

---

## 9. Kich ban tai chong (k6)

| File | Muc dich |
|---|---|
| `k6/smoke.js` | Kiem tra nhanh API con song |
| `k6/stress.js` | Tang tai lien tuc den khi bao loi |
| `k6/analysis-latency.js` | Do do tre cua luong phan tich |

```bash
pnpm test:perf          # k6 smoke + stress
pnpm test:perf:staging  # Bao cao hieu nang staging
```

---

## 10. Du lieu mau

| File | Mo ta |
|---|---|
| `fixtures/valid-simple.csv` | CSV hop le, dung cho smoke test |
| `fixtures/large-50k.csv` | 50 000 dong - kiem tra hieu nang streaming import |
| `fixtures/arch-baseline.json` | Baseline kien truc de so sanh |

---

## 11. Checklist kich ban

`unit_test/` chua 20 file markdown mo ta **384 nhom kich ban** can kiem tra. Day la **checklist**, khong phai bao cao ket qua. Xem [`unit_test/README.md`](unit_test/README.md).
