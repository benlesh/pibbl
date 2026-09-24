import {
  crc,
  useEventListener,
  useSignal,
  Rectangle,
  Text,
  type CRCController,
  type CRCPointerEvent,
} from "@crc/core";
type CancellationMode =
  "none" | "prevent-default" | "stop-propagation" | "stop-immediate";
interface PropagationProps {
  readonly mode: CancellationMode;
  readonly record: (line: string) => void;
}
function eventLine(
  label: string,
  event: CRCPointerEvent,
  target: string,
  currentTarget: string,
): string {
  return `${label}  phase=${event.eventPhase}  target=${target}  current=${currentTarget}  related=${event.relatedTarget ? "set" : "null"}  path=${event.composedPath().length}`;
}
function PropagationLeaf({ mode, record }: PropagationProps) {
  return (
    <Rectangle
      style={{
        x: 236,
        y: 138,
        width: 248,
        height: 136,
        fill: "#1f4bd8",
        stroke: "#0c2a80",
        strokeWidth: 3,
        cursor: "pointer",
      }}
      onPointerDownCapture={(event) => {
        record(eventLine("LEAF capture prop", event, "leaf", "leaf"));
      }}
      onPointerDown={(event) => {
        if (mode === "prevent-default") event.preventDefault();
        if (mode === "stop-propagation") event.stopPropagation();
        record(
          `${eventLine("LEAF target prop", event, "leaf", "leaf")}  default=${event.defaultPrevented}`,
        );
      }}
    />
  );
}
function PropagationAncestor(props: PropagationProps) {
  useEventListener({
    onPointerDownCapture: (event) => {
      props.record(
        eventLine("PARENT listener capture", event, "leaf", "parent"),
      );
    },
    onPointerDown: (event) => {
      props.record(
        eventLine("PARENT listener bubble", event, "leaf", "parent"),
      );
    },
  });
  return <PropagationLeaf mode={props.mode} record={props.record} />;
}
function PropagationAndCancellationStudy() {
  const mode = useSignal<CancellationMode>("none");
  const trace = useSignal<readonly string[]>([]);
  const record = (line: string) => {
    trace.update((current) => [...current.slice(-6), line]);
  };
  const chooseMode = (next: CancellationMode) => {
    mode.set(next);
    trace.set([]);
  };
  useEventListener({
    onPointerDownCapture: (event) => {
      record(eventLine("ROOT listener capture", event, "leaf", "root"));
    },
    onPointerDown: (event) => {
      if (mode.get() === "stop-immediate") event.stopImmediatePropagation();
      record(
        `${eventLine("ROOT listener bubble 1", event, "leaf", "root")}${mode.get() === "stop-immediate" ? "  STOP IMMEDIATE" : ""}`,
      );
    },
  });
  useEventListener({
    onPointerDown: (event) => {
      record(eventLine("ROOT listener bubble 2", event, "leaf", "root"));
    },
  });
  const modes: readonly [CancellationMode, string][] = [
    ["none", "NORMAL"],
    ["prevent-default", "PREVENT"],
    ["stop-propagation", "STOP"],
    ["stop-immediate", "IMMEDIATE"],
  ];
  return [
    <Rectangle
      style={{
        x: 0,
        y: 0,
        width: 720,
        height: 420,
        fill: "#17211d",
      }}
    />,
    <Text
      style={{
        x: 360,
        y: 42,
        fill: "#fffdf6",
        font: "900 22px sans-serif",
        textAlign: "center",
      }}
    >
      {"PROPAGATION / CANCELLATION"}
    </Text>,
    ...modes.map(([value], index) => (
      <Rectangle
        style={{
          x: 62 + index * 154,
          y: 66,
          width: 132,
          height: 42,
          fill: mode.get() === value ? "#f7c948" : "#314158",
          stroke: "#fffdf6",
          strokeWidth: mode.get() === value ? 3 : 1,
          cursor: "pointer",
        }}
        onClick={() => chooseMode(value)}
      />
    )),
    ...modes.map(([value, label], index) => (
      <Text
        style={{
          x: 128 + index * 154,
          y: 92,
          fill: mode.get() === value ? "#17211d" : "#fffdf6",
          font: "800 12px monospace",
          textAlign: "center",
          textBaseline: "middle",
        }}
      >
        {label}
      </Text>
    )),
    <Rectangle
      style={{
        x: 190,
        y: 122,
        width: 340,
        height: 168,
        fill: "#26354a",
        stroke: "#74d3ae",
        strokeWidth: 2,
      }}
    />,
    <PropagationAncestor mode={mode.get()} record={record} />,
    <Text
      style={{
        x: 360,
        y: 207,
        fill: "#fffdf6",
        font: "800 20px sans-serif",
        textAlign: "center",
      }}
    >
      {"LEAF — press here"}
    </Text>,
    <Text
      style={{
        x: 360,
        y: 304,
        width: 680,
        lineHeight: 13,
        wrap: true,
        fill: "#74d3ae",
        font: "600 9px monospace",
        textAlign: "center",
        textBaseline: "top",
      }}
    >
      {trace.get().length
        ? trace.get().join("\n")
        : "Choose a mode, then press the blue leaf."}
    </Text>,
    <Text
      style={{
        x: 360,
        y: 410,
        fill: "#a9b8c9",
        font: "600 11px sans-serif",
        textAlign: "center",
      }}
    >
      {
        "Capture props run on the leaf before its target prop; useEventListener supplies the ancestor route."
      }
    </Text>,
  ];
}
export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <PropagationAndCancellationStudy />);
}
