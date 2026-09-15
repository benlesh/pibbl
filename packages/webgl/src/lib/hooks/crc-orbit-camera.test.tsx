import { crc, type CRCController, type CRCNode } from '@crc/core';
import {
  crcInternalCurrentRenderOwner,
  crcInternalRequestRendererWork,
  type CRCInternalRenderOwner,
} from '@crc/core/internal';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as publicWebGL from '../../index.js';

const controllers = new Set<CRCController>();

afterEach(() => {
  for (const controller of controllers) controller.dispose();
  controllers.clear();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('crcOrbitCamera', () => {
  it.each([
    ['non-finite orbit point', { orbitPoint: [0, Infinity, 0], initialPosition: [0, 0, 5] }, /orbitPoint.*finite/i],
    ['coincident pose', { orbitPoint: [0, 0, 0], initialPosition: [0, 0, 0] }, /initialPosition.*differ/i],
    ['zero minimum', { orbitPoint: [0, 0, 0], initialPosition: [0, 0, 5], minDistance: 0 }, /minDistance.*positive/i],
    ['inverted bounds', { orbitPoint: [0, 0, 0], initialPosition: [0, 0, 5], minDistance: 4, maxDistance: 3 }, /maxDistance.*minDistance/i],
    ['negative rotation speed', { orbitPoint: [0, 0, 0], initialPosition: [0, 0, 5], rotateSpeed: -1 }, /rotateSpeed.*nonnegative/i],
    ['infinite zoom speed', { orbitPoint: [0, 0, 0], initialPosition: [0, 0, 5], zoomSpeed: Infinity }, /zoomSpeed.*finite/i],
  ])('rejects %s before retaining a hook slot', (_name, options, message) => {
    const frames = installControlledFrames();
    function Probe(): void {
      orbitCamera()(options as never);
    }
    const canvas = createCanvas(100, 100);
    controllers.add(crc(canvas, <Probe />, { pixelRatio: 1 }));

    expect(() => frames.runNext(1)).toThrowError(message);
  });

  it('returns the clamped initial pose and preserves handler and vector snapshots while values stay equal', () => {
    const frames = installControlledFrames();
    const results: any[] = [];
    const options = {
      orbitPoint: [1, 2, 3] as const,
      initialPosition: [1, 2, 13] as const,
      maxDistance: 5,
    };
    function Probe(): CRCNode {
      results.push(orbitCamera()(options));
    }
    const canvas = createCanvas(100, 100);
    controllers.add(crc(canvas, <Probe />, { pixelRatio: 1 }));
    frames.runNext(1);

    expect(results[0].position).toEqual([1, 2, 8]);
    expect(results[0].lookAt).toEqual([1, 2, 3]);
    expect(Object.isFrozen(results[0].position)).toBe(true);
    expect(Object.isFrozen(results[0].lookAt)).toBe(true);
    expect(Object.isFrozen(results[0].handlers)).toBe(true);
    expect(frames.pendingIds()).toEqual([]);

    crc(canvas, <Probe />);
    frames.runNext(2);
    expect(results[1].position).toBe(results[0].position);
    expect(results[1].lookAt).toBe(results[0].lookAt);
    expect(results[1].handlers).toBe(results[0].handlers);
    expect(results[1].handlers.onPointerMove)
      .toBe(results[0].handlers.onPointerMove);
    expect(frames.pendingIds()).toEqual([]);
  });

  it('captures one primary pointer and uses root-logical drag deltas without letting unrelated pointers steal it', () => {
    const frames = installControlledFrames();
    let result: any;
    let renders = 0;
    function Probe(): void {
      renders += 1;
      result = orbitCamera()({
        orbitPoint: [0, 0, 0],
        initialPosition: [0, 0, 10],
      });
    }
    const canvas = createCanvas(200, 100);
    controllers.add(crc(canvas, <Probe />, {
      viewport: { width: 200, height: 100 },
      pixelRatio: 1,
    }));
    frames.runNext(1);
    const captures: number[] = [];
    const currentTarget = {
      setPointerCapture: (pointerId: number) => captures.push(pointerId),
      hasPointerCapture: () => true,
      releasePointerCapture: () => undefined,
    };

    result.handlers.onPointerDown(pointer({
      pointerId: 7,
      isPrimary: true,
      x: 20,
      y: 30,
      currentTarget,
    }));
    result.handlers.onPointerDown(pointer({
      pointerId: 9,
      isPrimary: true,
      x: 90,
      y: 90,
      currentTarget,
    }));
    result.handlers.onPointerMove(pointer({
      pointerId: 9,
      isPrimary: true,
      x: 120,
      y: 120,
      currentTarget,
    }));
    expect(frames.pendingIds()).toEqual([]);

    result.handlers.onPointerMove(pointer({
      pointerId: 7,
      isPrimary: true,
      x: 30,
      y: 40,
      currentTarget,
    }));
    result.handlers.onPointerMove(pointer({
      pointerId: 7,
      isPrimary: true,
      x: 40,
      y: 45,
      currentTarget,
    }));
    expect(captures).toEqual([7]);
    expect(frames.pendingIds()).toHaveLength(1);

    frames.runNext(2);
    expect(renders).toBe(2);
    expect(result.position[0]).toBeCloseTo(-1.9644, 3);
    expect(result.position[1]).toBeCloseTo(-1.4944, 3);
    expect(result.position[2]).toBeCloseTo(9.6906, 3);

    result.handlers.onPointerUp(pointer({
      pointerId: 9,
      isPrimary: true,
      x: 40,
      y: 45,
      currentTarget,
    }));
    result.handlers.onPointerMove(pointer({
      pointerId: 7,
      isPrimary: true,
      x: 50,
      y: 45,
      currentTarget,
    }));
    expect(frames.pendingIds()).toHaveLength(1);
    result.handlers.onPointerCancel(pointer({
      pointerId: 7,
      isPrimary: true,
      x: 50,
      y: 45,
      currentTarget,
    }));
    frames.runNext(3);
    const ended = result.position;
    result.handlers.onPointerMove(pointer({
      pointerId: 7,
      isPrimary: true,
      x: 80,
      y: 80,
      currentTarget,
    }));
    expect(result.position).toBe(ended);
    expect(frames.pendingIds()).toEqual([]);
  });

  it('clamps poles and distance and normalizes pixel, line, and page wheel deltas', () => {
    const frames = installControlledFrames();
    let result: any;
    function Probe(): void {
      result = orbitCamera()({
        orbitPoint: [0, 0, 0],
        initialPosition: [0, 0, 10],
        minDistance: 5,
        maxDistance: 20,
      });
    }
    const canvas = createCanvas(200, 100);
    controllers.add(crc(canvas, <Probe />, {
      viewport: { width: 200, height: 100 },
      pixelRatio: 1,
    }));
    frames.runNext(1);
    const currentTarget = captureTarget();
    result.handlers.onPointerDown(pointer({
      pointerId: 1,
      isPrimary: true,
      x: 0,
      y: 0,
      currentTarget,
    }));
    result.handlers.onPointerMove(pointer({
      pointerId: 1,
      isPrimary: true,
      x: 0,
      y: -100_000,
      currentTarget,
    }));
    frames.runNext(2);
    expect(result.position[1]).toBeCloseTo(9.999995, 5);

    const prevented: string[] = [];
    const wheel = (deltaY: number, deltaMode: number, label: string) => ({
      deltaY,
      deltaMode,
      preventDefault: () => prevented.push(label),
    }) as any;
    result.handlers.onWheel(wheel(Math.log(2) / 0.001, 0, 'pixel'));
    frames.runNext(3);
    expect(distance(result.position, result.lookAt)).toBeCloseTo(20, 8);
    result.handlers.onWheel(wheel(-100, 1, 'line'));
    frames.runNext(4);
    expect(distance(result.position, result.lookAt)).toBeCloseTo(5, 8);
    result.handlers.onWheel(wheel(1, 2, 'page'));
    frames.runNext(5);
    expect(distance(result.position, result.lookAt)).toBeCloseTo(
      5 * Math.exp(0.1),
      8,
    );
    expect(prevented).toEqual(['pixel', 'line', 'page']);

    result.handlers.onWheel(wheel(-1_000_000, 0, 'clamped'));
    frames.runNext(6);
    expect(distance(result.position, result.lookAt)).toBeCloseTo(5, 8);
    result.handlers.onWheel(wheel(-1, 0, 'unchanged'));
    expect(frames.pendingIds()).toEqual([]);
    expect(prevented).toEqual(['pixel', 'line', 'page', 'clamped']);
  });

  it('adopts live options after render, coalesces updates, and makes saved handlers inert after teardown', () => {
    const frames = installControlledFrames();
    let result: any;
    let orbitPoint: readonly [number, number, number] = [0, 0, 0];
    let zoomSpeed = 1;
    function Probe(): void {
      result = orbitCamera()({
        orbitPoint,
        initialPosition: [0, 0, 10],
        minDistance: 2,
        maxDistance: 20,
        zoomSpeed,
      });
    }
    const canvas = createCanvas(100, 100);
    const controller = crc(canvas, <Probe />, { pixelRatio: 1 });
    controllers.add(controller);
    frames.runNext(1);
    const handlers = result.handlers;

    orbitPoint = [4, 5, 6];
    zoomSpeed = 2;
    crc(canvas, <Probe />);
    frames.runNext(2);
    expect(result.lookAt).toEqual([4, 5, 6]);
    expect(result.position).toEqual([4, 5, 16]);
    const preventDefault = vi.fn();
    handlers.onWheel({ deltaY: Math.log(2) / 0.002, deltaMode: 0, preventDefault } as any);
    handlers.onWheel({ deltaY: -1, deltaMode: 0, preventDefault } as any);
    expect(frames.pendingIds()).toHaveLength(1);
    frames.runNext(3);
    expect(preventDefault).toHaveBeenCalledTimes(2);
    expect(result.handlers).toBe(handlers);

    controller.dispose();
    handlers.onWheel({ deltaY: 1, deltaMode: 0, preventDefault } as any);
    expect(frames.pendingIds()).toEqual([]);
  });

  it('does not publish equal-value vector caches when a later sibling makes the root transaction fail', () => {
    const frames = installControlledFrames();
    const snapshots: any[] = [];
    let orbitPoint: readonly [number, number, number] = [0, 0, 0];
    let owner!: CRCInternalRenderOwner;
    let failComposition = false;
    const workKey = {};
    function Probe(): void {
      snapshots.push(orbitCamera()({
        orbitPoint,
        initialPosition: [0, 0, 10],
      }));
    }
    function LaterSibling(): void {
      owner ??= crcInternalCurrentRenderOwner();
    }
    const scene = () => <><Probe /><LaterSibling /></>;
    const canvas = createCanvas(100, 100);
    controllers.add(crc(canvas, scene(), { pixelRatio: 1 }));
    frames.runNext(1);
    crcInternalRequestRendererWork(owner, {
      key: workKey,
      kind: 'compose',
      run: () => {
        if (failComposition) {
          throw new Error('expected later sibling composition failure');
        }
      },
    });

    orbitPoint = [1, 2, 3];
    failComposition = true;
    crc(canvas, scene());
    expect(() => frames.runNext(2))
      .toThrowError('expected later sibling composition failure');
    expect(snapshots[1].lookAt).toEqual([1, 2, 3]);

    orbitPoint = [0, 0, 0];
    failComposition = false;
    crc(canvas, scene());
    frames.runNext(3);

    expect(snapshots[2].position).toBe(snapshots[0].position);
    expect(snapshots[2].lookAt).toBe(snapshots[0].lookAt);
    expect(snapshots[2]).toBe(snapshots[0]);
  });
});

function orbitCamera(): (options: unknown) => any {
  return (publicWebGL as unknown as { crcOrbitCamera: (options: unknown) => any })
    .crcOrbitCamera;
}

function pointer(input: Record<string, unknown>): any {
  return input;
}

function captureTarget() {
  return {
    setPointerCapture: () => undefined,
    hasPointerCapture: () => true,
    releasePointerCapture: () => undefined,
  };
}

function distance(left: readonly number[], right: readonly number[]): number {
  return Math.hypot(
    left[0]! - right[0]!,
    left[1]! - right[1]!,
    left[2]! - right[2]!,
  );
}

function installControlledFrames() {
  let nextId = 0;
  const callbacks = new Map<number, FrameRequestCallback>();
  const pending = new Set<number>();
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
    const id = ++nextId;
    callbacks.set(id, callback);
    pending.add(id);
    return id;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => {
    pending.delete(id);
  });
  return {
    pendingIds: () => [...pending],
    runNext(timestamp: number): void {
      const id = pending.values().next().value as number | undefined;
      if (id === undefined) throw new Error('No pending animation frame.');
      pending.delete(id);
      callbacks.get(id)!(timestamp);
    },
  };
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  document.body.append(canvas);
  return canvas;
}
