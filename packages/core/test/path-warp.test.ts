import { PathGeometry, warpPath } from '@crc/core';
import { expect, it } from 'vitest';

it('warps continuous lines, cubics and closing edges without changing the source', () => {
  const path = new PathGeometry();
  path.moveTo(10, 20);
  path.lineTo(110, 120);
  path.bezierCurveTo(110, 90, 60, 120, 110, 120);
  path.closePath();
  const before = Array.from(path), revision = path.revision;
  const result = warpPath(path, {
    source: { x: 10, y: 20, width: 100, height: 100 },
    destination: {
      topLeft: { x: 0, y: 0 }, topRight: { x: 100, y: 0 },
      bottomLeft: { x: 0, y: 100 }, bottomRight: { x: 200, y: 100 },
    },
    tolerance: 0.1,
  });
  const segments = Array.from(result);
  expect(segments[0]).toEqual({ type: 'move', x: 0, y: 0 });
  // F(t,t) = (100t + 100t², 100t), not the endpoint chord (200t,100t).
  expect(segments).toContainEqual({ type: 'line', x: 75, y: 50 });
  expect(segments.filter(s => s.type === 'line' && s.x === 75 && s.y === 50)).toHaveLength(2);
  expect(segments.at(-1)).toEqual({ type: 'close' });
  expect(segments.every(s => ['move', 'line', 'close'].includes(s.type))).toBe(true);
  expect(Array.from(path)).toEqual(before);
  expect(path.revision).toBe(revision);
  result.clear();
  expect(Array.from(path)).toEqual(before);
});

it('projects an offset rectangle through an independent known homography', () => {
  const path = new PathGeometry();
  for (const [u, v] of [[0, 0], [1, 0], [0, 1], [1, 1], [0.5, 0.5]]) path.moveTo(10 + u * 100, 20 + v * 100);
  const options = {
    source: { x: 10, y: 20, width: 100, height: 100 },
    destination: { topLeft: { x: 0, y: 0 }, topRight: { x: 100, y: 0 }, bottomLeft: { x: 0, y: 100 }, bottomRight: { x: 100, y: 50 } },
    tolerance: 0.01,
  };
  const projected = Array.from(warpPath(path, { ...options, mode: 'perspective' }));
  const expected = [[0, 0], [100, 0], [0, 100], [100, 50], [200 / 3, 100 / 3]];
  projected.forEach((segment, i) => {
    expect(segment.type).toBe('move');
    if (segment.type !== 'move') throw new Error('Expected move');
    expect(segment.x).toBeCloseTo(expected[i][0], 10);
    expect(segment.y).toBeCloseTo(expected[i][1], 10);
  });
  expect(Array.from(warpPath(path, options)).at(-1)).toEqual({ type: 'move', x: 50, y: 37.5 });
  const line = new PathGeometry(); line.moveTo(10, 20); line.lineTo(110, 120);
  for (const segment of warpPath(line, { ...options, mode: 'perspective' })) {
    if (segment.type === 'line') expect(segment.y).toBeCloseTo(segment.x / 2, 10);
  }
});

it('rejects invalid perspective quadrilaterals and poles, but permits separate finite contours across the pole', () => {
  const options = {
    source: { x: 0, y: 0, width: 1, height: 1 },
    destination: { topLeft: { x: 0, y: 0 }, topRight: { x: 1, y: 0 }, bottomLeft: { x: 0, y: 1 }, bottomRight: { x: 1, y: 0.5 } },
    tolerance: 0.01, mode: 'perspective' as const,
  };
  const path = new PathGeometry(); path.moveTo(-2, 0); path.lineTo(0, 0);
  const revision = path.revision;
  expect(() => warpPath(path, options)).toThrow(RangeError);
  expect(path.revision).toBe(revision);
  path.clear(); path.moveTo(-2, 0); path.lineTo(-3, 1); path.moveTo(0, 0); path.lineTo(1, 1);
  expect(Array.from(warpPath(path, options)).filter(s => s.type === 'move')).toHaveLength(2);
  path.clear(); path.moveTo(-1, 0);
  expect(() => warpPath(path, options)).toThrow(RangeError);
  expect(() => warpPath(new PathGeometry(), {
    ...options, destination: { ...options.destination, bottomRight: { x: -1, y: -1 } },
  })).toThrow(RangeError);
});

const unitSource = { x: 0, y: 0, width: 1, height: 1 };
const unitCorners = { topLeft: { x: 0, y: 0 }, topRight: { x: 1, y: 0 }, bottomLeft: { x: 0, y: 1 }, bottomRight: { x: 1, y: 1 } };

it('bounds the entire bilinear diagonal analytically in destination units', () => {
  const path = new PathGeometry(); path.moveTo(0, 0); path.lineTo(1, 1);
  const tolerance = 0.001;
  const result = warpPath(path, { source: unitSource, destination: { ...unitCorners, bottomRight: { x: 10000, y: 1 } }, tolerance });
  let previous = 0;
  for (const segment of result) {
    if (segment.type !== 'line') continue;
    const t = segment.y;
    // x(t)=t+9999t². The maximum deviation from each parameter-matched
    // chord is exactly 9999*(b-a)²/4; no sampling of the curve is needed.
    expect(9999 * (t - previous) ** 2 / 4).toBeLessThanOrEqual(tolerance);
    expect(segment.x).toBeCloseTo(t + 9999 * t * t, 8);
    previous = t;
  }
  expect(previous).toBe(1);
  expect(result.segmentCount).toBeLessThan(4096);
});

it('preserves finite extrapolation, affine reflection, and degenerate bilinear maps', () => {
  const path = new PathGeometry(); path.moveTo(-2, 3); path.lineTo(2, -1);
  for (const mode of ['bilinear', 'perspective'] as const) {
    const reflected = warpPath(path, { source: unitSource, destination: {
      topLeft: { x: 10, y: 20 }, topRight: { x: 8, y: 20 }, bottomLeft: { x: 11, y: 23 }, bottomRight: { x: 9, y: 23 },
    }, mode, tolerance: 0.01 });
    const points = Array.from(reflected).flatMap(s => s.type === 'move' || s.type === 'line' ? [[s.x, s.y] as const] : []);
    expect(points[0][0]).toBeCloseTo(17, 10); expect(points[0][1]).toBeCloseTo(29, 10);
    expect(points.at(-1)![0]).toBeCloseTo(5, 10); expect(points.at(-1)![1]).toBeCloseTo(17, 10);
  }
  for (const corners of [
    { ...unitCorners, bottomRight: { x: -1, y: -1 } },
    { ...unitCorners, bottomLeft: unitCorners.topRight, bottomRight: unitCorners.topLeft },
    { topLeft: { x: 3, y: 4 }, topRight: { x: 3, y: 4 }, bottomLeft: { x: 3, y: 4 }, bottomRight: { x: 3, y: 4 } },
  ]) {
    expect(() => warpPath(path, { source: unitSource, destination: corners, tolerance: 0.1 })).not.toThrow();
    expect(() => warpPath(path, { source: unitSource, destination: corners, mode: 'perspective', tolerance: 0.1 })).toThrow(RangeError);
  }
});

it('retains loops and collinear backtracking, including singular arcs and continuation after close', () => {
  const path = new PathGeometry();
  path.moveTo(0, 0); path.bezierCurveTo(10, 0, -10, 0, 0, 0); path.closePath();
  path.quadraticCurveTo(4, 0, 0, 0);
  path.moveTo(5, 0);
  path.spliceSegments(path.segmentCount, 0, [{ type: 'arc', cx: 0, cy: 0, ux: 5, uy: 0, vx: 0, vy: 0, startAngle: 0, sweep: -Math.PI * 2 }]);
  const result = Array.from(warpPath(path, { source: unitSource, destination: unitCorners, tolerance: 0.01 }));
  const xs = result.flatMap(s => s.type === 'line' ? [s.x] : []);
  expect(Math.max(...xs)).toBeCloseTo(5); expect(Math.min(...xs)).toBeCloseTo(-5);
  const close = result.findIndex(s => s.type === 'close');
  expect(result.slice(0, close).some(s => s.type === 'line' && s.x > 2)).toBe(true);
  expect(result.slice(0, close).some(s => s.type === 'line' && s.x < -2)).toBe(true);
  expect(result.slice(close).some(s => s.type === 'line' && s.x > 1)).toBe(true);
  expect(result.filter(s => s.type === 'move')).toHaveLength(2);
});

function distanceToLines(point: readonly [number, number], path: PathGeometry): number {
  let previous: readonly [number, number] = [0, 0], minimum = Infinity;
  for (const s of path) {
    if (s.type === 'move') previous = [s.x, s.y];
    if (s.type !== 'line') continue;
    const dx = s.x - previous[0], dy = s.y - previous[1];
    const t = Math.max(0, Math.min(1, ((point[0] - previous[0]) * dx + (point[1] - previous[1]) * dy) / (dx * dx + dy * dy) || 0));
    minimum = Math.min(minimum, Math.hypot(point[0] - previous[0] - t * dx, point[1] - previous[1] - t * dy));
    previous = [s.x, s.y];
  }
  return minimum;
}

it('approximates skewed full arcs and cubics after mapping, not their original controls', () => {
  for (const mode of ['bilinear', 'perspective'] as const) {
    const options = { source: unitSource, destination: {
      topLeft: { x: 0, y: 0 }, topRight: { x: 100, y: 0 }, bottomLeft: { x: 0, y: 100 }, bottomRight: { x: 100, y: 50 },
    }, mode, tolerance: 0.02 };
    const map = (x: number, y: number): readonly [number, number] => mode === 'bilinear' ? [100 * x, 100 * y - 50 * x * y] : [200 * x / (1 + x), 100 * y / (1 + x)];
    const arc = new PathGeometry(); arc.moveTo(0.8, 0.6);
    arc.spliceSegments(1, 0, [{ type: 'arc', cx: 0.5, cy: 0.5, ux: 0.3, uy: 0.1, vx: 0.15, vy: 0.3, startAngle: 0, sweep: -2 * Math.PI }]);
    const cubic = new PathGeometry(); cubic.moveTo(0, 0); cubic.bezierCurveTo(1, 1, 0, 1, 1, 0);
    const warpedArc = warpPath(arc, options), warpedCubic = warpPath(cubic, options);
    for (let i = 0; i <= 400; i++) {
      const t = i / 400, angle = -2 * Math.PI * t;
      expect(distanceToLines(map(0.5 + 0.3 * Math.cos(angle) + 0.15 * Math.sin(angle), 0.5 + 0.1 * Math.cos(angle) + 0.3 * Math.sin(angle)), warpedArc)).toBeLessThanOrEqual(0.02000001);
      expect(distanceToLines(map(3 * (1 - t) ** 2 * t + t ** 3, 3 * (1 - t) * t), warpedCubic)).toBeLessThanOrEqual(0.02000001);
    }
  }
});

it('certifies finite curves with mixed control weights and rejects a tangent pole', () => {
  const options = { source: unitSource, destination: { ...unitCorners, bottomRight: { x: 1, y: 0.5 } }, mode: 'perspective' as const, tolerance: 0.01 };
  const path = new PathGeometry(); path.moveTo(0, 0); path.quadraticCurveTo(-1.5, 0.5, 0, 1);
  // W controls = [1, -.5, 1], but W(t) >= .25 over the curve.
  expect(() => warpPath(path, options)).not.toThrow();
  path.setSegment(1, { type: 'quadratic', cpx: -2, cpy: 0.5, x: 0, y: 1 });
  expect(() => warpPath(path, options)).toThrow(RangeError);
  path.clear(); path.moveTo(-0.99, 0); path.lineTo(-0.99, 0.001);
  expect(() => warpPath(path, options)).not.toThrow();
});

it('validates empty inputs, rejects malformed options, and bounds output without changing input', () => {
  const path = new PathGeometry();
  const valid = { source: unitSource, destination: unitCorners, tolerance: 0.01 };
  expect(warpPath(path, valid).segmentCount).toBe(0);
  expect(warpPath(path, valid)).not.toBe(path);
  for (const options of [
    { ...valid, tolerance: 0 }, { ...valid, tolerance: Infinity },
    { ...valid, source: { ...unitSource, width: -1 } },
    { ...valid, maxSegments: 0 }, { ...valid, maxSegments: 1.5 },
    { ...valid, maxSegments: Number.MAX_SAFE_INTEGER + 1 },
    { ...valid, destination: { ...unitCorners, topLeft: { x: NaN, y: 0 } } },
  ]) expect(() => warpPath(path, options)).toThrow(RangeError);
  for (const options of [null, {}, { ...valid, mode: 'other' }, { ...valid, mode: null }, { ...valid, maxSegments: null }]) {
    expect(() => warpPath(path, options as never)).toThrow(TypeError);
  }
  path.moveTo(0, 0); path.quadraticCurveTo(0, 100, 1, 0); path.closePath();
  const before = Array.from(path), revision = path.revision;
  expect(() => warpPath(path, { ...valid, maxSegments: 2 })).toThrow(/maxSegments/);
  expect(() => warpPath(path, { ...valid, tolerance: Number.MIN_VALUE })).toThrow(RangeError);
  expect(Array.from(path)).toEqual(before); expect(path.revision).toBe(revision);
});

it('snapshots option coordinates and reports numerical overflow instead of silently dropping output', () => {
  const corners = structuredClone(unitCorners);
  const path = new PathGeometry(); path.moveTo(0, 0); path.lineTo(1, 1);
  const output = warpPath(path, { source: unitSource, destination: corners, tolerance: 0.01 });
  const before = Array.from(output);
  corners.bottomRight.x = 999; path.clear();
  expect(Array.from(output)).toEqual(before);
  path.moveTo(Number.MAX_VALUE, Number.MAX_VALUE);
  expect(() => warpPath(path, { source: unitSource, destination: corners, tolerance: 0.01 })).toThrow(RangeError);
});

it('keeps a finite perspective line exact without subdividing its nonlinear parameter spacing', () => {
  const path = new PathGeometry(); path.moveTo(0, 0); path.lineTo(1, 1);
  const result = warpPath(path, { source: unitSource, destination: { ...unitCorners, bottomRight: { x: 1, y: 0.5 } },
    mode: 'perspective', tolerance: 0.00001, maxSegments: 2 });
  expect(Array.from(result)).toEqual([{ type: 'move', x: 0, y: 0 }, { type: 'line', x: 1, y: 0.5 }]);
});

it('warps implicit arc connections and resumes from contour start after Close', () => {
  const path = new PathGeometry();
  path.spliceSegments(0, 0, [
    { type: 'move', x: 0, y: 0 },
    { type: 'arc', cx: 0.5, cy: 0.5, ux: 0.25, uy: 0, vx: 0, vy: 0.25, startAngle: 0, sweep: Math.PI },
    { type: 'close' }, { type: 'close' }, { type: 'line', x: 1, y: 1 },
  ]);
  const output = Array.from(warpPath(path, { source: unitSource, destination: { ...unitCorners, bottomRight: { x: 2, y: 1 } }, tolerance: 0.0001 }));
  expect(output).toContainEqual({ type: 'line', x: 1.125, y: 0.5 });
  const lastClose = output.findLastIndex(s => s.type === 'close');
  expect(output.slice(lastClose + 1)).toContainEqual({ type: 'line', x: 0.75, y: 0.5 });
  expect(output.at(-1)).toEqual({ type: 'line', x: 2, y: 1 });
});

it('handles rank-zero arcs, move-only contours, and both extreme coordinate scales', () => {
  for (const scale of [1e-120, 1e120]) {
    const path = new PathGeometry(); path.moveTo(0.5, 0.5);
    path.spliceSegments(1, 0, [{ type: 'arc', cx: 0.5, cy: 0.5, ux: 0, uy: 0, vx: 0, vy: 0, startAngle: 0, sweep: 2 * Math.PI }, { type: 'move', x: 1, y: 1 }]);
    const destination = { topLeft: { x: 0, y: 0 }, topRight: { x: scale, y: 0 }, bottomLeft: { x: 0, y: scale }, bottomRight: { x: scale, y: scale } };
    for (const mode of ['bilinear', 'perspective'] as const) {
      const output = Array.from(warpPath(path, { source: unitSource, destination, mode, tolerance: scale * 0.01 }));
      expect(output.at(-1)).toEqual({ type: 'move', x: scale, y: scale });
      for (const s of output.slice(0, -1)) {
        if (s.type === 'move' || s.type === 'line') {
          expect(s.x / scale).toBeCloseTo(0.5, 12); expect(s.y / scale).toBeCloseTo(0.5, 12);
        }
      }
    }
  }
});

it('counts canonical output segments rather than ignored redundant closes against the cap', () => {
  const path = new PathGeometry();
  path.spliceSegments(0, 0, [{ type: 'move', x: 0, y: 0 }, { type: 'close' }, { type: 'close' }]);
  const output = warpPath(path, { source: unitSource, destination: unitCorners, tolerance: 0.1, maxSegments: 2 });
  expect(Array.from(output)).toEqual([{ type: 'move', x: 0, y: 0 }, { type: 'close' }]);
});
