// @ts-check
import antfu from '@antfu/eslint-config';

export default antfu(
  {
    type: 'lib',
    stylistic: {
      indent: 2,
      semi: true,
      quotes: 'single',
    },
    formatters: {
      html: false,
      markdown: true,
      css: true,
    },
    ignores: [
      '**/fixtures/**',
      '**/vendor/**',
      '**/test/out/**',
    ],
  },
  {
    rules: {
      'no-restricted-syntax': 'off',
      'ts/no-invalid-this': 'off',
      'ts/consistent-type-imports': 'off',
      'ts/explicit-function-return-type': 'off',
      'prefer-template': 'off',
      'style/operator-linebreak': ['error', 'after', {
        overrides: {
          '&': 'before',
          '|': 'before',
        },
      }],
      'antfu/if-newline': 'off',
      'style/brace-style': ['error', '1tbs', {
        allowSingleLine: true,
      }],
    },
  },
  {
    files: ['playground/**/*.([cm])?[jt]s(x)?'],
    rules: {
      'ts/explicit-function-return-type': 'off',
    },
  },
  {
    files: ['pnpm-workspace.yaml'],
    rules: {
      'pnpm/yaml-enforce-settings': 'off',
      'pnpm/yaml-no-unused-catalog-item': 'off',
    },
  },
  {
    files: [
      'packages/core/**/*.ts',
    ],
    ignores: [
      '**/*.test.ts',
    ],
  },
);
