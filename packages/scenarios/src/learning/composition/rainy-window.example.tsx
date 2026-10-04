import { crc, Circle, Clip, Group, Layer, Rectangle, Text, useRef, useSignal, useTexture, type CRCController, type CRCPointerEvent } from "@crc/core";
import { blur, displacement, grayscale, opacity } from "@crc/core/filters";
import { rainDrops } from "@crc/core/textures";

const pane = { x: 28, y: 104, width: 824, height: 420 };
const panePath = new Path2D("M28 104H852V524H28Z");

function City() {
  return <Group>
    <Rectangle style={{ ...pane, fill: "#304850" }} />
    {Array.from({ length: 28 }, (_, i) => <Rectangle key={`sky-${i}`} style={{ x: pane.x, y: pane.y + i * 15, width: pane.width, height: 15, fill: `rgb(${48 + i * 2} ${72 + i * 2} ${80 + i})` }} />)}
    {Array.from({ length: 11 }, (_, i) => {
      const x = 28 + i * 79, top = 170 + (i * 53) % 100;
      return <Group key={i}>
        <Rectangle style={{ x, y: top, width: Math.min(73, 852 - x), height: 524 - top, fill: i % 2 ? "#344044" : "#26373d" }} />
        {Array.from({ length: 24 }, (_, j) => x + 16 + j % 4 * 16 <= 852 && <Rectangle key={j} style={{ x: x + 9 + j % 4 * 16, y: top + 16 + Math.floor(j / 4) * 29, width: 7, height: 13, fill: (i * 7 + j * 3) % 5 < 2 ? "#e6bc7c" : "#5e7274" }} />)}
      </Group>;
    })}
    <Rectangle style={{ x: 28, y: 439, width: 824, height: 85, fill: "#344b52" }} />
    {Array.from({ length: 44 }, (_, i) => <Rectangle key={`road-${i}`} style={{ x: 28 + (i * 137) % 800, y: 451 + i % 8 * 8, width: 12 + i % 5 * 10, height: 2, fill: i % 3 ? "#6b8b8e" : "#c5a47a" }} />)}
    <Rectangle style={{ x: 557, y: 352, width: 192, height: 69, fill: "#163c42" }} />
    <Text style={{ x: 579, y: 397, font: "700 28px sans-serif", fill: "#f1d29b" }}>NIGHT CAFÉ</Text>
    <Rectangle style={{ x: 133, y: 261, width: 5, height: 222, fill: "#142b34" }} />
    <Circle style={{ cx: 135, cy: 265, radius: 16, fill: "#f7d8a0" }} />
    <Rectangle style={{ x: 452, y: 285, width: 4, height: 210, fill: "#142b34" }} />
    <Circle style={{ cx: 454, cy: 289, radius: 12, fill: "#f7d8a0" }} />
  </Group>;
}

function RainyWindow() {
  const paused = useSignal(false), enabled = useSignal(true), rainRate = useSignal(24), gravity = useSignal(1);
  const condensation = useSignal(0.85), persistence = useSignal(20), irregularity = useSignal(1), mistBlur = useSignal(16), weather = useSignal(0);
  const dragging = useRef<number>();
  const rain = useTexture(rainDrops({ seed: 19, initialDrops: 160, rainRate: rainRate.get(), gravity: gravity.get(), paused: paused.get(), condensation: condensation.get(), trailPersistence: persistence.get(), trailStrength: 0.9, irregularity: irregularity.get() }), {
    resolution: { width: 704, height: 352 },
  });
  const map = rain.paint({ mode: "stretch" });
  const move = (event: CRCPointerEvent) => {
    if (dragging.current !== event.pointerId) return;
    rain.send({ type: "finger", x: Math.max(0, Math.min(1, (event.x - pane.x) / pane.width)), y: Math.max(0, Math.min(1, (event.y - pane.y) / pane.height)), radius: 0.045 });
  };
  const begin = (event: CRCPointerEvent) => {
    if (event.button !== 0 || dragging.current !== undefined) return;
    event.preventDefault();
    dragging.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    move(event);
  };
  const end = (event: CRCPointerEvent) => {
    if (dragging.current !== event.pointerId) return;
    if (event.type === "pointerup") move(event);
    dragging.current = undefined;
    rain.send({ type: "release" });
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const conditions = [
    { label: "MISTED", mist: 0.85, trails: 20, rain: 24, gravity: 1 },
    { label: "FRESH RAIN", mist: 0.15, trails: 8, rain: 55, gravity: 1.5 },
    { label: "STREAKED", mist: 1, trails: 45, rain: 12, gravity: 2 },
  ];
  const buttons = [
    { label: paused.get() ? "RESUME" : "PAUSE", click: () => paused.update(v => !v) },
    { label: conditions[weather.get()].label, click: () => {
      const next = (weather.get() + 1) % conditions.length, condition = conditions[next];
      weather.set(next); condensation.set(condition.mist); persistence.set(condition.trails); rainRate.set(condition.rain); gravity.set(condition.gravity);
      rain.send({ type: "reset" });
    } },
    { label: `MIST ${Math.round(condensation.get() * 100)}%`, click: () => condensation.update(v => v >= 1 ? 0 : v >= 0.6 ? 1 : v >= 0.3 ? 0.85 : 0.4) },
    { label: `TRAILS ${persistence.get()}s`, click: () => persistence.update(v => v >= 45 ? 0 : v >= 20 ? 45 : v >= 8 ? 20 : 8) },
    { label: `SHAPE ${irregularity.get() === 0 ? "SMOOTH" : irregularity.get() === 1 ? "ROUGH" : "SOFT"}`, click: () => irregularity.update(v => v === 1 ? 0 : v === 0 ? 0.5 : 1) },
    { label: `RAIN ${rainRate.get()}/s`, click: () => rainRate.update(v => v === 24 ? 80 : v === 80 ? 0 : 24) },
    { label: `GRAVITY ${gravity.get()}×`, click: () => gravity.update(v => v === 1 ? 3 : v === 3 ? 0 : 1) },
    { label: `MIST BLUR ${mistBlur.get()}`, click: () => mistBlur.update(v => v === 16 ? 24 : v === 24 ? 0 : v === 0 ? 8 : 16) },
    { label: enabled.get() ? "GLASS ON" : "GLASS OFF", click: () => enabled.update(v => !v) },
    { label: "RESET", click: () => rain.send({ type: "reset" }) },
  ];
  return <Group>
    <Rectangle style={{ width: 880, height: 700, fill: "#101f27" }} />
    <Text style={{ x: 28, y: 38, font: "12px monospace", fill: "#a4b9be" }}>WEATHER STUDIES / 01</Text>
    <Text style={{ x: 28, y: 76, font: "600 30px sans-serif", fill: "#edf0e6" }}>Rain on the window</Text>
    <Text style={{ x: 852, y: 73, textAlign: "right", font: "13px sans-serif", fill: "#a4b9be" }}>Click and drag to wipe the glass.</Text>
    <Clip style={{ d: panePath }}>
    <Group style={{ filter: enabled.get() ? displacement({ map, strength: 18, blurRadius: mistBlur, region: pane }) : [] }}>
      <Layer style={{ width: 880, height: 540 }}>
        <Group style={{ filter: blur({ radius: 0.6 }) }}><City /></Group>
      </Layer>
    </Group>
    {enabled.get() && <Rectangle pointerEvents="none" style={{ ...pane, fill: map, filter: [grayscale({ amount: 1 }), opacity({ amount: 0.08 })] }} />}
    </Clip>
    <Rectangle style={{ ...pane, fill: "rgba(0,0,0,0)", stroke: "#74858a", strokeWidth: 1, cursor: "grab" }} onPointerDown={begin} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} />
    {buttons.map((button, i) => <Group key={i}>
      <Rectangle style={{ x: 28 + i % 5 * 166, y: 548 + Math.floor(i / 5) * 52, width: 158, height: 40, cornerRadius: 5, fill: "#293c45", cursor: "pointer" }} onClick={button.click} />
      <Text pointerEvents="none" style={{ x: 107 + i % 5 * 166, y: 573 + Math.floor(i / 5) * 52, textAlign: "center", font: "700 11px sans-serif", fill: "#edf0e6" }}>{button.label}</Text>
    </Group>)}
    <Text style={{ x: 28, y: 674, font: "12px sans-serif", fill: "#a4b9be" }}>Drag a finger through the mist to collect water. Release to leave the gathered droplet on the glass.</Text>
  </Group>;
}

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <RainyWindow />);
}
