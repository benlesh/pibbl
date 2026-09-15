import { crc, type CRCController, type CRCNode } from '@crc/core';
import {
  AmbientLight,
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
} from '@crc/webgl';
import { afterEach, describe, expect, it } from 'vitest';

const controllers = new Set<CRCController>();

const CAMERA: CRCWebGLPerspectiveCamera = Object.freeze({
  type: 'perspective',
  position: [0, 0, 5],
  lookAt: [0, 0, 0],
  up: [0, 1, 0],
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

describe('public WebGL lighting rendering', () => {
  it('preserves the exact unlit fast path while lit no-light and emission stay defined', async () => {
    expect(await renderPixel(mesh(FRONT_TRIANGLE))).toEqual([0, 0, 0, 255]);
    expect(await renderPixel(mesh(FRONT_TRIANGLE, {
      color: 'rgb(128 64 32 / 50%)',
      lit: false,
    }))).toEqual([128, 64, 32, 128]);
    expect(await renderPixel(mesh(FRONT_TRIANGLE, {
      color: '#000000',
      lit: false,
      material: {
        type: 'lambert',
        emissiveColor: '#808080',
      },
    }))).toEqual([128, 128, 128, 255]);
    expect(await renderPixel(mesh(FRONT_TRIANGLE, {
      color: '#000000',
      material: {
        type: 'lambert',
        emissiveColor: 'rgb(255 255 255 / 50%)',
      },
    }))).toEqual([188, 188, 188, 255]);
  });

  it('renders ambient alpha and hemisphere midpoint and poles in linear light', async () => {
    expect(await renderPixel((
      <>
        <AmbientLight style={{ color: 'rgb(255 0 0 / 50%)' }} />
        {mesh(FRONT_TRIANGLE)}
      </>
    ))).toEqual([188, 0, 0, 255]);

    const hemisphere = (geometry: typeof FRONT_TRIANGLE) => renderPixel((
      <>
        <HemisphereLight
          style={{ skyColor: '#ff0000', groundColor: '#0000ff' }}
        />
        {mesh(geometry)}
      </>
    ));
    expect(await hemisphere(UP_TRIANGLE)).toEqual([255, 0, 0, 255]);
    expect(await hemisphere(DOWN_TRIANGLE)).toEqual([0, 0, 255, 255]);
    expect(await hemisphere(SIDE_TRIANGLE)).toEqual([188, 0, 188, 255]);
  });

  it('uses transformed directional orientation', async () => {
    expect(await renderPixel((
      <>
        <DirectionalLight />
        {mesh(FRONT_TRIANGLE, { color: '#808080' })}
      </>
    ))).toEqual([128, 128, 128, 255]);
    expect(await renderPixel((
      <>
        <DirectionalLight style={{ rotationYDegrees: 180 }} />
        {mesh(FRONT_TRIANGLE)}
      </>
    ))).toEqual([0, 0, 0, 255]);
  });

  it('applies point inverse square, the distance floor, and finite range', async () => {
    expect(await renderPixel((
      <>
        <PointLight style={{ translateZ: 2 }} />
        {mesh(FRONT_TRIANGLE)}
      </>
    ))).toEqual([137, 137, 137, 255]);
    expect(await renderPixel((
      <>
        <PointLight style={{ translateZ: 0.005, intensity: 0.0001 }} />
        {mesh(FRONT_TRIANGLE)}
      </>
    ))).toEqual([255, 255, 255, 255]);
    expect(await renderPixel((
      <>
        <PointLight style={{ translateZ: 2, intensity: 4, range: 2 }} />
        {mesh(FRONT_TRIANGLE)}
      </>
    ))).toEqual([0, 0, 0, 255]);
  });

  it('renders smooth and equal-angle spot cones', async () => {
    const inner = 20;
    const outer = 40;
    const midpointCosine = (
      Math.cos(inner * Math.PI / 180) +
      Math.cos(outer * Math.PI / 180)
    ) / 2;
    const midpointAngle = Math.acos(midpointCosine);
    const midpointIntensity = 4 / midpointCosine ** 3;

    expect(await renderPixel((
      <>
        <SpotLight style={{
          translateX: 2 * Math.tan(midpointAngle),
          translateZ: 2,
          intensity: midpointIntensity,
          innerConeAngleDegrees: inner,
          outerConeAngleDegrees: outer,
        }} />
        {mesh(FRONT_TRIANGLE)}
      </>
    ))).toEqual([188, 188, 188, 255]);

    const insideAngle = 20 * Math.PI / 180;
    expect(await renderPixel((
      <>
        <SpotLight style={{
          translateX: 2 * Math.tan(insideAngle),
          translateZ: 2,
          intensity: 4 / Math.cos(insideAngle) ** 3,
          innerConeAngleDegrees: 30,
          outerConeAngleDegrees: 30,
        }} />
        {mesh(FRONT_TRIANGLE)}
      </>
    ))).toEqual([255, 255, 255, 255]);
  });

  it('uses the single clear for transparent and alpha backgrounds without rasterizing alpha-zero meshes', async () => {
    expect(await renderPixel(null)).toEqual([0, 0, 0, 0]);
    expect(await renderPixel(
      <WebGLBackground style={{ color: 'rgb(255 0 0 / 50%)' }} />,
    )).toEqual([255, 0, 0, 128]);
    expect(await renderPixel((
      <>
        <WebGLBackground style={{ color: '#ff0000' }} />
        {mesh(FRONT_TRIANGLE, { color: 'rgb(0 0 255 / 0%)' })}
      </>
    ))).toEqual([255, 0, 0, 255]);
  });
});

function mesh(
  geometry: typeof FRONT_TRIANGLE,
  style: MeshStyle = {},
): CRCNode {
  return <Mesh geometry={geometry} style={style} />;
}

function triangleWithNormal(normal: readonly [number, number, number]) {
  return createWebGLGeometry({
    positions: [-10, -10, 0, 10, -10, 0, 0, 10, 0],
    normals: [...normal, ...normal, ...normal],
  });
}

async function renderPixel(children: CRCNode): Promise<readonly number[]> {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  canvas.style.cssText = 'display:block;width:1px;height:1px';
  document.body.appendChild(canvas);
  controllers.add(crc(canvas, (
    <WebGLLayer camera={CAMERA} style={{ width: 1, height: 1 }}>
      {children}
    </WebGLLayer>
  ), {
    viewport: { width: 1, height: 1 },
    fit: 'fill',
    pixelRatio: 1,
  }));
  await nextFrame();
  return Array.from(canvas.getContext('2d')!.getImageData(0, 0, 1, 1).data);
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}
