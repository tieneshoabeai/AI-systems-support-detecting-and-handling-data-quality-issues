import { defineConfig, loadEnv, mergeConfig } from 'vite'
import appConfig from './vite.config.ts'

export default defineConfig(({ mode }) => {
  // Only public API configuration reaches the browser. E2E_TEST_* stays in Node.
  const env = loadEnv(mode, process.cwd(), 'VITE_API_')
  return mergeConfig(appConfig, {
    // The dedicated loopback E2E server uses HTTP; requests still reach the configured BE.
    envDir: false,
    define: {
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(env['VITE_API_BASE_URL'] ?? ''),
      'import.meta.env.VITE_API_PREFIX': JSON.stringify(env['VITE_API_PREFIX'] ?? ''),
    },
  })
})
