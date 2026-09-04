# DOM-aligned user events delivery field note

> **Historical status: COMPLETED FIELD RECORD.** Results are dated evidence and are not current API guidance or current test totals.

Date: 2026-08-29

## Scope and environment

This note records fresh Task 10 evidence for the completed DOM-aligned event
delivery. It does not reuse the historical 265-test or 294-test snapshots.

- Worktree start: `7c2b2ae5a635a0e5e63afec6458fa5648c28ff8a`
- Node.js: `v24.19.0`
- pnpm: `11.21.0` through Corepack
- Vitest: `4.1.10`
- Browser: Playwright Chromium, headless
- Host: macOS arm64

The normal performance gate exercised structural counters only. Its two
opt-in wall-clock cases remained skipped, and every existing wall-clock budget
was left unchanged.

## Structural performance and ownership evidence

The performance suite now proves these literal structures through the
test-only `RuntimeDiagnostics` observer and Canvas path-test counters:

- an empty rendered root owns zero event targets, propagation listeners,
  pointer captures, and native UI listeners;
- 100 overlapping `pointerdown` targets plus one propagation listener share
  one actual native `pointerdown` listener;
- a topmost hit invokes target 99 after exactly one path test;
- a miss invokes no target or ancestor and performs exactly 100 path tests,
  one for every live geometric candidate;
- the complete structural snapshot is byte-for-byte equal before and after
  both dispatches, so no target, listener, capture, handler, frame, or
  propagation-owned registry state is retained by dispatch.

The lifecycle suite also proves one target inside a live layer moves through
this exact ownership sequence:

| State            | Instances | Targets | Native listeners | Captures |
| ---------------- | --------- | ------- | ---------------- | -------- |
| Layer mounted    | 2         | 1       | 2                | 0        |
| Pointer captured | 2         | 1       | 4                | 1        |
| Layer removed    | 1         | 0       | 0                | 0        |
| Root disposed    | 0         | 0       | 0                | 0        |

Removing the layer releases native and logical capture synchronously, produces
no ghost `lostpointercapture` call, and balances all four actual native
listener acquisitions with four releases and zero duplicate releases. The
existing 1,000-reflow and 1,000-mount/dispose stress paths now include target,
propagation-listener, and pointer-capture counts in their exact stable and
fully released snapshots.

The first RED runs failed because the observer did not expose those structural
fields. The performance RED also exposed a private laboratory ordering defect:
after lazy native listener installation replaced the eager listener model, the
Canvas completion observer could run before CRC. Moving only that private
completion observer to the bubbling `window` boundary restores measurement
ordering without changing `@crc/core` runtime behavior.

Initial Task 10 GREEN results represented by commit `3d38c70`:

- `corepack pnpm@11.21.0 test:performance`: 1 file passed; 7 passed and 2
  opt-in timing tests skipped; duration 1.32 seconds.
- `corepack pnpm@11.21.0 test:lifecycle`: 2 files and 12 tests passed;
  duration 9.64 seconds.

## Public package and Studio boundary

The strict consumer now exercises `crcEventTarget`, `crcEventListener`, and
pointer, mouse, touch, wheel, keyboard, focus, input/editing, composition,
clipboard, and drag declarations from both `@crc/core` and
`@crc/core/types`. The same source is compiled under Bundler and NodeNext
resolution against the packed tarball. Runtime verification loads the exact
root export set and checks every value is function-valued, including both event
hooks and the `LayoutDiagnostic` class constructor; unsupported `lib/` and
`src/` imports are rejected; and installed tarballs contain no `src` directory.

The Studio declaration consumer exercises the same ten event families and the
two grouped registration hooks under strict TypeScript settings.

## Final verification

Every command below used the configured Node `v24.19.0` runtime and Corepack
pnpm `11.21.0`.

Initial Task 10 focused gates represented by commit `3d38c70` passed:

- `corepack pnpm@11.21.0 typecheck`: exit 0 with no diagnostics.
- `corepack pnpm@11.21.0 lint`: exit 0; ESLint passed and Prettier reported
  every matched file formatted.
- `corepack pnpm@11.21.0 test:package-consumer:packed`: exit 0 for both strict
  Bundler and NodeNext consumers, all event-family declarations, runtime
  exports, blocked deep imports, and the no-`src` check.
- `corepack pnpm@11.21.0 test:ci`: 61 files passed; 599 tests passed and 2
  skipped out of 601; duration 21.16 seconds.
- `corepack pnpm@11.21.0 test:lifecycle`: 2 files and 12 tests passed;
  duration 9.64 seconds.
- `corepack pnpm@11.21.0 test:performance`: 1 file; 7 tests passed and 2
  opt-in timing tests skipped out of 9; duration 1.32 seconds.
- `CRC_STUDIO_PREVIEW_PORT=4274 corepack pnpm@11.21.0 test:studio-visual`:
  exit 0 after a 0.86-second Studio build; all 5 full-page baselines matched;
  measured command duration 3.71 seconds.

The first aggregate invocation reached Studio visual verification after its
static, package, 601-test browser, and visual-safeguard phases had passed, then
stopped after about 60.0 seconds because unrelated user process `44491`, rooted
at `/Users/benlesh/GitHub/yeah/apps/web`, already owned the verifier's fixed
loopback port 4174. That process was not disturbed. The evidence harness now
accepts a validated `CRC_STUDIO_PREVIEW_PORT` integer from 1 through 65535 and
retains 4174 as its default.

The one post-fix aggregate run for the initial Task 10 delivery was:

```text
CRC_STUDIO_PREVIEW_PORT=4274 corepack pnpm@11.21.0 trust
```

It exited 0 in a measured 46.8 seconds on the tree committed as `3d38c70`,
before the follow-up performance-laboratory regressions below were added. Fresh
component totals for that aggregate were 28 lessons, 15 test labs, 61 browser
files with 599 passed and 2 skipped tests out of 601 (21.12 seconds), 5 exact
Studio baselines, 1 built smoke test (652 milliseconds), 12 lifecycle tests
(9.69 seconds), and 7 passed plus 2 skipped structural-performance tests out of
9 (1.37 seconds). The catalog, typecheck, ESLint/Prettier, source and built
package/Studio builds, packed Bundler and NodeNext consumers, visual safeguard,
and all cleanup ownership ledgers also passed. No visual baseline or wall-clock
performance budget changed.

## Post-delivery focused fixes

The aggregate gate was not rerun for these private instrumentation-only fixes:

- Fix round 1 (`c364eab`) added unrelated-DOM origin/pairing coverage. Its final
  focused performance run reported 8 passed and 2 opt-in skips out of 10 in
  1.36 seconds.
- Fix round 2 adds same-Canvas reentrancy coverage and per-event counter/target
  ownership. Its current focused performance run reports 9 passed and 2 opt-in
  skips out of 11 in 1.39 seconds. This focused total is newer than, and must
  not be attributed to, the `3d38c70` aggregate above.
