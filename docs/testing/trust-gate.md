# CRC trust gate

The trust gate is the durable contributor and CI contract for CRC's existing public surface. It is intentionally broader than a unit-test command: catalog completeness, package artifacts, source and built examples, lifecycle stress, deterministic visuals, browser behavior, types, lint, and builds must agree.

## Clean-checkout sequence

Requirements:

- Node 24.15.0 or newer on the Node 24 LTS line;
- pnpm 11.21.0, read from the repository `packageManager` declaration;
- Chromium installed for Playwright.

From a fresh checkout:

```sh
corepack pnpm@11.21.0 install --frozen-lockfile --strict-peer-dependencies
corepack pnpm@11.21.0 exec playwright install chromium
corepack pnpm@11.21.0 trust
```

On a fresh Linux CI runner, install Chromium with `--with-deps`. The trust script runs browser launches serially to avoid port/process contention observed during the upgrade and visual work.

## Gate contents

The aggregate command checks:

- scenario catalog/source discovery and the committed scenario index;
- ESLint, Prettier, and TypeScript 7;
- package ESM/declarations/source maps;
- source-mode and built-package gallery production builds;
- packed-tarball Bundler/NodeNext/runtime consumers;
- a deliberate visual regression, named expected/actual/diff artifacts, unchanged baseline bytes, and normal recovery;
- the complete headless Chromium suite, including always-on performance structure;
- built-package smoke and the focused lifecycle/cleanup stress suite.

The unified GitHub Actions workflow runs the same responsibilities as parallel static, package, browser, and lifecycle jobs, then exposes one stable aggregate result suitable for selection as a required check. It is configured to upload named test artifacts even when a behavior failure occurs. Hosted branch-protection configuration remains a repository-administration action outside local source control.

## Visual baseline policy

Visual baselines are check-only in normal tests and CI. A baseline must never be rewritten merely to clear a red check. The safeguard script records committed baseline bytes, induces the documented smoke mismatch, requires the mismatch and expected/actual/diff artifacts, verifies the baseline is byte-identical, and reruns the normal comparison green.

When an intentional product change requires a new baseline:

1. run the focused scenario normally and inspect its current expected image;
2. generate the candidate actual/diff through the explicit test workflow;
3. inspect expected, actual, and diff at native pixels;
4. update only the named baseline with a written reason in the owning field note;
5. run the deliberate drill and normal recovery again.

## Performance cadence

Every pull request runs exact workload structure, hit counts, ownership, and finite-metric assertions through the normal suite. Wall-clock reference budgets are noisier and run:

- monthly;
- before and after resolver, region registration, transform, clipping, or layer hot-path changes;
- when a real workload reports an interaction regression.

Reference environment: macOS 26.5.1 arm64, Node 24.19.0, pnpm 11.21.0, Playwright HeadlessChrome 151, 800×600 viewport, DPR 1, sRGB, no competing browser workload. Run the focused reference guard three consecutive times:

```sh
VITE_CRC_PERF_GUARD=1 corepack pnpm@11.21.0 test:performance:reference
VITE_CRC_PERF_GUARD=1 corepack pnpm@11.21.0 test:performance:reference
VITE_CRC_PERF_GUARD=1 corepack pnpm@11.21.0 test:performance:reference
```

`VITE_CRC_REPORT_PERF=1` records observations without enforcing budgets. Investigate only after three controlled breaches, excluding environment or constant-factor regressions first. The 10,000-region sparse/miss spatial-index trigger remains median above 6 ms or p95 above 12 ms. Current verified p95 is 6.8 ms after the identity/empty-clip fast path, so a spatial index is not justified.

## Supported browser boundary

The contract suite uses Chromium as the required browser oracle. Native executable traces and current W3C UI/Pointer Events informed mouse ordering. CRC normalizes Canvas-only regions to one topmost logical target, transition-before-move, same-live-target activation, accumulated transform/clip/layer geometry, and pathless Canvas observers. Browser-dependent context-menu ordering is preserved rather than universally normalized.

The project does not claim cross-browser, touch, keyboard, focus, or accessibility parity. Adding another required browser needs characterization and explicit compatibility decisions rather than assuming identical Canvas metrics or input ordering.
