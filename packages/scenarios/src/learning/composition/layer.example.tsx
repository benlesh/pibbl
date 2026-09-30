import {
  crc,
  useSignal,
  Group,
  Layer,
  Rectangle,
  Text,
  type CRCController,
} from "@crc/core";
function LayerStudy() {
  const active = useSignal(false);
  return [
    <Rectangle
      style={{
        left: 0,
        top: 0,
        width: 720,
        height: 420,
        fill: "#ff6b57",
      }}
    />,
    <Rectangle
      style={{
        left: 132,
        top: 82,
        width: 456,
        height: 256,
        fill: "#fffdf6",
        stroke: "#17211d",
        strokeWidth: 6,
      }}
    />,
    <Group
      style={{
        translateX: 188,
        translateY: 103,
      }}
    >
      <Layer
        style={{
          width: 344,
          height: 214,
        }}
      >
        <Rectangle
          style={{
            left: 0,
            top: 0,
            width: 344,
            height: 214,
            fill: active.get() ? "#f7c948" : "#74d3ae",
            stroke: "#17211d",
            strokeWidth: 6,
            cursor: "pointer",
          }}
          onClick={() => active.update((value) => !value)}
        />
        <Rectangle
          style={{
            left: 34,
            top: 34,
            width: 86,
            height: 146,
            fill: "#1f4bd8",
          }}
        />
        <Text
          style={{
            left: 226,
            top: 84,
            fill: "#17211d",
            font: "900 25px sans-serif",
            textAlign: "center",
          }}
        >
          {active.get() ? "LAYER!" : "OFFSCREEN"}
        </Text>
        <Text
          style={{
            left: 226,
            top: 130,
            fill: "#17211d",
            font: "700 12px monospace",
            textAlign: "center",
          }}
        >
          {"CLICK THE BADGE"}
        </Text>
      </Layer>
    </Group>,
  ];
}
export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <LayerStudy />);
}
