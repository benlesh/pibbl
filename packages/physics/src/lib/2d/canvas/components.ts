import {
  crcEventTarget,
  definePrimitive,
  type RenderingContext2D,
} from '@crc/core';
import type {
  Capsule2DProps,
  Capsule2DStyle,
  Chain2DProps,
  Chain2DStyle,
  PhysicsShape2DProps,
  PhysicsShape2DStyle,
  Segment2DProps,
  Segment2DStyle,
} from '../types.js';
import type { CRCPhysicsShape2D, CRCPhysicsVector2 } from '../../../2d-geometry.js';
import { boundsOfShape2D, capsuleShape2D, chainShape2D, segmentShape2D } from '../shapes.js';
import { requireShapeRecord2D, type ConvexLeaf2D } from '../shape-records.js';
import { installCustomShapeResolver2D } from './inference.js';

type ResolvedPhysicsShapeStyle2D = Readonly<PhysicsShape2DStyle>;
type ResolvedCapsuleStyle2D = Omit<Readonly<Capsule2DStyle>, 'start' | 'end'> & {
  readonly start: CRCPhysicsVector2;
  readonly end: CRCPhysicsVector2;
};
type ResolvedSegmentStyle2D = Omit<Readonly<Segment2DStyle>, 'start' | 'end'> & {
  readonly start: CRCPhysicsVector2;
  readonly end: CRCPhysicsVector2;
};
type ResolvedChainStyle2D = Omit<Readonly<Chain2DStyle>, 'points'> & {
  readonly points: readonly CRCPhysicsVector2[];
};

function renderPhysicsShape2D(
  props: PhysicsShape2DProps,
  style: ResolvedPhysicsShapeStyle2D,
  context: RenderingContext2D,
): void {
  renderShape(props, style, style.shape, context);
}

function renderCapsule2D(
  props: Capsule2DProps,
  style: Readonly<ResolvedCapsuleStyle2D>,
  context: RenderingContext2D,
): void {
  renderShape(props, style, capsuleShape2D(style), context);
}

function renderSegment2D(
  props: Segment2DProps,
  style: Readonly<ResolvedSegmentStyle2D>,
  context: RenderingContext2D,
): void {
  renderShape(props, style, segmentShape2D(style), context);
}

function renderChain2D(
  props: Chain2DProps,
  style: Readonly<ResolvedChainStyle2D>,
  context: RenderingContext2D,
): void {
  renderShape(props, style, chainShape2D(style), context);
}

export const PhysicsShape2D = definePrimitive<
  PhysicsShape2DProps,
  PhysicsShape2DStyle,
  PhysicsShape2DStyle,
  PhysicsShape2DStyle
>(renderPhysicsShape2D, { resolveStyle: resolvePhysicsShapeStyle });

export const Capsule2D = definePrimitive<
  Capsule2DProps,
  Capsule2DStyle,
  Capsule2DStyle,
  ResolvedCapsuleStyle2D
>(renderCapsule2D, { resolveStyle: style => ({
  ...stripLayout(style),
  start: copyPoint(style.start, 'Capsule2D.start'),
  end: copyPoint(style.end, 'Capsule2D.end'),
  radius: positive(style.radius, 'Capsule2D.radius'),
}) });

export const Segment2D = definePrimitive<
  Segment2DProps,
  Segment2DStyle,
  Segment2DStyle,
  ResolvedSegmentStyle2D
>(renderSegment2D, { resolveStyle: style => ({
  ...stripLayout(style),
  start: copyPoint(style.start, 'Segment2D.start'),
  end: copyPoint(style.end, 'Segment2D.end'),
}) });

export const Chain2D = definePrimitive<
  Chain2DProps,
  Chain2DStyle,
  Chain2DStyle,
  ResolvedChainStyle2D
>(renderChain2D, { resolveStyle: style => ({
  ...stripLayout(style),
  points: Object.freeze(style.points.map((point, index) => copyPoint(point, `Chain2D.points[${index}]`))),
  closed: style.closed ?? false,
  radius: nonnegative(style.radius ?? 0, 'Chain2D.radius'),
}) });

installCustomShapeResolver2D(PhysicsShape2D, style => requireShape(style.shape, 'PhysicsShape2D.shape'));
installCustomShapeResolver2D(Capsule2D, style => capsuleShape2D({
  start: copyPoint(style.start, 'Capsule2D.start'),
  end: copyPoint(style.end, 'Capsule2D.end'),
  radius: positive(style.radius, 'Capsule2D.radius'),
}));
installCustomShapeResolver2D(Segment2D, style => segmentShape2D({
  start: copyPoint(style.start, 'Segment2D.start'),
  end: copyPoint(style.end, 'Segment2D.end'),
}));
installCustomShapeResolver2D(Chain2D, style => chainShape2D({
  points: copyPoints(style.points, 'Chain2D.points'),
  closed: style.closed === true,
  radius: nonnegative(style.radius ?? 0, 'Chain2D.radius'),
}));

function resolvePhysicsShapeStyle(style: Readonly<PhysicsShape2DStyle>): ResolvedPhysicsShapeStyle2D {
  requireShape(style.shape, 'PhysicsShape2D.shape');
  return stripLayout(style) as ResolvedPhysicsShapeStyle2D;
}

function renderShape(
  props: PhysicsShape2DProps,
  style: Readonly<{
    readonly fill?: CanvasRenderingContext2D['fillStyle'];
    readonly stroke?: CanvasRenderingContext2D['strokeStyle'];
    readonly strokeWidth?: number;
    readonly opacity?: number;
    readonly cursor?: string;
    readonly lineInteractionWidth?: number;
  }>,
  shape: CRCPhysicsShape2D,
  context: RenderingContext2D,
): void {
  const record = requireShapeRecord2D(shape);
  const path = pathForShape(shape);
  const opacity = style.opacity ?? 1;
  if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
    throw new RangeError('Physics shape opacity must be finite from zero through one.');
  }
  context.globalAlpha *= opacity;
  if (style.fill !== undefined) {
    context.fillStyle = style.fill;
    context.fill(path);
  }
  const strokeWidth = nonnegative(style.strokeWidth ?? 0, 'Physics shape strokeWidth');
  if (style.stroke !== undefined && strokeWidth > 0) {
    context.strokeStyle = style.stroke;
    context.lineWidth = strokeWidth;
    context.stroke(path);
  }
  const bounds = boundsOfShape2D(shape);
  const interactivePath = props.pointerEvents === 'none' ? new Path2D() : path;
  crcEventTarget(props, {
    path: interactivePath,
    fill: style.fill !== undefined && record.area > 0,
    lineInteractionWidth: style.lineInteractionWidth ?? strokeWidth,
    cursor: style.cursor,
    keyboardFocusable: props.keyboardFocusable,
    keyboardNavigationBounds: props.keyboardNavigationBounds ?? {
      x: bounds.min[0], y: bounds.min[1],
      width: bounds.max[0] - bounds.min[0], height: bounds.max[1] - bounds.min[1],
    },
  });
}

function pathForShape(shape: CRCPhysicsShape2D): Path2D {
  const record = requireShapeRecord2D(shape);
  const local = new Path2D();
  for (const leaf of record.leaves) appendLeaf(local, leaf);
  if (record.localPose.x === 0 && record.localPose.y === 0 && record.localPose.rotationRadians === 0) return local;
  const result = new Path2D();
  result.addPath(local, new DOMMatrix()
    .translate(record.localPose.x, record.localPose.y)
    .rotate(record.localPose.rotationRadians * 180 / Math.PI));
  return result;
}

function appendLeaf(path: Path2D, leaf: ConvexLeaf2D): void {
  switch (leaf.kind) {
    case 'circle':
      path.moveTo(leaf.center[0]! + leaf.radius, leaf.center[1]!);
      path.arc(leaf.center[0]!, leaf.center[1]!, leaf.radius, 0, Math.PI * 2);
      path.closePath();
      return;
    case 'ellipse':
      path.moveTo(leaf.center[0]! + leaf.radiusX, leaf.center[1]!);
      path.ellipse(leaf.center[0]!, leaf.center[1]!, leaf.radiusX, leaf.radiusY, leaf.rotationRadians, 0, Math.PI * 2);
      path.closePath();
      return;
    case 'box':
      path.rect(leaf.center[0]! - leaf.halfWidth, leaf.center[1]! - leaf.halfHeight, leaf.halfWidth * 2, leaf.halfHeight * 2);
      return;
    case 'rounded-box':
      path.roundRect(
        leaf.center[0]! - leaf.halfWidth,
        leaf.center[1]! - leaf.halfHeight,
        leaf.halfWidth * 2,
        leaf.halfHeight * 2,
        Array.from(leaf.radii),
      );
      return;
    case 'capsule':
      appendCapsule(path, leaf.start, leaf.end, leaf.radius);
      return;
    case 'segment':
      path.moveTo(leaf.start[0]!, leaf.start[1]!);
      path.lineTo(leaf.end[0]!, leaf.end[1]!);
      return;
    case 'polygon':
      path.moveTo(leaf.vertices[0]!, leaf.vertices[1]!);
      for (let index = 2; index < leaf.vertices.length; index += 2) path.lineTo(leaf.vertices[index]!, leaf.vertices[index + 1]!);
      path.closePath();
  }
}

function appendCapsule(path: Path2D, start: Float64Array, end: Float64Array, radius: number): void {
  const dx = end[0]! - start[0]!, dy = end[1]! - start[1]!, length = Math.hypot(dx, dy);
  if (length === 0) {
    path.moveTo(start[0]! + radius, start[1]!);
    path.arc(start[0]!, start[1]!, radius, 0, Math.PI * 2);
    path.closePath();
    return;
  }
  const normal = Math.atan2(dy, dx) - Math.PI / 2;
  path.moveTo(start[0]! + Math.cos(normal) * radius, start[1]! + Math.sin(normal) * radius);
  path.lineTo(end[0]! + Math.cos(normal) * radius, end[1]! + Math.sin(normal) * radius);
  path.arc(end[0]!, end[1]!, radius, normal, normal + Math.PI);
  path.lineTo(start[0]! - Math.cos(normal) * radius, start[1]! - Math.sin(normal) * radius);
  path.arc(start[0]!, start[1]!, radius, normal + Math.PI, normal + Math.PI * 2);
  path.closePath();
}

function stripLayout<T extends Readonly<Record<PropertyKey, unknown>>>(style: T): T {
  const result = { ...style } as Record<PropertyKey, unknown>;
  for (const key of [
    'width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight', 'padding', 'overflow',
    'left', 'top', 'alignSelf', 'justifySelf', 'flexBasis', 'flexGrow', 'flexShrink',
    'gridColumnStart', 'gridColumnSpan', 'gridRowStart', 'gridRowSpan',
  ]) delete result[key];
  return result as T;
}

function copyPoints(value: unknown, path: string): readonly CRCPhysicsVector2[] {
  if (!Array.isArray(value)) throw new TypeError(`${path} must be an array.`);
  return Object.freeze(value.map((point, index) => copyPoint(point, `${path}[${index}]`)));
}

function copyPoint(value: unknown, path: string): CRCPhysicsVector2 {
  if (!Array.isArray(value) || value.length !== 2 || value.some(entry => typeof entry !== 'number' || !Number.isFinite(entry))) {
    throw new TypeError(`${path} must be a finite two-dimensional point.`);
  }
  return Object.freeze([value[0] as number, value[1] as number] as const);
}

function positive(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new RangeError(`${path} must be finite and greater than zero.`);
  return value;
}

function nonnegative(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new RangeError(`${path} must be finite and nonnegative.`);
  return value;
}

function requireShape(value: unknown, path: string): CRCPhysicsShape2D {
  try {
    requireShapeRecord2D(value as CRCPhysicsShape2D);
    return value as CRCPhysicsShape2D;
  } catch {
    throw new TypeError(`${path} must be a CRC physics 2D shape.`);
  }
}
