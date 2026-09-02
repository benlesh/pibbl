import {
  crc,
  crcState,
  Path,
  Rectangle,
  Text,
  type CRCController,
} from "@crc/core";
function PathStudy() {
  const [inside, setInside] = crcState(false);
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
        x: 0,
        y: 0,
        width: 720,
        height: 420,
        fill: "#17211d",
      }}
    />,
    <Path
      style={{
        d: star,
        fill: inside ? "#f7c948" : "#74d3ae",
        stroke: "#fffdf6",
        strokeWidth: 6,
        cursor: "crosshair",
      }}
      onMouseOver={() => setInside(true)}
      onMouseOut={() => setInside(false)}
    />,
    <Text
      style={{
        x: 360,
        y: 350,
        fill: "#fffdf6",
        font: "700 18px monospace",
        textAlign: "center",
      }}
    >
      {inside ? "PATH2D!" : "TRACE THE STAR"}
    </Text>,
  ];
}
export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <PathStudy />);
}
