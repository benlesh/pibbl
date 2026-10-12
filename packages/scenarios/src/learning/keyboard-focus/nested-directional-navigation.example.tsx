import {
  pibbl,
  useEventTarget,
  useSignal,
  FocusManagement,
  KeyboardNavigation,
  Rectangle,
  Text,
  type PibblController,
  type PibblKeyboardEvent,
} from "@pibbl/core";
function boxPath(x: number, y: number, width: number, height: number): Path2D {
  const path = new Path2D();
  path.rect(x, y, width, height);
  return path;
}
type BoundaryName = "INNER" | "OUTER";
interface NavigationTargetProps {
  readonly boundary: BoundaryName;
  readonly color: string;
  readonly height: number;
  readonly label: string;
  readonly onFocusTarget: (label: string, boundary: BoundaryName) => void;
  readonly onInput: (input: string) => void;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}
function NavigationTarget({
  boundary,
  color,
  height,
  label,
  onFocusTarget,
  onInput,
  width,
  x,
  y,
}: NavigationTargetProps) {
  const snapshot = useEventTarget(
    {
      onClick: () => onInput("pointer"),
      onFocus: () => onFocusTarget(label, boundary),
      onKeyDown: (event: PibblKeyboardEvent) => onInput(event.key),
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
      pointerEvents={"none"}
      style={{
        left: x,
        top: y,
        width,
        height,
        fill: color,
        stroke: snapshot.isFocused ? "#111827" : "#475569",
        strokeWidth: snapshot.isFocused ? 5 : 2,
      }}
    />,
    snapshot.isFocusVisible ? (
      <Rectangle
        pointerEvents={"none"}
        style={{
          left: x - 5,
          top: y - 5,
          width: width + 10,
          height: height + 10,
          stroke: "#facc15",
          strokeWidth: 4,
        }}
      />
    ) : undefined,
    <Text
      pointerEvents={"none"}
      style={{
        left: x + width / 2,
        top: y + height / 2 + 5,
        textAlign: "center",
        fill: "#ffffff",
        font: boundary === "INNER" ? "800 17px Arial" : "800 18px Arial",
      }}
    >
      {label}
    </Text>,
  ];
}
interface BoundaryProps {
  readonly onFocusTarget: (label: string, boundary: BoundaryName) => void;
  readonly onInput: (input: string) => void;
}
function InnerGrid({ onFocusTarget, onInput }: BoundaryProps) {
  return [
    <NavigationTarget
      boundary={"INNER"}
      color={"#7c3aed"}
      height={88}
      label={"Inner 1"}
      onFocusTarget={onFocusTarget}
      onInput={onInput}
      width={128}
      x={225}
      y={184}
    />,
    <NavigationTarget
      boundary={"INNER"}
      color={"#6d28d9"}
      height={88}
      label={"Inner 2"}
      onFocusTarget={onFocusTarget}
      onInput={onInput}
      width={128}
      x={367}
      y={184}
    />,
    <NavigationTarget
      boundary={"INNER"}
      color={"#6d28d9"}
      height={88}
      label={"Inner 3"}
      onFocusTarget={onFocusTarget}
      onInput={onInput}
      width={128}
      x={225}
      y={286}
    />,
    <NavigationTarget
      boundary={"INNER"}
      color={"#7c3aed"}
      height={88}
      label={"Inner 4"}
      onFocusTarget={onFocusTarget}
      onInput={onInput}
      width={128}
      x={367}
      y={286}
    />,
  ];
}
function OuterGrid({ onFocusTarget, onInput }: BoundaryProps) {
  return [
    <NavigationTarget
      boundary={"OUTER"}
      color={"#0f766e"}
      height={178}
      label={"Outer left"}
      onFocusTarget={onFocusTarget}
      onInput={onInput}
      width={156}
      x={34}
      y={142}
    />,
    <Rectangle
      pointerEvents={"none"}
      style={{
        left: 207,
        top: 82,
        width: 306,
        height: 316,
        fill: "#ede9fe",
        stroke: "#7c3aed",
        strokeWidth: 3,
      }}
    />,
    <NavigationTarget
      boundary={"OUTER"}
      color={"#4338ca"}
      height={54}
      label={"Inner grid entry"}
      onFocusTarget={onFocusTarget}
      onInput={onInput}
      width={270}
      x={225}
      y={102}
    />,
    <Text
      pointerEvents={"none"}
      style={{
        left: 360,
        top: 175,
        textAlign: "center",
        fill: "#5b21b6",
        font: "800 10px monospace",
      }}
    >
      {"TAB ENTERS · ARROWS STAY INSIDE"}
    </Text>,
    <KeyboardNavigation mode={"directional"}>
      <InnerGrid onFocusTarget={onFocusTarget} onInput={onInput} />
    </KeyboardNavigation>,
    <NavigationTarget
      boundary={"OUTER"}
      color={"#0f766e"}
      height={178}
      label={"Outer right"}
      onFocusTarget={onFocusTarget}
      onInput={onInput}
      width={156}
      x={530}
      y={142}
    />,
  ];
}
interface LessonStatus {
  readonly boundary: BoundaryName | "NONE";
  readonly focused: string;
  readonly input: string;
}
function NestedDirectionalNavigationLesson() {
  const status = useSignal<LessonStatus>({
    boundary: "NONE",
    focused: "NONE",
    input: "Click or Tab",
  });
  const onFocusTarget = (focused: string, boundary: BoundaryName) =>
    status.update((current) => ({
      ...current,
      boundary,
      focused,
    }));
  const onInput = (input: string) =>
    status.update((current) => ({
      ...current,
      input,
    }));
  return [
    <Rectangle
      pointerEvents={"none"}
      style={{
        width: 720,
        height: 520,
        fill: "#f8fafc",
      }}
    />,
    <Text
      pointerEvents={"none"}
      style={{
        left: 360,
        top: 30,
        textAlign: "center",
        fill: "#0f172a",
        font: "800 20px Arial",
      }}
    >
      {"A DIRECTIONAL GRID INSIDE A DIRECTIONAL GRID"}
    </Text>,
    <Text
      pointerEvents={"none"}
      style={{
        left: 360,
        top: 58,
        textAlign: "center",
        fill: "#334155",
        font: "13px Arial",
      }}
    >
      {
        "Arrow across the outer cards. Tab into the inner grid, then arrow to its edges."
      }
    </Text>,
    <KeyboardNavigation mode={"directional"}>
      <OuterGrid onFocusTarget={onFocusTarget} onInput={onInput} />
    </KeyboardNavigation>,
    <Rectangle
      pointerEvents={"none"}
      style={{
        left: 34,
        top: 422,
        width: 652,
        height: 72,
        fill: "#0f172a",
        stroke: "#475569",
        strokeWidth: 2,
      }}
    />,
    <Text
      pointerEvents={"none"}
      style={{
        left: 54,
        top: 451,
        fill: "#f8fafc",
        font: "800 14px monospace",
      }}
    >{`FOCUSED: ${status.get().focused.toUpperCase()}`}</Text>,
    <Text
      pointerEvents={"none"}
      style={{
        left: 54,
        top: 477,
        fill: status.get().boundary === "INNER" ? "#c4b5fd" : "#5eead4",
        font: "800 13px monospace",
      }}
    >{`ACTIVE BOUNDARY: ${status.get().boundary}`}</Text>,
    <Text
      pointerEvents={"none"}
      style={{
        left: 666,
        top: 477,
        textAlign: "right",
        fill: "#facc15",
        font: "800 13px monospace",
      }}
    >{`LAST INPUT: ${status.get().input}`}</Text>,
  ];
}
export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(
    canvas,
    <FocusManagement>
      <NestedDirectionalNavigationLesson />
    </FocusManagement>,
  );
}
