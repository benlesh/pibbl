import mountStaticGLBGallery from "../../scenarios/src/learning/webgl/static-glb.example";
import type { CRCController } from "../src";
import { releaseInternalWebGLAsset } from "../../webgl/src/lib/assets/asset";
import { decodeGLBAsset } from "../../webgl/src/lib/gltf/decode";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clickLogicalPoint } from "./support/user-input";

const galleryAssetURLs = import.meta.glob<string>(
  "../../../playground/public/models/khronos-*.glb",
  { eager: true, import: "default", query: "?url" },
);
const controllers: CRCController[] = [];

afterEach(() => {
  for (const controller of controllers) controller.dispose();
  controllers.length = 0;
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

async function settleFrames(count = 4): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
}

async function waitForDraws(
  drawElements: ReturnType<typeof vi.spyOn>,
  previousCount: number,
): Promise<void> {
  for (let index = 0; index < 60; index += 1) {
    if (drawElements.mock.calls.length > previousCount) return;
    await settleFrames(1);
  }
  throw new Error("Selected gallery model did not reach a WebGL draw.");
}

describe("public static GLB gallery", () => {
  it("vendors four size-conscious assets that pass the real CRC decoder", async () => {
    const entries = Object.entries(galleryAssetURLs).sort(([left], [right]) =>
      left.localeCompare(right),
    );
    expect(entries.map(([path]) => path.split("/").at(-1))).toEqual([
      "khronos-avocado.glb",
      "khronos-boombox.glb",
      "khronos-scifi-helmet.glb",
      "khronos-toy-car.glb",
    ]);

    let totalBytes = 0;
    for (const [, url] of entries) {
      const response = await fetch(url);
      const bytes = await response.arrayBuffer();
      totalBytes += bytes.byteLength;
      const asset = await decodeGLBAsset(bytes, {
        decodeImage: (imageBytes, mimeType) =>
          createImageBitmap(new Blob([Uint8Array.from(imageBytes)], { type: mimeType }), {
            colorSpaceConversion: "none",
            imageOrientation: "none",
            premultiplyAlpha: "none",
          }),
      });
      expect(asset.bounds.min.every(Number.isFinite)).toBe(true);
      expect(asset.bounds.max.every(Number.isFinite)).toBe(true);
      releaseInternalWebGLAsset(asset);
    }
    expect(totalBytes).toBeLessThan(12 * 1024 * 1024);
  });

  it("loads Avocado first and switches through all four public models", async () => {
    const assetBytes = new Map<string, ArrayBuffer>();
    for (const [assetPath, url] of Object.entries(galleryAssetURLs)) {
      const response = await fetch(url);
      assetBytes.set(`/models/${assetPath.split("/").at(-1)}`, await response.arrayBuffer());
    }
    const requests: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const source = String(input);
      requests.push(source);
      const bytes = assetBytes.get(source);
      return bytes === undefined
        ? new Response(null, { status: 404 })
        : new Response(bytes.slice(0), { status: 200 });
    });
    const context = new OffscreenCanvas(1, 1).getContext("webgl2");
    if (!context) throw new Error("WebGL2 is required for gallery evidence.");
    const drawElements = vi.spyOn(
      Object.getPrototypeOf(context) as WebGL2RenderingContext,
      "drawElements",
    );

    const canvas = document.createElement("canvas");
    canvas.width = 720;
    canvas.height = 420;
    document.body.replaceChildren(canvas);
    const controller = mountStaticGLBGallery(canvas);
    controllers.push(controller);
    await waitForDraws(drawElements, 0);

    expect(requests).toEqual(["/models/khronos-avocado.glb"]);

    let previousDrawCount = drawElements.mock.calls.length;
    await clickLogicalPoint(canvas, { x: 246, y: 388 });
    await waitForDraws(drawElements, previousDrawCount);
    previousDrawCount = drawElements.mock.calls.length;
    await clickLogicalPoint(canvas, { x: 414, y: 388 });
    await waitForDraws(drawElements, previousDrawCount);
    previousDrawCount = drawElements.mock.calls.length;
    await clickLogicalPoint(canvas, { x: 594, y: 388 });
    await waitForDraws(drawElements, previousDrawCount);

    expect(requests).toEqual([
      "/models/khronos-avocado.glb",
      "/models/khronos-boombox.glb",
      "/models/khronos-toy-car.glb",
      "/models/khronos-scifi-helmet.glb",
    ]);
  });

  it("keeps the Avocado's visible surface readable", async () => {
    const avocadoURL = Object.entries(galleryAssetURLs).find(([path]) =>
      path.endsWith("/khronos-avocado.glb"),
    )?.[1];
    if (!avocadoURL) throw new Error("The Avocado gallery asset is required.");
    const avocadoBytes = await (await fetch(avocadoURL)).arrayBuffer();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(avocadoBytes.slice(0), { status: 200 }),
    );

    const context = new OffscreenCanvas(1, 1).getContext("webgl2");
    if (!context) throw new Error("WebGL2 is required for gallery evidence.");
    const drawElements = vi.spyOn(
      Object.getPrototypeOf(context) as WebGL2RenderingContext,
      "drawElements",
    );
    const canvas = document.createElement("canvas");
    canvas.width = 720;
    canvas.height = 420;
    document.body.replaceChildren(canvas);
    const controller = mountStaticGLBGallery(canvas);
    controllers.push(controller);
    await waitForDraws(drawElements, 0);
    await settleFrames(12);

    const pixels = canvas.getContext("2d")!.getImageData(0, 0, 720, 420).data;
    const surfaceLuminance: number[] = [];
    // The upper crop contains only the model and the known scene background.
    // Broad luminance thresholds protect readable fill without pinning exact pixels.
    for (let y = 80; y <= 175; y += 1) {
      for (let x = 300; x <= 420; x += 1) {
        const offset = (y * 720 + x) * 4;
        const red = pixels[offset]!;
        const green = pixels[offset + 1]!;
        const blue = pixels[offset + 2]!;
        const backgroundDistance =
          Math.abs(red - 15) + Math.abs(green - 33) + Math.abs(blue - 51);
        if (backgroundDistance > 18) {
          surfaceLuminance.push(0.2126 * red + 0.7152 * green + 0.0722 * blue);
        }
      }
    }
    surfaceLuminance.sort((left, right) => left - right);
    const average =
      surfaceLuminance.reduce((total, value) => total + value, 0) /
      surfaceLuminance.length;
    const lowerQuartile =
      surfaceLuminance[Math.floor(surfaceLuminance.length * 0.25)]!;

    expect(average).toBeGreaterThanOrEqual(85);
    expect(lowerQuartile).toBeGreaterThanOrEqual(65);
  });
});
