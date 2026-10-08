import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { parse } from "@babel/parser";
import { pibblRuntimeSource } from "./pibbl-runtime-source.ts";
import {
  collectPublicExports,
  pibblPublicCompilerOptions,
} from "./studio-docs/api-exports.ts";

const repositoryRoot = resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
const tsc = join(dirname(require.resolve("typescript")), "tsc.js");
const expectedModules = new Map([
  ["@pibbl/core/filters", "node_modules/@pibbl/core/filters.d.ts"],
  ["@pibbl/core/textures", "node_modules/@pibbl/core/textures/index.d.ts"],
  ["@pibbl/core", "node_modules/@pibbl/core/index.d.ts"],
  ["@pibbl/core/jsx-runtime", "node_modules/@pibbl/core/jsx-runtime.d.ts"],
  [
    "@pibbl/core/jsx-dev-runtime",
    "node_modules/@pibbl/core/jsx-dev-runtime.d.ts",
  ],
  [
    "@pibbl/core/physics/2d/geometry",
    "node_modules/@pibbl/core/physics/2d/geometry.d.ts",
  ],
  ["@pibbl/core/physics/2d", "node_modules/@pibbl/core/physics/2d.d.ts"],
  ["@pibbl/core/particles", "node_modules/@pibbl/core/particles/index.d.ts"],
  ["@pibbl/core/machines", "node_modules/@pibbl/core/machines/index.d.ts"],
  [
    "@pibbl/core/machines/animation",
    "node_modules/@pibbl/core/machines/animation.d.ts",
  ],
  ["@pibbl/core/sprites", "node_modules/@pibbl/core/sprites/index.d.ts"],
  [
    "@pibbl/core/sprites/formats/aseprite",
    "node_modules/@pibbl/core/sprites/formats/aseprite.d.ts",
  ],
  [
    "@pibbl/core/sprites/formats/texture-packer",
    "node_modules/@pibbl/core/sprites/formats/texture-packer.d.ts",
  ],
  ["@pibbl/three", "node_modules/@pibbl/three/index.d.ts"],
  ["@pibbl/core/viz", "node_modules/@pibbl/core/viz/index.d.ts"],
  [
    "@pibbl/core/viz/inspection",
    "node_modules/@pibbl/core/viz/inspection.d.ts",
  ],
  ["@pibbl/text", "node_modules/@pibbl/text/index.d.ts"],
]);
const bundle = await readFile(
  join(repositoryRoot, "playground/src/pibbl-editor-types.txt"),
  "utf8",
);
const markers = [
  ...bundle.matchAll(/^\/\* @pibbl-studio-module (.+) \*\/$/gmu),
];
assert.deepEqual(
  markers.map((match) => match[1]).sort(),
  [...expectedModules.keys()].sort(),
);
const sourceEntries = {
  filters: join(repositoryRoot, "packages/core/src/filters.ts"),
  textures: join(
    repositoryRoot,
    "packages/core/src/features/textures/index.ts",
  ),
  root: join(repositoryRoot, "packages/core/src/index.ts"),
  jsxRuntime: join(repositoryRoot, "packages/core/src/jsx-runtime.ts"),
  jsxDevRuntime: join(repositoryRoot, "packages/core/src/jsx-dev-runtime.ts"),
  physics2dGeometry: join(
    repositoryRoot,
    "packages/core/src/features/physics/2d-geometry.ts",
  ),
  physics2d: join(repositoryRoot, "packages/core/src/features/physics/2d.ts"),
  particles: join(
    repositoryRoot,
    "packages/core/src/features/particles/index.ts",
  ),
  machines: join(
    repositoryRoot,
    "packages/core/src/features/machines/index.ts",
  ),
  machineAnimation: join(
    repositoryRoot,
    "packages/core/src/features/machines/animation.ts",
  ),
  sprites: join(repositoryRoot, "packages/core/src/features/sprites/index.ts"),
  spriteAseprite: join(
    repositoryRoot,
    "packages/core/src/features/sprites/formats/aseprite.ts",
  ),
  spriteTexturePacker: join(
    repositoryRoot,
    "packages/core/src/features/sprites/formats/texture-packer.ts",
  ),
  three: join(repositoryRoot, "packages/three/src/index.ts"),
  viz: join(repositoryRoot, "packages/core/src/features/viz/index.ts"),
  inspection: join(
    repositoryRoot,
    "packages/core/src/features/viz/inspection.ts",
  ),
  text: join(repositoryRoot, "packages/text/src/index.ts"),
};
const builtEntries = Object.fromEntries(
  Object.entries(sourceEntries).map(([name, path]) => [
    name,
    path.replace("/src/", "/dist/").replace(/\.ts$/u, ".d.ts"),
  ]),
);
const sourceInventory = await collectPublicExports(
  sourceEntries,
  pibblPublicCompilerOptions,
);
const builtInventory = await collectPublicExports(
  builtEntries,
  pibblPublicCompilerOptions,
);
const inventoryKey = new Map([
  ["@pibbl/core/filters", "filters"],
  ["@pibbl/core/textures", "textures"],
  ["@pibbl/core", "root"],
  ["@pibbl/core/jsx-runtime", "jsxRuntime"],
  ["@pibbl/core/jsx-dev-runtime", "jsxDevRuntime"],
  ["@pibbl/core/physics/2d/geometry", "physics2dGeometry"],
  ["@pibbl/core/physics/2d", "physics2d"],
  ["@pibbl/core/particles", "particles"],
  ["@pibbl/core/machines", "machines"],
  ["@pibbl/core/machines/animation", "machineAnimation"],
  ["@pibbl/core/sprites", "sprites"],
  ["@pibbl/core/sprites/formats/aseprite", "spriteAseprite"],
  ["@pibbl/core/sprites/formats/texture-packer", "spriteTexturePacker"],
  ["@pibbl/three", "three"],
  ["@pibbl/core/viz", "viz"],
  ["@pibbl/core/viz/inspection", "inspection"],
  ["@pibbl/text", "text"],
]);

function explicitNames(content) {
  const ast = parse(content, {
    sourceType: "module",
    plugins: [["typescript", { dts: true }]],
  });
  const names = new Set();
  for (const statement of ast.program.body) {
    if (statement.type !== "ExportNamedDeclaration") continue;
    if (statement.declaration?.id?.name)
      names.add(statement.declaration.id.name);
    for (const declaration of statement.declaration?.declarations ?? []) {
      if (declaration.id.type === "Identifier") names.add(declaration.id.name);
    }
    for (const specifier of statement.specifiers) {
      if (specifier.exported.type === "Identifier")
        names.add(specifier.exported.name);
    }
  }
  return [...names].sort();
}
function inventoryNames(entry) {
  return [
    ...new Set([...entry.values, ...entry.types, ...entry.overview]),
  ].sort();
}

const temp = await mkdtemp(join(tmpdir(), "pibbl-studio-pivot-"));
try {
  for (const [index, marker] of markers.entries()) {
    const name = marker[1];
    const relative = expectedModules.get(name);
    const file = join(temp, relative);
    await mkdir(dirname(file), { recursive: true });
    const content = bundle
      .slice(
        marker.index + marker[0].length,
        markers[index + 1]?.index ?? bundle.length,
      )
      .trimStart();
    assert.ok(content.length > 0, `Studio declaration for ${name} is empty`);
    const key = inventoryKey.get(name);
    assert.deepEqual(
      inventoryNames(sourceInventory[key]),
      inventoryNames(builtInventory[key]),
      `${name} source and built exports differ`,
    );
    assert.deepEqual(
      explicitNames(content),
      inventoryNames(sourceInventory[key]),
      `${name} Studio exports differ from the public package`,
    );
    await writeFile(file, content);
  }
  const consumer = `
    /** @jsxImportSource @pibbl/core */
    import { pibbl, Rectangle, DragHandle, ManipulationFrame, ResizeHandles, RotationHandle, drive, signal, useManipulation, useSignal, type PibblNode } from '@pibbl/core';
    import { defineThreeLayer, type PibblThreeTarget } from '@pibbl/three';
    import { loadOutlineFont, createTextGeometry } from '@pibbl/text';
    async function textOutline(bytes: Uint8Array) { using font = await loadOutlineFont(bytes); return createTextGeometry(font, 'Hello', {fontSize: 100, missingGlyphs: 'error'}); }
    import { Particles2D } from '@pibbl/core/particles';
    import { assign, createMachine, defineMachine, fromCallback, type MachineEvent } from '@pibbl/core/machines';
    import { playAnimation } from '@pibbl/core/machines/animation';
    import { Sprite, defineSpriteAnimation, type SpriteFrame } from '@pibbl/core/sprites';
    import { aseprite } from '@pibbl/core/sprites/formats/aseprite';
    import { texturePacker } from '@pibbl/core/sprites/formats/texture-packer';
    import { ReactionDiffusion, ProceduralTexture, texturePalettes, type TextureRenderer } from '@pibbl/core/textures';
    const textureRenderer: TextureRenderer = (ctx, texture) => { ctx.drawImage(texture.source, 0, 0, texture.width, texture.height); };
    const textures = <><ReactionDiffusion paused palette={texturePalettes.ember} render={textureRenderer} /><ProceduralTexture kind="paper" /></>;
    void textures;
    type MachineDemoEvent = MachineEvent & { readonly type: 'GO' };
    const machine = defineMachine<{ readonly count: number }, MachineDemoEvent>({
      initial: 'idle', context: { count: 0 }, states: {
        idle: { on: { GO: { actions: assign(({ context }) => ({ count: context.count + 1 })) } }, invoke: { task: fromCallback(() => {}) } },
      },
    });
    const actor = createMachine(machine, { input: undefined });
    actor.start(); actor.send({ type: 'GO' }); actor.stop();
    declare const spriteFrame: SpriteFrame;
    const spriteFrameSignal = signal(spriteFrame);
    const spriteAnimation = defineSpriteAnimation({ frames: [spriteFrame], fps: 12 });
    const animationTask = playAnimation(() => drive(spriteFrameSignal, spriteAnimation));
    const formats = [aseprite(), texturePacker(), animationTask];
    void formats;
    import { PhysicsWorld2D } from '@pibbl/core/physics/2d';
    import { BarSeries, LineSeries, PointSeries, defineSeries } from '@pibbl/core/viz';
    import { useBarInspection, useNumericInspection, usePointInspection } from '@pibbl/core/viz/inspection';
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
      targets(resources): readonly PibblThreeTarget[] { return [{ object: resources.mesh }]; },
      dispose(resources) { resources.mesh.geometry.dispose(); resources.mesh.material.dispose(); },
    });
    const observations = [{ time: 0, value: 4 }, { time: 1, value: 9 }] as const;
    const observationSeries = defineSeries({ data: observations, x: 'time', y: 'value' });
    const riskRows = [{ desk: 'Rates', low: -2, high: 5 }] as const;
    function InspectionComposition(): PibblNode {
      const numeric = useNumericInspection(observationSeries);
      const points = usePointInspection(observationSeries);
      const bars = useBarInspection({ data: riskRows, category: 'desk' });
      return <><LineSeries data={observations} x="time" y="value" xScale="time" yScale="value" inspection={numeric} /><PointSeries data={observations} x="time" y="value" xScale="time" yScale="value" inspection={points} /><BarSeries data={riskRows} category="desk" valueStart="low" valueEnd="high" categoryScale="desk" valueScale="risk" inspection={bars} /></>;
    }
    function App(): PibblNode {
      void Particles2D; void PhysicsWorld2D; void OrbitControls;
      const box = useSignal({ left: 20, top: 30, width: 100, height: 60 });
      const sprite = <Sprite frame={spriteFrameSignal} sampling="nearest" />;
      void sprite;
      const manipulation = useManipulation({ box });
      return <><ManipulationFrame {...manipulation.frameProps}><DragHandle controller={manipulation} formatReadout={({ left, top }) => String(left + top)} style={{ readout: { gap: 5, active: { visible: true, fill: 'blue' } } }}><Rectangle keyboardFocusable style={{ width: 20, height: 20, cursor: 'grab' }} /></DragHandle><ResizeHandles controller={manipulation} /><RotationHandle controller={manipulation} /></ManipulationFrame><InspectionComposition /><Layer angle={1} style={{ width: 20, height: 20 }} /></>;
    }
    declare const canvas: HTMLCanvasElement;
    pibbl(canvas, <App />);
  `;
  await writeFile(join(temp, "consumer.tsx"), consumer);
  await writeFile(
    join(temp, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        jsx: "react-jsx",
        jsxImportSource: "@pibbl/core",
        lib: ["ESNext", "DOM"],
        module: "ESNext",
        moduleResolution: "Bundler",
        noEmit: true,
        skipLibCheck: false,
        strict: true,
        target: "ESNext",
        paths: {
          three: [
            join(
              repositoryRoot,
              "packages/three/node_modules/@types/three/index.d.ts",
            ),
          ],
          "three/addons/controls/OrbitControls.js": [
            join(
              repositoryRoot,
              "packages/three/node_modules/@types/three/examples/jsm/controls/OrbitControls.d.ts",
            ),
          ],
        },
      },
      files: ["consumer.tsx"],
    }),
  );
  const result = spawnSync(process.execPath, [tsc, "-p", temp], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout + result.stderr);
    throw new Error("Studio public declaration consumer failed.");
  }

  async function runtime(mode) {
    const plugin = pibblRuntimeSource(mode);
    const resolved = plugin.resolveId("virtual:pibbl-runtime-source");
    const loaded = await plugin.load(resolved);
    const serialized = /^export default ([\s\S]+);$/u.exec(loaded)?.[1];
    assert.ok(serialized, `Studio ${mode} runtime did not expose a bundle`);
    const context = { EventTarget, TextDecoder, TextEncoder, atob };
    await runInNewContext(
      `(async () => {${JSON.parse(serialized)}\n})()`,
      context,
    );
    assert.ok(context.PIBBL_CORE, `Studio ${mode} runtime did not initialize`);
    return context.PIBBL_CORE;
  }
  const source = await runtime("source");
  const built = await runtime("built");
  assert.deepEqual(Object.keys(source).sort(), Object.keys(built).sort());
  for (const runtime of [source, built]) {
    for (const name of [
      "ReactionDiffusion",
      "ProceduralTexture",
      "loadOutlineFont",
      "createTextGeometry",
      "pibbl",
      "useManipulation",
      "Manipulable",
      "ManipulationFrame",
      "DragHandle",
      "ResizeHandle",
      "ResizeHandles",
      "RotationHandle",
      "degrees",
      "defineRenderLayer",
      "defineThreeLayer",
      "Particles2D",
      "PhysicsWorld2D",
    ]) {
      assert.equal(
        typeof runtime[name],
        "function",
        `${name} must be in the Studio runtime`,
      );
    }
    for (const name of [
      "WebGLLayer",
      "Particles3D",
      "PhysicsWorld3D",
      "sphereShape3D",
      "useOrbitCamera",
    ]) {
      assert.equal(
        name in runtime,
        false,
        `${name} must not be in the Studio runtime`,
      );
    }
    assert.deepEqual(Object.keys(runtime.__pibblStudioModules).sort(), [
      "@pibbl/three",
      "three",
      "three/addons/controls/OrbitControls.js",
    ]);
    assert.equal(
      runtime.__pibblStudioModules["@pibbl/three"].defineThreeLayer,
      runtime.defineThreeLayer,
    );
    assert.equal(typeof runtime.__pibblStudioModules.three.Scene, "function");
    assert.equal(
      typeof runtime.__pibblStudioModules[
        "three/addons/controls/OrbitControls.js"
      ].OrbitControls,
      "function",
    );
  }
  process.stdout.write(
    "Studio source, built, and editor declarations have exact public export-name parity; source/built runtime and Three addons passed.\n",
  );
} finally {
  await rm(temp, { recursive: true, force: true });
}
