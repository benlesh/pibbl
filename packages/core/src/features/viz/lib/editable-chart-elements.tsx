import {
  Line,
  Rectangle,
  definePrimitive,
  resolveSignalValue,
  useRef,
  useSignal,
  type PibblNodeInput,
  type PibblRef,
  type SignalValue,
} from "@pibbl/core";
import {
  pibblInternalCurrentWorldTransform,
  type SignalStyle,
} from "@pibbl/core/internal";
import type {
  PibblEventTarget,
  PibblKeyboardEvent,
  PibblPointerEvent,
} from "@pibbl/core";
import type { ScaleId } from "./types.js";
import { lookupScale } from "./scale-context.js";

/** One numeric x/y domain anchor for {@link EditableTrendLine}. */
export interface ChartAnchor {
  /** X-scale domain value; an exact supplied timestamp for a trading-time x scale. */
  readonly x: number;
  /** Y-scale numeric domain value. */
  readonly y: number;
}
/** Paint and hit-area fields shared by {@link RangeNavigator} and editable annotations. */
export interface EditableChartStyle {
  /** Fill for navigator and reference-band interiors. */
  readonly fill?: string;
  /** Stroke color for visible annotation geometry. */
  readonly stroke?: string;
  /** Positive width of visible strokes. */
  readonly strokeWidth?: number;
  /** Annotation opacity from zero through one; handles remain fully opaque. */
  readonly opacity?: number;
  /** Fill color for visible drag handles. */
  readonly handleFill?: string;
  /** Stroke color for visible drag handles. */
  readonly handleStroke?: string;
  /** Positive square size of the painted handle. */
  readonly handleSize?: number;
  /** Positive width and height of each invisible pointer hit region. */
  readonly hitSize?: number;
}
/** {@link EditableChartStyle} accepted by {@link RangeNavigator}. */
export interface RangeNavigatorStyle extends EditableChartStyle {}
/** {@link EditableChartStyle} accepted by {@link EditableReferenceLine}. */
export interface EditableReferenceLineStyle extends EditableChartStyle {}
/** {@link EditableChartStyle} accepted by {@link EditableReferenceBand}. */
export interface EditableReferenceBandStyle extends EditableChartStyle {}
/** {@link EditableChartStyle} accepted by {@link EditableTrendLine}. */
export interface EditableTrendLineStyle extends EditableChartStyle {}
type Pair = readonly [number, number];
type StyleInput<S extends EditableChartStyle> = SignalValue<SignalStyle<S>>;
type Change<T> = (value: T) => void;
/** Controlled inputs and callbacks for {@link RangeNavigator}. */
export interface RangeNavigatorProps {
  /** ID of an ancestor invertible numeric continuous scale. */
  readonly scale: ScaleId;
  /** Controlled numeric interval in the scale domain. */
  readonly values: SignalValue<Pair>;
  /** Perpendicular local-coordinate start and end for the navigator strip. */
  readonly span: SignalValue<Pair>;
  /** Minimum numeric distance between interval endpoints; defaults to zero. */
  readonly minimumSpan?: number;
  /** Receives each synchronous controlled drag or keyboard interval. */
  readonly onChange: Change<Pair>;
  /** Receives the final interval after a completed pointer or keyboard edit. */
  readonly onCommit?: Change<Pair>;
  /** Runs after a cancelled interaction restores its starting interval. */
  readonly onCancel?: () => void;
  /** Optional annotation and handle paint inputs. */
  readonly style?: StyleInput<RangeNavigatorStyle>;
}
/** Controlled inputs and callbacks for {@link EditableReferenceLine}. */
export interface EditableReferenceLineProps {
  /** ID of an ancestor invertible numeric continuous scale. */
  readonly scale: ScaleId;
  /** Axis perpendicular to the drawn line and edited value. */
  readonly direction: "horizontal" | "vertical";
  /** Controlled numeric value in the scale domain. */
  readonly value: SignalValue<number>;
  /** Local-coordinate extent of the line along its non-edited axis. */
  readonly span: SignalValue<Pair>;
  /** Whether endpoint-independent handle geometry is drawn; defaults to true. */
  readonly selected?: SignalValue<boolean>;
  /** Finite positive numeric domain increment for arrow-key edits. */
  readonly keyboardStep: number;
  /** Runs when a pointer or keyboard interaction selects the line. */
  readonly onSelect?: () => void;
  /** Receives each synchronous controlled drag or keyboard value. */
  readonly onChange: Change<number>;
  /** Receives the final value after a completed pointer or keyboard edit. */
  readonly onCommit?: Change<number>;
  /** Runs after a cancelled interaction restores its starting value. */
  readonly onCancel?: () => void;
  /** Optional line and handle paint inputs. */
  readonly style?: StyleInput<EditableReferenceLineStyle>;
}
/** Controlled inputs and callbacks for {@link EditableReferenceBand}. */
export interface EditableReferenceBandProps {
  /** ID of an ancestor invertible numeric continuous scale. */
  readonly scale: ScaleId;
  /** Axis perpendicular to the band and edited interval. */
  readonly direction: "horizontal" | "vertical";
  /** Controlled numeric interval in the scale domain. */
  readonly values: SignalValue<Pair>;
  /** Local-coordinate extent of the band along its non-edited axis. */
  readonly span: SignalValue<Pair>;
  /** Whether resize handles are drawn; defaults to true. */
  readonly selected?: SignalValue<boolean>;
  /** Finite positive numeric domain increment for arrow-key panning. */
  readonly keyboardStep: number;
  /** Minimum numeric distance between interval endpoints; defaults to zero. */
  readonly minimumSpan?: number;
  /** Runs when a pointer or keyboard interaction selects the band. */
  readonly onSelect?: () => void;
  /** Receives each synchronous controlled drag or keyboard interval. */
  readonly onChange: Change<Pair>;
  /** Receives the final interval after a completed pointer or keyboard edit. */
  readonly onCommit?: Change<Pair>;
  /** Runs after a cancelled interaction restores its starting interval. */
  readonly onCancel?: () => void;
  /** Optional band and handle paint inputs. */
  readonly style?: StyleInput<EditableReferenceBandStyle>;
}
/** Controlled inputs and callbacks for {@link EditableTrendLine}. */
export interface EditableTrendLineProps {
  /** ID of an ancestor numeric or TradingTimeScale x mapping. */
  readonly xScale: ScaleId;
  /** ID of an ancestor invertible numeric y mapping. */
  readonly yScale: ScaleId;
  /** Controlled pair of domain anchors forming the line. */
  readonly anchors: SignalValue<readonly [ChartAnchor, ChartAnchor]>;
  /** Whether endpoint handles are drawn; defaults to true. */
  readonly selected?: SignalValue<boolean>;
  /** Finite positive x and y increments for arrow-key translation. */
  readonly keyboardStep: {
    /** Numeric-domain or timestamp increment for x translation. */
    readonly x: number;
    /** Numeric-domain increment for y translation. */
    readonly y: number;
  };
  /** Runs when a pointer or keyboard interaction selects the trend line. */
  readonly onSelect?: () => void;
  /** Receives each synchronous controlled drag or keyboard anchor pair. */
  readonly onChange: Change<readonly [ChartAnchor, ChartAnchor]>;
  /** Receives final anchors after a completed pointer or keyboard edit. */
  readonly onCommit?: Change<readonly [ChartAnchor, ChartAnchor]>;
  /** Runs after a cancelled interaction restores its starting anchors. */
  readonly onCancel?: () => void;
  /** Optional line and handle paint inputs. */
  readonly style?: StyleInput<EditableTrendLineStyle>;
}

type Scale = {
  readonly type: string;
  readonly domain: readonly number[];
  readonly range: Pair;
  map(value: number): number;
  invert?(position: number): number;
  nearestTimeAtPosition?(position: number): number | undefined;
  slotAtTime?(time: number): number | undefined;
  timeAtSlot?(slot: number): number | undefined;
};
type Point = Readonly<{ x: number; y: number }>;
type Draft<T, M extends string> = Readonly<{
  pointerId: number;
  target: PibblEventTarget;
  inverse: DOMMatrix;
  start: Point;
  original: T;
  last: T;
  mode: M;
  /** Resolved scale instances at pointer-down, stable for the transaction. */
  scales: readonly Scale[];
}>;
type DraftSignal<T, M extends string> = ReturnType<
  typeof useSignal<Draft<T, M> | null>
>;
interface TransformCaptureProps {
  readonly capture: PibblRef<DOMMatrix>;
  readonly children: PibblNodeInput;
}
const TransformCapture = definePrimitive<TransformCaptureProps>(
  function TransformCapture(props) {
    props.capture.current = pibblInternalCurrentWorldTransform();
    return props.children;
  },
  { childInput: "structural" },
);

function pair(value: unknown, name: string): Pair {
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    !value.every(Number.isFinite)
  )
    throw new RangeError(`${name} requires two finite values.`);
  return value as unknown as Pair;
}
function positive(value: number, name: string) {
  if (!Number.isFinite(value) || value <= 0)
    throw new RangeError(`${name} must be finite and positive.`);
  return value;
}
function nonnegative(value: number, name: string) {
  if (!Number.isFinite(value) || value < 0)
    throw new RangeError(`${name} must be finite and non-negative.`);
  return value;
}
function clamp(value: number, values: readonly number[]) {
  return Math.max(Math.min(...values), Math.min(Math.max(...values), value));
}
function clip(value: number, scale: Scale) {
  return clamp(value, scale.domain);
}
function range(
  first: number,
  second: number,
  viewport: Pair,
): Pair | undefined {
  const low = Math.max(Math.min(first, second), Math.min(...viewport)),
    high = Math.min(Math.max(first, second), Math.max(...viewport));
  return high < low ? undefined : [low, high];
}
function style<S extends EditableChartStyle>(
  input: StyleInput<S> | undefined,
): Required<EditableChartStyle> {
  const source = resolveSignalValue(input ?? {}) as SignalStyle<S>;
  const opacity = resolveSignalValue(source.opacity) ?? 1,
    strokeWidth = resolveSignalValue(source.strokeWidth) ?? 1.5,
    handleSize = resolveSignalValue(source.handleSize) ?? 8,
    hitSize = resolveSignalValue(source.hitSize) ?? 20;
  if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1)
    throw new RangeError(
      "Editable chart style opacity must be finite from zero through one.",
    );
  positive(strokeWidth, "Editable chart style strokeWidth");
  positive(handleSize, "Editable chart style handleSize");
  positive(hitSize, "Editable chart style hitSize");
  const fill = resolveSignalValue(source.fill) ?? "#2563eb",
    stroke = resolveSignalValue(source.stroke) ?? "#2563eb",
    handleFill = resolveSignalValue(source.handleFill) ?? fill,
    handleStroke = resolveSignalValue(source.handleStroke) ?? stroke;
  for (const [name, value] of Object.entries({
    fill,
    stroke,
    handleFill,
    handleStroke,
  }))
    if (typeof value !== "string")
      throw new TypeError(`Editable chart style ${name} must be a string.`);
  return {
    fill,
    stroke,
    strokeWidth,
    opacity,
    handleFill,
    handleStroke,
    handleSize,
    hitSize,
  };
}
function scale(
  id: ScaleId,
  receiver: string,
  options: Readonly<{ allowTradingTime?: boolean }> = {},
): Scale {
  const source = lookupScale(id, receiver);
  if (!source)
    throw new TypeError(`${receiver} requires an ancestor scale ID.`);
  const value = source.get() as Scale;
  if (value.type === "point" || value.type === "band")
    throw new TypeError(`${receiver} requires a continuous scale.`);
  if (value.type === "trading-time" && !options.allowTradingTime)
    throw new TypeError(
      `${receiver} requires an invertible numeric continuous scale, not TradingTimeScale.`,
    );
  if (
    !Array.isArray(value.domain) ||
    value.domain.length < 2 ||
    !value.domain.every(Number.isFinite) ||
    !Array.isArray(value.range) ||
    value.range.length !== 2 ||
    !value.range.every(Number.isFinite) ||
    typeof value.map !== "function"
  )
    throw new TypeError(`${receiver} requires a finite numeric scale.`);
  if (value.type !== "trading-time" && typeof value.invert !== "function")
    throw new TypeError(`${receiver} requires an invertible continuous scale.`);
  if (
    value.type === "trading-time" &&
    (!value.nearestTimeAtPosition || !value.slotAtTime || !value.timeAtSlot)
  )
    throw new TypeError(`${receiver} requires a TradingTimeScale mapping.`);
  return value;
}
function local(
  inverse: DOMMatrix,
  event: Pick<PibblPointerEvent, "x" | "y">,
): Point {
  const point = inverse.transformPoint(new DOMPoint(event.x, event.y));
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y))
    throw new RangeError(
      "Editable chart interaction requires an invertible finite transform.",
    );
  return point;
}
function begin<T, M extends string>(
  state: DraftSignal<T, M>,
  event: PibblPointerEvent,
  original: T,
  mode: M,
  world: DOMMatrix | undefined,
  scales: readonly Scale[],
) {
  if (!world || state.get()) return;
  const inverse = world.inverse(),
    draft: Draft<T, M> = {
      pointerId: event.pointerId,
      target: event.currentTarget,
      inverse,
      start: local(inverse, event),
      original,
      last: original,
      mode,
      scales: [...scales],
    };
  state.set(draft);
  event.currentTarget.setPointerCapture(event.pointerId);
  event.stopPropagation();
}
function publish<T, M extends string>(
  state: DraftSignal<T, M>,
  active: Draft<T, M>,
  next: T,
  onChange: Change<T>,
) {
  onChange(next);
  state.set({ ...active, last: next });
}
function release<T, M extends string>(
  state: DraftSignal<T, M>,
  active: Draft<T, M>,
) {
  // Native release may synchronously dispatch lostpointercapture. Clear the
  // transaction first so an intentional release cannot roll itself back.
  state.set(null);
  if (active.target.hasPointerCapture(active.pointerId))
    active.target.releasePointerCapture(active.pointerId);
}
function keys(
  event: PibblKeyboardEvent,
  cancel: () => void,
  edit: (sign: number) => void,
) {
  if (event.key === "Escape") {
    event.preventDefault();
    cancel();
    return;
  }
  const sign =
    event.key === "ArrowLeft" || event.key === "ArrowDown"
      ? -1
      : event.key === "ArrowRight" || event.key === "ArrowUp"
        ? 1
        : 0;
  if (sign) {
    event.preventDefault();
    edit(sign);
  }
}
function edge(
  values: Pair,
  which: "first" | "second",
  value: number,
  minimum: number,
  source: Scale,
  bounded: boolean,
): Pair {
  const [first, second] = values;
  const domainLow = Math.min(...source.domain),
    domainHigh = Math.max(...source.domain);
  if (which === "first") {
    const limit = first <= second ? second - minimum : second + minimum;
    return [
      first <= second
        ? bounded
          ? clamp(value, [domainLow, limit])
          : Math.min(value, limit)
        : bounded
          ? clamp(value, [limit, domainHigh])
          : Math.max(value, limit),
      second,
    ];
  }
  const limit = first <= second ? first + minimum : first - minimum;
  return [
    first,
    first <= second
      ? bounded
        ? clamp(value, [limit, domainHigh])
        : Math.max(value, limit)
      : bounded
        ? clamp(value, [domainLow, limit])
        : Math.min(value, limit),
  ];
}
function pan(
  values: Pair,
  delta: number,
  source: Scale,
  bounded: boolean,
): Pair {
  if (!bounded) return [values[0] + delta, values[1] + delta];
  const low = Math.min(...values),
    high = Math.max(...values),
    permitted = clamp(delta, [
      Math.min(...source.domain) - low,
      Math.max(...source.domain) - high,
    ]);
  return [values[0] + permitted, values[1] + permitted];
}
function minimumMappedDelta(
  points: Pair,
  requested: number,
  source: Scale,
  minimum: number,
) {
  if (!minimum) return requested;
  const width = (delta: number) =>
    Math.abs(
      source.invert!(points[1] + delta) - source.invert!(points[0] + delta),
    );
  let previous = 0;
  for (let index = 1; index <= 64; index++) {
    const candidate = (requested * index) / 64;
    if (width(candidate) >= minimum) {
      previous = candidate;
      continue;
    }
    let low = previous,
      high = candidate;
    for (let iteration = 0; iteration < 40; iteration++) {
      const middle = (low + high) / 2;
      if (width(middle) >= minimum) low = middle;
      else high = middle;
    }
    return low;
  }
  return requested;
}
function panMapped(
  values: Pair,
  requested: number,
  source: Scale,
  bounded: boolean,
  minimum: number,
): Pair {
  const positions: Pair = [source.map(values[0]), source.map(values[1])],
    viewportDelta = bounded
      ? sharedMappedDelta(positions, requested, source.range)
      : requested,
    delta = minimumMappedDelta(positions, viewportDelta, source, minimum);
  if (bounded)
    return [
      clip(source.invert!(positions[0] + delta), source),
      clip(source.invert!(positions[1] + delta), source),
    ];
  return [
    source.invert!(positions[0] + delta),
    source.invert!(positions[1] + delta),
  ];
}
function navigatorInterval(
  values: Pair,
  minimum: number,
  source: Scale,
  receiver: string,
) {
  const domainLow = Math.min(...source.domain),
    domainHigh = Math.max(...source.domain),
    domainSpan = domainHigh - domainLow;
  if (minimum > domainSpan)
    throw new RangeError(
      `${receiver} minimumSpan cannot exceed its scale domain span.`,
    );
  if (values.some((value) => value < domainLow || value > domainHigh))
    throw new RangeError(
      `${receiver} values must lie within its scale domain.`,
    );
  if (Math.abs(values[1] - values[0]) < minimum)
    throw new RangeError(`${receiver} values must meet minimumSpan.`);
}
function annotationInterval(values: Pair, minimum: number, receiver: string) {
  if (Math.abs(values[1] - values[0]) < minimum)
    throw new RangeError(`${receiver} values must meet minimumSpan.`);
}
function handle(
  x: number,
  y: number,
  paint: Required<EditableChartStyle>,
  handlers: Record<string, unknown>,
) {
  const visual = {
      left: x - paint.handleSize / 2,
      top: y - paint.handleSize / 2,
      width: paint.handleSize,
      height: paint.handleSize,
    },
    hit = {
      left: x - paint.hitSize / 2,
      top: y - paint.hitSize / 2,
      width: paint.hitSize,
      height: paint.hitSize,
    };
  return (
    <>
      <Rectangle
        pointerEvents="none"
        style={{
          ...visual,
          fill: paint.handleFill,
          stroke: paint.handleStroke,
          strokeWidth: paint.strokeWidth,
          opacity: 1,
        }}
      />
      <Rectangle
        {...handlers}
        keyboardFocusable
        style={{ ...hit, fill: "rgba(0,0,0,0)", cursor: "grab" }}
      />
    </>
  );
}
function sharedMappedDelta(
  points: readonly number[],
  requested: number,
  viewport: Pair,
) {
  return clamp(requested, [
    Math.min(...viewport) - Math.min(...points),
    Math.max(...viewport) - Math.max(...points),
  ]);
}

/**
 * Renders a controlled overview interval with pan and edge-resize handles.
 *
 * @param props - Controlled range inputs and callbacks; see {@link RangeNavigatorProps}.
 * @returns Navigator geometry, handles, or no geometry when outside the visible scale range.
 * @see {@link EditableReferenceBand} for a directional plot interval.
 */
export function RangeNavigator(props: RangeNavigatorProps) {
  const values = pair(
      resolveSignalValue(props.values),
      "RangeNavigator values",
    ),
    span = pair(resolveSignalValue(props.span), "RangeNavigator span"),
    source = scale(props.scale, "RangeNavigator"),
    paint = style(props.style),
    minimum = nonnegative(props.minimumSpan ?? 0, "RangeNavigator minimumSpan"),
    draft = useSignal<Draft<Pair, "pan" | "first" | "second"> | null>(null),
    transform = useRef<DOMMatrix>();
  navigatorInterval(values, minimum, source, "RangeNavigator");
  const first = source.map(values[0]),
    second = source.map(values[1]),
    visible = range(first, second, source.range);
  const cancel = () => {
    const active = draft.get();
    if (!active) return;
    props.onChange(active.original);
    release(draft, active);
    props.onCancel?.();
  };
  const down =
    (mode: "pan" | "first" | "second") => (event: PibblPointerEvent) =>
      begin(draft, event, values, mode, transform.current, [source]);
  const move = (event: PibblPointerEvent) => {
    const active = draft.get();
    if (!active || active.pointerId !== event.pointerId) return;
    const point = local(active.inverse, event),
      captured = active.scales[0]!,
      next =
        active.mode === "pan"
          ? panMapped(
              active.original,
              point.x - active.start.x,
              captured,
              true,
              minimum,
            )
          : edge(
              active.original,
              active.mode,
              captured.invert!(point.x),
              minimum,
              captured,
              true,
            );
    publish(draft, active, next, props.onChange);
    event.stopPropagation();
  };
  const up = (event: PibblPointerEvent) => {
    const active = draft.get();
    if (!active || active.pointerId !== event.pointerId) return;
    release(draft, active);
    props.onCommit?.(active.last);
    event.stopPropagation();
  };
  if (!visible) return null;
  const top = Math.min(...span),
    height = Math.abs(span[1] - span[0]),
    center = top + height / 2;
  const edit = (sign: number) => {
    const keyboardStep =
        minimum || Math.abs(source.domain[1]! - source.domain[0]!) * 0.01,
      next = pan(values, sign * keyboardStep, source, true);
    props.onChange(next);
    props.onCommit?.(next);
  };
  const handleKeys = (event: PibblKeyboardEvent) => keys(event, cancel, edit);
  return (
    <TransformCapture capture={transform}>
      <Rectangle
        keyboardFocusable
        onPointerDown={down("pan")}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={cancel}
        onLostPointerCapture={cancel}
        onKeyDown={handleKeys}
        style={{
          left: visible[0],
          top,
          width: visible[1] - visible[0],
          height,
          fill: paint.fill,
          stroke: paint.stroke,
          strokeWidth: paint.strokeWidth,
          opacity: paint.opacity,
          cursor: "grab",
        }}
      />
      {handle(first, center, paint, {
        onPointerDown: down("first"),
        onPointerMove: move,
        onPointerUp: up,
        onPointerCancel: cancel,
        onLostPointerCapture: cancel,
        onKeyDown: handleKeys,
      })}
      {handle(second, center, paint, {
        onPointerDown: down("second"),
        onPointerMove: move,
        onPointerUp: up,
        onPointerCancel: cancel,
        onLostPointerCapture: cancel,
        onKeyDown: handleKeys,
      })}
    </TransformCapture>
  );
}

/**
 * Renders one controlled numeric-domain reference line.
 *
 * @param props - Controlled line inputs and callbacks; see {@link EditableReferenceLineProps}.
 * @returns The line and its selected handle, or no geometry when it is outside the visible range.
 * @see {@link EditableReferenceBand} for an editable interval.
 */
export function EditableReferenceLine(props: EditableReferenceLineProps) {
  if (props.direction !== "horizontal" && props.direction !== "vertical")
    throw new TypeError(
      "EditableReferenceLine direction must be horizontal or vertical.",
    );
  const value = resolveSignalValue(props.value),
    span = pair(resolveSignalValue(props.span), "EditableReferenceLine span"),
    source = scale(props.scale, "EditableReferenceLine"),
    step = positive(props.keyboardStep, "EditableReferenceLine keyboardStep"),
    paint = style(props.style),
    selected = resolveSignalValue(props.selected ?? true),
    draft = useSignal<Draft<number, "line"> | null>(null),
    transform = useRef<DOMMatrix>();
  if (!Number.isFinite(value))
    throw new RangeError("EditableReferenceLine value must be finite.");
  const position = source.map(value),
    cancel = () => {
      const active = draft.get();
      if (!active) return;
      props.onChange(active.original);
      release(draft, active);
      props.onCancel?.();
    },
    down = (event: PibblPointerEvent) => {
      props.onSelect?.();
      begin(draft, event, value, "line", transform.current, [source]);
    };
  const move = (event: PibblPointerEvent) => {
      const active = draft.get();
      if (!active || active.pointerId !== event.pointerId) return;
      const point = local(active.inverse, event),
        captured = active.scales[0]!;
      publish(
        draft,
        active,
        captured.invert!(props.direction === "horizontal" ? point.y : point.x),
        props.onChange,
      );
      event.stopPropagation();
    },
    up = (event: PibblPointerEvent) => {
      const active = draft.get();
      if (!active || active.pointerId !== event.pointerId) return;
      release(draft, active);
      props.onCommit?.(active.last);
      event.stopPropagation();
    };
  if (!range(position, position, source.range)) return null;
  const coords: [number, number][] =
      props.direction === "horizontal"
        ? [
            [span[0], position],
            [span[1], position],
          ]
        : [
            [position, span[0]],
            [position, span[1]],
          ],
    x = props.direction === "horizontal" ? (span[0] + span[1]) / 2 : position,
    y = props.direction === "horizontal" ? position : (span[0] + span[1]) / 2;
  const edit = (sign: number) => {
    props.onSelect?.();
    const next = value + sign * step;
    props.onChange(next);
    props.onCommit?.(next);
  };
  const handleKeys = (event: PibblKeyboardEvent) => keys(event, cancel, edit);
  return (
    <TransformCapture capture={transform}>
      <Line
        keyboardFocusable
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={cancel}
        onLostPointerCapture={cancel}
        onKeyDown={handleKeys}
        style={{
          coords,
          stroke: paint.stroke,
          strokeWidth: paint.strokeWidth,
          opacity: paint.opacity,
          lineInteractionWidth: paint.hitSize,
          cursor: "grab",
        }}
      />
      {selected
        ? handle(x, y, paint, {
            onPointerDown: down,
            onPointerMove: move,
            onPointerUp: up,
            onPointerCancel: cancel,
            onLostPointerCapture: cancel,
            onKeyDown: handleKeys,
          })
        : null}
    </TransformCapture>
  );
}

/**
 * Renders a controlled numeric-domain interval with pan and edge-resize handles.
 *
 * @param props - Controlled band inputs and callbacks; see {@link EditableReferenceBandProps}.
 * @returns Band geometry and selected handles, or no geometry when outside the visible range.
 * @see {@link RangeNavigator} for an overview-strip interval.
 */
export function EditableReferenceBand(props: EditableReferenceBandProps) {
  if (props.direction !== "horizontal" && props.direction !== "vertical")
    throw new TypeError(
      "EditableReferenceBand direction must be horizontal or vertical.",
    );
  const values = pair(
      resolveSignalValue(props.values),
      "EditableReferenceBand values",
    ),
    span = pair(resolveSignalValue(props.span), "EditableReferenceBand span"),
    source = scale(props.scale, "EditableReferenceBand"),
    step = positive(props.keyboardStep, "EditableReferenceBand keyboardStep"),
    minimum = nonnegative(
      props.minimumSpan ?? 0,
      "EditableReferenceBand minimumSpan",
    ),
    paint = style(props.style),
    selected = resolveSignalValue(props.selected ?? true),
    draft = useSignal<Draft<Pair, "pan" | "first" | "second"> | null>(null),
    transform = useRef<DOMMatrix>();
  annotationInterval(values, minimum, "EditableReferenceBand");
  const first = source.map(values[0]),
    second = source.map(values[1]),
    visible = range(first, second, source.range);
  const cancel = () => {
    const active = draft.get();
    if (!active) return;
    props.onChange(active.original);
    release(draft, active);
    props.onCancel?.();
  };
  const down =
    (mode: "pan" | "first" | "second") => (event: PibblPointerEvent) => {
      props.onSelect?.();
      begin(draft, event, values, mode, transform.current, [source]);
    };
  const move = (event: PibblPointerEvent) => {
    const active = draft.get();
    if (!active || active.pointerId !== event.pointerId) return;
    const point = local(active.inverse, event),
      coordinate = props.direction === "horizontal" ? point.y : point.x,
      start =
        props.direction === "horizontal" ? active.start.y : active.start.x,
      captured = active.scales[0]!,
      next =
        active.mode === "pan"
          ? panMapped(
              active.original,
              coordinate - start,
              captured,
              false,
              minimum,
            )
          : edge(
              active.original,
              active.mode,
              captured.invert!(coordinate),
              minimum,
              captured,
              false,
            );
    publish(draft, active, next, props.onChange);
    event.stopPropagation();
  };
  const up = (event: PibblPointerEvent) => {
    const active = draft.get();
    if (!active || active.pointerId !== event.pointerId) return;
    release(draft, active);
    props.onCommit?.(active.last);
    event.stopPropagation();
  };
  const edit = (sign: number) => {
    props.onSelect?.();
    const next = pan(values, sign * step, source, false);
    props.onChange(next);
    props.onCommit?.(next);
  };
  if (!visible) return null;
  const rect =
    props.direction === "horizontal"
      ? {
          left: Math.min(...span),
          top: visible[0],
          width: Math.abs(span[1] - span[0]),
          height: visible[1] - visible[0],
        }
      : {
          left: visible[0],
          top: Math.min(...span),
          width: visible[1] - visible[0],
          height: Math.abs(span[1] - span[0]),
        };
  const firstHandle: Pair =
      props.direction === "horizontal"
        ? [Math.min(...span), first]
        : [first, Math.min(...span)],
    secondHandle: Pair =
      props.direction === "horizontal"
        ? [Math.max(...span), second]
        : [second, Math.max(...span)];
  const handleKeys = (event: PibblKeyboardEvent) => keys(event, cancel, edit);
  return (
    <TransformCapture capture={transform}>
      <Rectangle
        keyboardFocusable
        onPointerDown={down("pan")}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={cancel}
        onLostPointerCapture={cancel}
        onKeyDown={handleKeys}
        style={{
          ...rect,
          fill: paint.fill,
          stroke: paint.stroke,
          strokeWidth: paint.strokeWidth,
          opacity: paint.opacity,
          cursor: "grab",
        }}
      />
      {selected ? (
        <>
          {handle(firstHandle[0], firstHandle[1], paint, {
            onPointerDown: down("first"),
            onPointerMove: move,
            onPointerUp: up,
            onPointerCancel: cancel,
            onLostPointerCapture: cancel,
            onKeyDown: handleKeys,
          })}
          {handle(secondHandle[0], secondHandle[1], paint, {
            onPointerDown: down("second"),
            onPointerMove: move,
            onPointerUp: up,
            onPointerCancel: cancel,
            onLostPointerCapture: cancel,
            onKeyDown: handleKeys,
          })}
        </>
      ) : null}
    </TransformCapture>
  );
}

function snap(source: Scale, position: number): number {
  const time = source.nearestTimeAtPosition?.(position);
  if (time === undefined)
    throw new RangeError(
      "EditableTrendLine cannot edit an empty TradingTimeScale.",
    );
  return time;
}
function mapped(source: Scale, position: number): number {
  return source.type === "trading-time"
    ? snap(source, position)
    : source.invert!(position);
}
function advanceTradingTime(
  source: Scale,
  value: number,
  sign: number,
  step: number,
) {
  const target = value + sign * step,
    candidates = source.domain.filter((candidate) =>
      sign > 0 ? candidate >= target : candidate <= target,
    );
  return sign > 0
    ? (candidates[0] ?? Math.max(...source.domain))
    : (candidates[candidates.length - 1] ?? Math.min(...source.domain));
}
function translateTradingAnchors(
  source: Scale,
  anchors: readonly [ChartAnchor, ChartAnchor],
  sign: number,
  step: number,
): readonly [ChartAnchor, ChartAnchor] {
  const slots = anchors.map((anchor) => source.slotAtTime!(anchor.x)!);
  const requested =
    source.slotAtTime!(advanceTradingTime(source, anchors[0].x, sign, step))! -
    slots[0]!;
  const delta = clamp(requested, [
    -Math.min(...slots),
    source.domain.length - 1 - Math.max(...slots),
  ]);
  return [
    { ...anchors[0], x: source.timeAtSlot!(slots[0]! + delta)! },
    { ...anchors[1], x: source.timeAtSlot!(slots[1]! + delta)! },
  ];
}

/**
 * Renders two controlled anchors as an editable trend line.
 *
 * Trading-time x values snap to supplied observations during pointer and keyboard edits.
 *
 * @param props - Controlled anchor inputs and callbacks; see {@link EditableTrendLineProps}.
 * @returns Line geometry and selected endpoint handles.
 * @see {@link ChartAnchor} for the controlled anchor shape.
 */
export function EditableTrendLine(props: EditableTrendLineProps) {
  const anchors = resolveSignalValue(props.anchors),
    x = scale(props.xScale, "EditableTrendLine xScale", {
      allowTradingTime: true,
    }),
    y = scale(props.yScale, "EditableTrendLine yScale"),
    stepX = positive(props.keyboardStep.x, "EditableTrendLine keyboardStep.x"),
    stepY = positive(props.keyboardStep.y, "EditableTrendLine keyboardStep.y"),
    paint = style(props.style),
    selected = resolveSignalValue(props.selected ?? true),
    draft = useSignal<Draft<
      readonly [ChartAnchor, ChartAnchor],
      "line" | "first" | "second"
    > | null>(null),
    transform = useRef<DOMMatrix>();
  if (
    !Array.isArray(anchors) ||
    anchors.length !== 2 ||
    !anchors.every(
      (anchor) => Number.isFinite(anchor.x) && Number.isFinite(anchor.y),
    )
  )
    throw new RangeError("EditableTrendLine requires two finite anchors.");
  const positions: readonly [Point, Point] = [
    { x: x.map(anchors[0].x), y: y.map(anchors[0].y) },
    { x: x.map(anchors[1].x), y: y.map(anchors[1].y) },
  ];
  const cancel = () => {
    const active = draft.get();
    if (!active) return;
    props.onChange(active.original);
    release(draft, active);
    props.onCancel?.();
  };
  const down =
    (mode: "line" | "first" | "second") => (event: PibblPointerEvent) => {
      props.onSelect?.();
      begin(
        draft,
        event,
        anchors as readonly [ChartAnchor, ChartAnchor],
        mode,
        transform.current,
        [x, y],
      );
    };
  const move = (event: PibblPointerEvent) => {
    const active = draft.get();
    if (!active || active.pointerId !== event.pointerId) return;
    const point = local(active.inverse, event),
      dragX = active.scales[0]!,
      dragY = active.scales[1]!;
    let next: readonly [ChartAnchor, ChartAnchor];
    if (active.mode === "line") {
      const originalPositions: readonly [Point, Point] = [
        {
          x: dragX.map(active.original[0].x),
          y: dragY.map(active.original[0].y),
        },
        {
          x: dragX.map(active.original[1].x),
          y: dragY.map(active.original[1].y),
        },
      ];
      const yDelta = point.y - active.start.y;
      const slotDelta =
        dragX.type === "trading-time"
          ? clamp(
              Math.round(
                dragX.slotAtTime!(snap(dragX, point.x))! -
                  dragX.slotAtTime!(snap(dragX, active.start.x))!,
              ),
              [
                -Math.min(
                  dragX.slotAtTime!(active.original[0].x)!,
                  dragX.slotAtTime!(active.original[1].x)!,
                ),
                dragX.domain.length -
                  1 -
                  Math.max(
                    dragX.slotAtTime!(active.original[0].x)!,
                    dragX.slotAtTime!(active.original[1].x)!,
                  ),
              ],
            )
          : 0;
      const xDelta =
        dragX.type === "trading-time" ? 0 : point.x - active.start.x;
      const translateX = (anchor: ChartAnchor, position: Point) =>
        dragX.type === "trading-time"
          ? dragX.timeAtSlot!(dragX.slotAtTime!(anchor.x)! + slotDelta)!
          : mapped(dragX, position.x + xDelta);
      next = [
        {
          x: translateX(active.original[0], originalPositions[0]),
          y: mapped(dragY, originalPositions[0].y + yDelta),
        },
        {
          x: translateX(active.original[1], originalPositions[1]),
          y: mapped(dragY, originalPositions[1].y + yDelta),
        },
      ];
    } else {
      const index = active.mode === "first" ? 0 : 1,
        changed = { x: mapped(dragX, point.x), y: mapped(dragY, point.y) };
      next =
        index === 0
          ? [changed, active.original[1]]
          : [active.original[0], changed];
    }
    publish(draft, active, next, props.onChange);
    event.stopPropagation();
  };
  const up = (event: PibblPointerEvent) => {
    const active = draft.get();
    if (!active || active.pointerId !== event.pointerId) return;
    release(draft, active);
    props.onCommit?.(active.last);
    event.stopPropagation();
  };
  const edit = (sign: number, axis: "x" | "y") => {
    props.onSelect?.();
    const translated =
      axis === "y"
        ? anchors
        : x.type === "trading-time"
          ? translateTradingAnchors(x, anchors, sign, stepX)
          : ([
              { ...anchors[0], x: anchors[0].x + sign * stepX },
              { ...anchors[1], x: anchors[1].x + sign * stepX },
            ] as const);
    const next: readonly [ChartAnchor, ChartAnchor] = [
      { ...translated[0], y: anchors[0].y + (axis === "y" ? sign * stepY : 0) },
      { ...translated[1], y: anchors[1].y + (axis === "y" ? sign * stepY : 0) },
    ];
    props.onChange(next);
    props.onCommit?.(next);
  };
  const coords: [number, number][] = positions.map((point) => [
    point.x,
    point.y,
  ]);
  const handleKeys = (event: PibblKeyboardEvent) =>
    keys(event, cancel, (sign) =>
      edit(
        sign,
        event.key === "ArrowLeft" || event.key === "ArrowRight" ? "x" : "y",
      ),
    );
  return (
    <TransformCapture capture={transform}>
      <Line
        keyboardFocusable
        onPointerDown={down("line")}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={cancel}
        onLostPointerCapture={cancel}
        onKeyDown={handleKeys}
        style={{
          coords,
          stroke: paint.stroke,
          strokeWidth: paint.strokeWidth,
          opacity: paint.opacity,
          lineInteractionWidth: paint.hitSize,
          cursor: "grab",
        }}
      />
      {selected ? (
        <>
          {handle(positions[0].x, positions[0].y, paint, {
            onPointerDown: down("first"),
            onPointerMove: move,
            onPointerUp: up,
            onPointerCancel: cancel,
            onLostPointerCapture: cancel,
            onKeyDown: handleKeys,
          })}
          {handle(positions[1].x, positions[1].y, paint, {
            onPointerDown: down("second"),
            onPointerMove: move,
            onPointerUp: up,
            onPointerCancel: cancel,
            onLostPointerCapture: cancel,
            onKeyDown: handleKeys,
          })}
        </>
      ) : null}
    </TransformCapture>
  );
}
