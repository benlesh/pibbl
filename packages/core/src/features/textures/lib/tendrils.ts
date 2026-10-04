import { ElectricMemory, type ElectricThread } from "./wasm/electric.js";
import { lazyKernel } from "./wasm/memory.js";
import { bytes } from "./wasm/tendrils-bytes.js";
const wasmModule = /* @__PURE__ */ lazyKernel(bytes);
import { boundary } from "./electric-boundary.js";
import { defineTexture } from "@crc/core";
import { validateSeed } from "./palette.js";
import {
  electricOptions,
  point,
  range,
  type ElectricControl,
  type ElectricOptions,
  type ElectricPoint,
} from "./electric-shared.js";
import {
  MAX_ELECTRIC_SOURCES,
  site,
  source,
  sourceId,
  sources,
  type ElectricSource,
  type ElectricSourceMessage,
  type SourceSite,
} from "./electric-sources.js";

export interface TendrilsOptions extends ElectricOptions {
  /** Common electrode. Sources seed the outer endpoints. */
  readonly center?: ElectricPoint;
  readonly sources?: readonly ElectricSource[];
  /** Optional simple closed vessel outline in normalized texture coordinates. */
  readonly boundary?: readonly ElectricPoint[];
  readonly count?: number;
  /** Continuous upward drift speed, 0..1. No circular boundary is assumed. */
  readonly rise?: number;
  /** Terminal discharge size, 0..1. Source weight also scales the discharge. */
  readonly crackle?: number;
  readonly frequency?: number;
}
export type TendrilsMessage =
  | ElectricControl
  | ElectricSourceMessage
  | {
      readonly type: "configure";
      readonly branching?: number;
      readonly glow?: number;
      readonly rise?: number;
      readonly crackle?: number;
      readonly frequency?: number;
    };
function options(o: TendrilsOptions) {
  const count = range(o.count ?? 15, 1, 32, "Tendril count");
  if (!Number.isInteger(count))
    throw new RangeError("Tendril count must be an integer.");
  return {
    ...electricOptions(o),
    center: point(o.center ?? { x: 0.5, y: 0.5 }),
    sources: sources(o.sources ?? []),
    boundary: boundary(o.boundary),
    count,
    rise: range(o.rise ?? 0, 0, 1, "Rise"),
    crackle: range(o.crackle ?? 0, 0, 1, "Crackle"),
    frequency: range(o.frequency ?? 18, 1, 30, "Frequency"),
  };
}
type Thread = ElectricThread;
interface State {
  kernel: ElectricMemory;
  config: ReturnType<typeof options>;
  inputKey: string;
  sites: Map<string, SourceSite>;
  ordered: SourceSite[];
  threads: Thread[];
  time: number;
  paused: boolean;
}
function strength(weight: number) {
  return weight / (1 + weight);
}
function rebuild(s: State) {
  s.ordered = [...s.sites.values()].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
  s.kernel.setSources(s.ordered);
}
function bind(t: Thread, next: SourceSite, snap = false) {
  if (t.sourceId !== next.id || snap) {
    t.trajectory = { ...next.point };
    t.sourcePoint = { ...next.point };
  }
  t.sourceId = next.id;
  t.releasedAge = undefined;
  t.visible = true;
  if (snap) {
    t.point = { ...next.point };
    t.strength = strength(next.weight);
  }
}
function detach(t: Thread) {
  t.sourceId = undefined;
  t.releasedAge ??= 0;
}
function replaceSites(
  s: State,
  values: readonly ElectricSource[],
  reconsider: boolean,
) {
  s.sites = new Map(values.map((v) => [v.id, site(v)]));
  rebuild(s);
  s.threads.forEach((t, i) => {
    const current = t.sourceId && s.sites.get(t.sourceId);
    if (!current || current.weight === 0) detach(t);
    if (reconsider) {
      const next = s.kernel.choose(s.config.seed, i + t.generation * 37);
      if (next) bind(t, next, s.paused || !t.visible);
    }
  });
}
function reset(s: State) {
  s.time = 0;
  s.sites = new Map(s.config.sources.map((v) => [v.id, site(v)]));
  rebuild(s);
  s.threads = Array.from({ length: s.config.count }, (_, i) => {
    const next = s.kernel.choose(s.config.seed, i);
    return Object.assign(s.kernel.thread(i), {
      releasedAge: undefined,
      sourceId: next?.id,
      point: { ...(next?.point ?? s.config.center) },
      strength: next ? strength(next.weight) : 0,
      age: (i / s.config.count) * 5,
      generation: 0,
      trajectory: { ...(next?.point ?? s.config.center) },
      sourcePoint: { ...(next?.point ?? s.config.center) },
      visible: !!next,
      born: false,
    });
  });
}
function reconsider(s: State) {
  s.threads.forEach((t, i) => {
    const next = s.kernel.choose(s.config.seed, i + t.generation * 37);
    if (next) bind(t, next, s.paused || !t.visible);
    else detach(t);
  });
}
const recipe = /* @__PURE__ */ defineTexture<
  TendrilsOptions,
  State,
  TendrilsMessage
>({
  defaultPlacement: { mode: "stretch" },
  create(context, input) {
    const config = options(input);
    const s: State = {
      kernel: new ElectricMemory(wasmModule()),
      config,
      inputKey: JSON.stringify(input),
      sites: new Map(),
      ordered: [],
      threads: [],
      time: 0,
      paused: false,
    };
    reset(s);
    if (s.ordered.some((v) => v.weight > 0)) context.requestFrame();
    return s;
  },
  update(s, input, context) {
    const key = JSON.stringify(input);
    if (key === s.inputKey) return;
    const next = options(input),
      previous = s.config;
    s.config = next;
    s.inputKey = key;
    if (next.seed !== previous.seed || next.count !== previous.count) reset(s);
    else if (JSON.stringify(next.sources) !== JSON.stringify(previous.sources))
      replaceSites(s, next.sources, true);
    context.invalidate();
    if (!s.paused && s.threads.some((t) => t.visible)) context.requestFrame();
  },
  receive(s, m, context) {
    switch (m.type) {
      case "pause":
        s.paused = m.paused;
        break;
      case "reset":
        s.config.seed =
          m.seed === undefined ? s.config.seed : validateSeed(m.seed);
        reset(s);
        break;
      case "configure":
        s.config = options({ ...s.config, ...m });
        break;
      case "set-sources": {
        const next = sources(m.sources);
        s.config.sources = next;
        replaceSites(s, next, true);
        break;
      }
      case "upsert-source": {
        const next = source(m.source),
          previous = s.sites.get(next.id);
        if (!previous && s.sites.size >= MAX_ELECTRIC_SOURCES)
          throw new RangeError("At most 512 electric sources may be active.");
        const changedWeight = !previous || previous.weight !== next.weight;
        if (previous) {
          previous.point = next.point;
          previous.weight = next.weight;
        } else {
          s.sites.set(next.id, site(next));
          rebuild(s);
        }
        s.kernel.setSources(s.ordered);
        if (next.weight === 0) {
          for (const t of s.threads) if (t.sourceId === next.id) detach(t);
        } else if (changedWeight) reconsider(s);
        if (s.paused)
          for (const t of s.threads) {
            const target = t.sourceId && s.sites.get(t.sourceId);
            if (target) bind(t, target, true);
          }
        break;
      }
      case "remove-source": {
        const id = sourceId(m.id);
        if (!s.sites.delete(id)) return;
        rebuild(s);
        for (const t of s.threads) if (t.sourceId === id) detach(t);
        break;
      }
      default:
        throw new TypeError("Unknown tendrils message.");
    }
    context.invalidate();
    if (!s.paused && s.threads.some((t) => t.visible)) context.requestFrame();
  },
  advance(s, frame, context) {
    if (s.paused) return;
    const dt = Math.min(50, frame.delta) / 1000;
    s.time += dt;
    s.kernel.boundary(s.config.boundary);
    s.kernel.advanceTendrils(
      s.threads.length,
      s.config.seed,
      dt,
      s.config.rise,
    );
    context.invalidate();
    if (s.threads.some((t) => t.visible)) context.requestFrame();
  },
  rasterize(s, context) {
    s.kernel.tendrils(s.config, s.time, s.threads.length);
    s.kernel.draw(context, s.config.glow);
  },
  dispose(s) {
    s.kernel.dispose();
    s.sites.clear();
    s.ordered.length = 0;
    s.threads.length = 0;
    s.config.sources.length = 0;
  },
});
/** Weighted attachment sites and persistent filaments, independent of vessel geometry. */
export function tendrils(config: TendrilsOptions = {}) {
  return recipe(config);
}
