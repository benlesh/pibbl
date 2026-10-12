import {
  constant,
  add,
  sub,
  scale,
  mul,
  trig,
  absI,
  type Pair,
  type Jet,
} from './transform-math.js';
import { evaluatePolyline } from './transform-guide.js';
import { prepareBendGuide, measureBendGuide } from './path-bend-guide.js';
import {
  bendPathAlongArc,
  bendPathAlongPath,
  type PathBendOptions,
  type BendPathAlongArcOptions,
} from './path-bending.js';
import { PathGeometry } from './path-geometry.js';
import {
  make,
  coordinate,
  positive,
  mergePairs,
  type PathTransform,
} from './path-transforms.js';

/**
 * Alignment, fitting, baseline, and overflow controls shared by reusable bend transforms.
 *
 * @see {@link PathBendTransformOptions}
 */
export type BendTransformOptions = Omit<
  PathBendOptions,
  'tolerance' | 'maxSegments'
>;
/**
 * Circular bending parameters for a reusable arc transform; accuracy is supplied when applying it.
 *
 * @see {@link arcBendTransform}
 */
export type ArcBendTransformOptions = Omit<
  BendPathAlongArcOptions,
  'tolerance' | 'maxSegments'
>;
/**
 * Guide path and bending parameters for a reusable path transform.
 *
 * @see {@link PathGeometry}
 * @see {@link pathBendTransform}
 */
export type PathBendTransformOptions = Omit<
  PathBendOptions,
  'tolerance' | 'maxSegments'
> & {
  /** Path used as the bending guide. See {@link PathGeometry}. */
  readonly guide: PathGeometry;
};
function placement(input: Omit<PathBendOptions, 'tolerance' | 'maxSegments'>) {
  const frame = input.source;
  const source = {
    x: coordinate(frame?.x),
    y: coordinate(frame?.y),
    width: positive(frame?.width, 'source.width'),
    height: coordinate(frame?.height),
  };
  if (source.height < 0)
    throw new RangeError('source.height must be nonnegative.');
  const align = input.align ?? 'start',
    fit = input.fit ?? 'none',
    overflow = input.overflow ?? 'error';
  if (
    !['start', 'center', 'end'].includes(align) ||
    !['none', 'stretch'].includes(fit) ||
    !['error', 'extend', 'wrap'].includes(overflow)
  )
    throw new TypeError('Invalid bend placement option.');
  const raw = input.baseline ?? 'center';
  if (typeof raw !== 'number' && !['top', 'center', 'bottom'].includes(raw))
    throw new TypeError('Invalid bend baseline.');
  const baseline =
    typeof raw === 'number'
      ? coordinate(raw)
      : source.y + source.height * { top: 0, center: 0.5, bottom: 1 }[raw];
  return {
    source,
    baseline,
    fit,
    overflow,
    anchor: { start: 0, center: 0.5, end: 1 }[align],
    offset: coordinate(input.offset ?? 0),
    normal: coordinate(input.normalOffset ?? 0),
  };
}
function distances(
  p: ReturnType<typeof placement>,
  length: number,
  input: Pair,
): Pair {
  const factor = p.fit === 'stretch' ? length / p.source.width : 1;
  return [
    add(
      scale(sub(input[0], constant(p.source.x)), factor),
      constant(p.anchor * (length - factor * p.source.width) + p.offset),
    ),
    add(sub(input[1], constant(p.baseline)), constant(p.normal)),
  ];
}
/**
 * Creates a reusable mapping that bends source geometry around a circular arc.
 *
 * @param options - Source bounds and circular bend geometry. See {@link ArcBendTransformOptions}.
 * @returns A point mapping that bends the source along a circular arc. See {@link PathTransform}.
 *
 * @see {@link ArcBendTransformOptions}
 * @see {@link PathTransform}
 */
export function arcBendTransform(
  options: ArcBendTransformOptions,
): PathTransform {
  const p = placement(options),
    arc = { ...options.arc };
  const saved = { ...options, source: { ...options.source }, arc };
  // Keep the established arc validation and wrapping contract.
  bendPathAlongArc(new PathGeometry(), {
    ...options,
    source: { ...options.source },
    arc,
    tolerance: 1,
  });
  const length = positive(arc.radius * Math.abs(arc.sweep), 'guide length'),
    direction = Math.sign(arc.sweep);
  const curve = (s: Jet, d: Jet, extension = constant(0)): Pair => {
    const theta = add(
      scale(s, direction / arc.radius),
      constant(arc.startAngle % (2 * Math.PI)),
    );
    const radius = sub(constant(arc.radius), scale(d, direction));
    return [
      sub(
        add(constant(arc.cx), mul(radius, trig(theta, true))),
        scale(mul(extension, trig(theta)), direction),
      ),
      add(
        add(constant(arc.cy), mul(radius, trig(theta))),
        scale(mul(extension, trig(theta, true)), direction),
      ),
    ];
  };
  return make([
    () => ({
      apply: (path, quality) =>
        bendPathAlongArc(path, {
          ...saved,
          tolerance: quality.tolerance,
          maxSegments: quality.maxSegments,
        }),
      error: (input) => {
        const [s, d] = distances(p, length, input);
        return (
          Number.EPSILON *
          64 *
          (1 + Math.abs(arc.startAngle) + absI(s.v) / arc.radius) *
          (arc.radius + absI(d.v) + (p.overflow === 'extend' ? absI(s.v) : 0))
        );
      },
      domain: (input, margin) => {
        const [s] = distances(p, length, input);
        return (
          p.overflow !== 'error' ||
          (s.v[0] >= -margin && s.v[1] <= length + margin)
        );
      },
      evaluate: (input) => {
        const [s, d] = distances(p, length, input);
        if (p.overflow !== 'extend') return curve(s, d);
        const parts: Pair[] = [];
        if (s.v[0] < 0) {
          const before = { ...s, v: [s.v[0], Math.min(0, s.v[1])] as const };
          parts.push(curve(constant(0), d, before));
        }
        if (s.v[1] >= 0 && s.v[0] <= length)
          parts.push(
            curve(
              { ...s, v: [Math.max(0, s.v[0]), Math.min(length, s.v[1])] },
              d,
            ),
          );
        if (s.v[1] > length) {
          const after = {
            ...s,
            v: [Math.max(length, s.v[0]), s.v[1]] as const,
          };
          parts.push(curve(constant(length), d, sub(after, constant(length))));
        }
        return parts.length === 1 ? parts[0] : mergePairs(parts);
      },
    }),
  ]);
}
/**
 * Creates a reusable mapping that bends source geometry along a guide path.
 *
 * @param options - Source bounds, target guide, and alignment along that guide. See
 * {@link PathBendTransformOptions} .
 * @returns A point mapping that bends the source along the target path. See {@link PathTransform}.
 *
 * @see {@link PathBendTransformOptions}
 * @see {@link PathTransform}
 */
export function pathBendTransform(
  options: PathBendTransformOptions,
): PathTransform {
  const p = placement(options);
  if (!(options.guide instanceof PathGeometry))
    throw new TypeError('guide must be PathGeometry.');
  const guide = options.guide.clone();
  const saved = { ...options, source: { ...options.source }, guide };
  const prepared = prepareBendGuide(guide);
  if (p.overflow === 'wrap' && !prepared.closed)
    throw new RangeError('wrap requires a closed guide.');
  return make([
    (accuracy) => {
      const measured = measureBendGuide(prepared, accuracy * 4, 1, () => 2);
      const { length, knots } = measured;
      const coordinates = knots.map((k) => k.distance),
        points = knots.map((k) => k.point),
        normals = knots.map((k) => k.normal);
      const field = (s: Jet): readonly [Pair, Pair] => {
        if (s.v[0] >= 0 && s.v[1] <= length)
          return [
            evaluatePolyline(coordinates, points, s),
            evaluatePolyline(coordinates, normals, s),
          ];
        const positions = [...points],
          directions = [...normals],
          distances = [...coordinates];
        if (s.v[0] < 0) {
          const n = normals[0],
            q = points[0],
            d = s.v[0];
          distances.unshift(d);
          positions.unshift([q[0] + d * n[1], q[1] - d * n[0]]);
          directions.unshift(n);
        }
        if (s.v[1] > length) {
          const n = normals.at(-1)!,
            q = points.at(-1)!,
            d = s.v[1] - length;
          distances.push(s.v[1]);
          positions.push([q[0] + d * n[1], q[1] - d * n[0]]);
          directions.push(n);
        }
        return [
          evaluatePolyline(distances, positions, s),
          evaluatePolyline(distances, directions, s),
        ];
      };
      const sample = (s: Jet, d: Jet): Pair => {
        const [q, n] = field(s);
        return [add(q[0], mul(d, n[0])), add(q[1], mul(d, n[1]))];
      };
      return {
        apply: (path, quality) =>
          bendPathAlongPath(path, guide, {
            ...saved,
            tolerance: quality.tolerance,
            maxSegments: quality.maxSegments,
          }),
        // The measured error bounds unit normal displacement and two units of
        // length uncertainty. Enlarge for placement, displacement, and wrapped laps.
        error: (input) => {
          const [s, d] = distances(p, length, input);
          return (
            measured.error *
            (1 + absI(d.v)) *
            (2 +
              absI(s.v) / length +
              absI(
                scale(sub(input[0], constant(p.source.x)), 1 / p.source.width)
                  .v,
              ))
          );
        },
        domain: (input, margin) => {
          const [s] = distances(p, length, input);
          return (
            p.overflow !== 'error' ||
            (s.v[0] >= -margin && s.v[1] <= length + margin)
          );
        },
        evaluate: (input) => {
          const [s, d] = distances(p, length, input);
          if (p.overflow !== 'wrap') return sample(s, d);
          const first = Math.floor(s.v[0] / length),
            last = Math.floor(s.v[1] / length);
          if (
            !Number.isSafeInteger(first) ||
            !Number.isSafeInteger(last) ||
            last - first > 1024
          )
            throw new RangeError('Wrapped bend exceeds its lap budget.');
          const parts: Pair[] = [];
          for (let lap = first; lap <= last; lap++)
            parts.push(
              sample(
                {
                  ...s,
                  v: [
                    Math.max(0, s.v[0] - lap * length),
                    Math.min(length, s.v[1] - lap * length),
                  ],
                },
                d,
              ),
            );
          return parts.length === 1 ? parts[0] : mergePairs(parts);
        },
      };
    },
  ]);
}
