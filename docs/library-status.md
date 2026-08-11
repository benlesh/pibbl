# CRC library status and feature inventory

_Snapshot refreshed: 2026-08-11, against `main` through `43b0d27`_

## At a glance

CRC is a small, functional component-style rendering layer over the HTML Canvas 2D API. The current package supports a render tree, scheduled updates, stateful hooks, mouse hit testing, transforms, clipping, offscreen layers, and a useful set of drawing primitives.

The implementation is ahead of its documentation, but the tests are unevenly distributed. The committed browser suite passes **70 tests with 4 skipped**. Most of those tests cover `clip`, `g`, `img`, `layer`, `line`, `rect`, and `text`, with a small direct `crcRef` suite; many other public exports have only indirect coverage or none at all. Rendering tests also tend to take screenshots without comparing them to approved images, so a passing rendering test often proves “rendered without throwing,” not “the pixels are correct.”

This is an inventory, not a project plan. “Remaining work” lists the clearest gaps to use when building that plan.

## How to read test confidence

- **Substantial** — direct browser tests cover the main behavior and several interactions or variants. Important edge cases may remain.
- **Partial** — some direct tests exist, or the feature is exercised meaningfully through another feature, but important behavior is unverified.
- **Minimal** — the feature is reached incidentally by other tests; its own contract is not tested.
- **None** — no committed test was found that meaningfully exercises the feature.
- **WIP** — test work exists outside the committed `main` baseline.

These labels describe the evidence in the repository, not line or branch coverage; coverage instrumentation is not currently configured.

## Public feature inventory

### Runtime and component model

| Feature / API                                     | Current behavior                                                                                                                                                                                      | Test confidence                                                                                                                                                                          | What remains                                                                                                                                                                                                                   |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Mount and update: `crc(canvas, element, config?)` | Mounts a component tree on an `HTMLCanvasElement`, then schedules renders with `requestAnimationFrame`. Repeated calls update the root. An optional `AbortSignal` tears the instance down.            | **Partial.** Every component test mounts through `crc`, and one smoke test renders a rectangle. Mount-vs-update, abort cleanup, cancellation, and error paths are not directly asserted. | Add lifecycle tests for initial mount, repeated root updates, coalesced frames, abort/unmount cleanup, and attempts to update an unmounted canvas. Decide whether a public unmount API is needed in addition to `AbortSignal`. |
| Component creation: `defineComp`                  | Wraps a component function so calls return a component element rather than rendering immediately. This is the non-JSX authoring API.                                                                  | **Partial.** Used by all built-in components and test components, but its return contract is not tested directly.                                                                        | Add a small contract/type test and document how to write custom components.                                                                                                                                                    |
| Tree rendering, children, identity, and `key`     | Recursively renders a component tree, assigns path-like identities, preserves hook slots, and tears down disappeared components. Sibling collisions are numbered; `key` overrides the component name. | **Partial.** Nested groups, clips, and layers exercise tree traversal. Identity, keyed reordering, removal, hook-order errors, and teardown behavior are not tested directly.            | Add reconciliation/lifecycle tests, especially keyed siblings, insertion/removal/reordering, and cleanup when a subtree disappears. Clarify whether hook-order rules intentionally mirror React’s.                             |
| Canvas event bridge                               | Registers one native listener per supported mouse event on the root canvas and relays events to component hit tests. Offscreen layers forward through the parent instance.                            | **Partial.** Component interaction tests cover the common events; layer forwarding has one passing test and one multi-layer test skipped.                                                | Commit and resolve the direct `crcEvent` tests, test listener cleanup and handler replacement, and define event ordering and overlap/propagation semantics.                                                                    |
| Teardown management                               | Internal teardown collections clean component resources and nested instances.                                                                                                                         | **None** direct.                                                                                                                                                                         | Test one-time execution, parent/child following, removal, component disappearance, abort, and async callbacks that fire after unmount.                                                                                         |

### Drawing components

| Feature / API                     | Current behavior                                                                                                                                                                         | Test confidence                                                                                                                                         | What remains                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rectangle: `rect`                 | Draws a `Path2D` rectangle with fill, stroke, alpha, cursor, pixel-grid alignment, and mouse events.                                                                                     | **Substantial:** 9 passing browser tests cover basic rendering, cursor, and all common mouse event categories.                                          | Add assertions for fill/stroke/alpha output, all pixel-grid modes, transparent/no-fill behavior, negative dimensions, and prop updates. Current screenshot capture is not visual regression testing.                                                                                                                                                                                                      |
| Arbitrary path: `path`            | Fills and/or strokes a supplied `Path2D`, applies alpha, and wires cursor and hit-tested events. This is the base used by several shapes.                                                | **Minimal.** Covered indirectly through `rect`; there is no direct path suite.                                                                          | Add direct fill/stroke/combined/transparent/alpha tests, line hit-width tests, event tests, and dynamic path replacement. Fix the current lint error in the stroke assignment. Verify and define `alpha: 0` behavior; the current truthy check does not apply zero.                                                                                                                                       |
| Polyline: `line`                  | Builds a `Path2D` from coordinate pairs and delegates drawing and events to `path`.                                                                                                      | **Substantial:** 7 passing direct tests cover basic/styled/multipoint rendering and click/movement interactions with and without an expanded hit width. | Add empty/single-point input, coordinate updates, alpha, and transformed/clipped interactions. Replace screenshot-only rendering checks with pixel or approved visual comparisons.                                                                                                                                                                                                                        |
| Horizontal line: `horizontalLine` | Draws a horizontal line with default left/right bounds from the canvas, optional pixel alignment, styles, cursor, and events.                                                            | **None** direct.                                                                                                                                        | Test defaults, custom bounds, each pixel-grid mode, event hit width, transforms, and prop updates. Align the default behavior with `verticalLine` (one defaults alignment to absent, the other to `'none'`).                                                                                                                                                                                              |
| Vertical line: `verticalLine`     | Draws a vertical line with default top/bottom bounds from the canvas, optional pixel alignment, styles, cursor, and events.                                                              | **None** direct.                                                                                                                                        | Test the same contract as `horizontalLine`, including defaults and parity between the two helpers.                                                                                                                                                                                                                                                                                                        |
| SVG path: `svgPath`               | Creates a `Path2D` from SVG path data and delegates to `path`.                                                                                                                           | **None** direct.                                                                                                                                        | Add valid/invalid SVG data tests, fill/stroke and interactions, prop updates, transformed paths, and documentation examples.                                                                                                                                                                                                                                                                              |
| Text: `text`                      | Draws fill/stroke text with font, alignment, baseline, max dimensions, wrapping, and `visible`, `squish`, `ellipsis`, or `clip` overflow modes; it can also receive mouse events.        | **Substantial:** 10 passing browser tests cover rendering, common mouse events, ellipsis, and word wrapping.                                            | Test `squish`, `clip`, max height, multiline edge cases, alignment/baseline hit bounds, stroke+fill, empty/long words, and prop updates. `TextProps` advertises `alpha`, but the implementation never applies it; implement or remove that prop.                                                                                                                                                          |
| Image: `img`                      | Loads an image URL, rerenders when it loads, supports natural or explicit dimensions, optional border, alpha, pixel alignment, cursor, and mouse events.                                 | **Substantial:** 12 passing browser tests cover rendering, natural dimensions, events, alpha, pixel alignment, and cursor.                              | Test load failure, source replacement and races, unmount-before-load, zero dimensions, all alignment modes, CORS/tainted-canvas expectations, and `alpha: 0`. Consider aborting or ignoring stale loads.                                                                                                                                                                                                  |
| Transform group: `g`              | Applies scale, rotation around an optional origin, translation, and X/Y skew to children.                                                                                                | **Substantial:** 15 passing tests cover individual, nested, and compound transforms, transformed events, and mixed shapes/text.                         | Add prop-update tests, zero/negative scales, transform reset/isolation between siblings, and interactions combined with clipping and layers. Remove or implement the unused `clipFillRule` prop.                                                                                                                                                                                                          |
| Clip group: `clip`                | Clips child rendering to a `Path2D` using `nonzero` or `evenodd`, and records clip paths for event hit testing.                                                                          | **Partial:** 7 passing tests cover rendering and basic clipped interactions; 1 nested-interaction test is skipped.                                      | Fix/define nested clip hit testing and enable the skipped test. The current hit-test helper accepts a point inside any clip in the stack; nested canvas clipping normally requires it to be inside every active clip. Add transformed and dynamically changed clips.                                                                                                                                      |
| Offscreen layer: `layer`          | Renders a component to an `OffscreenCanvas`, composites it onto the parent, and avoids some rerenders by shallowly comparing root props. Events are forwarded through the parent canvas. | **Partial:** 6 passing tests and 3 skipped. Basic rendering, dimensions, nesting, multiple layers, one optimization case, and one event case pass.      | Fix and enable the skipped prop-change, resize, and multi-layer event tests. Resolve the two type errors in the skipped test setup. Test teardown, deep/nested prop changes, root component type changes, pixel density, and environments without `OffscreenCanvas`. Review the comparison/update logic: the layer currently passes the existing root back to `executeRender` rather than `props.render`. |

### Hooks and interaction helpers

| Feature / API                             | Current behavior                                                                                                                                                     | Test confidence                                                                                                                                                                                                                                   | What remains                                                                                                                                                                                                                            |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mouse events: `crcEvent`                  | Supports `click`, `dblclick`, `contextmenu`, `mousemove`, `mouseover`, `mouseout`, `mousedown`, and `mouseup`, with fill/stroke hit testing and clipping/transforms. | **WIP.** The untracked `crc-event.test.ts` adds 19 tests: 15 pass and 4 fail because observed order is `mousemove` then `mouseover`, while the tests expect the reverse. Committed component tests already exercise the common events indirectly. | Decide and document event order, then fix either implementation or expectations. Format and commit the WIP suite. Add overlapping-element semantics, handler errors, handler replacement/removal, no-path behavior, and teardown tests. |
| Cursor: `crcCursor`                       | Sets the canvas CSS cursor while the pointer is over a hit-tested path, then removes it on exit.                                                                     | **Partial.** Covered through `rect` and `img`.                                                                                                                                                                                                    | Add direct tests for competing/overlapping cursor regions, handler teardown, missing paths, prop changes, and leaving the canvas.                                                                                                       |
| State: `crcState`                         | Stores a hook value and schedules a root rerender; accepts a value or updater function. Multiple updates before a frame are coalesced by the render scheduler.       | **Minimal.** Exercised by image loading and some test components, but its contract is not directly tested.                                                                                                                                        | Test initialization, persistence, functional updates, batching, nested-layer parent updates, setter identity, and calls after unmount.                                                                                                  |
| Memoization: `crcMemo`                    | Reuses a value while a shallow dependency array is unchanged.                                                                                                        | **Minimal.** Used indirectly by path hooks.                                                                                                                                                                                                       | Add direct tests for mount/update behavior, dependency changes, empty dependencies, changing dependency-array length, and misuse outside render. Clarify the declared `deps` type versus the internal `!deps` branch.                   |
| Synchronous change hook: `crcWhenChanged` | Runs a callback synchronously when shallow dependencies change and supports a returned teardown.                                                                     | **Minimal.** Used by image loading; teardown behavior is not tested.                                                                                                                                                                              | Add direct tests for first render, unchanged/changed/no dependencies, teardown order, unmount cleanup, errors, and re-entrant state updates. Review teardown registration to ensure callbacks cannot execute twice.                     |
| Mutable reference: `crcRef`               | Returns a stable `{ current }` object across renders without scheduling renders when it changes.                                                                     | **Partial:** 3 passing direct tests cover persistence, no rerender after mutation, and multiple refs.                                                                                                                                             | Add initial-value/update/order tests, invalid hook-order behavior, and keyed tree unmount/remount coverage. Fix the three current lint errors in the test types.                                                                        |
| Rectangle path: `crcRectPath`             | Memoizes a rectangular `Path2D` and optionally aligns it to the pixel grid.                                                                                          | **Minimal.** Exercised by `img`; no direct contract tests.                                                                                                                                                                                        | Add memo identity, dimension/update, pixel-alignment, and zero/negative-size tests.                                                                                                                                                     |
| Line path: `crcLinePath`                  | Memoizes a polyline `Path2D`; optionally closes the path.                                                                                                            | **None** direct.                                                                                                                                                                                                                                  | Test path construction, `closePath`, memo identity, coordinate mutations, empty/single-point inputs, and dependency behavior.                                                                                                           |
| SVG path hook: `crcSvgPath`               | Memoizes a `Path2D` made from SVG path data.                                                                                                                         | **None** direct.                                                                                                                                                                                                                                  | Test memo identity, data changes, malformed input behavior, and browser compatibility expectations.                                                                                                                                     |

### Types, packaging, documentation, and examples

| Feature / area         | Current behavior                                                                                                                                                                                                    | Test confidence                                                                                                                                                                                                                                      | What remains                                                                                                                                                                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public TypeScript API  | `@crc/core` exports component props plus selected canvas/event types.                                                                                                                                               | **Partial.** The project compiles enough to build declarations, but `pnpm typecheck` currently fails on 2 errors in `layer.test.ts`. There are no committed public API type tests.                                                                   | Fix typecheck, add positive and `@ts-expect-error` API tests, and decide which internal concepts are intentionally public.                                                                                                                                              |
| `@crc/types` package   | Published package scaffolding exists, but `src/index.ts` exports nothing. `@crc/core` re-exports it and also builds a `types` entry.                                                                                | **None.** The build succeeds but produces an effectively empty package.                                                                                                                                                                              | Populate it with shared public types or remove the separate package/export until needed. Test package-level imports from built artifacts.                                                                                                                               |
| Package build          | `pnpm build` successfully builds ESM and declarations. In this snapshot, the core JS entry is 30.5 kB uncompressed; the build reports 50.2 kB total artifacts.                                                      | **Partial.** Build passes; no consumer/package smoke test exists.                                                                                                                                                                                    | Add packed-package import tests, verify declaration exports and tree shaking, establish a bundle-size budget, and replace the README’s `~XXXXkb gzipped` placeholder with a measured value.                                                                             |
| Playground             | One Vite playground renders a red rectangle. `pnpm dev` and `pnpm playground` start it successfully at `http://localhost:5173`.                                                                                     | **Minimal.** Direct playground production build passes, but there is no automated behavior test.                                                                                                                                                     | Expand it into examples for every component/hook or restore the richer playground work from the existing branch. Add a smoke test. Fix the root `playground:build` script, which runs in `docs` even though that directory is not a package and has no matching script. |
| README and guides      | The root README has a feature list and sample, but it references nonexistent `Canvas` and `Circle` exports and links to missing guides and example directories. The package READMEs contain almost no API guidance. | **None.**                                                                                                                                                                                                                                            | Rewrite the quick start using the actual `crc`/`rect` API; document all public exports; either create the linked guides/examples or remove the links; correct repository links and attribution placeholders.                                                            |
| Continuous integration | Separate GitHub Actions workflows install Node 22 and pnpm for browser tests, lint, and typecheck on pull-request activity.                                                                                         | **Partial.** The jobs exist, but typecheck and lint are currently red; builds and package/playground smoke checks are absent. Workflows use `pnpm/action-setup@v2` with `latest`, which is not aligned with the repository’s pinned package manager. | Make the existing jobs green, align pnpm setup with `packageManager`, add build/package/playground checks, decide whether direct pushes need coverage, and avoid failing artifact upload when no screenshots exist.                                                     |

## Current verification snapshot

Commands were run from the repository root on 2026-08-11.

| Check                                    | Result   | Notes                                                                                                                                                      |
| ---------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Install                                  | **Pass** | `pnpm install --frozen-lockfile` completed from the existing lockfile.                                                                                     |
| Committed browser tests only             | **Pass** | 9 files; 70 passed, 4 skipped.                                                                                                                             |
| Whole working-tree browser suite         | **Fail** | 85 passed, 4 failed, 4 skipped. All failures are in the untracked `crc-event.test.ts` and concern `mousemove`/`mouseover` ordering.                        |
| Typecheck                                | **Fail** | 2 errors in `layer.test.ts`: unsupported `children` and `onRender` props supplied to `rect`.                                                               |
| Lint, excluding the untracked event test | **Fail** | 9 errors and 1 warning across the README example, one layer test, `path.ts`, the new `crcRef` test, `is-transparent.ts`, `test-utils.ts`, and `update.ts`. |
| Lint, whole working tree                 | **Fail** | 94 errors and 1 warning; most additional errors are formatting in the untracked event test.                                                                |
| Package build                            | **Pass** | Both `@crc/types` and `@crc/core` build.                                                                                                                   |
| Playground build, direct package command | **Pass** | `pnpm -C playground run playground:build`.                                                                                                                 |
| Root playground build script             | **Fail** | `pnpm playground:build` runs in `docs`, which has no package manifest or `playground:build` script.                                                        |

Skipped committed tests:

- Nested clip-region interaction.
- Layer rerender when props change.
- Layer rerender when dimensions change.
- Events with multiple layers.

## Running locally

### Prerequisites and first-time setup

The CI configuration uses Node.js 22. The repository pins pnpm 9.13.2 in `package.json`.

```sh
corepack enable
corepack prepare pnpm@9.13.2 --activate
pnpm install --frozen-lockfile
```

If the browser tests report that Chromium is missing, install the Playwright browser once:

```sh
pnpm exec playwright install chromium
```

On Linux CI or a fresh Linux machine, use `pnpm exec playwright install --with-deps chromium` instead.

### Run the playground

The most complete development command stubs the workspace packages, then starts Vite:

```sh
pnpm dev
```

For the current source-mapped playground alone:

```sh
pnpm playground
```

Open <http://localhost:5173/> and stop the server with `Ctrl+C`.

There is currently only this single playground; the `examples/*` directories linked from the README do not exist on `main`.

### Run tests

Headless, one run (the command used by CI):

```sh
pnpm test:ci
```

Interactive/headful Vitest browser mode:

```sh
pnpm test
```

Headless watch mode:

```sh
pnpm test:watch
```

Because this working tree currently contains the untracked `packages/core/src/lib/hooks/crc-event.test.ts`, the full commands include that WIP suite and presently report four failures. To run only the committed baseline without moving that file:

```sh
pnpm exec vitest run \
  packages/core/src/lib/components \
  packages/core/src/lib/hooks/crc-ref.test.ts \
  packages/core/test/browser.test.ts \
  --browser.headless
```

### Other useful checks

```sh
pnpm typecheck
pnpm lint
pnpm build
pnpm -C playground run playground:build
```

`typecheck` and `lint` are currently red as described above. Use the direct playground build command; the root `pnpm playground:build` script is currently broken.

## Existing work outside `main`

Review these before recreating the same work:

| Branch / working tree                                     | Relevant work                                                                                                                                                               | Caution                                                                                                                                                                  |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Untracked `packages/core/src/lib/hooks/crc-event.test.ts` | 19 direct event tests.                                                                                                                                                      | 4 ordering failures and substantial lint cleanup remain. This file belongs to the current working tree and was not modified during this review.                          |
| `origin/jess/tests-for-utils`                             | Tests for path creation, hit testing, transparency, pixel alignment, equality helpers, typed entries, and common event wiring; also lint/typecheck workflow work and fixes. | It is a broad branch with more than tests, so extract or rebase deliberately.                                                                                            |
| `origin/jess/jsx-support`                                 | Initial JSX runtime, transform, Vite plugin, playground use, and tests.                                                                                                     | This is not part of the current published/main API. It needs an explicit product decision and current-main rebase before being listed as a supported feature.            |
| `origin/jess/playground-and-types`                        | A much richer browser playground/editor plus JSX/type work.                                                                                                                 | Large, mixed-scope WIP branch (135 changed files versus current `main`); treat as a source of ideas or selectively recover it rather than assuming it is ready to merge. |

## Suggested planning themes

The later project plan will likely be clearest if it separates five tracks:

1. **Make the baseline trustworthy:** resolve the WIP event expectations, enable skipped tests, fix typecheck/lint, and add real visual assertions or focused canvas-pixel assertions.
2. **Close public API coverage gaps:** prioritize lifecycle/state, `path`/`line`, horizontal/vertical lines, SVG paths, and hook contracts.
3. **Resolve correctness questions:** nested clip intersections, layer updates, event ordering/overlap, alpha-zero behavior, and text alpha/hit bounds.
4. **Make the library learnable:** correct the README, document the actual API, and build representative examples in the playground.
5. **Choose the future surface:** decide whether to revive JSX, the richer playground, and the separate `@crc/types` package before investing in publication polish.

## Evidence reviewed

- Public exports and implementation under `packages/core/src/`.
- Committed and untracked browser tests under `packages/core/`.
- Workspace scripts, build configs, Vitest config, and GitHub Actions workflow.
- Root and package READMEs plus the current Vite playground.
- Relevant local and remote Git branches listed above.
- Local install, test, lint, typecheck, build, and playground verification runs.
