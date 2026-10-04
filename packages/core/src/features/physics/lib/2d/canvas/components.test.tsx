import { crc, type CRCController } from '@crc/core';
/** @jsxImportSource @crc/core */
import {
  Capsule2D,
  Chain2D,
  PhysicsShape2D,
  Segment2D,
} from '../../../2d.js';
import {
  boxShape2D,
  capsuleShape2D,
  chainShape2D,
  circleShape2D,
  ellipseShape2D,
  polygonShape2D,
  roundedBoxShape2D,
  segmentShape2D,
} from '../shapes.js';
import { afterEach, describe, expect, it } from 'vitest';
import { inferCanvasColliderShape2D } from './inference.js';

const mounts: CRCController[] = [];

afterEach(() => {
  for (const mount of mounts.splice(0)) mount.dispose();
  document.body.replaceChildren();
});

describe('matching Canvas physics shape components', () => {
  it('renders and targets a capsule from the same resolved geometry', async () => {
    const clicks: string[] = [];
    const canvas = mount(
      <Capsule2D
        style={{ start: [10, 20], end: [30, 20], radius: 5, fill: '#ef4444' }}
        onClick={() => clicks.push('capsule')}
        keyboardFocusable
      />,
    );
    await nextFrame();
    expect(pixelAt(canvas, 10, 20)).toEqual([239, 68, 68, 255]);
    expect(pixelAt(canvas, 20, 20)).toEqual([239, 68, 68, 255]);
    expect(pixelAt(canvas, 4, 20)).toEqual([0, 0, 0, 0]);
    click(canvas, 10, 20);
    click(canvas, 4, 20);
    expect(clicks).toEqual(['capsule']);
  });

  it('renders segment and rounded chain geometry with ordinary paint semantics', async () => {
    const canvas = mount(
      <>
        <Segment2D style={{ start: [5, 5], end: [25, 5], stroke: '#2563eb', strokeWidth: 2 }} />
        <Chain2D style={{ points: [[5, 20], [20, 20], [20, 30]], radius: 3, fill: '#22c55e' }} />
      </>,
    );
    await nextFrame();
    expect(pixelAt(canvas, 10, 5)).toEqual([37, 99, 235, 255]);
    expect(pixelAt(canvas, 10, 20)).toEqual([34, 197, 94, 255]);
  });

  it('dispatches every public immutable shape through PhysicsShape2D without changing its collider identity', () => {
    const shapes = [
      circleShape2D({ radius: 2 }),
      ellipseShape2D({ radiusX: 3, radiusY: 2 }),
      boxShape2D({ width: 4, height: 3 }),
      roundedBoxShape2D({ width: 4, height: 3, radius: 1 }),
      capsuleShape2D({ start: [0, 0], end: [4, 0], radius: 1 }),
      segmentShape2D({ start: [0, 0], end: [4, 0] }),
      chainShape2D({ points: [[0, 0], [4, 0], [4, 4]], radius: 1 }),
      polygonShape2D({ points: [[0, 0], [4, 0], [0, 4]] }),
    ];
    for (const shape of shapes) {
      expect(inferCanvasColliderShape2D({
        componentType: PhysicsShape2D,
        componentName: 'PhysicsShape2D',
        style: { shape },
      })).toBe(shape);
    }
  });
});

function mount(root: Parameters<typeof crc>[1]): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 50;
  canvas.height = 40;
  document.body.appendChild(canvas);
  mounts.push(crc(canvas, root));
  return canvas;
}

function pixelAt(canvas: HTMLCanvasElement, x: number, y: number): number[] {
  return Array.from(canvas.getContext('2d')!.getImageData(x, y, 1, 1).data);
}

function click(canvas: HTMLCanvasElement, x: number, y: number): void {
  const bounds = canvas.getBoundingClientRect();
  for (const type of ['mousedown', 'mouseup', 'click']) {
    canvas.dispatchEvent(new MouseEvent(type, {
      bubbles: true,
      button: 0,
      buttons: type === 'mousedown' ? 1 : 0,
      clientX: bounds.left + x,
      clientY: bounds.top + y,
    }));
  }
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}
