import {
  crc,
  Rectangle,
  useSignal,
  useManipulation,
  ManipulationFrame,
  DragHandle,
  ResizeHandles,
  RotationHandle,
  type CRCDragHandleStyle,
  type CRCResizeHandleStyle,
  type CRCResizeHandlesProps,
  type CRCRotationHandleProps,
  type CRCRotationHandleStyle,
  type CRCManipulationReadoutStyle,
  type CRCManipulationReadoutStateStyle,
  type CRCRotationConnectorStyle,
  type CRCRotationArcStyle,
} from "@crc/core";

const focused: CRCManipulationReadoutStateStyle = {
  fill: "#b83970",
  visible: true,
};
const readout: CRCManipulationReadoutStyle = {
  font: "12px sans-serif",
  fill: "#222",
  focused,
};
const dragStyle: CRCDragHandleStyle = { readout };
const resizeStyle: CRCResizeHandleStyle = { readout };
const connector: CRCRotationConnectorStyle = {
  stroke: "#087e8b",
  strokeWidth: 2,
};
const arc: CRCRotationArcStyle = { color: "#b83970", strokeWidth: 3 };
const rotationStyle: CRCRotationHandleStyle = { connector, arc, readout };
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
  const handles: CRCResizeHandlesProps = {
    controller: manipulation,
    positions: "corners",
    style: resizeStyle,
  };
  const turn: CRCRotationHandleProps = {
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
const controller = crc(canvas, <Scene />);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
