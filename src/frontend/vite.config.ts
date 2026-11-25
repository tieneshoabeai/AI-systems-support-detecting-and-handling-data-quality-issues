import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    {
      name: 'offline-application-shell',
      apply: 'build',
      generateBundle: {
        order: 'post',
        handler(_options, bundle) {
          const files = Object.keys(bundle).filter(file => !file.endsWith('.map'))
          const html = bundle['index.html']
          const version = createHash('sha256').update(files.sort().join('\n')).update(html?.type === 'asset' ? html.source : '').digest('hex').slice(0, 16)
          // Only static build assets enter CacheStorage. Account data stays in scoped IndexedDB.
          this.emitFile({ type: 'asset', fileName: 'offline-shell.js', source: `
const cacheName = 'dataverse-shell-${version}';
const base = new URL('./', self.registration.scope);
const files = ${JSON.stringify([...files, 'favicon.svg', 'icons.svg'])};
const urls = new Set(files.map(file => new URL(file, base).href));
const shell = new URL('index.html', base).href;
self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll([...urls])));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('dataverse-shell-') && key !== cacheName).map(key => caches.delete(key)))));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== base.origin) return;
  if (request.mode === 'navigate' && url.pathname.startsWith(base.pathname) && !url.pathname.startsWith(base.pathname + 'api/')) {
    event.respondWith(fetch(request).catch(() => caches.open(cacheName).then(cache => cache.match(shell)).then(response => response || Response.error())));
  } else if (urls.has(url.href)) {
    event.respondWith(caches.open(cacheName).then(cache => cache.match(request, { ignoreVary: true })).then(response => response || fetch(request)));
  }
});
` })
        },
      },
    },
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
