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

export interface GroupProps extends CRCStructuralEventProps, CRCPhysics2DPropExtension {
  children: CRCNodeInput;
}

export interface GStyle extends SystemStyle, BoxStyle, LayoutItemStyle {
  scaleX?: number;
  scaleY?: number;
  /** Clockwise rotation in degrees. */
  rotationDegrees?: number;
  rotationOrigin?: [number, number];
  translateX?: number;
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
