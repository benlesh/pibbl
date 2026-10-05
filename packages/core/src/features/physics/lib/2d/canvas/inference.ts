import {
  Arc,
  Circle,
  Ellipse,
  Group,
  HorizontalLine,
  Image,
  Line,
  Path,
  Polygon,
  Rectangle,
  RegularPolygon,
  Star,
  SvgPath,
  Text,
  VerticalLine,
  Wedge,
} from "@pibbl/core";
import type {
  PibblPhysicsShape2D,
  PibblPhysicsVector2,
} from "../../../2d-geometry.js";
import {
  arcShape2D,
  boxShape2D,
  chainShape2D,
  circleShape2D,
  ellipseShape2D,
  polygonShape2D,
  roundedBoxShape2D,
  wedgeShape2D,
} from "../shapes.js";
import {
  canonicalizeContour2D,
  polygonMassData2D,
  triangulateContour2D,
} from "../math.js";
import {
  createShape2D,
  requireShapeRecord2D,
  type PolygonLeaf2D,
} from "../shape-records.js";

export interface CanvasColliderInferenceInput2D {
  readonly componentType: Function;
  readonly componentName: string;
  readonly style: Readonly<Record<PropertyKey, unknown>>;
}

const customShapeResolvers2D = new WeakMap<
  Function,
  (style: Readonly<Record<PropertyKey, unknown>>) => PibblPhysicsShape2D
>();

export function installCustomShapeResolver2D(
  component: Function,
  resolver: (
    style: Readonly<Record<PropertyKey, unknown>>,
  ) => PibblPhysicsShape2D,
): void {
  if (customShapeResolvers2D.has(component)) {
    throw new Error(
      "A Pibbl primitive may have only one physics 2D shape resolver.",
    );
  }
  customShapeResolvers2D.set(component, resolver);
}

export function inferCanvasColliderShape2D(
  input: CanvasColliderInferenceInput2D,
): PibblPhysicsShape2D {
  const { componentType, componentName, style } = input;
  const customResolver = customShapeResolvers2D.get(componentType);
  if (customResolver) return requireShape(customResolver(style), componentName);
  if (componentType === Rectangle) {
    const width = positive(style, "width", componentName),
      height = positive(style, "height", componentName);
    const center = [width / 2, height / 2] as const;
    const radii = resolvedRadii(style, 4);
    return radii.some((radius) => radius > 0)
      ? roundedBoxShape2D({
          width,
          height,
          center,
          radius: radii as [number, number, number, number],
        })
      : boxShape2D({ width, height, center });
  }
  if (componentType === Circle) {
    return circleShape2D({
      center: [number(style, "cx", 0), number(style, "cy", 0)],
      radius: positive(style, "radius", componentName),
    });
  }
  if (componentType === Ellipse) {
    return ellipseShape2D({
      center: [number(style, "cx", 0), number(style, "cy", 0)],
      radiusX: positive(style, "radiusX", componentName),
      radiusY: positive(style, "radiusY", componentName),
      rotationDegrees: (number(style, "rotation", 0) * 180) / Math.PI,
    });
  }
  if (componentType === Arc) {
    return arcShape2D({
      center: [number(style, "cx", 0), number(style, "cy", 0)],
      radius: positive(style, "radius", componentName),
      startAngleRadians: number(style, "startAngle"),
      endAngleRadians: number(style, "endAngle"),
      counterclockwise: style.counterclockwise === true,
      thickness: positive(style, "strokeWidth", componentName),
    });
  }
  if (componentType === Wedge) {
    return wedgeShape2D({
      center: [number(style, "cx", 0), number(style, "cy", 0)],
      radius: positive(style, "radius", componentName),
      startAngleRadians: number(style, "startAngle"),
      endAngleRadians: number(style, "endAngle"),
      counterclockwise: style.counterclockwise === true,
    });
  }
  if (componentType === Polygon) {
    const vertices = points(style.coords, `${componentName}.coords`);
    const radii = resolvedRadii(style, vertices.length);
    return shapeFromClosedContour(
      roundedContour(vertices, radii),
      `${componentName}.coords`,
      radii.some((radius) => radius > 0),
    );
  }
  if (componentType === RegularPolygon) {
    const sides = integer(style, "sides", 3, componentName);
    const radius = regularPolygonRadius(style, sides, componentName);
    const cx = number(style, "cx", 0),
      cy = number(style, "cy", 0),
      rotation = number(style, "rotation", -Math.PI / 2);
    const vertices = Array.from({ length: sides }, (_, index) => {
      const angle = rotation + (index * Math.PI * 2) / sides;
      return [
        cx + radius * Math.cos(angle),
        cy + radius * Math.sin(angle),
      ] as const;
    });
    const radii = resolvedRadii(style, sides);
    return shapeFromClosedContour(
      roundedContour(vertices, radii),
      `${componentName}.vertices`,
      radii.some((value) => value > 0),
    );
  }
  if (componentType === Star) {
    const count = integer(style, "points", 3, componentName);
    const outer = positive(style, "outerRadius", componentName),
      inner = positive(style, "innerRadius", componentName);
    if (inner > outer)
      throw new RangeError(
        `${componentName}.innerRadius must not exceed outerRadius.`,
      );
    const cx = number(style, "cx", 0),
      cy = number(style, "cy", 0),
      rotation = number(style, "rotation", -Math.PI / 2);
    const vertices = Array.from({ length: count * 2 }, (_, index) => {
      const angle = rotation + (index * Math.PI) / count;
      const radius = index % 2 === 0 ? outer : inner;
      return [
        cx + radius * Math.cos(angle),
        cy + radius * Math.sin(angle),
      ] as const;
    });
    const radii = resolvedRadii(style, count * 2);
    return shapeFromClosedContour(
      roundedContour(vertices, radii),
      `${componentName}.vertices`,
      true,
    );
  }
  if (componentType === Line)
    return lineShape(
      points(style.coords, `${componentName}.coords`),
      number(style, "strokeWidth", 0),
    );
  if (componentType === HorizontalLine) {
    const y = number(style, "y");
    return lineShape(
      [
        [number(style, "x1", 0), y],
        [number(style, "x2"), y],
      ],
      number(style, "strokeWidth", 0),
    );
  }
  if (componentType === VerticalLine) {
    const x = number(style, "x");
    return lineShape(
      [
        [x, number(style, "y1", 0)],
        [x, number(style, "y2")],
      ],
      number(style, "strokeWidth", 0),
    );
  }
  if (componentType === SvgPath) return inferSvgPath(style, componentName);
  if (componentType === Path)
    throw explicitShapeError(
      componentName,
      "its opaque Path2D commands cannot be inspected",
    );
  if (componentType === Text || componentType === Image) {
    if (typeof style.width !== "number" || typeof style.height !== "number") {
      throw explicitShapeError(
        componentName,
        "stable width and height are not declared",
      );
    }
    const width = positive(style, "width", componentName),
      height = positive(style, "height", componentName);
    return boxShape2D({ width, height, center: [width / 2, height / 2] });
  }
  if (componentType === Group)
    throw explicitShapeError(
      componentName,
      "Group has no self geometry; attach colliders to physical descendants",
    );
  throw explicitShapeError(
    componentName,
    "the primitive has no stable physics shape adapter",
  );
}

export function bakeCanvasShapeTransform2D(
  shape: PibblPhysicsShape2D,
  transform: DOMMatrixReadOnly,
): PibblPhysicsShape2D {
  if (isIdentity(transform)) return shape;
  const source = requireShapeRecord2D(shape);
  const local = new DOMMatrix()
    .translate(source.localPose.x, source.localPose.y)
    .rotate((source.localPose.rotationRadians * 180) / Math.PI);
  const combined = new DOMMatrix([
    transform.a,
    transform.b,
    transform.c,
    transform.d,
    transform.e,
    transform.f,
  ]).multiply(local);
  const parts: PibblPhysicsShape2D[] = [];
  for (const leaf of source.leaves) {
    if (leaf.kind === "segment") {
      parts.push(
        chainShape2D({
          points: [
            transformPoint(combined, leaf.start),
            transformPoint(combined, leaf.end),
          ],
        }),
      );
      continue;
    }
    const contour = leafContour(leaf).map((point) =>
      transformPoint(combined, point),
    );
    parts.push(
      shapeFromClosedContour(
        contour,
        "transformed collider contour",
        leaf.kind === "rounded-box" || leaf.kind === "capsule",
      ),
    );
  }
  return combineShapes(parts);
}

function inferSvgPath(
  style: Readonly<Record<PropertyKey, unknown>>,
  componentName: string,
): PibblPhysicsShape2D {
  if (typeof style.d !== "string")
    throw explicitShapeError(componentName, "SVG path data is not a string");
  const contours = parseSvgContours(style.d, componentName);
  if (contours.length !== 1)
    throw explicitShapeError(
      componentName,
      "multiple SVG contours have ambiguous fill or winding semantics",
    );
  const contour = contours[0]!;
  if (contour.closed) {
    if (style.fill === undefined)
      throw explicitShapeError(
        componentName,
        "a closed SVG contour without a resolved fill is ambiguous",
      );
    try {
      return shapeFromClosedContour(contour.points, `${componentName}.d`);
    } catch {
      throw explicitShapeError(
        componentName,
        "its SVG contour is self-intersecting, degenerate, or cannot be decomposed deterministically",
      );
    }
  }
  if (style.fill !== undefined)
    throw explicitShapeError(
      componentName,
      "an open filled SVG contour is ambiguous",
    );
  try {
    return lineShape(contour.points, number(style, "strokeWidth", 0));
  } catch {
    throw explicitShapeError(
      componentName,
      "its open SVG contour is degenerate or has an invalid resolved stroke width",
    );
  }
}

function lineShape(
  source: readonly PibblPhysicsVector2[],
  strokeWidth: number,
): PibblPhysicsShape2D {
  if (source.length < 2)
    throw new RangeError("A line collider requires at least two points.");
  if (!Number.isFinite(strokeWidth) || strokeWidth < 0)
    throw new TypeError(
      "Resolved strokeWidth must be a finite nonnegative number.",
    );
  return chainShape2D({ points: source, radius: strokeWidth / 2 });
}

function shapeFromClosedContour(
  source: readonly PibblPhysicsVector2[],
  path: string,
  forceCompound = false,
): PibblPhysicsShape2D {
  if (!forceCompound) {
    try {
      return polygonShape2D({ points: source });
    } catch {
      // Concavity is represented as a deterministic triangle compound below.
    }
  }
  {
    const contour = canonicalizeContour2D(source, {
      strictlyConvex: false,
      path,
    });
    const triangles = triangulateContour2D(contour);
    const leaves = triangles.map<PolygonLeaf2D>(
      (vertices, canonicalLeafIndex) =>
        Object.freeze({ kind: "polygon", vertices, canonicalLeafIndex }),
    );
    const entries = leaves.map((leaf) => polygonMassData2D(leaf.vertices));
    const area = entries.reduce((sum, entry) => sum + entry.area, 0);
    const centroidX =
      entries.reduce((sum, entry) => sum + entry.area * entry.centroidX, 0) /
      area;
    const centroidY =
      entries.reduce((sum, entry) => sum + entry.area * entry.centroidY, 0) /
      area;
    const unitInertia = entries.reduce((sum, entry) => {
      const dx = entry.centroidX - centroidX,
        dy = entry.centroidY - centroidY;
      return sum + entry.unitInertia + entry.area * (dx * dx + dy * dy);
    }, 0);
    const xs = leaves.flatMap((leaf) =>
      Array.from(leaf.vertices).filter((_, index) => index % 2 === 0),
    );
    const ys = leaves.flatMap((leaf) =>
      Array.from(leaf.vertices).filter((_, index) => index % 2 === 1),
    );
    return createShape2D({
      leaves,
      localBounds: new Float64Array([
        Math.min(...xs),
        Math.min(...ys),
        Math.max(...xs),
        Math.max(...ys),
      ]),
      area,
      centroidX,
      centroidY,
      unitInertia,
    });
  }
}

function combineShapes(
  shapes: readonly PibblPhysicsShape2D[],
): PibblPhysicsShape2D {
  if (shapes.length === 1) return shapes[0]!;
  const records = shapes.map(requireShapeRecord2D);
  const leaves = records.flatMap((record) => record.leaves);
  const area = records.reduce((sum, record) => sum + record.area, 0);
  const centroidX =
    area === 0
      ? 0
      : records.reduce(
          (sum, record) => sum + record.area * record.centroidX,
          0,
        ) / area;
  const centroidY =
    area === 0
      ? 0
      : records.reduce(
          (sum, record) => sum + record.area * record.centroidY,
          0,
        ) / area;
  const unitInertia = records.reduce((sum, record) => {
    const dx = record.centroidX - centroidX,
      dy = record.centroidY - centroidY;
    return sum + record.unitInertia + record.area * (dx * dx + dy * dy);
  }, 0);
  return createShape2D({
    leaves,
    localBounds: new Float64Array([
      Math.min(...records.map((record) => record.localBounds[0]!)),
      Math.min(...records.map((record) => record.localBounds[1]!)),
      Math.max(...records.map((record) => record.localBounds[2]!)),
      Math.max(...records.map((record) => record.localBounds[3]!)),
    ]),
    area,
    centroidX,
    centroidY,
    unitInertia,
  });
}

function leafContour(
  leaf: ReturnType<typeof requireShapeRecord2D>["leaves"][number],
): readonly PibblPhysicsVector2[] {
  switch (leaf.kind) {
    case "circle":
      return ellipseContour(leaf.center, leaf.radius, leaf.radius, 0);
    case "ellipse":
      return ellipseContour(
        leaf.center,
        leaf.radiusX,
        leaf.radiusY,
        leaf.rotationRadians,
      );
    case "box":
      return [
        [leaf.center[0]! - leaf.halfWidth, leaf.center[1]! - leaf.halfHeight],
        [leaf.center[0]! + leaf.halfWidth, leaf.center[1]! - leaf.halfHeight],
        [leaf.center[0]! + leaf.halfWidth, leaf.center[1]! + leaf.halfHeight],
        [leaf.center[0]! - leaf.halfWidth, leaf.center[1]! + leaf.halfHeight],
      ];
    case "rounded-box": {
      const cx = leaf.center[0]!,
        cy = leaf.center[1]!;
      const corners = [
        [
          cx + leaf.halfWidth - leaf.radii[1]!,
          cy - leaf.halfHeight + leaf.radii[1]!,
          -Math.PI / 2,
          0,
          leaf.radii[1]!,
        ],
        [
          cx + leaf.halfWidth - leaf.radii[2]!,
          cy + leaf.halfHeight - leaf.radii[2]!,
          0,
          Math.PI / 2,
          leaf.radii[2]!,
        ],
        [
          cx - leaf.halfWidth + leaf.radii[3]!,
          cy + leaf.halfHeight - leaf.radii[3]!,
          Math.PI / 2,
          Math.PI,
          leaf.radii[3]!,
        ],
        [
          cx - leaf.halfWidth + leaf.radii[0]!,
          cy - leaf.halfHeight + leaf.radii[0]!,
          Math.PI,
          Math.PI * 1.5,
          leaf.radii[0]!,
        ],
      ] as const;
      return corners.flatMap(([x, y, start, end, radius]) =>
        arcContour(x, y, radius, start, end, 8),
      );
    }
    case "capsule": {
      const angle = Math.atan2(
        leaf.end[1]! - leaf.start[1]!,
        leaf.end[0]! - leaf.start[0]!,
      );
      return [
        ...arcContour(
          leaf.end[0]!,
          leaf.end[1]!,
          leaf.radius,
          angle - Math.PI / 2,
          angle + Math.PI / 2,
          16,
        ),
        ...arcContour(
          leaf.start[0]!,
          leaf.start[1]!,
          leaf.radius,
          angle + Math.PI / 2,
          angle + Math.PI * 1.5,
          16,
        ),
      ];
    }
    case "polygon": {
      const result: PibblPhysicsVector2[] = [];
      for (let index = 0; index < leaf.vertices.length; index += 2)
        result.push([leaf.vertices[index]!, leaf.vertices[index + 1]!]);
      return result;
    }
    case "segment":
      return [];
  }
}

function ellipseContour(
  center: Float64Array,
  radiusX: number,
  radiusY: number,
  rotation: number,
): readonly PibblPhysicsVector2[] {
  const cosine = Math.cos(rotation),
    sine = Math.sin(rotation);
  return Array.from({ length: 32 }, (_, index) => {
    const angle = (index * Math.PI * 2) / 32,
      x = radiusX * Math.cos(angle),
      y = radiusY * Math.sin(angle);
    return [
      center[0]! + x * cosine - y * sine,
      center[1]! + x * sine + y * cosine,
    ] as const;
  });
}

function arcContour(
  cx: number,
  cy: number,
  radius: number,
  start: number,
  end: number,
  steps: number,
): readonly PibblPhysicsVector2[] {
  if (radius === 0) return [[cx, cy]];
  return Array.from({ length: steps + 1 }, (_, index) => {
    const angle = start + ((end - start) * index) / steps;
    return [
      cx + radius * Math.cos(angle),
      cy + radius * Math.sin(angle),
    ] as const;
  });
}

function transformPoint(
  matrix: DOMMatrixReadOnly,
  point: ArrayLike<number>,
): PibblPhysicsVector2 {
  return [
    matrix.a * point[0]! + matrix.c * point[1]! + matrix.e,
    matrix.b * point[0]! + matrix.d * point[1]! + matrix.f,
  ];
}

function isIdentity(matrix: DOMMatrixReadOnly): boolean {
  return (
    matrix.a === 1 &&
    matrix.b === 0 &&
    matrix.c === 0 &&
    matrix.d === 1 &&
    matrix.e === 0 &&
    matrix.f === 0
  );
}

function roundedContour(
  source: readonly PibblPhysicsVector2[],
  radii: readonly number[],
): readonly PibblPhysicsVector2[] {
  if (radii.every((radius) => radius === 0))
    return source.map((point) => [point[0], point[1]] as const);
  const corners = source.map((point, index) => {
    const previous = source[(index + source.length - 1) % source.length]!,
      next = source[(index + 1) % source.length]!;
    const previousLength = Math.hypot(
      previous[0] - point[0],
      previous[1] - point[1],
    );
    const nextLength = Math.hypot(next[0] - point[0], next[1] - point[1]);
    const previousUnit = [
      (previous[0] - point[0]) / previousLength,
      (previous[1] - point[1]) / previousLength,
    ] as const;
    const nextUnit = [
      (next[0] - point[0]) / nextLength,
      (next[1] - point[1]) / nextLength,
    ] as const;
    const dot = Math.max(
      -1,
      Math.min(
        1,
        previousUnit[0] * nextUnit[0] + previousUnit[1] * nextUnit[1],
      ),
    );
    return {
      point,
      previousUnit,
      nextUnit,
      demand: radii[index]! / Math.tan(Math.acos(dot) / 2),
      radius: radii[index]!,
      previousLength,
    };
  });
  const scale = corners.reduce((current, corner, index) => {
    const demand =
      corner.demand + corners[(index + 1) % corners.length]!.demand;
    return demand > 0
      ? Math.min(
          current,
          corners[(index + 1) % corners.length]!.previousLength / demand,
        )
      : current;
  }, 1);
  const output: PibblPhysicsVector2[] = [];
  for (const corner of corners) {
    const demand = corner.demand * scale;
    if (corner.radius === 0 || !Number.isFinite(demand)) {
      output.push([corner.point[0], corner.point[1]]);
      continue;
    }
    const start = [
      corner.point[0] + corner.previousUnit[0] * demand,
      corner.point[1] + corner.previousUnit[1] * demand,
    ] as const;
    const end = [
      corner.point[0] + corner.nextUnit[0] * demand,
      corner.point[1] + corner.nextUnit[1] * demand,
    ] as const;
    output.push(start);
    appendQuadratic(output, start, corner.point, end, 0);
  }
  return output;
}

function appendQuadratic(
  output: PibblPhysicsVector2[],
  start: PibblPhysicsVector2,
  control: PibblPhysicsVector2,
  end: PibblPhysicsVector2,
  depth: number,
): void {
  const midpoint = [
    (start[0] + 2 * control[0] + end[0]) / 4,
    (start[1] + 2 * control[1] + end[1]) / 4,
  ] as const;
  const chord = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2] as const;
  if (
    Math.hypot(midpoint[0] - chord[0], midpoint[1] - chord[1]) <= 0.05 ||
    depth >= 12
  ) {
    output.push([end[0], end[1]]);
    return;
  }
  const firstControl = midpointOf(start, control),
    secondControl = midpointOf(control, end);
  appendQuadratic(output, start, firstControl, midpoint, depth + 1);
  appendQuadratic(output, midpoint, secondControl, end, depth + 1);
}

interface SvgContour {
  readonly points: readonly PibblPhysicsVector2[];
  readonly closed: boolean;
}

function parseSvgContours(
  data: string,
  componentName: string,
): readonly SvgContour[] {
  const tokens =
    data.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) ?? [];
  const contours: SvgContour[] = [];
  let output: PibblPhysicsVector2[] = [],
    closed = false,
    command = "",
    index = 0;
  let current: PibblPhysicsVector2 = [0, 0],
    start: PibblPhysicsVector2 = [0, 0];
  const finish = () => {
    if (output.length > 0) contours.push({ points: output, closed });
    output = [];
    closed = false;
  };
  const read = () => {
    const value = Number(tokens[index++]);
    if (!Number.isFinite(value))
      throw explicitShapeError(componentName, "SVG path data is malformed");
    return value;
  };
  while (index < tokens.length) {
    if (/^[a-zA-Z]$/.test(tokens[index]!)) command = tokens[index++]!;
    if (!command)
      throw explicitShapeError(
        componentName,
        "SVG path data must begin with a command",
      );
    const relative = command === command.toLowerCase(),
      upper = command.toUpperCase();
    const point = (x: number, y: number): PibblPhysicsVector2 =>
      relative ? [current[0] + x, current[1] + y] : [x, y];
    if (upper === "M") {
      finish();
      current = point(read(), read());
      start = current;
      output.push(current);
      command = relative ? "l" : "L";
    } else if (upper === "L") {
      current = point(read(), read());
      output.push(current);
    } else if (upper === "H") {
      current = relative
        ? [current[0] + read(), current[1]]
        : [read(), current[1]];
      output.push(current);
    } else if (upper === "V") {
      current = relative
        ? [current[0], current[1] + read()]
        : [current[0], read()];
      output.push(current);
    } else if (upper === "Q") {
      const control = point(read(), read()),
        end = point(read(), read());
      appendQuadratic(output, current, control, end, 0);
      current = end;
    } else if (upper === "C") {
      const first = point(read(), read()),
        second = point(read(), read()),
        end = point(read(), read());
      appendCubic(output, current, first, second, end, 0);
      current = end;
    } else if (upper === "Z") {
      closed = true;
      current = start;
      command = "";
    } else
      throw explicitShapeError(
        componentName,
        `SVG command ${command} is not supported for deterministic collider inference`,
      );
  }
  finish();
  return contours;
}

function appendCubic(
  output: PibblPhysicsVector2[],
  start: PibblPhysicsVector2,
  first: PibblPhysicsVector2,
  second: PibblPhysicsVector2,
  end: PibblPhysicsVector2,
  depth: number,
): void {
  const error = Math.max(
    pointLineDistance(first, start, end),
    pointLineDistance(second, start, end),
  );
  if (error <= 0.05 || depth >= 12) {
    output.push([end[0], end[1]]);
    return;
  }
  const a = midpointOf(start, first),
    b = midpointOf(first, second),
    c = midpointOf(second, end),
    d = midpointOf(a, b),
    e = midpointOf(b, c),
    middle = midpointOf(d, e);
  appendCubic(output, start, a, d, middle, depth + 1);
  appendCubic(output, middle, e, c, end, depth + 1);
}

function midpointOf(
  a: PibblPhysicsVector2,
  b: PibblPhysicsVector2,
): PibblPhysicsVector2 {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}
function pointLineDistance(
  point: PibblPhysicsVector2,
  start: PibblPhysicsVector2,
  end: PibblPhysicsVector2,
): number {
  const dx = end[0] - start[0],
    dy = end[1] - start[1],
    length = Math.hypot(dx, dy);
  return length === 0
    ? Math.hypot(point[0] - start[0], point[1] - start[1])
    : Math.abs(
        dy * point[0] - dx * point[1] + end[0] * start[1] - end[1] * start[0],
      ) / length;
}

function resolvedRadii(
  style: Readonly<Record<PropertyKey, unknown>>,
  count: number,
): readonly number[] {
  const fallback = number(style, "cornerRadius", 0),
    source = Array.isArray(style.cornerRadii) ? style.cornerRadii : [];
  return Array.from({ length: count }, (_, index) => {
    const value = source[index] ?? fallback;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
      throw new TypeError(
        `cornerRadii[${index}] must be a finite nonnegative number.`,
      );
    return value;
  });
}
function regularPolygonRadius(
  style: Readonly<Record<PropertyKey, unknown>>,
  sides: number,
  componentName: string,
): number {
  if (style.circumradius !== undefined)
    return positive(style, "circumradius", componentName);
  if (style.inradius !== undefined)
    return (
      positive(style, "inradius", componentName) / Math.cos(Math.PI / sides)
    );
  if (style.sideLength !== undefined)
    return (
      positive(style, "sideLength", componentName) /
      (2 * Math.sin(Math.PI / sides))
    );
  throw new TypeError(`${componentName} requires one resolved size.`);
}
function points(value: unknown, path: string): readonly PibblPhysicsVector2[] {
  if (!Array.isArray(value))
    throw new TypeError(`${path} must be an array of points.`);
  return value.map((entry, index) => {
    if (
      !Array.isArray(entry) ||
      entry.length !== 2 ||
      !entry.every((item) => typeof item === "number" && Number.isFinite(item))
    )
      throw new TypeError(
        `${path}[${index}] must be a finite two-dimensional point.`,
      );
    return [entry[0] as number, entry[1] as number] as const;
  });
}
function number(
  style: Readonly<Record<PropertyKey, unknown>>,
  key: string,
  fallback?: number,
): number {
  const value = style[key] ?? fallback;
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new TypeError(`Resolved ${key} must be a finite number.`);
  return value;
}
function positive(
  style: Readonly<Record<PropertyKey, unknown>>,
  key: string,
  componentName: string,
): number {
  const value = number(style, key);
  if (value <= 0)
    throw new RangeError(`${componentName}.${key} must be greater than zero.`);
  return value;
}
function integer(
  style: Readonly<Record<PropertyKey, unknown>>,
  key: string,
  minimum: number,
  componentName: string,
): number {
  const value = number(style, key);
  if (!Number.isSafeInteger(value) || value < minimum)
    throw new RangeError(
      `${componentName}.${key} must be a safe integer of at least ${minimum}.`,
    );
  return value;
}
function requireShape(
  shape: PibblPhysicsShape2D,
  componentName: string,
): PibblPhysicsShape2D {
  try {
    requireShapeRecord2D(shape);
    return shape;
  } catch {
    throw new TypeError(
      `${componentName} physics shape resolver must return a Pibbl physics 2D shape.`,
    );
  }
}
function explicitShapeError(componentName: string, reason: string): Error {
  return new Error(
    `${componentName} cannot infer a collider because ${reason}; provide an explicit shape.`,
  );
}
