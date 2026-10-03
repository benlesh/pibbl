# Repeating animation history grows with elapsed time

Issue: CRC-PERF-01  
Priority: P1  
Status: Reconciled; awaiting independent review and integration
Evidence date: 2026-10-02  
Classification: Confirmed progressive slowdown

## Problem

crossedMilestones collects timeline events from zero to the current horizon. Repeat traversal starts at iteration zero. Deduplication uses filter with findIndex over the accumulated timeline before selecting the newly crossed interval. Collection grows with history and deduplication is quadratic in collected events.

## Evidence and limits

The actual 160 ms particle emission program took median 0.1 ms at age 1 second, 6.6 ms at 60 seconds, 75.7 ms at 300 seconds, and 303.1 ms at 600 seconds in an isolated evaluator probe. The latter three evaluations delivered only two milestones. The live particle example also became progressively slower over 60 seconds. Stirred Ink uses a longer repeat and measured only about 0.3 ms at 600 seconds; this does not establish its reported crash cause.

See the [audit evidence](../evidence/followup-results.json) and [shared environment and limitations](../README.md). Findings describe the reviewed working tree, not necessarily current main. Revalidate against the integration baseline before changing code.

## Relevant code

- [packages/core/src/lib/animation/evaluate.ts](../../../../../packages/core/src/lib/animation/evaluate.ts)
- [packages/scenarios/src/learning/composition/particle-effects.example.tsx](../../../../../packages/scenarios/src/learning/composition/particle-effects.example.tsx)
- [packages/scenarios/src/learning/composition/stirred-ink.example.tsx](../../../../../packages/scenarios/src/learning/composition/stirred-ink.example.tsx)

## Reproduction

Evaluate the same repeating program over one approximately 16.667 ms interval at progressively later times. First reproduce through usePlayback and a public scenario; use the private evaluator probe only to isolate complexity.

## Implementation direction

- Traverse the newly crossed interval and calculate relevant repeat iteration bounds arithmetically where duration permits.
- Deduplicate while collecting with a collision-safe identity key; avoid nested historical scans.
- Preserve forward/reverse boundary rules, nested and alternate repeats, source order, zero-duration safeguards, seeks, and stepper semantics.

## Acceptance criteria

- [ ] A focused regression fails before the fix and shows bounded visits for equal-width intervals at late program ages.
- [ ] Public playback delivers the same exact markers and iteration events, including nested/reverse/boundary cases.
- [ ] A sustained particle example has no elapsed-history CPU growth attributable to milestone traversal.
- [ ] Retained activation state is bounded; no replacement cache merely retains all historical events.

## Dependencies and boundaries

No prerequisites. Review alongside animation contracts. Do not rewrite animation sampling wholesale.

## Completion record

### Baseline reconciliation — 2026-10-02

The audit fingerprinted the dirty `codex/physics-2d-quality` checkout at
`1d1a2ec49f6bca52be99abf24bd34e1b3cb3f16e`. Its
`packages/core/src/lib/animation/evaluate.ts` SHA-256 was
`72e0740e2b25997f85196eb0b4018be94a2db8d924460be221dc436335cd0673`.
The accepted integration baseline is
`6b25a550c3f36d3ab17deeb393251442539d6489`; it contains the corrective
commit `0f7bf4660c874f8cef8535013295a1e45bb8a903` and the current evaluator
SHA-256 is `b0572acbf32927474783a1e5ebab1f0ca3641fa13b2abfadfd2fca7b1935eec5`.

That existing change passes the crossed interval into `collectTimeline`,
arithmetically limits fixed-duration repeat traversal to the relevant
iterations (including the preceding boundary occurrence), filters to crossed
events before deduplication, and uses a structured `Set` key. It leaves
dynamic/terminal-stepper repeats on their sequential discovery path.

The committed evaluator regression at
`packages/core/src/lib/animation/evaluate.test.ts` therefore supplies the
required failing-before/passing-after proof from the original implementation:
at both 2,048 ms and 2,000,000 ms, a one-millisecond crossed interval emits
only the marker at the requested time, constructs fewer than ten timeline
events, and performs no historical `findIndex` scan. The adjacent frozen
fixture verifies nested fractional repeats across all four directions and both
forward/reverse boundary traversal orders.

### Fresh supported-environment verification — 2026-10-02

- Environment: Node `v24.15.0`, pnpm `11.21.0`, Playwright Chromium supplied
  by the provisioned checkout.
- First, `@crc/types` and `@crc/core` were built because Vite's Studio
  documentation preflight resolves workspace package declarations from their
  generated `dist` entries.
- `fnm exec --using=24.15.0 corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/animation/evaluate.test.ts packages/core/test/animation-lab.test.ts --browser.headless --browser.ui=false --maxWorkers=1`
  passed: 2 files, 45 tests, 2.76 s.
- The public scenario is the Animation laboratory at `#/testing/animation`.
  Choose **Repeat alternate** and advance it: its headless public-API test
  observes the marker at 100 ms and iteration event `1` with the expected
  payload. The scenario remains a test laboratory, so it is excluded from
  public Studio search.

No new runtime change is appropriate: the committed baseline already contains
the fix and its focused regression. A prior first test invocation was blocked
before collection by missing generated `@crc/types`/`@crc/core` package outputs
in this new worktree; rebuilding those baseline packages resolved the setup
condition without source changes.

### Pending independent review and integration

An independent reviewer must verify the baseline-to-candidate mapping, the
late-age bounded-work assertion, and the public scenario evidence. The
orchestrator must record that review disposition, the issue-record commit,
integration trust result, merge commit, and verified remote `main` SHA before
marking the issue complete.
