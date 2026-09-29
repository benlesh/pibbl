import { preparedStyleValue, preparedStyleQuery, type PreparedQuery } from '../style/responsive.js';
import { definePrimitive } from '../define-primitive.js';
import { cloneCRCElement } from '../element/create-element.js';
import { getChildPrimitiveReceiverToken } from '../element/metadata.js';
import type { CRCElement } from '../element/types.js';
import { GLOBAL_STATE } from '../global-state.js';
import { layoutDiagnostic } from '../style/diagnostics.js';
import {
  type CRCStructuralEventProps,
  wireStructuralEvents,
} from '../components/structural-events.js';
import { normalizeEdges } from '../style/normalize.js';
import { resolveLength } from '../style/resolve-length.js';
import { setPreNormalizedStyle } from '../style/resolve-dispatch.js';
import type {
  BoxStyle,
  FlexItemStyle,
  LayoutItemStyle,
  ResolvedBoxStyle,
} from '../style/types.js';
import type {
  CanvasMeasurementService,
  CRCNodeInput,
  MeasureInput,
  MeasureResult,
  RenderingContext2D,
  SystemStyle,
} from '../types.js';
import {
  prepareDirectChildStyle,
  materializeLayoutChildren,
  placeDirectChildren,
  prepareLayoutChildren,
  resolveContainerBox,
} from './absolute.js';
import { pushLayoutBox } from './context.js';
import { recordLayoutEvaluation } from './diagnostics.js';
import { measureElement } from './measure.js';
import type { Constraints, LayoutBox } from './types.js';

type FlexDirection = 'row' | 'column';
type FlexWrap = 'nowrap' | 'wrap';
type MainAlignment =
  | 'flex-start'
  | 'flex-end'
  | 'center'
  | 'space-between'
  | 'space-around'
  | 'space-evenly';
type CrossAlignment = 'stretch' | 'flex-start' | 'flex-end' | 'center';

export interface FlexStyle extends BoxStyle, LayoutItemStyle {
  flexDirection?: FlexDirection;
  flexWrap?: FlexWrap;
  justifyContent?: MainAlignment;
  alignItems?: CrossAlignment;
  alignContent?: CrossAlignment | MainAlignment;
  gap?: number;
  rowGap?: number;
  columnGap?: number;
}

export interface FlexProps extends CRCStructuralEventProps {
  children: CRCNodeInput;
}

export interface FlexMeasurementInput {
  service: CanvasMeasurementService;
  measureElement(
    element: CRCElement<any>,
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
  child: CRCElement<any>;
  normalized: Readonly<BoxStyle & FlexItemStyle & LayoutItemStyle>;
  baseMain: number;
  targetMain: number;
  paddingMain: number;
  preferredCross: number;
  paddingCross: number;
  minMain: number;
  maxMain: number;
  minCross: number;
  maxCross: number;
  grow: number;
  shrink: number;
  crossAuto: boolean;
  alignSelf: CrossAlignment | 'auto';
  receiverToken: object;
  query?: PreparedQuery;
}

interface FlexLine {
  items: FlexItem[];
  crossSize: number;
  crossOffset: number;
}

interface FlexPlacement {
  box: LayoutBox;
  element: CRCElement<any>;
}

function renderFlex(
  props: FlexProps,
  style: Readonly<ResolvedFlexStyle>,
  ctx: RenderingContext2D,
) {
  wireStructuralEvents(props);
  const children = prepareLayoutChildren(props.children, 'Flex');
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
  const service = {
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
  const placements = resolveFlexPlacements(
    localContent,
    children,
    style,
    {
      service,
      measureElement: (element, constraints) =>
        measureElement(element, constraints, service),
    },
  );
  let index = 0;
  return placeDirectChildren(
    children,
    localContent,
    () => placements[index++],
    style.overflow,
  );
}

/** Describes the supported Flexbox subset for JSX or createElement authoring. */
export const Flex = definePrimitive<
  FlexProps,
  FlexStyle,
  FlexStyle,
  ResolvedFlexStyle
>(renderFlex, {
  childInput: 'structural',
  resolveStyle: (style, context) => ({
    box: resolveContainerBox(style, context, 'Flex', 'flex'),
    overflow: style.overflow ?? 'visible',
    ...normalizeFlexOptions(style, context.allocation),
  }),
  measure: input => measureFlex(input),
});

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
  const row = (input.style.flexDirection ?? 'row') === 'row';
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
    const prepared = prepareDirectChildStyle(child, receiverToken, diagnosticBox);
    const style = preparedStyleValue(prepared) as Readonly<
      BoxStyle & FlexItemStyle & LayoutItemStyle & Record<string, unknown>
    >;
    rejectUnsupportedItemFields(child, style, diagnosticBox);
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
    if ((shrink > 0 || basis === 'auto') && style[minimumProperty] === undefined) {
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
    if (mainValue === undefined || mainValue === 'auto') {
      return unsupportedIntrinsic('requires a definite child basis; measured auto basis is deferred');
    }
    if (crossValue === undefined || crossValue === 'auto') {
      return unsupportedIntrinsic('requires a definite child cross size');
    }
    const baseMain = intrinsicNumber(mainValue, 'flexBasis');
    const baseCross = intrinsicNumber(crossValue, crossProperty);
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
    const padding = normalizeEdges(
      style.padding,
      'padding',
      childContext(child, diagnosticBox),
    );
    const paddingMain = row ? padding.left + padding.right :
      padding.top + padding.bottom;
    const paddingCross = row ? padding.top + padding.bottom :
      padding.left + padding.right;
    intrinsicMain += clamp(baseMain, minMain, maxMain) + paddingMain;
    intrinsicCross = Math.max(
      intrinsicCross,
      clamp(baseCross, minCross, maxCross) + paddingCross,
    );
    count++;
  }
  intrinsicMain += Math.max(0, count - 1) * mainGap;
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
  return [
    style.minWidth,
    style.maxWidth,
    style.minHeight,
    style.maxHeight,
  ].some(isPercentage);
}

function unsupportedIntrinsic(reason: string): MeasureResult {
  return {
    status: 'unsupported',
    reason: `Flex intrinsic measurement ${reason}`,
  };
}

export function layoutFlex(
  container: Readonly<LayoutBox>,
  children: CRCNodeInput,
  style: Readonly<FlexStyle>,
  measurement: FlexMeasurementInput,
): LayoutBox[] {
  const prepared = materializeLayoutChildren(children, 'Flex');
  return resolveFlexPlacements(container, prepared, style, measurement)
    .map(placement => placement.box);
}

function resolveFlexPlacements(
  container: Readonly<LayoutBox>,
  children: readonly CRCElement<any>[],
  style: Readonly<FlexStyle>,
  measurement: FlexMeasurementInput,
): FlexPlacement[] {
  assertFiniteBox(container);
  const options = normalizeFlexOptions(style, container);
  const row = options.flexDirection === 'row';
  const mainSize = row ? container.width : container.height;
  const crossSize = row ? container.height : container.width;
  const mainGap = row ? options.columnGap : options.rowGap;
  const crossGap = row ? options.rowGap : options.columnGap;
  const items: FlexItem[] = [];

  for (const child of children) {
    const receiverToken = getChildPrimitiveReceiverToken(
      GLOBAL_STATE.renderTransaction,
      GLOBAL_STATE.primitiveReceiverToken,
      items.length,
    );
    const prepared = prepareDirectChildStyle(child, receiverToken, container);
    const normalized = preparedStyleValue(prepared) as Readonly<
      BoxStyle & FlexItemStyle & LayoutItemStyle & Record<string, unknown>
    >;
    rejectUnsupportedItemFields(child, normalized, container);
    const grow = nonnegativeFactor(normalized.flexGrow ?? 0, 'flexGrow', child, container);
    const shrink = nonnegativeFactor(
      normalized.flexShrink ?? 1,
      'flexShrink',
      child,
      container,
    );
    const basisValue = normalized.flexBasis ?? 'auto';
    const minimumProperty = row ? 'minWidth' : 'minHeight';
    if ((shrink > 0 || basisValue === 'auto') && normalized[minimumProperty] === undefined) {
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
    const crossAuto = specifiedCross === undefined || specifiedCross === 'auto';
    const alignment = normalizeItemAlignment(normalized.alignSelf, child, container);
    const needsMeasuredCross = crossAuto && alignment !== 'stretch' &&
      options.alignItems !== 'stretch';
    if (needsMeasuredMain || needsMeasuredCross || crossAuto) {
      const constraints = {
        minWidth: 0,
        maxWidth: container.width,
        minHeight: 0,
        maxHeight: container.height,
      };
      const measurementChild = cloneCRCElement(child);
      setPreNormalizedStyle(
        measurementChild,
        normalized,
        child,
        receiverToken,
        preparedStyleQuery(prepared),
      );
      const result = measurement.measureElement(measurementChild, constraints);
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

    const baseMain = resolveBasis(
      basisValue,
      specifiedMain,
      measured?.[mainProperty],
      mainReference,
      mainProperty,
      child,
      container,
    );
    const preferredCross = crossAuto ?
      measured?.[crossProperty] ?? 0 :
      resolveItemLength(
        specifiedCross,
        crossReference,
        crossProperty,
        child,
        container,
      );
    const padding = normalizeEdges(normalized.padding, 'padding', childContext(child, container));
    const paddingMain = row ? padding.left + padding.right : padding.top + padding.bottom;
    const paddingCross = row ? padding.top + padding.bottom : padding.left + padding.right;
    const minMain = resolveOptionalBound(
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
    items.push({
      child,
      normalized,
      baseMain,
      targetMain: baseMain,
      paddingMain,
      preferredCross: clamp(preferredCross, minCross, maxCross) + paddingCross,
      paddingCross,
      minMain,
      maxMain,
      minCross,
      maxCross,
      grow,
      shrink,
      crossAuto,
      alignSelf: alignment,
      receiverToken,
      query: preparedStyleQuery(prepared),
    });
  }

  const lines = collectLines(items, mainSize, mainGap, options.flexWrap);
  for (const line of lines) resolveFlexibleLengths(line, mainSize, mainGap);
  resolveLineCrossSizes(
    lines,
    crossSize,
    crossGap,
    options.alignContent,
    options.flexWrap === 'wrap',
  );

  const placements: FlexPlacement[] = [];
  for (const line of lines) {
    const occupied = line.items.reduce(
      (total, item) => total + item.targetMain + item.paddingMain,
      Math.max(0, line.items.length - 1) * mainGap,
    );
    const distribution = distributeAlignment(
      options.justifyContent,
      mainSize - occupied,
      line.items.length,
    );
    let mainCursor = distribution.start;
    for (const item of line.items) {
      const alignment = effectiveAlignment(item.alignSelf, options.alignItems);
      let outerCross = item.preferredCross;
      if (alignment === 'stretch' && item.crossAuto) {
        outerCross = clamp(
          Math.max(0, line.crossSize - item.paddingCross),
          item.minCross,
          item.maxCross,
        ) + item.paddingCross;
      }
      const crossOffset = alignmentOffset(
        alignment,
        line.crossSize,
        outerCross,
      );
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
      const renderedChild = cloneCRCElement(item.child);
      setPreNormalizedStyle(
        renderedChild,
        Object.freeze(usedStyle),
        item.child,
        item.receiverToken,
        item.query,
      );
      placements.push({ box, element: renderedChild });
      mainCursor += outerMain + mainGap + distribution.between;
    }
  }
  return placements;
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
  const baseOuter = line.items.reduce(
    (total, item) => total + item.baseMain + item.paddingMain,
    0,
  );
  const hypotheticalOuter = line.items.reduce(
    (total, item) => total +
      clamp(item.baseMain, item.minMain, item.maxMain) + item.paddingMain,
    0,
  );
  const growing = hypotheticalOuter + gapSpace < mainSize;
  const initialFree = mainSize - gapSpace - baseOuter;
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
  }

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
    const scaledFactor = growing ? rawFactor :
      unfrozen.reduce((total, item) => total + item.shrink * item.baseMain, 0);
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
      const share = growing ? item.grow / scaledFactor :
        item.shrink * item.baseMain / scaledFactor;
      const candidate = item.baseMain + free * share;
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
    if (alignment === 'center' || alignment === 'space-around' ||
      alignment === 'space-evenly') {
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

function normalizeFlexOptions(
  style: Readonly<FlexStyle>,
  container: Readonly<LayoutBox>,
) {
  const flexDirection = supported(style.flexDirection ?? 'row', ['row', 'column'], 'flexDirection', container);
  const flexWrap = supported(style.flexWrap ?? 'nowrap', ['nowrap', 'wrap'], 'flexWrap', container);
  const justifyContent = supported(
    style.justifyContent ?? 'flex-start',
    ['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly'],
    'justifyContent',
    container,
  );
  const alignItems = supported(
    style.alignItems ?? 'stretch',
    ['stretch', 'flex-start', 'flex-end', 'center'],
    'alignItems',
    container,
  );
  const alignContent = supported(
    style.alignContent ?? 'stretch',
    ['stretch', 'flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly'],
    'alignContent',
    container,
  );
  const gap = nonnegativeGap(style.gap ?? 0, 'gap', container);
  return {
    flexDirection: flexDirection as FlexDirection,
    flexWrap: flexWrap as FlexWrap,
    justifyContent: justifyContent as MainAlignment,
    alignItems: alignItems as CrossAlignment,
    alignContent: alignContent as CrossAlignment | MainAlignment,
    rowGap: nonnegativeGap(style.rowGap ?? gap, 'rowGap', container),
    columnGap: nonnegativeGap(style.columnGap ?? gap, 'columnGap', container),
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
): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw optionDiagnostic(property, value, container);
  }
  return value;
}

function nonnegativeFactor(
  value: number,
  property: string,
  child: CRCElement<any>,
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
  child: CRCElement<any>,
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
  child: CRCElement<any>,
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
  child: CRCElement<any>,
  container: Readonly<LayoutBox>,
): number {
  if (value === undefined) return fallback;
  return resolveItemLength(value, reference, property, child, container);
}

function normalizeItemAlignment(
  value: LayoutItemStyle['alignSelf'],
  child: CRCElement<any>,
  container: Readonly<LayoutBox>,
): CrossAlignment | 'auto' {
  if (value === undefined || value === 'auto') return 'auto';
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
  child: CRCElement<any>,
  style: Readonly<Record<string, unknown>>,
  container: Readonly<LayoutBox>,
): void {
  for (const property of ['order', 'margin', 'marginLeft', 'marginRight', 'marginTop', 'marginBottom']) {
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
) {
  return layoutDiagnostic({
    component: 'Flex',
    property,
    value,
    algorithm: 'flex',
    constraints: constraintsFor(container),
    reason: 'uses an unsupported flex value',
  });
}

function childDiagnostic(
  child: CRCElement<any>,
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
  child: CRCElement<any>,
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
