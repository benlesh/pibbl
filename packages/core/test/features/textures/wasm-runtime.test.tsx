import { afterEach, expect, it, vi } from "vitest";
import { crc } from "@crc/core";
import { ProceduralTexture, ReactionDiffusion } from "@crc/core/textures";
import { clearSharedState } from "../../core/src/lib/global-state.js";
import {
  ManualSchedulerDriver,
  installSchedulerDriverForTest,
} from "../../core/src/lib/scheduler/testing.js";

afterEach(() => {
  clearSharedState();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});
for (const kind of ["marble", "paper", "cellular", "ink"] as const) {
  it(`${kind} uploads pixels directly from its WASM memory`, () => {
    const NativeMemory = WebAssembly.Memory;
    const memory = vi
      .spyOn(WebAssembly, "Memory")
      .mockImplementation(function (descriptor) {
        return new NativeMemory(descriptor);
      });
    const upload = vi.spyOn(
      OffscreenCanvasRenderingContext2D.prototype,
      "putImageData",
    );
    const driver = new ManualSchedulerDriver();
    const restore = installSchedulerDriverForTest(driver);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 32;
    document.body.append(canvas);
    const controller = crc(
      canvas,
      kind === "ink" ? (
        <ReactionDiffusion
          paused
          resolution={{ width: 32, height: 32 }}
          style={{ width: 32, height: 32 }}
        />
      ) : (
        <ProceduralTexture
          kind={kind}
          resolution={{ width: 32, height: 32 }}
          style={{ width: 32, height: 32 }}
        />
      ),
    );
    try {
      driver.flush(0);
      expect(memory).toHaveBeenCalledTimes(1);
      const owned = memory.mock.results[0].value as WebAssembly.Memory;
      expect(upload.mock.calls[0][0].data.buffer).toBe(owned.buffer);
      expect(
        new Set(canvas.getContext("2d")!.getImageData(0, 0, 32, 32).data).size,
      ).toBeGreaterThan(2);
      expect(driver.pendingHostFrames).toBe(0);
    } finally {
      controller.dispose();
      if (driver.pendingHostFrames) driver.flush(16);
      restore();
    }
  });
}
