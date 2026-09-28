import {
  crc,
  useEventTarget,
  useSignal,
  FocusManagement,
  Rectangle,
  Text,
  type CRCController,
  type CRCEventTargetSnapshot,
  type CRCKeyboardEvent,
  type CRCLogicalMouseEvent,
} from "@crc/core";
function boxPath(x: number, y: number, width: number, height: number): Path2D {
  const path = new Path2D();
  path.rect(x, y, width, height);
  return path;
}
function KeyboardActivationLesson() {
  const events = useSignal<readonly string[]>([]);
  const activation = useSignal("No activation yet");
  const record = (message: string) =>
    events.update((current) => [...current.slice(-5), message]);
  const snapshot: CRCEventTargetSnapshot = useEventTarget(
    {
      onClick: (event: CRCLogicalMouseEvent) => {
        const source = event.sourceEvent
          ? `keyboard (${event.sourceEvent.type})`
          : "native pointer click";
        activation.set(`click from ${source}; detail ${event.detail}`);
        record(`click → ${source}`);
      },
      onKeyDown: (event: CRCKeyboardEvent) => {
        record(
          `keydown key=${event.key} code=${event.code} repeat=${event.repeat} shift=${event.shiftKey}`,
        );
        if (event.key === "Escape") {
          event.preventDefault();
          record("Escape default prevented by the target");
        }
      },
      onKeyUp: (event: CRCKeyboardEvent) => {
        record(
          `keyup key=${event.key} ctrl=${event.ctrlKey} alt=${event.altKey} meta=${event.metaKey}`,
        );
      },
    },
    {
      path: boxPath(174, 94, 372, 154),
      fill: true,
      cursor: "pointer",
    },
  );
  return [
    <Rectangle
      style={{
        width: 720,
        height: 420,
        fill: "#fff7ed",
      }}
    />,
    <Text
      style={{
        x: 360,
        y: 35,
        textAlign: "center",
        fill: "#431407",
        font: "800 21px Arial",
      }}
    >
      {"KEYBOARD EVENTS & BUTTON ACTIVATION"}
    </Text>,
    <Rectangle
      style={{
        x: 174,
        y: 94,
        width: 372,
        height: 154,
        fill: "#ea580c",
        stroke: snapshot.isFocused ? "#111827" : "#9a3412",
        strokeWidth: snapshot.isFocused ? 5 : 2,
      }}
    />,
    snapshot.isFocusVisible ? (
      <Rectangle
        style={{
          x: 166,
          y: 86,
          width: 388,
          height: 170,
          stroke: "#0f172a",
          strokeWidth: 4,
        }}
      />
    ) : undefined,
    <Text
      style={{
        x: 360,
        y: 149,
        textAlign: "center",
        fill: "#fff7ed",
        font: "900 30px Arial",
      }}
    >
      {"ACTIVATE ME"}
    </Text>,
    <Text
      style={{
        x: 360,
        y: 182,
        textAlign: "center",
        fill: "#fff7ed",
        font: "14px Arial",
      }}
    >
      {"Tab here, then press Enter or Space"}
    </Text>,
    <Text
      style={{
        x: 360,
        y: 214,
        textAlign: "center",
        fill: "#ffedd5",
        font: "12px monospace",
      }}
    >
      {"Escape is logged and prevents its later default policy."}
    </Text>,
    <Text
      style={{
        x: 360,
        y: 278,
        textAlign: "center",
        fill: "#7c2d12",
        font: "700 13px monospace",
      }}
    >
      {activation.get()}
    </Text>,
    <Rectangle
      style={{
        x: 56,
        y: 300,
        width: 608,
        height: 90,
        fill: "#431407",
      }}
    />,
    ...(events.get().length ? events.get() : ["Key fields will appear here."]).map(
      (entry, index) => (
        <Text
          style={{
            x: 72,
            y: 324 + index * 13,
            fill: "#ffedd5",
            font: "11px monospace",
          }}
        >
          {entry}
        </Text>
      ),
    ),
    <Text
      style={{
        x: 360,
        y: 410,
        textAlign: "center",
        fill: "#7c2d12",
        font: "11px Arial",
      }}
    >
      {
        "Enter clicks on keydown. Space prevents scroll on keydown and clicks on matching keyup."
      }
    </Text>,
  ];
}
export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(
    canvas,
    <FocusManagement>
      <KeyboardActivationLesson />
    </FocusManagement>,
  );
}
