import { prepareStandaloneLayoutKernel } from "@pibbl/core/internal/layout";
import type { LayoutGridTrack } from "./lib/types.js";
/**
 * Prepares the native module used by {@link prepareLayout}.
 * @returns A promise that resolves once an owned tree can be created.
 */
export function prepareLayout(): Promise<void> {
  return prepareStandaloneLayoutKernel();
}

export { createLayoutTree } from "./lib/tree.js";
/**
 * Creates an immutable capped intrinsic {@link LayoutGridTrack}.
 * @param limit - Nonnegative numeric or percentage cap.
 * @returns A frozen capped intrinsic track.
 */
export function fitContent(
  limit: number | `${number}%`,
): import("./lib/types.js").LayoutFitContentTrack {
  if (
    (typeof limit === "number" && Number.isFinite(limit) && limit >= 0) ||
    (typeof limit === "string" && /^(?:\d+|\d*\.\d+)%$/.test(limit))
  ) {
    return Object.freeze({ kind: "fit-content" as const, limit });
  }
  throw new TypeError(
    "fitContent limit must be a finite nonnegative number or percentage.",
  );
}
export {
  analyzeYoga32Tree,
  assertYoga32Converted,
  convertYoga32Style,
} from "./lib/yoga32.js";
export type {
  LayoutAlign,
  LayoutAxisConstraint,
  LayoutBox,
  LayoutBoxSizing,
  LayoutChange,
  LayoutConstraints,
  LayoutDirection,
  LayoutEdges,
  LayoutFlexDirection,
  LayoutGridTrack,
  LayoutMinMaxTrack,
  LayoutRepeatTrack,
  LayoutFitContentTrack,
  LayoutSizingKeyword,
  LayoutIntrinsicMeasure,
  LayoutIntrinsicMeasureResult,
  LayoutLength,
  LayoutMode,
  LayoutTrackBreadth,
  LayoutMeasure,
  LayoutMeasureInput,
  LayoutMeasureResult,
  LayoutNode,
  LayoutNodeInput,
  LayoutOverflow,
  LayoutPosition,
  LayoutSnapshot,
  LayoutStyle,
  LayoutTree,
  LayoutWrap,
  Yoga32ConvertedStyle,
  Yoga32ConvertedStyleResult,
  Yoga32ConversionOptions,
  Yoga32Diagnostic,
  Yoga32DiagnosticSeverity,
  Yoga32MigrationReport,
  Yoga32StyleInput,
  Yoga32TreeInput,
} from "./lib/types.js";

/**
 * Creates an immutable bounded {@link LayoutGridTrack}.
 * @param options - Minimum and maximum track breadths.
 * @returns A frozen minimum/maximum track.
 */
export function minmax(
  options: Readonly<{
    min: import("./lib/types.js").LayoutTrackBreadth;
    max: import("./lib/types.js").LayoutTrackBreadth;
  }>,
): import("./lib/types.js").LayoutMinMaxTrack {
  return Object.freeze({
    kind: "minmax" as const,
    min: options.min,
    max: options.max,
  });
}
/**
 * Repeats {@link LayoutGridTrack} values a fixed number of times.
 * @param tracks - Track sequence to repeat.
 * @param options - Positive repeat count.
 * @returns A frozen repeated track definition.
 */
export function repeatTracks(
  tracks: readonly LayoutGridTrack[],
  options: Readonly<{ count: number }>,
): import("./lib/types.js").LayoutRepeatTrack {
  if (!Number.isInteger(options.count) || options.count < 1 || !tracks.length)
    throw new RangeError(
      "repeatTracks requires a positive integer count and at least one track.",
    );
  return Object.freeze({
    kind: "repeat" as const,
    count: options.count,
    tracks: Object.freeze([...tracks]),
  });
}
/**
 * Repeats {@link LayoutGridTrack} values against the owning axis without collapsing empty tracks.
 * @param tracks - Track sequence to repeat.
 * @returns A frozen automatic fill definition.
 */
export function autoFillTracks(
  ...tracks: readonly LayoutGridTrack[]
): import("./lib/types.js").LayoutRepeatTrack {
  if (!tracks.length)
    throw new RangeError("autoFillTracks requires at least one track.");
  return Object.freeze({
    kind: "repeat" as const,
    count: "auto-fill" as const,
    tracks: Object.freeze([...tracks]),
  });
}
/**
 * Repeats {@link LayoutGridTrack} values against the owning axis and collapses unoccupied tracks.
 * @param tracks - Track sequence to repeat.
 * @returns A frozen automatic fit definition.
 */
export function autoFitTracks(
  ...tracks: readonly LayoutGridTrack[]
): import("./lib/types.js").LayoutRepeatTrack {
  if (!tracks.length)
    throw new RangeError("autoFitTracks requires at least one track.");
  return Object.freeze({
    kind: "repeat" as const,
    count: "auto-fit" as const,
    tracks: Object.freeze([...tracks]),
  });
}
