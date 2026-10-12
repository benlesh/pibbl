import {
  constant,
  add,
  sub,
  scale,
  lerp,
  type Pair,
} from './transform-math.js';
import {
  snapshotGuide,
  sampleGuide,
  type PathGuide,
} from './transform-guide.js';
import {
  make,
  rectangle,
  coordinate,
  normalize,
  mergePairs,
  sourceDomain,
  type PathRect,
  type PathTransform,
} from './path-transforms.js';

/**
 * Source rectangle, normalized cell boundaries, and horizontal/vertical path guides for a mesh
 * transform.
 *
 * @see {@link PathRect}
 * @see {@link PathGuide}
 * @see {@link meshTransform}
 */
export interface MeshTransformOptions {
  /** Source rectangle whose normalized cells are mapped through the guide mesh. See {@link PathRect}. */
  readonly source: PathRect;
  /**
   * Strictly increasing normalized column boundaries, beginning at 0 and ending at 1. See
   * {@link MeshTransformOptions}.
   */
  readonly columns: readonly number[];
  /**
   * Strictly increasing normalized row boundaries, beginning at 0 and ending at 1. See
   * {@link MeshTransformOptions}.
   */
  readonly rows: readonly number[];
  /** Boundary rows; each contains columns.length - 1 left-to-right edges. */
  readonly horizontal: readonly (readonly PathGuide[])[];
  /** Boundary columns; each contains rows.length - 1 top-to-bottom edges. */
  readonly vertical: readonly (readonly PathGuide[])[];
}
/**
 * Creates a mapping through a mesh bounded by horizontal and vertical path guides.
 *
 * @param options - Source rectangle and the four boundary guides used to deform it. See
 * {@link MeshTransformOptions} .
 * @returns A point mapping suitable for transformPath. See {@link PathTransform}.
 *
 * @see {@link MeshTransformOptions}
 * @see {@link PathTransform}
 */
export function meshTransform(options: MeshTransformOptions): PathTransform {
  const source = rectangle(options.source);
  const axis = (values: readonly number[]) => {
    const result = Array.from(values, (n) => coordinate(n));
    if (
      result.length < 2 ||
      result[0] !== 0 ||
      result.at(-1) !== 1 ||
      result.some((n, i) => i > 0 && n <= result[i - 1])
    )
      throw new RangeError(
        'Mesh axes must strictly increase from zero to one.',
      );
    return result;
  };
  const columns = axis(options.columns),
    rows = axis(options.rows);
  if (
    options.horizontal.length !== rows.length ||
    options.vertical.length !== columns.length ||
    options.horizontal.some((row) => row.length !== columns.length - 1) ||
    options.vertical.some((col) => col.length !== rows.length - 1)
  )
    throw new RangeError('Mesh edge dimensions must match its axes.');
  if ((columns.length - 1) * (rows.length - 1) > 4096)
    throw new RangeError('Mesh exceeds 4096 cells.');
  const horizontal = options.horizontal.map((row) => row.map(snapshotGuide));
  const vertical = options.vertical.map((col) => col.map(snapshotGuide));
  const ends = (guide: ReturnType<typeof snapshotGuide>) => {
    const first = guide.spans[0],
      last = guide.spans.at(-1)!;
    const a = bendSpanPoint(first, 0),
      b = bendSpanPoint(last, 1);
    return guide.reverse ? [b, a] : [a, b];
  };
  const equal = (a: readonly number[], b: readonly number[]) => {
    if (a[0] !== b[0] || a[1] !== b[1])
      throw new RangeError('Mesh edges must share exactly matching endpoints.');
  };
  for (let row = 0; row < rows.length - 1; row++)
    for (let col = 0; col < columns.length - 1; col++) {
      const t = ends(horizontal[row][col]),
        b = ends(horizontal[row + 1][col]),
        l = ends(vertical[col][row]),
        r = ends(vertical[col + 1][row]);
      equal(t[0], l[0]);
      equal(t[1], r[0]);
      equal(b[0], l[1]);
      equal(b[1], r[1]);
    }
  return make([
    (accuracy) => {
      const h = horizontal.map((row) =>
          row.map((g) => sampleGuide(g, accuracy)),
        ),
        v = vertical.map((col) => col.map((g) => sampleGuide(g, accuracy)));
      const error =
        2 *
        Math.max(
          ...h.flat().map((g) => g.error),
          ...v.flat().map((g) => g.error),
        );
      return {
        error: () => error,
        domain: (p, margin) => sourceDomain(p, source, margin),
        evaluate: (input) => {
          const [u, w] = normalize(input, source),
            cells: Pair[] = [];
          for (let row = 0; row < rows.length - 1; row++) {
            if (w.v[1] < rows[row] || w.v[0] > rows[row + 1]) continue;
            for (let col = 0; col < columns.length - 1; col++) {
              if (u.v[1] < columns[col] || u.v[0] > columns[col + 1]) continue;
              const localU = scale(
                sub(
                  {
                    ...u,
                    v: [
                      Math.max(u.v[0], columns[col]),
                      Math.min(u.v[1], columns[col + 1]),
                    ],
                  },
                  constant(columns[col]),
                ),
                1 / (columns[col + 1] - columns[col]),
              );
              const localV = scale(
                sub(
                  {
                    ...w,
                    v: [
                      Math.max(w.v[0], rows[row]),
                      Math.min(w.v[1], rows[row + 1]),
                    ],
                  },
                  constant(rows[row]),
                ),
                1 / (rows[row + 1] - rows[row]),
              );
              const top = h[row][col].evaluate(localU),
                bottom = h[row + 1][col].evaluate(localU),
                left = v[col][row].evaluate(localV),
                right = v[col + 1][row].evaluate(localV);
              const a = ends(horizontal[row][col]),
                b = ends(horizontal[row + 1][col]);
              cells.push(
                [0, 1].map((axis) =>
                  sub(
                    add(
                      lerp(top[axis], bottom[axis], localV),
                      lerp(left[axis], right[axis], localU),
                    ),
                    lerp(
                      lerp(constant(a[0][axis]), constant(a[1][axis]), localU),
                      lerp(constant(b[0][axis]), constant(b[1][axis]), localU),
                      localV,
                    ),
                  ),
                ) as unknown as Pair,
              );
            }
          }
          if (!cells.length)
            throw new RangeError('Point lies outside the mesh source.');
          return cells.length === 1 ? cells[0] : mergePairs(cells);
        },
      };
    },
  ]);
}
import { bendSpanPoint } from './path-bend-spans.js';
