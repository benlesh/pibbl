import { afterEach, expect, it, vi } from "vitest";
import { pibbl, defineRenderLayer } from "@pibbl/core";
import { clearSharedState } from "../src/lib/global-state.js";
import { installSchedulerDriverForTest, ManualSchedulerDriver, snapshotRealmScheduler } from "../src/lib/scheduler/testing.js";

afterEach(() => {
  clearSharedState();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

it.each(["normal", "create", "render", "dispose"] as const)(
  "releases the owned render-layer surface after %s lifecycle",
  (failure) => {
    const driver = new ManualSchedulerDriver();
    const restore = installSchedulerDriverForTest(driver);
    const reportError = vi.fn();
    vi.stubGlobal("reportError", reportError);
    let surface: OffscreenCanvas | undefined;
    const disposedSizes: number[][] = [];
    const TestLayer = defineRenderLayer<{}, {}>({
      create(context) {
        surface = context.canvas;
        context.canvas.getContext("2d");
        if (failure === "create") throw new Error("create fault");
        return {};
      },
      render() {
        if (failure === "render") throw new Error("render fault");
      },
      dispose(_resources, context) {
        disposedSizes.push([context.canvas.width, context.canvas.height]);
        if (failure === "dispose") throw new Error("dispose fault");
      },
    });
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 32;
    document.body.append(canvas);
    const controller = pibbl(canvas, <TestLayer style={{ width: 20, height: 10 }} />, { pixelRatio: 1 });
    try {
      if (failure === "create") expect(() => driver.flush(0)).toThrow("create fault");
      else {
        driver.flush(0);
        if (failure === "render") expect(() => driver.flush(16)).toThrow("render fault");
      }
      controller.dispose();
      controller.dispose();
      expect(surface).toMatchObject({ width: 0, height: 0 });
      expect(disposedSizes).toEqual(failure === "create" ? [] : [[20, 10]]);
      expect(snapshotRealmScheduler()).toMatchObject({ registeredRoots: 0, advanceParticipants: 0, pendingHostFrames: 0 });
      if (failure === "dispose") expect(reportError).toHaveBeenCalledOnce();
    } finally {
      controller.dispose();
      restore();
    }
  },
);
