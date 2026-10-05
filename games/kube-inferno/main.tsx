import {
  pibbl,
  signal,
  useSignal,
  useConst,
  usePlayback,
  useReaction,
  drive,
  stepper,
  type PibblPlayback,
} from "@pibbl/core";
import {
  createGame,
  advance,
  purchase,
  connect,
  retire,
  investigate,
  incident,
  catalog,
  type Kind,
} from "./model";
import { Background, Sprite, Effects, frames, type Camera } from "./scene";
import machineUrl from "./assets/machines.png";
import "../../playground/node_modules/@fontsource-variable/space-grotesk/index.css";
import "./style.css";
import { mountQuickGuide } from "./tutorial";
import { mapViewport, screenToWorld } from "./map-viewport";

const root = document.querySelector<HTMLElement>("#game")!;
root.innerHTML = `
<header class="hud">
 <div class="brand"><span class="flame"><svg viewBox="0 0 40 52" width="40" height="52" aria-hidden="true"><path fill="#ff914b" d="M22 0C30 15 13 14 24 29C26 23 32 19 31 11C46 29 42 46 23 51C3 53-6 30 10 17C7 29 12 32 14 31C3 15 23 16 22 0Z"/><path fill="#ffd077" d="M21 29C32 40 24 49 18 47C10 44 14 36 21 29Z"/></svg></span><div><h1>KUBE INFERNO</h1><p>BUILD · SCALE · SURVIVE</p></div></div>
 <div class="metrics"><div><label>ACTIVE USERS</label><strong id="users">12,480</strong></div><div><label>REVENUE</label><strong id="revenue">$186<span>/s</span></strong></div><div><label>COSTS</label><strong id="costs">$94<span>/s</span></strong></div><div><label>PROFIT</label><strong id="profit" class="mint">+$92<span>/s</span></strong></div><div><label>BANK</label><strong id="bank">$24,850</strong></div></div>
 <div class="spark"><label>LIVE REVENUE / SEC</label><svg viewBox="0 0 220 38" aria-label="Recent revenue"><polyline id="sparkline" fill="none" stroke="#57eadd" stroke-width="2" points="0,20 220,20"/></svg></div>
</header>
<div class="incident"><span class="warning">⚠</span><strong id="event">FLASH CROWD</strong><span id="event-detail">Demand is rising. Keep your customers online.</span><span class="countdown" id="countdown">01:00</span></div>
<section class="workspace">
 <div class="map" id="map"><canvas id="canvas" width="1200" height="720" aria-label="Interactive infrastructure map. Use the machine selector and build controls for keyboard operation."></canvas><div class="map-title"><span class="live-dot"></span> EMBER / US-EAST <span class="subtle">CLUSTER 01</span></div><div class="map-controls"><button id="zoom-out" aria-label="Zoom out">−</button><button id="fit">FIT</button><button id="zoom-in" aria-label="Zoom in">+</button></div><div class="map-help" id="map-help">Drag a machine into the cluster · Connect its ports · Keep the lights on</div><div id="toast" role="status"></div></div>
 <aside class="inspector"><div class="inspector-top"><span>INSPECT COMPONENT</span><span class="live-dot"></span></div><select id="selection" aria-label="Select a machine"></select><div id="status" class="status">OVERLOADED</div><dl><div><dt>CPU PRESSURE</dt><dd id="load">98%</dd></div><div class="meter"><i id="load-bar"></i></div><div><dt>QUEUED REQUESTS</dt><dd id="queue">342</dd></div><div><dt>RUNNING COST</dt><dd id="running">$2/s</dd></div><div><dt>CAPACITY</dt><dd id="capacity">240 req/s</dd></div></dl><p id="explanation" class="explanation"></p><div class="actions"><button id="investigate">⌕ &nbsp; Investigate <small>$250 · 25s</small></button><button id="replica">+ &nbsp; Add replica <small>$100 · 3s</small></button><button id="retire" class="danger">− &nbsp; Retire component</button></div><div class="route-control"><label for="route">CONNECT SELECTED TO</label><div><select id="route" aria-label="Connection destination"></select><button id="connect" aria-label="Connect selected machines">↗</button></div><button id="disconnect">Disconnect selected route</button></div><div class="records"><label>PERSONAL BEST</label><div><span>Peak users</span><b id="peak-users">12,480</b></div><div><span>Peak bank</span><b id="peak-bank">$24,850</b></div></div></aside>
</section>
<footer class="dock"><div class="event-log"><label>OPERATIONS LOG</label><ol id="log"></ol></div><div class="build-tray" id="build-tray"></div><div class="simulation"><label>SIMULATION SPEED</label><div class="speed-controls"><button id="pause" aria-label="Pause simulation">Ⅱ</button><button data-speed="1" class="active">1×</button><button data-speed="2">2×</button></div><button id="effects" class="quiet" aria-pressed="false">Reduce effects</button><button id="restart" class="quiet">New run ↗</button></div></footer><div class="statusbar"><span>Pibbl / CANVAS 2D</span><span id="instruction">Keep systems online. Grow something worth saving.</span><button id="help">How to play</button></div>
<dialog id="help-dialog"><button class="close" aria-label="Close instructions">×</button><span class="eyebrow">WELCOME TO YOUR NEXT INCIDENT</span><h2>Build. Scale. Survive.</h2><p>Your customers pay when requests succeed. Slow service loses sales—and eventually customers.</p><ol><li><b>Build capacity.</b> Drag a card onto the map, or click one then click an empty location. Construction costs money and time.</li><li><b>Connect it.</b> Click a machine’s right port, then a destination’s left port. App servers need an incoming gateway route and a path to a database. The inspector also has keyboard-friendly connection controls.</li><li><b>Invest wisely.</b> Investigate to remove redundant queries. Retire excess servers when demand drops. Retiring immediately removes the machine in this first playable version.</li><li><b>Read the map.</b> Orange means pressure, flames mean overload, sparks mean a dead machine. Every minute brings a new market event.</li></ol><p class="subtle">This first slice uses a simplified capacity model. Machines bundle compute and workload capacity; it is not a Kubernetes emulator.</p><button id="replay-tips" class="primary">Replay quick tips</button><button class="primary close">Keep the lights on →</button></dialog>`;
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
let game = createGame();
let selected = "app-2",
  connection = "",
  placing: Kind | null = null,
  paused = false,
  speed = 1,
  hidden = false;
let reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const camera: Camera = { zoom: 0.88, x: 30, y: 78 };
const revision = signal(0),
  loaded = signal(false);
const atlas = new window.Image();
atlas.onload = () => loaded.set(true);
atlas.onerror = () => toast("Machine artwork could not load. Reload to retry.");
atlas.src = machineUrl;
let playback: PibblPlayback | undefined,
  lastClock = 0,
  lastHud = -1,
  lastSave = -1,
  recordUsers = 0,
  recordBank = 0;
try {
  const r = JSON.parse(localStorage.getItem("kube-inferno:records:v1") || "{}");
  recordUsers = Number(r.users) || 0;
  recordBank = Number(r.bank) || 0;
} catch {
  /* Storage is optional. */
}
const money = (n: number) => "$" + Math.floor(n).toLocaleString("en-US");
function toast(message: string) {
  $("toast").textContent = message;
  $("toast").classList.add("shown");
}
function refresh() {
  revision.set(revision.get() + 1);
  updateHud();
}
function selectedMachine() {
  return game.nodes.find((n) => n.id === selected) || game.nodes[0];
}
function updateHud() {
  $("users").textContent = Math.floor(game.users).toLocaleString("en-US");
  $("revenue").textContent = money(game.revenue) + "/s";
  $("costs").textContent = money(game.costs) + "/s";
  const profit = game.revenue - game.costs;
  $("profit").textContent =
    (profit >= 0 ? "+" : "−") + money(Math.abs(profit)) + "/s";
  $("profit").className = profit >= 0 ? "mint" : "red";
  $("bank").textContent = money(game.bank);
  $("event").textContent = game.ended ? "SERVICE CLOSED" : game.event;
  $("event-detail").textContent = game.ended
    ? "Your cash runway ran out. Start a new run."
    : game.attack
      ? "Malicious requests consume capacity without earning revenue."
      : game.event === "ECONOMIC DOWNTURN"
        ? "Demand is falling. Retire idle capacity to protect your cash."
        : "Demand is rising. Keep your customers online.";
  const remaining = 60 - Math.floor(game.time % 60);
  $("countdown").textContent = paused
    ? "PAUSED"
    : `${Math.floor(remaining / 60)
        .toString()
        .padStart(2, "0")}:${(remaining % 60).toString().padStart(2, "0")}`;
  const n = selectedMachine();
  selected = n.id;
  const selector = $<HTMLSelectElement>("selection");
  const ids = game.nodes.map((n) => n.id).join(",");
  if (selector.dataset.ids !== ids) {
    selector.replaceChildren(
      ...game.nodes.map((n) => new Option(n.name, n.id)),
    );
    selector.dataset.ids = ids;
    $<HTMLSelectElement>("route").replaceChildren(
      ...game.nodes.map((n) => new Option(n.name, n.id)),
    );
  }
  selector.value = selected;
  $("status").textContent = n.dead
    ? "OFFLINE"
    : !n.ready
      ? `BUILDING · ${Math.ceil(catalog[n.kind].build - n.built)}s`
      : n.load > 1
        ? "OVERLOADED"
        : n.load === 0
          ? "NO TRAFFIC"
          : "HEALTHY";
  $("status").className = "status " + (n.dead || n.load > 1 ? "hot" : "cool");
  $("load").textContent = Math.round(n.load * 100) + "%";
  $("load-bar").style.width = Math.min(100, n.load * 100) + "%";
  $("queue").textContent = Math.floor(n.queue).toLocaleString();
  $("running").textContent = money(catalog[n.kind].cost) + "/s";
  $("capacity").textContent = catalog[n.kind].capacity
    ? `${catalog[n.kind].capacity} req/s`
    : "READ RELIEF";
  $("explanation").textContent = n.dead
    ? "This machine is offline. Its traffic has moved to the remaining servers."
    : !n.ready
      ? "Capacity is on its way. Wire this machine into the graph while it builds."
      : n.load > 1
        ? "Incoming work exceeds capacity. Add a replica or investigate a performance improvement."
        : n.load === 0
          ? "No requests are reaching this machine. Check its incoming and outgoing connections."
          : "This component is serving traffic. Watch for bottlenecks further downstream.";
  const inv = $<HTMLButtonElement>("investigate");
  inv.disabled = game.investigation !== 0 || game.bank < 250 || game.ended;
  inv.textContent =
    game.investigation > 0
      ? `Investigating · ${Math.ceil(game.investigation)}s`
      : game.investigation === -1
        ? "✓ Queries optimized · +50%"
        : "⌕ Investigate · $250 / 25s";
  $<HTMLButtonElement>("retire").disabled =
    ["gateway", "database"].includes(n.id) || game.ended;
  $<HTMLButtonElement>("replica").disabled = game.bank < 100 || game.ended;
  $("log").replaceChildren(
    ...game.logs.slice(0, 4).map((s, i) => {
      const li = document.createElement("li");
      li.textContent = s;
      li.className = i === 0 ? "latest" : "";
      return li;
    }),
  );
  const max = Math.max(250, ...game.history);
  $("sparkline").setAttribute(
    "points",
    game.history
      .map(
        (v, i) =>
          `${(i / Math.max(1, game.history.length - 1)) * 220},${36 - (v / max) * 32}`,
      )
      .join(" "),
  );
  $("peak-users").textContent = Math.floor(
    Math.max(recordUsers, game.peakUsers),
  ).toLocaleString();
  $("peak-bank").textContent = money(Math.max(recordBank, game.peakBank));
  document
    .querySelectorAll<HTMLButtonElement>(".build-card")
    .forEach(
      (b) =>
        (b.disabled =
          game.ended ||
          game.bank < catalog[b.dataset.kind as Kind].price ||
          game.nodes.length >= 24),
    );
  if (game.ended)
    toast(
      "Service closed. Your records are saved—start a new run to try again.",
    );
}
function saveRecords() {
  recordUsers = Math.max(recordUsers, game.peakUsers);
  recordBank = Math.max(recordBank, game.peakBank);
  try {
    localStorage.setItem(
      "kube-inferno:records:v1",
      JSON.stringify({ users: recordUsers, bank: recordBank }),
    );
  } catch {
    /* Play remains available without storage. */
  }
}
function App() {
  const time = useSignal(0);
  const program = useConst(() =>
    drive(
      time,
      stepper({
        initial: () => 0,
        step: (n: number) => n + 1 / 60,
        read: (n: number) => n,
        stepMilliseconds: 1000 / 60,
        maxElapsedMilliseconds: 100,
      }),
    ),
  );
  const controls = usePlayback(program, { autoplay: true });
  useReaction(() => {
    playback = controls;
    return () => {
      playback = undefined;
    };
  }, [controls]);
  const now = time.get();
  useReaction(() => {
    const elapsed = Math.max(0, now - lastClock);
    lastClock = now;
    if (!paused && !hidden && !game.ended) {
      let left = Math.min(elapsed, 0.1) * speed;
      while (left > 0) {
        const dt = Math.min(left, 1 / 60);
        advance(game, dt);
        left -= dt;
      }
    }
    if (game.time - lastHud > 0.1 || lastHud < 0) {
      updateHud();
      lastHud = game.time;
    }
    if (Math.floor(game.time / 5) !== lastSave) {
      lastSave = Math.floor(game.time / 5);
      saveRecords();
    }
  }, [now]);
  revision.get();
  const ready = loaded.get();
  return (
    <>
      <Background
        game={game}
        camera={camera}
        selected={selected}
        connection={connection}
        reduced={reduced}
      />
      {[...game.nodes]
        .sort((a, b) => a.y - b.y)
        .map((n) => (
          <>
            {ready && (
              <Sprite
                key={`${n.id}-sprite`}
                image={atlas}
                frame={frames[n.dead ? 5 : catalog[n.kind].art]}
                camera={camera}
                opacity={n.ready ? 1 : 0.42}
                style={{
                  x: n.x,
                  y: n.y,
                  width: n.kind === "database" ? 210 : 190,
                  height: n.kind === "database" ? 210 : 190,
                }}
              />
            )}
            <Effects
              key={`${n.id}-fx`}
              node={n}
              game={game}
              camera={camera}
              selected={selected === n.id}
              reduced={reduced}
            />
          </>
        ))}
    </>
  );
}
const canvas = $<HTMLCanvasElement>("canvas");
const controller = pibbl(canvas, <App />, {
  viewport: { width: 1200, height: 720 },
  fit: "contain",
});
function changePause() {
  paused = !paused;
  syncPlayback();
  updateHud();
}
function syncPlayback() {
  if (hidden || paused || game.ended) playback?.pause();
  else playback?.resume();
  $("pause").textContent = paused ? "▶" : "Ⅱ";
  $("pause").setAttribute(
    "aria-label",
    paused ? "Resume simulation" : "Pause simulation",
  );
}
$("pause").onclick = changePause;
document.querySelectorAll<HTMLButtonElement>("[data-speed]").forEach(
  (b) =>
    (b.onclick = () => {
      speed = Number(b.dataset.speed);
      document
        .querySelectorAll("[data-speed]")
        .forEach((x) => x.classList.toggle("active", x === b));
    }),
);
$("effects").onclick = () => {
  reduced = !reduced;
  $("effects").setAttribute("aria-pressed", String(reduced));
  refresh();
};
$("effects").setAttribute("aria-pressed", String(reduced));
$("selection").onchange = () => {
  selected = $<HTMLSelectElement>("selection").value;
  refresh();
};
$("investigate").onclick = () => {
  if (investigate(game))
    toast(
      "Investigation started. Redundant queries are the suspected bottleneck.",
    );
  refresh();
};
function deploy(kind: Kind, x: number, y: number) {
  const n = purchase(
    game,
    kind,
    Math.max(100, Math.min(1090, x)),
    Math.max(170, Math.min(610, y)),
  );
  if (n) {
    selected = n.id;
    placing = null;
    $("map-help").textContent =
      "Connect the right port of a source to the left port of a destination.";
    toast(`${n.name} is building. Connect gateway → new server → database.`);
  } else toast("Cannot deploy: check your cash and the 24-machine limit.");
  refresh();
  return n;
}
$("replica").onclick = () => {
  const n = selectedMachine();
  const copy = deploy("small", n.x + 180, n.y + 60);
  if (copy) {
    connect(game, "gateway", copy.id);
    connect(game, copy.id, "database");
    toast("Replica deploying with gateway and database routes.");
    refresh();
  }
};
$("retire").onclick = () => {
  retire(game, selected);
  selected = "app-2";
  refresh();
};
$("connect").onclick = () => {
  toast(
    connect(game, selected, $<HTMLSelectElement>("route").value)
      ? "Route connected."
      : "Unsupported or duplicate route. Use gateway → app → database.",
  );
  refresh();
};
$("disconnect").onclick = () => {
  const to = $<HTMLSelectElement>("route").value;
  const count = game.edges.length;
  game.edges = game.edges.filter(([a, b]) => !(a === selected && b === to));
  toast(
    count === game.edges.length
      ? "No such route."
      : "Route removed. Traffic will use the remaining paths.",
  );
  refresh();
};
$("restart").onclick = () => {
  saveRecords();
  game = createGame();
  selected = "app-2";
  lastHud = -1;
  paused = false;
  placing = null;
  connection = "";
  syncPlayback();
  $("toast").classList.remove("shown");
  refresh();
};
const dialog = $<HTMLDialogElement>("help-dialog");
$("help").onclick = () => dialog.showModal();
dialog
  .querySelectorAll<HTMLButtonElement>(".close")
  .forEach((b) => (b.onclick = () => dialog.close()));
const kinds: Kind[] = ["small", "large", "cache", "database", "shield"];
for (const kind of kinds) {
  const item = catalog[kind],
    button = document.createElement("button");
  button.className = "build-card";
  button.dataset.kind = kind;
  button.draggable = true;
  button.title = item.hint;
  button.innerHTML = `<span class="machine-thumb" style="background-image:url('${machineUrl}');background-position:${(item.art % 3) * 50}% ${Math.floor(item.art / 3) * 100}%"></span><b>${item.name.toUpperCase()}</b><span class="price">${money(item.price)} <em>· $${item.cost}/s</em><small>◷ ${item.build}s</small></span>`;
  button.onclick = () => {
    placing = kind;
    toast(
      `Place ${item.name}: ${money(item.price)} upfront, $${item.cost}/s, ${item.build}s to build. Click the map or drag this card.`,
    );
    $("map-help").textContent =
      "Click an empty position to deploy · Escape to cancel";
  };
  button.ondragstart = (e) => {
    placing = kind;
    e.dataTransfer?.setData("text/plain", kind);
  };
  $("build-tray").append(button);
}
function point(e: { clientX: number; clientY: number }) {
  const r = canvas.getBoundingClientRect();
  return screenToWorld(
    e.clientX - r.left,
    e.clientY - r.top,
    r.width,
    r.height,
    camera,
  );
}
canvas.ondragover = (e) => e.preventDefault();
canvas.ondrop = (e) => {
  e.preventDefault();
  const p = point(e);
  if (placing) deploy(placing, p.x, p.y);
};
let drag: {
  id: string;
  dx: number;
  dy: number;
  startX: number;
  startY: number;
  moved: boolean;
} | null = null;
canvas.onpointerdown = (e) => {
  const p = point(e);
  canvas.setPointerCapture(e.pointerId);
  if (placing) {
    deploy(placing, p.x, p.y);
    return;
  }
  for (const n of [...game.nodes].reverse()) {
    if (Math.hypot(p.x - (n.x + 75), p.y - (n.y - 8)) < 18) {
      connection = n.id;
      toast(`Connect ${n.name} to a destination’s left port.`);
      refresh();
      return;
    }
    if (connection && Math.hypot(p.x - (n.x - 75), p.y - (n.y - 8)) < 22) {
      toast(
        connect(game, connection, n.id)
          ? "Route connected."
          : "Unsupported or duplicate route.",
      );
      connection = "";
      refresh();
      return;
    }
  }
  const n = [...game.nodes]
    .sort((a, b) => b.y - a.y)
    .find((n) => Math.abs(p.x - n.x) < 70 && p.y > n.y - 150 && p.y < n.y + 45);
  if (n) {
    selected = n.id;
    drag = {
      id: n.id,
      dx: p.x - n.x,
      dy: p.y - n.y,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    };
    refresh();
  } else {
    drag = {
      id: "pan",
      dx: camera.x,
      dy: camera.y,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    };
    connection = "";
  }
};
canvas.onpointermove = (e) => {
  if (!drag) return;
  drag.moved ||=
    Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 5;
  if (!drag.moved) return;
  const r = canvas.getBoundingClientRect();
  if (drag.id === "pan") {
    const { scale } = mapViewport(r.width, r.height);
    camera.x = drag.dx + (e.clientX - drag.startX) / scale;
    camera.y = drag.dy + (e.clientY - drag.startY) / scale;
  } else {
    const n = game.nodes.find((n) => n.id === drag!.id);
    const p = point(e);
    if (n) {
      n.x = p.x - drag.dx;
      n.y = p.y - drag.dy;
    }
  }
  refresh();
};
canvas.onpointerup = () => {
  drag = null;
};
canvas.onpointercancel = () => {
  drag = null;
};
function zoom(f: number) {
  camera.zoom = Math.max(0.45, Math.min(1.6, camera.zoom * f));
  refresh();
}
canvas.onwheel = (e) => {
  e.preventDefault();
  zoom(e.deltaY > 0 ? 0.95 : 1.05);
};
$("zoom-in").onclick = () => zoom(1.1);
$("zoom-out").onclick = () => zoom(1 / 1.1);
$("fit").onclick = () => {
  camera.zoom = 0.88;
  camera.x = 30;
  camera.y = 78;
  refresh();
};
function key(e: KeyboardEvent) {
  if ((e.target as HTMLElement).matches("button,input,select") || dialog.open)
    return;
  if (e.key === "Escape") {
    placing = null;
    connection = "";
    $("toast").classList.remove("shown");
    refresh();
  }
  if (e.code === "Space") {
    e.preventDefault();
    changePause();
  }
}
window.addEventListener("keydown", key);
function visibility() {
  hidden = document.hidden;
  syncPlayback();
  saveRecords();
}
document.addEventListener("visibilitychange", visibility);
function dispose() {
  guide.dispose();
  saveRecords();
  controller.dispose();
  window.removeEventListener("keydown", key);
  document.removeEventListener("visibilitychange", visibility);
  atlas.onload = null;
  atlas.onerror = null;
}
window.addEventListener("pagehide", dispose, { once: true });
if (import.meta.hot) import.meta.hot.dispose(dispose);
// Dev-only observer gives browser tests semantic evidence from the real page.
if (import.meta.env.DEV)
  Object.defineProperty(window, "kubeInferno", {
    configurable: true,
    value: {
      snapshot: () => structuredClone(game),
      incident: (type: Parameters<typeof incident>[1]) => {
        incident(game, type);
        refresh();
      },
    },
  });
updateHud();

const guide = mountQuickGuide($("map"), (id) => {
  if (game.nodes.some((n) => n.id === id)) selected = id;
  refresh();
});
$("replay-tips").onclick = () => {
  dialog.close();
  guide.show();
};
