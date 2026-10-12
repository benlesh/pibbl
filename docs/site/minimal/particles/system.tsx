import { pibbl } from "@pibbl/core";
import {
  defineParticleEffect2D,
  particleRange,
  Particles2D,
  useParticleSystem,
  type PibblParticleBurstOverrides,
  type PibblParticleCommonProps,
  type PibblParticleExecution,
  type PibblParticleSystem,
  type PibblParticleSystemOptions,
  type PibblParticleSystemStatus,
  type Particles2DProps,
  type Particles2DStyle,
} from "@pibbl/core/particles";

const effect = defineParticleEffect2D({
  emitters: [
    {
      name: "spark",
      capacity: 80,
      emission: [{ type: "rate", particlesPerSecond: 12 }, { type: "manual" }],
      shape: { type: "line", from: [135, 135], to: [185, 135] },
      initial: {
        lifetimeMilliseconds: 1200,
        velocity: [particleRange(-35, 35), particleRange(-95, -45)],
        size: particleRange(4, 7),
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
const burstButton = document.createElement("button");
burstButton.textContent = "Burst";
document.body.append(burstButton);
const burst: PibblParticleBurstOverrides = { count: 20, position: [160, 135] };
let activeSystem: PibblParticleSystem<"spark"> | undefined;
burstButton.addEventListener("click", () => activeSystem?.emit("spark", burst));

function App() {
  const options: PibblParticleSystemOptions = { seed: 7, autoplay: true };
  const system: PibblParticleSystem<"spark"> = useParticleSystem(effect, options);
  activeSystem = system;
  const status: PibblParticleSystemStatus = system.status.get();
  const execution: PibblParticleExecution = system.execution.get();
  const style: Particles2DStyle = { width: 320, height: 220 };
  const common: PibblParticleCommonProps<Record<string, never>> = {
    onEvent: (event) => {
      if (event.type === "burst-accepted" || event.type === "burst-rejected") {
        output.textContent = `Particle event: ${event.type}`;
      }
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

const app = pibbl(canvas, <App />);
window.addEventListener("pagehide", () => app.dispose(), { once: true });
