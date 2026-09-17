import {
  crc,
  useState,
  Grid,
  Rectangle,
  Text,
  type CRCController,
} from "@crc/core";
function GridStudy() {
  const [active, setActive] = useState(false);
  return [
    <Rectangle
      style={{
        width: 720,
        height: 420,
        fill: "#f7f0df",
      }}
    />,
    <Grid
      style={{
        width: 560,
        height: 260,
        padding: 80,
        gridTemplateColumns: [150, "25%", "1fr"],
        gridTemplateRows: [100, "1fr"],
        gap: 14,
      }}
    >
      <Rectangle
        style={{
          width: "auto",
          height: "auto",
          gridColumnStart: 1,
          gridRowStart: 1,
          fill: "#f7c948",
          stroke: "#17211d",
          strokeWidth: 3,
        }}
      />
      <Rectangle
        style={{
          width: "auto",
          height: "auto",
          gridColumnStart: 2,
          gridColumnSpan: 2,
          gridRowStart: 1,
          fill: active ? "#74d3ae" : "#ff6b57",
          stroke: "#17211d",
          strokeWidth: 3,
          cursor: "pointer",
        }}
        onClick={() => setActive((value) => !value)}
      />
      <Rectangle
        style={{
          width: "auto",
          height: "auto",
          gridColumnStart: 1,
          gridColumnSpan: 2,
          gridRowStart: 2,
          fill: "#1f4bd8",
        }}
      />
      <Rectangle
        style={{
          width: "auto",
          height: "auto",
          gridColumnStart: 3,
          gridRowStart: 2,
          fill: "#74d3ae",
        }}
      />
    </Grid>,
    <Text
      style={{
        x: 360,
        y: 52,
        fill: "#17211d",
        font: "900 18px sans-serif",
        textAlign: "center",
      }}
    >
      {"EXPLICIT TRACKS · EXPLICIT PLACEMENT"}
    </Text>,
  ];
}
export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <GridStudy />);
}
