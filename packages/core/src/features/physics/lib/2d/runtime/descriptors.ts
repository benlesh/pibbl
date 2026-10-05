import { Group, isSignal } from "@pibbl/core";
import {
  pibblInternalCreatePropAttachment,
  type PibblInternalPrimitiveAttachmentInput,
  type PibblInternalMountedPropAttachment,
} from "@pibbl/core/internal";
import type {
  PibblPhysicsShape2D,
  PibblPhysicsVector2,
} from "../../../2d-geometry.js";
import { transformShape2D } from "../../../2d-geometry.js";
import { requireShapeRecord2D, type ShapeRecord2D } from "../shape-records.js";
import type {
  PibblPhysicsAttachment2D,
  PibblPhysicsBodyAttachment2D,
  PibblPhysicsBodyHandle2D,
  PibblPhysicsColliderAttachment2D,
  PibblPhysicsColliderConfiguration2D,
  PibblPhysicsCollisionFilter,
  PibblPhysicsDynamicBody2DOptions,
  PibblPhysicsKinematicBody2DOptions,
  PibblPhysicsKinematicTarget2D,
  PibblPhysicsStaticBody2DOptions,
} from "../types.js";
import {
  copyFiniteVector2,
  requireFiniteNumber,
  requireNonnegativeNumber,
  requirePositiveNumber,
  requireSafeIntegerInRange,
} from "../../shared/validation.js";
import {
  pushPhysicsBody2D,
  requireCurrentPhysicsBody2D,
  requireCurrentPhysicsWorld2D,
} from "./context.js";
import {
  bakeCanvasShapeTransform2D,
  inferCanvasColliderShape2D,
} from "../canvas/inference.js";
import {
  bodyLocalTransformFromPrimitive2D,
  captureBodyPresentation2D,
  matrixFromPose,
  resolveDynamicPresentationTransform2D,
  type CanvasBodyPresentationCapture2D,
} from "../canvas/presentation.js";

const bodyFramesByWorld2D = new WeakMap<object, Map<number, BodyFrame2D>>();

interface BodyFrame2D {
  readonly poseMatrix: DOMMatrix;
  readonly preBodyLineage: PibblInternalPrimitiveAttachmentInput["presentationTransformLineage"];
  readonly untrackedCanvasTransformCount: number;
}

const attachmentRecord2DSymbol = Symbol("PibblPhysicsAttachment2D");

// Exact Pibbl presentation anchors preserve authored transforms as doubles. A
// relative collider frame still performs one inversion and one multiplication,
// so accept only their bounded IEEE-754 double-operation noise. This is never
// an authored-geometry epsilon: a post-mount 1e-7 translation or scale change
// remains observable.
const RELATIVE_MATRIX_ROUNDOFF_OPERATIONS = 32;

export interface NormalizedPhysicsCollisionFilter2D {
  readonly category: number;
  readonly mask: number;
  readonly group: number;
}

export interface NormalizedPhysicsColliderConfiguration2D {
  readonly shape: "self" | PibblPhysicsShape2D;
  readonly offset: PibblPhysicsVector2;
  readonly rotationDegrees: number;
  readonly density: number;
  readonly friction: number;
  readonly restitution: number;
  readonly sensor: boolean;
  readonly contributesToMass: boolean;
  readonly collisionFilter: NormalizedPhysicsCollisionFilter2D;
  readonly tag: unknown;
  readonly handlers: Readonly<{
    readonly onCollisionStart?: PibblPhysicsColliderConfiguration2D["onCollisionStart"];
    readonly onCollisionEnd?: PibblPhysicsColliderConfiguration2D["onCollisionEnd"];
    readonly onHit?: PibblPhysicsColliderConfiguration2D["onHit"];
    readonly onOverlapStart?: PibblPhysicsColliderConfiguration2D["onOverlapStart"];
    readonly onOverlapEnd?: PibblPhysicsColliderConfiguration2D["onOverlapEnd"];
  }>;
}

export interface NormalizedPhysicsDynamicBody2DOptions {
  readonly enabled: boolean;
  readonly handle: PibblPhysicsBodyHandle2D | undefined;
  readonly linearVelocity: PibblPhysicsVector2;
  readonly angularVelocityDegreesPerSecond: number;
  readonly linearDamping: number;
  readonly angularDamping: number;
  readonly gravityScale: number;
  readonly mass: "auto" | number;
  readonly fixedRotation: boolean;
  readonly allowSleep: boolean;
  readonly ccd: boolean;
  readonly reenableVelocity: "zero" | "preserve";
  readonly collider: false | NormalizedPhysicsColliderConfiguration2D;
}

export interface NormalizedPhysicsStaticBody2DOptions {
  readonly enabled: boolean;
  readonly handle: PibblPhysicsBodyHandle2D | undefined;
  readonly collider: false | NormalizedPhysicsColliderConfiguration2D;
}

export interface NormalizedPhysicsKinematicBody2DOptions {
  readonly enabled: boolean;
  readonly handle: PibblPhysicsBodyHandle2D | undefined;
  readonly target: Readonly<PibblPhysicsKinematicTarget2D>;
  readonly allowSleep: boolean;
  readonly collider: false | NormalizedPhysicsColliderConfiguration2D;
}

export type PhysicsBodyAttachment2DDescriptor =
  | Readonly<{
      readonly kind: "body";
      readonly bodyType: "dynamic";
      readonly options: NormalizedPhysicsDynamicBody2DOptions;
    }>
  | Readonly<{
      readonly kind: "body";
      readonly bodyType: "static";
      readonly options: NormalizedPhysicsStaticBody2DOptions;
    }>
  | Readonly<{
      readonly kind: "body";
      readonly bodyType: "kinematic";
      readonly options: NormalizedPhysicsKinematicBody2DOptions;
    }>;

export interface PhysicsColliderAttachment2DDescriptor {
  readonly kind: "collider";
  readonly options: NormalizedPhysicsColliderConfiguration2D;
}

export type PhysicsAttachment2DDescriptor =
  PhysicsBodyAttachment2DDescriptor | PhysicsColliderAttachment2DDescriptor;

type RegisteredAttachment2D = Readonly<{
  readonly [attachmentRecord2DSymbol]: PhysicsAttachment2DDescriptor;
}>;

/**
 * Creates a declarative body attachment whose motion is advanced by the physics solver.
 *
 * @param options - Dynamic body, collider, and initial motion configuration. See
 * {@link PibblPhysicsDynamicBody2DOptions} .
 * @returns A dynamic-body attachment for a supported primitive's physics prop. See
 * {@link PibblPhysicsBodyAttachment2D} .
 *
 * @see {@link PibblPhysicsDynamicBody2DOptions}
 * @see {@link PibblPhysicsBodyAttachment2D}
 */
export function dynamicBody2D(
  options: PibblPhysicsDynamicBody2DOptions = {},
): PibblPhysicsBodyAttachment2D {
  const mass = options.mass ?? "auto";
  if (mass !== "auto") requirePositiveNumber(mass, "options.mass");
  const reenableVelocity = options.reenableVelocity ?? "zero";
  if (reenableVelocity !== "zero" && reenableVelocity !== "preserve") {
    throw new TypeError(
      'options.reenableVelocity must be "zero" or "preserve".',
    );
  }
  return createAttachment({
    kind: "body",
    bodyType: "dynamic",
    options: Object.freeze({
      enabled: options.enabled ?? true,
      handle: options.handle,
      linearVelocity: copyFiniteVector2(
        options.linearVelocity ?? [0, 0],
        "options.linearVelocity",
      ),
      angularVelocityDegreesPerSecond: requireFiniteNumber(
        options.angularVelocityDegreesPerSecond ?? 0,
        "options.angularVelocityDegreesPerSecond",
      ),
      linearDamping: requireNonnegativeNumber(
        options.linearDamping ?? 0,
        "options.linearDamping",
      ),
      angularDamping: requireNonnegativeNumber(
        options.angularDamping ?? 0,
        "options.angularDamping",
      ),
      gravityScale: requireFiniteNumber(
        options.gravityScale ?? 1,
        "options.gravityScale",
      ),
      mass,
      fixedRotation: options.fixedRotation ?? false,
      allowSleep: options.allowSleep ?? true,
      ccd: options.ccd ?? false,
      reenableVelocity,
      collider: normalizeOptionalCollider(options.collider, "options.collider"),
    }),
  });
}

/**
 * Creates a declarative body attachment that remains fixed in the simulation.
 *
 * @param options - Static body and collider configuration. See
 * {@link PibblPhysicsStaticBody2DOptions} .
 * @returns A static-body attachment for a supported primitive's physics prop. See
 * {@link PibblPhysicsBodyAttachment2D} .
 *
 * @see {@link PibblPhysicsStaticBody2DOptions}
 * @see {@link PibblPhysicsBodyAttachment2D}
 */
export function staticBody2D(
  options: PibblPhysicsStaticBody2DOptions = {},
): PibblPhysicsBodyAttachment2D {
  return createAttachment({
    kind: "body",
    bodyType: "static",
    options: Object.freeze({
      enabled: options.enabled ?? true,
      handle: options.handle,
      collider: normalizeOptionalCollider(options.collider, "options.collider"),
    }),
  });
}

/**
 * Creates a declarative body attachment driven by application-supplied target signals.
 *
 * @param options - Kinematic body, collider, and motion configuration. See
 * {@link PibblPhysicsKinematicBody2DOptions} .
 * @returns A kinematic-body attachment for a supported primitive's physics prop. See
 * {@link PibblPhysicsBodyAttachment2D} .
 *
 * @see {@link PibblPhysicsKinematicBody2DOptions}
 * @see {@link PibblPhysicsBodyAttachment2D}
 */
export function kinematicBody2D(
  options: PibblPhysicsKinematicBody2DOptions = {},
): PibblPhysicsBodyAttachment2D {
  const target = options.target ?? {};
  if (target.position !== undefined && !isSignal(target.position)) {
    throw new TypeError("options.target.position must be a Pibbl signal.");
  }
  if (
    target.rotationDegrees !== undefined &&
    !isSignal(target.rotationDegrees)
  ) {
    throw new TypeError("options.target.rotationDegrees must be a Pibbl signal.");
  }
  return createAttachment({
    kind: "body",
    bodyType: "kinematic",
    options: Object.freeze({
      enabled: options.enabled ?? true,
      handle: options.handle,
      target: Object.freeze({
        position: target.position,
        rotationDegrees: target.rotationDegrees,
      }),
      allowSleep: options.allowSleep ?? true,
      collider: normalizeOptionalCollider(options.collider, "options.collider"),
    }),
  });
}

/**
 * Creates a declarative collider attachment for a primitive within a physics body.
 *
 * @param options - Collider shape, material, filtering, and sensor configuration. See
 * {@link PibblPhysicsColliderConfiguration2D} .
 * @returns A collider attachment for a supported primitive's physics prop. See
 * {@link PibblPhysicsColliderAttachment2D} .
 *
 * @see {@link PibblPhysicsColliderConfiguration2D}
 * @see {@link PibblPhysicsColliderAttachment2D}
 */
export function collider2D(
  options: PibblPhysicsColliderConfiguration2D = {},
): PibblPhysicsColliderAttachment2D {
  return createAttachment({
    kind: "collider",
    options: normalizeCollider(options, "options"),
  });
}

export function requirePhysicsAttachment2DDescriptor(
  value: PibblPhysicsAttachment2D,
): PhysicsAttachment2DDescriptor {
  const descriptor =
    typeof value === "object" && value !== null
      ? (value as Partial<RegisteredAttachment2D>)[attachmentRecord2DSymbol]
      : undefined;
  if (descriptor === undefined) {
    throw new TypeError("Expected a registered Pibbl physics 2D attachment.");
  }
  return descriptor;
}

function createAttachment<T extends PhysicsAttachment2DDescriptor>(
  descriptor: T,
): T["kind"] extends "body"
  ? PibblPhysicsBodyAttachment2D
  : PibblPhysicsColliderAttachment2D {
  const frozenDescriptor = Object.freeze(descriptor);
  const value = Object.freeze({
    [attachmentRecord2DSymbol]: frozenDescriptor,
  }) as unknown as RegisteredAttachment2D & PibblPhysicsAttachment2D;
  return pibblInternalCreatePropAttachment(
    "physics",
    value,
    () => new MountedPhysicsAttachment2D(value),
  ) as never;
}

export class MountedPhysicsAttachment2D implements PibblInternalMountedPropAttachment {
  private descriptor: PhysicsAttachment2DDescriptor;
  private world: ReturnType<typeof requireCurrentPhysicsWorld2D> | undefined;
  private bodyId: number | undefined;
  private releaseBodyScope: (() => void) | undefined;
  private cachedShapeInput:
    NormalizedPhysicsColliderConfiguration2D | undefined;
  private cachedShape: ShapeRecord2D | undefined;
  private cachedSelfShapeKey: string | undefined;
  private cachedSelfShape: PibblPhysicsShape2D | undefined;
  private cachedBakedSource: PibblPhysicsShape2D | undefined;
  private cachedBakedTransform: readonly number[] | undefined;
  private cachedBakedShape: PibblPhysicsShape2D | undefined;
  private bodyPresentation: CanvasBodyPresentationCapture2D | undefined;
  // `exit` runs after every traversal, while `dispose` runs only when this
  // mounted attachment is actually removed. Keep the last ownership key so a
  // removed keyed body releases its presentation lineage from the long-lived
  // world's frame map.
  private bodyFrameWorld: object | undefined;
  private bodyFrameId: number | undefined;
  private wasEnabled = false;

  constructor(value: PibblPhysicsAttachment2D) {
    this.descriptor = requirePhysicsAttachment2DDescriptor(value);
  }

  update(value: unknown): void {
    const next = requirePhysicsAttachment2DDescriptor(
      value as PibblPhysicsAttachment2D,
    );
    if (this.descriptor.kind === "body" && next.kind !== "body") {
      this.releaseBodyFrame();
    }
    this.descriptor = next;
  }

  enter(): void {
    const world = requireCurrentPhysicsWorld2D();
    this.world = world;
    if (this.descriptor.kind === "body") {
      const bodyId = world.bodyIdFor(this);
      if (
        this.bodyFrameWorld !== undefined &&
        (this.bodyFrameWorld !== world || this.bodyFrameId !== bodyId)
      ) {
        this.releaseBodyFrame();
      }
      this.bodyId = bodyId;
      this.releaseBodyScope = pushPhysicsBody2D({ world, bodyId });
    } else {
      this.bodyId = requireCurrentPhysicsBody2D().bodyId;
    }
  }

  preparePrimitive(
    input: PibblInternalPrimitiveAttachmentInput,
  ): Readonly<{ readonly presentationTransform2D?: DOMMatrix }> | void {
    const world = this.world;
    const bodyId = this.bodyId;
    if (world === undefined || bodyId === undefined) {
      throw new Error(
        "Physics 2D attachment preparation requires its entered scope.",
      );
    }
    if (this.descriptor.kind === "body") {
      const descriptor = this.descriptor;
      const simulationParent = world.simulationTransform(
        input.parentWorldTransform,
      );
      const enabled = descriptor.options.enabled;
      const reenabled = !this.wasEnabled && enabled;
      const local = bodyLocalTransformFromPrimitive2D(
        input.componentType,
        input.style,
      );
      if (
        this.bodyPresentation === undefined ||
        reenabled ||
        descriptor.bodyType !== "dynamic"
      ) {
        this.bodyPresentation = captureBodyPresentation2D(
          simulationParent,
          local,
          input.componentName,
          descriptor.bodyType === "dynamic" && enabled,
        );
      }
      const presentation = this.bodyPresentation;
      let bodyFrames = bodyFramesByWorld2D.get(world);
      if (!bodyFrames) {
        bodyFrames = new Map();
        bodyFramesByWorld2D.set(world, bodyFrames);
      }
      let presentationTransform2D: DOMMatrix | undefined;
      let effectiveBodyFrame: DOMMatrix;
      if (!enabled || descriptor.bodyType !== "dynamic") {
        effectiveBodyFrame = world.rootTransform(
          matrixFromPose(presentation.initialPose),
        );
      } else {
        world.handle.revision.get();
        const presentedPose = reenabled
          ? presentation.initialPose
          : (world.presentationPose(bodyId) ?? presentation.initialPose);
        presentationTransform2D = resolveDynamicPresentationTransform2D(
          presentation,
          presentedPose,
          simulationParent,
          local,
          input.componentName,
        );
        effectiveBodyFrame = input.parentWorldTransform.multiply(
          presentationTransform2D.multiply(local),
        );
      }
      bodyFrames.set(
        bodyId,
        Object.freeze({
          poseMatrix: effectiveBodyFrame,
          preBodyLineage: input.presentationTransformLineage,
          untrackedCanvasTransformCount:
            (input.presentationTransformLineage
              ?.untrackedCanvasTransformCount ?? 0) +
            (input.hasUntrackedCanvasTransform ? 1 : 0),
        }),
      );
      this.bodyFrameWorld = world;
      this.bodyFrameId = bodyId;
      const collider = descriptor.options.collider;
      const effectiveCollider =
        collider === false
          ? false
          : collider.shape === "self" && input.componentType === Group
            ? false
            : withColliderShape(
                collider,
                this.bakeShape(
                  collider.shape === "self"
                    ? this.resolveSelfShape(input)
                    : collider.shape,
                  descriptor.bodyType === "dynamic"
                    ? matrixFromPose(presentation.initialPose)
                        .inverse()
                        .multiply(simulationParent)
                        .multiply(local)
                    : relativeColliderTransform2D(
                        effectiveBodyFrame,
                        input.parentWorldTransform,
                      ).multiply(local),
                ),
              );
      const effectiveDescriptor =
        effectiveCollider === collider
          ? descriptor
          : (Object.freeze({
              ...descriptor,
              options: Object.freeze({
                ...descriptor.options,
                collider: effectiveCollider,
              }),
            }) as PhysicsBodyAttachment2DDescriptor);
      world.collectBody(
        this,
        bodyId,
        effectiveDescriptor,
        presentation.initialPose,
      );
      this.wasEnabled = enabled;
      return presentationTransform2D === undefined
        ? undefined
        : { presentationTransform2D };
    } else {
      const bodyFrame = requireBodyFrame(world, bodyId);
      const lineageTransform = relativeColliderTransformFromLineage2D(
        bodyFrame,
        input,
      );
      const options = withColliderShape(
        this.descriptor.options,
        this.bakeShape(
          this.descriptor.options.shape === "self"
            ? this.resolveSelfShape(input)
            : this.descriptor.options.shape,
          (
            lineageTransform ??
            relativeColliderTransform2D(
              bodyFrame.poseMatrix,
              input.parentWorldTransform,
            )
          ).multiply(
            bodyLocalTransformFromPrimitive2D(input.componentType, input.style),
          ),
          lineageTransform === undefined,
        ),
      );
      world.collectCollider(this, bodyId, options);
    }
  }

  exit(_success: boolean): void {
    try {
      this.releaseBodyScope?.();
    } finally {
      this.releaseBodyScope = undefined;
      this.bodyId = undefined;
      this.world = undefined;
    }
  }

  dispose(): void {
    try {
      this.exit(false);
    } finally {
      this.releaseBodyFrame();
    }
  }

  private releaseBodyFrame(): void {
    const world = this.bodyFrameWorld;
    const bodyId = this.bodyFrameId;
    if (world !== undefined && bodyId !== undefined) {
      const frames = bodyFramesByWorld2D.get(world);
      frames?.delete(bodyId);
      if (frames?.size === 0) bodyFramesByWorld2D.delete(world);
    }
    this.bodyFrameWorld = undefined;
    this.bodyFrameId = undefined;
  }

  resolveShape(
    options: NormalizedPhysicsColliderConfiguration2D,
  ): ShapeRecord2D {
    if (
      this.cachedShapeInput &&
      sameColliderShapeInput(this.cachedShapeInput, options)
    ) {
      return this.cachedShape!;
    }
    if (options.shape === "self") {
      throw new Error(
        "Self collider inference is not available in this runtime task.",
      );
    }
    const transformed =
      options.offset[0] === 0 &&
      options.offset[1] === 0 &&
      options.rotationDegrees === 0
        ? options.shape
        : transformShape2D(options.shape, {
            position: options.offset,
            rotationDegrees: options.rotationDegrees,
          });
    this.cachedShapeInput = options;
    this.cachedShape = requireShapeRecord2D(transformed);
    return this.cachedShape;
  }

  private resolveSelfShape(
    input: PibblInternalPrimitiveAttachmentInput,
  ): PibblPhysicsShape2D {
    const key = `${input.componentName}:${stableGeometryKey(input.style)}`;
    if (key === this.cachedSelfShapeKey) return this.cachedSelfShape!;
    const shape = inferCanvasColliderShape2D(input);
    this.cachedSelfShapeKey = key;
    this.cachedSelfShape = shape;
    return shape;
  }

  private bakeShape(
    shape: PibblPhysicsShape2D,
    transform: DOMMatrixReadOnly,
    stabilizeFallback = true,
  ): PibblPhysicsShape2D {
    const candidate = [
      transform.a,
      transform.b,
      transform.c,
      transform.d,
      transform.e,
      transform.f,
    ];
    const values =
      stabilizeFallback &&
      this.cachedBakedSource === shape &&
      this.cachedBakedTransform !== undefined &&
      sameRelativeTransformWithinCanvasRoundoff(
        this.cachedBakedTransform,
        candidate,
      )
        ? this.cachedBakedTransform
        : candidate;
    if (
      this.cachedBakedSource === shape &&
      this.cachedBakedTransform?.every(
        (value, index) => value === values[index],
      )
    ) {
      return this.cachedBakedShape!;
    }
    const baked = bakeCanvasShapeTransform2D(shape, new DOMMatrix([...values]));
    this.cachedBakedSource = shape;
    this.cachedBakedTransform = Object.freeze(values);
    this.cachedBakedShape = baked;
    return baked;
  }
}

/** @internal Test-only ownership observation. */
export function snapshotPhysicsBodyFrameCountForTest(world: object): number {
  return bodyFramesByWorld2D.get(world)?.size ?? 0;
}

function sameRelativeTransformWithinCanvasRoundoff(
  previous: readonly number[],
  candidate: readonly number[],
): boolean {
  return previous.every((value, index) => {
    const next = candidate[index]!;
    const tolerance =
      index < 4
        ? linearTransformRoundoffTolerance(value, next)
        : translationRoundoffTolerance(value, next);
    return Math.abs(value - next) <= tolerance;
  });
}

function linearTransformRoundoffTolerance(
  previous: number,
  candidate: number,
): number {
  const magnitude = Math.max(1, Math.abs(previous), Math.abs(candidate));
  return (
    RELATIVE_MATRIX_ROUNDOFF_OPERATIONS * Number.EPSILON * magnitude * magnitude
  );
}

function translationRoundoffTolerance(
  previous: number,
  candidate: number,
): number {
  return (
    RELATIVE_MATRIX_ROUNDOFF_OPERATIONS *
    Number.EPSILON *
    (1 + Math.max(Math.abs(previous), Math.abs(candidate)))
  );
}

function relativeColliderTransform2D(
  bodyFrame: DOMMatrixReadOnly,
  colliderParentFrame: DOMMatrixReadOnly,
): DOMMatrixReadOnly {
  return sameMatrixExactly2D(bodyFrame, colliderParentFrame)
    ? new DOMMatrix()
    : bodyFrame.inverse().multiply(colliderParentFrame);
}

function relativeColliderTransformFromLineage2D(
  bodyFrame: BodyFrame2D,
  input: PibblInternalPrimitiveAttachmentInput,
): DOMMatrix | undefined {
  const inputUntrackedCanvasTransformCount =
    (input.presentationTransformLineage?.untrackedCanvasTransformCount ?? 0) +
    (input.hasUntrackedCanvasTransform ? 1 : 0);
  if (
    inputUntrackedCanvasTransformCount !==
    bodyFrame.untrackedCanvasTransformCount
  ) {
    return undefined;
  }
  const nodes: DOMMatrix[] = [];
  let cursor = input.presentationTransformLineage;
  while (cursor !== bodyFrame.preBodyLineage) {
    if (cursor === undefined) return undefined;
    nodes.push(cursor.localTransform);
    cursor = cursor.parent;
  }
  nodes.reverse();
  if (nodes.length === 0) return new DOMMatrix();
  let relative = new DOMMatrix();
  for (const transform of nodes.slice(1)) {
    relative = relative.multiply(transform);
  }
  return relative;
}

function sameMatrixExactly2D(
  left: DOMMatrixReadOnly,
  right: DOMMatrixReadOnly,
): boolean {
  return (
    left.a === right.a &&
    left.b === right.b &&
    left.c === right.c &&
    left.d === right.d &&
    left.e === right.e &&
    left.f === right.f
  );
}

function requireBodyFrame(world: object, bodyId: number): BodyFrame2D {
  const frame = bodyFramesByWorld2D.get(world)?.get(bodyId);
  if (!frame)
    throw new Error("A collider requires its body geometry to prepare first.");
  return frame;
}

function withColliderShape(
  options: NormalizedPhysicsColliderConfiguration2D,
  shape: PibblPhysicsShape2D,
): NormalizedPhysicsColliderConfiguration2D {
  return Object.freeze({ ...options, shape });
}

function stableGeometryKey(
  style: Readonly<Record<PropertyKey, unknown>>,
): string {
  return JSON.stringify(style, (key, value: unknown) => {
    if (
      ["fill", "stroke", "opacity", "cursor", "filter", "src"].includes(key)
    ) {
      return undefined;
    }
    if (typeof value === "function") return undefined;
    if (typeof Path2D !== "undefined" && value instanceof Path2D) {
      return "[opaque Path2D]";
    }
    return value;
  });
}

function normalizeOptionalCollider(
  value:
    false | PibblPhysicsColliderConfiguration2D | PibblPhysicsShape2D | undefined,
  path: string,
): false | NormalizedPhysicsColliderConfiguration2D {
  if (value === false) return false;
  if (value === undefined) return normalizeCollider({}, path);
  if (isPhysicsShape2D(value)) return normalizeCollider({ shape: value }, path);
  return normalizeCollider(value, path);
}

function normalizeCollider(
  options: PibblPhysicsColliderConfiguration2D,
  path: string,
): NormalizedPhysicsColliderConfiguration2D {
  const shape = options.shape ?? "self";
  if (shape !== "self") requireShapeRecord2D(shape);
  const restitution = requireNonnegativeNumber(
    options.restitution ?? 0,
    `${path}.restitution`,
  );
  if (restitution > 1) {
    throw new RangeError(`${path}.restitution must be from zero through one.`);
  }
  const sensor = options.sensor ?? false;
  return Object.freeze({
    shape,
    offset: copyFiniteVector2(options.offset ?? [0, 0], `${path}.offset`),
    rotationDegrees: requireFiniteNumber(
      options.rotationDegrees ?? 0,
      `${path}.rotationDegrees`,
    ),
    density: requirePositiveNumber(options.density ?? 1, `${path}.density`),
    friction: requireNonnegativeNumber(
      options.friction ?? 0.5,
      `${path}.friction`,
    ),
    restitution,
    sensor,
    contributesToMass: options.contributesToMass ?? !sensor,
    collisionFilter: normalizeCollisionFilter(options.collisionFilter, path),
    tag: options.tag,
    handlers: normalizeHandlers(options, path),
  });
}

function normalizeCollisionFilter(
  filter: PibblPhysicsCollisionFilter | undefined,
  path: string,
): NormalizedPhysicsCollisionFilter2D {
  return Object.freeze({
    category: requireSafeIntegerInRange(
      filter?.category ?? 1,
      0,
      0xffff_ffff,
      `${path}.collisionFilter.category`,
    ),
    mask: requireSafeIntegerInRange(
      filter?.mask ?? 0xffff_ffff,
      0,
      0xffff_ffff,
      `${path}.collisionFilter.mask`,
    ),
    group: requireSafeIntegerInRange(
      filter?.group ?? 0,
      -0x8000_0000,
      0x7fff_ffff,
      `${path}.collisionFilter.group`,
    ),
  });
}

function normalizeHandlers(
  options: PibblPhysicsColliderConfiguration2D,
  path: string,
): NormalizedPhysicsColliderConfiguration2D["handlers"] {
  const handlers = {
    onCollisionStart: options.onCollisionStart,
    onCollisionEnd: options.onCollisionEnd,
    onHit: options.onHit,
    onOverlapStart: options.onOverlapStart,
    onOverlapEnd: options.onOverlapEnd,
  };
  for (const [name, handler] of Object.entries(handlers)) {
    if (handler !== undefined && typeof handler !== "function") {
      throw new TypeError(`${path}.${name} must be a function.`);
    }
  }
  return Object.freeze(handlers);
}

function isPhysicsShape2D(value: object): value is PibblPhysicsShape2D {
  try {
    requireShapeRecord2D(value as PibblPhysicsShape2D);
    return true;
  } catch {
    return false;
  }
}

function sameColliderShapeInput(
  left: NormalizedPhysicsColliderConfiguration2D,
  right: NormalizedPhysicsColliderConfiguration2D,
): boolean {
  return (
    left.shape === right.shape &&
    left.offset[0] === right.offset[0] &&
    left.offset[1] === right.offset[1] &&
    left.rotationDegrees === right.rotationDegrees
  );
}
