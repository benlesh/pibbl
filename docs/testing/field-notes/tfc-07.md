# TFC-07 field note — whole-runtime cleanup

Date: 2026-08-11

## Scenario and risk

The cataloged `runtime-cleanup-stress` laboratory exercises pending frames, current/superseded/broken images, single and nested layers, synchronous `crcWhenChanged` cleanup, component keys, root identities, abort/dispose/remount, repeated cleanup, and 1,000 fully rendered mount/dispose cycles. The gallery and the headless suite load the same public-API scene, controller, action IDs, and source marker.

The highest risks were resources with more than one apparent owner and asynchronous work retaining authority after its component died. In the starting implementation, change-hook cleanups belonged to both component and main teardown Sets; stale state setters knew only their Canvas; and `img` load handlers had no error, generation, or removal cleanup.

## Manual evidence

The source gallery was exercised in the in-app Chromium browser at `http://127.0.0.1:5182`, using the desktop viewport and DPR 1.

- Queueing a normal frame advanced the displayed request count. Abort released the mounted hook once. After remount, **Dispose with pending frame** atomically queued and disposed the next frame; the completed-render count did not advance, the runtime reported disposed, and repeated cleanup did not change the cleanup count.
- The primary SVG data image rendered a cyan rectangle and pale circle; changing source replaced it with the pink triangle; the broken source and removed image left only the background. No older image repainted.
- A single layer rendered orange, nested layers rendered green at the nested position, and removal restored background pixels with the hook probe still live.
- Dependency change, key replacement, component removal/restoration, and root replacement kept setup minus cleanup equal to one live hook. The root background and component probe changed with the selected state.
- The 1,000-cycle control reached mount generation 1,002. After earlier manual identity actions, the displayed totals were 1,006 acquisitions, 1,005 cleanups, and 1,008 completed renders: exactly one setup remained live and the six earlier settled transition renders remained visible in the total.
- Reset returned the initial mounted probe, hidden image/layers, zero cycle count, and one live hook generation.

Screenshots of the primary image, secondary image, broken-image absence, and nested-layer state were inspected. The console contained only Vite connection debug messages and no warnings or errors.

One expected Vite HMR reset occurred while the catalog checklist was corrected concurrently; state-dependent sequences were rerun after the reload. Manual testing also found that `cleanup-again` initially targeted the current live remount after the 1,000-cycle action while leaving the displayed status as mounted. The controller was corrected to re-clean the stale lifetime when one exists, and a regression now preserves the live post-cycle baseline.

## Headless evidence

The exact shared laboratory passes seven integration cases. Test-owned diagnostics instrument native listeners, frames, instance/ref maps, regions, and teardown counts without entering the production bundle. A controlled `Image` implementation saves old callbacks deliberately, completes sources out of order, and fires callbacks after removal/disposal.

The 1,000-cycle case settles a real render before every disposal. Its accepted ledger is:

| Resource                |      Acquired/requested |      Released/completed | Live/pending before final disposal |
| ----------------------- | ----------------------: | ----------------------: | ---------------------------------: |
| CRC instances           |                   1,002 |                   1,001 |                                  1 |
| Native Canvas listeners |                   8,016 |                   8,008 |                                  8 |
| Animation frames        |                   2,004 |                   2,004 |                                  0 |
| Component refs          | `baseline refs × 1,002` | `baseline refs × 1,001` |                    `baseline refs` |
| Hook generations        |                   1,002 |                   1,001 |                                  1 |

Final controller disposal makes every live count zero and acquisition equal release. Global current-instance/component/canvas/context/seen-set slots are `undefined`, mounting is false, hook index is zero, and the clip stack is empty both at the live baseline and after final disposal.

The independent supported-environment review used Node 24.19.0 and pnpm 11.21.0. The integrated focused cleanup suite passed 41/41; the independent full browser suite passed 177 tests with 4 intentional skips. TypeScript 7 checking, lint/format, package builds, strict package consumers, and diagnostic package-boundary inspection passed.

## Visual strategy

Lifecycle correctness is primarily semantic and ledger-based. Visual evidence uses exact text-free pixel assertions for the initial/root backgrounds, hook probe, cyan/pink images, broken/removed-image absence, orange layer, green nested layer, and post-removal background. This avoids a broad screenshot baseline whose state panel text would add platform-font noise while still proving that removed resources stop drawing.

## Surprises, failures, and rejected approaches

- Instance/ref identity alone did not make state setters safe during teardown because refs-map deletion happens after teardown execution. The closed component/main teardown checks are required.
- The first stress-loop draft mounted and disposed before its first frame. It exercised listeners and cancellation but acquired no components or hooks, so every cycle was changed to settle one real render.
- A human cannot reliably click Queue frame and then Abort before the next display frame. The manual checklist now uses the atomic Dispose-with-pending-frame action for that proof; automation separately controls the exact frame ledger.
- Retaining the prior loaded image until a replacement settles was rejected for this component contract. Source-tagged state makes source changes, errors, and races visibly deterministic.
- GC/heap thresholds were rejected as the primary oracle. Exact owners, callbacks, frames, maps, refs, pixels, and idempotent release counts are reproducible.
- A general async-effect abstraction was rejected as out of scope; the existing hook and image component now own their current resources narrowly.

## Helper and tooling opportunities

Recurring friction now supports three concrete candidates for TFC-10 review:

1. promote the test-only runtime diagnostics into a reusable internal test helper that composes listener, frame, instance/ref, region, teardown, and temporary-global ledgers without per-suite monkey-patch code;
2. add a controlled browser async-resource scheduler for image/load/error/out-of-order/late completion cases;
3. add a shared settled-cycle driver that reports acquisition/release/live deltas and distinguishes pre-frame cancellation from fully rendered mount/unmount stress.

The controlled image scheduler and exact structure ledger were useful here, but neither has enough cross-feature use yet to justify a production dependency or public API.

## Decisions and follow-ups

- A state setter is scoped to the exact instance and component-ref identity that created it and becomes inert as soon as either teardown begins.
- `crcWhenChanged` has one current cleanup owner: its component teardown collection. Dependency change removes and runs that generation before the next setup.
- `img` owns its current source generation, detaches load/error handlers on every terminal boundary, and only draws state tagged with the current source.
- Existing frame/controller and recursive layer ownership passed the broader stress proof without another production change.
- TFC-08 owns the remaining full runtime/hook identity matrix, including component type/key and hook-order error contracts.
