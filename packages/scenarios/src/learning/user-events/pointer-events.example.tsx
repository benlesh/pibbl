import {
  crc,
  useState,
  Rectangle,
  Text,
  type CRCController,
  type CRCPointerEvent,
} from "@crc/core";
function pointerSummary(event: CRCPointerEvent): string {
  return `${event.type} #${event.pointerId} ${event.pointerType} ${Math.round(event.x)},${Math.round(event.y)} p=${event.pressure.toFixed(2)} ${event.width}×${event.height} tilt=${event.tiltX}/${event.tiltY} twist=${event.twist} b=${event.button}/${event.buttons} ${event.isPrimary ? "primary" : "secondary"}`;
}
function PointerEventsStudy() {
  const [trace, setTrace] = useState<readonly string[]>([]);
  const [inside, setInside] = useState(false);
  const record = (event: CRCPointerEvent) => {
    setTrace((current) => [...current.slice(-3), pointerSummary(event)]);
  };
  return [
    <Rectangle
      style={{
        x: 0,
        y: 0,
        width: 720,
        height: 420,
        fill: "#f7f0df",
      }}
    />,
    <Text
      style={{
        x: 360,
        y: 46,
        fill: "#17211d",
        font: "900 24px sans-serif",
        textAlign: "center",
      }}
    >
      {"POINTER EVENT FIELD LAB"}
    </Text>,
    <Rectangle
      style={{
        x: 70,
        y: 82,
        width: 580,
        height: 204,
        fill: inside ? "#f7c948" : "#74d3ae",
        stroke: "#17211d",
        strokeWidth: 5,
        cursor: "crosshair",
      }}
      onPointerOver={(event) => record(event)}
      onPointerEnter={(event) => {
        setInside(true);
        record(event);
      }}
      onPointerDown={(event) => record(event)}
      onPointerMove={(event) => record(event)}
      onPointerRawUpdate={(event) => record(event)}
      onPointerUp={(event) => record(event)}
      onPointerCancel={(event) => {
        setInside(false);
        record(event);
      }}
      onPointerOut={(event) => record(event)}
      onPointerLeave={(event) => {
        setInside(false);
        record(event);
      }}
    />,
    <Text
      style={{
        x: 360,
        y: 166,
        fill: "#17211d",
        font: "900 35px sans-serif",
        textAlign: "center",
      }}
    >
      {inside ? "MOVE • PRESS • LEAVE" : "ENTER THIS FIELD"}
    </Text>,
    <Text
      style={{
        x: 360,
        y: 207,
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
        x: 360,
        y: 244,
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
        x: 34,
        y: 316,
        width: 652,
        height: 76,
        fill: "#17211d",
        stroke: "#1f4bd8",
        strokeWidth: 2,
      }}
    />,
    <Text
      style={{
        x: 54,
        y: 337,
        width: 612,
        lineHeight: 18,
        fit: "ellipsis",
        fill: "#fffdf6",
        font: "600 12px monospace",
      }}
    >
      {trace.length
        ? trace.join("\n")
        : "Trace waits for a pointer. The latest pointer fields appear here."}
    </Text>,
  ];
}
export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <PointerEventsStudy />);
}
