import {
  resolveSignalValue,
  useLayoutBox,
  type SignalValue,
  type PibblNode,
  type Signal,
} from "@pibbl/core";
import type {
  ScaleId,
  ScaleRange,
  ScaleLayoutStyle,
  ResolvedScale,
} from "./types.js";
import type { SignalStyle } from "@pibbl/core/internal";
import { createTradingTimeMapping } from "./trading-time-mapping.js";
import { resolveLinearScale } from "./linear-scale.js";
import { useScaleProvider } from "./scale-provider.js";
import { scaleView } from "./scale-view.js";

/** Controlled gapless observation slots; UTCScale retains elapsed-time semantics.
 * @see {@link TradingTimeScale}
 */
export interface TradingTimeScaleProps {
  /** Ancestor scale identity. */ readonly id: ScaleId;
  /** Strictly increasing, unique UTC-millisecond observations; copied by the mapping. */ readonly timestamps: SignalValue<
    readonly number[]
  >;
  /** Visible logical slot endpoints, possibly fractional/reversed; default covers supplied slots. */ readonly logicalRange?: SignalValue<
    readonly [number, number]
  >;
  /** Output in local logical units or the receiving allocation's width/height. */ readonly range: SignalValue<ScaleRange>;
  /** Reverses physical output without reordering supplied observations. */ readonly reverse?: SignalValue<boolean>;
  /** Receiving scale frame allocation and layout participation. */ readonly style?: SignalValue<
    SignalStyle<ScaleLayoutStyle>
  >;
  /** Descendant visualization composition. */ readonly children?: PibblNode;
}
/** Dedicated exact-time/slot mapping; no interpolated UTC timestamps are fabricated.
 * @see {@link TradingTimeScale}
 */
export interface ResolvedTradingTimeScale {
  /** Describes this resolved mapping. */ readonly type: "trading-time";
  /** Owned supplied timestamps in ascending order, also used as the data domain. */ readonly timestamps: readonly number[];
  /** Owned supplied timestamp domain, not logical slot endpoints. */ readonly domain: readonly number[];
  /** Controlled viewport endpoints in logical slot units. */ readonly logicalRange: readonly [
    number,
    number,
  ];
  /** Output local-logical endpoints. */ readonly range: readonly [
    number,
    number,
  ];
  /** Receiving allocation in local logical units. */ readonly frame: Readonly<{
    /** Local allocation x. */ x: number;
    /** Local allocation y. */ y: number;
    /** Local width. */ width: number;
    /** Local height. */ height: number;
  }>;
  /** Maps an exact supplied UTC timestamp; unknown timestamps throw.
   * @param time - Supplied UTC milliseconds.
   * @returns Series-local coordinate.
   */ map(time: number): number;
  /** Maps a possibly fractional logical slot, including viewport whitespace.
   * @param slot - Logical observation slot.
   * @returns Series-local coordinate.
   */ mapSlot(slot: number): number;
  /** Exact timestamp lookup.
   * @param time - UTC milliseconds.
   * @returns Supplied slot index, or undefined.
   */ slotAtTime(time: number): number | undefined;
  /** Exact integer slot lookup.
   * @param slot - Integer logical observation slot.
   * @returns Supplied timestamp, or undefined.
   */ timeAtSlot(slot: number): number | undefined;
  /** Inverts local geometry to fractional slots.
   * @param position - Series-local logical coordinate.
   * @returns Fractional logical slot.
   */ slotAtPosition(position: number): number;
  /** Selects a supplied timestamp; ties choose earlier, outside positions clamp.
   * @param position - Series-local logical coordinate.
   * @returns Supplied UTC milliseconds, or undefined for empty input.
   */ nearestTimeAtPosition(position: number): number | undefined;
  /** Chooses at most count visible supplied observations as date ticks.
   * @param count - Integer maximum from zero through 100, default five.
   * @returns Original UTC timestamps in physical axis order.
   */ ticks(count?: number): readonly number[];
  /** Formats supplied or finite valid UTC timestamps without inferring sessions.
   * @param time - UTC milliseconds in Date range.
   * @returns ISO UTC timestamp.
   */ formatTick(time: number): string;
}
const views = new WeakMap<
  Signal<ResolvedScale>,
  Signal<ResolvedTradingTimeScale>
>();
/**
 * Reads a stable dedicated ancestor trading-time signal.
 * @param id - Ancestor TradingTimeScale identity.
 * @returns Readonly mapping with explicit timestamp and logical-slot operations.
 * @see {@link TradingTimeScale}
 */
export function useTradingTimeScale(
  id: ScaleId,
): Signal<ResolvedTradingTimeScale> {
  return scaleView(
    views,
    id,
    "useTradingTimeScale",
    (kind) => kind === "trading-time",
  );
}
/**
 * Provides gapless positions for ordered supplied observations, leaving application-owned viewport control explicit.
 * @param props - Timestamps, optional logical viewport, output range and children.
 * @returns Descendant composition in the named mapping scope.
 * @see {@link TradingTimeScaleProps}
 */
export function TradingTimeScale(props: TradingTimeScaleProps): PibblNode {
  const { width, height } = useLayoutBox();
  useScaleProvider(
    props.id,
    "trading-time",
    () => {
      const timestamps = Object.freeze([
        ...resolveSignalValue(props.timestamps),
      ]);
      const logicalRange = Object.freeze([
        ...(props.logicalRange
          ? resolveSignalValue(props.logicalRange)
          : [-0.5, Math.max(0.5, timestamps.length - 0.5)]),
      ]) as readonly [number, number];
      const linear = resolveLinearScale(
        logicalRange,
        resolveSignalValue(props.range),
        resolveSignalValue(props.reverse ?? false),
        width,
        height,
      );
      const mapping = createTradingTimeMapping({
        timestamps,
        logicalRange,
        range: linear.range,
      });
      return Object.freeze({
        type: "trading-time" as const,
        timestamps,
        domain: timestamps,
        logicalRange,
        range: linear.range,
        frame: linear.frame,
        map: mapping.mapTime,
        mapSlot: linear.map,
        slotAtTime: mapping.slotAtTime,
        timeAtSlot: mapping.timeAtSlot,
        slotAtPosition: mapping.slotAtPosition,
        nearestTimeAtPosition: mapping.nearestTimeAtPosition,
        ticks(count = 5) {
          if (!Number.isInteger(count) || count < 0 || count > 100)
            throw new RangeError(
              "TradingTime ticks count must be an integer 0–100.",
            );
          const lo = Math.max(0, Math.ceil(Math.min(...logicalRange))),
            hi = Math.min(
              timestamps.length - 1,
              Math.floor(Math.max(...logicalRange)),
            ),
            n = Math.max(0, hi - lo + 1),
            m = Math.min(n, count);
          const result = Array.from(
            { length: m },
            (_, i) =>
              timestamps[
                lo + (m === 1 ? 0 : Math.round((i * (n - 1)) / (m - 1)))
              ]!,
          );
          return Object.freeze(
            logicalRange[0] > logicalRange[1] ? result.reverse() : result,
          );
        },
        formatTick(time: number) {
          if (!Number.isFinite(time) || Math.abs(time) > 8_640_000_000_000_000)
            throw new RangeError(
              "TradingTime format requires UTC milliseconds within Date range.",
            );
          return new Date(time).toISOString();
        },
      });
    },
    [
      props.timestamps,
      props.logicalRange,
      props.range,
      props.reverse,
      width,
      height,
    ],
  );
  return props.children;
}
