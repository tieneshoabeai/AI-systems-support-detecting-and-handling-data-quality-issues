import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import { viteApiTargetControl } from './scripts/vite-api-target-control.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    viteApiTargetControl(),
    {
      name: 'local-https',
      config(config, { command, mode }) {
        // Preview is intentionally HTTP; HTTPS certificates are only needed for dev serve.
        const isPreview = process.argv.includes('preview')
        if (command !== 'serve' || config.envDir === false || isPreview) return {}
        if (process.env['DEV_HTTPS']?.trim().toLowerCase() === 'false') return {}
        const env = loadEnv(mode, process.cwd(), '')
        const keyPath = resolve(env['DEV_HTTPS_KEY'] || 'certs/localhost-key.pem')
        const certPath = resolve(env['DEV_HTTPS_CERT'] || 'certs/localhost.pem')

        // Keep preview/dev startup usable when certificates have not been generated.
        let https: { key: Buffer; cert: Buffer } | undefined
        try {
          https = { key: readFileSync(keyPath), cert: readFileSync(certPath) }
        } catch {
          return {}
        }

        return {
          server: { host: config.server?.host ?? 'localhost', port: config.server?.port ?? 5173, strictPort: true, https },
          preview: { host: config.preview?.host ?? 'localhost', port: config.preview?.port ?? 4173, strictPort: true, https },
        }
      },
    },
  ],
})
