import { afterEach, describe, expect, it } from 'vitest';
import { installRecordingPath2D } from './recording-path2d.test-util';
import {
  createRegularPolygonPath,
  resolveRegularPolygonGeometry,
  type RegularPolygonPathOptions,
} from './regular-polygon';

let recording: ReturnType<typeof installRecordingPath2D> | undefined;

afterEach(() => {
  recording?.restore();
  recording = undefined;
});

function generatedVertices(options: Readonly<RegularPolygonPathOptions>) {
  recording = installRecordingPath2D();
  const commands = recording.commands(createRegularPolygonPath(options));
  const vertices = commands
    .filter(command => command[0] === 'moveTo' || command[0] === 'lineTo')
    .map(command => [command[1], command[2]] as const);
  recording.restore();
  recording = undefined;
  return vertices;
}

describe('createRegularPolygonPath', () => {
  it('defaults the center and rotation and generates vertices clockwise', () => {
    const vertices = generatedVertices({ sides: 4, circumradius: 10 });

    expect(vertices).toHaveLength(4);
    expect(vertices[0][0]).toBeCloseTo(0, 10);
    expect(vertices[0][1]).toBeCloseTo(-10, 10);
    expect(vertices[1][0]).toBeCloseTo(10, 10);
    expect(vertices[1][1]).toBeCloseTo(0, 10);
    expect(vertices[2][0]).toBeCloseTo(0, 10);
    expect(vertices[2][1]).toBeCloseTo(10, 10);
    expect(vertices[3][0]).toBeCloseTo(-10, 10);
    expect(vertices[3][1]).toBeCloseTo(0, 10);
  });

  it('uses an explicit center and rotation', () => {
    const vertices = generatedVertices({
      sides: 3,
      cx: 20,
      cy: 30,
      circumradius: 10,
      rotation: 0,
    });

    expect(vertices[0]).toEqual([30, 30]);
    expect(vertices[1][0]).toBeCloseTo(15, 10);
    expect(vertices[1][1]).toBeCloseTo(30 + 5 * Math.sqrt(3), 10);
    expect(vertices[2][0]).toBeCloseTo(15, 10);
    expect(vertices[2][1]).toBeCloseTo(30 - 5 * Math.sqrt(3), 10);
  });

  it('normalizes circumradius, inradius, and side length with the approved formulas', () => {
    const sides = 6;
    const circumradius = 20;
    const inradius = circumradius * Math.cos(Math.PI / sides);
    const sideLength = 2 * circumradius * Math.sin(Math.PI / sides);

    const byCircumradius = generatedVertices({ sides, circumradius });
    for (const equivalent of [
      generatedVertices({ sides, inradius }),
      generatedVertices({ sides, sideLength }),
    ]) {
      equivalent.forEach(([x, y], index) => {
        expect(x).toBeCloseTo(byCircumradius[index][0], 10);
        expect(y).toBeCloseTo(byCircumradius[index][1], 10);
      });
    }

    const inradiusGeometry = resolveRegularPolygonGeometry({ sides: 4, inradius: 10 });
    const sideLengthGeometry = resolveRegularPolygonGeometry({ sides: 4, sideLength: 10 });
    expect(inradiusGeometry.vertices[0][1]).toBeCloseTo(-10 / Math.cos(Math.PI / 4), 10);
    expect(sideLengthGeometry.vertices[0][1]).toBeCloseTo(-10 / (2 * Math.sin(Math.PI / 4)), 10);
  });

  it('returns a fresh empty path for zero size after validating corner arrays', () => {
    recording = installRecordingPath2D();
    const options = { sides: 4, cx: 5, cy: 6, circumradius: 0 } as const;
    const first = createRegularPolygonPath(options);
    const second = createRegularPolygonPath(options);
    const geometry = resolveRegularPolygonGeometry(options);

    expect(first).not.toBe(second);
    expect(recording.commands(first)).toEqual([]);
    expect(recording.commands(second)).toEqual([]);
    expect(recording.commands(geometry.path)).toEqual([]);
    expect(geometry.vertices).toEqual([
      [5, 6],
      [5, 6],
      [5, 6],
      [5, 6],
    ]);
    expect(geometry.bounds).toEqual({ x: 5, y: 6, width: 0, height: 0 });
    expect(() => createRegularPolygonPath({
      ...options,
      cornerRadii: [0, 0, 0, 0, null],
    })).toThrowError(/cornerRadii.*length.*4/);
  });

  it('uses generated vertex order for rounded-corner indices and canonical traversal', () => {
    recording = installRecordingPath2D();
    const commands = recording.commands(createRegularPolygonPath({
      sides: 4,
      circumradius: 50,
      cornerRadii: [1, 2, 3, 4],
    }));

    expect(commands.map(([name]) => name)).toEqual([
      'moveTo', 'arcTo', 'arcTo', 'arcTo', 'arcTo', 'closePath',
    ]);
    expect(commands.filter(command => command[0] === 'arcTo').map(command =>
      [command[1], command[2], command[5]],
    )).toEqual([
      [expect.closeTo(0, 10), -50, 1],
      [50, expect.closeTo(0, 10), 2],
      [expect.closeTo(0, 10), 50, 3],
      [-50, expect.closeTo(0, 10), 4],
    ]);
  });

  it('rejects invalid sides before allocating or traversing geometry', () => {
    recording = installRecordingPath2D();

    for (const sides of [Number.NaN, Number.POSITIVE_INFINITY, 2, 3.5]) {
      expect(() => createRegularPolygonPath({ sides, circumradius: 10 }))
        .toThrowError(RangeError);
    }
    expect(() => createRegularPolygonPath({ sides: 2, circumradius: 10 }))
      .toThrowError(/sides.*at least 3/);
    expect(() => createRegularPolygonPath({ sides: 3.5, circumradius: 10 }))
      .toThrowError(/sides.*integer/);
  });

  it('requires exactly one size option at runtime', () => {
    recording = installRecordingPath2D();
    const invalid = [
      { sides: 6 },
      { sides: 6, circumradius: 10, inradius: 5 },
      { sides: 6, circumradius: 10, sideLength: 5 },
      { sides: 6, inradius: 5, sideLength: 5 },
      { sides: 6, circumradius: 10, inradius: 5, sideLength: 5 },
    ];

    for (const options of invalid) {
      expect(() => createRegularPolygonPath(
        options as unknown as RegularPolygonPathOptions,
      )).toThrowError(RangeError);
      expect(() => createRegularPolygonPath(
        options as unknown as RegularPolygonPathOptions,
      )).toThrowError(/circumradius\|inradius\|sideLength.*exactly one/);
    }
  });

  it('rejects non-finite positions, rotation, sizes, and corner radii with exact paths', () => {
    recording = installRecordingPath2D();
    const invalid: readonly [RegularPolygonPathOptions, RegExp][] = [
      [{ sides: 4, cx: Number.NaN, circumradius: 1 }, /cx.*finite/],
      [{ sides: 4, cy: Number.NEGATIVE_INFINITY, circumradius: 1 }, /cy.*finite/],
      [{ sides: 4, rotation: Number.POSITIVE_INFINITY, circumradius: 1 }, /rotation.*finite/],
      [{ sides: 4, circumradius: Number.NaN }, /circumradius.*finite/],
      [{ sides: 4, inradius: -1 }, /inradius.*nonnegative/],
      [{ sides: 4, sideLength: Number.POSITIVE_INFINITY }, /sideLength.*finite/],
      [{ sides: 4, circumradius: 1, cornerRadius: -1 }, /cornerRadius.*nonnegative/],
      [{ sides: 4, circumradius: 1, cornerRadii: [0, Number.NaN] }, /cornerRadii\[1\].*finite/],
    ];

    for (const [options, expected] of invalid) {
      expect(() => createRegularPolygonPath(options)).toThrowError(RangeError);
      expect(() => createRegularPolygonPath(options)).toThrowError(expected);
    }
  });

  it('produces browser geometry containing its center but not a bounding-box corner', () => {
    recording = installRecordingPath2D();
    recording.restore();
    recording = undefined;
    const context = document.createElement('canvas').getContext('2d')!;
    const path = createRegularPolygonPath({
      sides: 6,
      cx: 40,
      cy: 40,
      circumradius: 20,
    });

    expect(context.isPointInPath(path, 40, 40)).toBe(true);
    expect(context.isPointInPath(path, 20, 20)).toBe(false);
  });
});
