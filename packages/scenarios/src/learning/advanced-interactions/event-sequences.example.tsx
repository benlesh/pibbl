import { pibbl, useSignal, Rectangle, Text, type PibblController } from "@pibbl/core";
function EventSequenceStudy() {
  const events = useSignal<readonly string[]>([]);
  const record = (value: string) =>
    events.update((current) => [...current.slice(-5), value]);
  const target = (x: number, color: string, name: string) => (
    <Rectangle
      style={{
        left: x,
        top: 86,
        width: 250,
        height: 210,
        fill: color,
        cursor: "pointer",
      }}
      onMouseOver={() => record(`${name}: over`)}
      onMouseOut={() => record(`${name}: out`)}
      onMouseMove={() => record(`${name}: move`)}
      onMouseDown={() => record(`${name}: down`)}
      onMouseUp={() => record(`${name}: up`)}
      onClick={() => record(`${name}: click`)}
    />
  );
  return [
    <Rectangle
      style={{
        left: 0,
        top: 0,
        width: 720,
        height: 420,
        fill: "#17211d",
      }}
    />,
    target(70, "#1f4bd8", "A"),
    target(400, "#ff6b57", "B"),
    <Text
      style={{
        left: 195,
        top: 158,
        fill: "#fffdf6",
        font: "900 72px sans-serif",
        textAlign: "center",
      }}
    >
      {"A"}
    </Text>,
    <Text
      style={{
        left: 525,
        top: 158,
        fill: "#17211d",
        font: "900 72px sans-serif",
        textAlign: "center",
      }}
    >
      {"B"}
    </Text>,
    <Text
      style={{
        left: 360,
        top: 340,
        width: 620,
        fit: "ellipsis",
        fill: "#74d3ae",
        font: "700 13px monospace",
        textAlign: "center",
      }}
    >
      {events.get().length ? events.get().join("  →  ") : "MOVE A → B, THEN CLICK"}
    </Text>,
  ];
}
export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(canvas, <EventSequenceStudy />);
}
