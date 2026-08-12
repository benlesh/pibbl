# TFC-10 field note — durable trust gate and handoff

Date: 2026-08-11

## Scenario and risk

The final slice turns the confidence work into one repeatable contributor and CI contract. Thirteen presentation-neutral scenarios now share validated metadata, recursive executable-source discovery, lazy definitions, stable routes, controls, manual procedures, and exact source panels. The gallery index projects them by learning progression, public API, concept, category, and visibility/maturity.

The main risk was a false-green gate: a catalog could omit a source, a registered action could be broken, a packed artifact could differ from the workspace, or visual evidence could disappear while individual tests stayed green. Fresh review caught and closed concrete variants of each risk before completion.

## Manual and visual evidence

The complete index was traversed in the Codex in-app Chromium browser at `http://localhost:5174/#/scenarios`, desktop viewport. All 13 stable routes rendered their expected title, one Canvas, a 3–6 step manual procedure, known limitations, live controls, and the exact marker-validated `*.example.ts` source. The pages exposed 2–29 controls depending on the scenario; every source panel was nonempty. The index itself visibly separated six documentation candidates from seven laboratories and exposed every required facet. No warning or error appeared in the browser console.

Specialized field notes record execution of every checklist throughout DEP-01 through TFC-09. The final generic catalog test independently mounted all 13 definitions and, after review hardening, executed every registered action with a reset between actions before disposal. This includes the two deliberate 1,000-cycle stress actions under an explicit timeout.

The visual safeguard first ran the normal smoke comparison, then induced the documented purple-versus-blue mismatch. It required a nonzero exit with the `Visual mismatch` diagnostic and named expected, actual, and diff artifacts, verified every committed baseline SHA-256 byte stayed unchanged, and reran normal comparison green. The workflow configuration treats missing browser evidence as an error, not a warning.

## Final trust method

The documented sequence uses Node 24.19.0 and pnpm 11.21.0:

```sh
corepack pnpm@11.21.0 install --frozen-lockfile --strict-peer-dependencies
corepack pnpm@11.21.0 exec playwright install chromium
corepack pnpm@11.21.0 trust
```

The aggregate validates recursive catalog/source/index discovery, TypeScript 7, ESLint and Prettier, both package builds, source and built gallery builds, real packed-tarball Bundler/NodeNext/runtime consumers, the complete Chromium suite, visual failure/recovery, built-package smoke, lifecycle stress, and deterministic performance structure. The final repository-root run passed all stages: 34 browser files, 265 tests passed, and only the two explicit wall-clock timing cases skipped; focused lifecycle passed 9/9 and structural performance passed 3/3. Wall-clock timing remains an explicit reference cadence, while structural counters are required on every change.

## Initial risk closure

| Initial risk lead                           | Final disposition and evidence                                                                                                                                              |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Outdated development graph                  | Closed by DEP-02–04: current compatible graph, exact pnpm/Node floor, strict peers, deduplicated lock, and no outdated direct packages at closure.                          |
| Manual/headless drift                       | Closed by one catalog/definition/controller source for gallery and tests, recursive source discovery, action execution, and the generated index.                            |
| Unapproved or noisy screenshots             | Closed by named exact baselines, tight documented masks, deliberate failure/recovery, byte immutability, and required CI artifacts.                                         |
| Non-hover handlers outlive components       | Closed by component-owned replaceable event bindings and subtree/lifecycle regressions.                                                                                     |
| Hover teardown growth                       | Closed by one stable owned region slot and 1,000-rerender ledger stability.                                                                                                 |
| Optional listener cleanup and no disposal   | Closed by explicit listener ownership plus the additive idempotent `CRCController.dispose()`.                                                                               |
| Retained offscreen layers                   | Closed by parent-owned cascading layer instances, root paint entries, and nested cleanup ledgers.                                                                           |
| Late image callbacks                        | Closed by source-generation identity, detachable load/error handlers, removal/dispose tests, and controlled image stress.                                                   |
| Duplicate `crcWhenChanged` cleanup          | Closed by one component-owned cleanup slot and exact dependency/key/component/root cleanup tests.                                                                           |
| Repeated mouse hit tests                    | Closed by one logical target resolution per native event and exact structural counters.                                                                                     |
| Linear all-hit dispatch                     | Closed behaviorally by one reverse-paint-order topmost target; the optimized linear scan remains accepted until the measured spatial-index trigger is breached three times. |
| Nested clips used union semantics           | Closed by cumulative intersection across root, group, transform, and layer geometry with exact hit/pixel evidence.                                                          |
| Insertion order changed move/over semantics | Closed by the native-informed `out → over → move` contract and executable trace oracle.                                                                                     |

## Surprises and rejected approaches

- A top-level-only source glob was rejected because a nested example could escape both CI and the gallery. Both discovery paths are recursive now.
- The first generic manifest only mounted/reset/disposed scenarios. Review correctly rejected that as sufficient; it now executes every advertised action in isolation.
- Artifact names initially omitted the workflow attempt and evidence absence only warned. Rerun-safe names include both run ID and attempt; browser evidence absence fails the job.
- A portability cleanup attempted to resolve TypeScript's hidden `bin/tsc` subpath. The final trust run caught that TypeScript 7 export-map boundary; the harness now resolves the public package entry and invokes adjacent `lib/tsc.js` with Node.
- A workspace consumer was not represented as part of the aggregate once the stronger packed consumer was installed. The trust documentation now states the exact gate instead of overclaiming.
- Lifecycle artifact upload was removed because those focused tests do not promise their own visual artifacts; the required browser lane owns named expected/actual/diff evidence.

## Tooling decisions and follow-ups

TFC-10 installed the three repeatedly justified P0 tools: catalog/index validation, visual safeguard, and packed consumer. The raw CDP driver and table-driven visual specification remain P1 candidates; runtime ledgers, Canvas-command recording, image scheduling, and reference benchmark reporting remain P2 composition opportunities. A bundled font remains deferred until glyph appearance itself becomes a contract.

The unified workflow runs on pull requests, pushes to `main`, and manual dispatch, then exposes one stable `Trust gate` aggregate job. This local branch has not been pushed, so hosted green status and selecting that job in branch protection remain explicit external repository-administration actions rather than claimed local evidence. No product behavior remains blocked by them.
