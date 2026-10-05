# DEP-03 build and package upgrade notes

> **Historical status: COMPLETED DEPENDENCY RECORD.** Versions and results are a dated snapshot, not the current verification result.

Date: 2026-08-11

Status: complete.

## Final build stack

- Vite 8.2.1 powers source and built gallery modes.
- Vite's native `resolve.tsconfigPaths` replaces `vite-tsconfig-paths` in source mode.
- esbuild 0.28.2 emits the existing bundled ESM `.mjs` entries and source maps.
- TypeScript 7.0.2 emits the declaration tree through its CLI.
- unbuild, the unreachable Rollup config, Rollup itself, every direct Rollup plugin, and build-only dead utilities were removed.

## Package-output contract

`@pibbl/core` retains `index.mjs` and `types.mjs` runtime entries. Declaration targets now use `.d.ts` plus an internal declaration tree instead of unbuild's flattened `.d.mts` files. Production source specifiers include `.js`, so the emitted graph resolves under both Bundler and NodeNext. Package builds also emit `.mjs.map` files with source content.

The `playground/package-consumer` fixture checks:

- public value and type imports from `@pibbl/core`;
- the type-only `@pibbl/core/types` export;
- strict TypeScript 7 resolution under Bundler and NodeNext;
- Node ESM loading and the complete 22-name public runtime export set.

## Source-versus-built proof

Source mode uses root TypeScript aliases. Built mode disables those aliases and Vite tsconfig-path resolution. A Vite guard fails if built mode loads anything under `packages/core/src`, so both the browser test and gallery must consume `packages/core/dist/index.mjs` through package exports.

The same `baseline-smoke` scenario and same headless test passed in both modes. Both actual screenshots had SHA-256 `ffcfdf8f838f685939c825ca7c4a5c0a6dcc667ea89300c7e1df26379c0eccb3` and passed the established exact-outside-glyph-masks rule.

## Verification

| Check                         | Result                                                       |
| ----------------------------- | ------------------------------------------------------------ |
| Clean package build           | Pass; ESM, declarations, and source maps emitted.            |
| Bundler consumer              | Pass with `skipLibCheck: false`.                             |
| NodeNext consumer             | Pass with `skipLibCheck: false`.                             |
| Node runtime import           | Pass; 22 expected public exports.                            |
| Source gallery build          | Pass; 54 modules transformed.                                |
| Built gallery build           | Pass; 14 modules transformed and source guard stayed silent. |
| Source headless smoke         | Pass.                                                        |
| Built headless smoke          | Pass.                                                        |
| Full browser suite            | 10 files; 71 passed and 4 skipped.                           |
| Typecheck and lint            | Pass.                                                        |
| Manual source/built galleries | Both passed mount, update, coordinate click, and reset.      |
