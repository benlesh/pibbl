import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const consumer = await realpath(await mkdtemp(join(tmpdir(), 'pibbl-packed-standalone-layout-')));
const execute = promisify(execFile);

try {
  const run = (command, args, cwd = consumer) =>
    execute(command, args, {
      cwd,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
  const cache = join(consumer, 'cache');
  const pack = async directory => {
    const { stdout } = await run('npm', [
      'pack',
      '--json',
      '--ignore-scripts',
      '--cache',
      cache,
      '--pack-destination',
      consumer,
    ], join(root, 'packages', directory));
    const [packed] = JSON.parse(stdout);
    return join(consumer, packed.filename);
  };
  const [core, layout] = await Promise.all([pack('core'), pack('layout')]);
  await writeFile(
    join(consumer, 'package.json'),
    JSON.stringify({ private: true, type: 'module' }),
  );
  await run('npm', [
    'install',
    '--offline',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    '--cache',
    cache,
    core,
    layout,
  ]);

  const installed = join(consumer, 'node_modules/@pibbl/layout');
  assert.equal(await realpath(installed), installed);
  const manifest = JSON.parse(await readFile(join(installed, 'package.json'), 'utf8'));
  assert.deepEqual(manifest.exports['.'], {
    types: './dist/index.d.ts',
    default: './dist/index.mjs',
  });

  await writeFile(
    join(consumer, 'entry.ts'),
    `import { createLayoutTree, prepareLayout, type LayoutBox } from '@pibbl/layout';
const ready: Promise<void> = prepareLayout();
const tree = createLayoutTree();
const root = tree.createNode({ style: { width: 100, height: 20, flexDirection: 'row', gap: 10 } });
const child = tree.createNode({ style: { width: 40, height: 20 } });
tree.appendChild(root, child);
const snapshot = tree.calculateLayout({ root, width: 100, height: 20 });
const box: LayoutBox = snapshot.getBox(child);
tree.dispose();
void ready;
void box;
`,
  );
  for (const resolution of ['Bundler', 'NodeNext']) {
    await writeFile(
      join(consumer, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          strict: true,
          noEmit: true,
          target: 'ESNext',
          lib: ['ESNext'],
          module: resolution === 'Bundler' ? 'ESNext' : 'NodeNext',
          moduleResolution: resolution,
          types: [],
          skipLibCheck: false,
        },
        files: ['entry.ts'],
      }),
    );
    await run(process.execPath, [
      join(root, 'node_modules/typescript/bin/tsc'),
      '-p',
      join(consumer, 'tsconfig.json'),
    ]);
  }
  await writeFile(
    join(consumer, 'run.mjs'),
    `import assert from 'node:assert/strict';
import { createLayoutTree, prepareLayout } from '@pibbl/layout';
await prepareLayout();
const tree = createLayoutTree();
const root = tree.createNode({ style: { width: 100, height: 20, flexDirection: 'row', gap: 10 } });
const measured = tree.createNode({ style: { flexGrow: 1, minWidth: 20, height: 20 }, measure: ({ width }) => ({ width: width.maximum / 2, height: 20 }) });
const fixed = tree.createNode({ style: { width: 30, height: 20 } });
tree.appendChild(root, measured);
tree.appendChild(root, fixed);
const snapshot = tree.calculateLayout({ root, width: 100, height: 20 });
assert.deepEqual(snapshot.getBox(measured), { x: 0, y: 0, width: 60, height: 20 });
assert.deepEqual(snapshot.getBox(fixed), { x: 70, y: 0, width: 30, height: 20 });
tree.dispose();
assert.throws(() => tree.calculateLayout({ root, width: 100, height: 20 }), /disposed/);
`,
  );
  await run(process.execPath, [join(consumer, 'run.mjs')]);

  const bundle = await build({
    absWorkingDir: consumer,
    entryPoints: ['entry.ts'],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    metafile: true,
    logLevel: 'silent',
  });
  const inputs = Object.keys(bundle.metafile.inputs).map(path =>
    resolve(consumer, path),
  );
  assert.ok(inputs.some(path => path.startsWith(`${installed}/dist/`)));
  assert.ok(
    inputs.every(path => path.startsWith(`${consumer}/`)),
    'The standalone package bundle must not fall back to repository source.',
  );
  assert.ok(
    inputs.every(path => !path.includes('/lib/render.js')),
    'The standalone package must not import the Canvas renderer.',
  );
  process.stdout.write(
    'Packed standalone layout package: offline tarballs, Bundler/NodeNext, native calculate/measure/dispose, and no Canvas renderer import pass\n',
  );
} finally {
  await rm(consumer, { recursive: true, force: true });
}
