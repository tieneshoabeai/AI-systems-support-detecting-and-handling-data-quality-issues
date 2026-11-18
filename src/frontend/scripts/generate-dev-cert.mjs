import { existsSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const directory = resolve(root, 'certs')
mkdirSync(directory, { recursive: true })
if (existsSync(resolve(directory, 'localhost-key.pem')) || existsSync(resolve(directory, 'localhost.pem'))) {
  throw new Error('Existing certificate/key found; no files overwritten. Set DEV_HTTPS_KEY and DEV_HTTPS_CERT to use your trusted certificate.')
}
const executable = process.env.OPENSSL_BIN || 'openssl'
const result = process.platform === 'win32' && !process.env.OPENSSL_BIN
  ? spawnSync('pwsh', ['-NoProfile', '-File', resolve(root, 'scripts/generate-dev-cert.ps1')], { stdio: 'inherit' })
  : spawnSync(executable, [
  'req', '-x509', '-newkey', 'rsa:2048', '-sha256', '-nodes', '-days', '30',
  '-keyout', 'localhost-key.pem', '-out', 'localhost.pem', '-subj', '/CN=localhost',
  '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1,IP:::1',
], { cwd: directory, stdio: 'inherit' })
if (result.error) throw result.error
if (result.status !== 0) process.exit(result.status ?? 1)
console.log('Created a local development certificate. It is not automatically trusted by your browser. Use a trusted development certificate for browser validation.')
