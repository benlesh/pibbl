import { portablePath } from '../html/portable-clips.js';
import { definePrimitive } from '../define-primitive.js';
import { PathGeometry } from '../geometry/path-geometry.js';
import { resolvePath } from '../geometry/resolve-path.js';
import { PibblNodeInput, SystemStyle } from '../types.js';
import { setPrimitivePresentation } from '../primitive-presentation.js';
import { stripLayoutParticipation } from '../style/resolve-built-in.js';
import {
  type PibblStructuralEventProps,
  wireStructuralEvents,
} from './structural-events.js';
import type {
  BoxStyle,
  LayoutItemStyle,
  ResolvedDrawingStyle,
} from '../style/types.js';

/**
 * Authored inputs for Clip, including the declared data and presentation options.
 *
 * @see {@link PibblNodeInput}
 * @see {@link Clip}
 */
export interface ClipProps extends PibblStructuralEventProps {
  /** Descendant content or the callback that supplies it. See {@link PibblNodeInput}. */
  children: PibblNodeInput;
}

/**
 * Supported geometry and presentation properties for Clip.
 *
 * @see {@link SystemStyle}
 * @see {@link BoxStyle}
 * @see {@link LayoutItemStyle}
 * @see {@link PathGeometry}
 * @see {@link Clip}
 */
export interface ClipStyle extends SystemStyle, BoxStyle, LayoutItemStyle {
  /**
   * Geometry to draw or clip, supplied in the declared path representation. See
   * {@link PathGeometry}.
   */
  d: Path2D | PathGeometry;
  /** Canvas winding rule used to determine the path interior. See {@link ClipStyle}. */
  fillRule?: CanvasFillRule;
}

type ResolvedClipStyle = ResolvedDrawingStyle<ClipStyle>;

function renderClip(
  props: ClipProps,
) {
  wireStructuralEvents(props);
  return props.children;
}

/**
 * Describes a clipping container for JSX or createElement authoring.
 *
 * @param props - Authored component inputs, supplied through JSX or createElement. See the linked
 * props and style types.
 * @throws When called directly; Pibbl mounts this component through JSX or createElement.
 *
 * @see {@link ClipProps}
 * @see {@link ClipStyle}
 */
export const Clip = definePrimitive<
  ClipProps,
  ClipStyle,
  ClipStyle,
  ResolvedClipStyle
>(renderClip, {
  childInput: 'structural',
  resolveStyle: style => stripLayoutParticipation(style) as ResolvedClipStyle,
});

setPrimitivePresentation<ResolvedClipStyle>(Clip, style => {
  const { d, fillRule = 'nonzero' } = style;
  return { clip: { path: resolvePath(d), fillRule, svgPath: portablePath(d) } };
});
