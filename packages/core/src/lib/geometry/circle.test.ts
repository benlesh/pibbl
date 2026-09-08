import { afterEach, describe, expect, it } from 'vitest';
import { createCirclePath } from './circle';
import { installRecordingPath2D } from './recording-path2d.test-util';

let recording: ReturnType<typeof installRecordingPath2D> | undefined;

afterEach(() => recording?.restore());

describe('createCirclePath', () => {
  it('uses zero defaults and records one full-turn arc', () => {
    recording = installRecordingPath2D();

    expect(recording.commands(createCirclePath({ radius: 4 }))).toEqual([
      ['arc', 0, 0, 4, 0, Math.PI * 2, undefined],
    ]);
  });

  it('creates empty paths for a zero radius', () => {
    recording = installRecordingPath2D();

    expect(recording.commands(createCirclePath({ radius: 0 }))).toEqual([]);
  });

  it('creates fresh paths', () => {
    recording = installRecordingPath2D();
    const options = { cx: 1, cy: 2, radius: 3 } as const;

    expect(createCirclePath(options)).not.toBe(createCirclePath(options));
  });

  it('rejects non-finite values and negative radius', () => {
    recording = installRecordingPath2D();

    expect(() => createCirclePath({ cx: Number.NaN, radius: 1 }))
      .toThrowError(/cx.*finite/);
    expect(() => createCirclePath({ cy: Number.POSITIVE_INFINITY, radius: 1 }))
      .toThrowError(/cy.*finite/);
    expect(() => createCirclePath({ radius: Number.NEGATIVE_INFINITY }))
      .toThrowError(/radius.*finite/);
    expect(() => createCirclePath({ radius: -1 }))
      .toThrowError(/radius.*nonnegative/);
  });

  it('produces a usable platform path', () => {
    recording = installRecordingPath2D();
    recording.restore();
    const context = document.createElement('canvas').getContext('2d')!;
    const path = createCirclePath({ cx: 20, cy: 20, radius: 10 });

    expect(context.isPointInPath(path, 20, 20)).toBe(true);
    expect(context.isPointInPath(path, 25, 20)).toBe(true);
    expect(context.isPointInPath(path, 40, 20)).toBe(false);
  });
});
