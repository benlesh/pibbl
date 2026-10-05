import * as Pibbl from '@pibbl/core';
import { afterEach, expect, it } from 'vitest';
import type { PibblController, PibblNode } from '@pibbl/core';

let controller: PibblController | undefined;

const settle = () => new Promise<void>(resolve =>
  requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
);

afterEach(async () => {
  controller?.dispose();
  controller = undefined;
  await settle();
  document.body.replaceChildren();
});

function pixels(
  canvas: HTMLCanvasElement,
  matches: (red: number, green: number, blue: number, alpha: number) => boolean,
): DOMPoint[] {
  const { data, width, height } = canvas.getContext('2d')!.getImageData(
    0,
    0,
    canvas.width,
    canvas.height,
  );
  const result: DOMPoint[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      if (matches(data[offset]!, data[offset + 1]!, data[offset + 2]!, data[offset + 3]!))
        result.push(new DOMPoint(x + 0.5, y + 0.5));
    }
  }
  return result;
}

function mean(points: readonly DOMPoint[]): DOMPoint {
  return new DOMPoint(
    points.reduce((total, point) => total + point.x, 0) / points.length,
    points.reduce((total, point) => total + point.y, 0) / points.length,
  );
}

function dot(left: DOMPoint, right: DOMPoint): number {
  return left.x * right.x + left.y * right.y;
}

function maxArcAlpha(
  canvas: HTMLCanvasElement,
  point: DOMPoint,
): number {
  const context = canvas.getContext('2d')!;
  let alpha = 0;
  for (let y = Math.round(point.y) - 2; y <= Math.round(point.y) + 2; y++) {
    for (let x = Math.round(point.x) - 2; x <= Math.round(point.x) + 2; x++) {
      const [red, green, blue, candidate] = context.getImageData(x, y, 1, 1).data;
      if (red! < 20 && green! < 20 && blue! > 230) alpha = Math.max(alpha, candidate!);
    }
  }
  return alpha;
}

it('paints a 24 CSS-pixel connector perpendicular to a nonuniformly transformed top edge', async () => {
  const box = Pibbl.signal({ left: 80, top: 100, width: 120, height: 80 });
  const rotation = Pibbl.signal(0);
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 450;
  document.body.append(canvas);

  function Scene(): PibblNode {
    const manipulation = Pibbl.useManipulation({ box, rotation, rotate: {} });
    return (
      <Pibbl.Group
        style={{
          translateX: 40,
          translateY: 30,
          rotationDegrees: 30,
          scaleX: 1.5,
          scaleY: 0.75,
        }}
      >
        <Pibbl.ManipulationFrame {...manipulation.frameProps}>
          <Pibbl.RotationHandle
            controller={manipulation}
            style={{ connector: { stroke: '#ff0000', strokeWidth: 4 }, arc: false }}
          />
        </Pibbl.ManipulationFrame>
      </Pibbl.Group>
    );
  }

  controller = Pibbl.pibbl(canvas, <Scene />, { pixelRatio: 1 });
  await settle();

  const transform = new DOMMatrix()
    .scale(1.5, 0.75)
    .rotate(30)
    .translate(40, 30);
  const top = transform.transformPoint(new DOMPoint(140, 100));
  const tangent = new DOMPoint(transform.a, transform.b);
  const mappedOut = new DOMPoint(-transform.c, -transform.d);
  let normal = new DOMPoint(-tangent.y, tangent.x);
  const normalLength = Math.hypot(normal.x, normal.y);
  normal = new DOMPoint(normal.x / normalLength, normal.y / normalLength);
  if (dot(normal, mappedOut) < 0) normal = new DOMPoint(-normal.x, -normal.y);
  const expectedHandle = new DOMPoint(top.x + normal.x * 24, top.y + normal.y * 24);

  const red = pixels(canvas, (r, g, b, a) => r > 220 && g < 50 && b < 50 && a > 180);
  expect(red.length).toBeGreaterThan(40);
  const redProjection = (point: DOMPoint) => dot(
    new DOMPoint(point.x - top.x, point.y - top.y),
    normal,
  );
  const first = red.reduce((nearest, point) =>
    redProjection(point) < redProjection(nearest) ? point : nearest,
  );
  const last = red.reduce((furthest, point) =>
    redProjection(point) > redProjection(furthest) ? point : furthest,
  );
  const paintedDirection = new DOMPoint(last.x - first.x, last.y - first.y);
  expect(
    Math.abs(dot(paintedDirection, tangent)) /
      (Math.hypot(paintedDirection.x, paintedDirection.y) * Math.hypot(tangent.x, tangent.y)),
  ).toBeLessThan(0.2);
  expect(Math.hypot(paintedDirection.x, paintedDirection.y)).toBeGreaterThan(14);

  const handle = pixels(canvas, (r, g, b, a) =>
    r > 20 && r < 80 && g > 70 && g < 140 && b > 170 && a > 180,
  ).filter(point => Math.hypot(point.x - expectedHandle.x, point.y - expectedHandle.y) < 8);
  expect(handle.length).toBeGreaterThan(8);
  const actualHandle = mean(handle);
  expect(Math.hypot(actualHandle.x - expectedHandle.x, actualHandle.y - expectedHandle.y))
    .toBeLessThan(1.5);
  expect(Math.hypot(actualHandle.x - top.x, actualHandle.y - top.y)).toBeCloseTo(24, 0);
});

it('omits both optional rotation decorations when explicitly disabled', async () => {
  const box = Pibbl.signal({ left: 100, top: 100, width: 120, height: 80 });
  const rotation = Pibbl.signal(0);
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 240;
  document.body.append(canvas);
  function Scene(): PibblNode {
    const manipulation = Pibbl.useManipulation({ box, rotation, rotate: {} });
    return <Pibbl.ManipulationFrame {...manipulation.frameProps}>
      <Pibbl.RotationHandle controller={manipulation} style={{ connector: false, arc: false }} />
    </Pibbl.ManipulationFrame>;
  }
  controller = Pibbl.pibbl(canvas, <Scene />, { pixelRatio: 1 });
  await settle();

  expect(pixels(canvas, (r, g, b, a) => r > 220 && g < 50 && b < 50 && a > 180)).toHaveLength(0);
  expect(maxArcAlpha(canvas, new DOMPoint(184, 81))).toBe(0);
  expect(canvas.getContext('2d')!.getImageData(160, 88, 1, 1).data[3]).toBe(0);
});

it('renders an opt-in blue guide arc with symmetric fading around the rotation handle', async () => {
  const box = Pibbl.signal({ left: 100, top: 100, width: 120, height: 80 });
  const rotation = Pibbl.signal(0);
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 240;
  document.body.append(canvas);
  function Scene(): PibblNode {
    const manipulation = Pibbl.useManipulation({ box, rotation, rotate: {} });
    return <Pibbl.ManipulationFrame {...manipulation.frameProps}>
      <Pibbl.RotationHandle
        controller={manipulation}
        style={{
          connector: false,
          arc: { color: '#0000ff', sweep: Math.PI / 2, strokeWidth: 3 },
        }}
      />
    </Pibbl.ManipulationFrame>;
  }
  controller = Pibbl.pibbl(canvas, <Scene />, { pixelRatio: 1 });
  await settle();

  const pivot = new DOMPoint(160, 140);
  const pointAt = (offset: number) => new DOMPoint(
    pivot.x + 64 * Math.cos(-Math.PI / 2 + offset),
    pivot.y + 64 * Math.sin(-Math.PI / 2 + offset),
  );
  const nearLeft = maxArcAlpha(canvas, pointAt(-Math.PI / 8));
  const nearRight = maxArcAlpha(canvas, pointAt(Math.PI / 8));
  const endLeft = maxArcAlpha(canvas, pointAt(-Math.PI * 0.22));
  const endRight = maxArcAlpha(canvas, pointAt(Math.PI * 0.22));
  expect(nearLeft).toBeGreaterThan(80);
  expect(nearRight).toBeGreaterThan(80);
  expect(Math.abs(nearLeft - nearRight)).toBeLessThanOrEqual(8);
  expect(endLeft).toBeGreaterThan(0);
  expect(endRight).toBeGreaterThan(0);
  expect(Math.abs(endLeft - endRight)).toBeLessThanOrEqual(16);
  expect(nearLeft).toBeGreaterThan(endLeft + 40);
  expect(nearRight).toBeGreaterThan(endRight + 40);
});
