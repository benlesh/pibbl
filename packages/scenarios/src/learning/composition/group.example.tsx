import {
  pibbl,
  useSignal,
  Group,
  Rectangle,
  Text,
  type PibblController,
} from "@pibbl/core";
function GroupStudy() {
  const selected = useSignal(false);
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
          left: 0,
          top: 0,
          width: 376,
          height: 256,
          fill: selected.get() ? "#74d3ae" : "#ff6b57",
          stroke: "#17211d",
          strokeWidth: 6,
          cursor: "pointer",
        }}
        onClick={() => selected.update((value) => !value)}
      />
      <Rectangle
        style={{
          left: 28,
          top: 30,
          width: 74,
          height: 74,
          fill: "#f7c948",
        }}
      />
      <Rectangle
        style={{
          left: 274,
          top: 152,
          width: 74,
          height: 74,
          fill: "#1f4bd8",
        }}
      />
      <Text
        style={{
          left: 188,
          top: 112,
          fill: "#17211d",
          font: "900 34px sans-serif",
          textAlign: "center",
        }}
      >
        {selected.get() ? "GROUPED!" : "ONE GROUP"}
      </Text>
      <Text
        style={{
          left: 188,
          top: 162,
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
        left: 0,
        top: 0,
        width: 720,
        height: 420,
        fill: "#f7f0df",
      }}
    />,
    ticket,
  ];
}
export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(canvas, <GroupStudy />);
}
