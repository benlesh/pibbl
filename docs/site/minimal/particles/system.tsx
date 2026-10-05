import { crc } from "@crc/core";
import {
  defineParticleEffect2D,
  Particles2D,
  useParticleSystem,
  type CRCParticleBurstOverrides,
  type CRCParticleCommonProps,
  type CRCParticleExecution,
  type CRCParticleSystem,
  type CRCParticleSystemOptions,
  type CRCParticleSystemStatus,
  type Particles2DProps,
  type Particles2DStyle,
} from "@crc/core/particles";

const effect = defineParticleEffect2D({
  emitters: [
    {
      name: "spark",
      capacity: 80,
      emission: [{ type: "rate", particlesPerSecond: 12 }, { type: "manual" }],
      shape: { type: "point", position: [160, 130] },
      initial: {
        lifetimeMilliseconds: 900,
        velocity: [0, -60],
        size: 7,
        color: "#f97316",
      },
      renderer: { type: "circle" },
    },
  ],
});
const canvas = document.createElement("canvas");
canvas.width = 320;
canvas.height = 220;
document.body.append(canvas);
const output = document.createElement("p");
document.body.append(output);

function App() {
  const options: CRCParticleSystemOptions = { seed: 7, autoplay: true };
  const system: CRCParticleSystem<"spark"> = useParticleSystem(effect, options);
  const burst: CRCParticleBurstOverrides = { count: 20, position: [160, 130] };
  const status: CRCParticleSystemStatus = system.status.get();
  const execution: CRCParticleExecution = system.execution.get();
  const style: Particles2DStyle = { width: 320, height: 220 };
  const common: CRCParticleCommonProps<Record<string, never>> = {
    onEvent: (event) => {
      output.textContent = `Particle event: ${event.type}`;
    },
  };
  const props: Particles2DProps<"spark"> = { system, style, ...common };
  return (
    <Particles2D
      {...props}
      onPointerDown={() => {
        if (status === "paused") system.resume();
        else if (status === "running" && execution !== "unbound") {
          system.emit("spark", burst);
        }
      }}
    />
  );
}

const app = crc(canvas, <App />);
window.addEventListener("pagehide", () => app.dispose(), { once: true });
