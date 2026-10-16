import { Group, Rectangle, resolveSignalValue } from "@pibbl/core";
import type { PibblNode } from "@pibbl/core";
import type {
  Accessor,
  AdjacencyMatrixProps,
  MatrixCellGeometry,
  MatrixCellProps,
  MatrixData,
  MatrixLayout,
  MatrixOptions,
  NodeStyle,
  VizKey,
} from "./types.js";
import {
  defaultGraphLabelStyle,
  GraphLabel,
  resolveMarkStyle,
  useGraphFrame,
} from "./shared.js";

function value<D, V>(accessor: Accessor<D, V>, datum: D): V {
  return typeof accessor === "function"
    ? accessor(datum)
    : (datum as Record<PropertyKey, V>)[accessor];
}
function finite(input: number, name: string, nonnegative = false): number {
  if (!Number.isFinite(input) || (nonnegative && input < 0))
    throw new RangeError(
      `layoutMatrix: ${name} must be finite${nonnegative ? " and nonnegative" : ""}.`,
    );
  return input;
}
function bounds(
  input: MatrixOptions<unknown, unknown, unknown>["bounds"],
): void {
  finite(input.x, "bounds.x");
  finite(input.y, "bounds.y");
  finite(input.width, "bounds.width", true);
  finite(input.height, "bounds.height", true);
}
function label(
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  rotationDegrees = 0,
) {
  return Object.freeze({
    text,
    bounds: Object.freeze({ x, y, width, height }),
    rotationDegrees,
  });
}

/** Computes ordered cells for an explicit row/column relation matrix.
 * @param data - Explicit rows, columns, and ordered relations. See {@link MatrixData}.
 * @param options - Typed accessors, dimensions, labels, and unit. See {@link MatrixOptions}.
 * @returns Immutable cell and label geometry. See {@link MatrixLayout}.
 */
export function layoutMatrix<R, C, E>(
  data: MatrixData<R, C, E>,
  options: MatrixOptions<R, C, E>,
): MatrixLayout<R, C, E> {
  bounds(options.bounds as MatrixOptions<unknown, unknown, unknown>["bounds"]);
  const gap = finite(options.cellGap ?? 2, "cellGap", true);
  const rowLabelWidth = finite(
    options.rowLabelWidth ?? 96,
    "rowLabelWidth",
    true,
  );
  const columnLabelHeight = finite(
    options.columnLabelHeight ?? 54,
    "columnLabelHeight",
    true,
  );
  const rowKeys = new Map<VizKey, R>(),
    columnKeys = new Map<VizKey, C>();
  for (const row of data.rows) {
    const key = value(options.rowKey, row);
    if (rowKeys.has(key))
      throw new Error(`layoutMatrix: duplicate row key ${String(key)}.`);
    rowKeys.set(key, row);
  }
  for (const column of data.columns) {
    const key = value(options.columnKey, column);
    if (columnKeys.has(key))
      throw new Error(`layoutMatrix: duplicate column key ${String(key)}.`);
    columnKeys.set(key, column);
  }
  const width = Math.max(
    0,
    (options.bounds.width -
      rowLabelWidth -
      Math.max(0, data.columns.length - 1) * gap) /
      Math.max(1, data.columns.length),
  );
  const height = Math.max(
    0,
    (options.bounds.height -
      columnLabelHeight -
      Math.max(0, data.rows.length - 1) * gap) /
      Math.max(1, data.rows.length),
  );
  const grouped = new Map<string, E[]>();
  for (const relation of data.relations) {
    const source = value(options.source, relation),
      target = value(options.target, relation);
    if (!rowKeys.has(source))
      throw new RangeError(
        `layoutMatrix: source ${String(source)} is not a row key.`,
      );
    if (!columnKeys.has(target))
      throw new RangeError(
        `layoutMatrix: target ${String(target)} is not a column key.`,
      );
    const amount = value(options.value, relation);
    finite(amount, "relation value");
    const key = `${typeof source}:${String(source)}\u0000${typeof target}:${String(target)}`;
    const records = grouped.get(key);
    if (records) records.push(relation);
    else grouped.set(key, [relation]);
  }
  const cells: MatrixCellGeometry<R, C, E>[] = [];
  const rowLabels = data.rows.map((row, index) =>
    label(
      options.rowLabel
        ? value(options.rowLabel, row)
        : String(value(options.rowKey, row)),
      options.bounds.x,
      options.bounds.y + columnLabelHeight + index * (height + gap),
      rowLabelWidth - gap,
      height,
    ),
  );
  const columnLabels = data.columns.map((column, index) =>
    label(
      options.columnLabel
        ? value(options.columnLabel, column)
        : String(value(options.columnKey, column)),
      options.bounds.x + rowLabelWidth + index * (width + gap),
      options.bounds.y,
      width,
      columnLabelHeight - gap,
    ),
  );
  for (let r = 0; r < data.rows.length; r++)
    for (let c = 0; c < data.columns.length; c++) {
      const row = data.rows[r],
        column = data.columns[c],
        rowKey = value(options.rowKey, row),
        columnKey = value(options.columnKey, column);
      const records =
        grouped.get(
          `${typeof rowKey}:${String(rowKey)}\u0000${typeof columnKey}:${String(columnKey)}`,
        ) ?? [];
      const total = records.reduce(
        (sum, record) => sum + value(options.value, record),
        0,
      );
      finite(total, "cell aggregate");
      const cellBounds = Object.freeze({
        x: options.bounds.x + rowLabelWidth + c * (width + gap),
        y: options.bounds.y + columnLabelHeight + r * (height + gap),
        width,
        height,
      });
      cells.push(
        Object.freeze({
          row,
          column,
          rowKey,
          columnKey,
          records: Object.freeze(records),
          value: records.length ? total : null,
          bounds: cellBounds,
          label: records.length
            ? label(
                options.formatValue
                  ? options.formatValue(total)
                  : `${total} ${options.unit}`,
                cellBounds.x,
                cellBounds.y,
                width,
                height,
              )
            : null,
        }),
      );
    }
  return Object.freeze({
    bounds: Object.freeze({ ...options.bounds }),
    unit: options.unit,
    cells: Object.freeze(cells),
    rowLabels: Object.freeze(rowLabels),
    columnLabels: Object.freeze(columnLabels),
  });
}

/** Default cell paint for custom matrix compositions.
 * @param cell - Cell geometry.
 * @param range - Observed numeric extent.
 * @returns Resolved cell paint.
 * @see {@link MatrixCell}
 */
export function defaultMatrixCellStyle<R, C, E>(
  cell: MatrixCellGeometry<R, C, E>,
  range: Readonly<{ minimum: number; maximum: number }>,
): NodeStyle {
  const value = cell.value ?? 0,
    span = range.maximum - range.minimum;
  const alpha =
    cell.value === null
      ? 0.05
      : span <= 0
        ? 0.8
        : 0.16 +
          0.74 * Math.max(0, Math.min(1, (value - range.minimum) / span));
  return { fill: `rgba(15, 118, 110, ${alpha})`, cornerRadius: 2 };
}

/** Draw one supplied matrix cell geometry.
 * @param argument - Cell props.
 * @returns Canvas node.
 * @see {@link MatrixCellProps}
 */
export function MatrixCell<R, C, E>({
  cell,
  style: input,
  children,
  ...events
}: MatrixCellProps<R, C, E>): PibblNode {
  const style = resolveSignalValue(input) ?? {};
  return (
    <Group>
      <Rectangle
        {...events}
        style={{
          ...style,
          left: cell.bounds.x,
          top: cell.bounds.y,
          width: cell.bounds.width,
          height: cell.bounds.height,
        }}
      />
      {children}
    </Group>
  );
}

/** Render an ordered relation matrix with default marks and labels.
 * @param props - Matrix data and presentation.
 * @returns Canvas node.
 * @see {@link layoutMatrix}
 */
export function AdjacencyMatrix<R, C, E>(
  props: AdjacencyMatrixProps<R, C, E>,
): PibblNode {
  const frame = useGraphFrame(props.style);
  if (!frame.bounds.width || !frame.bounds.height)
    return <Group style={frame.groupStyle}>{null}</Group>;
  const data = resolveSignalValue(props.data);
  const style = frame.style;
  const layout = layoutMatrix(data, {
    ...props,
    bounds: frame.bounds,
    cellGap: style.cellGap,
    rowLabelWidth: style.rowLabelWidth,
    columnLabelHeight: style.columnLabelHeight,
  });
  const values = layout.cells
    .map((cell) => cell.value)
    .filter((entry): entry is number => entry !== null);
  const minimum = Math.min(...values, 0),
    maximum = Math.max(...values, 1);
  return (
    <Group style={frame.groupStyle}>
      {layout.cells.map((cell) => (
        <Group
          key={JSON.stringify([cell.rowKey, cell.columnKey])}
          onClick={(event) => props.onCellClick?.(cell, event)}
        >
          {props.renderCell ? (
            props.renderCell(cell)
          ) : (
            <Group>
              <MatrixCell
                cell={cell}
                keyboardFocusable={Boolean(props.onCellClick)}
                style={{
                  ...defaultMatrixCellStyle(cell, { minimum, maximum }),
                  ...resolveMarkStyle(cell, props.cellStyle),
                }}
              />
              {cell.label && (
                <GraphLabel
                  label={cell.label}
                  style={{
                    ...defaultGraphLabelStyle(cell.label),
                    fill:
                      cell.value !== null &&
                      (cell.value - minimum) / (maximum - minimum || 1) >= 0.5
                        ? "#ffffff"
                        : "#123c34",
                    textAlign: "center",
                    ...resolveSignalValue(props.labelStyle),
                  }}
                />
              )}
            </Group>
          )}
        </Group>
      ))}
      {layout.rowLabels.concat(layout.columnLabels).map((entry, index) => (
        <GraphLabel
          key={`axis-${index}`}
          label={entry}
          style={{
            ...defaultGraphLabelStyle(entry),
            ...resolveSignalValue(props.labelStyle),
          }}
        />
      ))}
    </Group>
  );
}
