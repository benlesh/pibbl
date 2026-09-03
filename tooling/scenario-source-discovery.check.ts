import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  rm,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  assertExampleSourceDiscovery,
  discoverExampleSourcePaths,
} from './scenario-source-discovery';

const fixtureRoot = await mkdtemp(join(tmpdir(), 'crc-scenario-discovery-'));
const sourceDirectory = join(fixtureRoot, 'packages/scenarios/src');
const catalogedPath = 'packages/scenarios/src/cataloged.example.tsx';
const legacyPath = 'packages/scenarios/src/orphan.example.ts';
const orphanTsxPath = 'packages/scenarios/src/orphan.example.tsx';

try {
  await mkdir(sourceDirectory, { recursive: true });
  await writeFile(join(fixtureRoot, catalogedPath), 'export default 1;\n');
  await writeFile(join(fixtureRoot, legacyPath), 'export default 2;\n');

  const withLegacy = await discoverExampleSourcePaths(
    sourceDirectory,
    fixtureRoot,
  );
  assert.deepEqual(withLegacy, [catalogedPath, legacyPath]);
  assert.throws(
    () => assertExampleSourceDiscovery(withLegacy, [catalogedPath], []),
    /legacy \.example\.ts.*orphan\.example\.ts/iu,
  );

  await unlink(join(fixtureRoot, legacyPath));
  await writeFile(join(fixtureRoot, orphanTsxPath), 'export default 3;\n');
  const withOrphanTsx = await discoverExampleSourcePaths(
    sourceDirectory,
    fixtureRoot,
  );
  assert.throws(
    () => assertExampleSourceDiscovery(withOrphanTsx, [catalogedPath], []),
    /disagrees with the catalog.*Omitted:.*orphan\.example\.tsx/iu,
  );
  assert.doesNotThrow(() =>
    assertExampleSourceDiscovery(
      withOrphanTsx,
      [catalogedPath, orphanTsxPath],
      [],
    ),
  );
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}

process.stdout.write(
  'Scenario discovery fixture rejected legacy and uncataloged example sources.\n',
);
