import { crc, type CRCController, type CRCNode } from "@crc/core";
import {
  AmbientLight,
  Cube,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  PointLight,
  SpotLight,
  WebGLBackground,
  WebGLLayer,
  createWebGLGeometry,
  type CRCWebGLPerspectiveCamera,
  type MeshStyle,
} from "@crc/webgl";
import { afterEach, describe, expect, it } from "vitest";

const controllers = new Set<CRCController>();

const CAMERA: CRCWebGLPerspectiveCamera = Object.freeze({
  type: "perspective",
  position: [0, 0, 5] as const,
  lookAt: [0, 0, 0] as const,
  up: [0, 1, 0] as const,
  fieldOfViewDegrees: 90,
  near: 0.1,
  far: 100,
});

const FRONT_TRIANGLE = triangleWithNormal([0, 0, 1]);
const UP_TRIANGLE = triangleWithNormal([0, 1, 0]);
const DOWN_TRIANGLE = triangleWithNormal([0, -1, 0]);
const SIDE_TRIANGLE = triangleWithNormal([1, 0, 0]);

afterEach(() => {
  for (const controller of controllers) controller.dispose();
  controllers.clear();
  document.body.replaceChildren();
});

describe("public WebGL lighting rendering", () => {
  it("preserves the exact unlit fast path while lit no-light and emission stay defined", async () => {
    expect(await renderPixel(mesh(FRONT_TRIANGLE))).toEqual([0, 0, 0, 255]);
    expect(
      await renderPixel(
        mesh(FRONT_TRIANGLE, {
          color: "rgb(128 64 32 / 50%)",
          lit: false,
        }),
      ),
    ).toEqual([128, 64, 32, 128]);
    expect(
      await renderPixel(
        mesh(FRONT_TRIANGLE, {
          color: "#000000",
          lit: false,
          material: {
            type: "lambert",
            emissiveColor: "#808080",
          },
        }),
      ),
    ).toEqual([128, 128, 128, 255]);
    expect(
      await renderPixel(
        mesh(FRONT_TRIANGLE, {
          color: "#000000",
          material: {
            type: "lambert",
            emissiveColor: "rgb(255 255 255 / 50%)",
          },
        }),
      ),
    ).toEqual([188, 188, 188, 255]);
  });

  it("renders ambient alpha and hemisphere midpoint and poles in linear light", async () => {
    expect(
      await renderPixel(
        <>
          <AmbientLight style={{ color: "rgb(255 0 0 / 50%)" }} />
          {mesh(FRONT_TRIANGLE)}
        </>,
      ),
    ).toEqual([188, 0, 0, 255]);

    const hemisphere = (geometry: typeof FRONT_TRIANGLE) =>
      renderPixel(
        <>
          <HemisphereLight
            style={{ skyColor: "#ff0000", groundColor: "#0000ff" }}
          />
          {mesh(geometry)}
        </>,
      );
    expect(await hemisphere(UP_TRIANGLE)).toEqual([255, 0, 0, 255]);
    expect(await hemisphere(DOWN_TRIANGLE)).toEqual([0, 0, 255, 255]);
    expect(await hemisphere(SIDE_TRIANGLE)).toEqual([188, 0, 188, 255]);
  });

  it("uses transformed directional orientation", async () => {
    expect(
      await renderPixel(
        <>
          <DirectionalLight />
          {mesh(FRONT_TRIANGLE, { color: "#808080" })}
        </>,
      ),
    ).toEqual([128, 128, 128, 255]);
    expect(
      await renderPixel(
        <>
          <DirectionalLight style={{ rotationYDegrees: 180 }} />
          {mesh(FRONT_TRIANGLE)}
        </>,
      ),
    ).toEqual([0, 0, 0, 255]);
  });

  it("darkens a real ground pixel occluded from a directional light by geometry depth", async () => {
    const ground = createWebGLGeometry({
      positions: [-4, 0, -4, 4, 0, -4, -4, 0, 4, 4, 0, -4, 4, 0, 4, -4, 0, 4],
      normals: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
    });
    const camera: CRCWebGLPerspectiveCamera = {
      type: "perspective",
      position: [4, 4, 6],
      lookAt: [0, -0.25, 0],
      up: [0, 1, 0],
      fieldOfViewDegrees: 50,
      near: 0.1,
      far: 100,
    };
    const render = (castShadow: boolean) =>
      renderImage(
        <>
          <WebGLBackground style={{ color: "#101827" }} />
          <AmbientLight style={{ intensity: 0.12 }} />
          <DirectionalLight
            style={{
              intensity: 1.1,
              rotationXDegrees: -45,
              castShadow,
            }}
          />
          <Cube style={{ color: "#ef4444", translateY: 0 }} />
          <Mesh
            geometry={ground}
            style={{
              color: "#d1d5db",
              translateY: -1,
              receiveShadow: true,
            }}
          />
        </>,
        64,
        64,
        camera,
      );

    const shadowed = await render(true);
    const unshadowed = await render(false);
    const occludedPixel = findDarkenedGroundPixel(shadowed, unshadowed, 40);
    expect(occludedPixel).toBeDefined();
    expect(occludedPixel!.shadowed[3]).toBe(255);
    expect(occludedPixel!.unshadowed[3]).toBe(255);
    const unshadowedSpread =
      Math.max(...occludedPixel!.unshadowed.slice(0, 3)) -
      Math.min(...occludedPixel!.unshadowed.slice(0, 3));
    expect(unshadowedSpread).toBeLessThanOrEqual(10);
  });

  it("does not let an occluder-only darkening satisfy ground-shadow evidence", () => {
    const shadowed = Uint8ClampedArray.from([
      120, 20, 20, 255, 160, 160, 160, 255,
    ]);
    const unshadowed = Uint8ClampedArray.from([
      200, 80, 80, 255, 160, 160, 160, 255,
    ]);

    expect(findDarkenedGroundPixel(shadowed, unshadowed, 40)).toBeUndefined();
  });

  it("applies point inverse square, the distance floor, and finite range", async () => {
    expect(
      await renderPixel(
        <>
          <PointLight style={{ translateZ: 2 }} />
          {mesh(FRONT_TRIANGLE)}
        </>,
      ),
    ).toEqual([137, 137, 137, 255]);
    expect(
      await renderPixel(
        <>
          <PointLight style={{ translateZ: 0.005, intensity: 0.0001 }} />
          {mesh(FRONT_TRIANGLE)}
        </>,
      ),
    ).toEqual([255, 255, 255, 255]);
    expect(
      await renderPixel(
        <>
          <PointLight style={{ translateZ: 2, intensity: 4, range: 2 }} />
          {mesh(FRONT_TRIANGLE)}
        </>,
      ),
    ).toEqual([0, 0, 0, 255]);
  });

  it("darkens a real ground pixel occluded from a point light in any cube direction", async () => {
    const ground = createWebGLGeometry({
      positions: [-4, 0, -4, 4, 0, -4, -4, 0, 4, 4, 0, -4, 4, 0, 4, -4, 0, 4],
      normals: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
    });
    const camera: CRCWebGLPerspectiveCamera = {
      type: "perspective",
      position: [4, 4, 6],
      lookAt: [0, -0.25, 0],
      up: [0, 1, 0],
      fieldOfViewDegrees: 50,
      near: 0.1,
      far: 100,
    };
    const render = (castShadow: boolean) =>
      renderImage(
        <>
          <WebGLBackground style={{ color: "#101827" }} />
          <AmbientLight style={{ intensity: 0.08 }} />
          <PointLight
            style={{
              intensity: 70,
              range: 12,
              translateX: 2,
              translateY: 4,
              translateZ: 2,
              castShadow,
            }}
          />
          <Cube style={{ color: "#ef4444", translateY: 0 }} />
          <Mesh
            geometry={ground}
            style={{
              color: "#d1d5db",
              translateY: -1,
              receiveShadow: true,
            }}
          />
        </>,
        64,
        64,
        camera,
      );

    const shadowed = await render(true);
    const unshadowed = await render(false);
    const occludedPixel = findDarkenedGroundPixel(shadowed, unshadowed, 30);
    expect(occludedPixel).toBeDefined();
    expect(occludedPixel!.shadowed[3]).toBe(255);
    expect(occludedPixel!.unshadowed[3]).toBe(255);
  });

  it("renders smooth and equal-angle spot cones", async () => {
    const inner = 20;
    const outer = 40;
    const midpointCosine =
      (Math.cos((inner * Math.PI) / 180) + Math.cos((outer * Math.PI) / 180)) /
      2;
    const midpointAngle = Math.acos(midpointCosine);
    const midpointIntensity = 4 / midpointCosine ** 3;

    expect(
      await renderPixel(
        <>
          <SpotLight
            style={{
              translateX: 2 * Math.tan(midpointAngle),
              translateZ: 2,
              intensity: midpointIntensity,
              innerConeAngleDegrees: inner,
              outerConeAngleDegrees: outer,
            }}
          />
          {mesh(FRONT_TRIANGLE)}
        </>,
      ),
    ).toEqual([188, 188, 188, 255]);

    const insideAngle = (20 * Math.PI) / 180;
    expect(
      await renderPixel(
        <>
          <SpotLight
            style={{
              translateX: 2 * Math.tan(insideAngle),
              translateZ: 2,
              intensity: 4 / Math.cos(insideAngle) ** 3,
              innerConeAngleDegrees: 30,
              outerConeAngleDegrees: 30,
            }}
          />
          {mesh(FRONT_TRIANGLE)}
        </>,
      ),
    ).toEqual([255, 255, 255, 255]);
  });

  it("darkens ground occluded inside a spot cone without attenuating another light outside it", async () => {
    const ground = createWebGLGeometry({
      positions: [-4, 0, -4, 4, 0, -4, -4, 0, 4, 4, 0, -4, 4, 0, 4, -4, 0, 4],
      normals: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
    });
    const camera: CRCWebGLPerspectiveCamera = {
      type: "perspective",
      position: [4, 4, 6],
      lookAt: [0, -0.25, 0],
      up: [0, 1, 0],
      fieldOfViewDegrees: 50,
      near: 0.1,
      far: 100,
    };
    const render = (castShadow: boolean) =>
      renderImage(
        <>
          <WebGLBackground style={{ color: "#101827" }} />
          <AmbientLight style={{ intensity: 0.08 }} />
          <SpotLight
            style={{
              intensity: 80,
              range: 12,
              translateX: 2,
              translateY: 4,
              translateZ: 2,
              rotationXDegrees: -54.7356,
              rotationYDegrees: 45,
              innerConeAngleDegrees: 22,
              outerConeAngleDegrees: 35,
              castShadow,
            }}
          />
          <Cube style={{ color: "#ef4444", translateY: 0.5 }} />
          <Mesh
            geometry={ground}
            style={{
              color: "#d1d5db",
              translateY: -1,
              receiveShadow: true,
            }}
          />
        </>,
        64,
        64,
        camera,
      );

    const shadowed = await render(true);
    const unshadowed = await render(false);
    expect(findDarkenedGroundPixel(shadowed, unshadowed, 30)).toBeDefined();

    expect(
      await renderPixel(
        <>
          <DirectionalLight />
          <SpotLight
            style={{
              translateX: 4,
              translateZ: 2,
              innerConeAngleDegrees: 5,
              outerConeAngleDegrees: 10,
              castShadow: true,
            }}
          />
          {mesh(FRONT_TRIANGLE)}
        </>,
      ),
    ).toEqual([255, 255, 255, 255]);
  });

  it("uses the single clear for transparent and alpha backgrounds without rasterizing alpha-zero meshes", async () => {
    expect(await renderPixel(null)).toEqual([0, 0, 0, 0]);
    expect(
      await renderPixel(
        <WebGLBackground style={{ color: "rgb(255 0 0 / 50%)" }} />,
      ),
    ).toEqual([255, 0, 0, 128]);
    expect(
      await renderPixel(
        <>
          <WebGLBackground style={{ color: "#ff0000" }} />
          {mesh(FRONT_TRIANGLE, { color: "rgb(0 0 255 / 0%)" })}
        </>,
      ),
    ).toEqual([255, 0, 0, 255]);
  });
});

function mesh(geometry: typeof FRONT_TRIANGLE, style: MeshStyle = {}): CRCNode {
  return <Mesh geometry={geometry} style={style} />;
}

function triangleWithNormal(normal: readonly [number, number, number]) {
  return createWebGLGeometry({
    positions: [-10, -10, 0, 10, -10, 0, 0, 10, 0],
    normals: [...normal, ...normal, ...normal],
  });
}

async function renderPixel(children: CRCNode): Promise<readonly number[]> {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  canvas.style.cssText = "display:block;width:1px;height:1px";
  document.body.appendChild(canvas);
  controllers.add(
    crc(
      canvas,
      <WebGLLayer camera={CAMERA} style={{ width: 1, height: 1 }}>
        {children}
      </WebGLLayer>,
      {
        viewport: { width: 1, height: 1 },
        fit: "fill",
        pixelRatio: 1,
      },
    ),
  );
  await nextFrame();
  return Array.from(canvas.getContext("2d")!.getImageData(0, 0, 1, 1).data);
}

async function renderImage(
  children: CRCNode,
  width: number,
  height: number,
  camera: CRCWebGLPerspectiveCamera,
): Promise<Uint8ClampedArray> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.style.cssText = `display:block;width:${width}px;height:${height}px`;
  document.body.appendChild(canvas);
  controllers.add(
    crc(
      canvas,
      <WebGLLayer camera={camera} style={{ width, height, shadows: "low" }}>
        {children}
      </WebGLLayer>,
      {
        viewport: { width, height },
        fit: "fill",
        pixelRatio: 1,
      },
    ),
  );
  await nextFrame();
  return canvas.getContext("2d")!.getImageData(0, 0, width, height).data;
}

function findDarkenedGroundPixel(
  shadowed: Uint8ClampedArray,
  unshadowed: Uint8ClampedArray,
  minimumDifference: number,
): { shadowed: number[]; unshadowed: number[] } | undefined {
  for (let offset = 0; offset < shadowed.length; offset += 4) {
    const shadow = Array.from(shadowed.slice(offset, offset + 4));
    const lit = Array.from(unshadowed.slice(offset, offset + 4));
    const litSpread =
      Math.max(...lit.slice(0, 3)) - Math.min(...lit.slice(0, 3));
    if (
      shadow[3] === 255 &&
      lit[3] === 255 &&
      litSpread <= 10 &&
      lit[0]! - shadow[0]! >= minimumDifference &&
      lit[1]! - shadow[1]! >= minimumDifference &&
      lit[2]! - shadow[2]! >= minimumDifference
    )
      return { shadowed: shadow, unshadowed: lit };
  }
  return undefined;
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}
