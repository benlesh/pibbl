# Audit evidence

> **Historical status: Dated audit evidence and remediation proposals; current behavior is defined by runtime contracts.**

These files are historical measurements from 2026-10-02, not current pass/fail certificates. Read the [audit index](../README.md) for environment, baseline, fixture corrections, and limitations.

- [Real-time soak](soak-results.json) and [stdout](soak.log).
- [Synthetic load and failure probes](heavy-results.json). The first filter fixture is invalid and was corrected in the follow-up.
- [Corrected filter, sustained physics, and animation age measurements](followup-results.json) and [stdout](followup.log).
- [Physics handle retention](handle-retention-result.json).
- [Three CPU snapshot benchmark](three-picking-report.json).
- [Initial focused tests](tests.log) and [extended tests](extended-tests.log).
- [Source fingerprints and Git baseline](manifest.json).

The original probes below preserve the exact workload and instrumentation. They contain the original machine's absolute paths and expect a local Vite server at 127.0.0.1:5199. They are archived reproducibility references, not portable production test tooling. Read and adapt their paths and outputs before running; convert necessary cases into repository-supported public scenarios and tests during implementation. Do not run benchmarks concurrently or overwrite historical evidence with new results.

- [Soak probe](original-probes/crc-review-stress.mjs.txt).
- [Load and failure probe](original-probes/crc-review-heavy.mjs.txt).
- [Follow-up probe](original-probes/crc-review-followup.mjs.txt).
- [Handle retention probe](original-probes/crc-handle-retention-probe.mjs.txt).

The initial test command was `corepack pnpm@11.21.0 exec vitest run packages/core/test/signal-scheduler-performance.test.ts packages/core/test/runtime-cleanup-stress.test.ts packages/core/test/animation-performance.test.ts packages/core/test/filter-performance.test.ts packages/core/test/features/textures/performance.test.tsx packages/core/test/physics-2d-performance.test.tsx packages/core/test/particle-performance.test.ts --browser.headless --browser.ui=false --maxWorkers=1`.

The extended command was `corepack pnpm@11.21.0 exec vitest run packages/core/test/lifecycle-ownership.test.ts packages/core/test/signal-scheduler-ownership.test.ts packages/core/test/animation-ownership.test.ts packages/core/test/particle-ownership.test.ts packages/core/test/filter-ownership.test.ts packages/core/test/displacement-ownership.test.ts packages/core/test/event-performance.test.ts packages/core/test/animation-rendering.test.tsx packages/core/test/physics-2d-composition.test.tsx packages/core/src/lib/render-layer/define-render-layer.test.tsx packages/three/src/lib/define-three-layer.test.tsx packages/core/src/lib/animation/evaluate.test.ts --browser.headless --browser.ui=false --maxWorkers=1`.

The texture reviewer reported `corepack pnpm@11.21.0 vitest run packages/core/test/features/textures --browser.headless --browser.ui=false` with 74 passing tests. The Three command was `node --import tsx tooling/agent-verification/benchmark-three-picking.mjs /tmp/crc-review-three-cost`.

The browser probes used `corepack pnpm@11.21.0 -C playground run playground:dev --host 127.0.0.1 --port 5199`, then the respective Node script. Browser application imports use public exports; private seams are used for scheduling control and measurement. Real-time and synthetic results must remain separately labeled.
