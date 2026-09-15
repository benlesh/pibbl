import { describe, expect, it } from 'vitest';
import {
  arcShape2D,
  boundsOfShape2D,
  boxShape2D,
  capsuleShape2D,
  chainShape2D,
  circleShape2D,
  ellipseShape2D,
  massProperties2D,
  polygonShape2D,
  roundedBoxShape2D,
  segmentShape2D,
  transformShape2D,
  wedgeShape2D,
  type CRCPhysicsAabb2D,
  type CRCPhysicsShape2D,
} from '../../2d-geometry.js';
import { requireShapeRecord2D } from './shape-records.js';

describe('immutable 2D shape factories', () => {
  it('copies every caller-owned numeric array and freezes every shape shell', () => {
    const circleCenter: [number, number] = [1, 2];
    const ellipseCenter: [number, number] = [2, 3];
    const boxCenter: [number, number] = [3, 4];
    const roundedCenter: [number, number] = [4, 5];
    const roundedRadii: [number, number, number, number] = [1, 2, 3, 4];
    const capsuleStart: [number, number] = [0, 0];
    const capsuleEnd: [number, number] = [4, 0];
    const arcCenter: [number, number] = [5, 6];
    const wedgeCenter: [number, number] = [6, 7];
    const segmentStart: [number, number] = [1, 1];
    const segmentEnd: [number, number] = [5, 1];
    const chainPoints: [number, number][] = [[0, 0], [2, 0], [2, 2]];
    const polygonPoints: [number, number][] = [[0, 0], [3, 0], [0, 3]];

    const cases: readonly [CRCPhysicsShape2D, CRCPhysicsAabb2D][] = [
      [circleShape2D({ radius: 1, center: circleCenter }), bounds(0, 1, 2, 3)],
      [ellipseShape2D({ radiusX: 2, radiusY: 1, center: ellipseCenter }), bounds(0, 2, 4, 4)],
      [boxShape2D({ width: 2, height: 4, center: boxCenter }), bounds(2, 2, 4, 6)],
      [roundedBoxShape2D({ width: 10, height: 10, radius: roundedRadii, center: roundedCenter }), bounds(-1, 0, 9, 10)],
      [capsuleShape2D({ start: capsuleStart, end: capsuleEnd, radius: 1 }), bounds(-1, -1, 5, 1)],
      [arcShape2D({ center: arcCenter, radius: 2, startAngleRadians: 0, endAngleRadians: Math.PI / 2, thickness: 1 }), bounds(4.5, 5.5, 7.5, 8.5)],
      [wedgeShape2D({ center: wedgeCenter, radius: 2, startAngleRadians: 0, endAngleRadians: Math.PI / 2 }), bounds(6, 7, 8, 9)],
      [segmentShape2D({ start: segmentStart, end: segmentEnd }), bounds(1, 1, 5, 1)],
      [chainShape2D({ points: chainPoints }), bounds(0, 0, 2, 2)],
      [polygonShape2D({ points: polygonPoints }), bounds(0, 0, 3, 3)],
    ];

    circleCenter[0] = 100;
    ellipseCenter[0] = 100;
    boxCenter[0] = 100;
    roundedCenter[0] = 100;
    roundedRadii[0] = 0;
    capsuleStart[0] = 100;
    capsuleEnd[0] = 100;
    arcCenter[0] = 100;
    wedgeCenter[0] = 100;
    segmentStart[0] = 100;
    segmentEnd[0] = 100;
    chainPoints[0]![0] = 100;
    chainPoints.push([100, 100]);
    polygonPoints[0]![0] = 100;
    polygonPoints.push([100, 100]);

    for (const [shape, expectedBounds] of cases) {
      expect(Object.isFrozen(shape)).toBe(true);
      expect(boundsOfShape2D(shape)).toEqual(expectedBounds);
    }
    const roundedLeaf = requireShapeRecord2D(cases[3]![0]).leaves[0];
    expect(roundedLeaf?.kind).toBe('rounded-box');
    if (roundedLeaf?.kind === 'rounded-box') {
      expect([...roundedLeaf.radii]).toEqual([1, 2, 3, 4]);
    }
  });

  it('preserves the full rounded-box contour between deterministic corner arcs', () => {
    const properties = massProperties2D(roundedBoxShape2D({
      width: 10,
      height: 10,
      radius: 1,
    }));

    expect(properties.area).toBeCloseTo(100 - (4 - Math.PI), 0);
    expect(properties.centroid[0]).toBeCloseTo(0, 14);
    expect(properties.centroid[1]).toBeCloseTo(0, 14);

    const circleLike = roundedBoxShape2D({ width: 2, height: 2, radius: 1 });
    expect(boundsOfShape2D(circleLike)).toEqual(bounds(-1, -1, 1, 1));
    expect(massProperties2D(circleLike).area).toBeCloseTo(Math.PI, 0);
  });

  it('rejects nonfinite and invalid dimensions synchronously', () => {
    const invalidFactories: readonly (() => unknown)[] = [
      () => circleShape2D({ radius: Number.NaN }),
      () => circleShape2D({ radius: -1 }),
      () => ellipseShape2D({ radiusX: 1, radiusY: Number.POSITIVE_INFINITY }),
      () => ellipseShape2D({ radiusX: -1, radiusY: 1 }),
      () => boxShape2D({ width: Number.NaN, height: 1 }),
      () => boxShape2D({ width: 1, height: -1 }),
      () => roundedBoxShape2D({ width: 4, height: 4, radius: -1 }),
      () => roundedBoxShape2D({ width: 4, height: 4, radius: [0, 0, Number.NaN, 0] }),
      () => capsuleShape2D({ start: [0, 0], end: [1, 0], radius: -1 }),
      () => arcShape2D({ radius: 1, startAngleRadians: Number.NaN, endAngleRadians: 1, thickness: 1 }),
      () => arcShape2D({ radius: 1, startAngleRadians: 0, endAngleRadians: 1, thickness: -1 }),
      () => wedgeShape2D({ radius: -1, startAngleRadians: 0, endAngleRadians: 1 }),
      () => segmentShape2D({ start: [0, 0], end: [Number.NaN, 1] }),
      () => chainShape2D({ points: [[0, 0], [1, 0]], radius: -1 }),
      () => chainShape2D({ points: [[0, 0], [1, Number.NaN]] }),
      () => polygonShape2D({ points: [[0, 0], [1, 0], [0, Number.NaN]] }),
    ];

    for (const create of invalidFactories) {
      expect(create).toThrow();
    }
  });

  it('normalizes polygon winding, closing vertex, and starting vertex', () => {
    const first = polygonShape2D({ points: [[2, 0], [2, 2], [0, 2], [0, 0]] });
    const second = polygonShape2D({ points: [[0, 0], [0, 2], [2, 2], [2, 0], [0, 0]] });

    expect(boundsOfShape2D(first)).toEqual(boundsOfShape2D(second));
    expect(massProperties2D(first)).toEqual(massProperties2D(second));
    const mass = massProperties2D(first);
    expect(mass.area).toBe(4);
    expect(mass.centroid).toEqual([1, 1]);
    expect(mass.mass).toBe(4);
    expect(mass.rotationalInertia).toBeCloseTo(8 / 3, 14);

    const firstVertices = requireShapeRecord2D(first).leaves[0];
    const secondVertices = requireShapeRecord2D(second).leaves[0];
    expect(firstVertices?.kind).toBe('polygon');
    expect(secondVertices?.kind).toBe('polygon');
    if (firstVertices?.kind === 'polygon' && secondVertices?.kind === 'polygon') {
      expect([...firstVertices.vertices]).toEqual([0, 0, 2, 0, 2, 2, 0, 2]);
      expect([...secondVertices.vertices]).toEqual([0, 0, 2, 0, 2, 2, 0, 2]);
      expect(firstVertices.vertices).toBeInstanceOf(Float64Array);
    }
  });

  it('keeps flattened curve and chain leaves in deterministic source order', () => {
    const arc = requireShapeRecord2D(arcShape2D({
      radius: 2,
      startAngleRadians: 0,
      endAngleRadians: Math.PI / 2,
      thickness: 1,
    }));
    const chain = requireShapeRecord2D(chainShape2D({
      points: [[0, 0], [1, 0], [1, 1]],
      closed: true,
      radius: 0.25,
    }));
    const wedge = requireShapeRecord2D(wedgeShape2D({
      radius: 2,
      startAngleRadians: 0,
      endAngleRadians: Math.PI / 2,
    }));

    expect(arc.leaves.map((leaf) => leaf.canonicalLeafIndex)).toEqual([0, 1, 2, 3]);
    expect(chain.leaves.map((leaf) => leaf.canonicalLeafIndex)).toEqual([0, 1, 2]);
    expect(chain.leaves.map((leaf) => leaf.kind)).toEqual(['capsule', 'capsule', 'capsule']);
    expect(wedge.leaves.map((leaf) => leaf.canonicalLeafIndex)).toEqual([0, 1, 2, 3]);
  });

  it('triangulates a concave reflex wedge in stable removal order', () => {
    const shape = wedgeShape2D({
      radius: 2,
      startAngleRadians: 0,
      endAngleRadians: 3 * Math.PI / 2,
    });
    const record = requireShapeRecord2D(shape);

    expect(record.leaves.length).toBeGreaterThan(1);
    expect(record.leaves.map((leaf) => leaf.canonicalLeafIndex)).toEqual(
      record.leaves.map((_, index) => index),
    );
    expect(massProperties2D(shape).area).toBeCloseTo(3 * Math.PI, 0);
  });

  it('rejects invalid polygon contours', () => {
    const invalidContours = [
      [[0, 0], [1, 0]],
      [[0, 0], [1, 0], [1, 0], [0, 1]],
      [[0, 0], [1, 0], [2, 0]],
      [[0, 0], [2, 0], [1, 1], [2, 2], [0, 2]],
      [[0, 0], [2, 2], [0, 2], [2, 0]],
    ] as const;

    for (const points of invalidContours) {
      expect(() => polygonShape2D({ points })).toThrow();
    }
  });
});

describe('2D shape mass properties', () => {
  it('returns deeply frozen known answers for analytic primitives', () => {
    const circle = massProperties2D(circleShape2D({ radius: 2, center: [3, 4] }));
    const ellipse = massProperties2D(ellipseShape2D({ radiusX: 3, radiusY: 2, center: [-1, 1], rotationDegrees: 30 }));
    const box = massProperties2D(boxShape2D({ width: 2, height: 4 }));
    const capsule = massProperties2D(capsuleShape2D({ start: [-2, 0], end: [2, 0], radius: 1 }));

    expect(circle.area).toBeCloseTo(4 * Math.PI, 12);
    expect(circle.centroid).toEqual([3, 4]);
    expect(circle.mass).toBeCloseTo(4 * Math.PI, 12);
    expect(circle.rotationalInertia).toBeCloseTo(8 * Math.PI, 12);
    expect(ellipse.area).toBeCloseTo(6 * Math.PI, 12);
    expect(ellipse.centroid).toEqual([-1, 1]);
    expect(ellipse.rotationalInertia).toBeCloseTo(19.5 * Math.PI, 12);
    expect(box).toEqual({ area: 8, centroid: [0, 0], mass: 8, rotationalInertia: 40 / 3 });
    expect(capsule.area).toBeCloseTo(8 + Math.PI, 12);
    expect(capsule.centroid).toEqual([0, 0]);
    expect(capsule.rotationalInertia).toBeCloseTo(40 / 3 + 4.5 * Math.PI + 16 / 3, 12);
    for (const properties of [circle, ellipse, box, capsule]) {
      expect(Object.isFrozen(properties)).toBe(true);
      expect(Object.isFrozen(properties.centroid)).toBe(true);
    }
  });

  it('scales mass and inertia by density for the exact 2-by-4 box case', () => {
    expect(massProperties2D(boxShape2D({ width: 2, height: 4 }), { density: 3 })).toEqual({
      area: 8,
      centroid: [0, 0],
      mass: 24,
      rotationalInertia: 40,
    });
    expect(() => massProperties2D(boxShape2D({ width: 1, height: 1 }), { density: -1 })).toThrow();
    expect(() => massProperties2D(boxShape2D({ width: 1, height: 1 }), { density: 0 })).toThrow();
    expect(() => massProperties2D(boxShape2D({ width: 1, height: 1 }), { density: Number.NaN })).toThrow();
  });

  it('reports valid zero-area results for segments and zero-radius chains', () => {
    expect(massProperties2D(segmentShape2D({ start: [1, 2], end: [5, 2] }))).toEqual({
      area: 0,
      centroid: [3, 2],
      mass: 0,
      rotationalInertia: 0,
    });
    expect(massProperties2D(chainShape2D({ points: [[0, 0], [4, 0], [4, 2]] }))).toEqual({
      area: 0,
      centroid: [8 / 3, 1 / 3],
      mass: 0,
      rotationalInertia: 0,
    });
  });
});

describe('2D shape transforms and bounds', () => {
  it('preserves finite geometry smaller than machine epsilon', () => {
    const tiny = 1e-17;

    expect(boundsOfShape2D(circleShape2D({ radius: tiny }))).toEqual(
      bounds(-tiny, -tiny, tiny, tiny),
    );
    expect(massProperties2D(circleShape2D({ radius: tiny })).area).toBe(
      Math.PI * tiny * tiny,
    );
  });

  it('composes rigid transforms without changing the source shape', () => {
    const source = boxShape2D({ width: 2, height: 4, center: [1, 2] });
    const transformed = transformShape2D(source, { position: [10, -1], rotationDegrees: 90 });

    expect(boundsOfShape2D(source)).toEqual(bounds(0, 0, 2, 4));
    expect(boundsOfShape2D(transformed).min[0]).toBeCloseTo(6, 12);
    expect(boundsOfShape2D(transformed).min[1]).toBeCloseTo(-1, 12);
    expect(boundsOfShape2D(transformed).max[0]).toBeCloseTo(10, 12);
    expect(boundsOfShape2D(transformed).max[1]).toBeCloseTo(1, 12);
    expect(massProperties2D(transformed).centroid[0]).toBeCloseTo(8, 12);
    expect(massProperties2D(transformed).centroid[1]).toBeCloseTo(0, 12);

    const posed = boundsOfShape2D(transformed, { position: [2, 3], rotationDegrees: -90 });
    expect(posed.min[0]).toBeCloseTo(1, 12);
    expect(posed.min[1]).toBeCloseTo(-7, 12);
    expect(posed.max[0]).toBeCloseTo(3, 12);
    expect(posed.max[1]).toBeCloseTo(-3, 12);
    expect(Object.isFrozen(transformed)).toBe(true);
    expect(Object.isFrozen(posed)).toBe(true);
    expect(Object.isFrozen(posed.min)).toBe(true);
    expect(Object.isFrozen(posed.max)).toBe(true);
    expect(requireShapeRecord2D(transformed).leaves).toBe(
      requireShapeRecord2D(source).leaves,
    );
  });

  it('rejects malformed shape lookalikes and nonfinite transforms', () => {
    expect(() => boundsOfShape2D({} as CRCPhysicsShape2D)).toThrow('shape must be a CRC physics 2D shape');
    expect(() => transformShape2D(circleShape2D({ radius: 1 }), { position: [0, 0], rotationDegrees: Number.NaN })).toThrow();
    expect(() => boundsOfShape2D(circleShape2D({ radius: 1 }), { position: [Number.NaN, 0], rotationDegrees: 0 })).toThrow();
  });
});

function bounds(
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): CRCPhysicsAabb2D {
  return {
    min: [minX, minY],
    max: [maxX, maxY],
  };
}
