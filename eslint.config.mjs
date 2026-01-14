import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import importX from 'eslint-plugin-import-x';
import unicorn from 'eslint-plugin-unicorn';
import eslintConfigPrettier from 'eslint-config-prettier';

export default [
  // Global ignores
  {
    ignores: [
      'src/chart/browser/**', // Browser runtime - compiled by esbuild, not subject to Node.js rules
    ],
  },

  eslint.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  unicorn.configs.recommended,
  importX.flatConfigs.recommended,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },

    rules: {
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'default',
          format: ['camelCase'],
          leadingUnderscore: 'allow',
        },
        {
          selector: 'variable',
          format: ['camelCase', 'UPPER_CASE'],
          leadingUnderscore: 'allow',
        },
        {
          selector: 'function',
          format: ['camelCase']
        },
        {
          selector: 'parameter',
          format: ['camelCase'],
          leadingUnderscore: 'allow',
        },
        {
          selector: 'typeLike',
          format: ['PascalCase'],
        },
        {
          selector: 'enumMember',
          format: ['PascalCase'],
        },
        {
          selector: 'import',
          format: null,  // Don't check imports (external libraries)
        },
        {
          selector: 'property',
          format: null,
          modifiers: ['requiresQuotes']
        },
        {
          // Allow snake_case for Zod enum .Values (phases, intents, node names)
          selector: 'property',
          format: ['camelCase', 'snake_case', 'UPPER_CASE'],
        }
      ],

      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'separate-type-imports',
          disallowTypeAnnotations: true,
        },
      ],
      '@typescript-eslint/no-import-type-side-effects': 'error',
      '@typescript-eslint/array-type': [
        'error',
        {
          default: 'array',
          readonly: 'array',
        },
      ],
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],

      'import-x/no-unresolved': 'off',
      'import-x/namespace': 'off',
      'import-x/default': 'off',
      'import-x/no-named-as-default': 'off',
      'import-x/no-named-as-default-member': 'off',
      'import-x/no-cycle': 'off',

      'import-x/no-duplicates': [
        'error',
        {
          'prefer-inline': false,
        },
      ],
      'import-x/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
            'type',
          ],
          'newlines-between': 'always',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
          named: {
            enabled: true,
            types: 'types-first',
          },
        },
      ],
      'import-x/extensions': [
        'error',
        'always',
        {
          ignorePackages: true,
        },
      ],
      'import-x/no-default-export': 'error', // Forbid default export
      'import-x/prefer-default-export': 'off',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ExportAllDeclaration',
          message: 'Re-export all (export * from) is forbidden. Use named exports.',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error', // Forbid any completely
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': 'allow-with-description',
          'ts-ignore': false,
          minimumDescriptionLength: 10,
        },
      ],
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: true,
        },
      ],
      '@typescript-eslint/no-floating-promises': [
        'error',
        {
          ignoreVoid: true,
          ignoreIIFE: true,
        },
      ],
      '@typescript-eslint/no-misused-promises': [
        'error',
        {
          checksVoidReturn: true,
          checksConditionals: true,
        },
      ],
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-deprecated': 'error', // Forbid deprecated API
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        {
          assertionStyle: 'never', // Forbid 'as' casts - use type guards or Zod
        },
      ],
      '@typescript-eslint/no-unnecessary-type-assertion': 'error', // Remove unnecessary assertions
      '@typescript-eslint/await-thenable': 'error', // await only on Promise (catches erroneous awaits)

      'max-depth': ['error', 2],
      complexity: ['error', { max: 8 }],
      'no-unreachable': 'error', // Forbid unreachable code after return/throw/break/continue
      'no-nested-ternary': 'error', // Forbid nested ternary operators
      'max-lines-per-function': [
        'error',
        {
          max: 60,
          skipBlankLines: true,
          skipComments: true,
        },
      ],

      '@typescript-eslint/member-ordering': [
        'error',
        {
          default: [
            'static-field',
            'static-method',
            'field',
            'constructor',
            'public-method',
            'protected-method',
            'private-method',
          ],
        },
      ],


      'unicorn/prevent-abbreviations': 'off', // Allow abbreviations
      'unicorn/no-null': 'off', // Neo4j driver requires null
      'unicorn/no-array-reduce': 'warn', // Warn instead of error
      'unicorn/no-array-for-each': 'off', // forEach is more readable for side effects
      'unicorn/no-await-expression-member': 'off', // Allow (await foo()).bar
      'unicorn/numeric-separators-style': 'warn', // Warn for small numbers, recommend for large (1_000_000)
    },
  },

  // Relaxed rules for tests
  {
    files: ['private/tests/**/*.ts', 'vitest.config.ts'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'max-lines-per-function': 'off',
      'import-x/no-default-export': 'off',
      '@typescript-eslint/naming-convention': 'off',
      'import-x/order': 'off',
      'unicorn/numeric-separators-style': 'off',
    },
  },

  // Telegram Bot - allow snake_case for Telegram API properties
  {
    files: ['src/telegram-bot/**/*.ts'],
    rules: {
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'default', format: ['camelCase'], leadingUnderscore: 'allow' },
        { selector: 'variable', format: ['camelCase', 'UPPER_CASE'], leadingUnderscore: 'allow' },
        { selector: 'function', format: ['camelCase'] },
        { selector: 'parameter', format: ['camelCase'], leadingUnderscore: 'allow' },
        { selector: 'typeLike', format: ['PascalCase'] },
        { selector: 'enumMember', format: ['PascalCase'] },
        { selector: 'import', format: null },
        { selector: 'property', format: null, modifiers: ['requiresQuotes'] },
        // Allow snake_case for Telegram/grammY API (parse_mode, reply_markup, etc.)
        // Allow UPPER_CASE for env variables (TELEGRAM_BOT_TOKEN, etc.)
        { selector: 'property', format: ['camelCase', 'snake_case', 'UPPER_CASE'] },
      ],
    },
  },

  // Must be last - disables ESLint rules that conflict with Prettier
  eslintConfigPrettier,
];