import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "..");
const temp = mkdtempSync(join(tmpdir(), "crc-packed-pivot-"));
const tarballs = join(temp, "tarballs");
mkdirSync(tarballs);
const require = createRequire(import.meta.url);
const tsc = join(dirname(require.resolve("typescript")), "tsc.js");
const threeTypes = realpathSync(
  join(root, "packages/three/node_modules/@types/three"),
);

function run(command, args, cwd = root) {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}
function pnpm(args, cwd = root) {
  return run("corepack", ["pnpm@11.21.0", ...args], cwd);
}
function pack(directory, name, validateBuilt = true) {
  const file = join(tarballs, `${name}.tgz`);
  pnpm(["pack", "--out", file], join(root, directory));
  const entries = run("tar", ["-tzf", file]).trim().split("\n");
  if (validateBuilt) {
    assert.ok(
      entries.some((entry) => entry.startsWith("package/dist/")),
      `${name} has no built files`,
    );
    assert.ok(
      entries.every(
        (entry) =>
          !entry.includes("/src/") &&
          !(/\.(?:ts|tsx)$/u.test(entry) && !/\.d\.(?:ts|tsx)$/u.test(entry)),
      ),
      `${name} packed source`,
    );
  }
  return { file, entries };
}
function requireFiles(packageName, entries, names) {
  for (const name of names)
    assert.ok(
      entries.includes(`package/dist/${name}`),
      `${packageName} omitted ${name}`,
    );
}
function install(name, dependencies, extra = {}) {
  const directory = join(temp, name);
  mkdirSync(directory);
  writeFileSync(
    join(directory, "package.json"),
    JSON.stringify({
      name: `crc-${name}`,
      private: true,
      type: "module",
      dependencies,
      ...(Object.keys(extra).length ? { devDependencies: extra } : {}),
    }),
  );
  writeFileSync(join(directory, "pnpm-workspace.yaml"), `packages:\n  - .\n`);
  pnpm(
    ["install", "--offline", "--ignore-scripts", "--strict-peer-dependencies"],
    directory,
  );
  return directory;
}
function assertBlocked(requireFromConsumer, specifier) {
  assert.throws(
    () => requireFromConsumer.resolve(specifier),
    (error) =>
      error?.code === "ERR_PACKAGE_PATH_NOT_EXPORTED" ||
      error?.code === "MODULE_NOT_FOUND",
    `${specifier} unexpectedly resolved`,
  );
}
async function bundle(source, directory) {
  const result = await build({
    absWorkingDir: directory,
    bundle: true,
    format: "esm",
    platform: "browser",
    minify: true,
    jsx: "automatic",
    jsxImportSource: "@crc/core",
    metafile: true,
    stdin: { contents: source, loader: "tsx", resolveDir: directory },
    write: false,
  });
  return {
    code: result.outputFiles.map((file) => file.text).join("\n"),
    inputs: Object.keys(result.metafile.inputs).map((path) =>
      path.replaceAll("\\", "/"),
    ),
  };
}

try {
  const core = pack("packages/core", "core");
  const adapter = pack("packages/three", "adapter");
  const three = pack("packages/three/node_modules/three", "three", false);
  requireFiles("core", core.entries, [
    "index.d.ts",
    "index.mjs",
    "internal.d.ts",
    "jsx-runtime.d.ts",
    "jsx-dev-runtime.d.ts",
  ]);
  requireFiles("core", core.entries, [
    "features/particles/index.d.ts", "features/particles/index.mjs",
    "features/physics/2d.d.ts", "features/physics/2d.mjs",
    "features/physics/2d-geometry.d.ts", "features/physics/2d-testing.mjs",
    "features/physics/3d-geometry.mjs", "features/textures/index.mjs",
    "features/viz/index.mjs", "features/physics/lib/2d/world/rapier-engine.js",
  ]);
  assert.ok(core.entries.includes("package/THIRD_PARTY_NOTICES.txt"));
  requireFiles("adapter", adapter.entries, [
    "index.d.ts",
    "index.mjs",
    "index.mjs.map",
  ]);
  const geometryDir = install("geometry", { "@crc/core": `file:${core.file}` });
  assert.ok(!existsSync(join(geometryDir, "node_modules/@dimforge/rapier2d-compat")));
  const geometryRequire = createRequire(join(geometryDir, "runtime.mjs"));
  for (const specifier of ["@crc/core/physics", "@crc/core/physics/3d"])
    assertBlocked(geometryRequire, specifier);
  assert.ok(!existsSync(join(geometryDir, "node_modules/three")));
  const geometrySource = `
    import { circleShape2D, raycastShape2D } from '@crc/core/physics/2d/geometry';
    import { sphereShape3D, raycastShape3D } from '@crc/core/physics/3d/geometry';
    const a = raycastShape2D(circleShape2D({ radius: 1 }), { position: [0, 0], rotationDegrees: 0 }, { origin: [-2, 0], direction: [1, 0], maxDistance: 4 });
    const b = raycastShape3D(sphereShape3D({ radius: 1 }), { position: [0, 0, 0], orientation: [0, 0, 0, 1] }, { origin: [-2, 0, 0], direction: [1, 0, 0], maxDistance: 4 });
    if (a?.distance !== 1 || b?.distance !== 1) throw new Error('Pure geometry result changed');
  `;
  writeFileSync(join(geometryDir, "runtime.mjs"), geometrySource);
  run(process.execPath, ["runtime.mjs"], geometryDir);
  const geometryBundle = await bundle(geometrySource, geometryDir);
  assert.ok(
    geometryBundle.inputs.every(
      (input) =>
        !input.includes("/node_modules/three/") &&
        !/\/lib\/(?:2d|3d)\/(?:runtime|world|webgl)\//u.test(input),
    ),
  );
  assert.ok(
    !/requestAnimationFrame|OffscreenCanvas|document|navigator/u.test(
      geometryBundle.code,
    ),
  );

  const particleDir = install("particles-only", {
    "@crc/core": `file:${core.file}`,
  });
  assert.ok(!existsSync(join(particleDir, "node_modules/three")));
  const particleBundle = await bundle(
    `import { defineParticleEffect2D, particleRange } from '@crc/core/particles'; console.log(defineParticleEffect2D({ emitters: [{ name: 'spark', capacity: 1, emission: [{ type: 'rate', particlesPerSecond: 1 }], shape: { type: 'point' }, initial: { lifetimeMilliseconds: particleRange(100, 200) }, renderer: { type: 'circle' } }] }).dimension);`,
    particleDir,
  );
  assert.ok(
    particleBundle.inputs.every(
      (input) => !input.includes("/node_modules/three/"),
    ),
  );
  assert.ok(!particleBundle.code.includes("gl_InstanceID"));

  const consumer = install(
    "consumer",
    {
      "@crc/core": `file:${core.file}`,
      "@crc/three": `file:${adapter.file}`,
      three: `file:${three.file}`,
    },
    { "@types/three": `link:${threeTypes}` },
  );
  const fromConsumer = createRequire(join(consumer, "runtime.mjs"));
  const installedCore = realpathSync(fromConsumer.resolve("@crc/core"));
  const installedThree = realpathSync(fromConsumer.resolve("three"));
  for (const specifier of [
    "@crc/core/particles",
    "@crc/core/physics/2d",
    "@crc/core/physics/2d/testing",
    "@crc/three",
    "@crc/core/viz",
  ]) {
    const entry = fromConsumer.resolve(specifier);
    assert.equal(
      realpathSync(createRequire(entry).resolve("@crc/core")),
      installedCore,
      `${specifier} loaded a second core`,
    );
  }
  assert.equal(
    realpathSync(
      createRequire(fromConsumer.resolve("@crc/three")).resolve("three"),
    ),
    installedThree,
  );
  for (const specifier of [
    "@crc/core/physics/3d",
    "@crc/core/particles/webgl",
    "@crc/webgl",
    "@crc/webgl/gltf",
    "@crc/webgl/internal",
  ])
    assertBlocked(fromConsumer, specifier);
  for (const specifier of [
    "@crc/core/lib/crc",
    "@crc/three/src/index",
    "@crc/core/physics/src/3d-geometry",
  ])
    assertBlocked(fromConsumer, specifier);

  for (const file of [
    "index.ts",
    "jsx.tsx",
    "responsive-styles.tsx",
    "runtime.mjs",
    "wrong-runtime.ts",
    "tsconfig.bundler.json",
    "tsconfig.nodenext.json",
  ]) {
    cpSync(
      join(root, "playground/package-consumer", file),
      join(consumer, file),
    );
  }
  cpSync(
    join(root, "playground/package-consumer/mixed-runtime"),
    join(consumer, "mixed-runtime"),
    { recursive: true },
  );
  for (const mode of ["bundler", "nodenext"])
    run(
      process.execPath,
      [tsc, "-p", join(consumer, `tsconfig.${mode}.json`)],
      consumer,
    );
  run(process.execPath, ["runtime.mjs"], consumer);
  const shared = await bundle(
    `
    import { crc, Rectangle, createElement } from '@crc/core';
    import { defineThreeLayer } from '@crc/three';
    import { Scene, PerspectiveCamera } from 'three';
    import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
    import { Particles2D } from '@crc/core/particles';
    import { PhysicsWorld2D } from '@crc/core/physics/2d';
    import { createPhysicsTestHarness2D } from '@crc/core/physics/2d/testing';
    console.log(crc, createElement(Rectangle, { style: { width: 1, height: 1 } }), defineThreeLayer, new Scene(), new PerspectiveCamera(), OrbitControls, Particles2D, PhysicsWorld2D, createPhysicsTestHarness2D);
  `,
    consumer,
  );
  assert.ok(
    shared.inputs.every((input) => !/\/packages\/[^/]+\/src\//u.test(input)),
    "packed consumer reached workspace source",
  );
  assert.equal(
    shared.code.split("@crc/core.element").length - 1,
    1,
    "packed consumer duplicated the core brand",
  );
  const threeRoots = new Set(
    shared.inputs
      .filter((input) => input.includes("/node_modules/three/"))
      .map((input) =>
        input.slice(
          0,
          input.indexOf("/node_modules/three/") + "/node_modules/three".length,
        ),
      ),
  );
  assert.equal(
    threeRoots.size,
    1,
    "packed consumer bundled more than one Three.js identity",
  );
  process.stdout.write(
    "Packed surviving packages passed tarball boundaries, isolated particles/geometry, Bundler and NodeNext declarations, runtime exports, one core, and one Three.js identity.\n",
  );
} catch (error) {
  if (error?.stdout) process.stderr.write(error.stdout);
  if (error?.stderr) process.stderr.write(error.stderr);
  throw error;
} finally {
  rmSync(temp, { recursive: true, force: true });
}
