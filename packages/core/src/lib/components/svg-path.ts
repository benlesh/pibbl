import { defineComp } from '../define-comp.js';
import { crcSvgPath } from '../hooks/crc-svg-path.js';
import {
  CRCBasicMouseEvents,
  RenderingContext2D,
} from '../types.js';
import { SvgPathStyle } from '../style/types.js';
import { Path } from './path.js';

export interface SvgPathProps extends CRCBasicMouseEvents {}

function SvgPath(
  props: SvgPathProps,
  style: Readonly<SvgPathStyle>,
  ctx: RenderingContext2D,
) {
  const { d, ...pathStyle } = style;
  const svgPath = crcSvgPath(d);
  return Path(
    props,
    {
      ...pathStyle,
      d: svgPath,
    },
    ctx,
  );
}

/**
 * Creates a renderable SvgPath component element.
 */
export const svgPath = defineComp(SvgPath);
