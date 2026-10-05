import { afterEach, expect, it, vi } from 'vitest';
import { pibbl, defineTexture, Rectangle, useTexture } from '@pibbl/core';
import { displacement, reflectedLight } from '@pibbl/core/filters';
import { ManualSchedulerDriver, installSchedulerDriverForTest } from '../src/lib/scheduler/testing.js';
import { resolveFilterList } from '../src/lib/style/filter.js';

afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; });
const slopes = defineTexture({
  create: () => ({}),
  rasterize(_, { canvas }) {
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgb(128,128,128)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgb(255,128,128)'; ctx.fillRect(canvas.width / 2, 0, canvas.width / 2, canvas.height);
  },
});

it('reveals light on facing slopes while preserving scene alpha and flat pixels', () => {
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 16; document.body.append(canvas);
  function Scene() {
    const map = useTexture(slopes({}), { resolution: { width: 32, height: 16 } });
    return <Rectangle style={{ width: 32, height: 16, fill: 'rgba(20,40,60,0.5)', filter: reflectedLight({ map: map.paint({mode:'stretch'}), region: {x:0,y:0,width:32,height:16}, source:'#ffffff', opacity:0.5, direction:[1,0] }) }} />;
  }
  const controller = pibbl(canvas, <Scene />);
  try {
    driver.flush(0);
    const ctx = canvas.getContext('2d')!;
    const flat = ctx.getImageData(4,8,1,1).data, lit = ctx.getImageData(24,8,1,1).data;
    expect(flat[0]).toBeCloseTo(20,0); expect(lit[0]).toBeGreaterThan(100);
    expect(flat[3]).toBe(128); expect(lit[3]).toBe(128);
  } finally { controller.dispose(); restore(); }
});

it('fuses displacement and light into one bitmap transfer', () => {
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const transfer = vi.spyOn(OffscreenCanvas.prototype, 'transferToImageBitmap');
  const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 16; document.body.append(canvas);
  function Scene() {
    const map = useTexture(slopes({}), { resolution: { width: 32, height: 16 } }).paint({mode:'stretch'});
    const region = {x:0,y:0,width:32,height:16};
    return <Rectangle style={{ width:32,height:16,fill:'#124455',filter:[displacement({map,region,strength:2}),reflectedLight({map,region,source:'#ffffff',opacity:0.2,direction:[1,0]})] }} />;
  }
  const controller = pibbl(canvas,<Scene />);
  try { driver.flush(0); expect(transfer).toHaveBeenCalledTimes(1); }
  finally { controller.dispose(); restore(); }
});

const cyanLight = defineTexture({
  create: () => ({}),
  rasterize(_, { canvas }) {
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#00ffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  },
});

it('accepts a Pibbl texture light source and leaves the supplied image bitmap caller-owned', () => {
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 16; document.body.append(canvas);
  const imageCanvas = new OffscreenCanvas(1, 1);
  imageCanvas.getContext('2d')!.fillStyle = '#00ff00';
  imageCanvas.getContext('2d')!.fillRect(0, 0, 1, 1);
  const image = imageCanvas.transferToImageBitmap();
  const close = vi.spyOn(image, 'close');
  function TextureScene() {
    const map = useTexture(slopes({}), { resolution: { width: 32, height: 16 } });
    const light = useTexture(cyanLight({}), { resolution: { width: 8, height: 8 } });
    return <Rectangle style={{ width: 32, height: 16, fill: '#102030', filter: reflectedLight({ map: map.paint({ mode: 'stretch' }), region: { x: 0, y: 0, width: 32, height: 16 }, source: light.paint({ mode: 'stretch' }), opacity: 1, direction: [1, 0] }) }} />;
  }
  const textureController = pibbl(canvas, <TextureScene />);
  try {
    driver.flush(0);
    const lit = canvas.getContext('2d')!.getImageData(24, 8, 1, 1).data;
    expect(lit[1]).toBeGreaterThan(180);
    expect(lit[2]).toBeGreaterThan(180);
  } finally { textureController.dispose(); }
  function ImageScene() {
    const map = useTexture(slopes({}), { resolution: { width: 32, height: 16 } });
    return <Rectangle style={{ width: 32, height: 16, fill: '#102030', filter: reflectedLight({ map: map.paint({ mode: 'stretch' }), region: { x: 0, y: 0, width: 32, height: 16 }, source: image, opacity: 1, direction: [1, 0] }) }} />;
  }
  const imageController = pibbl(canvas, <ImageScene />);
  try {
    driver.flush(1);
    const lit = canvas.getContext('2d')!.getImageData(24, 8, 1, 1).data;
    expect(lit[1]).toBeGreaterThan(180);
    expect(close).not.toHaveBeenCalled();
  } finally { imageController.dispose(); restore(); }
  expect(close).not.toHaveBeenCalled();
  image.close();
});

it('reports malformed direction and region values as filter diagnostics', () => {
  const context = {
    component: 'WaterPanel', algorithm: 'render-dispatch' as const, allocation: { x: 0, y: 0, width: 32, height: 16 },
    percentageBasis: { x: 0, y: 0, width: 32, height: 16 }, constraints: { minWidth: 0, maxWidth: 32, minHeight: 0, maxHeight: 16 },
  };
  for (const [override, message] of [[{ direction: [Number.NaN, 0] }, /filter\.direction/], [{ region: { x: 0, y: 0, width: 0, height: 16 } }, /filter\.region/]] as const) {
    expect(() => resolveFilterList(reflectedLight({ map: {} as never, region: { x: 0, y: 0, width: 32, height: 16 }, ...override } as never), context)).toThrow(message);
  }
});
