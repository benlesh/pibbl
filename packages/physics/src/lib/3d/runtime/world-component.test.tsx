import { crc, signal, type CRCController, type CRCNode } from "@crc/core";
import { Cube, Group3D, WebGLLayer } from "@crc/webgl";
import {
  PhysicsWorld3D,
  collider3D,
  crcPhysicsWorld3D,
  dynamicBody3D,
  staticBody3D,
  type CRCPhysicsWorldHandle3D,
} from "../../../3d.js";
import { boxShape3D } from "../../../3d-geometry.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PhysicsWorld3DKernel } from "../world/world.js";
import {
  requirePhysicsWorld3DController,
  snapshotPhysicsWorld3DControllerForTest,
} from "./controller.js";

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

describe("PhysicsWorld3D render scopes", () => {
  it("requires the active WebGL island before acquiring a world", () => {
    const disposeKernel = vi.spyOn(PhysicsWorld3DKernel.prototype, "dispose");
    const invalid = mount(<PhysicsWorld3D />);
    expect(() => frames.flush(0)).toThrow(/backend environment.*not active/i);
    expect(disposeKernel).not.toHaveBeenCalled();
    invalid.dispose();
  });

  it("rejects invalid world props before acquiring kernel resources", () => {
    // Production break caught: validating after kernel construction acquires
    // stores and solver resources for a world that can never mount.
    const disposeKernel = vi.spyOn(PhysicsWorld3DKernel.prototype, "dispose");
    const invalid = mountWebGL(<PhysicsWorld3D gravity={[0, NaN, 0]} />);
    expect(() => frames.flush(0)).toThrow(/gravity.*finite/i);
    expect(disposeKernel).not.toHaveBeenCalled();
    invalid.dispose();
  });

  it("returns the nearest handle and rejects nesting without poisoning scope", () => {
    const disposeKernel = vi.spyOn(PhysicsWorld3DKernel.prototype, "dispose");
    const nested = mountWebGL(
      <PhysicsWorld3D><PhysicsWorld3D /></PhysicsWorld3D>,
    );
    expect(() => frames.flush(0)).toThrow(/cannot be nested/i);
    expect(disposeKernel).toHaveBeenCalledOnce();
    nested.dispose();

    const seen: CRCPhysicsWorldHandle3D[] = [];
    const Capture = () => {
      seen.push(crcPhysicsWorld3D());
      return undefined;
    };
    mountWebGL(<PhysicsWorld3D><Capture /></PhysicsWorld3D>);
    frames.flush(1);
    expect(seen).toHaveLength(1);
    expect(Object.isFrozen(seen[0])).toBe(true);
  });

  it("requires a nearest body for collider-only attachments", () => {
    const shape = boxShape3D({ width: 1, height: 1, depth: 1 });
    const invalid = mountWebGL(
      <PhysicsWorld3D><Cube physics={collider3D({ shape })} /></PhysicsWorld3D>,
    );
    expect(() => frames.flush(0)).toThrow(/collider3D.*nearest.*body/i);
    invalid.dispose();

    mountWebGL(
      <PhysicsWorld3D>
        <Group3D physics={staticBody3D({ collider: false })}>
          <Cube physics={collider3D({ shape })} />
        </Group3D>
      </PhysicsWorld3D>,
    );
    expect(() => frames.flush(1)).not.toThrow();
  });

  it("retains attachment-slot identity across recreated descriptors and keeps self Group3D body-only", () => {
    const version = signal(0);
    let world!: CRCPhysicsWorldHandle3D;
    const Scene = () => {
      version.get();
      world = crcPhysicsWorld3D();
      return <Group3D physics={dynamicBody3D({ mass: 1 })} />;
    };
    mountWebGL(<PhysicsWorld3D gravity={[0, 0, 0]}><Scene /></PhysicsWorld3D>);
    frames.flush(0);
    frames.flush(0);
    const first = snapshot(world);
    expect(first.bodyIds).toHaveLength(1);
    expect(first.colliderIds).toEqual([]);
    const generation = first.kernel.bodies[0]!.generation;

    version.set(1);
    frames.flush(1);
    const second = snapshot(world);
    expect(second.bodyIds).toEqual(first.bodyIds);
    expect(second.colliderIds).toEqual([]);
    expect(second.kernel.bodies[0]!.generation).toBe(generation);
  });
});

function snapshot(world: CRCPhysicsWorldHandle3D) {
  return snapshotPhysicsWorld3DControllerForTest(
    requirePhysicsWorld3DController(world),
  );
}

function mountWebGL(children: CRCNode): CRCController {
  return mount(
    <WebGLLayer style={{ width: 100, height: 100 }}>{children}</WebGLLayer>,
  );
}

function mount(root: Parameters<typeof crc>[1]): CRCController {
  const canvas = document.createElement("canvas");
  canvas.width = 100;
  canvas.height = 100;
  canvas.style.cssText = "display:block;width:100px;height:100px";
  document.body.appendChild(canvas);
  const controller = crc(canvas, root);
  mounts.push(controller);
  return controller;
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
