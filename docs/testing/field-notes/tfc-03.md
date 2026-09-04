# TFC-03 field note — event ownership and teardown

> **Historical status: COMPLETED FIELD RECORD.** Results are dated evidence and are not current API guidance or current test totals.

Date: 2026-08-11

## Scenario and risk

The event lifecycle laboratory uses the public `crc`, controller, component, layer, cursor, and mouse-event APIs to exercise 1,000 settled rerenders, handler replacement/removal, subtree and layer removal, abort, disposal, repeated cleanup, remount, stale cleanup, and thrown handlers. The risks were closures retained in registries, teardown growth hidden behind stable Set sizes, native listeners without a no-signal release path, queued frames rendering after disposal, stale controllers deleting remounts, and offscreen instances surviving their `Layer` owner.

## Manual and headless method

The cataloged laboratory is the shared manual/headless scenario. Its visible state reports runtime and mount generation, revision, handler generation/removal, subtree/layer state, per-target calls, cleanup requests, and last action. Private resource observations remain in the test adapter.

The source panel displays `lifecycle-lab.example.ts`, the exact public-API scene used by both modes. The neighboring scenario adapter intentionally owns the laboratory plumbing that creates the inner `AbortController`, retains stale controllers, and remounts the Canvas; that orchestration is catalog infrastructure rather than scene rendering source.

Headlessly, one shared-scenario flow runs 1,000 real render frames, replaces and removes the primary handler, removes a hovered cursor subtree, adds/clicks/removes an offscreen layer, and verifies deterministic pixels plus exact diagnostic baselines. A second flow reports a deliberate handler error, proves a safe target still works, and drives abort, disposal, repeated cleanup, remount, stale cleanup, and reset. Focused direct-core tests separately cover immediate pre-frame disposal, a legal frame identity, nested layers, no-signal cleanup, and two throwing pathless observers in one native dispatch.

## Visual strategy and stabilization

The fixed 480×240 scene gives the primary, subtree, throwing, safe, and layer regions distinct solid colors. Pixel probes avoid text and borders. Removal assertions require the purple subtree and orange layer pixels to return to background; the primary remains visibly gray but inert after its handlers are removed. Hovering the subtree sets `cursor: pointer`, and its removal must synchronously clear the owned cursor.

The 1,000-rerender test has an explicit 40-second budget but no retry. Every render awaits a real animation frame, so the test proves actual teardown replacement rather than request coalescing.

## Completed evidence

Manual review used the cataloged lifecycle laboratory in the in-app Chromium browser on macOS. The first rerender run reached revision 1,000; replacement generation 2 alone handled the next primary click; the disabled primary, removed subtree, and removed layer recorded no ghost clicks; the mounted layer recorded exactly one click; and the deliberate throwing target was followed successfully by the safe target. Abort and dispose were each followed by repeated cleanup, remount, and stale cleanup without disturbing the fresh runtime. Reset returned mount generation 1, revision 0, all call counters 0, the blue/purple/red/green regions, and no layer. The layer-present, removed-region, and reset compositions were visually reviewed. The only warning/error entry was the scenario's intentional `Lifecycle laboratory throwing handler` report.

Under Node 24.19.0 and pnpm 11.21.0, lint, typecheck, package build, the strict Bundler/NodeNext/runtime package consumer, source gallery build, and built-package gallery build pass. The complete Chromium suite passes 16 files with 92 tests passed and 4 intentionally skipped. The focused lifecycle file passes 11 tests, including the persistent-layer update, external cursor replacement, mount-only signal, and frame-id-zero regressions. A dry-run package manifest contains only `dist`, license, package metadata, and README files; no test diagnostics or lifecycle support module is publishable.

## Surprising findings and browser differences

- Animation-frame id `0` is legal. Truthiness cannot represent “no frame”; the instance now uses `undefined` as its sentinel.
- Removing event adapters was insufficient for visible cleanup: a hovered component could leave its Canvas cursor behind. Cursor ownership therefore needed its own persistent hook slot.
- A retained controller is only safe if it releases its owned instance reference after disposal and checks the current Canvas identity before cleanup.
- A signal is mount-only. Passing another signal while updating an existing Canvas returns the same controller and does not transfer lifetime ownership.
- Explicit `removeEventListener` ownership is both easier to count and necessary for no-signal mounts; relying on browser signal cleanup hid the release path.
- Layer event ownership cannot be fixed only at the bridge Set. The offscreen instance itself must follow the owning `Layer` component so nested cleanup cascades.

## Flakes and stabilization

The first layer pixel probe landed on the white antialiased label rather than the orange fill. The failure screenshot made the mistake obvious; the probe moved to an interior point away from glyphs. No threshold or retry was widened.

Test-only animation-frame accounting observes the browser realm, so only one diagnostics instance runs in a test realm and assertions use pending state/exact lifecycle deltas rather than pretending every frame belongs to CRC. Registry Sets are wrapped only after an owned instance is observed; each test snapshots its baseline before mutation so all relevant acquisitions/releases are ledgered.

## Failed or rejected approaches

- Rejected keeping listener cleanup dependent on optional `AbortSignal`; public `dispose()` is required.
- Rejected a global `disposeCRC(canvas)` helper; a mount-scoped controller can be identity-guarded and cannot accidentally target a remount.
- Rejected adding a production diagnostics API; private counters are unnecessary package surface.
- Rejected one new component teardown closure per rerender; each hook slot now owns one persistent finalizer and one replaceable binding.
- Rejected clearing every cursor blindly; a cursor slot clears only the Canvas style it successfully owned.
- Rejected heap/GC timing as a completion gate; exact acquisition/release ledgers are deterministic.
- Rejected folding broader image and hook cleanup into this step; TFC-07 retains those measured risks.

## Helper and tooling friction

- Exact-once proof required wrapping newly discovered layer event Sets, not only summing live registry sizes.
- Scenario controllers must outlive their inner CRC runtime so gallery actions can inspect abort/dispose and then remount the same Canvas.
- The old frozen lifecycle test encoded known leaks as expected values; TFC-03 replaced those assertions while preserving the historical TFC-01 report.
- A deliberate handler exception must be observed through `reportError` without becoming an uncaught browser-test failure.

Candidate tools:

1. a reusable resource-ledger helper that wraps Set/EventTarget ownership and asserts `acquired - released === live`;
2. a scenario lifecycle driver for mount/update/remove/dispose/remount matrices;
3. a browser-test cursor probe that records which logical region last owned a Canvas style;
4. a compact frame-ownership adapter that distinguishes application frames from test-settling frames.

## Decisions and follow-ups

- The implemented ownership contract is [event resource ownership](../../design/event-resource-ownership.md).
- `crc()` returns a stable additive `CRCController`; abort and disposal share one central idempotent path.
- Only the initial mount's `options.signal` controls that mount; later update signals are deliberately ignored and covered by a regression.
- Event bindings, hover state, cursor style, root listeners, frames, layer instances, and bridges each have one documented owner.
- TFC-04 must preserve these lifetime guarantees while replacing all-hit dispatch with the approved topmost target/order model.
- TFC-07 remains responsible for image callbacks, broader hook cleanup, and longer whole-runtime cycle stress.
