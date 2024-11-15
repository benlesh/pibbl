import { defineComp } from '../define-comp';
import { crcSvgPath } from '../hooks/crc-svg-path';
import {
  AlphaProps,
  CRCBasicMouseEvents,
  CursorStyleProps,
  FillStyleProps,
  IntrinsicProps,
  RenderingContext2D,
  StrokeStyleProps,
} from '../types';
import { Path } from './path';

export interface SvgPathProps
  extends IntrinsicProps,
    CRCBasicMouseEvents,
    FillStyleProps,
    StrokeStyleProps,
    AlphaProps,
    CursorStyleProps {
  d: string;
}

function SvgPath(props: SvgPathProps, ctx: RenderingContext2D) {
  const { d, ...pathProps } = props;
  const svgPath = crcSvgPath(d);
  return Path(
    {
      ...pathProps,
      path: svgPath,
    },
    ctx
  );
}

/**
 * Creates a renderable SvgPath component element.
 */
export const svgPath = defineComp(SvgPath);
