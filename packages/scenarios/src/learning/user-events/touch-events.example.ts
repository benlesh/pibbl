import {
  crc,
  crcState,
  defineComp,
  rect,
  text,
  type CRCController,
  type CRCTouchEvent,
} from "@crc/core";

function touchSummary(event: CRCTouchEvent): string {
  const changed = event.changedTouches[0];
  const identifier = changed ? changed.identifier : "–";
  return `${event.type} changed=#${identifier} at ${Math.round(event.x)},${Math.round(event.y)}  all=${event.touches.length} target=${event.targetTouches.length} changed=${event.changedTouches.length}`;
}

const TouchEventsStudy = defineComp(function TouchEventsStudy() {
  const [trace, setTrace] = crcState<readonly string[]>([]);
  const [activeContacts, setActiveContacts] = crcState(0);
  const record = (event: CRCTouchEvent) => {
    setTrace((current) => [...current.slice(-3), touchSummary(event)]);
    setActiveContacts(event.targetTouches.length);
  };

  return [
    rect({
      style: { x: 0, y: 0, width: 720, height: 420, fill: "#f7f0df" },
    }),
    text({
      style: {
        text: "TOUCH RETENTION",
        x: 360,
        y: 47,
        fill: "#17211d",
        font: "900 25px sans-serif",
        textAlign: "center",
      },
    }),
    rect({
      style: {
        x: 78,
        y: 92,
        width: 320,
        height: 188,
        fill: activeContacts ? "#a78bfa" : "#7c3aed",
        stroke: "#3b0764",
        strokeWidth: 5,
        cursor: "pointer",
      },
      onTouchStart: (event) => record(event),
      onTouchMove: (event) => record(event),
      onTouchEnd: (event) => record(event),
      onTouchCancel: (event) => record(event),
    }),
    text({
      style: {
        text: "START HERE",
        x: 238,
        y: 153,
        fill: "#fffdf6",
        font: "900 33px sans-serif",
        textAlign: "center",
      },
    }),
    text({
      style: {
        text: "Then drag a finger outside.\nThe start target retains that contact.",
        x: 238,
        y: 190,
        width: 258,
        lineHeight: 20,
        wrap: true,
        fill: "#fffdf6",
        font: "700 13px sans-serif",
        textAlign: "center",
      },
    }),
    rect({
      style: {
        x: 442,
        y: 92,
        width: 202,
        height: 188,
        fill: "#17211d",
      },
    }),
    text({
      style: {
        text: "RETAINED\nCONTACTS",
        x: 543,
        y: 145,
        lineHeight: 24,
        fill: "#f7c948",
        font: "900 16px monospace",
        textAlign: "center",
      },
    }),
    text({
      style: {
        text: String(activeContacts),
        x: 543,
        y: 220,
        fill: "#74d3ae",
        font: "900 48px sans-serif",
        textAlign: "center",
      },
    }),
    text({
      style: {
        text: "Touch start / move / end / cancel all expose touches, targetTouches, and changedTouches.",
        x: 360,
        y: 316,
        fill: "#17211d",
        font: "600 12px sans-serif",
        textAlign: "center",
      },
    }),
    text({
      style: {
        text: trace.length ? trace.join("\n") : "Use a touch-capable device; touchcancel is registered for interrupted contacts.",
        x: 46,
        y: 344,
        width: 628,
        lineHeight: 17,
        fit: "ellipsis",
        fill: "#1f4bd8",
        font: "600 12px monospace",
      },
    }),
  ];
});

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, TouchEventsStudy({}));
}
