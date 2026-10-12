import {
  pibbl,
  Rectangle,
  useSignal,
  useManipulation,
  ManipulationFrame,
  DragHandle,
  ResizeHandles,
  RotationHandle,
  type PibblDragHandleStyle,
  type PibblResizeHandleStyle,
  type PibblResizeHandlesProps,
  type PibblRotationHandleProps,
  type PibblRotationHandleStyle,
  type PibblManipulationReadoutStyle,
  type PibblManipulationReadoutStateStyle,
  type PibblRotationConnectorStyle,
  type PibblRotationArcStyle,
} from "@pibbl/core";

const focused: PibblManipulationReadoutStateStyle = {
  fill: "#b83970",
  visible: true,
};
const readout: PibblManipulationReadoutStyle = {
  font: "12px sans-serif",
  fill: "#222",
  focused,
};
const dragStyle: PibblDragHandleStyle = { readout };
const resizeStyle: PibblResizeHandleStyle = { readout };
const connector: PibblRotationConnectorStyle = {
  stroke: "#087e8b",
  strokeWidth: 2,
};
const arc: PibblRotationArcStyle = { color: "#b83970", strokeWidth: 3 };
const rotationStyle: PibblRotationHandleStyle = { connector, arc, readout };
function Scene() {
  const box = useSignal({ left: 100, top: 90, width: 180, height: 100 });
  const rotation = useSignal(0);
  const manipulation = useManipulation({
    box,
    rotation,
    move: {},
    resize: {},
    rotate: {},
  });
  const handles: PibblResizeHandlesProps = {
    controller: manipulation,
    positions: "corners",
    style: resizeStyle,
  };
  const turn: PibblRotationHandleProps = {
    controller: manipulation,
    readoutUnit: "degrees",
  };
  return (
    <ManipulationFrame {...manipulation.frameProps}>
      <DragHandle controller={manipulation} style={dragStyle}>
        <Rectangle style={{ width: "100%", height: "100%", fill: "#087e8b" }} />
      </DragHandle>
      <ResizeHandles {...handles} />
      <RotationHandle {...turn} style={rotationStyle} />
    </ManipulationFrame>
  );
}
const canvas = document.createElement("canvas");
canvas.width = 420;
canvas.height = 300;
document.body.append(canvas);
const controller = pibbl(canvas, <Scene />);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
