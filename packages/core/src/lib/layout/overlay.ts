import { defineComp } from '../define-comp.js';
import { GLOBAL_STATE } from '../global-state.js';
import { layoutDiagnostic } from '../style/diagnostics.js';
import type { BoxStyle, LayoutItemStyle, ResolvedBoxStyle } from '../style/types.js';
import type {
  CompEl,
  CRCNode,
  RenderingContext2D,
  SystemStyle,
} from '../types.js';
import {
  normalizeDirectChildStyle,
  placeDirectChildren,
  resolveContainerBox,
  resolveDirectChildBox,
} from './absolute.js';
import { pushLayoutBox } from './context.js';
import type { LayoutBox } from './types.js';

type OverlayAlignment = 'start' | 'center' | 'end' | 'stretch';

export interface OverlayStyle extends BoxStyle {
  alignItems?: OverlayAlignment;
  justifyItems?: OverlayAlignment;
}

export interface OverlayProps {
  children: CRCNode[];
}

interface ResolvedOverlayStyle extends SystemStyle {
  box: ResolvedBoxStyle;
  overflow: 'visible' | 'clip';
  alignItems: OverlayAlignment;
  justifyItems: OverlayAlignment;
}

function Overlay(
  props: OverlayProps,
  style: Readonly<ResolvedOverlayStyle>,
  ctx: RenderingContext2D,
) {
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
    props.children,
    localContent,
    child => placeOverlayChild(localContent, child, style),
    style.overflow,
  );
}

export const overlay = defineComp<
  OverlayProps,
  OverlayStyle,
  OverlayStyle,
  ResolvedOverlayStyle
>(Overlay, {
  resolveStyle: (style, context) => ({
    box: resolveContainerBox(style, context, 'Overlay', 'overlay'),
    overflow: style.overflow ?? 'visible',
    alignItems: style.alignItems ?? 'stretch',
    justifyItems: style.justifyItems ?? 'stretch',
  }),
});

export function placeOverlayChild(
  container: Readonly<LayoutBox>,
  child: CompEl<any, any>,
  alignment: Readonly<Pick<OverlayStyle, 'alignItems' | 'justifyItems'>> = {},
): LayoutBox {
  const item = normalizeDirectChildStyle(child) as Readonly<
    BoxStyle & LayoutItemStyle
  >;
  const box = resolveDirectChildBox(
    container,
    child,
    'overlay',
    item,
  ).borderBox;
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
  const x = alignAxis(container.x, container.width, box.width, horizontal);
  const y = alignAxis(container.y, container.height, box.height, vertical);
  return {
    x,
    y,
    width: horizontal === 'stretch' ? Math.max(0, container.width) : box.width,
    height: vertical === 'stretch' ? Math.max(0, container.height) : box.height,
  };
}

function resolveItemAlignment(
  item: LayoutItemStyle['alignSelf'] | LayoutItemStyle['justifySelf'],
  fallback: OverlayAlignment,
  child: CompEl<any, any>,
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
