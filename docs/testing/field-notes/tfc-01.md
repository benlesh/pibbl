# TFC-01 field note — interaction characterization

> **Historical status: COMPLETED FIELD RECORD.** Results are dated evidence and are not current API guidance or current test totals.

Date: 2026-08-11

## Scenario and risk

The new interaction trace laboratory compares equal native DOM and Pibbl regions, then exposes rerender, handler replacement, subtree removal, nested-layer, and reset controls. The risk was accidentally blessing current event order or fixing ownership bugs before a measurable baseline existed.

## Manual and headless method

The manual source-mode gallery was exercised in the in-app Chromium browser. Movement and activation across the native reference updated the shared trace panel; Pibbl Canvas activation recorded the left target; replacement, subtree removal, add/remove layer, 100 awaited rerenders, and reset all updated the visible state. Reset restored revision 0, handler 1, both regions, no layer, and an empty trace. Browser output contained only Vite connection debug messages.

The headless suite drives the same scenario with raw Chromium mouse input and freezes native/Pibbl movement and click projections. A test-only observer records owned instances, native listeners, event registry sizes, teardown entries, and scheduled frames. Ten independent final focused runs passed: 3 files and 7 tests per run. The complete browser suite passed 13 files, 78 tests, with 4 pre-existing skips.

## Visual strategy and stabilization

Both region pairs use the same 480×240 geometry and stable solid colors. The browser runner stays at 800×600, DPR 1, light color scheme, reduced motion, `en-US`, and UTC. Headless probes assert background, left-region, and right-region Canvas pixels away from text; manual review confirmed the native and Pibbl geometry, state panel, lifecycle controls, instructions, and exercised source.

Performance measurements reuse a single miss event, separate exact hit-count instrumentation from timing, warm up five batches, and report median/p95 from 41 batches. Timings are recorded but not used as machine-speed gates.

## Surprising findings and browser differences

- Native Chromium reports `mouseover` before the first `mousemove`; Pibbl reports the move first.
- Moving between siblings is native `mouseout → mouseover → mousemove`, while Pibbl is `mouseout → mousemove → mouseover`.
- One all-event region keeps stable live registry counts across 100 rerenders, but component teardown entries grow from 4 to 204.
- Removing a subtree clears hover adapters but leaves regular handlers callable at the old geometry.
- Removing a nested layer retains both offscreen instances and their event bridges; root abort still leaves two owned descendants.
- Immediate abort with a queued first frame can attempt to render after the instance was deleted. Settled abort is deterministic and cleans the simple root.

## Flakes and stabilization

Raw input is converted through the runner iframe scale and uses one explicit waypoint at a time. Every lifecycle rerender awaits a real frame; 100 synchronous `pibbl()` calls would only characterize RAF coalescing. The final focused suite passed ten independent runs without retries.

The first performance assertion mistakenly returned the cumulative count after 25 timing dispatches, producing `26 × regions`. Separating the single-dispatch structural probe from timing removed the accounting ambiguity. Batch sizing was then increased to avoid sub-millisecond timer quantization at 0 and 100 regions.

## Failed or rejected approaches

- Rejected production diagnostic exports or a teardown-size getter; the observer imports internals from a test-only file and is absent from build artifacts.
- Rejected changing Pibbl order to satisfy the native trace in a characterization step.
- Rejected speed thresholds before TFC-06 establishes budgets and a stable dispatcher.
- Rejected using a separately implemented manual native fixture; the gallery and headless test now mount the same scenario-owned reference.
- Rejected nondeterministic garbage-collection assertions; owned registries and teardown collections are the primary evidence.

## Helper and tooling friction

- Native listener counts require AbortSignal-aware accounting because browser-internal signal cleanup does not call an intercepted `removeEventListener`.
- Layer ownership must be followed through parent Canvas chains; the global map can include unrelated stale test canvases.
- Browser mouse synthesis crosses scenario, Canvas CSS, runner iframe, and screen coordinate spaces.
- Reproducible low-latency measurement needs batched samples and a separate structural probe.

Candidate tools:

1. a reusable coordinate-space input driver shared by component, scenario, and native-reference tests;
2. an owned-resource snapshot/assertion helper with delta-friendly diagnostics;
3. a scenario trace renderer that can show native evidence and approved Pibbl projections from one oracle table;
4. a benchmark reporter that writes environment-tagged JSON without turning local milliseconds into universal CI budgets.

## Decisions and follow-ups

- The trace tables are observed characterization, not the supported contract.
- Test diagnostics remain outside production source and package artifacts.
- Current leaks and races stay visible in green characterization assertions until their owning steps intentionally change the baseline.
- The representative performance baseline and full resource tables live in [the TFC-01 baseline report](../../design/tfc-01-characterization-baseline.md).
- The historical untracked `use-event.test.ts` named by the plan was absent; no user-owned file was overwritten.
