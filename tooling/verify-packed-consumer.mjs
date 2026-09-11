import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const focusImplementationMarker = 'CRC_FOCUS_MANAGEMENT_V1';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temporaryRoot = mkdtempSync(join(tmpdir(), 'crc-packed-consumer-'));
const packageDirectory = join(temporaryRoot, 'packages');
const consumerDirectory = join(temporaryRoot, 'consumer');

function run(command, args, options = {}) {
  execFileSync(command, args, {
    cwd: repositoryRoot,
    env: process.env,
    stdio: 'inherit',
    ...options,
  });
}

function pnpm(args, options = {}) {
  run('corepack', ['pnpm@11.21.0', ...args], options);
}

function pack(packagePath) {
  const before = new Set(readFileNames(packageDirectory));
  pnpm(['--dir', packagePath, 'pack', '--pack-destination', packageDirectory]);
  const created = readFileNames(packageDirectory).filter(file => !before.has(file));
  if (created.length !== 1 || !created[0].endsWith('.tgz')) {
    throw new Error(`Expected one tarball from ${packagePath}, received: ${created.join(', ')}`);
  }
  return join(packageDirectory, created[0]);
}

function readFileNames(directory) {
  try {
    return readdirSync(directory);
  } catch {
    return [];
  }
}

function assertTarballHasNoSources(tarball) {
  const entries = execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' })
    .trim()
    .split('\n');
  const sourceEntries = entries.filter(entry =>
    entry.includes('/src/') ||
    (/\.(?:[cm]?ts|tsx)$/.test(entry) && !/\.d\.(?:[cm]?ts|tsx)$/.test(entry))
  );
  if (sourceEntries.length > 0) {
    throw new Error(`Packed source files are not allowed: ${sourceEntries.join(', ')}`);
  }
  if (!entries.some(entry => entry.startsWith('package/dist/'))) {
    throw new Error(`Packed package ${tarball} does not contain dist output.`);
  }
  return entries;
}

function assertRequiredEntries(entries, requiredEntries) {
  const installedEntries = new Set(entries);
  const missing = requiredEntries.filter(entry => !installedEntries.has(entry));
  if (missing.length > 0) {
    throw new Error(`Packed package omitted required files: ${missing.join(', ')}`);
  }
}

function findPackageRoot(packageEntry) {
  let current = dirname(packageEntry);
  while (current !== dirname(current)) {
    if (existsSync(join(current, 'package.json'))) {
      return current;
    }
    current = dirname(current);
  }
  throw new Error(`Could not find the package root for ${packageEntry}.`);
}

async function bundleConsumerEntry(source) {
  const result = await build({
    absWorkingDir: consumerDirectory,
    bundle: true,
    format: 'esm',
    minify: true,
    platform: 'browser',
    stdin: {
      contents: source,
      loader: 'tsx',
      resolveDir: consumerDirectory,
    },
    jsx: 'automatic',
    jsxImportSource: '@crc/core',
    metafile: true,
    treeShaking: true,
    write: false,
  });
  return {
    code: result.outputFiles.map(file => file.text).join('\n'),
    metafile: result.metafile,
  };
}

function assertSinglePackedRuntime(metafile) {
  const normalizedInputs = Object.keys(metafile.inputs).map(input =>
    input.replaceAll('\\', '/'),
  );
  const leakedSources = normalizedInputs.filter(input =>
    /\/packages\/(?:core|webgl)\/src\//u.test(input),
  );
  if (leakedSources.length > 0) {
    throw new Error(
      `Packed consumer resolved workspace sources: ${leakedSources.join(', ')}`,
    );
  }
  for (const packageName of ['core', 'webgl']) {
    const marker = `/node_modules/@crc/${packageName}/`;
    const packageRoots = new Set(
      normalizedInputs
        .filter(input => input.includes(marker))
        .map(input => input.slice(0, input.indexOf(marker) + marker.length - 1)),
    );
    if (packageRoots.size !== 1) {
      throw new Error(
        `Packed bundle must resolve exactly one @crc/${packageName} package; ` +
        `received ${[...packageRoots].join(', ') || 'none'}.`,
      );
    }
  }
}

function assertIdentityMarkerOnce(code, marker, label) {
  const count = code.split(marker).length - 1;
  if (count !== 1) {
    throw new Error(
      `Packed core identity must contain one ${label}; received ${count}.`,
    );
  }
}

try {
  mkdirSync(packageDirectory, { recursive: true });
  mkdirSync(consumerDirectory, { recursive: true });

  const typesTarball = pack('packages/types');
  const coreTarball = pack('packages/core');
  const webglTarball = pack('packages/webgl');
  assertTarballHasNoSources(typesTarball);
  const coreEntries = assertTarballHasNoSources(coreTarball);
  const webglEntries = assertTarballHasNoSources(webglTarball);
  assertRequiredEntries(coreEntries, [
    'package/dist/index.d.ts',
    'package/dist/index.mjs',
    'package/dist/jsx-dev-runtime.d.ts',
    'package/dist/jsx-dev-runtime.mjs',
    'package/dist/jsx-dev-runtime.mjs.map',
    'package/dist/jsx-runtime.d.ts',
    'package/dist/jsx-runtime.mjs',
    'package/dist/jsx-runtime.mjs.map',
    'package/dist/types.d.ts',
  ]);
  assertRequiredEntries(webglEntries, [
    'package/dist/index.d.ts',
    'package/dist/index.mjs',
    'package/dist/index.mjs.map',
  ]);

  writeFileSync(join(consumerDirectory, 'package.json'), `${JSON.stringify({
    name: 'crc-packed-consumer',
    private: true,
    type: 'module',
    dependencies: {
      '@crc/core': `file:${coreTarball}`,
      '@crc/types': `file:${typesTarball}`,
      '@crc/webgl': `file:${webglTarball}`,
    },
  }, null, 2)}\n`);
  writeFileSync(
    join(consumerDirectory, 'pnpm-workspace.yaml'),
    `packages:\n  - .\noverrides:\n  '@crc/types': file:${typesTarball}\n`,
  );
  for (const file of [
    'index.ts',
    'jsx.tsx',
    'runtime.mjs',
    'tsconfig.bundler.json',
    'tsconfig.nodenext.json',
    'wrong-runtime.ts',
  ]) {
    cpSync(join(repositoryRoot, 'playground/package-consumer', file), join(consumerDirectory, file));
  }
  cpSync(
    join(repositoryRoot, 'playground/package-consumer/mixed-runtime'),
    join(consumerDirectory, 'mixed-runtime'),
    { recursive: true },
  );

  pnpm(['install', '--offline', '--ignore-scripts', '--strict-peer-dependencies'], {
    cwd: consumerDirectory,
  });

  const requireFromConsumer = createRequire(join(consumerDirectory, 'runtime.mjs'));
  const installedPackageRoots = new Map();
  for (const packageName of ['@crc/core', '@crc/types', '@crc/webgl']) {
    const packageEntry = realpathSync(requireFromConsumer.resolve(packageName));
    if (!packageEntry.startsWith(realpathSync(join(consumerDirectory, 'node_modules')))) {
      throw new Error(`${packageName} resolved outside the packed consumer: ${packageEntry}`);
    }
    const installedRoot = findPackageRoot(packageEntry);
    installedPackageRoots.set(packageName, installedRoot);
    try {
      realpathSync(join(installedRoot, 'src'));
      throw new Error(`${packageName} unexpectedly installed a src directory.`);
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  const installedCoreEntry = realpathSync(requireFromConsumer.resolve('@crc/core'));
  const installedWebGLRoot = installedPackageRoots.get('@crc/webgl');
  const installedWebGLEntry = realpathSync(requireFromConsumer.resolve('@crc/webgl'));
  const requireFromWebGL = createRequire(installedWebGLEntry);
  const webglCoreEntry = realpathSync(requireFromWebGL.resolve('@crc/core'));
  if (webglCoreEntry !== installedCoreEntry) {
    throw new Error(
      `@crc/webgl resolved a second core identity: ${webglCoreEntry}.`,
    );
  }
  const webglManifest = JSON.parse(
    readFileSync(join(installedWebGLRoot, 'package.json'), 'utf8'),
  );
  if (
    JSON.stringify(webglManifest.peerDependencies) !==
      JSON.stringify({ '@crc/core': '0.0.1' }) ||
    Object.keys(webglManifest.dependencies ?? {}).length !== 0
  ) {
    throw new Error(
      '@crc/webgl must declare exactly @crc/core 0.0.1 as a peer dependency.',
    );
  }
  const installedWebGLBundle = readFileSync(installedWebGLEntry, 'utf8');
  for (const marker of [
    focusImplementationMarker,
    '@crc/core.element',
    'CRC backend names must be nonempty.',
    'requestAnimationFrame',
  ]) {
    if (installedWebGLBundle.includes(marker)) {
      throw new Error(
        `Packed @crc/webgl embedded core implementation marker ${marker}.`,
      );
    }
  }
  const webglSourceMap = JSON.parse(
    readFileSync(`${installedWebGLEntry}.map`, 'utf8'),
  );
  const leakedCoreSources = webglSourceMap.sources.filter(source =>
    /(?:packages\/core|node_modules\/@crc\/core)/u.test(source),
  );
  if (leakedCoreSources.length > 0) {
    throw new Error(
      `Packed @crc/webgl source map embedded core sources: ${leakedCoreSources.join(', ')}`,
    );
  }

  const tsc = join(dirname(createRequire(import.meta.url).resolve('typescript')), 'tsc.js');
  run(process.execPath, [tsc, '-p', 'tsconfig.bundler.json'], { cwd: consumerDirectory });
  run(process.execPath, [tsc, '-p', 'tsconfig.nodenext.json'], { cwd: consumerDirectory });
  run(process.execPath, ['runtime.mjs'], { cwd: consumerDirectory });

  const { code: noFocusBundle } = await bundleConsumerEntry(`
    import { Rectangle } from '@crc/core';
    function Scene() {
      return <Rectangle style={{ width: 1, height: 1 }} />;
    }
    console.log(<Scene />);
  `);
  if (noFocusBundle.includes(focusImplementationMarker)) {
    throw new Error('Optimized no-focus bundle retained focus implementation code.');
  }

  const { code: withFocusBundle } = await bundleConsumerEntry(`
    import { FocusManagement, Rectangle } from '@crc/core';
    function Scene() {
      return (
        <FocusManagement>
          <Rectangle style={{ width: 1, height: 1 }} />
        </FocusManagement>
      );
    }
    console.log(<Scene />);
  `);
  if (!withFocusBundle.includes(focusImplementationMarker)) {
    throw new Error('Optimized with-focus bundle omitted the focus implementation marker.');
  }
  const noFocusBytes = Buffer.byteLength(noFocusBundle);
  const withFocusBytes = Buffer.byteLength(withFocusBundle);
  if (noFocusBytes >= withFocusBytes) {
    throw new Error(
      `Optimized no-focus bundle (${noFocusBytes} bytes) was not smaller than the with-focus bundle (${withFocusBytes} bytes).`,
    );
  }


  const sharedRuntimeBundle = await bundleConsumerEntry(`
    import { Fragment, crc, createElement } from '@crc/core';
    import {
      Cube,
      WebGLLayer,
      crcAnimationFrame,
      createWebGLGeometry,
    } from '@crc/webgl';
    const geometry = createWebGLGeometry({
      positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
    });
    const scene = (
      <WebGLLayer style={{ width: 1, height: 1 }}>
        <Cube style={{ size: geometry.vertexCount }} />
      </WebGLLayer>
    );
    console.log(Fragment, crc, createElement, crcAnimationFrame, scene);
  `);
  assertSinglePackedRuntime(sharedRuntimeBundle.metafile);
  assertIdentityMarkerOnce(
    sharedRuntimeBundle.code,
    '@crc/core.element',
    'element brand',
  );
  assertIdentityMarkerOnce(
    sharedRuntimeBundle.code,
    'CRC backend names must be nonempty.',
    'backend token registry',
  );
  assertIdentityMarkerOnce(
    sharedRuntimeBundle.code,
    'requestAnimationFrame',
    'scheduler implementation',
  );

  process.stdout.write(
    `Packed @crc/core and @crc/webgl consumer passed Bundler, NodeNext, declarations, ` +
    `runtime exports, blocked deep imports, no-src checks, one shared core identity, and ` +
    `optimized focus elimination (marker absent without focus; present with focus; ` +
    `${noFocusBytes} no-focus bytes vs ${withFocusBytes} with-focus bytes).\n`,
  );
} finally {
  rmSync(temporaryRoot, { force: true, recursive: true });
}
