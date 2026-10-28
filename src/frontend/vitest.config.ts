import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Test dùng config/fixture giả, không nạp file env của máy người dùng.
  envDir: false,
  test: {
    environment: 'jsdom',
    include: ['src/__tests__/**/*.test.{ts,tsx}'],
    clearMocks: true,
    restoreMocks: true,
    unstubEnvs: true,
  },
})
