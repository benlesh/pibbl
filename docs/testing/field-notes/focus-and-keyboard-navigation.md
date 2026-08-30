# Focus and keyboard-navigation delivery field note

Date: 2026-08-30

## Scope and environment

This note records fresh Task 10 release evidence for optional focus management
and directional keyboard navigation. Historical test totals are not reused.

- Worktree start: `345e77064a79b7f445dbf01f3739fb190920ffab`
- Node.js: `v24.15.0` through `fnm exec --using 24.15.0`
- pnpm: `11.21.0` through Corepack
- Vitest: `4.1.10`
- Browser: Playwright Chromium `151.0.7922.34`, headless
- Host: macOS arm64

The normal performance gate exercised structural counters. Its two opt-in
wall-clock cases remained skipped, and no performance budget changed.

## Test-driven lifecycle evidence

The new stress contract uses real public focus enhancers and real Canvas event
dispatch. It exercises 1,000 successful rerenders, handler replacement and
removal, keyed candidate reorder and removal, directional-boundary removal and
re-addition, Canvas focus and blur, pending Space activation, pointer capture,
abort, double disposal, remount, and application-owned `tabindex` mutation.

Before adding diagnostic support, this command was run on Node 24.15.0:

```sh
fnm exec --using 24.15.0 -- corepack pnpm@11.21.0 test:lifecycle
```

It exited 1 with 1 failed and 12 passed tests out of 13 in 9.66 seconds. The
new case failed at its first ownership assertion because the test observer did
not expose document listeners, mounted focus/navigation enhancers, focus
managers, candidates, current target, boundaries, pending activation, or the
original/current Canvas `tabindex`. The existing lifecycle cases passed.

The completed test-only observer lives only under `packages/core/test/support`.
It counts the one document listener and reads the installed optional focus
bridge structurally; no diagnostic is exported from a package entry or included
in the packed runtime. The final focused lifecycle run passed 2 files and all
13 tests in 9.67 seconds. It proves the active ownership baseline stays exact
through 1,000 rerenders and returns to zero for focus target, document and
Canvas listeners, enhancers, manager, frame, candidates, boundaries, pending
activation, and pointer capture. Two document-listener acquisitions balance
two releases with zero duplicate release. An original application
`tabindex="-2"` is restored after abort; a later application change to
`tabindex="7"` causes CRC to relinquish ownership and survives double disposal.

The ordinary event performance fixtures additionally prove that an unenhanced
empty root and 100 unenhanced pointer targets retain zero document listeners,
focus enhancers, managers, candidates, focused targets, navigation boundaries,
and pending activations. The fresh performance result was 1 file with 9 passed
and 2 opt-in timing tests skipped out of 11 in 1.42 seconds; the aggregate run
reproduced that structure in 1.44 seconds.

## Packed optionality evidence

The packed verifier built two minified browser ESM consumers with esbuild.
The ordinary `rect` consumer omitted `CRC_FOCUS_MANAGEMENT_V1` and measured
102,986 bytes. The otherwise equivalent consumer using
`withFocusManagement` retained the marker and measured 125,760 bytes. The
no-focus bundle was therefore 22,774 bytes smaller. Bundler and NodeNext type
consumers, declarations, runtime root exports, blocked deep imports, and the
no-source tarball check all passed. A post-build search found none of the new
test diagnostic names in `packages/core/dist/index.mjs`.

## Final verification

Required focused commands were run separately with Node 24.15.0 and pnpm
11.21.0:

- `typecheck`: exit 0 with no TypeScript diagnostics.
- `lint`: exit 0; ESLint passed and Prettier reported all matched files
  formatted.
- `test:package-consumer:packed`: exit 0 with the marker and byte evidence
  above.
- `test:ci`: 72 files passed; 747 passed and 2 skipped tests out of 749;
  duration 21.33 seconds.
- `test:lifecycle`: 2 files and 13 tests passed; duration 9.67 seconds.
- `test:performance`: 1 file; 9 passed and 2 skipped tests out of 11; duration
  1.42 seconds.

Port 4174 remained occupied by unrelated PID 44491 rooted outside this
repository. The existing validated Studio override was used without disturbing
that process:

```sh
/usr/bin/time -p env CRC_STUDIO_PREVIEW_PORT=4274 fnm exec --using 24.15.0 -- corepack pnpm@11.21.0 trust
```

The aggregate exited 0 in 51.70 seconds. Fresh component evidence was 28
lessons and 16 test labs; 72 browser files with 747 passed and 2 skipped tests
out of 749 in 21.38 seconds; 5 exact Studio baselines; 1 built smoke test in
631 milliseconds; 13 lifecycle tests in 9.68 seconds; and 9 passed plus 2
skipped structural-performance tests in 1.44 seconds. Catalog validation,
typecheck, ESLint/Prettier, package and source/built Studio builds, packed
Bundler/NodeNext consumers, declarations, and cleanup ownership ledgers also
passed.

Visual inspection produced no intentional product diff. The safeguard rejected
its deliberate mismatch, preserved every baseline byte, and recovered green;
the Studio verifier matched all five full-page baselines. No visual baseline
was added or rewritten.

## 2026-08-30 lifecycle evidence tightening

This test-only follow-up closes two review gaps without changing production
runtime or package-entry code. Final abort/double-dispose and remount/dispose
checks now compare the complete runtime diagnostic snapshot, including native
and document listeners, event targets, handlers, component and main teardowns,
propagation listeners, focus resources, frames, and exact application
`tabindex` ownership/restoration. The associated listener and handler ledgers
must also balance with zero live or duplicate releases.

Focused-target diagnostics now preserve the full logical identity as
`{ componentId, slot }`. A dedicated mounted lifecycle case moves focus between
two slots owned by the same component and proves the diagnostic changes from
slot 0 to slot 1 while retaining the component identity.

The strict RED command was:

```sh
fnm exec --using 24.15.0 -- corepack pnpm@11.21.0 test:lifecycle
```

It exited 1 with 1 failed and 12 passed tests out of 13 in 9.67 seconds: the
new structured target assertion expected component ID plus slot 0, while the
observer still returned only the component ID string. After the minimal
test-observer update and the two-slot control, the same command passed 2 files
and all 14 tests in 9.67 seconds.

Fresh proportional verification on Node `v24.15.0`, pnpm `11.21.0`, and
Playwright Chromium `151.0.7922.34` also passed:

- `test:performance`: 1 file, 9 passed and 2 opt-in skips out of 11, 1.40
  seconds.
- `typecheck`: exit 0 with no TypeScript diagnostics.
- `lint`: exit 0; ESLint and Prettier clean.
- `test:package-consumer:packed`: exit 0; the no-focus bundle omitted
  `CRC_FOCUS_MANAGEMENT_V1` at 102,986 bytes and the focus bundle retained it
  at 125,760 bytes.

The aggregate `trust` gate and visual suite were not rerun for this test-only
follow-up. The 51.70-second aggregate and five-baseline result above belong to
the preceding `b02cc27` delivery and are not claimed as fresh evidence for this
round. No visual baseline changed.
