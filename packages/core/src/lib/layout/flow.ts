import { defineComp } from '../define-comp.js';
import { definePrimitive } from '../define-primitive.js';
import { cloneCRCElement } from '../element/create-element.js';
import { getChildPrimitiveReceiverToken } from '../element/metadata.js';
import type { CRCElement } from '../element/types.js';
import { GLOBAL_STATE } from '../global-state.js';
import { layoutDiagnostic } from '../style/diagnostics.js';
import { normalizeEdges } from '../style/normalize.js';
import { setPreNormalizedStyle } from '../style/resolve-dispatch.js';
import type { BoxStyle, LayoutItemStyle, ResolvedBoxStyle } from '../style/types.js';
import type {
  CanvasMeasurementService,
  CRCNode,
  MeasureInput,
  MeasureResult,
  RenderingContext2D,
  SystemStyle,
} from '../types.js';
import {
  childWithUsedSize,
  materializeLayoutChildren,
  normalizeDirectChildStyle,
  placeDirectChildren,
  prepareLayoutChildren,
  resolveContainerBox,
  resolveDirectChildBox,
} from './absolute.js';
import { pushLayoutBox } from './context.js';
import { recordLayoutEvaluation } from './diagnostics.js';
import { measureElement } from './measure.js';
import type { Constraints, LayoutBox } from './types.js';

type FlowDirection = 'horizontal' | 'vertical';
type FlowAlignment = 'start' | 'center' | 'end' | 'stretch';

export interface FlowStyle extends BoxStyle, LayoutItemStyle {
  direction?: FlowDirection;
  wrap?: boolean;
  gap?: number;
  lineGap?: number;
  alignItems?: FlowAlignment;
}

export interface FlowProps {
  children: CRCNode;
}

interface ResolvedFlowStyle extends SystemStyle {
  box: ResolvedBoxStyle;
  overflow: 'visible' | 'clip';
  direction: FlowDirection;
  wrap: boolean;
  gap: number;
  lineGap: number;
  alignItems: FlowAlignment;
}

interface FlowItem {
  child: CRCElement<any>;
  normalized: Readonly<SystemStyle>;
  width: number;
  height: number;
  horizontalPadding: number;
  verticalPadding: number;
  alignment: FlowAlignment;
  receiverToken: object;
}

export interface FlowMeasurementInput {
  service: CanvasMeasurementService;
  measureElement(
    element: CRCElement<any>,
    constraints: Readonly<Constraints>,
  ): MeasureResult;
}

interface FlowPlacement {
  box: LayoutBox;
  element: CRCElement<any>;
}

function renderFlow(
  props: FlowProps,
  style: Readonly<ResolvedFlowStyle>,
  ctx: RenderingContext2D,
) {
  const children = prepareLayoutChildren(props.children, 'Flow');
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
  const placements = resolveFlowPlacements(
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

/** Describes sequential flow layout for JSX or createElement authoring. */
export const Flow = definePrimitive<
  FlowProps,
  FlowStyle,
  FlowStyle,
  ResolvedFlowStyle
>(renderFlow, {
  resolveStyle: (style, context) => ({
    box: resolveContainerBox(style, context, 'Flow', 'flow'),
    overflow: style.overflow ?? 'visible',
    ...normalizeFlowOptions(style, context.allocation),
  }),
  measure: input => measureFlow(input),
});

const renderLegacyFlow = function Flow(
  props: FlowProps,
  style: Readonly<ResolvedFlowStyle>,
  ctx: RenderingContext2D,
) {
  return renderFlow(props, style, ctx);
};

/** @internal Temporary lowercase authoring adapter retained until Task 12. */
export const flow = defineComp<
  FlowProps,
  FlowStyle,
  FlowStyle,
  ResolvedFlowStyle
>(renderLegacyFlow, {
  resolveStyle: (style, context) => ({
    box: resolveContainerBox(style, context, 'Flow', 'flow'),
    overflow: style.overflow ?? 'visible',
    ...normalizeFlowOptions(style, context.allocation),
  }),
  measure: input => measureFlow(input),
});

export function layoutFlow(
  container: Readonly<LayoutBox>,
  children: CRCNode,
  style: Readonly<FlowStyle>,
  measurement: FlowMeasurementInput,
): LayoutBox[] {
  const prepared = materializeLayoutChildren(children, 'Flow');
  return resolveFlowPlacements(container, prepared, style, measurement)
    .map(placement => placement.box);
}

function resolveFlowPlacements(
  container: Readonly<LayoutBox>,
  children: readonly CRCElement<any>[],
  style: Readonly<FlowStyle>,
  measurement: FlowMeasurementInput,
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
    const normalized = normalizeDirectChildStyle(child) as Readonly<
      BoxStyle & LayoutItemStyle
    >;
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
      const measurementChild = cloneCRCElement(child);
      setPreNormalizedStyle(
        measurementChild,
        normalized,
        child,
        receiverToken,
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
    });
  }

  const boxes = arrangeFlowItems(container, items, options);
  return boxes.map((box, index) => ({
    box,
    element: childWithUsedSize(
      items[index].child,
      items[index].normalized,
      Math.max(0, box.width - items[index].horizontalPadding),
      Math.max(0, box.height - items[index].verticalPadding),
      items[index].receiverToken,
    ),
  }));
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
  const padding = normalizeEdges(style.padding, 'padding', diagnosticContext);
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
  child: CRCElement<any>,
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
