import {
  crc,
  crcState,
  defineComp,
  rect,
  text,
  type CRCController,
} from "@crc/core";

const MouseDownStudy = defineComp(function MouseDownStudy() {
  const [presses, setPresses] = crcState(0);
  const [button, setButton] = crcState("none");
  return [
    rect({ x: 0, y: 0, width: 720, height: 420, fillStyle: "#ff6b57" }),
    rect({
      x: 150,
      y: 92,
      width: 420,
      height: 236,
      fillStyle: "#1f4bd8",
      strokeStyle: "#17211d",
      lineWidth: 8,
      cursor: "pointer",
      onMouseDown: (event) => {
        setPresses((value) => value + 1);
        setButton(
          ["primary", "middle", "secondary"][event.originalEvent.button] ??
            `button ${event.originalEvent.button}`,
        );
      },
    }),
    text({
      text: "PRESS THE PAD",
      x: 360,
      y: 164,
      fillStyle: "#fffdf6",
      font: "900 40px sans-serif",
      textAlign: "center",
    }),
    text({
      text: `DOWN / ${presses} / ${button}`,
      x: 360,
      y: 238,
      fillStyle: "#fffdf6",
      font: "700 15px monospace",
      textAlign: "center",
    }),
  ];
});

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, MouseDownStudy({}));
}
