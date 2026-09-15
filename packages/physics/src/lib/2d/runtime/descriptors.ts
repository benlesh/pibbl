import { Group, isSignal } from "@crc/core";
import {
  crcInternalCreatePropAttachment,
  type CRCInternalPrimitiveAttachmentInput,
  type CRCInternalMountedPropAttachment,
} from "@crc/core/internal";
import type {
  CRCPhysicsShape2D,
  CRCPhysicsVector2,
} from "../../../2d-geometry.js";
import { transformShape2D } from "../../../2d-geometry.js";
import { requireShapeRecord2D, type ShapeRecord2D } from "../shape-records.js";
import type {
  CRCPhysicsAttachment2D,
  CRCPhysicsBodyAttachment2D,
  CRCPhysicsBodyHandle2D,
  CRCPhysicsColliderAttachment2D,
  CRCPhysicsColliderConfiguration2D,
  CRCPhysicsCollisionFilter,
  CRCPhysicsDynamicBody2DOptions,
  CRCPhysicsKinematicBody2DOptions,
  CRCPhysicsKinematicTarget2D,
  CRCPhysicsStaticBody2DOptions,
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

const bodyFramesByWorld2D = new WeakMap<
  object,
  Map<number, Readonly<{ poseMatrix: DOMMatrix }>>
>();

const attachmentRecord2DSymbol = Symbol("CRCPhysicsAttachment2D");

export interface NormalizedPhysicsCollisionFilter2D {
  readonly category: number;
  readonly mask: number;
  readonly group: number;
}

export interface NormalizedPhysicsColliderConfiguration2D {
  readonly shape: "self" | CRCPhysicsShape2D;
  readonly offset: CRCPhysicsVector2;
  readonly rotationDegrees: number;
  readonly density: number;
  readonly friction: number;
  readonly restitution: number;
  readonly sensor: boolean;
  readonly contributesToMass: boolean;
  readonly collisionFilter: NormalizedPhysicsCollisionFilter2D;
  readonly tag: unknown;
  readonly handlers: Readonly<{
    readonly onCollisionStart?: CRCPhysicsColliderConfiguration2D["onCollisionStart"];
    readonly onCollisionEnd?: CRCPhysicsColliderConfiguration2D["onCollisionEnd"];
    readonly onHit?: CRCPhysicsColliderConfiguration2D["onHit"];
    readonly onOverlapStart?: CRCPhysicsColliderConfiguration2D["onOverlapStart"];
    readonly onOverlapEnd?: CRCPhysicsColliderConfiguration2D["onOverlapEnd"];
  }>;
}

export interface NormalizedPhysicsDynamicBody2DOptions {
  readonly enabled: boolean;
  readonly handle: CRCPhysicsBodyHandle2D | undefined;
  readonly linearVelocity: CRCPhysicsVector2;
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
  readonly handle: CRCPhysicsBodyHandle2D | undefined;
  readonly collider: false | NormalizedPhysicsColliderConfiguration2D;
}

export interface NormalizedPhysicsKinematicBody2DOptions {
  readonly enabled: boolean;
  readonly handle: CRCPhysicsBodyHandle2D | undefined;
  readonly target: Readonly<CRCPhysicsKinematicTarget2D>;
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

export function dynamicBody2D(
  options: CRCPhysicsDynamicBody2DOptions = {},
): CRCPhysicsBodyAttachment2D {
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

export function staticBody2D(
  options: CRCPhysicsStaticBody2DOptions = {},
): CRCPhysicsBodyAttachment2D {
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

export function kinematicBody2D(
  options: CRCPhysicsKinematicBody2DOptions = {},
): CRCPhysicsBodyAttachment2D {
  const target = options.target ?? {};
  if (target.position !== undefined && !isSignal(target.position)) {
    throw new TypeError("options.target.position must be a CRC signal.");
  }
  if (
    target.rotationDegrees !== undefined &&
    !isSignal(target.rotationDegrees)
  ) {
    throw new TypeError("options.target.rotationDegrees must be a CRC signal.");
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

export function collider2D(
  options: CRCPhysicsColliderConfiguration2D = {},
): CRCPhysicsColliderAttachment2D {
  return createAttachment({
    kind: "collider",
    options: normalizeCollider(options, "options"),
  });
}

export function requirePhysicsAttachment2DDescriptor(
  value: CRCPhysicsAttachment2D,
): PhysicsAttachment2DDescriptor {
  const descriptor =
    typeof value === "object" && value !== null
      ? (value as Partial<RegisteredAttachment2D>)[attachmentRecord2DSymbol]
      : undefined;
  if (descriptor === undefined) {
    throw new TypeError("Expected a registered CRC physics 2D attachment.");
  }
  return descriptor;
}

function createAttachment<T extends PhysicsAttachment2DDescriptor>(
  descriptor: T,
): T["kind"] extends "body"
  ? CRCPhysicsBodyAttachment2D
  : CRCPhysicsColliderAttachment2D {
  const frozenDescriptor = Object.freeze(descriptor);
  const value = Object.freeze({
    [attachmentRecord2DSymbol]: frozenDescriptor,
  }) as unknown as RegisteredAttachment2D & CRCPhysicsAttachment2D;
  return crcInternalCreatePropAttachment(
    "physics",
    value,
    () => new MountedPhysicsAttachment2D(value),
  ) as never;
}

export class MountedPhysicsAttachment2D implements CRCInternalMountedPropAttachment {
  private descriptor: PhysicsAttachment2DDescriptor;
  private world: ReturnType<typeof requireCurrentPhysicsWorld2D> | undefined;
  private bodyId: number | undefined;
  private releaseBodyScope: (() => void) | undefined;
  private cachedShapeInput:
    NormalizedPhysicsColliderConfiguration2D | undefined;
  private cachedShape: ShapeRecord2D | undefined;
  private cachedSelfShapeKey: string | undefined;
  private cachedSelfShape: CRCPhysicsShape2D | undefined;
  private cachedBakedSource: CRCPhysicsShape2D | undefined;
  private cachedBakedTransform: readonly number[] | undefined;
  private cachedBakedShape: CRCPhysicsShape2D | undefined;
  private bodyPresentation: CanvasBodyPresentationCapture2D | undefined;
  private wasEnabled = false;

  constructor(value: CRCPhysicsAttachment2D) {
    this.descriptor = requirePhysicsAttachment2DDescriptor(value);
  }

  update(value: unknown): void {
    this.descriptor = requirePhysicsAttachment2DDescriptor(
      value as CRCPhysicsAttachment2D,
    );
  }

  enter(): void {
    const world = requireCurrentPhysicsWorld2D();
    this.world = world;
    if (this.descriptor.kind === "body") {
      const bodyId = world.bodyIdFor(this);
      this.bodyId = bodyId;
      this.releaseBodyScope = pushPhysicsBody2D({ world, bodyId });
    } else {
      this.bodyId = requireCurrentPhysicsBody2D().bodyId;
    }
  }

  preparePrimitive(
    input: CRCInternalPrimitiveAttachmentInput,
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
          input.parentWorldTransform,
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
      const authoredPoseMatrix = matrixFromPose(presentation.initialPose);
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
                  authoredPoseMatrix
                    .inverse()
                    .multiply(input.parentWorldTransform),
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
      if (!enabled || descriptor.bodyType !== "dynamic") {
        bodyFrames.set(
          bodyId,
          Object.freeze({ poseMatrix: authoredPoseMatrix }),
        );
        return;
      }
      world.handle.revision.get();
      const presentedPose = reenabled
        ? presentation.initialPose
        : (world.presentationPose(bodyId) ?? presentation.initialPose);
      bodyFrames.set(
        bodyId,
        Object.freeze({
          poseMatrix: matrixFromPose(presentedPose).multiply(
            presentation.poseResidual,
          ),
        }),
      );
      return {
        presentationTransform2D: resolveDynamicPresentationTransform2D(
          presentation,
          presentedPose,
          input.parentWorldTransform,
          local,
          input.componentName,
        ),
      };
    } else {
      const options = withColliderShape(
        this.descriptor.options,
        this.bakeShape(
          this.descriptor.options.shape === "self"
            ? this.resolveSelfShape(input)
            : this.descriptor.options.shape,
          requireBodyFrame(world, bodyId)
            .poseMatrix.inverse()
            .multiply(input.parentWorldTransform),
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
    this.exit(false);
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
    input: CRCInternalPrimitiveAttachmentInput,
  ): CRCPhysicsShape2D {
    const key = `${input.componentName}:${stableGeometryKey(input.style)}`;
    if (key === this.cachedSelfShapeKey) return this.cachedSelfShape!;
    const shape = inferCanvasColliderShape2D(input);
    this.cachedSelfShapeKey = key;
    this.cachedSelfShape = shape;
    return shape;
  }

  private bakeShape(
    shape: CRCPhysicsShape2D,
    transform: DOMMatrixReadOnly,
  ): CRCPhysicsShape2D {
    const values = [
      transform.a,
      transform.b,
      transform.c,
      transform.d,
      transform.e,
      transform.f,
    ];
    if (
      this.cachedBakedSource === shape &&
      this.cachedBakedTransform?.every(
        (value, index) => value === values[index],
      )
    ) {
      return this.cachedBakedShape!;
    }
    const baked = bakeCanvasShapeTransform2D(shape, transform);
    this.cachedBakedSource = shape;
    this.cachedBakedTransform = Object.freeze(values);
    this.cachedBakedShape = baked;
    return baked;
  }
}

function requireBodyFrame(
  world: object,
  bodyId: number,
): Readonly<{ poseMatrix: DOMMatrix }> {
  const frame = bodyFramesByWorld2D.get(world)?.get(bodyId);
  if (!frame)
    throw new Error("A collider requires its body geometry to prepare first.");
  return frame;
}

function withColliderShape(
  options: NormalizedPhysicsColliderConfiguration2D,
  shape: CRCPhysicsShape2D,
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
    false | CRCPhysicsColliderConfiguration2D | CRCPhysicsShape2D | undefined,
  path: string,
): false | NormalizedPhysicsColliderConfiguration2D {
  if (value === false) return false;
  if (value === undefined) return normalizeCollider({}, path);
  if (isPhysicsShape2D(value)) return normalizeCollider({ shape: value }, path);
  return normalizeCollider(value, path);
}

function normalizeCollider(
  options: CRCPhysicsColliderConfiguration2D,
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
  filter: CRCPhysicsCollisionFilter | undefined,
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
  options: CRCPhysicsColliderConfiguration2D,
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

function isPhysicsShape2D(value: object): value is CRCPhysicsShape2D {
  try {
    requireShapeRecord2D(value as CRCPhysicsShape2D);
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
