# Dataset 3D checkpoint before TaiFE integration — 2026-11-05

Human approved committing and pushing the current Dataset 3D work to ThuongFEAI
before integrating origin/TaiFE. This checkpoint includes source, tests, baselines,
capture harnesses and related review evidence under dataset-3d-core.
Unrelated skill edits, reference-image collections and other untracked files are
not included and must remain untouched.

Before checkpoint: HEAD fdc5ca0c729a6cf009afa522abce5c7d690b28f9.
Reviewed incoming TaiFE: 95aa0eca634e93770c2183f79e09c00c0b5103a6.
Merge base: 78c2cde5c0cf63103957c9ab882aaf6723c78285.

## Validation before commit

- TypeScript build passed.
- Dataset 3D suite: 91 passed, 2 failed, 93 total (28.23 seconds).
- The two existing failures are the backdrop spacing and outer-glass palette
  expectations in spool-core.test.ts; they were present before integration.
- Current outer-glass colour #bcc2c0ff is invalid for Three.js, which warns and
  uses white. Its opacity/roughness/light-map settings and backdrop inset 0.001
  were preserved rather than changed to make the tests green.
- Build and scoped ESLint passed during the preceding UI change.
- Fifteen current baseline image hashes were verified. The module legend browser
  checks passed at 1920, 1280 and 390 px, including keyboard, zoom and detach.
- Outer-glass/orbit intersections 1–3 remain pending a separate plan.

## Integration boundary

Preserve the current /workspaces/3d-dataset route, graphics/holographic-core,
graphics/neon-cube, views/dataset-3d, relevant types and tests, plus their baselines.
Incoming TaiFE adds a separate development preview at /preview/... and updates
backend modules, infrastructure and documentation.
Preflight merge-tree reported no committed-tree conflicts, and incoming paths did
not overlap local modified/untracked paths. This is not a substitute for runtime
and build verification after the actual merge.

Push this checkpoint before merging. Integrate without automatically committing
or pushing the resulting merge; show the review and verification results first.
