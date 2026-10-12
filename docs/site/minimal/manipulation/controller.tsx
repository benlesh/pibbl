import {
  pibbl,
  Rectangle,
  useSignal,
  useManipulation,
  ManipulationFrame,
  DragHandle,
  ResizeHandle,
  type PibblManipulationController,
  type PibblManipulationOptions,
  type PibblManipulationFrameProps,
  type PibblManipulationMoveInput,
  type PibblManipulationResizeInput,
  type PibblManipulationRotateInput,
  type PibblManipulationWhen,
  type PibblManipulationPoint,
  type PibblResizePosition,
  type PibblManipulationGeometry,
  type PibblManipulationOperation,
  type PibblManipulationActive,
  type PibblManipulationSnapshot,
  type PibblManipulationEvent,
  type PibblManipulationCommitEvent,
  type PibblManipulationCancelEvent,
  type PibblManipulationCancelReason,
  type PibblDragHandleProps,
  type PibblResizeHandleProps,
} from "@pibbl/core";

const canvas = document.createElement("canvas");
canvas.width = 420;
canvas.height = 280;
const output = document.createElement("pre");
document.body.append(canvas, output);
let controls: PibblManipulationController | undefined;
const when: PibblManipulationWhen = "shift";
const origin: PibblManipulationPoint = { x: 0, y: 0 };
const move: PibblManipulationMoveInput = { snap: { step: 20, when, origin } };
const resize: PibblManipulationResizeInput = { minWidth: 60, minHeight: 40 };
const rotate: PibblManipulationRotateInput = { enabled: false };
function report(event: PibblManipulationEvent) {
  const geometry: PibblManipulationGeometry = event.applied;
  const operation: PibblManipulationOperation = event.operation;
  output.textContent = operation + ": " + JSON.stringify(geometry);
}
function Scene() {
  const box = useSignal({ left: 80, top: 70, width: 180, height: 100 });
  const rotation = useSignal(0);
  const options: PibblManipulationOptions = {
    box,
    rotation,
    move,
    resize,
    rotate,
    onChange: report,
    onCommit(event: PibblManipulationCommitEvent) {
      report(event);
      output.textContent += " committed=" + event.changed;
    },
    onCancel(event: PibblManipulationCancelEvent) {
      const reason: PibblManipulationCancelReason = event.reason;
      output.textContent = "Cancelled: " + reason;
    },
  };
  const manipulation = useManipulation(options);
  controls = manipulation;
  const active: PibblManipulationActive | null = manipulation.active.get();
  const snapshot: PibblManipulationSnapshot | null = manipulation.snapshot.get();
  const frame: PibblManipulationFrameProps = manipulation.frameProps;
  const drag: PibblDragHandleProps = { controller: manipulation };
  const position: PibblResizePosition = "bottom-right";
  const corner: PibblResizeHandleProps = { controller: manipulation, position };
  return (
    <ManipulationFrame {...frame}>
      <DragHandle {...drag}>
        <Rectangle
          style={{
            width: "100%",
            height: "100%",
            fill: active ? "#b83970" : "#087e8b",
            opacity: snapshot?.snapActive ? 0.7 : 1,
          }}
        />
      </DragHandle>
      <ResizeHandle {...corner} />
    </ManipulationFrame>
  );
}
const controller = pibbl(canvas, <Scene />);
const cancel = document.createElement("button");
cancel.textContent = "Cancel gesture";
cancel.onclick = () => controls?.cancel();
document.body.append(cancel);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
