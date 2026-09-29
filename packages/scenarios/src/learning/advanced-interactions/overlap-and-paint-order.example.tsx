import { crc, useSignal, Rectangle, Text, type CRCController } from "@crc/core";
function PaintOrderStudy() {
  const winner = useSignal("none");
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
        left: 118,
        top: 92,
        width: 320,
        height: 238,
        fill: "#1f4bd8",
        cursor: "pointer",
      }}
      onClick={() => winner.set("cobalt")}
    />,
    <Rectangle
      style={{
        left: 282,
        top: 126,
        width: 320,
        height: 238,
        fill: "#ff6b57",
        opacity: 0.94,
        cursor: "pointer",
      }}
      onClick={() => winner.set("coral")}
    />,
    <Text
      style={{
        left: 206,
        top: 184,
        fill: "#fffdf6",
        font: "900 32px sans-serif",
        textAlign: "center",
      }}
    >
      {"UNDER"}
    </Text>,
    <Text
      style={{
        left: 510,
        top: 238,
        fill: "#17211d",
        font: "900 32px sans-serif",
        textAlign: "center",
      }}
    >
      {"TOP"}
    </Text>,
    <Text
      style={{
        left: 360,
        top: 54,
        fill: "#17211d",
        font: "800 16px monospace",
        textAlign: "center",
      }}
    >
      {winner.get() === "none"
        ? "CLICK THE OVERLAP"
        : `TARGET / ${winner.get().toUpperCase()}`}
    </Text>,
  ];
}
export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <PaintOrderStudy />);
}
