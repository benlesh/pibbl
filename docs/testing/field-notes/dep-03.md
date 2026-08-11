# DEP-03 field note — build and package modernization

Date: 2026-08-11

## Scenario and risk

DEP-03 had to replace unbuild and the obsolete Rollup graph without changing package exports or allowing source aliases to disguise broken published output. The shared `baseline-smoke` scenario is the behavior and visual oracle in both source and built modes.

## Manual and headless method

- Source gallery: Vite native tsconfig paths loaded workspace source.
- Built gallery: `--mode built` disabled source resolution and a transform guard rejected any `packages/core/src` module.
- The in-app Chromium procedure mounted, updated, clicked Canvas coordinate `(100, 100)`, and reset in both modes.
- The same headless smoke test and scenario module ran once per mode.
- A separate package-consumer fixture checked Bundler, NodeNext, and Node ESM loading.

## Visual strategy and controls

Both package modes use the DEP-01 baseline, stabilization controls, semantic probes, and glyph-only masks. Artifacts are separated under `test-screenshots/dep-03/source` and `.../built`. The two actual PNGs were byte-identical, so package bundling introduced no rendering difference.

## Surprising findings and browser differences

- TypeScript 7 can emit declarations but cannot replace unbuild's single-file declaration bundle; an internal declaration tree is required.
- Extensionless relative specifiers in that tree fail NodeNext, while `.js` source specifiers resolve correctly through TypeScript and esbuild.
- Vite 8's native tsconfig-path support removes a TypeScript-5-only `tsconfck` peer chain.
- Passing `-- --mode built` through nested pnpm scripts forwarded a literal separator to Vite. Named playground scripts avoid ambiguous argument forwarding.

## Flakes and stabilization

- Source and built browser runs were executed sequentially to avoid local Chromium contention.
- Built-mode artifacts have separate paths, so one run cannot hide the other.
- The source-boundary guard turns accidental alias leakage into a deterministic build/test failure.

## Failed or rejected approaches

- Rejected TypeScript-only JavaScript emit because extensionless source imports would not be directly runnable as Node ESM without a much broader source rewrite.
- Rejected TypeScript `outFile`; TypeScript 7 removed it.
- Rejected retaining the unreachable Rollup graph after esbuild replaced the live bundle step.
- Rejected a built test that merely pointed directly at `dist`; package exports and a source-boundary guard give stronger consumer evidence.

## Helper and tooling friction

- Package-boundary tests need a positive consumer assertion and a negative source-leak assertion.
- Source and built visual artifacts need mode-specific names even when they share one baseline.
- Type consumers should test more than one module-resolution strategy.

Candidate tools:

1. a reusable package-boundary Vite guard that can assert allowed source/output roots;
2. a pack-and-consume harness that installs produced tarballs into a temporary project and runs Bundler, NodeNext, and runtime checks.

## Decisions and follow-ups

- esbuild owns runtime bundling and source maps; TypeScript CLI owns checking and declarations.
- Built mode resolves real package exports and fails on source leakage.
- The workspace consumer fixture is the DEP-03 minimum; TFC-10 should add packed-tarball verification to the final trust gate.
