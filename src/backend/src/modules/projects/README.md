# MODULE `projects` - Du an phan tich

> **Module Specification & Documentation**

## 1. Thong tin Phien ban (Version Information)

- **Current Version:** v1.1.0
- **Last Updated:** 2026-11-21
- **Module Path:** `src/backend/src/modules/projects` (43 file TypeScript)
- **Architecture Layer:** Clean Architecture 4 tang (`domain` -> `application` -> `infrastructure` -> `presentation`)
- **Layer Rules:** CA1-CA14 - xem [`../README.md`](../README.md)

## 2. Muc dich & Pham vi Nghiep vu (Scope & Responsibility)

Project la **don vi cong viec** trong mot workspace: noi chua dataset, chay phan tich chat luong du lieu va sinh bao cao.

```text
Workspace ---> Project ---> Dataset ---> DataRecord
                      |---> Analysis (ket qua DQ + AI)
                      `---> ProjectSave (ban luu cua nguoi dung)
```

### 2.1. Tinh nang thuoc pham vi

| Chuc nang | Noi dung |
|---|---|
| CRUD project | Tao, doc, cap nhat, xoa mem |
| Thanh vien | Them, doi vai tro, xoa, chuyen owner |
| Trang thai | `not_started` -> `in_progress` -> `completed` |
| Snapshot | Luu trang thai voi optimistic locking (`expectedVersion`) |
| Phan quyen ngu canh | Resolve vai tro project cua user theo request |
| Cascade | Xoa project -> xoa dataset + file R2 ben trong |

### 2.2. Cau truc thu muc

```text
projects/
|-- domain/
|   |-- entities/project.entity.ts
|   |-- value-objects/
|   |   |-- project-role.vo.ts       # owner | member | viewer + ma tran quyen
|   |   `-- project-status.vo.ts     # not_started | in_progress | completed
|   |-- events/project-events.ts
|   `-- ports/
|       |-- project.repository.port.ts
|       `-- project.access.port.ts
|-- application/
|   |-- commands/                    # 10 command handler
|   |-- queries/                     # 7 query handler
|   |-- policy-loaders/
|   |   |-- project-policy.loader.ts
|   |   |-- project-scope-policy.loader.ts
|   |   `-- workspace-scope-policy.loader.ts
|   |-- projects.types.ts
|   `-- projects.utils.ts
|-- infrastructure/
|   |-- adapters/
|   |   |-- project-access.adapter.ts
|   |   `-- project-context.adapter.ts     # hien thuc PROJECT_CONTEXT_PORT
|   `-- persistence/                  # schema, repository, mapper
`-- presentation/
    |-- controllers/projects.controller.ts
    |-- dtos/                          # 5 DTO
    `-- responses/project.response.ts
```

## 3. Nhat ky Prompting & Quyet dinh Ky thuat (Prompting Log & Rationale)

- **User Prompt / Business Intent:** Lam `projects` la **tang cuoi cung** cua mo hinh phan quyen (3 vai tro: `owner` | `member` | `viewer`) va la **don vi cong viec** ma dataset, phan tich va bao cao deu gan vao.

- **Technical Reasoning & Decisions:**

1. **Ma tran quyen tap trung trong VO, khong rai rac.** `canModerateProject(projectRole, workspaceRole)` va `canAccessProject(projectRole, workspaceRole)` trong `project-role.vo.ts` la **nguon su truth duy nhat**. Entity goi qua `assertCanModerate()` / `assertCanAccess()`, handler khong tu viet lai dieu kien. Cach nay loai bo class bug "check o controller, check o service, check o query - khac nhau".

2. **Ba vai tro project.** `owner` (toan quyen), `member` (duoc ghi: them dataset, chay phan tich), `viewer` (chi doc). Vai tro `owner` va `member` phan biet nhau o ha cap; `viewer` duoc sua o ha cap de phan biet quyen doc voi quyen ghi.

3. **Suy ra vai tro tu workspace.** `ProjectContextAdapter` ap dung: WS-OWNER -> PROJ-OWNER; co mat trong `project.members` -> lay dung vai tro ghi trong DB; WS-MEMBER mac dinh -> PROJ-VIEWER. Nho vay **them** mot nguoi vao workspace khong cap quyen ghi - phai them vao project.

4. **Optimistic locking.** `PUT /projects/:id/snapshot` nhan `expectedVersion`; lech -> `ConflictError` (HTTP 409). Chuyen hai nguoi cung sua mot project se ghi de lan nhau neu khong co khoa.

5. **Ba policy loader.** `ProjectPolicyLoader` (theo `:id`), `ProjectScopePolicyLoader` (theo danh sach id), `WorkspaceScopePolicyLoader` (theo workspace id). Tach rieng de vi trieu chi khac nhau va tranh tai phu ban.

6. **Cascade qua outbox event + transaction.** Xoa project phai xoa dataset va file R2. Lam truc tiep trong handler tao trang thai nua cua doi; transaction dam bao nhat quan.

- **Generated / Modified Artifacts:**

- `domain/value-objects/project-role.vo.ts` - `ProjectMemberRole`, `canModerateProject`, `canAccessProject`.
- `domain/value-objects/project-status.vo.ts` - `PROJECT_STATUSES`, `isProjectCompleted`.
- `infrastructure/adapters/project-context.adapter.ts` - hien thuc `PROJECT_CONTEXT_PORT`, fail-safe.
- `application/policy-loaders/` - 3 loader.
- `application/commands/delete-project.handler.ts` + `cascade-project-datasets.handler.ts` - cascade.

## 4. Dac ta Giao tiep Ky thuat (Technical Contracts & API Specifications)

### 4.1. Endpoints

| Method | Path | Chinh sach | Mo ta |
|---|---|---|---|
| `POST` | `/api/v1/workspaces/:workspaceId/projects` | Member workspace | Tao project |
| `GET` | `/api/v1/workspaces/:workspaceId/projects` | Member workspace | Liet ke project cua workspace |
| `GET` | `/api/v1/projects` | Dang nhap | Liet ke project theo vai tro cua toi |
| `GET` | `/api/v1/projects/:id` | `canAccessProject` | Chi tiet project |
| `PATCH` | `/api/v1/projects/:id` | `canModerateProject` | Cap nhat |
| `DELETE` | `/api/v1/projects/:id` | `canModerateProject` | Xoa mem (cascade) |
| `PUT` | `/api/v1/projects/:id/snapshot` | `Action.Execute` | Luu trang thai (optimistic locking) |
| `GET` | `/api/v1/projects/:id/members` | `canAccessProject` | Danh sach thanh vien |
| `POST` | `/api/v1/projects/:id/members` | `canModerateProject` | Them thanh vien |
| `PATCH` | `/api/v1/projects/:id/members/:userId` | `canModerateProject` | Doi vai tro |
| `DELETE` | `/api/v1/projects/:id/members/:userId` | `canModerateProject` | Xoa thanh vien |
| `POST` | `/api/v1/projects/:id/transfer-owner` | Owner hien tai | Chuyen quyen so huu |

### 4.2. Interfaces / Providers duoc export ra ngoai

`src/backend/src/modules/projects/index.ts` export public contract:

| Export | Vai tro |
|---|---|
| `ProjectsModule` | Nest module |
| `Project` entity, `ProjectRole`, `ProjectStatus` | Domain contract |
| `PROJECT_REPOSITORY_PORT` | Port truy van project |

> `PROJECT_CONTEXT_PORT` **khong** thuoc public contract cua module `projects` — no la
> port tang `shared` (`shared/application/ports/project-context.port.ts`), duoc
> `projects` **implement** qua `infrastructure/adapters/project-context.adapter.ts`.
> Token nay khong duoc re-export tu `modules/projects/index.ts`.

### 4.3. Su kien domain phat ra

| Event | Khi nao | Muc dich |
|---|---|---|
| `project.created` | Tao project | Audit log + thong bao |
| `project.updated` | Cap nhat project | Audit log |
| `project.member_added` | Them thanh vien | Thong bao |
| `project.member_removed` | Xoa thanh vien | Thong bao |
| `project.owner_transferred` | Chuyen owner | Thong bao cho ca hai ben |
| `PROJECT_DELETED` | Xoa project | Kich hoat cascade xoa dataset |

## 5. Rang buoc & Tieu chuan Bat bien (Invariants & Security Rules)

### 5.1. Bat bien nghiep vu

- Project **phai** thuoc mot `workspaceId` va co `ownerId`.
- Chi `canModerateProject` duoc them / xoa / doi vai tro thanh vien, cap nhat, xoa project.
- Khong xoa chinh owner qua `DELETE /members/:userId` - phai `transfer-owner` truoc.
- `status` chi nhat trong `{ not_started, in_progress, completed }`.
- `completed` la trang thai cuoi - khong quay lai.
- `version` tang **monotonically**; `expectedVersion` lech -> `ConflictError` (409).
- Khong the dat vai tro `viewer` cho chinh owner hien tai.
- Chi workspace owner / project owner duoc chuyen quyen so huu.

### 5.2. Xoa mem (Soft Delete)

- **Chuan:** `deleted_at: Date | null` - truong nay **null** nghia la ban ghi dang hoat dong.
- **Quy tac truy van:** moi truy van mac dinh luon loc `deleted_at: null`. Repository base (`shared/infrastructure/database/base-mongo.repository.ts`) ap dung dieu nay tu dong.
- **Choi index Partial Unique:** `partialFilterExpression: { deleted_at: null }` - cho phep tai khoan / ten / email da xoa mem duoc tao lai.

### 5.3. Bao mat

| Van de | Cach xu ly |
|---|---|
| IDOR qua `projectId` | Dynamic check nap instance + kiem tra `workspaceId` / `members` |
| Thanh vien project xem project khac | `canAccessProject` kiem tra ca vai tro project va workspace |
| Ghi de thay doi cua nguoi khac | Optimistic locking qua `expectedVersion` -> 409 |
| Chuyen quyen so huu khong ai duong | Policy loader + kiem tra owner hien tai |
| Xoa nham project nguoi khac | Chi owner duoc xoa |
| Truy van context loi | Adapter fail-safe tra tap rong |

### 5.4. Phan quyen

**Ma tran quyen:**

| Quyen | PROJ-OWNER | PROJ-MEMBER | PROJ-VIEWER | WS-OWNER |
|---|---|---|---|---|
| Doc project | Co | Co | Co | Co |
| Chay phan tich | Co | Co | Khong | Co |
| Xem dataset | Co | Co | Co | Co |
| Quan ly thanh vien | Co | Khong | Khong | Co |
| Cap nhat project | Co | Khong | Khong | Co |
| Xoa project | Co | Khong | Khong | Co |

**Suy ra vai tro:** WS-OWNER -> PROJ-OWNER; co trong `project.members` -> vai tro ghi trong DB; WS-MEMBER mac dinh -> PROJ-VIEWER.

## 6. Lich su Thay doi (Change Log & Version History)

### 2026-11-21
- **v1.1.0** / 2026-11-21 / Viet lai README module day du theo chuan 6 phan / Yeu cau tai doc / Tai lieu mau chuan

### 2026-11-XX
- **v1.0.0** / 2026-11-XX / Bo sung `project-context.adapter.ts` hien thuc `PROJECT_CONTEXT_PORT` va 3 policy loader / Hoan thien tang ngu canh cua mo hinh phan quyen 3 tang / `modules/projects`
- **v0.9.0** / 2026-11-XX / Bo sung optimistic locking qua `expectedVersion` tren `PUT /snapshot` / Chan ghi de thay doi / `modules/projects`
- **v0.8.0** / 2026-11-XX / Cascade xoa project -> dataset -> file R2, boc transaction MongoDB / Dam bao nhat quan / `modules/projects`, `modules/datasets`
- **v0.4.0** / 2026-11-XX / Bo sung `transfer-owner` va doi vai tro thanh vien / Vong doi so huu an toan / `modules/projects`
- **v0.1.0** / 2026-11-XX / Tao module, tach thanh vien vao mang `members[]` / Kien truc Clean Architecture / `modules/projects`

- **Dinh dang:** `[Version] / [Ngay] / [Thay doi gi] / [Ly do] / [Anh huong den dau]`
