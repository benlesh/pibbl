import {
  meshTransform,
  arcBendTransform,
  pathBendTransform,
  affineTransform,
  composeTransforms,
  envelopeTransform,
  PathGeometry,
  transformPath,
} from '@crc/core';
import { expect, it } from 'vitest';

it('composes a text-envelope mapping left to right, snapshots guides, and preserves closing edges', () => {
  const top = new PathGeometry();
  top.moveTo(0, 0);
  top.lineTo(100, 0);
  const bottom = new PathGeometry();
  bottom.moveTo(0, 100);
  bottom.lineTo(200, 100);
  const source = new PathGeometry();
  source.moveTo(0, 0);
  source.lineTo(1, 1);
  source.closePath();
  const envelope = envelopeTransform({
    source: { x: 0, y: 0, width: 1, height: 1 },
    top,
    bottom,
  });
  const mapping = composeTransforms(
    envelope,
    affineTransform({ a: 2, d: 2, e: 10, f: 20 }),
  );
  top.clear();
  bottom.clear();
  expect(mapping.mapPoint({ x: 0.5, y: 0.5 })).toEqual({ x: 160, y: 120 });
  const result = transformPath(source, mapping, { tolerance: 0.01 });
  const points = Array.from(result);
  expect(points[0]).toEqual({ type: 'move', x: 10, y: 20 });
  expect(points.at(-1)).toEqual({ type: 'close' });
  expect(
    points.filter((p) => p.type === 'line' && p.x === 160 && p.y === 120),
  ).toHaveLength(2);
  expect(source.segmentCount).toBe(3);
  let previous = 0;
  for (const p of points) {
    if (p.type !== 'line') continue;
    const t = (p.y - 20) / 200;
    // F(t)=(10+200t+200t²,20+200t): exact maximum chord error.
    expect((200 * (t - previous) ** 2) / 4).toBeLessThanOrEqual(0.01);
    previous = t;
  }
});

it('tracks curved arc-length guides and supports intermediate guide creases', () => {
  const top = new PathGeometry();
  top.moveTo(0, 0);
  top.quadraticCurveTo(50, -50, 100, 0);
  const middle = new PathGeometry();
  middle.moveTo(0, 40);
  middle.lineTo(100, 80);
  const bottom = new PathGeometry();
  bottom.moveTo(0, 100);
  bottom.lineTo(100, 100);
  const mapping = envelopeTransform({
    source: { x: 0, y: 0, width: 1, height: 1 },
    guides: [
      { at: 0, path: top },
      { at: 0.4, path: middle },
      { at: 1, path: bottom },
    ],
  });
  const mid = mapping.mapPoint({ x: 0.5, y: 0 });
  expect(mid.x).toBeCloseTo(50, 8);
  expect(mid.y).toBeCloseTo(-25, 8);
  expect(mapping.mapPoint({ x: 0.5, y: 0.4 })).toEqual({ x: 50, y: 60 });
  const shape = new PathGeometry();
  shape.rect(0, 0, 1, 1);
  const result = transformPath(shape, mapping, { tolerance: 0.2 });
  expect(result.segmentCount).toBeGreaterThan(10);
  expect(Array.from(result).filter((s) => s.type === 'close')).toHaveLength(1);
  expect(Array.from(result).at(-1)).toEqual({ type: 'move', x: 0, y: 0 });
  expect(() => mapping.mapPoint({ x: 2, y: 0 })).toThrow(RangeError);
});

it('maps a shared-edge curved mesh and composes it with a bend', () => {
  const line = (x0: number, y0: number, x1: number, y1: number) => {
    const p = new PathGeometry();
    p.moveTo(x0, y0);
    p.lineTo(x1, y1);
    return p;
  };
  const top = new PathGeometry();
  top.moveTo(0, 0);
  top.quadraticCurveTo(50, -40, 100, 0);
  const mesh = meshTransform({
    source: { x: 0, y: 0, width: 1, height: 1 },
    columns: [0, 0.5, 1],
    rows: [0, 1],
    horizontal: [
      [line(0, 0, 50, -20), line(50, -20, 100, 0)],
      [line(0, 100, 50, 120), line(50, 120, 100, 100)],
    ],
    vertical: [
      [line(0, 0, 0, 100)],
      [line(50, -20, 50, 120)],
      [line(100, 0, 100, 100)],
    ],
  });
  expect(mesh.mapPoint({ x: 0.5, y: 0.25 })).toEqual({ x: 50, y: 15 });
  expect(mesh.mapPoint({ x: 0, y: 1 })).toEqual({ x: 0, y: 100 });
  const bend = arcBendTransform({
    source: { x: 0, y: 0, width: 100, height: 100 },
    arc: { cx: 0, cy: 0, radius: 200, startAngle: 0, sweep: 1 },
    baseline: 0,
    fit: 'stretch',
  });
  const compound = composeTransforms(mesh, bend);
  const p = compound.mapPoint({ x: 0.5, y: 0.25 });
  expect(p.x).toBeCloseTo(185 * Math.cos(0.5), 8);
  expect(p.y).toBeCloseTo(185 * Math.sin(0.5), 8);
  const diagonal = new PathGeometry();
  diagonal.moveTo(0, 0);
  diagonal.lineTo(1, 1);
  expect(
    transformPath(diagonal, compound, { tolerance: 0.1 }).segmentCount,
  ).toBeGreaterThan(5);
});

it('bends along a snapshotted smooth path, preserving placement controls', () => {
  const guide = new PathGeometry();
  guide.moveTo(30, 40);
  guide.lineTo(130, 40);
  const bend = pathBendTransform({
    guide,
    source: { x: 0, y: 0, width: 100, height: 20 },
    baseline: 0,
    offset: 5,
    normalOffset: 3,
  });
  guide.clear();
  const p = bend.mapPoint({ x: 25, y: 7 });
  expect(p.x).toBeCloseTo(60, 8);
  expect(p.y).toBeCloseTo(50, 8);
  const source = new PathGeometry();
  source.rect(0, 0, 50, 10);
  expect(
    transformPath(source, bend, { tolerance: 0.01 }).segmentCount,
  ).toBeGreaterThan(3);
});

it('preserves curves for affine compositions and supports materialized sequential application', () => {
  const path = new PathGeometry();
  path.moveTo(1, 2);
  path.quadraticCurveTo(4, 9, 8, 3);
  path.closePath();
  const a = affineTransform({ a: 2, d: 3 }),
    b = affineTransform({ e: 10, f: -4 });
  const fused = transformPath(path, composeTransforms(a, b), {
    tolerance: 0.01,
  });
  const sequential = transformPath(
    transformPath(path, a, { tolerance: 0.01 }),
    b,
    { tolerance: 0.01 },
  );
  expect(Array.from(fused)).toEqual(Array.from(sequential));
  expect(fused.getSegment(1).type).toBe('quadratic');
  expect(composeTransforms(b, a).mapPoint({ x: 1, y: 2 })).not.toEqual(
    composeTransforms(a, b).mapPoint({ x: 1, y: 2 }),
  );
  expect(transformPath(path, composeTransforms(), { tolerance: 1 })).not.toBe(
    path,
  );
});

it('honors reversed guides, correspondence stations, and snapshot ownership', () => {
  const top = new PathGeometry();
  top.moveTo(0, 0);
  top.lineTo(100, 0);
  const bottom = new PathGeometry();
  bottom.moveTo(100, 100);
  bottom.lineTo(0, 100);
  const source = { x: 0, y: 0, width: 1, height: 1 };
  const stations = [
    { at: 0, distance: 0 },
    { at: 0.5, distance: 0.75 },
    { at: 1, distance: 1 },
  ];
  const transform = envelopeTransform({
    source,
    top,
    bottom: { path: bottom, reverse: true, stations },
  });
  source.width = 5;
  stations[1].distance = 0.1;
  bottom.clear();
  expect(transform.mapPoint({ x: 0.5, y: 1 })).toEqual({ x: 75, y: 100 });
  expect(transform.mapPoint({ x: 0.5, y: 0.5 })).toEqual({ x: 62.5, y: 50 });
});

it('bounds a nonlinear composition in final destination units', () => {
  const top = new PathGeometry();
  top.moveTo(0, 0);
  top.lineTo(1, 0);
  const bottom = new PathGeometry();
  bottom.moveTo(0, 1);
  bottom.lineTo(2, 1);
  const path = new PathGeometry();
  path.moveTo(0, 0);
  path.lineTo(1, 1);
  const envelope = envelopeTransform({
    source: { x: 0, y: 0, width: 1, height: 1 },
    top,
    bottom,
  });
  const bend = arcBendTransform({
    source: { x: 0, y: 0, width: 2, height: 1 },
    arc: { cx: 0, cy: 0, radius: 20, startAngle: 0, sweep: 1 },
    baseline: 0,
    fit: 'stretch',
  });
  const result = transformPath(
    path,
    composeTransforms(envelope, bend, affineTransform({ a: 10, d: 10 })),
    { tolerance: 0.05 },
  );
  const vertices = Array.from(result).flatMap((p) =>
    p.type === 'move' || p.type === 'line' ? [p] : [],
  );
  for (let i = 0; i <= 500; i++) {
    const t = i / 500,
      theta = (t + t * t) / 2;
    const p = {
      x: 10 * (20 - t) * Math.cos(theta),
      y: 10 * (20 - t) * Math.sin(theta),
    };
    const distances = vertices.slice(1).map((b, j) => {
      const a = vertices[j],
        dx = b.x - a.x,
        dy = b.y - a.y;
      const u = Math.max(
        0,
        Math.min(
          1,
          ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy),
        ),
      );
      return Math.hypot(p.x - a.x - u * dx, p.y - a.y - u * dy);
    });
    expect(Math.min(...distances)).toBeLessThanOrEqual(0.05);
  }
});

it('preserves the analytic normal field through composed path bending', () => {
  const guide = new PathGeometry();
  guide.arc(100, 100, 80, 0, Math.PI / 2);
  const mapping = composeTransforms(
    pathBendTransform({
      guide,
      source: { x: 0, y: 0, width: 40 * Math.PI, height: 10 },
      baseline: 0,
    }),
    affineTransform({ a: 2, d: 2 }),
  );
  const p = mapping.mapPoint({ x: 20 * Math.PI, y: 5 }, { tolerance: 0.01 });
  expect(
    Math.hypot(
      p.x - (200 + 150 * Math.SQRT1_2),
      p.y - (200 + 150 * Math.SQRT1_2),
    ),
  ).toBeLessThan(0.01);
});

it('rejects malformed meshes and opaque-transform impostors without mutating sources', () => {
  const path = new PathGeometry();
  path.moveTo(0, 0);
  path.lineTo(1, 1);
  expect(() =>
    transformPath(path, { mapPoint: () => ({ x: 0, y: 0 }) } as never, {
      tolerance: 1,
    }),
  ).toThrow(TypeError);
  expect(() =>
    transformPath(path, affineTransform(), { tolerance: 0 }),
  ).toThrow(RangeError);
  expect(() =>
    meshTransform({
      source: { x: 0, y: 0, width: 1, height: 1 },
      columns: [0, 1],
      rows: [0, 1],
      horizontal: [],
      vertical: [],
    }),
  ).toThrow(RangeError);
  const p = new PathGeometry();
  p.moveTo(0, 0);
  p.lineTo(0, 0);
  expect(() =>
    envelopeTransform({
      source: { x: 0, y: 0, width: 1, height: 1 },
      top: p,
      bottom: path,
    }).mapPoint({ x: 0, y: 0 }),
  ).toThrow(RangeError);
  expect(path.segmentCount).toBe(2);
});
