import { afterEach, describe, expect, it } from 'vitest';
import { createLinePath } from './line';
import { installRecordingPath2D } from './recording-path2d.test-util';

let recording: ReturnType<typeof installRecordingPath2D> | undefined;

afterEach(() => recording?.restore());

describe('createLinePath', () => {
  it('creates empty and move-only paths without adding line segments', () => {
    recording = installRecordingPath2D();

    expect(recording.commands(createLinePath({ coords: [] }))).toEqual([]);
    expect(recording.commands(createLinePath({ coords: [[1, 2]] }))).toEqual([
      ['moveTo', 1, 2],
    ]);
  });

  it('creates ordered segments and leaves paths open by default', () => {
    recording = installRecordingPath2D();

    expect(recording.commands(createLinePath({
      coords: [[1, 2], [3, 4], [5, 6]],
    }))).toEqual([
      ['moveTo', 1, 2],
      ['lineTo', 3, 4],
      ['lineTo', 5, 6],
    ]);
  });

  it('closes a line only when requested', () => {
    recording = installRecordingPath2D();

    expect(recording.commands(createLinePath({
      coords: [[1, 2], [3, 4]],
      closePath: true,
    }))).toEqual([
      ['moveTo', 1, 2],
      ['lineTo', 3, 4],
      ['closePath'],
    ]);
  });

  it('creates fresh paths from readonly coordinates', () => {
    recording = installRecordingPath2D();
    const options = {
      coords: [[1, 2], [3, 4]],
    } as const;

    expect(createLinePath(options)).not.toBe(createLinePath(options));
  });

  it('rejects non-finite coordinates with exact option paths', () => {
    recording = installRecordingPath2D();

    expect(() => createLinePath({ coords: [[0, 0], [Number.NaN, 1]] }))
      .toThrowError(/coords\[1\]\[0\].*finite/);
    expect(() => createLinePath({ coords: [[0, 0], [1, Number.NaN]] }))
      .toThrowError(/coords\[1\]\[1\].*finite/);
  });

  it('produces usable platform paths after restoring Path2D', () => {
    recording = installRecordingPath2D();
    recording.restore();
    const context = document.createElement('canvas').getContext('2d')!;
    context.lineWidth = 4;

    expect(context.isPointInStroke(createLinePath({
      coords: [[0, 0], [20, 0]],
    }), 10, 1)).toBe(true);
  });
});
