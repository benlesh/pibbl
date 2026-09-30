import { crc, useSignal, Rectangle, Text, type CRCController } from "@crc/core";
function ContextMenuStudy() {
  const opened = useSignal(false);
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
    <Rectangle
      style={{
        left: 98,
        top: 82,
        width: 350,
        height: 256,
        fill: "#ff6b57",
        stroke: "#17211d",
        strokeWidth: 6,
        cursor: "context-menu",
      }}
      onContextMenu={(event) => {
        event.originalEvent.preventDefault();
        opened.set(true);
      }}
    />,
    <Text
      style={{
        left: 273,
        top: 170,
        fill: "#17211d",
        font: "900 38px sans-serif",
        textAlign: "center",
      }}
    >
      {"RIGHT CLICK"}
    </Text>,
    <Text
      style={{
        left: 560,
        top: 154,
        width: 130,
        lineHeight: 26,
        wrap: true,
        fill: "#17211d",
        font: "700 17px sans-serif",
        textAlign: "center",
      }}
    >
      {opened.get()
        ? "Context received\nDefault menu prevented"
        : "A contextual action\ncan stay contextual."}
    </Text>,
  ];
}
export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <ContextMenuStudy />);
}
