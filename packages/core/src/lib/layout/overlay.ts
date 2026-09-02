import { defineComp } from '../define-comp.js';
import { definePrimitive } from '../define-primitive.js';
import { GLOBAL_STATE } from '../global-state.js';
import { layoutDiagnostic } from '../style/diagnostics.js';
import type { BoxStyle, LayoutItemStyle, ResolvedBoxStyle } from '../style/types.js';
import type {
  CRCNode,
  RenderingContext2D,
  SystemStyle,
} from '../types.js';
import type { CRCElement } from '../element/types.js';
import {
  childWithUsedSize,
  prepareLayoutChildren,
  normalizeDirectChildStyle,
  placeDirectChildren,
  resolveContainerBox,
  resolveDirectChildBox,
} from './absolute.js';
import { pushLayoutBox } from './context.js';
import { recordLayoutEvaluation } from './diagnostics.js';
import type { LayoutBox } from './types.js';

type OverlayAlignment = 'start' | 'center' | 'end' | 'stretch';

export interface OverlayStyle extends BoxStyle, LayoutItemStyle {
  alignItems?: OverlayAlignment;
  justifyItems?: OverlayAlignment;
}

export interface OverlayProps {
  children: CRCNode;
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

  return placeDirectChildren(
    children,
    localContent,
    child => resolveOverlayChildPlacement(localContent, child, style),
    style.overflow,
  );
}

/** Describes overlay layout for JSX or createElement authoring. */
export const Overlay = definePrimitive<
  OverlayProps,
  OverlayStyle,
  OverlayStyle,
  ResolvedOverlayStyle
>(renderOverlay, {
  resolveStyle: (style, context) => ({
    box: resolveContainerBox(style, context, 'Overlay', 'overlay'),
    overflow: style.overflow ?? 'visible',
    alignItems: style.alignItems ?? 'stretch',
    justifyItems: style.justifyItems ?? 'stretch',
  }),
});

const renderLegacyOverlay = function Overlay(
  props: OverlayProps,
  style: Readonly<ResolvedOverlayStyle>,
  ctx: RenderingContext2D,
) {
  return renderOverlay(props, style, ctx);
};

/** @internal Temporary lowercase authoring adapter retained until Task 12. */
export const overlay = defineComp<
  OverlayProps,
  OverlayStyle,
  OverlayStyle,
  ResolvedOverlayStyle
>(renderLegacyOverlay, {
  resolveStyle: (style, context) => ({
    box: resolveContainerBox(style, context, 'Overlay', 'overlay'),
    overflow: style.overflow ?? 'visible',
    alignItems: style.alignItems ?? 'stretch',
    justifyItems: style.justifyItems ?? 'stretch',
  }),
});

export function placeOverlayChild(
  container: Readonly<LayoutBox>,
  child: CRCElement<any>,
  alignment: Readonly<Pick<OverlayStyle, 'alignItems' | 'justifyItems'>> = {},
): LayoutBox {
  return resolveOverlayChildPlacement(container, child, alignment).box;
}

function resolveOverlayChildPlacement(
  container: Readonly<LayoutBox>,
  child: CRCElement<any>,
  alignment: Readonly<Pick<OverlayStyle, 'alignItems' | 'justifyItems'>> = {},
): { box: LayoutBox; element: CRCElement<any> } {
  const item = normalizeDirectChildStyle(child) as Readonly<
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
    ),
  };
}

function resolveItemAlignment(
  item: LayoutItemStyle['alignSelf'] | LayoutItemStyle['justifySelf'],
  fallback: OverlayAlignment,
  child: CRCElement<any>,
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
