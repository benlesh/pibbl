import { defineTexture } from "@crc/core";
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

export interface LightningOptions extends ElectricOptions {
  readonly positive?: ElectricPoint;
  readonly negative?: ElectricPoint;
  readonly edge?: "top" | "right" | "bottom" | "left";
  /** Enables the configured base connection; manual connections remain independent. */
  readonly active?: boolean;
  /** Topology refreshes per second, 1..30. Connections survive several refreshes. */
  readonly frequency?: number;
  readonly contactCore?: boolean;
}
export type LightningMessage =
  | ElectricControl
  | {
      readonly type: "connect";
      readonly id: string;
      readonly positive: ElectricPoint;
      readonly negative: ElectricPoint;
    }
  | { readonly type: "disconnect"; readonly id: string }
  | {
      readonly type: "configure";
      readonly positive?: ElectricPoint;
      readonly negative?: ElectricPoint;
      readonly edge?: LightningOptions["edge"];
      readonly active?: boolean;
      readonly branching?: number;
      readonly glow?: number;
      readonly frequency?: number;
    };
function options(o: LightningOptions) {
  if (
    o.edge !== undefined &&
    !["top", "right", "bottom", "left"].includes(o.edge)
  )
    throw new TypeError("Unknown lightning edge.");
  return {
    ...electricOptions(o),
    positive: point(o.positive ?? { x: 0.2, y: 0.5 }),
    negative: point(o.negative ?? { x: 0.8, y: 0.5 }),
    edge: o.edge,
    active: o.active ?? true,
    frequency: range(o.frequency ?? 15, 1, 30, "Frequency"),
    contactCore: o.contactCore ?? false,
  };
}
interface Connection {
  positive: ElectricPoint;
  negative: ElectricPoint;
  strength: number;
  active: boolean;
  salt: number;
}
interface State {
  config: ReturnType<typeof options>;
  inputKey: string;
  time: number;
  paused: boolean;
  connections: Map<string, Connection>;
}
function salt(id: string) {
  let n = 0;
  for (let i = 0; i < id.length; i++)
    n = (Math.imul(n, 31) + id.charCodeAt(i)) | 0;
  return n;
}
const recipe = defineTexture<LightningOptions, State, LightningMessage>({
  defaultPlacement: { mode: "stretch" },
  create(context, input) {
    if (input.active !== false) context.requestFrame();
    return {
      config: options(input),
      inputKey: JSON.stringify(input),
      time: 0,
      paused: false,
      connections: new Map(),
    };
  },
  update(s, input, context) {
    const key = JSON.stringify(input);
    if (key === s.inputKey) return;
    const next = options(input);
    if (next.seed !== s.config.seed) {
      s.time = 0;
      s.connections.clear();
    }
    s.config = next;
    s.inputKey = key;
    context.invalidate();
    if (!s.paused && (next.active || s.connections.size))
      context.requestFrame();
  },
  receive(s, m, context) {
    switch (m.type) {
      case "pause":
        s.paused = m.paused;
        break;
      case "reset":
        s.config.seed =
          m.seed === undefined ? s.config.seed : validateSeed(m.seed);
        s.time = 0;
        s.connections.clear();
        break;
      case "configure":
        s.config = options({ ...s.config, ...m });
        break;
      case "connect": {
        if (typeof m.id !== "string" || m.id.length > 128)
          throw new RangeError(
            "Connection id must be a string of at most 128 characters.",
          );
        const positive = point(m.positive),
          negative = point(m.negative),
          old = s.connections.get(m.id);
        if (old) {
          old.positive = positive;
          old.negative = negative;
          old.active = true;
          old.strength = 1;
        } else if (s.connections.size < 24)
          s.connections.set(m.id, {
            positive,
            negative,
            strength: 1,
            active: true,
            salt: salt(m.id),
          });
        break;
      }
      case "disconnect": {
        const old = s.connections.get(m.id);
        if (old) old.active = false;
        break;
      }
      default:
        throw new TypeError("Unknown lightning message.");
    }
    context.invalidate();
    if (!s.paused && (s.config.active || s.connections.size))
      context.requestFrame();
  },
  advance(s, frame, context) {
    if (s.paused) return;
    const dt = Math.min(50, frame.delta) / 1000;
    s.time += dt;
    for (const [id, c] of s.connections) {
      if (!c.active) c.strength *= Math.exp(-dt * 15);
      if (c.strength < 0.005) s.connections.delete(id);
    }
    context.invalidate();
    if (s.config.active || s.connections.size) context.requestFrame();
  },
  rasterize(s, context) {
    const c = s.config,
      lines: Filament[] = [],
      connections = [...s.connections.values()];
    const epoch = Math.floor(s.time * c.frequency),
      jump = Math.floor(epoch / 6);
    if (c.active) {
      let negative = c.negative;
      if (c.edge) {
        const t = 0.1 + noise(c.seed, jump + 1000) * 0.8;
        negative =
          c.edge === "top"
            ? { x: t, y: 0.1 }
            : c.edge === "bottom"
              ? { x: t, y: 0.9 }
              : c.edge === "left"
                ? { x: 0.1, y: t }
                : { x: 0.9, y: t };
      }
      connections.unshift({
        positive: c.positive,
        negative,
        strength: 1,
        active: true,
        salt: 0,
      });
    }
    for (const connection of connections) {
      const { positive: a, negative: b } = connection;
      const seed = c.seed ^ connection.salt,
        dx = b.x - a.x,
        dy = b.y - a.y;
      const points: ElectricPoint[] = [];
      // Coarse structure persists for six flickers. Fine structure varies faster.
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        const offset =
          Math.sin(t * Math.PI) *
          ((noise(seed, i + jump * 41) - 0.5) * 0.32 +
            (noise(seed, i + epoch * 79) - 0.5) * 0.11);
        points.push({
          x: a.x + dx * t - dy * offset,
          y: a.y + dy * t + dx * offset,
        });
      }
      const intensity =
        connection.strength * (0.65 + noise(seed, epoch + 600) * 0.35);
      lines.push({
        points,
        intensity,
        hue: 265 + noise(seed, jump) * 45,
        width: 0.002,
      });
      for (let j = 0; j < Math.ceil(c.branching * 5); j++) {
        const index = 5 + j * 3,
          root = points[index],
          baseTip = mix(root, b, 0.5);
        const fork = (noise(seed, j + epoch * 37) - 0.5) * 1.6;
        const tip = { x: baseTip.x - dy * fork, y: baseTip.y + dx * fork };
        const branch: ElectricPoint[] = [root];
        for (let k = 1; k <= 7; k++) {
          const p = mix(root, tip, k / 7),
            jitter = (noise(seed, k + j * 13 + epoch * 53) - 0.5) * 0.13;
          branch.push({ x: p.x - dy * jitter, y: p.y + dx * jitter });
        }
        lines.push({
          points: branch,
          intensity: intensity * c.branching * 0.75,
          hue: 285,
          width: 0.0012,
        });
      }
    }
    drawFilaments(context, lines, c.glow);
    if (c.contactCore)
      for (const connection of connections)
        drawCore(context, connection.positive, connection.strength, c.glow);
  },
  dispose(s) {
    s.connections.clear();
  },
});
/** Persistent branching arcs between artistic positive/negative points. */
export function lightning(config: LightningOptions = {}) {
  return recipe(config);
}
