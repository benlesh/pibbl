import {
  clip,
  crc,
  crcState,
  defineComp,
  rect,
  text,
  type CRCController,
} from "@crc/core";

const ClipStudy = defineComp(function ClipStudy() {
  const [inside, setInside] = crcState(false);
  const windowPath = new Path2D();
  windowPath.arc(360, 210, 142, 0, Math.PI * 2);
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
    clip({
      path: windowPath,
      children: [
        rect({
          style: {
            x: 204,
            y: 54,
            width: 312,
            height: 312,
            fill: inside ? '#f7c948' : '#1f4bd8',
            cursor: 'crosshair',
          },
          onMouseOver: () => setInside(true),
          onMouseOut: () => setInside(false),
        }),
        rect({
          style: {
            x: 112,
            y: 174,
            width: 496,
            height: 72,
            fill: '#ff6b57',
          },
        }),
        rect({
          style: {
            x: 326,
            y: 10,
            width: 68,
            height: 400,
            fill: '#74d3ae',
          },
        }),
      ],
    }),
    text({
      style: {
        text: inside ? "INSIDE THE CLIP" : "CIRCULAR WINDOW",
        x: 360,
        y: 190,
        fill: "#17211d",
        font: "900 25px sans-serif",
        textAlign: "center",
      },
    }),
  ];
});

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, ClipStudy({}));
}
