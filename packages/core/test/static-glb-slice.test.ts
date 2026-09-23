import {
  STATIC_GLB_SLICE_PROBES,
  loadScenario,
  staticGLBSliceScenarioEntry,
  type StaticGLBSliceState,
} from "@crc/scenarios";
import type { ScenarioController } from "@crc/scenarios";
import { getCRCInstance } from "../src/lib/global-state";
import { afterEach, describe, expect, it, vi } from "vitest";
import staticGLBAssetURL from "../../../playground/public/models/crc-static-glb-slice.glb?url";
import staticGLBSource from "../../scenarios/src/learning/webgl/static-glb.example.tsx?raw";
import { loadScenarioSource } from "../../../playground/src/scenario-sources";
import {
  clickLogicalPoint,
  dragPointerLogicalPoint,
  tab,
} from "./support/user-input";
import { RuntimeDiagnostics } from "./support/runtime-diagnostics";

const controllers = new Set<ScenarioController<StaticGLBSliceState>>();
const diagnostics = new Set<RuntimeDiagnostics>();

afterEach(async () => {
  for (const controller of controllers) await controller.dispose();
  controllers.clear();
  for (const observer of diagnostics) observer.restore();
  diagnostics.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

async function loadFixture(): Promise<ArrayBuffer> {
  const response = await fetch(staticGLBAssetURL);
  if (!response.ok) throw new Error("Static GLB test asset could not be read.");
  return response.arrayBuffer();
}

function installAssetServer(asset: ArrayBuffer) {
  const requests: string[] = [];
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input) => {
      const source = String(input);
      requests.push(source);
      if (source.includes("malformed")) {
        return new Response(new Uint8Array([0x67, 0x6c, 0x54, 0x46]), {
          status: 200,
        });
      }
      return new Response(asset.slice(0), { status: 200 });
    });
  return { fetch, requests };
}

function webGLSpies() {
  const probe = new OffscreenCanvas(1, 1).getContext("webgl2");
  if (!probe) throw new Error("WebGL2 is required for static GLB evidence.");
  const prototype = Object.getPrototypeOf(probe) as WebGL2RenderingContext;
  return {
    attachShader: vi.spyOn(prototype, "attachShader"),
    bindTexture: vi.spyOn(prototype, "bindTexture"),
    createFramebuffer: vi.spyOn(prototype, "createFramebuffer"),
    createProgram: vi.spyOn(prototype, "createProgram"),
    deleteBuffer: vi.spyOn(prototype, "deleteBuffer"),
    deleteFramebuffer: vi.spyOn(prototype, "deleteFramebuffer"),
    deleteProgram: vi.spyOn(prototype, "deleteProgram"),
    deleteTexture: vi.spyOn(prototype, "deleteTexture"),
    deleteVertexArray: vi.spyOn(prototype, "deleteVertexArray"),
    getUniformLocation: vi.spyOn(prototype, "getUniformLocation"),
    shaderSource: vi.spyOn(prototype, "shaderSource"),
    texImage2D: vi.spyOn(prototype, "texImage2D"),
    texStorage3D: vi.spyOn(prototype, "texStorage3D"),
    uniform1f: vi.spyOn(prototype, "uniform1f"),
    uniform1i: vi.spyOn(prototype, "uniform1i"),
    uniformMatrix4fv: vi.spyOn(prototype, "uniformMatrix4fv"),
  };
}

async function mountScenario(
  onStateChange?: (state: Readonly<StaticGLBSliceState>) => void,
) {
  const canvas = document.createElement("canvas");
  canvas.width = staticGLBSliceScenarioEntry.canvas.width;
  canvas.height = staticGLBSliceScenarioEntry.canvas.height;
  canvas.style.cssText = `display:block;width:${canvas.width}px;height:${canvas.height}px`;
  document.body.replaceChildren(canvas);
  const observer = new RuntimeDiagnostics(canvas);
  diagnostics.add(observer);
  const definition = await loadScenario(staticGLBSliceScenarioEntry);
  const controller = await definition.mount({ canvas, onStateChange });
  controllers.add(controller);
  await controller.settled();
  return { canvas, controller, observer };
}

function uniformLocations(
  spy: ReturnType<typeof webGLSpies>["getUniformLocation"],
  name: string,
): Set<WebGLUniformLocation> {
  const locations = new Set<WebGLUniformLocation>();
  spy.mock.calls.forEach(([, candidate], index) => {
    if (candidate !== name) return;
    const location = spy.mock.results[index]
      ?.value as WebGLUniformLocation | null;
    if (location) locations.add(location);
  });
  return locations;
}

function valuesForUniform(
  locationSpy: ReturnType<typeof webGLSpies>["getUniformLocation"],
  valueSpy: ReturnType<typeof webGLSpies>["uniform1f"],
  name: string,
): number[] {
  const locations = uniformLocations(locationSpy, name);
  return valueSpy.mock.calls
    .filter(([location]) => location !== null && locations.has(location))
    .map(([, value]) => value);
}

describe("public static GLB browser slice", () => {
  it("makes its learning source available to the deterministic laboratory", async () => {
    await expect(
      loadScenarioSource(staticGLBSliceScenarioEntry),
    ).resolves.toBe(staticGLBSource);
  });

  it("loads and renders hierarchy, PBR texture factors, one light, shadows, orbit, click, and model-wide focus", async () => {
    const asset = await loadFixture();
    const server = installAssetServer(asset);
    const gl = webGLSpies();
    const states: Readonly<StaticGLBSliceState>[] = [];
    const { canvas, controller, observer } = await mountScenario((state) => {
      states.push(state);
    });

    expect(states.map((state) => state.status)).toContain("loading");
    expect(controller.getState()).toMatchObject({
      source: "primary",
      status: "ready",
      modelSelections: 0,
      focusTarget: "none",
      assetBounds: {
        min: [-1.5, 0.25, -0.5],
        max: [1.5, 1.75, 0.5],
      },
    });
    expect(server.requests).toEqual(["/models/crc-static-glb-slice.glb"]);

    const pbrShaders = gl.shaderSource.mock.calls
      .map(([, source]) => source)
      .filter((source) => source.includes("u_metallic_factor"));
    expect(pbrShaders).toHaveLength(1);
    expect(
      valuesForUniform(
        gl.getUniformLocation,
        gl.uniform1f,
        "u_metallic_factor",
      ),
    ).toEqual([0.15, 0.82]);
    expect(
      valuesForUniform(
        gl.getUniformLocation,
        gl.uniform1f,
        "u_roughness_factor",
      ),
    ).toEqual([0.72, 0.28]);
    expect(
      gl.texImage2D.mock.calls.filter((call) => Array.from(call).length === 6),
    ).toHaveLength(1);
    const shadowArrays = shadowArrayTextures(gl);
    expect(shadowArrays.length).toBeGreaterThan(0);
    expect(
      shadowArrays.filter(
        (texture) => shadowTextureDeleteCount(gl, texture) === 0,
      ),
    ).toHaveLength(1);
    expect(
      shadowArrays.every(
        (texture) => shadowTextureDeleteCount(gl, texture) <= 1,
      ),
    ).toBe(true);

    const lightCounts = uniformLocations(
      gl.getUniformLocation,
      "u_light_count",
    );
    const uploadedLightCounts = gl.uniform1i.mock.calls
      .filter(([location]) => location !== null && lightCounts.has(location))
      .map(([, value]) => value);
    expect(uploadedLightCounts.length).toBeGreaterThan(0);
    expect([...new Set(uploadedLightCounts)]).toEqual([1]);

    const pbrModels = pbrModelMatrices(gl);
    expect(pbrModels).toHaveLength(2);
    expect(
      pbrModels.map((matrix) => [matrix[12], matrix[13], matrix[14]]),
    ).toEqual([
      [-1, 1, 0],
      [1, 0.75, 0],
    ]);

    await clickLogicalPoint(canvas, STATIC_GLB_SLICE_PROBES.tallPrimitive);
    expect(controller.getState()).toMatchObject({
      lastTarget: "model",
      modelSelections: 1,
    });
    await clickLogicalPoint(canvas, STATIC_GLB_SLICE_PROBES.compactPrimitive);
    expect(controller.getState()).toMatchObject({
      lastTarget: "model",
      modelSelections: 2,
    });

    const before = document.createElement("button");
    canvas.before(before);
    before.focus();
    await tab();
    expect(document.activeElement).toBe(canvas);
    expect(controller.getState().focusTarget).toBe("model");
    expect(observer.snapshot()).toMatchObject({
      focusCandidates: 1,
      focusedTargets: 1,
    });
    const focusBounds = modelFocusBounds(canvas);
    expect(focusBounds.width).toBeGreaterThan(150);
    expect(focusBounds.height).toBeGreaterThan(80);

    const initialOrbit = controller.getState().orbitPosition;
    await dragPointerLogicalPoint(
      canvas,
      STATIC_GLB_SLICE_PROBES.orbitStart,
      STATIC_GLB_SLICE_PROBES.orbitEnd,
    );
    await controller.settled();
    expect(controller.getState().orbitPosition).not.toEqual(initialOrbit);
  });

  it("replaces, errors, removes, remounts, and disposes loader and renderer resources exactly", async () => {
    const asset = await loadFixture();
    const server = installAssetServer(asset);
    const gl = webGLSpies();
    const bitmapClose = vi.spyOn(ImageBitmap.prototype, "close");
    const nativeCreateImageBitmap =
      globalThis.createImageBitmap.bind(globalThis);
    const decodedBitmaps: ImageBitmap[] = [];
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async (...args: unknown[]) => {
        const bitmap = await (
          nativeCreateImageBitmap as unknown as (
            ...input: unknown[]
          ) => Promise<ImageBitmap>
        )(...args);
        decodedBitmaps.push(bitmap);
        return bitmap;
      }),
    );
    const { controller, observer } = await mountScenario();
    const shadowArrays = shadowArrayTextures(gl);
    const liveShadowArrays = shadowArrays.filter(
      (texture) => shadowTextureDeleteCount(gl, texture) === 0,
    );
    expect(liveShadowArrays).toHaveLength(1);
    const shadowArray = liveShadowArrays[0]!;
    expect(shadowTextureDeleteCount(gl, shadowArray)).toBe(0);

    await controller.perform("show-replacement");
    expect(controller.getState()).toMatchObject({
      source: "replacement",
      status: "ready",
    });
    expect(server.requests).toEqual([
      "/models/crc-static-glb-slice.glb",
      "/models/crc-static-glb-slice.glb?replacement=1",
    ]);
    expect(decodedBitmapCloseCount(bitmapClose, decodedBitmaps)).toBe(1);

    await controller.perform("show-malformed");
    expect(controller.getState()).toMatchObject({
      source: "malformed",
      status: "error",
    });
    expect(controller.getState().errorMessage).toContain(
      'Failed to load GLB asset from "/models/crc-static-glb-malformed.glb"',
    );
    expect(observer.snapshot()).toMatchObject({ focusCandidates: 0 });
    expect(decodedBitmapCloseCount(bitmapClose, decodedBitmaps)).toBe(2);

    await controller.perform("show-primary");
    expect(controller.getState().status).toBe("ready");
    await controller.perform("remove-model");
    expect(controller.getState()).toMatchObject({
      status: "removed",
      focusTarget: "none",
      assetBounds: null,
    });
    expect(observer.snapshot()).toMatchObject({ focusCandidates: 0 });
    expect(decodedBitmapCloseCount(bitmapClose, decodedBitmaps)).toBe(3);

    await controller.perform("remount-model");
    expect(controller.getState()).toMatchObject({
      source: "primary",
      status: "ready",
    });
    expect(observer.snapshot()).toMatchObject({ focusCandidates: 1 });

    const deletesBefore = {
      buffers: gl.deleteBuffer.mock.calls.length,
      framebuffers: gl.deleteFramebuffer.mock.calls.length,
      programs: gl.deleteProgram.mock.calls.length,
      textures: gl.deleteTexture.mock.calls.length,
      vertexArrays: gl.deleteVertexArray.mock.calls.length,
    };
    await controller.dispose();
    controllers.delete(controller);
    expect(decodedBitmapCloseCount(bitmapClose, decodedBitmaps)).toBe(4);
    expect(observer.snapshot()).toMatchObject({
      eventTargets: 0,
      focusCandidates: 0,
      focusManagers: 0,
      instances: 0,
      nativeListeners: 0,
      scheduledFrames: 0,
    });
    expect({
      buffers: gl.deleteBuffer.mock.calls.length,
      framebuffers: gl.deleteFramebuffer.mock.calls.length,
      programs: gl.deleteProgram.mock.calls.length,
      textures: gl.deleteTexture.mock.calls.length,
      vertexArrays: gl.deleteVertexArray.mock.calls.length,
    }).not.toEqual(deletesBefore);
    expect(shadowTextureDeleteCount(gl, shadowArray)).toBe(1);
    await controller.dispose();
    expect(decodedBitmapCloseCount(bitmapClose, decodedBitmaps)).toBe(4);
    expect(shadowTextureDeleteCount(gl, shadowArray)).toBe(1);
    expect(
      shadowArrayTextures(gl).every(
        (texture) => shadowTextureDeleteCount(gl, texture) === 1,
      ),
    ).toBe(true);
  });
});

function probeGLConstant(name: "TEXTURE_2D_ARRAY"): number {
  const context = new OffscreenCanvas(1, 1).getContext("webgl2");
  if (!context) throw new Error("WebGL2 is required for static GLB evidence.");
  return context[name];
}

function decodedBitmapCloseCount(
  close: { readonly mock: { readonly contexts: readonly unknown[] } },
  decoded: readonly ImageBitmap[],
): number {
  const identities = new Set(decoded);
  return close.mock.contexts.filter((bitmap) =>
    identities.has(bitmap as ImageBitmap),
  ).length;
}

function shadowArrayTextures(
  gl: ReturnType<typeof webGLSpies>,
): WebGLTexture[] {
  const target = probeGLConstant("TEXTURE_2D_ARRAY");
  return gl.texStorage3D.mock.calls.flatMap(([storageTarget], storageIndex) => {
    if (storageTarget !== target) return [];
    const allocationOrder =
      gl.texStorage3D.mock.invocationCallOrder[storageIndex];
    if (allocationOrder === undefined) {
      throw new Error("The shadow array allocation order was not recorded.");
    }
    let boundTexture: WebGLTexture | null = null;
    let boundOrder = -1;
    gl.bindTexture.mock.calls.forEach(([bindTarget, texture], bindIndex) => {
      const invocationOrder = gl.bindTexture.mock.invocationCallOrder[bindIndex];
      if (
        bindTarget === target &&
        texture !== null &&
        invocationOrder !== undefined &&
        invocationOrder < allocationOrder &&
        invocationOrder > boundOrder
      ) {
        boundTexture = texture;
        boundOrder = invocationOrder;
      }
    });
    if (!boundTexture) {
      throw new Error("The shadow array allocation had no bound texture.");
    }
    return [boundTexture];
  });
}

function shadowTextureDeleteCount(
  gl: ReturnType<typeof webGLSpies>,
  texture: WebGLTexture,
): number {
  return gl.deleteTexture.mock.calls.filter(([candidate]) => candidate === texture)
    .length;
}

function pbrModelMatrices(gl: ReturnType<typeof webGLSpies>): number[][] {
  const pbrShaders = new Set(
    gl.shaderSource.mock.calls
      .filter(([, source]) => source.includes("u_metallic_factor"))
      .map(([shader]) => shader),
  );
  const pbrPrograms = new Set(
    gl.attachShader.mock.calls
      .filter(([, shader]) => pbrShaders.has(shader))
      .map(([program]) => program),
  );
  const modelLocations = new Set<WebGLUniformLocation>();
  gl.getUniformLocation.mock.calls.forEach(([program, name], index) => {
    if (name !== "u_model" || !pbrPrograms.has(program)) return;
    const location = gl.getUniformLocation.mock.results[index]
      ?.value as WebGLUniformLocation | null;
    if (location) modelLocations.add(location);
  });
  return gl.uniformMatrix4fv.mock.calls
    .filter(([location]) => location !== null && modelLocations.has(location))
    .map(([, , matrix]) => Array.from(matrix as Float32Array));
}

function modelFocusBounds(canvas: HTMLCanvasElement): Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}> {
  const instance = getCRCInstance(canvas);
  const policy = instance.eventRoot.focusPolicy as unknown as {
    candidates: readonly {
      rootBounds?: Readonly<{
        x: number;
        y: number;
        width: number;
        height: number;
      }>;
    }[];
  };
  const bounds = policy.candidates[0]?.rootBounds;
  if (!bounds) throw new Error("The Model focus union was not committed.");
  return bounds;
}
