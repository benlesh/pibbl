# First-class animation delivery field note

> **Historical status: COMPLETED FIELD RECORD.** Results are dated evidence for the named candidate and environment, not current API guidance or reusable test totals.

Delivery verification date: 2026-09-11

## Scope and environment

Final verification covered Task 13 on the first-class animation branch based at
`8f0e75ff67e3377041d9f6558870b1a3d0b77b77`. The closure commit containing
this note records the final candidate.

- macOS 26.6.2 (25G83), arm64
- Node.js `v26.7.0`; pnpm `11.21.0`
- Vitest `4.1.10`; Playwright `1.62.1`
- Playwright Chromium `151.0.7922.34`, headless

This Node 26 run is additive local evidence. The GitHub Actions workflow's
Node 24 LTS environment remains canonical and now runs the same Studio visual
command as the local aggregate.

## RED and focused recovery

The initial focused ownership/performance run failed 2 ownership tests while
all 7 structural tests passed because no snapshot exposed live/acquired/released
evaluator stepper state. After adding that true activation/fork seam, a stronger
keyframe allocation assertion failed 1 of 9 tests because exact sample-time
array allocation was still unavailable. The final exact-counter RED run failed
3 of 9 tests: both ownership cases lacked cumulative scheduler Begin/Complete
counts, and the 1,000-track case lacked literal output-stage attempts. The
narrow source-only diagnostics added no public export and changed no runtime
semantics:

- evaluator activation ownership counts retained stepper state plus every
  current-frame fork acquisition, adoption/discard, and final release;
- the scheduler counts every Begin command and every Complete callback at its
  actual acquisition and execution, cancellation, or discard boundary;
- the signal graph counts renderer-edge acquisition and release;
- playback counts actual user-output stage attempts; and
- animation definitions count persistent keyframe arrays, samples, and arrays
  allocated while sampling.

After implementation, the focused command passed 9 of 9 tests:

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/test/animation-ownership.test.ts packages/core/test/animation-performance.test.ts --browser.headless --browser.ui=false
```

The ownership cases measured exact balanced deltas. Autoplay, pause, seek,
reverse, replacement, and owner removal acquired/released 2 playbacks, 2 writer
leases, 2 evaluator stepper states, 7 Begin commands, 23 Complete callbacks, 1
renderer consumer, 3 renderer edges, and 1 root registration. Custom sampling
failure, root render failure, abort, disposal, and five fresh remounts
acquired/released 8 playbacks, 8 writer leases, 9 Begin commands, 48 Complete
callbacks, 8 renderer consumers, 8 renderer edges, and 8 root registrations.
Every release boundary ended with zero live animation owners, Advance
participants, callbacks, commands, milestones, and host frames.

The required combined lifecycle/structural command passed 8 files with 43
passed and 2 intentionally skipped tests of 45 in 10.27 seconds. The packaged
sub-gates then passed 19 of 19 lifecycle tests and 25 passed with 2 opt-in
wall-clock tests skipped of 27 structural-performance tests.

## Structural animation evidence

The deterministic workload established these exact results:

- 1,000 numeric playbacks requested one realm host callback for each presented
  frame, sampled exactly 1,000 times, attempted exactly 1,000 user-output stages,
  emitted 1,000 unique output records, and caused at most one root traversal;
- the equality-suppressed frame caused zero root traversals because playback
  metadata was deliberately unobserved, while the changed frame caused one;
- 100 sequential tracks targeting one signal acquired and released one writer
  lease;
- one ten-value keyframe definition retained 3 normalized storage arrays and
  performed 10 samples with 0 sample-time array allocations;
- analytic spring samples at 16 ms and 9,000 ms each used the same 2 closed-form
  exponential operations, providing gap-independent display-sample evidence;
- a 1,000 ms fixed-step gap with `stepMilliseconds: 10` and
  `maxElapsedMilliseconds: 40` performed exactly 4 steps, clamped 40 ms, and
  discarded 960 ms. In general the structural bound is
  `ceil(maxElapsedMilliseconds / stepMilliseconds)` because a prior frame may
  retain a fractional remainder;
- ordinary animation allocated no offscreen surface and performed no pixel
  readback, writeback, or bitmap transfer; and
- presentation-only motion above a Layer caused one root traversal, zero Layer
  child traversals, and preserved the child's render revision.

These are structural counters, not elapsed-time promises. Uncontrolled
wall-clock thresholds and cross-browser/GPU pixel identity remain outside the
correctness contract.

## Documentation and visual decisions

Review found one documentation overclaim: the animation contract described
generic `invalidation` and `work` trace facts even though the closed trace union
emits only command, sample, write, milestone, stepper, and error records. The
contract now names the emitted vocabulary and its frame/time/run/path fields.
The post-baseline semantic-unit digest and reviewed manifest digest were updated
without adding units, weakening the checker, or inflating probe counts;
`docs:check` still reports 738 current baseline units and all 880 mutation
probes passing.

The frozen-time first-class animation expected, expected artifact, and actual
images were visually inspected at 480×240 and remained byte-identical at
SHA-256
`59cda42cdfd88b14f6339bc883c8a86622059db584ea02fa10a4015ee0d20289`.
Its neutral diff artifact was also inspected. The comparison is exact and uses
no mask; that baseline was not rewritten.

The first check-only Studio run exposed only two catalog ordinals made stale by
the approved Task 11 lesson. Expected and actual full-page images were inspected
before the narrow updates:

| Baseline                       | Dimensions | Exact changed pixels | Intentional text                      | Old SHA-256                                                        | New SHA-256                                                        |
| ------------------------------ | ---------: | -------------------: | ------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `studio-mouse.expected.png`    |  1280×2854 |                   61 | `MOUSE EVENTS / 27` → `/ 28`          | `e6974f87900882cd6013a163da1e9841e0dc5f163711948151bdb4495ca5b3f8` | `52153a41722de1f07dce686d121f3516e3230c0d06fae63ca3f46329977ae9f5` |
| `studio-advanced.expected.png` |  1280×3045 |                   54 | `ADVANCED INTERACTIONS / 51` → `/ 52` | `e1f7ccd5eebb2dacae659d29cc8f9d20b8ede13fb03350e182228cd7d38b0716` | `9ff29494188c455717b687eccc69fe35ce225d13901947623be7cd7f6c153009` |

No mask is appropriate because the catalog text is deterministic and every
changed pixel belongs to the intended numeral. All other Studio baselines were
restored byte-for-byte, the check-only rerun matched all 5 pages, and the visual
safeguard rejected its deliberate drill, preserved every baseline byte, and
recovered green.

## Aggregate trust evidence

The exact final pre-record aggregate invocation was:

```sh
node --version
corepack pnpm@11.21.0 --version
corepack pnpm@11.21.0 trust
```

It exited zero. Fresh results from that run were:

- scenario validation: 52 lessons and 19 test laboratories;
- documentation: 12 guides, 43 current/migration files, 67 historical/work
  records, 77 values, 173 types, 23 acceptance rows, 67 parsed snippets, 8
  extracted TypeScript programs, 738 current semantic units, and 880 mutation
  probes;
- typecheck, ESLint, Prettier, package builds, source/built Studio builds,
  declaration parity, and packed Bundler/NodeNext consumers: passed;
- complete browser suite: 140 files, 2,003 passed and 2 intentionally skipped
  tests of 2,005 in 22.95 seconds;
- visual safeguard: deliberate mutation rejected and green recovered;
- Studio visuals: all 5 full-page baselines matched exactly;
- built-package smoke: 1 file and 1 test passed in 639 ms;
- lifecycle gate: 5 files and 19 tests passed in 9.92 seconds; and
- structural-performance gate: 4 files, 25 passed and 2 opt-in wall-clock tests
  skipped of 27 in 1.86 seconds.

## Remaining deliberate boundaries

This closure adds no public manual clock, retained trace history, free-standing
`play`, effect/subscription/batch API, automatic caching policy, worker/WASM
execution, cross-thread signals, retained scene graph, or pixel-determinism
promise. The realm scheduler remains the only animation frame owner, and
production animation performs no pixel work.
