import {
  crc,
  useState,
  Line,
  Rectangle,
  Text,
  type CRCController,
} from "@crc/core";
function HitAreaStudy() {
  const [hits, setHits] = useState(0);
  const route: [number, number][] = [
    [80, 290],
    [200, 118],
    [340, 260],
    [484, 100],
    [640, 250],
  ];
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
    <Line
      style={{
        coords: route,
        stroke: "#17211d",
        strokeWidth: 18,
      }}
    />,
    <Line
      style={{
        coords: route,
        stroke: "#ff6b57",
        strokeWidth: 4,
        lineInteractionWidth: 42,
        cursor: "grab",
      }}
      onClick={() => setHits((value) => value + 1)}
    />,
    <Text
      style={{
        x: 360,
        y: 48,
        fill: "#17211d",
        font: "900 22px sans-serif",
        textAlign: "center",
      }}
    >
      {"4 PX STROKE / 42 PX HIT AREA"}
    </Text>,
    <Text
      style={{
        x: 360,
        y: 354,
        fill: "#1f4bd8",
        font: "700 14px monospace",
        textAlign: "center",
      }}
    >{`CLICKS NEAR THE LINE / ${hits}`}</Text>,
  ];
}
export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <HitAreaStudy />);
}
