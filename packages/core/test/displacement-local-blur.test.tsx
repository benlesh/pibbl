import { afterEach, expect, it } from "vitest";
import { crc, defineTexture, Group, Rectangle, useTexture } from "@crc/core";
import { displacement, reflectedLight } from "@crc/core/filters";
import { clearSharedState } from "../src/lib/global-state.js";
import { ManualSchedulerDriver, installSchedulerDriverForTest } from "../src/lib/scheduler/testing.js";

afterEach(() => { clearSharedState(); document.body.innerHTML = ""; });

it.each([false, true])("uses blue as local blur coverage with zero displacement (following reflection: %s)", (reflection) => {
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const field = defineTexture({ create() { return null; }, rasterize(_, context) {
    const ctx = context.canvas.getContext("2d")!;
    ctx.fillStyle = "rgb(128 128 255)"; ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = "rgb(128 128 0)"; ctx.fillRect(64, 0, 64, 64);
  } });
  function Scene() {
    const map = useTexture(field({}), { resolution: { width: 128, height: 64 } }).paint({ mode: "stretch" });
    const region = { x: 0, y: 0, width: 128, height: 64 };
    const effect = displacement({ map, strength: 0, blurRadius: 3, region });
    return <Group style={{ filter: reflection ? [effect, reflectedLight({ map, region, opacity: 0 })] : effect }}>
      {Array.from({ length: 64 }, (_, i) => <Rectangle key={i} style={{ left: i * 2, width: 2, height: 64, fill: i % 2 ? "#ffffff" : "#000000" }} />)}
    </Group>;
  }
  const canvas = document.createElement("canvas"); canvas.width = 128; canvas.height = 64; document.body.append(canvas);
  const controller = crc(canvas, <Scene />);
  try {
    driver.flush(0);
    const pixels = canvas.getContext("2d")!.getImageData(0, 32, 128, 1).data;
    const contrast = (start: number) => Math.abs(pixels[start * 4] - pixels[(start + 2) * 4]);
    expect(contrast(80)).toBeGreaterThan(240);
    expect(contrast(20)).toBeLessThan(contrast(80) * 0.6);
  } finally { controller.dispose(); restore(); }
});
