import {
  crc,
  crcState,
  defineComp,
  rect,
  text,
  type CRCController,
} from "@crc/core";

const Poster = defineComp(function Poster() {
  const [message, setMessage] = crcState("HELLO");
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
    rect({
      style: {
        x: 74,
        y: 72,
        width: 572,
        height: 276,
        fill: '#f7c948',
        stroke: '#17211d',
        strokeWidth: 6,
      },
    }),
    rect({
      style: {
        x: 154,
        y: 112,
        width: 412,
        height: 196,
        fill: '#1f4bd8',
        cursor: 'pointer',
      },
      onClick: () => setMessage((value) => (value === 'HELLO' ? 'CRC!' : 'HELLO')),
    }),
    text({
      text: message,
      x: 360,
      y: 180,
      fillStyle: "#fffdf6",
      font: "800 64px sans-serif",
      textAlign: "center",
    }),
    text({
      text: "CLICK THE CARD",
      x: 360,
      y: 258,
      fillStyle: "#fffdf6",
      font: "700 14px monospace",
      textAlign: "center",
    }),
  ];
});

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, Poster({}));
}
