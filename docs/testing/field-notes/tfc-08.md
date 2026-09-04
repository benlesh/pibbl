# TFC-08 field note — runtime and hook confidence

> **Historical status: COMPLETED FIELD RECORD.** Results are dated evidence and are not current API guidance or current test totals.

Date: 2026-08-11

## Scenario and risk

The cataloged `runtime-hooks-laboratory` exercises `crc`, `defineComp`, state, memo, ref, synchronous change cleanup, all three public memoized path hooks, falsy children, keyed sibling insertion/reordering/removal, component keys, root identity, and outside-render hook misuse. The gallery and headless suite load the same public-API example, controller, action IDs, catalog metadata, source marker, and source adapter. Existing TFC-04/TFC-05 interaction scenarios and direct lifecycle tests deliberately retain the `crcEvent` and `crcCursor` behavior matrix instead of duplicating it here.

The highest risks were silent identity or hook-slot reuse and updates losing one another before a frame. Before this step, a key replaced component type identity, distinct functions with the same name collided, a state update could cancel and discard a queued root replacement, hook order/count changes could reinterpret another hook's storage, and `crcLinePath` did not include `closePath` in its memo dependencies. A thrown render also needed to release partially acquired resources, restore temporary render state and the Canvas context, and permit a valid retry.

## Runtime contract table

| Contract           | Accepted behavior                                                                                                                                                                                                           | Primary proof                                                |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `defineComp`       | Each call creates a fresh element with the exact props and stable component-function type.                                                                                                                                  | Direct runtime contract and built public type consumer       |
| Mount/update       | One live Canvas returns one controller; multiple queued roots commit only the latest explicit root.                                                                                                                         | Direct runtime contract                                      |
| Merged updates     | State and explicit root updates share one pending frame without losing the root or parent-update intent.                                                                                                                    | Both update orders plus latest-root assertions               |
| Component identity | Identity contains function identity and optional encoded key. Same-name functions and same-key/different-type components remount.                                                                                           | Direct identity matrix                                       |
| Keyed siblings     | Reorder/insertion preserves surviving identities; removal tears down a key and later restoration remounts it.                                                                                                               | Direct runtime contract and shared laboratory                |
| Unkeyed siblings   | Same-type siblings use occurrence order. Insertion shifts identity by position.                                                                                                                                             | Direct characterization                                      |
| Duplicate keys     | Two explicit sibling keys under one parent throw a deterministic diagnostic.                                                                                                                                                | Direct error contract                                        |
| Falsy children     | `false`, `null`, `undefined`, `''`, and `0` render nothing and consume no identity slot.                                                                                                                                    | Direct contract, public type consumer, and shared laboratory |
| Failed render      | Context saves and temporary globals restore; component resources fail closed and are released; the next valid render remounts cleanly. Pixels already drawn before the throw are not presented as an atomic image rollback. | Direct render/memo failure and retry contracts               |
| Disposal/removal   | Removed, replaced, and disposed component hooks follow the TFC-07 exact ownership rules.                                                                                                                                    | TFC-07 cleanup suite plus TFC-08 key/root/removal cases      |

## Hook contract table

| Public hook      | Accepted behavior                                                                                                                                                                              | Primary proof                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `crcState`       | Initializes once per identity, preserves one setter, applies value/functional updates immediately to stored state, coalesces frames, and resets on remount. Dead setters remain inert.         | Direct state, stale-setter, and shared-scenario tests                  |
| `crcMemo`        | Reuses identity while dependency arrays are strictly element-equal; value or length changes recompute. `NaN` changes and `0`/`-0` compare equal under the explicit strict-equality contract.   | Direct hook contract                                                   |
| `crcRef`         | Returns one mutable object per hook identity, ignores later initializers, and does not schedule a render when `current` changes.                                                               | Strengthened committed ref suite, direct hook contract, and laboratory |
| `crcWhenChanged` | Runs synchronously on mount/change or every render without deps. Prior cleanup runs once before replacement setup, including when the new setup throws; removal runs the current cleanup once. | Direct hook/lifecycle contracts and laboratory counters                |
| `crcRectPath`    | Memo identity follows effective adjusted rectangle geometry.                                                                                                                                   | Direct controlled-`Path2D` contract and laboratory                     |
| `crcLinePath`    | Memo identity follows every coordinate and `closePath`.                                                                                                                                        | Direct controlled-`Path2D` contract and laboratory                     |
| `crcSvgPath`     | Memo identity follows the exact data string; browser `Path2D` owns parsing and errors propagate into the normal failed-render recovery path.                                                   | Direct controlled-`Path2D` contract and laboratory                     |
| `crcEvent`       | Global and path modes share one typed slot and release the previous mode before registering the next. Event ordering/target behavior remains the TFC-04/TFC-05 contract.                       | Direct slot transition plus shared interaction suites                  |
| `crcCursor`      | Default and path modes share one typed slot and release the previous default/region before registering the next.                                                                               | Direct cursor suite, slot transition, and shared interaction suites    |

Every public hook requires an active component render and throws the exact message `CRC hooks can only be called while rendering a component.` otherwise. Each hook class has a distinct slot kind. Rendering more hooks, fewer hooks, or a different kind at an existing index throws a deterministic diagnostic. A shorter render releases omitted suffix resources before the render fails; the failed-render boundary then releases the remaining component tree so a valid retry starts cleanly.

## Manual evidence

The source gallery was exercised in the in-app Chromium browser at `http://127.0.0.1:5183`, using the desktop viewport and DPR 1.

- **Increment state** changed state `0 → 1`, render count `1 → 2`, and the probe from blue to purple.
- **Mutate ref** changed the visible ref value `0 → 1` without advancing the render count.
- **Stable render** preserved the memo identity, ref identity, and path identities `#2 / #3 / #4`.
- **Change dependency** changed memo creation `1 → 2`, paths `#2 / #3 / #4 → #7 / #8 / #9`, and change ownership `1 acquired / 0 cleaned → 2 acquired / 1 cleaned`; the triangle changed from orange to pink.
- **Reorder siblings**, **Insert sibling**, and **Remove sibling** moved the sky, green, and orange blocks while preserving identities `a = 5`, `b = 6`, and `c = 10` for every surviving key.
- **Replace component key** produced fresh state, ref, memoized paths, and one cleanup. **Remove component** cleared the probe and balanced cleanup; **Restore component** created a fresh hook generation.
- **Replace root** changed root `a → b`, changed the background, cleaned the old subtree, and remounted all hook and sibling identities.
- **Probe hook misuse** reported `9 · Error × 9` with the exact shared diagnostic. The next state action still rendered correctly.
- **Reset** restored the exact initial counters, identities, sibling order, colors, and pixels.

Screenshots covering the initial composition, state/ref transitions, dependency/path change, sibling reorder/insert/remove, component removal/restoration, root replacement, misuse recovery, and reset were inspected. The console contained only Vite connection/debug messages and no warnings or errors.

## Headless and package evidence

The headless integration suite imports the catalog entry and raw source adapter, drives the same public controls, checks the formatted diagnostics, and asserts exact text-free pixels for the background, state probe, dependency triangle, sibling colors/order, removal, and root replacement. Direct tests supplement the public laboratory with errors that should not intentionally corrupt the gallery: duplicate keys, hook-count/order mismatch, render and memo factory failures, queued update merging, same-name component functions, and malformed SVG path parsing.

Independent verification used Node 24.19.0 and pnpm 11.21.0:

- the focused runtime/hook/ref/scenario matrix passed 51/51 at the integrated review point;
- after the final failed-render retry hardening, its focused runtime/hook/path/scenario matrix passed 30/30;
- the complete browser suite passed 207 tests with 4 pre-existing drawing-component skips assigned to TFC-09;
- TypeScript 7 checking, ESLint, and Prettier checks passed;
- declaration and ESM package builds passed;
- strict Bundler and NodeNext public API consumers passed;
- the built runtime export-list consumer passed;
- source and built gallery production builds passed.

The public type fixture covers positive inference and intentional failures for `defineComp`, `crc`, controller/signal types, state/updaters, memo dependencies, refs, synchronous change callbacks, all path hooks, event names/event shape, and cursor options. The package export map now exposes only the root, types, and package metadata; the runtime consumer also proves that `@crc/core/lib/*` internals are rejected rather than resolving declaration-only paths.

## Visual strategy

Runtime identity and hook ownership are primarily semantic contracts, so the durable visual gate uses exact Canvas pixels rather than a font-sensitive screenshot baseline. Pixel probes cover both root backgrounds, state colors, dependency triangle colors, all keyed sibling colors and positions, component absence, and reset. The gallery state panel makes identity and acquisition/cleanup changes manually inspectable, while headless assertions remain the pass/fail oracle.

## Legacy test and branch review

The committed `crcRef` suite originated on `crc-ref-tests`. Its `.only` marker had already been removed and its types cleaned before TFC-08. The three useful behaviors—persistence, mutation without rerender, and multiple refs—were retained. TFC-08 added direct initializer/object-identity/key-remount coverage, public type assertions, and explicit controller ownership so the interaction helper no longer leaves CRC instances mounted between tests.

`origin/jess/tests-for-utils` was reviewed selectively rather than merged. It combines old browser-runner imports, CI/config/lockfile changes, unrelated component edits, broad utility tests, and a skipped single-point case. The useful intent was recreated against current contracts: dependency-array equality is covered through `crcMemo`, and line construction/`closePath` is covered through the public memoized hook with controlled `Path2D` commands. Stale branch infrastructure and unrelated source changes were rejected.

## Surprises, failures, and rejected approaches

- A key alone was not a complete identity: it allowed two different component types to share hook state. Function identity and key are both required.
- Function names are diagnostic labels, not identity. Two distinct functions can legally have the same name.
- Coalescing animation frames was correct but insufficient; root and state updates also needed retained pending intent.
- Generic storage indices could not diagnose order changes. Typed hook slots were needed for state, memo, ref, change cleanup, path hooks, event, and cursor resources.
- The first error-recovery pass restored global state but still read the mutable global component pointer after child rendering cleared it. Keeping a local parent ref made sibling traversal and after-render ownership stable.
- A throwing `crcWhenChanged` replacement initially left the prior cleanup referenced, allowing retry to invoke it twice. Ownership is cleared before running the old cleanup and before calling the new setup.
- `closePath` looked like construction configuration rather than geometry, but omitting it from memo dependencies returned observably stale paths.
- Rejected silently accepting duplicate explicit keys. A deterministic error exposes the ambiguous tree immediately.
- Rejected blindly merging the utility branch or preserving screenshot-only utility tests. Current public contracts and exact commands/pixels provide narrower evidence.
- Rejected exposing hook-count corruption as a manual gallery action. Focused tests own the destructive error path; the gallery uses recoverable outside-render misuse.

## Helper and tooling opportunities

Recurring friction supports four candidates for later TFC-10 review:

1. a shared manual-frame harness for latest-root, cancellation, and thrown-callback tests;
2. a controlled `Path2D` recorder with standard identity and command assertions;
3. a reusable component harness that always owns and disposes its controller;
4. a built-package type fixture helper that pairs positive inference, `@ts-expect-error`, runtime export enumeration, and negative internal-subpath imports.

The hook-slot mechanism is production runtime behavior, not test tooling. The other helpers should remain internal until repeated use proves a stable API.

## Decisions and follow-ups

- Component identity is function identity plus optional explicit key; unkeyed same-type siblings use occurrence order.
- Explicit sibling keys must be unique under one parent.
- Hook order and count are runtime contracts with intentional diagnostics, and outside-render misuse has one exact message.
- A thrown render fails closed: it releases component resources and permits a clean remount, but does not promise an atomic pixel rollback.
- Root updates and state-driven parent updates merge until the scheduled frame; the latest explicit root wins.
- Memo dependencies use strict equality, and path hooks own distinct slot kinds and complete effective-geometry dependencies.
- TFC-09 owns the remaining four drawing-component skips and drawing-specific edge contracts; they do not weaken the completed runtime/hook matrix.
