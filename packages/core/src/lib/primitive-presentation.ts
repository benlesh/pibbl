import {
  getPrimitivePresentation,
  setPrimitivePresentation,
} from './element/metadata.js';
import { GLOBAL_STATE } from './global-state.js';
import {
  getCurrentPaintTransform,
  getCurrentWorldTransform,
  hasCurrentWorldTransformCanvasDelta,
  setCurrentWorldTransformAnchor,
} from './render-target.js';
import { pushClippingPath } from './util/push-clipping-path.js';

export interface PrimitivePresentation {
  readonly transform?: DOMMatrix;
  readonly clip?: {
    readonly path: Path2D;
    readonly svgPath?: string;
    readonly fillRule: CanvasFillRule;
  };
}

export interface GroupTransformStyle {
  readonly scaleX?: number;
  readonly scaleY?: number;
  readonly rotationDegrees?: number;
  readonly rotationOrigin?: readonly [number, number];
  readonly translateX?: number;
  readonly translateY?: number;
  readonly skewX?: number;
  readonly skewY?: number;
}

export function createGroupTransform(
  style: Readonly<GroupTransformStyle>,
): DOMMatrix {
  let transform = new DOMMatrix();

  const { scaleX = 1, scaleY = 1 } = style;
  if (scaleX !== 1 || scaleY !== 1) {
    transform = transform.scale(scaleX, scaleY);
  }

  const { rotationDegrees } = style;
  if (rotationDegrees) {
    const [originX, originY] = style.rotationOrigin ?? [0, 0];
    transform = transform
      .translate(originX, originY)
      .rotate(rotationDegrees)
      .translate(-originX, -originY);
  }

  const { translateX = 0, translateY = 0 } = style;
  if (translateX !== 0 || translateY !== 0) {
    transform = transform.translate(translateX, translateY);
  }

  if (style.skewX) transform = transform.skewX(style.skewX);
  if (style.skewY) transform = transform.skewY(style.skewY);
  return transform;
}

export function enterPrimitivePresentation(
  presentation: Readonly<PrimitivePresentation> | undefined,
  options: Readonly<{ deferPaint?: boolean }> = {},
): () => void {
  if (!presentation) return () => undefined;
  const context = GLOBAL_STATE.renderContext;
  const previousWorldBase = GLOBAL_STATE.worldBaseTransform;
  const previousWorldExact = GLOBAL_STATE.worldExactTransform;
  const previousWorldPaintAnchor = GLOBAL_STATE.worldPaintAnchorTransform;
  const previousLineage = GLOBAL_STATE.presentationTransformLineage;
  if (!context || !previousWorldBase) {
    throw new Error('Primitive presentation requires an active render target.');
  }

  const { transform, clip } = presentation;
  if (transform) {
    // These calculations share one synchronous Canvas snapshot. No user code runs
    // between the read and applying the Pibbl-owned presentation transform.
    const currentPaint = getCurrentPaintTransform();
    const currentWorld = getCurrentWorldTransform(currentPaint);
    const untrackedCanvasTransformCount =
      (previousLineage?.untrackedCanvasTransformCount ?? 0) +
      (GLOBAL_STATE.presentationTransformLineageTrackingDepth > 0 &&
        hasCurrentWorldTransformCanvasDelta(currentPaint) ? 1 : 0);
    if (options.deferPaint) {
      GLOBAL_STATE.worldBaseTransform = previousWorldBase.multiply(transform);
    } else {
      if (transform.is2D) {
        context.transform(transform.a, transform.b, transform.c, transform.d, transform.e, transform.f);
      } else {
        // Keep Canvas validation for unsupported non-affine matrices.
        context.setTransform(context.getTransform().multiply(transform));
      }
    }
    setCurrentWorldTransformAnchor(currentWorld.multiply(transform));
    if (GLOBAL_STATE.presentationTransformLineageTrackingDepth > 0) {
      GLOBAL_STATE.presentationTransformLineage = Object.freeze({
        parent: previousLineage,
        localTransform: transform,
        untrackedCanvasTransformCount,
      });
    }
  }

  let releaseClip: (() => void) | undefined;
  try {
    if (clip) {
      releaseClip = pushClippingPath(
        context,
        clip.path,
        clip.fillRule,
        !options.deferPaint,
        clip.svgPath,
      );
    }
  } catch (error) {
    GLOBAL_STATE.worldBaseTransform = previousWorldBase;
    GLOBAL_STATE.worldExactTransform = previousWorldExact;
    GLOBAL_STATE.worldPaintAnchorTransform = previousWorldPaintAnchor;
    GLOBAL_STATE.presentationTransformLineage = previousLineage;
    throw error;
  }

  let active = true;
  return () => {
    if (!active) return;
    active = false;
    releaseClip?.();
    GLOBAL_STATE.worldExactTransform = previousWorldExact;
    GLOBAL_STATE.worldPaintAnchorTransform = previousWorldPaintAnchor;
    GLOBAL_STATE.presentationTransformLineage = previousLineage;
    if (options.deferPaint) {
      GLOBAL_STATE.worldBaseTransform = previousWorldBase;
    }
  };
}

export { getPrimitivePresentation, setPrimitivePresentation };
