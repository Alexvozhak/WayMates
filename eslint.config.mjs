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
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',

      // === Simplicity Rules (docs/eslint_simplicity_rules.md) ===

      // Spread operator разрешён (изменено по требованию)
      // 'no-restricted-syntax': [...] - удалено

      // Ограничение вложенности (максимум 2 уровня)
      'max-depth': ['error', 2],

      // Ограничение циклической сложности
      'complexity': ['error', { max: 8 }],

      // Ограничение длины функций
      'max-lines-per-function': [
        'error',
        {
          max: 60,
          skipBlankLines: true,
          skipComments: true,
        },
      ],

      // === Code Organization Rules ===

      // Порядок членов в классах и интерфейсах
      '@typescript-eslint/member-ordering': [
        'error',
        {
          default: [
            // Статические свойства и методы
            'static-field',
            'static-method',

            // Поля
            'field',

            // Конструктор
            'constructor',

            // Публичные методы
            'public-method',

            // Приватные методы
            'protected-method',
            'private-method',
          ],
        },
      ],
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
      'scripts/**/*.js',
    ],
  },
);
