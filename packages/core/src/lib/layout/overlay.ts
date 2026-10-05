import { preparedStyleValue, preparedStyleQuery } from '../style/responsive.js';
import { definePrimitive } from '../define-primitive.js';
import { GLOBAL_STATE } from '../global-state.js';
import { layoutDiagnostic } from '../style/diagnostics.js';
import {
  type PibblStructuralEventProps,
  wireStructuralEvents,
} from '../components/structural-events.js';
import type { BoxStyle, LayoutItemStyle, ResolvedBoxStyle } from '../style/types.js';
import type {
  PibblNodeInput,
  RenderingContext2D,
  SystemStyle,
} from '../types.js';
import type { PibblElement } from '../element/types.js';
import { getChildPrimitiveReceiverToken } from '../element/metadata.js';
import {
  childWithUsedSize,
  prepareLayoutChildren,
  prepareDirectChildStyle,
  placeDirectChildren,
  resolveContainerBox,
  resolveDirectChildBox,
} from './absolute.js';
import { pushLayoutBox } from './context.js';
import { recordLayoutEvaluation } from './diagnostics.js';
import type { LayoutBox } from './types.js';

type OverlayAlignment = 'start' | 'center' | 'end' | 'stretch';

/**
 * Supported geometry and presentation properties for Overlay.
 *
 * @see {@link BoxStyle}
 * @see {@link LayoutItemStyle}
 * @see {@link Overlay}
 */
export interface OverlayStyle extends BoxStyle, LayoutItemStyle {
  /** Default alignment of children on the cross or block axis. See {@link OverlayAlignment}. */
  alignItems?: OverlayAlignment;
  /** Default inline-axis alignment of grid or overlay children. See {@link OverlayAlignment}. */
  justifyItems?: OverlayAlignment;
}

/**
 * Authored inputs for Overlay, including the declared data and presentation options.
 *
 * @see {@link PibblNodeInput}
 * @see {@link Overlay}
 */
export interface OverlayProps extends PibblStructuralEventProps {
  /** Descendant content or the callback that supplies it. See {@link PibblNodeInput}. */
  children: PibblNodeInput;
}

interface ResolvedOverlayStyle extends SystemStyle {
  box: ResolvedBoxStyle;
  overflow: 'visible' | 'clip';
  alignItems: OverlayAlignment;
  justifyItems: OverlayAlignment;
}

function renderOverlay(
  props: OverlayProps,
  style: Readonly<ResolvedOverlayStyle>,
  ctx: RenderingContext2D,
) {
  wireStructuralEvents(props);
  const children = prepareLayoutChildren(props.children, 'Overlay');
  recordLayoutEvaluation();
  const content = style.box.contentBox;
  ctx.translate(content.x, content.y);
  const localContent = Object.freeze({
    x: 0,
    y: 0,
    width: content.width,
    height: content.height,
  });
  const releaseLayout = pushLayoutBox(localContent);
  GLOBAL_STATE.componentRefs!.onAfterRender = releaseLayout;

  let occurrence = 0;
  return placeDirectChildren(
    children,
    localContent,
    child => resolveOverlayChildPlacement(
      localContent,
      child,
      style,
      getChildPrimitiveReceiverToken(
        GLOBAL_STATE.renderTransaction,
        GLOBAL_STATE.primitiveReceiverToken,
        occurrence++,
      ),
    ),
    style.overflow,
  );
}

/**
 * Describes overlay layout for JSX or createElement authoring.
 *
 * @param props - Authored component inputs, supplied through JSX or createElement. See the linked
 * props and style types.
 * @throws When called directly; Pibbl mounts this component through JSX or createElement.
 *
 * @see {@link OverlayProps}
 * @see {@link OverlayStyle}
 */
export const Overlay = definePrimitive<
  OverlayProps,
  OverlayStyle,
  OverlayStyle,
  ResolvedOverlayStyle
>(renderOverlay, {
  childInput: 'structural',
  resolveStyle: (style, context) => ({
    box: resolveContainerBox(style, context, 'Overlay', 'overlay'),
    overflow: style.overflow ?? 'visible',
    alignItems: style.alignItems ?? 'stretch',
    justifyItems: style.justifyItems ?? 'stretch',
  }),
});

export function placeOverlayChild(
  container: Readonly<LayoutBox>,
  child: PibblElement<any>,
  alignment: Readonly<Pick<OverlayStyle, 'alignItems' | 'justifyItems'>> = {},
): LayoutBox {
  return resolveOverlayChildPlacement(container, child, alignment).box;
}

function resolveOverlayChildPlacement(
  container: Readonly<LayoutBox>,
  child: PibblElement<any>,
  alignment: Readonly<Pick<OverlayStyle, 'alignItems' | 'justifyItems'>> = {},
  receiverToken?: object,
): { box: LayoutBox; element: PibblElement<any> } {
  const prepared = prepareDirectChildStyle(child, receiverToken, container);
  const item = preparedStyleValue(prepared) as Readonly<
    BoxStyle & LayoutItemStyle
  >;
  const resolved = resolveDirectChildBox(
    container,
    child,
    'overlay',
    item,
  );
  const declaredBox = resolved.borderBox;
  const horizontal = resolveItemAlignment(
    item.justifySelf,
    alignment.justifyItems ?? 'stretch',
    child,
    container,
    'justifySelf',
  );
  const vertical = resolveItemAlignment(
    item.alignSelf,
    alignment.alignItems ?? 'stretch',
    child,
    container,
    'alignSelf',
  );
  const x = alignAxis(
    container.x,
    container.width,
    declaredBox.width,
    horizontal,
  );
  const y = alignAxis(
    container.y,
    container.height,
    declaredBox.height,
    vertical,
  );
  const box = {
    x,
    y,
    width: horizontal === 'stretch' ?
        Math.max(0, container.width) :
        declaredBox.width,
    height: vertical === 'stretch' ?
        Math.max(0, container.height) :
        declaredBox.height,
  };
  const horizontalPadding = declaredBox.width - resolved.contentBox.width;
  const verticalPadding = declaredBox.height - resolved.contentBox.height;
  return {
    box,
    element: childWithUsedSize(
      child,
      item,
      Math.max(0, box.width - horizontalPadding),
      Math.max(0, box.height - verticalPadding),
      receiverToken,
      preparedStyleQuery(prepared),
    ),
  };
}

function resolveItemAlignment(
  item: LayoutItemStyle['alignSelf'] | LayoutItemStyle['justifySelf'],
  fallback: OverlayAlignment,
  child: PibblElement<any>,
  container: Readonly<LayoutBox>,
  property: 'alignSelf' | 'justifySelf',
): OverlayAlignment {
  if (item === undefined || item === 'auto') return fallback;
  if (item === 'start' || item === 'center' || item === 'end' || item === 'stretch') {
    return item;
  }
  throw layoutDiagnostic({
    component: child.type.name || 'Anonymous',
    property,
    value: item,
    algorithm: 'overlay',
    constraints: {
      minWidth: 0,
      maxWidth: container.width,
      minHeight: 0,
      maxHeight: container.height,
    },
    reason: 'uses an unsupported overlay alignment value',
  });
}

function alignAxis(
  start: number,
  available: number,
  size: number,
  alignment: OverlayAlignment,
): number {
  switch (alignment) {
    case 'center': return start + (available - size) / 2;
    case 'end': return start + available - size;
    default: return start;
  }
}
