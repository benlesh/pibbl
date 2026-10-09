import { Clip, Group, Overlay, Rectangle, pibbl, signal } from "@pibbl/core";
import { LineSeries, LinearScale } from "@pibbl/core/viz";
import { createLineAttributionInspector } from "./capture";

const canvas = document.querySelector("canvas")!;
const panel = document.querySelector("pre")!;
const inspector = createLineAttributionInspector(canvas);
const data = signal([
  { id: "a", x: 0, y: 10 },
  { id: "b", x: 5, y: 20 },
  { id: "c", x: 10, y: 30 },
]);
const clipped = signal(true),
  failed = signal(false);
const domain = signal<readonly [number, number]>([0, 10]);
let point = { x: 205, y: 240 };
let latestError: string | null = null;
function Bomb() {
  if (failed.get()) throw new Error("Controlled failure after line paint");
  return null;
}
function Scene() {
  const path = new Path2D();
  path.rect(0, 0, clipped.get() ? 300 : 600, 240);
  return (
    <>
      <Rectangle
        pointerEvents="none"
        style={{ width: 710, height: 420, fill: "#f4f7fb" }}
      />
      <Group style={{ translateX: 55, translateY: 90 }}>
        <Overlay style={{ width: 600, height: 240 }}>
          <LinearScale
            id="time"
            domain={domain}
            range="width"
            style={{ width: "100%", height: "100%" }}
          >
            <LinearScale id="value" domain={[0, 40]} range="height" reverse>
              <Clip style={{ d: path }}>
                <LineSeries
                  data={data}
                  x="x"
                  y="y"
                  xScale="time"
                  yScale="value"
                  pointerEvents="none"
                  style={{ stroke: "#2563eb", strokeWidth: 4 }}
                />
              </Clip>
            </LinearScale>
          </LinearScale>
        </Overlay>
      </Group>
      <Bomb />
    </>
  );
}
const app = pibbl(canvas, <Scene />, { pixelRatio: 1 });
const state = () => ({
  source: structuredClone(data.get()),
  domain: [...domain.get()],
  clipped: clipped.get(),
  point,
  error: latestError,
  attribution: inspector.snapshot(),
  query: inspector.segmentAt(point),
});
async function settle() {
  const end = performance.now() + 5000;
  for (let i = 0; i < 3; i++) await new Promise(requestAnimationFrame);
  while (inspector.snapshot().status === "waiting") {
    if (performance.now() > end)
      throw new Error("Attribution did not become available");
    await new Promise(requestAnimationFrame);
  }
  panel.textContent = JSON.stringify(state(), (_key, value) => value, 2);
}
const actions = {
  update() {
    data.set(
      data.get().map((row) => (row.id === "b" ? { ...row, y: 30 } : row)),
    );
  },
  clip() {
    clipped.set(!clipped.get());
  },
  zoom() {
    domain.set([2.5, 7.5]);
  },
  fail() {
    failed.set(true);
  },
  retry() {
    latestError = null;
    failed.set(false);
    pibbl(canvas, <Scene />);
  },
  reset() {
    latestError = null;
    failed.set(false);
    data.set([
      { id: "a", x: 0, y: 10 },
      { id: "b", x: 5, y: 20 },
      { id: "c", x: 10, y: 30 },
    ]);
    clipped.set(true);
    domain.set([0, 10]);
    pibbl(canvas, <Scene />);
  },
};
window.addEventListener("error", (event) => {
  if (String(event.error).includes("Controlled failure after line paint")) {
    latestError = "Controlled failure after line paint";
    event.preventDefault();
    void settle();
  }
});
for (const [action, invoke] of Object.entries(actions)) {
  const button = document.createElement("button");
  button.textContent = action;
  button.dataset.action = action;
  button.onclick = async () => {
    invoke();
    await settle();
  };
  document.querySelector("nav")!.append(button);
}
canvas.addEventListener("pointermove", async (event) => {
  const box = canvas.getBoundingClientRect();
  point = {
    x: ((event.clientX - box.left) * 710) / box.width,
    y: ((event.clientY - box.top) * 420) / box.height,
  };
  await settle();
});
window.addEventListener("pagehide", () => {
  inspector.dispose();
  app.dispose();
});
// Explicit cooperation for the bounded native verification, not a runtime-global inspector.
Object.assign(window, {
  lineAttributionDemo: {
    state,
    settle,
    dispose() {
      inspector.dispose();
      app.dispose();
    },
  },
});
void settle();
