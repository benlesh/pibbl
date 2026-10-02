import { GEOMETRY_EPSILON_3D } from "./numeric-policy.js";

export interface MeshBvh3D {
  readonly minimum: Float64Array;
  readonly maximum: Float64Array;
  readonly left: Int32Array;
  readonly right: Int32Array;
  readonly triangle: Int32Array;
}

export interface CanonicalTriangles3D {
  readonly triangles: Float64Array;
  readonly sourceTriangleIds: Uint32Array;
  readonly bvh: MeshBvh3D;
}

export function buildMeshTriangles3D(
  positions: Float64Array,
  indices: Uint32Array,
): CanonicalTriangles3D {
  const triangles: number[] = [];
  const sourceTriangleIds: number[] = [];
  for (let source = 0; source < indices.length / 3; source += 1) {
    const a = indices[source * 3]! * 3;
    const b = indices[source * 3 + 1]! * 3;
    const c = indices[source * 3 + 2]! * 3;
    if (triangleAreaSquared(positions, a, b, c) <= GEOMETRY_EPSILON_3D ** 2)
      continue;
    triangles.push(
      positions[a]!,
      positions[a + 1]!,
      positions[a + 2]!,
      positions[b]!,
      positions[b + 1]!,
      positions[b + 2]!,
      positions[c]!,
      positions[c + 1]!,
      positions[c + 2]!,
    );
    sourceTriangleIds.push(source);
  }
  if (triangles.length === 0)
    throw new RangeError(
      "triangle mesh must contain at least one nondegenerate triangle.",
    );
  const triangleArray = new Float64Array(triangles);
  const idArray = Uint32Array.from(sourceTriangleIds);
  return Object.freeze({
    triangles: triangleArray,
    sourceTriangleIds: idArray,
    bvh: buildBvh(triangleArray, idArray),
  });
}

export function buildHeightfieldTriangles3D(
  rows: number,
  columns: number,
  heights: Float64Array,
  cellSizeX: number,
  cellSizeZ: number,
  heightScale: number,
  origin: Float64Array,
): CanonicalTriangles3D {
  const triangles: number[] = [];
  const ids: number[] = [];
  const point = (
    row: number,
    column: number,
  ): readonly [number, number, number] => [
    origin[0]! + column * cellSizeX,
    origin[1]! + heights[row * columns + column]! * heightScale,
    origin[2]! + row * cellSizeZ,
  ];
  let source = 0;
  for (let row = 0; row < rows - 1; row += 1) {
    for (let column = 0; column < columns - 1; column += 1) {
      const a = point(row, column);
      const b = point(row, column + 1);
      const c = point(row + 1, column);
      const d = point(row + 1, column + 1);
      for (const triangle of [
        [a, c, b],
        [b, c, d],
      ] as const) {
        triangles.push(...triangle[0], ...triangle[1], ...triangle[2]);
        ids.push(source++);
      }
    }
  }
  const triangleArray = new Float64Array(triangles);
  const idArray = Uint32Array.from(ids);
  return Object.freeze({
    triangles: triangleArray,
    sourceTriangleIds: idArray,
    bvh: buildBvh(triangleArray, idArray),
  });
}

function buildBvh(triangles: Float64Array, sourceIds: Uint32Array): MeshBvh3D {
  const minimum: number[] = [],
    maximum: number[] = [],
    left: number[] = [],
    right: number[] = [],
    leaf: number[] = [];
  const build = (items: number[]): number => {
    const node = left.length;
    left.push(-1);
    right.push(-1);
    leaf.push(-1);
    const bounds = boundsFor(triangles, items);
    minimum.push(...bounds.minimum);
    maximum.push(...bounds.maximum);
    if (items.length === 1) {
      leaf[node] = items[0]!;
      return node;
    }
    const centroidMin = [Infinity, Infinity, Infinity];
    const centroidMax = [-Infinity, -Infinity, -Infinity];
    for (const item of items)
      for (let axis = 0; axis < 3; axis += 1) {
        const value = centroid(triangles, item, axis);
        centroidMin[axis] = Math.min(centroidMin[axis]!, value);
        centroidMax[axis] = Math.max(centroidMax[axis]!, value);
      }
    let axis = 0;
    for (let candidate = 1; candidate < 3; candidate += 1)
      if (
        centroidMax[candidate]! - centroidMin[candidate]! >
        centroidMax[axis]! - centroidMin[axis]!
      )
        axis = candidate;
    items.sort(
      (a, b) =>
        centroid(triangles, a, axis) - centroid(triangles, b, axis) ||
        sourceIds[a]! - sourceIds[b]!,
    );
    const split = Math.floor((items.length - 1) / 2) + 1;
    left[node] = build(items.slice(0, split));
    right[node] = build(items.slice(split));
    return node;
  };
  build(Array.from({ length: sourceIds.length }, (_, index) => index));
  return Object.freeze({
    minimum: new Float64Array(minimum),
    maximum: new Float64Array(maximum),
    left: Int32Array.from(left),
    right: Int32Array.from(right),
    triangle: Int32Array.from(leaf),
  });
}

function boundsFor(triangles: Float64Array, items: readonly number[]) {
  const minimum = [Infinity, Infinity, Infinity],
    maximum = [-Infinity, -Infinity, -Infinity];
  for (const item of items)
    for (let vertex = 0; vertex < 3; vertex += 1)
      for (let axis = 0; axis < 3; axis += 1) {
        const value = triangles[item * 9 + vertex * 3 + axis]!;
        minimum[axis] = Math.min(minimum[axis]!, value);
        maximum[axis] = Math.max(maximum[axis]!, value);
      }
  return { minimum, maximum };
}

function centroid(
  triangles: Float64Array,
  triangle: number,
  axis: number,
): number {
  return (
    (triangles[triangle * 9 + axis]! +
      triangles[triangle * 9 + 3 + axis]! +
      triangles[triangle * 9 + 6 + axis]!) /
    3
  );
}

function triangleAreaSquared(
  values: Float64Array,
  a: number,
  b: number,
  c: number,
): number {
  const abx = values[b]! - values[a]!,
    aby = values[b + 1]! - values[a + 1]!,
    abz = values[b + 2]! - values[a + 2]!;
  const acx = values[c]! - values[a]!,
    acy = values[c + 1]! - values[a + 1]!,
    acz = values[c + 2]! - values[a + 2]!;
  const x = aby * acz - abz * acy,
    y = abz * acx - abx * acz,
    z = abx * acy - aby * acx;
  return x * x + y * y + z * z;
}
