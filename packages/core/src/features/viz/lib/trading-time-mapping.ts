const DATE_LIMIT = 8_640_000_000_000_000;

/** Input used to resolve gapless trading-time coordinates. */
export interface TradingTimeMappingInput {
  /** Strictly increasing, unique UTC millisecond observations. */
  readonly timestamps: readonly number[];
  /** Visible logical slot endpoints; fractional values reserve viewport whitespace. */
  readonly logicalRange: readonly [number, number];
  /** Physical local-coordinate endpoints. */
  readonly range: readonly [number, number];
}

/** Immutable conversion operations for one owned trading-time observation list. */
export interface TradingTimeMapping {
  /** Maps an exact supplied timestamp to its physical local coordinate. */
  mapTime(time: number): number;
  /** Finds an exact supplied timestamp's consecutive logical slot. */
  slotAtTime(time: number): number | undefined;
  /** Finds the supplied timestamp at an exact integer logical slot. */
  timeAtSlot(slot: number): number | undefined;
  /** Selects the nearest supplied timestamp to a physical coordinate. */
  nearestTimeAtPosition(position: number): number | undefined;
  /** Inverts a physical coordinate to a possibly fractional logical slot. */
  slotAtPosition(position: number): number;
}

function finite(value: number, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new RangeError(`${name} must be finite.`);
  return value;
}

function endpointPair(
  value: readonly [number, number],
  name: string,
): readonly [number, number] {
  const first = finite(value[0], `${name}[0]`);
  const second = finite(value[1], `${name}[1]`);
  if (first === second) throw new RangeError(`${name} endpoints must differ.`);
  return Object.freeze([first, second]);
}

function timestamp(value: number, index: number): number {
  if (!Number.isSafeInteger(value) || Math.abs(value) > DATE_LIMIT)
    throw new RangeError(
      `timestamps[${index}] must be safe integers within Date range UTC milliseconds.`,
    );
  return value;
}

function indexOf(timestamps: readonly number[], time: number): number {
  let first = 0;
  let last = timestamps.length - 1;
  while (first <= last) {
    const middle = first + Math.floor((last - first) / 2);
    const candidate = timestamps[middle]!;
    if (candidate === time) return middle;
    if (candidate < time) first = middle + 1;
    else last = middle - 1;
  }
  return -1;
}

/**
 * Creates pure mappings between exact supplied UTC observations, logical slots, and local positions.
 *
 * The mapping owns a frozen copy of timestamps. It creates no timestamps for gaps: exact mapping
 * rejects unknown values, while inverse position mapping can intentionally produce fractional slots.
 *
 * @param input - Observation timestamps plus logical and physical viewport endpoints.
 * @returns Immutable mapping operations with logarithmic timestamp lookup and constant-time slot lookup.
 */
export function createTradingTimeMapping(
  input: TradingTimeMappingInput,
): TradingTimeMapping {
  const timestamps = input.timestamps.map((value, index) =>
    timestamp(value, index),
  );
  for (let index = 1; index < timestamps.length; index++) {
    if (timestamps[index - 1]! >= timestamps[index]!)
      throw new RangeError(
        "timestamps must be strictly increasing and unique.",
      );
  }
  Object.freeze(timestamps);
  const logicalRange = endpointPair(input.logicalRange, "logicalRange");
  const range = endpointPair(input.range, "range");
  const slotAtPosition = (position: number): number => {
    finite(position, "position");
    return (
      logicalRange[0] +
      ((position - range[0]) * (logicalRange[1] - logicalRange[0])) /
        (range[1] - range[0])
    );
  };
  const positionAtSlot = (slot: number): number =>
    range[0] +
    ((slot - logicalRange[0]) * (range[1] - range[0])) /
      (logicalRange[1] - logicalRange[0]);
  const slotAtTime = (time: number): number | undefined => {
    if (!Number.isSafeInteger(time) || Math.abs(time) > DATE_LIMIT)
      return undefined;
    const index = indexOf(timestamps, time);
    return index < 0 ? undefined : index;
  };
  return Object.freeze({
    mapTime(time: number): number {
      const slot = slotAtTime(time);
      if (slot === undefined)
        throw new RangeError(
          "TradingTimeScale cannot map an unknown timestamp.",
        );
      return positionAtSlot(slot);
    },
    slotAtTime,
    timeAtSlot(slot: number): number | undefined {
      if (!Number.isInteger(slot)) return undefined;
      return timestamps[slot];
    },
    nearestTimeAtPosition(position: number): number | undefined {
      if (timestamps.length === 0) return undefined;
      const slot = slotAtPosition(position);
      const earlier = Math.floor(slot);
      const index = Math.max(
        0,
        Math.min(
          timestamps.length - 1,
          earlier + (slot - earlier > 0.5 ? 1 : 0),
        ),
      );
      return timestamps[index];
    },
    slotAtPosition,
  });
}
