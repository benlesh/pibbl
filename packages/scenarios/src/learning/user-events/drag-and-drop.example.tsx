import {
  crc,
  useSignal,
  Rectangle,
  Text,
  type CRCController,
  type CRCDragEvent,
} from "@crc/core";
function dragLine(type: string, event: CRCDragEvent): string {
  const payload = event.dataTransfer?.getData("text/plain") || "empty";
  return `${type}  @ ${Math.round(event.x)},${Math.round(event.y)}  data=${payload}`;
}
function DragAndDropStudy() {
  const trace = useSignal<readonly string[]>([]);
  const dropped = useSignal("nothing dropped");
  const record = (type: string, event: CRCDragEvent) => {
    trace.update((current) => [...current.slice(-4), dragLine(type, event)]);
  };
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
    <Text
      style={{
        left: 360,
        top: 46,
        fill: "#fffdf6",
        font: "900 24px sans-serif",
        textAlign: "center",
      }}
    >
      {"DRAG / DROP ROUTING"}
    </Text>,
    <Rectangle
      style={{
        left: 74,
        top: 104,
        width: 226,
        height: 176,
        fill: "#1f4bd8",
        stroke: "#9fc1ff",
        strokeWidth: 3,
        cursor: "grab",
      }}
      onDragStart={(event) => {
        event.dataTransfer?.setData("text/plain", "crc-cargo");
        record("dragstart", event);
      }}
      onDrag={(event) => record("drag", event)}
      onDragEnd={(event) => record("dragend", event)}
    />,
    <Text
      style={{
        left: 187,
        top: 174,
        lineHeight: 28,
        fill: "#fffdf6",
        font: "900 22px sans-serif",
        textAlign: "center",
        textBaseline: "middle",
      }}
    >
      {"DRAG THIS\nCRC CARGO"}
    </Text>,
    <Rectangle
      style={{
        left: 420,
        top: 104,
        width: 226,
        height: 176,
        fill: "#26354a",
        stroke: "#74d3ae",
        strokeWidth: 3,
        cursor: "copy",
      }}
      onDrag={(event) => record("drag over target", event)}
      onDragEnd={(event) => record("dragend over target", event)}
      onDragEnter={(event) => record("dragenter", event)}
      onDragLeave={(event) => record("dragleave", event)}
      onDragOver={(event) => {
        event.preventDefault();
        record("dragover / prevented", event);
      }}
      onDrop={(event) => {
        const payload = event.dataTransfer?.getData("text/plain") || "empty";
        dropped.set(`dropped: ${payload} @ ${Math.round(event.x)},${Math.round(event.y)}`);
        record("drop", event);
      }}
    />,
    <Text
      style={{
        left: 533,
        top: 164,
        fill: "#74d3ae",
        font: "900 22px sans-serif",
        textAlign: "center",
      }}
    >
      {dropped.get() === "nothing dropped" ? "DROP ZONE" : "DELIVERED"}
    </Text>,
    <Text
      style={{
        left: 533,
        top: 204,
        width: 190,
        fill: "#fffdf6",
        font: "700 11px monospace",
        textAlign: "center",
      }}
    >
      {dropped.get()}
    </Text>,
    <Text
      style={{
        left: 360,
        top: 314,
        width: 660,
        lineHeight: 17,
        wrap: true,
        fill: "#f7c948",
        font: "700 12px monospace",
        textAlign: "center",
        textBaseline: "top",
      }}
    >
      {trace.get().length
        ? trace.get().join("\n")
        : "Drag the blue cargo into the drop zone."}
    </Text>,
    <Text
      style={{
        left: 360,
        top: 398,
        fill: "#a9b8c9",
        font: "600 11px sans-serif",
        textAlign: "center",
      }}
    >
      {
        "dragover calls preventDefault(), which permits drop. Coordinates are root-logical; dataTransfer is native."
      }
    </Text>,
  ];
}
export default function mount(canvas: HTMLCanvasElement): CRCController {
  const previousDraggable = canvas.draggable;
  canvas.draggable = true;
  let disposed = false;
  try {
    const controller = crc(canvas, <DragAndDropStudy />);
    return {
      dispose() {
        if (disposed) return;
        disposed = true;
        controller.dispose();
        canvas.draggable = previousDraggable;
      },
    };
  } catch (error) {
    canvas.draggable = previousDraggable;
    throw error;
  }
}
