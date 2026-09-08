import { afterEach, describe, expect, it } from 'vitest';
import { installRecordingPath2D } from './recording-path2d.test-util';
import { createPolygonPath } from './polygon';

let recording: ReturnType<typeof installRecordingPath2D> | undefined;

afterEach(() => recording?.restore());

describe('createPolygonPath', () => {
  it('creates an empty path for fewer than three validated points', () => {
    recording = installRecordingPath2D();

    expect(recording.commands(createPolygonPath({ coords: [] }))).toEqual([]);
    expect(recording.commands(createPolygonPath({
      coords: [[0, 0], [10, 10]],
      cornerRadius: 3,
    }))).toEqual([]);
    expect(() => createPolygonPath({
      coords: [[0, 0], [Number.NaN, 10]],
    })).toThrowError(/coords\[1\]\[0\].*finite/);
  });

  it('uses the canonical sharp closed path for all-zero effective radii', () => {
    recording = installRecordingPath2D();

    expect(recording.commands(createPolygonPath({
      coords: [[0, 0], [20, 0], [10, 10]],
      cornerRadius: 0,
    }))).toEqual([
      ['moveTo', 0, 0],
      ['lineTo', 20, 0],
      ['lineTo', 10, 10],
      ['closePath'],
    ]);
  });

  it('resolves uniform and per-corner values into rounded traversal', () => {
    recording = installRecordingPath2D();

    const commands = recording.commands(createPolygonPath({
      coords: [[0, 0], [40, 0], [40, 40], [0, 40]],
      cornerRadius: 8,
      cornerRadii: [0, null, 3],
    }));

    expect(commands.map(([name]) => name)).toEqual([
      'moveTo', 'lineTo', 'arcTo', 'arcTo', 'arcTo', 'closePath',
    ]);
    expect(commands[0]).toEqual(['moveTo', 0, 0]);
    expect(commands[1]).toEqual(['lineTo', 0, 0]);
    expect(commands.filter(command => command[0] === 'arcTo')
      .map(command => command[5])).toEqual([8, 3, 8]);
    expect(commands.at(-1)).toEqual(['closePath']);
  });

  it('rejects invalid direct options with exact RangeError paths', () => {
    recording = installRecordingPath2D();

    const invalidCases: readonly [Record<string, unknown>, RegExp][] = [
      [{ cornerRadius: Number.NaN }, /cornerRadius.*finite/],
      [{ cornerRadius: -1 }, /cornerRadius.*nonnegative/],
      [{ cornerRadii: [1, Number.POSITIVE_INFINITY] }, /cornerRadii\[1\].*finite/],
      [{ cornerRadii: [1, -1] }, /cornerRadii\[1\].*nonnegative/],
      [{ cornerRadii: [1, 2, 3, null] }, /cornerRadii.*length.*3/],
    ];

    for (const [cornerOptions, expected] of invalidCases) {
      expect(() => createPolygonPath({
        coords: [[0, 0], [20, 0], [10, 10]],
        ...cornerOptions,
      } as Parameters<typeof createPolygonPath>[0])).toThrowError(RangeError);
      expect(() => createPolygonPath({
        coords: [[0, 0], [20, 0], [10, 10]],
        ...cornerOptions,
      } as Parameters<typeof createPolygonPath>[0])).toThrowError(expected);
    }
  });

  it('creates a fresh path without rejecting self-intersection', () => {
    recording = installRecordingPath2D();
    const options = {
      coords: [[0, 0], [40, 40], [0, 40], [40, 0]],
      cornerRadius: 2,
    } as const;

    expect(createPolygonPath(options)).not.toBe(createPolygonPath(options));
    expect(recording.commands(createPolygonPath(options))
      .filter(([name]) => name === 'arcTo')).toHaveLength(4);
  });
});
