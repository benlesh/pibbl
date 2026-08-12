import {
  crc,
  crcState,
  defineComp,
  rect,
  text,
  type CRCController,
} from "@crc/core";

const EventSequenceStudy = defineComp(function EventSequenceStudy() {
  const [events, setEvents] = crcState<readonly string[]>([]);
  const record = (value: string) =>
    setEvents((current) => [...current.slice(-5), value]);
  const target = (x: number, color: string, name: string) =>
    rect({
      x,
      y: 86,
      width: 250,
      height: 210,
      fillStyle: color,
      cursor: "pointer",
      onMouseOver: () => record(`${name}: over`),
      onMouseOut: () => record(`${name}: out`),
      onMouseMove: () => record(`${name}: move`),
      onMouseDown: () => record(`${name}: down`),
      onMouseUp: () => record(`${name}: up`),
      onClick: () => record(`${name}: click`),
    });
  return [
    rect({ x: 0, y: 0, width: 720, height: 420, fillStyle: "#17211d" }),
    target(70, "#1f4bd8", "A"),
    target(400, "#ff6b57", "B"),
    text({
      text: "A",
      x: 195,
      y: 158,
      fillStyle: "#fffdf6",
      font: "900 72px sans-serif",
      textAlign: "center",
    }),
    text({
      text: "B",
      x: 525,
      y: 158,
      fillStyle: "#17211d",
      font: "900 72px sans-serif",
      textAlign: "center",
    }),
    text({
      text: events.length ? events.join("  →  ") : "MOVE A → B, THEN CLICK",
      x: 360,
      y: 340,
      maxWidth: 620,
      overflow: "ellipsis",
      fillStyle: "#74d3ae",
      font: "700 13px monospace",
      textAlign: "center",
    }),
  ];
});

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, EventSequenceStudy({}));
}
