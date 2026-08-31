import {
  crc,
  crcState,
  defineComp,
  rect,
  text,
  type CRCController,
  type CRCLogicalMouseEvent,
} from "@crc/core";

function mouseSummary(event: CRCLogicalMouseEvent): string {
  return `${event.type} at ${Math.round(event.x)},${Math.round(event.y)} button=${event.button} buttons=${event.buttons} detail=${event.detail}`;
}

const MouseBoundariesAndAuxiliaryClickStudy = defineComp(function MouseBoundariesAndAuxiliaryClickStudy() {
  const [inside, setInside] = crcState(false);
  const [auxiliaryCount, setAuxiliaryCount] = crcState(0);
  const [trace, setTrace] = crcState<readonly string[]>([]);
  const record = (event: CRCLogicalMouseEvent) =>
    setTrace((current) => [...current.slice(-3), mouseSummary(event)]);

  return [
    rect({
      style: { x: 0, y: 0, width: 720, height: 420, fill: "#f7f0df" },
    }),
    text({
      style: {
        text: "MOUSE BOUNDARIES + AUXCLICK",
        x: 360,
        y: 46,
        fill: "#17211d",
        font: "900 23px sans-serif",
        textAlign: "center",
      },
    }),
    rect({
      style: {
        x: 68,
        y: 92,
        width: 360,
        height: 194,
        fill: inside ? "#74d3ae" : "#1f4bd8",
        stroke: "#17211d",
        strokeWidth: 5,
        cursor: "pointer",
      },
      onMouseEnter: (event) => {
        setInside(true);
        record(event);
      },
      onMouseLeave: (event) => {
        setInside(false);
        record(event);
      },
      onAuxClick: (event) => {
        event.preventDefault();
        setAuxiliaryCount((value) => value + 1);
        record(event);
      },
    }),
    text({
      style: {
        text: inside ? "INSIDE" : "ENTER / LEAVE",
        x: 248,
        y: 158,
        fill: inside ? "#17211d" : "#fffdf6",
        font: "900 33px sans-serif",
        textAlign: "center",
      },
    }),
    text({
      style: {
        text: "Middle-click here for auxclick.",
        x: 248,
        y: 204,
        fill: inside ? "#17211d" : "#fffdf6",
        font: "700 14px sans-serif",
        textAlign: "center",
      },
    }),
    rect({
      style: { x: 470, y: 92, width: 182, height: 194, fill: "#17211d" },
    }),
    text({
      style: {
        text: "AUXCLICKS",
        x: 561,
        y: 150,
        fill: "#f7c948",
        font: "900 15px monospace",
        textAlign: "center",
      },
    }),
    text({
      style: {
        text: String(auxiliaryCount),
        x: 561,
        y: 216,
        fill: "#74d3ae",
        font: "900 52px sans-serif",
        textAlign: "center",
      },
    }),
    text({
      style: {
        text: "mouseenter and mouseleave are boundary events; auxclick reports the browser's non-primary button.",
        x: 360,
        y: 319,
        fill: "#17211d",
        font: "600 12px sans-serif",
        textAlign: "center",
      },
    }),
    text({
      style: {
        text: trace.length ? trace.join("\n") : "Move into and out of the cobalt card, then middle-click it.",
        x: 48,
        y: 347,
        width: 624,
        lineHeight: 18,
        fit: "ellipsis",
        fill: "#1f4bd8",
        font: "600 12px monospace",
      },
    }),
  ];
});

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, MouseBoundariesAndAuxiliaryClickStudy({}));
}
