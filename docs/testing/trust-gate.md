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
npm install --global corepack@0.35.0
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
- the validated public `docs/site/` content boundary, Learn/API/Examples
  information architecture, canonical and legacy routes, alphabetical API and
  example browse ordering, API coverage, Markdown rendering, and deterministic
  static MiniSearch records;
- public-search isolation: test-lab routes, scenario-only metadata, internal
  records, source paths, and remote search behavior are all rejected;
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
- the migration guide's field replacements agree with the current field table;
- source-inspected acceptance evidence, executable snippets, historical banners,
  and negative tests for missing guarantees, invalid links, unsupported exports,
  and incorrect field replacements;
- TypeScript, ESLint, Prettier, package output, and source/built Studio builds.

Component manipulation adds focused public browser evidence for signal-owned
move, resize, rotation, snapping, child-defined drag geometry, readouts,
pointer capture, cancellation, and teardown. That evidence supplements the
current documentation checks and source-inspection rules.

`trust:package` builds real tarballs and installs them into strict Bundler and
NodeNext consumers. It verifies runtime loading, declarations, source maps,
compiler subpaths, the absence of unpacked source dependencies, and blocked
private imports.

`trust:browser` runs the complete headless Chromium suite, the deliberate
visual-regression/recovery safeguard, representative full-page Studio visuals,
the public Studio documentation/navigation/search acceptance suite, and a
built-package smoke scenario. Semantic state and geometry assertions are the
first-line oracle; exact pixels are used only where they add information.

`trust:lifecycle` runs focused cleanup stress plus deterministic filter and signal
ownership and structural-performance checks. The signal/scheduler lifecycle suite
drives repeated mount, shared reads, branch and Layer removal, root replacement,
render failure, abort, disposal, and fresh remount. The animation lifecycle suite
also drives autoplay, pause, seek, reverse, replacement, custom failure, owner
removal, and fresh remount. Test-only snapshots require zero live renderer
consumers, renderer dependency edges, computed source-edge leases, playback
registrations, writer leases, evaluator/stepper states, queued commands and
milestones, registered roots, Advance participants, completion callbacks, and
host frames at release boundaries. Cumulative consumer, edge, root, playback,
lease, stepper-state, Begin-command, and Complete-callback acquisitions must
match releases exactly.

The signal/scheduler performance suite fixes structural work rather than elapsed
time: 1,000 writes coalesce to one realm host callback and one root traversal; 100
roots traverse once in stable mount order after one signal commit notification;
an unchanged computed performs one Plan validation and no render; and a stable
100-Layer tree repaints only its signal-owning child while reusing every sibling
bitmap identity. The animation performance suite fixes 1,000 numeric playbacks
to one realm host callback and one root traversal per presented frame, exactly
one sample and no more than one output-stage attempt per playback, and no render
for equality-suppressed output when metadata is unobserved. It also fixes one
lease across 100 sequential same-signal tracks, zero sample-time array allocation
for ten numeric keyframes, gap-independent closed-form spring samples, bounded
fixed-step work, zero animation-owned offscreen or pixel operations, and Layer
child-cache reuse under presentation-only animation. The filter lifecycle suite
fixes the workload at 1,000 unchanged rerenders, 100 sibling boundaries, and three nested boundaries, then checks exact
scratch-slot creation, depth, checkout/return, resize, and release counts through
replacement, failure, disposal, and a fresh remount. The filter performance suite
fixes helper walks, primitive callbacks, surface construction, clears, filtered
and parent draws, input pixel areas, pixel-readback calls, and bitmap transfers.
Resource evidence uses deterministic ownership counters rather than a garbage-
collection oracle. Wall-clock measurements remain optional diagnostics with no
default pass threshold; browser halo timing and pixels remain scenario/visual
evidence rather than lifecycle or structural-performance oracles.

Animation correctness uses the scheduler's frozen logical frame time. Seekable
tweens, keyframes, and springs jump directly to that time; only stateful steppers
integrate retained fixed steps. A stepper configured with step size `s` and
maximum elapsed input `m` performs at most `ceil(m / s)` steps in a presented
frame because the previous frame may retain a fractional remainder. Tests assert
that bound and the exact clamped/discarded elapsed trace values rather than an
uncontrolled duration threshold. The animation visual uses frozen-time semantic
state and exact Chromium pixels, and its committed expected/actual/diff artifacts
are inspected before any baseline decision. This evidence does not claim
cross-browser/GPU pixel identity, and no uncontrolled wall-clock measurement is
a default correctness gate.

The GitHub Actions matrix runs the same `trust:static`, `trust:package`,
`trust:browser`, `trust:lifecycle`, and `trust:native` scripts as local `trust`.
A regression check rejects a missing or extra CI stage. Each clean runner installs
Corepack and Chromium; browser jobs build their assets before testing. A startup
failure remains the primary error even when no screenshot artifacts exist.
The stable **Trust gate** result requires every matrix stage to succeed.

`trust:native` verifies text geometry, the pinned native toolchain, and two-build
reproducibility. Wall-clock text benchmarks remain explicit diagnostic commands,
not correctness gates.

### Historical audits versus merge checks

`audit:docs:preservation` retains the dated migration manifest, paragraph digests,
reviewed mappings, and their adversarial tests. `audit:agent-verification:claims`
retains strategy-ledger evidence fingerprints. These audits can report stale
claims after legitimate changes; they do not establish current runtime defects.
They are deliberately outside `trust`. Renewing a claim requires review, not an
automatic digest refresh. `CRC_VERIFY_CONTRACT_PROVENANCE=1` requires full Git
history when running the documentation audit.

The required gate retains current API/documentation parity, valid links and
snippets, scenario coverage, real packed consumers, browser behavior, visual
comparisons, resource ownership, and structural performance. These checks compare
observable behavior or current sources rather than hand-maintained historical
counts. The scenario index remains a checked generated artifact because readers
use its routes and API links; regenerate it with `scenarios:write-index` after
catalog edits. Source API discovery uses the repository's source mappings, so a
previous local build cannot hide missing declarations in a clean checkout.

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

Public Studio Markdown is a narrower, separately validated boundary:
`docs/site/` is the only tree that can render in the public Studio or feed its
local MiniSearch index. The checker also ensures public Learn/API/Examples
routes stay canonical, their documented aliases redirect, and automated test
labs remain absent from public navigation and search.

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

The [2026-09-04 JSX authoring field note](./field-notes/jsx-component-authoring.md)
is the final local closure record for that pivot. It reports the exact
environment, commands, wall times, inspected visuals, reviewed Studio baseline
changes, automated acceptance, and accepted verifier-hardening residuals. Its
Node 26 result is additive evidence; Node 24 LTS remains canonical.

The [documentation information architecture and search field note](./field-notes/documentation-information-architecture-and-search.md)
records the verification of the current Learn/API/Examples Studio experience.

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

### 2026-10-04 trust repair visual review

The Filters Studio baseline was updated for the already-shipped lesson numbering
(25 to 26) and the displayed `SvgPath` import added by the positioning migration.
Expected, actual, and pixel-diff images were inspected, including native-resolution
editor detail. All 23,256 changed pixels were confined to the ordinal and editor
source; the Canvas gallery and surrounding layout were unchanged. Only
`studio-filters.expected.png` was regenerated through the route-specific update.

The examples landing mismatch was different: all 5,612 changed pixels were in
two Canvas text labels, and a fresh page matched the existing baseline exactly.
Visual routes now use independent pages to avoid Chromium's navigation-dependent
Canvas text rasterization. Navigation continuity remains covered by the separate
Studio acceptance suite; no landing baseline or pixel tolerance was changed.

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
