## Review Summary

| Sev | Count | Top Issue | Affected Files |
| --- | --- | --- | --- |
| P0 | 0 | None confirmed | None |
| P1 | 0 | None confirmed | None |
| P2 | 0 | None confirmed | None |

No catalog findings confirmed in the implemented scope. Validation is **not complete**: the standalone helper scan is INCOMPLETE and the remaining recorded scenarios are unimplemented.

## Review Scope and Evidence

- **Mode:** full mode; evidence route: semantic review, limited to the three implemented specs and their helper/config.
- **Behavior under review:** Shopping Demo readiness, rejected-login recovery, and appearance preference changes/persistence. The original recording is a requirements inventory, not runtime proof for the rewrite.
- **Diff base/range:** supplied original recording versus rewritten seed; new spec files are untracked. No reliable original Git base exists for these files.
- **Changed E2E artifacts:** `tests/e2e/seed.spec.ts`, `tests/e2e/support/demo.ts`, `tests/e2e/auth/rejected-demo-login.spec.ts`, `tests/e2e/appearance/theme-preferences.spec.ts`, `playwright.config.ts`, `vite.e2e.config.ts`, E2E TypeScript config.
- **Context-only files consulted:** protected route and workbench routes; login view scene-readiness logic; PreviewSession theme surface; `use-preview-color-scheme.ts`; preview mock service and demo storage; project workspace view. No environment file or captured session was read.
- **Static evidence:** individual bundled scanner v3.5.3 invocations and exact summaries are in `conversion-status.md`; no project ESLint execution. TypeScript and diff whitespace checks passed. Scope framework is proven by `@playwright/test` imports. Config uses one Chromium project, no storage state, the approved literal base URL, and `reuseExistingServer:false`. Scanner reports nested declaration observations, not effective ESLint coverage; manual config inspection and native runner selection resolve the intended runner/origin, without converting scanner limitations to clean results.
- **Runtime evidence:** seed repeated 3/3 PASS; three implemented specs 3/3 PASS, 0 skips. Commands, durations and the MCP/native differential are recorded in `conversion-status.md`.
- **Independent verification:** V1 outcomes executed; V5 seed three-run result and three-test suite result only. V2/V3/V6 not executed. V4 backend writes N/A for these client-only scenarios.
- **Limitations/exclusions:** helper standalone scan exit 2 remains INCOMPLETE (unsupported provenance at form fills); manual Page/Locator tracing does not clear that result. Eight remaining recorded groups, actual picking, image/shader correctness and backend persistence are unverified. No whole-B clearance.

## Static evidence

- `tests/e2e/auth/rejected-demo-login.spec.ts:11` — FALSE-POSITIVE #14: intentionally incorrect password; successful login uses only the displayed fixture.
- `tests/e2e/auth/rejected-demo-login.spec.ts:16` — FALSE-POSITIVE #4i: the same logout locator has a positive assertion at line 22 in the same test.
- `tests/e2e/support/demo.ts:19` — FALSE-POSITIVE #5a sweep candidate: missing displayed input throws; no promised assertion is conditionally bypassed.
- `tests/e2e/support/demo.ts:27` and `:28`: scanner provenance unsupported, no source-linked task IDs emitted; manual trace establishes the typed Page and form Locator but the scan remains INCOMPLETE.
- #1: 3/3 files; Processing heading/link, rejection alert/recovery, and mutually exclusive preference plus resolved theme/reload outcomes match the titles.
- #2: 3/3 files; each promised state transition has meaningful postconditions.
- #3: 3/3 files and imported helper; no catch path suppresses actions/assertions.
- #12: 3/3 files; login is explicit per fresh context. Wrong/login surfaces cannot satisfy the private workspace heading. Config supplies no hidden session dependency.
- #13: 3/3 files; positive setup reuses login helper; intentional rejected-login path owns its own form interaction. No established same-page POM is bypassed.
- #20: 3/3 files; demo login is handled by the existing demo adapter, theme preference uses localStorage, no uncontrolled backend mutation.
- #21: 3/3 files and config; no storageState/session file dependency.
- #22: 3/3 files; no backend promise. Theme storage is local-only and the real document reload asserts its value and resolved theme.
- #23: 3/3 files; no injected list fixture/empty-state claim. Demo activation precedes form use; protected-route and theme render guards were inspected.
- #11: helper members have clear fixture/navigation responsibilities. Project helper is retained for the explicitly planned remaining B scenarios, not claimed exercised by these three tests.

Required bounded opening-token sweeps, across implemented specs and helper:

| ID | Hits / disposition |
| --- | --- |
| #3b | N/A (Playwright) |
| #3 | 0 |
| #5a | 1 throwing fixture validation guard; no bypass |
| #7 | 0, including one-hop aliases and wrapped destructuring |
| #9b | N/A (Playwright) |
| #9c | 0 |
| #19 | 0 module-level mutable test containers |
| #10b | 0 |
| #10d | N/A (Playwright) |
| #4a | 0 |
| #4f | 0 |
| #4i | 1; same-test positive locator witness as above |
| #4k | 0; appearance loop iterates three literal options, not an unproven DOM collection |
| #11c | 0 |
| #10c | 27 role calls; all named targets exact or locator-scoped; unnamed roles bounded by relevant text |
| #18 | 0 |
| #4g | N/A (Cypress query-command sweep) |
| #5b | 0 force options, including variable options |
| #9 | 0 sleeps |
| #10f | N/A (Playwright) |
| #17 | 0 Page selector APIs or renamed Page fixture actions |
| #8b | 0 discarded boolean checks |
| #15 | 0 floating web-first assertions |
| #16 | 14 action/navigation lines, all awaited |

Real P0 = 0 confirmed distinct source lines in this reviewed scope. This is a bounded semantic result, not scanner completion or proof for unimplemented scenarios.
