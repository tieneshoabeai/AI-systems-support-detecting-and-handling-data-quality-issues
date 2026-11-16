# App architecture refactor

## Agreed scope

Use the existing app/constants, context, provider, pages/public, pages/private,
guards and router directories. Do not replace them with a feature architecture.
Require a session for Management, Processing and Dataset 3D in development and
production. Unknown URL 404 is public; missing private resources are checked
after the route guard. Preserve authenticated/local-limited access policy.

## Mapping

- Move app/app-providers.tsx to app/provider/app-providers.tsx; fix relative imports.
- Move app/layout.tsx to app/pages/private/workspace-page.tsx and name it WorkspacePage.
- Keep AuthProvider implementation in context; keep AuthContext shared with hooks.
- Keep main, bootstrap and runtime factory separate: DOM entry selection, instance
  creation/HMR cleanup, and dependency/resource lifecycle respectively.
- Add public LoginPage and NotFoundPage entries using existing UI.
- Add private page entries for Dataset 3D, Management, Processing, Project Workspace
  and Shopping Records; lazy imports remain per-page.
- Add application route path constants and explicit barrels. app/index excludes
  main and application-bootstrap to avoid triggering startup on public API import.
- Remove the empty provider/...temp placeholder. Preserve the prepared folders.
- Update affected consumer tests and frontend/app/views documentation.

## Behavior changes

- main no longer selects a development WorkbenchEntry that bypasses auth runtime.
- WorkbenchRoutes has no protect=false option; private routes always use ProtectedRoute.
- Dataset 3D is guarded; return-target validation accepts its exact registered path.
- Public unknown URLs show the shared NotFoundView through NotFoundPage.
- Missing project shows its message only after session validation.
- The separate /preview/workspaces-3d development tool is unchanged; it is distinct
  from the private /workspaces/3d-dataset route.
- Management/Processing still use fixtures: requiring a session does not connect
  their business operations to backend APIs.

## Validation

- Baseline: TypeScript clean; 7 relevant test files, 120 tests passed.
- Final production build (yarn build) passes, with the existing large-chunk warning.
- Final TypeScript project build passes.
- ESLint passes on app and affected/new test files. Stylistic prints two existing
  deprecated-rule notices; no rule was disabled to accommodate the refactor.
- Full suite: 50 files pass, 4 fail; 690 tests pass, 9 fail (699 total).
- Failing files: holographic-towers, model-fingerprint, orbit-clearance and spool-core.
  These are geometry/material snapshot failures outside this task; no baseline
  assertions were changed. This task recorded a focused, not full-suite, baseline.
- After separating the authenticated test fixture into the existing test support
  directory, reran the four affected routing/theme/entry suites: 53 tests passed.
- Static dependency scan: 257 non-test source TS/TSX files; no missing relative
  module imports or static runtime cycles detected. This does not prove absence
  of all dynamic runtime cycles.
- git diff --check passes.

## Limitations

Tests mock transport and scenes; real-server authentication, browser rendering
and WebGL visuals were not checked. Existing unrelated working-tree edits were
preserved. No dependencies changed and no commit was created.
