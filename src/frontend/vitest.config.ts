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
    // Máy 4 nhân CPU thật / 8 GB RAM đang swap gần hết: 27 file jsdom tranh CPU nên một test
    // "luân phiên" chết ở 5000ms (5/1/6 lần đỏ). Tuần tự xanh 6/6 ở đúng timeout mặc định
    // (160-195 s, đổi lấy +80 s). isolate:false (6/7/4) và maxThreads:2 (1/1/3) đã đo và loại.
    fileParallelism: false,
  },
})
