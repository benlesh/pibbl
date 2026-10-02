import type { TextureContext } from "@crc/core";
import { drawCore, type ElectricPoint } from "../electric-shared.js";
import type { SourceSite } from "../electric-sources.js";
const S = 64,
  T = 2624,
  P = 3072,
  L = 3584,
  O = 3784;
type Exports = Record<string, (...args: number[]) => number>;
class PointView implements ElectricPoint {
  constructor(
    private owner: ElectricMemory,
    private offset: number,
  ) {}
  get x() {
    return this.owner.data[this.offset];
  }
  get y() {
    return this.owner.data[this.offset + 1];
  }
}
export class ElectricThread {
  private readonly p: PointView;
  private readonly trajectoryPoint: PointView;
  private readonly source: PointView;
  constructor(
    private owner: ElectricMemory,
    private offset: number,
  ) {
    this.p = new PointView(owner, offset + 1);
    this.trajectoryPoint = new PointView(owner, offset + 6);
    this.source = new PointView(owner, offset + 8);
  }
  get sourceId() {
    return this.owner.ids[this.owner.data[this.offset]];
  }
  set sourceId(id: string | undefined) {
    this.owner.data[this.offset] =
      id === undefined ? 0 : this.owner.tokens.get(id)!;
  }
  get point() {
    return this.p;
  }
  set point(p: ElectricPoint) {
    this.owner.data[this.offset + 1] = p.x;
    this.owner.data[this.offset + 2] = p.y;
  }
  get trajectory() {
    return this.trajectoryPoint;
  }
  set trajectory(p: ElectricPoint) {
    this.owner.data[this.offset + 6] = p.x;
    this.owner.data[this.offset + 7] = p.y;
  }
  get sourcePoint() {
    return this.source;
  }
  set sourcePoint(p: ElectricPoint) {
    this.owner.data[this.offset + 8] = p.x;
    this.owner.data[this.offset + 9] = p.y;
  }
  get strength() {
    return this.owner.data[this.offset + 3];
  }
  set strength(v: number) {
    this.owner.data[this.offset + 3] = v;
  }
  get age() {
    return this.owner.data[this.offset + 4];
  }
  set age(v: number) {
    this.owner.data[this.offset + 4] = v;
  }
  get generation() {
    return this.owner.data[this.offset + 5];
  }
  set generation(v: number) {
    this.owner.data[this.offset + 5] = v;
  }
  get releasedAge() {
    const n = this.owner.data[this.offset + 10];
    return n < 0 ? undefined : n;
  }
  set releasedAge(v: number | undefined) {
    this.owner.data[this.offset + 10] = v ?? -1;
  }
  get visible() {
    return this.owner.data[this.offset + 11] !== 0;
  }
  set visible(v: boolean) {
    this.owner.data[this.offset + 11] = +v;
  }
  get born() {
    return this.owner.data[this.offset + 12] !== 0;
  }
  set born(v: boolean) {
    this.owner.data[this.offset + 12] = +v;
  }
}
export class ElectricConnection {
  private readonly a: PointView;
  private readonly b: PointView;
  readonly offset: number;
  constructor(
    private owner: ElectricMemory,
    readonly index: number,
  ) {
    this.offset = L + index * 8;
    this.a = new PointView(owner, this.offset);
    this.b = new PointView(owner, this.offset + 2);
  }
  get positive() {
    return this.a;
  }
  set positive(p: ElectricPoint) {
    this.owner.data[this.offset] = p.x;
    this.owner.data[this.offset + 1] = p.y;
  }
  get negative() {
    return this.b;
  }
  set negative(p: ElectricPoint) {
    this.owner.data[this.offset + 2] = p.x;
    this.owner.data[this.offset + 3] = p.y;
  }
  get strength() {
    return this.owner.data[this.offset + 4];
  }
  set strength(v: number) {
    this.owner.data[this.offset + 4] = v;
  }
  get salt() {
    return this.owner.data[this.offset + 5];
  }
  set salt(v: number) {
    this.owner.data[this.offset + 5] = v;
  }
  get active() {
    return this.owner.data[this.offset + 6] > 0;
  }
  set active(v: boolean) {
    this.owner.data[this.offset + 6] = v ? 1 : -1;
  }
  release() {
    this.owner.data[this.offset + 6] = 0;
  }
}
/** One fixed heap per mounted electric resource; all numeric views borrow it. */
export class ElectricMemory {
  data: Float64Array<ArrayBuffer>;
  private kernel?: Exports;
  private outline?: readonly ElectricPoint[];
  readonly tokens = new Map<string, number>();
  ids: (string | undefined)[] = [undefined];
  private ordered: SourceSite[] = [];
  constructor(module: WebAssembly.Module) {
    const memory = new WebAssembly.Memory({ initial: 3, maximum: 3 });
    this.data = new Float64Array(memory.buffer, 65536);
    this.kernel = new WebAssembly.Instance(module, {
      env: {
        memory,
        abort() {
          throw new Error("Electric texture WASM aborted.");
        },
      },
    }).exports as Exports;
  }
  thread(index: number) {
    return new ElectricThread(this, T + index * 14);
  }
  connection() {
    for (let i = 1; i < 25; i++)
      if (this.data[L + i * 8 + 6] === 0)
        return new ElectricConnection(this, i);
    throw new RangeError("At most 24 lightning connections may be active.");
  }
  clearConnections() {
    this.data.fill(0, L, L + 25 * 8);
  }
  setSources(sites: readonly SourceSite[]) {
    // Preserve live bindings while compacting IDs, so removed source history
    // cannot accumulate in the JS control map across repeated edits.
    const old = Array.from(
      { length: 32 },
      (_, i) => this.ids[this.data[T + i * 14]],
    );
    this.ordered = [...sites].sort((a, b) =>
      a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
    );
    this.tokens.clear();
    this.ids = [undefined];
    for (const id of [...this.ordered.map((s) => s.id), ...old])
      if (id !== undefined && !this.tokens.has(id)) {
        this.tokens.set(id, this.ids.length);
        this.ids.push(id);
      }
    for (let i = 0; i < 32; i++)
      this.data[T + i * 14] =
        old[i] === undefined ? 0 : this.tokens.get(old[i]!)!;
    this.data[0] = this.ordered.length;
    this.ordered.forEach((site, i) => {
      const p = S + i * 5;
      this.data[p] = this.tokens.get(site.id)!;
      this.data[p + 1] = site.point.x;
      this.data[p + 2] = site.point.y;
      this.data[p + 3] = site.weight;
      this.data[p + 4] = site.hash;
    });
  }
  choose(seed: number, ticket: number) {
    return this.ordered[this.kernel!.choose(seed, ticket)];
  }
  boundary(points: readonly ElectricPoint[] | undefined) {
    if (this.outline === points) return;
    this.outline = points;
    this.data[1] = points?.length ?? 0;
    points?.forEach((p, i) => {
      this.data[P + i * 2] = p.x;
      this.data[P + i * 2 + 1] = p.y;
    });
  }
  advanceTendrils(count: number, seed: number, dt: number, rise: number) {
    this.kernel!.advance(count, seed, dt, rise);
  }
  advanceLightning(dt: number) {
    this.kernel!.advance(dt);
  }
  tendrils(
    c: {
      seed: number;
      center: ElectricPoint;
      rise: number;
      crackle: number;
      frequency: number;
      branching: number;
    },
    time: number,
    count: number,
  ) {
    this.kernel!.generate(
      count,
      c.seed,
      time,
      c.center.x,
      c.center.y,
      c.rise,
      c.crackle,
      c.frequency,
      c.branching,
    );
  }
  lightning(
    c: {
      seed: number;
      frequency: number;
      branching: number;
      active: boolean;
      edge?: string;
      positive: ElectricPoint;
      negative: ElectricPoint;
      contactCore: boolean;
    },
    time: number,
    connections: Iterable<ElectricConnection>,
  ) {
    let n = 0;
    for (const connection of connections) this.data[3 + n++] = connection.index;
    this.data[2] = n;
    this.kernel!.generate(
      c.seed,
      time,
      c.frequency,
      c.branching,
      +c.active,
      ["", "top", "right", "bottom", "left"].indexOf(c.edge ?? ""),
      c.positive.x,
      c.positive.y,
      c.negative.x,
      c.negative.y,
      +c.contactCore,
    );
  }
  draw(context: TextureContext, glow: number) {
    const ctx = context.canvas.getContext("2d")!,
      w = context.canvas.width,
      h = context.canvas.height,
      scale = Math.min(w, h),
      d = this.data;
    ctx.globalCompositeOperation = "lighter";
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    for (let pass = 0; pass < 4; pass++) {
      if (pass < 2 && glow === 0) continue;
      let p = O + 3;
      for (let line = 0; line < d[O]; line++) {
        const count = d[p],
          intensity = d[p + 1],
          hue = d[p + 2],
          width = d[p + 3];
        p += 4;
        if (intensity >= 0.005) {
          ctx.beginPath();
          ctx.moveTo(d[p] * w, d[p + 1] * h);
          for (let i = 1; i < count; i++)
            ctx.lineTo(d[p + i * 2] * w, d[p + i * 2 + 1] * h);
          const alpha = Math.min(
            1,
            intensity *
              (pass === 0
                ? 0.055 * glow
                : pass === 1
                  ? 0.16 * glow
                  : pass === 2
                    ? 0.65
                    : 0.95),
          );
          ctx.strokeStyle =
            pass === 3
              ? `rgba(245,239,255,${alpha})`
              : `hsla(${hue},100%,${pass === 2 ? 72 : 58}%,${alpha})`;
          ctx.lineWidth = Math.max(
            0.45,
            scale *
              width *
              (pass === 0
                ? 16 * glow
                : pass === 1
                  ? 6 * glow
                  : pass === 2
                    ? 2
                    : 0.65),
          );
          ctx.stroke();
        }
        p += count * 2;
      }
    }
    let p = d[O + 1];
    for (let i = 0; i < d[O + 2]; i++, p += 4)
      drawCore(context, { x: d[p], y: d[p + 1] }, d[p + 2], glow, d[p + 3]);
  }
  dispose() {
    this.kernel = undefined;
    this.data = new Float64Array(0);
    this.tokens.clear();
    this.ids = [];
    this.ordered = [];
    this.outline = undefined;
  }
}
