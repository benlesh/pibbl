import {
  Absolute,
  Group,
  Rectangle,
  crc,
  crcPlayback,
  crcTransition,
  parallel,
  signal,
  track,
  tween,
  type CRCController,
  type CRCNode,
  type CRCPlayback,
  type Signal,
} from '@crc/core';
import {
  crcInternalCurrentRenderOwner,
  crcInternalRequestRendererWork,
  type CRCInternalRenderOwner,
} from '@crc/core/internal';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  installSchedulerDriverForTest,
  ManualSchedulerDriver,
} from '../src/lib/scheduler/testing.js';

let driver: ManualSchedulerDriver;
let restoreDriver: () => void;
const controllers = new Set<CRCController>();

beforeEach(() => {
  document.body.replaceChildren();
  driver = new ManualSchedulerDriver();
  restoreDriver = installSchedulerDriverForTest(driver);
});

afterEach(() => {
  for (const controller of controllers) controller.dispose();
  controllers.clear();
  restoreDriver();
  document.body.replaceChildren();
});

describe('animation rendering integration', () => {
  it('commits one component-owned playback before two roots render in mount order', () => {
    const x = signal(0);
    const y = signal(0);
    const opacity = signal(1);
    const renders: Array<{
      root: 'first' | 'second';
      x: number;
      y: number;
      opacity?: number;
    }> = [];
    let firstPlayback!: CRCPlayback;
    let secondPlayback!: CRCPlayback;

    function FirstRoot(): CRCNode {
      firstPlayback = crcPlayback(parallel(
        track(x, tween({ from: 0, to: 20, duration: 100 })),
        track(opacity, tween({ from: 1, to: 0, duration: 100 })),
      ));
      const currentX = x.get();
      const currentY = y.get();
      const currentOpacity = opacity.get();
      renders.push({
        root: 'first',
        x: currentX,
        y: currentY,
        opacity: currentOpacity,
      });
      return (
        <Group>
          <Rectangle
            style={{
              x: currentX,
              y: currentY,
              width: 10,
              height: 10,
              fill: 'red',
              opacity: currentOpacity,
            }}
          />
        </Group>
      );
    }

    function SecondRoot(): CRCNode {
      secondPlayback = crcPlayback(
        track(y, tween({ from: 0, to: 10, duration: 100 })),
      );
      const currentX = x.get();
      const currentY = y.get();
      renders.push({ root: 'second', x: currentX, y: currentY });
      return (
        <Rectangle
          style={{
            x: currentX,
            y: currentY,
            width: 10,
            height: 10,
            fill: 'blue',
          }}
        />
      );
    }

    controllers.add(crc(createCanvas(), <FirstRoot />, { pixelRatio: 1 }));
    controllers.add(crc(createCanvas(), <SecondRoot />, { pixelRatio: 1 }));
    expect(driver.pendingHostFrames).toBe(1);
    driver.flush(-1);
    renders.length = 0;
    const requestsBeforePlay = driver.requestCount;

    firstPlayback.play();
    secondPlayback.play();
    expect(driver.requestCount).toBe(requestsBeforePlay + 1);
    expect(driver.pendingHostFrames).toBe(1);
    driver.flush(0);
    renders.length = 0;

    expect(driver.pendingHostFrames).toBe(1);
    driver.flush(50);

    expect(renders).toEqual([
      { root: 'first', x: 10, y: 5, opacity: 0.5 },
      { root: 'second', x: 10, y: 5 },
    ]);
    expect(driver.pendingHostFrames).toBe(1);
  });

  it('repaints another root after a failed transition preview rolls back', () => {
    let producerOwner!: CRCInternalRenderOwner;
    let failComposition = false;
    let output!: Signal<number>;
    const observed: number[] = [];
    const workKey = {};

    function TransitionChild({ initial, target }: { initial: number; target: number }) {
      output = crcTransition(target, {
        type: 'tween',
        duration: 100,
        initial,
      });
      output.get();
    }

    function Producer({
      include,
      initial,
      target,
    }: { include: boolean; initial: number; target: number }) {
      producerOwner ??= crcInternalCurrentRenderOwner();
      return include ? <TransitionChild initial={initial} target={target} /> : undefined;
    }

    function Observer() {
      const value = output.get();
      observed.push(value);
      return (
        <Rectangle
          style={{ x: value * 10, width: 10, height: 10, fill: 'blue' }}
        />
      );
    }

    const producerCanvas = createCanvas(60, 10);
    controllers.add(crc(
      producerCanvas,
      <Producer include={false} initial={0} target={0} />,
      { pixelRatio: 1 },
    ));
    driver.flush(0);
    crcInternalRequestRendererWork(producerOwner, {
      key: workKey,
      kind: 'compose',
      run: () => {
        if (failComposition) throw new Error('transition composition failed');
      },
    });

    failComposition = true;
    crc(producerCanvas, <Producer include initial={1} target={10} />);
    expect(() => driver.flush(10)).toThrow(/transition composition failed/iu);
    expect(output.get()).toBe(1);

    const observerCanvas = createCanvas(60, 10);
    controllers.add(crc(observerCanvas, <Observer />, { pixelRatio: 1 }));
    crc(producerCanvas, <Producer include initial={3} target={20} />);
    expect(() => driver.flush(20)).toThrow(/transition composition failed/iu);

    expect(observed).toEqual([3]);
    expect(output.get()).toBe(1);
    expect(pixel(observerCanvas, 31, 1)).toEqual([0, 0, 255, 255]);

    failComposition = false;
    crc(producerCanvas, <Producer include={false} initial={0} target={0} />);
    driver.flush(30);
    for (const logicalTime of [40, 50, 60]) {
      if (driver.pendingHostFrames === 0) break;
      driver.flush(logicalTime);
    }

    expect(observed).toEqual([3, 1]);
    expect(pixel(observerCanvas, 11, 1)).toEqual([0, 0, 255, 255]);
    expect(pixel(observerCanvas, 31, 1)).toEqual([0, 0, 0, 0]);
  });

  it('preserves animated transforms, rectangle geometry, layout, and event order', () => {
    const translateX = signal(0);
    const rectangleX = signal(0);
    const layoutLeft = signal(40);
    const clicks: Array<{ target: string; x: number; y: number }> = [];
    const renderedValues: Array<{
      translateX: number;
      rectangleX: number;
      layoutLeft: number;
    }> = [];
    let playback!: CRCPlayback;

    function Scene(): CRCNode {
      playback = crcPlayback(parallel(
        track(translateX, tween({ from: 0, to: 10, duration: 100 })),
        track(rectangleX, tween({ from: 0, to: 10, duration: 100 })),
        track(layoutLeft, tween({ from: 40, to: 60, duration: 100 })),
      ));
      const currentTranslateX = translateX.get();
      const currentRectangleX = rectangleX.get();
      const currentLayoutLeft = layoutLeft.get();
      renderedValues.push({
        translateX: currentTranslateX,
        rectangleX: currentRectangleX,
        layoutLeft: currentLayoutLeft,
      });
      return (
        <>
          <Group style={{ translateX: currentTranslateX }}>
            <Rectangle
              style={{
                x: currentRectangleX,
                width: 20,
                height: 10,
                fill: 'red',
              }}
              onClick={event => clicks.push({
                target: 'bottom',
                x: event.x,
                y: event.y,
              })}
            />
            <Rectangle
              style={{
                x: currentRectangleX,
                width: 20,
                height: 10,
                fill: 'blue',
              }}
              onClick={event => clicks.push({
                target: 'top',
                x: event.x,
                y: event.y,
              })}
            />
          </Group>
          <Absolute style={{ width: 120, height: 40 }}>
            <Rectangle
              style={{
                left: currentLayoutLeft,
                top: 20,
                width: 10,
                height: 10,
                fill: 'green',
              }}
            />
          </Absolute>
        </>
      );
    }

    const canvas = createCanvas(120, 40);
    controllers.add(crc(canvas, <Scene />, { pixelRatio: 1 }));
    expect(driver.pendingHostFrames).toBe(1);
    driver.flush(-1);
    renderedValues.length = 0;
    playback.play();
    expect(driver.pendingHostFrames).toBe(1);
    driver.flush(0);
    renderedValues.length = 0;
    expect(driver.pendingHostFrames).toBe(1);

    driver.flush(50);

    expect(renderedValues).toEqual([
      { translateX: 5, rectangleX: 5, layoutLeft: 50 },
    ]);
    expect(pixel(canvas, 12, 5)).toEqual([0, 0, 255, 255]);
    expect(pixel(canvas, 2, 5)).toEqual([0, 0, 0, 0]);
    expect(pixel(canvas, 55, 25)).toEqual([0, 128, 0, 255]);
    expect(pixel(canvas, 45, 25)).toEqual([0, 0, 0, 0]);

    dispatchClick(canvas, 2, 5);
    expect(clicks).toEqual([]);
    dispatchClick(canvas, 15, 5);
    expect(clicks).toEqual([{ target: 'top', x: 15, y: 5 }]);
  });
});

function createCanvas(width = 40, height = 20): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.style.cssText = `display:block;width:${width}px;height:${height}px`;
  document.body.appendChild(canvas);
  return canvas;
}

function dispatchClick(canvas: HTMLCanvasElement, x: number, y: number): void {
  const bounds = canvas.getBoundingClientRect();
  for (const type of ['mousedown', 'mouseup', 'click']) {
    canvas.dispatchEvent(new MouseEvent(type, {
      bubbles: true,
      button: 0,
      buttons: type === 'mousedown' ? 1 : 0,
      cancelable: true,
      clientX: bounds.left + x,
      clientY: bounds.top + y,
    }));
  }
}

function pixel(canvas: HTMLCanvasElement, x: number, y: number): number[] {
  return Array.from(canvas.getContext('2d')!.getImageData(x, y, 1, 1).data);
}
