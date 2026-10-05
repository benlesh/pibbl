import { preparedStyleValue, preparedStyleQuery } from '../style/responsive.js';
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
  GridItemStyle,
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
  childWithUsedSize,
  prepareDirectChildStyle,
  materializeLayoutChildren,
  placeDirectChildren,
  prepareLayoutChildren,
  resolveContainerBox,
  resolveDirectChildBox,
} from './absolute.js';
import { pushLayoutBox } from './context.js';
import { recordLayoutEvaluation } from './diagnostics.js';
import { assertSupportedChildPosition } from './positioning-diagnostics.js';
import { measureElement } from './measure.js';
import type { Constraints, LayoutBox } from './types.js';

/**
 * A fixed logical size, percentage of available space, or fractional share of remaining grid space.
 *
 * @see {@link GridStyle}
 */
export type GridTrack = number | `${number}%` | `${number}fr`;
type GridAlignment = 'stretch' | 'start' | 'center' | 'end';
type ParsedGridTrack =
  | Readonly<{ kind: 'fixed'; value: number }>
  | Readonly<{ kind: 'percentage'; factor: number }>
  | Readonly<{ kind: 'fraction'; factor: number }>;

/**
 * Supported geometry and presentation properties for Grid.
 *
 * @see {@link BoxStyle}
 * @see {@link LayoutItemStyle}
 * @see {@link GridTrack}
 * @see {@link Grid}
 */
export interface GridStyle extends BoxStyle, LayoutItemStyle {
  /** Explicit grid column track definitions. See {@link GridTrack}. */
  gridTemplateColumns: readonly GridTrack[];
  /** Explicit grid row track definitions. See {@link GridTrack}. */
  gridTemplateRows: readonly GridTrack[];
  /** Default inline-axis alignment of grid or overlay children. See {@link GridAlignment}. */
  justifyItems?: GridAlignment;
  /** Default alignment of children on the cross or block axis. See {@link GridAlignment}. */
  alignItems?: GridAlignment;
  /** Spacing between adjacent items. See {@link GridStyle}. */
  gap?: number;
  /** Space between adjacent rows or items on the row axis. See {@link GridStyle}. */
  rowGap?: number;
  /** Space between adjacent columns or items on the column axis. See {@link GridStyle}. */
  columnGap?: number;
}

/**
 * Authored inputs for Grid, including the declared data and presentation options.
 *
 * @see {@link CRCNodeInput}
 * @see {@link Grid}
 */
export interface GridProps extends CRCStructuralEventProps {
  /** Descendant content or the callback that supplies it. See {@link CRCNodeInput}. */
  children: CRCNodeInput;
}

export interface GridMeasurementInput {
  service: CanvasMeasurementService;
  measureElement(
    element: CRCElement<any>,
    constraints: Readonly<Constraints>,
  ): MeasureResult;
}

interface ResolvedGridStyle extends SystemStyle {
  box: ResolvedBoxStyle;
  overflow: 'visible' | 'clip';
  columns: readonly ParsedGridTrack[];
  rows: readonly ParsedGridTrack[];
  justifyItems: GridAlignment;
  alignItems: GridAlignment;
  rowGap: number;
  columnGap: number;
}

interface GridPlacement {
  box: LayoutBox;
  element: CRCElement<any>;
}

function renderGrid(
  props: GridProps,
  style: Readonly<ResolvedGridStyle>,
  ctx: RenderingContext2D,
) {
  wireStructuralEvents(props);
  const children = prepareLayoutChildren(props.children, 'Grid');
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
  const placements = resolveGridPlacements(
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

/**
 * Describes explicit Grid layout for JSX or createElement authoring.
 *
 * @param props - Authored component inputs, supplied through JSX or createElement. See the linked
 * props and style types.
 * @throws When called directly; CRC mounts this component through JSX or createElement.
 *
 * @see {@link GridProps}
 * @see {@link GridStyle}
 */
export const Grid = definePrimitive<
  GridProps,
  GridStyle,
  GridStyle,
  ResolvedGridStyle
>(renderGrid, {
  childInput: 'structural',
  resolveStyle: (style, context) => ({
    box: resolveContainerBox(style, context, 'Grid', 'grid'),
    overflow: style.overflow ?? 'visible',
    ...normalizeGridOptions(style, context.allocation),
  }),
  measure: (input) => measureGrid(input),
});

export function layoutGrid(
  container: Readonly<LayoutBox>,
  children: CRCNodeInput,
  style: Readonly<GridStyle>,
  measurement: GridMeasurementInput,
): LayoutBox[] {
  const prepared = materializeLayoutChildren(children, 'Grid');
  const options = normalizeGridOptions(style, container);
  return resolveGridPlacements(container, prepared, options, measurement)
    .map((placement) => placement.box);
}

function resolveGridPlacements(
  container: Readonly<LayoutBox>,
  children: readonly CRCElement<any>[],
  options: Readonly<ReturnType<typeof normalizeGridOptions>>,
  measurement: GridMeasurementInput,
): GridPlacement[] {
  assertFiniteContainer(container);
  const columns = resolveParsedGridTracks(
    options.columns,
    container.width,
    options.columnGap,
    'columns',
    container,
  );
  const rows = resolveParsedGridTracks(
    options.rows,
    container.height,
    options.rowGap,
    'rows',
    container,
  );
  const placements: GridPlacement[] = [];

  for (const child of children) {
    const receiverToken = getChildPrimitiveReceiverToken(
      GLOBAL_STATE.renderTransaction,
      GLOBAL_STATE.primitiveReceiverToken,
      placements.length,
    );
    const prepared = prepareDirectChildStyle(child, receiverToken, container);
    const normalized = preparedStyleValue(prepared) as Readonly<
      BoxStyle & GridItemStyle & LayoutItemStyle & Record<string, unknown>
    >;
    assertSupportedChildPosition('Grid', child, normalized);
    rejectUnsupportedItemFields(child, normalized, container);
    const columnStart = placementInteger(
      normalized.gridColumnStart,
      'gridColumnStart',
      child,
      container,
      true,
    );
    const rowStart = placementInteger(
      normalized.gridRowStart,
      'gridRowStart',
      child,
      container,
      true,
    );
    const columnSpan = placementInteger(
      normalized.gridColumnSpan ?? 1,
      'gridColumnSpan',
      child,
      container,
      false,
    );
    const rowSpan = placementInteger(
      normalized.gridRowSpan ?? 1,
      'gridRowSpan',
      child,
      container,
      false,
    );
    validateStart(
      columnStart,
      columns.length,
      'gridColumnStart',
      child,
      container,
    );
    validateStart(
      rowStart,
      rows.length,
      'gridRowStart',
      child,
      container,
    );
    validateSpan(
      columnStart,
      columnSpan,
      columns.length,
      'gridColumnSpan',
      child,
      container,
    );
    validateSpan(
      rowStart,
      rowSpan,
      rows.length,
      'gridRowSpan',
      child,
      container,
    );
    const area = {
      x: container.x + trackOffset(columns, columnStart - 1, options.columnGap),
      y: container.y + trackOffset(rows, rowStart - 1, options.rowGap),
      width: trackSpan(columns, columnStart - 1, columnSpan, options.columnGap),
      height: trackSpan(rows, rowStart - 1, rowSpan, options.rowGap),
    };
    const widthAuto =
      normalized.width === undefined || normalized.width === 'auto';
    const heightAuto =
      normalized.height === undefined || normalized.height === 'auto';
    const justify = itemAlignment(
      normalized.justifySelf,
      options.justifyItems,
      'justifySelf',
      child,
      container,
    );
    const align = itemAlignment(
      normalized.alignSelf,
      options.alignItems,
      'alignSelf',
      child,
      container,
    );
    let measured: MeasureResult | undefined;
    if (
      (widthAuto && justify !== 'stretch') ||
      (heightAuto && align !== 'stretch')
    ) {
      const measurementChild = cloneCRCElement(child);
      setPreNormalizedStyle(
        measurementChild,
        normalized,
        child,
        receiverToken,
        preparedStyleQuery(prepared),
      );
      measured = measurement.measureElement(measurementChild, {
        minWidth: 0,
        maxWidth: area.width,
        minHeight: 0,
        maxHeight: area.height,
      });
      if (measured.status === 'unsupported') {
        throw childDiagnostic(
          child,
          widthAuto && justify !== 'stretch' ? 'width' : 'height',
          'auto',
          container,
          `measurement is required but unsupported: ${measured.reason}`,
        );
      }
    }
    const padding = normalizeEdges(
      normalized.padding,
      'padding',
      childContext(child, container),
    );
    const usedStyle = {
      ...normalized,
      width: widthAuto
        ? justify === 'stretch'
          ? Math.max(0, area.width - padding.left - padding.right)
          : measured!.status === 'measured'
            ? measured!.size.width
            : 0
        : normalized.width,
      height: heightAuto
        ? align === 'stretch'
          ? Math.max(0, area.height - padding.top - padding.bottom)
          : measured!.status === 'measured'
            ? measured!.size.height
            : 0
        : normalized.height,
    };
    const resolved = resolveDirectChildBox(area, child, 'grid', usedStyle);
    const border = resolved.borderBox;
    const box = {
      x: area.x + alignmentOffset(area.width, border.width, justify),
      y: area.y + alignmentOffset(area.height, border.height, align),
      width: border.width,
      height: border.height,
    };
    placements.push({
      box,
      element: childWithUsedSize(
        child,
        normalized,
        resolved.contentBox.width,
        resolved.contentBox.height,
        receiverToken,
        preparedStyleQuery(prepared),
      ),
    });
  }
  return placements;
}

export function resolveGridTracks(
  tracks: readonly GridTrack[],
  bound: number,
  gap: number,
  axis: 'columns' | 'rows',
): number[] {
  const container = {
    x: 0,
    y: 0,
    width: axis === 'columns' ? bound : 0,
    height: axis === 'rows' ? bound : 0,
  };
  const parsed = parseGridTracks(tracks, axis, container);
  return resolveParsedGridTracks(parsed, bound, gap, axis, container);
}

function resolveParsedGridTracks(
  tracks: readonly ParsedGridTrack[],
  bound: number,
  gap: number,
  axis: 'columns' | 'rows',
  container: Readonly<LayoutBox>,
): number[] {
  if (!Number.isFinite(bound) || bound < 0) {
    throw optionDiagnostic(
      axis,
      bound,
      container,
      'requires a finite nonnegative track bound',
    );
  }
  const resolved = new Array<number>(tracks.length).fill(0);
  const fractions: { index: number; factor: number }[] = [];
  let allocated =
    Math.max(0, tracks.length - 1) * nonnegativeOption(gap, 'gap', container);
  for (let index = 0; index < tracks.length; index++) {
    const track = tracks[index];
    if (track.kind === 'fixed') {
      resolved[index] = track.value;
      allocated += track.value;
    } else if (track.kind === 'percentage') {
      const size = (bound * track.factor) / 100;
      if (!Number.isFinite(size)) throw trackDiagnostic(track, axis, container);
      resolved[index] = size;
      allocated += size;
    } else {
      fractions.push({ index, factor: track.factor });
    }
  }
  const totalFr = fractions.reduce((total, track) => total + track.factor, 0);
  if (!Number.isFinite(allocated) || !Number.isFinite(totalFr)) {
    throw trackDiagnostic(tracks, axis, container);
  }
  const remaining = Math.max(0, bound - allocated);
  const unit = remaining / Math.max(1, totalFr);
  for (const track of fractions) resolved[track.index] = unit * track.factor;
  if (resolved.some((value) => !Number.isFinite(value) || value < 0)) {
    throw trackDiagnostic(tracks, axis, container);
  }
  return resolved;
}

function parseGridTracks(
  tracks: readonly GridTrack[],
  axis: 'columns' | 'rows',
  container: Readonly<LayoutBox>,
): readonly ParsedGridTrack[] {
  if (!Array.isArray(tracks) || tracks.length === 0) {
    throw optionDiagnostic(
      axis === 'columns' ? 'gridTemplateColumns' : 'gridTemplateRows',
      tracks,
      container,
      `requires a nonempty explicit ${axis} list`,
    );
  }
  return tracks.map(track => {
    if (typeof track === 'number') {
      if (!Number.isFinite(track) || track < 0) {
        throw trackDiagnostic(track, axis, container);
      }
      return Object.freeze({ kind: 'fixed', value: track });
    }
    if (typeof track !== 'string') {
      throw trackDiagnostic(track, axis, container);
    }
    const match = /^(?:\d+(?:\.\d+)?|\.\d+)(%|fr)$/.exec(track);
    if (!match) throw trackDiagnostic(track, axis, container);
    const factor = Number.parseFloat(track);
    if (!Number.isFinite(factor) || factor < 0) {
      throw trackDiagnostic(track, axis, container);
    }
    return Object.freeze(match[1] === '%' ?
      { kind: 'percentage', factor } :
      { kind: 'fraction', factor });
  });
}

function measureGrid(input: MeasureInput<GridProps, GridStyle>): MeasureResult {
  prepareLayoutChildren(input.props.children, 'Grid');
  const diagnosticBox = {
    x: 0,
    y: 0,
    width: Number.isFinite(input.constraints.maxWidth)
      ? input.constraints.maxWidth
      : 0,
    height: Number.isFinite(input.constraints.maxHeight)
      ? input.constraints.maxHeight
      : 0,
  };
  const options = normalizeGridOptions(input.style, diagnosticBox);
  const widthDefinite =
    input.style.width !== undefined && input.style.width !== 'auto';
  const heightDefinite =
    input.style.height !== undefined && input.style.height !== 'auto';
  if (!widthDefinite) {
    const unsupported = intrinsicTrackReason(
      options.columns,
      'columns',
    );
    if (unsupported) return { status: 'unsupported', reason: unsupported };
  }
  if (!heightDefinite) {
    const unsupported = intrinsicTrackReason(options.rows, 'rows');
    if (unsupported) return { status: 'unsupported', reason: unsupported };
  }
  const width = widthDefinite
    ? measuredLength(
        input.style.width!,
        input.constraints.maxWidth,
        'width',
        input.constraints,
      )
    : intrinsicTrackSize(
        options.columns,
        options.columnGap,
        'columns',
      );
  const height = heightDefinite
    ? measuredLength(
        input.style.height!,
        input.constraints.maxHeight,
        'height',
        input.constraints,
      )
    : intrinsicTrackSize(options.rows, options.rowGap, 'rows');
  return { status: 'measured', size: { width, height } };
}

function intrinsicTrackSize(
  tracks: readonly ParsedGridTrack[],
  gap: number,
  axis: 'columns' | 'rows',
): number {
  const size =
    tracks.reduce((total, track) => total +
      (track.kind === 'fixed' ? track.value : 0), 0) +
    Math.max(0, tracks.length - 1) * gap;
  if (!Number.isFinite(size))
    throw trackDiagnostic(tracks, axis, { x: 0, y: 0, width: 0, height: 0 });
  return size;
}

function intrinsicTrackReason(
  tracks: readonly ParsedGridTrack[],
  axis: 'columns' | 'rows',
): string | undefined {
  if (tracks.every(track => track.kind === 'fixed')) return undefined;
  const kind = tracks.some(track => track.kind === 'fraction')
    ? 'fractional'
    : 'percentage';
  return `Grid ${kind} intrinsic measurement for ${axis} is unsupported because it is allocation-dependent`;
}

function measuredLength(
  value: Exclude<BoxStyle['width'], undefined>,
  reference: number,
  property: string,
  constraints: Readonly<Constraints>,
): number {
  const resolved = resolveLength(value, reference, property, {
    component: 'Grid',
    algorithm: 'measurement',
    constraints,
  });
  if (resolved === undefined || resolved < 0) {
    throw layoutDiagnostic({
      component: 'Grid',
      property,
      value,
      algorithm: 'measurement',
      constraints,
      reason: 'requires a definite nonnegative container size',
    });
  }
  return resolved;
}

function normalizeGridOptions(
  style: Readonly<GridStyle>,
  container: Readonly<LayoutBox>,
) {
  if (
    !Array.isArray(style.gridTemplateColumns) ||
    style.gridTemplateColumns.length === 0
  ) {
    throw optionDiagnostic(
      'gridTemplateColumns',
      style.gridTemplateColumns,
      container,
      'requires a nonempty explicit columns list',
    );
  }
  if (
    !Array.isArray(style.gridTemplateRows) ||
    style.gridTemplateRows.length === 0
  ) {
    throw optionDiagnostic(
      'gridTemplateRows',
      style.gridTemplateRows,
      container,
      'requires a nonempty explicit rows list',
    );
  }
  const justifyItems = containerAlignment(
    style.justifyItems ?? 'stretch',
    'justifyItems',
    container,
  );
  const alignItems = containerAlignment(
    style.alignItems ?? 'stretch',
    'alignItems',
    container,
  );
  const gap = nonnegativeOption(style.gap ?? 0, 'gap', container);
  return {
    columns: parseGridTracks(
      style.gridTemplateColumns,
      'columns',
      container,
    ),
    rows: parseGridTracks(style.gridTemplateRows, 'rows', container),
    justifyItems,
    alignItems,
    rowGap: nonnegativeOption(style.rowGap ?? gap, 'rowGap', container),
    columnGap: nonnegativeOption(
      style.columnGap ?? gap,
      'columnGap',
      container,
    ),
  };
}

function containerAlignment(
  value: unknown,
  property: string,
  container: Readonly<LayoutBox>,
): GridAlignment {
  if (
    value === 'stretch' ||
    value === 'start' ||
    value === 'center' ||
    value === 'end'
  )
    return value;
  throw optionDiagnostic(
    property,
    value,
    container,
    'uses an unsupported grid alignment',
  );
}

function itemAlignment(
  value: unknown,
  fallback: GridAlignment,
  property: string,
  child: CRCElement<any>,
  container: Readonly<LayoutBox>,
): GridAlignment {
  if (value === undefined || value === 'auto') return fallback;
  if (
    value === 'stretch' ||
    value === 'start' ||
    value === 'center' ||
    value === 'end'
  )
    return value;
  throw childDiagnostic(
    child,
    property,
    value,
    container,
    'uses an unsupported grid alignment',
  );
}

function placementInteger(
  value: unknown,
  property: string,
  child: CRCElement<any>,
  container: Readonly<LayoutBox>,
  required: boolean,
): number {
  if (value === undefined && required) {
    throw childDiagnostic(
      child,
      property,
      value,
      container,
      'is required for explicit grid placement',
    );
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw childDiagnostic(
      child,
      property,
      value,
      container,
      'must be a positive integer',
    );
  }
  return value;
}

function validateSpan(
  start: number,
  span: number,
  trackCount: number,
  property: string,
  child: CRCElement<any>,
  container: Readonly<LayoutBox>,
): void {
  if (start - 1 + span > trackCount) {
    throw childDiagnostic(
      child,
      property,
      span,
      container,
      `grid area start ${start} plus span ${span} exceeds the explicit ${trackCount}-track list`,
    );
  }
}

function validateStart(
  start: number,
  trackCount: number,
  property: string,
  child: CRCElement<any>,
  container: Readonly<LayoutBox>,
): void {
  if (start > trackCount) {
    throw childDiagnostic(
      child,
      property,
      start,
      container,
      `must reference the explicit ${trackCount}-track list`,
    );
  }
}

function trackOffset(
  tracks: readonly number[],
  index: number,
  gap: number,
): number {
  return (
    tracks.slice(0, index).reduce((total, size) => total + size, 0) +
    index * gap
  );
}

function trackSpan(
  tracks: readonly number[],
  index: number,
  span: number,
  gap: number,
): number {
  return (
    tracks.slice(index, index + span).reduce((total, size) => total + size, 0) +
    Math.max(0, span - 1) * gap
  );
}

function alignmentOffset(
  area: number,
  item: number,
  alignment: GridAlignment,
): number {
  if (alignment === 'center') return (area - item) / 2;
  if (alignment === 'end') return area - item;
  return 0;
}

function nonnegativeOption(
  value: number,
  property: string,
  container: Readonly<LayoutBox>,
): number {
  if (!Number.isFinite(value) || value < 0) {
    throw optionDiagnostic(
      property,
      value,
      container,
      'requires a finite nonnegative number',
    );
  }
  return value;
}

function assertFiniteContainer(container: Readonly<LayoutBox>): void {
  for (const [property, value] of Object.entries(container)) {
    if (
      !Number.isFinite(value) ||
      ((property === 'width' || property === 'height') && value < 0)
    ) {
      throw optionDiagnostic(
        property,
        value,
        container,
        'requires finite nonnegative container geometry',
      );
    }
  }
}

function rejectUnsupportedItemFields(
  child: CRCElement<any>,
  style: Readonly<Record<string, unknown>>,
  container: Readonly<LayoutBox>,
): void {
  for (const property of ['gridColumnEnd', 'gridRowEnd', 'gridArea', 'order']) {
    if (style[property] !== undefined) {
      throw childDiagnostic(
        child,
        property,
        style[property],
        container,
        'is outside the explicit Grid subset',
      );
    }
  }
}

function trackDiagnostic(
  value: unknown,
  axis: string,
  container: Readonly<LayoutBox>,
) {
  return optionDiagnostic(
    axis === 'columns' ? 'gridTemplateColumns' : 'gridTemplateRows',
    value,
    container,
    'contains an unsupported track; use finite numbers, exact decimal percentages, or decimal fr units',
  );
}

function optionDiagnostic(
  property: string,
  value: unknown,
  container: Readonly<LayoutBox>,
  reason: string,
) {
  return layoutDiagnostic({
    component: 'Grid',
    property,
    value,
    algorithm: 'grid',
    constraints: constraintsFor(container),
    reason,
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
    algorithm: 'grid',
    constraints: constraintsFor(container),
    reason,
  });
}

function childContext(child: CRCElement<any>, container: Readonly<LayoutBox>) {
  return {
    component: child.type.name || 'Anonymous',
    algorithm: 'grid',
    constraints: constraintsFor(container),
  };
}

function constraintsFor(container: Readonly<LayoutBox>) {
  return {
    minWidth: 0,
    maxWidth: container.width,
    minHeight: 0,
    maxHeight: container.height,
  };
}
