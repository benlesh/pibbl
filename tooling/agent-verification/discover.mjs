import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Curated scenario contracts. Discovery does not execute commands or certify coverage.
const workflows = [
  {
    id: 'layout-placement', scenario: 'agent-layout-placement',
    requirements: ['LAY-02', 'LAY-06'], route: '/#/testing/agent-layout-placement',
    prerequisites: ['Node 24.15+ on Node 24 LTS, pnpm 11.21.0 and installed Playwright Chromium.', 'Running source-development Studio; built inspection is unavailable.'],
    initialState: 'Clipped local offset: parent left=30/top=20; shape x=90; 20x20 child allocation; outer translation (40,30) and scale 2.',
    actions: ['Inspect declared placement, observed allocation, entry transform and clip probe.', 'Click the clipped center, then allow overflow and click the same center.', 'Repair local x to zero and click the new center.'],
    acceptance: ['Root center (300,90) is inside shape geometry but excluded by the parent clip; no click is delivered.', 'Allowing overflow keeps allocation and center unchanged, makes the shape targetable and delivers one click.', 'Repair changes the center to (120,90) inside the clip while preserving the 20x20 allocation.', 'Pending, error and disposed observations are unavailable; previous snapshots remain historical.'],
    sources: ['packages/scenarios/src/agent-layout-placement.ts', 'packages/scenarios/src/agent-layout-placement.example.tsx', 'packages/core/test/agent-layout-workflow.test.ts', 'packages/core/test/agent-layout-placement.test.tsx', 'tooling/agent-verification/layout-smoke.mjs'],
    check: { executable: 'corepack', arguments: ['pnpm@11.21.0', 'exec', 'vitest', 'run', 'packages/core/test/agent-layout-workflow.test.ts', 'packages/core/test/agent-layout-placement.test.tsx', '--browser.headless', '--browser.ui=false'] },
    replay: { executable: 'node', arguments: ['tooling/agent-verification/layout-smoke.mjs'], requires: 'Supply the source Studio URL and a new report file path. Existing output files are refused.' },
    queries: ['Live evidence: agent-layout-placement-evidence contains declared, allocation, observed, diagnosis and clicks.', 'Read crc-layout-studio-smoke/1 with evidence-reader.mjs REPORT.json --action overlap-prohibited --fields ["/before/assertion","/before/relations/overlap/area","/after/lastActivated"]. Every view reports no schema-provided attestation.'],
    limits: ['Controlled layout fixture; no served-build attestation or general replay protocol yet.', 'Declared inputs are application provenance, not a general style resolver trace. Geometry probes do not prove pixel visibility.', 'LAY-06 still requires broader overlap/out-of-allocation coverage. Discovery does not close either requirement.'],
  },
  {
    id: 'missing-zero-invalid', scenario: 'viz-hover-lab', requirements: ['DAT-07'], route: '/#/testing/viz-hover-lab',
    prerequisites: ['Node 24.15+ on Node 24 LTS, pnpm 11.21.0 and installed Playwright Chromium.', 'Running source-development Studio for the native visualization replay.'],
    initialState: 'Choose Zero, missing and invalid values: ten rows include five finite values, one zero, two missing values and three nonfinite invalid values.',
    actions: ['Inspect tagged rows instead of treating JSON null as a universal missing-value representation.', 'Hover zero at x=1, the missing/invalid interval and post-gap x=9.', 'Replace the data and verify old missingness metadata is no longer current.'],
    acceptance: ['Valid zero produces an exact y=0 query, recorded tooltip label and a connected line segment.', 'Null, undefined, NaN and both infinities break interpolation and line segments rather than being coerced to zero.', 'At x=9 interpolation is 25 with an estimated tooltip label.', 'Serialized categories and counts refer to the same generation as the chart.'],
    sources: ['packages/scenarios/src/viz-hover-lab.ts', 'packages/core/test/agent-viz-missingness.test.ts', 'tooling/agent-verification/viz-replay.mjs'],
    check: { executable: 'corepack', arguments: ['pnpm@11.21.0', 'exec', 'vitest', 'run', 'packages/core/test/agent-viz-missingness.test.ts', '--browser.headless', '--browser.ui=false'] },
    replay: { executable: 'node', arguments: ['tooling/agent-verification/viz-replay.mjs'], requires: 'Supply the source Studio URL and an optional fresh output directory; this runs all visualization replay actions.' },
    queries: ['Read compact saved evidence: node tooling/agent-verification/evidence-reader.mjs REPORT.json', 'Inspect mixed data: --action zero-missing-invalid --fields ["/observations/0/state/missingness/counts/zero","/observations/0/state/missingness/counts/missing","/observations/0/state/missingness/counts/invalid","/observations/0/state/missingness/policy"]'],
    limits: ['Explicit finite-number/null/undefined/nonfinite application policy, not arbitrary business coercion.', 'Successful tooltip text calls establish emission, not unobscured glyph visibility. Native coordinates have documented finite precision.'],
  },

{
  "id": "text-redaction",
  "scenario": "agent-text-verification",
  "requirements": [
    "TXT-08"
  ],
  "route": "/#/testing/agent-text-verification",
  "prerequisites": [
    "Node 24.15+ on Node 24 LTS, pnpm 11.21.0 and installed Playwright Chromium.",
    "Source-development Studio for version-bound native replay; built inspection is unsupported."
  ],
  "initialState": "Seed label Revenue: 24; independent expectation Revenue: 42; private fixture string is painted but redacted in evidence.",
  "actions": [
    "Inspect initial failing label assertion.",
    "Repair label and observe pass.",
    "Reseed and observe failure again."
  ],
  "acceptance": [
    "Exact fixture labels remain available; other strings and observation errors stay redacted.",
    "All twelve required native checks complete, including seeded failure detection."
  ],
  "sources": [
    "packages/scenarios/src/agent-text-verification.ts",
    "packages/core/test/agent-text-workflow.test.ts",
    "tooling/agent-verification/text-replay.mjs"
  ],
  "check": {
    "executable": "corepack",
    "arguments": [
      "pnpm@11.21.0",
      "exec",
      "vitest",
      "run",
      "packages/core/test/agent-text-workflow.test.ts",
      "--browser.headless",
      "--browser.ui=false"
    ]
  },
  "replay": {
    "executable": "node",
    "arguments": [
      "tooling/agent-verification/text-replay.mjs"
    ],
    "requires": "Supply the running source Studio URL, then an optional fresh output directory."
  },
  "queries": [
    "Read compact evidence: node tooling/agent-verification/evidence-reader.mjs REPORT.json",
    "Inspect one field: --action repair --fields [\"/state/assertion\",\"/state/observation/records/0/content\"]"
  ],
  "limits": [
    "Successful text calls are not glyph-visibility or font-resolution proof.",
    "The text replay validates its entire envelope before retaining it; this is not screenshot redaction."
  ]
},
{
  "id": "signal-mutation",
  "scenario": "agent-signal-mutation",
  "requirements": [
    "SIG-14"
  ],
  "route": "/#/testing/agent-signal-mutation",
  "prerequisites": [
    "Node 24.15+ on Node 24 LTS, pnpm 11.21.0 and installed Playwright Chromium.",
    "Source-development Studio for version-bound native replay; built inspection is unsupported."
  ],
  "initialState": "Explicit 480x180 contain viewport; amount 10 in source and display; default Object.is equality.",
  "actions": [
    "Equal no-op: verify intentional unchanged value.",
    "Mutate existing object to 42 and verify stale display at 10.",
    "Repeat mutation, replace object, then reset."
  ],
  "acceptance": [
    "Same-reference mutation does not advance the signal revision or evaluate the component.",
    "Replacement publishes and displays 42; an independent pixel must be blue.",
    "Native pixel sampling includes contain offsets; finite observation is two host frames."
  ],
  "sources": [
    "packages/scenarios/src/agent-signal-mutation.ts",
    "packages/core/test/agent-signal-mutation.test.ts",
    "tooling/agent-verification/signal-mutation-replay.mjs"
  ],
  "check": {
    "executable": "corepack",
    "arguments": [
      "pnpm@11.21.0",
      "exec",
      "vitest",
      "run",
      "packages/core/test/agent-signal-mutation.test.ts",
      "--browser.headless",
      "--browser.ui=false"
    ]
  },
  "replay": {
    "executable": "node",
    "arguments": [
      "tooling/agent-verification/signal-mutation-replay.mjs"
    ],
    "requires": "Supply the running source Studio URL, then an optional fresh output directory."
  },
  "queries": [
    "Read compact evidence: node tooling/agent-verification/evidence-reader.mjs REPORT.json",
    "Inspect repaired state: --action replacement --fields [\"/state/sourceAmount\",\"/state/evaluatedAmount\",\"/state/diagnosis\"]"
  ],
  "limits": [
    "Only explicit application-owned data and the declared equality policy are diagnosed.",
    "No universal deep-mutation detector or guarantee against a later unrelated redraw."
  ]
},
  {
    id: 'targeting-interception', scenario: 'agent-targeting-verification',
    requirements: ['HIT-03', 'HIT-09', 'HIT-12', 'HIT-13', 'EVT-11'],
    route: '/#/testing/agent-targeting-verification',
    prerequisites: ['Node 24.15+ on Node 24 LTS, pnpm 11.21.0 and installed Playwright Chromium.', 'Source-development Studio for manual inspection; built Studio does not expose this inspector.'],
    initialState: 'Seed mode; fixed 480x240 logical viewport; item-a unselected; zero-alpha decoration above the blue control.',
    actions: ['Inspect target at root-logical (144,112).', 'Deliver a native click and compare predicted target with delivery and selected item.', 'Repair decoration using pointerEvents=none and repeat.', 'Check intentional-block mode as the benign no-selection case.'],
    acceptance: ['Seed delivers to the decoration and does not select item-a.', 'Repair selects item-a exactly once.', 'Blue pixel (144,112) remains [37,99,235,255] across seed and repair.', 'Intentional blocking keeps item-a unselected.'],
    sources: ['packages/scenarios/src/agent-targeting-verification.ts', 'packages/core/test/agent-targeting-verification.test.ts', 'tooling/agent-verification/targeting.ts'],
    check: { executable: 'corepack', arguments: ['pnpm@11.21.0', 'exec', 'vitest', 'run', 'packages/core/test/agent-targeting-verification.test.ts', '--browser.headless', '--browser.ui=false'] },
    replay: { executable: 'node', arguments: ['tooling/agent-verification/replay.mjs'], requires: 'Supply the running source Studio URL as the next argument; optional output directory must be fresh.' },
    queries: ['Inspector snapshot: generation, targeting records and focus/capture state.', 'Active geometry probe: predicted target; browser point probe: DOM interception.', 'Fixture evidence: actual delivery target/generation and selected application entity.'],
    limits: ['Covers this controlled fixture, not every requirement in full.', 'Geometry probes reject opaque renderer resolvers; owner-document checks do not inspect ancestor frames.'],
  },
  {
    id: 'weighted-aggregation', scenario: 'viz-hover-lab',
    requirements: ['DAT-04', 'DAT-06', 'INT-03', 'INT-08'],
    route: '/#/testing/viz-hover-lab',
    prerequisites: ['Node 24.15+ on Node 24 LTS, pnpm 11.21.0 and installed Playwright Chromium.', 'Source-development Studio for the native replay and provenance evidence.'],
    initialState: 'Select weighted-data-bug to seed an unweighted aggregation of the controlled weighted dataset.',
    actions: ['Inspect input/included/group counts, sums and denominators.', 'Compare group values with independently calculated weighted means.', 'Select weighted-data and repeat hover and aggregation checks.'],
    acceptance: ['Weighted means must be 10 and 30: (0*3+40*1)/4 and (0*1+40*3)/4.', 'At x=2.5, correct interpolation is 15; the seeded unweighted means incorrectly produce 20.', 'Correct geometry alone must not make the incorrect aggregate pass.'],
    sources: ['packages/scenarios/src/viz-hover-lab.ts', 'packages/core/test/agent-viz-verification.test.ts', 'tooling/agent-verification/viz-replay.mjs'],
    check: { executable: 'corepack', arguments: ['pnpm@11.21.0', 'exec', 'vitest', 'run', 'packages/core/test/agent-viz-verification.test.ts', '--browser.headless', '--browser.ui=false'] },
    replay: { executable: 'node', arguments: ['tooling/agent-verification/viz-replay.mjs'], requires: 'Supply the running source Studio URL as the next argument; optional output directory must be fresh.' },
    queries: ['Fixture pipeline: group counts, weighted sums, denominators and values.', 'Native hover result and generation under the same dataset.'],
    limits: ['Controlled two-group arithmetic, not arbitrary joins, sampling or statistical correctness.', 'The focused suite checks additional cases; this mapping certifies none of them merely by discovery.'],
  },
];

export function discoverRequirement(id, ledger) {
  const row = ledger.requirements.find(row => row.id === id);
  if (!row) throw Object.assign(new Error('Unknown verification requirement ID.'), { code: 'CRC_UNKNOWN_REQUIREMENT' });
  const matches = workflows.filter(workflow => workflow.requirements.includes(id));
  return structuredClone({ schema: 'crc-verification-discovery/1', verification: 'discovery-only',
    status: matches.length ? 'mapped' : 'unmapped', requirementId: id, requirement: row.requirement,
    assessedStatus: row.status, remaining: row.remaining, workflows: matches });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [id, ...extra] = process.argv.slice(2);
    if (!id || extra.length) throw Object.assign(new Error('Usage: node tooling/agent-verification/discover.mjs REQUIREMENT-ID'), { code: 'CRC_DISCOVERY_USAGE' });
    const ledger = JSON.parse(await readFile(new URL('../../docs/strategy/agent-verification-ledger.json', import.meta.url), 'utf8'));
    process.stdout.write(JSON.stringify(discoverRequirement(id, ledger)) + '\n');
  } catch (error) {
    process.stdout.write(JSON.stringify({ schema: 'crc-verification-discovery/1', status: 'invalid', code: error.code ?? 'CRC_DISCOVERY_UNAVAILABLE', message: error.message }) + '\n');
    process.exitCode = 1;
  }
}
