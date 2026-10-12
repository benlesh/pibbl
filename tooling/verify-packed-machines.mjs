import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const tsc = join(dirname(require.resolve('typescript')), 'tsc.js');
const temp = mkdtempSync(join(tmpdir(), 'pibbl-packed-machines-'));

const run = (command, args, cwd = root) => execFileSync(command, args, {
  cwd,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});

function unpack(packageName) {
  const archive = join(temp, `${packageName}.tgz`);
  run('corepack', ['pnpm@11.21.0', 'pack', '--out', archive], join(root, 'packages', packageName));
  const directory = join(
    temp,
    'node_modules',
    packageName === 'core' ? '@pibbl/core' : 'pibbl',
  );
  mkdirSync(directory, { recursive: true });
  run('tar', ['-xzf', archive, '--strip-components=1', '-C', directory]);
  return directory;
}

function assertExports(actual, expected, entry) {
  assert.deepEqual(Object.keys(actual).sort(), expected.slice().sort(), `${entry} exports changed`);
}

async function importEntry(installed, specifier) {
  return import(pathToFileURL(installed.resolve(specifier)).href);
}

async function verifyTreeShaking(consumer) {
  const cases = {
    unused: "import { defineMachine } from '@pibbl/core/machines'; console.log('plain');",
    standalone: `
      import { createMachine, defineMachine } from '@pibbl/core/machines';
      const machine = defineMachine({ initial: 'idle', context: {}, states: { idle: {} } });
      const actor = createMachine(machine, { input: undefined });
      actor.start(); console.log(actor.snapshot.get()); actor.stop();
    `,
  };
  for (const [name, contents] of Object.entries(cases)) {
    const result = await build({
      stdin: {
        contents,
        loader: 'js',
        resolveDir: consumer,
        sourcefile: `packed-machine-${name}.js`,
      },
      bundle: true,
      format: 'esm',
      metafile: true,
      minify: true,
      platform: 'browser',
      write: false,
      logLevel: 'silent',
    });
    const retained = Object.values(result.metafile.outputs).flatMap(output =>
      Object.entries(output.inputs ?? {})
        .filter(([, detail]) => detail.bytesInOutput > 0)
        .map(([path]) => path.replaceAll('\\', '/')),
    );
    const joined = retained.join('\n');
    assert.equal(/features\/machines\/(hook|animation)\./u.test(joined), false,
      `Packed ${name} machine consumer retained mount or animation integration.`);
    assert.equal(/features\/(physics|sprites|textures|particles|viz)\//u.test(joined), false,
      `Packed ${name} machine consumer retained an unrelated optional feature.`);
    assert.equal(/\/lib\/(animation|hooks)\//u.test(joined), false,
      `Packed ${name} machine consumer retained playback or component hook code.`);
    if (name === 'unused') {
      assert.equal(/features\/machines\//u.test(joined), false,
        'An unused packed machine import survived tree shaking.');
    }
  }
}

try {
  const coreDirectory = unpack('core');
  const pibblDirectory = unpack('pibbl');
  const coreManifest = JSON.parse(readFileSync(join(coreDirectory, 'package.json'), 'utf8'));
  const pibblManifest = JSON.parse(readFileSync(join(pibblDirectory, 'package.json'), 'utf8'));
  assert.deepEqual(coreManifest.dependencies ?? {}, {}, 'Core machine and sprite entries need no runtime dependencies.');
  assert.deepEqual(Object.keys(pibblManifest.dependencies ?? {}), ['@pibbl/core'],
    'The unscoped facade may depend only on @pibbl/core.');
  assert.equal(pibblManifest.dependencies['@pibbl/core'], coreManifest.version);

  writeFileSync(join(temp, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  const installed = createRequire(join(temp, 'probe.mjs'));
  const entries = {
    '@pibbl/core/machines': ['assign', 'createMachine', 'defineMachine', 'fromCallback', 'useMachine'],
    '@pibbl/core/machines/animation': ['playAnimation'],
    '@pibbl/core/sprites': ['Sprite', 'defineSpriteAnimation', 'loadSpriteSheet'],
    '@pibbl/core/sprites/formats/aseprite': ['aseprite'],
    '@pibbl/core/sprites/formats/texture-packer': ['texturePacker'],
  };
  for (const [entry, names] of Object.entries(entries)) {
    const scoped = await importEntry(installed, entry);
    assertExports(scoped, names, entry);
    const unscopedEntry = entry.replace('@pibbl/core', 'pibbl');
    const unscoped = await importEntry(installed, unscopedEntry);
    assertExports(unscoped, names, unscopedEntry);
    for (const name of names) {
      assert.equal(unscoped[name], scoped[name], `${unscopedEntry}:${name} must preserve core identity.`);
    }
  }
  for (const entry of [
    '@pibbl/core/machines/internal',
    '@pibbl/core/machines/src/runtime.ts',
    '@pibbl/core/sprites/internal',
    '@pibbl/core/sprites/formats/private',
    'pibbl/machines/internal',
    'pibbl/sprites/internal',
  ]) {
    assert.throws(() => installed.resolve(entry), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
  }

  writeFileSync(join(temp, 'consumer.tsx'), `
    /** @jsxImportSource @pibbl/core */
    import { drive, signal, type PibblNode } from '@pibbl/core';
    import { assign, createMachine, defineMachine, fromCallback, type MachineEvent } from '@pibbl/core/machines';
    import { playAnimation } from '@pibbl/core/machines/animation';
    import { Sprite, defineSpriteAnimation, type SpriteFrame } from '@pibbl/core/sprites';
    import { aseprite } from '@pibbl/core/sprites/formats/aseprite';
    import { texturePacker } from '@pibbl/core/sprites/formats/texture-packer';
    import { createMachine as createPibblMachine, defineMachine as definePibblMachine } from 'pibbl/machines';
    import { playAnimation as playPibblAnimation } from 'pibbl/machines/animation';
    import { Sprite as PibblSprite, defineSpriteAnimation as definePibblSpriteAnimation, type SpriteFrame as PibblSpriteFrame } from 'pibbl/sprites';
    import { aseprite as pibblAseprite } from 'pibbl/sprites/formats/aseprite';
    import { texturePacker as pibblTexturePacker } from 'pibbl/sprites/formats/texture-packer';
    type Event = MachineEvent & { readonly type: 'GO' };
    const machine = defineMachine<{ readonly count: number }, Event>({
      initial: 'idle', context: { count: 0 }, states: {
        idle: { on: { GO: { actions: assign(({ context }) => ({ count: context.count + 1 })) } }, invoke: { task: fromCallback(() => {}) } },
      },
    });
    const actor = createMachine(machine, { input: undefined }); actor.start(); actor.send({ type: 'GO' }); actor.stop();
    declare const frame: SpriteFrame;
    declare const pibblFrame: PibblSpriteFrame;
    const selected = signal(frame);
    const clip = defineSpriteAnimation({ frames: [frame], fps: 12 });
    const task = playAnimation(() => drive(selected, clip));
    const formats = [aseprite(), texturePacker(), task, pibblAseprite(), pibblTexturePacker(), playPibblAnimation, createPibblMachine, definePibblMachine, definePibblSpriteAnimation];
    void formats; void PibblSprite; void pibblFrame;
    export function App(): PibblNode { return <Sprite frame={selected} />; }
  `);
  const consumer = join(temp, 'consumer');
  mkdirSync(consumer);
  writeFileSync(join(consumer, 'entry.js'), "import { createMachine, defineMachine } from '@pibbl/core/machines'; const actor = createMachine(defineMachine({ initial: 'idle', context: {}, states: { idle: {} } }), { input: undefined }); actor.start(); actor.stop();");
  await verifyTreeShaking(consumer);
  for (const mode of ['Bundler', 'NodeNext']) {
    writeFileSync(join(temp, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        target: 'ESNext', lib: ['ESNext', 'DOM'], strict: true, noEmit: true,
        skipLibCheck: false, types: [], jsx: 'react-jsx', jsxImportSource: '@pibbl/core',
        module: mode === 'Bundler' ? 'ESNext' : 'NodeNext', moduleResolution: mode,
      },
      files: ['consumer.tsx'],
    }));
    run(process.execPath, [tsc, '-p', join(temp, 'tsconfig.json')]);
  }
  process.stdout.write('Packed machines and sprites: scoped/unscoped exports, package boundaries, Bundler, NodeNext, and packed standalone tree shaking passed.\n');
} catch (error) {
  if (error.stdout) process.stderr.write(error.stdout);
  if (error.stderr) process.stderr.write(error.stderr);
  throw error;
} finally {
  rmSync(temp, { recursive: true, force: true });
}
