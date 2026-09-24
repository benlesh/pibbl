import {
  Clip,
  crc,
  useConst,
  useSignal,
  createRegularPolygonPath,
  Rectangle,
  Text,
  type CRCController,
} from "@crc/core";
function ClipStudy() {
  const inside = useSignal(false);
  const hexagon = useConst(
    () => createRegularPolygonPath({ sides: 6, cx: 360, cy: 210, inradius: 142 }),
  );
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
    <Clip
      style={{
        d: hexagon,
      }}
    >
      <Rectangle
        style={{
          x: 204,
          y: 54,
          width: 312,
          height: 312,
          fill: inside.get() ? "#f7c948" : "#1f4bd8",
          cursor: "crosshair",
        }}
        onMouseOver={() => inside.set(true)}
        onMouseOut={() => inside.set(false)}
      />
      <Rectangle
        style={{
          x: 112,
          y: 174,
          width: 496,
          height: 72,
          fill: "#ff6b57",
        }}
      />
      <Rectangle
        style={{
          x: 326,
          y: 10,
          width: 68,
          height: 400,
          fill: "#74d3ae",
        }}
      />
    </Clip>,
    <Text
      style={{
        x: 360,
        y: 190,
        fill: "#17211d",
        font: "900 25px sans-serif",
        textAlign: "center",
      }}
    >
      {inside.get() ? "INSIDE THE CLIP" : "HEXAGON WINDOW"}
    </Text>,
  ];
}
export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <ClipStudy />);
}
