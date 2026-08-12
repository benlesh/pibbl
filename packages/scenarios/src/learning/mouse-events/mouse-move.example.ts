import {
  crc,
  crcState,
  defineComp,
  rect,
  text,
  type CRCController,
} from "@crc/core";

const MouseMoveStudy = defineComp(function MouseMoveStudy() {
  const [trail, setTrail] = crcState<readonly [number, number][]>([]);
  return [
    rect({ x: 0, y: 0, width: 720, height: 420, fillStyle: "#f7f0df" }),
    rect({
      x: 58,
      y: 72,
      width: 604,
      height: 276,
      fillStyle: "#1f4bd8",
      cursor: "crosshair",
      onMouseMove: (event) =>
        setTrail((points) => [...points.slice(-17), [event.x, event.y]]),
    }),
    ...trail.map(([x, y], index) =>
      rect({
        x: x - 5,
        y: y - 5,
        width: 10,
        height: 10,
        fillStyle: index === trail.length - 1 ? "#f7c948" : "#74d3ae",
        alpha: (index + 3) / (trail.length + 2),
      }),
    ),
    text({
      text: trail.length
        ? `${Math.round(trail.at(-1)![0])}, ${Math.round(trail.at(-1)![1])}`
        : "MOVE INSIDE THE FIELD",
      x: 360,
      y: 368,
      fillStyle: "#17211d",
      font: "800 15px monospace",
      textAlign: "center",
    }),
  ];
});

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, MouseMoveStudy({}));
}
