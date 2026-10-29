import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
/** Checks the copyable public recording against the exhaustive pinned corpus. */
export function verifyYogaPublicFixtures() {
  const source = readFileSync(new URL('../packages/scenarios/src/learning/layout/wasm-yoga-migration.example.tsx', import.meta.url), 'utf8');
  const reference = JSON.parse(readFileSync(new URL('./layout-yoga-rehearsal/reference.json', import.meta.url), 'utf8'));
  const match = source.match(/const DEFAULT_WASM_YOGA_MIGRATION_FIXTURES = ([\s\S]*?) satisfies readonly YogaMigrationFixture\[\];/);
  assert.ok(match, 'public fixture defaults remain explicit copyable data');
  const fixtures = JSON.parse(match[1]);
  assert.deepEqual(fixtures.map(fixture => fixture.name), ['grow', 'cap', 'shrink', 'custom-column-measure', 'custom-column-measure-resized']);
  for (const fixture of fixtures) {
    const recorded = reference.cases.find(candidate => candidate.name === fixture.name);
    assert.ok(recorded, `missing native reference: ${fixture.name}`);
    for (const [key, value] of Object.entries(fixture)) assert.deepEqual(recorded[key], value, `${fixture.name}.${key} differs from recorded geometry`);
  }
  return { cases: fixtures.length, fullCases: reference.cases.length };
}
if (import.meta.main) {
  const { cases, fullCases } = verifyYogaPublicFixtures();
  console.warn(`Public Yoga defaults: ${cases} cases agree with the full ${fullCases}-case corpus`);
}
