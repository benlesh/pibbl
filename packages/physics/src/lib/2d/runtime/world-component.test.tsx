import { Circle, Group, crc, type CRCController } from "@crc/core";
/** @jsxImportSource @crc/core */
import {
  PhysicsWorld2D,
  collider2D,
  crcPhysicsWorld2D,
  staticBody2D,
} from "../../../2d.js";
import { circleShape2D } from "../../../2d-geometry.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let callbacks: Map<number, FrameRequestCallback>;
let nextId: number;
const mounts: CRCController[] = [];

beforeEach(() => {
  document.body.innerHTML = "";
  callbacks = new Map();
  nextId = 0;
  vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(
    (callback) => {
      const id = ++nextId;
      callbacks.set(id, callback);
      return id;
    },
  );
  vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) => {
    callbacks.delete(id);
  });
});

afterEach(() => {
  for (const mount of mounts.splice(0)) mount.dispose();
  vi.restoreAllMocks();
});

describe("PhysicsWorld2D render scopes", () => {
  it("returns the nearest world handle to descendants and restores sibling scope", () => {
    const seen: unknown[] = [];
    const Child = () => {
      seen.push(crcPhysicsWorld2D());
      return undefined;
    };
    mount(
      <PhysicsWorld2D>
        <Child />
      </PhysicsWorld2D>,
    );
    flush(0);
    expect(seen).toHaveLength(1);
    expect(Object.isFrozen(seen[0])).toBe(true);

    const outside = mount(<Child />);
    expect(() => flush(1)).toThrow(/nearest PhysicsWorld2D/i);
    outside.dispose();
  });

  it("rejects same-dimension nested worlds and balances world scope after failure", () => {
    const nested = mount(
      <PhysicsWorld2D>
        <PhysicsWorld2D />
      </PhysicsWorld2D>,
    );
    expect(() => flush(0)).toThrow(/cannot be nested/i);
    nested.dispose();

    const seen: unknown[] = [];
    const Child = () => {
      seen.push(crcPhysicsWorld2D());
      return undefined;
    };
    mount(
      <PhysicsWorld2D>
        <Child />
      </PhysicsWorld2D>,
    );
    flush(1);
    expect(seen).toHaveLength(1);
  });

  it("requires a nearest body for collider-only attachments and accepts its descendant scope", () => {
    const shape = circleShape2D({ radius: 1 });
    const invalid = mount(
      <PhysicsWorld2D>
        <Circle physics={collider2D({ shape })} style={{ radius: 1 }} />
      </PhysicsWorld2D>,
    );
    expect(() => flush(0)).toThrow(/collider2D.*nearest.*body/i);
    invalid.dispose();

    mount(
      <PhysicsWorld2D>
        <Group physics={staticBody2D({ collider: false })}>
          <Circle physics={collider2D({ shape })} style={{ radius: 1 }} />
        </Group>
      </PhysicsWorld2D>,
    );
    expect(() => flush(1)).not.toThrow();
  });
});

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

function flush(time: number): void {
  const entry = callbacks.entries().next().value as
    readonly [number, FrameRequestCallback] | undefined;
  if (!entry) throw new Error("No CRC host frame is pending.");
  callbacks.delete(entry[0]);
  entry[1](time);
}
