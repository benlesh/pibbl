import { flattenPathWang, PathGeometry, simplifyPathRadial } from '@pibbl/core';
import { describe, expect, it } from 'vitest';

describe('alternate path algorithms', () => {
  it('flattens Béziers and affine arcs with bounded line segments', () => {
    const tolerance = 0.1;
    const arc = new PathGeometry();
    const arcStart: Point = [
      20 * Math.cos(Math.PI / 4) * Math.cos(-Math.PI / 2) - 4 * Math.sin(Math.PI / 4) * Math.sin(-Math.PI / 2),
      10 + 20 * Math.sin(Math.PI / 4) * Math.cos(-Math.PI / 2) + 4 * Math.cos(Math.PI / 4) * Math.sin(-Math.PI / 2),
    ];
    arc.moveTo(...arcStart);
    arc.ellipse(0, 10, 20, 4, Math.PI / 4, -Math.PI / 2, Math.PI * 1.25);
    const paths = [
      build(path => path.quadraticCurveTo(10, 20, 20, 0)),
      build(path => path.bezierCurveTo(4, -20, 16, 20, 20, 0)),
      arc,
    ];

    for (const [index, path] of paths.entries()) {
      const flattened = flattenPathWang(path, { tolerance });
      const segments = Array.from(flattened);
      expect(segments[0]).toEqual(Array.from(path)[0]);
      expect(segments.every(segment => segment.type === 'move' || segment.type === 'line')).toBe(true);
      expect(maximumDistanceToPolyline(path, flattened), `path ${index}`).toBeLessThanOrEqual(tolerance * 1.00001);
    }
  });

  it('has predictable limits and does not mutate its input', () => {
    const path = new PathGeometry();
    path.moveTo(0, 0);
    path.bezierCurveTo(0, 100, 100, 100, 100, 0);
    const revision = path.revision;

    expect(() => flattenPathWang(path, { tolerance: 0.01, maxSegments: 2 })).toThrow(RangeError);
    expect(() => flattenPathWang(path, { tolerance: 0 })).toThrow(RangeError);
    expect(path.revision).toBe(revision);
  });

  it('preserves degenerate curves, closed continuations, and singular arcs', () => {
    const path = new PathGeometry();
    path.spliceSegments(0, 0, [
      { type: 'move', x: 0, y: 0 },
      { type: 'quadratic', cpx: 5, cpy: 0, x: 10, y: 0 },
      { type: 'cubic', cp1x: 10 + 10 / 3, cp1y: 0, cp2x: 10 + 20 / 3, cp2y: 0, x: 20, y: 0 },
      { type: 'close' },
      { type: 'line', x: 10, y: 10 },
      { type: 'arc', cx: 10, cy: 10, ux: 5, uy: 0, vx: 0, vy: 0, startAngle: 0, sweep: Math.PI },
    ]);

    const result = Array.from(flattenPathWang(path, { tolerance: 0.1, maxSegments: 20 }));

    expect(result.slice(0, 5).map(segment => segment.type)).toEqual(['move', 'line', 'line', 'close', 'line']);
    expect(result[4]).toEqual({ type: 'line', x: 10, y: 10 });
    expect(result[5]).toEqual({ type: 'line', x: 15, y: 10 });
    expect(result.at(-1)).toEqual({ type: 'line', x: 5, y: 10 });
  });

  it('uses a split error budget for radial filtering and retains valid closed contours', () => {
    const open = new PathGeometry();
    open.moveTo(0, 0);
    for (let i = 1; i < 100; i++) open.lineTo(i, i % 2 ? 0.01 : -0.01);
    open.lineTo(100, 0);
    const ring = new PathGeometry();
    ring.moveTo(0, 0);
    ring.lineTo(0.01, 0);
    ring.lineTo(10, 0);
    ring.lineTo(10, 10);
    ring.lineTo(0, 10);
    ring.closePath();

    const simplified = simplifyPathRadial(open, { tolerance: 0.1 });
    const closed = Array.from(simplifyPathRadial(ring, { tolerance: 100 }));

    expect(maximumDistanceToPolyline(open, simplified)).toBeLessThanOrEqual(0.1 * 1.00001);
    expect(Array.from(simplified)).toHaveLength(2);
    expect(closed.at(-1)).toEqual({ type: 'close' });
    expect(closed.filter(segment => segment.type === 'line')).toHaveLength(2);
  });

  it('rejects curves for radial simplification without mutating the input', () => {
    const path = new PathGeometry();
    path.moveTo(0, 0);
    path.quadraticCurveTo(5, 5, 10, 0);
    const revision = path.revision;
    expect(() => simplifyPathRadial(path, { tolerance: 1 })).toThrow(TypeError);
    expect(path.revision).toBe(revision);
  });

  it('falls back to the exact default contract when a tolerance cannot be split', () => {
    const path = new PathGeometry();
    path.moveTo(0, 0);
    path.lineTo(1, 0);
    expect(Array.from(simplifyPathRadial(path, { tolerance: Number.MIN_VALUE })))
      .toEqual(Array.from(path));
  });
});

type Point = readonly [number, number];

function build(draw: (path: PathGeometry) => void): PathGeometry {
  const path = new PathGeometry();
  path.moveTo(0, 0);
  draw(path);
  return path;
}

function maximumDistanceToPolyline(original: PathGeometry, flattened: PathGeometry): number {
  const lines = segmentsAsLines(flattened);
  let maximum = 0;
  for (const sample of samples(original, 20_000)) {
    maximum = Math.max(maximum, Math.min(...lines.map(([a, b]) => pointSegmentDistance(sample, a, b))));
  }
  return maximum;
}

function segmentsAsLines(path: PathGeometry): Array<readonly [Point, Point]> {
  const lines: Array<readonly [Point, Point]> = [];
  let current: Point = [0, 0];
  let start: Point = [0, 0];
  for (const segment of path) {
    if (segment.type === 'move') current = start = [segment.x, segment.y];
    else if (segment.type === 'line') { const end: Point = [segment.x, segment.y]; lines.push([current, end]); current = end; }
    else if (segment.type === 'close') { lines.push([current, start]); current = start; }
  }
  return lines;
}

function* samples(path: PathGeometry, count: number): Iterable<Point> {
  let current: Point = [0, 0];
  for (const segment of path) {
    switch (segment.type) {
      case 'move': current = [segment.x, segment.y]; break;
      case 'line': {
        const start = current, end: Point = [segment.x, segment.y];
        for (let i = 0; i <= count; i++) yield interpolate(start, end, i / count);
        current = end;
        break;
      }
      case 'quadratic': {
        const start = current, control: Point = [segment.cpx, segment.cpy], end: Point = [segment.x, segment.y];
        for (let i = 0; i <= count; i++) yield quadratic(start, control, end, i / count);
        current = end;
        break;
      }
      case 'cubic': {
        const start = current, first: Point = [segment.cp1x, segment.cp1y], second: Point = [segment.cp2x, segment.cp2y], end: Point = [segment.x, segment.y];
        for (let i = 0; i <= count; i++) yield cubic(start, first, second, end, i / count);
        current = end;
        break;
      }
      case 'arc':
        for (let i = 0; i <= count; i++) {
          const angle = segment.startAngle + segment.sweep * i / count;
          yield [segment.cx + segment.ux * Math.cos(angle) + segment.vx * Math.sin(angle), segment.cy + segment.uy * Math.cos(angle) + segment.vy * Math.sin(angle)];
        }
        current = [segment.cx + segment.ux * Math.cos(segment.startAngle + segment.sweep), segment.cy + segment.uy * Math.cos(segment.startAngle + segment.sweep)];
        break;
      case 'close': break;
    }
  }
}

function quadratic(a: Point, b: Point, c: Point, t: number): Point { return interpolate(interpolate(a, b, t), interpolate(b, c, t), t); }
function cubic(a: Point, b: Point, c: Point, d: Point, t: number): Point { return interpolate(interpolate(interpolate(a, b, t), interpolate(b, c, t), t), interpolate(interpolate(b, c, t), interpolate(c, d, t), t), t); }
function interpolate(a: Point, b: Point, t: number): Point { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
function pointSegmentDistance(point: Point, a: Point, b: Point): number {
  const x = b[0] - a[0], y = b[1] - a[1], length = x * x + y * y;
  if (length === 0) return Math.hypot(point[0] - a[0], point[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * x + (point[1] - a[1]) * y) / length));
  return Math.hypot(point[0] - (a[0] + x * t), point[1] - (a[1] + y * t));
}
