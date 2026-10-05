import {
  pibbl,
  useEventTarget,
  useSignal,
  FocusManagement,
  Rectangle,
  Text,
  type PibblClipboardEvent,
  type PibblCompositionEvent,
  type PibblController,
  type PibblInputEvent,
} from "@pibbl/core";
function boxPath(x: number, y: number, width: number, height: number): Path2D {
  const path = new Path2D();
  path.rect(x, y, width, height);
  return path;
}
function EditingCompositionClipboardLesson({
  canvas,
}: {
  readonly canvas: HTMLCanvasElement;
}) {
  const events = useSignal<readonly string[]>([]);
  const record = (message: string) =>
    events.update((current) => [...current.slice(-7), message]);
  const dispatchSyntheticEditingSample = () => {
    canvas.dispatchEvent(
      new InputEvent("beforeinput", {
        bubbles: true,
        cancelable: true,
        data: "Δ",
        inputType: "insertText",
      }),
    );
    canvas.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        data: "Δ",
        inputType: "insertText",
      }),
    );
    canvas.dispatchEvent(
      new Event("change", {
        bubbles: true,
      }),
    );
    canvas.dispatchEvent(
      new CompositionEvent("compositionstart", {
        bubbles: true,
        data: "あ",
      }),
    );
    canvas.dispatchEvent(
      new CompositionEvent("compositionupdate", {
        bubbles: true,
        data: "あい",
      }),
    );
    canvas.dispatchEvent(
      new CompositionEvent("compositionend", {
        bubbles: true,
        data: "愛",
      }),
    );
    canvas.dispatchEvent(
      new Event("select", {
        bubbles: true,
      }),
    );
    canvas.dispatchEvent(new Event("selectionchange"));
  };
  const snapshot = useEventTarget(
    {
      onBeforeInput: (event: PibblInputEvent) =>
        record(`beforeinput ${event.inputType}: ${event.data ?? "null"}`),
      onChange: () => record("change"),
      onCompositionEnd: (event: PibblCompositionEvent) =>
        record(`compositionend: ${event.data}`),
      onCompositionStart: (event: PibblCompositionEvent) =>
        record(`compositionstart: ${event.data}`),
      onCompositionUpdate: (event: PibblCompositionEvent) =>
        record(`compositionupdate: ${event.data}`),
      onCopy: (event: PibblClipboardEvent) =>
        record(
          `copy (${event.clipboardData ? "clipboard data available" : "no clipboard data"})`,
        ),
      onCut: (event: PibblClipboardEvent) =>
        record(
          `cut (${event.clipboardData ? "clipboard data available" : "no clipboard data"})`,
        ),
      onInput: (event: PibblInputEvent) =>
        record(`input ${event.inputType}: ${event.data ?? "null"}`),
      onPaste: (event: PibblClipboardEvent) =>
        record(
          `paste (${event.clipboardData?.getData("text/plain") || "browser data"})`,
        ),
      onSelect: () => record("select"),
      onSelectionChange: () => record("selectionchange"),
      onClick: dispatchSyntheticEditingSample,
    },
    {
      path: boxPath(88, 86, 544, 118),
      fill: true,
      cursor: "pointer",
      keyboardFocusable: true,
    },
  );
  return [
    <Rectangle
      style={{
        width: 720,
        height: 420,
        fill: "#fdf4ff",
      }}
    />,
    <Text
      style={{
        left: 360,
        top: 31,
        textAlign: "center",
        fill: "#4a044e",
        font: "800 20px Arial",
      }}
    >
      {"EDITING, COMPOSITION & CLIPBOARD TRANSPORT"}
    </Text>,
    <Rectangle
      style={{
        left: 88,
        top: 86,
        width: 544,
        height: 118,
        fill: "#a21caf",
        stroke: snapshot.isFocused ? "#111827" : "#701a75",
        strokeWidth: snapshot.isFocused ? 5 : 2,
      }}
    />,
    snapshot.isFocusVisible ? (
      <Rectangle
        style={{
          left: 80,
          top: 78,
          width: 560,
          height: 134,
          stroke: "#facc15",
          strokeWidth: 4,
        }}
      />
    ) : undefined,
    <Text
      style={{
        left: 360,
        top: 132,
        textAlign: "center",
        fill: "#ffffff",
        font: "700 15px Arial",
      }}
    >
      {"CLICK TO DISPATCH A NATIVE SYNTHETIC EDITING SEQUENCE"}
    </Text>,
    <Text
      style={{
        left: 360,
        top: 164,
        textAlign: "center",
        fill: "#fce7f3",
        font: "12px Arial",
      }}
    >
      {
        "Then press ⌘/Ctrl-C, ⌘/Ctrl-X, or ⌘/Ctrl-V while this Canvas target is focused."
      }
    </Text>,
    <Text
      style={{
        left: 360,
        top: 180,
        textAlign: "center",
        fill: "#fce7f3",
        font: "11px monospace",
      }}
    >
      {"The trace records event transport; Canvas itself does not edit text."}
    </Text>,
    <Text
      style={{
        left: 360,
        top: 193,
        textAlign: "center",
        fill: "#fce7f3",
        font: "11px monospace",
      }}
    >
      {"Use semantic DOM controls for an accessible editing experience."}
    </Text>,
    <Rectangle
      style={{
        left: 56,
        top: 234,
        width: 608,
        height: 142,
        fill: "#4a044e",
      }}
    />,
    <Text
      style={{
        left: 76,
        top: 258,
        fill: "#f5d0fe",
        font: "700 12px monospace",
      }}
    >
      {"EVENT TRACE"}
    </Text>,
    ...(events.get().length
      ? events.get()
      : [
          "beforeinput · input · change · compositionstart/update/end · select · selectionchange · copy/cut/paste",
        ]
    ).map((entry, index) => (
      <Text
        style={{
          left: 76,
          top: 278 + index * 12,
          fill: "#fdf4ff",
          font: "10px monospace",
        }}
      >
        {entry}
      </Text>
    )),
    <Text
      style={{
        left: 360,
        top: 405,
        textAlign: "center",
        fill: "#701a75",
        font: "11px Arial",
      }}
    >
      {
        "For real editing, selection, names, and assistive technology, pair Canvas state with application-owned semantic DOM controls."
      }
    </Text>,
  ];
}
export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(
    canvas,
    <FocusManagement>
      <EditingCompositionClipboardLesson canvas={canvas} />
    </FocusManagement>,
  );
}
