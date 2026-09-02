import {
  crc,
  crcState,
  Group,
  Rectangle,
  Text,
  type CRCController,
} from "@crc/core";
function GroupStudy() {
  const [selected, setSelected] = crcState(false);
  const ticket = (
    <Group
      style={{
        translateX: 172,
        translateY: 72,
        rotationDegrees: -8,
        rotationOrigin: [188, 128],
      }}
    >
      <Rectangle
        style={{
          x: 0,
          y: 0,
          width: 376,
          height: 256,
          fill: selected ? "#74d3ae" : "#ff6b57",
          stroke: "#17211d",
          strokeWidth: 6,
          cursor: "pointer",
        }}
        onClick={() => setSelected((value) => !value)}
      />
      <Rectangle
        style={{
          x: 28,
          y: 30,
          width: 74,
          height: 74,
          fill: "#f7c948",
        }}
      />
      <Rectangle
        style={{
          x: 274,
          y: 152,
          width: 74,
          height: 74,
          fill: "#1f4bd8",
        }}
      />
      <Text
        style={{
          x: 188,
          y: 112,
          fill: "#17211d",
          font: "900 34px sans-serif",
          textAlign: "center",
        }}
      >
        {selected ? "GROUPED!" : "ONE GROUP"}
      </Text>
      <Text
        style={{
          x: 188,
          y: 162,
          fill: "#17211d",
          font: "700 13px monospace",
          textAlign: "center",
        }}
      >
        {"MOVE · ROTATE · SCALE"}
      </Text>
    </Group>
  );
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
    ticket,
  ];
}
export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <GroupStudy />);
}
