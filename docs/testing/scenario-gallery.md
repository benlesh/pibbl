# Shared scenario gallery

CRC scenarios are authored once against the public `@crc/core` API and consumed through a lazy, presentation-neutral catalog. The local gallery, browser tests, and a future documentation renderer are peers over that contract; none depends on another adapter.

## Architecture

```text
catalog metadata + lazy loader + source identity
                    |
          scenario definition/controller
             /             |            \
     local gallery    headless driver    future docs
```

- `packages/scenarios/src/catalog.ts` contains import-safe metadata, actions, source identity, validation, and lazy loaders. Importing it does not mount a scenario or import gallery/test frameworks.
- Every `packages/scenarios/src/**/*.example.ts` file is readable public-API source. Its scenario controller owns state, actions, render settlement, reset, and disposal.
- `packages/scenarios/src/surface.ts` is an optional gallery surface adapter available only through the explicit `@crc/scenarios/surface` subpath. It is not exported from the package root or imported by the catalog.
- `playground/src/scenario-sources.ts` is the only Vite-specific raw-source adapter. Its recursive glob discovers every example and verifies both path and source marker.
- `tooling/scenario-catalog.ts` independently discovers the same files from disk, loads every definition, and checks the generated [scenario index](../scenario-index.md).
- `packages/core/test/scenario-catalog.test.ts` mounts every entry, executes each registered action in isolation, resets it, and disposes it without importing gallery UI.

`loadScenario(entry)` rejects a definition whose ID, source ID, or ordered action IDs differ from its catalog entry. Catalog validation also rejects duplicate IDs/slugs/actions, empty tags/instructions/reasons, invalid dimensions, and non-TypeScript source references.

## Required metadata

Every entry supplies a stable ID and slug, title, summary, category, API and concept tags, manual steps with expected observations, known limitations, source identity/path, actions, Canvas dimensions, visibility, maturity, and a visibility reason.

Visibility has two initial classes:

- `documentation-candidate`: readable public-API teaching material that a future docs projection may publish.
- `test-laboratory`: diagnostic, lifecycle, stress, or performance material that belongs in the complete internal gallery but is not automatically public documentation.

Maturity is one of `baseline`, `characterization`, `contract`, or `trusted`. It describes evidence state, not presentation quality.

## Run the indexed gallery

From the repository root:

```sh
pnpm playground
```

Open <http://localhost:5173/#/scenarios>. The index presents all executable scenarios by learning progression, public API, concept, category, and visibility/maturity. Each scenario retains a stable `#/scenarios/<slug>` route.

To exercise the baseline first, open <http://localhost:5173/#/scenarios/baseline-smoke>.

1. Confirm the initial blue rectangle reports revision `0`, clicks `0`, and last action `mount`.
2. Choose **Update scene**. The rectangle becomes purple, revision becomes `1`, and last action becomes `update`.
3. Click inside the colored rectangle. It becomes orange, clicks becomes `1`, and last action becomes `click`.
4. Choose **Reset**. The blue scene returns with revision and clicks at `0` and last action `reset`.

The gallery exposes source, exact instructions, expected results, live state, reset, tags, visibility, maturity, and limitations from the catalog entry. The Canvas itself has no keyboard click equivalent because CRC's current public API is mouse-only; that limitation is explicit rather than hidden by the gallery.

## Headless and visual proof

Run the focused public-boundary test with:

```sh
pnpm test:smoke
```

The test imports the same lazy catalog entry and definition, then asserts mount, update, real browser click, reset, a post-reset click, disposal, source identity, and targeted Canvas pixels.

The approved baseline is `packages/core/test/visual-baselines/dep-01-smoke.expected.png`. Each run writes actual and diff-capable artifacts under ignored `test-screenshots/dep-01/`; CI already uploads that tree. The comparator is exact outside documented text masks. Text masks isolate cross-platform Arial glyph rasterization while semantic assertions and source identity protect the displayed values; structural backgrounds, borders, state rows, Canvas colors, and target pixels remain exact. A later bundled test font is preferable if text glyphs become a direct visual contract.

To prove the failure path without editing source or baselines:

```sh
VITE_CRC_VISUAL_DRILL=1 pnpm test:smoke
```

This intentionally compares the legitimate purple update state against the approved blue reset baseline. The command must fail and produce `smoke.expected.png`, `smoke.actual.png`, and `smoke.diff.png`. Run the normal command afterward and require green. Baselines are adopted only after inspecting all images; CI never updates them.

## Future documentation seam

A future renderer should import the catalog, filter `documentation-candidate` entries, group by category/API/concept/learning order, load definitions lazily, and provide its own presentation. It may reuse the raw-source identity adapter pattern but must not copy example code into prose metadata or depend on the playground UI. Published scenario URLs should retain their catalog slugs.
