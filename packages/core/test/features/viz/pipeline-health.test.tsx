import { userEvent } from "vitest/browser";
import { expect, it, vi } from "vitest";
import mount from "../../../../scenarios/src/learning/composition/pipeline-health.example.js";
import { testRuntime } from "./support/runtime.js";

it("exposes missing telemetry and keyboard time inspection without animating in motion-off mode", async () => {
  const runtime = testRuntime();
  const labels: string[] = [];
  for (const prototype of [
    CanvasRenderingContext2D.prototype,
    OffscreenCanvasRenderingContext2D.prototype,
  ]) {
    const native = prototype.fillText;
    vi.spyOn(prototype, "fillText").mockImplementation(function (
      this: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
      ...args
    ) {
      labels.push(String(args[0]));
      native.apply(this, args);
    });
  }
  const before = document.createElement("button");
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "width:880px;height:620px";
  document.body.append(before, canvas);
  const app = mount(canvas);
  try {
    runtime.flush();
    expect(labels).toContain("1 stage unmeasured");
    expect(labels.some((label) => label.startsWith("≥ "))).toBe(true);
    if (labels.includes("MOTION ON"))
      await userEvent.click(canvas, { position: { x: 628, y: 567 } });
    runtime.flush();
    expect(labels).toContain("MOTION OFF");
    before.focus();
    await userEvent.tab();
    await userEvent.tab();
    labels.length = 0;
    await userEvent.keyboard("{Home}");
    runtime.flush();
    expect(labels).toContain("STAGE · p95 AT 13:00");
    labels.length = 0;
    await userEvent.keyboard("{End}");
    runtime.flush();
    expect(labels).toContain("STAGE · p95 AT 14:30");
    await userEvent.click(canvas, { position: { x: 80, y: 400 } });
    for (let i = 0; i < 5; i++) runtime.flush();
    expect(runtime.pending).toBe(0);
    expect(labels).toContain("unknown");
  } finally {
    app.dispose();
    expect(runtime.pending).toBe(0);
    runtime.dispose();
  }
});
