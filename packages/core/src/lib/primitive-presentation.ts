import {
  getPrimitivePresentation,
  setPrimitivePresentation,
} from './element/metadata.js';
import { GLOBAL_STATE } from './global-state.js';
import {
  getCurrentWorldTransform,
  hasCurrentWorldTransformCanvasDelta,
  setCurrentWorldTransformAnchor,
} from './render-target.js';
import { pushClippingPath } from './util/push-clipping-path.js';

export interface PrimitivePresentation {
  readonly transform?: DOMMatrix;
  readonly clip?: {
    readonly path: Path2D;
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
    const untrackedCanvasTransformCount =
      (previousLineage?.untrackedCanvasTransformCount ?? 0) +
      (hasCurrentWorldTransformCanvasDelta() ? 1 : 0);
    const currentWorld = getCurrentWorldTransform();
    if (options.deferPaint) {
      GLOBAL_STATE.worldBaseTransform = previousWorldBase.multiply(transform);
    } else {
      context.setTransform(context.getTransform().multiply(transform));
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
