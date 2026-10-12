import {
  Clip,
  FocusManagement,
  Group,
  Overlay,
  Rectangle,
  Text,
  pibbl,
  useLayoutBox,
  useSignal,
  useReaction,
  untracked,
  type PibblController,
  type PibblPointerEvent,
  type PibblEventTarget,
  type WritableSignal,
} from "@pibbl/core";
import {
  Axis,
  LineSeries,
  UTCScale,
  LinearScale,
  useUTCScale,
  panDomain,
  zoomDomain,
} from "@pibbl/core/viz";
// NOAA GML / Scripps Mauna Loa monthly means, Jan–Dec 1980, ppm.
// https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_mlo.csv
// Reused unchanged from the checked-in 2026-09-28 snapshot.
const data = [
  337.9, 338.34, 340.07, 340.93, 341.45, 341.36, 339.45, 337.67, 336.25, 336.14,
  337.3, 338.29,
].map((ppm, i) => ({ time: Date.UTC(1980, i, 1), ppm }));
type Domain = readonly [number, number];
const full: Domain = [data[0].time, data.at(-1)!.time],
  day = 86400000,
  minSpan = 30 * day;
const ink = "#172f3d",
  teal = "#087f8c",
  muted = "#526975";
interface Snapshot {
  committed: Domain;
  draft: Domain | null;
}
interface Options {
  domain?: WritableSignal<Domain>;
  onSnapshot?: (snapshot: Snapshot) => void;
}
function dates(domain: Domain) {
  return domain.map((v) => new Date(v).toISOString().slice(5, 10)).join(" – ");
}
function Label({
  x,
  y,
  text,
  size = 10,
}: {
  x: number;
  y: number;
  text: string;
  size?: number;
}) {
  return (
    <Text
      pointerEvents="none"
      style={{
        left: x,
        top: y,
        textBaseline: "alphabetic",
        font: `${size}px sans-serif`,
        fill: ink,
      }}
    >
      {text}
    </Text>
  );
}
function constrained(input: Domain): Domain {
  const [a, b] = input;
  if (!Number.isFinite(a) || !Number.isFinite(b) || a >= b)
    throw new RangeError("Window requires finite increasing endpoints.");
  const span = Math.min(full[1] - full[0], Math.max(minSpan, b - a)),
    start = Math.max(full[0], Math.min(full[1] - span, a));
  return [Math.round(start), Math.round(start + span)];
}
function Detail({
  domain,
  left,
}: {
  domain: WritableSignal<Domain>;
  left: number;
}) {
  const { width, height } = useLayoutBox(),
    scale = useUTCScale("detail").get(),
    focused = useSignal(false),
    clip = new Path2D();
  clip.rect(0, 0, width, height);
  const constraints = {
    bounds: full,
    minimumSpanRatio: minSpan / (full[1] - full[0]),
  };
  const zoom = (factor: number, anchor = width / 2) =>
    domain.set(
      zoomDomain(scale, {
        ...constraints,
        rangeAnchor: anchor,
        factor,
      }),
    );
  return (
    <>
      {[
        { x: 68, label: "Zoom in", factor: 1.5 },
        { x: 164, label: "Zoom out", factor: 1 / 1.5 },
      ].map((button) => (
        <Group
          key={button.label}
          style={{ translateX: button.x, translateY: -65 }}
        >
          <Rectangle
            keyboardFocusable
            onClick={() => zoom(button.factor)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                zoom(button.factor);
              }
            }}
            style={{
              width: 90,
              height: 44,
              fill: "white",
              stroke: "#b7cdd0",
              strokeWidth: 1,
              cornerRadius: 5,
              cursor: "pointer",
            }}
          />
          <Label x={10} y={27} text={button.label} />
        </Group>
      ))}
      <Clip style={{ d: clip }}>
        <LineSeries
          data={data}
          x="time"
          y="ppm"
          xScale="detail"
          yScale="ppm"
          pointerEvents="none"
          style={{ stroke: teal }}
        />
      </Clip>
      <Axis
        scale="detail"
        position="bottom"
        tickCount={3}
        tickFormat={(v) => new Date(Number(v)).toISOString().slice(5, 10)}
        style={{ font: "9px sans-serif", fill: muted }}
      />
      <Axis
        scale="ppm"
        position="left"
        tickValues={[335, 340, 345]}
        style={{ font: "9px sans-serif", fill: muted }}
      />
      <Rectangle
        keyboardFocusable
        onFocus={() => focused.set(true)}
        onBlur={() => focused.set(false)}
        onWheel={(e) => {
          e.preventDefault();
          const pixels =
            e.deltaY *
            (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? height : 1);
          zoom(
            Math.exp(Math.max(-4, Math.min(4, -pixels * 0.002))),
            e.x - left,
          );
        }}
        onKeyDown={(e) => {
          if (
            !["+", "=", "-", "ArrowLeft", "ArrowRight", "Home"].includes(e.key)
          )
            return;
          e.preventDefault();
          if (e.key === "Home") domain.set(full);
          else if (e.key === "ArrowLeft" || e.key === "ArrowRight")
            domain.set(
              panDomain(scale, {
                ...constraints,
                rangeDelta: (e.key === "ArrowLeft" ? 1 : -1) * width * 0.1,
              }),
            );
          else zoom(e.key === "-" ? 1 / 1.5 : 1.5);
        }}
        style={{
          width,
          height,
          fill: "transparent",
          stroke: focused.get() ? ink : undefined,
          strokeWidth: 1,
          cursor: "zoom-in",
        }}
      />
    </>
  );
}
function Brush({
  domain,
  left,
  onSnapshot,
}: {
  domain: WritableSignal<Domain>;
  left: number;
  onSnapshot?: Options["onSnapshot"];
}) {
  const { width, height } = useLayoutBox(),
    scale = useUTCScale("overview").get(),
    focus = useSignal(false);
  type Drag = {
    id: number;
    owner: PibblEventTarget;
    origin: Domain;
    base: Domain;
    draft: Domain;
    anchor: number;
    mode: "start" | "end" | "move";
    width: number;
    height: number;
  };
  const drag = useSignal<Drag | null>(null),
    committed = domain.get(),
    stored = drag.get();
  const active =
    stored &&
    stored.origin === committed &&
    stored.width === width &&
    stored.height === height
      ? stored
      : null;
  const shown = active?.draft ?? constrained(committed),
    a = scale.map(shown[0]),
    b = scale.map(shown[1]);
  onSnapshot?.({ committed, draft: active?.draft ?? null });
  useReaction(() => {
    const old = untracked(() => drag.get());
    if (
      old &&
      (old.origin !== committed ||
        old.width !== width ||
        old.height !== height) &&
      old.owner.hasPointerCapture(old.id)
    )
      old.owner.releasePointerCapture(old.id);
  }, [committed, width, height]);
  function cancel() {
    const old = drag.get();
    drag.set(null);
    if (old?.owner.hasPointerCapture(old.id))
      old.owner.releasePointerCapture(old.id);
  }
  function begin(e: PibblPointerEvent) {
    if (e.button !== 0 || active) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const pixel = e.x - left,
      value = scale.invert(pixel);
    const nearStart = Math.abs(pixel - a),
      nearEnd = Math.abs(pixel - b);
    const mode =
      Math.min(nearStart, nearEnd) <= 22
        ? nearStart <= nearEnd
          ? "start"
          : "end"
        : "move";
    const draft =
      mode === "move" && (pixel < a || pixel > b)
        ? constrained([
            value - (shown[1] - shown[0]) / 2,
            value + (shown[1] - shown[0]) / 2,
          ])
        : shown;
    drag.set({
      id: e.pointerId,
      owner: e.currentTarget,
      origin: committed,
      base: draft,
      draft,
      anchor: value,
      mode,
      width,
      height,
    });
  }
  function move(e: PibblPointerEvent) {
    const old = drag.get();
    if (!old || old.id !== e.pointerId) return;
    if (
      old.origin !== domain.get() ||
      old.width !== width ||
      old.height !== height
    ) {
      cancel();
      return;
    }
    e.preventDefault();
    const delta = Math.round(scale.invert(e.x - left) - old.anchor);
    let next: Domain;
    if (old.mode === "start")
      next = [
        Math.max(
          full[0],
          Math.min(old.origin[1] - minSpan, old.origin[0] + delta),
        ),
        old.origin[1],
      ];
    else if (old.mode === "end")
      next = [
        old.origin[0],
        Math.min(
          full[1],
          Math.max(old.origin[0] + minSpan, old.origin[1] + delta),
        ),
      ];
    else next = constrained([old.base[0] + delta, old.base[1] + delta]);
    drag.set({ ...old, draft: next });
  }
  function finish(e: PibblPointerEvent) {
    const old = drag.get();
    if (!old || old.id !== e.pointerId) return;
    const valid =
      old.origin === domain.get() &&
      old.width === width &&
      old.height === height;
    cancel();
    if (valid) domain.set(old.draft);
  }
  return (
    <>
      <Rectangle
        pointerEvents="none"
        style={{ width, height, fill: "#e7eff0" }}
      />
      <LineSeries
        data={data}
        x="time"
        y="ppm"
        xScale="overview"
        yScale="mini"
        pointerEvents="none"
        style={{ stroke: teal, strokeWidth: 1 }}
      />
      <Rectangle
        pointerEvents="none"
        style={{
          left: a,
          width: b - a,
          height,
          fill: "rgba(8,127,140,0.18)",
          stroke: teal,
          strokeWidth: 1,
        }}
      />
      <Label
        x={0}
        y={-5}
        text={`${active ? "Draft" : "Window"}: ${dates(shown)} · ${active ? "release commits" : "drag handles or window"}`}
      />
      <Rectangle
        keyboardFocusable
        onFocus={() => focus.set(true)}
        onBlur={() => focus.set(false)}
        onPointerDown={begin}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={cancel}
        onLostPointerCapture={cancel}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            cancel();
            return;
          }
          if (!["ArrowLeft", "ArrowRight", "Home"].includes(e.key)) return;
          e.preventDefault();
          cancel();
          const current = domain.get(),
            step = (e.key === "ArrowLeft" ? -1 : 1) * minSpan;
          if (e.key === "Home") domain.set(full);
          else if (e.shiftKey)
            domain.set([
              current[0],
              Math.max(
                current[0] + minSpan,
                Math.min(full[1], current[1] + step),
              ),
            ]);
          else domain.set(constrained([current[0] + step, current[1] + step]));
        }}
        style={{
          width,
          height,
          fill: "transparent",
          stroke: focus.get() ? ink : undefined,
          strokeWidth: 2,
          cursor: active ? "grabbing" : "grab",
        }}
      />
    </>
  );
}
function Scene({ options }: { options: Options }) {
  const { width, height } = useLayoutBox(),
    ownDomain = useSignal<Domain>([Date.UTC(1980, 2, 1), Date.UTC(1980, 8, 1)]),
    domain = options.domain ?? ownDomain;
  const current = domain.get();
  const checked = constrained(current);
  if (checked[0] !== current[0] || checked[1] !== current[1])
    throw new RangeError(
      "Controlled window must stay inside the full extent, span at least 30 days, and use integer milliseconds.",
    );
  const left = 42,
    plotWidth = Math.max(1, width - left - 22),
    plotHeight = Math.max(1, height - 226);
  return (
    <>
      <Rectangle style={{ width, height, fill: "#f7faf9" }} />
      <Text
        style={{
          left: 14,
          top: 24,
          font: "600 22px sans-serif",
          textBaseline: "alphabetic",
          fill: ink,
          when: [
            {
              query: { maxWidth: 400 },
              style: { font: "600 18px sans-serif" },
            },
            {
              query: { maxHeight: 350 },
              style: { font: "600 18px sans-serif" },
            },
          ],
        }}
      >
        Explore a date window
      </Text>
      <Group style={{ translateX: 14, translateY: 35 }}>
        <Rectangle
          keyboardFocusable
          onClick={() => domain.set(full)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              domain.set(full);
            }
          }}
          style={{
            width: 90,
            height: 44,
            fill: "white",
            stroke: "#b7cdd0",
            strokeWidth: 1,
            cornerRadius: 5,
            cursor: "pointer",
          }}
        />
        <Label x={10} y={27} text="Reset year" />
      </Group>
      <Label
        x={14}
        y={92}
        text={`Committed: ${dates(current)} · CO₂ ppm · 1980`}
      />
      <Group style={{ translateX: left, translateY: 100 }}>
        <Overlay style={{ width: plotWidth, height: plotHeight }}>
          <UTCScale
            id="detail"
            domain={current}
            range="width"
            style={{ width: "100%", height: "100%" }}
          >
            <LinearScale id="ppm" domain={[335, 345]} range="height" reverse>
              <Detail domain={domain} left={left} />
            </LinearScale>
          </UTCScale>
        </Overlay>
      </Group>
      <Group style={{ translateX: left, translateY: height - 94 }}>
        <Overlay style={{ width: plotWidth, height: 44 }}>
          <UTCScale
            id="overview"
            domain={full}
            range="width"
            style={{ width: "100%", height: "100%" }}
          >
            <LinearScale id="mini" domain={[335, 345]} range="height" reverse>
              <Brush
                domain={domain}
                left={left}
                onSnapshot={options.onSnapshot}
              />
            </LinearScale>
          </UTCScale>
        </Overlay>
      </Group>
      <Label
        x={14}
        y={height - 33}
        text="Plot: wheel / + − zoom · arrows pan · Home resets"
        size={9}
      />
      <Label
        x={14}
        y={height - 20}
        text="Brush: drag / touch · Shift+arrows end · Esc cancels"
        size={9}
      />
      <Label
        x={14}
        y={height - 7}
        text="NOAA / Scripps · Mauna Loa · 1980 · ppm · UTC"
        size={9}
      />
    </>
  );
}
export default function mount(
  canvas: HTMLCanvasElement,
  options: Options = {},
): PibblController {
  const touchAction = canvas.style.touchAction;
  canvas.style.touchAction = "none";
  const app = pibbl(
    canvas,
    <FocusManagement>
      <Scene options={options} />
    </FocusManagement>,
    { viewport: "responsive" },
  );
  let disposed = false;
  return {
    ...app,
    dispose() {
      if (disposed) return;
      disposed = true;
      app.dispose();
      canvas.style.touchAction = touchAction;
    },
  };
}
