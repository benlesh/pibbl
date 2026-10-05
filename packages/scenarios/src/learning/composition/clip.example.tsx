import {
  Clip,
  pibbl,
  useConst,
  useSignal,
  createRegularPolygonPath,
  Rectangle,
  Text,
  type PibblController,
} from "@pibbl/core";
function ClipStudy() {
  const inside = useSignal(false);
  const hexagon = useConst(
    () => createRegularPolygonPath({ sides: 6, cx: 360, cy: 210, inradius: 142 }),
  );
  return [
    <Rectangle
      style={{
        left: 0,
        top: 0,
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
          left: 204,
          top: 54,
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
          left: 112,
          top: 174,
          width: 496,
          height: 72,
          fill: "#ff6b57",
        }}
      />
      <Rectangle
        style={{
          left: 326,
          top: 10,
          width: 68,
          height: 400,
          fill: "#74d3ae",
        }}
      />
    </Clip>,
    <Text
      style={{
        left: 360,
        top: 190,
        fill: "#17211d",
        font: "900 25px sans-serif",
        textAlign: "center",
      }}
    >
      {inside.get() ? "INSIDE THE CLIP" : "HEXAGON WINDOW"}
    </Text>,
  ];
}
export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(canvas, <ClipStudy />);
}
