import { vi } from "vitest";

const timing = vi.hoisted(() => ({
  collecting: false,
  waterRaster: [] as number[],
}));

vi.mock("@crc/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@crc/core")>();
  return {
    ...actual,
    defineTexture(definition: Parameters<typeof actual.defineTexture>[0]) {
      const rasterize = definition.rasterize;
      return actual.defineTexture({
        ...definition,
        rasterize(context, frame) {
          const start = performance.now();
          try {
            return rasterize(context, frame);
          } finally {
            if (timing.collecting)
              timing.waterRaster.push(performance.now() - start);
          }
        },
      });
    },
  };
});

import {
  createElement,
  crc,
  Group,
  Rectangle,
  signal,
  useTexture,
} from "@crc/core";
import { displacement } from "@crc/core/filters";
import { filterBoundaryExecutor } from "../src/filters/filter-executor.js";
import { waterWaves } from "@crc/textures";
import {
  ManualSchedulerDriver,
  installSchedulerDriverForTest,
} from "../src/lib/scheduler/testing.js";
import { describe, expect, it } from "vitest";

const enabled = import.meta.env.VITE_CRC_DISPLACEMENT_BENCH === "1";
const now = () => performance.now();
const percentile = (samples: number[], value: number) =>
  samples[Math.min(samples.length - 1, Math.floor(samples.length * value))] ??
  0;
type Samples = Record<
  | "frameCpu"
  | "waterRaster"
  | "sourceCapture"
  | "offscreenComposition"
  | "rootComposite"
  | "gpuUpload"
  | "gpuSubmit"
  | "transfer",
  number[]
>;

function summary(
  samples: Samples,
): Record<string, { count: number; medianMs: number; p95Ms: number }> {
  return Object.fromEntries(
    Object.entries(samples).map(([name, values]) => {
      const sorted = [...values].sort((a, b) => a - b);
      return [
        name,
        {
          count: sorted.length,
          medianMs: percentile(sorted, 0.5),
          p95Ms: percentile(sorted, 0.95),
        },
      ];
    }),
  );
}

describe.skipIf(!enabled)("animated displacement cost probe", () => {
  it("records synchronous CPU submission costs at normal and high-density canvases", () => {
    const reports = [];
    for (const [size, density] of [
      [320, 1],
      [960, 2],
    ] as const) {
      const samples: Samples = {
        frameCpu: [],
        waterRaster: [],
        sourceCapture: [],
        offscreenComposition: [],
        rootComposite: [],
        gpuUpload: [],
        gpuSubmit: [],
        transfer: [],
      };
      const collect = <T,>(name: keyof Samples, fn: () => T): T => {
        const start = now();
        try {
          return fn();
        } finally {
          if (timing.collecting) samples[name].push(now() - start);
        }
      };
      const executeBoundary = filterBoundaryExecutor.render;
      const captureSpy = vi.spyOn(filterBoundaryExecutor, "render").mockImplementation(input => {
        return executeBoundary({ ...input, renderSubtree: () => collect("sourceCapture", input.renderSubtree) });
      });
      const sourceDrawImage = OffscreenCanvasRenderingContext2D.prototype
        .drawImage as (...args: any[]) => void;
      const upload = WebGL2RenderingContext.prototype.texImage2D;
      const submit = WebGL2RenderingContext.prototype.drawArrays;
      const transfer = OffscreenCanvas.prototype.transferToImageBitmap;
      OffscreenCanvasRenderingContext2D.prototype.drawImage = function (
        this: OffscreenCanvasRenderingContext2D,
        ...args: any[]
      ) {
        return collect("offscreenComposition", () =>
          sourceDrawImage.apply(this, args),
        );
      } as typeof OffscreenCanvasRenderingContext2D.prototype.drawImage;
      WebGL2RenderingContext.prototype.texImage2D = function (
        this: WebGL2RenderingContext,
        ...args: Parameters<WebGL2RenderingContext["texImage2D"]>
      ) {
        return collect("gpuUpload", () => upload.apply(this, args));
      } as typeof WebGL2RenderingContext.prototype.texImage2D;
      WebGL2RenderingContext.prototype.drawArrays = function (...args) {
        return collect("gpuSubmit", () =>
          submit.apply(this, args as Parameters<typeof submit>),
        );
      };
      OffscreenCanvas.prototype.transferToImageBitmap = function (...args) {
        return collect("transfer", () =>
          transfer.apply(this, args as Parameters<typeof transfer>),
        );
      };
      const canvas = document.createElement("canvas");
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      canvas.width = size * density;
      canvas.height = size * density;
      document.body.append(canvas);
      const driver = new ManualSchedulerDriver();
      const restoreDriver = installSchedulerDriverForTest(driver);
      const phase = signal(0);
      function Scene() {
        const map = useTexture(waterWaves({ seed: 7, speed: 1, scale: 4 }), {
          resolution: { width: 128, height: 128 },
        });
        return createElement(Group, {
          style: {
            filter: displacement({
              map,
              strength: 5,
              region: { x: 0, y: 0, width: size, height: size },
            }),
          },
          children: Array.from({ length: 64 }, (_, i) =>
            createElement(Rectangle, {
              key: i,
              style: {
                x: i === 0 ? phase : (i % 8) * (size / 8),
                y: Math.floor(i / 8) * (size / 8),
                width: size / 10,
                height: size / 10,
                fill: i % 2 ? "#1677ff" : "#f6c343",
              },
            }),
          ),
        });
      }
      const controller = crc(canvas, createElement(Scene, {}), {
        pixelRatio: density,
      });
      const rootContext = canvas.getContext("2d")!;
      const rootDrawImage = rootContext.drawImage.bind(rootContext) as (
        ...args: any[]
      ) => void;
      rootContext.drawImage = function (...args: any[]) {
        return collect("rootComposite", () => rootDrawImage(...args));
      } as typeof rootContext.drawImage;
      try {
        expect(canvas.width).toBe(size * density);
        expect(canvas.height).toBe(size * density);
        for (let index = 0; index < 36; index++) {
          timing.collecting = index >= 6;
          if (index === 6) timing.waterRaster.length = 0;
          phase.set(index % 2);
          const offsets = Object.fromEntries(Object.entries(samples).map(([name, values]) => [name, values.length]));
          const start = now();
          driver.flush(index * (1000 / 60));
          if (timing.collecting) {
            samples.frameCpu.push(now() - start);
            for (const name of ["sourceCapture", "offscreenComposition", "rootComposite", "gpuUpload", "gpuSubmit", "transfer"] as const) {
              const spans = samples[name].splice(offsets[name]);
              samples[name].push(spans.reduce((total, span) => total + span, 0));
            }
          }
        }
      } finally {
        timing.collecting = false;
        controller.dispose();
        captureSpy.mockRestore();
        restoreDriver();
        OffscreenCanvasRenderingContext2D.prototype.drawImage = sourceDrawImage;
        canvas.remove();
        rootContext.drawImage = rootDrawImage;
        WebGL2RenderingContext.prototype.texImage2D = upload;
        WebGL2RenderingContext.prototype.drawArrays = submit;
        OffscreenCanvas.prototype.transferToImageBitmap = transfer;
      }
      samples.waterRaster.push(...timing.waterRaster);
      expect(samples.frameCpu).toHaveLength(30);
      expect(samples.waterRaster.length).toBeGreaterThan(0);
      expect(samples.sourceCapture.length).toBeGreaterThan(0);
      expect(samples.rootComposite.length).toBeGreaterThan(0);
      reports.push({
        size,
        density,
        backing: { width: canvas.width, height: canvas.height },
        samples: summary(samples),
      });
    }
    console.error(
      JSON.stringify({
        probe: "crc-water-displacement-cpu-submission",
        node:
          typeof process === "undefined" ? "browser-runner" : process.version,
        userAgent: navigator.userAgent,
        hardwareConcurrency: navigator.hardwareConcurrency,
        warmupFrames: 6,
        measuredFrames: 30,
        nestedTiming: [
          "waterRaster, sourceCapture, offscreenComposition, rootComposite, gpuUpload, gpuSubmit, and transfer overlap frameCpu and must not be summed",
        ],
        gpuElapsed:
          "unavailable: WebGL timer queries are intentionally not used by this probe",
        reports,
      }),
    );
    expect(reports).toHaveLength(2);
  });
});
