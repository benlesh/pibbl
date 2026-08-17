import {
  crc,
  crcState,
  defineComp,
  line,
  rect,
  text,
  type CRCController,
} from "@crc/core";

const HitAreaStudy = defineComp(function HitAreaStudy() {
  const [hits, setHits] = crcState(0);
  const route: [number, number][] = [
    [80, 290],
    [200, 118],
    [340, 260],
    [484, 100],
    [640, 250],
  ];
  return [
    rect({
      style: {
        x: 0,
        y: 0,
        width: 720,
        height: 420,
        fill: '#f7f0df',
      },
    }),
    line({ coords: route, strokeStyle: "#17211d", lineWidth: 18 }),
    line({
      coords: route,
      strokeStyle: "#ff6b57",
      lineWidth: 4,
      lineInteractionWidth: 42,
      cursor: "grab",
      onClick: () => setHits((value) => value + 1),
    }),
    text({
      text: "4 PX STROKE / 42 PX HIT AREA",
      x: 360,
      y: 48,
      fillStyle: "#17211d",
      font: "900 22px sans-serif",
      textAlign: "center",
    }),
    text({
      text: `CLICKS NEAR THE LINE / ${hits}`,
      x: 360,
      y: 354,
      fillStyle: "#1f4bd8",
      font: "700 14px monospace",
      textAlign: "center",
    }),
  ];
});

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, HitAreaStudy({}));
}
