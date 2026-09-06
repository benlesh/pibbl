# Standard shape primitives verification field note

> **Historical status: REVISION-SPECIFIC VERIFICATION EVIDENCE.** These results
> describe the dated revision and environment below; rerun the trust gate for
> current evidence.

Date: 2026-09-06

Branch: `codex/standard-shape-primitives`

Workspace: `/private/tmp/crc-standard-shapes`

## Revision and environment

The full gate ran against committed implementation/scenario revision
`39639bff2116223ec14e3c2cb347b5770be7b471` plus the Task 7 documentation,
Studio declaration, documentation-preservation, and approved Studio-baseline
closure changes recorded in this field note. This follows the plan's sequence:
the evidence is written after the implementation gate and committed with the
documentation closure.

- Node: `v26.7.0`
- pnpm: `11.21.0` through Corepack
- Browser: Playwright Chromium `151.0.7922.34`
- Host: local macOS

Node 26 is newer than the repository's minimum `>=24.15.0`, but it is not the
documented Node 24 LTS line. The original Task 7 and aggregate results below are
therefore local Node 26 evidence. The later final-review fix evidence records a
fresh focused Node 24.15.0 run.

## Fresh focused and consistency evidence

The five Task 7 consistency commands passed:

| Command                                  | Fresh result                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `corepack pnpm@11.21.0 scenarios:check`  | PASS; validated 47 learning lessons, 16 test labs, and `docs/scenario-index.md`.                                                                                                                                                                                                                                                                                                                                              |
| `corepack pnpm@11.21.0 docs:check`       | PASS after the `b529bfc` provenance fix; 11 guides, 40 current/migration files, 54 historical/work records, 46 values, 122 types, 21 acceptance rows, 51 parsed snippets, 8 extracted TypeScript programs, 667 pre-Task-14 and 667 current semantic units across 12 normative contracts, 48 direct evidence mappings, 85 baseline-derived field migrations, 100 discovered presentation sources, and 755 RED mutation probes. |
| `corepack pnpm@11.21.0 typecheck`        | PASS; `tsc --noEmit`.                                                                                                                                                                                                                                                                                                                                                                                                         |
| `corepack pnpm@11.21.0 lint`             | PASS; ESLint and the repository-wide Prettier check.                                                                                                                                                                                                                                                                                                                                                                          |
| `corepack pnpm@11.21.0 playground:build` | PASS; exact Studio export-name parity and 122-type structural coverage, then a 1,322-module Vite production build.                                                                                                                                                                                                                                                                                                            |

The exact focused implementation command was:

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/components/shape-style.test.ts packages/core/src/lib/components/circle.test.ts packages/core/src/lib/components/ellipse.test.ts packages/core/src/lib/components/arc-geometry.test.ts packages/core/src/lib/components/arc.test.ts packages/core/src/lib/components/wedge.test.ts packages/core/src/lib/components/polygon.test.ts packages/core/test/jsx-authoring.test.tsx packages/core/test/learning-examples.test.ts packages/core/test/drawing-gallery.test.ts --browser.headless --browser.ui=false
```

Result: PASS; 10 files, 261 tests, zero skips, 2.62 seconds.

### Final-review fix evidence

The final-review fix tree based on `b529bfc117cca76670cd6a561e15cb71508604ed`
was checked with Node `v24.15.0` and pnpm `11.21.0` through Corepack. The focused
browser command was:

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/components/circle.test.ts packages/core/src/lib/components/ellipse.test.ts packages/core/src/lib/components/arc.test.ts packages/core/src/lib/components/wedge.test.ts packages/core/test/standard-shape-allocation.test.ts packages/core/test/drawing-gallery.test.ts --browser.headless --browser.ui=false
```

Result: PASS; 6 files, 47 tests, zero skips, 1.44 seconds. The allocation suite
imports the public components and mounts them through a nested `Absolute` whose
immediate containing allocation is 400 by 200 while the root is 400 by 300. A
temporary mutation that propagated the ancestor percentage basis made all four
allocation cases fail; the runtime source was then restored before the green
run.

The same Node 24.15.0 fix tree passed `corepack pnpm@11.21.0 docs:check` with
755 RED mutation probes and passed `corepack pnpm@11.21.0 scenarios:check` with
47 learning lessons, 16 test labs, and the generated scenario index validated.

## Aggregate trust evidence

The exact aggregate command was:

```sh
corepack pnpm@11.21.0 trust
```

Result: PASS, exit 0. The aggregate run covered:

- static/catalog/documentation/type/lint/build checks, including the 47/16
  scenario totals and exact 46-value/122-type public and Studio declarations;
- source and built Studio builds;
- packed Bundler and NodeNext consumers, declaration and runtime-export checks,
  blocked deep imports, source-free package use, and tree-shaking evidence
  (116,321-byte no-focus build versus 139,968-byte with-focus build);
- the main browser matrix: 91 files, 1,249 passed and 2 skipped out of 1,251;
- the visual-safeguard mutation drill, which rejected the intentional mutation,
  preserved baseline bytes, recovered, and passed;
- five matched full-page Studio baselines;
- built smoke: 1 file and 1 test passed;
- lifecycle cleanup: 2 files and 14 tests passed;
- structural performance: 1 file, 9 passed and 2 skipped out of 11.

The two skipped cases are the controlled wall-clock performance guards, which
are opt-in rather than default correctness checks. The focused standard-shape
matrix had no skips.

## Visual evidence inspection

### Drawing gallery

The public `drawing-shapes` scenario artifacts were inspected at:

- `test-screenshots/tfc-09/drawing-shapes.expected.png`
- `test-screenshots/tfc-09/drawing-shapes.actual.png`
- `test-screenshots/tfc-09/drawing-shapes.diff.png`

The expected and actual images, and the committed
`packages/core/test/visual-baselines/tfc-09-drawing-shapes.expected.png`, had
the same SHA-256
`8d48816262326b90867cdbfa962eca61a0a15599827d8c2c9f04a79d4d07fe79`;
byte comparison returned zero. The gallery's pixel and scenario-state checks
cover the intentional Circle, Ellipse, Arc, Wedge, and Polygon row while the
pre-existing drawing fixtures remain unchanged. Canvas-call assertions live in
the focused component suites, and click-target assertions live in the focused
component and learning-lesson suites rather than this gallery test.

### Studio catalog reflow

The first aggregate run stopped at the Studio visual gate after the scenarios
catalog added five drawing lessons. Before accepting any update, the committed
expected image, generated actual image, and generated diff were inspected for
each page. The controller explicitly authorized these five baseline updates and
no others.

| Baseline and generated evidence                                                                                                                                   | Pre-update changed pixels and bounds | Inspection conclusion                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/core/test/visual-baselines/studio-landing.expected.png`; `test-screenshots/studio/landing.actual.png`; `test-screenshots/studio/landing.diff.png`       | 6,584; `x=24..148`, `y=374..899`     | Only the five new sidebar lesson labels and resulting sidebar text reflow/antialiasing changed. Both expected and actual already said `11 focused primitives`; there was no `6` to `11` main-content count change. |
| `packages/core/test/visual-baselines/studio-primitive.expected.png`; `test-screenshots/studio/primitive.actual.png`; `test-screenshots/studio/primitive.diff.png` | 7,170; `x=24..1198`, `y=374..2739`   | Sidebar insertion/reflow plus the expected next-lesson link changing from Rectangle to Circle.                                                                                                                     |
| `packages/core/test/visual-baselines/studio-mouse.expected.png`; `test-screenshots/studio/mouse.actual.png`; `test-screenshots/studio/mouse.diff.png`             | 6,718; `x=24..483`, `y=61..899`      | Sidebar insertion/reflow plus the expected lesson ordinal change.                                                                                                                                                  |
| `packages/core/test/visual-baselines/studio-advanced.expected.png`; `test-screenshots/studio/advanced.actual.png`; `test-screenshots/studio/advanced.diff.png`    | 6,640; `x=24..558`, `y=61..899`      | Sidebar insertion/reflow plus the expected lesson ordinal change.                                                                                                                                                  |
| `packages/core/test/visual-baselines/studio-test-lab.expected.png`; `test-screenshots/studio/test-lab.actual.png`; `test-screenshots/studio/test-lab.diff.png`    | 6,584; `x=24..148`, `y=374..899`     | Sidebar insertion/reflow only.                                                                                                                                                                                     |

No Canvas, editor, or other main-content drift was present. After the inspected,
authorized update, `corepack pnpm@11.21.0 test:studio-visual` passed all five
full-page baselines, and the complete trust rerun passed the same gate.

## Requirement-by-requirement audit

| Design obligation                                     | Implementation and direct evidence                                                                                                                                                                                                                                                                                                    | Audit result                                                                                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Five discoverable drawing leaves and ten public types | Root exports in `packages/core/src/index.ts`; exact API, runtime, Bundler, NodeNext, packed, JSX, and `createElement` checks in the public-vocabulary, authoring, and consumer tests.                                                                                                                                                 | Complete. All five reject children; geometry remains under `style`, events remain props, and `ArcStyle` has no `fill`.                     |
| Closed local styles and declared-box participation    | Focused modules `circle.ts`, `ellipse.ts`, `arc.ts`, `wedge.ts`, and `polygon.ts` use `definePrimitive` and the shared specified/normalized/resolved style path.                                                                                                                                                                      | Complete. Supported paint fields and the stroke-only Arc boundary are documented and typed.                                                |
| Percentage bases and local units                      | `shape-style.test.ts` plus direct resolver tests cover unit-level diagnostics; `standard-shape-allocation.test.ts` mounts public components through a real 400-by-200 `Absolute` allocation and covers width-based `cx`/`radiusX`, height-based `cy`/`radiusY`, and smaller-dimension circular radius through paint and hit behavior. | Complete. Polygon tuples remain finite local numbers; `auto` and indefinite bases reject through established diagnostics.                  |
| Circle and Ellipse geometry                           | `circle.test.ts`, `ellipse.test.ts`, and `standard-shape-allocation.test.ts` cover numeric/default/percentage geometry, rotation in finite radians, paint, updates, zero-radius/axis empty geometry, hit testing, and exact default/overridden bounds.                                                                                | Complete.                                                                                                                                  |
| Arc direction and open stroke geometry                | `arc-geometry.test.ts` covers signed Canvas full-turn thresholds, opposite-direction normalization, wrapping, zero span, endpoints, and cardinal extrema; `arc.test.ts` covers the open stroke-only path and injected-fill rejection.                                                                                                 | Complete.                                                                                                                                  |
| Partial and full Wedge geometry                       | `arc-geometry.test.ts` and `wedge.test.ts` cover center-to-arc closure, curved/radial interaction and bounds, fill, and a full-circle path with no center commands or radial stroke seam.                                                                                                                                             | Complete. No `innerRadius`.                                                                                                                |
| Polygon geometry and validation                       | `polygon.test.ts` covers ordered numeric tuples, closure, finite contextual coordinate diagnostics, extrema bounds, paint/target behavior, and empty/noninteractive arrays below three points; the Line regression remained green.                                                                                                    | Complete.                                                                                                                                  |
| Deterministic zero/error behavior                     | Component suites cover zero radius/ellipse axis/span and short polygons as empty; negative/non-finite radii, angles, rotation, and coordinates as contextual `LayoutDiagnostic` failures.                                                                                                                                             | Complete.                                                                                                                                  |
| Shared paint and interaction geometry                 | Every component creates a fresh `Path2D` and delegates to `renderPath`; focused component, allocation, and lesson tests cover fill/stroke targeting, `lineInteractionWidth`, cursor/opacity where applicable, computed bounds, explicit bounds overrides, and click targeting.                                                        | Complete. Transform, clip, layer, layout placement, focus-policy, and reverse paint-ledger behavior remain in the shared tested machinery. |
| Immediate-mode and lifecycle ownership                | No path cache, retained command object, async owner, or persistent shape resource exists. `runtime-contract.test.ts` proves acquired hook/event resources are torn down on a shape resolution failure and that the same Canvas can recover with valid geometry.                                                                       | Complete. Updates, removal, replacement, and disposal use existing primitive/event teardown.                                               |
| Layout and measurement boundary                       | All five omit a `measure` capability; focused tests assert unsupported finite-constraint measurement.                                                                                                                                                                                                                                 | Complete. Geometry does not infer an intrinsic box; no new pixel alignment contract was added.                                             |
| Public learning and deterministic lab evidence        | Five public-root JSX lessons provide click-driven updates; `drawing-shapes` covers exact pixels, semantic scenario state, and the inspected visual. Focused component suites provide Canvas-call evidence, while focused component and lesson suites provide interaction evidence. Catalog checks report 47 lessons and 16 labs.      | Complete.                                                                                                                                  |
| Documentation and Studio integration                  | Drawing contract, API reference, library status, scenario index, exact Studio declaration bundle, and visible implemented-plan/design banners agree with source. Preservation metadata records 48 current drawing-contract units and the 13 approved shape additions.                                                                 | Complete. `docs:check`, Studio build, and export parity pass.                                                                              |
| Explicit non-goals                                    | Normative docs preserve no splines/smoothing, data transformation or chart suite, annular/inner-radius wedge, rounded Rectangle, retained graph/registry/generic Shape, new paint/compositing/pixel alignment, or geometry-derived intrinsic measurement.                                                                             | Complete; no implementation exports or behavior cross these boundaries.                                                                    |
| Trust closure                                         | The five consistency commands, exact 10-suite focused command, visual inspection/update workflow, and complete aggregate gate above are fresh.                                                                                                                                                                                        | Complete; no indirect or missing evidence found.                                                                                           |

## Closure assessment

The audit found no missing design requirement or unauthorized public extension.
The aggregate gate remains the qualified Node 26 run, while the final-review
focused browser, documentation, and catalog checks were reproduced on the
documented Node 24.15.0 line. Historical test totals were not reused as current
results; every total in this note comes from the 2026-09-06 commands above.
