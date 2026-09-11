# Interactive studio and automated test labs

CRC now has two deliberately different example catalogs. The learner studio presents 52 focused, attractive lessons; the automated-test catalog preserves the exhaustive scenarios used by browser verification. Both are authored against the public `@crc/core` API.

## Architecture

```text
learning catalog ── focused mount(canvas) source ── learner studio

test catalog ─────── scenario controller ────────── test labs + headless driver
```

- `packages/scenarios/src/learning-catalog.ts` contains the public lesson order, section, API tags, two objectives, prompts, relationships, Canvas dimensions, canonical source path, validation, and lazy loaders.
- Every `packages/scenarios/src/learning/**/*.example.tsx` file is a concise lesson with one contract: `export default function mount(canvas: HTMLCanvasElement): CRCController`.
- `packages/scenarios/src/catalog.ts` retains the test-only scenario metadata, actions, source identity, visibility, maturity, validation, and lazy loaders.
- Every non-learning `packages/scenarios/src/**/*.example.tsx` file remains an exhaustive scenario controller with state, actions, render settlement, reset, and disposal.
- `packages/scenarios/src/surface.ts` is an optional gallery surface adapter available only through the explicit `@crc/scenarios/surface` subpath. It is not exported from the package root or imported by the catalog.
- `playground/src/learning-sources.ts` and `playground/src/scenario-sources.ts` are the Vite-specific raw-source adapters. Learning source is route-lazy; test source becomes a collapsed read-only editor only when opened.
- `tooling/scenario-catalog.ts` independently discovers both sets from disk, validates their source contracts, loads every definition, and checks the generated [example catalog index](../scenario-index.md).
- Browser tests mount every lesson and every test scenario from those same modules.

`loadScenario(entry)` rejects a definition whose ID, source ID, or ordered
action IDs differ from its catalog entry. Catalog validation also rejects
duplicate IDs/slugs/actions, empty tags/instructions/reasons, invalid
dimensions, and non-TSX source references.

## Learner studio

Run the source-mode studio from the repository root:

```sh
pnpm playground
```

Open <http://localhost:5173/#/examples>. Desktop navigation stays visible; narrow screens use a keyboard-accessible drawer. The landing page leads into drawing, composition, mouse-event, and advanced-interaction lessons.

Each lesson loads Monaco and the TypeScript worker on demand. CRC declarations provide semantic errors, completion items, and hover types. Valid edits are emitted by the worker and run in a replaceable opaque iframe with `sandbox="allow-scripts"`; invalid edits leave the last successful preview in place. Share links use a versioned compressed hash payload and fall back safely when malformed or oversized.

The Canvas lessons demonstrate the shipped JSX, drawing, layout, DOM-aligned
user-event, focus, and directional-keyboard contracts. CRC focus lessons use
the Canvas as the one native focus host and explicit logical targets; they do
not imply generated semantic DOM descendants or an accessibility tree. The
surrounding Studio navigation and controls remain ordinary accessible DOM.

## Automated test labs

Open <http://localhost:5173/#/testing>. This area explains that its scenarios are deterministic browser fixtures and retains their exact IDs, action sets, diagnostic state, visual baselines, and headless consumers. Test-only visibility and maturity metadata are not shown on learning pages.

To exercise the baseline first, open <http://localhost:5173/#/testing/baseline-smoke>.

1. Confirm the initial blue rectangle reports revision `0`, clicks `0`, and last action `mount`.
2. Choose **Update scene**. The rectangle becomes purple, revision becomes `1`, and last action becomes `update`.
3. Click inside the colored rectangle. It becomes orange, clicks becomes `1`, and last action becomes `click`.
4. Choose **Reset**. The blue scene returns with revision and clicks at `0` and last action `reset`.

Each lab exposes its Canvas, fixture controls, state, procedure, expected evidence, limitations, and a collapsed syntax-highlighted source viewer. Legacy `#/scenarios` and `#/scenarios/<slug>` URLs redirect to this area.

## Headless and visual proof

Run the focused public-boundary test with:

```sh
pnpm test:smoke
```

The test imports the same lazy catalog entry and definition, then asserts mount, update, real browser click, reset, a post-reset click, disposal, source identity, and targeted Canvas pixels.

Representative full-page studio layouts are checked with:

```sh
pnpm test:studio-visual
```

The five exact baselines cover the landing page, a drawing primitive, a mouse-event lesson, an advanced interaction lesson, and an automated test lab. To intentionally adopt a reviewed design change, run `pnpm test:studio-visual:update`, inspect every updated image, and then rerun the normal comparison. CI never updates these baselines.

The approved baseline is `packages/core/test/visual-baselines/dep-01-smoke.expected.png`. Each run writes actual and diff-capable artifacts under ignored `test-screenshots/dep-01/`; the unified workflow is configured to upload that tree. The comparator is exact outside documented text masks. Text masks isolate cross-platform Arial glyph rasterization while semantic assertions and source identity protect the displayed values; structural backgrounds, borders, state rows, Canvas colors, and target pixels remain exact. A later bundled test font is preferable if text glyphs become a direct visual contract.

To prove the failure path without editing source or baselines:

```sh
VITE_CRC_VISUAL_DRILL=1 pnpm test:smoke
```

This intentionally compares the legitimate purple update state against the approved blue reset baseline. The command must fail and produce `smoke.expected.png`, `smoke.actual.png`, and `smoke.diff.png`. Run the normal command afterward and require green. Baselines are adopted only after inspecting all images; CI never updates them.

## Catalog boundaries

Learning sources contain no scenario IDs, marker boilerplate, fixture counters, or test-runner code. Their identity comes from the validated catalog path and content. Test scenarios retain those diagnostic contracts because they are useful verification fixtures. Changes to either catalog must regenerate [the example index](../scenario-index.md) with `pnpm scenarios:write-index`.
