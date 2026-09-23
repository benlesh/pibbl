import { crc, signal, type CRCController, type CRCNode } from "@crc/core";
import { Group3D, WebGLLayer } from "@crc/webgl";
/** @jsxImportSource @crc/core */
import {
  PhysicsWorld3D,
  applyForce3D,
  applyImpulse3D,
  applyTorque3D,
  crcPhysicsBody3D,
  crcPhysicsWorld3D,
  disableBody3D,
  dynamicBody3D,
  enableBody3D,
  setAngularVelocity3D,
  setLinearVelocity3D,
  sleepBody3D,
  teleportBody3D,
  wakeBody3D,
  type CRCPhysicsBodyHandle3D,
  type CRCPhysicsWorldHandle3D,
} from "../../../3d.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { snapshotPhysicsBodyHandle3DForTest } from "./body-handle.js";
import {
  createPhysicsBodyHandle3D,
  physicsBodyHandleBinding3D,
} from "./body-handle.js";
import {
  requirePhysicsWorld3DController,
  snapshotPhysicsWorld3DControllerForTest,
} from "./controller.js";
import { requirePhysicsAttachment3DDescriptor } from "./descriptors.js";

let frames: ManualFrames;
const mounts: CRCController[] = [];

beforeEach(() => {
  document.body.innerHTML = "";
  frames = new ManualFrames();
  frames.install();
});

afterEach(() => {
  for (const mount of mounts.splice(0)) mount.dispose();
  vi.restoreAllMocks();
});

describe("3D physics body handles", () => {
  it("does not leak an earlier handle when a later initial binding conflicts across worlds", () => {
    // Production break caught: binding bodies during Array.map leaves an
    // earlier handle attached when a later cross-world binding throws.
    const free = createPhysicsBodyHandle3D({} as never);
    const shared = createPhysicsBodyHandle3D({} as never);
    let firstWorld!: CRCPhysicsWorldHandle3D;
    const First = () => {
      firstWorld = crcPhysicsWorld3D();
      return <Group3D physics={dynamicBody3D({
        handle: shared,
        collider: false,
        mass: 1,
      })} />;
    };
    mountWebGL(<PhysicsWorld3D gravity={[0, 0, 0]}><First /></PhysicsWorld3D>);
    frames.flush(0);
    frames.flush(0);
    const foreign = requirePhysicsWorld3DController(firstWorld);
    expect(physicsBodyHandleBinding3D(shared)?.controller).toBe(foreign);
    expect(physicsBodyHandleBinding3D(free)).toBeUndefined();

    mountWebGL(
      <PhysicsWorld3D gravity={[0, 0, 0]}>
        <Group3D physics={dynamicBody3D({ handle: free, collider: false, mass: 1 })} />
        <Group3D physics={dynamicBody3D({ handle: shared, collider: false, mass: 1 })} />
      </PhysicsWorld3D>,
    );
    expect(() => frames.flush(1)).toThrow(/at most one live body/i);
    expect(physicsBodyHandleBinding3D(free)).toBeUndefined();
    expect(physicsBodyHandleBinding3D(shared)?.controller).toBe(foreign);
  });

  it("keeps old bindings and avoids partial new bindings when a rerender conflicts across worlds", () => {
    // Production break caught: rerender finalization unbinds the accepted
    // handle and binds an earlier replacement before discovering a later
    // cross-world conflict.
    const old = createPhysicsBodyHandle3D({} as never);
    const free = createPhysicsBodyHandle3D({} as never);
    const shared = createPhysicsBodyHandle3D({} as never);
    let firstWorld!: CRCPhysicsWorldHandle3D;
    let secondWorld!: CRCPhysicsWorldHandle3D;
    const First = () => {
      firstWorld = crcPhysicsWorld3D();
      return <Group3D physics={dynamicBody3D({
        handle: shared,
        collider: false,
        mass: 1,
      })} />;
    };
    const Second = () => {
      secondWorld = crcPhysicsWorld3D();
      return [
        <Group3D key="first" physics={dynamicBody3D({
          handle: old,
          collider: false,
          mass: 1,
        })} />,
        <Group3D key="second" physics={dynamicBody3D({
          collider: false,
          mass: 1,
        })} />,
      ];
    };
    mountWebGL(<PhysicsWorld3D gravity={[0, 0, 0]}><First /></PhysicsWorld3D>);
    mountWebGL(<PhysicsWorld3D gravity={[0, 0, 0]}><Second /></PhysicsWorld3D>);
    frames.flush(0);
    frames.flush(0);
    const accepted = physicsBodyHandleBinding3D(old);
    const secondController = requirePhysicsWorld3DController(secondWorld);
    expect(accepted?.controller).toBe(secondController);
    const probe = secondController as unknown as BindingFinalizationProbe3D;
    const [firstBody, secondBody] = probe.acceptedBodies;
    probe.draft = {
      configuration: probe.acceptedConfiguration,
      props: probe.acceptedProps,
      bodies: new Map([
        [firstBody!.id, {
          ...firstBody!,
          descriptor: requirePhysicsAttachment3DDescriptor(dynamicBody3D({
            handle: free,
            collider: false,
            mass: 1,
          })),
        }],
        [secondBody!.id, {
          ...secondBody!,
          descriptor: requirePhysicsAttachment3DDescriptor(dynamicBody3D({
            handle: shared,
            collider: false,
            mass: 1,
          })),
        }],
      ]),
      colliders: new Map(),
    };
    expect(() => probe.finishRender(true)).toThrow(/at most one live body/i);
    expect(physicsBodyHandleBinding3D(old)).toEqual(accepted);
    expect(physicsBodyHandleBinding3D(free)).toBeUndefined();
    expect(physicsBodyHandleBinding3D(shared)?.controller).toBe(
      requirePhysicsWorld3DController(firstWorld),
    );
  });

  it("keeps one hook shell stable and materializes readonly signals lazily", () => {
    const seen: CRCPhysicsBodyHandle3D[] = [];
    const rerender = signal(0);
    const Body = () => {
      rerender.get();
      const handle = crcPhysicsBody3D();
      seen.push(handle);
      return <Group3D physics={dynamicBody3D({ handle, collider: false, mass: 1 })} />;
    };
    mountWebGL(<PhysicsWorld3D gravity={[0, 0, 0]}><Body /></PhysicsWorld3D>);
    frames.flush(0);
    expect(snapshotPhysicsBodyHandle3DForTest(seen[0]!)).toMatchObject({
      bound: true,
      materializedFields: [],
    });
    expect(seen[0]!.position.get()).toEqual([0, 0, 0]);
    expect(snapshotPhysicsBodyHandle3DForTest(seen[0]!)).toMatchObject({
      materializedFields: ["position"],
    });
    rerender.set(1);
    frames.flush(1);
    expect(seen.at(-1)).toBe(seen[0]);
  });

  it("snapshots caller arrays and applies Begin commands in invocation order", () => {
    let body!: CRCPhysicsBodyHandle3D;
    let world!: CRCPhysicsWorldHandle3D;
    const Body = () => {
      body = crcPhysicsBody3D();
      world = crcPhysicsWorld3D();
      return <Group3D physics={dynamicBody3D({ handle: body, collider: false, mass: 1 })} />;
    };
    mountWebGL(
      <PhysicsWorld3D gravity={[0, 0, 0]} fixedStepMilliseconds={100}>
        <Body />
      </PhysicsWorld3D>,
    );
    frames.flush(0);
    frames.flush(0);

    const velocity: [number, number, number] = [2, 3, 4];
    const orientation: [number, number, number, number] = [0, 0, 0, 2];
    setLinearVelocity3D(body, [1, 1, 1]);
    setLinearVelocity3D(body, velocity);
    setAngularVelocity3D(body, [10, 20, 30]);
    teleportBody3D(body, { position: [4, 5, 6], orientation });
    applyForce3D(body, [0, 0, 0], { at: [1, 2, 3] });
    applyImpulse3D(body, [0, 0, 0]);
    applyTorque3D(body, [0, 0, 0]);
    velocity[0] = 200;
    orientation[3] = 1;

    frames.flush(1);
    const state = snapshot(world).kernel.bodies[0]!;
    expect(state).toMatchObject({
      positionX: 4,
      positionY: 5,
      positionZ: 6,
      linearVelocityX: 2,
      linearVelocityY: 3,
      linearVelocityZ: 4,
      angularVelocityX: (10 * Math.PI) / 180,
      angularVelocityY: (20 * Math.PI) / 180,
      angularVelocityZ: (30 * Math.PI) / 180,
      orientationW: 1,
    });
  });

  it("makes removed generations inert and increments a reused handle binding", () => {
    const shown = signal(true);
    let body!: CRCPhysicsBodyHandle3D;
    let world!: CRCPhysicsWorldHandle3D;
    const Body = () => {
      body = crcPhysicsBody3D();
      world = crcPhysicsWorld3D();
      return shown.get()
        ? <Group3D physics={dynamicBody3D({ handle: body, collider: false, mass: 1 })} />
        : undefined;
    };
    mountWebGL(<PhysicsWorld3D gravity={[0, 0, 0]}><Body /></PhysicsWorld3D>);
    frames.flush(0);
    frames.flush(0);
    const firstGeneration = snapshotPhysicsBodyHandle3DForTest(body).bindingGeneration;

    shown.set(false);
    setLinearVelocity3D(body, [99, 0, 0]);
    frames.flush(1);
    frames.flush(1);
    expect(snapshot(world).kernel.bodyCount).toBe(0);

    shown.set(true);
    frames.flush(2);
    frames.flush(2);
    expect(snapshotPhysicsBodyHandle3DForTest(body).bindingGeneration).toBe(
      firstGeneration + 1,
    );
    expect(snapshot(world).kernel.bodies[0]!.linearVelocityX).toBe(0);
  });

  it("supports explicit sleep, wake, disable, and enable restoration commands", () => {
    let body!: CRCPhysicsBodyHandle3D;
    let world!: CRCPhysicsWorldHandle3D;
    const Body = () => {
      body = crcPhysicsBody3D();
      world = crcPhysicsWorld3D();
      return <Group3D physics={dynamicBody3D({ handle: body, collider: false, mass: 1 })} />;
    };
    mountWebGL(<PhysicsWorld3D gravity={[0, 0, 0]}><Body /></PhysicsWorld3D>);
    frames.flush(0);
    frames.flush(0);
    sleepBody3D(body);
    frames.flush(1);
    wakeBody3D(body);
    disableBody3D(body);
    enableBody3D(body, { velocity: "preserve" });
    frames.flush(2);
    expect(snapshot(world).kernel.bodyCount).toBe(1);
  });
});

interface BindingFinalizationProbe3D {
  readonly acceptedBodies: readonly Readonly<{
    readonly id: number;
    readonly attachment: unknown;
    readonly descriptor: unknown;
    readonly initialPose: unknown;
    readonly handleBindingGeneration: number | undefined;
  }>[];
  readonly acceptedConfiguration: unknown;
  readonly acceptedProps: unknown;
  draft: unknown;
  finishRender(success: boolean): void;
}

function snapshot(world: CRCPhysicsWorldHandle3D) {
  return snapshotPhysicsWorld3DControllerForTest(
    requirePhysicsWorld3DController(world),
  );
}

function mountWebGL(children: CRCNode): CRCController {
  const canvas = document.createElement("canvas");
  canvas.width = 100;
  canvas.height = 100;
  canvas.style.cssText = "display:block;width:100px;height:100px";
  document.body.appendChild(canvas);
  const mount = crc(
    canvas,
    <WebGLLayer style={{ width: 100, height: 100 }}>{children}</WebGLLayer>,
  );
  mounts.push(mount);
  return mount;
}

class ManualFrames {
  private callbacks = new Map<number, FrameRequestCallback>();
  private nextId = 0;

  install(): void {
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
      const id = ++this.nextId;
      this.callbacks.set(id, callback);
      return id;
    });
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) => {
      this.callbacks.delete(id);
    });
  }

  flush(time: number): void {
    const entry = this.callbacks.entries().next().value as
      | readonly [number, FrameRequestCallback]
      | undefined;
    if (!entry) throw new Error("No CRC host frame is pending.");
    this.callbacks.delete(entry[0]);
    entry[1](time);
  }
}
