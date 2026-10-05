// Opt-in descriptive benchmark; intentionally excluded from correctness gates.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { cpus, platform, arch } from 'node:os';
import { performance } from 'node:perf_hooks';
import { snapshotPickingScene } from '../../packages/three/src/lib/picking-snapshot.ts';
import { reserveEvidenceDirectory } from './evidence-directory.mjs';

const repository = fileURLToPath(new URL('../../', import.meta.url));
const requireThree = createRequire(resolve(repository, 'packages/three/package.json'));
const { Scene, Mesh, PerspectiveCamera, BoxGeometry, SphereGeometry, MeshBasicMaterial, REVISION } =
  await import(pathToFileURL(resolve(dirname(requireThree.resolve('three')), 'three.module.js')).href);
const output = resolve(process.argv[2] ?? resolve(repository, 'packages/core/test/out/three-picking-cost', new Date().toISOString().replaceAll(':', '-')));
await reserveEvidenceDirectory(output);
const sampleCount = 30;
const warmupCount = 5;
const report = {
  schema: 'pibbl-three-picking-cost/1', timestamp: new Date().toISOString(),
  environment: { node: process.version, platform: platform(), architecture: arch(), cpu: cpus()[0]?.model, threeRevision: REVISION },
  sourceSha256: createHash('sha256').update(await readFile(resolve(repository, 'packages/three/src/lib/picking-snapshot.ts'))).digest('hex'),
  sampleCount, warmupCount,
  meaning: 'Descriptive Node CPU snapshot cost, not browser frame time or a pass/fail performance gate.',
  limitations: ['No rendering, GPU, picking query, or browser scheduling included.', 'GC is uncontrolled; one preceding snapshot is retained during each copy.', 'Geometry bytes exclude objects, matrices, materials, maps, and other overhead.', 'Single local run with synthetic static scenes; not a cross-machine benchmark.'],
  cases: [],
};
for (const [name, count, shared, shape] of [
  ['shared-boxes', 1024, true, 'box'],
  ['unique-boxes', 1024, false, 'box'],
  ['shared-spheres', 128, true, 'sphere'],
  ['unique-spheres', 128, false, 'sphere'],
]) {
  const scene = new Scene(), camera = new PerspectiveCamera(), material = new MeshBasicMaterial();
  const makeGeometry = () => shape === 'box' ? new BoxGeometry(2, 2, 2) : new SphereGeometry(1, 64, 32);
  const resources = new Set();
  const sharedGeometry = shared ? makeGeometry() : null;
  for (let index = 0; index < count; index++) {
    const geometry = sharedGeometry ?? makeGeometry(); resources.add(geometry);
    scene.add(new Mesh(geometry, material));
  }
  try {
    let previous;
    const elapsed = [];
    for (let sample = -warmupCount; sample < sampleCount; sample++) {
      const start = performance.now();
      const next = snapshotPickingScene(scene, camera);
      const duration = performance.now() - start;
      assert.equal(next.scene.children.length, count);
      if (previous) assert.notEqual(next.scene, previous.scene);
      previous = next;
      if (sample >= 0) elapsed.push(duration);
    }
    const geometries = new Set(previous.scene.children.map(mesh => mesh.geometry));
    assert.equal(geometries.size, shared ? 1 : count);
    const bytes = [...geometries].reduce((total, geometry) => total +
      Object.values(geometry.attributes).reduce((sum, attribute) => sum + attribute.array.byteLength, 0) + (geometry.index?.array.byteLength ?? 0), 0);
    const ordered = [...elapsed].sort((a, b) => a - b);
    report.cases.push({ name, objectCount: count, uniqueGeometries: geometries.size, geometryBytesPerSnapshot: bytes,
      durationMs: { median: ordered[Math.ceil(sampleCount * .5) - 1], p95: ordered[Math.ceil(sampleCount * .95) - 1], max: ordered.at(-1), samples: elapsed } });
  } finally { for (const geometry of resources) geometry.dispose(); material.dispose(); }
}
await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
process.stdout.write(JSON.stringify({ evidence: resolve(output, 'report.json'), cases: report.cases.map(({ durationMs, ...entry }) => ({ ...entry, medianMs: durationMs.median, p95Ms: durationMs.p95 })) }) + "\n");
