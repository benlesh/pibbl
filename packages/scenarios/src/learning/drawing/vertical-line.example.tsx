import {
  crc,
  useSignal,
  Rectangle,
  Text,
  VerticalLine,
  type CRCController,
} from "@crc/core";
function VerticalStudy() {
  const stripe = useSignal(0);
  const colors = ["#1f4bd8", "#ff6b57", "#f7c948", "#74d3ae"];
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
    ...colors.map((color, index) => (
      <VerticalLine
        style={{
          x: 160 + index * 132,
          y1: 74 + index * 18,
          y2: 346 - index * 18,
          stroke: color,
          strokeWidth: stripe.get() === index + 1 ? 26 : 10,
          lineInteractionWidth: 40,
          alignToPixelGrid: "round",
          cursor: "col-resize",
        }}
        onMouseOver={() => stripe.set(index + 1)}
        onMouseOut={() => stripe.set(0)}
      />
    )),
    <Text
      style={{
        x: 360,
        y: 370,
        fill: "#17211d",
        font: "800 17px monospace",
        textAlign: "center",
      }}
    >
      {stripe.get() ? `STRIPE ${stripe.get()}` : "VERTICAL FIELD"}
    </Text>,
  ];
}
export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <VerticalStudy />);
}
