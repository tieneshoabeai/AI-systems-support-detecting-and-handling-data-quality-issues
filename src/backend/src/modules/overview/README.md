# MODULE `overview` - Tong quan

> **Module Specification & Documentation**

## 1. Thong tin Phien ban (Version Information)

- **Current Version:** v1.1.0
- **Last Updated:** 2026-11-21
- **Module Path:** `src/backend/src/modules/overview` (5 file TypeScript)
- **Architecture Layer:** Clean Architecture 4 tang (`domain` -> `application` -> `infrastructure` -> `presentation`)
- **Layer Rules:** CA1-CA14 - xem [`../README.md`](../README.md)

## 2. Muc dich & Pham vi Nghiep vu (Scope & Responsibility)

Module tra cu bien nhat cho man hinh dashboard: so lieu tong hop ma khong can cham vao tung module.

Day la module **chi doc**. Khong co command handler, khong co domain event phat ra.

### 2.1. Tinh nang thuoc pham vi

| Chuc nang | Noi dung |
|---|---|
| Tong quan nguoi dung | So workspace, project, dataset, phan tich cua toi |
| Tong quan workspace | Thong ke theo tung project trong workspace |

### 2.2. Cau truc thu muc

```text
overview/
|-- application/
|   |-- queries/
|   |   |-- get-user-overview.handler.ts
|   |   `-- get-workspace-overview.handler.ts
|   `-- overview.types.ts
|-- presentation/controllers/overview.controller.ts
`-- overview.module.ts
```

## 3. Nhat ky Prompting & Quyet dinh Ky thuat (Prompting Log & Rationale)

- **User Prompt / Business Intent:** Cung cap mot API tom tat cho dashboard, de frontend khong phai goi 5-6 endpoint khac nhau chi de ve mot man hinh tong quan.

- **Technical Reasoning & Decisions:**

1. **Khong co `domain/` rieng.** Module nay **khong co quy tac nghiep vu** chi duoc bien dich - tat ca so lieu lay tu repository cua module khac qua port. Tao `domain/` rong se chi la nhieu.

2. **Khong co command handler, khong co event.** Module chi doc - khong duoc tao hay sua du lieu.

3. **Tinh nhieu chi so trong mot lan quet.** Module dung **aggregation pipeline** voi `$facet` de tinh nhieu chi so theo tung project trong mot lan quet database, thay vi chay nhieu truy van rieng le. Voi dataset lon, cach nay khac biet giua chay duoc va khong chay duoc.

4. **Chi lay so lieu can cho dashboard.** Khong dua du lieu chi tiet (bang record, danh sach day du) vao response tong quan - response phai nhe.

- **Generated / Modified Artifacts:**

- `application/queries/get-user-overview.handler.ts` - tong quan nguoi dung.
- `application/queries/get-workspace-overview.handler.ts` - tong quan workspace, dung `$facet`.

## 4. Dac ta Giao tiep Ky thuat (Technical Contracts & API Specifications)

### 4.1. Endpoints

| Method | Path | Chinh sach | Mo ta |
|---|---|---|---|
| `GET` | `/api/v1/overview/workspaces` | Member | Tong quan cua toi |
| `GET` | `/api/v1/workspaces/:id/overview` | Member workspace | Tong quan workspace |

### 4.2. Interfaces / Providers duoc export ra ngoai

`src/backend/src/modules/overview/index.ts` export public contract:

| Export | Vai tro |
|---|---|
| `OverviewModule` | Nest module |

### 4.3. Su kien domain phat ra

> Module nay **khong phat su kien** - no thuan la lop doc du lieu tong hop.

## 5. Rang buoc & Tieu chuan Bat bien (Invariants & Security Rules)

### 5.1. Bat bien nghiep vu

- Chi so phai phan anh dung trang thai hien tai cua du lieu nguoi dung xem.
- Khong duoc lo du lieu chi tiet vao response tong quan.
- Chi tinh so lieu cua workspace ma nguoi dung **la thanh vien**.
- So lieu phai duoc tinh trong **mot** aggregation pipeline khi co the.

### 5.2. Xoa mem (Soft Delete)

- **Chuan:** `deleted_at: Date | null` - truong nay **null** nghia la ban ghi dang hoat dong.
- **Quy tac truy van:** moi truy van mac dinh luon loc `deleted_at: null`. Repository base (`shared/infrastructure/database/base-mongo.repository.ts`) ap dung dieu nay tu dong.
- **Choi index Partial Unique:** `partialFilterExpression: { deleted_at: null }` - cho phep tai khoan / ten / email da xoa mem duoc tao lai.

### 5.3. Bao mat

| Van de | Cach xu ly |
|---|---|
| Xem tong quan workspace nguoi khac | Policy loader kiem tra instance |
| Lo du lieu qua response | Chi con so lieu tong hop |
| Query lan qua nhieu lan | Aggregation `$facet` gom nhieu chi so trong mot lan quet |

### 5.4. Phan quyen

| Route | Chinh sach |
|---|---|
| `GET /overview/workspaces` | Loc theo vai tro cua toi |
| `GET /workspaces/:id/overview` | Member workspace |

## 6. Lich su Thay doi (Change Log & Version History)

### 2026-11-21
- **v1.1.0** / 2026-11-21 / Viet lai README module day du theo chuan 6 phan / Yeu cau tai doc / Tai lieu mau chuan

### 2026-11-XX
- **v1.0.0** / 2026-11-XX / Bo sung `get-workspace-overview.handler.ts` dung `$facet` / Mot lan quet database cho nhieu chi so / `modules/overview`
- **v0.5.0** / 2026-11-XX / Bo sung `get-user-overview.handler.ts` / Dashboard tong quan ca nhan / `modules/overview`
- **v0.1.0** / 2026-11-XX / Tao module / Lop doc tong hop, tach khoi `projects` / `modules/overview`

- **Dinh dang:** `[Version] / [Ngay] / [Thay doi gi] / [Ly do] / [Anh huong den dau]`
