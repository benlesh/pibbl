import {
  crc,
  crcState,
  Group,
  Layer,
  Rectangle,
  Text,
  type CRCController,
} from "@crc/core";
function LayerStudy() {
  const [active, setActive] = crcState(false);
  return [
    <Rectangle
      style={{
        x: 0,
        y: 0,
        width: 720,
        height: 420,
        fill: "#ff6b57",
      }}
    />,
    <Rectangle
      style={{
        x: 132,
        y: 82,
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
            x: 0,
            y: 0,
            width: 344,
            height: 214,
            fill: active ? "#f7c948" : "#74d3ae",
            stroke: "#17211d",
            strokeWidth: 6,
            cursor: "pointer",
          }}
          onClick={() => setActive((value) => !value)}
        />
        <Rectangle
          style={{
            x: 34,
            y: 34,
            width: 86,
            height: 146,
            fill: "#1f4bd8",
          }}
        />
        <Text
          style={{
            x: 226,
            y: 84,
            fill: "#17211d",
            font: "900 25px sans-serif",
            textAlign: "center",
          }}
        >
          {active ? "LAYER!" : "OFFSCREEN"}
        </Text>
        <Text
          style={{
            x: 226,
            y: 130,
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
