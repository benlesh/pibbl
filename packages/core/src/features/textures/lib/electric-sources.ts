import type { TendrilsMessage, TendrilsOptions } from './tendrils.js';
import { point, range, type ElectricPoint } from "./electric-shared.js";

/**
 * A weighted attachment site in normalized texture coordinates.
 *
 * @see {@link ElectricPoint}
 * @see {@link ElectricSourceMessage}
 * @see {@link TendrilsOptions}
 */
export interface ElectricSource {
  /** Stable identifier of this resource or connection. See {@link ElectricSource}. */
  readonly id: string;
  /** A point in the operation's coordinate system. See {@link ElectricPoint}. */
  readonly point: ElectricPoint;
  /** Relative sampling weight or source intensity. See {@link ElectricSource}. */
  readonly weight: number;
}
/**
 * Upserts, removes, or replaces the named source electrodes of an electrical texture.
 *
 * @see {@link ElectricSource}
 * @see {@link TendrilsMessage}
 */
export type ElectricSourceMessage =
  | {
      /** The literal "upsert-source" identifying this variant. See {@link ElectricSourceMessage}. */
      readonly type: "upsert-source";
      /** Named electrode to insert or replace. See {@link ElectricSource}. */
      readonly source: ElectricSource;
    }
  | {
      /** The literal "remove-source" identifying this variant. See {@link ElectricSourceMessage}. */
      readonly type: "remove-source";
      /** Stable identifier of this resource or connection. See {@link ElectricSourceMessage}. */
      readonly id: string;
    }
  | {
      /** The literal "set-sources" identifying this variant. See {@link ElectricSourceMessage}. */
      readonly type: "set-sources";
      /** Named electrical source electrodes. See {@link ElectricSource}. */
      readonly sources: readonly ElectricSource[];
    };

export const MAX_ELECTRIC_SOURCES = 512;
export function sourceId(id: string): string {
  if (typeof id !== "string" || id.length < 1 || id.length > 128)
    throw new RangeError("Electric source id must contain 1..128 characters.");
  return id;
}
export function source(value: ElectricSource): ElectricSource {
  return {
    id: sourceId(value.id),
    point: point(value.point),
    weight: range(value.weight, 0, 1_000_000, "Source weight"),
  };
}
export function sources(values: readonly ElectricSource[]): ElectricSource[] {
  if (!Array.isArray(values) || values.length > MAX_ELECTRIC_SOURCES)
    throw new RangeError(
      "Electric sources must be an array of at most 512 sites.",
    );
  const ids = new Set<string>();
  const result = values.map((value) => {
    const next = source(value);
    if (ids.has(next.id))
      throw new TypeError(`Duplicate electric source id: ${next.id}`);
    ids.add(next.id);
    return next;
  });
  return result.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
export interface SourceSite {
  id: string;
  point: ElectricPoint;
  weight: number;
  hash: number;
}
export function site(value: ElectricSource): SourceSite {
  let hash = 2166136261;
  for (let i = 0; i < value.id.length; i++)
    hash = Math.imul(hash ^ value.id.charCodeAt(i), 16777619);
  return { ...value, point: { ...value.point }, hash };
}
