import {
  crc,
  Rectangle,
  useSignal,
  useManipulation,
  ManipulationFrame,
  DragHandle,
  ResizeHandle,
  type CRCManipulationController,
  type CRCManipulationOptions,
  type CRCManipulationFrameProps,
  type CRCManipulationMoveInput,
  type CRCManipulationResizeInput,
  type CRCManipulationRotateInput,
  type CRCManipulationWhen,
  type CRCManipulationPoint,
  type CRCResizePosition,
  type CRCManipulationGeometry,
  type CRCManipulationOperation,
  type CRCManipulationActive,
  type CRCManipulationSnapshot,
  type CRCManipulationEvent,
  type CRCManipulationCommitEvent,
  type CRCManipulationCancelEvent,
  type CRCManipulationCancelReason,
  type CRCDragHandleProps,
  type CRCResizeHandleProps,
} from "@crc/core";

const canvas = document.createElement("canvas");
canvas.width = 420;
canvas.height = 280;
const output = document.createElement("pre");
document.body.append(canvas, output);
let controls: CRCManipulationController | undefined;
const when: CRCManipulationWhen = "shift";
const origin: CRCManipulationPoint = { x: 0, y: 0 };
const move: CRCManipulationMoveInput = { snap: { step: 20, when, origin } };
const resize: CRCManipulationResizeInput = { minWidth: 60, minHeight: 40 };
const rotate: CRCManipulationRotateInput = { enabled: false };
function report(event: CRCManipulationEvent) {
  const geometry: CRCManipulationGeometry = event.applied;
  const operation: CRCManipulationOperation = event.operation;
  output.textContent = operation + ": " + JSON.stringify(geometry);
}
function Scene() {
  const box = useSignal({ left: 80, top: 70, width: 180, height: 100 });
  const rotation = useSignal(0);
  const options: CRCManipulationOptions = {
    box,
    rotation,
    move,
    resize,
    rotate,
    onChange: report,
    onCommit(event: CRCManipulationCommitEvent) {
      report(event);
      output.textContent += " committed=" + event.changed;
    },
    onCancel(event: CRCManipulationCancelEvent) {
      const reason: CRCManipulationCancelReason = event.reason;
      output.textContent = "Cancelled: " + reason;
    },
  };
  const manipulation = useManipulation(options);
  controls = manipulation;
  const active: CRCManipulationActive | null = manipulation.active.get();
  const snapshot: CRCManipulationSnapshot | null = manipulation.snapshot.get();
  const frame: CRCManipulationFrameProps = manipulation.frameProps;
  const drag: CRCDragHandleProps = { controller: manipulation };
  const position: CRCResizePosition = "bottom-right";
  const corner: CRCResizeHandleProps = { controller: manipulation, position };
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
const controller = crc(canvas, <Scene />);
const cancel = document.createElement("button");
cancel.textContent = "Cancel gesture";
cancel.onclick = () => controls?.cancel();
document.body.append(cancel);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
