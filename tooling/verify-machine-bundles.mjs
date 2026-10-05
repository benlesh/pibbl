import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = process.argv.includes('--source');
const cases = {
  unused: `import { defineMachine } from '@pibbl/core/machines'; console.log('no machines');`,
  definition: `import { defineMachine } from '@pibbl/core/machines'; console.log(defineMachine({initial:'idle',context:{},states:{idle:{}}}));`,
  actor: `import { defineMachine,createMachine } from '@pibbl/core/machines'; const actor=createMachine(defineMachine({initial:'idle',context:{},states:{idle:{on:{GO:'active'}},active:{}}}),{input:undefined});actor.start();actor.send({type:'GO'});console.log(actor.snapshot.get());actor.stop();`,
  hook: `import { useMachine } from '@pibbl/core/machines'; globalThis.machineHook=useMachine;`,
  animation: `import { playAnimation } from '@pibbl/core/machines/animation';globalThis.machineAnimation=playAnimation;`,
};
for (const [name, contents] of Object.entries(cases)) {
  const result = await build({
    stdin: { contents, resolveDir: root, sourcefile: 'machine-consumer.js' },
    bundle: true, write: false, metafile: true, minify: true, format: 'esm', platform: 'browser',
    ...(source ? { alias: {
      '@pibbl/core/machines/animation': resolve(root, 'packages/core/src/features/machines/animation.ts'),
      '@pibbl/core/machines': resolve(root, 'packages/core/src/features/machines/index.ts'),
    } } : {}),
  });
  const retained = Object.values(result.metafile.outputs).flatMap(output => Object.entries(output.inputs).filter(([, detail]) => detail.bytesInOutput > 0).map(([path]) => path));
  const code = result.outputFiles[0].contents;
  assert.ok(!retained.some(path => /features\/(physics|sprites|textures)/u.test(path)), `${name} pulled in unrelated optional features`);
  if (name === 'unused') assert.ok(!retained.some(path => path.includes('/machines/')), 'Unused machines survive tree shaking');
  if (name === 'definition' || name === 'actor') {
    assert.ok(!retained.some(path => /machines\/(hook|animation)\./u.test(path)), `${name} retains a mount/animation adapter`);
    assert.ok(!retained.some(path => /lib\/(animation|renderers|hooks)\//u.test(path)), `${name} retains renderer, playback, or hook code: ${retained.join(', ')}`);
  }
  process.stdout.write(`${source ? 'source' : 'built'} ${name}: ${code.length} minified bytes, ${gzipSync(code).length} gzip bytes; ${retained.length} retained modules\n`);
}
