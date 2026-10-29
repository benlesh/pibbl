import { contentBoxStyle } from './box-sizing.js';
import { canvasMeasurementService } from './canvas-measurement.js';
import { nativeLayout, mountedLayoutRegion, type LayoutRegion } from './wasm/region.js';
import { prepareKnownLayoutDescendants, registerKnownLayoutPreflight, claimPreparedLayoutPlan, stagePreparedLayoutPlan, preparePlacedKnownLayout, type PreparedLayoutPlan } from './prepared-root.js';
import { getStyleMeasurementMode, preparedStyleValue, preparedStyleQuery, type PreparedQuery } from '../style/responsive.js';
import { definePrimitive } from '../define-primitive.js';
import { clonePibblElement } from '../element/create-element.js';
import { getChildPrimitiveReceiverToken } from '../element/metadata.js';
import type { PibblElement } from '../element/types.js';
import { GLOBAL_STATE } from '../global-state.js';
import { layoutDiagnostic } from '../style/diagnostics.js';
import {
  type PibblStructuralEventProps,
  wireStructuralEvents,
} from '../components/structural-events.js';
import { normalizeBoxInsets, hasPercentageBoxPadding, resolveAllocatedInsets } from './box-insets.js';
import { setPreNormalizedStyle } from '../style/resolve-dispatch.js';
import type { BoxStyle, LayoutItemStyle, ResolvedBoxStyle } from '../style/types.js';
import type {
  CanvasMeasurementService,
  PibblNodeInput,
  IntrinsicMeasureInput,
  IntrinsicSizesResult,
  MeasureInput,
  MeasureResult,
  RenderingContext2D,
  SystemStyle,
} from '../types.js';
import {
  childWithUsedSize,
  materializeLayoutChildren,
  prepareDirectChildStyle,
  placeDirectChildren,
  prepareLayoutChildren,
  resolveContainerBox,
  resolveDirectChildBox,
} from './absolute.js';
import { pushLayoutBox, resolvePositionedContainingBox } from './context.js';
import { recordLayoutEvaluation } from './diagnostics.js';
import { assertSupportedChildPosition } from './positioning-diagnostics.js';
import { measureElement, measureIntrinsicElement } from './measure.js';
import type { Constraints, LayoutBox } from './types.js';

type FlowDirection = 'horizontal' | 'vertical';
type FlowAlignment = 'start' | 'center' | 'end' | 'stretch';

/**
 * Supported geometry and presentation properties for Flow.
 *
 * @see {@link BoxStyle}
 * @see {@link LayoutItemStyle}
 * @see {@link Flow}
 */
export interface FlowStyle extends BoxStyle, LayoutItemStyle {
  /** Direction in which this operation proceeds. See {@link FlowDirection}. */
  direction?: FlowDirection;
  /** Whether content may wrap into additional lines. See {@link FlowStyle}. */
  wrap?: boolean;
  /** Spacing between adjacent items. See {@link FlowStyle}. */
  gap?: number;
  /** Space between wrapped flow lines. See {@link FlowStyle}. */
  lineGap?: number;
  /** Default alignment of children on the cross or block axis. See {@link FlowAlignment}. */
  alignItems?: FlowAlignment;
}

/**
 * Authored inputs for Flow, including the declared data and presentation options.
 *
 * @see {@link PibblNodeInput}
 * @see {@link Flow}
 */
export interface FlowProps extends PibblStructuralEventProps {
  /** Descendant content or the callback that supplies it. See {@link PibblNodeInput}. */
  children: PibblNodeInput;
}

// Parent input is private metadata, not a recursively validated resolved value.
const FLOW_CONTAINING_BOX_STYLE = Symbol('pibbl.flow-containing-box-style');

interface ResolvedFlowStyle extends SystemStyle {
  box: ResolvedBoxStyle;
  [FLOW_CONTAINING_BOX_STYLE]: Readonly<FlowStyle>;
  overflow: 'visible' | 'clip';
  direction: FlowDirection;
  wrap: boolean;
  gap: number;
  lineGap: number;
  alignItems: FlowAlignment;
}

interface FlowItem {
  child: PibblElement<any>;
  normalized: Readonly<SystemStyle>;
  width: number;
  height: number;
  horizontalPadding: number;
  verticalPadding: number;
  alignment: FlowAlignment;
  receiverToken: object;
  query?: PreparedQuery;
}

export interface FlowMeasurementInput {
  service: CanvasMeasurementService;
  measureElement(
    element: PibblElement<any>,
    constraints: Readonly<Constraints>,
  ): MeasureResult;
}

interface FlowPlacement {
  usedWidth: number; usedHeight: number;
  box: LayoutBox;
  element: PibblElement<any>;
}

function renderFlow(
  props: FlowProps,
  style: Readonly<ResolvedFlowStyle>,
  ctx: RenderingContext2D,
) {
  wireStructuralEvents(props);
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
      style[FLOW_CONTAINING_BOX_STYLE],
      localContent,
      'Flow',
    ),
  });
  GLOBAL_STATE.componentRefs!.onAfterRender = releaseLayout;
  const prepared = nativeLayout ? claimPreparedLayoutPlan(GLOBAL_STATE.componentRefs!.element, localContent) : undefined;
  const nativeRegion = prepared?.region ?? (nativeLayout ? mountedLayoutRegion() : undefined);
  if (nativeLayout && !nativeRegion) throw new Error('Experimental Flow requires its mounted native region.');
  const plan = prepared ?? prepareFlowAllocation(props, style, localContent, ctx, nativeRegion);
  const { children, placements } = plan;
  let index = 0;
  return placeDirectChildren(
    children,
    localContent,
    (_child, occurrence) => {
      const placement = placements[index++];
      if (nativeLayout && !prepared) preparePlacedKnownLayout(placement.element, occurrence);
      return placement;
    },
    style.overflow,
  );
}

/**
 * Describes sequential flow layout for JSX or createElement authoring.
 *
 * @param props - Authored component inputs, supplied through JSX or createElement. See the linked
 * props and style types.
 * @throws When called directly; Pibbl mounts this component through JSX or createElement.
 *
 * @see {@link FlowProps}
 * @see {@link FlowStyle}
 */
export const Flow = definePrimitive<
  FlowProps,
  FlowStyle,
  FlowStyle,
  ResolvedFlowStyle
>(renderFlow, {
  childInput: 'structural',
  resolveStyle: (style, context) => {
    if (nativeLayout && hasPercentageBoxPadding(style)) {
      style = resolveAllocatedInsets(style, { width: context.percentageBasis.width,
        context: { ...context, component: 'Flow', algorithm: 'flow' } });
    }
    return {
      box: resolveContainerBox(style, context, 'Flow', 'flow'),
      [FLOW_CONTAINING_BOX_STYLE]: style,
      overflow: style.overflow ?? 'visible',
      ...normalizeFlowOptions(style, context.allocation),
    };
  },
  measure: input => measureFlow(input),
  measureIntrinsic: input => measureFlowIntrinsic(input),
});

interface IntrinsicFlowItem {
  readonly child: PibblElement<any>;
  readonly style: Readonly<BoxStyle & LayoutItemStyle>;
  readonly receiver: object;
  readonly query?: PreparedQuery;
  readonly horizontalInsets: number;
  readonly verticalInsets: number;
  readonly minWidth: number;
  readonly maxWidth: number;
}

/** Pure paired contributions for a declared Flow sequence. */
function measureFlowIntrinsic(
  input: IntrinsicMeasureInput<FlowProps, FlowStyle>,
): IntrinsicSizesResult {
  const maximumWidth = intrinsicConstraintMaximum(input.constraints.width);
  const maximumHeight = intrinsicConstraintMaximum(input.constraints.height);
  const owner = { x: 0, y: 0, width: maximumWidth, height: maximumHeight };
  const options = normalizeFlowOptions(input.style, owner);
  const children = materializeLayoutChildren(input.props.children, 'Flow');
  const items: IntrinsicFlowItem[] = [];
  let maximumWidthContribution = 0;
  let minimumWidthContribution = 0;

  for (let index = 0; index < children.length; index++) {
    const child = children[index]!;
    const receiver = getChildPrimitiveReceiverToken(
      GLOBAL_STATE.renderTransaction,
      GLOBAL_STATE.primitiveReceiverToken,
      index,
    );
    const prepared = prepareDirectChildStyle(child, receiver, owner);
    let style = preparedStyleValue(prepared) as Readonly<BoxStyle & LayoutItemStyle>;
    if (hasIntrinsicPercentageCycle(style)) {
      return { status: 'unsupported', reason: 'Flow intrinsic percentage child sizes require a definite owner allocation' };
    }
    if (style.boxSizing !== undefined) {
      style = contentBoxStyle(style, {
        width: owner.width,
        height: owner.height,
        context: {
          component: child.type.name || 'Anonymous', algorithm: 'Flow intrinsic measurement',
          constraints: { minWidth: 0, maxWidth: owner.width, minHeight: 0, maxHeight: owner.height },
        },
      });
    }
    assertSupportedChildPosition('Flow', child, style);
    const insets = normalizeBoxInsets(style, {
      component: child.type.name || 'Anonymous', algorithm: 'Flow intrinsic measurement',
      constraints: { minWidth: 0, maxWidth: owner.width, minHeight: 0, maxHeight: owner.height },
    });
    const horizontalInsets = insets.left + insets.right;
    const verticalInsets = insets.top + insets.bottom;
    let minWidth: number;
    let maxWidth: number;
    if (typeof style.width === 'number' && typeof style.height === 'number') {
      minWidth = style.width + horizontalInsets;
      maxWidth = minWidth;
    } else {
      const measuredChild = clonePibblElement(child);
      setPreNormalizedStyle(measuredChild, style, child, receiver, preparedStyleQuery(prepared));
      const measured = measureIntrinsicElement(measuredChild, {
        minWidth: 0, maxWidth: owner.width, minHeight: 0, maxHeight: owner.height,
      }, input.service);
      if (measured.status !== 'measured') return measured;
      minWidth = (typeof style.width === 'number' ? style.width : measured.minContent.width) + horizontalInsets;
      maxWidth = (typeof style.width === 'number' ? style.width : measured.maxContent.width) + horizontalInsets;
    }
    if (!Number.isFinite(minWidth) || !Number.isFinite(maxWidth) || minWidth < 0 || maxWidth < minWidth) {
      return { status: 'unsupported', reason: 'Flow intrinsic child widths must be finite and ordered' };
    }
    items.push({ child, style, receiver, query: preparedStyleQuery(prepared), horizontalInsets, verticalInsets, minWidth, maxWidth });
    minimumWidthContribution = options.wrap ? Math.max(minimumWidthContribution, minWidth) : minimumWidthContribution + minWidth;
    maximumWidthContribution += maxWidth;
  }
  const gaps = Math.max(0, items.length - 1) * options.gap;
  if (!options.wrap) minimumWidthContribution += gaps;
  maximumWidthContribution += gaps;
  const minimumHeight = measureIntrinsicFlowHeight(items, minimumWidthContribution, false, options, input, owner);
  if (minimumHeight.status !== 'measured') return minimumHeight;
  const maximumHeightResult = measureIntrinsicFlowHeight(items, maximumWidthContribution, true, options, input, owner);
  if (maximumHeightResult.status !== 'measured') return maximumHeightResult;
  return {
    status: 'measured',
    minContent: { width: minimumWidthContribution, height: minimumHeight.height },
    maxContent: { width: maximumWidthContribution, height: maximumHeightResult.height },
  };
}

function intrinsicConstraintMaximum(constraint: IntrinsicMeasureInput<FlowProps, FlowStyle>['constraints']['width']): number {
  return constraint.kind === 'bounded' ? constraint.max : Number.MAX_SAFE_INTEGER;
}

function hasIntrinsicPercentageCycle(style: Readonly<BoxStyle>): boolean {
  return hasPercentageBoxPadding(style) || isPercentageLength(style.width) || isPercentageLength(style.height) ||
    isPercentageLength(style.minWidth) || isPercentageLength(style.maxWidth) ||
    isPercentageLength(style.minHeight) || isPercentageLength(style.maxHeight);
}

function isPercentageLength(value: unknown): boolean {
  return typeof value === 'string' && value.endsWith('%');
}

function measureIntrinsicFlowHeight(
  items: readonly IntrinsicFlowItem[],
  width: number,
  maximumWidths: boolean,
  options: ReturnType<typeof normalizeFlowOptions>,
  input: IntrinsicMeasureInput<FlowProps, FlowStyle>,
  owner: Readonly<LayoutBox>,
): Readonly<{ status: 'measured'; height: number }> | Readonly<{ status: 'unsupported'; reason: string }> {
  const placements: FlowItem[] = [];
  for (const item of items) {
    const selectedWidth = maximumWidths ? item.maxWidth : item.minWidth;
    const contentWidth = Math.max(0, (width === 0 ? 0 : options.wrap ? Math.min(width, selectedWidth) : selectedWidth) - item.horizontalInsets);
    let contentHeight: number;
    if (typeof item.style.height === 'number') {
      contentHeight = item.style.height;
    } else {
      const measuredChild = clonePibblElement(item.child);
      setPreNormalizedStyle(measuredChild, { ...item.style, width: contentWidth } as Readonly<BoxStyle & LayoutItemStyle>, item.child, item.receiver, item.query);
      const measured = measureElement(measuredChild, {
        minWidth: contentWidth, maxWidth: contentWidth,
        minHeight: 0, maxHeight: owner.height,
      }, input.service);
      if (measured.status !== 'measured') return measured;
      contentHeight = measured.size.height;
    }
    if (!Number.isFinite(contentHeight) || contentHeight < 0) {
      return { status: 'unsupported', reason: 'Flow intrinsic child heights must be finite and nonnegative' };
    }
    placements.push({
      child: item.child, normalized: item.style, width: contentWidth + item.horizontalInsets,
      height: contentHeight + item.verticalInsets, horizontalPadding: item.horizontalInsets,
      verticalPadding: item.verticalInsets, alignment: options.alignItems, receiverToken: item.receiver,
      query: item.query,
    });
  }
  const boxes = arrangeFlowItems({ x: 0, y: 0, width, height: owner.height }, placements, options);
  let height = 0;
  for (const box of boxes) height = Math.max(height, box.y + box.height);
  return { status: 'measured', height };
}

function prepareFlowAllocation(props: FlowProps, style: Readonly<FlowStyle>, content: Readonly<LayoutBox>, ctx: RenderingContext2D, region?: LayoutRegion): { children: readonly PibblElement<any>[]; placements: FlowPlacement[] } {
  const children = prepareLayoutChildren(props.children, 'Flow');
  const service = canvasMeasurementService(ctx);
  const placements = resolveFlowPlacements(content, children, style, { service, measureElement: (child, constraints) => measureElement(child, constraints, service) }, region);
  return { children, placements };
}
if (nativeLayout) registerKnownLayoutPreflight(Flow, (element, style, content, receiver, slot) => {
  const previous = GLOBAL_STATE.primitiveReceiverToken;
  GLOBAL_STATE.primitiveReceiverToken = receiver;
  const releaseLayout = pushLayoutBox(content, {
    containingBlock: resolvePositionedContainingBox(
      style as Readonly<FlowStyle>,
      content,
      'Flow',
    ),
  });
  try {
    const options = normalizeFlowOptions(style as Readonly<FlowStyle>, content);
    const ctx = GLOBAL_STATE.renderContext;
    if (!ctx) throw new Error('Known Flow preparation requires a Canvas measurement context.');
    const region = slot.acquire();
    const allocation = prepareFlowAllocation(element.props as FlowProps, options, content, ctx, region);
    const plan: PreparedLayoutPlan = { region, content, ...allocation };
    prepareKnownLayoutDescendants(plan, slot);
    stagePreparedLayoutPlan(slot, plan);
  } finally {
    releaseLayout();
    GLOBAL_STATE.primitiveReceiverToken = previous;
  }
});

export function layoutFlow(
  container: Readonly<LayoutBox>,
  children: PibblNodeInput,
  style: Readonly<FlowStyle>,
  measurement: FlowMeasurementInput,
): LayoutBox[] {
  const prepared = materializeLayoutChildren(children, 'Flow');
  return resolveFlowPlacements(container, prepared, style, measurement)
    .map(placement => placement.box);
}

function resolveFlowPlacements(
  container: Readonly<LayoutBox>,
  children: readonly PibblElement<any>[],
  style: Readonly<FlowStyle>,
  measurement: FlowMeasurementInput,
  nativeRegion?: LayoutRegion,
): FlowPlacement[] {
  assertFiniteContainer(container);
  const options = normalizeFlowOptions(style, container);
  const items: FlowItem[] = [];
  for (const child of children) {
    const receiverToken = getChildPrimitiveReceiverToken(
      GLOBAL_STATE.renderTransaction,
      GLOBAL_STATE.primitiveReceiverToken,
      items.length,
    );
    const prepared = prepareDirectChildStyle(child, receiverToken, container);
    let normalized = preparedStyleValue(prepared) as Readonly<
      BoxStyle & LayoutItemStyle
    >;
    if (nativeLayout && GLOBAL_STATE.currentPibblInstance && getStyleMeasurementMode() === undefined && hasPercentageBoxPadding(normalized)) {
      normalized = resolveAllocatedInsets(normalized, { width: container.width, context: { component: child.type.name || 'Anonymous', algorithm: 'flow' } });
    }
    if (normalized.boxSizing !== undefined) normalized = contentBoxStyle(normalized, { width: container.width, height: container.height, context: { component: child.type.name || 'Anonymous', algorithm: 'flow', constraints: { minWidth: 0, maxWidth: container.width, minHeight: 0, maxHeight: container.height } } });
    assertSupportedChildPosition('Flow', child, normalized);
    const needsWidth = normalized.width === undefined || normalized.width === 'auto';
    const needsHeight = normalized.height === undefined || normalized.height === 'auto';
    let measuredWidth: number | undefined;
    let measuredHeight: number | undefined;
    if (needsWidth || needsHeight) {
      const constraints = {
        minWidth: 0,
        maxWidth: container.width,
        minHeight: 0,
        maxHeight: container.height,
      };
      const measurementChild = clonePibblElement(child);
      setPreNormalizedStyle(
        measurementChild,
        normalized,
        child,
        receiverToken,
        preparedStyleQuery(prepared),
      );
      const result = measurement.measureElement(measurementChild, constraints);
      if (result.status === 'unsupported') {
        const axis = needsWidth ? 'width' : 'height';
        throw layoutDiagnostic({
          component: child.type.name || 'Anonymous',
          property: axis,
          value: normalized[axis] ?? 'auto',
          algorithm: 'flow',
          constraints,
          reason: `measurement is required but unsupported: ${result.reason}`,
        });
      }
      measuredWidth = result.size.width;
      measuredHeight = result.size.height;
    }
    const resolvedStyle = {
      ...normalized,
      width: needsWidth ? measuredWidth : normalized.width,
      height: needsHeight ? measuredHeight : normalized.height,
    };
    const resolved = resolveDirectChildBox(
      container,
      child,
      'flow',
      resolvedStyle,
      measurement.service,
    );
    const box = resolved.borderBox;
    items.push({
      child,
      normalized: Object.freeze(resolvedStyle),
      width: box.width,
      height: box.height,
      horizontalPadding: box.width - resolved.contentBox.width,
      verticalPadding: box.height - resolved.contentBox.height,
      alignment: resolveItemAlignment(
        normalized.alignSelf,
        options.alignItems,
        child,
        container,
      ),
      receiverToken,
      query: preparedStyleQuery(prepared),
    });
  }

  const nativeBoxes = nativeRegion?.placeFlow(items, { horizontal: options.direction === 'horizontal', mainBound: options.direction === 'horizontal' ? container.width : container.height, gap: options.gap, lineGap: options.lineGap, wrap: options.wrap });
  const boxes = nativeBoxes ?? arrangeFlowItems(container, items, options);
  return boxes.map((box, index) => {
    const usedWidth = Math.max(0, box.width - items[index].horizontalPadding);
    const usedHeight = Math.max(0, box.height - items[index].verticalPadding);
    return {
      box: nativeBoxes && (container.x !== 0 || container.y !== 0) ? { x: container.x + box.x, y: container.y + box.y, width: box.width, height: box.height } : box,
      usedWidth, usedHeight,
      element: childWithUsedSize(items[index].child, items[index].normalized, usedWidth, usedHeight, items[index].receiverToken, items[index].query),
    };
  });
}

function measureFlow(
  input: MeasureInput<FlowProps, FlowStyle>,
): MeasureResult {
  const children = prepareLayoutChildren(input.props.children, 'Flow');
  const widthDefinite = input.style.width !== undefined &&
    input.style.width !== 'auto';
  const heightDefinite = input.style.height !== undefined &&
    input.style.height !== 'auto';
  const provisional = provisionalFlowBox(input.style, input.constraints);
  if (widthDefinite && heightDefinite) {
    return { status: 'measured', size: {
      width: provisional.content.width,
      height: provisional.content.height,
    } };
  }

  const placements = resolveFlowPlacements(
    provisional.content,
    children,
    input.style,
    input,
  );
  let intrinsicWidth = 0;
  let intrinsicHeight = 0;
  for (const placement of placements) {
    intrinsicWidth = Math.max(
      intrinsicWidth,
      placement.box.x - provisional.content.x + placement.box.width,
    );
    intrinsicHeight = Math.max(
      intrinsicHeight,
      placement.box.y - provisional.content.y + placement.box.height,
    );
  }
  validateMeasuredExtent(intrinsicWidth, 'width', input.constraints);
  validateMeasuredExtent(intrinsicHeight, 'height', input.constraints);
  return { status: 'measured', size: {
    width: widthDefinite ? provisional.content.width : intrinsicWidth,
    height: heightDefinite ? provisional.content.height : intrinsicHeight,
  } };
}

function provisionalFlowBox(
  style: Readonly<FlowStyle>,
  constraints: Readonly<Constraints>,
): { border: LayoutBox; content: LayoutBox } {
  const diagnosticContext = {
    component: 'Flow',
    algorithm: 'measurement',
    constraints,
  };
  const padding = normalizeBoxInsets(style, diagnosticContext);
  const width = finiteMeasurementBound(
    constraints.maxWidth,
    [style.width, style.minWidth, style.maxWidth],
    padding.left + padding.right,
    'width',
    constraints,
  );
  const height = finiteMeasurementBound(
    constraints.maxHeight,
    [style.height, style.minHeight, style.maxHeight],
    padding.top + padding.bottom,
    'height',
    constraints,
  );
  const box = resolveContainerBox(style, {
    allocation: { x: 0, y: 0, width, height },
    percentageBasis: { x: 0, y: 0, width, height },
    constraints,
    component: 'Flow',
    algorithm: 'render-dispatch',
  }, 'Flow', 'measurement');
  return { border: box.borderBox, content: box.contentBox };
}

function finiteMeasurementBound(
  maximum: number,
  specified: readonly (BoxStyle['width'] | undefined)[],
  padding: number,
  property: 'width' | 'height',
  constraints: Readonly<Constraints>,
): number {
  if (Number.isFinite(maximum)) return maximum;
  const numeric = specified.filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value),
  );
  if (numeric.length > 0) {
    const bound = Math.max(...numeric) + padding;
    if (Number.isFinite(bound)) return bound;
    throw layoutDiagnostic({
      component: 'Flow',
      property,
      value: bound,
      algorithm: 'measurement',
      constraints,
      reason: 'measurement allocation arithmetic must remain finite',
    });
  }
  const percentage = specified.find(
    value => typeof value === 'string' && value.endsWith('%'),
  );
  if (percentage !== undefined) {
    throw layoutDiagnostic({
      component: 'Flow',
      property,
      value: percentage,
      algorithm: 'measurement',
      constraints,
      reason: 'requires a definite finite percentage reference',
    });
  }
  return Number.MAX_SAFE_INTEGER;
}

function validateMeasuredExtent(
  value: number,
  property: string,
  constraints: Readonly<Constraints>,
): void {
  if (!Number.isFinite(value) || value < 0) {
    throw layoutDiagnostic({
      component: 'Flow',
      property,
      value,
      algorithm: 'measurement',
      constraints,
      reason: 'intrinsic flow extent must be finite and nonnegative',
    });
  }
}

function arrangeFlowItems(
  container: Readonly<LayoutBox>,
  items: readonly FlowItem[],
  options: ReturnType<typeof normalizeFlowOptions>,
): LayoutBox[] {
  const horizontal = options.direction === 'horizontal';
  const mainBound = horizontal ? container.width : container.height;
  const lines: FlowItem[][] = [];
  let line: FlowItem[] = [];
  let occupiedMain = 0;
  for (const item of items) {
    const mainSize = horizontal ? item.width : item.height;
    const nextMain = line.length === 0 ?
      mainSize :
      occupiedMain + options.gap + mainSize;
    if (options.wrap && line.length > 0 && nextMain > mainBound) {
      lines.push(line);
      line = [];
      occupiedMain = 0;
    }
    occupiedMain = line.length === 0 ?
      mainSize :
      occupiedMain + options.gap + mainSize;
    line.push(item);
  }
  if (line.length > 0) lines.push(line);

  const placements: LayoutBox[] = [];
  let crossCursor = 0;
  for (const currentLine of lines) {
    const lineCross = Math.max(0, ...currentLine.map(item =>
      horizontal ? item.height : item.width,
    ));
    let mainCursor = 0;
    for (const item of currentLine) {
      const itemMain = horizontal ? item.width : item.height;
      const itemCross = horizontal ? item.height : item.width;
      const crossOffset = alignCross(lineCross, itemCross, item.alignment);
      const placedCross = item.alignment === 'stretch' ?
        Math.max(0, lineCross) :
        itemCross;
      placements.push(horizontal ? {
        x: container.x + mainCursor,
        y: container.y + crossCursor + crossOffset,
        width: itemMain,
        height: placedCross,
      } : {
        x: container.x + crossCursor + crossOffset,
        y: container.y + mainCursor,
        width: placedCross,
        height: itemMain,
      });
      mainCursor += itemMain + options.gap;
    }
    crossCursor += lineCross + options.lineGap;
  }
  return placements;
}

function normalizeFlowOptions(
  style: Readonly<FlowStyle>,
  container: Readonly<LayoutBox>,
) {
  const direction = style.direction ?? 'horizontal';
  if (direction !== 'horizontal' && direction !== 'vertical') {
    throw optionDiagnostic('direction', direction, container);
  }
  if (style.wrap !== undefined && typeof style.wrap !== 'boolean') {
    throw optionDiagnostic('wrap', style.wrap, container);
  }
  const alignItems = style.alignItems ?? 'start';
  if (
    alignItems !== 'start' && alignItems !== 'center' &&
    alignItems !== 'end' && alignItems !== 'stretch'
  ) {
    throw optionDiagnostic('alignItems', alignItems, container);
  }
  return {
    direction,
    wrap: style.wrap ?? false,
    gap: nonnegativeOption(style.gap ?? 0, 'gap', container),
    lineGap: nonnegativeOption(style.lineGap ?? 0, 'lineGap', container),
    alignItems,
  };
}

function nonnegativeOption(
  value: number,
  property: string,
  container: Readonly<LayoutBox>,
): number {
  if (!Number.isFinite(value) || value < 0) {
    throw optionDiagnostic(property, value, container);
  }
  return value;
}

function resolveItemAlignment(
  value: LayoutItemStyle['alignSelf'],
  fallback: FlowAlignment,
  child: PibblElement<any>,
  container: Readonly<LayoutBox>,
): FlowAlignment {
  if (value === undefined || value === 'auto') return fallback;
  if (value === 'start' || value === 'center' || value === 'end' || value === 'stretch') {
    return value;
  }
  throw layoutDiagnostic({
    component: child.type.name || 'Anonymous',
    property: 'alignSelf',
    value,
    algorithm: 'flow',
    constraints: constraintsFor(container),
    reason: 'uses an unsupported flow alignment value',
  });
}

function alignCross(
  lineCross: number,
  itemCross: number,
  alignment: FlowAlignment,
): number {
  if (alignment === 'center') return (lineCross - itemCross) / 2;
  if (alignment === 'end') return lineCross - itemCross;
  return 0;
}

function assertFiniteContainer(container: Readonly<LayoutBox>): void {
  for (const [property, value] of Object.entries(container)) {
    if (!Number.isFinite(value) ||
      ((property === 'width' || property === 'height') && value < 0)) {
      throw optionDiagnostic(property, value, container);
    }
  }
}

function optionDiagnostic(
  property: string,
  value: unknown,
  container: Readonly<LayoutBox>,
) {
  return layoutDiagnostic({
    component: 'Flow',
    property,
    value,
    algorithm: 'flow',
    constraints: constraintsFor(container),
    reason: 'uses an unsupported flow value',
  });
}

function constraintsFor(container: Readonly<LayoutBox>) {
  return {
    minWidth: 0,
    maxWidth: container.width,
    minHeight: 0,
    maxHeight: container.height,
  };
}
