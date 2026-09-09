import {
  getPrimitivePresentation,
  setPrimitivePresentation,
} from './element/metadata.js';
import { GLOBAL_STATE } from './global-state.js';
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
  if (!context || !previousWorldBase) {
    throw new Error('Primitive presentation requires an active render target.');
  }

  const { transform, clip } = presentation;
  if (transform) {
    if (options.deferPaint) {
      GLOBAL_STATE.worldBaseTransform = previousWorldBase.multiply(transform);
    } else {
      context.setTransform(context.getTransform().multiply(transform));
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
    throw error;
  }

  let active = true;
  return () => {
    if (!active) return;
    active = false;
    releaseClip?.();
    if (options.deferPaint) {
      GLOBAL_STATE.worldBaseTransform = previousWorldBase;
    }
  };
}

export { getPrimitivePresentation, setPrimitivePresentation };
