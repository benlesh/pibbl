import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, mkdirSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

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
  const sourceEntries = entries.filter(entry => entry.includes('/src/'));
  if (sourceEntries.length > 0) {
    throw new Error(`Packed source files are not allowed: ${sourceEntries.join(', ')}`);
  }
  if (!entries.some(entry => entry.startsWith('package/dist/'))) {
    throw new Error(`Packed package ${tarball} does not contain dist output.`);
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

try {
  mkdirSync(packageDirectory, { recursive: true });
  mkdirSync(consumerDirectory, { recursive: true });

  const typesTarball = pack('packages/types');
  const coreTarball = pack('packages/core');
  assertTarballHasNoSources(typesTarball);
  assertTarballHasNoSources(coreTarball);

  writeFileSync(join(consumerDirectory, 'package.json'), `${JSON.stringify({
    name: 'crc-packed-consumer',
    private: true,
    type: 'module',
    dependencies: {
      '@crc/core': `file:${coreTarball}`,
      '@crc/types': `file:${typesTarball}`,
    },
  }, null, 2)}\n`);
  writeFileSync(
    join(consumerDirectory, 'pnpm-workspace.yaml'),
    `packages:\n  - .\noverrides:\n  '@crc/types': file:${typesTarball}\n`,
  );
  for (const file of ['index.ts', 'runtime.mjs', 'tsconfig.bundler.json', 'tsconfig.nodenext.json']) {
    cpSync(join(repositoryRoot, 'playground/package-consumer', file), join(consumerDirectory, file));
  }

  pnpm(['install', '--offline', '--ignore-scripts', '--strict-peer-dependencies'], {
    cwd: consumerDirectory,
  });

  const requireFromConsumer = createRequire(join(consumerDirectory, 'runtime.mjs'));
  for (const packageName of ['@crc/core', '@crc/types']) {
    const packageEntry = realpathSync(requireFromConsumer.resolve(packageName));
    if (!packageEntry.startsWith(realpathSync(join(consumerDirectory, 'node_modules')))) {
      throw new Error(`${packageName} resolved outside the packed consumer: ${packageEntry}`);
    }
    const installedRoot = findPackageRoot(packageEntry);
    try {
      realpathSync(join(installedRoot, 'src'));
      throw new Error(`${packageName} unexpectedly installed a src directory.`);
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');
  run(process.execPath, [tsc, '-p', 'tsconfig.bundler.json'], { cwd: consumerDirectory });
  run(process.execPath, [tsc, '-p', 'tsconfig.nodenext.json'], { cwd: consumerDirectory });
  run(process.execPath, ['runtime.mjs'], { cwd: consumerDirectory });

  process.stdout.write(
    'Packed @crc/core consumer passed Bundler, NodeNext, runtime, and no-src checks.\n',
  );
} finally {
  rmSync(temporaryRoot, { force: true, recursive: true });
}
