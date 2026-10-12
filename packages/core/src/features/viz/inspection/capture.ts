import { invertNumericPosition } from "../lib/series-position.js";
import { useRenderedRef } from "./owned-ref.js";
import type { HoverSeries } from "../lib/hover-types.js";
import type {
  NumericSeriesCapture,
  NumericInspectionRef,
  PointInspectionRef,
  PointRenderedSeries,
} from "./capture-types.js";

function useCapture<D>(): PointInspectionRef<D> {
  return useRenderedRef<NumericSeriesCapture<D>, PointRenderedSeries<D>>(
    "numericSeriesInspection",
    (candidate, geometry) => {
      const rows = candidate.observations.map((row) =>
        Object.freeze({
          ...row,
          anchorLocal: Object.freeze({ ...row.anchorLocal }),
          anchorRoot: geometry.rootAtLocal(row.anchorLocal),
        }),
      );
      return Object.freeze({
        observations: Object.freeze(rows),
        marks: Object.freeze(candidate.observations.slice()),
        assertLive: geometry.assertLive,
        localAtRoot: geometry.localAtRoot,
        anchorInsideClips: geometry.anchorInsideClips,
        domainXAtRoot(point: Readonly<{ x: number; y: number }>) {
          const local = geometry.localAtRoot(point);
          return local
            ? invertNumericPosition(candidate.xScale, local.x)
            : undefined;
        },
        anchorAtDomain(point: Readonly<{ domainX: number; domainY: number }>) {
          geometry.assertLive();
          const anchorLocal = Object.freeze({
            x: candidate.xScale.map(point.domainX),
            y: candidate.yScale.map(point.domainY),
          });
          return Object.freeze({
            anchorLocal,
            anchorRoot: geometry.rootAtLocal(anchorLocal),
          });
        },
      });
    },
  );
}

/**
 * Owns optional numeric capture without reading signals or executing queries.
 * @param _series - Typed descriptor used for datum inference; not observed or registered.
 * @returns A stable mount-owned capture ref; pass it to one numeric series' inspection prop.
 * @see {@link NumericInspectionRef}
 */
export function useNumericInspection<D>(
  _series: HoverSeries<D>,
): NumericInspectionRef<D> {
  return useCapture<D>();
}

/**
 * Owns optional circle/ring capture for one PointSeries; O(n) retained geometry when enabled.
 * @param _series - Typed descriptor used for datum inference; not observed or registered.
 * @returns A stable point inspection ref. Rendered records are borrowed until replacement/disposal.
 * @see {@link PointInspectionRef}
 */
export function usePointInspection<D>(
  _series: HoverSeries<D>,
): PointInspectionRef<D> {
  return useCapture<D>();
}
