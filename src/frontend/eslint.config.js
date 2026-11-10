import { relative, resolve, sep, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

const sourceRoot = fileURLToPath(new URL('./src/', import.meta.url))
const jsxLayers = new Set(['app', 'views', 'components', '__tests__'])
const uiLayers = ['app', 'views', 'components', 'hooks']
const forbiddenLayers = {
  views: ['app'],
  components: ['app', 'views'],
  hooks: ['app', 'views', 'components'],
  graphics: uiLayers,
  math: uiLayers,
  services: uiLayers,
  repositories: uiLayers,
  sync: uiLayers,
  lib: uiLayers,
  configs: uiLayers,
  utils: uiLayers,
}
const layerOf = filename => relative(sourceRoot, filename).split(sep)[0]

const frontendLayers = {
  meta: {
    schema: [],
    messages: {
      jsx: 'Place .tsx files in app, views, components, or __tests__.',
      dependency: '{{from}} cannot import {{to}}. Import from the layer that owns the contract.',
      reactInGraphics: 'React and React Three Fiber belong in the UI layer. Keep graphics independent of React.',
    },
  },
  create(context) {
    const filename = context.physicalFilename
    const from = layerOf(filename)

    function checkImport(source) {
      if (from === '__tests__' || typeof source?.value !== 'string') return
      const specifier = source.value
      if (from === 'graphics' && /^(?:react|react-dom|@react-three\/[^/]+)(?:\/|$)/.test(specifier)) {
        context.report({ node: source, messageId: 'reactInGraphics' })
      }
      if (!specifier.startsWith('.')) return
      const to = layerOf(resolve(dirname(filename), specifier))
      if (
        to === '__tests__'
        || forbiddenLayers[from]?.includes(to)
        || (from === 'types' && to !== 'types')
      ) {
        context.report({ node: source, messageId: 'dependency', data: { from, to } })
      }
    }

    return {
      Program(node) {
        if (filename.endsWith('.tsx') && !jsxLayers.has(from)) {
          context.report({ node, messageId: 'jsx' })
        }
      },
      ImportDeclaration: node => checkImport(node.source),
      ExportNamedDeclaration: node => checkImport(node.source),
      ExportAllDeclaration: node => checkImport(node.source),
      ImportExpression: node => checkImport(node.source),
    }
  },
}

export default defineConfig([
  globalIgnores(['dist', '.agents/**']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/graphify-out/**'],
    plugins: { architecture: { rules: { 'frontend-layers': frontendLayers } } },
    rules: {
      'architecture/frontend-layers': 'error',
    },
  },
])
