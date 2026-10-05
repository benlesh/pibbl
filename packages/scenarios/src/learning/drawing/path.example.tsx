import {
  pibbl,
  useSignal,
  Path,
  Rectangle,
  Text,
  type PibblController,
} from "@pibbl/core";
function PathStudy() {
  const inside = useSignal(false);
  const star = new Path2D();
  const points = [
    [360, 66],
    [395, 156],
    [490, 160],
    [416, 218],
    [442, 314],
    [360, 258],
    [278, 314],
    [304, 218],
    [230, 160],
    [325, 156],
  ];
  star.moveTo(points[0][0], points[0][1]);
  for (const [x, y] of points.slice(1)) star.lineTo(x, y);
  star.closePath();
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
    <Path
      style={{
        d: star,
        fill: inside.get() ? "#f7c948" : "#74d3ae",
        stroke: "#fffdf6",
        strokeWidth: 6,
        cursor: "crosshair",
      }}
      onMouseOver={() => inside.set(true)}
      onMouseOut={() => inside.set(false)}
    />,
    <Text
      style={{
        left: 360,
        top: 350,
        fill: "#fffdf6",
        font: "700 18px monospace",
        textAlign: "center",
      }}
    >
      {inside.get() ? "PATH2D!" : "TRACE THE STAR"}
    </Text>,
  ];
}
export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(canvas, <PathStudy />);
}
