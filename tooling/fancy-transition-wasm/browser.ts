// @ts-nocheck -- reference modules are supplied by the experiment builder.
import {
  pibbl,
  createElement,
  Rectangle,
  embers,
  hologram,
  useVisibilityTransition,
} from "../../packages/core/src/index";
import {
  installSchedulerDriverForTest,
  ManualSchedulerDriver,
} from "../../packages/core/src/lib/scheduler/testing";
import { embers as jsEmbers } from "reference:embers";
import { hologram as jsHologram } from "reference:hologram";
const median = (values) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
globalThis.run = () => {
  const results = {};
  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = 320;
  canvas.style.width = "400px";
  canvas.style.height = "320px";
  document.body.append(canvas);
  for (const [name, oldFactory, newFactory] of [
    ["embers", jsEmbers, embers],
    ["hologram", jsHologram, hologram],
  ]) {
    const times = { js: [], wasm: [] },
      submit = { js: [], wasm: [] };
    let maxPixelError = 0,
      changedChannels = 0,
      maxGeometryError = 0,
      parityFrames = 0;
    const reference = [];
    for (let trial = 0; trial < 4; trial++)
      for (const mode of trial % 2 ? ["wasm", "js"] : ["js", "wasm"]) {
        const driver = new ManualSchedulerDriver(),
          restore = installSchedulerDriverForTest(driver);
        let handle;
        const effect = (mode === "js" ? oldFactory : newFactory)({
          region: { x: 80, y: 100, width: 240, height: 160 },
          seed: 9,
          wind: -65,
          linger: 300,
        });
        function Scene() {
          handle = useVisibilityTransition({ enter: effect, duration: 400 });
          return createElement(Rectangle, {
            style: {
              x: 80,
              y: 100,
              width: 240,
              height: 160,
              fill: "#557abc",
              transition: handle.binding,
            },
          });
        }
        const root = pibbl(canvas, createElement(Scene, {}));
        driver.flush(0);
        try {
          for (let frame = 0; frame < 95; frame++) {
            // Exit, mid-flight reversal, then complete exit and its particle tail.
            if (frame === 0 || frame === 28) void handle.hide();
            if (frame === 12) void handle.show();
            const trace = [];
            const originals = [];
            if (trial === 0)
              for (const method of [
                "lineTo",
                "translate",
                "rotate",
                "fillRect",
                "createRadialGradient",
              ]) {
                const old = OffscreenCanvasRenderingContext2D.prototype[method];
                originals.push([method, old]);
                OffscreenCanvasRenderingContext2D.prototype[method] = function (
                  ...args
                ) {
                  trace.push(...args);
                  return old.apply(this, args);
                };
              }
            const start = performance.now();
            try {
              if (driver.pendingHostFrames) driver.flush((frame + 1) * 16);
            } finally {
              for (const [m, fn] of originals)
                OffscreenCanvasRenderingContext2D.prototype[m] = fn;
            }
            const submitted = performance.now(),
              pixels = canvas
                .getContext("2d")
                .getImageData(0, 0, 400, 320).data;
            const done = performance.now();
            if (trial > 0 && frame > 2 && frame < 70) {
              times[mode].push(done - start);
              submit[mode].push(submitted - start);
            }
            if (trial === 0) {
              if (mode === "js")
                reference.push({ pixels: pixels.slice(), trace });
              else {
                const before = reference[frame];
                if (before.trace.length !== trace.length)
                  throw Error(`${name} command mismatch frame ${frame}`);
                for (let i = 0; i < trace.length; i++)
                  maxGeometryError = Math.max(
                    maxGeometryError,
                    Math.abs(trace[i] - before.trace[i]),
                  );
                for (let i = 0; i < pixels.length; i++) {
                  const difference = Math.abs(pixels[i] - before.pixels[i]);
                  maxPixelError = Math.max(maxPixelError, difference);
                  if (difference) changedChannels++;
                }
                parityFrames++;
              }
            }
          }
        } finally {
          root.dispose();
          if (driver.pendingHostFrames) driver.flush(2000);
          restore();
        }
      }
    if (maxGeometryError > 1e-5 || maxPixelError > 2)
      throw Error(
        `${name} parity failed: geometry ${maxGeometryError}, pixels ${maxPixelError}`,
      );
    results[name] = {
      parityFrames,
      maxGeometryError,
      maxPixelError,
      changedChannels,
      submissionMedianMs: { js: median(submit.js), wasm: median(submit.wasm) },
      synchronizedMedianMs: { js: median(times.js), wasm: median(times.wasm) },
    };
  }
  return results;
};
