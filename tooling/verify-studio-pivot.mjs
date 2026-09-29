import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { parse } from '@babel/parser';
import { crcRuntimeSource } from './crc-runtime-source.ts';
import {
  collectPublicExports,
  crcPublicCompilerOptions,
} from './studio-docs/api-exports.ts';

const repositoryRoot = resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const tsc = join(dirname(require.resolve('typescript')), 'tsc.js');
const expectedModules = new Map([
  ['@crc/core', 'node_modules/@crc/core/index.d.ts'],
  ['@crc/core/jsx-runtime', 'node_modules/@crc/core/jsx-runtime.d.ts'],
  ['@crc/core/jsx-dev-runtime', 'node_modules/@crc/core/jsx-dev-runtime.d.ts'],
  ['@crc/physics/2d/geometry', 'node_modules/@crc/physics/2d/geometry.d.ts'],
  ['@crc/physics/2d', 'node_modules/@crc/physics/2d.d.ts'],
  ['@crc/physics/3d/geometry', 'node_modules/@crc/physics/3d/geometry.d.ts'],
  ['@crc/particles', 'node_modules/@crc/particles/index.d.ts'],
  ['@crc/three', 'node_modules/@crc/three/index.d.ts'],
  ['@crc/viz', 'node_modules/@crc/viz/index.d.ts'],
]);
const bundle = await readFile(join(repositoryRoot, 'playground/src/crc-editor-types.txt'), 'utf8');
const markers = [...bundle.matchAll(/^\/\* @crc-studio-module (.+) \*\/$/gmu)];
assert.deepEqual(markers.map(match => match[1]).sort(), [...expectedModules.keys()].sort());
const sourceEntries = {
  root: join(repositoryRoot, 'packages/core/src/index.ts'),
  jsxRuntime: join(repositoryRoot, 'packages/core/src/jsx-runtime.ts'),
  jsxDevRuntime: join(repositoryRoot, 'packages/core/src/jsx-dev-runtime.ts'),
  physics2dGeometry: join(repositoryRoot, 'packages/physics/src/2d-geometry.ts'),
  physics2d: join(repositoryRoot, 'packages/physics/src/2d.ts'),
  physics3dGeometry: join(repositoryRoot, 'packages/physics/src/3d-geometry.ts'),
  particles: join(repositoryRoot, 'packages/particles/src/index.ts'),
  three: join(repositoryRoot, 'packages/three/src/index.ts'),
  viz: join(repositoryRoot, 'packages/viz/src/index.ts'),
};
const builtEntries = Object.fromEntries(Object.entries(sourceEntries).map(([name, path]) => [
  name,
  path.replace('/src/', '/dist/').replace(/\.ts$/u, '.d.ts'),
]));
const sourceInventory = await collectPublicExports(sourceEntries, crcPublicCompilerOptions);
const builtInventory = await collectPublicExports(builtEntries, crcPublicCompilerOptions);
const inventoryKey = new Map([
  ['@crc/core', 'root'],
  ['@crc/core/jsx-runtime', 'jsxRuntime'],
  ['@crc/core/jsx-dev-runtime', 'jsxDevRuntime'],
  ['@crc/physics/2d/geometry', 'physics2dGeometry'],
  ['@crc/physics/2d', 'physics2d'],
  ['@crc/physics/3d/geometry', 'physics3dGeometry'],
  ['@crc/particles', 'particles'],
  ['@crc/three', 'three'],
  ['@crc/viz', 'viz'],
]);

function explicitNames(content) {
  const ast = parse(content, { sourceType: 'module', plugins: [['typescript', { dts: true }]] });
  const names = new Set();
  for (const statement of ast.program.body) {
    if (statement.type !== 'ExportNamedDeclaration') continue;
    if (statement.declaration?.id?.name) names.add(statement.declaration.id.name);
    for (const declaration of statement.declaration?.declarations ?? []) {
      if (declaration.id.type === 'Identifier') names.add(declaration.id.name);
    }
    for (const specifier of statement.specifiers) {
      if (specifier.exported.type === 'Identifier') names.add(specifier.exported.name);
    }
  }
  return [...names].sort();
}
function inventoryNames(entry) {
  return [...new Set([...entry.values, ...entry.types, ...entry.overview])].sort();
}

const temp = await mkdtemp(join(tmpdir(), 'crc-studio-pivot-'));
try {
  for (const [index, marker] of markers.entries()) {
    const name = marker[1];
    const relative = expectedModules.get(name);
    const file = join(temp, relative);
    await mkdir(dirname(file), { recursive: true });
    const content = bundle.slice(marker.index + marker[0].length, markers[index + 1]?.index ?? bundle.length).trimStart();
    assert.ok(content.length > 0, `Studio declaration for ${name} is empty`);
    const key = inventoryKey.get(name);
    assert.deepEqual(inventoryNames(sourceInventory[key]), inventoryNames(builtInventory[key]), `${name} source and built exports differ`);
    assert.deepEqual(explicitNames(content), inventoryNames(sourceInventory[key]), `${name} Studio exports differ from the public package`);
    await writeFile(file, content);
  }
  const consumer = `
    /** @jsxImportSource @crc/core */
    import { crc, Rectangle, DragHandle, ManipulationFrame, ResizeHandles, RotationHandle, useManipulation, useSignal, type CRCNode } from '@crc/core';
    import { defineThreeLayer, type CRCThreeTarget } from '@crc/three';
    import { Particles2D } from '@crc/particles';
    import { sphereShape3D, boundsOfShape3D } from '@crc/physics/3d/geometry';
    import { PhysicsWorld2D } from '@crc/physics/2d';
    import { Scene, PerspectiveCamera, Mesh, BoxGeometry, MeshBasicMaterial } from 'three';
    import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
    const Layer = defineThreeLayer<{ angle: number }, { scene: Scene; camera: PerspectiveCamera; mesh: Mesh<BoxGeometry, MeshBasicMaterial> }>({
      create() {
        const scene = new Scene();
        const camera = new PerspectiveCamera();
        const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
        scene.add(mesh);
        return { scene, camera, mesh };
      },
      update(resources, props) { resources.mesh.rotation.y = props.angle; },
      targets(resources): readonly CRCThreeTarget[] { return [{ object: resources.mesh }]; },
      dispose(resources) { resources.mesh.geometry.dispose(); resources.mesh.material.dispose(); },
    });
    function App(): CRCNode {
      void Particles2D; void PhysicsWorld2D; void OrbitControls;
      void boundsOfShape3D(sphereShape3D({ radius: 1 }));
      const box = useSignal({ left: 20, top: 30, width: 100, height: 60 });
      const manipulation = useManipulation({ box });
      return <><ManipulationFrame {...manipulation.frameProps}><DragHandle controller={manipulation} formatReadout={({ left, top }) => String(left + top)} style={{ readout: { gap: 5, active: { visible: true, fill: 'blue' } } }}><Rectangle keyboardFocusable style={{ width: 20, height: 20, cursor: 'grab' }} /></DragHandle><ResizeHandles controller={manipulation} /><RotationHandle controller={manipulation} /></ManipulationFrame><Layer angle={1} style={{ width: 20, height: 20 }} /></>;
    }
    declare const canvas: HTMLCanvasElement;
    crc(canvas, <App />);
  `;
  await writeFile(join(temp, 'consumer.tsx'), consumer);
  await writeFile(join(temp, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      jsx: 'react-jsx', jsxImportSource: '@crc/core', lib: ['ESNext', 'DOM'],
      module: 'ESNext', moduleResolution: 'Bundler', noEmit: true,
      skipLibCheck: false, strict: true, target: 'ESNext',
      paths: {
        three: [join(repositoryRoot, 'packages/three/node_modules/@types/three/index.d.ts')],
        'three/addons/controls/OrbitControls.js': [join(repositoryRoot, 'packages/three/node_modules/@types/three/examples/jsm/controls/OrbitControls.d.ts')],
      },
    },
    files: ['consumer.tsx'],
  }));
  const result = spawnSync(process.execPath, [tsc, '-p', temp], { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stdout + result.stderr);
    throw new Error('Studio public declaration consumer failed.');
  }

  async function runtime(mode) {
    const plugin = crcRuntimeSource(mode);
    const resolved = plugin.resolveId('virtual:crc-runtime-source');
    const loaded = await plugin.load(resolved);
    const serialized = /^export default ([\s\S]+);$/u.exec(loaded)?.[1];
    assert.ok(serialized, `Studio ${mode} runtime did not expose a bundle`);
    const context = { EventTarget };
    runInNewContext(JSON.parse(serialized), context);
    assert.ok(context.CRC_CORE, `Studio ${mode} runtime did not initialize`);
    return context.CRC_CORE;
  }
  const source = await runtime('source');
  const built = await runtime('built');
  assert.deepEqual(Object.keys(source).sort(), Object.keys(built).sort());
  for (const runtime of [source, built]) {
    for (const name of ['crc', 'useManipulation', 'Manipulable', 'ManipulationFrame', 'DragHandle', 'ResizeHandle', 'ResizeHandles', 'RotationHandle', 'degrees', 'defineRenderLayer', 'defineThreeLayer', 'Particles2D', 'PhysicsWorld2D', 'sphereShape3D']) {
      assert.equal(typeof runtime[name], 'function', `${name} must be in the Studio runtime`);
    }
    for (const name of ['WebGLLayer', 'Particles3D', 'PhysicsWorld3D', 'useOrbitCamera']) {
      assert.equal(name in runtime, false, `${name} must not be in the Studio runtime`);
    }
    assert.deepEqual(Object.keys(runtime.__crcStudioModules).sort(), [
      '@crc/three', 'three', 'three/addons/controls/OrbitControls.js',
    ]);
    assert.equal(runtime.__crcStudioModules['@crc/three'].defineThreeLayer, runtime.defineThreeLayer);
    assert.equal(typeof runtime.__crcStudioModules.three.Scene, 'function');
    assert.equal(typeof runtime.__crcStudioModules['three/addons/controls/OrbitControls.js'].OrbitControls, 'function');
  }
  process.stdout.write('Studio source, built, and editor declarations have exact public export-name parity; source/built runtime and Three addons passed.\n');
} finally {
  await rm(temp, { recursive: true, force: true });
}
