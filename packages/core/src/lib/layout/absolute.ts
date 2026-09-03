import { definePrimitive } from '../define-primitive.js';
import { EMPTY_STYLE } from '../style/empty-style.js';
import { materializeContainerChildren } from '../element/children.js';
import { cloneCRCElement } from '../element/create-element.js';
import {
  getPrimitiveDefinition,
  getSpecifiedStyle,
} from '../element/metadata.js';
import type { CRCElement } from '../element/types.js';
import { GLOBAL_STATE } from '../global-state.js';
import { normalizeEdges } from '../style/normalize.js';
import { resolveLength } from '../style/resolve-length.js';
import { setPreNormalizedStyle } from '../style/resolve-dispatch.js';
import type {
  BoxStyle,
  LayoutItemStyle,
  ResolvedBoxStyle,
} from '../style/types.js';
import type {
  CRCNode,
  CRCRenderTransaction,
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

export type AbsoluteStyle = BoxStyle & LayoutItemStyle;

export interface AbsoluteProps {
  children: CRCNode;
}

interface ResolvedAbsoluteStyle extends SystemStyle {
  box: ResolvedBoxStyle;
  overflow: 'visible' | 'clip';
}

type LayoutReceiver = 'Absolute' | 'Overlay' | 'Flow' | 'Flex' | 'Grid';

const preparedLayoutTransactions = new WeakMap<
  CRCRenderTransaction,
  WeakMap<object, readonly CRCElement<any>[]>
>();

function renderAbsolute(
  props: AbsoluteProps,
  style: Readonly<ResolvedAbsoluteStyle>,
  ctx: RenderingContext2D,
) {
  const children = prepareLayoutChildren(props.children, 'Absolute');
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
    child => resolveAbsoluteChildPlacement(localContent, child),
    style.overflow,
  );
}

/** Describes absolute layout for JSX or createElement authoring. */
export const Absolute = definePrimitive<
  AbsoluteProps,
  AbsoluteStyle,
  AbsoluteStyle,
  ResolvedAbsoluteStyle
>(renderAbsolute, {
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
  child: CRCElement<any>,
): LayoutBox {
  return resolveAbsoluteChildPlacement(container, child).box;
}

function resolveAbsoluteChildPlacement(
  container: Readonly<LayoutBox>,
  child: CRCElement<any>,
): { box: LayoutBox; element: CRCElement<any> } {
  const style = normalizeDirectChildStyle(child) as Readonly<
    BoxStyle & LayoutItemStyle
  >;
  const resolved = resolveDirectChildBox(container, child, 'absolute', style);
  const context = childDiagnosticContext(child, container, 'absolute');
  const left = resolveLength(style.left ?? 0, container.width, 'left', context)!;
  const top = resolveLength(style.top ?? 0, container.height, 'top', context)!;
  const box = {
    x: finitePlacement(container.x + left, 'left', left, context),
    y: finitePlacement(container.y + top, 'top', top, context),
    width: resolved.borderBox.width,
    height: resolved.borderBox.height,
  };
  return {
    box,
    element: childWithUsedSize(
      child,
      style,
      resolved.contentBox.width,
      resolved.contentBox.height,
    ),
  };
}

/** @internal Carries normalized finite content size into the eventual render. */
export function childWithUsedSize(
  child: CRCElement<any>,
  style: Readonly<SystemStyle>,
  width: number,
  height: number,
  receiverToken?: object,
): CRCElement<any> {
  const renderedChild = cloneCRCElement(child);
  setPreNormalizedStyle(renderedChild, Object.freeze({
    ...style,
    width,
    height,
  }), child, receiverToken);
  return renderedChild;
}

/** @internal Shared by the initial direct-child layout algorithms. */
export function resolveDirectChildBox(
  container: Readonly<LayoutBox>,
  child: CRCElement<any>,
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
  child: CRCElement<any>,
): Readonly<SystemStyle> {
  const definition = getPrimitiveDefinition(child.type);
  const style = getSpecifiedStyle(child) ?? EMPTY_STYLE;
  return definition?.normalizeStyle ?
      definition.normalizeStyle(style) :
      style;
}

/** @internal Converts source-order descriptors to stable placed children. */
export function placeDirectChildren(
  children: readonly CRCElement<any>[],
  contentBox: Readonly<LayoutBox>,
  place: (child: CRCElement<any>) => LayoutBox | {
    box: LayoutBox;
    element: CRCElement<any>;
  },
  overflow: 'visible' | 'clip',
): CRCElement<any>[] {
  const occurrences = new Map<Function, number>();
  const placed: CRCElement<any>[] = [];
  for (const child of children) {
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

/** @internal Prepares one finite direct-child sequence for a layout boundary. */
export function materializeLayoutChildren(
  children: CRCNode,
  receiver: LayoutReceiver,
): readonly CRCElement<any>[] {
  // Placement identity owns layout sibling keys. Deferring its check preserves
  // fail-closed teardown when a later duplicate follows an acquired child.
  return materializeContainerChildren(children, receiver, {
    validateKeys: false,
  });
}

/** @internal Shares one direct sequence between an occurrence's measurement and paint. */
export function prepareLayoutChildren(
  children: CRCNode,
  receiver: LayoutReceiver,
): readonly CRCElement<any>[] {
  const transaction = GLOBAL_STATE.renderTransaction;
  const receiverToken = GLOBAL_STATE.primitiveReceiverToken;
  if (!transaction || !receiverToken) {
    return materializeLayoutChildren(children, receiver);
  }

  let receivers = preparedLayoutTransactions.get(transaction);
  if (!receivers) {
    receivers = new WeakMap();
    preparedLayoutTransactions.set(transaction, receivers);
  }
  const prepared = receivers.get(receiverToken);
  if (prepared) return prepared;
  const materialized = materializeLayoutChildren(children, receiver);
  receivers.set(receiverToken, materialized);
  return materialized;
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
  child: CRCElement<any>,
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
