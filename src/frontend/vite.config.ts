import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    {
      name: 'local-https',
      config(config, { command, mode }) {
        // The isolated E2E configuration owns its server; production builds need no key.
        if (command !== 'serve' || config.envDir === false) return {}
        const env = loadEnv(mode, process.cwd(), '')
        const server = { host: config.server?.host ?? 'localhost', port: config.server?.port ?? 5173, strictPort: true }
        const preview = { host: config.preview?.host ?? 'localhost', port: config.preview?.port ?? 4173, strictPort: true }
        // Opt into HTTP for local UI review without installing a trusted certificate.
        if (env['DEV_HTTPS'] === 'false') return { server, preview }
        const https = {
          key: readFileSync(resolve(env['DEV_HTTPS_KEY'] || 'certs/localhost-key.pem')),
          cert: readFileSync(resolve(env['DEV_HTTPS_CERT'] || 'certs/localhost.pem')),
        }
        return {
          server: { ...server, https },
          preview: { ...preview, https },
        }
      },
    },
  ],
})
