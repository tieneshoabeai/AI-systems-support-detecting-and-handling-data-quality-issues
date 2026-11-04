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
    // "luân phiên" chết ở 5000ms (5/1/6 lần đỏ). Tuần tự xanh 6/6 ở đúng timeout mặc định.
    // isolate:false (6/7/4) và maxThreads:2 (1/1/3) đã đo và loại. Chi phí thời gian thì CHƯA đo
    // được: 47-81 s lúc máy nhàn, 160-195 s lúc máy swap, nên mỗi con số chỉ là một buổi đo và
    // phép A/B trên cùng một máy nhàn vẫn nợ (change-log §7.8). Cái mua được là kết quả tất định.
    fileParallelism: false,
  },
})
