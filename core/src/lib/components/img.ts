import { defineComp } from '../define-comp';
import { crcCursor } from '../hooks/crc-cursor';
import { crcRectPath } from '../hooks/crc-rect-path';
import { crcState } from '../hooks/crc-state';
import { crcWhenChanged } from '../hooks/crc-when-changed';
import {
  IntrinsicProps,
  CRCBasicMouseEvents,
  AlphaProps,
  CursorStyleProps,
  StrokeStyleProps,
  PixelGridAlignment,
  RenderingContext2D,
} from '../types';
import { wireCommonEvents } from '../util/wire-common-events';

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

  crcCursor({
    path: imagePath,
    style: props.cursor,
    fill: true,
    lineInteractionWidth: props.lineWidth,
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
