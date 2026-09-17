import {
  crc,
  useEventListener,
  useEventTarget,
  useState,
  FocusManagement,
  Rectangle,
  Text,
  type CRCController,
  type CRCEvent,
} from "@crc/core";
function boxPath(x: number, y: number, width: number, height: number): Path2D {
  const path = new Path2D();
  path.rect(x, y, width, height);
  return path;
}
interface FocusTargetProps {
  readonly color: string;
  readonly keyboardFocusable?: boolean;
  readonly label: string;
  readonly mode: "click" | "key" | "explicit-true" | "explicit-false";
  readonly record: (message: string) => void;
  readonly x: number;
  readonly y: number;
}
function FocusTarget({
  color,
  keyboardFocusable,
  label,
  mode,
  record,
  x,
  y,
}: FocusTargetProps) {
  const width = 142;
  const height = 104;
  const snapshot = useEventTarget(
    {
      onBlur: (event) =>
        record(
          `target blur ← ${event.relatedTarget ? "another target" : "none"}`,
        ),
      onClick: mode === "key" ? undefined : () => record(`${label}: click`),
      onFocus: (event) =>
        record(
          `target focus ← ${event.relatedTarget ? "another target" : "canvas entry"}`,
        ),
      onFocusIn: () => record("target focusin (target phase)"),
      onFocusOut: () => record("target focusout (target phase)"),
      onKeyDown:
        mode === "key"
          ? (event) => record(`Key auto: ${event.key}`)
          : undefined,
    },
    {
      path: boxPath(x, y, width, height),
      fill: true,
      keyboardFocusable,
      cursor: "pointer",
    },
  );
  return [
    <Rectangle
      style={{
        x,
        y,
        width,
        height,
        fill: color,
        stroke: snapshot.isFocused ? "#111827" : "#475569",
        strokeWidth: snapshot.isFocused ? 4 : 2,
      }}
    />,
    snapshot.isFocusVisible ? (
      <Rectangle
        style={{
          x: x - 6,
          y: y - 6,
          width: width + 12,
          height: height + 12,
          stroke: "#facc15",
          strokeWidth: 4,
        }}
      />
    ) : undefined,
    <Text
      style={{
        x: x + width / 2,
        y: y + 38,
        textAlign: "center",
        fill: "#ffffff",
        font: "700 15px Arial",
      }}
    >
      {label}
    </Text>,
    <Text
      style={{
        x: x + width / 2,
        y: y + 65,
        textAlign: "center",
        fill: "#ffffff",
        font: "11px monospace",
      }}
    >
      {snapshot.isFocusVisible
        ? "FOCUS + KEYBOARD"
        : snapshot.isFocused
          ? "POINTER FOCUS"
          : "not focused"}
    </Text>,
  ];
}
function FocusManagementLesson() {
  const [events, setEvents] = useState<readonly string[]>([]);
  const record = (message: string) =>
    setEvents((current) => [...current.slice(-4), message]);
  const recordBoundary = (name: string) => (event: CRCEvent) => {
    record(
      `boundary ${name} phase ${event.eventPhase} → ${event.relatedTarget ? "related target" : "none"}`,
    );
  };
  useEventListener({
    onFocusIn: recordBoundary("focusin bubble"),
    onFocusInCapture: recordBoundary("focusin capture"),
    onFocusOut: recordBoundary("focusout bubble"),
    onFocusOutCapture: recordBoundary("focusout capture"),
  });
  return [
    <Rectangle
      style={{
        width: 720,
        height: 420,
        fill: "#f8fafc",
      }}
    />,
    <Text
      style={{
        x: 360,
        y: 32,
        textAlign: "center",
        fill: "#0f172a",
        font: "800 22px Arial",
      }}
    >
      {"LOGICAL FOCUS MANAGEMENT"}
    </Text>,
    <Text
      style={{
        x: 360,
        y: 57,
        textAlign: "center",
        fill: "#334155",
        font: "12px Arial",
      }}
    >
      {
        "Click a card for pointer focus. Tab / Shift+Tab follows declaration order and exits at either end."
      }
    </Text>,
    <FocusTarget
      color={"#0f766e"}
      label={"Click auto"}
      mode={"click"}
      record={record}
      x={50}
      y={92}
    />,
    <FocusTarget
      color={"#2563eb"}
      label={"Key auto"}
      mode={"key"}
      record={record}
      x={210}
      y={92}
    />,
    <FocusTarget
      color={"#7c3aed"}
      label={"Explicit true"}
      mode={"explicit-true"}
      keyboardFocusable={true}
      record={record}
      x={370}
      y={92}
    />,
    <FocusTarget
      color={"#be123c"}
      label={"Explicit false"}
      mode={"explicit-false"}
      keyboardFocusable={false}
      record={record}
      x={530}
      y={92}
    />,
    <Text
      style={{
        x: 360,
        y: 228,
        textAlign: "center",
        fill: "#0f172a",
        font: "700 13px Arial",
      }}
    >
      {
        "Click and key handlers enroll automatically; explicit false remains clickable but is skipped by focus and Tab."
      }
    </Text>,
    <Rectangle
      style={{
        x: 46,
        y: 254,
        width: 628,
        height: 116,
        fill: "#111827",
        stroke: "#334155",
        strokeWidth: 2,
      }}
    />,
    <Text
      style={{
        x: 64,
        y: 278,
        fill: "#facc15",
        font: "700 12px monospace",
      }}
    >
      {"FOCUS EVENT TRACE"}
    </Text>,
    ...(events.length
      ? events
      : ["Focus moves: focusout → blur, then focusin → focus."]
    ).map((entry, index) => (
      <Text
        style={{
          x: 64,
          y: 305 + index * 18,
          fill: "#e2e8f0",
          font: "12px monospace",
        }}
      >
        {entry}
      </Text>
    )),
    <Text
      style={{
        x: 360,
        y: 399,
        textAlign: "center",
        fill: "#334155",
        font: "11px Arial",
      }}
    >
      {
        "Dark border = logically focused · yellow ring = keyboard-visible focus · Canvas stays the only native focus host."
      }
    </Text>,
  ];
}
export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(
    canvas,
    <FocusManagement>
      <FocusManagementLesson />
    </FocusManagement>,
  );
}
