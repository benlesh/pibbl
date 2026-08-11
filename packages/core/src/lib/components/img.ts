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
} from '../types.js';
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

function Img(props: ImgProps, ctx: RenderingContext2D) {
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

  if (alpha) {
    ctx.globalAlpha = ctx.globalAlpha * alpha;
  }

  const [image, setImage] = crcState<HTMLImageElement | null>(null);

  crcWhenChanged(() => {
    const img = new Image();
    img.onload = () => {
      setImage(img);
    };
    img.src = src;
  }, [src]);

  width = width ?? image?.width ?? 0;
  height = height ?? image?.height ?? 0;

  const imagePath = crcRectPath(x, y, width, height, {
    alignToPixelGrid,
    lineWidth,
  });

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
