import { displacement, opacity } from "@pibbl/core/filters";
import { Circle, Group, Rectangle, pibbl, defineTexture, signal, useTexture, type PibblController } from "@pibbl/core";
/** @jsxImportSource @pibbl/core */
import {
  PhysicsWorld2D,
  applyImpulse2D,
  collider2D,
  pibblPhysicsBody2D,
  pibblPhysicsWorld2D,
  disableBody2D,
  dynamicBody2D,
  enableBody2D,
  kinematicBody2D,
  queryPoint2D,
  setLinearVelocity2D,
  staticBody2D,
  teleportBody2D,
  type PibblPhysicsWorldHandle2D,
} from "../../../2d.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  requirePhysicsWorld2DController,
  snapshotPhysicsWorld2DControllerForTest,
} from "../runtime/controller.js";
import {
  bodyLocalTransformFromPrimitive2D,
  captureBodyPresentation2D,
  resolveDynamicPresentationTransform2D,
} from "./presentation.js";

describe("Canvas 2D physics pose presentation", () => {
  const mounts: PibblController[] = [];

  afterEach(() => {
    for (const mount of mounts.splice(0)) mount.dispose();
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it("includes primitive left/top placement in the body-local presentation transform", () => {
    expect(
      matrix(
        bodyLocalTransformFromPrimitive2D(Rectangle, { left: 12, top: 18 }),
      ),
    ).toEqual([1, 0, 0, 1, 12, 18]);
    expect(
      matrix(
        bodyLocalTransformFromPrimitive2D(Group, {
          left: 12,
          top: 18,
          translateX: 4,
          translateY: 6,
        }),
      ),
    ).toEqual([1, 0, 0, 1, 16, 24]);
  });

  it("presents committed dynamic motion through filters and coordinate targeting", () => {
    const frames = new ManualFrames();
    frames.install();
    let world!: PibblPhysicsWorldHandle2D;
    const clicks: string[] = [];
    const Capture = () => {
      world = pibblPhysicsWorld2D();
    };
    const root = (translateX = 10) => (
      <PhysicsWorld2D>
        <Capture />
        <Group
          physics={dynamicBody2D({ collider: false })}
          style={{ translateX }}
        >
          <Rectangle
            physics={collider2D()}
            style={{
              left: 5,
              top: 5,
              width: 10,
              height: 10,
              fill: "#2563eb",
              filter: opacity({ amount: 1 }),
            }}
            onClick={() => clicks.push("hit")}
          />
        </Group>
      </PhysicsWorld2D>
    );
    const canvas = document.createElement("canvas");
    canvas.width = 70;
    canvas.height = 30;
    document.body.appendChild(canvas);
    mounts.push(pibbl(canvas, root()));
    frames.flush(0);
    expect(pixelAt(canvas, 17, 8)).toEqual([37, 99, 235, 255]);

    frames.flush(1);
    const controller = requirePhysicsWorld2DController(world);
    const bodyId =
      snapshotPhysicsWorld2DControllerForTest(controller).bodyIds[0]!;
    controller.queueCommands([
      {
        kind: "set-pose",
        bodyId,
        pose: { position: [30, 0], rotationDegrees: 0 },
      },
    ]);
    frames.flush(2);
    expect(pixelAt(canvas, 37, 8)).toEqual([37, 99, 235, 255]);
    expect(pixelAt(canvas, 17, 8)).toEqual([0, 0, 0, 0]);
    click(canvas, 37, 8);
    click(canvas, 17, 8);
    expect(clicks).toEqual(["hit"]);

    pibbl(canvas, root(11));
    expect(() => frames.flush(3)).toThrow(/ancestor transform|authored pose/i);
  });

  it("keeps physics pose, velocity and targeting unchanged when visible displacement is enabled", () => {
    const frames = new ManualFrames(); frames.install();
    const strength = signal(0);
    let body!: ReturnType<typeof pibblPhysicsBody2D>;
    let clicks = 0;
    const mapRecipe = defineTexture({
      create() {},
      rasterize(_state, { canvas }) {
        const c = canvas.getContext("2d")!;
        c.fillStyle = "rgb(255 128 128)"; c.fillRect(0, 0, canvas.width, canvas.height);
      },
    });
    function Effect() {
      body = pibblPhysicsBody2D();
      const map = useTexture(mapRecipe({}), { resolution: { width: 8, height: 8 } });
      return <Group style={{ filter: displacement({ map, strength, region: { x: 0, y: 0, width: 70, height: 40 } }) }}>
        <Circle physics={dynamicBody2D({ handle: body, mass: 1 })} style={{ cx: 20, cy: 20, radius: 5, fill: "#2563eb" }} onClick={() => clicks++} />
      </Group>;
    }
    const canvas = document.createElement("canvas"); canvas.width = 70; canvas.height = 40; document.body.append(canvas);
    mounts.push(pibbl(canvas, <PhysicsWorld2D gravity={[0, 0]} fixedStepMilliseconds={100}><Effect /></PhysicsWorld2D>));
    frames.flush(0); frames.flush(0);
    setLinearVelocity2D(body, [100, 0]); frames.flush(100);
    const pose = [...body.position.get()], velocity = [...body.linearVelocity.get()];
    expect(pose[0]).toBeCloseTo(10, 5);
    expect(pixelAt(canvas, 23, 20)[3]).toBeGreaterThan(200);
    click(canvas, 23, 20); expect(clicks).toBe(1);
    strength.set(6); frames.flush(100);
    expect(body.position.get()).toEqual(pose); expect(body.linearVelocity.get()).toEqual(velocity);
    expect(pixelAt(canvas, 11, 20)[3]).toBeGreaterThan(200);
    expect(pixelAt(canvas, 23, 20)[3]).toBe(0);
    click(canvas, 11, 20); expect(clicks).toBe(1);
    click(canvas, 23, 20); expect(clicks).toBe(2);
    frames.flush(200);
    expect(body.position.get()[0]).toBeCloseTo(20, 5);
    expect(body.linearVelocity.get()).toEqual(velocity);
  });

  it("moves a dynamic primitive when its Canvas click applies an impulse", () => {
    const frames = new ManualFrames();
    frames.install();
    let body!: ReturnType<typeof pibblPhysicsBody2D>;
    let clickCount = 0;
    const Ball = () => {
      body = pibblPhysicsBody2D();
      return (
        <Circle
          physics={dynamicBody2D({ handle: body, mass: 1 })}
          style={{ cx: 20, cy: 20, radius: 5, fill: "#2563eb" }}
          onClick={() => {
            clickCount += 1;
            applyImpulse2D(body, [100, 0]);
          }}
        />
      );
    };
    const canvas = document.createElement("canvas");
    canvas.width = 60;
    canvas.height = 40;
    document.body.appendChild(canvas);
    mounts.push(
      pibbl(
        canvas,
        <PhysicsWorld2D gravity={[0, 0]} fixedStepMilliseconds={100}>
          <Ball />
        </PhysicsWorld2D>,
      ),
    );
    frames.flush(0);
    frames.flush(0);

    expect(pixelAt(canvas, 20, 20)).toEqual([37, 99, 235, 255]);
    click(canvas, 20, 20);
    expect(clickCount).toBe(1);
    frames.flush(100);

    expect(body.position.get()[0]).toBeCloseTo(10, 5);
    expect(body.position.get()[1]).toBe(0);
    expect(body.linearVelocity.get()).toEqual([100, 0]);
    frames.flush(200);

    expect(pixelAt(canvas, 30, 20)).toEqual([37, 99, 235, 255]);
    expect(pixelAt(canvas, 15, 20)).toEqual([0, 0, 0, 0]);
  });

  it("advances a dynamic primitive under its world gravity", () => {
    const frames = new ManualFrames();
    frames.install();
    let body!: ReturnType<typeof pibblPhysicsBody2D>;
    const Ball = () => {
      body = pibblPhysicsBody2D();
      return (
        <Circle
          physics={dynamicBody2D({ handle: body, mass: 1 })}
          style={{ cx: 20, cy: 10, radius: 5, fill: "#2563eb" }}
        />
      );
    };
    const canvas = document.createElement("canvas");
    canvas.width = 40;
    canvas.height = 40;
    document.body.appendChild(canvas);
    mounts.push(
      pibbl(
        canvas,
        <PhysicsWorld2D gravity={[0, 10]} fixedStepMilliseconds={100}>
          <Ball />
        </PhysicsWorld2D>,
      ),
    );
    frames.flush(0);
    frames.flush(0);
    frames.flush(100);
    frames.flush(200);

    expect(body.position.get()[0]).toBe(0);
    // Rapier integrates four internal substeps per accepted tick.
    expect(body.position.get()[1]).toBeCloseTo(0.225, 5);
    expect(body.linearVelocity.get()[0]).toBe(0);
    expect(body.linearVelocity.get()[1]).toBeCloseTo(2, 5);
  });

  it("applies world gravity updates to an existing dynamic primitive", () => {
    const frames = new ManualFrames();
    frames.install();
    let body!: ReturnType<typeof pibblPhysicsBody2D>;
    const Ball = () => {
      body = pibblPhysicsBody2D();
      return (
        <Circle
          physics={dynamicBody2D({ handle: body, mass: 1 })}
          style={{ cx: 20, cy: 10, radius: 5, fill: "#2563eb" }}
        />
      );
    };
    const root = (gravityY: number) => (
      <PhysicsWorld2D gravity={[0, gravityY]} fixedStepMilliseconds={100}>
        <Ball />
      </PhysicsWorld2D>
    );
    const canvas = document.createElement("canvas");
    canvas.width = 40;
    canvas.height = 40;
    document.body.appendChild(canvas);
    mounts.push(pibbl(canvas, root(0)));
    frames.flush(0);
    frames.flush(0);
    frames.flush(100);

    pibbl(canvas, root(20));
    frames.flush(200);
    frames.flush(300);

    expect(body.position.get()[0]).toBe(0);
    expect(body.position.get()[1]).toBeCloseTo(0.125, 5);
    expect(body.linearVelocity.get()[0]).toBe(0);
    expect(body.linearVelocity.get()[1]).toBeCloseTo(2, 5);
  });

  it("settles an inferred Circle body on an inferred Rectangle body", () => {
    const frames = new ManualFrames();
    frames.install();
    let body!: ReturnType<typeof pibblPhysicsBody2D>;
    const Ball = () => {
      body = pibblPhysicsBody2D();
      return (
        <Circle
          physics={dynamicBody2D({ handle: body, mass: 1 })}
          style={{ cx: 20, cy: 10, radius: 5, fill: "#2563eb" }}
        />
      );
    };
    const canvas = document.createElement("canvas");
    canvas.width = 40;
    canvas.height = 40;
    document.body.appendChild(canvas);
    mounts.push(
      pibbl(
        canvas,
        <PhysicsWorld2D gravity={[0, 10]} fixedStepMilliseconds={100}>
          <Rectangle
            physics={staticBody2D()}
            style={{ left: 0, top: 30, width: 40, height: 5, fill: "#334155" }}
          />
          <Ball />
        </PhysicsWorld2D>,
      ),
    );
    frames.flush(0);
    frames.flush(0);
    for (let milliseconds = 100; milliseconds <= 3000; milliseconds += 100) {
      frames.flush(milliseconds);
      if (body.sleeping.get()) break;
    }

    expect(body.position.get()[1]).toBeCloseTo(15, 1);
    expect(body.linearVelocity.get()[1]).toBeCloseTo(0, 1);
  });

  it("keeps the learning-example ball bounded before and after its impulse", () => {
    const frames = new ManualFrames();
    frames.install();
    let body!: ReturnType<typeof pibblPhysicsBody2D>;
    const Ball = () => {
      body = pibblPhysicsBody2D();
      return (
        <Circle
          physics={dynamicBody2D({
            handle: body,
            mass: 1,
            collider: { restitution: 0.35 },
          })}
          style={{ cx: 210, cy: 110, radius: 28, fill: "#2563eb" }}
        />
      );
    };
    const canvas = document.createElement("canvas");
    canvas.width = 720;
    canvas.height = 420;
    document.body.appendChild(canvas);
    mounts.push(
      pibbl(
        canvas,
        <PhysicsWorld2D gravity={[0, 560]} fixedStepMilliseconds={1000 / 60}>
          <Rectangle
            physics={staticBody2D({ collider: { friction: 0.8 } })}
            style={{
              left: 72,
              top: 316,
              width: 576,
              height: 34,
              fill: "#334155",
            }}
          />
          <Group physics={staticBody2D({ collider: false })}>
            <Rectangle
              physics={collider2D({ sensor: true })}
              pointerEvents="none"
              style={{ left: 164, top: 304, width: 92, height: 12 }}
            />
          </Group>
          <Ball />
        </PhysicsWorld2D>,
      ),
    );
    frames.flush(0);
    frames.flush(0);
    for (let frame = 1; frame <= 300; frame += 1) {
      frames.flush((frame * 1000) / 60);
      if (body.sleeping.get()) break;
    }

    const position = body.position.get();
    const rotation = (body.rotationDegrees.get() * Math.PI) / 180;
    const centerX =
      position[0] + Math.cos(rotation) * 210 - Math.sin(rotation) * 110;
    const centerY =
      position[1] + Math.sin(rotation) * 210 + Math.cos(rotation) * 110;
    expect(centerX).toBeCloseTo(210, 1);
    expect(centerY).toBeCloseTo(288, 0);
    expect(Math.abs(body.linearVelocity.get()[1])).toBeLessThan(3);

    applyImpulse2D(body, [45, -120]);
    frames.flush((301 * 1000) / 60);
    expect(body.linearVelocity.get()[0]).toBeGreaterThan(40);
    expect(body.linearVelocity.get()[1]).toBeLessThan(-100);

    for (let frame = 302; frame <= 600; frame += 1) {
      frames.flush((frame * 1000) / 60);
    }
    const returnedPosition = body.position.get();
    const returnedRotation = (body.rotationDegrees.get() * Math.PI) / 180;
    const returnedCenterX =
      returnedPosition[0] +
      Math.cos(returnedRotation) * 210 -
      Math.sin(returnedRotation) * 110;
    const returnedCenterY =
      returnedPosition[1] +
      Math.sin(returnedRotation) * 210 +
      Math.cos(returnedRotation) * 110;
    expect(returnedCenterX).toBeGreaterThan(210);
    expect(returnedCenterX).toBeLessThan(648);
    expect(returnedCenterY).toBeCloseTo(288, 0);
  });

  it("keeps a released translated Group collider aligned with its painted ball through a wall", () => {
    const frames = new ManualFrames();
    frames.install();
    let body!: ReturnType<typeof pibblPhysicsBody2D>;
    let world!: PibblPhysicsWorldHandle2D;
    const Capture = () => {
      world = pibblPhysicsWorld2D();
      return undefined;
    };
    const Ball = () => {
      body = pibblPhysicsBody2D();
      return (
        <Group
          physics={dynamicBody2D({
            handle: body,
            collider: false,
            mass: 1,
            linearDamping: 0.025,
            angularDamping: 0.04,
          })}
          style={{ translateX: 210, translateY: 110 }}
        >
          <Group>
            <Circle
              physics={collider2D({
                tag: "ball",
                restitution: 0.35,
                friction: 0.65,
              })}
              style={{ cx: 0, cy: 0, radius: 28, fill: "#2563eb" }}
            />
          </Group>
        </Group>
      );
    };
    const canvas = document.createElement("canvas");
    canvas.width = 720;
    canvas.height = 420;
    document.body.appendChild(canvas);
    mounts.push(
      pibbl(
        canvas,
        <PhysicsWorld2D
          gravity={[0, 560]}
          fixedStepMilliseconds={1000 / 60}
          interpolation="none"
        >
          <Capture />
          <Rectangle
            physics={staticBody2D({ collider: { friction: 0.55 } })}
            style={{
              left: 54,
              top: 316,
              width: 612,
              height: 34,
              fill: "#334155",
            }}
          />
          <Rectangle
            physics={staticBody2D({ collider: { friction: 0.4 } })}
            style={{
              left: 646,
              top: 96,
              width: 20,
              height: 220,
              fill: "#475569",
            }}
          />
          <Ball />
        </PhysicsWorld2D>,
      ),
    );
    frames.flush(0);
    frames.flush(0);
    disableBody2D(body);
    teleportBody2D(body, { position: [300, 280], rotationDegrees: 0 });
    enableBody2D(body, { velocity: "zero" });
    setLinearVelocity2D(body, [1000, 0]);

    for (let frame = 1; frame <= 45; frame += 1) {
      frames.flush((frame * 1000) / 60);
      const position = body.position.get();
      const painted = solidBlueCenter(canvas);
      expect(painted).not.toBeNull();
      expect(Math.abs(painted![0] - position[0])).toBeLessThanOrEqual(2);
      expect(Math.abs(painted![1] - position[1])).toBeLessThanOrEqual(2);
      const matches = queryPoint2D(world, position, { mode: "all" });
      expect(matches.some((match) => match.tag === "ball")).toBe(true);
      expect(
        queryPoint2D(world, [position[0] * 2 - 210, position[1] * 2 - 110], {
          mode: "any",
        }),
      ).toBe(false);
      expect(position[0]).toBeLessThanOrEqual(666.01);
    }
  });

  it("leaves kinematic authored placement under application authority", () => {
    const frames = new ManualFrames();
    frames.install();
    let translateX = 10;
    const root = () => (
      <PhysicsWorld2D>
        <Group
          physics={kinematicBody2D({ collider: false })}
          style={{ translateX }}
        >
          <Rectangle
            physics={collider2D()}
            style={{ left: 5, top: 5, width: 10, height: 10, fill: "#2563eb" }}
          />
        </Group>
      </PhysicsWorld2D>
    );
    const canvas = document.createElement("canvas");
    canvas.width = 60;
    canvas.height = 25;
    document.body.appendChild(canvas);
    mounts.push(pibbl(canvas, root()));
    frames.flush(0);
    frames.flush(1);

    translateX = 30;
    pibbl(canvas, root());
    frames.flush(2);
    expect(pixelAt(canvas, 37, 8)).toEqual([37, 99, 235, 255]);
    expect(pixelAt(canvas, 17, 8)).toEqual([0, 0, 0, 0]);
  });

  it("cedes disabled pose authority and re-enables at the current authored pose", () => {
    const frames = new ManualFrames();
    frames.install();
    let enabled = false;
    let translateX = 10;
    const root = () => (
      <PhysicsWorld2D gravity={[0, 0]}>
        <Group
          physics={dynamicBody2D({
            collider: false,
            enabled,
            linearVelocity: [3, 4],
            reenableVelocity: "preserve",
          })}
          style={{ translateX }}
        >
          <Rectangle
            physics={collider2D()}
            style={{ left: 5, top: 5, width: 10, height: 10, fill: "#2563eb" }}
          />
        </Group>
      </PhysicsWorld2D>
    );
    const canvas = document.createElement("canvas");
    canvas.width = 70;
    canvas.height = 25;
    document.body.appendChild(canvas);
    mounts.push(pibbl(canvas, root()));
    frames.flush(0);
    frames.flush(0);

    translateX = 30;
    enabled = true;
    pibbl(canvas, root());
    frames.flush(0);
    expect(pixelAt(canvas, 37, 8)).toEqual([37, 99, 235, 255]);
    expect(pixelAt(canvas, 17, 8)).toEqual([0, 0, 0, 0]);
  });

  it("keeps authored placement at acquisition and applies one parent-local dynamic delta", () => {
    const parent = new DOMMatrix().translate(10, 5).rotate(30);
    const local = new DOMMatrix().translate(20, 4).rotate(15);
    const capture = captureBodyPresentation2D(parent, local, "Group");

    expect(capture.initialPose.position[0]).toBeCloseTo(25.3205, 4);
    expect(capture.initialPose.position[1]).toBeCloseTo(18.4641, 4);
    expect(capture.initialPose.rotationDegrees).toBeCloseTo(45);
    expect(
      matrix(
        resolveDynamicPresentationTransform2D(
          capture,
          capture.initialPose,
          parent,
          local,
          "Group",
        ),
      ),
    ).toEqual([1, 0, 0, 1, 0, 0]);

    const moved = resolveDynamicPresentationTransform2D(
      capture,
      { position: [55, 28], rotationDegrees: 70 },
      parent,
      local,
      "Group",
    );
    const presentedWorld = parent.multiply(moved).multiply(local);
    const expectedWorld = matrix(new DOMMatrix().translate(55, 28).rotate(70));
    matrix(presentedWorld).forEach((value, index) => {
      expect(value).toBeCloseTo(expectedWorld[index]!, 5);
    });
  });

  it("diagnoses authored pose changes while an enabled dynamic body owns pose", () => {
    const parent = new DOMMatrix().translate(10, 5);
    const local = new DOMMatrix().translate(20, 4);
    const capture = captureBodyPresentation2D(parent, local, "Group");
    expect(() =>
      resolveDynamicPresentationTransform2D(
        capture,
        capture.initialPose,
        parent,
        new DOMMatrix().translate(21, 4),
        "Group",
      ),
    ).toThrow(
      /Group.*authored.*dynamic.*teleportBody2D|Group.*dynamic.*authored.*teleportBody2D/i,
    );
    expect(() =>
      resolveDynamicPresentationTransform2D(
        capture,
        capture.initialPose,
        new DOMMatrix().translate(11, 5),
        local,
        "Group",
      ),
    ).toThrow(/ancestor transform.*dynamic/i);
  });

  it("rejects noninvertible, skewed, and non-rigid dynamic ancestors", () => {
    expect(() =>
      captureBodyPresentation2D(
        new DOMMatrix().scale(0, 1),
        new DOMMatrix(),
        "Rectangle",
      ),
    ).toThrow(/noninvertible/i);
    expect(() =>
      captureBodyPresentation2D(
        new DOMMatrix().skewX(10),
        new DOMMatrix(),
        "Rectangle",
      ),
    ).toThrow(/skewed|rigid/i);
    expect(() =>
      captureBodyPresentation2D(
        new DOMMatrix().scale(2),
        new DOMMatrix(),
        "Rectangle",
      ),
    ).toThrow(/non-rigid|scale/i);
  });

  it("accepts browser transform round-trip noise around a rigid ancestor", () => {
    const browserIdentity = new DOMMatrix([
      0.9999999803366121, 0, 0, 1.0000000018736235, 0, 3.3213614218633807e-22,
    ]);

    expect(() =>
      captureBodyPresentation2D(browserIdentity, new DOMMatrix(), "Circle"),
    ).not.toThrow();
  });
});

function matrix(value: DOMMatrixReadOnly): readonly number[] {
  return [value.a, value.b, value.c, value.d, value.e, value.f].map((entry) =>
    Math.abs(entry) < 1e-10 ? 0 : Number(entry.toFixed(8)),
  );
}

function pixelAt(canvas: HTMLCanvasElement, x: number, y: number): number[] {
  return Array.from(canvas.getContext("2d")!.getImageData(x, y, 1, 1).data);
}

function solidBlueCenter(
  canvas: HTMLCanvasElement,
): readonly [number, number] | null {
  const pixels = canvas
    .getContext("2d")!
    .getImageData(0, 0, canvas.width, canvas.height).data;
  let left = canvas.width;
  let right = -1;
  let top = canvas.height;
  let bottom = -1;
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const offset = (y * canvas.width + x) * 4;
      if (
        pixels[offset] === 37 &&
        pixels[offset + 1] === 99 &&
        pixels[offset + 2] === 235 &&
        pixels[offset + 3] === 255
      ) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  }
  return right < left || bottom < top
    ? null
    : [(left + right) / 2, (top + bottom) / 2];
}

function click(canvas: HTMLCanvasElement, x: number, y: number): void {
  const bounds = canvas.getBoundingClientRect();
  for (const type of ["mousedown", "mouseup", "click"]) {
    canvas.dispatchEvent(
      new MouseEvent(type, {
        bubbles: true,
        button: 0,
        buttons: type === "mousedown" ? 1 : 0,
        clientX: bounds.left + x,
        clientY: bounds.top + y,
      }),
    );
  }
}

class ManualFrames {
  private callbacks = new Map<number, FrameRequestCallback>();
  private nextId = 0;

  install(): void {
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(
      (callback) => {
        const id = ++this.nextId;
        this.callbacks.set(id, callback);
        return id;
      },
    );
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) => {
      this.callbacks.delete(id);
    });
  }

  flush(time: number): void {
    const entry = this.callbacks.entries().next().value as
      readonly [number, FrameRequestCallback] | undefined;
    if (!entry) throw new Error("No Pibbl host frame is pending.");
    this.callbacks.delete(entry[0]);
    entry[1](time);
  }
}
