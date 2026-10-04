import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';
import { resolve } from 'node:path';

// Built public entries only: no source aliases, installs, browser, or rebuild.
const root = resolve(import.meta.dirname, '..');
const fixtures = {
  core: `import { PhysicsWorld2D } from '@crc/core/physics/2d'; import { crc, createElement, Rectangle } from '@crc/core'; export const mount = canvas => crc(canvas, createElement(Rectangle, { style: { width: 20, height: 20, fill: 'red' } }));`,
  geometry: `export { circleShape2D, raycastShape2D } from '@crc/core/physics/2d/geometry'; export { sphereShape3D, raycastShape3D } from '@crc/core/physics/3d/geometry';`,
  physics: `import { crc, createElement } from '@crc/core'; import { PhysicsWorld2D } from '@crc/core/physics/2d'; export const mount = canvas => crc(canvas, createElement(PhysicsWorld2D, { children: [] }));`,
};
for (const [name, contents] of Object.entries(fixtures)) {
  const result = await build({
    absWorkingDir: root,
    stdin: { contents, resolveDir: resolve(root, 'playground'), sourcefile: `${name}.js` },
    tsconfigRaw: { compilerOptions: {} },
    bundle: true, format: 'esm', platform: 'browser', target: 'esnext',
    minify: true, metafile: true, write: false, logLevel: 'silent',
  });
  const code = result.outputFiles[0].text;
  const retained = Object.values(result.metafile.outputs).flatMap(output =>
    Object.entries(output.inputs).filter(([, value]) => value.bytesInOutput > 0).map(([path]) => path));
  assert.ok(retained.every(path => !/packages\/[^/]+\/src\//.test(path)), `${name}: reached workspace source`);
  const engine = retained.some(path => /rapier/i.test(path));
  const wasm = code.includes('AGFzbQ'); // WASM magic in the embedded base64 payload.
  assert.equal(engine, name === 'physics', `${name}: unexpected Rapier retention`);
  assert.equal(wasm, name === 'physics', `${name}: unexpected embedded WASM retention`);
  assert.ok(code.length > 100, `${name}: fixture was erased`);
  const bytes = Buffer.byteLength(code);
  const gzip = gzipSync(code).byteLength;
  // Initial generous guardrails; calibrate against the first consolidated build.
  const limits = { core: [160_000, 48_000], geometry: [70_000, 23_000], physics: [4_600_000, 1_700_000] };
  assert.ok(bytes <= limits[name][0] && gzip <= limits[name][1], `${name}: bundle exceeded size budget (${bytes}/${gzip})`);
  process.stdout.write(`${name}: ${bytes} bytes minified, ${gzip} bytes gzip; Rapier=${engine}, WASM=${wasm}\n`);
}
