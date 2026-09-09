# Rounded shapes and path creators verification field note

> **Historical status: BLOCKED AGGREGATE VERIFICATION EVIDENCE.** This dated
> record captures the feature audit and independently green trust constituents;
> it does not mark the approved design or implementation plan as implemented.

Date: 2026-09-08

Branch: `codex/rounded-shapes`

Workspace: `/private/tmp/crc-rounded-shapes`

## Environment

- Node: `v24.15.0`
- pnpm: `11.21.0` through Corepack
- Browser: Playwright Chromium `151.0.7922.34`, headless
- Host: local macOS

## Aggregate result

`fnm exec --using=24.15.0 -- corepack pnpm@11.21.0 trust` did not complete.
It passed scenario discovery and catalog validation for 49 lessons and 16 test
labs, then stopped in `docs:check` before type, package, browser, or lifecycle
stages. The exact assertion is the pre-existing missing visible Historical
status banner in
`docs/superpowers/plans/2026-09-08-first-class-filters-implementation.md`.
That plan is outside the rounded-shapes feature scope and was not changed.

Because the aggregate gate is red, the rounded-shapes design remains approved
for implementation rather than being recorded as implemented, and the
rounded-shapes implementation plan has no implemented-plan banner.

## Independently completed trust constituents

The stages the aggregate command could not reach were run independently under
the same Node and pnpm versions:

| Gate                    | Fresh result                                                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Static remainder        | `typecheck`, repository lint/format, workspace build, source Studio build, and built Studio build passed. Studio declaration parity reports 140 types.  |
| Packed package consumer | Passed Bundler and NodeNext consumers, declarations, 58 runtime exports, blocked deep imports, source-free package use, and focus-elimination evidence. |
| Browser aggregate       | 106 files passed; 1,371 tests passed and 2 controlled performance guards skipped. Visual safeguard preserved baseline bytes; built smoke passed.        |
| Studio visuals          | All five full-page baselines matched after the inspected, intentional feature baseline update below.                                                    |
| Lifecycle               | 2 files and 14 tests passed.                                                                                                                            |
| Structural performance  | 1 file; 9 tests passed and 2 controlled wall-clock guards skipped.                                                                                      |

The public root surface is 58 runtime values and 140 named type exports. The
runtime consumer has an exact 58-name assertion; Studio parity has an exact
140-type assertion.

## Approved-design audit

| Obligation                                 | Evidence and result                                                                                                                                                                                                                                                                                        |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ten public creators and canonical geometry | `index.ts` explicitly exports all ten creators; construction commands occur in their geometry modules. Rectangle, Circle, Ellipse, Arc, Wedge, Line, Polygon, RegularPolygon, Star, SvgPath, and the existing path hooks delegate rather than repeat formulas.                                             |
| Rounded corners                            | `RoundedCornerStyle`, `cornerRadius`, and sparse `cornerRadii` are covered by geometry/component tests for nullish fallback, literal zero, index order, percentage basis, scaling, signed rectangles, and contextual diagnostics.                                                                          |
| Generated leaves                           | RegularPolygon covers all three normalized-size formulas, clockwise vertex generation, zero path with generated bounds, events, and unsupported measurement. Star covers alternating concave vertices, equal/zero radii, generated bounds, explicit bounds precedence, and no crossing-triangle traversal. |
| Shared runtime behavior                    | Component tests and allocation/learning tests cover `renderPath`, paint, targeting, clipping, transforms, layout placement, recovery, and no intrinsic measurement.                                                                                                                                        |
| Public delivery                            | JSX/createElement and package-consumer checks cover static rejection and all public values/types; Studio mirrors the declarations; 49 lessons, 16 labs, the creator-based Clip lesson, and the generated scenario index are present.                                                                       |
| Documentation and boundaries               | Current contracts document `RangeError` versus `LayoutDiagnostic`, zeros, percentages/indexing/scaling, clipping with `createRegularPolygonPath` and `crcMemo`, and explicit non-goals. No generic Shape/registry, retained geometry cache, or additional shape hook is exported.                          |

The historical Task 7 plan wording was corrected in this revision: a zero-radius
Star returns an empty path while retaining generated vertex extrema for default
keyboard bounds; explicit caller bounds still win.

## Studio visual inspection

The initial Studio visual run reported a landing mismatch. Expected, actual,
and generated diff images were inspected for every route before updating any
baseline. The generated artifacts are under
`test-screenshots/studio/pre-task11/`; current actual captures are under
`test-screenshots/studio/`.

| Route     | Pre-update delta                                         | Inspection conclusion                                                                                                      |
| --------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| landing   | 1,722 pixels, `x=24..134`, `y=775..899`                  | Only the intended RegularPolygon and Star sidebar entries appear.                                                          |
| primitive | 340,553 pixels; expected `1280x2878`, actual `1280x2930` | Intended rounded Rectangle lesson geometry, code and API note, plus the new sidebar entries and resulting vertical reflow. |
| mouse     | 1,769 pixels, `x=24..483`, `y=61..899`                   | Intended sidebar insertion and lesson ordinal advancing from 23 to 25.                                                     |
| advanced  | 1,785 pixels, `x=24..558`, `y=61..899`                   | Intended sidebar insertion and lesson ordinal advancing from 47 to 49.                                                     |
| test-lab  | 1,722 pixels, `x=24..134`, `y=775..899`                  | Only the intended RegularPolygon and Star sidebar entries appear.                                                          |

No unrelated canvas, editor, or landing-content drift was accepted. After the
reviewed baseline update, `test:studio-visual` matched all five routes and the
full browser aggregate passed.

## Required next authority

The owner of the unrelated first-class-filters implementation plan must add its
required Historical status banner, then a fresh aggregate `trust` run must pass.
Only then may this design status change to implemented and the rounded-shapes
implementation plan receive its implemented-plan banner.
