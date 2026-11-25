import { defineConfig } from '@playwright/test'

const baseURL = 'http://127.0.0.1:4173'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  outputDir: '.agents/testing-e2e/results',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: '.agents/testing-e2e/report', open: 'never' }],
  ],
  use: {
    baseURL,
    // Exercise the real compact layout; API tests do not benchmark the 3D renderer.
    viewport: { width: 960, height: 900 },
    deviceScaleFactor: 1,
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
    colorScheme: 'dark',
    // Live login traffic contains credentials and tokens; never retain network traces.
    trace: 'off',
    screenshot: 'only-on-failure',
    video: 'off',
    serviceWorkers: 'block',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium', channel: 'chromium' } }],
  webServer: {
    command: 'yarn dev:e2e',
    url: `${baseURL}/auth/login`,
    // Do not silently attach to an unrelated application on the dedicated E2E port.
    reuseExistingServer: false,
  },
})
