import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CONTACT_SLOP_3D,
  FAT_AABB_MARGIN_3D,
  GEOMETRY_EPSILON_3D,
  MAX_CCD_IMPACTS_PER_TICK_3D,
  MAX_EPA_ITERATIONS_3D,
  MAX_GJK_ITERATIONS_3D,
  MAX_POSITION_CORRECTION_3D,
  RESTITUTION_VELOCITY_THRESHOLD_3D,
  SLEEP_ANGULAR_SPEED_DEGREES_3D,
  SLEEP_DURATION_SECONDS_3D,
  SLEEP_LINEAR_SPEED_3D,
} from "./numeric-policy.js";

const repositoryRoot = fileURLToPath(
  new URL("../../../../../", import.meta.url),
);
const require = createRequire(import.meta.url);
const tscPath = join(
  dirname(require.resolve("typescript/package.json")),
  "bin/tsc",
);

describe("@crc/physics public 3D type surface", () => {
  it("locks the approved 3D numeric and bounded-iteration policy", () => {
    expect(GEOMETRY_EPSILON_3D).toBe(1e-9);
    expect(CONTACT_SLOP_3D).toBe(0.005);
    expect(MAX_POSITION_CORRECTION_3D).toBe(0.2);
    expect(RESTITUTION_VELOCITY_THRESHOLD_3D).toBe(1);
    expect(SLEEP_LINEAR_SPEED_3D).toBe(0.05);
    expect(SLEEP_ANGULAR_SPEED_DEGREES_3D).toBe(0.5);
    expect(SLEEP_DURATION_SECONDS_3D).toBe(0.5);
    expect(FAT_AABB_MARGIN_3D).toBe(0.1);
    expect(MAX_GJK_ITERATIONS_3D).toBe(32);
    expect(MAX_EPA_ITERATIONS_3D).toBe(48);
    expect(MAX_CCD_IMPACTS_PER_TICK_3D).toBe(4);
  });

  it("exports only the implemented geometry values from both dimensioned entries", () => {
    expect(compileFixture(completeSurfaceFixture)).toBe("");
    expect(
      compileFixture(`
        // @ts-expect-error @crc/physics deliberately has no root barrel.
        import '@crc/physics';
      `),
    ).toBe("");
  });

  it("keeps shapes and runtime handles nominal and numeric tuples readonly", () => {
    expect(compileFixture(nominalFixture)).toBe("");
  });

  it("augments supported WebGL primitives only after the 3D entry is imported", () => {
    expect(
      compileFixture(`
      import type { CubeProps } from '@crc/webgl';
      type HasPhysics = 'physics' extends keyof CubeProps ? true : false;
      const hasPhysics: HasPhysics = false;
      void hasPhysics;
    `),
    ).toBe("");
    expect(
      compileFixture(`
      import type { CubeProps, Group3DProps, MeshProps, SphereProps } from '@crc/webgl';
      import type { CRCPhysicsBodyAttachment3D } from '@crc/physics/3d';
      declare const attachment: CRCPhysicsBodyAttachment3D;
      const cube: CubeProps = { physics: attachment };
      const group: Group3DProps = { children: undefined, physics: attachment };
      const mesh: MeshProps = { geometry: null as never, physics: attachment };
      const sphere: SphereProps = { physics: attachment };
      void [cube, group, mesh, sphere];
    `),
    ).toBe("");
  });

  it("keeps geometry declarations renderer- and runtime-independent", () => {
    const emitted = emitGeometryDeclarations();

    expect(emitted.diagnostics).toBe("");
    expect(emitted.declarations).not.toMatch(/@crc\/(?:core|webgl)/);
    expect(emitted.declarations).not.toMatch(/scheduler|Canvas|DOM|browser/);
  });
});

const completeSurfaceFixture = `
  import {
    sphereShape3D, boxShape3D, boundsOfShape3D, massProperties3D,
    containsPoint3D, distanceBetweenShapes3D, overlapShapes3D,
    contactBetweenShapes3D, raycastShape3D, shapeCastAgainstShape3D,
    transformShape3D,
    type CRCPhysicsVector3, type CRCPhysicsQuaternion,
    type CRCPhysicsMatrix3, type CRCPhysicsPose3D,
    type CRCPhysicsTransform3D, type CRCPhysicsAabb3D,
    type CRCPhysicsRay3D, type CRCPhysicsShape3D,
    type CRCPhysicsMassProperties3D, type CRCPhysicsDistance3D,
    type CRCPhysicsContactPoint3D, type CRCPhysicsShapeContact3D,
    type CRCPhysicsShapeHit3D,
  } from '@crc/physics/3d/geometry';
  import {
    sphereShape3D as sphereFromWorld,
    boxShape3D as boxFromWorld,
    boundsOfShape3D as boundsFromWorld,
    massProperties3D as massFromWorld,
    containsPoint3D as containsFromWorld,
    distanceBetweenShapes3D as distanceFromWorld,
    overlapShapes3D as overlapFromWorld,
    contactBetweenShapes3D as contactFromWorld,
    raycastShape3D as raycastFromWorld,
    shapeCastAgainstShape3D as shapeCastFromWorld,
    transformShape3D as transformFromWorld,
    type CRCPhysicsAxisLocks3D,
    type CRCPhysicsCollisionFilter,
    type CRCPhysicsColliderConfiguration3D,
    type CRCPhysicsDynamicBody3DOptions,
    type CRCPhysicsStaticBody3DOptions,
    type CRCPhysicsKinematicTarget3D,
    type CRCPhysicsKinematicBody3DOptions,
    type CRCPhysicsSolverOptions,
    type CRCPhysicsWorld3DProps,
    type CRCPhysicsBodyAttachment3D,
    type CRCPhysicsColliderAttachment3D,
    type CRCPhysicsAttachment3D,
    type CRCPhysicsBodyHandle3D,
    type CRCPhysicsColliderHandle3D,
    type CRCPhysicsWorldHandle3D,
    type CRCPhysicsQueryMode,
    type CRCPhysicsQueryOptions3D,
    type CRCPhysicsQueryHit3D,
    type CRCPhysicsQueryMatch3D,
    type CRCPhysicsQueryResult3D,
    type CRCPhysicsCollisionEvent3D,
    type CRCPhysicsOverlapEvent3D,
    type CRCPhysicsBodyStateEvent3D,
    type CRCPhysicsCollisionHandler3D,
    type CRCPhysicsHitHandler3D,
    type CRCPhysicsOverlapHandler3D,
    type CRCPhysicsBodyStateHandler3D,
  } from '@crc/physics/3d';

  declare const shape: CRCPhysicsShape3D;
  declare const pose: CRCPhysicsPose3D;
  declare const point: CRCPhysicsVector3;
  declare const ray: CRCPhysicsRay3D;
  const contains: boolean = containsPoint3D(shape, pose, point);
  const distance: CRCPhysicsDistance3D = distanceBetweenShapes3D(shape, pose, shape, pose);
  const overlap: boolean = overlapShapes3D(shape, pose, shape, pose);
  const contact: CRCPhysicsShapeContact3D | null = contactBetweenShapes3D(shape, pose, shape, pose);
  const rayHit: CRCPhysicsShapeHit3D | null = raycastShape3D(shape, pose, ray, { includeInitialOverlap: true });
  const castHit: CRCPhysicsShapeHit3D | null = shapeCastAgainstShape3D(shape, pose, point, shape, pose);
  void [sphereShape3D, boxShape3D, boundsOfShape3D, massProperties3D,
    containsPoint3D, distanceBetweenShapes3D, overlapShapes3D,
    contactBetweenShapes3D, raycastShape3D, shapeCastAgainstShape3D,
    transformShape3D, sphereFromWorld, boxFromWorld, boundsFromWorld,
    massFromWorld, containsFromWorld, distanceFromWorld, overlapFromWorld,
    contactFromWorld, raycastFromWorld, shapeCastFromWorld,
    transformFromWorld, contains, distance, overlap, contact, rayHit, castHit];

  type GeometryTypes = [CRCPhysicsVector3, CRCPhysicsQuaternion,
    CRCPhysicsMatrix3, CRCPhysicsPose3D, CRCPhysicsTransform3D,
    CRCPhysicsAabb3D, CRCPhysicsRay3D, CRCPhysicsShape3D,
    CRCPhysicsMassProperties3D, CRCPhysicsDistance3D,
    CRCPhysicsContactPoint3D, CRCPhysicsShapeContact3D,
    CRCPhysicsShapeHit3D];
  type RuntimeTypes = [CRCPhysicsAxisLocks3D, CRCPhysicsCollisionFilter,
    CRCPhysicsColliderConfiguration3D, CRCPhysicsDynamicBody3DOptions,
    CRCPhysicsStaticBody3DOptions, CRCPhysicsKinematicTarget3D,
    CRCPhysicsKinematicBody3DOptions, CRCPhysicsSolverOptions,
    CRCPhysicsWorld3DProps, CRCPhysicsBodyAttachment3D,
    CRCPhysicsColliderAttachment3D, CRCPhysicsAttachment3D,
    CRCPhysicsBodyHandle3D, CRCPhysicsColliderHandle3D,
    CRCPhysicsWorldHandle3D, CRCPhysicsQueryMode,
    CRCPhysicsQueryOptions3D, CRCPhysicsQueryHit3D,
    CRCPhysicsQueryMatch3D,
    CRCPhysicsQueryResult3D<'closest', CRCPhysicsQueryMatch3D>,
    CRCPhysicsCollisionEvent3D, CRCPhysicsOverlapEvent3D,
    CRCPhysicsBodyStateEvent3D, CRCPhysicsCollisionHandler3D,
    CRCPhysicsHitHandler3D, CRCPhysicsOverlapHandler3D,
    CRCPhysicsBodyStateHandler3D];
  declare const geometryTypes: GeometryTypes;
  declare const runtimeTypes: RuntimeTypes;
  void geometryTypes;
  void runtimeTypes;

  // Runtime values arrive with their implementations, never as throwing stubs.
  // @ts-expect-error Task 2 does not export a world component.
  import { PhysicsWorld3D } from '@crc/physics/3d';
  // @ts-expect-error Task 2 does not export descriptor factories.
  import { dynamicBody3D } from '@crc/physics/3d';
  // @ts-expect-error Task 2 does not export future geometry factories.
  import { ellipsoidShape3D } from '@crc/physics/3d/geometry';
  void [PhysicsWorld3D, dynamicBody3D, ellipsoidShape3D];
`;

const nominalFixture = `
  import type {
    CRCPhysicsAttachment3D, CRCPhysicsBodyAttachment3D,
    CRCPhysicsColliderAttachment3D, CRCPhysicsBodyHandle3D,
    CRCPhysicsColliderHandle3D, CRCPhysicsWorldHandle3D,
  } from '@crc/physics/3d';
  import type {
    CRCPhysicsMatrix3, CRCPhysicsQuaternion, CRCPhysicsShape3D,
    CRCPhysicsVector3,
  } from '@crc/physics/3d/geometry';

  declare const vector: CRCPhysicsVector3;
  declare const quaternion: CRCPhysicsQuaternion;
  declare const matrix: CRCPhysicsMatrix3;
  declare const points: readonly CRCPhysicsVector3[];
  declare const body: CRCPhysicsBodyAttachment3D;
  const attachment: CRCPhysicsAttachment3D = body;
  void attachment;

  // @ts-expect-error public lookalikes are not shapes.
  const invalidShape: CRCPhysicsShape3D = {};
  // @ts-expect-error public lookalikes are not body attachments.
  const invalidBody: CRCPhysicsBodyAttachment3D = {};
  // @ts-expect-error public lookalikes are not collider attachments.
  const invalidCollider: CRCPhysicsColliderAttachment3D = {};
  // @ts-expect-error public lookalikes are not body handles.
  const invalidBodyHandle: CRCPhysicsBodyHandle3D = {};
  // @ts-expect-error public lookalikes are not collider handles.
  const invalidColliderHandle: CRCPhysicsColliderHandle3D = {};
  // @ts-expect-error public lookalikes are not world handles.
  const invalidWorldHandle: CRCPhysicsWorldHandle3D = {};
  // @ts-expect-error vectors are readonly tuples.
  vector[0] = 1;
  // @ts-expect-error quaternions are readonly tuples.
  quaternion[3] = 1;
  // @ts-expect-error matrices are readonly tuples.
  matrix[8] = 1;
  // @ts-expect-error point collections are readonly.
  points.push([1, 2, 3]);
  void [invalidShape, invalidBody, invalidCollider, invalidBodyHandle,
    invalidColliderHandle, invalidWorldHandle];
`;

function compileFixture(source: string): string {
  return withTemporaryDirectory((directory) => {
    writeFileSync(join(directory, "fixture.ts"), source);
    writeFileSync(
      join(directory, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          lib: ["ESNext", "DOM"],
          module: "ESNext",
          moduleResolution: "Bundler",
          noEmit: true,
          paths: {
            "@crc/core": [`${repositoryRoot}/packages/core/src/index.ts`],
            "@crc/core/internal": [
              `${repositoryRoot}/packages/core/src/internal.ts`,
            ],
            "@crc/physics/3d": [`${repositoryRoot}/packages/physics/src/3d.ts`],
            "@crc/physics/3d/geometry": [
              `${repositoryRoot}/packages/physics/src/3d-geometry.ts`,
            ],
            "@crc/webgl": [`${repositoryRoot}/packages/webgl/src/index.ts`],
          },
          skipLibCheck: true,
          strict: true,
          target: "ESNext",
          types: [],
        },
        files: ["./fixture.ts"],
      }),
    );

    return runTypeScript(directory);
  });
}

function emitGeometryDeclarations(): Readonly<{
  declarations: string;
  diagnostics: string;
}> {
  return withTemporaryDirectory((directory) => {
    const outputDirectory = join(directory, "declarations");
    writeFileSync(
      join(directory, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          declaration: true,
          emitDeclarationOnly: true,
          module: "ESNext",
          moduleResolution: "Bundler",
          outDir: outputDirectory,
          rootDir: `${repositoryRoot}/packages/physics/src`,
          skipLibCheck: true,
          target: "ESNext",
          types: [],
        },
        files: [`${repositoryRoot}/packages/physics/src/3d-geometry.ts`],
      }),
    );

    const diagnostics = runTypeScript(directory);
    const declarations =
      diagnostics === ""
        ? readdirSync(outputDirectory, { encoding: "utf8", recursive: true })
            .filter((fileName) => fileName.endsWith(".d.ts"))
            .map((fileName) =>
              readFileSync(join(outputDirectory, fileName), "utf8"),
            )
            .join("\n")
        : "";
    return { declarations, diagnostics };
  });
}

function runTypeScript(directory: string): string {
  const result = spawnSync(process.execPath, [tscPath, "-p", directory], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  return `${result.stdout}${result.stderr}`;
}

function withTemporaryDirectory<T>(run: (directory: string) => T): T {
  const directory = mkdtempSync(join(tmpdir(), "crc-physics-3d-types-"));
  try {
    return run(directory);
  } finally {
    rmSync(directory, { recursive: true });
  }
}
