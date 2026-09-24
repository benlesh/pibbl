import {
  crc,
  useSignal,
  Rectangle,
  Text,
  type CRCController,
  type CRCPointerEvent,
} from "@crc/core";
function PointerCaptureStudy() {
  const capturedId = useSignal<number | null>(null);
  const trace = useSignal<readonly string[]>([]);
  const position = useSignal({
    x: 220,
    y: 196,
  });
  const record = (value: string) =>
    trace.update((current) => [...current.slice(-3), value]);
  const label = (event: CRCPointerEvent) =>
    `${event.type} #${event.pointerId} captured=${event.currentTarget.hasPointerCapture(event.pointerId)}`;
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
        y: 45,
        fill: "#fffdf6",
        font: "900 25px sans-serif",
        textAlign: "center",
      }}
    >
      {"POINTER CAPTURE"}
    </Text>,
    <Rectangle
      style={{
        x: 74,
        y: 84,
        width: 292,
        height: 216,
        fill: capturedId.get() === null ? "#1f4bd8" : "#74d3ae",
        stroke: "#fffdf6",
        strokeWidth: 4,
        cursor: capturedId.get() === null ? "grab" : "grabbing",
      }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        capturedId.set(event.pointerId);
        position.set({
          x: event.x,
          y: event.y,
        });
        record(
          `setPointerCapture(${event.pointerId}) → has=${event.currentTarget.hasPointerCapture(event.pointerId)}`,
        );
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          position.set({
            x: event.x,
            y: event.y,
          });
        }
        record(
          `${label(event)} at ${Math.round(event.x)},${Math.round(event.y)}`,
        );
      }}
      onPointerUp={(event) => {
        event.currentTarget.releasePointerCapture(event.pointerId);
        capturedId.set(null);
        record(`releasePointerCapture(${event.pointerId}) → ${label(event)}`);
      }}
      onPointerCancel={(event) => {
        capturedId.set(null);
        record(label(event));
      }}
      onGotPointerCapture={(event) => record(label(event))}
      onLostPointerCapture={(event) => record(label(event))}
    />,
    <Text
      style={{
        x: 220,
        y: 155,
        fill: "#17211d",
        font: "900 27px sans-serif",
        textAlign: "center",
      }}
    >
      {capturedId.get() === null ? "PRESS AND DRAG" : `CAPTURING #${capturedId.get()}`}
    </Text>,
    <Text
      style={{
        x: 220,
        y: 194,
        fill: "#17211d",
        font: "700 13px sans-serif",
        textAlign: "center",
      }}
    >
      {"Keep holding, then move outside this card."}
    </Text>,
    <Rectangle
      style={{
        x: 406,
        y: 84,
        width: 240,
        height: 216,
        fill: "#f7f0df",
      }}
    />,
    <Text
      style={{
        x: 526,
        y: 130,
        fill: "#17211d",
        font: "900 17px monospace",
        textAlign: "center",
      }}
    >
      {"EVENT OWNER"}
    </Text>,
    <Text
      style={{
        x: 526,
        y: 174,
        fill: "#1f4bd8",
        font: "900 23px sans-serif",
        textAlign: "center",
      }}
    >
      {capturedId.get() === null ? "none" : `pointer #${capturedId.get()}`}
    </Text>,
    <Text
      style={{
        x: 526,
        y: 218,
        fill: "#17211d",
        font: "700 12px monospace",
        textAlign: "center",
      }}
    >{`latest move: ${Math.round(position.get().x)}, ${Math.round(position.get().y)}`}</Text>,
    <Text
      style={{
        x: 360,
        y: 326,
        fill: "#f7c948",
        font: "600 12px sans-serif",
        textAlign: "center",
      }}
    >
      {
        "got/lost capture are browser-timed; set, has, and release are called above."
      }
    </Text>,
    <Text
      style={{
        x: 48,
        y: 352,
        width: 624,
        lineHeight: 17,
        fit: "ellipsis",
        fill: "#74d3ae",
        font: "600 12px monospace",
      }}
    >
      {trace.get().length ? trace.get().join("\n") : "Trace waits for a press."}
    </Text>,
  ];
}
export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <PointerCaptureStudy />);
}
