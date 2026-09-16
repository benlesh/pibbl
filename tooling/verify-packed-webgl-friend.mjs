import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temporaryRoot = mkdtempSync(join(tmpdir(), 'crc-packed-webgl-friend-'));
const packageDirectory = join(temporaryRoot, 'packages');
const consumerDirectory = join(temporaryRoot, 'consumer');

try {
  mkdirSync(packageDirectory, { recursive: true });
  mkdirSync(consumerDirectory, { recursive: true });
  const typesTarball = pack('packages/types');
  const coreTarball = pack('packages/core');
  const webglTarball = pack('packages/webgl');
  const webglEntries = tarballEntries(webglTarball);
  for (const required of [
    'package/dist/index.mjs',
    'package/dist/internal.mjs',
    'package/dist/internal.d.ts',
  ]) {
    if (!webglEntries.includes(required)) {
      throw new Error(`Packed @crc/webgl omitted ${required}.`);
    }
  }
  if (!webglEntries.some(entry =>
    /^package\/dist\/chunk-[A-Z0-9]+\.mjs$/u.test(entry)
  )) {
    throw new Error(
      'Packed @crc/webgl omitted the shared root/internal ESM chunk.',
    );
  }

  writeFileSync(join(consumerDirectory, 'package.json'), `${JSON.stringify({
    name: 'crc-packed-webgl-friend-consumer',
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
  pnpm(['install', '--offline', '--ignore-scripts', '--strict-peer-dependencies'], {
    cwd: consumerDirectory,
  });

  const requireFromConsumer = createRequire(join(consumerDirectory, 'runtime.mjs'));
  const publicEntryPath = realpathSync(
    requireFromConsumer.resolve('@crc/webgl'),
  );
  const internalEntryPath = realpathSync(
    requireFromConsumer.resolve('@crc/webgl/internal'),
  );
  const installedRoot = realpathSync(join(consumerDirectory, 'node_modules'));
  for (const entryPath of [publicEntryPath, internalEntryPath]) {
    if (!entryPath.startsWith(installedRoot)) {
      throw new Error(`Packed WebGL entry resolved outside node_modules: ${entryPath}`);
    }
  }

  const publicCode = readFileSync(publicEntryPath, 'utf8');
  const internalCode = readFileSync(internalEntryPath, 'utf8');
  const publicChunks = relativeChunkImports(publicCode);
  const internalChunks = relativeChunkImports(internalCode);
  const sharedChunks = [...publicChunks].filter(chunk => internalChunks.has(chunk));
  if (sharedChunks.length !== 1) {
    throw new Error(
      `Packed WebGL entries must import exactly one shared runtime chunk; ` +
      `received ${sharedChunks.join(', ') || 'none'}.`,
    );
  }
  const sharedCode = readFileSync(
    join(dirname(publicEntryPath), sharedChunks[0]),
    'utf8',
  );
  for (const marker of [
    'geometryData',
    'WEBGL_BACKEND_TOKEN',
    'var Group3D',
    'var Mesh',
    'var Cube',
    'var Sphere',
  ]) {
    if (!sharedCode.includes(marker)) {
      throw new Error(
        `Packed WebGL shared runtime omitted identity marker ${marker}.`,
      );
    }
  }

  const publicEntry = await import(pathToFileURL(publicEntryPath).href);
  const internalEntry = await import(pathToFileURL(internalEntryPath).href);
  const geometry = publicEntry.createWebGLGeometry({
    positions: [-1, -1, 0, 1, -1, 0, 0, 1, 0],
  });
  const snapshot = internalEntry.getWebGLGeometrySnapshot(geometry);
  if (
    snapshot.positions.length !== 9 ||
    snapshot.bounds.minimumX !== -1 ||
    snapshot.bounds.maximumY !== 1
  ) {
    throw new Error('Packed WebGL cross-entry geometry snapshot was invalid.');
  }

  process.stdout.write(
    'Packed @crc/webgl root/internal entries share geometry, backend-token, and built-in primitive identities.\n',
  );
} finally {
  rmSync(temporaryRoot, { force: true, recursive: true });
}

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
    throw new Error(
      `Expected one tarball from ${packagePath}, received ${created.join(', ')}.`,
    );
  }
  return join(packageDirectory, created[0]);
}

function readFileNames(directory) {
  return existsSync(directory) ? readdirSync(directory) : [];
}

function tarballEntries(tarball) {
  return execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' })
    .trim()
    .split('\n');
}

function relativeChunkImports(code) {
  return new Set(
    [...code.matchAll(/from\s+["'](\.\/chunk-[A-Z0-9]+\.mjs)["']/gu)]
      .map(match => match[1]),
  );
}
