# MODULE `workspaces` - Khong gian lam viec

> **Module Specification & Documentation**

## 1. Thong tin Phien ban (Version Information)

- **Current Version:** v1.1.0
- **Last Updated:** 2026-11-21
- **Module Path:** `src/backend/src/modules/workspaces` (38 file TypeScript)
- **Architecture Layer:** Clean Architecture 4 tang (`domain` -> `application` -> `infrastructure` -> `presentation`)
- **Layer Rules:** CA1-CA14 - xem [`../README.md`](../README.md)

## 2. Muc dich & Pham vi Nghiep vu (Scope & Responsibility)

Workspace la **vung chua cap cao nhat** trong mo hinh phan quyen. Moi project, dataset va phan tich deu nam ben trong mot workspace.

```text
User ---> Workspace ---> Project ---> Dataset ---> DataRecord
        (owner/member)  (owner/member/viewer)
```

### 2.1. Tinh nang thuoc pham vi

| Chuc nang | Noi dung |
|---|---|
| CRUD workspace | Tao, doc, cap nhat, xoa mem |
| Thanh vien | Them, xoa, liet ke, chuyen quyen so huu, tu roi |
| Han ngach | Gioi han so workspace/user, dung luong/workspace |
| Phan quyen ngu canh | Resolve vai tro workspace cua user theo request |
| Su kien | `workspace.created`, `workspace.member_added`, `workspace.member_removed`, `workspace.owner_transferred`, `WORKSPACE_DELETED` |

### 2.2. Cau truc thu muc

```text
workspaces/
|-- domain/
|   |-- entities/workspace.entity.ts
|   |-- value-objects/
|   |   |-- workspace-role.vo.ts     # owner | member + resolveWorkspaceRole
|   |   `-- workspace-quota.vo.ts    # gioi han 20 workspace/user
|   |-- events/workspace-events.ts
|   `-- ports/
|       |-- workspace.repository.port.ts
|       `-- workspace.access.port.ts
|-- application/
|   |-- commands/                    # 8 command handler
|   |-- queries/                     # 6 query handler
|   |-- policy-loaders/workspace-policy.loader.ts
|   |-- workspaces.types.ts
|   `-- workspaces.utils.ts
|-- infrastructure/
|   |-- adapters/
|   |   |-- workspace-access.adapter.ts
|   |   `-- workspace-context.adapter.ts    # hien thuc WORKSPACE_CONTEXT_PORT
|   `-- persistence/                  # schema, repository, mapper
`-- presentation/
    |-- controllers/workspaces.controller.ts
    |-- dtos/                         # 6 DTO
    `-- responses/workspace.response.ts
```

## 3. Nhat ky Prompting & Quyet dinh Ky thuat (Prompting Log & Rationale)

- **User Prompt / Business Intent:** Lam `workspaces` la **tang trung gian** cua mo hinh phan quyen 3 tang: giua vai tro he thong (`admin`/`analyst`) va vai tro project (`owner`/`member`/`viewer`). Module nay phai tra loi duy nhat mot cau hoi: "user nay co quyen gi trong workspace nay?"

- **Technical Reasoning & Decisions:**

1. **Vai tro workspace la nguon su that duy nhat.** `resolveWorkspaceRole(ownerId, members, userId)` trong `workspace-role.vo.ts` la **ham duy nhat** quyet dinh vai tro. No duoc dung lai boi `WorkspaceContextAdapter` de suy ra quyen o tang policy. Khong viet lai dieu kien o guard, o handler, o query - tranh mau thuan.

2. **Vai tro `editor` / `viewer` trong `members[]` bi chuan hoa thanh `member`.** Chi con 2 vai tro `owner` | `member` o tang workspace. Logic chi tiet hon nam o tang project. Cach nay giu mo hinh 3 tang de doc va de kiem chung.

3. **Han ngach so workspace/user = 20.** Neu khong gioi han, mot tai khoan co the tao hang loat workspace va gui loi moi toi hang loat dia chi - bien he thong thanh cong cu spam. Admin he thong **khong** bi gioi han. Chi tinh workspace ma user lam **owner** (khong tinh workspace chi la thanh vien).

4. **Quota dung luong theo `storage_used_bytes`** dong bo bang lenh tang cac module, tranh truy van dem la.

5. **Cascade xoa qua domain event, boc transaction MongoDB.** Xoa workspace phai xoa project -> dataset -> record. Lam truc tiep trong handler se tao trang thai nua cua doi. Dung outbox event + transaction de dam bao nhat quan.

- **Generated / Modified Artifacts:**

- `domain/value-objects/workspace-role.vo.ts` - `WorkspaceRole`, `resolveWorkspaceRole`.
- `domain/value-objects/workspace-quota.vo.ts` - `MAX_WORKSPACES_PER_USER = 20`, `WorkspaceQuotaExceededError`.
- `infrastructure/adapters/workspace-context.adapter.ts` - hien thuc `WORKSPACE_CONTEXT_PORT`, **fail-safe** ( loi tra ve tap rong).
- `application/policy-loaders/workspace-policy.loader.ts` - nap resource cho kiem tra instance.
- `application/commands/delete-workspace.handler.ts` - phat `WORKSPACE_DELETED`.

## 4. Dac ta Giao tiep Ky thuat (Technical Contracts & API Specifications)

### 4.1. Endpoints

| Method | Path | Chinh sach | Mo ta |
|---|---|---|---|
| `POST` | `/api/v1/workspaces` | Dang nhap | Tao workspace (tu dong la owner) |
| `GET` | `/api/v1/workspaces` | Dang nhap | Danh sach workspace toi tham gia |
| `GET` | `/api/v1/workspaces/:id` | Member | Chi tiet |
| `PATCH` | `/api/v1/workspaces/:id` | Owner | Cap nhat |
| `DELETE` | `/api/v1/workspaces/:id` | Owner | Xoa mem (cascade project) |
| `GET` | `/api/v1/workspaces/:id/members` | Member | Danh sach thanh vien |
| `POST` | `/api/v1/workspaces/:id/members` | Owner | Them thanh vien |
| `DELETE` | `/api/v1/workspaces/:id/members/:userId` | Owner | Xoa thanh vien (khong xoa owner) |
| `POST` | `/api/v1/workspaces/:id/transfer-owner` | Owner hien tai | Chuyen quyen so huu |
| `POST` | `/api/v1/workspaces/:id/leave` | Member (tru owner) | Tu roi workspace |

### 4.2. Interfaces / Providers duoc export ra ngoai

`src/backend/src/modules/workspaces/index.ts` export public contract:

| Export | Vai tro |
|---|---|
| `WorkspacesModule` | Nest module |
| `Workspace` entity, `WorkspaceRole` | Domain contract |
| `WORKSPACE_REPOSITORY_PORT` | Port truy van workspace |
| `WorkspaceQuotaExceededError` | Loi nghiep vu |

> `WORKSPACE_CONTEXT_PORT` **khong** thuoc public contract cua module `workspaces` — no la
> port tang `shared` (`shared/application/ports/workspace-context.port.ts`), duoc
> `workspaces` **implement** qua `infrastructure/adapters/workspace-context.adapter.ts`
> (fail-safe: loi tra ve tap rong). Token nay khong duoc re-export tu
> `modules/workspaces/index.ts`.

### 4.3. Su kien domain phat ra

| Event | Khi nao | Muc dich |
|---|---|---|
| `workspace.created` | Tao workspace | Audit log |
| `workspace.member_added` | Them thanh vien | Thong bao + audit log |
| `workspace.member_removed` | Xoa thanh vien | Thong bao + audit log |
| `workspace.owner_transferred` | Chuyen owner | Thong bao cho ca hai ben |
| `WORKSPACE_DELETED` | Xoa workspace | Kich hoat cascade xoa project |

## 5. Rang buoc & Tieu chuan Bat bien (Invariants & Security Rules)

### 5.1. Bat bien nghiep vu

- Workspace **phai** co `ownerId`. Khong ton tai workspace khong chu so huu.
- Chi `owner` duoc them / xoa thanh vien, chuyen quyen so huu.
- **Khong** xoa chinh owner qua `DELETE /members/:userId` - phai dung `transfer-owner` truoc.
- Owner phai `transfer-owner` truoc khi `leave`.
- So workspace ma user lam **owner** khong vuot qua `MAX_WORKSPACES_PER_USER = 20` (tru admin).
- `storage_used_bytes` khong duoc vuot `WORKSPACE_STORAGE_QUOTA_BYTES`; tong khong vuot `STORAGE_MAX_QUOTA_BYTES`.
- Ten workspace **duy nhất** trong cac workspace chua xoa mem (partial unique index).

### 5.2. Xoa mem (Soft Delete)

- **Chuan:** `deleted_at: Date | null` - truong nay **null** nghia la ban ghi dang hoat dong.
- **Quy tac truy van:** moi truy van mac dinh luon loc `deleted_at: null`. Repository base (`shared/infrastructure/database/base-mongo.repository.ts`) ap dung dieu nay tu dong.
- **Choi index Partial Unique:** `partialFilterExpression: { deleted_at: null }` - cho phep tai khoan / ten / email da xoa mem duoc tao lai.

### 5.3. Bao mat

| Van de | Cach xu ly |
|---|---|
| Truy cap workspace nguoi khac | Policy loader nap instance + kiem tra `ownerId` / `members` |
| IDOR qua `workspaceId` trong URL | Dynamic check cua `PoliciesGuard` kiem tra instance thuoc tinh |
| Spam workspace + moi nguoi | Han ngach 20 workspace/user, chi owner moi gui moi |
| Xoa nham workspace nguoi khac | Chi owner duoc xoa; policy loader kiem tra instance |
| Vượt hạn ngạch dung lượng | Kiem tra quota truoc khi ghi, tra loi domain |
| Truy van context loi | Adapter fail-safe tra tap rong thay vi nem |

### 5.4. Phan quyen

| Route | Chinh sach |
|---|---|
| `POST /workspaces` | Dang nhap - tu dong la owner |
| `GET /workspaces` | Loc theo vai tro cua toi |
| `GET /workspaces/:id` | Member |
| `PATCH /workspaces/:id`, `DELETE /workspaces/:id` | Owner |
| `GET /workspaces/:id/members` | Member |
| `POST /workspaces/:id/members`, `DELETE .../members/:userId` | Owner |
| `POST /workspaces/:id/transfer-owner` | Owner hien tai |
| `POST /workspaces/:id/leave` | Member (tru owner) |

**Suy ra quyen project tu vai tro workspace:** WS-OWNER -> PROJ-OWNER (toan quyen tren moi project cua workspace); WS-MEMBER -> lay dung vai tro ghi trong `project.members`, neu khong co -> PROJ-VIEWER.

## 6. Lich su Thay doi (Change Log & Version History)

### 2026-11-21
- **v1.1.0** / 2026-11-21 / Viet lai README module day du theo chuan 6 phan / Yeu cau tai doc / Tai lieu mau chuan

### 2026-11-XX
- **v1.0.0** / 2026-11-XX / Bo sung `workspace-context.adapter.ts` hien thuc `WORKSPACE_CONTEXT_PORT` / Bo sung tang ngu canh cho mo hinh phan quyen 3 tang / `modules/workspaces`, `shared/application/ports`
- **v0.9.0** / 2026-11-XX / Bo sung han ngach `MAX_WORKSPACES_PER_USER` va quota dung luong / Chong spam + bao ve ha tang / `modules/workspaces`
- **v0.7.0** / 2026-11-XX / Cascade xoa workspace -> project -> dataset, boc transaction MongoDB / Tranh trang thai nua cua doi / `modules/workspaces`, `modules/projects`, `modules/datasets`
- **v0.3.0** / 2026-11-XX / Bo sung `transfer-owner` va `leave` / Vong doi so huu an toan / `modules/workspaces`
- **v0.1.0** / 2026-11-XX / Tao module, tach thanh vien vao mang `members[]` / Kien truc Clean Architecture / `modules/workspaces`

- **Dinh dang:** `[Version] / [Ngay] / [Thay doi gi] / [Ly do] / [Anh huong den dau]`
