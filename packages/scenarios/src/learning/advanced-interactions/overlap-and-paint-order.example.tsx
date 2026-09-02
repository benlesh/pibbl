import { crc, crcState, Rectangle, Text, type CRCController } from "@crc/core";
function PaintOrderStudy() {
  const [winner, setWinner] = crcState("none");
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
        x: 118,
        y: 92,
        width: 320,
        height: 238,
        fill: "#1f4bd8",
        cursor: "pointer",
      }}
      onClick={() => setWinner("cobalt")}
    />,
    <Rectangle
      style={{
        x: 282,
        y: 126,
        width: 320,
        height: 238,
        fill: "#ff6b57",
        opacity: 0.94,
        cursor: "pointer",
      }}
      onClick={() => setWinner("coral")}
    />,
    <Text
      style={{
        x: 206,
        y: 184,
        fill: "#fffdf6",
        font: "900 32px sans-serif",
        textAlign: "center",
      }}
    >
      {"UNDER"}
    </Text>,
    <Text
      style={{
        x: 510,
        y: 238,
        fill: "#17211d",
        font: "900 32px sans-serif",
        textAlign: "center",
      }}
    >
      {"TOP"}
    </Text>,
    <Text
      style={{
        x: 360,
        y: 54,
        fill: "#17211d",
        font: "800 16px monospace",
        textAlign: "center",
      }}
    >
      {winner === "none"
        ? "CLICK THE OVERLAP"
        : `TARGET / ${winner.toUpperCase()}`}
    </Text>,
  ];
}
export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <PaintOrderStudy />);
}
