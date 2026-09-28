import {
  Clip,
  crc,
  useSignal,
  Group,
  Layer,
  Path,
  Rectangle,
  Text,
  type CRCController,
} from "@crc/core";
interface MoonProps {
  active: boolean;
  onSelect: () => void;
}
function Moon(props: MoonProps) {
  const circle = new Path2D();
  circle.arc(150, 130, 108, 0, Math.PI * 2);
  return [
    <Rectangle
      style={{
        x: 0,
        y: 0,
        width: 300,
        height: 260,
        fill: "#1f4bd8",
      }}
    />,
    <Path
      style={{
        d: circle,
        fill: props.active ? "#f7c948" : "#74d3ae",
        cursor: "pointer",
      }}
      onClick={props.onSelect}
    />,
    <Rectangle
      style={{
        x: 128,
        y: 30,
        width: 44,
        height: 200,
        fill: "#ff6b57",
        opacity: 0.82,
      }}
    />,
  ];
}
function ComposedTargetStudy() {
  const active = useSignal(false);
  const crop = new Path2D();
  crop.roundRect(0, 0, 300, 260, 58);
  return [
    <Rectangle
      style={{
        x: 0,
        y: 0,
        width: 720,
        height: 420,
        fill: "#17211d",
      }}
    />,
    <Group
      style={{
        translateX: 210,
        translateY: 74,
        rotationDegrees: 8,
        rotationOrigin: [150, 130],
      }}
    >
      <Clip
        style={{
          d: crop,
        }}
      >
        <Layer
          style={{
            width: 300,
            height: 260,
          }}
        >
          <Moon active={active.get()} onSelect={() => active.update((value) => !value)} />
        </Layer>
      </Clip>
    </Group>,
    <Text
      style={{
        x: 360,
        y: 360,
        fill: "#fffdf6",
        font: "800 16px monospace",
        textAlign: "center",
      }}
    >
      {active.get() ? "COMPOSED TARGET!" : "CLICK THE VISIBLE MOON"}
    </Text>,
  ];
}
export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <ComposedTargetStudy />);
}
