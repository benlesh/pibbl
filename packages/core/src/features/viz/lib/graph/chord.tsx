import {
  Group,
  SvgPath,
  resolveSignalValue,
  PathGeometry,
  toSvgPathData,
} from "@pibbl/core";
import type { PathSegment, PibblNode } from "@pibbl/core";
import type {
  Accessor,
  ChordBandGeometry,
  ChordData,
  ChordDiagramProps,
  ChordLayout,
  ChordOptions,
  ChordRibbonGeometry,
  EdgeStyle,
  MarkInteraction,
  Style,
  VizKey,
} from "./types.js";
import {
  defaultGraphLabelStyle,
  GraphLabel,
  resolveMarkStyle,
  useGraphFrame,
} from "./shared.js";

function access<D, V>(input: Accessor<D, V>, datum: D): V {
  return typeof input === "function"
    ? input(datum)
    : (datum as Record<PropertyKey, V>)[input];
}
function finite(value: number, name: string, zero = false) {
  if (!Number.isFinite(value) || (zero && value < 0))
    throw new RangeError(
      `layoutChords: ${name} must be finite${zero ? " and nonnegative" : ""}.`,
    );
  return value;
}
function point(cx: number, cy: number, radius: number, degrees: number) {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return {
    x: cx + Math.cos(radians) * radius,
    y: cy + Math.sin(radians) * radius,
  };
}
function svg(segments: readonly PathSegment[]) {
  const geometry = new PathGeometry();
  geometry.spliceSegments(0, 0, segments);
  return toSvgPathData(geometry);
}
function bandSegments(
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  start: number,
  end: number,
): readonly PathSegment[] {
  const first = point(cx, cy, outer, start),
    last = point(cx, cy, inner, end),
    radians = Math.PI / 180;
  return Object.freeze([
    { type: "move", ...first },
    {
      type: "arc",
      cx,
      cy,
      ux: outer,
      uy: 0,
      vx: 0,
      vy: outer,
      startAngle: (start - 90) * radians,
      sweep: (end - start) * radians,
    },
    { type: "line", ...last },
    {
      type: "arc",
      cx,
      cy,
      ux: inner,
      uy: 0,
      vx: 0,
      vy: inner,
      startAngle: (end - 90) * radians,
      sweep: (start - end) * radians,
    },
    { type: "close" },
  ] as PathSegment[]);
}

/** Computes a directed chord layout, aggregating repeated ordered transfer pairs.
 * @param data - Ordered category transfers. See {@link ChordData}.
 * @param options - Accessors, bounds, angular spacing, and unit. See {@link ChordOptions}.
 * @returns Immutable bands and directed ribbon geometry. See {@link ChordLayout}.
 */
export function layoutChords<C, T>(
  data: ChordData<C, T>,
  options: ChordOptions<C, T>,
): ChordLayout<C, T> {
  const b = options.bounds;
  finite(b.x, "bounds.x");
  finite(b.y, "bounds.y");
  finite(b.width, "bounds.width", true);
  finite(b.height, "bounds.height", true);
  const width = finite(options.bandWidth ?? 20, "bandWidth", true),
    pad = finite(options.padAngle ?? 2, "padAngle", true),
    start = finite(options.startAngle ?? 0, "startAngle");
  if (data.categories.length * pad >= 360 && data.categories.length)
    throw new RangeError(
      "layoutChords: total padAngle must be less than 360 degrees.",
    );
  const categories = new Map<VizKey, C>();
  for (const category of data.categories) {
    const key = access(options.categoryKey, category);
    if (categories.has(key))
      throw new Error(`layoutChords: duplicate category key ${String(key)}.`);
    categories.set(key, category);
  }
  const groups = new Map<
    string,
    { source: VizKey; target: VizKey; records: T[]; value: number }
  >();
  const incoming = new Map<VizKey, number>(),
    outgoing = new Map<VizKey, number>();
  for (const key of categories.keys()) {
    incoming.set(key, 0);
    outgoing.set(key, 0);
  }
  for (const transfer of data.transfers) {
    const source = access(options.source, transfer),
      target = access(options.target, transfer),
      amount = finite(access(options.value, transfer), "transfer value", true);
    if (!categories.has(source) || !categories.has(target))
      throw new RangeError(
        "layoutChords: transfer endpoint is not a category key.",
      );
    incoming.set(
      target,
      finite(incoming.get(target)! + amount, "incoming total", true),
    );
    outgoing.set(
      source,
      finite(outgoing.get(source)! + amount, "outgoing total", true),
    );
    const id = `chord:${typeof source}:${String(source)}\u0000${typeof target}:${String(target)}`;
    const prior = groups.get(id);
    if (prior) {
      prior.records.push(transfer);
      prior.value = finite(prior.value + amount, "transfer total", true);
    } else
      groups.set(id, { source, target, records: [transfer], value: amount });
  }
  const total = Array.from(groups.values()).reduce(
    (sum, entry) => sum + entry.value,
    0,
  );
  const cx = b.x + b.width / 2,
    cy = b.y + b.height / 2,
    radius = Math.max(0, Math.min(b.width, b.height) / 2 - 28),
    inner = Math.max(0, radius - width);
  const weight = Array.from(categories.keys()).map(
    (key) => incoming.get(key)! + outgoing.get(key)!,
  );
  const sum = weight.reduce((a, n) => a + n, 0);
  finite(total, "transfer total", true);
  finite(sum, "incident total", true);
  const usable = 360 - data.categories.length * pad;
  let angle = start;
  const bands: ChordBandGeometry<C>[] = [];
  const arcs = new Map<
    VizKey,
    { start: number; end: number; cursor: number }
  >();
  for (let index = 0; index < data.categories.length; index++) {
    const datum = data.categories[index],
      key = access(options.categoryKey, datum),
      span = sum === 0 ? 0 : (weight[index] / sum) * usable,
      arc = Object.freeze({
        center: Object.freeze({ x: cx, y: cy }),
        radius,
        startAngleDegrees: angle,
        endAngleDegrees: angle + span,
      });
    const segments = bandSegments(cx, cy, radius, inner, angle, angle + span);
    const mid = angle + span / 2,
      labelPoint = point(cx, cy, radius + 18, mid);
    const label = Object.freeze({
      text: options.label ? access(options.label, datum) : String(key),
      bounds: Object.freeze({
        x: labelPoint.x - 45,
        y: labelPoint.y - 10,
        width: 90,
        height: 20,
      }),
      rotationDegrees: 0,
    });
    bands.push(
      Object.freeze({
        key,
        datum,
        incomingValue: incoming.get(key)!,
        outgoingValue: outgoing.get(key)!,
        arc,
        innerRadius: inner,
        segments,
        path: svg(segments),
        label,
      }),
    );
    arcs.set(key, { start: angle, end: angle + span, cursor: angle });
    angle += span + pad;
  }
  const ribbons: ChordRibbonGeometry<T>[] = [];
  for (const entry of groups.values()) {
    if (entry.value === 0) continue;
    const source = arcs.get(entry.source)!,
      target = arcs.get(entry.target)!;
    const sourceWeight =
        incoming.get(entry.source)! + outgoing.get(entry.source)!,
      targetWeight = incoming.get(entry.target)! + outgoing.get(entry.target)!;
    const sourceSpan =
        sourceWeight === 0
          ? 0
          : ((source.end - source.start) * entry.value) / sourceWeight,
      targetSpan =
        targetWeight === 0
          ? 0
          : ((target.end - target.start) * entry.value) / targetWeight;
    const sourceArc = Object.freeze({
      center: Object.freeze({ x: cx, y: cy }),
      radius: inner,
      startAngleDegrees: source.cursor,
      endAngleDegrees: source.cursor + sourceSpan,
    });
    source.cursor += sourceSpan;
    const targetStart = target.cursor;
    const targetArc = Object.freeze({
      center: Object.freeze({ x: cx, y: cy }),
      radius: inner,
      startAngleDegrees: targetStart,
      endAngleDegrees: targetStart + targetSpan,
    });
    target.cursor += targetSpan;
    const a = point(cx, cy, inner, sourceArc.startAngleDegrees),
      d = point(cx, cy, inner, targetArc.startAngleDegrees);
    const segments = Object.freeze([
      { type: "move" as const, ...a },
      {
        type: "arc" as const,
        cx,
        cy,
        ux: inner,
        uy: 0,
        vx: 0,
        vy: inner,
        startAngle: ((sourceArc.startAngleDegrees - 90) * Math.PI) / 180,
        sweep:
          ((sourceArc.endAngleDegrees - sourceArc.startAngleDegrees) *
            Math.PI) /
          180,
      },
      {
        type: "quadratic" as const,
        cpx: cx,
        cpy: cy,
        x: d.x,
        y: d.y,
      },
      {
        type: "arc" as const,
        cx,
        cy,
        ux: inner,
        uy: 0,
        vx: 0,
        vy: inner,
        startAngle: ((targetArc.startAngleDegrees - 90) * Math.PI) / 180,
        sweep:
          ((targetArc.endAngleDegrees - targetArc.startAngleDegrees) *
            Math.PI) /
          180,
      },
      {
        type: "quadratic" as const,
        cpx: cx,
        cpy: cy,
        x: a.x,
        y: a.y,
      },
      { type: "close" as const },
    ]);
    ribbons.push(
      Object.freeze({
        key: `${typeof entry.source}:${String(entry.source)}\u0000${typeof entry.target}:${String(entry.target)}`,
        sourceKey: entry.source,
        targetKey: entry.target,
        records: Object.freeze(entry.records),
        value: entry.value,
        sourceArc,
        targetArc,
        segments,
        path: svg(segments),
      }),
    );
  }
  return Object.freeze({
    bounds: Object.freeze({ ...b }),
    unit: options.unit,
    total,
    bands: Object.freeze(bands),
    ribbons: Object.freeze(ribbons),
  });
}

/** Default outer-band paint for custom chord compositions.
 * @param _band - Band geometry.
 * @returns Resolved band paint.
 * @see {@link ChordBand}
 */
export function defaultChordBandStyle<C>(
  _band: ChordBandGeometry<C>,
): EdgeStyle {
  return { fill: "#0f766e" };
}
/** Default directed-ribbon paint for custom chord compositions.
 * @param _ribbon - Ribbon geometry.
 * @returns Resolved ribbon paint.
 * @see {@link ChordRibbon}
 */
export function defaultChordRibbonStyle<T>(
  _ribbon: ChordRibbonGeometry<T>,
): EdgeStyle {
  return { fill: "rgba(15, 118, 110, 0.3)" };
}
/** Draw one supplied category band.
 * @param argument - Band props.
 * @returns Canvas node.
 * @see {@link ChordBandGeometry}
 */
export function ChordBand<C>({
  band,
  style: input,
  ...events
}: MarkInteraction & {
  readonly band: ChordBandGeometry<C>;
  readonly style?: Style<EdgeStyle>;
}): PibblNode {
  return (
    <SvgPath
      {...events}
      style={{ ...(resolveSignalValue(input) ?? {}), d: band.path }}
    />
  );
}
/** Draw one supplied directed ribbon.
 * @param argument - Ribbon props.
 * @returns Canvas node.
 * @see {@link ChordRibbonGeometry}
 */
export function ChordRibbon<T>({
  ribbon,
  style: input,
  ...events
}: MarkInteraction & {
  readonly ribbon: ChordRibbonGeometry<T>;
  readonly style?: Style<EdgeStyle>;
}): PibblNode {
  return (
    <SvgPath
      {...events}
      style={{ ...(resolveSignalValue(input) ?? {}), d: ribbon.path }}
    />
  );
}
/** Render a directed transfer chord diagram.
 * @param props - Transfer data and presentation.
 * @returns Canvas node.
 * @see {@link layoutChords}
 */
export function ChordDiagram<C, T>(props: ChordDiagramProps<C, T>): PibblNode {
  const frame = useGraphFrame(props.style),
    style = frame.style;
  if (!frame.bounds.width || !frame.bounds.height)
    return <Group style={frame.groupStyle}>{null}</Group>;
  const layout = layoutChords(resolveSignalValue(props.data), {
    ...props,
    bounds: frame.bounds,
    bandWidth: style.bandWidth,
    padAngle: style.padAngle,
    startAngle: style.startAngle,
  });
  return (
    <Group style={frame.groupStyle}>
      {layout.ribbons.map((ribbon) => (
        <Group
          key={ribbon.key}
          onClick={(event) => props.onRibbonClick?.(ribbon, event)}
        >
          {props.renderRibbon ? (
            props.renderRibbon(ribbon)
          ) : (
            <ChordRibbon
              ribbon={ribbon}
              keyboardFocusable={Boolean(props.onRibbonClick)}
              style={{
                ...defaultChordRibbonStyle(ribbon),
                ...resolveMarkStyle(ribbon, props.ribbonStyle),
              }}
            />
          )}
        </Group>
      ))}
      {layout.bands.map((band) => (
        <Group
          key={String(band.key)}
          onClick={(event) => props.onBandClick?.(band, event)}
        >
          {props.renderBand ? (
            props.renderBand(band)
          ) : (
            <Group>
              <ChordBand
                band={band}
                style={{
                  ...defaultChordBandStyle(band),
                  ...resolveMarkStyle(band, props.bandStyle),
                }}
              />
              <GraphLabel
                label={band.label}
                style={{
                  ...defaultGraphLabelStyle(band.label),
                  ...resolveSignalValue(props.labelStyle),
                }}
              />
            </Group>
          )}
        </Group>
      ))}
    </Group>
  );
}
