# Tech stack inventory — FE

Snapshot và kết quả validation: [README](../README.md), [testing-results](testing-results.md). Chỉ dùng công nghệ tìm thấy ở FE manifest/config/consumer.

| Hạng mục | Công nghệ thực tế | File bằng chứng từ repo root | Trạng thái |
|---|---|---|---|
| Frontend Framework | React / React DOM | `src/frontend/package.json`, `src/frontend/src/app/main.tsx` | SOURCE |
| Build Tool | Vite + React plugin + Babel React Compiler | `src/frontend/vite.config.ts` | SOURCE; build mới UNVERIFIED |
| Programming Language | TypeScript strict | `src/frontend/tsconfig.app.json`, `src/frontend/tsconfig.node.json` | Typecheck PASS |
| Styling | CSS, CSS Modules, custom properties | `src/frontend/src/styles/tokens.css`, `src/frontend/src/views/preview/preview.css` | SOURCE |
| State Management | React state/context + external stores; QueryClient infrastructure | `src/frontend/src/hooks/preview/use-preview-store.ts`, `src/frontend/src/lib/query-client.ts` | SOURCE; management không tự dùng query cache |
| Routing | React Router | `src/frontend/src/app/router/workbench-routes.tsx` | SOURCE/mock tests |
| API Communication | Axios, explicit auth, JSON/Blob | `src/frontend/src/lib/axios-client.ts` | SOURCE; live UNVERIFIED |
| Authentication | Session coordinator, bearer, sessionStorage | `src/frontend/src/services/auth/session-coordinator.ts`, `src/frontend/src/lib/session-storage.ts` | MOCK-TESTED |
| Local persistence | Dexie / IndexedDB drafts | `src/frontend/src/repositories/datasets/upload-draft.database.ts` | Source/mock persistence tests |
| Graphics | Three.js / R3F | `src/frontend/package.json`, `src/frontend/src/views/dataset-3d/dataset-3d.view.tsx` | SOURCE; WebGL UNVERIFIED |
| Generated contracts | openapi-typescript, generator, aliases | `src/frontend/scripts/generate-swagger-types.mjs`, `src/frontend/src/types/services-type/index.ts` | PARTIAL; payload schema/consumer gap |
| Testing | Vitest, Testing Library, jsdom, fake-indexeddb | `src/frontend/vitest.config.ts`, `src/frontend/package.json` | Scoped 315 PASS |
| Browser E2E | Playwright Chromium demo specs | `src/frontend/playwright.config.ts`, `src/frontend/tests/e2e/` | Specs tồn tại, chưa chạy lượt mới |
| Deployment | Static build script; hosting config chưa tìm thấy | `src/frontend/package.json` | Build script SOURCE; live UNVERIFIED |

Tailwind/MUI/Redux/Zustand và FE PM2/Docker/Nginx/CI pipeline: không tìm thấy bằng chứng tương ứng trong inventory đã khảo sát; không đưa vào stack như hiện trạng. Các công nghệ nằm ở BE không được suy thành dependency FE.
