import { contentBoxStyle } from './box-sizing.js';
import { canvasMeasurementService } from './canvas-measurement.js';
import { nativeLayout, LayoutRegion, mountedLayoutRegion } from './wasm/region.js';
import { prepareKnownLayoutDescendants, registerKnownLayoutPreflight, claimPreparedLayoutPlan, stagePreparedLayoutPlan, preparePlacedKnownLayout, type PreparedLayoutPlan } from './prepared-root.js';
import { getStyleMeasurementMode, preparedStyleValue, preparedStyleQuery } from '../style/responsive.js';
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
import { isFitContent, resolveScalarSizingLength, type FitContent, type SizingKeyword } from '../style/sizing-length.js';
import { setPreNormalizedStyle, registerOpaqueStyleProperties } from '../style/resolve-dispatch.js';
import type {
  BoxStyle,
  GridItemStyle,
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
  prepareDirectChildStyle,
  materializeLayoutChildren,
  placeDirectChildren,
  prepareLayoutChildren,
  resolveContainerBox,
  resolveDirectChildBox,
} from './absolute.js';
import { getLayoutDirection, pushLayoutBox, resolvePositionedContainingBox } from './context.js';
import { recordLayoutEvaluation } from './diagnostics.js';
import { assertSupportedChildPosition } from './positioning-diagnostics.js';
import { measureElement, measureIntrinsicElement } from './measure.js';
import { resolveAbsoluteFlexPlacement } from './flex.js';
import { GRID_V2_TRACK_STRIDE } from './grid-kernel.js';
import type { Constraints, LayoutBox } from './types.js';
const unsupportedProperties = ['gridColumnEnd', 'gridRowEnd', 'gridArea', 'order'] as const;


/** A scalar, fractional, or intrinsic breadth accepted by a Grid track.
 *
 * @see {@link GridTrack}
 */
export type GridTrackBreadth = number | `${number}%` | `${number}fr` | SizingKeyword | FitContent | 'auto';

/** A bounded Grid track whose minimum and maximum are resolved by the Grid owner.
 *
 * @see {@link GridTrack}
 */
export interface GridMinMaxTrack {
  /** Identifies the bounded track definition. See {@link GridMinMaxTrack}. */
  readonly kind: 'minmax';
  /** Minimum track breadth. See {@link GridTrackBreadth}. */
  readonly min: GridTrackBreadth;
  /** Maximum track breadth. See {@link GridTrackBreadth}. */
  readonly max: GridTrackBreadth;
}

/** A repeated {@link GridTrack} list. `auto-fill` and `auto-fit` use the available axis size. */
export interface GridRepeatTrack {
  /** Identifies the repetition definition. See {@link GridRepeatTrack}. */
  readonly kind: 'repeat';
  /** Fixed count or automatic fill/fit policy. See {@link GridRepeatTrack}. */
  readonly count: number | 'auto-fill' | 'auto-fit';
  /** Ordered pattern to repeat. See {@link GridTrack}. */
  readonly tracks: readonly GridTrack[];
}

/** A fixed logical size, percentage, fraction, intrinsic breadth, minmax, or repeat track. See {@link GridTrackBreadth}, {@link GridMinMaxTrack}, {@link GridRepeatTrack}. */
export type GridTrack = GridTrackBreadth | GridMinMaxTrack | GridRepeatTrack;

/** Creates an immutable bounded Grid track.
 * @param options - The minimum and maximum breadths.
 * @returns An immutable `minmax` track definition.
 * @see {@link GridTrack}
 */
export function minmax(options: Readonly<{ min: GridTrackBreadth; max: GridTrackBreadth }>): GridMinMaxTrack {
  return Object.freeze({ kind: 'minmax' as const, min: options.min, max: options.max });
}

/** Repeats Grid tracks a fixed number of times.
 * @param tracks - The track sequence to repeat.
 * @param options - The repeat count.
 * @returns An immutable repeated track definition.
 * @see {@link GridTrack}
 */
export function repeatTracks(tracks: readonly GridTrack[], options: Readonly<{ count: number }>): GridRepeatTrack {
  return Object.freeze({ kind: 'repeat' as const, count: options.count, tracks: Object.freeze([...tracks]) });
}

/** Repeats Grid tracks to fill the available axis.
 * @param tracks - The track sequence to repeat.
 * @returns An immutable auto-fill track definition.
 * @see {@link GridTrack}
 */
export function autoFillTracks(...tracks: readonly GridTrack[]): GridRepeatTrack {
  return Object.freeze({ kind: 'repeat' as const, count: 'auto-fill' as const, tracks: Object.freeze([...tracks]) });
}

/** Repeats Grid tracks to fit occupied cells in the available axis.
 * @param tracks - The track sequence to repeat.
 * @returns An immutable auto-fit track definition.
 * @see {@link GridTrack}
 */
export function autoFitTracks(...tracks: readonly GridTrack[]): GridRepeatTrack {
  return Object.freeze({ kind: 'repeat' as const, count: 'auto-fit' as const, tracks: Object.freeze([...tracks]) });
}

type GridAlignment = 'stretch' | 'start' | 'center' | 'end';
type ParsedGridTrack =
  | Readonly<{ kind: 'fixed'; value: number }>
  | Readonly<{ kind: 'percentage'; factor: number }>
  | Readonly<{ kind: 'fraction'; factor: number }>
  | Readonly<{ kind: 'intrinsic'; value: 'auto' | SizingKeyword | FitContent }>
  | Readonly<{ kind: 'minmax'; min: ParsedGridTrack; max: ParsedGridTrack }>;

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
  /** Placement direction and dense-packing policy for automatically placed children. */
  gridAutoFlow?: 'row' | 'column' | 'row dense' | 'column dense';
  /** Track used when automatic placement creates an implicit column. */
  gridAutoColumns?: GridTrack;
  /** Track used when automatic placement creates an implicit row. */
  gridAutoRows?: GridTrack;
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
 * @see {@link PibblNodeInput}
 * @see {@link Grid}
 */
export interface GridProps extends PibblStructuralEventProps {
  /** Descendant content or the callback that supplies it. See {@link PibblNodeInput}. */
  children: PibblNodeInput;
}

export interface GridMeasurementInput {
  service: CanvasMeasurementService;
  measureElement(
    element: PibblElement<any>,
    constraints: Readonly<Constraints>,
  ): MeasureResult;
}

// Parent input is private metadata, not a recursively validated resolved value.
const GRID_CONTAINING_BOX_STYLE = Symbol('pibbl.grid-containing-box-style');

interface ResolvedGridStyle extends SystemStyle {
  box: ResolvedBoxStyle;
  [GRID_CONTAINING_BOX_STYLE]: Readonly<GridStyle>;
  overflow: 'visible' | 'clip';
  columns: readonly ParsedGridTrack[];
  rows: readonly ParsedGridTrack[];
  justifyItems: GridAlignment;
  alignItems: GridAlignment;
  rowGap: number;
  columnGap: number;
  gridAutoFlow: NonNullable<GridStyle['gridAutoFlow']>;
  autoColumn: ParsedGridTrack;
  autoRow: ParsedGridTrack;
  autoFitColumns: boolean;
  autoFitRows: boolean;
  layoutDirection: 'ltr' | 'rtl';
}

interface GridPlacement {
  usedWidth: number; usedHeight: number;
  box: LayoutBox;
  element: PibblElement<any>;
}

type GridChildStyle = Readonly<
  BoxStyle & GridItemStyle & LayoutItemStyle & Record<string, unknown>
>;

interface GridCell {
  readonly child: PibblElement<any>;
  readonly prepared: ReturnType<typeof prepareDirectChildStyle>;
  readonly normalized: GridChildStyle;
  readonly receiverToken: object;
  columnStart: number;
  readonly columnSpan: number;
  rowStart: number;
  readonly rowSpan: number;
}

function renderGrid(
  props: GridProps,
  style: Readonly<ResolvedGridStyle>,
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
      style[GRID_CONTAINING_BOX_STYLE],
      localContent,
      'Grid',
    ),
  });
  GLOBAL_STATE.componentRefs!.onAfterRender = releaseLayout;
  const prepared = nativeLayout ? claimPreparedLayoutPlan(GLOBAL_STATE.componentRefs!.element, localContent) : undefined;
  const children = prepared?.children ?? prepareLayoutChildren(props.children, 'Grid');
  const service = canvasMeasurementService(ctx);
  const nativeRegion = prepared?.region ?? (nativeLayout ? mountedLayoutRegion() : undefined);
  if (nativeLayout && !nativeRegion) throw new Error('Experimental Grid requires its mounted native region.');
  const placements = prepared?.placements ?? resolveGridPlacements(
    localContent,
    children,
    style,
    {
      service,
      measureElement: (element, constraints) =>
        measureElement(element, constraints, service),
    },
    nativeRegion,
  );
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
 * Describes explicit Grid layout for JSX or createElement authoring.
 *
 * @param props - Authored component inputs, supplied through JSX or createElement. See the linked
 * props and style types.
 * @throws When called directly; Pibbl mounts this component through JSX or createElement.
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
  resolveStyle: (style, context) => {
    if (nativeLayout && hasPercentageBoxPadding(style)) {
      style = resolveAllocatedInsets(style, { width: context.percentageBasis.width,
        context: { ...context, component: 'Grid', algorithm: 'grid' } });
    }
    return {
      box: resolveContainerBox(style, context, 'Grid', 'grid'),
      [GRID_CONTAINING_BOX_STYLE]: style,
      overflow: style.overflow ?? 'visible',
      ...normalizeGridOptions(style, context.allocation),
    };
  },
  measure: (input) => measureGrid(input),
  measureIntrinsic: (input) => measureGridIntrinsic(input),
});

registerOpaqueStyleProperties(Grid, [
  'columns', 'rows', 'autoColumn', 'autoRow', 'gridAutoColumns', 'gridAutoRows',
]);

if (nativeLayout) registerKnownLayoutPreflight(Grid, (element, style, content, receiver, slot) => {
  const previous = GLOBAL_STATE.primitiveReceiverToken;
  GLOBAL_STATE.primitiveReceiverToken = receiver;
  const releaseLayout = pushLayoutBox(content, {
    containingBlock: resolvePositionedContainingBox(
      style as Readonly<GridStyle>,
      content,
      'Grid',
    ),
  });
  try {
    const children = prepareLayoutChildren(element.props.children, 'Grid');
    const options = normalizeGridOptions(style as Readonly<GridStyle>, content);
    const ctx = GLOBAL_STATE.renderContext;
    if (!ctx) throw new Error('Known Grid preparation requires a Canvas measurement context.');
    const service = canvasMeasurementService(ctx);
    const region = slot.acquire();
    const placements = resolveGridPlacements(content, children, options, { service, measureElement: (child, constraints) => measureElement(child, constraints, service) }, region);
    const plan: PreparedLayoutPlan = { region, content, children, placements };
    prepareKnownLayoutDescendants(plan, slot);
    stagePreparedLayoutPlan(slot, plan);
  } finally {
    releaseLayout();
    GLOBAL_STATE.primitiveReceiverToken = previous;
  }
});

export function layoutGrid(
  container: Readonly<LayoutBox>,
  children: PibblNodeInput,
  style: Readonly<GridStyle>,
  measurement: GridMeasurementInput,
): LayoutBox[] {
  const prepared = materializeLayoutChildren(children, 'Grid');
  const options = normalizeGridOptions(style, container);
  const region = nativeLayout ? new LayoutRegion() : undefined;
  try { return resolveGridPlacements(container, prepared, options, measurement, region).map((placement) => placement.box); }
  finally { region?.dispose(); }
}

function resolveGridPlacements(
  container: Readonly<LayoutBox>,
  children: readonly PibblElement<any>[],
  options: Readonly<ReturnType<typeof normalizeGridOptions>>,
  measurement: GridMeasurementInput,
  nativeRegion?: LayoutRegion,
): GridPlacement[] {
  assertFiniteContainer(container);
  const cells = nativeRegion ? prepareGridCells(children, container) : prepareExplicitGridCells(children, container, options.columns.length, options.rows.length);
  const flowCells = cells.filter((cell) => cell.normalized.position !== 'absolute');
  if (nativeRegion) { const assigned = nativeRegion.gridV2Region().assign(flowCells, options.columns.length, options.rows.length, gridFlowCode(options.gridAutoFlow)).cells; for (let index = 0; index < flowCells.length; index++) { flowCells[index]!.columnStart = assigned[index]!.columnStart; flowCells[index]!.rowStart = assigned[index]!.rowStart; } }
  let expandedColumns = appendImplicitTracks(options.columns, options.autoColumn, maxGridExtent(flowCells, 'column'));
  let expandedRows = appendImplicitTracks(options.rows, options.autoRow, maxGridExtent(flowCells, 'row'));
  if (nativeRegion && options.autoFitColumns) {
    const collapsed = nativeRegion.gridV2Region().collapseAutoFit(0, 0);
    for (let index = 0; index < flowCells.length; index++) flowCells[index]!.columnStart = collapsed.cells[index]!.columnStart;
    expandedColumns = expandedColumns.filter((_, index) => collapsed.keep[index]);
  }
  if (nativeRegion && options.autoFitRows) {
    const collapsed = nativeRegion.gridV2Region().collapseAutoFit(1, 0);
    for (let index = 0; index < flowCells.length; index++) flowCells[index]!.rowStart = collapsed.cells[index]!.rowStart;
    expandedRows = expandedRows.filter((_, index) => collapsed.keep[index]);
  }
  let columns = nativeRegion ? resolveNativeGridTracks(nativeRegion, expandedColumns, container.width, options.columnGap, 'columns', container) : resolveParsedGridTracks(
    expandedColumns,
    container.width,
    options.columnGap,
    'columns',
    container,
  );
  if (nativeRegion) {
    nativeRegion.applyGridV2Contributions(
      gatherGridIntrinsicContributions(expandedColumns, cells, measurement, container, 'columns'),
      options.columnGap,
      0,
    );
    // Contributions mutate native records in place. Row measurement must use the
    // resulting column areas, not the initial host snapshot.
    columns = nativeRegion.snapshotGridV2Tracks(0) as number[];
  }
  let rows = nativeRegion ? resolveNativeGridTracks(nativeRegion, expandedRows, container.height, options.rowGap, 'rows', container) : resolveParsedGridTracks(
    expandedRows,
    container.height,
    options.rowGap,
    'rows',
    container,
  );
  if (nativeRegion) {
    nativeRegion.applyGridV2Contributions(
      gatherGridIntrinsicContributions(
        expandedRows,
        cells,
        measurement,
        container,
        'rows',
        columns,
        options.columnGap,
      ),
      options.rowGap,
      1,
    );
    rows = nativeRegion.snapshotGridV2Tracks(1) as number[];
  }
  if (!nativeRegion && options.autoFitColumns) columns = collapseAutoFitTracks(columns, cells, 'column');
  if (!nativeRegion && options.autoFitRows) rows = collapseAutoFitTracks(rows, cells, 'row');
  const nativeItems = cells;
  const nativeBoxes = nativeRegion ? nativeRegion.placeGridV2Cells(flowCells, gridFlowCode(options.gridAutoFlow), options.columnGap, options.rowGap) : undefined;
  const placements: GridPlacement[] = [];

  for (const child of children) {
    const item = nativeItems[placements.length]!;
    const { prepared, receiverToken, columnStart, columnSpan, rowStart, rowSpan } = item;
    let normalized = item.normalized;
    if (normalized.position === 'absolute') {
      const needsNaturalMeasurement =
        normalized.width === undefined || normalized.width === 'auto' ||
        normalized.height === undefined || normalized.height === 'auto';
      const absolute = resolveAbsoluteFlexPlacement(container, child, normalized, receiverToken, preparedStyleQuery(prepared), container, {
        flexDirection: 'row', flexWrap: 'nowrap', justifyContent: 'flex-start', alignItems: options.alignItems === 'start' ? 'flex-start' : options.alignItems === 'end' ? 'flex-end' : options.alignItems, layoutDirection: options.layoutDirection,
      }, needsNaturalMeasurement ? measurement : undefined);
      placements.push({ usedWidth: absolute.usedWidth, usedHeight: absolute.usedHeight, box: absolute.box, element: absolute.element });
      continue;
    }
    const nativeBox = nativeBoxes?.[flowCells.indexOf(item)];
    const area = nativeBox ? { x: container.x + nativeBox.x, y: container.y + nativeBox.y, width: nativeBox.width, height: nativeBox.height } : {
      x: container.x + trackOffset(columns, columnStart - 1, options.columnGap),
      y: container.y + trackOffset(rows, rowStart - 1, options.rowGap),
      width: trackSpan(columns, columnStart - 1, columnSpan, options.columnGap),
      height: trackSpan(rows, rowStart - 1, rowSpan, options.rowGap),
    };
    if (nativeLayout && GLOBAL_STATE.currentPibblInstance && getStyleMeasurementMode() === undefined && hasPercentageBoxPadding(normalized)) {
      normalized = resolveAllocatedInsets(normalized, { width: area.width, context: childContext(child, area) });
    }
    if (normalized.boxSizing !== undefined) normalized = contentBoxStyle(normalized, { width: area.width, height: area.height, context: childContext(child, area) });
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
      const measurementChild = clonePibblElement(child);
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
    const padding = normalizeBoxInsets(normalized, childContext(child, container));
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
    const resolved = resolveDirectChildBox(area, child, 'grid', usedStyle, measurement.service);
    const border = resolved.borderBox;
    const box = {
      x: area.x + alignmentOffset(area.width, border.width, justify),
      y: area.y + alignmentOffset(area.height, border.height, align),
      width: border.width,
      height: border.height,
    };
    placements.push({
      usedWidth: resolved.contentBox.width, usedHeight: resolved.contentBox.height,
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
  const parsed = parseGridTracks(tracks, axis, container, gap);
  return resolveParsedGridTracks(parsed, bound, gap, axis, container);
}


function assignGridCells(children: readonly PibblElement<any>[], container: Readonly<LayoutBox>, columns: number, rows: number, options: Readonly<ReturnType<typeof normalizeGridOptions>>): GridCell[] {
  /* The production WASM lane owns this same occupancy pass.  Keeping this
   * compact compatibility implementation here preserves legacy JS builds. */
  const occupied = new Set<string>(), result: GridCell[] = [];
  let cursorColumn = 1, cursorRow = 1;
  const byColumn = options.gridAutoFlow.startsWith('column');
  const dense = options.gridAutoFlow.endsWith('dense');
  for (let index = 0; index < children.length; index++) {
    const child = children[index]!;
    const receiverToken = getChildPrimitiveReceiverToken(GLOBAL_STATE.renderTransaction, GLOBAL_STATE.primitiveReceiverToken, index);
    const prepared = prepareDirectChildStyle(child, receiverToken, container);
    const normalized = preparedStyleValue(prepared) as GridChildStyle;
    if (normalized.position !== 'absolute') assertSupportedChildPosition('Grid', child, normalized); rejectUnsupportedItemFields(child, normalized, container);
    const columnSpan = placementInteger(normalized.gridColumnSpan ?? 1, 'gridColumnSpan', child, container, false);
    const rowSpan = placementInteger(normalized.gridRowSpan ?? 1, 'gridRowSpan', child, container, false);
    let columnStart = normalized.gridColumnStart, rowStart = normalized.gridRowStart;
    if (columnStart === undefined || rowStart === undefined) {
      let found = false;
      const startColumn = dense ? 1 : cursorColumn;
      const startRow = dense ? 1 : cursorRow;
      /* Searching grows the implicit major axis. A bounded safety cap turns
       * malformed input into a useful layout diagnostic instead of a hang. */
      for (let major = 0; major < children.length + columns + rows + 1 && !found; major++) {
        const rowLimit = Math.max(rows, startRow + major + rowSpan);
        const columnLimit = Math.max(columns, startColumn + major + columnSpan);
        if (byColumn) {
          for (let column = columnStart ?? startColumn; column <= columnLimit && !found; column++) for (let row = rowStart ?? 1; row <= rowLimit && !found; row++) {
            const c = columnStart ?? column, r = rowStart ?? row;
            if (freeGridArea(occupied, c, r, columnSpan, rowSpan)) { columnStart = c; rowStart = r; found = true; }
          }
        } else {
          for (let row = rowStart ?? startRow; row <= rowLimit && !found; row++) for (let column = columnStart ?? 1; column <= columnLimit && !found; column++) {
            const c = columnStart ?? column, r = rowStart ?? row;
            if (freeGridArea(occupied, c, r, columnSpan, rowSpan)) { columnStart = c; rowStart = r; found = true; }
          }
        }
      }
      if (!found) throw childDiagnostic(child, 'gridAutoFlow', options.gridAutoFlow, container, 'could not find an implicit grid cell');
    }
    const c = placementInteger(columnStart, 'gridColumnStart', child, container, false), r = placementInteger(rowStart, 'gridRowStart', child, container, false);
    /* Explicit starts are allowed to establish implicit tracks. */
    for(let yy=r;yy<r+rowSpan;yy++)for(let xx=c;xx<c+columnSpan;xx++)occupied.add(`${xx}:${yy}`);
    cursorColumn = c; cursorRow = r;
    if (byColumn) cursorRow += rowSpan; else cursorColumn += columnSpan;
    result.push({ child, prepared, normalized, receiverToken, columnStart:c, columnSpan, rowStart:r, rowSpan });
  }
  return result;
}

function prepareExplicitGridCells(children: readonly PibblElement<any>[], container: Readonly<LayoutBox>, columns: number, rows: number): GridCell[] {
  const cells = prepareGridCells(children, container);
  for (let index = 0; index < cells.length; index++) {
    const cell = cells[index]!;
    assertSupportedChildPosition('Grid', cell.child, cell.normalized);
    cell.columnStart = placementInteger(cell.normalized.gridColumnStart, 'gridColumnStart', cell.child, container, true);
    cell.rowStart = placementInteger(cell.normalized.gridRowStart, 'gridRowStart', cell.child, container, true);
    if (cell.columnStart > columns) throw childDiagnostic(cell.child, 'gridColumnStart', cell.columnStart, container, `must reference one of the explicit ${columns} columns`);
    if (cell.rowStart > rows) throw childDiagnostic(cell.child, 'gridRowStart', cell.rowStart, container, `must reference one of the explicit ${rows} rows`);
    if (cell.columnStart + cell.columnSpan - 1 > columns) throw childDiagnostic(cell.child, 'gridColumnSpan', cell.columnSpan, container, `start ${cell.columnStart} plus span ${cell.columnSpan} must remain inside the explicit column tracks`);
    if (cell.rowStart + cell.rowSpan - 1 > rows) throw childDiagnostic(cell.child, 'gridRowSpan', cell.rowSpan, container, `start ${cell.rowStart} plus span ${cell.rowSpan} must remain inside the explicit row tracks`);
  }
  return cells;
}

function prepareGridCells(children: readonly PibblElement<any>[], container: Readonly<LayoutBox>): GridCell[] {
  const result: GridCell[] = [];
  for (let index = 0; index < children.length; index++) {
    const child = children[index]!;
    const receiverToken = getChildPrimitiveReceiverToken(GLOBAL_STATE.renderTransaction, GLOBAL_STATE.primitiveReceiverToken, index);
    const prepared = prepareDirectChildStyle(child, receiverToken, container);
    const normalized = preparedStyleValue(prepared) as GridChildStyle;
    if (normalized.position !== 'absolute') assertSupportedChildPosition('Grid', child, normalized); rejectUnsupportedItemFields(child, normalized, container);
    const columnSpan = placementInteger(normalized.gridColumnSpan ?? 1, 'gridColumnSpan', child, container, false);
    const rowSpan = placementInteger(normalized.gridRowSpan ?? 1, 'gridRowSpan', child, container, false);
    const columnStart = normalized.gridColumnStart === undefined ? 0 : placementInteger(normalized.gridColumnStart, 'gridColumnStart', child, container, false);
    const rowStart = normalized.gridRowStart === undefined ? 0 : placementInteger(normalized.gridRowStart, 'gridRowStart', child, container, false);
    result.push({ child, prepared, normalized, receiverToken, columnStart, columnSpan, rowStart, rowSpan });
  }
  return result;
}

function freeGridArea(occupied: ReadonlySet<string>, column: number, row: number, columnSpan: number, rowSpan: number): boolean {
  for (let y = row; y < row + rowSpan; y++) for (let x = column; x < column + columnSpan; x++) if (occupied.has(`${x}:${y}`)) return false;
  return true;
}

function maxGridExtent(cells: readonly { columnStart: number; columnSpan: number; rowStart: number; rowSpan: number }[], axis: 'column' | 'row'): number {
  let extent = 0;
  for (let index = 0; index < cells.length; index++) {
    const cell = cells[index]!;
    extent = Math.max(extent, axis === 'column' ? cell.columnStart + cell.columnSpan - 1 : cell.rowStart + cell.rowSpan - 1);
  }
  return extent;
}
function collapseAutoFitTracks(tracks: readonly number[], cells: readonly GridCell[], axis: 'column' | 'row'): number[] { const out=tracks.slice(); for(let index=0;index<out.length;index++){let used=false;for(let cellIndex=0;cellIndex<cells.length;cellIndex++){const cell=cells[cellIndex]!;const start=axis==='column'?cell.columnStart:cell.rowStart,span=axis==='column'?cell.columnSpan:cell.rowSpan;if(start<=index+1&&index+1<start+span){used=true;break}}if(!used)out[index]=0;}return out; }

function isAutoFitOnly(tracks: readonly GridTrack[]): boolean { return tracks.length===1&&typeof tracks[0]==='object'&&tracks[0]!==null&&'kind'in tracks[0]&&(tracks[0] as GridRepeatTrack).kind==='repeat'&&(tracks[0] as GridRepeatTrack).count==='auto-fit'; }

function appendImplicitTracks(explicit: readonly ParsedGridTrack[], automatic: ParsedGridTrack, extent: number): readonly ParsedGridTrack[] {
  if (extent <= explicit.length) return explicit;
  const tracks = explicit.slice();
  while (tracks.length < extent) tracks.push(automatic);
  return tracks;
}

function gatherGridIntrinsicContributions(
  tracks: readonly ParsedGridTrack[],
  cells: readonly GridCell[],
  measurement: GridMeasurementInput,
  container: Readonly<LayoutBox>,
  axis: 'columns' | 'rows',
  selectedColumns?: readonly number[],
  columnGap = 0,
): number[] {
  const records: number[] = [];
  for (let index = 0; index < cells.length; index++) {
    const cell = cells[index]!;
    if (cell.normalized.position === 'absolute') continue;
    const start = axis === 'columns' ? cell.columnStart : cell.rowStart;
    const span = axis === 'columns' ? cell.columnSpan : cell.rowSpan;
    if (start < 1 || start + span - 1 > tracks.length) continue;
    let needed = false;
    for (let track = start - 1; track < start - 1 + span; track++) {
      if (trackNeedsIntrinsic(tracks[track]!)) needed = true;
    }
    if (!needed) continue;
    if (axis === 'rows') {
      if (!selectedColumns) throw new Error('Grid row contributions require resolved column tracks.');
      const width = trackSpan(selectedColumns, cell.columnStart - 1, cell.columnSpan, columnGap);
      const height = measureGridCellAtSelectedWidth(cell, width, measurement, container);
      records.push(start, span, height, height);
      continue;
    }
    const result = measureIntrinsicElement(
      cell.child,
      {
        minWidth: 0,
        maxWidth: container.width,
        minHeight: 0,
        maxHeight: container.height,
      },
      measurement.service,
    );
    if (result.status !== 'measured') {
      throw childDiagnostic(
        cell.child,
        'measureIntrinsic',
        'unsupported',
        container,
        `intrinsic grid track contribution requires a declared intrinsic measurement: ${result.reason}`,
      );
    }
    records.push(start, span, result.minContent.width, result.maxContent.width);
  }
  return records;
}

/** Measures a row contribution at its selected final column span. */
function measureGridCellAtSelectedWidth(
  cell: Readonly<GridCell>,
  width: number,
  measurement: GridMeasurementInput,
  container: Readonly<LayoutBox>,
): number {
  const area = { x: 0, y: 0, width, height: container.height };
  let normalized = cell.normalized;
  if (
    nativeLayout &&
    GLOBAL_STATE.currentPibblInstance &&
    getStyleMeasurementMode() === undefined &&
    hasPercentageBoxPadding(normalized)
  ) {
    normalized = resolveAllocatedInsets(normalized, {
      width,
      context: childContext(cell.child, area),
    });
  }
  if (normalized.boxSizing !== undefined) {
    normalized = contentBoxStyle(normalized, {
      width,
      height: container.height,
      context: childContext(cell.child, area),
    });
  }
  const child = clonePibblElement(cell.child);
  setPreNormalizedStyle(
    child,
    normalized,
    cell.child,
    cell.receiverToken,
    preparedStyleQuery(cell.prepared),
  );
  const result = measurement.measureElement(child, {
    minWidth: width,
    maxWidth: width,
    minHeight: 0,
    maxHeight: container.height,
  });
  if (result.status !== 'measured') {
    throw childDiagnostic(
      cell.child,
      'height',
      'auto',
      container,
      `selected Grid column width requires measurement: ${result.reason}`,
    );
  }
  return result.size.height;
}

function trackNeedsIntrinsic(track: ParsedGridTrack): boolean { return track.kind === 'intrinsic' || track.kind === 'minmax' && trackNeedsIntrinsic(track.min); }
function resolveNativeGridTracks(region: LayoutRegion, tracks: readonly ParsedGridTrack[], bound: number, gap: number, axis: 'columns' | 'rows', container: Readonly<LayoutBox>): number[] {
  try { return region.resolveGridV2Tracks(gridTrackRecords(tracks, bound), { bound, gap, axis: axis === 'columns' ? 0 : 1 }) as number[]; }
  catch (error) { if (error instanceof RangeError) throw trackDiagnostic(tracks, axis, container); throw error; }
}

function gridTrackRecords(tracks: readonly ParsedGridTrack[], bound: number): number[] {
  const records = new Array<number>(tracks.length * GRID_V2_TRACK_STRIDE).fill(0);
  for (let index = 0; index < tracks.length; index++) {
    const track = tracks[index]!, offset = index * GRID_V2_TRACK_STRIDE;
    if (track.kind === 'fixed') { records[offset] = 0; records[offset + 1] = track.value; }
    else if (track.kind === 'percentage') { records[offset] = 1; records[offset + 1] = track.factor; }
    else if (track.kind === 'fraction') { records[offset] = 2; records[offset + 1] = track.factor; }
    else if (track.kind === 'intrinsic') { writeGridBreadth(records, offset, track, bound); }
    else { records[offset] = 6; writeGridBreadth(records, offset + 2, track.min, bound); writeGridBreadth(records, offset + 4, track.max, bound); }
  }
  return records;
}

function writeGridBreadth(records: number[], offset: number, track: ParsedGridTrack, bound: number): void {
  if (track.kind === 'fixed') { records[offset] = 0; records[offset + 1] = track.value; }
  else if (track.kind === 'percentage') { records[offset] = 1; records[offset + 1] = track.factor; }
  else if (track.kind === 'fraction') { records[offset] = 2; records[offset + 1] = track.factor; }
  else if (track.kind === 'minmax') writeGridBreadth(records, offset, track.min, bound);
  else if (track.value === 'min-content') records[offset] = 3;
  else if (track.value === 'max-content') records[offset] = 4;
  else if (track.value === 'auto') records[offset] = 5;
  else if (isFitContent(track.value)) { records[offset]=7; records[offset+1]=typeof track.value.limit==='number'?track.value.limit:bound*Number.parseFloat(track.value.limit)/100; }
}

function gridFlowCode(flow: NonNullable<GridStyle['gridAutoFlow']>): 0 | 1 | 2 | 3 {
  return flow === 'row' ? 0 : flow === 'column' ? 1 : flow === 'row dense' ? 2 : 3;
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
    } else if (track.kind === 'fraction') {
      fractions.push({ index, factor: track.factor });
    } else if (track.kind === 'minmax') {
      const min = resolvedTrackMinimum(track.min, bound, axis, container);
      const max = resolvedTrackMaximum(track.max, bound, axis, container);
      if (max < min) throw trackDiagnostic(track, axis, container);
      resolved[index] = min;
      allocated += min;
    } else {
      /* Intrinsic tracks begin at zero; their contribution is supplied by
       * known primitive measurement in the containing Grid pass. */
      resolved[index] = 0;
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
  gap = 0,
): readonly ParsedGridTrack[] {
  if (!Array.isArray(tracks) || tracks.length === 0) {
    throw optionDiagnostic(
      axis === 'columns' ? 'gridTemplateColumns' : 'gridTemplateRows',
      tracks,
      container,
      `requires a nonempty explicit ${axis} list`,
    );
  }
  if (!nativeLayout) for (let index = 0; index < tracks.length; index++) {
    const track = tracks[index]!;
    if (typeof track === 'object' || track === 'auto' || track === 'min-content' || track === 'max-content') throw trackDiagnostic(track, axis, container);
  }
  let autoRepeatIndex = -1;
  for (let index = 0; index < tracks.length; index++) {
    const track = tracks[index]!;
    if (!isAutoRepeatTrack(track)) continue;
    if (autoRepeatIndex !== -1) throw trackDiagnostic(tracks, axis, container);
    autoRepeatIndex = index;
  }
  const autoRepeatCount = autoRepeatIndex === -1
    ? undefined
    : resolveAutoRepeatCount(
      tracks,
      autoRepeatIndex,
      axis,
      container,
      gap,
    );
  const expanded: GridTrack[] = [];
  for (let index = 0; index < tracks.length; index++) {
    expandGridTrack(
      tracks[index]!,
      axis,
      container,
      expanded,
      index === autoRepeatIndex ? autoRepeatCount : undefined,
    );
  }
  if (!expanded.length) throw trackDiagnostic(tracks, axis, container);
  return expanded.map(track => {
    if (typeof track === 'number') {
      if (!Number.isFinite(track) || track < 0) {
        throw trackDiagnostic(track, axis, container);
      }
      return Object.freeze({ kind: 'fixed', value: track });
    }
    if (isFitContent(track)) return Object.freeze({ kind: 'intrinsic' as const, value: track });
    if (typeof track === 'object' && track !== null && 'kind' in track && track.kind === 'minmax') {
      const min = parseSingleGridTrack((track as GridMinMaxTrack).min, axis, container);
      const max = parseSingleGridTrack((track as GridMinMaxTrack).max, axis, container);
      return Object.freeze({ kind: 'minmax' as const, min, max });
    }
    if (typeof track !== 'string') throw trackDiagnostic(track, axis, container);
    if (track === 'auto' || track === 'min-content' || track === 'max-content') return Object.freeze({ kind: 'intrinsic' as const, value: track });
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

function parseSingleGridTrack(track: GridTrackBreadth, axis: 'columns' | 'rows', container: Readonly<LayoutBox>): ParsedGridTrack {
  const parsed = parseGridTracks([track], axis, container);
  return parsed[0]!;
}

function expandGridTrack(
  track: GridTrack,
  axis: 'columns' | 'rows',
  container: Readonly<LayoutBox>,
  into: GridTrack[],
  resolvedAutoRepeatCount?: number,
): void {
  if (typeof track === 'object' && track !== null && 'kind' in track && track.kind === 'repeat') {
    if (!Array.isArray(track.tracks) || !track.tracks.length) throw trackDiagnostic(track, axis, container);
    let count = track.count;
    if (count === 'auto-fill' || count === 'auto-fit') {
      if (resolvedAutoRepeatCount === undefined) throw trackDiagnostic(track, axis, container);
      count = resolvedAutoRepeatCount;
    }
    if (!Number.isInteger(count) || count < 0) throw trackDiagnostic(track, axis, container);
    for (let repeat = 0; repeat < count; repeat++) for (let index = 0; index < track.tracks.length; index++) expandGridTrack(track.tracks[index]!, axis, container, into);
    return;
  }
  into.push(track);
}

function isAutoRepeatTrack(track: GridTrack): track is GridRepeatTrack {
  return typeof track === 'object' && track !== null && 'kind' in track &&
    track.kind === 'repeat' &&
    (track.count === 'auto-fill' || track.count === 'auto-fit');
}

function resolveAutoRepeatCount(
  tracks: readonly GridTrack[],
  autoRepeatIndex: number,
  axis: 'columns' | 'rows',
  container: Readonly<LayoutBox>,
  gap: number,
): number {
  const autoRepeat = tracks[autoRepeatIndex]! as GridRepeatTrack;
  const repeated = trackListMetrics(autoRepeat.tracks, axis, container);
  let fixedBreadth = 0;
  let fixedCount = 0;
  for (let index = 0; index < tracks.length; index++) {
    if (index === autoRepeatIndex) continue;
    const metrics = trackMetrics(tracks[index]!, axis, container);
    fixedBreadth += metrics.breadth;
    fixedCount += metrics.count;
  }
  const bound = axis === 'columns' ? container.width : container.height;
  // The repeat group owns one gap per repeated track; fixed siblings own
  // only the gaps between fixed tracks. With no fixed sibling, the leading
  // gap is absent; with one, it is already represented by the group.
  const available = bound - fixedBreadth - (fixedCount - 1) * gap;
  const repeatedBreadth = repeated.breadth + repeated.count * gap;
  return Math.max(1, Math.floor(available / Math.max(1, repeatedBreadth)));
}

function trackListMetrics(
  tracks: readonly GridTrack[],
  axis: 'columns' | 'rows',
  container: Readonly<LayoutBox>,
): Readonly<{ breadth: number; count: number }> {
  let breadth = 0;
  let count = 0;
  for (let index = 0; index < tracks.length; index++) {
    const metrics = trackMetrics(tracks[index]!, axis, container);
    breadth += metrics.breadth;
    count += metrics.count;
  }
  return { breadth, count };
}

function trackMetrics(
  track: GridTrack,
  axis: 'columns' | 'rows',
  container: Readonly<LayoutBox>,
): Readonly<{ breadth: number; count: number }> {
  if (typeof track === 'object' && track !== null && 'kind' in track && track.kind === 'repeat') {
    if (!Array.isArray(track.tracks) || !track.tracks.length || typeof track.count !== 'number' || !Number.isInteger(track.count) || track.count < 0) {
      throw trackDiagnostic(track, axis, container);
    }
    let breadth = 0;
    let count = 0;
    for (let index = 0; index < track.tracks.length; index++) {
      const metrics = trackMetrics(track.tracks[index]!, axis, container);
      breadth += metrics.breadth * track.count;
      count += metrics.count * track.count;
    }
    return { breadth, count };
  }
  return {
    breadth: minimumRepeatBreadth([track], axis, container),
    count: 1,
  };
}

function minimumRepeatBreadth(tracks: readonly GridTrack[], axis: 'columns' | 'rows', container: Readonly<LayoutBox>): number {
  let size = 0;
  for (let index = 0; index < tracks.length; index++) {
    const parsed = parseSingleGridTrack(tracks[index]! as GridTrackBreadth, axis, container);
    size += resolvedTrackMinimum(parsed, axis === 'columns' ? container.width : container.height, axis, container);
  }
  return size;
}

function resolvedTrackMinimum(track: ParsedGridTrack, bound: number, axis: string, container: Readonly<LayoutBox>): number {
  if (track.kind === 'fixed') return track.value;
  if (track.kind === 'percentage') return bound * track.factor / 100;
  if (track.kind === 'minmax') return resolvedTrackMinimum(track.min, bound, axis, container);
  return 0;
}

function resolvedTrackMaximum(track: ParsedGridTrack, bound: number, axis: string, container: Readonly<LayoutBox>): number {
  if (track.kind === 'fixed') return track.value;
  if (track.kind === 'percentage') return bound * track.factor / 100;
  if (track.kind === 'fraction' || track.kind === 'intrinsic') return Number.POSITIVE_INFINITY;
  return resolvedTrackMaximum(track.max, bound, axis, container);
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
  if (widthDefinite && !heightDefinite) {
    const width = measuredLength(
      input.style.width!,
      input.constraints.maxWidth,
      'width',
      input.constraints,
    );
    const selected = measureGridRowsAtSelectedWidth(
      input.props.children,
      input.style,
      input.service,
      (element, constraints) => input.measureElement(element, constraints),
      input.constraints,
      width,
    );
    if (selected.status === 'unsupported') return selected;
    return { status: 'measured', size: { width, height: selected.height } };
  }
  const intrinsic = (!widthDefinite && !fixedIntrinsicAxis(options.columns)) || (!heightDefinite && !fixedIntrinsicAxis(options.rows))
    ? measureGridIntrinsic({
      props: input.props,
      style: input.style,
      constraints: {
        width: { kind: 'bounded', min: input.constraints.minWidth, max: input.constraints.maxWidth },
        height: { kind: 'bounded', min: input.constraints.minHeight, max: input.constraints.maxHeight },
      },
      service: input.service,
    })
    : undefined;
  if (intrinsic?.status === 'unsupported') return intrinsic;
  const width = widthDefinite
    ? measuredLength(
        input.style.width!,
        input.constraints.maxWidth,
        'width',
        input.constraints,
      )
    : fixedIntrinsicAxis(options.columns) ? intrinsicTrackSize(options.columns, options.columnGap) : intrinsic!.maxContent.width;
  const height = heightDefinite
    ? measuredLength(
        input.style.height!,
        input.constraints.maxHeight,
        'height',
        input.constraints,
      )
    : fixedIntrinsicAxis(options.rows) ? intrinsicTrackSize(options.rows, options.rowGap) : intrinsic!.maxContent.height;
  return { status: 'measured', size: { width, height } };
}

/**
 * Resolves intrinsic row tracks only after their column areas are known. A
 * paired provider's height is defined at that selected width, so its width-pair
 * height cannot be used as a row contribution.
 */
function measureGridRowsAtSelectedWidth(
  childInput: PibblNodeInput,
  style: Readonly<GridStyle>,
  service: CanvasMeasurementService,
  measure: GridMeasurementInput['measureElement'],
  constraints: Readonly<Constraints>,
  width: number,
): Readonly<{ status: 'measured'; height: number }> | Readonly<{ status: 'unsupported'; reason: string }> {
  if (!Number.isFinite(width) || width < 0 || !Number.isFinite(constraints.maxHeight)) {
    return { status: 'unsupported', reason: 'Grid selected-width row measurement requires finite owner constraints' };
  }
  const container = { x: 0, y: 0, width, height: constraints.maxHeight };
  const options = normalizeGridOptions(style, container);
  if (options.columns.some(trackNeedsIntrinsic)) {
    return { status: 'unsupported', reason: 'Grid selected-width row measurement requires resolved non-intrinsic columns' };
  }
  const children = materializeLayoutChildren(childInput, 'Grid');
  const cells = assignGridCells(children, container, options.columns.length, options.rows.length, options);
  const columns = resolveParsedGridTracks(
    appendImplicitTracks(options.columns, options.autoColumn, maxGridExtent(cells.filter((cell) => cell.normalized.position !== 'absolute'), 'column')),
    width,
    options.columnGap,
    'columns',
    container,
  );
  const rows = appendImplicitTracks(options.rows, options.autoRow, maxGridExtent(cells.filter((cell) => cell.normalized.position !== 'absolute'), 'row'));
  const resolved = new Array<number>(rows.length).fill(0);
  for (let index = 0; index < rows.length; index++) {
    const track = rows[index]!;
    if (track.kind === 'fixed') resolved[index] = track.value;
    else if (track.kind === 'intrinsic') continue;
    else if (track.kind === 'minmax') {
      if (track.min.kind === 'fixed') resolved[index] = track.min.value;
      else if (track.min.kind === 'intrinsic') continue;
      else return { status: 'unsupported', reason: 'Grid selected-width row measurement requires non-fractional, non-percentage row minima' };
    } else {
      return { status: 'unsupported', reason: 'Grid selected-width row measurement requires non-fractional, non-percentage rows' };
    }
  }
  const measurement: GridMeasurementInput = { service, measureElement: measure };
  const contributions = gatherGridIntrinsicContributions(
    rows,
    cells,
    measurement,
    container,
    'rows',
    columns,
    options.columnGap,
  );
  for (let offset = 0; offset < contributions.length; offset += 4) {
    const start = contributions[offset]!;
    const span = contributions[offset + 1]!;
    const height = contributions[offset + 2]!;
    let fixed = Math.max(0, span - 1) * options.rowGap;
    let eligible = 0;
    for (let index = start - 1; index < start - 1 + span; index++) {
      if (trackNeedsIntrinsic(rows[index]!)) eligible++;
      else fixed += resolved[index]!;
    }
    if (!eligible) continue;
    const contribution = Math.max(0, height - fixed) / eligible;
    for (let index = start - 1; index < start - 1 + span; index++) {
      if (trackNeedsIntrinsic(rows[index]!)) {
        resolved[index] = Math.max(resolved[index]!, contribution);
      }
    }
  }
  let height = Math.max(0, rows.length - 1) * options.rowGap;
  for (let index = 0; index < resolved.length; index++) height += resolved[index]!;
  return { status: 'measured', height };
}

function fixedIntrinsicAxis(tracks: readonly ParsedGridTrack[]): boolean {
  return tracks.every(track => track.kind === 'fixed');
}

function intrinsicTrackSize(tracks: readonly ParsedGridTrack[], gap: number): number {
  return tracks.reduce((total, track) => total + (track.kind === 'fixed' ? track.value : 0), Math.max(0, tracks.length - 1) * gap);
}

function measureGridIntrinsic(input: import('../types.js').IntrinsicMeasureInput<GridProps, GridStyle>): import('../types.js').IntrinsicSizesResult {
  const selected = intrinsicGridSelectedWidth(input);
  if (selected !== undefined) {
    const rows = measureGridRowsAtSelectedWidth(
      input.props.children,
      input.style,
      input.service,
      (element, constraints) => measureElement(element, constraints, input.service),
      selected.constraints,
      selected.width,
    );
    if (rows.status === 'unsupported') return rows;
    return {
      status: 'measured',
      minContent: { width: selected.width, height: rows.height },
      maxContent: { width: selected.width, height: rows.height },
    };
  }
  if (containsFractionTrack(input.style.gridTemplateColumns) || containsFractionTrack(input.style.gridTemplateRows)) {
    return { status: 'unsupported', reason: 'Grid fractional intrinsic measurement is allocation-dependent' };
  }
  const width = input.constraints.width.kind === 'bounded' ? input.constraints.width.max : Number.POSITIVE_INFINITY;
  const height = input.constraints.height.kind === 'bounded' ? input.constraints.height.max : Number.POSITIVE_INFINITY;
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return { status: 'unsupported', reason: 'Grid intrinsic measurement requires finite owner constraints' };
  }
  const container = { x: 0, y: 0, width, height };
  const options = normalizeGridOptions(input.style, container);
  if (options.columns.some(track => track.kind === 'percentage') || options.rows.some(track => track.kind === 'percentage')) {
    return { status: 'unsupported', reason: 'Grid percentage intrinsic measurement is allocation-dependent' };
  }
  const children = materializeLayoutChildren(input.props.children, 'Grid');
  const cells = assignGridCells(children, container, options.columns.length, options.rows.length, options);
  const columns = intrinsicGridAxis(options.columns, cells, 'columns', options.columnGap, container, input.service);
  if (columns.status === 'unsupported') return columns;
  const rows = intrinsicGridAxis(options.rows, cells, 'rows', options.rowGap, container, input.service);
  if (rows.status === 'unsupported') return rows;
  return {
    status: 'measured',
    minContent: { width: columns.min, height: rows.min },
    maxContent: { width: columns.max, height: rows.max },
  };
}

/** A declared finite Grid width selects the row-height query width. */
function intrinsicGridSelectedWidth(
  input: import('../types.js').IntrinsicMeasureInput<GridProps, GridStyle>,
): Readonly<{ width: number; constraints: Constraints }> | undefined {
  const widthConstraint = input.constraints.width;
  const heightConstraint = input.constraints.height;
  if (
    input.style.width === undefined ||
    input.style.width === 'auto' ||
    widthConstraint.kind !== 'bounded' ||
    heightConstraint.kind !== 'bounded'
  ) {
    return undefined;
  }
  const constraints: Constraints = {
    minWidth: widthConstraint.min,
    maxWidth: widthConstraint.max,
    minHeight: heightConstraint.min,
    maxHeight: heightConstraint.max,
  };
  const width = resolveScalarSizingLength(input.style.width, widthConstraint.max, 'width', {
    component: 'Grid',
    algorithm: 'intrinsic measurement',
    constraints,
  });
  return width === undefined || width < 0 ? undefined : { width, constraints };
}

function containsFractionTrack(tracks: readonly GridTrack[]): boolean {
  for (const track of tracks) {
    if (typeof track === 'string' && track.endsWith('fr')) return true;
    if (typeof track === 'object' && track !== null && 'kind' in track) {
      if (track.kind === 'minmax' && (typeof track.min === 'string' && track.min.endsWith('fr') || typeof track.max === 'string' && track.max.endsWith('fr'))) return true;
      if (track.kind === 'repeat' && containsFractionTrack(track.tracks)) return true;
    }
  }
  return false;
}

function intrinsicGridAxis(
  tracks: readonly ParsedGridTrack[],
  cells: readonly GridCell[],
  axis: 'columns' | 'rows',
  gap: number,
  container: Readonly<LayoutBox>,
  service: CanvasMeasurementService,
): Readonly<{ status: 'measured'; min: number; max: number }> | Readonly<{ status: 'unsupported'; reason: string }> {
  const minimum = new Array<number>(tracks.length).fill(0);
  const maximum = new Array<number>(tracks.length).fill(0);
  for (let index = 0; index < tracks.length; index++) {
    const track = tracks[index]!;
    if (track.kind === 'fixed') minimum[index] = maximum[index] = track.value;
    else if (track.kind === 'fraction') return { status: 'unsupported', reason: `Grid fractional intrinsic measurement for ${axis} is allocation-dependent` };
    else if (track.kind === 'minmax' && track.max.kind === 'fraction') return { status: 'unsupported', reason: `Grid fractional intrinsic measurement for ${axis} is allocation-dependent` };
  }
  for (const cell of cells) {
    if (cell.normalized.position === 'absolute') continue;
    const start = axis === 'columns' ? cell.columnStart : cell.rowStart;
    const span = axis === 'columns' ? cell.columnSpan : cell.rowSpan;
    if (start < 1 || start + span - 1 > tracks.length) continue;
    const measured = measureIntrinsicElement(cell.child, { minWidth: 0, maxWidth: container.width, minHeight: 0, maxHeight: container.height }, service);
    if (measured.status === 'unsupported') return measured;
    const min = axis === 'columns' ? measured.minContent.width : measured.minContent.height;
    const max = axis === 'columns' ? measured.maxContent.width : measured.maxContent.height;
    let fixed = Math.max(0, span - 1) * gap;
    const eligible: number[] = [];
    for (let index = start - 1; index < start - 1 + span; index++) {
      if (trackNeedsIntrinsic(tracks[index]!)) eligible.push(index);
      else fixed += minimum[index]!;
    }
    if (eligible.length) {
      const minimumContribution = Math.max(0, min - fixed) / eligible.length;
      const maximumContribution = Math.max(0, max - fixed) / eligible.length;
      for (const index of eligible) {
        minimum[index] = Math.max(minimum[index]!, minimumContribution);
        maximum[index] = Math.max(maximum[index]!, maximumContribution);
      }
    }
  }
  const gaps = Math.max(0, tracks.length - 1) * gap;
  return { status: 'measured', min: minimum.reduce((total, value) => total + value, gaps), max: maximum.reduce((total, value) => total + value, gaps) };
}

function measuredLength(
  value: Exclude<BoxStyle['width'], undefined>,
  reference: number,
  property: string,
  constraints: Readonly<Constraints>,
): number {
  const resolved = resolveScalarSizingLength(value, reference, property, {
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
  const rowGap = nonnegativeOption(style.rowGap ?? gap, 'rowGap', container);
  const columnGap = nonnegativeOption(
    style.columnGap ?? gap,
    'columnGap',
    container,
  );
  if (!nativeLayout && (style.gridAutoFlow !== undefined || style.gridAutoColumns !== undefined || style.gridAutoRows !== undefined)) throw optionDiagnostic('gridAutoFlow', style.gridAutoFlow, container, 'requires the native layout engine');
  const gridAutoFlow = style.gridAutoFlow ?? 'row';
  return {
    gridAutoFlow,
    columns: parseGridTracks(
      style.gridTemplateColumns,
      'columns',
      container,
      columnGap,
    ),
    rows: parseGridTracks(style.gridTemplateRows, 'rows', container, rowGap),
    autoColumn: nativeLayout ? parseGridTracks([style.gridAutoColumns ?? 'auto'], 'columns', container)[0]! : { kind: 'fixed' as const, value: 0 },
    autoRow: nativeLayout ? parseGridTracks([style.gridAutoRows ?? 'auto'], 'rows', container)[0]! : { kind: 'fixed' as const, value: 0 },
    autoFitColumns: isAutoFitOnly(style.gridTemplateColumns),
    autoFitRows: isAutoFitOnly(style.gridTemplateRows),
    layoutDirection: getLayoutDirection(),
    justifyItems,
    alignItems,
    rowGap,
    columnGap,
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
  child: PibblElement<any>,
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
  child: PibblElement<any>,
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
  child: PibblElement<any>,
  style: Readonly<Record<string, unknown>>,
  container: Readonly<LayoutBox>,
): void {
  for (let propertyIndex = 0; propertyIndex < unsupportedProperties.length; propertyIndex++) {
    const property = unsupportedProperties[propertyIndex];
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
    algorithm: 'grid',
    constraints: constraintsFor(container),
    reason,
  });
}

function childContext(child: PibblElement<any>, container: Readonly<LayoutBox>) {
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
