import { describe, expect, it } from 'vitest';
import { LayoutDiagnostic } from '../style/diagnostics';
import { resolveBox } from './box';
import type { Constraints } from './types';

const constraints: Constraints = {
  minWidth: 0,
  maxWidth: 320,
  minHeight: 0,
  maxHeight: 200,
};

describe('resolveBox', () => {
  it('resolves content-box sizes, clamps them, then adds padding', () => {
    expect(
      resolveBox(
        { width: '50%', height: 40, minWidth: 180, padding: 10 },
        constraints,
      ),
    ).toEqual({
      borderBox: { x: 0, y: 0, width: 200, height: 60 },
      contentBox: { x: 10, y: 10, width: 180, height: 40 },
    });
  });

  it('normalizes asymmetric padding and defaults overflow independently', () => {
    expect(
      resolveBox(
        {
          width: 100,
          height: 50,
          padding: { top: 1, right: 2, bottom: 3, left: 4 },
          overflow: 'clip',
        },
        constraints,
      ),
    ).toEqual({
      borderBox: { x: 0, y: 0, width: 106, height: 54 },
      contentBox: { x: 4, y: 1, width: 100, height: 50 },
    });
  });

  it('uses the finite allocation when width and height are auto or omitted', () => {
    expect(resolveBox({ width: 'auto', padding: 10 }, constraints)).toEqual({
      borderBox: { x: 0, y: 0, width: 320, height: 200 },
      contentBox: { x: 10, y: 10, width: 300, height: 180 },
    });
    expect(resolveBox({}, constraints)).toEqual({
      borderBox: { x: 0, y: 0, width: 320, height: 200 },
      contentBox: { x: 0, y: 0, width: 320, height: 200 },
    });
  });

  it('honors outer constraints without allowing padding to make content negative', () => {
    expect(
      resolveBox(
        { width: 100, height: 40, padding: { left: 80, right: 80 } },
        { ...constraints, maxWidth: 120 },
      ),
    ).toEqual({
      borderBox: { x: 0, y: 0, width: 120, height: 40 },
      contentBox: { x: 80, y: 0, width: 0, height: 40 },
    });
  });

  it('applies minimum and maximum style constraints before padding', () => {
    expect(
      resolveBox(
        {
          width: 20,
          height: 180,
          minWidth: 50,
          maxWidth: 90,
          minHeight: 30,
          maxHeight: 60,
          padding: 5,
        },
        constraints,
      ),
    ).toEqual({
      borderBox: { x: 0, y: 0, width: 60, height: 70 },
      contentBox: { x: 5, y: 5, width: 50, height: 60 },
    });
  });

  it('rejects negative and non-finite allocation values', () => {
    expect(() => resolveBox({ width: -1 }, constraints)).toThrow(
      /width.*nonnegative/,
    );
    expect(() => resolveBox({ minHeight: -1 }, constraints)).toThrow(
      /minHeight.*nonnegative/,
    );
    expect(() => resolveBox({ maxWidth: Number.NaN }, constraints)).toThrow(
      /maxWidth.*finite/,
    );
    expect(() =>
      resolveBox(
        { width: 10 },
        { ...constraints, minWidth: Number.POSITIVE_INFINITY },
      ),
    ).toThrow(/constraints\.minWidth.*finite/);
    expect(() =>
      resolveBox({ width: 10 }, { ...constraints, maxHeight: Number.NaN }),
    ).toThrow(/constraints\.maxHeight.*finite/);
  });

  it('rejects inverted style and allocation constraints', () => {
    expect(() =>
      resolveBox({ minWidth: 100, maxWidth: 50 }, constraints),
    ).toThrow(/minWidth.*100.*maxWidth.*50/);
    expect(() =>
      resolveBox({}, { ...constraints, minHeight: 100, maxHeight: 50 }),
    ).toThrow(/constraints\.minHeight.*100.*constraints\.maxHeight.*50/);
  });

  it('allows an unbounded maximum only for definite numeric sizes', () => {
    const unbounded = { ...constraints, maxWidth: Number.POSITIVE_INFINITY };
    expect(resolveBox({ width: 42, height: 10 }, unbounded)).toEqual({
      borderBox: { x: 0, y: 0, width: 42, height: 10 },
      contentBox: { x: 0, y: 0, width: 42, height: 10 },
    });
    expect(() => resolveBox({ width: '50%', height: 10 }, unbounded)).toThrow(
      /width.*50%.*definite/,
    );
    expect(() => resolveBox({ width: 'auto', height: 10 }, unbounded)).toThrow(
      /width.*auto.*definite/,
    );
  });

  it('rejects finite box inputs whose arithmetic would overflow', () => {
    const unbounded = { ...constraints, maxWidth: Number.POSITIVE_INFINITY };
    const resolveOverflowingBox = () =>
      resolveBox(
        {
          width: Number.MAX_VALUE,
          height: 10,
          minWidth: Number.MAX_VALUE,
          padding: { left: Number.MAX_VALUE, right: Number.MAX_VALUE },
        },
        unbounded,
        { component: 'absolute', algorithm: 'absolute-layout' },
      );

    expect(resolveOverflowingBox).toThrow(LayoutDiagnostic);
    expect(resolveOverflowingBox).toThrow(
      /absolute.*width.*Infinity.*absolute-layout.*maxWidth.*finite/,
    );
  });

  it('reports component, property, value, algorithm, and constraints', () => {
    expect(() =>
      resolveBox({ width: 'bogus' as any }, constraints, {
        component: 'overlay',
        algorithm: 'overlay-layout',
      }),
    ).toThrow(/overlay.*width.*bogus.*overlay-layout.*minWidth.*maxWidth.*320/);
  });
});
