import { isSignal } from "@crc/core";
import {
  crcInternalCreatePropAttachment,
  type CRCInternalPrimitiveAttachmentInput,
  type CRCInternalMountedPropAttachment,
} from "@crc/core/internal";
import {
  pushPhysicsPresentation,
  resolveWebGLPhysicsPrimitive,
  type CRCWebGLPhysicsPrimitiveFacts,
} from "@crc/webgl/internal";
import type {
  CRCPhysicsQuaternion,
  CRCPhysicsShape3D,
  CRCPhysicsVector3,
} from "../../../3d-geometry.js";
import { transformShape3D } from "../../../3d-geometry.js";
import {
  copyCanonicalQuaternion,
  copyFiniteVector3,
} from "../math.js";
import { requireShapeRecord3D, type ShapeRecord3D } from "../shape-records.js";
import type {
  CRCPhysicsAttachment3D,
  CRCPhysicsAxisLocks3D,
  CRCPhysicsBodyAttachment3D,
  CRCPhysicsBodyHandle3D,
  CRCPhysicsColliderAttachment3D,
  CRCPhysicsColliderConfiguration3D,
  CRCPhysicsCollisionFilter,
  CRCPhysicsDynamicBody3DOptions,
  CRCPhysicsKinematicBody3DOptions,
  CRCPhysicsKinematicTarget3D,
  CRCPhysicsStaticBody3DOptions,
} from "../types.js";
import {
  requireFiniteNumber,
  requireNonnegativeNumber,
  requirePositiveNumber,
  requireSafeIntegerInRange,
} from "../../shared/validation.js";
import {
  pushPhysicsBody3D,
  requireCurrentPhysicsBody3D,
  requireCurrentPhysicsWorld3D,
} from "./context.js";
import {
  bakeWebGLShapeTransform3D,
  inferWebGLColliderShape3D,
} from "../webgl/inference.js";
import {
  captureWebGLBodyPresentation3D,
  resolveWebGLBodyFrame3D,
  resolveWebGLColliderForwardMatrix3D,
  resolveWebGLDynamicPresentationMatrix3D,
  type WebGLBodyFrame3D,
  type WebGLBodyPresentationCapture3D,
} from "../webgl/presentation.js";

const bodyFramesByWorld3D = new WeakMap<object, Map<number, WebGLBodyFrame3D>>();

const attachmentRecord3DSymbol = Symbol("CRCPhysicsAttachment3D");

export interface NormalizedPhysicsCollisionFilter3D {
  readonly category: number;
  readonly mask: number;
  readonly group: number;
}

export interface NormalizedPhysicsColliderConfiguration3D {
  readonly shape: "self" | CRCPhysicsShape3D;
  readonly offset: CRCPhysicsVector3;
  readonly orientation: CRCPhysicsQuaternion;
  readonly density: number;
  readonly friction: number;
  readonly restitution: number;
  readonly sensor: boolean;
  readonly contributesToMass: boolean;
  readonly collisionFilter: NormalizedPhysicsCollisionFilter3D;
  readonly tag: unknown;
  readonly handlers: Readonly<{
    readonly onCollisionStart?: CRCPhysicsColliderConfiguration3D["onCollisionStart"];
    readonly onCollisionEnd?: CRCPhysicsColliderConfiguration3D["onCollisionEnd"];
    readonly onHit?: CRCPhysicsColliderConfiguration3D["onHit"];
    readonly onOverlapStart?: CRCPhysicsColliderConfiguration3D["onOverlapStart"];
    readonly onOverlapEnd?: CRCPhysicsColliderConfiguration3D["onOverlapEnd"];
  }>;
}

export interface NormalizedPhysicsDynamicBody3DOptions {
  readonly enabled: boolean;
  readonly handle: CRCPhysicsBodyHandle3D | undefined;
  readonly linearVelocity: CRCPhysicsVector3;
  readonly angularVelocityDegreesPerSecond: CRCPhysicsVector3;
  readonly linearDamping: number;
  readonly angularDamping: number;
  readonly gravityScale: number;
  readonly mass: "auto" | number;
  readonly lockTranslation: Required<CRCPhysicsAxisLocks3D>;
  readonly lockRotation: Required<CRCPhysicsAxisLocks3D>;
  readonly allowSleep: boolean;
  readonly ccd: boolean;
  readonly reenableVelocity: "zero" | "preserve";
  readonly collider: false | NormalizedPhysicsColliderConfiguration3D;
}

export interface NormalizedPhysicsStaticBody3DOptions {
  readonly enabled: boolean;
  readonly handle: CRCPhysicsBodyHandle3D | undefined;
  readonly collider: false | NormalizedPhysicsColliderConfiguration3D;
}

export interface NormalizedPhysicsKinematicBody3DOptions {
  readonly enabled: boolean;
  readonly handle: CRCPhysicsBodyHandle3D | undefined;
  readonly target: Readonly<CRCPhysicsKinematicTarget3D>;
  readonly allowSleep: boolean;
  readonly collider: false | NormalizedPhysicsColliderConfiguration3D;
}

export type PhysicsBodyAttachment3DDescriptor =
  | Readonly<{ kind: "body"; bodyType: "dynamic"; options: NormalizedPhysicsDynamicBody3DOptions }>
  | Readonly<{ kind: "body"; bodyType: "static"; options: NormalizedPhysicsStaticBody3DOptions }>
  | Readonly<{ kind: "body"; bodyType: "kinematic"; options: NormalizedPhysicsKinematicBody3DOptions }>;

export interface PhysicsColliderAttachment3DDescriptor {
  readonly kind: "collider";
  readonly options: NormalizedPhysicsColliderConfiguration3D;
}

export type PhysicsAttachment3DDescriptor =
  | PhysicsBodyAttachment3DDescriptor
  | PhysicsColliderAttachment3DDescriptor;

type RegisteredAttachment3D = Readonly<{
  readonly [attachmentRecord3DSymbol]: PhysicsAttachment3DDescriptor;
}>;

export function dynamicBody3D(
  options: CRCPhysicsDynamicBody3DOptions = {},
): CRCPhysicsBodyAttachment3D {
  const mass = options.mass ?? "auto";
  if (mass !== "auto") requirePositiveNumber(mass, "options.mass");
  const reenableVelocity = options.reenableVelocity ?? "zero";
  if (reenableVelocity !== "zero" && reenableVelocity !== "preserve") {
    throw new TypeError('options.reenableVelocity must be "zero" or "preserve".');
  }
  return createAttachment({
    kind: "body",
    bodyType: "dynamic",
    options: Object.freeze({
      enabled: options.enabled ?? true,
      handle: options.handle,
      linearVelocity: freezeVector(copyFiniteVector3(
        options.linearVelocity ?? [0, 0, 0],
        "options.linearVelocity",
      )),
      angularVelocityDegreesPerSecond: freezeVector(copyFiniteVector3(
        options.angularVelocityDegreesPerSecond ?? [0, 0, 0],
        "options.angularVelocityDegreesPerSecond",
      )),
      linearDamping: requireNonnegativeNumber(options.linearDamping ?? 0, "options.linearDamping"),
      angularDamping: requireNonnegativeNumber(options.angularDamping ?? 0, "options.angularDamping"),
      gravityScale: requireFiniteNumber(options.gravityScale ?? 1, "options.gravityScale"),
      mass,
      lockTranslation: normalizeLocks(options.lockTranslation),
      lockRotation: normalizeLocks(options.lockRotation),
      allowSleep: options.allowSleep ?? true,
      ccd: options.ccd ?? false,
      reenableVelocity,
      collider: normalizeOptionalCollider(options.collider, "options.collider"),
    }),
  });
}

export function staticBody3D(
  options: CRCPhysicsStaticBody3DOptions = {},
): CRCPhysicsBodyAttachment3D {
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

export function kinematicBody3D(
  options: CRCPhysicsKinematicBody3DOptions = {},
): CRCPhysicsBodyAttachment3D {
  const target = options.target ?? {};
  if (target.position !== undefined && !isSignal(target.position)) {
    throw new TypeError("options.target.position must be a CRC signal.");
  }
  if (target.orientation !== undefined && !isSignal(target.orientation)) {
    throw new TypeError("options.target.orientation must be a CRC signal.");
  }
  return createAttachment({
    kind: "body",
    bodyType: "kinematic",
    options: Object.freeze({
      enabled: options.enabled ?? true,
      handle: options.handle,
      target: Object.freeze({
        position: target.position,
        orientation: target.orientation,
      }),
      allowSleep: options.allowSleep ?? true,
      collider: normalizeOptionalCollider(options.collider, "options.collider"),
    }),
  });
}

export function collider3D(
  options: CRCPhysicsColliderConfiguration3D = {},
): CRCPhysicsColliderAttachment3D {
  return createAttachment({ kind: "collider", options: normalizeCollider(options, "options") });
}

export function requirePhysicsAttachment3DDescriptor(
  value: CRCPhysicsAttachment3D,
): PhysicsAttachment3DDescriptor {
  const descriptor = typeof value === "object" && value !== null
    ? (value as Partial<RegisteredAttachment3D>)[attachmentRecord3DSymbol]
    : undefined;
  if (descriptor === undefined) {
    throw new TypeError("Expected a registered CRC physics 3D attachment.");
  }
  return descriptor;
}

function createAttachment<T extends PhysicsAttachment3DDescriptor>(
  descriptor: T,
): T["kind"] extends "body" ? CRCPhysicsBodyAttachment3D : CRCPhysicsColliderAttachment3D {
  const frozenDescriptor = Object.freeze(descriptor);
  const value = Object.freeze({
    [attachmentRecord3DSymbol]: frozenDescriptor,
  }) as unknown as RegisteredAttachment3D & CRCPhysicsAttachment3D;
  return crcInternalCreatePropAttachment(
    "physics",
    value,
    () => new MountedPhysicsAttachment3D(value),
  ) as never;
}

export class MountedPhysicsAttachment3D implements CRCInternalMountedPropAttachment {
  private descriptor: PhysicsAttachment3DDescriptor;
  private world: ReturnType<typeof requireCurrentPhysicsWorld3D> | undefined;
  private bodyId: number | undefined;
  private releaseBodyScope: (() => void) | undefined;
  private releasePresentationScope: (() => void) | undefined;
  private cachedShapeSource: CRCPhysicsShape3D | undefined;
  private cachedShapeOffset: CRCPhysicsVector3 | undefined;
  private cachedShapeOrientation: CRCPhysicsQuaternion | undefined;
  private cachedShape: ShapeRecord3D | undefined;
  private cachedBakedSource:
    | CRCPhysicsShape3D
    | CRCWebGLPhysicsPrimitiveFacts["kind"]
    | undefined;
  private cachedBakedTransform: readonly number[] | undefined;
  private cachedBakedShape: CRCPhysicsShape3D | undefined;
  private bodyPresentation: WebGLBodyPresentationCapture3D | undefined;
  private wasEnabled = false;

  constructor(value: CRCPhysicsAttachment3D) {
    this.descriptor = requirePhysicsAttachment3DDescriptor(value);
  }

  update(value: unknown): void {
    this.descriptor = requirePhysicsAttachment3DDescriptor(value as CRCPhysicsAttachment3D);
  }

  enter(): void {
    const world = requireCurrentPhysicsWorld3D();
    this.world = world;
    if (this.descriptor.kind === "body") {
      const bodyId = world.bodyIdFor(this);
      this.bodyId = bodyId;
      this.releaseBodyScope = pushPhysicsBody3D({ world, bodyId });
    } else {
      this.bodyId = requireCurrentPhysicsBody3D().bodyId;
    }
  }

  preparePrimitive(input: CRCInternalPrimitiveAttachmentInput): void {
    const world = this.world;
    const bodyId = this.bodyId;
    if (world === undefined || bodyId === undefined) {
      throw new Error("Physics 3D attachment preparation requires its entered scope.");
    }
    const facts = resolveWebGLPhysicsPrimitive(input);
    if (this.descriptor.kind === "body") {
      const descriptor = this.descriptor;
      const enabled = descriptor.options.enabled;
      const reenabled = !this.wasEnabled && enabled;
      if (
        this.bodyPresentation === undefined ||
        reenabled ||
        descriptor.bodyType !== "dynamic"
      ) {
        this.bodyPresentation = captureWebGLBodyPresentation3D(
          facts,
          input.componentName,
        );
      }
      const presentation = this.bodyPresentation;
      const frame = resolveWebGLBodyFrame3D(
        presentation,
        facts,
        input.componentName,
        descriptor.bodyType === "dynamic" && enabled && !reenabled,
      );
      let bodyFrames = bodyFramesByWorld3D.get(world);
      if (bodyFrames === undefined) {
        bodyFrames = new Map();
        bodyFramesByWorld3D.set(world, bodyFrames);
      }
      bodyFrames.set(bodyId, frame);

      if (descriptor.bodyType === "dynamic" && enabled) {
        world.handle.revision.get();
        const presentedPose = reenabled
          ? presentation.initialPose
          : (world.presentationPose(bodyId) ?? presentation.initialPose);
        this.releasePresentationScope = pushPhysicsPresentation(
          resolveWebGLDynamicPresentationMatrix3D(
            presentation,
            presentedPose,
            frame,
            input.componentName,
          ),
        );
      }

      const collider = descriptor.options.collider;
      const effectiveCollider = collider === false ||
          (collider.shape === "self" && facts.kind === "group")
        ? false
        : withColliderShape(
            collider,
            this.resolveBakedShape(
              facts,
              collider.shape,
              frame.geometryMatrix,
              input.componentName,
            ),
          );
      const effectiveDescriptor = effectiveCollider === collider
        ? descriptor
        : Object.freeze({
            ...descriptor,
            options: Object.freeze({
              ...descriptor.options,
              collider: effectiveCollider,
            }),
          }) as PhysicsBodyAttachment3DDescriptor;
      world.collectBody(
        this,
        bodyId,
        effectiveDescriptor,
        presentation.initialPose,
      );
      this.wasEnabled = enabled;
    } else {
      const bodyFrame = requireBodyFrame3D(world, bodyId);
      const matrix = resolveWebGLColliderForwardMatrix3D(
        bodyFrame,
        facts,
        input.componentName,
      );
      const options = withColliderShape(
        this.descriptor.options,
        this.resolveBakedShape(
          facts,
          this.descriptor.options.shape,
          matrix,
          input.componentName,
        ),
      );
      world.collectCollider(this, bodyId, options);
    }
  }

  exit(_success: boolean): void {
    try {
      this.releasePresentationScope?.();
    } finally {
      try {
        this.releaseBodyScope?.();
      } finally {
        this.releasePresentationScope = undefined;
        this.releaseBodyScope = undefined;
        this.bodyId = undefined;
        this.world = undefined;
      }
    }
  }

  dispose(): void {
    this.exit(false);
  }

  resolveShape(options: NormalizedPhysicsColliderConfiguration3D): ShapeRecord3D {
    if (options.shape === "self") {
      throw new Error("Self collider inference is not available in this runtime task.");
    }
    if (
      this.cachedShapeSource === options.shape &&
      sameVector3(this.cachedShapeOffset, options.offset) &&
      sameQuaternion(this.cachedShapeOrientation, options.orientation)
    ) {
      return this.cachedShape!;
    }
    const identityOrientation =
      options.orientation[0] === 0 && options.orientation[1] === 0 &&
      options.orientation[2] === 0 && options.orientation[3] === 1;
    const transformed =
      options.offset[0] === 0 && options.offset[1] === 0 && options.offset[2] === 0 && identityOrientation
        ? options.shape
        : transformShape3D(options.shape, {
            position: options.offset,
            orientation: options.orientation,
          });
    this.cachedShapeSource = options.shape;
    this.cachedShapeOffset = options.offset;
    this.cachedShapeOrientation = options.orientation;
    this.cachedShape = requireShapeRecord3D(transformed);
    return this.cachedShape;
  }

  private resolveBakedShape(
    facts: CRCWebGLPhysicsPrimitiveFacts,
    source: "self" | CRCPhysicsShape3D,
    transform: Readonly<ArrayLike<number>>,
    componentName: string,
  ): CRCPhysicsShape3D {
    const sourceKey = source === "self" ? facts.kind : source;
    const values = Object.freeze(Array.from(transform));
    if (
      this.cachedBakedSource === sourceKey &&
      this.cachedBakedTransform?.every(
        (value, index) => value === values[index],
      )
    ) {
      return this.cachedBakedShape!;
    }
    const shape = source === "self"
      ? inferWebGLColliderShape3D(facts, values)
      : bakeWebGLShapeTransform3D(source, values, componentName);
    this.cachedBakedSource = sourceKey;
    this.cachedBakedTransform = values;
    this.cachedBakedShape = shape;
    return shape;
  }
}

function requireBodyFrame3D(
  world: object,
  bodyId: number,
): WebGLBodyFrame3D {
  const frame = bodyFramesByWorld3D.get(world)?.get(bodyId);
  if (frame === undefined) {
    throw new Error("A collider requires its body geometry to prepare first.");
  }
  return frame;
}

function withColliderShape(
  options: NormalizedPhysicsColliderConfiguration3D,
  shape: CRCPhysicsShape3D,
): NormalizedPhysicsColliderConfiguration3D {
  return Object.freeze({ ...options, shape });
}

function sameVector3(
  left: CRCPhysicsVector3 | undefined,
  right: CRCPhysicsVector3,
): boolean {
  return left !== undefined &&
    left[0] === right[0] &&
    left[1] === right[1] &&
    left[2] === right[2];
}

function sameQuaternion(
  left: CRCPhysicsQuaternion | undefined,
  right: CRCPhysicsQuaternion,
): boolean {
  return left !== undefined &&
    left[0] === right[0] &&
    left[1] === right[1] &&
    left[2] === right[2] &&
    left[3] === right[3];
}

function normalizeOptionalCollider(
  value: false | CRCPhysicsColliderConfiguration3D | CRCPhysicsShape3D | undefined,
  path: string,
): false | NormalizedPhysicsColliderConfiguration3D {
  if (value === false) return false;
  if (value === undefined) return normalizeCollider({}, path);
  try {
    requireShapeRecord3D(value as CRCPhysicsShape3D);
    return normalizeCollider({ shape: value as CRCPhysicsShape3D }, path);
  } catch {
    return normalizeCollider(value as CRCPhysicsColliderConfiguration3D, path);
  }
}

function normalizeCollider(
  options: CRCPhysicsColliderConfiguration3D,
  path: string,
): NormalizedPhysicsColliderConfiguration3D {
  const sensor = options.sensor ?? false;
  const shape = options.shape ?? "self";
  if (shape !== "self") requireShapeRecord3D(shape);
  return Object.freeze({
    shape,
    offset: freezeVector(copyFiniteVector3(options.offset ?? [0, 0, 0], `${path}.offset`)),
    orientation: freezeQuaternion(copyCanonicalQuaternion(
      options.orientation ?? [0, 0, 0, 1],
      `${path}.orientation`,
    )),
    density: requirePositiveNumber(options.density ?? 1, `${path}.density`),
    friction: requireNonnegativeNumber(options.friction ?? 0.5, `${path}.friction`),
    restitution: requireUnitInterval(options.restitution ?? 0, `${path}.restitution`),
    sensor,
    contributesToMass: options.contributesToMass ?? !sensor,
    collisionFilter: normalizeFilter(options.collisionFilter, `${path}.collisionFilter`),
    tag: options.tag,
    handlers: Object.freeze({
      onCollisionStart: options.onCollisionStart,
      onCollisionEnd: options.onCollisionEnd,
      onHit: options.onHit,
      onOverlapStart: options.onOverlapStart,
      onOverlapEnd: options.onOverlapEnd,
    }),
  });
}

function normalizeFilter(
  filter: CRCPhysicsCollisionFilter | undefined,
  path: string,
): NormalizedPhysicsCollisionFilter3D {
  return Object.freeze({
    category: requireSafeIntegerInRange(filter?.category ?? 1, 0, 0xffff_ffff, `${path}.category`),
    mask: requireSafeIntegerInRange(filter?.mask ?? 0xffff_ffff, 0, 0xffff_ffff, `${path}.mask`),
    group: requireSafeIntegerInRange(filter?.group ?? 0, -0x8000_0000, 0x7fff_ffff, `${path}.group`),
  });
}

function normalizeLocks(value: CRCPhysicsAxisLocks3D | undefined): Required<CRCPhysicsAxisLocks3D> {
  return Object.freeze({ x: value?.x ?? false, y: value?.y ?? false, z: value?.z ?? false });
}

function requireUnitInterval(value: number, path: string): number {
  const finite = requireFiniteNumber(value, path);
  if (finite < 0 || finite > 1) throw new RangeError(`${path} must be from 0 through 1.`);
  return finite;
}

function freezeVector(value: ArrayLike<number>): CRCPhysicsVector3 {
  return Object.freeze([value[0]!, value[1]!, value[2]!] as const);
}

function freezeQuaternion(value: ArrayLike<number>): CRCPhysicsQuaternion {
  return Object.freeze([value[0]!, value[1]!, value[2]!, value[3]!] as const);
}
