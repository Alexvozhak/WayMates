// @ts-check

import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';


export default defineConfig(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Отлавливает избыточные async функции без await
      '@typescript-eslint/require-await': 'error',
      // Дополнительные полезные правила для TypeScript
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  // Менее строгие правила для тестовых файлов
  {
    files: ['**/*.test.ts', '**/*.test.js', '**/tests/**/*.ts', '**/tests/**/*.js'],
    rules: {
      // В тестах разрешаем неиспользуемые переменные (для моков, заглушек)
      '@typescript-eslint/no-unused-vars': 'warn',
      // В тестах разрешаем any (для гибкости тестирования)
      '@typescript-eslint/no-explicit-any': 'off',
      // В тестах разрешаем async без await (для тестовых функций)
      '@typescript-eslint/require-await': 'warn',
    },
  },
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '*.js',
      '*.mjs',
    ],
  },
);
