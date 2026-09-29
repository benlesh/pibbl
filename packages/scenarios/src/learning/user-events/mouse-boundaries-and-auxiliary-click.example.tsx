import {
  crc,
  useSignal,
  Rectangle,
  Text,
  type CRCController,
  type CRCLogicalMouseEvent,
} from "@crc/core";
function mouseSummary(event: CRCLogicalMouseEvent): string {
  return `${event.type} at ${Math.round(event.x)},${Math.round(event.y)} button=${event.button} buttons=${event.buttons} detail=${event.detail}`;
}
function MouseBoundariesAndAuxiliaryClickStudy() {
  const inside = useSignal(false);
  const auxiliaryCount = useSignal(0);
  const trace = useSignal<readonly string[]>([]);
  const record = (event: CRCLogicalMouseEvent) =>
    trace.update((current) => [...current.slice(-3), mouseSummary(event)]);
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
        font: "900 23px sans-serif",
        textAlign: "center",
      }}
    >
      {"MOUSE BOUNDARIES + AUXCLICK"}
    </Text>,
    <Rectangle
      style={{
        left: 68,
        top: 92,
        width: 360,
        height: 194,
        fill: inside.get() ? "#74d3ae" : "#1f4bd8",
        stroke: "#17211d",
        strokeWidth: 5,
        cursor: "pointer",
      }}
      onMouseEnter={(event) => {
        inside.set(true);
        record(event);
      }}
      onMouseLeave={(event) => {
        inside.set(false);
        record(event);
      }}
      onAuxClick={(event) => {
        event.preventDefault();
        auxiliaryCount.update((value) => value + 1);
        record(event);
      }}
    />,
    <Text
      style={{
        left: 248,
        top: 158,
        fill: inside.get() ? "#17211d" : "#fffdf6",
        font: "900 33px sans-serif",
        textAlign: "center",
      }}
    >
      {inside.get() ? "INSIDE" : "ENTER / LEAVE"}
    </Text>,
    <Text
      style={{
        left: 248,
        top: 204,
        fill: inside.get() ? "#17211d" : "#fffdf6",
        font: "700 14px sans-serif",
        textAlign: "center",
      }}
    >
      {"Middle-click here for auxclick."}
    </Text>,
    <Rectangle
      style={{
        left: 470,
        top: 92,
        width: 182,
        height: 194,
        fill: "#17211d",
      }}
    />,
    <Text
      style={{
        left: 561,
        top: 150,
        fill: "#f7c948",
        font: "900 15px monospace",
        textAlign: "center",
      }}
    >
      {"AUXCLICKS"}
    </Text>,
    <Text
      style={{
        left: 561,
        top: 216,
        fill: "#74d3ae",
        font: "900 52px sans-serif",
        textAlign: "center",
      }}
    >
      {String(auxiliaryCount.get())}
    </Text>,
    <Text
      style={{
        left: 360,
        top: 319,
        fill: "#17211d",
        font: "600 12px sans-serif",
        textAlign: "center",
      }}
    >
      {
        "mouseenter and mouseleave are boundary events; auxclick reports the browser's non-primary button."
      }
    </Text>,
    <Text
      style={{
        left: 48,
        top: 347,
        width: 624,
        lineHeight: 18,
        fit: "ellipsis",
        fill: "#1f4bd8",
        font: "600 12px monospace",
      }}
    >
      {trace.get().length
        ? trace.get().join("\n")
        : "Move into and out of the cobalt card, then middle-click it."}
    </Text>,
  ];
}
export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <MouseBoundariesAndAuxiliaryClickStudy />);
}
