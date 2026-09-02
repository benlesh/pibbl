import {
  crc,
  crcState,
  Rectangle,
  Text,
  type CRCController,
  type CRCWheelEvent,
} from "@crc/core";
function wheelSummary(event: CRCWheelEvent): string {
  return `Δ ${event.deltaX.toFixed(1)}, ${event.deltaY.toFixed(1)}, ${event.deltaZ.toFixed(1)} mode=${event.deltaMode} at ${Math.round(event.x)},${Math.round(event.y)} buttons=${event.buttons} ${event.ctrlKey ? "ctrl" : ""}${event.shiftKey ? "shift" : ""}`;
}
function WheelStudy() {
  const [trace, setTrace] = crcState<readonly string[]>([]);
  const [count, setCount] = crcState(0);
  const [cancelled, setCancelled] = crcState(false);
  return [
    <Rectangle
      style={{
        x: 0,
        y: 0,
        width: 720,
        height: 420,
        fill: "#17211d",
      }}
    />,
    <Text
      style={{
        x: 360,
        y: 48,
        fill: "#fffdf6",
        font: "900 25px sans-serif",
        textAlign: "center",
      }}
    >
      {"WHEEL EVENT PAD"}
    </Text>,
    <Rectangle
      style={{
        x: 82,
        y: 88,
        width: 556,
        height: 184,
        fill: cancelled ? "#f7c948" : "#ff6b57",
        stroke: "#fffdf6",
        strokeWidth: 5,
        cursor: "ns-resize",
      }}
      onWheel={(event) => {
        event.preventDefault();
        setCancelled(event.defaultPrevented);
        setCount((value) => value + 1);
        setTrace((current) => [...current.slice(-3), wheelSummary(event)]);
      }}
    />,
    <Text
      style={{
        x: 360,
        y: 153,
        fill: "#17211d",
        font: "900 32px sans-serif",
        textAlign: "center",
      }}
    >
      {"SCROLL OR PINCH HERE"}
    </Text>,
    <Text
      style={{
        x: 360,
        y: 199,
        fill: "#17211d",
        font: "800 15px monospace",
        textAlign: "center",
      }}
    >{`${count} wheel events • default ${cancelled ? "prevented" : "ready to cancel"}`}</Text>,
    <Text
      style={{
        x: 360,
        y: 306,
        fill: "#f7c948",
        font: "600 13px sans-serif",
        textAlign: "center",
      }}
    >
      {
        "The handler calls preventDefault(), so a cancelable browser wheel event is cancelled."
      }
    </Text>,
    <Text
      style={{
        x: 48,
        y: 337,
        width: 624,
        lineHeight: 18,
        fit: "ellipsis",
        fill: "#74d3ae",
        font: "600 12px monospace",
      }}
    >
      {trace.length
        ? trace.join("\n")
        : "Trace reports deltaX, deltaY, deltaZ, deltaMode, logical coordinates, buttons, and modifiers."}
    </Text>,
  ];
}
export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <WheelStudy />);
}
