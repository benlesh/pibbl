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
import { getChildPrimitiveReceiverToken, getPrimitiveReceiverToken, getPrimitiveDefinition, getElementMetadata, setElementMetadata } from '../element/metadata.js';
import type { PibblElement } from '../element/types.js';
import { GLOBAL_STATE } from '../global-state.js';
import { layoutDiagnostic } from '../style/diagnostics.js';
import {
  type PibblStructuralEventProps,
  wireStructuralEvents,
} from '../components/structural-events.js';
import { normalizeBoxInsets, hasPercentageBoxPadding, resolveAllocatedInsets } from './box-insets.js';
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
  resolveDirectChildBox,
} from './absolute.js';
import { getLayoutDirection, pushLayoutBox } from './context.js';
import { recordLayoutEvaluation } from './diagnostics.js';
import { assertSupportedChildPosition } from './positioning-diagnostics.js';
import { markDerivedAbsoluteAxes } from '../style/positioning.js';
import { measureElement, measureIntrinsicElement, measureConstrainedIntrinsicElement, withIsolatedRenderState } from './measure.js';
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
  /** Inherited inline direction. Roots default to LTR. See {@link Flex}. */
  layoutDirection?: 'ltr' | 'rtl';
  /** The main axis along which flex children are placed. See {@link FlexDirection}. */
  flexDirection?: FlexDirection;
  /** Whether children may wrap onto additional flex lines. See {@link FlexWrap}. */
  flexWrap?: FlexWrap;
  /** Distribution along the main axis. start/end follow layout direction independently of axis reversal. See {@link MainAlignment}. */
  justifyContent?: MainAlignment | 'start' | 'end';
  /** Cross alignment. start/end follow layout direction independently of wrap reversal. See {@link CrossAlignment}. */
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

// Parent input is private metadata, not a recursively validated resolved value.
const FLEX_ABSOLUTE_BOX_STYLE = Symbol('pibbl.flex-absolute-box-style');
const FLEX_INHERITED_CONTAINING_BOX = Symbol('pibbl.flex-inherited-containing-box');

interface ResolvedFlexStyle extends SystemStyle {
  layoutDirection: 'ltr' | 'rtl';
  box: ResolvedBoxStyle;
  overflow: 'visible' | 'clip';
  flexDirection: FlexDirection;
  flexWrap: FlexWrap;
  justifyContent: MainAlignment;
  alignItems: CrossAlignment;
  alignContent: CrossAlignment | MainAlignment;
  rowGap: number;
  columnGap: number;
  /** Original container input retained for lazy absolute padding-box derivation. */
  [FLEX_ABSOLUTE_BOX_STYLE]: Readonly<FlexStyle>;
  [FLEX_INHERITED_CONTAINING_BOX]?: Readonly<LayoutBox>;
}

interface FlexItem {
  child: PibblElement<any>;
  normalized: Readonly<BoxStyle & FlexItemStyle & LayoutItemStyle>;
  baseMain: number;
  targetMain: number;
  paddingMain: number;
  marginMainBefore: number;
  marginMainAfter: number;
  autoMainBefore: boolean;
  autoMainAfter: boolean;
  marginCrossBefore: number;
  marginCrossAfter: number;
  autoCrossBefore: boolean;
  autoCrossAfter: boolean;
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
  relativeX: number;
  relativeY: number;
  sourceIndex: number;
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
  const releaseLayout = pushLayoutBox(localContent, style);
  GLOBAL_STATE.componentRefs!.onAfterRender = releaseLayout;
  const service = flexMeasurementService(ctx);
  const prepared = experimentalLayout ? claimPreparedFlexPlan(GLOBAL_STATE.componentRefs!.element, localContent) : undefined;
  const region = experimentalLayout ? mountedLayoutRegion() : undefined;
  const plan = prepared ?? prepareFlexAllocation(props, style, localContent, service, region);
  if (experimentalLayout && !prepared) prepareFlexDescendants(plan, style);
  const { children, placements, revision } = plan;
  if (!plan.cached) {
    const transaction = GLOBAL_STATE.renderTransaction;
    if (region && transaction && !style[FLEX_INHERITED_CONTAINING_BOX] && frozenFlexInputs(props.children)) {
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
  const cached = style[FLEX_INHERITED_CONTAINING_BOX] ? undefined : region?.allocationCache?.read(props.children, revision, localContent, style);
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
    return {
      box,
      [FLEX_ABSOLUTE_BOX_STYLE]: style,
      [FLEX_INHERITED_CONTAINING_BOX]: experimentalLayout ? getElementMetadata(GLOBAL_STATE.componentRefs!.element)?.absoluteContainingBlock : undefined,
      overflow: style.overflow ?? 'visible',
      ...normalizeFlexOptions(style, box.contentBox),
    };
  },
  measure: input => measureFlex(input),
});

// A known Absolute sibling boundary resolves these receiver inputs before any
// sibling's opaque component executes. Geometry still solves in normal traversal.
if (experimentalLayout) registerKnownLayoutPreflight(Flex, (element, style, content, receiver, slot) => {
  const options = normalizeFlexOptions(style as Readonly<FlexStyle>, content);
  const releaseLayout = pushLayoutBox(content, options);
  const previous = GLOBAL_STATE.primitiveReceiverToken;
  GLOBAL_STATE.primitiveReceiverToken = receiver;
  try {
    const children = prepareLayoutChildren(element.props.children, 'Flex');
    for (let index = 0; index < children.length; index++) {
      const child = children[index];
      const token = getChildPrimitiveReceiverToken(GLOBAL_STATE.renderTransaction, receiver, index);
      let prepared = prepareDirectChildStyle(child, token, content, true);
      const specified = preparedStyleValue(prepared) as Readonly<BoxStyle & FlexItemStyle & LayoutItemStyle & Record<string, unknown>>;
      const normalized = resolveAllocatedInsets(specified, { width: content.width, layoutDirection: options.layoutDirection, context: childContext(child, content) });
      if (normalized !== specified) {
        if (prepared instanceof ResponsiveStylePreparation) prepared.style = normalized;
        else prepared = normalized;
      }
      assertSupportedChildPosition('Flex', child, normalized, true);
      rejectUnsupportedItemFields(child, normalized, content);
      nonnegativeFactor(normalized.flexGrow ?? 0, 'flexGrow', child, content);
      nonnegativeFactor(normalized.flexShrink ?? 1, 'flexShrink', child, content);
      stagePreparedChildStyle(child, token, content, prepared);
    }
    const ctx = GLOBAL_STATE.renderContext;
    if (!ctx) throw new Error('Known layout preparation requires a Canvas measurement context.');
    const region = slot.acquire();
    const resolved = {
      box: { contentBox: content },
      [FLEX_ABSOLUTE_BOX_STYLE]: style as Readonly<FlexStyle>,
      [FLEX_INHERITED_CONTAINING_BOX]: getElementMetadata(element)?.absoluteContainingBlock,
      overflow: (style as Readonly<FlexStyle>).overflow ?? 'visible',
      ...normalizeFlexOptions(style as Readonly<FlexStyle>, content),
    } as Readonly<ResolvedFlexStyle>;
    const plan = prepareFlexAllocation(element.props as FlexProps, resolved, content, flexMeasurementService(ctx), region);
    prepareFlexDescendants(plan, resolved, slot);
    stagePreparedLayoutPlan(slot, { ...plan, region });
  } finally { GLOBAL_STATE.primitiveReceiverToken = previous; releaseLayout(); }
});

/** Known descendants prepare only after this boundary's own allocation settles. */
function prepareFlexDescendants(plan: Pick<PreparedFlexLayoutPlan, 'children' | 'placements' | 'content'>, style: Readonly<ResolvedFlexStyle>, parentSlot?: PreparedLayoutSlot): void {
  let containingBox: Readonly<LayoutBox> | undefined;
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
      let preparationChild = child;
      // Declarative static Flex boxes pass the nearest owner's padding box through
      // existing placement metadata. Nothing is attached to authored props/styles.
      if (child.type === Flex && (prepared.style as FlexStyle).position === 'static') {
        const childStyle = prepared.style as FlexStyle;
        const nonRowChain = style.flexDirection !== 'row' || (childStyle.flexDirection ?? 'row') !== 'row';
        if (style.flexWrap !== 'nowrap' || (childStyle.flexWrap ?? 'nowrap') !== 'nowrap' ||
            nonRowChain && !isFixedNowrapFlexContainingChild(childStyle)) {
          throw childDiagnostic(child, 'position', 'static', plan.content,
            'PIBBL_LAYOUT_UNSUPPORTED_POSITION: non-row static containing-block inheritance requires a fixed numeric direct nowrap Flex chain');
        }
        containingBox ??= resolveFlexContainingBox(style, plan.content);
        const insets = normalizeBoxInsets(prepared.style as FlexStyle, childContext(child, plan.content));
        const x = finiteRelativePlacement(containingBox.x - placement.box.x - insets.left, 'left', child, plan.content);
        const y = finiteRelativePlacement(containingBox.y - placement.box.y - insets.top, 'top', child, plan.content);
        setElementMetadata(placement.element, {
          ...getElementMetadata(placement.element),
          layoutDescriptionSource: getElementMetadata(child)?.layoutDescriptionSource ?? child,
          absoluteContainingBlock: Object.freeze({ x, y, width: containingBox.width, height: containingBox.height }),
        });
        preparationChild = placement.element;
      }
      const nested = preflightKnownLayout(preparationChild, prepared.style, { x: 0, y: 0, width: placement.usedWidth, height: placement.usedHeight }, receiver, occurrence, parentSlot);
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
  const wrappedIntrinsic = (input.style.flexWrap ?? 'nowrap') !== 'nowrap';
  if (wrappedIntrinsic && !experimentalLayout) return unsupportedIntrinsic('requires nowrap because wrapped intrinsic sizing is deferred');
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
  if (wrappedIntrinsic && !(experimentalLayout && options.flexDirection === 'row' && options.flexWrap === 'wrap' && options.layoutDirection === 'ltr' && typeof input.style.width === 'number' && !heightDefinite)) return unsupportedIntrinsic('wrapped intrinsic height requires a finite numeric row width, LTR wrap and automatic height');
  const wrapWidth = wrappedIntrinsic ? resolveMeasuredContainerLength(input.style.width!, input.constraints.maxWidth, 'width', input.constraints) : 0;
  const mainGap = row ? options.columnGap : options.rowGap;
  let lineMain = 0, lineCross = 0, lineItems = 0, wrappedHeight = 0;
  let intrinsicMain = 0;
  let intrinsicCross = 0;
  let count = 0;
  for (let sourceIndex = 0; sourceIndex < children.length; sourceIndex++) {
    const child = children[sourceIndex];
    const receiverToken = getChildPrimitiveReceiverToken(
      GLOBAL_STATE.renderTransaction,
      GLOBAL_STATE.primitiveReceiverToken,
      sourceIndex,
    );
    const prepared = prepareDirectChildStyle(child, receiverToken, diagnosticBox, true);
    let style = preparedStyleValue(prepared) as Readonly<
      BoxStyle & FlexItemStyle & LayoutItemStyle & Record<string, unknown>
    >;
    if (hasPercentageBoxPadding(style, options.layoutDirection)) return unsupportedIntrinsic('does not support percentage padding without an actual finite Flex allocation');
    // Absolute children have no flow contribution. This first slice does not
    // define an intrinsic containing-block cascade, so fail before a child can
    // be measured into the owner size.
    if (style.position === 'absolute') return unsupportedIntrinsic('does not support absolute children during intrinsic Flex measurement');
    if (experimentalLayout && (style.paddingStart !== undefined || style.paddingEnd !== undefined || style.borderStartWidth !== undefined || style.borderEndWidth !== undefined)) style = resolveAllocatedInsets(style, { width: diagnosticBox.width, layoutDirection: options.layoutDirection, context: childContext(child, diagnosticBox) });
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
    const marginDirection = layoutChild.type === Flex ? style.layoutDirection ?? options.layoutDirection : options.layoutDirection;
    const logicalLeft = marginDirection === 'rtl' ? style.marginEnd : style.marginStart;
    const logicalRight = marginDirection === 'rtl' ? style.marginStart : style.marginEnd;
    const leftValue = logicalLeft !== undefined ? logicalLeft : style.marginLeft === undefined ? style.margin : style.marginLeft;
    const rightValue = logicalRight !== undefined ? logicalRight : style.marginRight === undefined ? style.margin : style.marginRight;
    const topValue = style.marginTop === undefined ? style.margin : style.marginTop;
    const bottomValue = style.marginBottom === undefined ? style.margin : style.marginBottom;
    const hasLogicalMargin = style.marginStart !== undefined || style.marginEnd !== undefined;
    if ((!hasLogicalMargin && isPercentage(style.margin)) || isPercentage(topValue) || isPercentage(rightValue) || isPercentage(bottomValue) || isPercentage(leftValue)) return unsupportedIntrinsic('does not support percentage margins without an actual finite Flex allocation');
    // Physical-only paths retain their existing shorthand validation.
    if (!hasLogicalMargin) numericMargin(style.margin, 'margin', child, diagnosticBox);
    const marginTop = numericMargin(topValue, 'marginTop', child, diagnosticBox);
    const marginRight = numericMargin(rightValue, logicalRight !== undefined ? marginDirection === 'rtl' ? 'marginStart' : 'marginEnd' : 'marginRight', child, diagnosticBox);
    const marginBottom = numericMargin(bottomValue, 'marginBottom', child, diagnosticBox);
    const marginLeft = numericMargin(leftValue, logicalLeft !== undefined ? marginDirection === 'rtl' ? 'marginEnd' : 'marginStart' : 'marginLeft', child, diagnosticBox);
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
    if (wrappedIntrinsic && (!hasEmptyRectangleMinimum(child, style, preparedStyleQuery(prepared)) || shrink !== 0 || basis !== 'auto')) return unsupportedIntrinsic('wrapped intrinsic height requires direct empty numeric Rectangles with zero flexGrow/flexShrink and automatic basis');
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
    if (wrappedIntrinsic) {
      const outerMain = clamp(baseMain, minMain, maxMain) + paddingMain + marginLeft + marginRight;
      const crossExtent = clamp(baseCross, minCross, maxCross) + paddingCross + marginTop + marginBottom;
      const nextMain = lineMain + (lineItems > 0 ? mainGap : 0) + outerMain;
      if (!Number.isFinite(outerMain) || !Number.isFinite(crossExtent)) throw childDiagnostic(child, 'intrinsicLine', nextMain, diagnosticBox, 'wrapped intrinsic outer extents and line widths must remain finite');
      const outerCross = Math.max(0, crossExtent);
      if (lineItems > 0 && nextMain > wrapWidth) {
        wrappedHeight += lineCross + options.rowGap;
        if (!Number.isFinite(wrappedHeight)) throw childDiagnostic(child, 'intrinsicLine', wrappedHeight, diagnosticBox, 'wrapped intrinsic accumulated height must remain finite');
        lineCross = 0; lineItems = 0;
      }
      lineMain = lineItems > 0 ? nextMain : outerMain;
      if (!Number.isFinite(lineMain)) throw childDiagnostic(child, 'intrinsicLine', lineMain, diagnosticBox, 'wrapped intrinsic accumulated line width must remain finite');
      lineCross = Math.max(lineCross, outerCross);
      lineItems++;
    }
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
    ) : row ? wrappedIntrinsic ? wrappedHeight + lineCross : intrinsicCross : intrinsicMain,
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
    return resolveFlexPlacements(
      container,
      prepared,
      style,
      measurement,
      region,
    ).map(placement => placement.box);
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
  const authoredReverse = options.flexDirection === 'row-reverse' || options.flexDirection === 'column-reverse';
  const reverse = authoredReverse !== (row && options.layoutDirection === 'rtl');
  const authoredWrapReverse = options.flexWrap === 'wrap-reverse';
  const wrapReverse = authoredWrapReverse !== (!row && options.layoutDirection === 'rtl');
  const mainSize = row ? container.width : container.height;
  const crossSize = row ? container.height : container.width;
  const mainGap = row ? options.columnGap : options.rowGap;
  const crossGap = row ? options.rowGap : options.columnGap;
  const items: FlexItem[] = [];
  const placementsBySource: Array<FlexPlacement | undefined> = new Array(children.length);
  let hasAspectRatio = false;
  let hasAutoMainMargins = false;
  let absolutePaddingBox: Readonly<LayoutBox> | undefined;
  let absoluteMeasurementTokens: Set<object> | undefined;

  const occurrences = new Map<object, number>();
  for (let sourceIndex = 0; sourceIndex < children.length; sourceIndex++) {
    const child = children[sourceIndex];
    if (region) recordWasmAllocationItem();
    const receiverToken = getChildPrimitiveReceiverToken(
      GLOBAL_STATE.renderTransaction,
      GLOBAL_STATE.primitiveReceiverToken,
      sourceIndex,
    );
    const occurrence = occurrences.get(child.type) ?? 0;
    if (child.key === undefined) occurrences.set(child.type, occurrence + 1);
    const prepared = prepareDirectChildStyle(child, receiverToken, container, true);
    const declared = preparedStyleValue(prepared) as Readonly<
      BoxStyle & FlexItemStyle & LayoutItemStyle & Record<string, unknown>
    >;
    let normalized = declared;
    if (experimentalLayout) normalized = resolveAllocatedInsets(normalized, { width: container.width, layoutDirection: options.layoutDirection, context: childContext(child, container) });
    if (normalized.boxSizing !== undefined) normalized = contentBoxStyle(normalized, { width: container.width, height: container.height, mainAxis: row ? 'width' : 'height', context: childContext(child, container) });
    const aspectRatio = normalized.aspectRatio;
    if (aspectRatio !== undefined && (typeof aspectRatio !== 'number' || !Number.isFinite(aspectRatio) || aspectRatio <= 0)) {
      throw childDiagnostic(child, 'aspectRatio', aspectRatio, container, 'must be a positive finite outer width/height ratio');
    }
    assertSupportedChildPosition('Flex', child, normalized, true);
    rejectUnsupportedItemFields(child, normalized, container);
    if (normalized.position === 'absolute') {
      const definition = getPrimitiveDefinition(child.type);
      const hasPairedMeasurement = !!definition?.measureIntrinsic && !!definition.measure;
      const measurableText = child.type === Text &&
        (normalized.wrap === undefined || typeof normalized.wrap === 'boolean') &&
        (normalized.fit === undefined || normalized.fit === 'visible') &&
        (normalized.overflow === undefined || normalized.overflow === 'visible') && genericTextFont(normalized);
      const unwrappedText = measurableText && normalized.wrap !== true;
      const automaticWidth = normalized.width === undefined || normalized.width === 'auto';
      const automaticHeight = normalized.height === undefined || normalized.height === 'auto';
      const naturalBoth = unwrappedText && automaticWidth && automaticHeight && normalized.aspectRatio === undefined &&
        (normalized.left === undefined || normalized.right === undefined) &&
        (normalized.top === undefined || normalized.bottom === undefined);
      const naturalWidth = naturalBoth || automaticWidth &&
        typeof normalized.height === 'number' && Number.isFinite(normalized.height) &&
        normalized.aspectRatio === undefined && (normalized.left === undefined || normalized.right === undefined) &&
        (hasPairedMeasurement || unwrappedText);
      const naturalHeight = naturalBoth || automaticHeight &&
        typeof normalized.width === 'number' && Number.isFinite(normalized.width) &&
        normalized.aspectRatio === undefined && (normalized.top === undefined || normalized.bottom === undefined) &&
        (hasPairedMeasurement || measurableText);
      assertSupportedAbsoluteFlexPosition(child, normalized, container, preparedStyleQuery(prepared), naturalWidth, naturalHeight);
      const measurementToken = naturalWidth || naturalHeight ? region?.absoluteMeasurementIdentity(child.type,
        child.key === undefined ? `occurrence:${occurrence}` : `key:${typeof child.key}:${child.key}`) : undefined;
      if (measurementToken) (absoluteMeasurementTokens ??= new Set()).add(measurementToken);
      placementsBySource[sourceIndex] = resolveAbsoluteFlexPlacement(
        absolutePaddingBox ??= resolveFlexContainingBox(style, container),
        child,
        normalized,
        receiverToken,
        preparedStyleQuery(prepared),
        container,
        options,
        naturalWidth || naturalHeight ? measurement : undefined,
        region,
        measurementToken,
      );
      continue;
    }
    if (aspectRatio !== undefined) hasAspectRatio = true;
    const layoutChild = isLayoutComponent(child.type) ? prepareLayoutComponent(child, { receiverToken }) : child;
    const knownIntrinsicLayout = child.type === Flex || layoutChild.type === Flow || layoutChild.type === Grid || layoutChild.type === Flex &&
      isColumnDirection(normalized.flexDirection) && (normalized.flexWrap ?? 'nowrap') === 'nowrap';
    const layoutToken = region?.identity(child.type, child.key === undefined ? `occurrence:${occurrence}` : `key:${typeof child.key}:${child.key}`);
    let relativeX = 0;
    let relativeY = 0;
    const position = normalized.position;
    if (position !== undefined) {
      assertSupportedRelativeFlexPosition(child, normalized, options, container);
      const left = numericRelativeInset(normalized.left, 'left', child, container);
      const right = numericRelativeInset(normalized.right, 'right', child, container);
      const top = numericRelativeInset(normalized.top, 'top', child, container);
      const bottom = numericRelativeInset(normalized.bottom, 'bottom', child, container);
      if (position === 'relative') {
        if (options.layoutDirection === 'rtl') relativeX = right === undefined ? left ?? 0 : -right;
        else relativeX = left === undefined ? right === undefined ? 0 : -right : left;
        relativeY = top === undefined ? bottom === undefined ? 0 : -bottom : top;
      }
    }
    const allMargin = normalized.margin === 'auto' ? 'auto' : allocatedMargin(normalized.margin, 'margin', child, container);
    const marginDirection = layoutChild.type === Flex ? normalized.layoutDirection ?? options.layoutDirection : options.layoutDirection;
    const logicalLeft = marginDirection === 'rtl' ? normalized.marginEnd : normalized.marginStart;
    const logicalRight = marginDirection === 'rtl' ? normalized.marginStart : normalized.marginEnd;
    const marginLeftProperty = logicalLeft !== undefined ? marginDirection === 'rtl' ? 'marginEnd' : 'marginStart' : 'marginLeft';
    const marginRightProperty = logicalRight !== undefined ? marginDirection === 'rtl' ? 'marginStart' : 'marginEnd' : 'marginRight';
    const marginTopValue = normalized.marginTop === undefined ? allMargin : normalized.marginTop;
    const marginBottomValue = normalized.marginBottom === undefined ? allMargin : normalized.marginBottom;
    const marginRightValue = logicalRight !== undefined ? logicalRight : normalized.marginRight === undefined ? allMargin : normalized.marginRight;
    const marginLeftValue = logicalLeft !== undefined ? logicalLeft : normalized.marginLeft === undefined ? allMargin : normalized.marginLeft;
    const autoTop = marginTopValue === 'auto', autoRight = marginRightValue === 'auto';
    const autoBottom = marginBottomValue === 'auto', autoLeft = marginLeftValue === 'auto';
    const declaredCrossSize = row ? normalized.height : normalized.width;
    const hasAutoCrossMargin = row ? autoTop || autoBottom : autoLeft || autoRight;
    const measuredCrossContext = hasAutoCrossMargin && experimentalLayout && row && options.flexWrap === 'nowrap' &&
      (declaredCrossSize === undefined || declaredCrossSize === 'auto') &&
      !preparedStyleQuery(prepared) && aspectRatio === undefined;
    const measuredAutoCross = measuredCrossContext && typeof declared.width === 'number' &&
      typeof normalized.width === 'number' && Number.isFinite(normalized.width) && normalized.width >= 0;
    const automaticTextCrossWidth = measuredCrossContext && child.type === Text &&
      (normalized.width === undefined || normalized.width === 'auto') &&
      (normalized.flexBasis === undefined || normalized.flexBasis === 'auto') &&
      (normalized.flexGrow ?? 0) === 0 && typeof (normalized.flexShrink ?? 1) === 'number' && (normalized.flexShrink ?? 1) > 0 &&
      normalized.minWidth === undefined && normalized.maxWidth === undefined;
    const wrappedNumericTextCross = hasAutoCrossMargin && experimentalLayout && child.type === Text &&
      options.flexDirection === 'row' && options.flexWrap === 'wrap' && options.layoutDirection === 'ltr' &&
      (declaredCrossSize === undefined || declaredCrossSize === 'auto') &&
      typeof declared.width === 'number' && typeof normalized.width === 'number' && Number.isFinite(normalized.width) && normalized.width >= 0 &&
      (normalized.flexBasis ?? 'auto') === 'auto' && (normalized.flexGrow ?? 0) === 0 && normalized.flexShrink === 0 &&
      !preparedStyleQuery(prepared) && aspectRatio === undefined;
    const measuredTextCrossAuto = (measuredAutoCross || automaticTextCrossWidth || wrappedNumericTextCross) && child.type === Text && normalized.wrap === true &&
      (normalized.fit === undefined || normalized.fit === 'visible') &&
      (normalized.overflow === undefined || normalized.overflow === 'visible') && genericTextFont(normalized);
    const autoCrossDefinition = measuredAutoCross && !measuredTextCrossAuto ? getPrimitiveDefinition(child.type) : undefined;
    const measuredPrimitiveCrossAuto = !!autoCrossDefinition?.measureIntrinsic && !!autoCrossDefinition.measure;
    const measuredFlexCrossAuto = measuredAutoCross && child.type === Flex &&
      (normalized.flexDirection ?? 'row') === 'row' && normalized.flexWrap === 'wrap' &&
      (normalized.layoutDirection ?? options.layoutDirection) === 'ltr';
    if (hasAutoCrossMargin && !measuredTextCrossAuto && !measuredPrimitiveCrossAuto && !measuredFlexCrossAuto &&
        (typeof declaredCrossSize !== 'number' || !Number.isFinite(declaredCrossSize) || declaredCrossSize < 0 || aspectRatio !== undefined)) {
      throw childDiagnostic(child, row ? autoTop ? 'marginTop' : 'marginBottom' : autoLeft ? marginLeftProperty : marginRightProperty, 'auto', container, 'auto cross-axis margins require a finite numeric child cross size without aspect sizing');
    }
    const autoCrossBefore = row ? wrapReverse ? autoBottom : autoTop : wrapReverse ? autoRight : autoLeft;
    const autoCrossAfter = row ? wrapReverse ? autoTop : autoBottom : wrapReverse ? autoLeft : autoRight;
    const autoMainBefore = row ? reverse ? autoRight : autoLeft : reverse ? autoBottom : autoTop;
    const autoMainAfter = row ? reverse ? autoLeft : autoRight : reverse ? autoTop : autoBottom;
    if (autoMainBefore || autoMainAfter) hasAutoMainMargins = true;
    const marginTop = allocatedMargin(autoTop ? 0 : marginTopValue, 'marginTop', child, container);
    const marginRight = allocatedMargin(autoRight ? 0 : marginRightValue, marginRightProperty, child, container);
    const marginBottom = allocatedMargin(autoBottom ? 0 : marginBottomValue, 'marginBottom', child, container);
    const marginLeft = allocatedMargin(autoLeft ? 0 : marginLeftValue, marginLeftProperty, child, container);
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
    const customIntrinsic = experimentalLayout && row && options.flexWrap === 'nowrap' &&
      !preparedStyleQuery(prepared) && !!getPrimitiveDefinition(child.type)?.measureIntrinsic &&
      (basisValue === 'auto' && (normalized.width === undefined || normalized.width === 'auto') || shrink > 0 && normalized.minWidth === undefined);
    let intrinsicSizes: Extract<import('../types.js').IntrinsicSizesResult, { status: 'measured' }> | undefined;
    if (customIntrinsic) {
      const measurementChild = clonePibblElement(child);
      setPreNormalizedStyle(measurementChild, normalized, child, receiverToken);
      const result = measureIntrinsicElement(measurementChild, { minWidth: 0, maxWidth: container.width, minHeight: 0, maxHeight: container.height }, measurement.service, region ? { cache: region, token: layoutToken ?? receiverToken, recordMeasurement: recordWasmMeasurement, key: JSON.stringify([allocationInputRevision(), measurementStyle(normalized), container.width, container.height]) } : undefined);
      if (result.status === 'unsupported') throw childDiagnostic(child, 'measureIntrinsic', 'unsupported', container, `intrinsic measurement is required but unsupported: ${result.reason}; supply a definite basis and explicit minWidth: 0 to avoid the query`);
      intrinsicSizes = result;
    }

    if ((shrink > 0 || basisValue === 'auto') && normalized[minimumProperty] === undefined && !automaticTextMinimum && !automaticTextBasis && !automaticRectangleMinimum && !intrinsicSizes) {
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
    const measuredColumnWrapText = experimentalLayout && !row && options.flexWrap !== 'nowrap' &&
      needsMeasuredMain && child.type === Text && aspectRatio === undefined &&
      typeof declared.width === 'number' && typeof normalized.width === 'number' &&
      Number.isFinite(normalized.width) && normalized.width >= 0 && declared.minHeight === 0 &&
      grow === 0 && shrink === 0 && normalized.wrap === true &&
      (normalized.fit === undefined || normalized.fit === 'visible') &&
      (normalized.overflow === undefined || normalized.overflow === 'visible') &&
      (normalized.minWidth === undefined || normalized.minWidth === 0) &&
      normalized.maxWidth === undefined && normalized.maxHeight === undefined &&
      !preparedStyleQuery(prepared) && genericTextFont(normalized);
    const measuredColumnProviderDefinition = experimentalLayout && !row && options.flexDirection === 'column' &&
      options.flexWrap === 'nowrap' && options.layoutDirection === 'ltr' && needsMeasuredMain &&
      aspectRatio === undefined && typeof declared.width === 'number' && typeof normalized.width === 'number' &&
      Number.isFinite(normalized.width) && normalized.width >= 0 && declared.minHeight === 0 &&
      grow === 0 && shrink === 0 && (normalized.minWidth === undefined || normalized.minWidth === 0) &&
      normalized.maxWidth === undefined && !preparedStyleQuery(prepared) ?
      getPrimitiveDefinition(child.type) : undefined;
    const measuredColumnProvider = !!measuredColumnProviderDefinition?.measureIntrinsic &&
      !!measuredColumnProviderDefinition.measure;
    const alignment = normalizeItemAlignment(normalized.alignSelf, child, container, authoredWrapReverse);
    if (experimentalLayout && !row && options.flexWrap !== 'nowrap' &&
      (needsMeasuredMain && !measuredColumnWrapText || aspectRatio === undefined && crossAuto && effectiveAlignment(alignment, options.alignItems) !== 'stretch')) {
      throw childDiagnostic(child, needsMeasuredMain ? mainProperty : crossProperty, 'auto', container,
        'Experimental WASM column wrap requires a declared height or flexBasis and a declared width or stretched automatic width; intrinsic item sizes are unsupported.');
    }
    const needsMeasuredCross = aspectRatio === undefined && crossAuto && alignment !== 'stretch' &&
      options.alignItems !== 'stretch';
    // A finite column cross allocation determines a stretched built-in child's
    // width without measuring its intrinsic height. Resolve bounds/padding first.
    const deferredIntrinsicColumn = aspectRatio === undefined && experimentalLayout && !row && knownIntrinsicLayout &&
      needsMeasuredMain && crossAuto && effectiveAlignment(alignment, options.alignItems) === 'stretch';
    if (intrinsicSizes) measured = intrinsicSizes.maxContent;
    if (!intrinsicSizes && !deferredIntrinsicColumn && (needsMeasuredMain || aspectRatio === undefined && (needsMeasuredCross || crossAuto))) {
      const constraints = {
        minWidth: measuredColumnWrapText || measuredColumnProvider ? normalized.width as number : 0,
        maxWidth: measuredColumnWrapText || measuredColumnProvider ? normalized.width as number : container.width,
        minHeight: 0,
        maxHeight: measuredColumnWrapText || measuredColumnProvider ? Number.POSITIVE_INFINITY : container.height,
      };
      const measurementChild = clonePibblElement(child);
      setPreNormalizedStyle(
        measurementChild,
        normalized,
        child,
        receiverToken,
        preparedStyleQuery(prepared),
      );
      const result = measureFlexChild(measurementChild, constraints, normalized, layoutToken ?? receiverToken, measurement, region, preparedStyleQuery(prepared), (experimentalLayout && row && options.flexWrap === 'nowrap') || measuredColumnProvider);
      if (result.status === 'measured') {
        measured = result.size;
      } else if (measuredFlexCrossAuto || needsMeasuredMain || (crossAuto && effectiveAlignment(
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
    if (intrinsicSizes && normalized.minWidth === undefined && shrink > 0) {
      minMain = Math.min(intrinsicSizes.minContent.width, maxMain,
        typeof specifiedMain === 'number' ? specifiedMain : Number.POSITIVE_INFINITY);
    }
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
      marginMainBefore, marginMainAfter, autoMainBefore, autoMainAfter, marginCrossBefore, marginCrossAfter, autoCrossBefore, autoCrossAfter,
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
      relativeX,
      relativeY,
      sourceIndex,
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
    // Width-dependent content uses the settled content allocation.
    if (row) for (const item of line.items) {
      const definition = experimentalLayout && options.flexWrap === 'nowrap' && !item.query && item.aspectRatio === undefined ? getPrimitiveDefinition(item.child.type) : undefined;
      const constrainedProvider = !!definition?.measureIntrinsic && !!definition.measure;
      if (!item.crossAuto || (item.child.type !== Text && !(experimentalLayout && item.child.type === Flex) && !constrainedProvider)) continue;
      if (item.child.type === Flex && item.normalized.width === item.targetMain) continue;
      const measuredStyle = { ...item.normalized, width: item.targetMain };
      const child = clonePibblElement(item.child);
      setPreNormalizedStyle(child, measuredStyle, item.child, item.receiverToken, item.query);
      const result = measureFlexChild(child, {
        minWidth: constrainedProvider ? item.targetMain : 0, maxWidth: item.targetMain,
        minHeight: 0, maxHeight: container.height,
      }, measuredStyle, item.layoutToken ?? item.receiverToken, measurement, region, item.query, constrainedProvider);
      if (result.status === 'measured') {
        item.preferredCross = clamp(result.size.height, item.minCross, item.maxCross) + item.paddingCross;
      } else if (constrainedProvider) throw childDiagnostic(item.child, 'height', 'auto', container, `final-width measurement is required but unsupported: ${result.reason}`);
    }
  }
  if (region) {
    // Per-item wrapped line cross offsets are produced by the kernel below.
    for (const line of lines) { line.crossSize = crossSize; line.crossOffset = 0; }
  } else {
    resolveLineCrossSizes(lines, crossSize, crossGap, options.alignContent, options.flexWrap === 'wrap');
  }

  const crossPlacements = region?.placeCross(items, crossSize, options.alignItems, { reverse: wrapReverse, wrap: wrappedRegion ? { gap: crossGap, alignContent: options.alignContent } : undefined });
  const mainPlacements = region?.placeMain(mainSize, mainGap, options.justifyContent, reverse, hasAutoMainMargins ? items : undefined);
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
      const x = row ?
        container.x + mainCursor + item.relativeX :
        container.x + line.crossOffset + crossOffset + item.relativeX;
      const y = row ?
        container.y + line.crossOffset + crossOffset + item.relativeY :
        container.y + mainCursor + item.relativeY;
      const box = {
        x: finiteRelativePlacement(x, 'left', item.child, container),
        y: finiteRelativePlacement(y, 'top', item.child, container),
        width: row ? outerMain : outerCross,
        height: row ? outerCross : outerMain,
      };
      const usedStyle = {
        ...item.normalized,
        width: row ? item.targetMain : Math.max(0, outerCross - item.paddingCross),
        height: row ? Math.max(0, outerCross - item.paddingCross) : item.targetMain,
      };
      placementsBySource[item.sourceIndex] = {
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
      };
      mainCursor += outerMain + mainGap + distribution.between;
    }
  }
  for (let sourceIndex = 0; sourceIndex < placementsBySource.length; sourceIndex++) {
    if (!placementsBySource[sourceIndex]) throw new Error('Flex placement did not resolve one direct child.');
  }
  region?.pruneAbsoluteMeasurements(absoluteMeasurementTokens);
  return placementsBySource as FlexPlacement[];
}

function resolveFlexContainingBox(style: Readonly<FlexStyle> | Readonly<ResolvedFlexStyle>, content: Readonly<LayoutBox>): Readonly<LayoutBox> {
  const resolved = style as Readonly<Partial<ResolvedFlexStyle>>;
  const inherited = resolved[FLEX_INHERITED_CONTAINING_BOX];
  if (inherited) return inherited;
  const specified = resolved[FLEX_ABSOLUTE_BOX_STYLE] ?? style as Readonly<FlexStyle>;
  if (specified.position === 'static') {
    throw new Error('PIBBL_LAYOUT_UNSUPPORTED_POSITION: static containing-block inheritance requires a direct declarative Flex chain; opaque or transformed ancestry is not supported.');
  }
  return resolveFlexAbsolutePaddingBox(specified, content);
}

function resolveFlexAbsolutePaddingBox(
  style: Readonly<FlexStyle>,
  content: Readonly<LayoutBox>,
): LayoutBox {
  const paddingOnly = normalizeBoxInsets({
    ...style,
    borderWidth: undefined,
    borderStartWidth: undefined,
    borderEndWidth: undefined,
  }, {
    component: 'Flex', algorithm: 'flex absolute', constraints: constraintsFor(content),
  });
  return Object.freeze({
    x: content.x - paddingOnly.left,
    y: content.y - paddingOnly.top,
    width: content.width + paddingOnly.left + paddingOnly.right,
    height: content.height + paddingOnly.top + paddingOnly.bottom,
  });
}

function resolveAbsoluteFlexPlacement(
  paddingBox: Readonly<LayoutBox>,
  child: PibblElement<any>,
  style: Readonly<BoxStyle & FlexItemStyle & LayoutItemStyle>,
  receiverToken: object,
  query: PreparedQuery | undefined,
  content: Readonly<LayoutBox>,
  options: Readonly<Pick<ResolvedFlexStyle, 'flexDirection' | 'flexWrap' | 'justifyContent' | 'alignItems' | 'layoutDirection'>>,
  measurement?: FlexMeasurementInput,
  region?: LayoutRegion,
  measurementToken?: object,
): FlexPlacement {
  const left = numericAbsoluteInset(style.left, 'left', child, paddingBox);
  const right = numericAbsoluteInset(style.right, 'right', child, paddingBox);
  const top = numericAbsoluteInset(style.top, 'top', child, paddingBox);
  const bottom = numericAbsoluteInset(style.bottom, 'bottom', child, paddingBox);
  const automaticWidth = style.width === undefined || style.width === 'auto';
  const automaticHeight = style.height === undefined || style.height === 'auto';
  let measuredWidth: number | undefined;
  let measuredHeight: number | undefined;
  if (measurement) {
    const measurementAxis = automaticWidth && automaticHeight ? 'both' : automaticWidth ? 'width' : 'height';
    const measuredChild = clonePibblElement(child);
    // Text's measure callback uses an omitted natural axis. Keep authored
    // automatic dimensions on the original descriptor for final settlement.
    const measuredStyle = child.type === Text ? measurementAxis === 'both' ?
      { ...style, width: undefined, height: undefined } : measurementAxis === 'width' ?
        { ...style, width: undefined } : { ...style, height: undefined } : style;
    setPreNormalizedStyle(measuredChild, measuredStyle, child, receiverToken, query);
    const fixedAxis = measurementAxis === 'both' ? 0 : measurementAxis === 'width' ? style.height as number : style.width as number;
    const result = measureConstrainedIntrinsicElement(measuredChild, measurementAxis === 'both' ? {
      minWidth: 0, maxWidth: Number.POSITIVE_INFINITY, minHeight: 0, maxHeight: Number.POSITIVE_INFINITY,
    } : measurementAxis === 'width' ? {
      minWidth: 0, maxWidth: Number.POSITIVE_INFINITY, minHeight: fixedAxis, maxHeight: fixedAxis,
    } : {
      minWidth: fixedAxis, maxWidth: fixedAxis, minHeight: 0, maxHeight: Number.POSITIVE_INFINITY,
    }, measurement.service, region && measurementToken ? {
      cache: region, token: measurementToken,
      key: measurementAxis === 'both' ? `absolute-size:both:${allocationInputRevision()}` :
        `absolute-size:${measurementAxis}:${allocationInputRevision()}:${fixedAxis}`,
      recordMeasurement: recordWasmMeasurement,
    } : undefined);
    if (result.status !== 'measured') {
      throw childDiagnostic(child, measurementAxis, 'auto', paddingBox, `absolute natural ${measurementAxis} requires supported pure measurement: ${result.reason}`);
    }
    if (measurementAxis !== 'height') measuredWidth = result.size.width;
    if (measurementAxis !== 'width') measuredHeight = result.size.height;
  }
  const settledStyle = automaticWidth || automaticHeight ? {
    ...style,
    width: automaticWidth ? measuredWidth ?? resolveAbsoluteAutoSize(left, right, paddingBox.width, 'width', child, paddingBox, style.aspectRatio === undefined ? undefined : (style.height as number) * style.aspectRatio) : style.width,
    height: automaticHeight ? measuredHeight ?? resolveAbsoluteAutoSize(top, bottom, paddingBox.height, 'height', child, paddingBox, style.aspectRatio === undefined ? undefined : (style.width as number) / style.aspectRatio) : style.height,
  } : style;
  if (automaticWidth || automaticHeight) markDerivedAbsoluteAxes(settledStyle, automaticWidth, automaticHeight);
  const resolved = resolveDirectChildBox(paddingBox, child, 'absolute', settledStyle);
  const width = resolved.borderBox.width;
  const height = resolved.borderBox.height;
  const row = isRowDirection(options.flexDirection);
  const mainReversed = (options.flexDirection === 'row-reverse' || options.flexDirection === 'column-reverse') !==
    (row && options.layoutDirection === 'rtl');
  const crossReversed = (options.flexWrap === 'wrap-reverse') !== (!row && options.layoutDirection === 'rtl');
  const x = left !== undefined || right !== undefined ?
    options.layoutDirection === 'rtl'
      ? right === undefined ? paddingBox.x + left! : paddingBox.x + paddingBox.width - right - width
      : left === undefined ? paddingBox.x + paddingBox.width - right! - width : paddingBox.x + left :
    row ? resolveAbsoluteMainAlignment(content, width, options.justifyContent, mainReversed, true) :
      resolveAbsoluteCrossAlignment(content, width, options.alignItems, crossReversed, false);
  const y = top !== undefined || bottom !== undefined ?
    top === undefined ? paddingBox.y + paddingBox.height - bottom! - height : paddingBox.y + top :
    row ? resolveAbsoluteCrossAlignment(content, height, options.alignItems, crossReversed, true) :
      resolveAbsoluteMainAlignment(content, height, options.justifyContent, mainReversed, false);
  const usedWidth = resolved.contentBox.width;
  const usedHeight = resolved.contentBox.height;
  return {
    box: { x: finiteRelativePlacement(x, 'left', child, paddingBox), y: finiteRelativePlacement(y, 'top', child, paddingBox), width, height },
    usedWidth,
    usedHeight,
    element: childWithUsedSize(child, settledStyle, usedWidth, usedHeight, receiverToken, query),
  };
}

function resolveAbsoluteAutoSize(
  start: number | undefined,
  end: number | undefined,
  available: number,
  property: 'width' | 'height',
  child: PibblElement<any>,
  container: Readonly<LayoutBox>,
  aspectSize?: number,
): number {
  if ((start === undefined || end === undefined) && aspectSize === undefined) {
    throw childDiagnostic(child, property, 'auto', container, 'PIBBL_LAYOUT_UNSUPPORTED_POSITION: automatic absolute size requires opposing physical insets or one definite aspect-ratio axis');
  }
  // Opposing insets win; otherwise use the declared opposite axis before bounds.
  const size = start !== undefined && end !== undefined ? available - start - end : aspectSize!;
  if (!Number.isFinite(size)) {
    throw childDiagnostic(child, property, size, container, 'derived absolute size must remain finite');
  }
  return Math.max(0, size);
}

function resolveAbsoluteMainAlignment(
  content: Readonly<LayoutBox>,
  size: number,
  justifyContent: MainAlignment,
  reversed: boolean,
  horizontal: boolean,
): number {
  let alignment: CrossAlignment = justifyContent === 'flex-end' ? 'flex-end' :
    justifyContent === 'flex-start' || justifyContent === 'space-between' ? 'flex-start' : 'center';
  if (reversed) {
    if (alignment === 'flex-start') alignment = 'flex-end';
    else if (alignment === 'flex-end') alignment = 'flex-start';
  }
  return horizontal ? content.x + alignmentOffset(alignment, content.width, size) :
    content.y + alignmentOffset(alignment, content.height, size);
}

function resolveAbsoluteCrossAlignment(
  content: Readonly<LayoutBox>,
  size: number,
  alignItems: CrossAlignment,
  reversed: boolean,
  vertical: boolean,
): number {
  let alignment: CrossAlignment = alignItems === 'stretch' ? 'flex-start' : alignItems;
  if (reversed) {
    if (alignment === 'flex-start') alignment = 'flex-end';
    else if (alignment === 'flex-end') alignment = 'flex-start';
  }
  return vertical ? content.y + alignmentOffset(alignment, content.height, size) :
    content.x + alignmentOffset(alignment, content.width, size);
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
  measurement: FlexMeasurementInput, region?: LayoutRegion, query?: PreparedQuery, constrainedProvider = false,
): MeasureResult {
  const definition = constrainedProvider && !query ? getPrimitiveDefinition(child.type) : undefined;
  if (definition?.measureIntrinsic && definition.measure) return measureConstrainedIntrinsicElement(child, constraints, measurement.service, region ? { cache: region, token, key: JSON.stringify([allocationInputRevision(), measurementStyle(style), constraints]), recordMeasurement: recordWasmMeasurement } : undefined);
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
  const layoutDirection = style.layoutDirection ?? getLayoutDirection();
  if (layoutDirection !== 'ltr' && !(experimentalLayout && layoutDirection === 'rtl')) {
    throw optionDiagnostic('layoutDirection', layoutDirection, container);
  }
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
    layoutDirection,
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


function finiteRelativePlacement(
  value: number,
  property: 'left' | 'top',
  child: PibblElement<any>,
  container: Readonly<LayoutBox>,
): number {
  if (!Number.isFinite(value)) {
    throw childDiagnostic(child, property, value, container, 'resolved relative placement arithmetic must remain finite');
  }
  return value;
}

function assertSupportedAbsoluteFlexPosition(
  child: PibblElement<any>,
  style: Readonly<BoxStyle & FlexItemStyle & LayoutItemStyle>,
  container: Readonly<LayoutBox>,
  query: PreparedQuery | undefined,
  naturalWidth = false,
  naturalHeight = false,
): void {
  if (isKnownLayoutType(child.type) || isLayoutComponent(child.type)) {
    throw childDiagnostic(child, 'position', style.position, container, 'PIBBL_LAYOUT_UNSUPPORTED_POSITION: absolute layout children and nested containing blocks are not supported in this slice');
  }
  if (!experimentalLayout) {
    throw childDiagnostic(child, 'position', style.position, container, 'PIBBL_LAYOUT_UNSUPPORTED_POSITION: absolute requires experimental Flex');
  }
  const automaticWidth = style.width === undefined || style.width === 'auto';
  const automaticHeight = style.height === undefined || style.height === 'auto';
  if ((!automaticWidth && (typeof style.width !== 'number' || !Number.isFinite(style.width) || style.width < 0)) ||
      (!automaticHeight && (typeof style.height !== 'number' || !Number.isFinite(style.height) || style.height < 0))) {
    throw childDiagnostic(child, 'position', style.position, container, 'PIBBL_LAYOUT_UNSUPPORTED_POSITION: absolute currently requires finite numeric dimensions or automatic dimensions with opposing physical insets');
  }
  if (style.aspectRatio !== undefined && automaticWidth === automaticHeight) {
    throw childDiagnostic(child, 'aspectRatio', style.aspectRatio, container, 'PIBBL_LAYOUT_UNSUPPORTED_POSITION: absolute aspectRatio currently requires exactly one automatic axis and one finite numeric axis');
  }
  if (style.aspectRatio === undefined && ((!naturalWidth && automaticWidth && (style.left === undefined || style.right === undefined)) ||
      (!naturalHeight && automaticHeight && (style.top === undefined || style.bottom === undefined)))) {
    throw childDiagnostic(child, 'position', style.position, container, 'PIBBL_LAYOUT_UNSUPPORTED_POSITION: automatic absolute size requires both physical insets on its axis');
  }
  if (style.alignSelf !== undefined) {
    throw childDiagnostic(child, 'alignSelf', style.alignSelf, container, 'PIBBL_LAYOUT_UNSUPPORTED_POSITION: absolute currently uses parent alignItems only');
  }
  validateAbsoluteBound(style.minWidth, 'minWidth', child, container);
  validateAbsoluteBound(style.maxWidth, 'maxWidth', child, container);
  validateAbsoluteBound(style.minHeight, 'minHeight', child, container);
  validateAbsoluteBound(style.maxHeight, 'maxHeight', child, container);
  if (query || style.flexBasis !== undefined && style.flexBasis !== 'auto' ||
      (style.flexGrow !== undefined && style.flexGrow !== 0) || (style.flexShrink !== undefined && style.flexShrink !== 0) ||
      style.boxSizing !== undefined || style.padding !== undefined || style.paddingStart !== undefined || style.paddingEnd !== undefined ||
      style.borderWidth !== undefined || style.borderStartWidth !== undefined || style.borderEndWidth !== undefined || hasFlexMargin(style)) {
    throw childDiagnostic(child, 'position', style.position, container, 'PIBBL_LAYOUT_UNSUPPORTED_POSITION: absolute excludes nonzero flex factors, margins, and child box decoration in this slice');
  }
}

function validateAbsoluteBound(
  value: unknown,
  property: 'minWidth' | 'maxWidth' | 'minHeight' | 'maxHeight',
  child: PibblElement<any>,
  container: Readonly<LayoutBox>,
): void {
  if (value === undefined) return;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw childDiagnostic(child, property, value, container, 'PIBBL_LAYOUT_UNSUPPORTED_POSITION: absolute size bounds currently require nonnegative finite numbers');
  }
}

function numericAbsoluteInset(
  value: unknown,
  property: 'left' | 'right' | 'top' | 'bottom',
  child: PibblElement<any>,
  container: Readonly<LayoutBox>,
): number | undefined {
  if (value === undefined) return;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw childDiagnostic(child, property, value, container, 'currently requires a finite numeric absolute inset');
  }
  return value;
}

function assertSupportedRelativeFlexPosition(
  child: PibblElement<any>,
  style: Readonly<BoxStyle & FlexItemStyle & LayoutItemStyle>,
  options: Readonly<Pick<ResolvedFlexStyle, 'flexDirection' | 'flexWrap' | 'layoutDirection'>>,
  container: Readonly<LayoutBox>,
): void {
  const position = style.position;
  if (!experimentalLayout || (position !== 'static' && position !== 'relative')) {
    throw childDiagnostic(child, 'position', position, container, 'PIBBL_LAYOUT_UNSUPPORTED_POSITION: uses an unsupported Flex placement mode');
  }
  if (options.flexWrap !== 'nowrap' && (isKnownLayoutType(child.type) || isLayoutComponent(child.type))) {
    throw childDiagnostic(child, 'position', position, container, 'PIBBL_LAYOUT_UNSUPPORTED_POSITION: positioned layout children require a finite nowrap Flex allocation');
  }
  const childStyle = style as Readonly<FlexStyle & FlexItemStyle>;
  const nonRowChain = options.flexDirection !== 'row' || child.type === Flex && (childStyle.flexDirection ?? 'row') !== 'row';
  if (nonRowChain && (isKnownLayoutType(child.type) || isLayoutComponent(child.type)) &&
      (child.type !== Flex || !isFixedNowrapFlexContainingChild(childStyle))) {
    throw childDiagnostic(child, 'position', position, container, 'PIBBL_LAYOUT_UNSUPPORTED_POSITION: non-row positioned layout children require a fixed numeric direct nowrap Flex chain');
  }
}

function isFixedNowrapFlexContainingChild(style: Readonly<FlexStyle & FlexItemStyle>): boolean {
  return (style.flexWrap ?? 'nowrap') === 'nowrap' &&
    typeof style.width === 'number' && Number.isFinite(style.width) && style.width >= 0 &&
    typeof style.height === 'number' && Number.isFinite(style.height) && style.height >= 0 &&
    (style.flexGrow ?? 0) === 0 && (style.flexShrink ?? 1) === 0 &&
    (style.flexBasis === undefined || style.flexBasis === 'auto');
}

function numericRelativeInset(
  value: unknown,
  property: 'left' | 'right' | 'top' | 'bottom',
  child: PibblElement<any>,
  container: Readonly<LayoutBox>,
): number | undefined {
  if (value === undefined) return;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw childDiagnostic(child, property, value, container, 'currently requires a finite numeric relative inset');
  }
  return value;
}

function rejectUnsupportedItemFields(
  child: PibblElement<any>,
  style: Readonly<Record<string, unknown>>,
  container: Readonly<LayoutBox>,
): void {
  if (!experimentalLayout && hasFlexMargin(style)) throw childDiagnostic(child, 'margin', style.margin, container, 'margins require the experimental Flex engine');
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

function hasFlexMargin(style: Readonly<Record<string, unknown>>): boolean {
  return style.margin !== undefined || style.marginTop !== undefined || style.marginRight !== undefined ||
    style.marginBottom !== undefined || style.marginLeft !== undefined ||
    style.marginStart !== undefined || style.marginEnd !== undefined;
}
function allocatedMargin(value: unknown, property: string, child: PibblElement<any>, container: Readonly<LayoutBox>): number {
  if (experimentalLayout && isPercentage(value)) {
    return resolveLength(value as Percentage, container.width, property, childContext(child, container))!;
  }
  return numericMargin(value, property, child, container);
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
