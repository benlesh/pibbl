import { defineComp } from '../define-comp.js';
import { GLOBAL_STATE } from '../global-state.js';
import { normalizeEdges } from '../style/normalize.js';
import { resolveLength } from '../style/resolve-length.js';
import type {
  BoxStyle,
  LayoutItemStyle,
  ResolvedBoxStyle,
} from '../style/types.js';
import type {
  CompEl,
  CRCNode,
  RenderingContext2D,
  StyleResolutionContext,
  SystemStyle,
} from '../types.js';
import { layoutDiagnostic } from '../style/diagnostics.js';
import { pushLayoutBox } from './context.js';
import { recordLayoutEvaluation } from './diagnostics.js';
import { resolveBox } from './box.js';
import {
  createPlacementIdentityHint,
  placeChild,
} from './place-child.js';
import type { LayoutBox } from './types.js';

export type AbsoluteStyle = BoxStyle;

export interface AbsoluteProps {
  children: CRCNode[];
}

interface ResolvedAbsoluteStyle extends SystemStyle {
  box: ResolvedBoxStyle;
  overflow: 'visible' | 'clip';
}

function Absolute(
  props: AbsoluteProps,
  style: Readonly<ResolvedAbsoluteStyle>,
  ctx: RenderingContext2D,
) {
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
    props.children,
    localContent,
    child => placeAbsoluteChild(localContent, child),
    style.overflow,
  );
}

export const absolute = defineComp<
  AbsoluteProps,
  AbsoluteStyle,
  AbsoluteStyle,
  ResolvedAbsoluteStyle
>(Absolute, {
  resolveStyle: (style, context) => ({
    box: resolveContainerBox(style, context, 'Absolute', 'absolute'),
    overflow: style.overflow ?? 'visible',
  }),
});

/** @internal Resolves a layout container without inspecting its children. */
export function resolveContainerBox(
  style: Readonly<BoxStyle>,
  context: Readonly<StyleResolutionContext>,
  component: string,
  algorithm: string,
): ResolvedBoxStyle {
  return resolveLayoutBox(style, context, component, algorithm, false);
}

export function placeAbsoluteChild(
  container: Readonly<LayoutBox>,
  child: CompEl<any, any>,
): LayoutBox {
  const style = normalizeDirectChildStyle(child) as Readonly<
    BoxStyle & LayoutItemStyle
  >;
  const box = resolveDirectChildBox(container, child, 'absolute', style);
  const context = childDiagnosticContext(child, container, 'absolute');
  const left = resolveLength(style.left ?? 0, container.width, 'left', context)!;
  const top = resolveLength(style.top ?? 0, container.height, 'top', context)!;
  return {
    x: finitePlacement(container.x + left, 'left', left, context),
    y: finitePlacement(container.y + top, 'top', top, context),
    width: box.borderBox.width,
    height: box.borderBox.height,
  };
}

/** @internal Shared by the initial direct-child layout algorithms. */
export function resolveDirectChildBox(
  container: Readonly<LayoutBox>,
  child: CompEl<any, any>,
  algorithm: string,
  style: Readonly<SystemStyle> = normalizeDirectChildStyle(child),
): ResolvedBoxStyle {
  return resolveLayoutBox(
    style as Readonly<BoxStyle>,
    {
      allocation: container,
      percentageBasis: container,
      constraints: {
        minWidth: 0,
        maxWidth: container.width,
        minHeight: 0,
        maxHeight: container.height,
      },
      component: child.type.name || 'Anonymous',
      algorithm: 'render-dispatch',
    },
    child.type.name || 'Anonymous',
    algorithm,
    true,
  );
}

/** @internal Normalizes a descriptor without resolving or invoking its callback. */
export function normalizeDirectChildStyle(
  child: CompEl<any, any>,
): Readonly<SystemStyle> {
  return child.type.normalizeStyle ?
      child.type.normalizeStyle(child.style) :
      child.style;
}

/** @internal Converts source-order descriptors to stable placed children. */
export function placeDirectChildren(
  children: readonly CRCNode[],
  contentBox: Readonly<LayoutBox>,
  place: (child: CompEl<any, any>) => LayoutBox | {
    box: LayoutBox;
    element: CompEl<any, any>;
  },
  overflow: 'visible' | 'clip',
): CompEl<any, any>[] {
  const occurrences = new Map<Function, number>();
  const placed: CompEl<any, any>[] = [];
  for (const node of children) {
    if (!node || typeof node !== 'object' || !('type' in node)) continue;
    const child = node as CompEl<any, any>;
    const occurrence = child.key === undefined ?
      occurrences.get(child.type) ?? 0 :
      0;
    if (child.key === undefined) {
      occurrences.set(child.type, occurrence + 1);
    }
    const placement = place(child);
    const box = 'box' in placement ? placement.box : placement;
    const element = 'box' in placement ? placement.element : child;
    placed.push(placeChild({
      element,
      box,
      clipInChildSpace: overflow === 'clip' ? {
        x: contentBox.x - box.x,
        y: contentBox.y - box.y,
        width: contentBox.width,
        height: contentBox.height,
      } : undefined,
      identityHint: createPlacementIdentityHint(child, occurrence),
    }));
  }
  return placed;
}

function resolveLayoutBox(
  style: Readonly<BoxStyle>,
  context: Readonly<StyleResolutionContext>,
  component: string,
  algorithm: string,
  requireDefinite: boolean,
): ResolvedBoxStyle {
  if (requireDefinite && (style.width === undefined || style.width === 'auto')) {
    throw requiredDimension(component, 'width', style.width, context, algorithm);
  }
  if (requireDefinite && (style.height === undefined || style.height === 'auto')) {
    throw requiredDimension(component, 'height', style.height, context, algorithm);
  }

  const diagnosticContext = {
    component,
    algorithm,
    constraints: context.constraints,
  };
  const width = resolveOptionalAllocationLength(
    style.width,
    context.percentageBasis.width,
    'width',
    diagnosticContext,
  );
  const height = resolveOptionalAllocationLength(
    style.height,
    context.percentageBasis.height,
    'height',
    diagnosticContext,
  );
  const minWidth = resolveOptionalAllocationLength(
    style.minWidth,
    context.percentageBasis.width,
    'minWidth',
    diagnosticContext,
  );
  const maxWidth = resolveOptionalAllocationLength(
    style.maxWidth,
    context.percentageBasis.width,
    'maxWidth',
    diagnosticContext,
  );
  const minHeight = resolveOptionalAllocationLength(
    style.minHeight,
    context.percentageBasis.height,
    'minHeight',
    diagnosticContext,
  );
  const maxHeight = resolveOptionalAllocationLength(
    style.maxHeight,
    context.percentageBasis.height,
    'maxHeight',
    diagnosticContext,
  );
  const padding = normalizeEdges(style.padding, 'padding', diagnosticContext);
  const allowOverflow = requireDefinite;
  const maxConstraintWidth = allowOverflow ? allocationCeiling(
    context.allocation.width,
    [width, minWidth, maxWidth],
    padding.left + padding.right,
    'width',
    diagnosticContext,
  ) : context.allocation.width;
  const maxConstraintHeight = allowOverflow ? allocationCeiling(
    context.allocation.height,
    [height, minHeight, maxHeight],
    padding.top + padding.bottom,
    'height',
    diagnosticContext,
  ) : context.allocation.height;

  return resolveBox({
    ...style,
    width,
    height,
    minWidth,
    maxWidth,
    minHeight,
    maxHeight,
  }, {
    minWidth: 0,
    maxWidth: maxConstraintWidth,
    minHeight: 0,
    maxHeight: maxConstraintHeight,
  }, diagnosticContext);
}

function resolveOptionalAllocationLength(
  value: BoxStyle['width'],
  reference: number,
  property: string,
  context: Parameters<typeof resolveLength>[3],
): number | undefined {
  if (value === undefined) return undefined;
  return resolveLength(value, reference, property, context);
}

function allocationCeiling(
  allocation: number,
  values: readonly (number | undefined)[],
  padding: number,
  property: string,
  context: Parameters<typeof resolveLength>[3],
): number {
  const ceiling = Math.max(allocation, ...values.filter(
    (value): value is number => value !== undefined,
  )) + padding;
  if (!Number.isFinite(ceiling)) {
    throw layoutDiagnostic({
      ...context,
      property,
      value: ceiling,
      reason: 'resolved allocation arithmetic must remain finite',
    });
  }
  return ceiling;
}

function requiredDimension(
  component: string,
  property: 'width' | 'height',
  value: unknown,
  context: Readonly<StyleResolutionContext>,
  algorithm: string,
) {
  return layoutDiagnostic({
    component,
    property,
    value: value ?? 'auto',
    algorithm,
    constraints: context.constraints,
    reason: 'requires a definite dimension until measurement is available',
  });
}

function childDiagnosticContext(
  child: CompEl<any, any>,
  container: Readonly<LayoutBox>,
  algorithm: string,
) {
  return {
    component: child.type.name || 'Anonymous',
    algorithm,
    constraints: {
      minWidth: 0,
      maxWidth: container.width,
      minHeight: 0,
      maxHeight: container.height,
    },
  };
}

function finitePlacement(
  resolved: number,
  property: string,
  value: unknown,
  context: ReturnType<typeof childDiagnosticContext>,
): number {
  if (!Number.isFinite(resolved)) {
    throw layoutDiagnostic({
      ...context,
      property,
      value,
      reason: 'resolved placement arithmetic must remain finite',
    });
  }
  return resolved;
}
