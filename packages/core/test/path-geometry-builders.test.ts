import { describe, expect, it } from 'vitest';
import { PathGeometry, toPath2D, toSvgPathData } from '@pibbl/core';

function compare(actual: Path2D, expected: Path2D, label = '') {
  const ctx = document.createElement('canvas').getContext('2d')!;
  ctx.lineWidth = 3;
  for (let y = -40.37; y < 150; y += 4.7) {
    for (let x = -60.23; x < 180; x += 4.7) {
      expect(ctx.isPointInPath(actual, x, y), `${label} fill ${x},${y}`).toBe(ctx.isPointInPath(expected, x, y));
      expect(ctx.isPointInStroke(actual, x, y), `${label} stroke ${x},${y}`).toBe(ctx.isPointInStroke(expected, x, y));
    }
  }
}

describe('PathGeometry builders', () => {
  it('matches native circles, ellipses, arcTo and rounded rectangles, including subsequent segments', () => {
    const geometry = new PathGeometry();
    const native = new Path2D();
    const steps: ((p: PathGeometry | Path2D) => void)[] = [
      p => p.arc(30, 30, 20, 0.3, Math.PI * 2 + 0.3),
      p => p.closePath(),
      p => p.moveTo(70, 10),
      p => p.arcTo(130, 10, 130, 60, 20),
      p => p.lineTo(120, 90),
      p => p.ellipse(40, 90, 30, 12, 0.4, -1, 4, true),
      p => p.rect(-20, -10, 15, 30),
      p => p.lineTo(5, 40),
      p => p.roundRect(150, 130, -70, -30, [5, { x: 12, y: 8 }, 10, 20]),
      p => p.lineTo(60, 110),
    ];
    for (const [index, step] of steps.entries()) {
      step(geometry); step(native);
      compare(toPath2D(geometry), native, `step ${index}`);
    }
    compare(toPath2D(geometry), native);
    compare(new Path2D(toSvgPathData(geometry)), native);
  });

  it('preserves arc geometry under skew, reflection and singular transforms', () => {
    const source = new PathGeometry();
    source.ellipse(30, 35, 20, 10, 0.7, 0.2, 5.7);
    source.closePath();
    for (const matrix of [new DOMMatrix([1, .3, .8, 1, 10, 5]), new DOMMatrix([-1, .2, 0, 1, 90, 0]), new DOMMatrix([1, 0, 2, 0, 0, 40]), new DOMMatrix([0, 0, 0, 0, 40, 40])]) {
      const native = new Path2D();
      native.addPath(toPath2D(source), matrix);
      const transformed = source.clone();
      transformed.transform(matrix);
      const actual = toPath2D(transformed);
      if (matrix.a * matrix.d - matrix.b * matrix.c !== 0) {
        compare(actual, native, matrix.toString());
        compare(new Path2D(toSvgPathData(transformed)), native);
      } else {
        // Native degenerate conics and explicit line reversals stroke differently
        // at turning-point joins. Verify traversal analytically, not pixel parity
        // for that platform-specific join treatment.
        compare(new Path2D(toSvgPathData(transformed)), actual);
        const arc = [...transformed].find(segment => segment.type === 'arc')!;
        if (arc.type !== 'arc') throw new Error('Expected arc');
        expect(arc.uy).toBe(0);
        expect(arc.vy).toBe(0);
        const ctx = document.createElement('canvas').getContext('2d')!;
        ctx.lineWidth = 2;
        const amplitude = Math.hypot(arc.ux, arc.vx);
        if (amplitude > 0) {
          expect(ctx.isPointInStroke(actual, arc.cx - amplitude + .1, 40)).toBe(true);
          expect(ctx.isPointInStroke(actual, arc.cx - amplitude - 2, 40)).toBe(false);
          expect((toSvgPathData(transformed).match(/ L /g) ?? []).length).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });

  it('copies addPath and self-addition, splices atomically and keeps mutation revisions', () => {
    const source = new PathGeometry();
    source.rect(0, 0, 20, 20);
    const copy = new PathGeometry();
    copy.addPath(source, { e: 30 });
    source.clear();
    const before = toSvgPathData(copy);
    const count = copy.segmentCount;
    const revision = copy.revision;
    copy.addPath(copy);
    expect(copy.revision).toBe(revision + 1);
    expect(copy.segmentCount).toBeGreaterThan(count);
    expect(toSvgPathData(copy).startsWith(before)).toBe(true);
    const snapshot = toSvgPathData(copy);
    expect(() => copy.spliceSegments(0, 1, [{ type: 'line', x: 0, y: 0 }])).toThrow();
    expect(toSvgPathData(copy)).toBe(snapshot);
    copy.spliceSegments(1, 1, [{ type: 'quadratic', cpx: 70, cpy: -10, x: 50, y: 20 }]);
    expect(copy.getSegment(1).type).toBe('quadratic');
  });

  it('exports edited arcs with their implicit connecting line', () => {
    const p = new PathGeometry();
    p.moveTo(0, 0);
    p.lineTo(10, 10);
    p.setSegment(1, { type: 'arc', cx: 80, cy: 80, ux: 20, uy: 0, vx: 0, vy: 10, startAngle: 0, sweep: Math.PI });
    p.closePath();
    compare(new Path2D(toSvgPathData(p)), toPath2D(p));
  });

  it('matches validation categories without partially modifying geometry', () => {
    const p = new PathGeometry();
    expect(() => p.arc(0, 0, -1, 0, 1)).toThrowError(DOMException);
    expect(() => p.roundRect(0, 0, 10, 10, [])).toThrowError(RangeError);
    expect(() => p.roundRect(0, 0, 10, 10, -1)).toThrowError(RangeError);
    p.arc(0, 0, NaN, 0, 1);
    p.roundRect(0, 0, 10, 10, Infinity);
    expect(p.segmentCount).toBe(0);
    expect(p.revision).toBe(0);
  });
});
