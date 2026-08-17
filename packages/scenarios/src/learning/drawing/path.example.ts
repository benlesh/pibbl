import {
  crc,
  crcState,
  defineComp,
  path,
  rect,
  text,
  type CRCController,
} from "@crc/core";

const PathStudy = defineComp(function PathStudy() {
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
    rect({
      style: {
        x: 0,
        y: 0,
        width: 720,
        height: 420,
        fill: '#17211d',
      },
    }),
    path({
      style: {
        d: star,
        fill: inside ? '#f7c948' : '#74d3ae',
        stroke: '#fffdf6',
        strokeWidth: 6,
        cursor: 'crosshair',
      },
      onMouseOver: () => setInside(true),
      onMouseOut: () => setInside(false),
    }),
    text({
      text: inside ? "PATH2D!" : "TRACE THE STAR",
      x: 360,
      y: 350,
      fillStyle: "#fffdf6",
      font: "700 18px monospace",
      textAlign: "center",
    }),
  ];
});

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, PathStudy({}));
}
