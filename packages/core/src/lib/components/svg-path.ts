import { defineComp } from '../define-comp.js';
import { crcSvgPath } from '../hooks/crc-svg-path.js';
import {
  AlphaProps,
  CRCBasicMouseEvents,
  CursorStyleProps,
  FillStyleProps,
  IntrinsicProps,
  RenderingContext2D,
  StrokeStyleProps,
  SystemStyle,
} from '../types.js';
import { Path } from './path.js';

export interface SvgPathProps
  extends IntrinsicProps,
  CRCBasicMouseEvents,
  FillStyleProps,
  StrokeStyleProps,
  AlphaProps,
  CursorStyleProps {
  d: string;
}

function SvgPath(
  props: SvgPathProps,
  _style: SystemStyle,
  ctx: RenderingContext2D,
) {
  const { d, ...pathProps } = props;
  const svgPath = crcSvgPath(d);
  return Path(
    {
      ...pathProps,
      path: svgPath,
    },
    {},
    ctx,
  );
}

/**
 * Creates a renderable SvgPath component element.
 */
export const svgPath = defineComp(SvgPath);
