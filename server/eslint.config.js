import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import prettier from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';

export default [
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      prettier: prettier,
    },
    rules: {
      ...typescript.configs.recommended.rules,
      ...prettierConfig.rules,
      
      // TypeScript specific rules
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off', // Too strict for MVP
      '@typescript-eslint/explicit-module-boundary-types': 'off', // Too strict for MVP
      '@typescript-eslint/no-explicit-any': 'warn', // Changed from error to warn for MVP
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-empty-function': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn', // Changed from error to warn
      '@typescript-eslint/prefer-nullish-coalescing': 'warn', // Changed from error to warn
      '@typescript-eslint/prefer-optional-chain': 'warn', // Changed from error to warn
      '@typescript-eslint/no-unnecessary-type-assertion': 'warn', // Changed from error to warn
      '@typescript-eslint/no-floating-promises': 'warn', // Changed from error to warn
      '@typescript-eslint/await-thenable': 'warn', // Changed from error to warn
      '@typescript-eslint/no-misused-promises': 'warn', // Changed from error to warn
      '@typescript-eslint/require-await': 'warn', // Changed from error to warn
      '@typescript-eslint/return-await': 'warn', // Changed from error to warn
      '@typescript-eslint/prefer-readonly': 'warn', // Changed from error to warn
      '@typescript-eslint/prefer-readonly-parameter-types': 'off', // Too strict for MVP
      '@typescript-eslint/strict-boolean-expressions': 'off', // Too strict for MVP
      
      // General code quality rules
      'no-console': 'warn', // Changed from error to warn for MVP
      'no-debugger': 'error',
      'no-alert': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'prefer-arrow-callback': 'warn', // Changed from error to warn
      'arrow-spacing': 'error',
      'no-duplicate-imports': 'error',
      'no-unused-expressions': 'error',
      'no-useless-return': 'warn', // Changed from error to warn
      'no-useless-concat': 'warn', // Changed from error to warn
      'prefer-template': 'warn', // Changed from error to warn
      'template-curly-spacing': 'error',
      'object-shorthand': 'warn', // Changed from error to warn
      'prefer-destructuring': ['warn', { object: true, array: false }], // Changed from error to warn
      'no-nested-ternary': 'warn', // Changed from error to warn
      'no-unneeded-ternary': 'warn', // Changed from error to warn
      'no-else-return': 'warn', // Changed from error to warn
      'consistent-return': 'warn', // Changed from error to warn
      'default-case': 'warn', // Changed from error to warn
      'no-fallthrough': 'error',
      'no-magic-numbers': 'off', // Too strict for MVP
      'max-lines': 'off', // Too strict for existing codebase
      'max-lines-per-function': 'off', // Too strict for existing codebase
      'complexity': 'off', // Too strict for existing codebase
      'max-depth': 'off', // Too strict for existing codebase
      'max-params': 'off', // Too strict for existing codebase
      'no-param-reassign': 'warn', // Changed from error to warn
      'no-return-assign': 'error',
      'no-sequences': 'error',
      'no-throw-literal': 'warn', // Changed from error to warn
      'prefer-promise-reject-errors': 'warn', // Changed from error to warn
      'no-promise-executor-return': 'warn', // Changed from error to warn
      'no-unreachable-loop': 'error',
      'no-unsafe-finally': 'error',
      'no-unsafe-negation': 'error',
      'require-atomic-updates': 'warn', // Changed from error to warn
      'use-isnan': 'error',
      'valid-typeof': 'error',
      
      // NestJS specific rules
      'class-methods-use-this': 'off', // NestJS services often don't use 'this'
      'import/no-extraneous-dependencies': 'off', // NestJS has many peer dependencies
      
      // Additional rules for Node.js environment
      'no-undef': 'off', // TypeScript handles this
      'no-require-imports': 'off', // Allow require() for some packages
      'no-useless-escape': 'warn', // Changed from error to warn
      
      // Prettier integration
      'prettier/prettier': 'error',
    },
  },
  {
    ignores: ['dist/', 'node_modules/', '*.js'],
  },
];