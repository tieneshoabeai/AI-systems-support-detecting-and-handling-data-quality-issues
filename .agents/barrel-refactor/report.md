# Hierarchical barrel refactor — FE

## Scope and status

Applied across the existing frontend layers without moving implementations or changing dependencies. Created 59 explicit public barrels, including services/index.ts and the other layer roots. No src/index.ts. Changed 183 import declarations in 114 existing files. No existing barrels needed updating.

The migration intentionally retains direct imports where aggregates would change eager module evaluation, mock isolation, or lazy loading. It is not a claim that every cross-layer runtime import now uses a layer root. See the complete list below for the 261 initially proposed changes retained on their original paths; existing same-module imports, bootstrap/dynamic entries and assets are additional deliberate exclusions.

## How to use

- Prefer named imports from a layer root when doing so preserves the consumer's loading boundary.
- Use a domain barrel within that layer, or a documented direct entry, where the layer root would load unrelated modules.
- Within a domain keep direct imports, never import its own root barrel.
- Use export type/import type for type-only contracts; no export-star barrels.
- Do not re-export startup main.tsx/application-bootstrap.tsx, CSS, assets or test files.
- Keep existing dynamic imports and their vi.mock targets unchanged.
- Isolated route barrels views/application, views/dataset-3d and views/processing are intentionally not re-exported by views/index.ts.
- CurrentUser from types/users remains CurrentUser; the different preview type is exported as PreviewCurrentUser. Consumers retain their local CurrentUser binding with an import alias.

## Verified results

| Check | Baseline | Final |
| --- | --- | --- |
| TypeScript diagnostics | 1171 | 1171 |
| ESLint errors | 10516 | 10516 |
| ESLint warnings | 4641 | 4631 |
| Full tests | 49 files pass, 4 fail; 676 pass, 9 fail | Same 49 files pass, 4 fail; 676 pass, 9 fail |
| Production command yarn build | Blocked by TypeScript | Blocked by TypeScript |
| Separate Vite bundling | Pass | Pass |
| Static runtime cycles after refactor | None detected in original file graph | None detected |

Baseline Vite bundling was reconstructed in memory from the exact pre-refactor imports, using a temporary pre-transform plugin without rewriting source. The final main entry, application bootstrap, Dataset 3D and React Three Fiber chunks retain the same displayed sizes as baseline (218.46, 249.26, 475.44 and 912.54 kB respectively). This is build evidence, not a browser rendering or performance measurement. A large-chunk warning remains.

The initial aggregate-only migration changed chunk grouping materially; runtime consumers that would acquire unrelated eager module dependencies were returned to smaller entries. This is why not all imports use layer roots, while all layer public barrels are present.

Existing failed test files: holographic-towers, model-fingerprint, orbit-clearance and spool-core under src/__tests__/dataset-3d. Their nine failures existed before this refactor; do not alter their baseline assertions as part of barrel work.

No compiler/lint rules were disabled. No business logic was edited. No source files were renamed. Existing unrelated working-tree changes were preserved.

Final failed test names exactly match baseline. TypeScript retains the same diagnostic counts by code; three first-line messages differ only in the ordering of displayed union members, in addition to expected import-related line-number shifts. Static graph checks do not establish absence of all possible runtime/dynamic cycles. No browser/WebGL visual validation was performed.

## Retained original import paths

These paths preserve evaluation boundaries; tests keep direct implementation targets for isolation. They are explicit exceptions to the preferred root import convention, not missing files.

| Consumer (relative to frontend) | Retained specifier |
| --- | --- |
| `src/__tests__/auth/auth-flow.test.tsx` | `../../app/app-providers` |
| `src/__tests__/auth/auth-flow.test.tsx` | `../../app/app-runtime` |
| `src/__tests__/auth/auth-flow.test.tsx` | `../../lib/query-client` |
| `src/__tests__/auth/auth-flow.test.tsx` | `../../lib/session-storage` |
| `src/__tests__/auth/auth-flow.test.tsx` | `../../repositories/datasets/upload-draft.database` |
| `src/__tests__/auth/auth-flow.test.tsx` | `../../app/router/return-target` |
| `src/__tests__/auth/auth.service.test.ts` | `../../lib/axios-client` |
| `src/__tests__/auth/auth.service.test.ts` | `../../services/auth/auth.service` |
| `src/__tests__/auth/session-coordinator.test.ts` | `../../app/app-runtime` |
| `src/__tests__/auth/session-coordinator.test.ts` | `../../repositories/datasets/upload-draft.database` |
| `src/__tests__/auth/session-coordinator.test.ts` | `../../lib/api-error` |
| `src/__tests__/auth/session-coordinator.test.ts` | `../../lib/session-storage` |
| `src/__tests__/auth/session-coordinator.test.ts` | `../../services/auth/session-coordinator` |
| `src/__tests__/auth/session-services.test.ts` | `../../lib/axios-client` |
| `src/__tests__/auth/session-services.test.ts` | `../../services/auth/auth.service` |
| `src/__tests__/auth/session-services.test.ts` | `../../services/users/users.service` |
| `src/__tests__/auth/session-services.test.ts` | `../../services/health/health.service` |
| `src/__tests__/auth/shopping-demo.test.tsx` | `../../lib/axios-client` |
| `src/__tests__/auth/shopping-demo.test.tsx` | `../../services/auth/auth.service` |
| `src/__tests__/auth/shopping-demo.test.tsx` | `../../services/users/users.service` |
| `src/__tests__/auth/shopping-demo.test.tsx` | `../../mocks/shopping-trends/auth-adapter` |
| `src/__tests__/auth/shopping-demo.test.tsx` | `../../mocks/shopping-trends/data` |
| `src/__tests__/auth/shopping-demo.test.tsx` | `../../hooks/preview/use-shopping-detection` |
| `src/__tests__/auth/shopping-demo.test.tsx` | `../../views/preview/preview-session` |
| `src/__tests__/auth/shopping-demo.test.tsx` | `../../services/preview/preview-mock.service` |
| `src/__tests__/auth/shopping-demo.test.tsx` | `../../views/preview/components/shopping-demo-content` |
| `src/__tests__/auth/upload-draft.repository.test.ts` | `../../configs/upload-draft.config` |
| `src/__tests__/auth/upload-draft.repository.test.ts` | `../../repositories/datasets/upload-draft.database` |
| `src/__tests__/auth/upload-draft.repository.test.ts` | `../../repositories/datasets/upload-draft.repository` |
| `src/__tests__/auth/workbench-return-target.test.ts` | `../../app/router/return-target` |
| `src/__tests__/dataset-3d/cube-connection-focus.test.ts` | `../../graphics/holographic-core/cube-connection-focus` |
| `src/__tests__/dataset-3d/cube-connection-focus.test.ts` | `../../graphics/holographic-core/cube-connection-paths` |
| `src/__tests__/dataset-3d/cube-connection-focus.test.ts` | `../../graphics/holographic-core/cube-label-layout` |
| `src/__tests__/dataset-3d/holographic-bloom-pass.test.ts` | `../../graphics/holographic-core/holographic-bloom-pass` |
| `src/__tests__/dataset-3d/holographic-towers.test.ts` | `../../graphics/holographic-core/holographic-core.model` |
| `src/__tests__/dataset-3d/holographic-towers.test.ts` | `../../graphics/holographic-core/tower-gauge-config` |
| `src/__tests__/dataset-3d/inbound-stream-paths.test.ts` | `../../graphics/holographic-core/inbound-stream-paths` |
| `src/__tests__/dataset-3d/inbound-streams.test.ts` | `../../graphics/holographic-core/holographic-core.model` |
| `src/__tests__/dataset-3d/inbound-streams.test.ts` | `../../graphics/holographic-core/inbound-stream-paths` |
| `src/__tests__/dataset-3d/issue-constellation.test.ts` | `../../graphics/holographic-core/core-visual-config` |
| `src/__tests__/dataset-3d/issue-constellation.test.ts` | `../../graphics/holographic-core/issue-constellation` |
| `src/__tests__/dataset-3d/issue-constellation.test.ts` | `../../graphics/neon-cube/neon-cube.model` |
| `src/__tests__/dataset-3d/issue-constellation.test.ts` | `../../graphics/holographic-core/holographic-core.model` |
| `src/__tests__/dataset-3d/light-environment.test.ts` | `../../graphics/holographic-core/light-environment.config` |
| `src/__tests__/dataset-3d/light-environment.test.ts` | `../../graphics/holographic-core/light-environment` |
| `src/__tests__/dataset-3d/model-fingerprint.test.ts` | `../../graphics/holographic-core/holographic-core.model` |
| `src/__tests__/dataset-3d/orbit-clearance.test.ts` | `../../graphics/holographic-core/holographic-core.model` |
| `src/__tests__/dataset-3d/project-glass-motion.test.ts` | `../../graphics/holographic-core/project-glass-motion` |
| `src/__tests__/dataset-3d/project-glass-pass.test.ts` | `../../graphics/holographic-core/project-glass-pass` |
| `src/__tests__/dataset-3d/spool-core.test.ts` | `../../graphics/holographic-core/core-visual-config` |
| `src/__tests__/dataset-3d/spool-core.test.ts` | `../../graphics/holographic-core/spool-core` |
| `src/__tests__/dataset-3d/support/orbit-clearance.ts` | `../../../graphics/holographic-core/core-visual-config` |
| `src/__tests__/dataset-3d/tower-crowns.test.ts` | `../../graphics/holographic-core/holographic-core.model` |
| `src/__tests__/dataset-3d/tower-crowns.test.ts` | `../../graphics/holographic-core/tower-gauge-config` |
| `src/__tests__/dataset-3d/tower-gauge-data.test.ts` | `../../graphics/holographic-core/tower-gauge-config` |
| `src/__tests__/dataset-3d/tower-gauge-data.test.ts` | `../../graphics/holographic-core/tower-gauge-data` |
| `src/__tests__/dataset-3d/tower-gauge-data.test.ts` | `../../graphics/holographic-core/tower-config` |
| `src/__tests__/dataset-3d/tower-gauge.test.ts` | `../../graphics/holographic-core/holographic-core.model` |
| `src/__tests__/dataset-3d/tower-gauge.test.ts` | `../../graphics/holographic-core/tower-gauge-config` |
| `src/__tests__/dataset-3d/tower-gauge.test.ts` | `../../graphics/holographic-core/tower-gauge-data` |
| `src/__tests__/dataset-3d/tower-picking.test.ts` | `../../graphics/holographic-core/holographic-core.model` |
| `src/__tests__/dataset-3d/tower-picking.test.ts` | `../../graphics/holographic-core/tower-config` |
| `src/__tests__/foundation/api.test.ts` | `../../configs/api.config` |
| `src/__tests__/foundation/api.test.ts` | `../../lib/api-error` |
| `src/__tests__/foundation/api.test.ts` | `../../lib/axios-client` |
| `src/__tests__/foundation/session.test.ts` | `../../lib/session-storage` |
| `src/__tests__/foundation/session.test.ts` | `../../lib/axios-client` |
| `src/__tests__/foundation/session.test.ts` | `../../utils/auth/access-token` |
| `src/__tests__/foundation/startup.test.tsx` | `../../app/app-providers` |
| `src/__tests__/foundation/startup.test.tsx` | `../../lib/query-client` |
| `src/__tests__/foundation/startup.test.tsx` | `../../lib/api-error` |
| `src/__tests__/neon-cube/neon-cube-spec.test.ts` | `../../graphics/neon-cube/neon-cube.model` |
| `src/__tests__/neon-cube/neon-cube.model.test.ts` | `../../graphics/neon-cube/neon-cube.model` |
| `src/__tests__/preview/preview-entry.test.tsx` | `../../services/preview/preview-route` |
| `src/__tests__/preview/preview-entry.test.tsx` | `../../services/preview/preview-mock.service` |
| `src/__tests__/preview/preview-interactions.test.tsx` | `../../views/preview/home-2d.view` |
| `src/__tests__/preview/preview-interactions.test.tsx` | `../../views/preview/workspaces-2d.view` |
| `src/__tests__/preview/preview-interactions.test.tsx` | `../../views/preview/projects-2d.view` |
| `src/__tests__/preview/preview-interactions.test.tsx` | `../../services/preview/preview-mock.service` |
| `src/__tests__/preview/preview-logic.test.tsx` | `../../services/preview/preview-mock.service` |
| `src/__tests__/preview/preview-logic.test.tsx` | `../../views/preview/preview-card` |
| `src/__tests__/preview/preview-logic.test.tsx` | `../../views/preview/components/preview-toaster` |
| `src/__tests__/preview/preview-logic.test.tsx` | `../../views/preview/home-2d.view` |
| `src/__tests__/preview/preview-notifications.test.tsx` | `../../views/preview/notifications-2d.view` |
| `src/__tests__/preview/preview-notifications.test.tsx` | `../../views/preview/preview-data` |
| `src/__tests__/preview/preview-notifications.test.tsx` | `../../services/preview/preview-mock.service` |
| `src/__tests__/preview/preview-notifications.test.tsx` | `../../services/preview/preview-route` |
| `src/__tests__/preview/preview-reports.test.tsx` | `../../views/preview/components/report-center` |
| `src/__tests__/preview/preview-reports.test.tsx` | `../../services/preview/preview-mock.service` |
| `src/__tests__/preview/preview-settings.test.tsx` | `../../views/preview/settings-2d.view` |
| `src/__tests__/preview/preview-settings.test.tsx` | `../../views/preview/preview-data` |
| `src/__tests__/preview/preview-settings.test.tsx` | `../../services/preview/preview-mock.service` |
| `src/__tests__/preview/preview-shell.test.tsx` | `../../views/preview/components/preview-shell` |
| `src/__tests__/preview/preview-shell.test.tsx` | `../../views/preview/preview-data` |
| `src/__tests__/preview/preview-shell.test.tsx` | `../../services/preview/preview-mock.service` |
| `src/__tests__/preview/preview-test-kit.tsx` | `../../views/preview/preview-session` |
| `src/__tests__/preview/preview-test-kit.tsx` | `../../services/preview/preview-mock.service` |
| `src/__tests__/preview/preview-theme.test.tsx` | `../../views/preview/settings-2d.view` |
| `src/__tests__/preview/preview-theme.test.tsx` | `../../hooks/preview/use-preview-color-scheme` |
| `src/__tests__/preview/preview-views.test.tsx` | `../../views/preview/workspaces-2d.view` |
| `src/__tests__/preview/preview-views.test.tsx` | `../../views/preview/projects-2d.view` |
| `src/__tests__/preview/preview-views.test.tsx` | `../../views/preview/home-2d.view` |
| `src/__tests__/preview/preview-views.test.tsx` | `../../views/preview/preview-data` |
| `src/__tests__/preview/preview-views.test.tsx` | `../../services/preview/preview-mock.service` |
| `src/__tests__/preview/preview-worst-case.test.tsx` | `../../views/preview/home-2d.view` |
| `src/__tests__/preview/preview-worst-case.test.tsx` | `../../views/preview/workspaces-2d.view` |
| `src/__tests__/preview/preview-worst-case.test.tsx` | `../../views/preview/projects-2d.view` |
| `src/__tests__/preview/preview-worst-case.test.tsx` | `../../views/preview/notifications-2d.view` |
| `src/__tests__/preview/preview-worst-case.test.tsx` | `../../views/preview/preview-data` |
| `src/__tests__/preview/preview-worst-case.test.tsx` | `../../services/preview/preview-fixtures` |
| `src/__tests__/preview/preview-worst-case.test.tsx` | `../../services/preview/preview-mock.service` |
| `src/__tests__/preview/preview-worst-case.test.tsx` | `../../services/preview/preview-worst-case` |
| `src/__tests__/preview/project-data-actions.test.tsx` | `../../views/preview/components/project-data-actions` |
| `src/__tests__/preview/project-data-actions.test.tsx` | `../../views/preview/components/result-review-dialog` |
| `src/__tests__/preview/project-data-actions.test.tsx` | `../../services/processing/result-review` |
| `src/__tests__/preview/project-data-actions.test.tsx` | `../../services/preview/preview-mock.service` |
| `src/__tests__/preview/resource-avatar.test.tsx` | `../../views/preview/components/resource-avatar` |
| `src/__tests__/preview/resource-avatar.test.tsx` | `../../views/preview/components/resource-avatar-state` |
| `src/__tests__/workspace-3d/connection-geometry.test.ts` | `../../graphics/workspace-3d/connection-geometry` |
| `src/__tests__/workspace-3d/connection-geometry.test.ts` | `../../math/workspace-3d/resource-connection-profile` |
| `src/__tests__/workspace-3d/connection-geometry.test.ts` | `../../math/workspace-3d/resource-layout` |
| `src/__tests__/workspace-3d/connection-geometry.test.ts` | `../../views/workspace-3d/preview-resources` |
| `src/__tests__/workspace-3d/local-csv.test.ts` | `../../math/workspace-3d/local-csv` |
| `src/__tests__/workspace-3d/local-csv.test.ts` | `../../math/workspace-3d/resource-layout` |
| `src/__tests__/workspace-3d/resource-label-policy.test.ts` | `../../math/workspace-3d/resource-label-policy` |
| `src/__tests__/workspace-3d/resource-layout.test.ts` | `../../math/workspace-3d/resource-layout` |
| `src/__tests__/workspace-3d/resource-layout.test.ts` | `../../views/workspace-3d/preview-resources` |
| `src/__tests__/workspace-3d/resource-map.test.tsx` | `../../views/workspace-3d/workspace-3d.view` |
| `src/__tests__/workspace-3d/resource-map.test.tsx` | `../../views/workspace-3d/preview-resources` |
| `src/__tests__/workspace-3d/resource-map.test.tsx` | `../../hooks/workspace-3d/use-scene-motion` |
| `src/__tests__/workspace-3d/resource-navigation.test.ts` | `../../math/workspace-3d/resource-layout` |
| `src/__tests__/workspace-3d/resource-navigation.test.ts` | `../../math/workspace-3d/resource-routing` |
| `src/__tests__/workspace-3d/resource-navigation.test.ts` | `../../math/workspace-3d/resource-camera` |
| `src/__tests__/workspace-3d/resource-navigation.test.ts` | `../../views/workspace-3d/preview-resources` |
| `src/__tests__/workspace-3d/scene-lifecycle.test.tsx` | `../../components/graphics/workspace-3d/resource-scene` |
| `src/__tests__/workspace-3d/scene-lifecycle.test.tsx` | `../../components/graphics/workspace-3d/resource-camera-controller` |
| `src/__tests__/workspace-3d/scene-lifecycle.test.tsx` | `../../math/workspace-3d/resource-layout` |
| `src/__tests__/workspace-3d/scene-lifecycle.test.tsx` | `../../views/workspace-3d/preview-resources` |
| `src/__tests__/workspace-3d/scene-lifecycle.test.tsx` | `../../math/workspace-3d/resource-camera` |
| `src/app/App.tsx` | `./router/app-router` |
| `src/app/App.tsx` | `../components/auth/session-renewal-dialog` |
| `src/app/app-providers.tsx` | `./context/auth-provider` |
| `src/app/app-runtime.ts` | `../lib/axios-client` |
| `src/app/app-runtime.ts` | `../lib/session-storage` |
| `src/app/app-runtime.ts` | `../services/auth/auth.service` |
| `src/app/app-runtime.ts` | `../services/health/health.service` |
| `src/app/app-runtime.ts` | `../services/users/users.service` |
| `src/app/app-runtime.ts` | `../services/auth/session-coordinator` |
| `src/app/app-runtime.ts` | `../repositories/datasets/upload-draft.database` |
| `src/app/app-runtime.ts` | `../repositories/datasets/upload-draft.repository` |
| `src/app/app-runtime.ts` | `../lib/api-error` |
| `src/app/application-bootstrap.tsx` | `../lib/query-client` |
| `src/app/application-bootstrap.tsx` | `../lib/api-error` |
| `src/app/context/auth-provider.tsx` | `../../hooks/auth/auth-context` |
| `src/app/context/auth-provider.tsx` | `../../lib/api-error` |
| `src/app/guards/protected-route.tsx` | `../../hooks/auth/use-auth` |
| `src/app/guards/public-only-route.tsx` | `../../hooks/auth/use-auth` |
| `src/app/layout.tsx` | `../hooks/auth/use-auth` |
| `src/app/main.tsx` | `../services/preview/preview-route` |
| `src/app/main.tsx` | `../mocks/shopping-trends/demo-mode` |
| `src/app/router/app-router.tsx` | `../../hooks/auth/use-auth` |
| `src/app/router/app-router.tsx` | `../../views/auth/login.view` |
| `src/app/router/app-router.tsx` | `../../services/preview/preview-route` |
| `src/app/router/workbench-routes.tsx` | `../../services/preview/preview-route` |
| `src/app/router/workbench-routes.tsx` | `../../hooks/preview/use-preview-store` |
| `src/components/auth/session-renewal-dialog.tsx` | `../../hooks/auth/use-auth` |
| `src/components/graphics/auth-glass/auth-glass.backdrop.tsx` | `../../../graphics/auth-glass/auth-glass.materials` |
| `src/components/graphics/auth-glass/auth-glass.render.ts` | `../../../graphics/auth-glass/auth-glass.config` |
| `src/components/graphics/auth-glass/auth-glass.render.ts` | `../../../graphics/auth-glass/auth-glass.materials` |
| `src/components/graphics/auth-glass/auth-glass.scene.tsx` | `./display-base/display-base` |
| `src/components/graphics/auth-glass/display-base/display-base.review.tsx` | `../../../../graphics/auth-glass/auth-glass.config` |
| `src/components/graphics/auth-glass/display-base/display-base.review.tsx` | `../../../../graphics/auth-glass/auth-glass.geometry` |
| `src/components/graphics/auth-glass/display-base/use-base-environment.ts` | `../../../../graphics/auth-glass/display-base/display-base.lighting` |
| `src/components/graphics/holographic-core/cube-label.tsx` | `../../../graphics/holographic-core/cube-label-layout` |
| `src/components/graphics/holographic-core/cube-label.tsx` | `../../../graphics/holographic-core/cube-label-texture` |
| `src/components/graphics/holographic-core/cube-label.tsx` | `../../../graphics/holographic-core/liquid-glass-pass` |
| `src/components/graphics/holographic-core/holographic-core.decor.tsx` | `../../../graphics/holographic-core/orbit.config` |
| `src/components/graphics/holographic-core/holographic-core.environment.tsx` | `../../../graphics/holographic-core/orbit.config` |
| `src/components/graphics/holographic-core/holographic-core.environment.tsx` | `../../../graphics/neon-cube/neon-cube.cluster` |
| `src/components/graphics/holographic-core/holographic-core.light-environment.tsx` | `../../../graphics/holographic-core/light-environment` |
| `src/components/graphics/holographic-core/holographic-core.scene.tsx` | `../../../graphics/holographic-core/holographic-core.model` |
| `src/components/graphics/holographic-core/holographic-core.scene.tsx` | `../../../graphics/holographic-core/tower-gauge-config` |
| `src/components/graphics/holographic-core/holographic-core.scene.tsx` | `../../../graphics/holographic-core/cube-connection-focus` |
| `src/components/graphics/holographic-core/holographic-core.scene.tsx` | `../../../graphics/holographic-core/liquid-glass-pass` |
| `src/components/graphics/holographic-core/holographic-core.scene.tsx` | `../../../graphics/holographic-core/core-visual-config` |
| `src/components/graphics/holographic-core/holographic-core.scene.tsx` | `../../../graphics/holographic-core/project-glass-pass` |
| `src/components/graphics/holographic-core/holographic-core.scene.tsx` | `../../../graphics/holographic-core/holographic-bloom-pass` |
| `src/components/graphics/holographic-core/holographic-core.scene.tsx` | `../../../graphics/holographic-core/project-glass-profiler` |
| `src/components/graphics/holographic-core/holographic-core.scene.tsx` | `../../../graphics/holographic-core/light-environment.config` |
| `src/components/graphics/workspace-3d/hero-space-hole.tsx` | `../../../graphics/workspace-3d/preview-scene-runtime` |
| `src/components/graphics/workspace-3d/home-universe.tsx` | `../../../graphics/workspace-3d/preview-scene-runtime` |
| `src/components/graphics/workspace-3d/resource-camera-controller.tsx` | `../../../math/workspace-3d/resource-camera` |
| `src/components/graphics/workspace-3d/resource-hardware.tsx` | `../../../math/workspace-3d/resource-connection-profile` |
| `src/components/graphics/workspace-3d/resource-hardware.tsx` | `../../../graphics/workspace-3d/connection-geometry` |
| `src/components/graphics/workspace-3d/resource-scene.tsx` | `../../../math/workspace-3d/resource-layout` |
| `src/components/graphics/workspace-3d/resource-scene.tsx` | `../../../math/workspace-3d/resource-label-policy` |
| `src/components/graphics/workspace-3d/resource-scene.tsx` | `../../../math/workspace-3d/resource-routing` |
| `src/components/graphics/workspace-3d/workspace-universe.tsx` | `../../../graphics/workspace-3d/preview-scene-runtime` |
| `src/graphics/holographic-core/core-visual-config.ts` | `../neon-cube/neon-cube.model` |
| `src/graphics/holographic-core/core-visual-config.ts` | `../neon-cube/neon-cube.cluster` |
| `src/graphics/holographic-core/cube-connection-paths.ts` | `../neon-cube/neon-cube.cluster` |
| `src/graphics/holographic-core/cube-connection-paths.ts` | `../neon-cube/neon-cube.model` |
| `src/graphics/holographic-core/cube-label-layout.ts` | `../neon-cube/neon-cube.cluster` |
| `src/graphics/holographic-core/cube-label-layout.ts` | `../neon-cube/neon-cube.model` |
| `src/graphics/holographic-core/light-environment.ts` | `../neon-cube/neon-cube.cluster` |
| `src/graphics/holographic-core/tower-ring.ts` | `../neon-cube/neon-cube.model` |
| `src/graphics/workspace-3d/connection-geometry.ts` | `../../math/workspace-3d/resource-connection-profile` |
| `src/hooks/auth/use-login.ts` | `../../lib/api-error` |
| `src/hooks/preview/use-preview-session.ts` | `../../services/preview/preview-mock.service` |
| `src/hooks/preview/use-preview-session.ts` | `../../services/preview/preview-route` |
| `src/hooks/preview/use-preview-store.ts` | `../../services/preview/preview-mock.service` |
| `src/lib/axios-client.ts` | `../mocks/shopping-trends/demo-mode` |
| `src/lib/axios-client.ts` | `../mocks/shopping-trends/auth-adapter` |
| `src/lib/session-storage.ts` | `../mocks/shopping-trends/demo-mode` |
| `src/repositories/datasets/upload-draft.repository.ts` | `../../lib/api-error` |
| `src/repositories/datasets/upload-draft.repository.ts` | `../../configs/upload-draft.config` |
| `src/services/auth/auth.service.ts` | `../../lib/api-error` |
| `src/services/auth/session-coordinator.ts` | `../../lib/api-error` |
| `src/services/health/health.service.ts` | `../../lib/api-error` |
| `src/services/preview/preview-fixtures.ts` | `../../mocks/shopping-trends/demo-mode` |
| `src/services/preview/preview-mock.service.ts` | `../../mocks/shopping-trends/demo-mode` |
| `src/services/preview/preview-mock.service.ts` | `../../mocks/shopping-trends/demo-storage` |
| `src/services/users/users.service.ts` | `../../lib/api-error` |
| `src/views/application/application-frame.tsx` | `../../services/preview/preview-route` |
| `src/views/application/application-frame.tsx` | `../preview/preview-session` |
| `src/views/auth/login.view.tsx` | `../../hooks/auth/use-login` |
| `src/views/auth/login.view.tsx` | `../../graphics/auth-glass/auth-glass.config` |
| `src/views/auth/login.view.tsx` | `../../graphics/auth-glass/auth-glass.provider-icons` |
| `src/views/auth/login.view.tsx` | `../../graphics/auth-glass/display-base/display-base.config` |
| `src/views/auth/login.view.tsx` | `../../mocks/shopping-trends/demo-mode` |
| `src/views/dataset-3d/dataset-3d.view.tsx` | `../../components/graphics/holographic-core/holographic-core.scene` |
| `src/views/preview/components/preview-surface.ts` | `../../../services/preview/preview-route` |
| `src/views/preview/components/project-wizard.tsx` | `../../../math/workspace-3d/local-csv` |
| `src/views/preview/components/shopping-demo-banner.tsx` | `../../../mocks/shopping-trends/demo-mode` |
| `src/views/preview/components/shopping-demo-banner.tsx` | `../../../mocks/shopping-trends/demo-storage` |
| `src/views/preview/components/shopping-demo-banner.tsx` | `../../../services/preview/preview-mock.service` |
| `src/views/preview/components/shopping-demo-banner.tsx` | `../../../hooks/auth/auth-context` |
| `src/views/preview/components/shopping-demo-content.tsx` | `../../../mocks/shopping-trends/data` |
| `src/views/preview/components/shopping-demo-content.tsx` | `../../../hooks/preview/use-shopping-detection` |
| `src/views/preview/preview-data.ts` | `../../services/preview/preview-fixtures` |
| `src/views/preview/preview-data.ts` | `../../mocks/shopping-trends/demo-mode` |
| `src/views/preview/preview-entry.tsx` | `../../hooks/preview/use-preview-store` |
| `src/views/preview/preview-session.tsx` | `../../hooks/preview/use-preview-session` |
| `src/views/preview/project-workspace-2d.view.tsx` | `./components/preview-shell` |
| `src/views/preview/project-workspace-2d.view.tsx` | `./components/preview-icons` |
| `src/views/preview/project-workspace-2d.view.tsx` | `./components/preview-primitives` |
| `src/views/preview/project-workspace-2d.view.tsx` | `./components/project-data-actions` |
| `src/views/preview/project-workspace-2d.view.tsx` | `../../mocks/shopping-trends/demo-mode` |
| `src/views/preview/project-workspace-2d.view.tsx` | `../../hooks/preview/use-shopping-detection` |
| `src/views/preview/project-workspace-2d.view.tsx` | `./components/shopping-demo-content` |
| `src/views/preview/project-workspace-2d.view.tsx` | `./components/result-review-dialog` |
| `src/views/preview/project-workspace-2d.view.tsx` | `../../mocks/shopping-trends/data` |
| `src/views/preview/shopping-records.view.tsx` | `./components/shopping-demo-content` |
| `src/views/preview/shopping-records.view.tsx` | `./components/preview-shell` |
| `src/views/preview/shopping-records.view.tsx` | `../../mocks/shopping-trends/demo-mode` |
| `src/views/processing/processing.view.tsx` | `../preview/components/preview-shell` |
| `src/views/processing/processing.view.tsx` | `../preview/components/universe-hero` |
| `src/views/processing/processing.view.tsx` | `../preview/components/recent-projects` |
| `src/views/processing/processing.view.tsx` | `../preview/components/preview-icons` |
| `src/views/workspace-3d/workspace-3d.view.tsx` | `../../math/workspace-3d/resource-layout` |
| `src/views/workspace-3d/workspace-3d.view.tsx` | `../../components/graphics/workspace-3d/resource-scene` |

