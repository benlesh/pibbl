import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  copyFiniteVector2,
  requireFiniteNumber,
  requireNonnegativeNumber,
  requirePositiveNumber,
  requireSafeIntegerInRange,
} from '../shared/validation.js';
import {
  DEFAULT_FIXED_STEP_MILLISECONDS,
  DEFAULT_GRAVITY,
  DEFAULT_INTERPOLATION,
  DEFAULT_MAX_CATCH_UP_STEPS,
  DEFAULT_POSITION_ITERATIONS,
  DEFAULT_SLEEPING,
  DEFAULT_VELOCITY_ITERATIONS,
  GEOMETRY_EPSILON,
  MAX_CCD_IMPACTS_PER_TICK,
  MAX_EPA_ITERATIONS,
  MAX_GJK_ITERATIONS,
} from './numeric-policy.js';

const repositoryRoot = fileURLToPath(
  new URL('../../../../../../../', import.meta.url),
);
const require = createRequire(import.meta.url);
const tscPath = join(
  dirname(require.resolve('typescript/package.json')),
  'bin/tsc',
);

describe('@pibbl/core/physics public 2D type surface', () => {
  it('locks the documented 2D defaults and iteration policy', () => {
    expect(DEFAULT_GRAVITY).toEqual([0, 0]);
    expect(Object.isFrozen(DEFAULT_GRAVITY)).toBe(true);
    expect(DEFAULT_FIXED_STEP_MILLISECONDS).toBe(1000 / 60);
    expect(DEFAULT_MAX_CATCH_UP_STEPS).toBe(4);
    expect(DEFAULT_INTERPOLATION).toBe('linear');
    expect(DEFAULT_SLEEPING).toBe(true);
    expect(DEFAULT_VELOCITY_ITERATIONS).toBe(8);
    expect(DEFAULT_POSITION_ITERATIONS).toBe(3);
    expect(GEOMETRY_EPSILON).toBe(1e-9);
    expect(MAX_GJK_ITERATIONS).toBe(24);
    expect(MAX_EPA_ITERATIONS).toBe(32);
    expect(MAX_CCD_IMPACTS_PER_TICK).toBe(4);
  });

  it('validates and copies public numeric input synchronously', () => {
    const source: [number, number] = [3, 4];
    const copied = copyFiniteVector2(source, 'velocity');
    source[0] = 99;

    expect(copied).toEqual([3, 4]);
    expect(Object.isFrozen(copied)).toBe(true);
    expect(requireFiniteNumber(-2.5, 'value')).toBe(-2.5);
    expect(requirePositiveNumber(0.25, 'radius')).toBe(0.25);
    expect(requireNonnegativeNumber(0, 'friction')).toBe(0);
    expect(requireSafeIntegerInRange(16, 1, 16, 'maxCatchUpSteps')).toBe(16);
    expect(() => requireFiniteNumber(Number.NaN, 'gravity[0]')).toThrow(
      'gravity[0] must be a finite number; received NaN.',
    );
    expect(() => requirePositiveNumber(0, 'radius')).toThrow(
      'radius must be greater than zero; received 0.',
    );
    expect(() => requireNonnegativeNumber(-1, 'friction')).toThrow(
      'friction must be nonnegative; received -1.',
    );
    expect(() => requireSafeIntegerInRange(17, 1, 16, 'maxCatchUpSteps'))
      .toThrow(
        'maxCatchUpSteps must be a safe integer from 1 through 16; received 17.',
      );
    expect(() => copyFiniteVector2([0, Number.POSITIVE_INFINITY], 'gravity'))
      .toThrow('gravity[1] must be a finite number; received Infinity.');
  });

  it('exports every fixed geometry and world name from dimensioned entries', () => {
    expect(compileFixture(completeSurfaceFixture)).toBe('');
    expect(
      compileFixture(`
        // @ts-expect-error @pibbl/core/physics deliberately has no root barrel.
        import '@pibbl/core/physics';
      `),
    ).toBe('');
  });

  it('keeps attachment and shape values nominal and numeric arrays readonly', () => {
    expect(compileFixture(nominalFixture)).toBe('');
  });

  it('augments supported core primitives only after the world entry is imported', () => {
    const beforeDiagnostics = compileFixture(`
      import type { RectangleProps } from '@pibbl/core';
      type HasPhysics = 'physics' extends keyof RectangleProps ? true : false;
      const hasPhysics: HasPhysics = false;
      void hasPhysics;
    `);
    const afterDiagnostics = compileFixture(`
      import type { PibblComponent, RectangleProps } from '@pibbl/core';
      import { dynamicBody2D } from '@pibbl/core/physics/2d';

      const supported: RectangleProps = { physics: dynamicBody2D() };
      void supported;

      interface CustomProps { readonly physics?: string }
      const Custom: PibblComponent<CustomProps> = () => undefined;
      Custom({ physics: 'application-owned' });
      // @ts-expect-error official attachment types do not leak into custom props.
      Custom({ physics: dynamicBody2D() });
    `);

    expect(beforeDiagnostics).toBe('');
    expect(afterDiagnostics).toBe('');
  });

  it('keeps geometry declarations renderer-independent', () => {
    const emitted = emitGeometryDeclarations();

    expect(emitted.diagnostics).toBe('');
    expect(emitted.declarations).not.toContain('@pibbl/core');
  });
});

const completeSurfaceFixture = `
  import {
    circleShape2D, ellipseShape2D, boxShape2D, roundedBoxShape2D,
    capsuleShape2D, arcShape2D, wedgeShape2D, segmentShape2D,
    chainShape2D, polygonShape2D, boundsOfShape2D, massProperties2D,
    containsPoint2D, distanceBetweenShapes2D, overlapShapes2D,
    contactBetweenShapes2D, raycastShape2D, shapeCastAgainstShape2D,
    transformShape2D,
    type PibblPhysicsVector2, type PibblPhysicsPose2D,
    type PibblPhysicsTransform2D, type PibblPhysicsAabb2D,
    type PibblPhysicsRay2D, type PibblPhysicsShape2D,
    type PibblPhysicsMassProperties2D, type PibblPhysicsDistance2D,
    type PibblPhysicsContactPoint2D, type PibblPhysicsShapeContact2D,
    type PibblPhysicsShapeHit2D,
  } from '@pibbl/core/physics/2d/geometry';
  import {
    PhysicsWorld2D, PhysicsShape2D, Capsule2D, Segment2D, Chain2D,
    dynamicBody2D, staticBody2D, kinematicBody2D, collider2D,
    withPhysicsShape2D, pibblPhysicsBody2D, pibblPhysicsWorld2D,
    applyForce2D, applyImpulse2D, applyTorque2D, setLinearVelocity2D,
    setAngularVelocity2D, teleportBody2D, wakeBody2D, sleepBody2D,
    enableBody2D, disableBody2D, raycastAny2D, shapeCastAll2D,
    findShapeOverlap2D, findAllAabbMatches2D, hasPointMatch2D,
    type PibblPhysicsCollisionFilter, type PibblPhysicsCollisionHandler2D,
    type PibblPhysicsHitHandler2D, type PibblPhysicsOverlapHandler2D,
    type PibblPhysicsBodyStateHandler2D,
    type PibblPhysicsColliderConfiguration2D,
    type PibblPhysicsDynamicBody2DOptions,
    type PibblPhysicsStaticBody2DOptions,
    type PibblPhysicsKinematicTarget2D,
    type PibblPhysicsKinematicBody2DOptions,
    type PibblPhysicsBodyAttachment2D,
    type PibblPhysicsColliderAttachment2D,
    type PibblPhysicsAttachment2D, type PibblPhysicsSolverOptions,
    type PibblPhysicsWorld2DProps, type PibblPhysicsPrimitiveProps2D,
    type PhysicsShape2DProps, type PhysicsShape2DStyle,
    type Capsule2DProps, type Capsule2DStyle,
    type Segment2DProps, type Segment2DStyle,
    type Chain2DProps, type Chain2DStyle,
    type PibblPhysicsBodyHandle2D, type PibblPhysicsColliderHandle2D,
    type PibblPhysicsWorldHandle2D,
    type PibblPhysicsQueryOptions2D, type PibblPhysicsQueryHit2D,
    type PibblPhysicsQueryMatch2D,
    type PibblPhysicsCollisionEvent2D, type PibblPhysicsOverlapEvent2D,
    type PibblPhysicsBodyStateEvent2D,
  } from '@pibbl/core/physics/2d';

  void [circleShape2D, ellipseShape2D, boxShape2D, roundedBoxShape2D,
    capsuleShape2D, arcShape2D, wedgeShape2D, segmentShape2D,
    chainShape2D, polygonShape2D, boundsOfShape2D, massProperties2D,
    containsPoint2D, distanceBetweenShapes2D, overlapShapes2D,
    contactBetweenShapes2D, raycastShape2D, shapeCastAgainstShape2D,
    transformShape2D, PhysicsWorld2D, PhysicsShape2D, Capsule2D,
    Segment2D, Chain2D, dynamicBody2D, staticBody2D, kinematicBody2D,
    collider2D, withPhysicsShape2D, pibblPhysicsBody2D, pibblPhysicsWorld2D,
    applyForce2D, applyImpulse2D, applyTorque2D, setLinearVelocity2D,
    setAngularVelocity2D, teleportBody2D, wakeBody2D, sleepBody2D,
    enableBody2D, disableBody2D, raycastAny2D, shapeCastAll2D, findShapeOverlap2D,
    findAllAabbMatches2D, hasPointMatch2D];

  type GeometryTypes = [PibblPhysicsVector2, PibblPhysicsPose2D,
    PibblPhysicsTransform2D, PibblPhysicsAabb2D, PibblPhysicsRay2D,
    PibblPhysicsShape2D, PibblPhysicsMassProperties2D, PibblPhysicsDistance2D,
    PibblPhysicsContactPoint2D, PibblPhysicsShapeContact2D,
    PibblPhysicsShapeHit2D];
  type WorldTypes = [PibblPhysicsCollisionFilter,
    PibblPhysicsCollisionHandler2D, PibblPhysicsHitHandler2D,
    PibblPhysicsOverlapHandler2D, PibblPhysicsBodyStateHandler2D,
    PibblPhysicsColliderConfiguration2D, PibblPhysicsDynamicBody2DOptions,
    PibblPhysicsStaticBody2DOptions, PibblPhysicsKinematicTarget2D,
    PibblPhysicsKinematicBody2DOptions, PibblPhysicsBodyAttachment2D,
    PibblPhysicsColliderAttachment2D, PibblPhysicsAttachment2D,
    PibblPhysicsSolverOptions, PibblPhysicsWorld2DProps,
    PibblPhysicsPrimitiveProps2D, PhysicsShape2DProps, PhysicsShape2DStyle,
    Capsule2DProps, Capsule2DStyle, Segment2DProps, Segment2DStyle,
    Chain2DProps, Chain2DStyle, PibblPhysicsBodyHandle2D,
    PibblPhysicsColliderHandle2D, PibblPhysicsWorldHandle2D,
    PibblPhysicsQueryOptions2D,
    PibblPhysicsQueryHit2D, PibblPhysicsQueryMatch2D,
    PibblPhysicsQueryMatch2D | null,
    PibblPhysicsCollisionEvent2D, PibblPhysicsOverlapEvent2D,
    PibblPhysicsBodyStateEvent2D];
  declare const geometryTypes: GeometryTypes;
  declare const worldTypes: WorldTypes;
  void geometryTypes;
  void worldTypes;

  declare const world: PibblPhysicsWorldHandle2D;
  declare const shape: PibblPhysicsShape2D;
  declare const pose: PibblPhysicsPose2D;
  declare const ray: PibblPhysicsRay2D;
  declare const bounds: PibblPhysicsAabb2D;
  declare const point: PibblPhysicsVector2;
  const physicsShapeInput: Parameters<typeof PhysicsShape2D>[0] = {
    style: { shape },
  };
  const capsuleInput: Parameters<typeof Capsule2D>[0] = {
    style: { start: [0, 0], end: [1, 0], radius: 1 },
  };
  const segmentInput: Parameters<typeof Segment2D>[0] = {
    style: { start: [0, 0], end: [1, 0], stroke: 'black' },
  };
  const chainInput: Parameters<typeof Chain2D>[0] = {
    style: { points: [[0, 0], [1, 0]] },
  };
  // @ts-expect-error Capsule2D radius is required.
  const invalidCapsuleInput: Parameters<typeof Capsule2D>[0] = { style: { start: [0, 0], end: [1, 0] } };
  // @ts-expect-error Segment2D is stroke-only.
  const invalidSegmentInput: Parameters<typeof Segment2D>[0] = { style: { start: [0, 0], end: [1, 0], fill: 'black' } };
  void [physicsShapeInput, capsuleInput, segmentInput, chainInput,
    invalidCapsuleInput, invalidSegmentInput];
  const anyHit: boolean = raycastAny2D(world, ray);
  const allHits: readonly PibblPhysicsQueryHit2D[] =
    shapeCastAll2D(world, shape, pose, [1, 0]);
  const closestOverlap: PibblPhysicsQueryMatch2D | null =
    findShapeOverlap2D(world, shape, pose);
  const allBounds: readonly PibblPhysicsQueryMatch2D[] =
    findAllAabbMatches2D(world, bounds);
  const anyPoint: boolean = hasPointMatch2D(world, point);
  void [anyHit, allHits, closestOverlap, allBounds, anyPoint];
`;

const nominalFixture = `
  import type {
    PibblPhysicsAttachment2D, PibblPhysicsBodyAttachment2D,
    PibblPhysicsColliderAttachment2D,
  } from '@pibbl/core/physics/2d';
  import type {
    PibblPhysicsShape2D, PibblPhysicsVector2,
  } from '@pibbl/core/physics/2d/geometry';

  declare const body: PibblPhysicsBodyAttachment2D;
  declare const collider: PibblPhysicsColliderAttachment2D;
  declare const vector: PibblPhysicsVector2;
  declare const points: readonly PibblPhysicsVector2[];
  const attachment: PibblPhysicsAttachment2D = body;
  void attachment;
  void collider;

  // @ts-expect-error public lookalikes are not shapes.
  const invalidShape: PibblPhysicsShape2D = {};
  // @ts-expect-error public lookalikes are not body attachments.
  const invalidBody: PibblPhysicsBodyAttachment2D = {};
  // @ts-expect-error public lookalikes are not collider attachments.
  const invalidCollider: PibblPhysicsColliderAttachment2D = {};
  // @ts-expect-error vectors are readonly tuples.
  vector[0] = 1;
  // @ts-expect-error point collections are readonly.
  points.push([1, 2]);
  void invalidShape;
  void invalidBody;
  void invalidCollider;
`;

function compileFixture(source: string): string {
  return withTemporaryDirectory((directory) => {
    writeFileSync(join(directory, 'fixture.ts'), source);
    writeFileSync(
      join(directory, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          lib: ['ESNext', 'DOM'],
          module: 'ESNext',
          moduleResolution: 'Bundler',
          noEmit: true,
          paths: {
            '@pibbl/core': [`${repositoryRoot}/packages/core/src/index.ts`],
            '@pibbl/core/internal': [
              `${repositoryRoot}/packages/core/src/internal.ts`,
            ],
            '@pibbl/core/physics/2d': [
              `${repositoryRoot}/packages/core/src/features/physics/2d.ts`,
            ],
            '@pibbl/core/physics/2d/geometry': [
              `${repositoryRoot}/packages/core/src/features/physics/2d-geometry.ts`,
            ],
          },
          skipLibCheck: true,
          strict: true,
          target: 'ESNext',
          types: [],
        },
        files: ['./fixture.ts'],
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
    const outputDirectory = join(directory, 'declarations');
    writeFileSync(
      join(directory, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          declaration: true,
          emitDeclarationOnly: true,
          module: 'ESNext',
          moduleResolution: 'Bundler',
          outDir: outputDirectory,
          rootDir: `${repositoryRoot}/packages/core/src/features/physics`,
          skipLibCheck: true,
          target: 'ESNext',
          types: [],
        },
        files: [`${repositoryRoot}/packages/core/src/features/physics/2d-geometry.ts`],
      }),
    );

    const diagnostics = runTypeScript(directory);
    const declarations = diagnostics === ''
      ? readdirSync(outputDirectory, { encoding: 'utf8', recursive: true })
          .filter((fileName) => fileName.endsWith('.d.ts'))
          .map((fileName) => readFileSync(join(outputDirectory, fileName), 'utf8'))
          .join('\n')
      : '';
    return { declarations, diagnostics };
  });
}

function runTypeScript(directory: string): string {
  const result = spawnSync(process.execPath, [tscPath, '-p', directory], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  return `${result.stdout}${result.stderr}`;
}

function withTemporaryDirectory<T>(run: (directory: string) => T): T {
  const directory = mkdtempSync(join(tmpdir(), 'pibbl-physics-types-'));
  try {
    return run(directory);
  } finally {
    rmSync(directory, { recursive: true });
  }
}
