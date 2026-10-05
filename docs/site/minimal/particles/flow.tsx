import { crc } from "@crc/core";
import {
  defineParticleEffect2D,
  Particles2D,
  useFlowField2D,
  useFlowSource2D,
  useParticleSystem,
  type CRCFlowField2D,
  type CRCFlowFieldOptions2D,
  type CRCFlowObstacleBatch2D,
  type CRCFlowObstacleSource2D,
  type CRCFlowSourceOptions2D,
} from "@crc/core/particles";

const obstacles: CRCFlowObstacleSource2D = {
  read(): CRCFlowObstacleBatch2D {
    return { revision: 1, boxes: new Float64Array(0) };
  },
};
const fieldOptions: CRCFlowFieldOptions2D = {
  bounds: { width: 320, height: 220 },
  resolution: [32, 22],
  obstacles,
};
const sourceOptions: CRCFlowSourceOptions2D = {
  position: [160, 180],
  radius: 55,
  acceleration: [0, -180],
};
const effect = defineParticleEffect2D({
  emitters: [
    {
      name: "mist",
      capacity: 180,
      emission: [{ type: "rate", particlesPerSecond: 25 }],
      shape: { type: "point", position: [160, 180] },
      initial: { lifetimeMilliseconds: 2400, size: 5, color: "#38bdf8" },
      renderer: { type: "circle" },
    },
  ],
});
const canvas = document.createElement("canvas");
canvas.width = 320;
canvas.height = 220;
document.body.append(canvas);

function App() {
  const field: CRCFlowField2D = useFlowField2D(fieldOptions);
  useFlowSource2D(field, sourceOptions);
  const mist = useParticleSystem(effect, { flow: field, autoplay: true });
  return <Particles2D system={mist} style={{ width: 320, height: 220 }} />;
}

const app = crc(canvas, <App />);
window.addEventListener("pagehide", () => app.dispose(), { once: true });
