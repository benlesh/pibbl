import {
  pibbl,
  useSignal,
  Rectangle,
  Text,
  type PibblController,
  type PibblTouchEvent,
} from "@pibbl/core";
function touchSummary(event: PibblTouchEvent): string {
  const changed = event.changedTouches[0];
  const identifier = changed ? changed.identifier : "–";
  return `${event.type} changed=#${identifier} at ${Math.round(event.x)},${Math.round(event.y)}  all=${event.touches.length} target=${event.targetTouches.length} changed=${event.changedTouches.length}`;
}
function TouchEventsStudy() {
  const trace = useSignal<readonly string[]>([]);
  const activeContacts = useSignal(0);
  const record = (event: PibblTouchEvent) => {
    trace.update((current) => [...current.slice(-3), touchSummary(event)]);
    activeContacts.set(event.targetTouches.length);
  };
  return [
    <Rectangle
      style={{
        left: 0,
        top: 0,
        width: 720,
        height: 420,
        fill: "#f7f0df",
      }}
    />,
    <Text
      style={{
        left: 360,
        top: 47,
        fill: "#17211d",
        font: "900 25px sans-serif",
        textAlign: "center",
      }}
    >
      {"TOUCH RETENTION"}
    </Text>,
    <Rectangle
      style={{
        left: 78,
        top: 92,
        width: 320,
        height: 188,
        fill: activeContacts.get() ? "#a78bfa" : "#7c3aed",
        stroke: "#3b0764",
        strokeWidth: 5,
        cursor: "pointer",
      }}
      onTouchStart={(event) => record(event)}
      onTouchMove={(event) => record(event)}
      onTouchEnd={(event) => record(event)}
      onTouchCancel={(event) => record(event)}
    />,
    <Text
      style={{
        left: 238,
        top: 153,
        fill: "#fffdf6",
        font: "900 33px sans-serif",
        textAlign: "center",
      }}
    >
      {"START HERE"}
    </Text>,
    <Text
      style={{
        left: 238,
        top: 190,
        width: 258,
        lineHeight: 20,
        wrap: true,
        fill: "#fffdf6",
        font: "700 13px sans-serif",
        textAlign: "center",
      }}
    >
      {"Then drag a finger outside.\nThe start target retains that contact."}
    </Text>,
    <Rectangle
      style={{
        left: 442,
        top: 92,
        width: 202,
        height: 188,
        fill: "#17211d",
      }}
    />,
    <Text
      style={{
        left: 543,
        top: 145,
        lineHeight: 24,
        fill: "#f7c948",
        font: "900 16px monospace",
        textAlign: "center",
      }}
    >
      {"RETAINED\nCONTACTS"}
    </Text>,
    <Text
      style={{
        left: 543,
        top: 220,
        fill: "#74d3ae",
        font: "900 48px sans-serif",
        textAlign: "center",
      }}
    >
      {String(activeContacts.get())}
    </Text>,
    <Text
      style={{
        left: 360,
        top: 316,
        fill: "#17211d",
        font: "600 12px sans-serif",
        textAlign: "center",
      }}
    >
      {
        "Touch start / move / end / cancel all expose touches, targetTouches, and changedTouches."
      }
    </Text>,
    <Text
      style={{
        left: 46,
        top: 344,
        width: 628,
        lineHeight: 17,
        fit: "ellipsis",
        fill: "#1f4bd8",
        font: "600 12px monospace",
      }}
    >
      {trace.get().length
        ? trace.get().join("\n")
        : "Use a touch-capable device; touchcancel is registered for interrupted contacts."}
    </Text>,
  ];
}
export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(canvas, <TouchEventsStudy />);
}
