import { ElectricMemory, type ElectricConnection } from "./wasm/electric.js";
import { lazyKernel } from "./wasm/memory.js";
import { bytes } from "./wasm/lightning-bytes.js";
const wasmModule = /* @__PURE__ */ lazyKernel(bytes);
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
type Connection = ElectricConnection;
interface State {
  kernel: ElectricMemory;
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
const recipe = /* @__PURE__ */ defineTexture<
  LightningOptions,
  State,
  LightningMessage
>({
  defaultPlacement: { mode: "stretch" },
  create(context, input) {
    if (input.active !== false) context.requestFrame();
    const config = options(input);
    return {
      kernel: new ElectricMemory(wasmModule()),
      config,
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
      s.kernel.clearConnections();
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
        s.kernel.clearConnections();
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
          s.connections.set(
            m.id,
            Object.assign(s.kernel.connection(), {
              positive,
              negative,
              strength: 1,
              active: true,
              salt: salt(m.id),
            }),
          );
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
    s.kernel.advanceLightning(dt);
    for (const [id, c] of s.connections) {
      if (c.strength < 0.005) {
        c.release();
        s.connections.delete(id);
      }
    }
    context.invalidate();
    if (s.config.active || s.connections.size) context.requestFrame();
  },
  rasterize(s, context) {
    s.kernel.lightning(s.config, s.time, s.connections.values());
    s.kernel.draw(context, s.config.glow);
  },
  dispose(s) {
    s.connections.clear();
    s.kernel.dispose();
  },
});
/** Persistent branching arcs between artistic positive/negative points. */
export function lightning(config: LightningOptions = {}) {
  return recipe(config);
}
