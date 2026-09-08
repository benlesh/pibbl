import { afterEach, describe, expect, it } from 'vitest';
import { createEllipsePath } from './ellipse';
import { installRecordingPath2D } from './recording-path2d.test-util';

let recording: ReturnType<typeof installRecordingPath2D> | undefined;

afterEach(() => recording?.restore());

describe('createEllipsePath', () => {
  it('uses zero defaults and records one full-turn ellipse', () => {
    recording = installRecordingPath2D();

    expect(recording.commands(createEllipsePath({ radiusX: 6, radiusY: 3 }))).toEqual([
      ['ellipse', 0, 0, 6, 3, 0, 0, Math.PI * 2, undefined],
    ]);
  });

  it('creates empty paths when either radius is zero', () => {
    recording = installRecordingPath2D();

    expect(recording.commands(createEllipsePath({ radiusX: 0, radiusY: 3 }))).toEqual([]);
    expect(recording.commands(createEllipsePath({ radiusX: 6, radiusY: 0 }))).toEqual([]);
  });

  it('creates fresh paths', () => {
    recording = installRecordingPath2D();
    const options = { cx: 1, cy: 2, radiusX: 3, radiusY: 4, rotation: 0.5 } as const;

    expect(createEllipsePath(options)).not.toBe(createEllipsePath(options));
  });

  it('rejects non-finite values and negative radii', () => {
    recording = installRecordingPath2D();

    expect(() => createEllipsePath({ cx: Number.NaN, radiusX: 1, radiusY: 1 }))
      .toThrowError(/cx.*finite/);
    expect(() => createEllipsePath({ cy: Number.POSITIVE_INFINITY, radiusX: 1, radiusY: 1 }))
      .toThrowError(/cy.*finite/);
    expect(() => createEllipsePath({ radiusX: Number.NaN, radiusY: 1 }))
      .toThrowError(/radiusX.*finite/);
    expect(() => createEllipsePath({ radiusX: 1, radiusY: Number.NEGATIVE_INFINITY }))
      .toThrowError(/radiusY.*finite/);
    expect(() => createEllipsePath({ radiusX: -1, radiusY: 1 }))
      .toThrowError(/radiusX.*nonnegative/);
    expect(() => createEllipsePath({ radiusX: 1, radiusY: -1 }))
      .toThrowError(/radiusY.*nonnegative/);
    expect(() => createEllipsePath({ radiusX: 1, radiusY: 1, rotation: Number.NaN }))
      .toThrowError(/rotation.*finite/);
  });

  it('produces a usable platform path', () => {
    recording = installRecordingPath2D();
    recording.restore();
    const context = document.createElement('canvas').getContext('2d')!;
    const path = createEllipsePath({ cx: 20, cy: 20, radiusX: 10, radiusY: 5 });

    expect(context.isPointInPath(path, 20, 20)).toBe(true);
    expect(context.isPointInPath(path, 25, 20)).toBe(true);
    expect(context.isPointInPath(path, 40, 20)).toBe(false);
  });
});
