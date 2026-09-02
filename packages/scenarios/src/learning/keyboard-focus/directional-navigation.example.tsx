import {
  crc,
  crcEventTarget,
  crcState,
  FocusManagement,
  KeyboardNavigation,
  Rectangle,
  Text,
  type CRCController,
} from "@crc/core";
function boxPath(x: number, y: number, width: number, height: number): Path2D {
  const path = new Path2D();
  path.rect(x, y, width, height);
  return path;
}
interface SquareProps {
  readonly label: string;
  readonly record: (message: string) => void;
  readonly x: number;
  readonly y: number;
}
function DirectionalSquare({ label, record, x, y }: SquareProps) {
  const width = 74;
  const height = 54;
  const snapshot = crcEventTarget(
    {
      onClick: () => record(`${label}: click`),
      onFocus: () => record(`${label}: focused`),
    },
    {
      path: boxPath(x, y, width, height),
      fill: true,
      cursor: "pointer",
      keyboardNavigationBounds: {
        x,
        y,
        width,
        height,
      },
    },
  );
  return [
    <Rectangle
      style={{
        x,
        y,
        width,
        height,
        fill: "#2563eb",
        stroke: snapshot.isFocused ? "#111827" : "#1e3a8a",
        strokeWidth: snapshot.isFocused ? 4 : 2,
      }}
    />,
    snapshot.isFocusVisible ? (
      <Rectangle
        style={{
          x: x - 4,
          y: y - 4,
          width: width + 8,
          height: height + 8,
          stroke: "#facc15",
          strokeWidth: 3,
        }}
      />
    ) : undefined,
    <Text
      style={{
        x: x + width / 2,
        y: y + 33,
        textAlign: "center",
        fill: "#ffffff",
        font: "800 17px Arial",
      }}
    >
      {label}
    </Text>,
  ];
}
function PlainButton({ label, record, x, y }: SquareProps) {
  const snapshot = crcEventTarget(
    {
      onClick: () => record(`${label}: click`),
    },
    {
      path: boxPath(x, y, 204, 38),
      fill: true,
      cursor: "pointer",
    },
  );
  return [
    <Rectangle
      style={{
        x,
        y,
        width: 204,
        height: 38,
        fill: "#0f766e",
        stroke: snapshot.isFocused ? "#111827" : "#115e59",
        strokeWidth: snapshot.isFocused ? 4 : 2,
      }}
    />,
    <Text
      style={{
        x: x + 102,
        y: y + 25,
        textAlign: "center",
        fill: "#ffffff",
        font: "700 13px Arial",
      }}
    >
      {label}
    </Text>,
  ];
}
function DirectionalGrid({
  record,
}: {
  readonly record: (message: string) => void;
}) {
  const squares = ["1", "2", "3", "4", "5", "6"];
  return squares.map((label, index) => (
    <DirectionalSquare
      key={label}
      label={label}
      record={record}
      x={230 + (index % 3) * 92}
      y={112 + Math.floor(index / 3) * 72}
    />
  ));
}
function DirectionalNavigationLesson() {
  const [events, setEvents] = crcState<readonly string[]>([]);
  const record = (message: string) =>
    setEvents((current) => [...current.slice(-2), message]);
  return [
    <Rectangle
      style={{
        width: 720,
        height: 420,
        fill: "#eff6ff",
      }}
    />,
    <Text
      style={{
        x: 360,
        y: 30,
        textAlign: "center",
        fill: "#172554",
        font: "800 21px Arial",
      }}
    >
      {"DIRECTIONAL KEYBOARD NAVIGATION"}
    </Text>,
    <PlainButton
      label={"Above the square boundary"}
      record={record}
      x={258}
      y={50}
    />,
    <KeyboardNavigation mode={"directional"}>
      <DirectionalGrid record={record} />
    </KeyboardNavigation>,
    <PlainButton
      label={"Below the square boundary"}
      record={record}
      x={258}
      y={278}
    />,
    <Text
      style={{
        x: 360,
        y: 334,
        textAlign: "center",
        fill: "#1e3a8a",
        font: "13px Arial",
      }}
    >
      {"Arrow keys use each custom target’s declared keyboardNavigationBounds."}
    </Text>,
    <Text
      style={{
        x: 360,
        y: 356,
        textAlign: "center",
        fill: "#1e3a8a",
        font: "12px Arial",
      }}
    >
      {
        "At an edge nothing wraps; with no candidate, focus and the browser default remain unchanged."
      }
    </Text>,
    <Text
      style={{
        x: 360,
        y: 378,
        textAlign: "center",
        fill: "#172554",
        font: "11px monospace",
      }}
    >
      {
        "Tab ignores geometry: Above → 1 → 2 → 3 → 4 → 5 → 6 → Below (row-major source order)."
      }
    </Text>,
    <Text
      style={{
        x: 360,
        y: 406,
        textAlign: "center",
        fill: "#334155",
        font: "12px monospace",
      }}
    >
      {events.length
        ? events.join("  ·  ")
        : "Click or Tab into a square, then use the arrow keys."}
    </Text>,
  ];
}
export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(
    canvas,
    <FocusManagement>
      <DirectionalNavigationLesson />
    </FocusManagement>,
  );
}
