import type { CRCDragHandleStyle } from '../manipulation/handles.js';
import type { HtmlBoxStyle } from '../html/types.js';
import { definePrimitive } from '../define-primitive.js';
import { CRCNodeInput, SystemStyle } from '../types.js';
import type { CRCPhysics2DPropExtension } from '../types.js';
import {
  createGroupTransform,
  setPrimitivePresentation,
} from '../primitive-presentation.js';
import { stripLayoutParticipation } from '../style/resolve-built-in.js';
import {
  type CRCStructuralEventProps,
  wireStructuralEvents,
} from './structural-events.js';
import type {
  BoxStyle,
  LayoutItemStyle,
  ResolvedDrawingStyle,
} from '../style/types.js';

/**
 * Authored inputs for Group, including the declared data and presentation options.
 *
 * @see {@link CRCPhysics2DPropExtension}
 * @see {@link CRCNodeInput}
 * @see {@link Group}
 */
export interface GroupProps extends CRCStructuralEventProps, CRCPhysics2DPropExtension {
  /** Descendant content or the callback that supplies it. See {@link CRCNodeInput}. */
  children: CRCNodeInput;
}

/**
 * Transforms, layout participation, and shared style properties for Group.
 *
 * @see {@link SystemStyle}
 * @see {@link BoxStyle}
 * @see {@link LayoutItemStyle}
 * @see {@link Group}
 * @see {@link CRCDragHandleStyle}
 * @see {@link HtmlBoxStyle}
 */
export interface GStyle extends SystemStyle, BoxStyle, LayoutItemStyle {
  /** Horizontal scale factor. See {@link GStyle}. */
  scaleX?: number;
  /** Vertical scale factor. See {@link GStyle}. */
  scaleY?: number;
  /** Clockwise rotation in degrees. */
  rotationDegrees?: number;
  /** Point around which the rotation is applied. See {@link GStyle}. */
  rotationOrigin?: [number, number];
  /** Horizontal translation in the current logical coordinate system. See {@link GStyle}. */
  translateX?: number;
  /** Vertical translation in the current logical coordinate system. See {@link GStyle}. */
  translateY?: number;
  /** Horizontal skew angle in degrees. */
  skewX?: number;
  /** Vertical skew angle in degrees. */
  skewY?: number;
}

type ResolvedGStyle = ResolvedDrawingStyle<GStyle>;

function renderGroup(
  props: GroupProps,
) {
  wireStructuralEvents(props);
  return props.children;
}

/**
 * Describes a transformation group for JSX or createElement authoring.
 *
 * @param props - Authored component inputs, supplied through JSX or createElement. See the linked
 * props and style types.
 * @throws When called directly; CRC mounts this component through JSX or createElement.
 *
 * @see {@link GroupProps}
 * @see {@link GStyle}
 */
export const Group = definePrimitive<
  GroupProps,
  GStyle,
  GStyle,
  ResolvedGStyle
>(renderGroup, {
  childInput: 'structural',
  resolveStyle: style => stripLayoutParticipation(style) as ResolvedGStyle,
});

setPrimitivePresentation<ResolvedGStyle>(Group, style => ({
  transform: createGroupTransform(style),
}));
