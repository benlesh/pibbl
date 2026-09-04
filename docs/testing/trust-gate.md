# CRC trust gate

The trust gate is the durable contributor and CI contract for CRC's shipped
public surface. It is broader than a unit-test command: current documentation,
catalogs, source declarations, compiler entries, packed artifacts, source and
built Studio modes, browser behavior, deterministic visuals, lifecycle
ownership, and structural performance must agree.

## Clean-checkout sequence

Requirements:

- Node 24.15.0 or newer on the Node 24 LTS line;
- pnpm 11.21.0 from the repository `packageManager` declaration;
- Chromium installed for Playwright.

From a fresh checkout:

```sh
corepack pnpm@11.21.0 install --frozen-lockfile --strict-peer-dependencies
corepack pnpm@11.21.0 exec playwright install chromium
corepack pnpm@11.21.0 trust
```

On a fresh Linux CI runner, install Chromium with `--with-deps`. Browser
launches run serially inside the local aggregate to avoid port/process
contention observed during earlier upgrade and visual work.

## Gate contents

`trust:static` checks:

- learning/test catalog discovery, source contracts, and the generated index;
- the required JSX/non-JSX guide set and all active local documentation files,
  links, and heading/explicit anchors;
- exact API-reference parity with every root value/type export and both
  automatic-runtime entries, including their explicitly handled module-scoped
  JSX namespace; every other export declaration/namespace/star form fails
  closed;
- Git-discovered `.example.tsx` files, all deterministic scenario source, and
  Playground code/copy, plus the active-document inventory, contain no removed
  authoring vocabulary;
- required Vite/esbuild, Babel, JavaScript, mixed-runtime, lifecycle, primitive,
  text/children, layout, focus, and accessibility coverage markers;
- every explicitly marked complete TypeScript/TSX program extracted directly
  from its guide, plus the marked JavaScript program transformed independently
  by esbuild and the real Babel automatic-runtime plugin;
- the fixed obligation manifest derived from pre-Task-14 commit `0040d65` and
  the approved JSX translation record covers all 12 normative contracts with
  substantive semantic claims, explicit contradictions, and distinct mapped
  implementation symbols plus executable-test markers; the checker verifies
  those markers in the cited files and rejects heading-only contracts, removed
  or contradicted clauses, generic evidence substitution, and mapping drift;
- fail-closed export discovery, source-inspected acceptance-matrix evidence,
  mounted/driven non-JSX behavior, literal `Historical status` banners, and
  targeted RED mutations proving each check rejects stale or incomplete
  evidence;
- TypeScript, ESLint, Prettier, package output, and source/built Studio builds.

`trust:package` builds real tarballs and installs them into strict Bundler and
NodeNext consumers. It verifies runtime loading, declarations, source maps,
compiler subpaths, the absence of unpacked source dependencies, and blocked
private imports.

`trust:browser` runs the complete headless Chromium suite, the deliberate
visual-regression/recovery safeguard, representative full-page Studio visuals,
and a built-package smoke scenario. Semantic state and geometry assertions are
the first-line oracle; exact pixels are used only where they add information.

`trust:lifecycle` runs focused cleanup stress plus deterministic structural
performance checks. Resource evidence uses exact acquisition/release ownership,
not garbage-collection timing.

The unified GitHub Actions workflow runs the same responsibilities as parallel
static, package, browser, and lifecycle jobs, then exposes one stable aggregate
result suitable for branch protection. Browser jobs upload named evidence even
when a behavior check fails. Hosted branch-protection configuration remains a
repository-administration action outside local source control.

## Documentation evidence semantics

Run the focused documentation check while editing prose:

```sh
corepack pnpm@11.21.0 docs:check
```

The check treats root/package READMEs, `AGENTS.md`, current guides, current
architecture/design contracts, current status/follow-up pages, current testing
policy, the generated scenario index, and Studio/editor-facing explanatory
sources as active guidance. The breaking
migration guide is link-checked but may show a removed name only beside its
replacement. Completed numbered plans, approved dated designs, implementation
plans, characterization baselines, dependency upgrade notes, dated field
notes, task reports, and `_bmad-output/` remain historical/discovery evidence;
their old vocabulary and point-in-time totals are not current instructions.
Repository historical records must use the literal `Historical status` phrase
near their title and cannot claim `CURRENT`; their path alone is not evidence
of historical status.

Documentation success proves consistency, not runtime behavior by itself. The
acceptance matrix in [library status](../library-status.md) maps each authoring
topic to its required current guide/contract and specific executable example or
test. The checker validates those mappings and inspects the cited Layer, Text,
directional-navigation, and non-JSX sources for the claimed behavior rather
than accepting filenames. The non-JSX browser case mounts the dedicated lesson,
drives pointer and directional/keyboard activation, observes keyed dynamic
children and Text zero/state changes, and disposes twice. Typecheck, catalog,
package, browser, lifecycle, and Studio gates execute the remaining contracts.

When reporting verification, name the command, runtime/browser environment,
and fresh result. A dated field note or old test count is evidence only for its
named revision. In particular, do not present the historical 265-test or
294-test totals as current unless a fresh run reproduces one.

## Visual baseline policy

Visual baselines are check-only in normal tests and CI. Never rewrite a
baseline merely to clear a red check. The safeguard records committed baseline
bytes, induces the documented smoke mismatch, requires named
expected/actual/diff artifacts, verifies the baseline is byte-identical, and
reruns the normal comparison green.

When an intentional product change requires a new baseline:

1. run the focused scenario normally and inspect its current expected image;
2. generate candidate actual/diff output through the explicit update workflow;
3. inspect expected, actual, and diff at native pixels;
4. update only the named baseline with a written reason in the owning record;
5. run the deliberate safeguard and normal recovery again.

The Studio baseline update command is
`corepack pnpm@11.21.0 test:studio-visual:update`; CI never invokes it.

## Performance cadence

Every pull request checks exact workload structure, hit counts, ownership, and
finite metrics through the normal suite. Wall-clock reference budgets are
noisier and run:

- monthly;
- before and after resolver, region registration, transform, clipping, or
  layer hot-path changes;
- when a real workload reports an interaction regression.

The recorded reference environment is macOS 26.5.1 arm64, Node 24.19.0, pnpm
11.21.0, Playwright HeadlessChrome 151, 800×600 viewport, DPR 1, sRGB, and no
competing browser workload. Run the focused reference guard three consecutive
times:

```sh
VITE_CRC_PERF_GUARD=1 corepack pnpm@11.21.0 test:performance:reference
VITE_CRC_PERF_GUARD=1 corepack pnpm@11.21.0 test:performance:reference
VITE_CRC_PERF_GUARD=1 corepack pnpm@11.21.0 test:performance:reference
```

`VITE_CRC_REPORT_PERF=1` records observations without enforcing budgets.
Investigate only after three controlled breaches, excluding environment or
constant-factor regressions first. The 10,000-region sparse/miss spatial-index
trigger remains median above 6 ms or p95 above 12 ms. The last recorded
reference p95 was 6.8 ms after the identity/empty-clip fast path, so that dated
run did not justify a spatial index.

## Supported browser boundary

Chromium is the required browser oracle. CRC's supported pointer, mouse, touch,
wheel, keyboard/focus, editing/composition, clipboard, and drag/drop facades
are exercised there, including focus policies and directional navigation.
Native executable traces and current UI/Pointer Events informed ordering.

CRC normalizes Canvas-only regions to one topmost logical target,
transition-before-move, same-live-target activation, accumulated
transform/clip/layer geometry, and pathless Canvas observers. Browser-dependent
context-menu ordering remains native rather than universally normalized.

The project does not claim cross-browser parity. Adding another required
browser needs characterization and explicit compatibility decisions rather
than assuming identical Canvas metrics or input ordering. Keyboard reachability
also does not imply semantic accessibility: CRC creates no semantic DOM or
assistive-technology tree, so applications must supply the equivalent
accessible experience described in the accessibility contract.
