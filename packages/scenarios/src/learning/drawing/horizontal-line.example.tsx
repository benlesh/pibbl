import {
  crc,
  useSignal,
  HorizontalLine,
  Rectangle,
  Text,
  type CRCController,
} from "@crc/core";
function HorizontalStudy() {
  const band = useSignal("none");
  const rule = (y: number, color: string, name: string) => (
    <HorizontalLine
      style={{
        y,
        x1: 82,
        x2: 638,
        stroke: color,
        strokeWidth: band.get() === name ? 14 : 5,
        lineInteractionWidth: 30,
        alignToPixelGrid: "round",
      }}
      onMouseOver={() => band.set(name)}
      onMouseOut={() => band.set("none")}
    />
  );
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
        x: 82,
        y: 54,
        fill: "#fffdf6",
        font: "800 24px sans-serif",
      }}
    >
      {"HORIZONTAL RHYTHM"}
    </Text>,
    rule(154, "#1f4bd8", "cobalt"),
    rule(230, "#ff6b57", "coral"),
    rule(306, "#f7c948", "yellow"),
    <Text
      style={{
        x: 638,
        y: 344,
        fill: "#74d3ae",
        font: "700 14px monospace",
        textAlign: "right",
      }}
    >
      {band.get() === "none" ? "SWEEP THE LINES" : band.get().toUpperCase()}
    </Text>,
  ];
}
export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <HorizontalStudy />);
}
