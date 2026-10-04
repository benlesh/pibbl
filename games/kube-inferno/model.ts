/** Deterministic, bounded business simulation. No browser or CRC dependencies. */
export type Kind =
  "small" | "large" | "cache" | "database" | "shield" | "gateway";
export const catalog: Record<
  Kind,
  {
    name: string;
    price: number;
    cost: number;
    build: number;
    capacity: number;
    art: number;
    hint: string;
  }
> = {
  small: {
    name: "Small server",
    price: 100,
    cost: 2,
    build: 3,
    capacity: 240,
    art: 1,
    hint: "Quick relief · 240 req/s",
  },
  large: {
    name: "Large server",
    price: 600,
    cost: 7,
    build: 20,
    capacity: 850,
    art: 4,
    hint: "Efficient capacity · 850 req/s",
  },
  cache: {
    name: "Cache",
    price: 350,
    cost: 3,
    build: 12,
    capacity: 0,
    art: 3,
    hint: "Cuts database reads by 45%",
  },
  database: {
    name: "Read replica",
    price: 800,
    cost: 6,
    build: 30,
    capacity: 500,
    art: 2,
    hint: "Adds read capacity · 500 req/s",
  },
  shield: {
    name: "Shield",
    price: 450,
    cost: 4,
    build: 15,
    capacity: 0,
    art: 0,
    hint: "Filters 85% of attack traffic",
  },
  gateway: {
    name: "Load balancer",
    price: 400,
    cost: 5,
    build: 8,
    capacity: 10000,
    art: 0,
    hint: "Routes incoming requests",
  },
};
export interface Machine {
  id: string;
  kind: Kind;
  name: string;
  x: number;
  y: number;
  ready: boolean;
  dead: boolean;
  built: number;
  load: number;
  queue: number;
}
export interface Game {
  time: number;
  bank: number;
  users: number;
  revenue: number;
  costs: number;
  quality: number;
  efficiency: number;
  investigation: number;
  nodes: Machine[];
  edges: [string, string][];
  logs: string[];
  nextId: number;
  peakUsers: number;
  peakBank: number;
  phase: number;
  event: string;
  demand: number;
  attack: number;
  insolvency: number;
  ended: boolean;
  history: number[];
}
export function createGame(): Game {
  const make = (
    id: string,
    kind: Kind,
    name: string,
    x: number,
    y: number,
    dead = false,
  ): Machine => ({
    id,
    kind,
    name,
    x,
    y,
    dead,
    ready: true,
    built: catalog[kind].build,
    load: 0,
    queue: 0,
  });
  return {
    time: 0,
    bank: 24850,
    users: 12480,
    revenue: 186,
    costs: 0,
    quality: 0.65,
    efficiency: 1,
    investigation: 0,
    nextId: 4,
    peakUsers: 12480,
    peakBank: 24850,
    phase: 0,
    event: "FLASH CROWD",
    demand: 16000,
    attack: 0,
    insolvency: 0,
    ended: false,
    history: [],
    nodes: [
      make("gateway", "gateway", "LOAD BALANCER", 175, 285),
      make("app-1", "small", "APP 01", 510, 155),
      make("app-2", "small", "APP 02", 510, 355),
      make("app-3", "small", "APP 03", 510, 555, true),
      make("database", "database", "DATABASE", 980, 275),
      make("cache", "cache", "CACHE", 860, 555),
    ],
    edges: [
      ["gateway", "app-1"],
      ["gateway", "app-2"],
      ["gateway", "app-3"],
      ["app-1", "database"],
      ["app-2", "database"],
      ["app-3", "database"],
      ["app-1", "cache"],
      ["app-2", "cache"],
      ["cache", "database"],
    ],
    logs: [
      "APP 03 failed · replace or retire it",
      "Flash crowd incoming · scale your service",
    ],
  };
}
export function log(g: Game, message: string) {
  g.logs.unshift(message);
  g.logs.length = Math.min(g.logs.length, 5);
}
export function purchase(
  g: Game,
  kind: Kind,
  x: number,
  y: number,
): Machine | null {
  const item = catalog[kind];
  if (
    g.ended ||
    g.bank < item.price ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    g.nodes.length >= 24
  )
    return null;
  const id = `node-${g.nextId++}`;
  const n: Machine = {
    id,
    kind,
    name: `${item.name.toUpperCase()} ${g.nextId - 1}`,
    x,
    y,
    ready: false,
    dead: false,
    built: 0,
    load: 0,
    queue: 0,
  };
  g.bank -= item.price;
  g.nodes.push(n);
  log(g, `${item.name} deploying · connect its ports`);
  return n;
}
const app = (n: Machine) => n.kind === "small" || n.kind === "large";
export function connect(g: Game, from: string, to: string): boolean {
  const a = g.nodes.find((n) => n.id === from),
    b = g.nodes.find((n) => n.id === to);
  if (!a || !b || a === b || g.ended) return false;
  const allowed =
    (a.kind === "gateway" && (app(b) || b.kind === "shield")) ||
    (a.kind === "shield" && app(b)) ||
    (app(a) && (b.kind === "cache" || b.kind === "database")) ||
    (a.kind === "cache" && b.kind === "database");
  if (!allowed || g.edges.some(([x, y]) => x === from && y === to))
    return false;
  g.edges.push([from, to]);
  log(g, `${a.name} → ${b.name} connected`);
  return true;
}
export function retire(g: Game, id: string): boolean {
  if (id === "gateway" || id === "database" || g.ended) return false;
  const n = g.nodes.find((n) => n.id === id);
  if (!n) return false;
  g.nodes = g.nodes.filter((n) => n.id !== id);
  g.edges = g.edges.filter((e) => !e.includes(id));
  log(g, `${n.name} retired · running cost removed`);
  return true;
}
export function investigate(g: Game): boolean {
  if (g.bank < 250 || g.investigation !== 0 || g.ended) return false;
  g.bank -= 250;
  g.investigation = 25;
  log(g, "Investigating redundant database queries · 25s");
  return true;
}
export function incident(
  g: Game,
  type: "surge" | "downturn" | "attack" | "failure",
) {
  if (type === "failure") {
    const candidates = g.nodes.filter((n) => app(n) && n.ready && !n.dead);
    const n =
      candidates[Math.floor(g.time * 7) % Math.max(1, candidates.length)];
    if (n) {
      n.dead = true;
      log(g, `${n.name} failed · traffic redistributed`);
    }
    return;
  }
  g.event =
    type === "surge"
      ? "FLASH CROWD"
      : type === "downturn"
        ? "ECONOMIC DOWNTURN"
        : "DDoS ATTACK";
  g.demand = type === "downturn" ? 4500 : 18000;
  g.attack = type === "attack" ? 1400 : 0;
  log(g, g.event.toLowerCase() + " · adapt your infrastructure");
}
export function advance(g: Game, dt: number) {
  if (g.ended) return;
  g.time += dt;
  const phase = Math.floor(g.time / 60);
  if (phase !== g.phase) {
    g.phase = phase;
    incident(g, (["surge", "downturn", "attack"] as const)[phase % 3]);
    if (phase % 3 === 2) incident(g, "failure");
  }
  for (const n of g.nodes) {
    if (!n.ready) {
      n.built = Math.min(catalog[n.kind].build, n.built + dt);
      if (n.built >= catalog[n.kind].build) {
        n.ready = true;
        log(g, `${n.name} ready`);
      }
    }
  }
  if (g.investigation > 0) {
    g.investigation = Math.max(0, g.investigation - dt);
    if (g.investigation === 0) {
      g.investigation = -1;
      g.efficiency = 1.5;
      log(g, "Redundant queries removed · app capacity +50%");
    }
  }
  const live = (id: string) =>
    g.nodes.find((n) => n.id === id && n.ready && !n.dead);
  const has = (a: string, b: string) =>
    g.edges.some(([x, y]) => x === a && y === b);
  const incoming = (n: Machine) =>
    has("gateway", n.id) ||
    g.nodes.some(
      (s) =>
        s.kind === "shield" &&
        live(s.id) &&
        has("gateway", s.id) &&
        has(s.id, n.id),
    );
  const dbs = g.nodes.filter((n) => n.kind === "database" && live(n.id));
  const apps = g.nodes.filter(
    (n) =>
      app(n) &&
      live(n.id) &&
      incoming(n) &&
      dbs.some(
        (db) =>
          has(n.id, db.id) ||
          g.nodes.some(
            (c) =>
              c.kind === "cache" &&
              live(c.id) &&
              has(n.id, c.id) &&
              has(c.id, db.id),
          ),
      ),
  );
  const protectedApp = (n: Machine) =>
    g.nodes.some(
      (s) =>
        s.kind === "shield" &&
        live(s.id) &&
        has("gateway", s.id) &&
        has(s.id, n.id),
    ) && !has("gateway", n.id);
  const protectedShare = apps.length
    ? apps.filter(protectedApp).length / apps.length
    : 0;
  const requests = g.users * 0.07 + g.attack * (1 - 0.85 * protectedShare);
  const capacity = apps.reduce(
    (sum, n) => sum + catalog[n.kind].capacity * g.efficiency,
    0,
  );
  const cached = apps.length
    ? apps.filter((n) =>
        g.nodes.some(
          (c) =>
            c.kind === "cache" &&
            live(c.id) &&
            has(n.id, c.id) &&
            has(c.id, "database"),
        ),
      ).length / apps.length
    : 0;
  const dbDemand = (requests * (1 - 0.45 * cached)) / g.efficiency;
  const usedDbs = dbs.filter((db) =>
    apps.some(
      (n) =>
        has(n.id, db.id) ||
        g.nodes.some(
          (c) =>
            c.kind === "cache" &&
            live(c.id) &&
            has(n.id, c.id) &&
            has(c.id, db.id),
        ),
    ),
  );
  const dbCapacity = usedDbs.reduce(
    (sum, n) => sum + (n.id === "database" ? 850 : 500),
    0,
  );
  const ratio = capacity ? requests / capacity : 10;
  const quality = Math.max(
    0.02,
    Math.min(1, 1 / ratio, dbDemand ? dbCapacity / dbDemand : 1),
  );
  g.quality += (quality - g.quality) * Math.min(1, dt * 2);
  for (const n of g.nodes) {
    const target =
      n.dead || !n.ready
        ? 0
        : app(n)
          ? apps.includes(n)
            ? ratio
            : 0
          : n.kind === "database"
            ? usedDbs.includes(n)
              ? dbDemand / Math.max(dbCapacity, 1)
              : 0
            : n.kind === "gateway"
              ? requests / 10000
              : 0.25;
    n.load += (target - n.load) * Math.min(1, dt * 2);
    n.queue = Math.max(0, n.queue + (target - 1) * 100 * dt);
    n.queue = Math.min(n.queue, 9999);
  }
  const desired = g.demand * (0.15 + 0.85 * g.quality * g.quality);
  g.users += (desired - g.users) * dt * (desired > g.users ? 0.012 : 0.035);
  g.revenue = g.users * 0.02 * g.quality;
  g.costs = 70 + g.nodes.reduce((sum, n) => sum + catalog[n.kind].cost, 0);
  g.bank += (g.revenue - g.costs) * dt;
  g.peakUsers = Math.max(g.peakUsers, g.users);
  g.peakBank = Math.max(g.peakBank, g.bank);
  g.insolvency = g.bank < 0 ? g.insolvency + dt : 0;
  if (g.insolvency >= 15) {
    g.ended = true;
    log(g, "Service closed · cash runway exhausted");
  }
  if (Math.floor(g.time * 2) !== Math.floor((g.time - dt) * 2)) {
    g.history.push(g.revenue);
    if (g.history.length > 80) g.history.shift();
  }
}
