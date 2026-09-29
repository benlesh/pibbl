import type { CRCNode, SignalValue } from "@crc/core";
import type { PointAccessor } from "./point-types.js";
import type { ResolvedLinearScale, ScaleId } from "./types.js";
export interface HoverQueryContext {
  scale(id: ScaleId): ResolvedLinearScale;
}
export type HoverQuery<T> = (context: HoverQueryContext) => T | undefined;
export interface HoverDataProps<T> {
  readonly query: HoverQuery<T> &
    (T extends PromiseLike<unknown> ? never : unknown);
  readonly children: (result: T | undefined) => CRCNode;
}
export interface HoverSeries<D> {
  readonly data: SignalValue<readonly D[]>;
  readonly x: PointAccessor<D>;
  readonly y: PointAccessor<D>;
  readonly defined?: (datum: D, index: number, data: readonly D[]) => boolean;
}
export interface HoverPoint {
  readonly x: number;
  readonly y: number;
}
export interface HoverHit<D> {
  readonly datum: D;
  readonly index: number;
  readonly x: number;
  readonly y: number;
  readonly anchor: HoverPoint;
}
// The constraint permits independently typed descriptors; the mapped result below
// restores the exact association between a series key and its original datum.
export type HoverSeriesMap = Readonly<Record<string, HoverSeries<any>>>;
export type ClosestPointHit<S extends HoverSeriesMap> = {
  [K in keyof S & string]: S[K] extends HoverSeries<infer D>
    ? HoverHit<D> & { readonly series: K; readonly distance: number }
    : never;
}[keyof S & string];
export interface ClosestPointOptions<S extends HoverSeriesMap> {
  readonly series: S;
  readonly position: SignalValue<HoverPoint | null>;
  readonly xScale: ScaleId;
  readonly yScale: ScaleId;
  readonly maxDistance?: number;
}
