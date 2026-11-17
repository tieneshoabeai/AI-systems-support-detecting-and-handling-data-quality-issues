# Recorded seed conversion — option B

Scope: frontend Shopping Demo only, approved origin `http://127.0.0.1:4173`, Chromium, disposable browser contexts. Original recording is retained in `recordings/seed-original.txt`. This file is an execution ledger, not a completion claim.

## Current implementation

- `tests/e2e/seed.spec.ts`: authenticated Processing readiness only.
- `tests/e2e/support/demo.ts`: displayed demo fixture, explicit login and project navigation helpers; no manually captured session.
- `tests/e2e/auth/rejected-demo-login.spec.ts`: wrong password rejection followed by successful correction in the same form.
- `tests/e2e/appearance/theme-preferences.spec.ts`: all three mutually exclusive preferences, resolved surface theme, unchanged workspace and System persistence after reload.
- Remaining recorded groups: management navigation/sidebar/pagination; workspace and CSV project creation; records; Detection and review; notifications/reset; reports and attachment; preferences/profile undo; logout.
- Canvas picking and screenshot acceptance remain separate, unverified graphics work. Semantic module selection does not prove raycasting or rendered image correctness.

## Native readiness diagnosis

The official generator setup intermittently failed while the login page still showed its 3D loading status and no login form after 15 seconds. No product code or timeout was changed during this diagnosis.

`yarn test:e2e --project=chromium tests/e2e/seed.spec.ts:5 --list` selected exactly one Chromium test.

`yarn test:e2e --project=chromium tests/e2e/seed.spec.ts:5 --repeat-each=3 --retries=0`:

- Sandbox attempt: Vite could not listen (`EPERM`), no test outcome.
- Approved execution outside sandbox: **3 passed**, durations 12.8s, 5.1s, 5.5s; total 30.6s.
- Classification: **UNCLEAR / not reproduced in the native three-run check**. This does not prove the earlier MCP failure fixed or absent.
- Subsequent official generator setup succeeded in 14.8s. Generation resumed.
- The following official setup for management failed again with the same missing form after 15s (seed total 26.5s). Generation is blocked at the official setup prerequisite; no product or timing change was made.
- The failed setup exposed no active page to `browser_close`; it returned `Must setup test before interacting with the page`.

Independent native validation of the three existing specs then completed:

`yarn test:e2e --project=chromium tests/e2e/seed.spec.ts tests/e2e/auth/rejected-demo-login.spec.ts tests/e2e/appearance/theme-preferences.spec.ts`

**3 passed, 0 failed, 0 skipped** in 24.3s: appearance 12.3s, rejected-login recovery 4.2s, seed 4.3s. The runner owned and stopped its Vite server. This confirms these three tests, not the ungenerated B scenarios or MCP lifecycle.

## Static checks so far

E2E TypeScript compilation and `git diff --check` passed for the current files.

Bundled reviewer scanner v3.5.3, no project ESLint execution:

- Seed, appearance spec (including its resolved-theme assertions), Playwright config, Vite E2E config: `scan exit=0` each.
  `Summary: 0 total hit(s), 0 P0, 0 P1/P2 heuristic, 0 LLM-triage, 0 P0 candidate; 0 AST-origin hit(s), canonical retained findings.`
- Auth rejection spec: `scan exit=0`.
  `Summary: 2 total hit(s), 0 P0, 0 P1/P2 heuristic, 2 LLM-triage, 0 P0 candidate; 2 AST-origin hit(s), canonical retained findings.`
  - `tests/e2e/auth/rejected-demo-login.spec.ts:11` — FALSE-POSITIVE #14: deliberately invalid password for rejection; positive login reads the displayed demo fixture.
  - `tests/e2e/auth/rejected-demo-login.spec.ts:16` — FALSE-POSITIVE #4i: the same logout locator is positively asserted at line 22 after recovery.
- Standalone helper: `scan exit=2`, **INCOMPLETE**, unsupported provenance in actions and form fills at lines 27–28. No source-linked analysis task was emitted. Manual inspection establishes Page/Locator bindings, but does not turn this scanner result into COMPLETE. No helper rewrite was made solely to satisfy the scanner.
  `Summary [INCOMPLETE]: 0 total hit(s), 0 P0, 0 P1/P2 heuristic, 0 LLM-triage, 0 P0 candidate; 0 AST-origin hit(s), canonical retained findings.`

The scanner requires a system-prefix Node. An explicitly approved symlink at `/usr/local/bin/node` points to the existing NVM Node 26.7.0; no package was installed for that change.

## Limits

**B is incomplete.** Remaining scenarios have not been generated or run because the required MCP setup repeatedly fails. The helper scanner result also remains INCOMPLETE. No backend persistence, screenshot baseline, shader image correctness, actual canvas picking, V2/V3 mutation probe or independent V6 review is claimed. Existing unrelated changes are retained; no commit or push.

Proposed continuation for Human review: keep the passing seed/auth/theme tests and the current product visuals, author remaining recorded groups with integrated `apply_patch` using the original recording plus source contracts, then verify them with the approved native Chromium runner. This substitutes source/native validation for the unavailable official interactive generation; it requires explicit approval to depart from that skill prerequisite. It does not claim MCP exploration for those groups.
