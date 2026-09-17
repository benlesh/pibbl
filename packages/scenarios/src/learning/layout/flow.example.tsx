import {
  crc,
  useState,
  Flow,
  Rectangle,
  Text,
  type CRCController,
} from "@crc/core";
const colors = ["#1f4bd8", "#ff6b57", "#74d3ae", "#f7c948"] as const;
function FlowStudy() {
  const [selected, setSelected] = useState(0);
  return [
    <Rectangle
      style={{
        width: 720,
        height: 420,
        fill: "#f7f0df",
      }}
    />,
    <Flow
      style={{
        width: 552,
        height: 240,
        gap: 16,
        lineGap: 16,
        wrap: true,
      }}
    >
      {[
        ...colors.map((fill, index) => (
          <Rectangle
            key={String(index)}
            style={{
              width: index === selected ? 180 : 120,
              height: 84,
              fill,
              stroke: "#17211d",
              strokeWidth: index === selected ? 5 : 2,
              cursor: "pointer",
            }}
            onClick={() => setSelected(index)}
          />
        )),
        <Text
          style={{
            font: "800 16px sans-serif",
            fill: "#17211d",
          }}
        >
          {"AUTO-SIZED TEXT JOINS THE FLOW"}
        </Text>,
      ]}
    </Flow>,
  ];
}
export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <FlowStudy />);
}
