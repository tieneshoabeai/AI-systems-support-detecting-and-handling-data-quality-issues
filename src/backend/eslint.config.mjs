// @ts-check
/**
 * ESLint flat config — Data Quality Backend
 *
 * Nguyên tắc cốt lõi (xem edit/03_yeu_cau_chat_luong_code_clean_architecture.md):
 *   - "Mũi tên phụ thuộc luôn hướng vào trong": infrastructure → application → domain
 *   - domain không được chạm framework (NestJS/Mongoose/Kafka/S3…)
 *   - Không `any` — bổ sung cho `test/zero-any.spec.ts`
 *
 * Mức độ nghiêm:
 *   - Nhóm "layer" (CA1, CA2) → `error` ngay: code hiện tại đã đạt.
 *   - Nhóm "coupling" (CA5, CA6–CA9) → `warn`: sẽ siết lên `error` ở Bước 7
 *     sau khi refactor L3a xong.
 */

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

const SRC = 'src/**/*';
const TEST = 'test/**/*';

/** Thư viện hạ tầng/framework — domain & application không được chạm trực tiếp. */
const INFRA_LIBS = [
  '@nestjs/*',
  'mongoose',
  '@aws-sdk/*',
  'kafkajs',
  'socket.io',
  'ioredis',
  'bcrypt',
  'busboy',
  'passport*',
  'express',
];

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      '*.config.js',
      '*.config.mjs',
      '**/*.d.ts',
      // Script JS thuần (k6, benchmark) không thuộc TS project → không lint bằng type-aware rules.
      'test/k6/**',
      'test/benchmark/**',
    ],
  },

  js.configs.recommended,
  tseslint.configs.recommended,

  // ── Type-aware rules ──────────────────────────────────────────────────────
  {
    files: [SRC, TEST],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.eslint.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      // Type safety — anh em của `noImplicitAny` và `test/zero-any.spec.ts`.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-require-imports': 'error',
      '@typescript-eslint/no-empty-object-type': 'error',
      '@typescript-eslint/no-unsafe-declaration-merging': 'error',

      // Chất lượng chung.
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-console': ['warn', { allow: ['warn', 'error', 'log'] }],
      'object-shorthand': 'warn',
      'no-implicit-coercion': 'error',
    },
  },

  // ── CA1: domain không được import framework / tầng ngoài ─────────────────
  {
    files: ['src/modules/*/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                // Tầng trong không được biết tầng ngoài.
                '../application/**',
                '../infrastructure/**',
                '../../application/**',
                '../../infrastructure/**',
                '../../../application/**',
                '../../../infrastructure/**',
                // Framework & hạ tầng.
                ...INFRA_LIBS,
              ],
              message:
                'Tầng domain không được phụ thuộc tầng ngoài hoặc framework (Clean Architecture — Dependency Rule).',
            },
          ],
        },
      ],
    },
  },

  // ── CA2: application không được import infrastructure ────────────────────
  {
    files: ['src/modules/*/application/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '../infrastructure/**',
                '../../infrastructure/**',
                '../../../infrastructure/**',
                'mongoose',
                '@aws-sdk/*',
                'kafkajs',
                'socket.io',
                'ioredis',
                'busboy',
              ],
              message:
                'Tầng application không được import infrastructure hay thư viện hạ tầng (Clean Architecture — Dependency Rule).',
            },
          ],
        },
      ],
    },
  },

  // ── CA5: shared không được biết module nghiệp vụ ─────────────────────────
  // Hiện `shared/events` cần `REALTIME_PORT` (token runtime) để đẩy realtime →
  // đây là vi phạm thật, để `warn` cho tới khi Bước 4 (L3a) tách contract ra `shared/`.
  {
    files: ['src/shared/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'warn',
        {
          patterns: [
            {
              group: [
                '../modules/**',
                '../../modules/**',
                '../*/modules/**',
                '@/modules/**',
              ],
              message:
                'src/shared là lớp cross-cutting, không được phụ thuộc vào module nghiệp vụ cụ thể. Nên import type-only, hoặc chuyển contract sang shared/ports/.',
            },
          ],
        },
      ],
    },
  },

  // ── MM2: cấm deep cross-module import (Modular Monolith) ───────────────
  // Chỉ chặn import sâu vào tầng nội bộ của module KHÁC
  // (domain/application/infrastructure/presentation).
  // Cho phép: import nội bộ cùng module (`../../domain/...`), public contract
  // (`../datasets`), và wiring module NestJS (`../workspaces/workspaces.module`).
  {
    files: ['src/modules/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^\\.\\./(analysis|audit|auth|data-view|datasets|feedback|issues|notifications|overview|projects|realtime|users|workspaces)/(domain|application|infrastructure|presentation)/.+',
              message:
                'Module không được import trực tiếp file của module khác. ' +
                'Chỉ import qua public contract: `../<ten-module>`. (Modular Monolith — MM2)',
            },
            {
              regex: '^\\.\\./\\.\\./(analysis|audit|auth|data-view|datasets|feedback|issues|notifications|overview|projects|realtime|users|workspaces)/(domain|application|infrastructure|presentation)/.+',
              message:
                'Module không được import trực tiếp file của module khác. ' +
                'Chỉ import qua public contract: `../../<ten-module>`. (Modular Monolith — MM2)',
            },
            {
              regex: '^\\.\\./\\.\\./\\.\\./(analysis|audit|auth|data-view|datasets|feedback|issues|notifications|overview|projects|realtime|users|workspaces)/(domain|application|infrastructure|presentation)/.+',
              message:
                'Module không được import trực tiếp file của module khác. ' +
                'Chỉ import qua public contract. (Modular Monolith — MM2)',
            },
          ],
        },
      ],
    },
  },

  // ── Test: nới lỏng ────────────────────────────────────────────────────────
  {
    files: [TEST, 'scripts/**/*'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/consistent-type-imports': 'off',
      'no-console': 'off',
    },
  },

  // Luôn đặt cuối để ghi đè xung đột style với prettier.
  prettier,
);
