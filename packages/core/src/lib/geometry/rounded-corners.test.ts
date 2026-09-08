import { afterEach, describe, expect, it } from 'vitest';
import { installRecordingPath2D } from './recording-path2d.test-util';
import {
  createRoundedClosedPolygonPath,
  resolveNumericCornerRadii,
} from './rounded-corners';

let recording: ReturnType<typeof installRecordingPath2D> | undefined;

afterEach(() => recording?.restore());

describe('resolveNumericCornerRadii', () => {
  it('expands a uniform radius to the actual corner count', () => {
    expect(resolveNumericCornerRadii(4, { cornerRadius: 5 }))
      .toEqual([5, 5, 5, 5]);
    expect(resolveNumericCornerRadii(3, {})).toEqual([0, 0, 0]);
  });

  it('uses nullish fallback while preserving explicit zero overrides', () => {
    const sparse = [0, null, 3, undefined] as (number | null | undefined)[];
    delete sparse[3];

    expect(resolveNumericCornerRadii(5, {
      cornerRadius: 5,
      cornerRadii: sparse,
    })).toEqual([0, 5, 3, 5, 5]);
  });

  it('rejects overlong arrays against the actual corner count', () => {
    expect(() => resolveNumericCornerRadii(3, {
      cornerRadii: [1, 2, 3, null],
    })).toThrowError(/cornerRadii.*length.*3/);
  });

  it('validates every supplied radius even when fallback would not select it', () => {
    expect(() => resolveNumericCornerRadii(2, {
      cornerRadius: -1,
      cornerRadii: [2, 3],
    })).toThrowError(/cornerRadius.*nonnegative/);
    expect(() => resolveNumericCornerRadii(2, {
      cornerRadius: 4,
      cornerRadii: [2, Number.NaN],
    })).toThrowError(/cornerRadii\[1\].*finite/);
    expect(() => resolveNumericCornerRadii(2, {
      cornerRadii: [Number.POSITIVE_INFINITY],
    })).toThrowError(/cornerRadii\[0\].*finite/);
    expect(() => resolveNumericCornerRadii(2, {
      cornerRadii: [-1],
    })).toThrowError(/cornerRadii\[0\].*nonnegative/);
  });
});

describe('createRoundedClosedPolygonPath', () => {
  it('rounds vertex zero and traverses every square corner before closing', () => {
    recording = installRecordingPath2D();

    const commands = recording.commands(createRoundedClosedPolygonPath([
      [0, 0],
      [40, 0],
      [40, 40],
      [0, 40],
    ], [8, 8, 8, 8]));

    expect(commands.map(([name]) => name)).toEqual([
      'moveTo', 'arcTo', 'arcTo', 'arcTo', 'arcTo', 'closePath',
    ]);
    expect(commands[0][1]).toBe(0);
    expect(commands[0][2]).toBeCloseTo(8);
    expect(commands[1].slice(1, 3)).toEqual([0, 0]);
    expect(commands[1][3]).toBeCloseTo(8);
    expect(commands[1][4]).toBe(0);
    expect(commands[1][5]).toBe(8);
    expect(commands.at(-1)).toEqual(['closePath']);
  });

  it('uses the canonical closed-line traversal when every radius is zero', () => {
    recording = installRecordingPath2D();

    expect(recording.commands(createRoundedClosedPolygonPath([
      [0, 0],
      [20, 0],
      [10, 10],
    ], [0, 0, 0]))).toEqual([
      ['moveTo', 0, 0],
      ['lineTo', 20, 0],
      ['lineTo', 10, 10],
      ['closePath'],
    ]);
  });

  it('applies one global scale to unequal radii constrained by a short edge', () => {
    recording = installRecordingPath2D();
    const requested = [12, 6, 9, 3];
    const coords = [
      [0, 0],
      [10, 0],
      [10, 40],
      [0, 40],
    ] as const;
    const expectedScale = 5 / 9;

    const commands = recording.commands(
      createRoundedClosedPolygonPath(coords, requested),
    );
    const recordedArcRadii = commands
      .filter(command => command[0] === 'arcTo')
      .map(command => command[5]);

    expect(recordedArcRadii).toHaveLength(4);
    requested.forEach((radius, index) => {
      expect(recordedArcRadii[index]).toBeCloseTo(radius * expectedScale, 10);
    });
  });

  it('rounds convex, concave, near-collinear, and self-intersecting traversal', () => {
    recording = installRecordingPath2D();
    const cases = [
      [[0, 0], [40, 0], [40, 40], [0, 40]],
      [[0, 0], [40, 0], [20, 20], [40, 40], [0, 40]],
      [[0, 0], [20, Number.EPSILON], [40, 0], [40, 40], [0, 40]],
      [[0, 0], [40, 40], [0, 40], [40, 0]],
    ] as const;

    for (const coords of cases) {
      const commands = recording.commands(
        createRoundedClosedPolygonPath(coords, coords.map(() => 4)),
      );
      expect(commands.filter(([name]) => name === 'arcTo'))
        .toHaveLength(coords.length);
      expect(commands.at(-1)).toEqual(['closePath']);
    }
  });

  it('keeps duplicate and exactly collinear corners sharp', () => {
    recording = installRecordingPath2D();

    const duplicateCommands = recording.commands(
      createRoundedClosedPolygonPath([
        [0, 0], [40, 0], [40, 0], [40, 40], [0, 40],
      ], [4, 4, 4, 4, 4]),
    );
    expect(duplicateCommands.filter(([name]) => name === 'arcTo')).toHaveLength(3);
    expect(duplicateCommands.filter(([name]) => name === 'lineTo')).toHaveLength(2);

    const collinearCommands = recording.commands(
      createRoundedClosedPolygonPath([
        [0, 0], [20, 0], [40, 0], [40, 40], [0, 40],
      ], [4, 4, 4, 4, 4]),
    );
    expect(collinearCommands.filter(([name]) => name === 'arcTo')).toHaveLength(4);
    expect(collinearCommands.filter(([name]) => name === 'lineTo')).toHaveLength(1);
  });

  it('does not mistake finite non-collinear large-coordinate rays for collinear rays', () => {
    recording = installRecordingPath2D();

    const commands = recording.commands(
      createRoundedClosedPolygonPath([
        [0, 0],
        [1e155, 5e154],
        [1e155, 1e155],
      ], [1, 1, 1]),
    );

    expect(commands.map(([name]) => name)).toEqual([
      'moveTo', 'arcTo', 'arcTo', 'arcTo', 'closePath',
    ]);
    expect(commands[1].slice(0, 3)).toEqual(['arcTo', 0, 0]);
  });

  it('produces usable convex and concave platform paths', () => {
    recording = installRecordingPath2D();
    recording.restore();
    const context = document.createElement('canvas').getContext('2d')!;

    const convex = createRoundedClosedPolygonPath([
      [0, 0], [40, 0], [40, 40], [0, 40],
    ], [10, 10, 10, 10]);
    expect(context.isPointInPath(convex, 1, 1)).toBe(false);
    expect(context.isPointInPath(convex, 20, 20)).toBe(true);

    const concave = createRoundedClosedPolygonPath([
      [0, 0], [50, 0], [50, 50], [25, 25], [0, 50],
    ], [5, 5, 5, 5, 5]);
    expect(context.isPointInPath(concave, 15, 15)).toBe(true);
  });
});
