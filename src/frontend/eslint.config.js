import { relative, resolve, sep, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import js from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
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

// Migration checks are warnings until consumers move to the Design System.
// Native controls remain valid inside UI implementations and test fixtures.
const designSystemMigration = {
  meta: {
    schema: [],
    messages: {
      nativeControl: 'Migrate <{{tag}}> to the corresponding Design System control in an approved batch.',
      uiDependency: 'Design System UI cannot import {{specifier}}. Pass domain data and callbacks through props.',
      domainDependency: 'Domain components must access services and repositories through hooks.',
    },
  },
  create(context) {
    const filename = context.physicalFilename
    const segments = relative(sourceRoot, filename).split(sep)
    const isUi = segments[0] === 'components' && segments[1] === 'ui'
    const isDomain = segments[0] === 'components' && !['ui', 'graphics'].includes(segments[1])
    const allowedUiLayers = new Set(['styles', 'utils', 'types'])

    function checkImport(source) {
      if (typeof source?.value !== 'string') return
      const specifier = source.value
      if (isUi && /^(?:three|@react-three\/[^/]+)(?:\/|$)/.test(specifier)) {
        context.report({ node: source, messageId: 'uiDependency', data: { specifier } })
        return
      }
      if (!specifier.startsWith('.')) return
      const target = relative(sourceRoot, resolve(dirname(filename), specifier)).split(sep)
      const isUiTarget = target[0] === 'components' && target[1] === 'ui'
      const isUiHook = target[0] === 'hooks' && target[1] === 'ui'
      if (isUi && !isUiTarget && !isUiHook && !allowedUiLayers.has(target[0])) {
        context.report({ node: source, messageId: 'uiDependency', data: { specifier } })
      }
      if (isDomain && ['services', 'repositories'].includes(target[0])) {
        context.report({ node: source, messageId: 'domainDependency' })
      }
    }

    return {
      ImportDeclaration: node => checkImport(node.source),
      ExportNamedDeclaration: node => checkImport(node.source),
      ExportAllDeclaration: node => checkImport(node.source),
      ImportExpression: node => checkImport(node.source),
      JSXOpeningElement(node) {
        if (segments[0] === '__tests__' || isUi) return
        const tag = node.name.type === 'JSXIdentifier' ? node.name.name : null
        if (['button', 'input', 'textarea', 'select'].includes(tag)) {
          context.report({ node, messageId: 'nativeControl', data: { tag } })
        }
      },
    }
  },
}

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
  // OpenAPI outputs are generated; handwritten adapters remain fully linted.
  globalIgnores(['dist', '.agents/**', 'src/lib/openapi.ts', 'src/types/services-type/**']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommendedTypeChecked,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    rules: {
      'no-console': 'warn',
      'no-lonely-if': 'warn',
      '@stylistic/no-trailing-spaces': 'warn',
      '@stylistic/no-multi-spaces': 'warn',
      '@stylistic/no-multiple-empty-lines': 'warn',
      '@stylistic/space-before-blocks': ['error', 'always'],
      '@stylistic/object-curly-spacing': ['warn', 'always'],
      '@stylistic/indent': ['warn', 2],
      '@stylistic/quotes': ['error', 'single'],
      '@stylistic/array-bracket-spacing': ['warn', 'never'],
      '@stylistic/keyword-spacing': 'warn',
      '@stylistic/comma-spacing': 'warn',
      '@stylistic/arrow-spacing': 'warn',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
    },
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: fileURLToPath(new URL('.', import.meta.url)),
      },
    },
    plugins: { '@stylistic': stylistic },
  },
  {
    files: ['vite.config.ts', 'vite.e2e.config.ts', 'vitest.config.ts', 'playwright.config.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/graphify-out/**'],
    plugins: { architecture: { rules: {
      'frontend-layers': frontendLayers,
      'design-system-migration': designSystemMigration,
    } } },
    rules: {
      'architecture/frontend-layers': 'error',
      'architecture/design-system-migration': 'warn',
    },
  },
])
