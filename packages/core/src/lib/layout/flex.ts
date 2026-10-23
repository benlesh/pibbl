import { contentBoxStyle } from './box-sizing.js';
import { Grid } from './grid.js';
import { Flow } from './flow.js';
import type { PreparedFlexLayoutPlan, PreparedLayoutSlot } from './prepared-root.js';
import { isKnownLayoutType, registerKnownLayoutPreflight, stagePreparedChildStyle, takePreparedChildStyle, hasPreparedChildStyles, claimPreparedFlexPlan, stagePreparedLayoutPlan, preflightKnownLayout, attachPreparedLayoutSlot } from './prepared-root.js';
import { isLayoutComponent, prepareLayoutComponent } from './define-layout-component.js';
import { allocationInputRevision } from './allocation-revision.js';
import { FlexAllocationCache, frozenFlexInputs, type CachedFlexPlacement } from './flex-allocation-cache.js';
import { experimentalLayout, LayoutRegion, mountedLayoutRegion, recordWasmMeasurement, recordWasmAllocationPass, recordWasmAllocationItem, recordWasmAllocationCacheHit } from './wasm/region.js';
import { Rectangle } from '../components/rect.js';
import { Text, prepareLayoutTextContent, measureLayoutTextMinimumWidth, measureLayoutTextNaturalRun } from '../components/text.js';

const unsupportedProperties = ['order'] as const;

import { ResponsiveStylePreparation, preparedStyleValue, preparedStyleQuery, type PreparedQuery } from '../style/responsive.js';
import { definePrimitive } from '../define-primitive.js';
import { clonePibblElement } from '../element/create-element.js';
import { getChildPrimitiveReceiverToken, getPrimitiveReceiverToken } from '../element/metadata.js';
import type { PibblElement } from '../element/types.js';
import { GLOBAL_STATE } from '../global-state.js';
import { layoutDiagnostic } from '../style/diagnostics.js';
import {
  type PibblStructuralEventProps,
  wireStructuralEvents,
} from '../components/structural-events.js';
import { normalizeBoxInsets, hasPercentagePadding, resolveAllocatedPadding } from './box-insets.js';
import { resolveLength } from '../style/resolve-length.js';
import { setPreNormalizedStyle, peekPreNormalizedStyle } from '../style/resolve-dispatch.js';
import type {
  BoxStyle,
  Percentage,
  FlexItemStyle,
  LayoutItemStyle,
  ResolvedBoxStyle,
} from '../style/types.js';
import type {
  CanvasMeasurementService,
  PibblNodeInput,
  MeasureInput,
  MeasureResult,
  RenderingContext2D,
  SystemStyle,
} from '../types.js';
import {
  childWithUsedSize,
  childWithCachedUsedSize,
  prepareDirectChildStyle,
  materializeLayoutChildren,
  placeDirectChildren,
  prepareLayoutChildren,
  resolveContainerBox,
} from './absolute.js';
import { pushLayoutBox } from './context.js';
import { recordLayoutEvaluation } from './diagnostics.js';
import { assertSupportedChildPosition } from './positioning-diagnostics.js';
import { measureElement, withIsolatedRenderState } from './measure.js';
import { withSignalWriteForbidden } from '../signals/graph.js';
import type { Constraints, LayoutBox } from './types.js';

type FlexDirection = 'row' | 'column' | 'row-reverse' | 'column-reverse';
type FlexWrap = 'nowrap' | 'wrap' | 'wrap-reverse';
type MainAlignment =
  | 'flex-start'
  | 'flex-end'
  | 'center'
  | 'space-between'
  | 'space-around'
  | 'space-evenly';
type CrossAlignment = 'stretch' | 'flex-start' | 'flex-end' | 'center';

/**
 * Supported geometry and presentation properties for Flex.
 *
 * @see {@link BoxStyle}
 * @see {@link LayoutItemStyle}
 * @see {@link Flex}
 */
export interface FlexStyle extends BoxStyle, LayoutItemStyle {
  /** The main axis along which flex children are placed. See {@link FlexDirection}. */
  flexDirection?: FlexDirection;
  /** Whether children may wrap onto additional flex lines. See {@link FlexWrap}. */
  flexWrap?: FlexWrap;
  /** Distribution along the main axis. start/end keep physical LTR edges under reversal. See {@link MainAlignment}. */
  justifyContent?: MainAlignment | 'start' | 'end';
  /** Cross alignment. start/end keep physical LTR edges under wrap-reverse. See {@link CrossAlignment}. */
  alignItems?: CrossAlignment | 'start' | 'end';
  /**
   * Distribution of wrapped flex lines within the available cross-axis space. See
   * {@link CrossAlignment}, {@link MainAlignment}.
   */
  alignContent?: CrossAlignment | MainAlignment | 'start' | 'end';
  /** Numeric spacing, or experimental allocated-axis percentages. See {@link Percentage}, {@link FlexStyle}. */
  gap?: number | Percentage;
  /** Physical row spacing; experimental percentages use content height. See {@link Percentage}, {@link FlexStyle}. */
  rowGap?: number | Percentage;
  /** Physical column spacing; experimental percentages use content width. See {@link Percentage}, {@link FlexStyle}. */
  columnGap?: number | Percentage;
}

/**
 * Authored inputs for Flex, including the declared data and presentation options.
 *
 * @see {@link PibblNodeInput}
 * @see {@link Flex}
 */
export interface FlexProps extends PibblStructuralEventProps {
  /** Descendant content or the callback that supplies it. See {@link PibblNodeInput}. */
  children: PibblNodeInput;
}

export interface FlexMeasurementInput {
  service: CanvasMeasurementService;
  measureElement(
    element: PibblElement<any>,
    constraints: Readonly<Constraints>,
  ): MeasureResult;
}

interface ResolvedFlexStyle extends SystemStyle {
  box: ResolvedBoxStyle;
  overflow: 'visible' | 'clip';
  flexDirection: FlexDirection;
  flexWrap: FlexWrap;
  justifyContent: MainAlignment;
  alignItems: CrossAlignment;
  alignContent: CrossAlignment | MainAlignment;
  rowGap: number;
  columnGap: number;
}

interface FlexItem {
  child: PibblElement<any>;
  normalized: Readonly<BoxStyle & FlexItemStyle & LayoutItemStyle>;
  baseMain: number;
  targetMain: number;
  paddingMain: number;
  marginMainBefore: number;
  marginMainAfter: number;
  marginCrossBefore: number;
  marginCrossAfter: number;
  preferredCross: number;
  paddingCross: number;
  minMain: number;
  maxMain: number;
  minCross: number;
  maxCross: number;
  grow: number;
  shrink: number;
  crossAuto: boolean;
  aspectRatio?: number;
  alignSelf: CrossAlignment | 'auto';
  receiverToken: object;
  layoutToken?: object;
  query?: PreparedQuery;
}

interface FlexLine {
  items: FlexItem[];
  crossSize: number;
  crossOffset: number;
}

interface FlexPlacement extends CachedFlexPlacement {
  box: LayoutBox;
  element: PibblElement<any>;
}

function renderFlex(
  props: FlexProps,
  style: Readonly<ResolvedFlexStyle>,
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
  const releaseLayout = pushLayoutBox(localContent);
  GLOBAL_STATE.componentRefs!.onAfterRender = releaseLayout;
  const service = flexMeasurementService(ctx);
  const prepared = experimentalLayout ? claimPreparedFlexPlan(GLOBAL_STATE.componentRefs!.element, localContent) : undefined;
  const region = experimentalLayout ? mountedLayoutRegion() : undefined;
  const plan = prepared ?? prepareFlexAllocation(props, style, localContent, service, region);
  if (experimentalLayout && !prepared) prepareFlexDescendants(plan);
  const { children, placements, revision } = plan;
  if (!plan.cached) {
    const transaction = GLOBAL_STATE.renderTransaction;
    if (region && transaction && frozenFlexInputs(props.children)) {
      const input = props.children;
      const owner = GLOBAL_STATE.componentRefs!;
      const snapshot: CachedFlexPlacement[] = [];
      for (const placement of placements) {
        snapshot.push({
          box: { x: placement.box.x, y: placement.box.y, width: placement.box.width, height: placement.box.height },
          usedWidth: placement.usedWidth, usedHeight: placement.usedHeight,
        });
      }
      transaction.onFinish(success => {
        if (!success || owner.teardowns.closed || allocationInputRevision() !== revision) return;
        const cache = new FlexAllocationCache();
        cache.store(input, revision, localContent, style, snapshot);
        region.allocationCache = cache;
      });
    }
  }
  let index = 0;
  return placeDirectChildren(
    children,
    localContent,
    () => placements[index++],
    style.overflow,
  );
}

function flexMeasurementService(ctx: RenderingContext2D): CanvasMeasurementService {
  return {
    measureText(value: string, font: string) {
      ctx.save();
      try {
        ctx.font = font;
        return ctx.measureText(value);
      } finally {
        ctx.restore();
      }
    },
  };
}

function prepareFlexAllocation(props: FlexProps, style: Readonly<ResolvedFlexStyle>, localContent: Readonly<LayoutBox>, service: CanvasMeasurementService, region?: LayoutRegion) {
  const revision = allocationInputRevision();
  // Decide before materializing or inspecting children; normal paint traversal
  // still visits them and resolves their current receiver-owned paint inputs.
  const cached = region?.allocationCache?.read(props.children, revision, localContent, style);
  const children = prepareLayoutChildren(props.children, 'Flex');
  let placements: FlexPlacement[];
  if (cached) {
    recordWasmAllocationCacheHit();
    placements = [];
    for (let index = 0; index < children.length; index++) {
      const allocation = cached[index];
      const child = children[index];
      const receiver = hasPreparedChildStyles() ? getChildPrimitiveReceiverToken(GLOBAL_STATE.renderTransaction, GLOBAL_STATE.primitiveReceiverToken, index) : undefined;
      const prepared = takePreparedChildStyle(child, receiver, localContent);
      placements.push({
        box: allocation.box,
        usedWidth: allocation.usedWidth,
        usedHeight: allocation.usedHeight,
        element: prepared ? childWithUsedSize(child, preparedStyleValue(prepared), allocation.usedWidth, allocation.usedHeight, receiver, preparedStyleQuery(prepared)) :
          childWithCachedUsedSize(child, allocation.usedWidth, allocation.usedHeight),
      });
    }
  } else {
    if (region) region.allocationCache = undefined;
    placements = resolveFlexPlacements(localContent, children, style, {
      service,
      measureElement: (element, constraints) => measureElement(element, constraints, service),
    }, region);
  }
  return { children, placements, revision, content: localContent, cached: cached !== undefined };
}

/**
 * Describes the supported Flexbox subset for JSX or createElement authoring.
 * Text automatic heights use the final allocated width in rows and nowrap columns
 * before dependent sibling placement. See {@link Text}.
 *
 * @param props - Authored component inputs, supplied through JSX or createElement. See the linked
 * props and style types.
 * @throws When called directly; Pibbl mounts this component through JSX or createElement.
 *
 * @see {@link FlexProps}
 * @see {@link FlexStyle}
 */
export const Flex = definePrimitive<
  FlexProps,
  FlexStyle,
  FlexStyle,
  ResolvedFlexStyle
>(renderFlex, {
  childInput: 'structural',
  resolveStyle: (style, context) => {
    const box = resolveContainerBox(style, context, 'Flex', 'flex');
    return { box, overflow: style.overflow ?? 'visible', ...normalizeFlexOptions(style, box.contentBox) };
  },
  measure: input => measureFlex(input),
});

// A known Absolute sibling boundary resolves these receiver inputs before any
// sibling's opaque component executes. Geometry still solves in normal traversal.
if (experimentalLayout) registerKnownLayoutPreflight(Flex, (element, style, content, receiver, slot) => {
  normalizeFlexOptions(style as Readonly<FlexStyle>, content);
  const previous = GLOBAL_STATE.primitiveReceiverToken;
  GLOBAL_STATE.primitiveReceiverToken = receiver;
  try {
    const children = prepareLayoutChildren(element.props.children, 'Flex');
    for (let index = 0; index < children.length; index++) {
      const child = children[index];
      const token = getChildPrimitiveReceiverToken(GLOBAL_STATE.renderTransaction, receiver, index);
      let prepared = prepareDirectChildStyle(child, token, content, true);
      const specified = preparedStyleValue(prepared) as Readonly<BoxStyle & FlexItemStyle & LayoutItemStyle & Record<string, unknown>>;
      const normalized = resolveAllocatedPadding(specified, { width: content.width, context: childContext(child, content) });
      if (normalized !== specified) {
        if (prepared instanceof ResponsiveStylePreparation) prepared.style = normalized;
        else prepared = normalized;
      }
      assertSupportedChildPosition('Flex', child, normalized);
      rejectUnsupportedItemFields(child, normalized, content);
      nonnegativeFactor(normalized.flexGrow ?? 0, 'flexGrow', child, content);
      nonnegativeFactor(normalized.flexShrink ?? 1, 'flexShrink', child, content);
      stagePreparedChildStyle(child, token, content, prepared);
    }
    const ctx = GLOBAL_STATE.renderContext;
    if (!ctx) throw new Error('Known layout preparation requires a Canvas measurement context.');
    const region = slot.acquire();
    const resolved = { box: { contentBox: content }, overflow: (style as Readonly<FlexStyle>).overflow ?? 'visible', ...normalizeFlexOptions(style as Readonly<FlexStyle>, content) } as Readonly<ResolvedFlexStyle>;
    const plan = prepareFlexAllocation(element.props as FlexProps, resolved, content, flexMeasurementService(ctx), region);
    prepareFlexDescendants(plan, slot);
    stagePreparedLayoutPlan(slot, { ...plan, region });
  } finally { GLOBAL_STATE.primitiveReceiverToken = previous; }
});

/** Known descendants prepare only after this boundary's own allocation settles. */
function prepareFlexDescendants(plan: Pick<PreparedFlexLayoutPlan, 'children' | 'placements'>, parentSlot?: PreparedLayoutSlot): void {
  let flexOccurrence = 0;
  let descriptionOccurrences: Map<Function, number> | undefined;
    for (let index = 0; index < plan.children.length; index++) {
      const child = plan.children[index];
      if (!isKnownLayoutType(child.type) && !isLayoutComponent(child.type)) continue;
      let occurrence = 0;
      if (child.key === undefined) {
        if (child.type === Flex) occurrence = flexOccurrence++;
        else {
          descriptionOccurrences ??= new Map();
          occurrence = descriptionOccurrences.get(child.type) ?? 0;
          descriptionOccurrences.set(child.type, occurrence + 1);
        }
      }
      const placement = plan.placements[index];
      const prepared = peekPreNormalizedStyle(placement.element);
      if (!prepared) throw new Error('Known layout preparation requires settled receiver inputs.');
      const receiver = getPrimitiveReceiverToken(placement.element);
      const nested = preflightKnownLayout(child, prepared.style, { x: 0, y: 0, width: placement.usedWidth, height: placement.usedHeight }, receiver, occurrence, parentSlot);
      attachPreparedLayoutSlot(placement.element, nested);
    }
}

function measureFlex(
  input: MeasureInput<FlexProps, FlexStyle>,
): MeasureResult {
  const children = prepareLayoutChildren(input.props.children, 'Flex');
  const widthDefinite = input.style.width !== undefined &&
    input.style.width !== 'auto';
  const heightDefinite = input.style.height !== undefined &&
    input.style.height !== 'auto';
  if (widthDefinite && heightDefinite) {
    return { status: 'measured', size: {
      width: resolveMeasuredContainerLength(
        input.style.width!,
        input.constraints.maxWidth,
        'width',
        input.constraints,
      ),
      height: resolveMeasuredContainerLength(
        input.style.height!,
        input.constraints.maxHeight,
        'height',
        input.constraints,
      ),
    } };
  }
  if ((input.style.flexWrap ?? 'nowrap') !== 'nowrap') {
    return unsupportedIntrinsic('requires nowrap because wrapped intrinsic sizing is deferred');
  }
  if (isPercentage(input.style.gap) || isPercentage(input.style.rowGap) || isPercentage(input.style.columnGap)) return unsupportedIntrinsic('does not support percentage gaps without an actual finite content allocation');
  const row = isRowDirection(input.style.flexDirection);
  const diagnosticBox = {
    x: 0,
    y: 0,
    width: Number.isFinite(input.constraints.maxWidth) ?
      input.constraints.maxWidth : 0,
    height: Number.isFinite(input.constraints.maxHeight) ?
      input.constraints.maxHeight : 0,
  };
  const options = normalizeFlexOptions(input.style, diagnosticBox);
  const mainGap = row ? options.columnGap : options.rowGap;
  let intrinsicMain = 0;
  let intrinsicCross = 0;
  let count = 0;
  for (const child of children) {
    const receiverToken = getChildPrimitiveReceiverToken(
      GLOBAL_STATE.renderTransaction,
      GLOBAL_STATE.primitiveReceiverToken,
      count,
    );
    const prepared = prepareDirectChildStyle(child, receiverToken, diagnosticBox, true);
    let style = preparedStyleValue(prepared) as Readonly<
      BoxStyle & FlexItemStyle & LayoutItemStyle & Record<string, unknown>
    >;
    if (hasPercentagePadding(style.padding)) return unsupportedIntrinsic('does not support percentage padding without an actual finite Flex allocation');
    const layoutChild = isLayoutComponent(child.type) ? prepareLayoutComponent(child, { receiverToken }) : child;
    const settledColumnChild = experimentalLayout && !row && typeof input.style.width === 'number' && !heightDefinite &&
      (child.type === Text || layoutChild.type === Flow || layoutChild.type === Grid || layoutChild.type === Flex && isColumnDirection(style.flexDirection) && (style.flexWrap ?? 'nowrap') === 'nowrap');
    if (settledColumnChild && (isPercentage(style.width) || isPercentage(style.minWidth) || isPercentage(style.maxWidth))) {
      if (isPercentage(style.height) || isPercentage(style.flexBasis) || isPercentage(style.minHeight) || isPercentage(style.maxHeight)) return unsupportedIntrinsic('does not support percentage child main sizes or bounds');
      const reference = resolveMeasuredContainerLength(input.style.width!, input.constraints.maxWidth, 'width', input.constraints);
      const context = childContext(child, diagnosticBox);
      // Resolve only against an explicit owner, before converting outer box inputs.
      // Keep numeric hot paths allocation-free and leave indefinite owners unsupported.
      style = { ...style,
        width: isPercentage(style.width) ? resolveLength(style.width!, reference, 'width', context) : style.width,
        minWidth: isPercentage(style.minWidth) ? resolveLength(style.minWidth!, reference, 'minWidth', context) : style.minWidth,
        maxWidth: isPercentage(style.maxWidth) ? resolveLength(style.maxWidth!, reference, 'maxWidth', context) : style.maxWidth,
      };
    }
    if (style.boxSizing !== undefined) style = contentBoxStyle(style, { width: diagnosticBox.width, height: diagnosticBox.height, mainAxis: row ? 'width' : 'height', context: childContext(child, diagnosticBox) });
    rejectUnsupportedItemFields(child, style, diagnosticBox);
    if (style.aspectRatio !== undefined) return unsupportedIntrinsic('does not support aspectRatio during intrinsic measurement');
    const allMargin = numericMargin(style.margin, 'margin', child, diagnosticBox);
    const marginTop = numericMargin(style.marginTop === undefined ? allMargin : style.marginTop, 'marginTop', child, diagnosticBox);
    const marginRight = numericMargin(style.marginRight === undefined ? allMargin : style.marginRight, 'marginRight', child, diagnosticBox);
    const marginBottom = numericMargin(style.marginBottom === undefined ? allMargin : style.marginBottom, 'marginBottom', child, diagnosticBox);
    const marginLeft = numericMargin(style.marginLeft === undefined ? allMargin : style.marginLeft, 'marginLeft', child, diagnosticBox);
    const marginMain = row ? marginLeft + marginRight : marginTop + marginBottom;
    const marginCross = row ? marginTop + marginBottom : marginLeft + marginRight;
    const grow = nonnegativeFactor(
      style.flexGrow ?? 0,
      'flexGrow',
      child,
      diagnosticBox,
    );
    if (grow !== 0) {
      return unsupportedIntrinsic('does not support flexGrow during intrinsic measurement');
    }
    const shrink = nonnegativeFactor(
      style.flexShrink ?? 1,
      'flexShrink',
      child,
      diagnosticBox,
    );
    const basis = style.flexBasis ?? 'auto';
    const mainProperty = row ? 'width' : 'height';
    const crossProperty = row ? 'height' : 'width';
    const minimumProperty = row ? 'minWidth' : 'minHeight';
    if ((shrink > 0 || basis === 'auto') && style[minimumProperty] === undefined &&
      !hasEmptyRectangleMinimum(child, style, preparedStyleQuery(prepared))) {
      throw childDiagnostic(
        child,
        minimumProperty,
        style[minimumProperty],
        diagnosticBox,
        'an explicit main-axis minimum is required for shrink or auto basis',
      );
    }
    const mainValue = basis === 'auto' ? style[mainProperty] : basis;
    const crossValue = style[crossProperty];
    if (isPercentage(mainValue) || isPercentage(crossValue) ||
      hasPercentageBounds(style)) {
      return unsupportedIntrinsic('does not support percentage child sizes or bounds');
    }
    let baseMain: number;
    let baseCross: number;
    if (experimentalLayout && !row && widthDefinite && !heightDefinite &&
      (child.type === Text || layoutChild.type === Flow || layoutChild.type === Grid || layoutChild.type === Flex && isColumnDirection(style.flexDirection) && (style.flexWrap ?? 'nowrap') === 'nowrap') &&
      (mainValue === undefined || mainValue === 'auto' || crossValue === undefined || crossValue === 'auto')) {
      // Descend only through known built-in columns at settled content widths.
      // The shared measurement context detects descriptor cycles; there is no
      // speculative component execution, percentage feedback or fixed-point loop.
      const padding = normalizeBoxInsets(style, childContext(child, diagnosticBox));
      const automaticWidth = crossValue === undefined || crossValue === 'auto';
      if (automaticWidth && effectiveAlignment(normalizeItemAlignment(style.alignSelf, child, diagnosticBox), options.alignItems) !== 'stretch') {
        return unsupportedIntrinsic('requires stretch or a definite child width in an auto-height column');
      }
      const availableWidth = resolveMeasuredContainerLength(input.style.width!, input.constraints.maxWidth, 'width', input.constraints);
      const minWidth = intrinsicOptionalNumber(style.minWidth, 0, 'minWidth');
      const maxWidth = intrinsicOptionalNumber(style.maxWidth, Number.POSITIVE_INFINITY, 'maxWidth');
      if (minWidth > maxWidth) throw childDiagnostic(child, 'minWidth', minWidth, diagnosticBox, 'minimum must not exceed maximum');
      const usedWidth = clamp(automaticWidth ? Math.max(0, availableWidth-padding.left-padding.right-marginCross) : intrinsicNumber(crossValue, 'width'), minWidth, maxWidth);
      const measuredChild = clonePibblElement(layoutChild);
      const measuredStyle = { ...style, width: usedWidth };
      setPreNormalizedStyle(measuredChild, measuredStyle, layoutChild, getPrimitiveReceiverToken(layoutChild) ?? receiverToken, preparedStyleQuery(prepared));
      const result = input.measureElement(measuredChild, { minWidth: 0, maxWidth: usedWidth, minHeight: 0, maxHeight: input.constraints.maxHeight });
      if (result.status !== 'measured') return result;
      baseMain = mainValue === undefined || mainValue === 'auto' ? result.size.height : intrinsicNumber(mainValue, 'flexBasis');
      baseCross = usedWidth;
    } else {
      if (mainValue === undefined || mainValue === 'auto') {
        return unsupportedIntrinsic('requires a definite child basis; measured auto basis is deferred');
      }
      if (crossValue === undefined || crossValue === 'auto') {
        return unsupportedIntrinsic('requires a definite child cross size');
      }
      baseMain = intrinsicNumber(mainValue, 'flexBasis');
      baseCross = intrinsicNumber(crossValue, crossProperty);
    }
    const minMain = intrinsicOptionalNumber(style[minimumProperty], 0, minimumProperty);
    const maxMainProperty = row ? 'maxWidth' : 'maxHeight';
    const maxMain = intrinsicOptionalNumber(
      style[maxMainProperty],
      Number.POSITIVE_INFINITY,
      maxMainProperty,
    );
    const minCrossProperty = row ? 'minHeight' : 'minWidth';
    const maxCrossProperty = row ? 'maxHeight' : 'maxWidth';
    const minCross = intrinsicOptionalNumber(style[minCrossProperty], 0, minCrossProperty);
    const maxCross = intrinsicOptionalNumber(
      style[maxCrossProperty],
      Number.POSITIVE_INFINITY,
      maxCrossProperty,
    );
    const padding = normalizeBoxInsets(style, childContext(child, diagnosticBox));
    const paddingMain = row ? padding.left + padding.right :
      padding.top + padding.bottom;
    const paddingCross = row ? padding.top + padding.bottom :
      padding.left + padding.right;
    intrinsicMain += clamp(baseMain, minMain, maxMain) + paddingMain + marginMain;
    intrinsicCross = Math.max(
      intrinsicCross,
      clamp(baseCross, minCross, maxCross) + paddingCross + marginCross,
    );
    count++;
  }
  intrinsicMain = Math.max(0, intrinsicMain + Math.max(0, count - 1) * mainGap);
  return { status: 'measured', size: {
    width: widthDefinite ? resolveMeasuredContainerLength(
      input.style.width!,
      input.constraints.maxWidth,
      'width',
      input.constraints,
    ) : row ? intrinsicMain : intrinsicCross,
    height: heightDefinite ? resolveMeasuredContainerLength(
      input.style.height!,
      input.constraints.maxHeight,
      'height',
      input.constraints,
    ) : row ? intrinsicCross : intrinsicMain,
  } };
}

function resolveMeasuredContainerLength(
  value: Exclude<BoxStyle['width'], undefined>,
  reference: number,
  property: string,
  constraints: Readonly<Constraints>,
): number {
  const resolved = resolveLength(value, reference, property, {
    component: 'Flex',
    algorithm: 'measurement',
    constraints,
  });
  if (resolved === undefined || resolved < 0) {
    throw layoutDiagnostic({
      component: 'Flex',
      property,
      value,
      algorithm: 'measurement',
      constraints,
      reason: 'requires a definite nonnegative container size',
    });
  }
  return resolved;
}

function intrinsicNumber(
  value: unknown,
  property: string,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw layoutDiagnostic({
      component: 'Flex',
      property,
      value,
      algorithm: 'measurement',
      reason: 'intrinsic measurement requires finite nonnegative numeric sizes',
    });
  }
  return value;
}

function intrinsicOptionalNumber(
  value: unknown,
  fallback: number,
  property: string,
): number {
  return value === undefined ? fallback : intrinsicNumber(value, property);
}

function isPercentage(value: unknown): boolean {
  return typeof value === 'string' && value.endsWith('%');
}

function hasPercentageBounds(style: Readonly<BoxStyle>): boolean {
  return isPercentage(style.minWidth) || isPercentage(style.maxWidth) ||
    isPercentage(style.minHeight) || isPercentage(style.maxHeight);
}

function unsupportedIntrinsic(reason: string): MeasureResult {
  return {
    status: 'unsupported',
    reason: `Flex intrinsic measurement ${reason}`,
  };
}

export function layoutFlex(
  container: Readonly<LayoutBox>,
  children: PibblNodeInput,
  style: Readonly<FlexStyle>,
  measurement: FlexMeasurementInput,
): LayoutBox[] {
  const prepared = materializeLayoutChildren(children, 'Flex');
  const region = experimentalLayout ? new LayoutRegion() : undefined;
  try {
    return resolveFlexPlacements(container, prepared, style, measurement, region)
      .map(placement => placement.box);
  } finally { region?.dispose(); }
}

function resolveFlexPlacements(
  container: Readonly<LayoutBox>,
  children: readonly PibblElement<any>[],
  style: Readonly<FlexStyle>,
  measurement: FlexMeasurementInput,
  region?: LayoutRegion,
): FlexPlacement[] {
  if (region) recordWasmAllocationPass();
  assertFiniteBox(container);
  const options = normalizeFlexOptions(style, container);
  const row = isRowDirection(options.flexDirection);
  const reverse = options.flexDirection === 'row-reverse' || options.flexDirection === 'column-reverse';
  const wrapReverse = options.flexWrap === 'wrap-reverse';
  const mainSize = row ? container.width : container.height;
  const crossSize = row ? container.height : container.width;
  const mainGap = row ? options.columnGap : options.rowGap;
  const crossGap = row ? options.rowGap : options.columnGap;
  const items: FlexItem[] = [];
  let hasAspectRatio = false;

  const occurrences = new Map<object, number>();
  for (const child of children) {
    if (region) recordWasmAllocationItem();
    const receiverToken = getChildPrimitiveReceiverToken(
      GLOBAL_STATE.renderTransaction,
      GLOBAL_STATE.primitiveReceiverToken,
      items.length,
    );
    const occurrence = occurrences.get(child.type) ?? 0;
    if (child.key === undefined) occurrences.set(child.type, occurrence + 1);
    const layoutToken = region?.identity(child.type, child.key === undefined ? `occurrence:${occurrence}` : `key:${typeof child.key}:${child.key}`);
    const prepared = prepareDirectChildStyle(child, receiverToken, container, true);
    let normalized = preparedStyleValue(prepared) as Readonly<
      BoxStyle & FlexItemStyle & LayoutItemStyle & Record<string, unknown>
    >;
    if (experimentalLayout) normalized = resolveAllocatedPadding(normalized, { width: container.width, context: childContext(child, container) });
    if (normalized.boxSizing !== undefined) normalized = contentBoxStyle(normalized, { width: container.width, height: container.height, mainAxis: row ? 'width' : 'height', context: childContext(child, container) });
    const aspectRatio = normalized.aspectRatio;
    if (aspectRatio !== undefined && (typeof aspectRatio !== 'number' || !Number.isFinite(aspectRatio) || aspectRatio <= 0)) {
      throw childDiagnostic(child, 'aspectRatio', aspectRatio, container, 'must be a positive finite outer width/height ratio');
    }
    if (aspectRatio !== undefined) hasAspectRatio = true;
    const layoutChild = isLayoutComponent(child.type) ? prepareLayoutComponent(child, { receiverToken }) : child;
    const knownIntrinsicLayout = child.type === Flex || layoutChild.type === Flow || layoutChild.type === Grid || layoutChild.type === Flex &&
      isColumnDirection(normalized.flexDirection) && (normalized.flexWrap ?? 'nowrap') === 'nowrap';
    assertSupportedChildPosition('Flex', child, normalized);
    rejectUnsupportedItemFields(child, normalized, container);
    const allMargin = numericMargin(normalized.margin, 'margin', child, container);
    const marginTop = numericMargin(normalized.marginTop === undefined ? allMargin : normalized.marginTop, 'marginTop', child, container);
    const marginRight = numericMargin(normalized.marginRight === undefined ? allMargin : normalized.marginRight, 'marginRight', child, container);
    const marginBottom = numericMargin(normalized.marginBottom === undefined ? allMargin : normalized.marginBottom, 'marginBottom', child, container);
    const marginLeft = numericMargin(normalized.marginLeft === undefined ? allMargin : normalized.marginLeft, 'marginLeft', child, container);
    const marginMainBefore = row ? reverse ? marginRight : marginLeft : reverse ? marginBottom : marginTop;
    const marginMainAfter = row ? reverse ? marginLeft : marginRight : reverse ? marginTop : marginBottom;
    const marginCrossBefore = row ? wrapReverse ? marginBottom : marginTop : wrapReverse ? marginRight : marginLeft;
    const marginCrossAfter = row ? wrapReverse ? marginTop : marginBottom : wrapReverse ? marginLeft : marginRight;
    const grow = nonnegativeFactor(normalized.flexGrow ?? 0, 'flexGrow', child, container);
    const shrink = nonnegativeFactor(
      normalized.flexShrink ?? 1,
      'flexShrink',
      child,
      container,
    );
    const basisValue = normalized.flexBasis ?? 'auto';
    const minimumProperty = row ? 'minWidth' : 'minHeight';
    // A bounded native Text contribution; other missing minima keep their
    // diagnostic. A flex basis is a distribution input, never a width cap.
    const intrinsicTextSizing = experimentalLayout && row && options.flexWrap === 'nowrap' &&
      child.type === Text && normalized.wrap === true &&
      (normalized.fit === undefined || normalized.fit === 'visible') && !preparedStyleQuery(prepared) &&
      (normalized.width === undefined || normalized.width === 'auto' || typeof normalized.width === 'number') &&
      (normalized.maxWidth === undefined || typeof normalized.maxWidth === 'number') && genericTextFont(normalized);
    const automaticTextBasis = intrinsicTextSizing && basisValue === 'auto' &&
      (normalized.width === undefined || normalized.width === 'auto') &&
      (normalized.minWidth === undefined || typeof normalized.minWidth === 'number');
    const automaticTextMinimum = intrinsicTextSizing && normalized[minimumProperty] === undefined && shrink > 0 &&
      (typeof basisValue === 'number' || basisValue === 'auto' &&
        (typeof normalized.width === 'number' || automaticTextBasis));
    // An empty authored rectangle has no intrinsic content contribution. Keep
    // opaque/child-bearing primitives conservative without evaluating children.
    const automaticRectangleMinimum = hasEmptyRectangleMinimum(child, normalized, preparedStyleQuery(prepared), true);
    if ((shrink > 0 || basisValue === 'auto') && normalized[minimumProperty] === undefined && !automaticTextMinimum && !automaticTextBasis && !automaticRectangleMinimum) {
      throw childDiagnostic(
        child,
        minimumProperty,
        normalized[minimumProperty],
        container,
        'an explicit main-axis minimum is required for shrink or auto basis',
      );
    }

    const mainProperty = row ? 'width' : 'height';
    const crossProperty = row ? 'height' : 'width';
    const mainReference = mainSize;
    const crossReference = crossSize;
    let measured: { width: number; height: number } | undefined;
    const specifiedMain = normalized[mainProperty];
    const specifiedCross = normalized[crossProperty];
    const needsMeasuredMain = basisValue === 'auto' &&
      (specifiedMain === undefined || specifiedMain === 'auto');
    if (aspectRatio !== undefined && needsMeasuredMain) throw childDiagnostic(child, 'aspectRatio', aspectRatio, container, 'requires a definite main dimension or flexBasis; intrinsic aspect sizing is unsupported');
    const crossAuto = specifiedCross === undefined || specifiedCross === 'auto';
    if (experimentalLayout && !row && options.flexWrap !== 'nowrap' && (needsMeasuredMain || aspectRatio === undefined && crossAuto)) {
      throw childDiagnostic(child, needsMeasuredMain ? mainProperty : crossProperty, 'auto', container,
        'Experimental WASM column wrap requires a declared height or flexBasis and a declared width; intrinsic item sizes are unsupported.');
    }
    const alignment = normalizeItemAlignment(normalized.alignSelf, child, container, wrapReverse);
    const needsMeasuredCross = aspectRatio === undefined && crossAuto && alignment !== 'stretch' &&
      options.alignItems !== 'stretch';
    // A finite column cross allocation determines a stretched built-in child's
    // width without measuring its intrinsic height. Resolve bounds/padding first.
    const deferredIntrinsicColumn = aspectRatio === undefined && experimentalLayout && !row && knownIntrinsicLayout &&
      needsMeasuredMain && crossAuto && effectiveAlignment(alignment, options.alignItems) === 'stretch';
    if (!deferredIntrinsicColumn && (needsMeasuredMain || aspectRatio === undefined && (needsMeasuredCross || crossAuto))) {
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
      const result = measureFlexChild(measurementChild, constraints, normalized, layoutToken ?? receiverToken, measurement, region, preparedStyleQuery(prepared));
      if (result.status === 'measured') {
        measured = result.size;
      } else if (needsMeasuredMain || (crossAuto && effectiveAlignment(
        alignment,
        options.alignItems,
      ) !== 'stretch')) {
        throw childDiagnostic(
          child,
          needsMeasuredMain ? mainProperty : crossProperty,
          'auto',
          container,
          `measurement is required but unsupported: ${result.reason}`,
        );
      }
    }

    const padding = normalizeBoxInsets(normalized, childContext(child, container));
    const paddingMain = row ? padding.left + padding.right : padding.top + padding.bottom;
    const paddingCross = row ? padding.top + padding.bottom : padding.left + padding.right;
    let minMain = resolveOptionalBound(
      normalized[minimumProperty],
      mainReference,
      minimumProperty,
      0,
      child,
      container,
    );
    const maximumProperty = row ? 'maxWidth' : 'maxHeight';
    const maxMain = resolveOptionalBound(
      normalized[maximumProperty],
      mainReference,
      maximumProperty,
      Number.POSITIVE_INFINITY,
      child,
      container,
    );
    if (automaticTextMinimum) {
      if (region) recordWasmMeasurement();
      const contentMinimum = measureLayoutTextMinimumWidth(child.props, {
        font: normalized.font as string ?? '13px sans-serif',
        service: measurement.service,
        receiverToken,
      });
      minMain = Math.min(contentMinimum, maxMain,
        typeof specifiedMain === 'number' ? specifiedMain : Number.POSITIVE_INFINITY);
    }
    const minCrossProperty = row ? 'minHeight' : 'minWidth';
    const maxCrossProperty = row ? 'maxHeight' : 'maxWidth';
    const minCross = resolveOptionalBound(
      normalized[minCrossProperty],
      crossReference,
      minCrossProperty,
      0,
      child,
      container,
    );
    const maxCross = resolveOptionalBound(
      normalized[maxCrossProperty],
      crossReference,
      maxCrossProperty,
      Number.POSITIVE_INFINITY,
      child,
      container,
    );
    if (minMain > maxMain) {
      throw childDiagnostic(
        child,
        minimumProperty,
        minMain,
        container,
        'minimum must not exceed maximum',
      );
    }
    if (minCross > maxCross) {
      throw childDiagnostic(
        child,
        minCrossProperty,
        minCross,
        container,
        'minimum must not exceed maximum',
      );
    }
    // Settle width-dependent height before using an automatic main basis.
    // The experimental built-in intrinsic column uses the same final-width rule.
    if (!row && options.flexWrap === 'nowrap' && (child.type === Text || experimentalLayout && knownIntrinsicLayout) && needsMeasuredMain) {
      const preferredWidth = crossAuto ?
        effectiveAlignment(alignment, options.alignItems) === 'stretch' ?
          Math.max(0, crossSize - paddingCross - marginCrossBefore - marginCrossAfter) : measured?.width ?? 0 :
        resolveItemLength(specifiedCross, crossReference, crossProperty, child, container);
      const usedWidth = clamp(preferredWidth, minCross, maxCross);
      if (child.type === Text || usedWidth !== measured?.width) {
        const measuredStyle = { ...normalized, width: usedWidth };
        const measurementChild = clonePibblElement(layoutChild);
        setPreNormalizedStyle(measurementChild, measuredStyle, layoutChild, getPrimitiveReceiverToken(layoutChild) ?? receiverToken, preparedStyleQuery(prepared));
        const result = measureFlexChild(measurementChild, {
          minWidth: 0, maxWidth: usedWidth,
          minHeight: 0, maxHeight: container.height,
        }, measuredStyle, layoutToken ?? receiverToken, measurement, region, preparedStyleQuery(prepared));
        if (result.status === 'measured') measured = result.size;
        else throw childDiagnostic(child, mainProperty, 'auto', container,
          `measurement is required but unsupported: ${result.reason}`);
      }
    }

    let naturalTextMain: number | undefined;
    if (automaticTextBasis) {
      const content = prepareLayoutTextContent(child.props, { receiverToken });
      const font = normalized.font as string ?? '13px sans-serif';
      const token = layoutToken ?? receiverToken;
      naturalTextMain = region?.readTextMaximum(token, content, font);
      if (naturalTextMain === undefined) {
        if (region) recordWasmMeasurement();
        naturalTextMain = measureLayoutTextNaturalRun(content, { font, service: measurement.service });
        region?.writeTextMaximum(token, content, font, naturalTextMain);
      }
    }
    const baseMain = naturalTextMain ?? resolveBasis(
      basisValue,
      specifiedMain,
      measured?.[mainProperty],
      mainReference,
      mainProperty,
      child,
      container,
    );
    const preferredCross = aspectRatio !== undefined ? 0 : crossAuto ?
      measured?.[crossProperty] ?? 0 :
      resolveItemLength(
        specifiedCross,
        crossReference,
        crossProperty,
        child,
        container,
      );
    items.push({
      child,
      normalized,
      baseMain,
      targetMain: baseMain,
      paddingMain,
      marginMainBefore, marginMainAfter, marginCrossBefore, marginCrossAfter,
      preferredCross: clamp(preferredCross, minCross, maxCross) + paddingCross,
      paddingCross,
      minMain,
      maxMain,
      minCross,
      maxCross,
      grow,
      shrink,
      crossAuto: aspectRatio === undefined && crossAuto,
      aspectRatio,
      alignSelf: alignment,
      receiverToken,
      layoutToken,
      query: preparedStyleQuery(prepared),
    });
  }

  const wrappedRegion = region && options.flexWrap !== 'nowrap';
  // Rust owns wrapped line boundaries and offsets; JS retains source-order items
  // only for host measurement and immediate rendering, never a second line solver.
  const lines = region ? items.length ? [{ items, crossSize: 0, crossOffset: 0 }] : [] :
    collectLines(items, mainSize, mainGap, options.flexWrap);
  if (lines.length === 0) region?.solve([], mainSize, mainGap, !!wrappedRegion);
  for (const line of lines) {
    if (region) region.solve(line.items, mainSize, mainGap, !!wrappedRegion);
    else resolveFlexibleLengths(line, mainSize, mainGap);
    if (hasAspectRatio) for (const item of line.items) {
      if (item.aspectRatio === undefined) continue;
      const outerMain = item.targetMain + item.paddingMain;
      const outerCross = row ? outerMain / item.aspectRatio : outerMain * item.aspectRatio;
      if (!Number.isFinite(outerCross)) throw childDiagnostic(item.child, 'aspectRatio', item.aspectRatio, container, 'derived cross size must be finite');
      item.preferredCross = clamp(Math.max(0, outerCross - item.paddingCross), item.minCross, item.maxCross) + item.paddingCross;
    }
    // Text height depends on its used width, not its pre-flex basis.
    if (row) for (const item of line.items) {
      if (!item.crossAuto || (item.child.type !== Text && !(experimentalLayout && item.child.type === Flex))) continue;
      if (item.child.type === Flex && item.normalized.width === item.targetMain) continue;
      const measuredStyle = { ...item.normalized, width: item.targetMain };
      const child = clonePibblElement(item.child);
      setPreNormalizedStyle(child, measuredStyle, item.child, item.receiverToken, item.query);
      const result = measureFlexChild(child, {
        minWidth: 0, maxWidth: item.targetMain,
        minHeight: 0, maxHeight: container.height,
      }, measuredStyle, item.layoutToken ?? item.receiverToken, measurement, region, item.query);
      if (result.status === 'measured') {
        item.preferredCross = clamp(result.size.height, item.minCross, item.maxCross) + item.paddingCross;
      }
    }
  }
  if (region) {
    // Per-item wrapped line cross offsets are produced by the kernel below.
    for (const line of lines) { line.crossSize = crossSize; line.crossOffset = 0; }
  } else {
    resolveLineCrossSizes(lines, crossSize, crossGap, options.alignContent, options.flexWrap === 'wrap');
  }

  const crossPlacements = region?.placeCross(items, crossSize, options.alignItems, wrappedRegion ? { gap: crossGap, alignContent: options.alignContent, reverse: wrapReverse } : undefined);
  const mainPlacements = region?.placeMain(mainSize, mainGap, options.justifyContent, reverse);
  const placements: FlexPlacement[] = [];
  let mainIndex = 0;
  let crossIndex = 0;
  for (const line of lines) {
    const occupied = mainPlacements ? 0 : line.items.reduce(
      (total, item) => total + item.targetMain + item.paddingMain,
      Math.max(0, line.items.length - 1) * mainGap,
    );
    const distribution = mainPlacements ? { start: 0, between: 0 } : distributeAlignment(
      options.justifyContent,
      mainSize - occupied,
      line.items.length,
    );
    let mainCursor = distribution.start;
    for (const item of line.items) {
      if (mainPlacements) mainCursor = mainPlacements[mainIndex++];
      let outerCross: number;
      let crossOffset: number;
      if (crossPlacements) {
        const placement = crossPlacements[crossIndex++];
        outerCross = placement.outerCross;
        crossOffset = placement.offset;
      } else {
        const alignment = effectiveAlignment(item.alignSelf, options.alignItems);
        outerCross = item.preferredCross;
        if (alignment === 'stretch' && item.crossAuto) {
          outerCross = clamp(Math.max(0, line.crossSize - item.paddingCross), item.minCross, item.maxCross) + item.paddingCross;
        }
        crossOffset = alignmentOffset(alignment, line.crossSize, outerCross);
      }
      const outerMain = item.targetMain + item.paddingMain;
      const box = row ? {
        x: container.x + mainCursor,
        y: container.y + line.crossOffset + crossOffset,
        width: outerMain,
        height: outerCross,
      } : {
        x: container.x + line.crossOffset + crossOffset,
        y: container.y + mainCursor,
        width: outerCross,
        height: outerMain,
      };
      const usedStyle = {
        ...item.normalized,
        width: row ? item.targetMain : Math.max(0, outerCross - item.paddingCross),
        height: row ? Math.max(0, outerCross - item.paddingCross) : item.targetMain,
      };
      placements.push({
        usedWidth: usedStyle.width,
        usedHeight: usedStyle.height,
        box,
        element: childWithUsedSize(
          item.child,
          usedStyle,
          usedStyle.width,
          usedStyle.height,
          item.receiverToken,
          item.query,
        ),
      });
      mainCursor += outerMain + mainGap + distribution.between;
    }
  }
  return placements;
}


function genericTextFont(style: Readonly<Record<string, unknown>>): boolean {
  return /^(?:(?:bold|italic|normal) )?\d+(?:\.\d+)?px (?:sans-serif|serif|monospace)$/.test(String(style.font ?? '13px sans-serif'));
}
function measurementStyle(style: Readonly<Record<string, unknown>>) {
  const { fill: _fill, stroke: _stroke, opacity: _opacity, cursor: _cursor, filter: _filter, ...metrics } = style;
  // Rest construction owns this fresh snapshot; normalize geometry-equivalent axes.
  const owned = metrics as Record<string, unknown>;
  if (owned.flexDirection === 'row-reverse') owned.flexDirection = 'row';
  else if (owned.flexDirection === 'column-reverse') owned.flexDirection = 'column';
  return owned;
}

// Resolve every receiver even on cache hits so normal traversal adopts current
// subscriptions. Retain only scalar snapshots, never descriptors or provisions.
function intrinsicTextSnapshot(child: PibblElement<any>, style: Readonly<BoxStyle & Record<string, unknown>>, constraints: Constraints): unknown[] | undefined {
  if (child.type !== Flex || !isColumnDirection(style.flexDirection) || (style.flexWrap ?? 'nowrap') !== 'nowrap' ||
    typeof style.width !== 'number' || (style.height !== undefined && style.height !== 'auto')) return;
  return withSignalWriteForbidden('Signal writes are forbidden during Pibbl measurement', () => withIsolatedRenderState(() => {
    const previous = GLOBAL_STATE.primitiveReceiverToken;
    const visiting = new Set<PibblElement<any>>();
    function visit(column: PibblElement<any>, columnStyle: Readonly<Record<string, unknown>>, parent: object | undefined, width: number): unknown[] | undefined {
      if (visiting.has(column)) return;
      visiting.add(column);
      GLOBAL_STATE.primitiveReceiverToken = parent;
      try {
        const snapshot: unknown[] = [];
        for (const [index, leaf] of prepareLayoutChildren(column.props.children, 'Flex').entries()) {
          const receiver = getChildPrimitiveReceiverToken(GLOBAL_STATE.renderTransaction, parent, index);
          const prepared = prepareDirectChildStyle(leaf, receiver, { x: 0, y: 0, width, height: constraints.maxHeight });
          const leafStyle = preparedStyleValue(prepared) as Readonly<BoxStyle & Record<string, unknown>>;
          if (preparedStyleQuery(prepared) || hasPercentageBounds(leafStyle) || isPercentage(leafStyle.width) || isPercentage(leafStyle.height)) return;
          let content: unknown;
          if (leaf.type === Text) {
            if (!genericTextFont(leafStyle)) return;
            content = prepareLayoutTextContent(leaf.props, { receiverToken: receiver });
          } else if (leaf.type === Flex && isColumnDirection(leafStyle.flexDirection) && (leafStyle.flexWrap ?? 'nowrap') === 'nowrap' && (leafStyle.height === undefined || leafStyle.height === 'auto')) {
            const padding = normalizeBoxInsets(leafStyle, childContext(leaf, { x: 0, y: 0, width, height: constraints.maxHeight }));
            const available = typeof leafStyle.width === 'number' ? leafStyle.width : Math.max(0, width-padding.left-padding.right);
            const usedWidth = clamp(available, typeof leafStyle.minWidth === 'number' ? leafStyle.minWidth : 0, typeof leafStyle.maxWidth === 'number' ? leafStyle.maxWidth : Infinity);
            content = visit(leaf, leafStyle, receiver, usedWidth);
            if (content === undefined) return;
          } else {
            // Opaque components participate only by already-declared finite sizes.
            if (typeof leafStyle.width !== 'number' || typeof leafStyle.height !== 'number' || !Number.isFinite(leafStyle.width) || !Number.isFinite(leafStyle.height)) return;
            content = null;
          }
          snapshot.push([leaf.key, content, measurementStyle(leafStyle)]);
          GLOBAL_STATE.primitiveReceiverToken = parent;
        }
        return [measurementStyle(columnStyle), snapshot];
      } finally { visiting.delete(column); GLOBAL_STATE.primitiveReceiverToken = parent; }
    }
    try { return visit(child, style, getPrimitiveReceiverToken(child), style.width as number); }
    finally { GLOBAL_STATE.primitiveReceiverToken = previous; }
  }));
}

function measureFlexChild(
  child: PibblElement<any>, constraints: Constraints,
  style: Readonly<BoxStyle & Record<string, unknown>>, token: object,
  measurement: FlexMeasurementInput, region?: LayoutRegion, query?: PreparedQuery,
): MeasureResult {
  const content = region && child.type === Text ? prepareLayoutTextContent(
    child.props, { receiverToken: getPrimitiveReceiverToken(child) },
  ) : undefined;
  const intrinsic = region && !query ? intrinsicTextSnapshot(child, style, constraints) : undefined;
  const cacheable = !query && (content !== undefined && genericTextFont(style) || intrinsic !== undefined);
  const key = cacheable ? JSON.stringify([content, intrinsic, measurementStyle(style), constraints]) : undefined;
  const cached = key ? region!.readMeasurement(token, key) : undefined;
  if (cached) return { status: 'measured', size: cached };
  if (region) recordWasmMeasurement();
  const result = measurement.measureElement(child, constraints);
  if (key && result.status === 'measured') region!.writeMeasurement(token, key, result.size);
  return result;
}

function collectLines(
  items: readonly FlexItem[],
  mainSize: number,
  gap: number,
  wrap: FlexWrap,
): FlexLine[] {
  const lines: FlexLine[] = [];
  let current: FlexItem[] = [];
  let occupied = 0;
  for (const item of items) {
    const hypothetical = clamp(item.baseMain, item.minMain, item.maxMain) +
      item.paddingMain;
    const next = current.length === 0 ? hypothetical : occupied + gap + hypothetical;
    if (wrap === 'wrap' && current.length > 0 && next > mainSize) {
      lines.push({ items: current, crossSize: 0, crossOffset: 0 });
      current = [];
      occupied = 0;
    }
    occupied = current.length === 0 ? hypothetical : occupied + gap + hypothetical;
    current.push(item);
  }
  if (current.length > 0) {
    lines.push({ items: current, crossSize: 0, crossOffset: 0 });
  }
  return lines;
}

function resolveFlexibleLengths(
  line: FlexLine,
  mainSize: number,
  gap: number,
): void {
  const gapSpace = Math.max(0, line.items.length - 1) * gap;
  const hypotheticalOuter = line.items.reduce(
    (total, item) => total +
      clamp(item.baseMain, item.minMain, item.maxMain) + item.paddingMain,
    0,
  );
  const growing = hypotheticalOuter + gapSpace < mainSize;
  let initialOuter = gapSpace;
  const frozen = new Set<FlexItem>();
  for (const item of line.items) {
    item.targetMain = item.baseMain;
    const hypothetical = clamp(item.baseMain, item.minMain, item.maxMain);
    if (
      (growing ? item.grow : item.shrink) === 0 ||
      (growing && item.baseMain > hypothetical) ||
      (!growing && item.baseMain < hypothetical)
    ) {
      item.targetMain = hypothetical;
      frozen.add(item);
    }
    initialOuter += item.targetMain + item.paddingMain;
  }
  const initialFree = mainSize - initialOuter;
  if (!Number.isFinite(initialFree)) throw new Error('Flex numeric overflow during allocation');

  while (frozen.size < line.items.length) {
    const fixed = line.items.reduce(
      (total, item) => total +
        (frozen.has(item) ? item.targetMain : item.baseMain) +
        item.paddingMain,
      gapSpace,
    );
    let free = mainSize - fixed;
    const unfrozen = line.items.filter(item => !frozen.has(item));
    const rawFactor = growing ?
      unfrozen.reduce((total, item) => total + item.grow, 0) :
      unfrozen.reduce((total, item) => total + item.shrink, 0);
    const maxFactor = unfrozen.reduce((max, item) => Math.max(max, growing ? item.grow : item.shrink), 0);
    const maxBasis = growing ? 1 : unfrozen.reduce((max, item) => Math.max(max, item.baseMain), 0);
    const weight = (item: FlexItem) => maxFactor === 0 || maxBasis === 0 ? 0 :
      ((growing ? item.grow : item.shrink) / maxFactor) *
      (growing ? 1 : item.baseMain / maxBasis);
    const scaledFactor = unfrozen.reduce((total, item) => total + weight(item), 0);
    if (scaledFactor === 0) {
      for (const item of unfrozen) {
        item.targetMain = clamp(item.baseMain, item.minMain, item.maxMain);
        frozen.add(item);
      }
      break;
    }
    if (rawFactor < 1) {
      const partialFree = initialFree * rawFactor;
      if (Math.abs(partialFree) < Math.abs(free)) free = partialFree;
    }
    const violations: { item: FlexItem; amount: number }[] = [];
    for (const item of unfrozen) {
      const share = weight(item) / scaledFactor;
      const candidate = item.baseMain + free * share;
      if (!Number.isFinite(candidate)) throw new Error('Flex numeric overflow during allocation');
      const clamped = clamp(candidate, item.minMain, item.maxMain);
      item.targetMain = clamped;
      if (clamped !== candidate) {
        violations.push({ item, amount: clamped - candidate });
      }
    }
    if (violations.length === 0) break;
    const totalViolation = violations.reduce(
      (total, violation) => total + violation.amount,
      0,
    );
    for (const violation of violations) {
      if (
        totalViolation === 0 ||
        (totalViolation > 0 && violation.amount > 0) ||
        (totalViolation < 0 && violation.amount < 0)
      ) {
        frozen.add(violation.item);
      }
    }
  }
}

function resolveLineCrossSizes(
  lines: FlexLine[],
  crossSize: number,
  gap: number,
  alignment: ResolvedFlexStyle['alignContent'],
  multiLine: boolean,
): void {
  if (lines.length === 0) return;
  for (const line of lines) {
    line.crossSize = Math.max(0, ...line.items.map(item => item.preferredCross));
  }
  if (lines.length === 1 && !multiLine) {
    lines[0].crossSize = crossSize;
    lines[0].crossOffset = 0;
    return;
  }
  const occupied = lines.reduce(
    (total, line) => total + line.crossSize,
    Math.max(0, lines.length - 1) * gap,
  );
  const free = crossSize - occupied;
  if (alignment === 'stretch' && free > 0) {
    const addition = free / lines.length;
    for (const line of lines) line.crossSize += addition;
  }
  const distribution = alignment === 'stretch' ?
    { start: 0, between: 0 } :
    distributeAlignment(alignment, free, lines.length);
  let cursor = distribution.start;
  for (const line of lines) {
    line.crossOffset = cursor;
    cursor += line.crossSize + gap + distribution.between;
  }
}

function distributeAlignment(
  alignment: MainAlignment | CrossAlignment,
  free: number,
  count: number,
): { start: number; between: number } {
  if (count === 0 || alignment === 'flex-start' || alignment === 'stretch') {
    return { start: 0, between: 0 };
  }
  if (free < 0) {
    if (alignment === 'flex-end') return { start: free, between: 0 };
    if (alignment === 'center') {
      return { start: free / 2, between: 0 };
    }
    return { start: 0, between: 0 };
  }
  if (alignment === 'flex-end') return { start: free, between: 0 };
  if (alignment === 'center') return { start: free / 2, between: 0 };
  if (alignment === 'space-between') {
    return count === 1 ? { start: 0, between: 0 } :
      { start: 0, between: free / (count - 1) };
  }
  if (alignment === 'space-around') {
    const between = free / count;
    return { start: between / 2, between };
  }
  if (alignment === 'space-evenly') {
    const between = free / (count + 1);
    return { start: between, between };
  }
  return { start: 0, between: 0 };
}

function isRowDirection(direction: unknown): boolean {
  return direction === undefined || direction === 'row' || direction === 'row-reverse';
}
function isColumnDirection(direction: unknown): boolean {
  return direction === 'column' || direction === 'column-reverse';
}

function normalizeFlexOptions(
  style: Readonly<FlexStyle>,
  container: Readonly<LayoutBox>,
) {
  const flexDirection = style.flexDirection ?? 'row';
  if (flexDirection !== 'row' && flexDirection !== 'column' &&
      !(experimentalLayout && (flexDirection === 'row-reverse' || flexDirection === 'column-reverse'))) {
    throw optionDiagnostic('flexDirection', flexDirection, container, 'uses an unsupported flex direction in this build');
  }
  const flexWrap = style.flexWrap ?? 'nowrap';
  if (flexWrap !== 'nowrap' && flexWrap !== 'wrap' && !(experimentalLayout && flexWrap === 'wrap-reverse')) {
    throw optionDiagnostic('flexWrap', flexWrap, container, 'uses an unsupported flex wrap in this build');
  }
  const justifyContent = supported(
    normalizeLogicalAlignment(style.justifyContent ?? 'flex-start', flexDirection === 'row-reverse' || flexDirection === 'column-reverse'),
    ['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly'],
    'justifyContent',
    container,
  );
  const alignItems = supported(
    normalizeLogicalAlignment(style.alignItems ?? 'stretch', flexWrap === 'wrap-reverse'),
    ['stretch', 'flex-start', 'flex-end', 'center'],
    'alignItems',
    container,
  );
  const alignContent = supported(
    normalizeLogicalAlignment(style.alignContent ?? 'stretch', flexWrap === 'wrap-reverse'),
    ['stretch', 'flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly'],
    'alignContent',
    container,
  );
  const gap = style.gap ?? 0;
  const columnGap = nonnegativeGap(gap, 'gap', container, container.width);
  const rowGap = typeof gap === 'number' ? columnGap : nonnegativeGap(gap, 'gap', container, container.height);
  return {
    flexDirection: flexDirection as FlexDirection,
    flexWrap: flexWrap as FlexWrap,
    justifyContent: justifyContent as MainAlignment,
    alignItems: alignItems as CrossAlignment,
    alignContent: alignContent as CrossAlignment | MainAlignment,
    rowGap: style.rowGap === undefined ? rowGap : nonnegativeGap(style.rowGap, 'rowGap', container, container.height),
    columnGap: style.columnGap === undefined ? columnGap : nonnegativeGap(style.columnGap, 'columnGap', container, container.width),
  };
}

function supported(
  value: string,
  accepted: readonly string[],
  property: string,
  container: Readonly<LayoutBox>,
): string {
  if (!accepted.includes(value)) throw optionDiagnostic(property, value, container);
  return value;
}

function nonnegativeGap(
  value: unknown,
  property: string,
  container: Readonly<LayoutBox>,
  reference: number,
): number {
  const resolved = experimentalLayout && isPercentage(value)
    ? resolveLength(value as Percentage, reference, property, { component: 'Flex', algorithm: 'flex', constraints: constraintsFor(container) })
    : value;
  if (typeof resolved !== 'number' || !Number.isFinite(resolved) || resolved < 0) {
    throw optionDiagnostic(property, value, container);
  }
  return resolved;
}

function nonnegativeFactor(
  value: number,
  property: string,
  child: PibblElement<any>,
  container: Readonly<LayoutBox>,
): number {
  if (!Number.isFinite(value) || value < 0) {
    throw childDiagnostic(
      child,
      property,
      value,
      container,
      'must be finite and nonnegative',
    );
  }
  return value;
}

function resolveBasis(
  basis: FlexItemStyle['flexBasis'],
  specifiedMain: BoxStyle['width'],
  measuredMain: number | undefined,
  reference: number,
  property: 'width' | 'height',
  child: PibblElement<any>,
  container: Readonly<LayoutBox>,
): number {
  const value = basis === 'auto' || basis === undefined ? specifiedMain : basis;
  if (value === undefined || value === 'auto') {
    if (measuredMain === undefined) {
      throw childDiagnostic(
        child,
        property,
        value ?? 'auto',
        container,
        'auto flex basis requires supported pure measurement',
      );
    }
    return measuredMain;
  }
  return resolveItemLength(value, reference, 'flexBasis', child, container);
}

function resolveItemLength(
  value: Exclude<BoxStyle['width'], undefined>,
  reference: number,
  property: string,
  child: PibblElement<any>,
  container: Readonly<LayoutBox>,
): number {
  const resolved = resolveLength(value, reference, property, childContext(child, container));
  if (resolved === undefined || resolved < 0) {
    throw childDiagnostic(
      child,
      property,
      value,
      container,
      'must resolve to a finite nonnegative length',
    );
  }
  return resolved;
}

function resolveOptionalBound(
  value: BoxStyle['minWidth'],
  reference: number,
  property: string,
  fallback: number,
  child: PibblElement<any>,
  container: Readonly<LayoutBox>,
): number {
  if (value === undefined) return fallback;
  return resolveItemLength(value, reference, property, child, container);
}

function normalizeLogicalAlignment(value: string, reversed: boolean): string {
  if (value === 'start') return reversed ? 'flex-end' : 'flex-start';
  if (value === 'end') return reversed ? 'flex-start' : 'flex-end';
  return value;
}

function normalizeItemAlignment(
  value: LayoutItemStyle['alignSelf'],
  child: PibblElement<any>,
  container: Readonly<LayoutBox>,
  reverseCross = false,
): CrossAlignment | 'auto' {
  if (value === undefined || value === 'auto') return 'auto';
  if (value === 'start') return reverseCross ? 'flex-end' : 'flex-start';
  if (value === 'end') return reverseCross ? 'flex-start' : 'flex-end';
  if (value === 'stretch' || value === 'flex-start' ||
    value === 'flex-end' || value === 'center') return value;
  throw childDiagnostic(
    child,
    'alignSelf',
    value,
    container,
    'uses an unsupported flex item alignment',
  );
}

function effectiveAlignment(
  value: CrossAlignment | 'auto',
  fallback: CrossAlignment,
): CrossAlignment {
  return value === 'auto' ? fallback : value;
}

function alignmentOffset(
  alignment: CrossAlignment,
  lineSize: number,
  itemSize: number,
): number {
  if (alignment === 'center') return (lineSize - itemSize) / 2;
  if (alignment === 'flex-end') return lineSize - itemSize;
  return 0;
}

function rejectUnsupportedItemFields(
  child: PibblElement<any>,
  style: Readonly<Record<string, unknown>>,
  container: Readonly<LayoutBox>,
): void {
  if (!experimentalLayout && hasPhysicalMargin(style)) throw childDiagnostic(child, 'margin', style.margin, container, 'physical margins require the experimental Flex engine');
  for (let propertyIndex = 0; propertyIndex < unsupportedProperties.length; propertyIndex++) {
    const property = unsupportedProperties[propertyIndex];
    if (style[property] !== undefined) {
      throw childDiagnostic(
        child,
        property,
        style[property],
        container,
        'uses an unsupported flex item feature',
      );
    }
  }
}

function hasPhysicalMargin(style: Readonly<Record<string, unknown>>): boolean {
  return style.margin !== undefined || style.marginTop !== undefined || style.marginRight !== undefined ||
    style.marginBottom !== undefined || style.marginLeft !== undefined;
}
function numericMargin(value: unknown, property: string, child: PibblElement<any>, container: Readonly<LayoutBox>): number {
  if (value === undefined) return 0;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw childDiagnostic(child, property, value, container, 'margin must be a finite number in logical Canvas units');
  return value;
}

function hasEmptyRectangleMinimum(
  child: PibblElement<any>,
  style: Readonly<Record<string, unknown>>,
  query: PreparedQuery | undefined,
  percentageSizes = false,
): boolean {
  return experimentalLayout && child.type === Rectangle &&
    !Object.hasOwn(child.props, 'children') && !query &&
    (typeof style.width === 'number' && Number.isFinite(style.width) && style.width >= 0 || percentageSizes && isPercentage(style.width)) &&
    (typeof style.height === 'number' && Number.isFinite(style.height) && style.height >= 0 || percentageSizes && isPercentage(style.height));
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function assertFiniteBox(container: Readonly<LayoutBox>): void {
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
  reason = 'uses an unsupported flex value',
) {
  return layoutDiagnostic({
    component: 'Flex',
    property,
    value,
    algorithm: 'flex',
    constraints: constraintsFor(container),
    reason,
  });
}

function childDiagnostic(
  child: PibblElement<any>,
  property: string,
  value: unknown,
  container: Readonly<LayoutBox>,
  reason: string,
) {
  return layoutDiagnostic({
    component: child.type.name || 'Anonymous',
    property,
    value,
    algorithm: 'flex',
    constraints: constraintsFor(container),
    reason,
  });
}

function childContext(
  child: PibblElement<any>,
  container: Readonly<LayoutBox>,
) {
  return {
    component: child.type.name || 'Anonymous',
    algorithm: 'flex',
    constraints: constraintsFor(container),
  };
}

function constraintsFor(container: Readonly<LayoutBox>): Constraints {
  return {
    minWidth: 0,
    maxWidth: container.width,
    minHeight: 0,
    maxHeight: container.height,
  };
}
