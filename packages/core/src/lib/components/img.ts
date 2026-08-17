import { defineComp } from '../define-comp.js';
import { crcRectPath } from '../hooks/crc-rect-path.js';
import { crcState } from '../hooks/crc-state.js';
import { crcWhenChanged } from '../hooks/crc-when-changed.js';
import {
  AlphaProps,
  CRCBasicMouseEvents,
  CursorStyleProps,
  IntrinsicProps,
  PixelGridAlignment,
  RenderingContext2D,
  StrokeStyleProps,
  SystemStyle,
} from '../types.js';
import { adjustRectangleToPixelGrid } from '../util/pixel-grid-adjustments.js';
import { wireCommonEvents } from '../util/wire-common-events.js';

export interface ImgProps
  extends IntrinsicProps,
  CRCBasicMouseEvents,
  AlphaProps,
  CursorStyleProps,
  StrokeStyleProps {
  src: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  alignToPixelGrid?: PixelGridAlignment;
}

interface LoadedImage {
  src: string;
  element: HTMLImageElement;
}

function Img(props: ImgProps, _style: SystemStyle, ctx: RenderingContext2D) {
  let {
    alpha,
    src,
    x,
    y,
    width,
    height,
    lineWidth,
    strokeStyle,
    alignToPixelGrid,
    ...otherProps
  } = props;

  if (alpha !== undefined) {
    ctx.globalAlpha = ctx.globalAlpha * alpha;
  }

  const [loadedImage, setLoadedImage] = crcState<LoadedImage | null>(null);
  const image = loadedImage?.src === src ? loadedImage.element : null;

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
      lineWidth ?? 0,
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

  if (strokeStyle && lineWidth) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.stroke(imagePath);
  }

  wireCommonEvents(otherProps, imagePath, true, lineWidth ?? 0);
}

/**
 * Creates a renderable Img component element.
 */
export const img = defineComp(Img);
