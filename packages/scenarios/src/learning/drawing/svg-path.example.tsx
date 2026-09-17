import {
  crc,
  useState,
  Group,
  Rectangle,
  SvgPath,
  Text,
  type CRCController,
} from "@crc/core";
function SvgPathStudy() {
  const [active, setActive] = useState(false);
  return [
    <Rectangle
      style={{
        x: 0,
        y: 0,
        width: 720,
        height: 420,
        fill: "#f7c948",
      }}
    />,
    <Rectangle
      style={{
        x: 52,
        y: 52,
        width: 616,
        height: 316,
        fill: "#fffdf6",
        stroke: "#17211d",
        strokeWidth: 6,
      }}
    />,
    <Group
      style={{
        translateX: 238,
        translateY: 70,
        scaleX: 2.45,
        scaleY: 2.45,
      }}
    >
      <SvgPath
        style={{
          d: "M50 88 C20 68 4 48 8 28 C12 4 42 0 50 20 C58 0 88 4 92 28 C96 48 80 68 50 88 Z",
          fill: active ? "#1f4bd8" : "#ff6b57",
          stroke: "#17211d",
          strokeWidth: 2,
          cursor: "pointer",
        }}
        onClick={() => setActive((value) => !value)}
      />
    </Group>,
    <Text
      style={{
        x: 360,
        y: 326,
        fill: "#17211d",
        font: "800 17px sans-serif",
        textAlign: "center",
      }}
    >
      {active ? "SVG PATH / ACTIVE" : "SVG PATH / CLICK"}
    </Text>,
  ];
}
export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <SvgPathStudy />);
}
