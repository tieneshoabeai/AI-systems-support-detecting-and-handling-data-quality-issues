# Batch 5 — Shopping Demo browser and WebGL plan for review

## Application Overview

PLANNING ONLY; no specs generated or native E2E run. Sole approved origin http://127.0.0.1:4173; project chromium; approved commands yarn dev:e2e and yarn test:e2e --project=chromium. MCP-owned Vite DEV server started successfully from envDir:false config. Existing Shopping Demo adapter and browser-only data, no real backend. Each scenario starts with a fresh browser context and explicit /auth/login?demo=shopping activation; context disposal is cleanup. Use only demo fixture values displayed by app/approved seed, never .env, auth.json, real account or storage-state files; do not print credential/token values. One test per named spec, stable semantic locators, no sleeps, no application changes. Observed: wrong demo password stays login and shows Email hoặc mật khẩu không chính xác; successful login reaches /processing; Shopping Trends route has 3900 rows/18 columns; Data View opens after focus, full records link reaches /records; records has 50 rows/page, 78 pages; Detection shows progress then 448 findings on 390 rows; closing completed Detection opens review dialog. Console had zero errors and two unclassified warnings, which is not proof of shader/image correctness. Not explored: logout/direct unauthenticated route, WebGL-disabled branch, actual canvas picks, review submission/persistence/failure, theme/attached/detached image stability. Cases marked CONDITIONAL need focused source/observed UI confirmation before generator claims them ready; do not invent missing guards. Server-confirmation/intercept memo N/A for Axios demo adapter: no real network write or backend acknowledgment; verify actual per-context demo storage when authorized. Do not intercept imaginary API endpoints. Native scan prerequisite identified by parent: e2e-reviewer scan.sh finds Node>=22 only in fixed system prefixes; Node26 currently NVM-only, so scanner gate not ready until separately resolved. Do not install/symlink/change host configuration. Visual candidates require Human approval; no automatic baseline acceptance. App defects encountered later must be reported, not fixed to satisfy tests.

## Test Scenarios

### 1. Demo authentication and routing

**Seed:** `tests/e2e/seed.spec.ts`

#### 1.1. Reject empty or invalid login input without opening the workbench

**File:** `tests/e2e/auth/invalid-login-input.spec.ts`

**Steps:**
  1. Fresh context: open /auth/login?demo=shopping and wait until the named login form is visibly usable.
    - expect: Only the local demo form is active; no authenticated workbench is visible.
  2. Submit empty fields, then an invalid email with a nonempty password using associated labels.
    - expect: Native required/email validation rejects the input; URL remains /auth/login and no workbench heading appears. Do not assert an adapter call count that browser cannot observe.

#### 1.2. Reject an incorrect demo password and retain a usable login form

**File:** `tests/e2e/auth/rejected-demo-login.spec.ts`

**Steps:**
  1. Fresh context: open demo login and use the displayed demo email with a deliberately wrong test password.
    - expect: Form is usable; submit through the exact Đăng nhập button.
  2. Submit the login.
    - expect: Alert Email hoặc mật khẩu không chính xác appears; URL remains login; authenticated account controls are absent.
  3. Correct the password using the approved displayed demo fixture.
    - expect: Successful subsequent login reaches /processing; rejection did not permanently disable the form.

#### 1.3. Restore the authenticated demo session on a protected project reload

**File:** `tests/e2e/auth/restore-demo-session.spec.ts`

**Steps:**
  1. Fresh context: open demo login and authenticate with its displayed fixture.
    - expect: URL reaches /processing and Demo Analyst account control is visible.
  2. Open Mở Shopping Trends and wait for heading Shopping Trends and dataset metadata.
    - expect: URL is /processing/projects/shopping-trends; metadata shows 3900 rows and 18 columns.
  3. Reload the protected URL.
    - expect: The same project and authenticated account are restored rather than the login form; no credentials are asserted or printed.

#### 1.4. Logout blocks subsequent direct access to the protected project

**File:** `tests/e2e/auth/logout-protected-route.spec.ts`

**Steps:**
  1. Fresh context: log in to demo and open the Shopping Trends project.
    - expect: Project heading is visible.
  2. Click the observed Đăng xuất demo control; directly navigate to the protected project path.
    - expect: Login form replaces private content; project controls are absent. Verify final return-target behavior against the actual router rather than guessing its query shape.

### 2. Project data navigation

**Seed:** `tests/e2e/seed.spec.ts`

#### 2.1. Open Data View after scene focus and navigate to the full records page

**File:** `tests/e2e/records/open-full-records.spec.ts`

**Steps:**
  1. Fresh context: authenticate and open Shopping Trends. Click Data View.
    - expect: Wait for the named Data View complementary panel; this is an observable focus-completion outcome, not a hard delay.
  2. Inspect the Bảng dữ liệu shopping region in the panel.
    - expect: Table contains ten data rows plus its header; known first-record cells agree with the existing CSV data; no fake processed-success state appears.
  3. Follow Xem đầy đủ 3.900 dòng →.
    - expect: URL ends /records and heading Shopping Trends — toàn bộ dữ liệu appears; ← Về Project returns to the same project.

#### 2.2. Paginate and search records without changing the original dataset

**File:** `tests/e2e/records/paginate-and-search.spec.ts`

**Steps:**
  1. Fresh context: authenticate and navigate to the full Shopping Trends records page.
    - expect: 3900 matching rows, page 1/78, 50 data rows and disabled previous button.
  2. Click Trang sau in the Phân trang dữ liệu navigation.
    - expect: Page changes to 2/78 and original CSV row numbers change from 1–50 to 51–100; previous is enabled.
  3. Search for a deliberately absent value, then clear the search.
    - expect: Empty-state message appears with zero data rows; clearing restores the original count/data. Search is read-only; verify unaffected original record values, not only a page label.

### 3. Detection and review

**Seed:** `tests/e2e/seed.spec.ts`

#### 3.1. Cancel pending demo Detection without creating reviewed results

**File:** `tests/e2e/detection/cancel-pending-detection.spec.ts`

**Steps:**
  1. CONDITIONAL timing/control verification: fresh demo login, project, then click Detection.
    - expect: Observe region Tiến trình Detection with progressbar before completion; no final findings/saved-success yet.
  2. Close or switch module while pending using the actual available cancellation path; use Playwright clock only after confirming timer setup semantics.
    - expect: Pending run is cancelled as implemented; reopening does not resurrect an old completion. Do not assert missing duplicate-request guards or imaginary backend calls.

#### 3.2. Require a review before closing completed Detection and restore the saved review

**File:** `tests/e2e/detection/review-validation-and-persistence.spec.ts`

**Steps:**
  1. Fresh context: authenticate, open Detection, wait for observed 448 findings on 390 rows.
    - expect: Progress state ends; review action becomes visible. Download processed result remains disabled before review save.
  2. Attempt to close the completed Detection panel.
    - expect: Observed dialog Đánh giá trước khi lưu kết quả opens and the module remains present.
  3. Submit without stars/comment; then choose stars and submit whitespace-only comment.
    - expect: Validation is visible and the dialog remains open; no reviewed-success/download state is acknowledged.
  4. CONDITIONAL submission verification: enter a valid review and save.
    - expect: Confirm actual demo persistence boundary before success claims; dialog closes only after demo save resolves. Reload in the same context to verify reviewed state remains. Verify raw records remain unchanged. This is local demo persistence, not backend confirmation.

#### 3.3. Preserve the entered review when demo storage rejects saving

**File:** `tests/e2e/detection/review-storage-rejection.spec.ts`

**Steps:**
  1. CONDITIONAL source/fixture verification: use a fresh context and only block the exact demo result storage write after successful login; do not block all Storage writes.
    - expect: No real backend or unrelated auth/preferences storage is affected.
  2. Complete Detection and enter a valid review, then save while that scoped storage write fails.
    - expect: An error is shown, no success or enabled processed download appears, review text/stars remain available.
  3. Remove only the injected failure and retry.
    - expect: Saved state is observable after the actual demo storage operation succeeds; raw dataset witness is unchanged. Pending/duplicate-submit assertions are included only if an actual async guard exists in this demo path.

### 4. WebGL and visual review

**Seed:** `tests/e2e/seed.spec.ts`

#### 4.1. Keep login usable when WebGL cannot initialize

**File:** `tests/e2e/graphics/login-webgl-fallback.spec.ts`

**Steps:**
  1. CONDITIONAL browser fixture: fresh context, suppress WebGL/WebGL2 context creation before app scripts using the approved browser API boundary only. Open demo login.
    - expect: Login form becomes visible and usable without waiting forever for scene readiness; no uncaught page exception. Canvas existence is not the assertion.
  2. Authenticate using the displayed demo fixture.
    - expect: Workbench is reachable despite renderer unavailability. This verifies degradation, not normal shader rendering.

#### 4.2. Select a project module and return to the overview after scene focus

**File:** `tests/e2e/graphics/project-focus-and-reset.spec.ts`

**Steps:**
  1. Fresh demo login: open Shopping Trends and wait for the Dataset 3D region and available module controls.
    - expect: No fallback status is present; record console/page errors during the transition. This alone is not proof of correct image output.
  2. Click Data View; wait for its complementary panel; click Về góc tổng quan.
    - expect: Panel/focus state returns to overview according to observed UI. Confirm control state rather than styling-class names.
  3. CONDITIONAL actual canvas picking and detach: use a verified visible target/location or accessible legend selection only after observation; toggle Tách mô hình and reverse it.
    - expect: Expected selection/panel and attached/detached control transitions occur. Camera/world numeric assertions require a supported observable interface; do not invent globals or use unverified click coordinates.

#### 4.3. Capture stable light and dark attached and detached scene candidates for Human review

**File:** `tests/e2e/graphics/visual-review-candidates.spec.ts`

**Steps:**
  1. CONDITIONAL visual prerequisite: establish reproducible scene-ready signal, font loading, animation time/randomness, fixed Chromium/OS/GPU/viewport before capture.
    - expect: Document what is controlled and what remains variable; absence of page errors is insufficient to establish rendering correctness.
  2. Capture dark/light and attached/detached scene candidates under .agents/testing-e2e/visual-candidates using observed controls.
    - expect: Candidate images and console/shader diagnostics are available for Human inspection; no automatically accepted screenshot snapshots.
  3. Ask Human to approve the intended appearance before creating toHaveScreenshot baselines.
    - expect: Until approval and a stable capture strategy exist, visual regression is NOT complete. Do not hide renderer regions or set broad image tolerance to force green.
