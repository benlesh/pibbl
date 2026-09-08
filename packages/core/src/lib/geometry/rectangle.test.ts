import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installRecordingPath2D } from './recording-path2d.test-util';
import { createRectanglePath } from './rectangle';

let recording: ReturnType<typeof installRecordingPath2D> | undefined;

beforeEach(() => {
  recording = installRecordingPath2D();
});

afterEach(() => {
  recording?.restore();
  recording = undefined;
});

describe('createRectanglePath', () => {
  it('uses rect for a sharp rectangle with default origin', () => {
    expect(record(createRectanglePath({ width: 30, height: 20 }))).toEqual([
      ['rect', 0, 0, 30, 20],
    ]);
  });

  it('preserves signed dimensions and delegates expanded radii to roundRect', () => {
    expect(record(createRectanglePath({
      x: 3,
      y: 4,
      width: -30,
      height: 20,
      cornerRadius: 6,
      cornerRadii: [0, null, 2],
    }))).toEqual([['roundRect', 3, 4, -30, 20, [0, 6, 2, 6]]]);
  });

  it('uses nullish fallback for sparse corner radii', () => {
    const radii: (number | null | undefined)[] = [1, undefined, null];
    delete radii[1];
    expect(record(createRectanglePath({
      width: 30,
      height: 20,
      cornerRadius: 5,
      cornerRadii: radii,
    }))).toEqual([['roundRect', 0, 0, 30, 20, [1, 5, 5, 5]]]);
  });

  it('rejects invalid options before allocating a path', () => {
    expect(() => createRectanglePath({ width: Number.NaN, height: 1 }))
      .toThrow(/width.*finite.*NaN/);
    expect(() => createRectanglePath({ width: 1, height: Number.POSITIVE_INFINITY }))
      .toThrow(/height.*finite.*Infinity/);
    expect(() => createRectanglePath({ width: 1, height: 1, cornerRadii: [0, 0, 0, 0, null] }))
      .toThrow(/cornerRadii.*length.*4/);
  });

  it('returns fresh paths and leaves fitting oversized radii to Canvas', () => {
    const first = createRectanglePath({ width: 3, height: 2, cornerRadius: 100 });
    const second = createRectanglePath({ width: 3, height: 2, cornerRadius: 100 });
    expect(first).not.toBe(second);
    expect(record(first)).toEqual([['roundRect', 0, 0, 3, 2, [100, 100, 100, 100]]]);
  });

  it('uses browser roundRect geometry for positive and signed rectangles', () => {
    recording?.restore();
    recording = undefined;
    const context = document.createElement('canvas').getContext('2d')!;
    const positive = createRectanglePath({ x: 20, y: 20, width: 40, height: 30, cornerRadius: 10 });
    const signed = createRectanglePath({ x: 60, y: 20, width: -40, height: 30, cornerRadius: 10 });

    expect(context.isPointInPath(positive, 21, 21)).toBe(false);
    expect(context.isPointInPath(positive, 30, 30)).toBe(true);
    expect(context.isPointInPath(signed, 59, 21)).toBe(false);
    expect(context.isPointInPath(signed, 50, 30)).toBe(true);
  });
});

function record(path: Path2D) {
  return recording!.commands(path);
}
