import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Runs the measurement harnesses under .agents/ without adding them to the shipped suite
// (vitest.config.ts only includes src/__tests__). From src/frontend:
//   npx vitest run --config .agents/dataset-3d-core/captures/vitest.measure.config.ts
export default defineConfig({
  envDir: false,
  test: {
    // test.root resolves against the working directory, so pin it to src/frontend instead.
    root: fileURLToPath(new URL('../../../', import.meta.url)),
    environment: 'jsdom',
    include: ['.agents/dataset-3d-core/captures/*.measure.ts'],
    // These harnesses sample thousands of vertices from the real scene graph; 5s is the
    // default and it is not enough on a loaded machine.
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
})
