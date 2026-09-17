import {
  crc,
  createElement,
  signal,
  type CRCController,
  type CRCNode,
} from "@crc/core";
import { Group3D, WebGLLayer } from "@crc/webgl";
import {
  PhysicsShape3D,
  PhysicsWorld3D,
  applyImpulse3D,
  boxShape3D,
  collider3D,
  crcPhysicsBody3D,
  crcPhysicsWorld3D,
  dynamicBody3D,
  sphereShape3D,
  type CRCPhysicsBodyHandle3D,
  type CRCPhysicsWorldHandle3D,
} from "@crc/physics/3d";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ownershipCountersPhysicsWorld3DControllerForTest,
  requirePhysicsWorld3DController,
  snapshotPhysicsWorld3DControllerForTest,
} from "../../physics/src/lib/3d/runtime/controller.js";
import {
  resetPhysicsEventMaterializationsForTest,
  snapshotPhysicsEventMaterializationsForTest,
} from "../../physics/src/lib/3d/runtime/events.js";
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
  resetPhysicsEventMaterializationsForTest();
});

afterEach(() => {
  for (const mount of mounts) mount.dispose();
  mounts.clear();
  restoreDriver();
  document.body.replaceChildren();
});

function flush(time: number): void {
  expect(driver.pendingHostFrames).toBe(1);
  driver.flush(time);
}

function mount(children: CRCNode): CRCController {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  document.body.appendChild(canvas);
  const mounted = crc(
    canvas,
    createElement(WebGLLayer, {
      camera: {
        type: "perspective",
        position: [0, 0, 8],
        lookAt: [0, 0, 0],
        up: [0, 1, 0],
        fieldOfViewDegrees: 45,
        near: 0.1,
        far: 100,
      },
      style: { width: 32, height: 32 },
      children,
    }),
    { pixelRatio: 1 },
  );
  mounts.add(mounted);
  return mounted;
}

describe("3D physics public ownership", () => {
  it("returns every world/body/collider/proxy owner to baseline across update, replacement, reparent, removal, command cancellation, and disposal", () => {
    const mode = signal<"plain" | "replacement" | "reparented" | "removed">(
      "plain",
    );
    const update = signal(0);
    const sphere = sphereShape3D({ radius: 0.5 });
    const box = boxShape3D({ width: 0.5, height: 0.5, depth: 0.5 });
    let world!: CRCPhysicsWorldHandle3D;
    let body!: CRCPhysicsBodyHandle3D;

    const CaptureWorld = () => {
      world = crcPhysicsWorld3D();
      return undefined;
    };
    const Body = (_props: Readonly<{ identity: string }>) => {
      update.get();
      body = crcPhysicsBody3D();
      return createElement(Group3D, {
        physics: dynamicBody3D({ handle: body, collider: false, mass: "auto" }),
        children: [
          createElement(PhysicsShape3D, {
            shape: sphere,
            physics: collider3D({ shape: sphere, tag: "solid" }),
            style: { color: "#fff", lit: false },
          }),
          createElement(PhysicsShape3D, {
            shape: box,
            physics: collider3D({
              shape: box,
              sensor: true,
              contributesToMass: false,
              offset: [0, 2, 0],
              tag: "sensor",
            }),
            style: { color: "#fff", lit: false },
          }),
        ],
      });
    };
    const Scene = () => {
      const value = mode.get();
      const selected =
        value === "removed"
          ? undefined
          : createElement(Body, {
              key: value === "replacement" ? "replacement" : "stable",
              identity: value,
            });
      return createElement(PhysicsWorld3D, {
        gravity: [0, 0, 0],
        sleeping: false,
        children: [
          createElement(CaptureWorld, {}),
          value === "reparented"
            ? createElement(Group3D, { children: selected })
            : selected,
        ],
      });
    };

    const runtime = mount(createElement(Scene, {}));
    flush(0);
    flush(1000 / 60);
    const controller = requirePhysicsWorld3DController(world);
    const counters =
      ownershipCountersPhysicsWorld3DControllerForTest(controller);
    const mounted = snapshotPhysicsWorld3DControllerForTest(controller);
    expect(mounted.kernel).toMatchObject({
      bodyCount: 1,
      colliderCount: 2,
      counters: { liveBodies: 1, liveColliders: 2, liveProxies: 2 },
    });

    update.set(1);
    flush((1000 / 60) * 2);
    expect(
      snapshotPhysicsWorld3DControllerForTest(controller).kernel.counters,
    ).toMatchObject({
      bodyAllocations: 1,
      bodyReleases: 0,
      colliderAllocations: 2,
      colliderReleases: 0,
    });

    mode.set("replacement");
    flush((1000 / 60) * 3);
    flush((1000 / 60) * 4);
    expect(
      snapshotPhysicsWorld3DControllerForTest(controller).kernel.counters,
    ).toMatchObject({
      liveBodies: 1,
      liveColliders: 2,
      liveProxies: 2,
      bodyAllocations: 2,
      bodyReleases: 1,
      colliderAllocations: 4,
      colliderReleases: 2,
    });

    mode.set("reparented");
    flush((1000 / 60) * 5);
    flush((1000 / 60) * 6);
    expect(
      snapshotPhysicsWorld3DControllerForTest(controller).kernel.counters,
    ).toMatchObject({
      liveBodies: 1,
      liveColliders: 2,
      liveProxies: 2,
      bodyAllocations: 3,
      bodyReleases: 2,
    });

    mode.set("removed");
    flush((1000 / 60) * 7);
    flush((1000 / 60) * 8);
    expect(
      snapshotPhysicsWorld3DControllerForTest(controller).kernel.counters,
    ).toMatchObject({ liveBodies: 0, liveColliders: 0, liveProxies: 0 });

    mode.set("plain");
    flush((1000 / 60) * 9);
    flush((1000 / 60) * 10);
    applyImpulse3D(body, [1, 0, 0]);
    expect(snapshotPhysicsWorld3DControllerForTest(controller)).toMatchObject({
      beginCommandQueued: false,
      kernel: { pendingCommandCount: 0, pendingTopology: false },
    });
    expect(snapshotRealmScheduler().queuedBeginCommands).toBe(1);

    runtime.dispose();
    mounts.delete(runtime);
    expect(driver.pendingHostFrames).toBe(0);
    expect(snapshotRealmScheduler()).toMatchObject({
      registeredAdvanceParticipants: 0,
      queuedBeginCommands: 0,
      queuedFrameCompletions: 0,
    });
    expect(counters).toMatchObject({
      liveBodyStores: 0,
      liveColliderStores: 0,
      liveBroadPhases: 0,
      liveContactCaches: 0,
      liveSolvers: 0,
      liveBodies: 0,
      liveColliders: 0,
      liveProxies: 0,
      liveContacts: 0,
    });
  });

  it("returns acquired runtime ownership to baseline when a later render fails", () => {
    const failing = signal(false);
    const failure = new Error("physics ownership failure probe");
    const shape = sphereShape3D({ radius: 0.5 });
    let world!: CRCPhysicsWorldHandle3D;
    const Capture = () => {
      world = crcPhysicsWorld3D();
      return undefined;
    };
    const ThrowAfterBody = () => {
      if (failing.get()) throw failure;
      return undefined;
    };
    const Scene = () =>
      createElement(PhysicsWorld3D, {
        gravity: [0, 0, 0],
        sleeping: false,
        children: [
          createElement(Capture, {}),
          createElement(Group3D, {
            physics: dynamicBody3D({ mass: 1, collider: shape }),
            children: undefined,
          }),
          createElement(ThrowAfterBody, {}),
        ],
      });
    const runtime = mount(createElement(Scene, {}));
    flush(0);
    flush(1000 / 60);
    const controller = requirePhysicsWorld3DController(world);
    const counters =
      ownershipCountersPhysicsWorld3DControllerForTest(controller);
    expect(counters).toMatchObject({
      liveBodies: 1,
      liveColliders: 1,
      liveProxies: 1,
    });

    failing.set(true);
    expect(() => flush((1000 / 60) * 2)).toThrow(failure);
    expect(counters).toMatchObject({
      liveBodyStores: 0,
      liveColliderStores: 0,
      liveBroadPhases: 0,
      liveContactCaches: 0,
      liveSolvers: 0,
      liveBodies: 0,
      liveColliders: 0,
      liveProxies: 0,
      liveContacts: 0,
    });
    runtime.dispose();
    mounts.delete(runtime);
    expect(driver.pendingHostFrames).toBe(0);
    expect(snapshotRealmScheduler()).toMatchObject({
      registeredAdvanceParticipants: 0,
      queuedBeginCommands: 0,
      queuedFrameCompletions: 0,
    });
  });

  it("creates no public records or handles for unobserved contact events", () => {
    let world!: CRCPhysicsWorldHandle3D;
    const Scene = () =>
      createElement(PhysicsWorld3D, {
        gravity: [0, 0, 0],
        fixedStepMilliseconds: 10,
        sleeping: false,
        children: [
          createElement(() => {
            world = crcPhysicsWorld3D();
            return undefined;
          }, {}),
          createElement(Group3D, {
            physics: dynamicBody3D({
              mass: 1,
              collider: {
                shape: sphereShape3D({ radius: 1 }),
                sensor: true,
              },
            }),
            children: undefined,
          }),
          createElement(Group3D, {
            physics: dynamicBody3D({
              collider: {
                shape: sphereShape3D({ radius: 1 }),
                offset: [1.5, 0, 0],
              },
              mass: 1,
            }),
            children: undefined,
          }),
        ],
      });

    mount(createElement(Scene, {}));
    flush(0);
    flush(0);
    flush(10);
    const unobservedController = requirePhysicsWorld3DController(world);
    expect(
      snapshotPhysicsWorld3DControllerForTest(unobservedController),
    ).toMatchObject({
      materializedBodyHandles: 0,
      materializedColliderHandles: 0,
    });
    expect(snapshotPhysicsEventMaterializationsForTest()).toBe(0);
  });

  it("materializes one observed public event and releases its Complete queue", () => {
    const received: unknown[] = [];
    const onOverlapStart = (event: unknown) => received.push(event);
    let world!: CRCPhysicsWorldHandle3D;
    const Scene = () =>
      createElement(PhysicsWorld3D, {
        gravity: [0, 0, 0],
        fixedStepMilliseconds: 10,
        sleeping: false,
        children: [
          createElement(() => {
            world = crcPhysicsWorld3D();
            return undefined;
          }, {}),
          createElement(Group3D, {
            physics: dynamicBody3D({
              mass: 1,
              collider: {
                shape: sphereShape3D({ radius: 1 }),
                sensor: true,
                onOverlapStart,
              },
            }),
            children: undefined,
          }),
          createElement(Group3D, {
            physics: dynamicBody3D({
              collider: {
                shape: sphereShape3D({ radius: 1 }),
                offset: [1.5, 0, 0],
              },
              mass: 1,
            }),
            children: undefined,
          }),
        ],
      });

    mount(createElement(Scene, {}));
    flush(0);
    flush(0);
    flush(10);
    const observedController = requirePhysicsWorld3DController(world);
    expect(
      snapshotPhysicsWorld3DControllerForTest(observedController).kernel,
    ).toMatchObject({
      tick: 1,
      contactCount: 1,
      counters: { contactEventFactWrites: 1 },
    });
    expect(received).toHaveLength(1);
    expect(
      snapshotPhysicsWorld3DControllerForTest(observedController),
    ).toMatchObject({
      kernel: { counters: { contactEventFactWrites: 1 } },
      materializedBodyHandles: 2,
      materializedColliderHandles: 2,
    });
    expect(snapshotPhysicsEventMaterializationsForTest()).toBe(1);
    expect(snapshotRealmScheduler().queuedFrameCompletions).toBe(0);
  });
});
