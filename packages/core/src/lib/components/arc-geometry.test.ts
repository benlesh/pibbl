import { describe, expect, it, vi } from 'vitest';
import {
  arcBounds,
  createArcPath,
  createWedgePath,
  resolveCircularSweep,
  wedgeBounds,
} from './arc-geometry';

const fullTurn = Math.PI * 2;

describe('resolveCircularSweep', () => {
  it('keeps a zero span empty in either direction', () => {
    expect(resolveCircularSweep(1, 1, false)).toMatchObject({
      sweep: 0,
      fullCircle: false,
    });
    expect(resolveCircularSweep(1, 1, true)).toMatchObject({
      sweep: 0,
      fullCircle: false,
    });
  });

  it('normalizes clockwise short and long sweeps into [0, 2π)', () => {
    expect(resolveCircularSweep(0, Math.PI / 2, false).sweep)
      .toBe(Math.PI / 2);
    expect(resolveCircularSweep(0, -Math.PI / 2, false).sweep)
      .toBe(Math.PI * 1.5);
  });

  it('normalizes counterclockwise short and long sweeps into (-2π, 0]', () => {
    expect(resolveCircularSweep(0, -Math.PI / 2, true).sweep)
      .toBe(-Math.PI / 2);
    expect(resolveCircularSweep(0, Math.PI / 2, true).sweep)
      .toBe(-Math.PI * 1.5);
  });

  it('recognizes only direction-matching differences of at least one turn as full', () => {
    expect(resolveCircularSweep(0, fullTurn, false)).toMatchObject({
      sweep: fullTurn,
      fullCircle: true,
    });
    expect(resolveCircularSweep(fullTurn, 0, true)).toMatchObject({
      sweep: -fullTurn,
      fullCircle: true,
    });
    expect(resolveCircularSweep(0, fullTurn + 1, false)).toMatchObject({
      sweep: fullTurn,
      fullCircle: true,
    });
    expect(resolveCircularSweep(fullTurn + 1, 0, true)).toMatchObject({
      sweep: -fullTurn,
      fullCircle: true,
    });
  });

  it('normalizes opposite-direction full-turn differences instead of making them full', () => {
    expect(resolveCircularSweep(0, -fullTurn, false)).toMatchObject({
      sweep: 0,
      fullCircle: false,
    });
    expect(resolveCircularSweep(0, fullTurn, true)).toMatchObject({
      sweep: 0,
      fullCircle: false,
    });
    expect(resolveCircularSweep(0, -(fullTurn + Math.PI / 2), false))
      .toMatchObject({ sweep: Math.PI * 1.5, fullCircle: false });
    expect(resolveCircularSweep(0, fullTurn + Math.PI / 2, true))
      .toMatchObject({ sweep: -Math.PI * 1.5, fullCircle: false });
  });
});

describe('arc path geometry', () => {
  it('builds an arc from the normalized signed sweep', () => {
    const arc = vi.spyOn(Path2D.prototype, 'arc');
    const sweep = resolveCircularSweep(0, -Math.PI / 2, false);

    createArcPath(10, 20, 30, sweep);

    expect(arc).toHaveBeenCalledWith(10, 20, 30, 0, Math.PI * 1.5, false);
    arc.mockRestore();
  });

  it('builds a partial wedge with center and radial segments', () => {
    const moveTo = vi.spyOn(Path2D.prototype, 'moveTo');
    const lineTo = vi.spyOn(Path2D.prototype, 'lineTo');
    const arc = vi.spyOn(Path2D.prototype, 'arc');
    const closePath = vi.spyOn(Path2D.prototype, 'closePath');
    const sweep = resolveCircularSweep(0, Math.PI / 2, false);

    createWedgePath(10, 20, 30, sweep);

    expect(moveTo).toHaveBeenCalledWith(10, 20);
    expect(lineTo).toHaveBeenCalledWith(40, 20);
    expect(arc).toHaveBeenCalledWith(10, 20, 30, 0, Math.PI / 2, false);
    expect(closePath).toHaveBeenCalledOnce();
    vi.restoreAllMocks();
  });

  it('builds a full wedge without center or radial segments', () => {
    const moveTo = vi.spyOn(Path2D.prototype, 'moveTo');
    const lineTo = vi.spyOn(Path2D.prototype, 'lineTo');
    const arc = vi.spyOn(Path2D.prototype, 'arc');
    const closePath = vi.spyOn(Path2D.prototype, 'closePath');
    const sweep = resolveCircularSweep(0, fullTurn, false);

    createWedgePath(10, 20, 30, sweep);

    expect(moveTo).not.toHaveBeenCalled();
    expect(lineTo).not.toHaveBeenCalled();
    expect(arc).toHaveBeenCalledWith(10, 20, 30, 0, fullTurn, false);
    expect(closePath).toHaveBeenCalledOnce();
    vi.restoreAllMocks();
  });
});

describe('arc and wedge bounds', () => {
  it('returns no bounds for empty arc geometry', () => {
    expect(arcBounds(0, 0, 10, resolveCircularSweep(0, 0, false)))
      .toBeUndefined();
    expect(arcBounds(0, 0, 0, resolveCircularSweep(0, Math.PI, false)))
      .toBeUndefined();
  });

  it('includes endpoints and every cardinal extremum in a clockwise sweep', () => {
    const bounds = arcBounds(
      10,
      20,
      8,
      resolveCircularSweep(Math.PI / 4, Math.PI * 1.25, false),
    )!;

    expect(bounds.x).toBeCloseTo(2);
    expect(bounds.y).toBeCloseTo(20 - Math.SQRT1_2 * 8);
    expect(bounds.width).toBeCloseTo(8 + Math.SQRT1_2 * 8);
    expect(bounds.height).toBeCloseTo(8 + Math.SQRT1_2 * 8);
  });

  it('includes only cardinals contained by a counterclockwise sweep', () => {
    const bounds = arcBounds(
      10,
      20,
      8,
      resolveCircularSweep(Math.PI / 4, -Math.PI / 4, true),
    )!;

    expect(bounds.x).toBeCloseTo(10 + Math.SQRT1_2 * 8);
    expect(bounds.y).toBeCloseTo(20 - Math.SQRT1_2 * 8);
    expect(bounds.width).toBeCloseTo(8 - Math.SQRT1_2 * 8);
    expect(bounds.height).toBeCloseTo(Math.SQRT1_2 * 16);
  });

  it('returns the circle bounds for a full sweep', () => {
    expect(arcBounds(10, 20, 8, resolveCircularSweep(0, fullTurn, false)))
      .toEqual({ x: 2, y: 12, width: 16, height: 16 });
  });

  it('includes the center in partial wedge bounds', () => {
    const bounds = wedgeBounds(
      0,
      0,
      10,
      resolveCircularSweep(-Math.PI / 4, Math.PI / 4, false),
    )!;

    expect(bounds.x).toBe(0);
    expect(bounds.y).toBeCloseTo(-Math.SQRT1_2 * 10);
    expect(bounds.width).toBe(10);
    expect(bounds.height).toBeCloseTo(Math.SQRT1_2 * 20);
  });
});
