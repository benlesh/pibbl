import { crc, createElement, type CRCController } from "@crc/core";
import { Group3D, WebGLLayer } from "@crc/webgl";
import {
  PhysicsWorld3D,
  applyImpulse3D,
  crcPhysicsBody3D,
  crcPhysicsWorld3D,
  dynamicBody3D,
  heightfieldShape3D,
  sphereShape3D,
  triangleMeshShape3D,
  type CRCPhysicsBodyHandle3D,
  type CRCPhysicsWorldHandle3D,
} from "@crc/physics/3d";
import { WebGLLayerController } from "../../webgl/src/lib/layer-controller.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  requirePhysicsWorld3DController,
  snapshotPhysicsWorld3DControllerForTest,
} from "../../physics/src/lib/3d/runtime/controller.js";
import { createPhysicsOwnershipCounters3D } from "../../physics/src/lib/3d/runtime/ownership.js";
import { requireShapeRecord3D } from "../../physics/src/lib/3d/shape-records.js";
import { DynamicAabbBroadPhase3D } from "../../physics/src/lib/3d/world/broad-phase.js";
import { BODY_SLEEPING_3D } from "../../physics/src/lib/3d/world/solver.js";
import {
  BODY_ENABLED_3D,
  BODY_TYPE_DYNAMIC_3D,
} from "../../physics/src/lib/3d/world/storage.js";
import {
  PhysicsWorld3DKernel,
  type PhysicsTopologyRecord3D,
} from "../../physics/src/lib/3d/world/world.js";
import {
  installSchedulerDriverForTest,
  ManualSchedulerDriver,
  snapshotRealmScheduler,
} from "../src/lib/scheduler/testing.js";

let driver: ManualSchedulerDriver;
let restoreDriver: () => void;
const mounts = new Set<CRCController>();

beforeEach(() => {
  document.body.replaceChildren();
  driver = new ManualSchedulerDriver();
  restoreDriver = installSchedulerDriverForTest(driver);
});

afterEach(() => {
  for (const mount of mounts) mount.dispose();
  mounts.clear();
  restoreDriver();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function flush(time: number): void {
  expect(driver.pendingHostFrames).toBe(1);
  driver.flush(time);
}

describe("3D physics structural performance", () => {
  it("registers one world participant for 1,000 separated bodies and commits one presentation/render generation", () => {
    const render = vi.spyOn(
      WebGLLayerController.prototype,
      "renderRetainedChild",
    );
    const shape = sphereShape3D({ radius: 0.25 });
    let world!: CRCPhysicsWorldHandle3D;
    let selected!: CRCPhysicsBodyHandle3D;
    const Body = ({ index }: Readonly<{ index: number }>) => {
      const handle = crcPhysicsBody3D();
      if (index === 0) selected = handle;
      return createElement(Group3D, {
        style: { translateX: index * 2 },
        physics: dynamicBody3D({
          handle,
          collider: shape,
          gravityScale: 0,
          mass: 1,
        }),
        children: undefined,
      });
    };
    const Capture = () => {
      world = crcPhysicsWorld3D();
      return undefined;
    };
    const bodies = Array.from({ length: 1_000 }, (_, index) =>
      createElement(Body, { key: index, index }),
    );
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;
    document.body.appendChild(canvas);
    const runtime = crc(
      canvas,
      createElement(WebGLLayer, {
        camera: {
          type: "perspective",
          position: [0, 0, 5],
          lookAt: [0, 0, 0],
          up: [0, 1, 0],
          fieldOfViewDegrees: 45,
          near: 0.1,
          far: 5_000,
        },
        style: { width: 16, height: 16 },
        children: createElement(PhysicsWorld3D, {
          gravity: [0, 0, 0],
          sleeping: false,
          children: [createElement(Capture, {}), ...bodies],
        }),
      }),
      { pixelRatio: 1 },
    );
    mounts.add(runtime);

    flush(0);
    flush(1000 / 60);
    const controller = requirePhysicsWorld3DController(world);
    const before = snapshotPhysicsWorld3DControllerForTest(controller);
    const layer = render.mock.instances[0] as WebGLLayerController;
    const renderGeneration = layer.committedGeneration;
    if (renderGeneration === undefined) {
      throw new Error("expected a committed WebGL generation");
    }
    const renderCalls = render.mock.calls.length;
    expect(snapshotRealmScheduler()).toMatchObject({
      registeredAdvanceParticipants: 1,
    });
    expect(before).toMatchObject({
      advanceRegistered: true,
      kernel: {
        bodyCount: 1_000,
        colliderCount: 1_000,
        counters: { liveBodies: 1_000, liveProxies: 1_000 },
      },
    });
    expect(before.kernel.bodies[0]!.positionX).toBe(0);
    expect(before.kernel.bodies[999]!.positionX).toBe(1_998);

    const topologyCapacities = {
      bodyCapacity: before.kernel.counters.bodyCapacity,
      colliderCapacity: before.kernel.counters.colliderCapacity,
      proxyCapacity: before.kernel.counters.proxyCapacity,
      treeNodeCapacity: before.kernel.counters.treeNodeCapacity,
    };
    applyImpulse3D(selected, [1, 0, 0]);
    expect(snapshotRealmScheduler().queuedBeginCommands).toBe(1);
    flush((1000 / 60) * 2);
    const afterCommands = snapshotPhysicsWorld3DControllerForTest(controller);
    expect(afterCommands.revision).toBe(before.revision + 1);
    expect(layer.committedGeneration).toBe(renderGeneration + 1);
    expect(render.mock.calls.length).toBe(renderCalls + 1);
    expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(1);
    expect(afterCommands.kernel).toMatchObject({
      pendingCommandCount: 0,
      pairCount: 0,
      counters: {
        ...topologyCapacities,
        solverBodyCapacity: 1_024,
        solverContactCapacity: 4,
      },
    });

    const warmedCapacities = {
      ...topologyCapacities,
      solverBodyCapacity: afterCommands.kernel.counters.solverBodyCapacity,
      solverContactCapacity:
        afterCommands.kernel.counters.solverContactCapacity,
    };
    const warmedRevision = afterCommands.revision;
    const warmedRenderGeneration = layer.committedGeneration;
    if (warmedRenderGeneration === undefined) {
      throw new Error("expected a warmed WebGL generation");
    }
    const warmedRenderCalls = render.mock.calls.length;
    applyImpulse3D(selected, [1, 0, 0]);
    flush((1000 / 60) * 3);
    const stable = snapshotPhysicsWorld3DControllerForTest(controller);
    expect(stable.revision).toBe(warmedRevision + 1);
    expect(layer.committedGeneration).toBe(warmedRenderGeneration + 1);
    expect(render.mock.calls.length).toBe(warmedRenderCalls + 1);
    expect(stable.kernel).toMatchObject({
      pairCount: 0,
      counters: warmedCapacities,
    });
  });

  it("excludes sleeping bodies from integration and keeps warmed capacities stable", () => {
    const world = new PhysicsWorld3DKernel({
      gravity: [0, 0, 0],
      fixedStepMilliseconds: 10,
      sleeping: true,
    });
    world.proposeTopology([
      dynamicTopology(1, 0, false),
      dynamicTopology(2, 10, true),
    ]);
    adopt(world, 1, 0);
    adopt(world, 2, 10);
    const warm = world.snapshot();
    expect(warm).toMatchObject({
      integrationBodyCount: 1,
      bodyCount: 2,
      counters: {
        solverBodyCapacity: 4,
        solverContactCapacity: 4,
      },
    });
    adopt(world, 3, 20);
    expect(world.snapshot()).toMatchObject({
      integrationBodyCount: 1,
      counters: {
        bodyCapacity: warm.counters.bodyCapacity,
        solverBodyCapacity: warm.counters.solverBodyCapacity,
        solverContactCapacity: warm.counters.solverContactCapacity,
      },
    });
    world.dispose();
  });

  it("records exact moved-proxy and candidate-pair work without a capacity scan", () => {
    const counters = createPhysicsOwnershipCounters3D();
    const broadPhase = new DynamicAabbBroadPhase3D(counters, 4, 8);
    const first = broadPhase.createProxy(0, 1, 0, 0, 0, 1, 1, 1);
    broadPhase.createProxy(1, 1, 0.5, 0, 0, 1.5, 1, 1);
    const moved = broadPhase.createProxy(2, 1, 10, 0, 0, 11, 1, 1);
    broadPhase.createProxy(3, 1, 20, 0, 0, 21, 1, 1);
    expect(first).toBe(0);
    broadPhase.publishPairs();
    expect(counters).toMatchObject({
      lastMovedProxyCount: 4,
      lastCandidatePairCount: 2,
      publishedPairs: 1,
    });

    const capacities = {
      proxyCapacity: counters.proxyCapacity,
      treeNodeCapacity: counters.treeNodeCapacity,
      movedBufferCapacity: counters.movedBufferCapacity,
      pairBufferCapacity: counters.pairBufferCapacity,
      queryStackCapacity: counters.queryStackCapacity,
    };
    expect(
      broadPhase.moveProxy(
        moved,
        broadPhase.proxyGenerations[moved]!,
        0.75,
        0,
        0,
        1.25,
        1,
        1,
        -9.25,
        0,
        0,
      ),
    ).toBe(true);
    broadPhase.publishPairs();
    expect(counters).toMatchObject({
      lastMovedProxyCount: 1,
      lastCandidatePairCount: 2,
      publishedPairs: 2,
      ...capacities,
    });
    broadPhase.dispose();
  });

  it("keeps 10,000 canonical mesh/heightfield triangles immutable and structurally bounded", () => {
    const meshPositions: number[] = [];
    for (let triangle = 0; triangle < 5_000; triangle += 1) {
      const x = triangle * 2;
      meshPositions.push(x, 0, 0, x + 1, 0, 0, x, 0, 1);
    }
    const mesh = triangleMeshShape3D({ positions: meshPositions });
    const heightfield = heightfieldShape3D({
      rows: 51,
      columns: 51,
      heights: new Float64Array(51 * 51),
    });
    const meshRecord = requireShapeRecord3D(mesh);
    const heightfieldRecord = requireShapeRecord3D(heightfield);
    expect(meshRecord.kind).toBe("triangleMesh");
    expect(heightfieldRecord.kind).toBe("heightfield");
    if (
      meshRecord.kind !== "triangleMesh" ||
      heightfieldRecord.kind !== "heightfield"
    ) {
      throw new Error("expected canonical concave records");
    }
    expect(meshRecord.triangles.length / 9).toBe(5_000);
    expect(heightfieldRecord.triangles.length / 9).toBe(5_000);
    expect(
      meshRecord.bvh.triangle.filter((triangle) => triangle >= 0).length +
        heightfieldRecord.bvh.triangle.filter((triangle) => triangle >= 0)
          .length,
    ).toBe(10_000);
    expect(meshRecord.bvh.left.length).toBe(9_999);
    expect(heightfieldRecord.bvh.left.length).toBe(9_999);
    expect(requireShapeRecord3D(mesh)).toBe(meshRecord);
    expect(requireShapeRecord3D(heightfield)).toBe(heightfieldRecord);
  });
});

function dynamicTopology(
  id: number,
  x: number,
  sleeping: boolean,
): PhysicsTopologyRecord3D {
  return {
    kind: "body",
    id,
    definition: {
      positionX: x,
      positionY: 0,
      positionZ: 0,
      orientationX: 0,
      orientationY: 0,
      orientationZ: 0,
      orientationW: 1,
      localCenterX: 0,
      localCenterY: 0,
      localCenterZ: 0,
      linearVelocityX: 0,
      linearVelocityY: 0,
      linearVelocityZ: 0,
      angularVelocityX: 0,
      angularVelocityY: 0,
      angularVelocityZ: 0,
      forceX: 0,
      forceY: 0,
      forceZ: 0,
      torqueX: 0,
      torqueY: 0,
      torqueZ: 0,
      inverseMass: 1,
      localInverseInertiaXX: 1,
      localInverseInertiaYY: 1,
      localInverseInertiaZZ: 1,
      localInverseInertiaXY: 0,
      localInverseInertiaXZ: 0,
      localInverseInertiaYZ: 0,
      linearDamping: 0,
      angularDamping: 0,
      gravityScale: 0,
      sleepTime: sleeping ? 1 : 0,
      translationLocks: 0,
      rotationLocks: 0,
      flags:
        BODY_ENABLED_3D |
        BODY_TYPE_DYNAMIC_3D |
        (sleeping ? BODY_SLEEPING_3D : 0),
      owner: null,
    },
  };
}

function adopt(
  world: PhysicsWorld3DKernel,
  frameId: number,
  time: number,
): void {
  world.adopt(
    world.advance({
      frameId,
      logicalTime: time,
      stagedKinematicTargets: new Map(),
    }),
  );
}
