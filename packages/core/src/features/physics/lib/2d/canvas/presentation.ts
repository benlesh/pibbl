import type { PibblPhysicsPose2D } from "../../../2d-geometry.js";
import { Group } from "@pibbl/core";

const MATRIX_EPSILON = 1e-6;

export interface CanvasBodyPresentationCapture2D {
  readonly initialPose: PibblPhysicsPose2D;
  readonly parentWorld: DOMMatrix;
  readonly initialBodyLocal: DOMMatrix;
  readonly poseResidual: DOMMatrix;
}

export function captureBodyPresentation2D(
  parentWorld: DOMMatrixReadOnly,
  initialBodyLocal: DOMMatrixReadOnly,
  componentName: string,
  requireRigidAncestor = true,
): CanvasBodyPresentationCapture2D {
  if (requireRigidAncestor) validateRigidAncestor(parentWorld, componentName);
  else
    validateFiniteInvertible(
      parentWorld,
      `${componentName} ancestor transform`,
    );
  validateFiniteInvertible(
    initialBodyLocal,
    `${componentName} authored transform`,
  );
  if (requireRigidAncestor) {
    validateUnskewed(initialBodyLocal, `${componentName} authored transform`);
  }
  const world = copyMatrix(parentWorld).multiply(initialBodyLocal);
  const scaleX = Math.hypot(world.a, world.b);
  const initialPose = Object.freeze({
    position: Object.freeze([clean(world.e), clean(world.f)] as const),
    rotationDegrees: clean(
      (Math.atan2(world.b / scaleX, world.a / scaleX) * 180) / Math.PI,
    ),
  });
  const poseMatrix = matrixFromPose(initialPose);
  return Object.freeze({
    initialPose,
    parentWorld: copyMatrix(parentWorld),
    initialBodyLocal: copyMatrix(initialBodyLocal),
    poseResidual: poseMatrix.inverse().multiply(world),
  });
}

export function resolveDynamicPresentationTransform2D(
  capture: CanvasBodyPresentationCapture2D,
  presentedPose: PibblPhysicsPose2D,
  parentWorld: DOMMatrixReadOnly,
  currentBodyLocal: DOMMatrixReadOnly,
  componentName: string,
): DOMMatrix {
  validateRigidAncestor(parentWorld, componentName);
  if (!sameMatrix(parentWorld, capture.parentWorld)) {
    throw new Error(
      `${componentName} ancestor transform changed while an enabled dynamic body owns pose. ` +
        "Use teleportBody2D(), a kinematic body, or disable physics before authored motion.",
    );
  }
  if (!sameMatrix(currentBodyLocal, capture.initialBodyLocal)) {
    throw new Error(
      `${componentName} authored pose changed while an enabled dynamic body owns pose. ` +
        "Use teleportBody2D(), a kinematic body, or disable physics before authored motion.",
    );
  }
  validatePose(presentedPose, componentName);
  const presentedWorld = matrixFromPose(presentedPose).multiply(
    capture.poseResidual,
  );
  const result = copyMatrix(parentWorld)
    .inverse()
    .multiply(presentedWorld)
    .multiply(copyMatrix(capture.initialBodyLocal).inverse());
  return cleanMatrix(result);
}

export function bodyLocalTransformFromPrimitive2D(
  componentType: Function,
  style: Readonly<Record<PropertyKey, unknown>>,
): DOMMatrix {
  let transform = new DOMMatrix().translate(
    finiteStyleNumber(style.left, 0, "left"),
    finiteStyleNumber(style.top, 0, "top"),
  );
  if (componentType !== Group) return transform;
  const scaleX = finiteStyleNumber(style.scaleX, 1, "scaleX");
  const scaleY = finiteStyleNumber(style.scaleY, 1, "scaleY");
  if (scaleX !== 1 || scaleY !== 1) transform = transform.scale(scaleX, scaleY);
  const rotation = finiteStyleNumber(
    style.rotationDegrees,
    0,
    "rotationDegrees",
  );
  if (rotation !== 0) {
    const origin = style.rotationOrigin ?? [0, 0];
    if (
      !Array.isArray(origin) ||
      origin.length !== 2 ||
      origin.some(
        (value) => typeof value !== "number" || !Number.isFinite(value),
      )
    ) {
      throw new TypeError(
        "Group rotationOrigin must be a finite two-dimensional point.",
      );
    }
    transform = transform
      .translate(origin[0], origin[1])
      .rotate(rotation)
      .translate(-origin[0], -origin[1]);
  }
  const translateX = finiteStyleNumber(style.translateX, 0, "translateX");
  const translateY = finiteStyleNumber(style.translateY, 0, "translateY");
  if (translateX !== 0 || translateY !== 0)
    transform = transform.translate(translateX, translateY);
  const skewX = finiteStyleNumber(style.skewX, 0, "skewX");
  const skewY = finiteStyleNumber(style.skewY, 0, "skewY");
  if (skewX !== 0) transform = transform.skewX(skewX);
  if (skewY !== 0) transform = transform.skewY(skewY);
  return transform;
}

function validatePose(pose: PibblPhysicsPose2D, componentName: string): void {
  if (
    !Number.isFinite(pose.position[0]) ||
    !Number.isFinite(pose.position[1]) ||
    !Number.isFinite(pose.rotationDegrees)
  ) {
    throw new TypeError(
      `${componentName} physics presentation pose must be finite.`,
    );
  }
}

function validateRigidAncestor(
  matrix: DOMMatrixReadOnly,
  componentName: string,
): void {
  validateFiniteInvertible(
    matrix,
    `${componentName} dynamic ancestor transform`,
  );
  validateUnskewed(matrix, `${componentName} dynamic ancestor transform`);
  const scaleX = Math.hypot(matrix.a, matrix.b);
  const scaleY = Math.hypot(matrix.c, matrix.d);
  if (!close(scaleX, 1) || !close(scaleY, 1)) {
    throw new Error(
      `${componentName} has a non-rigid dynamic ancestor scale. Bake scale into collider geometry or move the body outside that ancestor.`,
    );
  }
}

function validateFiniteInvertible(
  matrix: DOMMatrixReadOnly,
  label: string,
): void {
  const values = [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f];
  if (values.some((value) => !Number.isFinite(value))) {
    throw new TypeError(`${label} must contain only finite values.`);
  }
  if (Math.abs(matrix.a * matrix.d - matrix.b * matrix.c) <= 1e-10) {
    throw new Error(`${label} is noninvertible.`);
  }
}

function validateUnskewed(matrix: DOMMatrixReadOnly, label: string): void {
  const scaleX = Math.hypot(matrix.a, matrix.b);
  const scaleY = Math.hypot(matrix.c, matrix.d);
  const dot = (matrix.a * matrix.c + matrix.b * matrix.d) / (scaleX * scaleY);
  if (Math.abs(dot) > 1e-8)
    throw new Error(`${label} is skewed and cannot define a rigid body pose.`);
}

function sameMatrix(
  left: DOMMatrixReadOnly,
  right: DOMMatrixReadOnly,
): boolean {
  return (
    close(left.a, right.a) &&
    close(left.b, right.b) &&
    close(left.c, right.c) &&
    close(left.d, right.d) &&
    close(left.e, right.e) &&
    close(left.f, right.f)
  );
}

function close(left: number, right: number): boolean {
  return Math.abs(left - right) <= MATRIX_EPSILON;
}

function clean(value: number): number {
  return Math.abs(value) <= MATRIX_EPSILON ? 0 : value;
}

function cleanMatrix(source: DOMMatrixReadOnly): DOMMatrix {
  return new DOMMatrix([
    clean(source.a),
    clean(source.b),
    clean(source.c),
    clean(source.d),
    clean(source.e),
    clean(source.f),
  ]);
}

function copyMatrix(source: DOMMatrixReadOnly): DOMMatrix {
  return new DOMMatrix([
    source.a,
    source.b,
    source.c,
    source.d,
    source.e,
    source.f,
  ]);
}

export function matrixFromPose(pose: PibblPhysicsPose2D): DOMMatrix {
  return new DOMMatrix()
    .translate(pose.position[0], pose.position[1])
    .rotate(pose.rotationDegrees);
}

function finiteStyleNumber(
  value: unknown,
  fallback: number,
  property: string,
): number {
  const resolved = value ?? fallback;
  if (typeof resolved !== "number" || !Number.isFinite(resolved)) {
    throw new TypeError(`Resolved Group ${property} must be finite.`);
  }
  return resolved;
}
