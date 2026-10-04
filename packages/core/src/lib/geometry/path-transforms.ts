import { PathGeometry } from './path-geometry.js';
import {
  bendSpans,
  bendSpanBounds,
  splitBendSpan,
  type BendSpan,
} from './path-bend-spans.js';
import {
  absI,
  constant,
  add,
  sub,
  scale,
  mul,
  lerp,
  reciprocal,
  type Pair,
} from './transform-math.js';
import {
  snapshotGuide,
  sampleGuide,
  type PathGuide,
} from './transform-guide.js';
import {
  warpPath,
  type PathWarpCorners,
  type PathWarpMode,
} from './path-warp.js';

export interface PathPoint {
  readonly x: number;
  readonly y: number;
}
export interface PathRect extends PathPoint {
  readonly width: number;
  readonly height: number;
}
declare const transformBrand: unique symbol;
export interface PathTransform {
  readonly [transformBrand]: true;
  /** Evaluate in ordinary source/destination coordinates. Guide approximation is bounded by tolerance. */
  mapPoint(
    point: PathPoint,
    options?: { readonly tolerance?: number },
  ): PathPoint;
}
export interface TransformPathOptions {
  readonly tolerance: number;
  readonly maxSegments?: number;
}
export type PathQuadCorners = PathWarpCorners;
export type PathQuadMode = PathWarpMode;
export interface QuadTransformOptions {
  readonly source: PathRect;
  readonly destination: PathQuadCorners;
  readonly mode?: PathQuadMode;
}
export interface EnvelopeGuide {
  readonly at: number;
  readonly path: PathGuide;
}
export type EnvelopeTransformOptions = {
  readonly source: PathRect;
  readonly interpolation?: 'linear';
} & (
  | {
      readonly top: PathGuide;
      readonly bottom: PathGuide;
      readonly guides?: never;
    }
  | {
      readonly guides: readonly EnvelopeGuide[];
      readonly top?: never;
      readonly bottom?: never;
    }
);
export type {
  PathGuide,
  PathGuideOptions,
  PathGuideStation,
} from './transform-guide.js';

export interface Stage {
  apply?(path: PathGeometry, options: TransformPathOptions): PathGeometry;
  evaluate(input: Pair): Pair;
  error(input: Pair): number;
  domain?(point: Pair, margin: number): boolean;
  affine?: Affine;
}
export type Factory = (accuracy: number) => Stage;
const definitions = new WeakMap<PathTransform, readonly Factory[]>();
const MAX_WORK = 2_000_000;
export const coordinate = (value: number, label = 'coordinate') => {
  if (typeof value !== 'number')
    throw new TypeError(`${label} must be a number.`);
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite.`);
  return value;
};
export const positive = (value: number, label: string) => {
  coordinate(value, label);
  if (value <= 0) throw new RangeError(`${label} must be positive.`);
  return value;
};
export function rectangle(input: PathRect): PathRect {
  return {
    x: coordinate(input?.x),
    y: coordinate(input?.y),
    width: positive(input?.width, 'source.width'),
    height: positive(input?.height, 'source.height'),
  };
}
export const normalize = (input: Pair, r: PathRect): Pair => [
  scale(sub(input[0], constant(r.x)), 1 / r.width),
  scale(sub(input[1], constant(r.y)), 1 / r.height),
];
export function make(factories: readonly Factory[]): PathTransform {
  // One cached preparation only; drag sessions cannot grow a tolerance cache indefinitely.
  let cachedAccuracy = NaN,
    cached: readonly Stage[] = [];
  const prepare = (accuracy: number) => {
    if (accuracy !== cachedAccuracy) {
      cached = factories.map((f) => f(accuracy));
      cachedAccuracy = accuracy;
    }
    return cached;
  };
  const value = Object.freeze({
    mapPoint(point: PathPoint, options: { tolerance?: number } = {}) {
      const tolerance = positive(options.tolerance ?? 0.0001, 'tolerance');
      const input: Pair = [
        constant(coordinate(point?.x)),
        constant(coordinate(point?.y)),
      ];
      for (
        let accuracy = tolerance / 16, attempt = 0;
        attempt < 9;
        attempt++, accuracy /= 16
      ) {
        const result = evaluate(prepare(accuracy), input);
        const x = result.value[0].v[0],
          y = result.value[1].v[0];
        if (!result.domain)
          throw new RangeError(
            'Point lies outside a transformation source rectangle.',
          );
        if (result.error + roundoff(result.value) <= tolerance)
          return { x: coordinate(x), y: coordinate(y) };
      }
      throw new RangeError(
        'Cannot certify point accuracy at available precision.',
      );
    },
  }) as PathTransform;
  definitions.set(value, factories);
  return value;
}
function definition(value: PathTransform): readonly Factory[] {
  const result = definitions.get(value);
  if (!result)
    throw new TypeError('Expected a constructor-created PathTransform.');
  return result;
}
/** Apply mappings in the order written. Empty composition is identity. */
export function composeTransforms(
  ...transforms: readonly PathTransform[]
): PathTransform {
  return make(transforms.flatMap((t) => [...definition(t)]));
}
export function affineTransform(matrix: DOMMatrix2DInit = {}): PathTransform {
  const m = affineMatrix(matrix);
  return make([
    () => ({
      affine: m,
      error: () => 0,
      evaluate: ([x, y]) => [
        add(add(scale(x, m.a), scale(y, m.c)), constant(m.e)),
        add(add(scale(x, m.b), scale(y, m.d)), constant(m.f)),
      ],
    }),
  ]);
}
export function quadTransform(options: QuadTransformOptions): PathTransform {
  const source = rectangle(options.source),
    mode = options.mode === undefined ? 'bilinear' : options.mode;
  const names = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'] as const;
  const corners = names.map((n) => ({
    x: coordinate(options.destination?.[n]?.x),
    y: coordinate(options.destination?.[n]?.y),
  }));
  const destination = Object.fromEntries(
    names.map((n, i) => [n, corners[i]]),
  ) as unknown as PathWarpCorners;
  // Reuse the existing convexity/pole validation, including empty geometry validation.
  warpPath(new PathGeometry(), { source, destination, mode, tolerance: 1 });
  const [a, b, c, d] = corners;
  const dx1 = b.x - d.x,
    dx2 = c.x - d.x,
    dx3 = a.x - b.x - c.x + d.x;
  const dy1 = b.y - d.y,
    dy2 = c.y - d.y,
    dy3 = a.y - b.y - c.y + d.y;
  const det = dx1 * dy2 - dx2 * dy1;
  const g = mode === 'perspective' ? (dx3 * dy2 - dx2 * dy3) / det : 0;
  const h = mode === 'perspective' ? (dx1 * dy3 - dx3 * dy1) / det : 0;
  return make([
    () => ({
      apply: (path, quality) =>
        warpPath(path, {
          source,
          destination,
          mode,
          tolerance: quality.tolerance,
          maxSegments: quality.maxSegments,
        }),
      error: () => 0,
      evaluate: (input) => {
        const [u, v] = normalize(input, source);
        if (mode === 'bilinear')
          return [
            lerp(
              lerp(constant(a.x), constant(b.x), u),
              lerp(constant(c.x), constant(d.x), u),
              v,
            ),
            lerp(
              lerp(constant(a.y), constant(b.y), u),
              lerp(constant(c.y), constant(d.y), u),
              v,
            ),
          ];
        const w = reciprocal(add(add(scale(u, g), scale(v, h)), constant(1)));
        return [
          mul(
            add(
              add(scale(u, b.x - a.x + g * b.x), scale(v, c.x - a.x + h * c.x)),
              constant(a.x),
            ),
            w,
          ),
          mul(
            add(
              add(scale(u, b.y - a.y + g * b.y), scale(v, c.y - a.y + h * c.y)),
              constant(a.y),
            ),
            w,
          ),
        ];
      },
    }),
  ]);
}
export function envelopeTransform(
  options: EnvelopeTransformOptions,
): PathTransform {
  const source = rectangle(options.source);
  if (options.interpolation !== undefined && options.interpolation !== 'linear')
    throw new TypeError('Unsupported envelope interpolation.');
  if (options.guides && (options.top || options.bottom))
    throw new TypeError('Specify guides or top/bottom, not both.');
  const guides = (
    options.guides ?? [
      { at: 0, path: options.top! },
      { at: 1, path: options.bottom! },
    ]
  ).map((g) => ({ at: coordinate(g.at), guide: snapshotGuide(g.path) }));
  if (
    guides.length < 2 ||
    guides[0].at !== 0 ||
    guides.at(-1)!.at !== 1 ||
    guides.some((g, i) => i > 0 && g.at <= guides[i - 1].at)
  )
    throw new RangeError('Envelope guides must strictly increase from 0 to 1.');
  return make([
    (accuracy) => {
      const sampled = guides.map((g) => sampleGuide(g.guide, accuracy));
      const error = Math.max(...sampled.map((g) => g.error));
      const evaluateBand = (input: Pair, i: number): Pair => {
        const [u, v] = normalize(input, source),
          a = sampled[i].evaluate(u),
          b = sampled[i + 1].evaluate(u);
        const t = scale(
          sub(v, constant(guides[i].at)),
          1 / (guides[i + 1].at - guides[i].at),
        );
        return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
      };
      return {
        error: () => error,
        domain: (input, margin) =>
          input[0].v[0] >= source.x - margin &&
          input[0].v[1] <= source.x + source.width + margin &&
          input[1].v[0] >= source.y - margin &&
          input[1].v[1] <= source.y + source.height + margin,
        evaluate: (input) => {
          const v0 = (input[1].v[0] - source.y) / source.height,
            v1 = (input[1].v[1] - source.y) / source.height;
          let first = 0;
          while (first < guides.length - 2 && guides[first + 1].at <= v0)
            first++;
          let last = first;
          while (last < guides.length - 2 && guides[last + 1].at < v1) last++;
          if (first === last) return evaluateBand(input, first);
          const outputs: Pair[] = [];
          for (let i = first; i <= last; i++) {
            const y = {
              ...input[1],
              v: [
                Math.max(
                  input[1].v[0],
                  source.y + guides[i].at * source.height,
                ),
                Math.min(
                  input[1].v[1],
                  source.y + guides[i + 1].at * source.height,
                ),
              ] as const,
            };
            outputs.push(evaluateBand([input[0], y], i));
          }
          return [0, 1].map((axis) => ({
            v: [
              Math.min(...outputs.map((p) => p[axis].v[0])),
              Math.max(...outputs.map((p) => p[axis].v[1])),
            ],
            d: [
              Math.min(...outputs.map((p) => p[axis].d[0])),
              Math.max(...outputs.map((p) => p[axis].d[1])),
            ],
            dd: [-Infinity, Infinity],
          })) as unknown as Pair;
        },
      };
    },
  ]);
}
function roundoff(pair: Pair): number {
  return Number.EPSILON * 512 * Math.max(1, ...pair.map((p) => absI(p.v)));
}
function evaluate(
  stages: readonly Stage[],
  input: Pair,
): { value: Pair; error: number; domain: boolean } {
  let value = input,
    error = 0,
    domain = true;
  for (const stage of stages) {
    // Bound propagation of guide approximation through every later map via its Jacobian.
    if (error > 0) {
      const box = value.map((p) => ({
        v: [p.v[0] - error, p.v[1] + error] as const,
        d: [0, 0] as const,
        dd: [0, 0] as const,
      })) as unknown as Pair;
      const dx = stage.evaluate([{ ...box[0], d: [1, 1] }, box[1]]);
      const dy = stage.evaluate([box[0], { ...box[1], d: [1, 1] }]);
      error *= Math.hypot(
        absI(dx[0].d),
        absI(dx[1].d),
        absI(dy[0].d),
        absI(dy[1].d),
      );
    }
    domain &&= stage.domain?.(value, roundoff(value)) ?? true;
    error += stage.error(value);
    value = stage.evaluate(value);
  }
  return { value, error, domain };
}
/** Return independent geometry. Nonlinear mappings approximate the final composed curve once. */
export function transformPath(
  path: PathGeometry,
  transform: PathTransform,
  options: TransformPathOptions,
): PathGeometry {
  if (!(path instanceof PathGeometry))
    throw new TypeError('transformPath requires PathGeometry.');
  const factories = definition(transform),
    tolerance = positive(options?.tolerance, 'tolerance');
  const maxSegments = positive(
    options.maxSegments === undefined ? 1_000_000 : options.maxSegments,
    'maxSegments',
  );
  if (!Number.isSafeInteger(maxSegments))
    throw new RangeError('maxSegments must be a safe integer.');
  let work = 0;
  for (
    let attempt = 0, accuracy = tolerance / 32;
    attempt < 9;
    attempt++, accuracy /= 16
  ) {
    const stages = factories.map((f) => f(accuracy));
    if (stages.length === 1 && stages[0].apply)
      return stages[0].apply(path, options);
    if (stages.every((s) => s.affine)) {
      if (path.segmentCount > maxSegments)
        throw new RangeError('transformPath exceeded maxSegments.');
      let result = path.clone();
      for (const s of stages) result = applyAffine(result, s.affine!);
      return result;
    }
    const output = new PathGeometry();
    let retry = false;
    const reserve = () => {
      if (output.segmentCount >= maxSegments)
        throw new RangeError('transformPath exceeded maxSegments.');
    };
    for (const item of bendSpans(path)) {
      if (item.type === 'close') {
        reserve();
        output.closePath();
        continue;
      }
      if (item.type === 'move') {
        const r = evaluate(stages, [
          constant(item.point[0]),
          constant(item.point[1]),
        ]);
        if (!r.domain)
          throw new RangeError(
            'Path lies outside a transformation source rectangle.',
          );
        if (r.error > tolerance / 4) {
          retry = true;
          break;
        }
        if (r.error + roundoff(r.value) > tolerance)
          throw new RangeError('Cannot certify transform precision.');
        reserve();
        output.moveTo(coordinate(r.value[0].v[0]), coordinate(r.value[1].v[0]));
        continue;
      }
      const stack: { span: BendSpan; depth: number }[] = [
        { span: item.span, depth: 0 },
      ];
      while (stack.length) {
        if (++work > MAX_WORK)
          throw new RangeError('transformPath exceeded its work limit.');
        const { span, depth } = stack.pop()!,
          b = bendSpanBounds(span);
        const r = evaluate(stages, [
          { v: [b.xmin, b.xmax], d: [-b.dx, b.dx], dd: [-b.ddx, b.ddx] },
          { v: [b.ymin, b.ymax], d: [-b.dy, b.dy], dd: [-b.ddy, b.ddy] },
        ]);
        if (r.error > tolerance / 4) {
          retry = true;
          break;
        }
        const second = Math.hypot(absI(r.value[0].dd), absI(r.value[1].dd)) / 8;
        // A Lipschitz bound also covers piecewise-smooth guides and crossed cell boundaries.
        const first = Math.hypot(absI(r.value[0].d), absI(r.value[1].d)) / 2;
        const bound = Math.min(second, first) + 2 * r.error + roundoff(r.value);
        if (r.domain && bound <= tolerance) {
          const end =
            'points' in span
              ? span.points.at(-1)!
              : [
                  span.arc.cx +
                    span.arc.ux *
                      Math.cos(span.arc.startAngle + span.arc.sweep) +
                    span.arc.vx *
                      Math.sin(span.arc.startAngle + span.arc.sweep),
                  span.arc.cy +
                    span.arc.uy *
                      Math.cos(span.arc.startAngle + span.arc.sweep) +
                    span.arc.vy *
                      Math.sin(span.arc.startAngle + span.arc.sweep),
                ];
          const p = evaluate(stages, [constant(end[0]), constant(end[1])]);
          reserve();
          output.lineTo(
            coordinate(p.value[0].v[0]),
            coordinate(p.value[1].v[0]),
          );
        } else {
          if (depth >= 52)
            throw new RangeError(
              'Cannot certify transform tolerance or source domain.',
            );
          const [left, right] = splitBendSpan(span);
          stack.push(
            { span: right, depth: depth + 1 },
            { span: left, depth: depth + 1 },
          );
        }
      }
      if (retry) break;
    }
    if (!retry) return output;
  }
  throw new RangeError('Cannot certify composed guide accuracy.');
}

/** @internal Merge cell enclosures; derivatives may jump at the shared edge. */
export function mergePairs(outputs: readonly Pair[]): Pair {
  return [0, 1].map((axis) => ({
    v: [
      Math.min(...outputs.map((p) => p[axis].v[0])),
      Math.max(...outputs.map((p) => p[axis].v[1])),
    ],
    d: [
      Math.min(...outputs.map((p) => p[axis].d[0])),
      Math.max(...outputs.map((p) => p[axis].d[1])),
    ],
    dd: [-Infinity, Infinity],
  })) as unknown as Pair;
}
export function sourceDomain(
  input: Pair,
  source: PathRect,
  margin: number,
): boolean {
  return (
    input[0].v[0] >= source.x - margin &&
    input[0].v[1] <= source.x + source.width + margin &&
    input[1].v[0] >= source.y - margin &&
    input[1].v[1] <= source.y + source.height + margin
  );
}
export { meshTransform, type MeshTransformOptions } from './transform-mesh.js';
export {
  arcBendTransform,
  pathBendTransform,
  type ArcBendTransformOptions,
  type PathBendTransformOptions,
  type BendTransformOptions,
} from './transform-bend.js';

interface Affine {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly e: number;
  readonly f: number;
}
function affineMatrix(matrix: DOMMatrix2DInit): Affine {
  if (!matrix || typeof matrix !== 'object')
    throw new TypeError('Expected a finite 2D affine matrix.');
  const value = matrix as DOMMatrixInit;
  if (
    value.is2D === false ||
    ['m13', 'm14', 'm23', 'm24', 'm31', 'm32', 'm34', 'm43'].some(
      (k) =>
        value[k as keyof DOMMatrixInit] !== undefined &&
        value[k as keyof DOMMatrixInit] !== 0,
    ) ||
    [value.m33, value.m44].some((n) => n !== undefined && n !== 1)
  )
    throw new RangeError('Expected a finite 2D affine matrix.');
  const pairs = [
    ['a', 'm11', 1],
    ['b', 'm12', 0],
    ['c', 'm21', 0],
    ['d', 'm22', 1],
    ['e', 'm41', 0],
    ['f', 'm42', 0],
  ] as const;
  const result = {} as Record<string, number>;
  for (const [key, alias, fallback] of pairs) {
    const a = value[key],
      b = value[alias];
    if (a !== undefined && b !== undefined && a !== b)
      throw new TypeError('Conflicting affine matrix aliases.');
    result[key] = coordinate(
      a === undefined ? (b === undefined ? fallback : b) : a,
    );
  }
  return result as unknown as Affine;
}
function applyAffine(path: PathGeometry, m: Affine): PathGeometry {
  const p = (x: number, y: number, vector = false) => ({
    x: coordinate(m.a * x + m.c * y + (vector ? 0 : m.e)),
    y: coordinate(m.b * x + m.d * y + (vector ? 0 : m.f)),
  });
  const segments = Array.from(path, (segment) => {
    switch (segment.type) {
      case 'close':
        return segment;
      case 'move':
      case 'line':
        return { ...segment, ...p(segment.x, segment.y) };
      case 'quadratic': {
        const control = p(segment.cpx, segment.cpy);
        return {
          ...segment,
          ...p(segment.x, segment.y),
          cpx: control.x,
          cpy: control.y,
        };
      }
      case 'cubic': {
        const a = p(segment.cp1x, segment.cp1y),
          b = p(segment.cp2x, segment.cp2y);
        return {
          ...segment,
          ...p(segment.x, segment.y),
          cp1x: a.x,
          cp1y: a.y,
          cp2x: b.x,
          cp2y: b.y,
        };
      }
      case 'arc': {
        const center = p(segment.cx, segment.cy),
          u = p(segment.ux, segment.uy, true),
          v = p(segment.vx, segment.vy, true);
        return {
          ...segment,
          cx: center.x,
          cy: center.y,
          ux: u.x,
          uy: u.y,
          vx: v.x,
          vy: v.y,
        };
      }
    }
  });
  const result = new PathGeometry();
  result.spliceSegments(0, 0, segments);
  return result;
}
