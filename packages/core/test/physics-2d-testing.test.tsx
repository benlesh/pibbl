/** @jsxImportSource @crc/core */
import { Circle, Group, crc, signal } from "@crc/core";
import {
  PhysicsWorld2D,
  collider2D,
  crcPhysicsBody2D,
  dynamicBody2D,
  kinematicBody2D,
  type CRCPhysicsBodyHandle2D,
} from "@crc/core/physics/2d";
import { createPhysicsTestHarness2D } from "@crc/core/physics/2d/testing";
import { describe, expect, it } from "vitest";

describe("public physics 2D test harness", () => {
  it("mounts through the public surface and advances host frames deterministically", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 100;
    document.body.append(canvas);
    let body!: CRCPhysicsBodyHandle2D;
    const harness = createPhysicsTestHarness2D({
      canvas,
      root: () => <Ball />,
      observe: () => ({
        position: body.position.get(),
        sleeping: body.sleeping.get(),
      }),
    });

    function Ball() {
      body = crcPhysicsBody2D();
      return (
        <PhysicsWorld2D gravity={[0, 600]}>
          <Group
            physics={dynamicBody2D({ handle: body, collider: false, mass: 1 })}
            style={{ translateX: 40, translateY: 10 }}
          >
            <Circle physics={collider2D()} style={{ radius: 4 }} />
          </Group>
        </PhysicsWorld2D>
      );
    }

    try {
      expect(harness.pendingFrames).toBe(1);
      expect(harness.flush()).toBe(true);
      const before = harness.observe();
      expect(harness.advanceFrames(6)).toBe(6);
      expect(harness.observe().position[1]).toBeGreaterThan(before.position[1]);
      expect(harness.observe().sleeping).toBe(false);
    } finally {
      harness.dispose();
      expect(canvas.isConnected).toBe(true);
      canvas.remove();
    }
  });

  it("flushes state actions without advancing host time and reset remounts a fresh root", () => {
    const canvas = document.createElement("canvas");
    document.body.append(canvas);
    const target = signal<readonly [number, number]>([10, 10]);
    let body!: CRCPhysicsBodyHandle2D;
    let renders = 0;
    const harness = createPhysicsTestHarness2D({
      canvas,
      root: () => <Platform />,
      observe: () => body.position.get(),
    });

    function Platform() {
      renders++;
      body = crcPhysicsBody2D();
      return (
        <PhysicsWorld2D gravity={[0, 0]}>
          <Group
            physics={kinematicBody2D({
              handle: body,
              collider: false,
              target: { position: target },
            })}
            style={{ translateX: 10, translateY: 10 }}
          >
            <Circle physics={collider2D()} style={{ radius: 4 }} />
          </Group>
        </PhysicsWorld2D>
      );
    }

    try {
      harness.flush();
      expect(harness.act(() => target.set([30, 10]))).toBeUndefined();
      expect(harness.observe()).toEqual([10, 10]);
      harness.advanceFrames(1);
      expect(harness.observe()).toEqual([30, 10]);
      harness.reset();
      expect(harness.pendingFrames).toBe(1);
      harness.flush();
      expect(renders).toBe(3);
      harness.act(() => target.set([40, 10]));
      harness.advanceFrames(1);
      expect(harness.observe()).toEqual([40, 10]);
    } finally {
      harness.dispose();
      canvas.remove();
    }
  });

  it("refuses to take over a realm that already has a CRC root", () => {
    const canvas = document.createElement("canvas");
    const occupied = document.createElement("canvas");
    document.body.append(canvas, occupied);
    const mount = crc(occupied, <Circle style={{ cx: 4, cy: 4, radius: 2 }} />);
    try {
      expect(() =>
        createPhysicsTestHarness2D({
          canvas,
          root: () => <PhysicsWorld2D />,
          observe: () => null,
        }),
      ).toThrow("isolated CRC realm");
    } finally {
      mount.dispose();
      canvas.remove();
      occupied.remove();
    }
  });

  it("releases the scheduler after a failed reset", () => {
    const canvas = document.createElement("canvas");
    document.body.append(canvas);
    let failReset = false;
    const harness = createPhysicsTestHarness2D({
      canvas,
      root: () => {
        if (failReset) throw new Error("reset root failed");
        return <Circle style={{ cx: 4, cy: 4, radius: 2 }} />;
      },
      observe: () => "live",
    });
    try {
      harness.flush();
      failReset = true;
      expect(() => harness.reset()).toThrow("reset root failed");
      expect(() => harness.observe()).toThrow("has been disposed");

      failReset = false;
      const replacement = createPhysicsTestHarness2D({
        canvas,
        root: () => <Circle style={{ cx: 4, cy: 4, radius: 2 }} />,
        observe: () => "replacement",
      });
      replacement.dispose();
    } finally {
      harness.dispose();
      canvas.remove();
    }
  });
});
