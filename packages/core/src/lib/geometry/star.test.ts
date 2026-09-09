import { afterEach, describe, expect, it } from 'vitest';
import { installRecordingPath2D } from './recording-path2d.test-util';
import {
  createStarPath,
  resolveStarGeometry,
  type StarPathOptions,
} from './star';

let recording: ReturnType<typeof installRecordingPath2D> | undefined;

afterEach(() => {
  recording?.restore();
  recording = undefined;
});

function generatedVertices(options: Readonly<StarPathOptions>) {
  recording = installRecordingPath2D();
  const commands = recording.commands(createStarPath(options));
  const vertices = commands
    .filter(command => command[0] === 'moveTo' || command[0] === 'lineTo')
    .map(command => [command[1], command[2]] as const);
  recording.restore();
  recording = undefined;
  return vertices;
}

describe('createStarPath', () => {
  it('defaults its center and rotation and generates alternating vertices clockwise', () => {
    const vertices = generatedVertices({
      points: 5,
      outerRadius: 20,
      innerRadius: 8,
    });

    expect(vertices).toHaveLength(10);
    expect(vertices[0][0]).toBeCloseTo(0, 10);
    expect(vertices[0][1]).toBeCloseTo(-20, 10);
    expect(Math.hypot(...vertices[1])).toBeCloseTo(8, 10);
    expect(vertices[1][0]).toBeGreaterThan(vertices[0][0]);
    expect(vertices[1][1]).toBeGreaterThan(vertices[0][1]);
    expect(Math.hypot(...vertices[2])).toBeCloseTo(20, 10);
  });

  it('uses an explicit center and rotation', () => {
    const vertices = generatedVertices({
      points: 3,
      cx: 20,
      cy: 30,
      outerRadius: 10,
      innerRadius: 4,
      rotation: 0,
    });

    expect(vertices[0]).toEqual([30, 30]);
    expect(vertices[1][0]).toBeCloseTo(22, 10);
    expect(vertices[1][1]).toBeCloseTo(30 + 2 * Math.sqrt(3), 10);
    expect(vertices[2][0]).toBeCloseTo(15, 10);
    expect(vertices[2][1]).toBeCloseTo(30 + 5 * Math.sqrt(3), 10);
  });

  it('allows equal radii and produces a regular points-times-two polygon', () => {
    const vertices = generatedVertices({
      points: 4,
      outerRadius: 10,
      innerRadius: 10,
    });

    expect(vertices).toHaveLength(8);
    vertices.forEach(([x, y]) => {
      expect(Math.hypot(x, y)).toBeCloseTo(10, 10);
    });
    expect(vertices[1][0]).toBeCloseTo(5 * Math.sqrt(2), 10);
    expect(vertices[1][1]).toBeCloseTo(-5 * Math.sqrt(2), 10);
  });

  it('returns fresh empty paths for either zero radius after validating corners', () => {
    recording = installRecordingPath2D();
    const innerZero = {
      points: 5,
      cx: 5,
      cy: 6,
      outerRadius: 20,
      innerRadius: 0,
    } as const;
    const bothZero = {
      points: 3,
      cx: 5,
      cy: 6,
      outerRadius: 0,
      innerRadius: 0,
    } as const;
    const first = createStarPath(innerZero);
    const second = createStarPath(innerZero);
    const geometry = resolveStarGeometry(innerZero);

    expect(first).not.toBe(second);
    expect(recording.commands(first)).toEqual([]);
    expect(recording.commands(second)).toEqual([]);
    expect(recording.commands(createStarPath(bothZero))).toEqual([]);
    expect(recording.commands(geometry.path)).toEqual([]);
    expect(geometry.vertices).toHaveLength(10);
    expect(geometry.vertices[0][0]).toBeCloseTo(5, 10);
    expect(geometry.vertices[0][1]).toBeCloseTo(-14, 10);
    expect(geometry.vertices[1]).toEqual([5, 6]);
    expect(geometry.bounds).toBeUndefined();
    expect(() => createStarPath({
      ...innerZero,
      cornerRadii: Array.from({ length: 11 }, () => 0),
    })).toThrowError(/cornerRadii.*length.*10/);
  });

  it('uses generated tip and valley order for canonical rounded traversal', () => {
    recording = installRecordingPath2D();
    const commands = recording.commands(createStarPath({
      points: 5,
      outerRadius: 20,
      innerRadius: 10,
      cornerRadii: [4, 1],
    }));
    const roundedCorners = commands.filter(command => command[0] === 'arcTo');

    expect(commands.map(([name]) => name)).toEqual([
      'moveTo', 'arcTo', 'arcTo',
      'lineTo', 'lineTo', 'lineTo', 'lineTo', 'lineTo', 'lineTo', 'lineTo', 'lineTo',
      'closePath',
    ]);
    expect(roundedCorners[0]).toEqual([
      'arcTo', expect.closeTo(0, 10), -20,
      expect.any(Number), expect.any(Number), 4,
    ]);
    expect(roundedCorners[1]).toEqual([
      'arcTo',
      expect.closeTo(10 * Math.cos(-3 * Math.PI / 10), 10),
      expect.closeTo(10 * Math.sin(-3 * Math.PI / 10), 10),
      expect.any(Number), expect.any(Number), 1,
    ]);
  });

  it('builds one concave twelve-corner six-point silhouette without crossing strokes', () => {
    recording = installRecordingPath2D();
    const commands = recording.commands(createStarPath({
      points: 6,
      outerRadius: 20,
      innerRadius: 8,
    }));

    expect(commands.filter(([name]) => name === 'moveTo')).toHaveLength(1);
    expect(commands.filter(([name]) => name === 'lineTo')).toHaveLength(11);
    expect(commands.at(-1)).toEqual(['closePath']);
  });

  it('rejects invalid point counts, geometry, ordering, and corners with direct RangeErrors', () => {
    recording = installRecordingPath2D();
    const invalid: readonly [StarPathOptions, RegExp][] = [
      [{ points: 2, outerRadius: 10, innerRadius: 5 }, /points.*at least 3/],
      [{ points: 3.5, outerRadius: 10, innerRadius: 5 }, /points.*integer/],
      [{ points: Number.NaN, outerRadius: 10, innerRadius: 5 }, /points.*finite/],
      [{ points: 5, cx: Number.NaN, outerRadius: 10, innerRadius: 5 }, /cx.*finite/],
      [{ points: 5, cy: Number.NEGATIVE_INFINITY, outerRadius: 10, innerRadius: 5 }, /cy.*finite/],
      [{ points: 5, outerRadius: Number.POSITIVE_INFINITY, innerRadius: 5 }, /outerRadius.*finite/],
      [{ points: 5, outerRadius: -1, innerRadius: 0 }, /outerRadius.*nonnegative/],
      [{ points: 5, outerRadius: 10, innerRadius: -1 }, /innerRadius.*nonnegative/],
      [{ points: 5, outerRadius: 10, innerRadius: 5, rotation: Number.NaN }, /rotation.*finite/],
      [{ points: 5, outerRadius: 8, innerRadius: 9 }, /innerRadius.*outerRadius/],
      [{ points: 5, outerRadius: 10, innerRadius: 5, cornerRadius: -1 }, /cornerRadius.*nonnegative/],
      [{ points: 5, outerRadius: 10, innerRadius: 5, cornerRadii: [0, Number.NaN] }, /cornerRadii\[1\].*finite/],
      [{
        points: 5,
        outerRadius: 10,
        innerRadius: 5,
        cornerRadii: Array.from({ length: 11 }, () => 0),
      }, /cornerRadii.*length.*10/],
    ];

    for (const [options, expected] of invalid) {
      expect(() => createStarPath(options)).toThrowError(RangeError);
      expect(() => createStarPath(options)).toThrowError(expected);
    }
  });

  it('creates a fresh path for each valid call', () => {
    recording = installRecordingPath2D();
    const options = { points: 5, outerRadius: 20, innerRadius: 8 } as const;

    expect(createStarPath(options)).not.toBe(createStarPath(options));
  });

  it('contains its center and arm while excluding a notch and bounding-box corner', () => {
    recording = installRecordingPath2D();
    recording.restore();
    recording = undefined;
    const context = document.createElement('canvas').getContext('2d')!;
    const path = createStarPath({
      points: 5,
      cx: 40,
      cy: 40,
      outerRadius: 20,
      innerRadius: 8,
    });

    expect(context.isPointInPath(path, 40, 40)).toBe(true);
    expect(context.isPointInPath(path, 40, 25)).toBe(true);
    expect(context.isPointInPath(path, 48, 25)).toBe(false);
    expect(context.isPointInPath(path, 20, 20)).toBe(false);
  });
});
