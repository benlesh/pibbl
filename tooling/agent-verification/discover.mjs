import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Curated scenario contracts. Discovery does not execute commands or certify coverage.
const workflows = [
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
