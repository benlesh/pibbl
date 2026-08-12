import {
  clip,
  crc,
  crcState,
  defineComp,
  g,
  layer,
  path,
  rect,
  text,
  type CRCController,
} from "@crc/core";

interface MoonProps {
  active: boolean;
  onSelect: () => void;
}

const Moon = defineComp(function Moon(props: MoonProps) {
  const circle = new Path2D();
  circle.arc(150, 130, 108, 0, Math.PI * 2);
  return [
    rect({ x: 0, y: 0, width: 300, height: 260, fillStyle: "#1f4bd8" }),
    path({
      path: circle,
      fillStyle: props.active ? "#f7c948" : "#74d3ae",
      cursor: "pointer",
      onClick: props.onSelect,
    }),
    rect({
      x: 128,
      y: 30,
      width: 44,
      height: 200,
      fillStyle: "#ff6b57",
      alpha: 0.82,
    }),
  ];
});

const ComposedTargetStudy = defineComp(function ComposedTargetStudy() {
  const [active, setActive] = crcState(false);
  const crop = new Path2D();
  crop.roundRect(0, 0, 300, 260, 58);
  return [
    rect({ x: 0, y: 0, width: 720, height: 420, fillStyle: "#17211d" }),
    g({
      x: 210,
      y: 74,
      rotate: 8,
      rotateOrigin: [150, 130],
      children: [
        clip({
          path: crop,
          children: [
            layer({
              width: 300,
              height: 260,
              render: Moon({
                active,
                onSelect: () => setActive((value) => !value),
              }),
            }),
          ],
        }),
      ],
    }),
    text({
      text: active ? "COMPOSED TARGET!" : "CLICK THE VISIBLE MOON",
      x: 360,
      y: 360,
      fillStyle: "#fffdf6",
      font: "800 16px monospace",
      textAlign: "center",
    }),
  ];
});

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, ComposedTargetStudy({}));
}
