import { crc, crcState, Rectangle, Text, type CRCController } from "@crc/core";
function ContextMenuStudy() {
  const [opened, setOpened] = crcState(false);
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
    <Rectangle
      style={{
        x: 98,
        y: 82,
        width: 350,
        height: 256,
        fill: "#ff6b57",
        stroke: "#17211d",
        strokeWidth: 6,
        cursor: "context-menu",
      }}
      onContextMenu={(event) => {
        event.originalEvent.preventDefault();
        setOpened(true);
      }}
    />,
    <Text
      style={{
        x: 273,
        y: 170,
        fill: "#17211d",
        font: "900 38px sans-serif",
        textAlign: "center",
      }}
    >
      {"RIGHT CLICK"}
    </Text>,
    <Text
      style={{
        x: 560,
        y: 154,
        width: 130,
        lineHeight: 26,
        wrap: true,
        fill: "#17211d",
        font: "700 17px sans-serif",
        textAlign: "center",
      }}
    >
      {opened
        ? "Context received\nDefault menu prevented"
        : "A contextual action\ncan stay contextual."}
    </Text>,
  ];
}
export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <ContextMenuStudy />);
}
