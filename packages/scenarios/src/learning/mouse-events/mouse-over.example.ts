import {
  crc,
  crcState,
  defineComp,
  rect,
  text,
  type CRCController,
} from "@crc/core";

const MouseOverStudy = defineComp(function MouseOverStudy() {
  const [active, setActive] = crcState("none");
  const card = (x: number, color: string, label: string) => [
    rect({
      x,
      y: 108,
      width: 176,
      height: 210,
      fillStyle: color,
      strokeStyle: "#17211d",
      lineWidth: 5,
      cursor: "pointer",
      onMouseOver: () => setActive(label),
    }),
    text({
      text: label,
      x: x + 88,
      y: 196,
      fillStyle: "#17211d",
      font: "900 22px sans-serif",
      textAlign: "center",
    }),
  ];
  return [
    rect({ x: 0, y: 0, width: 720, height: 420, fillStyle: "#f7f0df" }),
    ...card(64, "#1f4bd8", "FORM"),
    ...card(272, "#ff6b57", "COLOR"),
    ...card(480, "#f7c948", "PLAY"),
    text({
      text: active === "none" ? "ENTER A CARD" : `${active} / ENTERED`,
      x: 360,
      y: 352,
      fillStyle: "#17211d",
      font: "800 15px monospace",
      textAlign: "center",
    }),
  ];
});

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, MouseOverStudy({}));
}
