import {
  crc,
  crcState,
  defineComp,
  rect,
  text,
  type CRCController,
  type CRCPointerEvent,
} from "@crc/core";

const PointerCaptureStudy = defineComp(function PointerCaptureStudy() {
  const [capturedId, setCapturedId] = crcState<number | null>(null);
  const [trace, setTrace] = crcState<readonly string[]>([]);
  const [position, setPosition] = crcState({ x: 220, y: 196 });
  const record = (value: string) =>
    setTrace((current) => [...current.slice(-3), value]);
  const label = (event: CRCPointerEvent) =>
    `${event.type} #${event.pointerId} captured=${event.currentTarget.hasPointerCapture(event.pointerId)}`;

  return [
    rect({
      style: { x: 0, y: 0, width: 720, height: 420, fill: "#17211d" },
    }),
    text({
      style: {
        text: "POINTER CAPTURE",
        x: 360,
        y: 45,
        fill: "#fffdf6",
        font: "900 25px sans-serif",
        textAlign: "center",
      },
    }),
    rect({
      style: {
        x: 74,
        y: 84,
        width: 292,
        height: 216,
        fill: capturedId === null ? "#1f4bd8" : "#74d3ae",
        stroke: "#fffdf6",
        strokeWidth: 4,
        cursor: capturedId === null ? "grab" : "grabbing",
      },
      onPointerDown: (event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        setCapturedId(event.pointerId);
        setPosition({ x: event.x, y: event.y });
        record(`setPointerCapture(${event.pointerId}) → has=${event.currentTarget.hasPointerCapture(event.pointerId)}`);
      },
      onPointerMove: (event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          setPosition({ x: event.x, y: event.y });
        }
        record(`${label(event)} at ${Math.round(event.x)},${Math.round(event.y)}`);
      },
      onPointerUp: (event) => {
        event.currentTarget.releasePointerCapture(event.pointerId);
        setCapturedId(null);
        record(`releasePointerCapture(${event.pointerId}) → ${label(event)}`);
      },
      onPointerCancel: (event) => {
        setCapturedId(null);
        record(label(event));
      },
      onGotPointerCapture: (event) => record(label(event)),
      onLostPointerCapture: (event) => record(label(event)),
    }),
    text({
      style: {
        text: capturedId === null ? "PRESS AND DRAG" : `CAPTURING #${capturedId}`,
        x: 220,
        y: 155,
        fill: "#17211d",
        font: "900 27px sans-serif",
        textAlign: "center",
      },
    }),
    text({
      style: {
        text: "Keep holding, then move outside this card.",
        x: 220,
        y: 194,
        fill: "#17211d",
        font: "700 13px sans-serif",
        textAlign: "center",
      },
    }),
    rect({
      style: { x: 406, y: 84, width: 240, height: 216, fill: "#f7f0df" },
    }),
    text({
      style: {
        text: "EVENT OWNER",
        x: 526,
        y: 130,
        fill: "#17211d",
        font: "900 17px monospace",
        textAlign: "center",
      },
    }),
    text({
      style: {
        text: capturedId === null ? "none" : `pointer #${capturedId}`,
        x: 526,
        y: 174,
        fill: "#1f4bd8",
        font: "900 23px sans-serif",
        textAlign: "center",
      },
    }),
    text({
      style: {
        text: `latest move: ${Math.round(position.x)}, ${Math.round(position.y)}`,
        x: 526,
        y: 218,
        fill: "#17211d",
        font: "700 12px monospace",
        textAlign: "center",
      },
    }),
    text({
      style: {
        text: "got/lost capture are browser-timed; set, has, and release are called above.",
        x: 360,
        y: 326,
        fill: "#f7c948",
        font: "600 12px sans-serif",
        textAlign: "center",
      },
    }),
    text({
      style: {
        text: trace.length ? trace.join("\n") : "Trace waits for a press.",
        x: 48,
        y: 352,
        width: 624,
        lineHeight: 17,
        fit: "ellipsis",
        fill: "#74d3ae",
        font: "600 12px monospace",
      },
    }),
  ];
});

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, PointerCaptureStudy({}));
}
