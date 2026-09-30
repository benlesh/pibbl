import {
  flattenPath,
  PathGeometry,
  simplifyPath,
  subdividePath,
} from '@crc/core';
import { describe, expect, it } from 'vitest';

describe('editable path geometry utilities', () => {
  it('subdivides cubic, arc, and closing edges without changing the input', () => {
    const path = new PathGeometry();
    path.moveTo(0, 0);
    path.bezierCurveTo(0, 12, 12, 12, 12, 0);
    path.arc(12, 4, 4, -Math.PI / 2, Math.PI / 2);
    path.closePath();
    const revision = path.revision;

    const result = subdividePath(path, { divisions: 2 });

    expect(path.revision).toBe(revision);
    expect(Array.from(path)).toHaveLength(4);
    expect(Array.from(result).map(segment => segment.type))
      .toEqual(['move', 'cubic', 'cubic', 'arc', 'arc', 'line', 'line', 'close']);
    expect(Array.from(result)[1]).toMatchObject({
      type: 'cubic', cp1x: 0, cp1y: 6, cp2x: 3, cp2y: 9, x: 6, y: 9,
    });
    expect(Array.from(result)[3]).toMatchObject({
      type: 'arc', startAngle: -Math.PI / 2, sweep: Math.PI / 2,
    });
  });

  it('flattens curves and arcs into finite line segments while retaining contours', () => {
    const path = new PathGeometry();
    path.moveTo(0, 0);
    path.quadraticCurveTo(5, 10, 10, 0);
    path.arc(10, 5, 5, -Math.PI / 2, Math.PI / 2);
    path.closePath();

    const result = flattenPath(path, { tolerance: 0.1 });
    const segments = Array.from(result);

    expect(segments[0]).toEqual({ type: 'move', x: 0, y: 0 });
    expect(segments.at(-1)).toEqual({ type: 'close' });
    expect(segments.every(segment =>
      segment.type === 'move' || segment.type === 'line' || segment.type === 'close',
    )).toBe(true);
    expect(segments.length).toBeGreaterThan(5);
  });

  it('preserves Canvas implicit connections before edited arc segments', () => {
    const path = new PathGeometry();
    path.spliceSegments(0, 0, [
      { type: 'move', x: 0, y: 0 },
      { type: 'arc', cx: 10, cy: 5, ux: 5, uy: 0, vx: 0, vy: 5, startAngle: -Math.PI / 2, sweep: Math.PI },
    ]);

    expect(Array.from(subdividePath(path, { divisions: 2 })).map(segment => segment.type))
      .toEqual(['move', 'line', 'arc', 'arc']);
    expect(Array.from(flattenPath(path, { tolerance: 0.25 }))[1])
      .toEqual({ type: 'line', x: 10, y: 0 });
  });

  it('simplifies line-only contours without collapsing a closed ring', () => {
    const open = new PathGeometry();
    open.moveTo(0, 0);
    open.lineTo(5, 0.01);
    open.lineTo(10, 0);
    const ring = new PathGeometry();
    ring.moveTo(0, 0);
    ring.lineTo(10, 0);
    ring.lineTo(10, 10);
    ring.lineTo(0, 10);
    ring.closePath();

    expect(Array.from(simplifyPath(open, { tolerance: 0.1 })))
      .toEqual([{ type: 'move', x: 0, y: 0 }, { type: 'line', x: 10, y: 0 }]);
    const simplifiedRing = Array.from(simplifyPath(ring, { tolerance: 100 }));
    expect(simplifiedRing.at(-1)).toEqual({ type: 'close' });
    expect(simplifiedRing.filter(segment => segment.type === 'line')).toHaveLength(2);
  });

  it('retains three distinct vertices when a closed contour begins with duplicate points', () => {
    const path = new PathGeometry();
    path.moveTo(0, 0);
    path.lineTo(0, 0);
    path.lineTo(10, 0);
    path.lineTo(0, 10);
    path.closePath();

    const result = Array.from(simplifyPath(path, { tolerance: 100 }));

    expect(result).toEqual([
      { type: 'move', x: 0, y: 0 },
      { type: 'line', x: 10, y: 0 },
      { type: 'line', x: 0, y: 10 },
      { type: 'close' },
    ]);
  });

  it('retains a closed contour current point for lines that follow close markers', () => {
    const path = new PathGeometry();
    path.spliceSegments(0, 0, [
      { type: 'move', x: 0, y: 0 },
      { type: 'line', x: 10, y: 0 },
      { type: 'close' },
      { type: 'line', x: 10, y: 10 },
      { type: 'close' },
      { type: 'move', x: 20, y: 20 },
      { type: 'line', x: 30, y: 20 },
      { type: 'close' },
      { type: 'line', x: 30, y: 30 },
    ]);

    expect(Array.from(simplifyPath(path, { tolerance: 0.1 }))).toEqual([
      { type: 'move', x: 0, y: 0 },
      { type: 'line', x: 10, y: 0 },
      { type: 'close' },
      { type: 'line', x: 10, y: 10 },
      { type: 'close' },
      { type: 'move', x: 20, y: 20 },
      { type: 'line', x: 30, y: 20 },
      { type: 'close' },
      { type: 'line', x: 30, y: 30 },
    ]);
  });

  it('rejects invalid options and curved simplification without mutating input', () => {
    const curve = new PathGeometry();
    curve.moveTo(0, 0);
    curve.quadraticCurveTo(5, 5, 10, 0);
    const revision = curve.revision;

    expect(() => flattenPath(curve, { tolerance: 0 })).toThrow(RangeError);
    expect(() => subdividePath(curve, { divisions: 1.5 })).toThrow(RangeError);
    expect(() => simplifyPath(curve, { tolerance: 1 })).toThrow(TypeError);
    expect(curve.revision).toBe(revision);
  });
});
