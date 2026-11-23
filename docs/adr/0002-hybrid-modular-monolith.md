# ADR-0002: Modular Monolith lai — 6 module don gian ve monolith, 7 module phuc tap giu hexagonal

- **Trang thai:** Da chap nhan (thay the huong vertical-slice toan bo cua ADR-0001)
- **Ngay:** 2026-11-24
- **Nguoi quyet dinh:** Hoa
- **Thay the:** ADR-0001 (giuu lai lam lich su; huong slice-toan-bo da revert ve P1 `31cd2f3`)

## Boi canh
Sau khi revert 5 commit P2/P3 ve P1, backend dang o trang thai:
- Monolith trien khai: 1 `AppModule`, 1 process, 1 `shared/` kernel, 13 module
- Moi module giu Clean 4 tang: `application/*.handler.ts` (107 handler) + `domain/` + `infrastructure/` + `presentation/`
- Bien module da enforce tot: 116 import cheo 100% qua `index.ts` (rule MM2 o P1)

Ep chung 1 template slice cho ca 13 module la sai: module don gian khong co gi de bao ve bang hexagonal,
module phuc tap thi hexagonal dang ganh that (transaction/outbox/policy/AI worker).

## Quyet dinh
**Vo Modular Monolith + ruot heterogeneous:**
- Vo giu strict: 1 deploy, 13 module, `index.ts` public contract, cam import sau (MM2), `shared/` khong doi
- Ruot chia 2 loai template, ghi ro trong `README.md` moi module:
  - **Simple (monolith ben trong):** 6 module — `audit, overview, data-view, realtime, notifications, feedback-nhe`
    - Cau truc dich: `<mod>.routes.ts + <mod>.service.ts (+ <mod>.repository.ts + <mod>.schema.ts neu co DB rieng) + <mod>.types.ts + index.ts + <mod>.module.ts`
    - Entity nhe (neu co) nam gon trong `<mod>.types.ts`, khong tach `domain/`
    - Handler gop thanh method service, giu nguyen chu ky `execute()` + thu tu tham so (TC-02)
  - **Hexagonal (giu 4 tang):** 7 module — `analysis, auth, datasets, projects, workspaces, users, issues`
    - Giu nguyen `application/ + domain/ + infrastructure/ + presentation/`, chi chuan hoa import qua `index.ts`
    - Khong gop entity/port/handler; chi xoa import sau, sua test import path

## Nguong cung (khi nao Simple, khi nao Hexagonal)
Giu Hexagonal neu module co >= 1 trong:
1. Invariant nghiep vu phai bao ve bang entity (title/reason/optimistic locking/quota/password policy)
2. Transaction + outbox + cascade (`tx.runInTransaction`, `resolveMongoSession`, strict vs best-effort)
3. Policy RBAC 3 tang / fail-safe adapter
4. Tich hop ngoai fallible (AI worker, RAG, SMTP, ntfy, S3 stream) ma loi khong duoc hong luong chinh

Nguoc lai -> Simple. `feedback` duoc Simple voi dieu kien giu `Feedback.create/updateByAuthor + requiresReason + ensureNotAdmin` trong `types.ts`.
`notifications` duoc Simple voi dieu kien giu 2 mapper rieng (DB vs email) + `Notification.create/markAsRead`.

## Cac lua chon da can nhac
| Lua chon | Ly do bi loai |
|---|---|
| A. Slice toan bo 13 module (ADR-0001) | Over-engineering cho module don gian; da revert 5 commit |
| B. Monolith thuan toan bo (xoa modules/) | Mat cho gom invariant + de xoa nham session/outbox/policy; service phinh 2000-3000 LOC |
| C. **Hybrid 6+7 (chon)** | Dung cho dau: don gian duoc gon, phuc tap duoc bao ve; it dap pha nhat |
| D. Giu nguyen 4 tang het | Khong giai quyet noi dau "nguoi moi kho hieu" o nhom don gian |

## Danh doi
| Mat | Bu |
|---|---|
| 2 template trong 1 repo, nguoi moi phai doc ADR | Ghi `Template: Simple/Hexagonal` trong moi `README.md` + checklist cong khac nhau |
| Monolith de bi xoa nham invariant | Bat buoc giu `session/outbox`, `ensureNotAdmin/isObjectIdHex/deleted_at/camel-snake`, thu tu guard + route, TTL/index (TC/AC/BC/PC giu nguyen) |
| Compile-time check hop dong giua module | ESLint MM2 + arch test + integration test (giuu P1) |

## He qua thuc thi
- Chi flatten 6 module Simple theo thu tu `audit -> overview -> realtime -> data-view -> notifications -> feedback`, moi module 1 commit + du cong `type-check + lint + 82 HTTP + 1 WS + test`
- 7 module Hexagonal: khong gop, chi chuan hoa + viet tai lieu
- So lieu muc tieu moi: 340 file -> ~305 file (thay vi ~180); LOC -~3000; thu muc con -~30
- `12_business_invariants.md` + `13_refactor_constraints.md` giu nguyen hieu luc cho ca 2 template
