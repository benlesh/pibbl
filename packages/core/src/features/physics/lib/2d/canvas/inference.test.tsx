/** @jsxImportSource @pibbl/core */
import {
  Arc,
  Circle,
  Ellipse,
  HorizontalLine,
  Image,
  Line,
  Path,
  Polygon,
  Rectangle,
  RegularPolygon,
  Star,
  SvgPath,
  Text,
  VerticalLine,
  Wedge,
  pibbl,
  type PibblController,
} from "@pibbl/core";
import {
  Capsule2D,
  Chain2D,
  PhysicsShape2D,
  PhysicsWorld2D,
  Segment2D,
  pibblPhysicsWorld2D,
  staticBody2D,
  type PibblPhysicsWorldHandle2D,
} from "../../../2d.js";
import { circleShape2D } from "../shapes.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { requireShapeRecord2D } from "../shape-records.js";
import {
  requirePhysicsWorld2DController,
  snapshotPhysicsWorld2DControllerForTest,
} from "../runtime/controller.js";
import { inferCanvasColliderShape2D } from "./inference.js";

describe("Canvas 2D collider inference", () => {
  const mounts: PibblController[] = [];

  afterEach(() => {
    for (const mount of mounts.splice(0)) mount.dispose();
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it("acquires inferred colliders for every supported current Canvas primitive identity", () => {
    const frames = new ManualFrames();
    frames.install();
    let world!: PibblPhysicsWorldHandle2D;
    const Capture = () => {
      world = pibblPhysicsWorld2D();
    };
    const body = staticBody2D;
    const canvas = document.createElement("canvas");
    canvas.width = 120;
    canvas.height = 80;
    document.body.appendChild(canvas);
    mounts.push(
      pibbl(
        canvas,
        <PhysicsWorld2D>
          <Capture />
          <Rectangle
            physics={body()}
            style={{ left: 1, top: 1, width: 8, height: 6 }}
          />
          <Rectangle
            physics={body()}
            style={{ left: 10, top: 1, width: 8, height: 6, cornerRadius: 1 }}
          />
          <Circle physics={body()} style={{ cx: 5, cy: 15, radius: 3 }} />
          <Ellipse
            physics={body()}
            style={{ cx: 15, cy: 15, radiusX: 4, radiusY: 2 }}
          />
          <Arc
            physics={body()}
            style={{
              cx: 25,
              cy: 15,
              radius: 4,
              startAngle: 0,
              endAngle: Math.PI,
              strokeWidth: 2,
            }}
          />
          <Wedge
            physics={body()}
            style={{
              cx: 35,
              cy: 15,
              radius: 4,
              startAngle: 0,
              endAngle: Math.PI,
            }}
          />
          <Polygon
            physics={body()}
            style={{
              coords: [
                [45, 10],
                [53, 10],
                [49, 18],
              ],
            }}
          />
          <Polygon
            physics={body()}
            style={{
              coords: [
                [56, 10],
                [64, 10],
                [64, 18],
                [60, 14],
                [56, 18],
              ],
              cornerRadius: 0.5,
            }}
          />
          <RegularPolygon
            physics={body()}
            style={{ sides: 5, cx: 72, cy: 14, circumradius: 4 }}
          />
          <Star
            physics={body()}
            style={{
              points: 5,
              cx: 84,
              cy: 14,
              outerRadius: 5,
              innerRadius: 2,
            }}
          />
          <Line
            physics={body()}
            style={{
              coords: [
                [1, 26],
                [10, 26],
                [10, 30],
              ],
              strokeWidth: 2,
            }}
          />
          <HorizontalLine
            physics={body()}
            style={{ x1: 14, x2: 24, y: 27, strokeWidth: 2 }}
          />
          <VerticalLine
            physics={body()}
            style={{ x: 28, y1: 23, y2: 31, strokeWidth: 0 }}
          />
          <SvgPath
            physics={body()}
            style={{ d: "M 34 23 L 42 23 L 42 31 L 34 31 Z", fill: "#000" }}
          />
          <Text
            physics={body()}
            style={{ left: 46, top: 23, width: 10, height: 8 }}
          >
            stable
          </Text>
          <Capsule2D
            physics={body()}
            style={{ start: [60, 27], end: [70, 27], radius: 2 }}
          />
          <Segment2D
            physics={body()}
            style={{ start: [74, 27], end: [82, 27] }}
          />
          <Chain2D
            physics={body()}
            style={{
              points: [
                [86, 23],
                [94, 23],
                [94, 31],
              ],
              radius: 1,
            }}
          />
          <PhysicsShape2D
            physics={body()}
            style={{ shape: circleShape2D({ radius: 2, center: [102, 27] }) }}
          />
        </PhysicsWorld2D>,
      ),
    );
    frames.flush(0);
    frames.flush(1);
    const snapshot = snapshotPhysicsWorld2DControllerForTest(
      requirePhysicsWorld2DController(world),
    );
    expect(snapshot.kernel.bodyCount).toBe(19);
    expect(snapshot.kernel.colliderCount).toBe(19);
  });

  it("infers analytic rectangle, circle, and ellipse geometry by component identity", () => {
    expect(
      summary(Rectangle, {
        left: 10,
        top: 20,
        width: 30,
        height: 40,
      }),
    ).toEqual([
      { kind: "box", center: [15, 20], halfWidth: 15, halfHeight: 20 },
    ]);
    expect(
      summary(Rectangle, {
        left: 2,
        top: 4,
        width: 20,
        height: 10,
        cornerRadius: 3,
      }),
    ).toEqual([{ kind: "rounded-box", center: [10, 5], radii: [3, 3, 3, 3] }]);
    expect(summary(Circle, { cx: 7, cy: 9, radius: 5 })).toEqual([
      { kind: "circle", center: [7, 9], radius: 5 },
    ]);
    expect(
      summary(Ellipse, {
        cx: 4,
        cy: 6,
        radiusX: 8,
        radiusY: 3,
        rotation: Math.PI / 2,
      }),
    ).toEqual([
      {
        kind: "ellipse",
        center: [4, 6],
        radiusX: 8,
        radiusY: 3,
        rotationRadians: Math.PI / 2,
      },
    ]);
  });

  it("infers curved and concave contours with deterministic leaf order", () => {
    const arc = summary(Arc, {
      cx: 0,
      cy: 0,
      radius: 10,
      startAngle: 0,
      endAngle: Math.PI / 2,
      counterclockwise: false,
      strokeWidth: 4,
    });
    expect(arc.length).toBeGreaterThan(1);
    expect(arc.every((leaf) => leaf.kind === "capsule")).toBe(true);
    expect(arc[0]).toMatchObject({
      kind: "capsule",
      start: [10, 0],
      radius: 2,
    });

    expect(
      summary(Wedge, {
        cx: 0,
        cy: 0,
        radius: 10,
        startAngle: 0,
        endAngle: Math.PI,
        counterclockwise: false,
      }).every((leaf) => leaf.kind === "polygon"),
    ).toBe(true);

    expect(
      summary(Polygon, {
        coords: [
          [0, 0],
          [8, 0],
          [8, 8],
          [4, 3],
          [0, 8],
        ],
      }),
    ).toHaveLength(3);
    expect(
      summary(Polygon, {
        coords: [
          [0, 0],
          [8, 0],
          [8, 8],
          [0, 8],
        ],
        cornerRadius: 1,
      }).length,
    ).toBeGreaterThan(1);
    expect(
      summary(RegularPolygon, {
        sides: 5,
        cx: 2,
        cy: 3,
        rotation: 0,
        circumradius: 8,
      }),
    ).toHaveLength(1);
    expect(
      summary(Star, {
        points: 5,
        cx: 0,
        cy: 0,
        outerRadius: 10,
        innerRadius: 4,
        rotation: 0,
      }),
    ).toHaveLength(8);
  });

  it("preserves line and SVG contour order while expanding resolved stroke width", () => {
    expect(
      summary(Line, {
        coords: [
          [0, 0],
          [3, 4],
          [8, 4],
        ],
        strokeWidth: 6,
      }),
    ).toEqual([
      { kind: "capsule", start: [0, 0], end: [3, 4], radius: 3 },
      { kind: "capsule", start: [3, 4], end: [8, 4], radius: 3 },
    ]);
    expect(
      summary(HorizontalLine, { x1: 2, x2: 12, y: 5, strokeWidth: 2 }),
    ).toEqual([{ kind: "capsule", start: [2, 5], end: [12, 5], radius: 1 }]);
    expect(
      summary(VerticalLine, { y1: 1, y2: 9, x: 4, strokeWidth: 0 }),
    ).toEqual([{ kind: "segment", start: [4, 1], end: [4, 9] }]);
    expect(
      summary(SvgPath, { d: "M 0 0 L 8 0 L 8 6 L 0 6 Z", fill: "#000" }),
    ).toHaveLength(1);
    expect(
      summary(SvgPath, { d: "M 0 0 L 4 0 L 4 3", strokeWidth: 2 }),
    ).toEqual([
      { kind: "capsule", start: [0, 0], end: [4, 0], radius: 1 },
      { kind: "capsule", start: [4, 0], end: [4, 3], radius: 1 },
    ]);
  });

  it("requires stable explicit geometry for opaque or platform-dependent primitives", () => {
    expect(() =>
      inferCanvasColliderShape2D({
        componentType: Path,
        componentName: "Path",
        style: { d: new Path2D() },
      }),
    ).toThrow(/Path.*opaque Path2D.*explicit shape/i);
    expect(() =>
      inferCanvasColliderShape2D({
        componentType: Text,
        componentName: "Text",
        style: { x: 1, y: 2 },
      }),
    ).toThrow(/Text.*stable width and height.*explicit shape/i);
    expect(() =>
      inferCanvasColliderShape2D({
        componentType: Image,
        componentName: "Image",
        style: { x: 1, y: 2, src: "image.png" },
      }),
    ).toThrow(/Image.*stable width and height.*explicit shape/i);
    expect(() =>
      inferCanvasColliderShape2D({
        componentType: SvgPath,
        componentName: "SvgPath",
        style: { d: "M 0 0 L 8 8 L 0 8 L 8 0 Z", fill: "#000" },
      }),
    ).toThrow(/SvgPath.*self-intersecting.*explicit shape/i);
    expect(summary(Text, { left: 1, top: 2, width: 9, height: 4 })).toEqual([
      { kind: "box", center: [4.5, 2], halfWidth: 4.5, halfHeight: 2 },
    ]);
    expect(
      summary(Image, {
        left: 3,
        top: 5,
        width: 10,
        height: 6,
        src: "image.png",
      }),
    ).toEqual([{ kind: "box", center: [5, 3], halfWidth: 5, halfHeight: 3 }]);
  });

  it("does not retain removed positioning x/y as primitive-local collider geometry", () => {
    expect(summary(Rectangle, { x: 10, y: 20, width: 30, height: 40 })).toEqual(
      [{ kind: "box", center: [15, 20], halfWidth: 15, halfHeight: 20 }],
    );
    expect(summary(Text, { x: 1, y: 2, width: 9, height: 4 })).toEqual([
      { kind: "box", center: [4.5, 2], halfWidth: 4.5, halfHeight: 2 },
    ]);
    expect(
      summary(Image, { x: 3, y: 5, width: 10, height: 6, src: "image.png" }),
    ).toEqual([{ kind: "box", center: [5, 3], halfWidth: 5, halfHeight: 3 }]);
  });
});

function summary(
  componentType: Function,
  style: Readonly<Record<string, unknown>>,
) {
  const shape = inferCanvasColliderShape2D({
    componentType,
    componentName: componentType.name,
    style,
  });
  return requireShapeRecord2D(shape).leaves.map((leaf) => {
    switch (leaf.kind) {
      case "circle":
        return {
          kind: leaf.kind,
          center: [...leaf.center],
          radius: leaf.radius,
        };
      case "ellipse":
        return {
          kind: leaf.kind,
          center: [...leaf.center],
          radiusX: leaf.radiusX,
          radiusY: leaf.radiusY,
          rotationRadians: leaf.rotationRadians,
        };
      case "box":
        return {
          kind: leaf.kind,
          center: [...leaf.center],
          halfWidth: leaf.halfWidth,
          halfHeight: leaf.halfHeight,
        };
      case "rounded-box":
        return {
          kind: leaf.kind,
          center: [...leaf.center],
          radii: [...leaf.radii],
        };
      case "capsule":
        return {
          kind: leaf.kind,
          start: [...leaf.start],
          end: [...leaf.end],
          radius: leaf.radius,
        };
      case "segment":
        return { kind: leaf.kind, start: [...leaf.start], end: [...leaf.end] };
      case "polygon":
        return { kind: leaf.kind, vertices: [...leaf.vertices] };
    }
  });
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
