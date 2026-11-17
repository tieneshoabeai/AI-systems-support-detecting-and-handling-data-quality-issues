# FE lint remediation

## Approved scope

- Remove @stylistic/semi and @stylistic/comma-dangle. Both semicolon spellings and trailing-comma choices are now permitted by these rules.
- Fix remaining FE application/test lint issues.
- Exclude only src/mocks/**, src/services/preview/preview-fixtures.ts and src/services/preview/preview-worst-case.ts for this task. Test files remain in scope. No permanent ignore or suppression was added for mock data.
- User explicitly approved preserving three diagnostic logs with line-local lint exceptions: fallback glass warning, Three.js console forwarding, and opt-in glassPerf profiler output. Added exactly three documented eslint-disable-next-line no-console comments; the global rule remains enabled.

## Implementation

- All source mutations used apply_patch. ESLint fixes were computed in memory, filtered to the approved scope, reviewed and applied as patches; ESLint did not write source directly.
- Applied quote/spacing/indentation fixes and removed unnecessary casts. Testing Library element types are specified with supported generic arguments.
- Awaited Promise-returning operations in tests. Event handlers keep their existing error handling while returning void; clipboard handling catches both synchronous API access failures and Promise rejection. Router navigation rejection is reported through the browser error channel.
- Async test adapters explicitly return Promise values/rejections where their contracts require them. Their synchronous setup factories retain synchronous return values.
- Marked receiver-independent callback contracts this:void, including local factory methods that only use closures. No receiver-dependent class methods were relabeled.
- Added graphics/typed-objects.ts to narrow Three drawable generics and validate uniform values before calling methods. Resource disposal order is retained, including InstancedMesh disposal.
- Test JSON and userData reads now use small shape validators rather than propagating any. The resource validator still returns the original input objects/array after validating their contract fields.
- Excluded data files were not rewritten or formatted. Backend, dependencies and compiler strictness were not changed.

## Dark rendering source protection

Before formatting the dark environment source, normalized strict-read syntax was verified against both original hashes in .agents/light-environment/baseline.json. Both matched. A canonical TypeScript printer representation (including comments and rendering expressions, with uniform string-literal spelling) was then hashed before formatting. These derived hashes and the original hashes are retained in dark-source-baseline.json. The test now compares canonical source to that pre-format baseline, so whitespace/quote edits do not require accepting arbitrary rendering changes. The original baseline file was not edited.

## Validation

- Scoped ESLint before the three user-approved log exceptions: 299 files, 0 errors, 3 no-console warnings. Final scoped check after exceptions: 299 files, 0 errors, 0 warnings. Two installed Stylistic rules also print deprecation notices; no version changes were made.
- TypeScript: tsc -b passes with all existing strict options enabled.
- yarn build: passes; existing large-chunk warning remains.
- Final full tests: 49 files pass, 4 fail; 676 tests pass and the same 9 preexisting geometry/fingerprint tests fail (holographic-towers, model-fingerprint, orbit-clearance and spool-core). Dark source preservation passes against the pre-format canonical baseline.
- git diff --check: passes after final formatting.
- No browser/WebGL visual validation or target-device performance measurement was performed.

Reproduce the scoped lint check from src/frontend:

```sh
yarn lint --ignore-pattern 'src/mocks/**' --ignore-pattern 'src/services/preview/preview-fixtures.ts' --ignore-pattern 'src/services/preview/preview-worst-case.ts'
```

Full unfiltered lint may still report issues in the explicitly excluded files; scoped success does not claim those files are clean.

## Cleanup and review

Temporary patch planners are removed before handoff. This report and the pre-format test baseline remain under .agents/lint-fe. The Codex review panel is requested for the FE working-tree diff; unrelated existing changes are retained and no commit is made.

The dark-source-baseline.json file is a required fixture for light-environment.test.ts; transfer it with the corresponding test changes.
