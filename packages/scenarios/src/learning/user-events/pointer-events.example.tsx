import {
  pibbl,
  useSignal,
  Rectangle,
  Text,
  type PibblController,
  type PibblPointerEvent,
} from "@pibbl/core";
function pointerSummary(event: PibblPointerEvent): string {
  return `${event.type} #${event.pointerId} ${event.pointerType} ${Math.round(event.x)},${Math.round(event.y)} p=${event.pressure.toFixed(2)} ${event.width}×${event.height} tilt=${event.tiltX}/${event.tiltY} twist=${event.twist} b=${event.button}/${event.buttons} ${event.isPrimary ? "primary" : "secondary"}`;
}
function PointerEventsStudy() {
  const trace = useSignal<readonly string[]>([]);
  const inside = useSignal(false);
  const record = (event: PibblPointerEvent) => {
    trace.update((current) => [...current.slice(-3), pointerSummary(event)]);
  };
  return [
    <Rectangle
      style={{
        left: 0,
        top: 0,
        width: 720,
        height: 420,
        fill: "#f7f0df",
      }}
    />,
    <Text
      style={{
        left: 360,
        top: 46,
        fill: "#17211d",
        font: "900 24px sans-serif",
        textAlign: "center",
      }}
    >
      {"POINTER EVENT FIELD LAB"}
    </Text>,
    <Rectangle
      style={{
        left: 70,
        top: 82,
        width: 580,
        height: 204,
        fill: inside.get() ? "#f7c948" : "#74d3ae",
        stroke: "#17211d",
        strokeWidth: 5,
        cursor: "crosshair",
      }}
      onPointerOver={(event) => record(event)}
      onPointerEnter={(event) => {
        inside.set(true);
        record(event);
      }}
      onPointerDown={(event) => record(event)}
      onPointerMove={(event) => record(event)}
      onPointerRawUpdate={(event) => record(event)}
      onPointerUp={(event) => record(event)}
      onPointerCancel={(event) => {
        inside.set(false);
        record(event);
      }}
      onPointerOut={(event) => record(event)}
      onPointerLeave={(event) => {
        inside.set(false);
        record(event);
      }}
    />,
    <Text
      style={{
        left: 360,
        top: 166,
        fill: "#17211d",
        font: "900 35px sans-serif",
        textAlign: "center",
      }}
    >
      {inside.get() ? "MOVE • PRESS • LEAVE" : "ENTER THIS FIELD"}
    </Text>,
    <Text
      style={{
        left: 360,
        top: 207,
        fill: "#17211d",
        font: "700 13px monospace",
        textAlign: "center",
      }}
    >
      {
        "Pointer over / enter / down / move / rawupdate / up / cancel / out / leave"
      }
    </Text>,
    <Text
      style={{
        left: 360,
        top: 244,
        fill: "#17211d",
        font: "600 12px sans-serif",
        textAlign: "center",
      }}
    >
      {
        "Raw update is registered here; stylus/high-rate hardware is most likely to produce it."
      }
    </Text>,
    <Rectangle
      style={{
        left: 34,
        top: 316,
        width: 652,
        height: 76,
        fill: "#17211d",
        stroke: "#1f4bd8",
        strokeWidth: 2,
      }}
    />,
    <Text
      style={{
        left: 54,
        top: 337,
        width: 612,
        lineHeight: 18,
        fit: "ellipsis",
        fill: "#fffdf6",
        font: "600 12px monospace",
      }}
    >
      {trace.get().length
        ? trace.get().join("\n")
        : "Trace waits for a pointer. The latest pointer fields appear here."}
    </Text>,
  ];
}
export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(canvas, <PointerEventsStudy />);
}
