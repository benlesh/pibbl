import babelParser from '@babel/eslint-parser';
import js from '@eslint/js';
import globals from 'globals';
import { defineConfig, globalIgnores } from 'eslint/config';

const codeRules = {
  ...js.configs.recommended.rules,
  eqeqeq: ['error', 'smart'],
  'no-console': ['error', { allow: ['warn', 'error'] }],
  'no-empty': ['error', { allowEmptyCatch: true }],
  'no-unused-vars': ['error', {
    args: 'after-used',
    argsIgnorePattern: '^_',
    caughtErrors: 'none',
    ignoreRestSiblings: true,
    vars: 'all',
    varsIgnorePattern: '^_',
  }],
  'object-shorthand': ['error', 'always'],
  'prefer-const': ['error', { destructuring: 'all', ignoreReadBeforeAssign: true }],
};

const typescriptRules = {
  ...codeRules,
  // TypeScript owns these checks. Babel parses current TS syntax without
  // introducing a second, version-gated TypeScript scope implementation.
  'constructor-super': 'off',
  'getter-return': 'off',
  'no-class-assign': 'off',
  'no-const-assign': 'off',
  'no-dupe-args': 'off',
  'no-dupe-class-members': 'off',
  'no-dupe-keys': 'off',
  'no-func-assign': 'off',
  'no-import-assign': 'off',
  'no-new-native-nonconstructor': 'off',
  'no-new-symbol': 'off',
  'no-obj-calls': 'off',
  'no-redeclare': 'off',
  'no-setter-return': 'off',
  'no-this-before-super': 'off',
  'no-undef': 'off',
  'no-unreachable': 'off',
  'no-unsafe-negation': 'off',
  'no-unused-vars': 'off',
  'no-var': 'off',
  'prefer-const': 'off',
};

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    // Preserved design experiments are archival deliverables, not runtime/tooling source.
    'output/brand/pibbl-distinctiveness-studies/**',
    'output/brand/pibbl-loading-study/**',
    'output/brand/pibbl-tangram*/**',
    'packages/text/.cache/**',
    '**/dist/**',
    // Website build copies compiled Pibbl and upstream WASM loaders here.
    'website/public/generated/**',
    '**/.studio-docs-acceptance-dist/**',
    '**/.nx/**',
    '**/.vite/**',
    '**/*.d.ts',
    '**/*.d.mts',
    '**/*.d.cts',
    '**/fixtures/**',
    '**/vendor/**',
    '**/test/out/**',
    // Generated texture benchmark preview bundles.
    'tooling/texture-wasm-spike/bundle.js',
    'tooling/texture-wasm-spike/*-bundle.js',
    'tooling/texture-wasm-spike/optimized.mjs',
  ]),
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: { ...globals.browser, ...globals.node },
      sourceType: 'module',
    },
    rules: codeRules,
  },
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: { ...globals.browser, ...globals.node },
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          babelrc: false,
          configFile: false,
          parserOpts: {
            plugins: ['typescript', 'jsx'],
          },
        },
      },
      sourceType: 'module',
    },
    rules: typescriptRules,
  },
  {
    // Preserve the approved, hash-checked choreography snapshot byte for byte.
    files: ['output/brand/pibbl-big-bubbles/animation/loader/motion.mjs'],
    rules: { 'no-unused-vars': 'off', 'prefer-const': 'off' },
  },
]);
