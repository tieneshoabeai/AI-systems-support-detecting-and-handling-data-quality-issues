# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

University project (UTH, advanced JS/TS course): a platform for detecting and handling data quality issues (missing values, outliers, duplicates, format anomalies) in uploaded CSV/Excel datasets, with versioning and lineage. Roadmap is "core platform first, AI assistance later". Documentation and code comments are mostly in Vietnamese; reply in Vietnamese unless asked otherwise, keeping technical terms in English.

Two independent apps, no root package.json — always `cd` into the app first:

- `src/backend/` — NestJS 11 API, **pnpm** (`packageManager: pnpm@11`)
- `src/frontend/` — React 19 + Vite 8 SPA, **Yarn 1** (keep both `yarn.lock` and `package-lock.json`; don't mix `npm install` or regenerate lockfiles)

`docs/` holds design specs and reports (versioned `*_v1..v5.md`; the highest version is the newest). Per-module backend design docs live in `docs/modules/` and in each `src/backend/src/modules/*/README.md`.

## Commands

Backend (`src/backend`):

```sh
pnpm install
pnpm start:dev          # tsc build check + nest watch; serves on PORT (3000), prefix /api/v1, Swagger enabled
pnpm test               # jest, all test/*.spec.ts
pnpm test -- test/projects.spec.ts      # single file
pnpm test -- -t "pattern"               # single test by name
pnpm type-check         # tsc --noEmit
pnpm db:bootstrap       # create indexes/constraints; db:reset:{all,mongo,neo4j,storage} wipe selectively
pnpm db:seed
pnpm tunnel             # Cloudflare quick tunnel -> public HTTPS 443 URL
```

There is no ESLint config in the backend, so `pnpm lint` is not usable as-is. Env: `ConfigModule` reads `.env` then `src/backend/.env`, validated by `src/shared/config/env.validation.ts` (see `.env.example`). Leaving `S3_ENDPOINT` empty uses local filesystem storage fallback (`src/backend/storage`).

Frontend (`src/frontend`):

```sh
yarn install --frozen-lockfile
yarn dev
yarn test                                   # vitest run (jsdom), only src/__tests__/**/*.test.{ts,tsx}
yarn vitest run src/__tests__/auth/auth.service.test.ts   # single file
yarn vitest run -t "pattern"
yarn lint
yarn build                                  # tsc -b && vite build
```

Frontend requires `VITE_API_BASE_URL` (validated in `src/configs/api.config.ts`). Vitest uses `envDir: false`, so tests never read the local `.env`. `scripts/generate-swagger-types.mjs` pulls the backend OpenAPI spec from `VITE_SWAGGER_URL`.

## Backend architecture

Modular monolith: `src/modules/<feature>` (auth, users, workspaces, projects, datasets, data-view, clean-rules, versions, lineage, exports) on top of `src/shared` (cross-cutting infra). Typical module: `controller → service → repository (extends BaseMongoRepository) → Mongoose schema`, with Zod DTOs in `dto/`.

Key cross-cutting mechanisms (need several files to understand):

- **Validation & Swagger come from Zod, not class-validator.** DTOs export a Zod schema + inferred type; controllers use `@Body(new ZodValidationPipe(Schema))` and `@ApiZodBody(Schema)` / `@ApiZodQuery` (`shared/swagger/`) to generate OpenAPI.
- **Auth/authorization pipeline:** `JwtAuthGuard` + CASL `PoliciesGuard` with `@CheckPolicies(ability => ability.can(Action.X, 'Subject'))`. Abilities are workspace-scoped ABAC (`shared/casl/casl-ability.factory.ts`). `@PolicyResource()` makes the guard load the target document and attach it to the request so handlers read it via `@CurrentResource()` instead of querying twice. Routes without auth must use `@Public()` — `test/guard-coverage.spec.ts` fails if any endpoint is neither guarded nor public (add new controllers to that test).
- **Responses/errors:** global `TransformInterceptor` wraps responses, `AllExceptionsFilter` normalizes errors, `LoggingInterceptor` logs via PII masking (`shared/crypto/mask-pii.ts`). `/health` is excluded from the global prefix.
- **Ambient Mongo transactions:** `MongooseTransactionService.runInTransaction(fn)` stores the `ClientSession` in `AsyncLocalStorage` (`mongo-session-context.ts`); `BaseMongoRepository` methods attach it automatically — don't thread `session` manually through layers.
- **Polyglot persistence:** MongoDB (metadata, raw rows in `dataset_records`, outbox), Neo4j (lineage DAG: `Dataset`/`Version`/`Transformation` nodes, `DERIVED_FROM`/`APPLIED_TO` edges, queries in `lineage-queries.cypher.ts`), S3/Cloudflare R2 (raw files, snapshots, encrypted exports) via `shared/storage`.
- **Transactional outbox:** Mongo writes record an event via `OutboxService.recordEvent(..., session)` in the same transaction; `lineage/services/outbox-processor.worker.ts` syncs pending events to Neo4j. Never write to Neo4j directly from a Mongo write path.
- **Ingestion** streams multipart uploads with `busboy` + `fast-csv` (memory-bounded); schema inferred by `datasets/services/schema-inference.service.ts`. **Data view** uses keyset/cursor pagination (`shared/pagination/cursor-codec.ts`), and cell updates use optimistic concurrency via `@IfMatch()`.
- **Clean rules** support dry-run on a sample in memory (`clean-rules/services/rule-executor.service.ts`) before applying.
- **Versions** form a hash chain: `version_hash = SHA256(data_checksum + parent_hash + rules_hash)`; exports are AES-256-GCM stream-encrypted with PBKDF2-derived keys (`shared/crypto/crypto.util.ts`).

Invariants enforced in code review and tests:

- **Zero `any`**: no `: any`, `as any`, `<any>`, `Record<string, any>` anywhere (src, scripts, tests). Use `unknown` + type guards or Zod `safeParse`. `test/zero-any.spec.ts` scans the tree.
- Parameterized queries only — Mongoose query builder for Mongo, `$param` for Cypher; never string-concatenate user input.
- Soft delete uses `deleted_at: Date | null` (never an `is_deleted` boolean), with partial unique indexes `{ partialFilterExpression: { deleted_at: null } }`.
- `password_hash` is `select: false`; never log raw emails/phones/tokens.

## Frontend architecture

Layering (enforced by convention, see `.agents/Structure/frontend-architecture-plan.md`):

```
app/router + pages → views / components → hooks → services → lib/axios-client → backend
                                                  → repositories (Dexie/IndexedDB)
graphics/ (R3F scenes, receive a scene model, emit selection callbacks)
math/     (pure functions, no UI/API)
```

- Components never call Axios or IndexedDB directly; services hold no UI state; graphics never make requests or business decisions.
- Entry `src/app/main.tsx` → `application-bootstrap.tsx` / `app-providers.tsx` (QueryClient, AuthProvider, router). Auth: `services/auth/session-coordinator.ts` manages token refresh **only with user consent** (session-renewal dialog) — no silent refresh. Logout clears token/user/query cache; unsent upload drafts in IndexedDB are kept but locked, account-scoped, with size caps (`configs/upload-draft.config.ts`).
- `workspace-3d/` (views/graphics/math) is a 3D resource map of workspace → project → dataset; `/preview/...` routes are a dev preview that must not touch private APIs or session data.
- File naming: kebab-case with role suffix (`login.view.tsx`, `auth.service.ts`, `upload-draft.repository.ts`); tests mirror domains under `src/__tests__/`.
- Brand: primary `#00A878`, danger `#DC2626`, self-hosted Plus Jakarta Sans; tokens in `src/app/design-tokens.css`.

Frontend planning/handoff docs live in `src/frontend/.agents/` (start with `handoff/context.md`, then `frontend-delivery/master-plan.md` and `modules/00-contract-audit.md` for which backend contracts are verified). These docs can lag the source — verify against code.

## Team working rules (from `src/frontend/.agents/rules`)

- Clarify unclear requirements, business logic, or API contracts instead of inventing them; mark assumptions explicitly.
- For non-trivial changes, present a plan (affected files, impact, risks, validation) and wait for approval before implementing; stay within the approved scope.
- Don't refactor unrelated stable code, change folder structure/naming, or add dependencies without approval.
- Don't commit, push, reset, or revert unless asked. Don't read or print `.env` contents without permission.
- Distinguish evidence levels when reporting: static reading vs. mocked tests vs. build/lint vs. real browser/API runs.
- Commit message format: `type: short description`.
