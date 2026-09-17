import {
  Rectangle,
  crc,
  usePlayback,
  signal,
  track,
  tween,
  type CRCController,
  type CRCNode,
  type CRCPlayback,
} from '@crc/core';
import { getCurrentFrameTimestamp } from '@crc/core/internal';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Cube } from '../components/cube.js';
import { WebGLLayer } from '../components/webgl-layer.js';
import { useAnimationFrame } from '../../index.js';

const controllers = new Set<CRCController>();

afterEach(() => {
  for (const controller of controllers) controller.dispose();
  controllers.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('useAnimationFrame', () => {
  it('renders committed animation signal values inside a WebGL island', () => {
    installAnimationPlatform();
    const frames = installControlledFrames();
    vi.spyOn(CanvasRenderingContext2D.prototype, 'drawImage')
      .mockImplementation(() => undefined);
    const output = signal(0, { debugName: 'WebGL animation integration' });
    const renderedValues: number[] = [];
    let playback!: CRCPlayback;
    function Animated(): CRCNode {
      playback = usePlayback(track(
        output,
        tween({ from: 0, to: 10, duration: 100 }),
      ));
      renderedValues.push(output.get());
      return <Cube pointerEvents="none" style={{ lit: false }} />;
    }
    const canvas = createCanvas(20, 20);
    const controller = crc(canvas, (
      <WebGLLayer style={{ width: 20, height: 20 }}>
        <Animated />
      </WebGLLayer>
    ), { pixelRatio: 1 });
    controllers.add(controller);

    frames.runNext(-1);
    expect(renderedValues).toEqual([0]);

    playback.play();
    frames.runNext(0);
    frames.runNext(50);
    expect(renderedValues).toEqual([0, 5]);
    expect(frames.pendingIds()).toHaveLength(1);

    frames.runNext(100);
    expect(renderedValues).toEqual([0, 5, 10]);
    expect(frames.pendingIds()).toEqual([]);
  });

  it('shares one child frame across callers and stops when the final caller leaves', () => {
    installAnimationPlatform();
    const frames = installControlledFrames();
    const childTimestamps: number[] = [];
    const canvasTimestamps: number[] = [];
    const composites = vi.spyOn(
      CanvasRenderingContext2D.prototype,
      'drawImage',
    ).mockImplementation(() => undefined);
    function Animated(): CRCNode {
      childTimestamps.push(useAnimationFrame());
      return <Cube pointerEvents="none" style={{ lit: false }} />;
    }
    function CanvasSibling(): ReturnType<typeof Rectangle> {
      canvasTimestamps.push(getCurrentFrameTimestamp());
      return <Rectangle style={{ width: 1, height: 1 }} />;
    }
    const scene = (first: boolean, second: boolean) => (
      <>
        <WebGLLayer style={{ width: 40, height: 20 }}>
          {first && <Animated key="first" />}
          {second && <Animated key="second" />}
        </WebGLLayer>
        <CanvasSibling />
      </>
    );
    const canvas = createCanvas(40, 20);
    const controller = crc(canvas, scene(true, true), { pixelRatio: 1 });
    controllers.add(controller);

    frames.runNext(10);
    expect(childTimestamps).toEqual([10, 10]);
    expect(canvasTimestamps).toEqual([10]);
    expect(frames.pendingIds()).toHaveLength(1);

    frames.runNext(20);
    expect(childTimestamps).toEqual([10, 10, 20, 20]);
    expect(canvasTimestamps).toEqual([10, 20]);
    expect(frames.pendingIds()).toHaveLength(1);
    expect(composites).toHaveBeenCalledTimes(2);

    crc(canvas, scene(false, true));
    frames.runNewest(30);
    expect(childTimestamps).toEqual([10, 10, 20, 20, 30, 30, 30]);
    expect(canvasTimestamps).toEqual([10, 20, 30]);
    expect(frames.pendingIds()).toHaveLength(1);

    crc(canvas, scene(false, false));
    frames.runNewest(40);
    expect(childTimestamps).toEqual([10, 10, 20, 20, 30, 30, 30, 40]);
    expect(canvasTimestamps).toEqual([10, 20, 30, 40]);
    expect(frames.pendingIds()).toEqual([]);
  });

  it('cancels pending realm work on disposal and ignores its saved callback', () => {
    installAnimationPlatform();
    const frames = installControlledFrames();
    vi.spyOn(CanvasRenderingContext2D.prototype, 'drawImage')
      .mockImplementation(() => undefined);
    const timestamps: Array<{ key: string; timestamp: number }> = [];
    function Animated({ label }: { label: string }): CRCNode {
      timestamps.push({ key: label, timestamp: useAnimationFrame() });
      return <Cube pointerEvents="none" style={{ lit: false }} />;
    }
    const scene = (key: string) => (
      <WebGLLayer style={{ width: 20, height: 20 }}>
        <Animated key={key} label={key} />
      </WebGLLayer>
    );
    const canvas = createCanvas(20, 20);
    const controller = crc(canvas, scene('old'), { pixelRatio: 1 });
    controllers.add(controller);

    frames.runNext(1);
    const staleId = frames.pendingIds()[0]!;

    crc(canvas, scene('replacement'));
    frames.runNewest(2);
    const replacementId = frames.pendingIds()[0]!;
    expect(replacementId).not.toBe(staleId);
    expect(timestamps).toEqual([
      { key: 'old', timestamp: 1 },
      { key: 'old', timestamp: 2 },
      { key: 'replacement', timestamp: 2 },
    ]);

    controller.dispose();
    expect(frames.cancelledIds()).toContain(replacementId);
    expect(frames.pendingIds()).toEqual([]);
    frames.callback(replacementId)(4);
    expect(timestamps).toHaveLength(3);
  });

  it('coalesces pending parent and child work into one realm frame', () => {
    installAnimationPlatform();
    const frames = installControlledFrames();
    vi.spyOn(CanvasRenderingContext2D.prototype, 'drawImage')
      .mockImplementation(() => undefined);
    const childTimestamps: number[] = [];
    const parentLabels: string[] = [];
    function Animated(): CRCNode {
      childTimestamps.push(useAnimationFrame());
      return <Cube pointerEvents="none" style={{ lit: false }} />;
    }
    function ParentProbe({ label }: { label: string }): void {
      parentLabels.push(label);
    }
    const scene = (animated: boolean, label: string) => (
      <>
        <WebGLLayer style={{ width: 20, height: 20 }}>
          {animated ? <Animated /> : (
            <Cube pointerEvents="none" style={{ lit: false }} />
          )}
        </WebGLLayer>
        <ParentProbe label={label} />
      </>
    );
    const canvas = createCanvas(20, 20);
    const controller = crc(canvas, scene(true, 'initial'), { pixelRatio: 1 });
    controllers.add(controller);
    frames.runNext(1);
    const childFrameId = frames.pendingIds()[0]!;

    crc(canvas, scene(false, 'replacement'));
    expect(frames.pendingIds()).toEqual([childFrameId]);
    frames.run(childFrameId, 2);

    expect(childTimestamps).toEqual([1, 2]);
    expect(parentLabels).toEqual(['initial', 'replacement']);
    expect(frames.pendingIds()).toEqual([]);
  });

  it('retains a one-shot child iterable across private animation frames', () => {
    installAnimationPlatform();
    const frames = installControlledFrames();
    vi.spyOn(CanvasRenderingContext2D.prototype, 'drawImage')
      .mockImplementation(() => undefined);
    let iterations = 0;
    const timestamps: number[] = [];
    function Animated(): CRCNode {
      timestamps.push(useAnimationFrame());
      return <Cube pointerEvents="none" style={{ lit: false }} />;
    }
    const children = (function* oneShotChildren() {
      iterations += 1;
      yield <Animated />;
    })();
    const canvas = createCanvas(20, 20);
    const controller = crc(canvas, (
      <WebGLLayer style={{ width: 20, height: 20 }}>
        {children}
      </WebGLLayer>
    ), { pixelRatio: 1 });
    controllers.add(controller);

    frames.runNext(1);
    expect(iterations).toBe(1);
    expect(timestamps).toEqual([1]);

    frames.runNext(2);
    expect(iterations).toBe(1);
    expect(timestamps).toEqual([1, 2]);
    expect(frames.pendingIds()).toHaveLength(1);
  });
});

function installControlledFrames() {
  let nextId = 0;
  const callbacks = new Map<number, FrameRequestCallback>();
  const pending = new Set<number>();
  const cancelled: number[] = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
    const id = ++nextId;
    callbacks.set(id, callback);
    pending.add(id);
    return id;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => {
    cancelled.push(id);
    pending.delete(id);
  });
  const run = (id: number, timestamp: number) => {
    const callback = callbacks.get(id);
    if (!callback) throw new Error(`Unknown animation frame ${id}.`);
    pending.delete(id);
    callback(timestamp);
  };
  return {
    callback(id: number): FrameRequestCallback {
      const callback = callbacks.get(id);
      if (!callback) throw new Error(`Unknown animation frame ${id}.`);
      return callback;
    },
    cancelledIds: () => [...cancelled],
    pendingIds: () => [...pending],
    run,
    runNext(timestamp: number): void {
      const id = pending.values().next().value;
      if (id === undefined) throw new Error('No animation frame is pending.');
      run(id, timestamp);
    },
    runNewest(timestamp: number): void {
      const id = [...pending].at(-1);
      if (id === undefined) throw new Error('No animation frame is pending.');
      run(id, timestamp);
    },
  };
}

function installAnimationPlatform(): void {
  const gl = createNoopGL();
  class AnimationOffscreenCanvas {
    constructor(
      public width: number,
      public height: number,
    ) {}

    getContext(type: string): WebGL2RenderingContext | null {
      return type === 'webgl2' ? gl : null;
    }

    transferToImageBitmap(): ImageBitmap {
      return {
        width: this.width,
        height: this.height,
        close() {},
      } as ImageBitmap;
    }
  }
  vi.stubGlobal('OffscreenCanvas', AnimationOffscreenCanvas);
}

function createNoopGL(): WebGL2RenderingContext {
  let constant = 1;
  let handle = 0;
  return new Proxy({}, {
    get(target, property) {
      if (typeof property !== 'string') return undefined;
      const record = target as Record<string, unknown>;
      if (!(property in record)) {
        record[property] = /^[A-Z0-9_]+$/.test(property) ? constant++ :
          property === 'getParameter' ? () => 8 :
            property === 'getContextAttributes' ? () => ({
              alpha: true,
              depth: true,
              premultipliedAlpha: true,
              preserveDrawingBuffer: false,
            }) : property === 'getShaderParameter' ||
              property === 'getProgramParameter' ? () => true :
              property === 'getShaderInfoLog' ||
                property === 'getProgramInfoLog' ? () => '' :
                property === 'getUniformLocation' ?
                  (_program: object, name: string) => ({ name }) :
                  property === 'createShader' ||
                    property === 'createProgram' ||
                    property === 'createVertexArray' ||
                    property === 'createBuffer' ||
                    property === 'createTexture' ?
                    () => ({ kind: property, id: ++handle }) :
                    property === 'isContextLost' ? () => false :
                      () => undefined;
      }
      return record[property];
    },
  }) as WebGL2RenderingContext;
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.style.cssText = `display:block;width:${width}px;height:${height}px`;
  document.body.appendChild(canvas);
  return canvas;
}
