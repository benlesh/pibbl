import { noise, point, range, type ElectricPoint } from "./electric-shared.js";

/** A weighted attachment site in normalized texture coordinates. */
export interface ElectricSource {
  readonly id: string;
  readonly point: ElectricPoint;
  readonly weight: number;
}
export type ElectricSourceMessage =
  | { readonly type: "upsert-source"; readonly source: ElectricSource }
  | { readonly type: "remove-source"; readonly id: string }
  | {
      readonly type: "set-sources";
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
/** Order-independent weighted exponential race. Zero weight is never selected. */
export function chooseSource(
  sites: readonly SourceSite[],
  seed: number,
  ticket: number,
): SourceSite | undefined {
  let selected: SourceSite | undefined,
    best = Infinity;
  for (const candidate of sites) {
    if (candidate.weight === 0) continue;
    const logWeight = Math.log(candidate.weight);
    const score =
      Math.log(
        -Math.log(Math.max(1e-9, noise(seed ^ candidate.hash, ticket))),
      ) - logWeight;
    if (
      !selected ||
      score < best ||
      (score === best && candidate.id < selected.id)
    ) {
      best = score;
      selected = candidate;
    }
  }
  return selected;
}
