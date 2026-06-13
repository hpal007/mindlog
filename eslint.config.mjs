// Flat ESLint config for MindLog — Next.js 15.5 App Router + TypeScript (strict).
//
// eslint-config-next 15.5.x ships only the legacy (.eslintrc) shareable configs,
// so we bridge `next/core-web-vitals` into flat config via FlatCompat. On top of
// that we layer typescript-eslint's recommended preset and a small set of
// high-signal Code-Quality rules (unused vars, prefer-const, empty blocks).
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import tseslint from 'typescript-eslint';

const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

export default tseslint.config(
  // Never lint build output, deps, generated/infra files, or config scripts.
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'coverage/**',
      'supabase/**',
      'scripts/**',
      'next-env.d.ts',
      '**/*.config.*',
    ],
  },

  // Base JS + typescript-eslint recommended (syntax-only, no type-aware program
  // — keeps `npm run lint` fast and free of a full typecheck pass).
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Next.js Core Web Vitals (react-hooks, jsx-a11y, next plugin) via FlatCompat.
  ...compat.extends('next/core-web-vitals'),

  // Explicitly register @next/next as a flat-config plugin so the Next.js build's
  // ESLint detector recognizes it (it doesn't probe through the FlatCompat layer).
  {
    plugins: { '@next/next': nextPlugin },
  },

  // Project-wide rule tuning (high-signal Code-Quality guardrails).
  {
    rules: {
      // Unused vars are an error, but allow intentionally-unused leading-underscore
      // args/vars/caught-errors (a common, readable convention).
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      'prefer-const': 'error',
      // Empty blocks are an error, but an empty catch with an explanatory comment
      // is a legitimate "best-effort, swallow on failure" pattern.
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-console': 'warn',
    },
  },

  // Tests: relax a couple of rules that are noisy and low-value in test code.
  {
    files: ['tests/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);
