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

const fixtureRoot = await mkdtemp(join(tmpdir(), 'pibbl-scenario-discovery-'));
const sourceDirectory = join(fixtureRoot, 'packages/scenarios/src');
const catalogedPath = 'packages/scenarios/src/cataloged.example.tsx';
const legacyPath = 'packages/scenarios/src/orphan.example.ts';
const orphanTsxPath = 'packages/scenarios/src/orphan.example.tsx';
const tutorialCatalogedPath =
  'packages/scenarios/src/tutorials/diagram-editor/01-canvas-scene.example.tsx';
const tutorialOrphanPath =
  'packages/scenarios/src/tutorials/diagram-editor/02-first-node.example.tsx';

try {
  await mkdir(sourceDirectory, { recursive: true });
  await writeFile(join(fixtureRoot, catalogedPath), 'export default 1;\n');
  await writeFile(join(fixtureRoot, legacyPath), 'export default 2;\n');

  const withLegacy = await discoverExampleSourcePaths(
    sourceDirectory,
    fixtureRoot,
  );
  assert.deepEqual(withLegacy, [catalogedPath]);
  assert.doesNotThrow(() =>
    assertExampleSourceDiscovery(withLegacy, [catalogedPath], [], []),
  );

  await unlink(join(fixtureRoot, legacyPath));
  await writeFile(join(fixtureRoot, orphanTsxPath), 'export default 3;\n');
  await mkdir(join(fixtureRoot, 'packages/scenarios/src/tutorials/diagram-editor'), {
    recursive: true,
  });
  await writeFile(join(fixtureRoot, tutorialCatalogedPath), 'export default 4;\n');
  await writeFile(join(fixtureRoot, tutorialOrphanPath), 'export default 5;\n');
  const withOrphanTsx = await discoverExampleSourcePaths(
    sourceDirectory,
    fixtureRoot,
  );
  assert.throws(
    () => assertExampleSourceDiscovery(withOrphanTsx, [catalogedPath], [], []),
    /disagrees with the catalog.*Omitted:.*orphan\.example\.tsx/iu,
  );
  assert.throws(
    () =>
    assertExampleSourceDiscovery(
      withOrphanTsx,
      [catalogedPath, orphanTsxPath],
      [],
      [tutorialCatalogedPath],
    ),
    /Tutorial source discovery disagrees with the catalog.*Omitted:.*02-first-node\.example\.tsx/iu,
  );
  assert.doesNotThrow(() =>
    assertExampleSourceDiscovery(
      withOrphanTsx,
      [catalogedPath, orphanTsxPath],
      [],
      [tutorialCatalogedPath, tutorialOrphanPath],
    ),
  );
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}

process.stdout.write(
  'Scenario discovery fixture ignored non-TSX and rejected uncataloged example sources.\n',
);
