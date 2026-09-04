# Task 8 report: public focus API and bundle elimination

> **Historical status: COMPLETED IMPLEMENTATION EVIDENCE.** This dated report is preserved for audit and is not current API guidance.

## Outcome

`@crc/core` now exports `withFocusManagement`,
`withKeyboardNavigation`, and the type-only
`CRCKeyboardNavigationOptions`. No internal manager, candidate, modality, or
directional-boundary types were added to the public surface. Both enhancers
preserve the enhanced element's type, props, style, and key.

The packed consumer now proves the API through strict Bundler and NodeNext
compilation, the `@crc/core/types` compatibility boundary, and a runtime
identity smoke check. The Studio declaration surface and its strict consumer
carry the same approved API.

The focus implementation contains the stable marker
`CRC_FOCUS_MANAGEMENT_V1` in the real duplicate-enhancer error path. The packed
verifier creates minified browser ESM bundles with esbuild and proves the marker
is absent when an application imports only `rect`, but present when it uses
`withFocusManagement`. `render.ts`, `crc.ts`, event registration, and built-in
components have no runtime import from `lib/focus/*`; the optional modules are
reachable only from the public barrel and enhancer use.

## TDD evidence

The public and packaging checks were written first and observed failing under
Node 24.15.0:

- the public browser import failed because `@crc/core` did not export
  `withFocusManagement`;
- the packed Bundler consumer failed on both enhancer imports and
  `CRCKeyboardNavigationOptions`, including `@crc/core/types`;
- the Studio strict consumer failed on the same missing declarations.

After the minimal root exports, marker, consumer updates, and Studio
declarations were added, each check passed. `packages/core/src/types.ts`
required no source edit because its existing `export type * from './index.js'`
correctly forwards the new option type; the packed compatibility consumer
proves that behavior.

## Fresh verification

Environment: Node `v24.15.0`, pnpm `11.21.0`, Vitest Browser Mode with
Playwright Chromium.

- Public focus API browser test: 1 file, 1 test passed.
- Full focus suite: 9 files, 114 tests passed.
- Full browser suite: 71 files, 738 tests passed and 2 skipped.
- `corepack pnpm@11.21.0 typecheck`: passed.
- `corepack pnpm@11.21.0 lint`: passed.
- `corepack pnpm@11.21.0 build`: passed.
- `corepack pnpm@11.21.0 test:package-consumer:packed`: passed, including
  Bundler, NodeNext, runtime exports and identity, blocked deep imports, no
  packed sources, marker absence without focus, and marker presence with focus.
- `corepack pnpm@11.21.0 playground:build`: passed, including the strict Studio
  declaration consumer.
- Static import-edge inspection and `git diff --check`: passed.
