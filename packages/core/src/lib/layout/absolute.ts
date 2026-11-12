import { recordAllocationStyle, configureAllocationCheckpointAdapter, withAllocationCheckpoint, mountedAllocationCheckpointOwner } from './allocation-checkpoint.js';
import { participatingLayoutChildren, layoutParticipationPlan, type LayoutParticipationSource } from './participation.js';
import { allocatedContentBoxStyle, contentBoxStyle } from './box-sizing.js';
import { recordWasmAllocationPass, recordWasmAllocationItem, recordWasmAllocationCacheHit, nativeLayout } from './wasm/region.js';
import { registerKnownLayoutPreflight, isKnownLayoutType, claimPreparedLayoutPlan, stagePreparedLayoutPlan, prepareKnownLayoutDescendants, preparePlacedKnownLayout, takePreparedChildStyle, type PreparedLayoutPlan } from './prepared-root.js';
import { isLayoutComponent, prepareLayoutComponent } from './define-layout-component.js';
import { ResponsiveStylePreparation, getStyleMeasurementMode, preparedStyleValue, preparedStyleQuery, type PreparedQuery } from '../style/responsive.js';
import { definePrimitive } from '../define-primitive.js';
import { EMPTY_STYLE } from '../style/empty-style.js';
import { materializeContainerChildren } from '../element/children.js';
import { clonePibblElement } from '../element/create-element.js';
import {
  getElementMetadata,
  setElementMetadata,
  getPrimitiveDefinition,
  getChildPrimitiveReceiverToken,
  setPlacementConsumed,
} from '../element/metadata.js';
import { resolvePrimitiveStyleInput } from '../element/resolve-primitive-inputs.js';
import type { PibblElement } from '../element/types.js';
import { GLOBAL_STATE } from '../global-state.js';
import { normalizeBoxInsets, hasPercentageBoxPadding, resolveAllocatedInsets } from './box-insets.js';
import { isFitContent, isIntrinsicSizingValue, resolveScalarSizingLength } from '../style/sizing-length.js';
import {
  extractSystemFilter,
  setPreNormalizedStyle, setAllocatedContentSize,
  withoutSystemFilter,
} from '../style/resolve-dispatch.js';
import type {
  BoxStyle,
  LayoutItemStyle,
  ResolvedBoxStyle,
} from '../style/types.js';
import type {
  IntrinsicMeasureInput,
  IntrinsicSizesResult,
  CanvasMeasurementService,
  PibblNodeInput,
  PibblRenderTransaction,
  RenderingContext2D,
  StyleResolutionContext,
  SystemStyle,
} from '../types.js';
import { measureElement, measureIntrinsicElement } from './measure.js';
import { canvasMeasurementService } from './canvas-measurement.js';
import { layoutDiagnostic } from '../style/diagnostics.js';
import {
  type PibblStructuralEventProps,
  wireStructuralEvents,
} from '../components/structural-events.js';
import { pushLayoutBox, resolvePositionedContainingBox } from './context.js';
import { recordLayoutEvaluation } from './diagnostics.js';
import { resolveBox } from './box.js';
import {
  createPlacementIdentityHint,
  placeChild,
} from './place-child.js';
import type { LayoutBox } from './types.js';
import { withReceiverInputProvision, captureReceiverInputProvision } from '../signals/input-provision.js';
import { assertSupportedChildPosition } from './positioning-diagnostics.js';

/**
 * Supported geometry and presentation properties for Absolute.
 *
 * @see {@link BoxStyle}
 * @see {@link LayoutItemStyle}
 * @see {@link Absolute}
 */
export type AbsoluteStyle = BoxStyle & LayoutItemStyle;

/**
 * Authored inputs for Absolute, including the declared data and presentation options.
 *
 * @see {@link PibblNodeInput}
 * @see {@link Absolute}
 */
export interface AbsoluteProps extends PibblStructuralEventProps {
  /** Descendant content or the callback that supplies it. See {@link PibblNodeInput}. */
  children: PibblNodeInput;
}

// Parent input is private metadata, not a recursively validated resolved value.
const ABSOLUTE_CONTAINING_BOX_STYLE = Symbol('pibbl.absolute-containing-box-style');

interface ResolvedAbsoluteStyle extends SystemStyle {
  box: ResolvedBoxStyle;
  [ABSOLUTE_CONTAINING_BOX_STYLE]: Readonly<AbsoluteStyle>;
  overflow: 'visible' | 'clip';
}

type LayoutReceiver = 'Absolute' | 'Overlay' | 'Flow' | 'Flex' | 'Grid' | 'Layer';

const preparedLayoutTransactions = new WeakMap<
  PibblRenderTransaction,
  WeakMap<object, readonly PibblElement<any>[]>
>();

function renderAbsolute(
  props: AbsoluteProps,
  style: Readonly<ResolvedAbsoluteStyle>,
  ctx: RenderingContext2D,
) {
  wireStructuralEvents(props);
  const ordinaryChildren = nativeLayout ? undefined : prepareLayoutChildren(props.children, 'Absolute');
  recordLayoutEvaluation();
  const content = style.box.contentBox;
  ctx.translate(content.x, content.y);
  const localContent = Object.freeze({
    x: 0,
    y: 0,
    width: content.width,
    height: content.height,
  });
  const releaseLayout = pushLayoutBox(localContent, {
    logicalOffset: content,
    containingBlock: resolvePositionedContainingBox(
      style[ABSOLUTE_CONTAINING_BOX_STYLE],
      localContent,
      'Absolute',
    ),
  });
  GLOBAL_STATE.componentRefs!.onAfterRender = releaseLayout;

  const prepared = nativeLayout ? claimPreparedLayoutPlan(GLOBAL_STATE.componentRefs!.element, localContent) : undefined;
  const children = prepared?.children ?? ordinaryChildren ?? prepareLayoutChildren(props.children, 'Absolute');
  const placements = prepared?.placements ?? (nativeLayout ? withAllocationCheckpoint(mountedAllocationCheckpointOwner(), { children, content: localContent, settings: style, onHit: recordWasmAllocationCacheHit, calculate: () => prepareAbsolutePlacements(children, localContent) }) : undefined);
  let placementIndex = 0;
  let occurrence = 0;
  return placeDirectChildren(
    children,
    localContent,
    (child, childOccurrence) => {
      const placement = placements ? placements[placementIndex++] : resolveAbsoluteChildPlacement(localContent, child, getChildPrimitiveReceiverToken(
        GLOBAL_STATE.renderTransaction, GLOBAL_STATE.primitiveReceiverToken, occurrence++,
      ));
      if (nativeLayout && !prepared) preparePlacedKnownLayout(placement.element, childOccurrence);
      return placement;
    },
    style.overflow,
  );
}

/**
 * Describes absolute layout for JSX or createElement authoring.
 *
 * @param props - Authored component inputs, supplied through JSX or createElement. See the linked
 * props and style types.
 * @throws When called directly; Pibbl mounts this component through JSX or createElement.
 *
 * @see {@link AbsoluteProps}
 * @see {@link AbsoluteStyle}
 */
export const Absolute = definePrimitive<
  AbsoluteProps,
  AbsoluteStyle,
  AbsoluteStyle,
  ResolvedAbsoluteStyle
>(renderAbsolute, {
  childInput: 'structural',
  resolveStyle: (style, context) => {
    if (nativeLayout && hasPercentageBoxPadding(style)) {
      style = resolveAllocatedInsets(style, { width: context.percentageBasis.width,
        context: { ...context, component: 'Absolute', algorithm: 'absolute' } });
    }
    return {
      box: resolveContainerBox(style, context, 'Absolute', 'absolute'),
      [ABSOLUTE_CONTAINING_BOX_STYLE]: style,
      overflow: style.overflow ?? 'visible',
    };
  },
  measureIntrinsic: (input) => measureUnionIntrinsic(input, 'Absolute'),
});

/** Pure paired intrinsic contributions for stacking known layout owners. */
export function measureUnionIntrinsic<S extends SystemStyle>(
  input: IntrinsicMeasureInput<{ readonly children: PibblNodeInput }, S>,
  receiver: LayoutReceiver,
): IntrinsicSizesResult {
  const owner = {
    x: 0,
    y: 0,
    width: intrinsicMaximum(input.constraints.width),
    height: intrinsicMaximum(input.constraints.height),
  };
  const children = materializeLayoutChildren(input.props.children, receiver);
  let minWidth = 0, minHeight = 0, maxWidth = 0, maxHeight = 0;
  for (let index = 0; index < children.length; index++) {
    const child = children[index]!;
    const receiverToken = getChildPrimitiveReceiverToken(
      GLOBAL_STATE.renderTransaction,
      GLOBAL_STATE.primitiveReceiverToken,
      index,
    );
    const prepared = prepareDirectChildStyle(child, receiverToken, owner);
    let style = preparedStyleValue(prepared) as Readonly<BoxStyle & LayoutItemStyle>;
    if (hasIntrinsicUnionPercentage(style)) {
      return { status: 'unsupported', reason: `${receiver} intrinsic percentage child sizes require a definite owner allocation` };
    }
    if (style.boxSizing !== undefined) {
      style = contentBoxStyle(style, {
        width: owner.width,
        height: owner.height,
        context: { component: child.type.name || 'Anonymous', algorithm: `${receiver} intrinsic measurement`, constraints: {
          minWidth: 0, maxWidth: owner.width, minHeight: 0, maxHeight: owner.height,
        } },
      });
    }
    assertSupportedChildPosition(receiver, child, style, false, false);
    const insets = normalizeBoxInsets(style, {
      component: child.type.name || 'Anonymous', algorithm: `${receiver} intrinsic measurement`,
      constraints: { minWidth: 0, maxWidth: owner.width, minHeight: 0, maxHeight: owner.height },
    });
    let measured: IntrinsicSizesResult;
    if (typeof style.width === 'number' && typeof style.height === 'number') {
      measured = {
        status: 'measured',
        minContent: { width: style.width, height: style.height },
        maxContent: { width: style.width, height: style.height },
      };
    } else {
      const measuredChild = clonePibblElement(child);
      setPreNormalizedStyle(measuredChild, style, child, receiverToken, preparedStyleQuery(prepared));
      measured = measureIntrinsicElement(measuredChild, {
        minWidth: 0, maxWidth: owner.width, minHeight: 0, maxHeight: owner.height,
      }, input.service);
      if (measured.status !== 'measured') return measured;
    }
    const minimumWidth = (typeof style.width === 'number' ? style.width : measured.minContent.width) + insets.left + insets.right;
    const maximumWidth = (typeof style.width === 'number' ? style.width : measured.maxContent.width) + insets.left + insets.right;
    const minimumHeight = (typeof style.height === 'number' ? style.height : measured.minContent.height) + insets.top + insets.bottom;
    const maximumHeight = (typeof style.height === 'number' ? style.height : measured.maxContent.height) + insets.top + insets.bottom;
    const left = intrinsicOffset(receiver === 'Absolute' ? style.left : undefined, 'left', receiver);
    const top = intrinsicOffset(receiver === 'Absolute' ? style.top : undefined, 'top', receiver);
    if (left.status === 'unsupported') return { status: 'unsupported', reason: left.reason };
    if (top.status === 'unsupported') return { status: 'unsupported', reason: top.reason };
    minWidth = Math.max(minWidth, left.value + minimumWidth);
    minHeight = Math.max(minHeight, top.value + minimumHeight);
    maxWidth = Math.max(maxWidth, left.value + maximumWidth);
    maxHeight = Math.max(maxHeight, top.value + maximumHeight);
  }
  return { status: 'measured', minContent: { width: minWidth, height: minHeight }, maxContent: { width: maxWidth, height: maxHeight } };
}

function intrinsicMaximum(constraint: IntrinsicMeasureInput<{ readonly children: PibblNodeInput }>['constraints']['width']): number {
  return constraint.kind === 'bounded' ? constraint.max : Number.MAX_SAFE_INTEGER;
}

function hasIntrinsicUnionPercentage(style: Readonly<BoxStyle & LayoutItemStyle>): boolean {
  return hasPercentageBoxPadding(style) || intrinsicPercentage(style.width) || intrinsicPercentage(style.height) ||
    intrinsicPercentage(style.minWidth) || intrinsicPercentage(style.maxWidth) ||
    intrinsicPercentage(style.minHeight) || intrinsicPercentage(style.maxHeight) ||
    intrinsicPercentage(style.left) || intrinsicPercentage(style.top);
}

function intrinsicPercentage(value: unknown): boolean {
  return typeof value === 'string' && value.endsWith('%');
}

function intrinsicOffset(
  value: LayoutItemStyle['left'] | undefined,
  property: 'left' | 'top',
  receiver: LayoutReceiver,
): Readonly<{ status: 'measured'; value: number }> | Readonly<{ status: 'unsupported'; reason: string }> {
  if (value === undefined) return { status: 'measured', value: 0 };
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { status: 'unsupported', reason: `${receiver} intrinsic ${property} offset must be finite and numeric` };
  }
  return { status: 'measured', value: Math.max(0, value) };
}

function prepareAbsolutePlacements(children: readonly PibblElement<any>[], content: Readonly<LayoutBox>): { box: LayoutBox; element: PibblElement<any> }[] {
  recordWasmAllocationPass();
  const placements: { box: LayoutBox; element: PibblElement<any> }[] = [];
  for (let index = 0; index < children.length; index++) {
    recordWasmAllocationItem();
    placements.push(resolveAbsoluteChildPlacement(content, children[index], getChildPrimitiveReceiverToken(GLOBAL_STATE.renderTransaction, GLOBAL_STATE.primitiveReceiverToken, index)));
  }
  return placements;
}

if (nativeLayout) registerKnownLayoutPreflight(Absolute, (element, style, content, receiver, slot) => {
  const previous = GLOBAL_STATE.primitiveReceiverToken;
  GLOBAL_STATE.primitiveReceiverToken = receiver;
  const releaseLayout = pushLayoutBox(content, {
    containingBlock: resolvePositionedContainingBox(
      style as Readonly<AbsoluteStyle>,
      content,
      'Absolute',
    ),
  });
  try {
    const children = prepareLayoutChildren(element.props.children, 'Absolute');
    const placements = withAllocationCheckpoint(slot, { children, content, settings: style, onHit: recordWasmAllocationCacheHit, calculate: () => prepareAbsolutePlacements(children, content) });
    const plan: PreparedLayoutPlan = { content, children, placements };
    prepareKnownLayoutDescendants(plan, slot);
    stagePreparedLayoutPlan(slot, plan);
  } finally {
    releaseLayout();
    GLOBAL_STATE.primitiveReceiverToken = previous;
  }
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
  child: PibblElement<any>,
): LayoutBox {
  return resolveAbsoluteChildPlacement(container, child).box;
}

function resolveAbsoluteChildPlacement(
  container: Readonly<LayoutBox>,
  child: PibblElement<any>,
  receiverToken?: object,
): { box: LayoutBox; element: PibblElement<any> } {
  const prepared = prepareDirectChildStyle(child, receiverToken, container);
  let style = preparedStyleValue(prepared) as Readonly<
    BoxStyle & LayoutItemStyle
  >;
  if (nativeLayout && GLOBAL_STATE.currentPibblInstance && getStyleMeasurementMode() === undefined && hasPercentageBoxPadding(style)) {
    style = resolveAllocatedInsets(style, { width: container.width, context: childDiagnosticContext(child, container, 'absolute') });
  }
  // Absolute retains legacy left/top placement but never accepts Flex's explicit mode.
  assertSupportedChildPosition('Absolute', child, style, false, false);
  const resolved = resolveDirectChildBox(container, child, 'absolute', style, undefined, receiverToken);
  const context = childDiagnosticContext(child, container, 'absolute');
  const left = resolveScalarSizingLength(style.left ?? 0, container.width, 'left', context)!;
  const top = resolveScalarSizingLength(style.top ?? 0, container.height, 'top', context)!;
  const box = {
    x: finitePlacement(container.x + left, 'left', left, context),
    y: finitePlacement(container.y + top, 'top', top, context),
    width: resolved.borderBox.width,
    height: resolved.borderBox.height,
  };
  const element = childWithUsedSize(
      child,
      style,
      resolved.contentBox.width,
      resolved.contentBox.height,
      receiverToken,
      preparedStyleQuery(prepared),
    );
  return { box, element };
}

/** @internal Carries normalized finite content size into the eventual render. */
export function childWithUsedSize(
  child: PibblElement<any>,
  style: Readonly<SystemStyle>,
  width: number,
  height: number,
  receiverToken?: object,
  query?: PreparedQuery,
): PibblElement<any> {
  const renderedChild = clonePibblElement(child);
  setPlacementConsumed(renderedChild);
  setPreNormalizedStyle(renderedChild, Object.freeze(allocatedContentBoxStyle(style, width, height)), child, receiverToken, query);
  return renderedChild;
}

/** Rebinds current raw inputs while carrying only a settled content allocation. */
export function childWithCachedUsedSize(child: PibblElement<any>, width: number, height: number): PibblElement<any> {
  const renderedChild = clonePibblElement(child);
  setPlacementConsumed(renderedChild);
  setAllocatedContentSize(renderedChild, width, height);
  return renderedChild;
}

/** @internal Shared by the initial direct-child layout algorithms. */
export function resolveDirectChildBox(
  container: Readonly<LayoutBox>,
  child: PibblElement<any>,
  algorithm: string,
  style: Readonly<SystemStyle> = normalizeDirectChildStyle(child, undefined, container),
  service?: CanvasMeasurementService,
  receiverToken?: object,
): ResolvedBoxStyle {
  const boxStyle = style as Readonly<BoxStyle>;
  if (hasIntrinsicDirectLength(boxStyle)) return resolveIntrinsicDirectChildBox(container, child, algorithm, boxStyle, service, receiverToken);
  return resolveLayoutBox(
    boxStyle,
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

function hasIntrinsicDirectLength(style: Readonly<BoxStyle>): boolean {
  return isIntrinsicSizingValue(style.width) || isIntrinsicSizingValue(style.height) ||
    isIntrinsicSizingValue(style.minWidth) || isIntrinsicSizingValue(style.maxWidth) ||
    isIntrinsicSizingValue(style.minHeight) || isIntrinsicSizingValue(style.maxHeight);
}

function resolveIntrinsicDirectChildBox(container: Readonly<LayoutBox>, child: PibblElement<any>, algorithm: string, style: Readonly<BoxStyle>, service?: CanvasMeasurementService, receiverToken?: object): ResolvedBoxStyle {
  const context = childDiagnosticContext(child, container, algorithm);
  const measurement = service ?? (GLOBAL_STATE.renderContext ? canvasMeasurementService(GLOBAL_STATE.renderContext) : undefined);
  if (!measurement) throw layoutDiagnostic({ ...context, property: 'width', value: style.width, reason: 'intrinsic sizing requires a Canvas measurement service' });
  const pairedChild = clonePibblElement(child);
  setPreNormalizedStyle(pairedChild, style, child, receiverToken);
  const paired = measureIntrinsicElement(pairedChild, { minWidth: 0, maxWidth: container.width, minHeight: 0, maxHeight: container.height }, measurement);
  if (paired.status !== 'measured') throw layoutDiagnostic({ ...context, property: 'width', value: style.width, reason: `intrinsic measurement is required but unsupported: ${paired.reason}` });
  let width = intrinsicDirectLength(style.width, paired.minContent.width, paired.maxContent.width, container.width, 'width', context);
  const minWidth = intrinsicDirectLength(style.minWidth, paired.minContent.width, paired.maxContent.width, container.width, 'minWidth', context);
  const maxWidth = intrinsicDirectLength(style.maxWidth, paired.minContent.width, paired.maxContent.width, container.width, 'maxWidth', context);
  let height = intrinsicDirectLength(style.height, paired.minContent.height, paired.maxContent.height, container.height, 'height', context);
  const minHeight = intrinsicDirectLength(style.minHeight, paired.minContent.height, paired.maxContent.height, container.height, 'minHeight', context);
  const maxHeight = intrinsicDirectLength(style.maxHeight, paired.minContent.height, paired.maxContent.height, container.height, 'maxHeight', context);
  if (width !== undefined) {
    const minimum = minWidth ?? scalarDirectBound(style.minWidth, container.width, 'minWidth', context) ?? 0;
    const maximum = maxWidth ?? scalarDirectBound(style.maxWidth, container.width, 'maxWidth', context) ?? Number.POSITIVE_INFINITY;
    width = Math.min(maximum, Math.max(minimum, width));
  }
  if (height === undefined && width !== undefined) {
    const measuredChild = clonePibblElement(child);
    setPreNormalizedStyle(measuredChild, { ...style, boxSizing: 'content-box', width, minWidth: undefined, maxWidth: undefined } as Readonly<BoxStyle>, child, receiverToken);
    const measured = measureElement(measuredChild, { minWidth: width, maxWidth: width, minHeight: 0, maxHeight: container.height }, measurement);
    if (measured.status !== 'measured') throw layoutDiagnostic({ ...context, property: 'height', value: style.height ?? 'auto', reason: `constrained measurement is required but unsupported: ${measured.reason}` });
    height = measured.size.height;
  }
  const insets = normalizeBoxInsets(style, context);
  const horizontal = style.boxSizing === 'border-box' ? insets.left + insets.right : 0;
  const vertical = style.boxSizing === 'border-box' ? insets.top + insets.bottom : 0;
  return resolveLayoutBox({ ...style,
    width: width === undefined ? style.width : width + horizontal,
    height: height === undefined ? style.height : height + vertical,
    minWidth: minWidth === undefined ? style.minWidth : minWidth + horizontal,
    maxWidth: maxWidth === undefined ? style.maxWidth : maxWidth + horizontal,
    minHeight: minHeight === undefined ? style.minHeight : minHeight + vertical,
    maxHeight: maxHeight === undefined ? style.maxHeight : maxHeight + vertical,
  }, { allocation: container, percentageBasis: container, constraints: { minWidth: 0, maxWidth: container.width, minHeight: 0, maxHeight: container.height }, component: child.type.name || 'Anonymous', algorithm: 'render-dispatch' }, child.type.name || 'Anonymous', algorithm, true);
}

function intrinsicDirectLength(value: BoxStyle['width'], minimum: number, maximum: number, reference: number, property: string, context: Parameters<typeof resolveScalarSizingLength>[3]): number | undefined {
  if (value === 'min-content') return minimum;
  if (value === 'max-content') return maximum;
  if (isFitContent(value)) {
    const limit = resolveScalarSizingLength(value.limit, reference, property, context)!;
    return Math.min(maximum, Math.max(minimum, limit));
  }
  return undefined;
}

function scalarDirectBound(value: BoxStyle['width'] | undefined, reference: number, property: string, context: Parameters<typeof resolveScalarSizingLength>[3]): number | undefined {
  return value === undefined || isIntrinsicSizingValue(value) ? undefined : resolveScalarSizingLength(value, reference, property, context);
}

/** @internal Normalizes a descriptor without resolving or invoking its callback. */
export function normalizeDirectChildStyle(
  child: PibblElement<any>,
  receiverToken?: object,
  queryBasis?: Readonly<LayoutBox>,
): Readonly<SystemStyle> {
  return preparedStyleValue(prepareDirectChildStyle(child, receiverToken, queryBasis));
}

/** Carries responsive eligibility with this normalization, never with a token. */
export function prepareDirectChildStyle(
  child: PibblElement<any>,
  receiverToken?: object,
  queryBasis?: Readonly<LayoutBox>,
  flexMargins = false,
): Readonly<SystemStyle> | ResponsiveStylePreparation<Readonly<SystemStyle>> {
  configureAllocationCheckpointAdapter(prepareDirectChildStyle, childWithUsedSize, takePreparedChildStyle, isLayoutComponent, isKnownLayoutType, prepareLayoutComponent);
  const staged = takePreparedChildStyle(child, receiverToken, queryBasis);
  if (staged) { recordAllocationStyle(receiverToken, staged); return staged; }
  let source = child;
  const captured = captureReceiverInputProvision(
    GLOBAL_STATE.renderTransaction,
    receiverToken,
    () => {
      if (isLayoutComponent(child.type)) source = prepareLayoutComponent(child, { receiverToken });
      return resolvePrimitiveStyleInput(
        (source.props as { readonly style?: unknown }).style,
        source, queryBasis,
      ) ?? EMPTY_STYLE;
    },
  );
  const prepared = captured.value;
  const definition = getPrimitiveDefinition(source.type);
  const style = preparedStyleValue(prepared);
  if (!flexMargins) {
    const values = style as Readonly<Record<string, unknown>>;
    const property = values.margin !== undefined ? 'margin' : values.marginTop !== undefined ? 'marginTop' :
      values.marginRight !== undefined ? 'marginRight' : values.marginBottom !== undefined ? 'marginBottom' :
      values.marginLeft !== undefined ? 'marginLeft' : values.marginStart !== undefined ? 'marginStart' :
      values.marginEnd !== undefined ? 'marginEnd' : undefined;
    if (property) throw layoutDiagnostic({ component: child.type.name, algorithm: 'layout', property,
      value: values[property], reason: 'margins currently require experimental Flex' });
  }
  const filter = extractSystemFilter(style);
  const normalized = definition?.normalizeStyle ?
      definition.normalizeStyle(withoutSystemFilter(style)) :
      withoutSystemFilter(style);
  const final = { ...normalized, ...(filter === undefined ? {} : { filter }), ...(style.transition === undefined ? {} : { transition: (style as Readonly<SystemStyle>).transition }) };
  if (prepared instanceof ResponsiveStylePreparation) {
    prepared.style = final;
    recordAllocationStyle(receiverToken, prepared, captured.receipt);
    return prepared;
  }
  recordAllocationStyle(receiverToken, final, captured.receipt);
  return final;
}

/** @internal Converts source-order descriptors to stable placed children. */
export function placeDirectChildren(
  children: readonly PibblElement<any>[],
  contentBox: Readonly<LayoutBox>,
  place: (child: PibblElement<any>, occurrence: number) => LayoutBox | {
    box: LayoutBox;
    element: PibblElement<any>;
  },
  overflow: 'visible' | 'clip',
): PibblElement<any>[] {
  const participation = layoutParticipationPlan(children);
  if (participation) {
    const renderSequence = (sequence: readonly LayoutParticipationSource[], insideContents: boolean): PibblElement<any>[] => {
      const occurrences = new Map<Function, number>();
      const result: PibblElement<any>[] = [];
      for (const node of sequence) {
        const child = node.element;
        const occurrence = child.key === undefined ? occurrences.get(child.type) ?? 0 : 0;
        if (child.key === undefined) occurrences.set(child.type, occurrence + 1);
        let element: PibblElement<any>, box: LayoutBox;
        if (node.children) {
          element = clonePibblElement(child);
          setElementMetadata(element, { ...getElementMetadata(element), layoutContentsChildren: renderSequence(node.children, true) });
          box = { x: 0, y: 0, width: contentBox.width, height: contentBox.height };
        } else if (node.hidden) {
          element = child;
          box = { x: 0, y: 0, width: 0, height: 0 };
        } else {
          const placement = place(child, occurrence);
          box = 'box' in placement ? placement.box : placement;
          element = 'box' in placement ? placement.element : child;
        }
        result.push(placeChild({ element, box,
          clipInChildSpace: overflow === 'clip' && !insideContents ? {
            x: contentBox.x - box.x, y: contentBox.y - box.y,
            width: contentBox.width, height: contentBox.height,
          } : undefined,
          identityHint: createPlacementIdentityHint(child, occurrence),
        }));
      }
      return result;
    };
    return renderSequence(participation, false);
  }
  const occurrences = new Map<Function, number>();
  const placed: PibblElement<any>[] = [];
  for (const child of children) {
    const occurrence = child.key === undefined ? occurrences.get(child.type) ?? 0 : 0;
    if (child.key === undefined) occurrences.set(child.type, occurrence + 1);
    const placement = place(child, occurrence);
    const box = 'box' in placement ? placement.box : placement;
    const element = 'box' in placement ? placement.element : child;
    placed.push(placeChild({ element, box,
      clipInChildSpace: overflow === 'clip' ? {
        x: contentBox.x - box.x, y: contentBox.y - box.y,
        width: contentBox.width, height: contentBox.height,
      } : undefined,
      identityHint: createPlacementIdentityHint(child, occurrence),
    }));
  }
  return placed;
}

/** @internal Prepares one finite direct-child sequence for a layout boundary. */
export function materializeLayoutChildren(
  children: PibblNodeInput,
  receiver: LayoutReceiver,
): readonly PibblElement<any>[] {
  // Placement identity owns layout sibling keys. Deferring its check preserves
  // fail-closed teardown when a later duplicate follows an acquired child.
  return participatingLayoutChildren(materializeContainerChildren(children, receiver, {
    validateKeys: false,
  }));
}

/** @internal Shares one direct sequence between an occurrence's measurement and paint. */
export function prepareLayoutChildren(
  children: PibblNodeInput,
  receiver: LayoutReceiver,
): readonly PibblElement<any>[] {
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
  const materialized = withReceiverInputProvision(
    transaction,
    receiverToken,
    () => materializeLayoutChildren(children, receiver),
  );
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
  const padding = normalizeBoxInsets(style, diagnosticContext);
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
  context: Parameters<typeof resolveScalarSizingLength>[3],
): number | undefined {
  if (value === undefined) return undefined;
  return resolveScalarSizingLength(value, reference, property, context);
}

function allocationCeiling(
  allocation: number,
  values: readonly (number | undefined)[],
  padding: number,
  property: string,
  context: Parameters<typeof resolveScalarSizingLength>[3],
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
  child: PibblElement<any>,
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
