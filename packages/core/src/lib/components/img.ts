import { defineComp } from '../define-comp.js';
import { crcRectPath } from '../hooks/crc-rect-path.js';
import { crcState } from '../hooks/crc-state.js';
import { crcWhenChanged } from '../hooks/crc-when-changed.js';
import {
  CRCBasicMouseEvents,
  IntrinsicProps,
  RenderingContext2D,
} from '../types.js';
import type { ImgStyle } from '../style/types.js';
import { adjustRectangleToPixelGrid } from '../util/pixel-grid-adjustments.js';
import { wireCommonEvents } from '../util/wire-common-events.js';

export interface ImgProps
  extends IntrinsicProps,
  CRCBasicMouseEvents {}

interface LoadedImage {
  src: string;
  element: HTMLImageElement;
}

function Img(
  props: ImgProps,
  style: Readonly<ImgStyle>,
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
    const element = new Image();
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

  wireCommonEvents(props, imagePath, true, strokeWidth ?? 0, cursor);
}

/**
 * Creates a renderable Img component element.
 */
export const img = defineComp(Img);
