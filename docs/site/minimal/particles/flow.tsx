import { pibbl } from "@pibbl/core";
import {
  defineParticleEffect2D,
  Particles2D,
  useFlowField2D,
  useFlowSource2D,
  useParticleSystem,
  type PibblFlowField2D,
  type PibblFlowFieldOptions2D,
  type PibblFlowObstacleBatch2D,
  type PibblFlowObstacleSource2D,
  type PibblFlowSourceOptions2D,
} from "@pibbl/core/particles";

const obstacles: PibblFlowObstacleSource2D = {
  read(): PibblFlowObstacleBatch2D {
    return { revision: 1, boxes: new Float64Array(0) };
  },
};
const fieldOptions: PibblFlowFieldOptions2D = {
  bounds: { width: 320, height: 220 },
  resolution: [32, 22],
  obstacles,
};
const sourceOptions: PibblFlowSourceOptions2D = {
  position: [160, 180],
  radius: 55,
  acceleration: [0, -35],
};
const effect = defineParticleEffect2D({
  emitters: [
    {
      name: "mist",
      capacity: 180,
      emission: [
        { type: "burst", atMilliseconds: 0, count: 40 },
        { type: "rate", particlesPerSecond: 12 },
      ],
      shape: { type: "line", from: [125, 180], to: [195, 180] },
      initial: {
        lifetimeMilliseconds: 4000,
        size: 5,
        color: "#38bdf8",
      },
      renderer: { type: "circle" },
    },
  ],
});
const canvas = document.createElement("canvas");
canvas.width = 320;
canvas.height = 220;
document.body.append(canvas);

function App() {
  const field: PibblFlowField2D = useFlowField2D(fieldOptions);
  useFlowSource2D(field, sourceOptions);
  const mist = useParticleSystem(effect, { flow: field, autoplay: true });
  return <Particles2D system={mist} style={{ width: 320, height: 220 }} />;
}

const app = pibbl(canvas, <App />);
window.addEventListener("pagehide", () => app.dispose(), { once: true });
