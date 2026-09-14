import { definePrimitive } from '../define-primitive.js';
import type {
  CRCEventFocusOptions,
  CRCEventHandlers,
  CRCEventParticipationOptions,
} from '../events/types.js';
import { crcRectPath } from '../hooks/crc-rect-path.js';
import { crcState } from '../hooks/crc-state.js';
import { crcWhenChanged } from '../hooks/crc-when-changed.js';
import type {
  CRCPhysics2DPropExtension,
  MeasureInput,
  MeasureResult,
  RenderingContext2D,
  StyleResolutionContext,
} from '../types.js';
import { resolveLength } from '../style/resolve-length.js';
import {
  resolveLocalOffset,
  resolveOptionalLength,
  stripLayoutParticipation,
} from '../style/resolve-built-in.js';
import { registerOpaqueStyleProperties } from '../style/resolve-dispatch.js';
import type { ImgStyle, ResolvedImgStyle } from '../style/types.js';
import { adjustRectangleToPixelGrid } from '../util/pixel-grid-adjustments.js';
import { wireCommonEvents } from '../util/wire-common-events.js';

export interface ImageProps extends CRCEventHandlers, CRCEventFocusOptions, CRCEventParticipationOptions, CRCPhysics2DPropExtension {}

interface LoadedImage {
  src: string;
  element: HTMLImageElement;
}

function renderImage(
  props: ImageProps,
  style: Readonly<ResolvedImgStyle>,
  ctx: RenderingContext2D,
) {
  let {
    src,
    x = 0,
    y = 0,
    width,
    height,
    stroke,
    strokeWidth,
    opacity,
    cursor,
    alignToPixelGrid,
  } = style;

  if (opacity !== undefined) {
    ctx.globalAlpha = ctx.globalAlpha * opacity;
  }

  const [loadedImage, setLoadedImage] = crcState<LoadedImage | null>(null);
  const image =
    loadedImage && loadedImage.src === src ? loadedImage.element : null;

  crcWhenChanged(() => {
    let active = true;
    const BrowserImage = globalThis.Image;
    const element = new BrowserImage();
    const settle = () => {
      active = false;
      element.onload = null;
      element.onerror = null;
    };

    element.onload = () => {
      if (!active) return;
      settle();
      setLoadedImage({ src, element });
    };
    element.onerror = () => {
      if (!active) return;
      settle();
      setLoadedImage(null);
    };
    element.src = src;

    return () => {
      active = false;
      element.onload = null;
      element.onerror = null;
      element.removeAttribute('src');
    };
  }, [src]);

  width = width ?? image?.naturalWidth ?? image?.width ?? 0;
  height = height ?? image?.naturalHeight ?? image?.height ?? 0;

  if (alignToPixelGrid) {
    ({ x, y, width, height } = adjustRectangleToPixelGrid(
      strokeWidth ?? 0,
      x,
      y,
      width,
      height,
      alignToPixelGrid,
    ));
  }

  const imagePath = crcRectPath(x, y, width, height);

  if (image) {
    ctx.drawImage(image, x, y, width, height);
  }

  if (stroke && strokeWidth) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeWidth;
    ctx.stroke(imagePath);
  }

  wireCommonEvents(
    props,
    imagePath,
    true,
    strokeWidth ?? 0,
    cursor,
    { x, y, width, height },
  );
}

/**
 * Describes a Canvas image primitive for JSX or createElement authoring.
 */
export const Image = definePrimitive<
  ImageProps,
  ImgStyle,
  ImgStyle,
  ResolvedImgStyle
>(renderImage, {
  resolveStyle: resolveImageStyle,
  measure: measureImage,
});
registerOpaqueStyleProperties(Image, ['src', 'stroke', 'cursor']);

function resolveImageStyle(
  style: Readonly<ImgStyle>,
  context: Readonly<StyleResolutionContext>,
): ResolvedImgStyle {
  return {
    ...stripLayoutParticipation(style),
    x: resolveLocalOffset(style.x, context.percentageBasis.width, 'x', context),
    y: resolveLocalOffset(style.y, context.percentageBasis.height, 'y', context),
    width: resolveOptionalLength(
      style.width,
      context.percentageBasis.width,
      'width',
      context,
    ),
    height: resolveOptionalLength(
      style.height,
      context.percentageBasis.height,
      'height',
      context,
    ),
  } as ResolvedImgStyle;
}

function measureImage({
  style,
  constraints,
}: MeasureInput<ImageProps, ImgStyle>): MeasureResult {
  if (
    style.width === undefined || style.width === 'auto' ||
    style.height === undefined || style.height === 'auto'
  ) {
    return {
      status: 'unsupported',
      reason: 'Image natural dimensions are unavailable during pure measurement',
    };
  }
  const context = {
    component: 'Image',
    algorithm: 'measurement' as const,
    constraints,
  };
  return {
    status: 'measured',
    size: {
      width: resolveLength(
        style.width,
        constraints.maxWidth,
        'width',
        context,
      )!,
      height: resolveLength(
        style.height,
        constraints.maxHeight,
        'height',
        context,
      )!,
    },
  };
}
