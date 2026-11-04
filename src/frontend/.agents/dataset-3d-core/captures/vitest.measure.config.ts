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
  },
})
