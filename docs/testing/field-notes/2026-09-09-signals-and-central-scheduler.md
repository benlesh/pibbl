# Signals and central scheduler foundation delivery field note

> **Historical status: COMPLETED FIELD RECORD.** Results are dated evidence for the named revision and environment, not current API guidance or reusable test totals.

Delivery date: 2026-09-10

The initial implementation evidence is preserved below. The final-review
remediation section supersedes its behavioral conclusions and test totals for
the completed branch where they differ.

## Scope and environment

This record closes the signal-graph and realm-scheduler foundation plan only.
The dependency-ordered animation-engine plan remains pending. The reviewed
implementation range begins at `d8517b0`, the actual design-approval base for
this branch.

Fresh verification ran on macOS `26.6.2` (`arm64`) with Node.js `v26.7.0`,
pnpm `11.21.0`, Vitest `4.1.10`, Playwright `1.62.1`, and Chrome for Testing
`151.0.7922.34`. This is Node 26 evidence; no Node 24 execution is claimed.

## Lifecycle and structural TDD evidence

The two new test files were written before their supporting internal counters.
Their first combined run produced three meaningful failures and two passing
controls: the lifecycle case, 100-root notification case, and unchanged
computed case all stopped on the deliberately absent `signalGraphSnapshot`,
while the already-observable 1,000-write and Layer-reuse cases passed. After
adding internal-only graph and scheduler counters, all five tests passed.

A scheduler-snapshot mutation then removed the new phase and ownership fields.
The lifecycle test failed because `advanceParticipants` and
`completionCallbacks` were absent; restoring the fields returned it to green.
This distinguishes the new assertions from coverage that could pass without
observing scheduler ownership.

The exact lifecycle scenario exercises repeated `crc()` on one live Canvas,
shared reads in a root and a Layer, branch removal and re-addition, root
replacement, render failure, fail-closed recovery, abort while a computed is
pending validation, explicit disposal, fresh remount, and 25 additional
mount/dispose cycles. Relative to the test's clean baselines it observed:

- 36 renderer consumers created and exactly 36 released;
- 28 root registrations created and exactly 28 released;
- final `rendererConsumers`, `rendererEdges`, and
  `pendingComputedValidations` all equal to zero; and
- final `pendingHostFrames`, `registeredRoots`, `advanceParticipants`, and
  `completionCallbacks` all equal to zero.

The application-owned writable and computed signals remain readable after
mount teardown and are deliberately excluded from mount-resource leak counts.
No heap timing or garbage-collection oracle is used.

The structural cases proved these exact costs:

- 1,000 writes before a frame produce one host request and one root traversal;
- one signal observed by 100 roots produces one host request, 100 traversals in
  stable mount order, and one signal commit notification;
- an invalidated computed whose value remains equal performs one Plan-phase
  computed validation and zero root renders; and
- among 100 stable Layers, only the signal-owning child repaints, the other 99
  child traversal counts remain zero, all 100 bitmap identities are reused,
  and zero replacement offscreen surfaces are constructed.

Optional elapsed-time reporting is available only behind
`VITE_CRC_REPORT_PERF=1`. It has no threshold and is not correctness evidence.

The required six-file focused command passed 33 tests with 2 intentional
wall-clock skips across all 6 files:

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/test/signal-scheduler-ownership.test.ts packages/core/test/signal-scheduler-performance.test.ts packages/core/test/lifecycle-ownership.test.ts packages/core/test/runtime-cleanup-stress.test.ts packages/core/test/event-performance.test.ts packages/core/test/filter-performance.test.ts --browser.headless --browser.ui=false
```

The trust sub-gates then passed independently: lifecycle passed 16 tests in 4
files, and structural performance passed 18 tests with 2 intentional timing
skips in 3 files.

## Aggregate diagnostics and visual evidence

The first aggregate attempt exposed three stale pre-signal test assumptions,
not a production defect: two teardown-count checks did not include the
component signal consumer, and an exact export list omitted the five approved
signal exports. The focused corrections passed 28 tests across the three
affected files.

The next aggregate attempt passed all 126 browser files (1,704 tests passed and
2 intentional timing tests skipped), then correctly stopped on a stale Studio
visual baseline. Expected, actual, and exact pixel differences were inspected
before any baseline update. The new Signals lesson intentionally affects every
captured Studio route through the shared navigation; lesson routes also expose
the incremented ordinal, and Rectangle now links back to Signals. The sanctioned
update changed exactly these five baseline files, with no masks:

| Route     | Changed pixels | Bounding box `(x1,y1)-(x2,y2)` | Intended regions                                      |
| --------- | -------------: | ------------------------------ | ----------------------------------------------------- |
| landing   |          7,565 | `(24,295)-(134,899)`           | shared sidebar only                                   |
| primitive |         28,715 | `(14,61)-(586,2794)`           | 26,606 sidebar, 65 ordinal, 2,044 `Previous: Signals` |
| mouse     |          7,626 | `(24,61)-(483,899)`            | 7,565 sidebar, 61 ordinal                             |
| advanced  |          7,630 | `(24,61)-(558,899)`            | 7,565 sidebar, 65 ordinal                             |
| test-lab  |          7,565 | `(24,295)-(134,899)`           | shared sidebar only                                   |

For every route, zero changed pixels fell outside those intended regions. From
the inserted Signals row onward, each sidebar matched the prior baseline
shifted down exactly 40 pixels, with zero mismatched pixels. The visual
safeguard subsequently rejected its deliberate mutation, preserved all
baseline bytes, and recovered green; a fresh comparison matched all 5 Studio
baselines.

The complete aggregate command was:

```sh
corepack pnpm@11.21.0 trust
```

It exited zero. Fresh results included 51 lessons and 18 test laboratories;
documentation checks and all 844 documentation mutation probes; typecheck,
ESLint, Prettier, source/built package and Studio builds, declaration parity,
packed Bundler and NodeNext consumers, and blocked deep-import checks; 126
browser files with 1,704 passed and 2 intentionally skipped tests; the visual
safeguard and all 5 Studio baselines; 1 built-smoke test; 16 lifecycle tests;
and 18 structural-performance tests with 2 intentionally skipped timing
diagnostics.

## Final boundary and ownership review

The complete foundation diff was reviewed from `d8517b0`. Production host-frame
ownership remains singular: the realm scheduler contains the only production
`requestAnimationFrame` call. Public package and declaration audits found no
subscribe/effect/batch surface, no implicit signal-to-style binding, no
automatic cache, and no animation API. Signal reads remain explicit, Layers
remain the only retained rendering boundary, and timing remains diagnostic.

A subsequent complete review from `f5f576e` found five Important foundation
defects and one Minor documentation defect. The initial conclusion that no
production defect remained is superseded by the repair evidence below.

## Final-review remediation

The repair keeps the public API unchanged and does not implement animation. It
adds a host-agnostic graph-to-scheduler liveness seam so an observed pending
computed requests Plan work without dirtying a renderer early. Equal computed
results now stop after Plan, while changed results can invalidate and render
their exact consumer in the same frame. The learning and laboratory scenarios
now prove computed-only behavior without a direct source read or an
out-of-render computed read masking the result.

Cycle-closing computed edges are not committed. Direct and indirect cycles
rethrow the same cached error object and deterministic path on repeated reads;
guarded cycles retain noncyclic dependencies and recover when the guard
changes. Plan drains eligible observed computeds dependency-first without
fail-fast behavior. Computation errors remain attached to their value and enter
normal render recovery only when read, so one failing nested computed is not
reported once from Plan and again from Render, and independent roots still
progress.

Computed-to-source observer leases now exist only while the computed is
observed. First observation acquires dependencies recursively; final detach
releases them recursively; retained unobserved graphs validate version
snapshots on explicit `get()`. Deterministic ownership evidence observed these
exact deltas from clean baselines:

- the complete repeated-mount lifecycle acquired/released 36 renderer
  consumers, one computed source edge, and 28 root registrations exactly;
- the nested retained graph acquired and released exactly two computed source
  edges across failed-render cleanup, recovery, and final disposal;
- unit-level first-observer/final-detach evidence acquired/released one edge,
  a nested chain acquired/released two, and a dependency switch acquired and
  released three while keeping exactly two live before final detach; and
- every release boundary returned renderer consumers, renderer edges, computed
  source edges, pending validations, root registrations, Advance participants,
  completion callbacks, and host frames to zero.

Advance participants may mutate signals only through their supplied batch.
Direct `set()` and `update()` reject before mutation, and a participant that
stages then attempts a direct write loses its staged values. Commit
notifications and Plan-derived dirtiness may join the current plan. Arbitrary
state, root, renderer, or completion requests from Advance, Render, or Complete
wait for the next Begin. The controlled trace remained
`Advance → Commit → Plan → Render → Complete`; Advance state/root work produced
no render in its requesting frame and rendered in the next, while friend draw,
root render, and friend completion likewise appeared together only in the next
frame.

Meaningful RED runs first exposed six graph failures, two computed-only
root/Layer liveness failures, four scheduler admission failures, one public-lab
masking failure, three ownership/friend-edge failures, and two deferred friend
work/completion failures. The final focused matrix passed 474 tests across 11 graph,
consumer, hook, scheduler, friend, Layer, public-scenario, ownership, and
structural-performance files.

Fresh pre-aggregate verification ran on macOS `26.6.2` (`arm64`) with Node.js
`v26.7.0`, pnpm `11.21.0`, Vitest `4.1.10`, Playwright `1.62.1`, and Chrome for
Testing `151.0.7922.34`. This remains Node 26 evidence, not Node 24 LTS
evidence. Documentation passed 667 protected baseline units, 734 current units,
47 exhaustively mapped post-baseline signal-contract units, and 847 adversarial
mutation probes. Typecheck, ESLint, Prettier, source/built package and Studio
builds, strict source and packed consumers, and declaration parity passed. The
complete browser suite passed 1,722 tests in 126 files with 2 intentional timing
skips. The built smoke passed 1 test; lifecycle passed 17 tests in 4 files; and
structural performance passed 18 tests with 2 intentional timing skips in 3
files. The visual safeguard preserved every baseline byte and recovered green;
all 5 Studio images matched and were inspected at full-page scope with no
baseline rewrite or mask change.

After the complete tracked repair diff and self-review correction were in
place, a fresh `corepack pnpm@11.21.0 trust` run repeated the aggregate gate and
exited zero in the environment above.
