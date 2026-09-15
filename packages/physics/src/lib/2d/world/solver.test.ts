import { describe, expect, it } from "vitest";
import type { PrivateManifold2D } from "../collision/manifold.js";
import type { ShapeRecord2D } from "../shape-records.js";
import { createPhysicsOwnershipCounters2D } from "../runtime/ownership.js";
import {
  COLLIDER_SENSOR_2D,
  ContactCache2D,
  updateSortedContactCache2D,
  type SortedColliderPairs2D,
} from "./contact-cache.js";
import { BODY_TYPE_DYNAMIC_2D } from "./integrator.js";
import { SequentialImpulseSolver2D } from "./solver.js";
import { BodyStore2D, ColliderStore2D } from "./storage.js";

const shapeRecord: ShapeRecord2D = Object.freeze({
  leaves: Object.freeze([]),
  localPose: Object.freeze({ x: 0, y: 0, rotationRadians: 0 }),
  localBounds: new Float64Array([-1, -1, 1, 1]),
  area: 1,
  centroidX: 0,
  centroidY: 0,
  unitInertia: 1,
});

interface SceneBody {
  readonly index: number;
  readonly collider: number;
}

interface Scene {
  readonly bodies: BodyStore2D;
  readonly colliders: ColliderStore2D;
  readonly contacts: ContactCache2D;
  readonly solver: SequentialImpulseSolver2D;
  readonly bodyIndices: Int32Array;
  addBody(options?: Readonly<{
    dynamic?: boolean;
    x?: number;
    y?: number;
    vx?: number;
    vy?: number;
    angularVelocity?: number;
    inverseInertia?: number;
    friction?: number;
    restitution?: number;
    sensor?: boolean;
  }>): SceneBody;
  setContacts(
    entries: readonly Readonly<{
      first: SceneBody;
      second: SceneBody;
      normalX: number;
      normalY: number;
      points: readonly Readonly<{
        firstX: number;
        firstY: number;
        secondX: number;
        secondY: number;
        separation: number;
        firstFeature?: number;
        secondFeature?: number;
      }>[];
    }>[],
  ): void;
}

function createScene(capacity = 8): Scene {
  const counters = createPhysicsOwnershipCounters2D();
  const bodies = new BodyStore2D(counters, capacity);
  const colliders = new ColliderStore2D(counters, capacity);
  const contacts = new ContactCache2D(capacity);
  const solver = new SequentialImpulseSolver2D(capacity, capacity);
  const allocated: number[] = [];
  const scene: Scene = {
    bodies,
    colliders,
    contacts,
    solver,
    get bodyIndices() {
      return Int32Array.from(allocated);
    },
    addBody(options = {}) {
      const dynamic = options.dynamic ?? true;
      const index = bodies.allocate({
        positionX: options.x ?? 0,
        positionY: options.y ?? 0,
        rotationRadians: 0,
        linearVelocityX: options.vx ?? 0,
        linearVelocityY: options.vy ?? 0,
        angularVelocity: options.angularVelocity ?? 0,
        forceX: 0,
        forceY: 0,
        torque: 0,
        inverseMass: dynamic ? 1 : 0,
        inverseInertia: dynamic ? (options.inverseInertia ?? 1) : 0,
        linearDamping: 0,
        angularDamping: 0,
        gravityScale: 1,
        sleepTime: 0,
        flags: dynamic ? BODY_TYPE_DYNAMIC_2D : 0,
        owner: {},
      });
      allocated.push(index);
      const collider = colliders.allocate({
        bodyIndex: index,
        bodyGeneration: bodies.generations[index]!,
        shape: shapeRecord,
        material: {
          friction: options.friction ?? 0.5,
          restitution: options.restitution ?? 0,
        },
        filter: null,
        tag: null,
        handlers: null,
        owner: {},
        flags: options.sensor === true ? COLLIDER_SENSOR_2D : 0,
      });
      return { index, collider };
    },
    setContacts(entries) {
      const sorted = [...entries].sort(
        (left, right) =>
          left.first.collider - right.first.collider ||
          left.second.collider - right.second.collider,
      );
      const source: SortedColliderPairs2D = {
        pairFirstColliderIndices: Int32Array.from(
          sorted.map((entry) => entry.first.collider),
        ),
        pairFirstColliderGenerations: new Uint32Array(sorted.length).fill(1),
        pairSecondColliderIndices: Int32Array.from(
          sorted.map((entry) => entry.second.collider),
        ),
        pairSecondColliderGenerations: new Uint32Array(sorted.length).fill(1),
        pairCount: sorted.length,
      };
      updateSortedContactCache2D(
        contacts,
        source,
        colliders,
        (first, second): PrivateManifold2D | null => {
          const entry = sorted.find(
            (candidate) =>
              candidate.first.collider === first &&
              candidate.second.collider === second,
          );
          if (entry === undefined) return null;
          return {
            normalX: entry.normalX,
            normalY: entry.normalY,
            firstLeaf: 0,
            secondLeaf: 0,
            points: entry.points.map((point, index) => ({
              ...point,
              firstFeature: point.firstFeature ?? index,
              secondFeature: point.secondFeature ?? index,
            })),
          };
        },
      );
    },
  };
  return scene;
}

function solve(scene: Scene, order = scene.bodyIndices): void {
  scene.solver.solveCandidate(
    scene.bodies,
    order,
    order.length,
    scene.contacts,
  );
}

describe("deterministic 2D sequential impulse solver", () => {
  it("rests a falling circle on static ground in the fixed iteration counts", () => {
    const scene = createScene();
    const circle = scene.addBody({ y: 0.9, vy: 1, friction: 0 });
    const ground = scene.addBody({ dynamic: false, friction: 0 });
    scene.setContacts([
      {
        first: circle,
        second: ground,
        normalX: 0,
        normalY: -1,
        points: [
          {
            firstX: 0,
            firstY: 1,
            secondX: 0,
            secondY: 0.9,
            separation: -0.1,
          },
        ],
      },
    ]);

    solve(scene);

    expect(scene.bodies.linearVelocityY[circle.index]).toBeCloseTo(0, 12);
    expect(scene.bodies.positionY[circle.index]).toBeCloseTo(0.805, 12);
    expect(scene.solver.velocityIterationsPerformed).toBe(8);
    expect(scene.solver.positionIterationsPerformed).toBe(3);
    expect(scene.contacts.pointNormalImpulses[0]).toBeCloseTo(1, 12);
  });

  it("supports a two-box stack and builds one ascending dynamic island", () => {
    const scene = createScene();
    const ground = scene.addBody({ dynamic: false, friction: 0 });
    const lower = scene.addBody({ y: 0.9, vy: 1, friction: 0 });
    const upper = scene.addBody({ y: -0.1, vy: 1, friction: 0 });
    scene.setContacts([
      {
        first: ground,
        second: lower,
        normalX: 0,
        normalY: 1,
        points: [
          {
            firstX: 0,
            firstY: 0,
            secondX: 0,
            secondY: 0,
            separation: -0.1,
          },
        ],
      },
      {
        first: lower,
        second: upper,
        normalX: 0,
        normalY: 1,
        points: [
          {
            firstX: 0,
            firstY: 0.4,
            secondX: 0,
            secondY: 0.4,
            separation: -0.1,
          },
        ],
      },
    ]);

    solve(scene, new Int32Array([upper.index, lower.index, ground.index]));

    expect(scene.bodies.linearVelocityY[lower.index]).toBeCloseTo(0, 2);
    expect(scene.bodies.linearVelocityY[upper.index]).toBeCloseTo(0, 2);
    expect(scene.solver.islandCount).toBe(1);
    expect(
      Array.from(scene.solver.islandBodyIndices.subarray(0, 2)),
    ).toEqual([lower.index, upper.index]);
  });

  it("applies symmetric restitution only past the closing-speed threshold", () => {
    const run = (speed: number) => {
      const scene = createScene();
      const first = scene.addBody({ x: -0.9, vx: speed, restitution: 1, friction: 0 });
      const second = scene.addBody({ x: 0.9, vx: -speed, restitution: 1, friction: 0 });
      scene.setContacts([
        {
          first,
          second,
          normalX: -1,
          normalY: 0,
          points: [
            {
              firstX: 0,
              firstY: 0,
              secondX: 0,
              secondY: 0,
              separation: 0,
            },
          ],
        },
      ]);
      solve(scene);
      return [
        scene.bodies.linearVelocityX[first.index]!,
        scene.bodies.linearVelocityX[second.index]!,
      ] as const;
    };

    expect(run(2)[0]).toBeCloseTo(-2, 12);
    expect(run(2)[1]).toBeCloseTo(2, 12);
    expect(run(0.5)[0]).toBeCloseTo(0, 12);
    expect(run(0.5)[1]).toBeCloseTo(0, 12);
  });

  it("clamps tangential impulse by geometric-mean friction", () => {
    const scene = createScene();
    const body = scene.addBody({ vx: 4, vy: 2, friction: 0.25 });
    const ground = scene.addBody({ dynamic: false, friction: 1 });
    scene.setContacts([
      {
        first: body,
        second: ground,
        normalX: 0,
        normalY: -1,
        points: [
          {
            firstX: 0,
            firstY: 0,
            secondX: 0,
            secondY: 0,
            separation: 0,
          },
        ],
      },
    ]);

    solve(scene);

    expect(scene.contacts.mixedFriction[0]).toBe(0.5);
    expect(scene.contacts.pointNormalImpulses[0]).toBeCloseTo(2, 12);
    expect(Math.abs(scene.contacts.pointTangentImpulses[0]!)).toBeCloseTo(1, 12);
    expect(scene.bodies.linearVelocityX[body.index]).toBeCloseTo(3, 12);
  });

  it("builds no constraint or impulse for a sensor pair", () => {
    const scene = createScene();
    const body = scene.addBody({ vx: 3, sensor: true });
    const wall = scene.addBody({ dynamic: false });
    scene.setContacts([
      {
        first: body,
        second: wall,
        normalX: -1,
        normalY: 0,
        points: [
          {
            firstX: 0,
            firstY: 0,
            secondX: 0,
            secondY: 0,
            separation: -0.2,
          },
        ],
      },
    ]);

    solve(scene);

    expect(scene.solver.constraintCount).toBe(0);
    expect(scene.bodies.linearVelocityX[body.index]).toBe(3);
    expect(scene.bodies.positionX[body.index]).toBe(0);
    expect(scene.contacts.pointNormalImpulses[0]).toBe(0);
  });

  it("does not merge independent dynamics through one shared immovable body", () => {
    const scene = createScene();
    const sharedGround = scene.addBody({ dynamic: false });
    const first = scene.addBody();
    const second = scene.addBody();
    scene.setContacts([
      {
        first: sharedGround,
        second: first,
        normalX: 0,
        normalY: 1,
        points: [
          { firstX: -2, firstY: 0, secondX: -2, secondY: 0, separation: 0 },
        ],
      },
      {
        first: sharedGround,
        second,
        normalX: 0,
        normalY: 1,
        points: [
          { firstX: 2, firstY: 0, secondX: 2, secondY: 0, separation: 0 },
        ],
      },
    ]);

    solve(scene, new Int32Array([second.index, sharedGround.index, first.index]));

    expect(scene.solver.islandCount).toBe(2);
    expect(Array.from(scene.solver.islandBodyIndices.subarray(0, 2))).toEqual([
      first.index,
      second.index,
    ]);
    expect(Array.from(scene.solver.islandContactIndices.subarray(0, 2))).toEqual([
      0,
      1,
    ]);
  });

  it("bounds each positional correction iteration", () => {
    const scene = createScene();
    const body = scene.addBody();
    const ground = scene.addBody({ dynamic: false });
    scene.setContacts([
      {
        first: body,
        second: ground,
        normalX: 0,
        normalY: -1,
        points: [
          {
            firstX: 0,
            firstY: 0,
            secondX: 0,
            secondY: -2,
            separation: -2,
          },
        ],
      },
    ]);

    solve(scene);

    expect(scene.bodies.positionY[body.index]).toBeCloseTo(-0.6, 12);
  });

  it("reproduces exact ordering and equivalent continuous state in two runs", () => {
    const run = () => {
      const scene = createScene();
      const ground = scene.addBody({ dynamic: false, friction: 1 });
      const lower = scene.addBody({ y: 0.9, vx: 1, vy: 1, friction: 0.5 });
      const upper = scene.addBody({ y: -0.1, vx: -1, vy: 1, friction: 0.5 });
      scene.setContacts([
        {
          first: ground,
          second: lower,
          normalX: 0,
          normalY: 1,
          points: [
            { firstX: 0, firstY: 0, secondX: 0, secondY: 0, separation: -0.1 },
          ],
        },
        {
          first: lower,
          second: upper,
          normalX: 0,
          normalY: 1,
          points: [
            { firstX: 0, firstY: 0.4, secondX: 0, secondY: 0.4, separation: -0.1 },
          ],
        },
      ]);
      solve(scene);
      return {
        islands: Array.from(
          scene.solver.islandBodyIndices.subarray(0, scene.solver.islandBodyCount),
        ),
        constraints: Array.from(
          scene.solver.islandContactIndices.subarray(0, scene.solver.constraintCount),
        ),
        positions: Array.from(scene.bodies.positionY.subarray(0, 3)),
        velocities: Array.from(scene.bodies.linearVelocityY.subarray(0, 3)),
        impulses: Array.from(
          scene.contacts.pointNormalImpulses.subarray(0, 2),
        ),
      };
    };

    const first = run();
    const second = run();
    expect(first.islands).toEqual(second.islands);
    expect(first.constraints).toEqual(second.constraints);
    for (const field of ["positions", "velocities", "impulses"] as const) {
      for (let index = 0; index < first[field].length; index += 1) {
        expect(first[field][index]).toBeCloseTo(second[field][index]!, 12);
      }
    }
  });

  it("reuses warmed constraint and island buffers", () => {
    const scene = createScene(4);
    const body = scene.addBody({ vy: 1 });
    const ground = scene.addBody({ dynamic: false });
    scene.setContacts([
      {
        first: body,
        second: ground,
        normalX: 0,
        normalY: -1,
        points: [
          { firstX: 0, firstY: 0, secondX: 0, secondY: 0, separation: 0 },
        ],
      },
    ]);
    solve(scene);
    const bodies = scene.solver.islandBodyIndices;
    const contacts = scene.solver.islandContactIndices;
    const normalMasses = scene.solver.pointNormalMasses;

    for (let iteration = 0; iteration < 20; iteration += 1) solve(scene);

    expect(scene.solver.islandBodyIndices).toBe(bodies);
    expect(scene.solver.islandContactIndices).toBe(contacts);
    expect(scene.solver.pointNormalMasses).toBe(normalMasses);
  });
});
