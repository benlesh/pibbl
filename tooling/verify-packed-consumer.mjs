import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const focusImplementationMarker = 'CRC_FOCUS_MANAGEMENT_V1';
const physicsGeometryOnly = process.argv.includes('--physics-geometry-only');

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceThreeTypesDirectory = realpathSync(
  join(repositoryRoot, 'packages/three/node_modules/@types/three'),
);
const temporaryRoot = mkdtempSync(join(tmpdir(), 'crc-packed-consumer-'));
const packageDirectory = join(temporaryRoot, 'packages');
const consumerDirectory = join(temporaryRoot, 'consumer');
const rootOnlyConsumerDirectory = join(temporaryRoot, 'root-only-consumer');
const geometryConsumerDirectory = join(temporaryRoot, 'physics-geometry-consumer');

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

async function bundleConsumerEntry(source, directory = consumerDirectory) {
  const result = await build({
    absWorkingDir: directory,
    bundle: true,
    format: 'esm',
    minify: true,
    platform: 'browser',
    stdin: {
      contents: source,
      loader: 'tsx',
      resolveDir: directory,
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

function assertGeometryOnlyPhysicsBundle(metafile, code) {
  const normalizedInputs = Object.keys(metafile.inputs).map(input =>
    input.replaceAll('\\', '/'),
  );
  const forbiddenInputs = normalizedInputs.filter(input =>
    input.includes('/node_modules/@crc/core/') ||
    input.includes('/node_modules/@crc/webgl/') ||
    /physics(?:-|\/)world/iu.test(input),
  );
  if (forbiddenInputs.length > 0) {
    throw new Error(
      `Packed physics geometry bundle crossed a runtime boundary: ${forbiddenInputs.join(', ')}`,
    );
  }
  for (const marker of [
    'requestAnimationFrame',
    'Canvas',
    'OffscreenCanvas',
    'scheduler',
    'document',
    'navigator',
    'window',
  ]) {
    if (code.includes(marker)) {
      throw new Error(
        `Packed physics geometry bundle retained forbidden runtime marker ${marker}.`,
      );
    }
  }
}

const packedPackageMarkers = new Map([
  ['@crc/core', '/node_modules/@crc/core/'],
  ['@crc/particles', '/node_modules/@crc/particles/'],
  ['@crc/physics', '/node_modules/@crc/physics/'],
  ['@crc/three', '/node_modules/@crc/three/'],
  ['@crc/webgl', '/node_modules/@crc/webgl/'],
  ['three', '/node_modules/three/'],
]);

function assertSinglePackedRuntime(metafile, packageNames) {
  const normalizedInputs = Object.keys(metafile.inputs).map(input =>
    input.replaceAll('\\', '/'),
  );
  const leakedSources = normalizedInputs.filter(input =>
    /\/packages\/[^/]+\/src\//u.test(input),
  );
  if (leakedSources.length > 0) {
    throw new Error(
      `Packed consumer resolved workspace sources: ${leakedSources.join(', ')}`,
    );
  }
  for (const packageName of packageNames) {
    const marker = packedPackageMarkers.get(packageName);
    if (marker === undefined) {
      throw new Error(`Unknown packed package ${packageName}.`);
    }
    const packageRoots = new Set(
      normalizedInputs
        .filter(input => input.includes(marker))
        .map(input => input.slice(0, input.indexOf(marker) + marker.length - 1)),
    );
    if (packageRoots.size !== 1) {
      throw new Error(
        `Packed bundle must resolve exactly one ${packageName} package; ` +
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
  mkdirSync(geometryConsumerDirectory, { recursive: true });

  const physicsTarball = pack('packages/physics');
  const physicsEntries = assertTarballHasNoSources(physicsTarball);
  assertRequiredEntries(physicsEntries, [
    'package/dist/2d-geometry.d.ts',
    'package/dist/2d-geometry.mjs',
    'package/dist/2d-geometry.mjs.map',
    'package/dist/2d.d.ts',
    'package/dist/2d.mjs',
    'package/dist/2d.mjs.map',
    'package/dist/3d-geometry.d.ts',
    'package/dist/3d-geometry.mjs',
    'package/dist/3d-geometry.mjs.map',
    'package/dist/3d.d.ts',
    'package/dist/3d.mjs',
    'package/dist/3d.mjs.map',
  ]);

  let typesTarball;
  let coreTarball;
  let webglTarball;
  let particlesTarball;
  let threeTarball;
  let threeImplementationTarball;

  if (!physicsGeometryOnly) {
    mkdirSync(consumerDirectory, { recursive: true });
    mkdirSync(rootOnlyConsumerDirectory, { recursive: true });

    typesTarball = pack('packages/types');
    coreTarball = pack('packages/core');
    webglTarball = pack('packages/webgl');
    particlesTarball = pack('packages/particles');
    threeTarball = pack('packages/three');
    threeImplementationTarball = pack('packages/three/node_modules/three');
    assertTarballHasNoSources(typesTarball);
    const coreEntries = assertTarballHasNoSources(coreTarball);
    const webglEntries = assertTarballHasNoSources(webglTarball);
    const particleEntries = assertTarballHasNoSources(particlesTarball);
    const threeEntries = assertTarballHasNoSources(threeTarball);
    assertRequiredEntries(coreEntries, [
      'package/dist/index.d.ts',
      'package/dist/index.mjs',
      'package/dist/internal.d.ts',
      'package/dist/internal.mjs',
      'package/dist/internal.mjs.map',
      'package/dist/jsx-dev-runtime.d.ts',
      'package/dist/jsx-dev-runtime.mjs',
      'package/dist/jsx-dev-runtime.mjs.map',
      'package/dist/jsx-runtime.d.ts',
      'package/dist/jsx-runtime.mjs',
      'package/dist/jsx-runtime.mjs.map',
      'package/dist/types.d.ts',
    ]);
    assertRequiredEntries(webglEntries, [
      'package/dist/gltf.d.ts',
      'package/dist/gltf.mjs',
      'package/dist/gltf.mjs.map',
      'package/dist/index.d.ts',
      'package/dist/index.mjs',
      'package/dist/index.mjs.map',
      'package/dist/internal.d.ts',
      'package/dist/internal.mjs',
      'package/dist/internal.mjs.map',
    ]);
    assertRequiredEntries(particleEntries, [
      'package/dist/index.d.ts',
      'package/dist/index.mjs',
      'package/dist/index.mjs.map',
      'package/dist/webgl.d.ts',
      'package/dist/webgl.mjs',
      'package/dist/webgl.mjs.map',
    ]);
    assertRequiredEntries(threeEntries, [
      'package/dist/index.d.ts',
      'package/dist/index.mjs',
      'package/dist/index.mjs.map',
    ]);

    writeFileSync(join(rootOnlyConsumerDirectory, 'package.json'), `${JSON.stringify({
      name: 'crc-packed-particles-root-consumer',
      private: true,
      type: 'module',
      dependencies: {
        '@crc/core': `file:${coreTarball}`,
        '@crc/particles': `file:${particlesTarball}`,
        '@crc/types': `file:${typesTarball}`,
      },
    }, null, 2)}\n`);
    writeFileSync(
      join(rootOnlyConsumerDirectory, 'pnpm-workspace.yaml'),
      `packages:\n  - .\noverrides:\n  '@crc/types': file:${typesTarball}\n`,
    );
    pnpm(['install', '--offline', '--ignore-scripts', '--strict-peer-dependencies'], {
      cwd: rootOnlyConsumerDirectory,
    });
    const requireFromRootOnly = createRequire(
      join(rootOnlyConsumerDirectory, 'runtime.mjs'),
    );
    requireFromRootOnly.resolve('@crc/core');
    requireFromRootOnly.resolve('@crc/particles');
    try {
      requireFromRootOnly.resolve('@crc/webgl');
      throw new Error('The particles root-only consumer unexpectedly installed @crc/webgl.');
    } catch (error) {
      if (error?.code !== 'MODULE_NOT_FOUND') throw error;
    }
    const rootOnlyParticleBundle = await bundleConsumerEntry(`
      import { defineParticleEffect2D, particleRange } from '@crc/particles';
      const effect = defineParticleEffect2D({
        emitters: [{
          name: 'spark',
          capacity: 4,
          emission: [{ type: 'rate', particlesPerSecond: 1 }],
          shape: { type: 'point' },
          initial: { lifetimeMilliseconds: particleRange(100, 200) },
          renderer: { type: 'circle' },
        }],
      });
      console.log(effect.dimension);
    `, rootOnlyConsumerDirectory);
    const rootOnlyInputs = Object.keys(rootOnlyParticleBundle.metafile.inputs)
      .map(input => input.replaceAll('\\', '/'));
    if (
      rootOnlyInputs.some(input => input.includes('/node_modules/@crc/webgl/')) ||
      rootOnlyParticleBundle.code.includes('gl_InstanceID') ||
      rootOnlyParticleBundle.code.includes('#version 300 es')
    ) {
      throw new Error(
        'The packed @crc/particles root bundle retained WebGL package or shader code.',
      );
    }
  }

  writeFileSync(join(geometryConsumerDirectory, 'package.json'), `${JSON.stringify({
    name: 'crc-packed-physics-geometry-consumer',
    private: true,
    type: 'module',
    dependencies: {
      '@crc/physics': `file:${physicsTarball}`,
    },
  }, null, 2)}\n`);
  writeFileSync(
    join(geometryConsumerDirectory, 'pnpm-workspace.yaml'),
    'packages:\n  - .\n',
  );
  const geometrySource = `
    import {
      boxShape2D,
      circleShape2D,
      distanceBetweenShapes2D,
      raycastShape2D,
    } from '@crc/physics/2d/geometry';
    import {
      boxShape3D,
      distanceBetweenShapes3D,
      raycastShape3D,
      sphereShape3D,
    } from '@crc/physics/3d/geometry';
    const identity = { position: [0, 0], rotationDegrees: 0 };
    const distance = distanceBetweenShapes2D(
      circleShape2D({ radius: 1 }),
      identity,
      boxShape2D({ width: 2, height: 2 }),
      { position: [4, 0], rotationDegrees: 0 },
    );
    const hit = raycastShape2D(
      circleShape2D({ radius: 1 }),
      { position: [5, 0], rotationDegrees: 0 },
      { origin: [0, 0], direction: [2, 0], maxDistance: 10 },
    );
    const identity3D = { position: [0, 0, 0], orientation: [0, 0, 0, 1] };
    const distance3D = distanceBetweenShapes3D(
      sphereShape3D({ radius: 1 }),
      identity3D,
      boxShape3D({ width: 2, height: 2, depth: 2 }),
      { position: [4, 0, 0], orientation: [0, 0, 0, 1] },
    );
    const hit3D = raycastShape3D(
      boxShape3D({ width: 2, height: 2, depth: 2 }),
      { position: [5, 0, 0], orientation: [0, 0, 0, 1] },
      { origin: [0, 0, 0], direction: [2, 0, 0], maxDistance: 10 },
    );
    if (
      Math.abs(distance.separation - 2) > 1e-9 ||
      Math.abs((hit?.distance ?? Number.NaN) - 4) > 1e-9 ||
      Math.abs((hit?.timeOfImpact ?? Number.NaN) - 0.4) > 1e-9 ||
      Math.abs(distance3D.separation - 2) > 1e-9 ||
      Math.abs((hit3D?.distance ?? Number.NaN) - 4) > 1e-9 ||
      Math.abs((hit3D?.timeOfImpact ?? Number.NaN) - 0.4) > 1e-9
    ) {
      throw new Error('Packed physics geometry produced an unexpected result.');
    }
  `;
  writeFileSync(
    join(geometryConsumerDirectory, 'runtime.mjs'),
    geometrySource,
  );
  pnpm(['install', '--offline', '--ignore-scripts', '--strict-peer-dependencies'], {
    cwd: geometryConsumerDirectory,
  });
  const requireFromGeometryConsumer = createRequire(
    join(geometryConsumerDirectory, 'runtime.mjs'),
  );
  try {
    requireFromGeometryConsumer.resolve('@crc/physics');
    throw new Error('Packed @crc/physics unexpectedly exposed a root entry.');
  } catch (error) {
    if (error?.code !== 'ERR_PACKAGE_PATH_NOT_EXPORTED') throw error;
  }
  const installedPhysicsGeometryEntry = realpathSync(
    requireFromGeometryConsumer.resolve('@crc/physics/2d/geometry'),
  );
  if (!installedPhysicsGeometryEntry.startsWith(realpathSync(join(geometryConsumerDirectory, 'node_modules')))) {
    throw new Error(
      `@crc/physics/2d/geometry resolved outside the packed consumer: ${installedPhysicsGeometryEntry}`,
    );
  }
  const installedPhysicsGeometry3DEntry = realpathSync(
    requireFromGeometryConsumer.resolve('@crc/physics/3d/geometry'),
  );
  if (!installedPhysicsGeometry3DEntry.startsWith(realpathSync(join(geometryConsumerDirectory, 'node_modules')))) {
    throw new Error(
      `@crc/physics/3d/geometry resolved outside the packed consumer: ${installedPhysicsGeometry3DEntry}`,
    );
  }
  if (existsSync(join(geometryConsumerDirectory, 'node_modules/@crc/core'))) {
    throw new Error('Packed physics geometry consumer unexpectedly installed @crc/core.');
  }
  if (existsSync(join(geometryConsumerDirectory, 'node_modules/@crc/webgl'))) {
    throw new Error('Packed physics geometry consumer unexpectedly installed @crc/webgl.');
  }
  run(process.execPath, ['runtime.mjs'], { cwd: geometryConsumerDirectory });
  const geometryBundle = await bundleConsumerEntry(
    geometrySource,
    geometryConsumerDirectory,
  );
  assertGeometryOnlyPhysicsBundle(geometryBundle.metafile, geometryBundle.code);
  const sphereOnlyBundle = await bundleConsumerEntry(
    `import { sphereShape3D } from '@crc/physics/3d/geometry'; console.log(sphereShape3D({ radius: 1 }));`,
    geometryConsumerDirectory,
  );
  assertGeometryOnlyPhysicsBundle(sphereOnlyBundle.metafile, sphereOnlyBundle.code);
  const sphereOnlyInputs = Object.keys(sphereOnlyBundle.metafile.inputs).join('\n');
  if (/\/lib\/2d\//u.test(sphereOnlyInputs) || /\/lib\/3d\/(?:runtime|webgl|world)\//u.test(sphereOnlyInputs)) {
    throw new Error('sphereShape3D geometry-only bundle retained another dimension or runtime layer.');
  }

  if (!physicsGeometryOnly) {
    writeFileSync(join(consumerDirectory, 'package.json'), `${JSON.stringify({
    name: 'crc-packed-consumer',
    private: true,
    type: 'module',
    dependencies: {
      '@crc/core': `file:${coreTarball}`,
      '@crc/physics': `file:${physicsTarball}`,
      '@crc/types': `file:${typesTarball}`,
      '@crc/webgl': `file:${webglTarball}`,
      '@crc/particles': `file:${particlesTarball}`,
      '@crc/three': `file:${threeTarball}`,
      three: `file:${threeImplementationTarball}`,
    },
    devDependencies: {
      '@types/three': `link:${workspaceThreeTypesDirectory}`,
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
  for (const packageName of [
    '@crc/core',
    '@crc/core/internal',
    '@crc/types',
    '@crc/physics/3d',
    '@crc/physics/3d/geometry',
    '@crc/particles',
    '@crc/particles/webgl',
    '@crc/three',
    '@crc/webgl',
    '@crc/webgl/gltf',
    '@crc/webgl/internal',
    'three',
  ]) {
    const packageEntry = realpathSync(requireFromConsumer.resolve(packageName));
    if (!packageEntry.startsWith(realpathSync(join(consumerDirectory, 'node_modules')))) {
      throw new Error(`${packageName} resolved outside the packed consumer: ${packageEntry}`);
    }
    const installedRoot = findPackageRoot(packageEntry);
    installedPackageRoots.set(packageName, installedRoot);
    if (packageName.startsWith('@crc/')) {
      try {
        realpathSync(join(installedRoot, 'src'));
        throw new Error(`${packageName} unexpectedly installed a src directory.`);
      } catch (error) {
        if (error?.code !== 'ENOENT') {
          throw error;
        }
      }
    }
  }

  const installedCoreEntry = realpathSync(requireFromConsumer.resolve('@crc/core'));
  const installedPhysicsRoot = installedPackageRoots.get('@crc/physics/3d');
  if (installedPackageRoots.get('@crc/physics/3d/geometry') !== installedPhysicsRoot) {
    throw new Error('@crc/physics/3d entries did not resolve inside one installed package.');
  }
  const physicsManifest = JSON.parse(
    readFileSync(join(installedPhysicsRoot, 'package.json'), 'utf8'),
  );
  if (
    physicsManifest.sideEffects !== false ||
    Object.keys(physicsManifest.exports ?? {}).join(',') !== './2d,./2d/geometry,./3d,./3d/geometry' ||
    JSON.stringify(physicsManifest.peerDependencies) !==
      JSON.stringify({ '@crc/core': '0.0.1', '@crc/webgl': '0.0.1' }) ||
    physicsManifest.peerDependenciesMeta?.['@crc/core']?.optional !== true ||
    physicsManifest.peerDependenciesMeta?.['@crc/webgl']?.optional !== true
  ) {
    throw new Error('@crc/physics packed manifest does not preserve exact subpaths, optional peers, and side-effect metadata.');
  }
  const installedPhysicsEntry = realpathSync(requireFromConsumer.resolve('@crc/physics/3d'));
  const installedPhysicsBundle = readFileSync(installedPhysicsEntry, 'utf8');
  for (const marker of ['@crc/core.element', 'CRC backend names must be nonempty.']) {
    if (installedPhysicsBundle.includes(marker)) {
      throw new Error(`Packed @crc/physics embedded renderer implementation marker ${marker}.`);
    }
  }
  const installedWebGLRoot = installedPackageRoots.get('@crc/webgl');
  if (installedPackageRoots.get('@crc/webgl/internal') !== installedWebGLRoot) {
    throw new Error(
      '@crc/webgl/internal did not resolve inside the installed @crc/webgl package.',
    );
  }
  const installedWebGLEntry = realpathSync(requireFromConsumer.resolve('@crc/webgl'));
  const installedWebGLGLTFEntry = realpathSync(
    requireFromConsumer.resolve('@crc/webgl/gltf'),
  );
  const installedParticlesRoot = installedPackageRoots.get('@crc/particles');
  const installedParticlesEntry = realpathSync(
    requireFromConsumer.resolve('@crc/particles'),
  );
  const installedParticlesWebGLEntry = realpathSync(
    requireFromConsumer.resolve('@crc/particles/webgl'),
  );
  const installedThreeRoot = installedPackageRoots.get('@crc/three');
  const installedThreeEntry = realpathSync(requireFromConsumer.resolve('@crc/three'));
  const installedThreeImplementationEntry = realpathSync(
    requireFromConsumer.resolve('three'),
  );
  const requireFromWebGL = createRequire(installedWebGLEntry);
  const webglCoreEntry = realpathSync(requireFromWebGL.resolve('@crc/core'));
  const requireFromWebGLGLTF = createRequire(installedWebGLGLTFEntry);
  if (
    webglCoreEntry !== installedCoreEntry ||
    realpathSync(requireFromWebGLGLTF.resolve('@crc/core')) !== installedCoreEntry
  ) {
    throw new Error(
      `@crc/webgl resolved a second core identity: ${webglCoreEntry}.`,
    );
  }
  const requireFromParticles = createRequire(installedParticlesEntry);
  const requireFromParticlesWebGL = createRequire(installedParticlesWebGLEntry);
  if (
    realpathSync(requireFromParticles.resolve('@crc/core')) !== installedCoreEntry ||
    realpathSync(requireFromParticlesWebGL.resolve('@crc/core')) !== installedCoreEntry ||
    realpathSync(requireFromParticlesWebGL.resolve('@crc/webgl')) !==
      installedWebGLEntry
  ) {
    throw new Error(
      '@crc/particles did not resolve the packed consumer core/WebGL identities.',
    );
  }
  const requireFromThree = createRequire(installedThreeEntry);
  if (
    realpathSync(requireFromThree.resolve('@crc/core')) !== installedCoreEntry ||
    realpathSync(requireFromThree.resolve('three')) !== installedThreeImplementationEntry
  ) {
    throw new Error(
      '@crc/three did not resolve the packed consumer core/Three identities.',
    );
  }
  const threeManifest = JSON.parse(
    readFileSync(join(installedThreeRoot, 'package.json'), 'utf8'),
  );
  const expectedThreePeers = JSON.stringify({
    "@crc/core": "0.0.1",
    three: "^0.186.0",
  });
  if (JSON.stringify(threeManifest.peerDependencies) !== expectedThreePeers) {
    throw new Error("@crc/three must keep exact tested core and Three peers.");
  }
  if (Object.keys(threeManifest.dependencies ?? {}).length !== 0) {
    throw new Error('@crc/three must externalize core and Three implementations.');
  }
  const installedThreeBundle = readFileSync(installedThreeEntry, 'utf8');
  if (
    !installedThreeBundle.includes('from "@crc/core"') ||
    !installedThreeBundle.includes('from "three"')
  ) {
    throw new Error('@crc/three must retain external core and Three imports.');
  }
  for (const marker of [
    focusImplementationMarker,
    '@crc/core.element',
    'CRC backend names must be nonempty.',
    'requestAnimationFrame',
  ]) {
    if (installedThreeBundle.includes(marker)) {
      throw new Error(
        `Packed @crc/three embedded core implementation marker ${marker}.`,
      );
    }
  }
  if (
    installedThreeBundle.includes('THREE.WebGLProgram: Can not resolve #include') ||
    installedThreeBundle.includes('WebGLRenderer: Shader Error')
  ) {
    throw new Error('Packed @crc/three embedded Three renderer source.');
  }
  const threeSourceMap = JSON.parse(
    readFileSync(`${installedThreeEntry}.map`, 'utf8'),
  );
  const leakedThreeImplementationSources = threeSourceMap.sources.filter(source =>
    /(?:packages\/core|node_modules\/(?:@crc\/core|three)|three\/(?:build|src))/u.test(source),
  );
  if (leakedThreeImplementationSources.length > 0) {
    throw new Error(
      `Packed @crc/three source map embedded external implementations: ${leakedThreeImplementationSources.join(', ')}`,
    );
  }
  const particlesManifest = JSON.parse(
    readFileSync(join(installedParticlesRoot, 'package.json'), 'utf8'),
  );
  if (
    JSON.stringify(particlesManifest.peerDependencies) !==
      JSON.stringify({ '@crc/core': '0.0.1', '@crc/webgl': '0.0.1' }) ||
    particlesManifest.peerDependenciesMeta?.['@crc/webgl']?.optional !== true ||
    Object.keys(particlesManifest.dependencies ?? {}).length !== 0
  ) {
    throw new Error(
      '@crc/particles must keep core and optional WebGL as exact peer dependencies.',
    );
  }
  const installedParticlesRootBundle = readFileSync(installedParticlesEntry, 'utf8');
  if (
    installedParticlesRootBundle.includes('gl_InstanceID') ||
    installedParticlesRootBundle.includes('#version 300 es')
  ) {
    throw new Error('Packed @crc/particles root embedded WebGL shader implementation.');
  }
  const particleRootSourceMap = JSON.parse(
    readFileSync(`${installedParticlesEntry}.map`, 'utf8'),
  );
  const leakedWebGLSources = particleRootSourceMap.sources.filter(source =>
    /(?:packages\/webgl|node_modules\/@crc\/webgl|lib\/webgl)/u.test(source),
  );
  if (leakedWebGLSources.length > 0) {
    throw new Error(
      `Packed @crc/particles root source map embedded WebGL sources: ${leakedWebGLSources.join(', ')}`,
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
  if (
    installedWebGLBundle.includes('useGLTF') ||
    installedWebGLBundle.includes('GLB header byte 0 has invalid magic')
  ) {
    throw new Error('Packed @crc/webgl root embedded the optional GLB loader or decoder.');
  }
  const installedWebGLGLTFBundle = readFileSync(installedWebGLGLTFEntry, 'utf8');
  if (
    !installedWebGLGLTFBundle.includes('useGLTF') ||
    !installedWebGLGLTFBundle.includes('GLB header byte 0 has invalid magic')
  ) {
    throw new Error('Packed @crc/webgl/gltf omitted its loader or GLB decoder.');
  }
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
    import { Fragment, Group, Rectangle, crc, createElement } from '@crc/core';
    import {
      Particles2D,
      defineParticleEffect2D,
      particleCurve,
      particleRange,
    } from '@crc/particles';
    import { Particles3D, defineParticleEffect3D } from '@crc/particles/webgl';
    import { defineThreeLayer } from '@crc/three';
    import {
      PerspectiveCamera as ThreePerspectiveCamera,
      Scene as ThreeScene,
    } from 'three';
    import {
      AmbientLight,
      Cube,
      DirectionalLight,
      Group3D,
      HemisphereLight,
      Mesh,
      PointLight,
      Sphere,
      SpotLight,
      WebGLBackground,
      WebGLLayer,
      useAnimationFrame,
      useOrbitCamera,
      createWebGLGeometry,
    } from '@crc/webgl';
    import { PhysicsWorld3D, dynamicBody3D } from '@crc/physics/3d';
    const geometry = createWebGLGeometry({
      positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
      normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
    });
    const qualities = [false, 'low', 'medium', 'high'];
    const opacity = particleCurve([[0, 1], [1, 0]]);
    const effect2D = defineParticleEffect2D({
      emitters: [{
        name: 'spark',
        capacity: 8,
        emission: [{ type: 'rate', particlesPerSecond: 2 }],
        shape: { type: 'point' },
        initial: { lifetimeMilliseconds: particleRange(100, 200), size: 2 },
        appearance: { opacity },
        renderer: { type: 'circle' },
      }],
    });
    const effect3D = defineParticleEffect3D({
      emitters: [{
        name: 'ember',
        capacity: 8,
        emission: [{ type: 'rate', particlesPerSecond: 2 }],
        shape: { type: 'point' },
        initial: { lifetimeMilliseconds: particleRange(100, 200), size: 2 },
        appearance: { opacity },
        renderer: { type: 'point', material: 'emissive', blend: 'additive' },
      }],
    });
    const ThreeLayer = defineThreeLayer({
      create() {
        return {
          scene: new ThreeScene(),
          camera: new ThreePerspectiveCamera(),
        };
      },
    });
    function Scene() {
      const orbit = useOrbitCamera({
        orbitPoint: [0, 0, 0],
        initialPosition: [0, 2, 5],
      });
      const camera = {
        type: 'perspective',
        position: orbit.position,
        lookAt: orbit.lookAt,
        up: [0, 1, 0],
        fieldOfViewDegrees: 45,
        near: 0.1,
        far: 100,
      };
      const timestamp = useAnimationFrame();
      return (
        <Group {...orbit.handlers}>
          <Rectangle style={{ width: 1, height: 1, fill: 'transparent' }} />
          <Particles2D effect={effect2D} autoplay seed={42} pointerEvents="none" />
          <ThreeLayer
            missBehavior="block"
            style={{ width: 1, height: 1, filter: { type: 'blur', radius: 1 } }}
          />
          <PhysicsWorld3D gravity={[0, -9.81, 0]}>
          {qualities.map(shadows => (
            <WebGLLayer camera={camera} style={{ width: 1, height: 1, shadows }}>
              <WebGLBackground style={{ color: '#08111f' }} />
              <AmbientLight style={{ color: '#ffffff', intensity: 0.1 }} />
              <HemisphereLight
                style={{ skyColor: '#b9dcff', groundColor: '#302418', intensity: 0.3 }}
              />
              <DirectionalLight style={{ castShadow: false }} />
              <PointLight style={{ range: 12, castShadow: true }} />
              <SpotLight
                style={{
                  range: 20,
                  innerConeAngleDegrees: 15,
                  outerConeAngleDegrees: 28,
                  castShadow: true,
                }}
              />
              <Group3D style={{ rotationYDegrees: timestamp / 10 }}>
                <Cube
                  physics={dynamicBody3D({ mass: 1 })}
                  style={{
                    size: geometry.vertexCount,
                    material: {
                      type: 'lambert',
                      emissiveColor: '#102040',
                      emissiveIntensity: 0.25,
                    },
                    castShadow: true,
                    receiveShadow: false,
                  }}
                />
                <Sphere style={{ lit: false, castShadow: false, receiveShadow: true }} />
                <Mesh geometry={geometry} />
              </Group3D>
              <Particles3D
                effect={effect3D}
                autoplay
                seed={42}
                pointerEvents="none"
              />
            </WebGLLayer>
          ))}
          </PhysicsWorld3D>
        </Group>
      );
    }
    const scene = <Scene />;
    console.log(Fragment, crc, createElement, defineThreeLayer, useAnimationFrame, scene);
  `);
  assertSinglePackedRuntime(sharedRuntimeBundle.metafile, [
    '@crc/core',
    '@crc/particles',
    '@crc/physics',
    '@crc/three',
    '@crc/webgl',
    'three',
  ]);
  if (
    sharedRuntimeBundle.code.includes('useGLTF') ||
    sharedRuntimeBundle.code.includes('GLB header byte 0 has invalid magic')
  ) {
    throw new Error('An ordinary packed WebGL consumer bundled the optional GLB loader.');
  }
  assertIdentityMarkerOnce(
    sharedRuntimeBundle.code,
    '@crc/core.element',
    'element brand',
  );

  const dynamicBodyBundle = await bundleConsumerEntry(`
    import { dynamicBody3D } from '@crc/physics/3d';
    console.log(dynamicBody3D({ mass: 1 }));
  `);
  const dynamicInputs = Object.keys(dynamicBodyBundle.metafile.inputs).join('\n');
  for (const forbidden of ['/lib/2d/', 'joint', 'debug', 'replay']) {
    if (dynamicInputs.includes(forbidden)) {
      throw new Error(`dynamicBody3D bundle retained forbidden surface ${forbidden}.`);
    }
  }

  const physicsSceneBundle = await bundleConsumerEntry(`
    import { createElement } from '@crc/core';
    import { Cube, WebGLLayer } from '@crc/webgl';
    import { PhysicsWorld3D, dynamicBody3D } from '@crc/physics/3d';
    console.log(createElement(WebGLLayer, { style: { width: 1, height: 1 } },
      createElement(PhysicsWorld3D, { gravity: [0, -9.81, 0] },
        createElement(Cube, { physics: dynamicBody3D({ mass: 1 }), style: { lit: false } }))));
  `);
  assertSinglePackedRuntime(physicsSceneBundle.metafile, [
    '@crc/core',
    '@crc/physics',
    '@crc/webgl',
  ]);
  for (const forbidden of ['WebAssembly', '.wasm', 'new Worker', 'setInterval(', 'setTimeout(']) {
    if (physicsSceneBundle.code.includes(forbidden)) {
      throw new Error(`Packed physics scene retained forbidden engine/loop marker ${forbidden}.`);
    }
  }
  assertIdentityMarkerOnce(
    physicsSceneBundle.code,
    'requestAnimationFrame',
    'shared scheduler implementation in the physics scene',
  );
  assertIdentityMarkerOnce(
    sharedRuntimeBundle.code,
    'CRC backend names must be nonempty.',
    'backend token registry',
  );
  process.stdout.write(
    `Packed @crc/core, @crc/three, @crc/webgl, @crc/particles, @crc/physics, and three consumer passed Bundler, NodeNext, declarations, ` +
    `runtime exports, blocked deep imports, no-src checks, one shared core identity, and ` +
    `optimized focus elimination (marker absent without focus; present with focus; ` +
    `${noFocusBytes} no-focus bytes vs ${withFocusBytes} with-focus bytes).\n`,
  );
  }
  process.stdout.write(
    'Packed @crc/physics 2D and 3D geometry entries installed and executed without core, WebGL, world, Canvas, browser, or scheduler code.\n',
  );
} finally {
  rmSync(temporaryRoot, { force: true, recursive: true });
}
