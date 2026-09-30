import {
  Absolute,
  crc,
  useSignal,
  Overlay,
  Group,
  Rectangle,
  Text,
  type CRCController,
} from "@crc/core";
function AbsoluteOverlayStudy() {
  const active = useSignal(false);
  return (
    <Absolute
      style={{
        width: "100%",
        height: "100%",
      }}
    >
      <Rectangle
        style={{
          width: "100%",
          height: "100%",
          fill: "#f7f0df",
        }}
      />
      <Overlay
        style={{
          left: 100,
          top: 70,
          width: 520,
          height: 280,
          alignItems: "center",
          justifyItems: "center",
        }}
      >
        <Rectangle
          style={{
            width: "100%",
            height: "100%",
            fill: "#1f4bd8",
          }}
        />
        <Rectangle
          style={{
            width: 270,
            height: 130,
            fill: active.get() ? "#74d3ae" : "#ff6b57",
            stroke: "#17211d",
            strokeWidth: 5,
            cursor: "pointer",
          }}
          onClick={() => active.update((value) => !value)}
        />
        <Group style={{ width: 260, height: 28, alignSelf: "center", justifySelf: "center" }}>
        <Text
          style={{
            left: 130,
            top: 14,
            fill: "#17211d",
            font: "800 22px sans-serif",
            textAlign: "center",
            textBaseline: "middle",
          }}
        >
          {active.get() ? "OVERLAY ACTIVE" : "CLICK THE OVERLAY"}
        </Text>
        </Group>
      </Overlay>
    </Absolute>
  );
}
export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <AbsoluteOverlayStudy />);
}
