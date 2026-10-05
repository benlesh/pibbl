import {
  pibbl,
  Manipulable,
  Rectangle,
  useSignal,
  degrees,
  type PibblManipulableProps,
  type PibblManipulationBox,
} from "@pibbl/core";

function Scene() {
  const box = useSignal<PibblManipulationBox>({
    left: 80,
    top: 70,
    width: 180,
    height: 100,
  });
  const rotation = useSignal(degrees(10));
  const { width, height } = box.get();
  const props: PibblManipulableProps = {
    style: box,
    rotation,
    draggable: true,
    resizable: true,
    rotatable: true,
  };
  return (
    <Manipulable {...props}>
      <Rectangle style={{ width, height, fill: "#087e8b" }} />
    </Manipulable>
  );
}
const canvas = document.createElement("canvas");
canvas.width = 420;
canvas.height = 280;
document.body.append(canvas);
const controller = pibbl(canvas, <Scene />);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
