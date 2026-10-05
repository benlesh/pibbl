import { boundary, contain, riseAlongBoundary } from "./electric-boundary.js";
import { defineTexture } from "@pibbl/core";
import { validateSeed } from "./palette.js";
import {
  drawCore,
  drawFilaments,
  electricOptions,
  mix,
  noise,
  point,
  range,
  type ElectricControl,
  type ElectricOptions,
  type ElectricPoint,
  type Filament,
} from "./electric-shared.js";
import {
  chooseSource,
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
interface Thread {
  sourceId?: string;
  point: ElectricPoint;
  strength: number;
  age: number;
  generation: number;
  trajectory: ElectricPoint;
  sourcePoint: ElectricPoint;
  releasedAge?: number;
  visible: boolean;
  born: boolean;
}
interface State {
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
      const next = chooseSource(
        s.ordered,
        s.config.seed,
        i + t.generation * 37,
      );
      if (next) bind(t, next, s.paused || !t.visible);
    }
  });
}
function reset(s: State) {
  s.time = 0;
  s.sites = new Map(s.config.sources.map((v) => [v.id, site(v)]));
  rebuild(s);
  s.threads = Array.from({ length: s.config.count }, (_, i) => {
    const next = chooseSource(s.ordered, s.config.seed, i);
    return {
      sourceId: next?.id,
      point: { ...(next?.point ?? s.config.center) },
      strength: next ? strength(next.weight) : 0,
      age: (i / s.config.count) * 5,
      generation: 0,
      trajectory: { ...(next?.point ?? s.config.center) },
      sourcePoint: { ...(next?.point ?? s.config.center) },
      visible: !!next,
      born: false,
    };
  });
}
function reconsider(s: State) {
  s.threads.forEach((t, i) => {
    const next = chooseSource(s.ordered, s.config.seed, i + t.generation * 37);
    if (next) bind(t, next, s.paused || !t.visible);
    else detach(t);
  });
}
const recipe = defineTexture<TendrilsOptions, State, TendrilsMessage>({
  defaultPlacement: { mode: "stretch" },
  create(context, input) {
    const s: State = {
      config: options(input),
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
    s.threads.forEach((t, i) => {
      if (!t.visible) return;
      t.age += dt;

      if (t.releasedAge !== undefined) {
        t.releasedAge += dt;
        // Removal starts from the actual current endpoint; never an old target.
        t.point = riseAlongBoundary(
          t.point,
          dt * 0.055 * s.config.rise,
          s.config.boundary,
        );
        t.strength *= Math.exp(-dt * 3);
      }
      const target = t.sourceId && s.sites.get(t.sourceId);
      if (target) {
        // Sources seed births, not a sequence of waypoints. Accumulate a
        // continuous upward trajectory. Strong sources resist convection using
        // their ordinary weight, including contacts supplied by application code.
        t.trajectory = riseAlongBoundary(
          {
            x: t.trajectory.x + target.point.x - t.sourcePoint.x,
            y: t.trajectory.y + target.point.y - t.sourcePoint.y,
          },
          (dt * 0.055 * s.config.rise) / (1 + target.weight ** 2),
          s.config.boundary,
        );
        t.sourcePoint = { ...target.point };
        t.point = contain(
          mix(t.point, t.trajectory, 1 - Math.exp(-dt * 10)),
          s.config.boundary,
        );
        t.strength +=
          (strength(target.weight) - t.strength) * (1 - Math.exp(-dt * 8));
      }
      const duration = 8 + noise(s.config.seed, i + 300) * 4;
      if (
        t.releasedAge !== undefined ? t.releasedAge >= 5 : t.age >= duration
      ) {
        t.generation++;
        t.age = 0;
        t.born = true;
        const next = chooseSource(
          s.ordered,
          s.config.seed,
          i + t.generation * 37,
        );
        if (next) bind(t, next, true);
        else t.visible = false;
      }
    });
    context.invalidate();
    if (s.threads.some((t) => t.visible)) context.requestFrame();
  },
  rasterize(s, context) {
    const c = s.config,
      lines: Filament[] = [];
    s.threads.forEach((thread, i) => {
      if (!thread.visible) return;
      const phase = noise(c.seed, i) * Math.PI * 2,
        end = thread.point;
      const dx = end.x - c.center.x,
        dy = end.y - c.center.y,
        length = Math.hypot(dx, dy);
      const duration = 8 + noise(c.seed, i + 300) * 4;
      const fade =
        thread.releasedAge !== undefined
          ? Math.min(1, 5 - thread.releasedAge)
          : Math.min(1, (duration - thread.age) / 0.6);
      const birth = thread.born ? Math.min(1, thread.age / 0.25) : 1;
      const intensity =
        (0.4 + thread.strength * 0.5) * Math.max(0, fade) * birth;
      const points: ElectricPoint[] = [];
      for (let j = 0; j <= 40; j++) {
        const t = j / 40,
          envelope = Math.sin(t * Math.PI);
        const bend =
          envelope *
          (Math.sin(t * 10 + phase + s.time * 1.8) * 0.052 +
            Math.sin(t * 27 - s.time * 2.4 + phase) * 0.015 +
            Math.sin(t * 63 + phase + s.time * 3) * 0.004);
        points.push({
          x: c.center.x + dx * t - dy * bend,
          y:
            c.center.y +
            dy * t +
            dx * bend -
            c.rise *
              length *
              0.22 *
              envelope ** 2 *
              (0.7 + 0.3 * Math.sin(s.time * 0.6 + phase)),
        });
      }
      lines.push({
        points,
        intensity,
        hue: 250 + noise(c.seed, i + 71) * 65,
        width: 0.0023 + thread.strength * 0.001,
      });
      if (c.crackle > 0) {
        const tick = Math.floor(s.time * c.frequency),
          reach = c.crackle * (0.012 + 0.06 * thread.strength);
        for (let k = 0; k < 3; k++) {
          const direction =
            noise(c.seed, i * 131 + k * 31 + Math.floor(tick / 4) * 79) *
            Math.PI *
            2;
          const spark: ElectricPoint[] = [end];
          for (let j = 1; j <= 7; j++) {
            const t = j / 7,
              jitter =
                (noise(c.seed, i * 701 + tick * 47 + k * 17 + j) - 0.5) *
                reach *
                0.65;
            spark.push({
              x:
                end.x +
                Math.cos(direction) * reach * t -
                Math.sin(direction) * jitter,
              y:
                end.y +
                Math.sin(direction) * reach * t +
                Math.cos(direction) * jitter,
            });
          }
          lines.push({
            points: spark,
            intensity: intensity * 0.8,
            hue: 280,
            width: 0.0012,
          });
          lines.push({
            points: [
              spark[3],
              {
                x: spark[3].x + Math.cos(direction + 1) * reach * 0.5,
                y: spark[3].y + Math.sin(direction + 1) * reach * 0.5,
              },
            ],
            intensity: intensity * 0.4,
            hue: 265,
            width: 0.0009,
          });
        }
      }
      for (let b = 0; b < Math.ceil(c.branching * 3); b++) {
        const root = points[19 + b * 6],
          branch = [root],
          direction = (noise(c.seed, i * 7 + b + 800) - 0.5) * 1.1;
        for (let j = 1; j <= 10; j++) {
          const t = j / 10,
            base = mix(root, end, t * 0.7);
          branch.push({
            x: base.x - dy * direction * t * 0.25,
            y:
              base.y +
              dx * direction * t * 0.25 +
              Math.sin(t * 12 + phase + s.time * 2) * 0.003 * t,
          });
        }
        lines.push({
          points: branch,
          intensity: intensity * c.branching * 0.45,
          hue: 285,
          width: 0.0013,
        });
      }
    });
    drawFilaments(context, lines, c.glow);
    if (c.crackle > 0)
      for (const t of s.threads)
        if (t.visible) {
          const fade =
            t.releasedAge === undefined ? 1 : Math.min(1, 5 - t.releasedAge);
          drawCore(
            context,
            t.point,
            Math.max(0, fade) * (0.15 + t.strength * 0.7),
            c.glow,
            0.008 + t.strength * 0.02,
          );
        }
    drawCore(context, c.center, 0.95, c.glow, 0.045);
  },
  dispose(s) {
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
