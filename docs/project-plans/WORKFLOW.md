# Active project plan workflow

This directory is the execution queue for CRC project work. The active plan is authoritative for what to do next; completed plans remain unchanged as historical records.

## Start of a work session

1. Read this file.
2. Read [`README.md`](./README.md) to find the active numbered plan.
3. Read that plan’s baseline, locked scope, integration/visual test contract, status board, and session log.
4. Execute only the single step marked `[NEXT]`, unless a tiny prerequisite is required or the step is already done or genuinely blocked.
5. Preserve unrelated working-tree changes. In particular, do not overwrite or discard untracked tests without confirming ownership.

## Status markers

- `[NEXT]` — the one step selected for the next work session.
- `[TODO]` — queued but not yet selected.
- `[IN PROGRESS]` — started but its completion bar has not been met.
- `[BLOCKED]` — cannot proceed until the named decision, dependency, or fix exists.
- `[DONE]` — completion bar met and verification recorded.

Keep exactly one `[NEXT]` marker in the active numbered plan. The detailed step heading is the canonical marker; the summary board uses the corresponding plain-language queue state and must agree with it.

## Execution rules

- Start the selected step by changing its heading from `[NEXT]` to `[IN PROGRESS]` and its board state from `Next` to `In progress`.
- Work on the smallest complete slice that can satisfy that step’s “Done when” section.
- Treat disputed interaction behavior as a design question, not an accidental test expectation.
- For web-like interaction semantics, gather evidence in this order:
  1. executable native-browser characterization;
  2. current W3C UI Events / Pointer Events behavior;
  3. an explicit CRC-specific decision where Canvas has no native equivalent.
- Record public or architectural decisions in the plan’s decision log before depending on them in later steps.
- Prefer deterministic counters and ownership assertions for leak tests. Heap/garbage-collection observations may supplement those tests but must not be the only gate.
- Every step must satisfy the active plan’s integration/visual test contract before it can become `[DONE]`:
  - a scenario using the public API is runnable in the local browser gallery;
  - the headless browser suite imports and drives that exact scenario rather than a test-only imitation;
  - behavior has semantic assertions and applicable visual output has deterministic pixel/screenshot assertions;
  - the manual procedure and expected observations are written down;
  - a dated field note records browser quirks, flakes, failed approaches, and reusable test-tool opportunities.
- Keep scenario implementations presentation-neutral. Gallery pages, headless
  drivers, and current documentation pages should be adapters over the same
  scenario/catalog entry rather than dependencies of one another.
- Give each scenario an explicit visibility/maturity classification. Diagnostic and stress scenarios may remain local/test-only; do not publish them as user documentation merely because they appear in the gallery.
- Never update visual baselines merely to make CI green. Inspect the expected, actual, and diff artifacts and record why the change is correct.
- Internal unit tests and test-only diagnostics may supplement a step, but they do not replace its public-API integration scenario.
- Run the verification named by the selected step. Report failures honestly.
- Do not expand scope to new input APIs, component families, or a broad rewrite
  unless the plan is explicitly amended. JSX and `createElement` are the current
  supported authoring surfaces, not future scope.

## End of a work session

1. Set the active step to `[DONE]`, `[IN PROGRESS]`, or `[BLOCKED]` based on its completion bar.
2. If it is `[DONE]`, move `[NEXT]` to the next unblocked step and update the board states.
3. Keep exactly one `[NEXT]` marker unless the plan is fully complete.
4. Append a dated session-log entry with:
   - concrete artifacts or behavior changed;
   - verification run and its result;
   - decisions or blockers;
   - the next slice.
5. Add or update the step’s testing field note and link it from the session log.
6. Keep the status board synchronized with the detailed step headings.

## Plan rollover

When every step in the active plan is `[DONE]`:

1. Leave the completed numbered plan unchanged.
2. Create the next numbered plan only if another phase is approved.
3. Update [`README.md`](./README.md) so exactly one plan is active and older plans are listed under the archive.
4. Copy this operating protocol only when a future phase needs to change it; do not duplicate it into every plan.
