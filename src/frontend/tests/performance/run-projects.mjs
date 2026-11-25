import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'

const frontend = fileURLToPath(new URL('../../', import.meta.url))
const env = loadEnv('production', frontend, ['VITE_API_', 'E2E_TEST_'])
const apiOrigin = URL.parse(env.VITE_API_BASE_URL ?? '')
const prefix = env.VITE_API_PREFIX?.trim().replace(/^\/+|\/+$/g, '')
if (apiOrigin?.protocol !== 'https:' || apiOrigin.username || apiOrigin.password
  || apiOrigin.pathname !== '/' || apiOrigin.search || apiOrigin.hash
  || !prefix || !/^[\w-]+(?:\/[\w-]+)*$/.test(prefix)
  || !env.E2E_TEST_EMAIL?.trim() || !env.E2E_TEST_PASSWORD) {
  throw new Error('Thiếu cấu hình HTTPS API hoặc tài khoản E2E hợp lệ.')
}

const run = spawnSync('k6', ['run', 'tests/performance/suites/browser/projects.ts'], {
  cwd: frontend,
  stdio: 'inherit',
  env: {
    ...process.env,
    BASE_URL: 'https://127.0.0.1:4173',
    ALLOW_LOCAL_SELF_SIGNED_CERT: '1',
    ITERATIONS: process.env.ITERATIONS ?? '1',
    PERF_API_ROOT: apiOrigin.origin + '/' + prefix,
    E2E_TEST_EMAIL: env.E2E_TEST_EMAIL,
    E2E_TEST_PASSWORD: env.E2E_TEST_PASSWORD,
  },
})
if (run.error) console.error('Không khởi động được k6. Kiểm tra k6 trong PATH.')
process.exitCode = run.status ?? 1
