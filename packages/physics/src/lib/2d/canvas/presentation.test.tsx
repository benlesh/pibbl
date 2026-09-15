import { Circle, Group, Rectangle, crc, type CRCController } from '@crc/core';
import {
  PhysicsWorld2D,
  applyImpulse2D,
  collider2D,
  crcPhysicsBody2D,
  crcPhysicsWorld2D,
  dynamicBody2D,
  kinematicBody2D,
  type CRCPhysicsWorldHandle2D,
} from '../../../2d.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  requirePhysicsWorld2DController,
  snapshotPhysicsWorld2DControllerForTest,
} from '../runtime/controller.js';
import {
  captureBodyPresentation2D,
  resolveDynamicPresentationTransform2D,
} from './presentation.js';

describe('Canvas 2D physics pose presentation', () => {
  const mounts: CRCController[] = [];

  afterEach(() => {
    for (const mount of mounts.splice(0)) mount.dispose();
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it('presents committed dynamic motion through filters and coordinate targeting', () => {
    const frames = new ManualFrames();
    frames.install();
    let world!: CRCPhysicsWorldHandle2D;
    const clicks: string[] = [];
    const Capture = () => { world = crcPhysicsWorld2D(); };
    const root = (translateX = 10) => (
      <PhysicsWorld2D>
        <Capture />
        <Group physics={dynamicBody2D({ collider: false })} style={{ translateX }}>
          <Rectangle
            physics={collider2D()}
            style={{
              x: 5, y: 5, width: 10, height: 10, fill: '#2563eb',
              filter: { type: 'opacity', amount: 1 },
            }}
            onClick={() => clicks.push('hit')}
          />
        </Group>
      </PhysicsWorld2D>
    );
    const canvas = document.createElement('canvas');
    canvas.width = 70;
    canvas.height = 30;
    document.body.appendChild(canvas);
    mounts.push(crc(canvas, root()));
    frames.flush(0);
    expect(pixelAt(canvas, 17, 8)).toEqual([37, 99, 235, 255]);

    frames.flush(1);
    const controller = requirePhysicsWorld2DController(world);
    const bodyId = snapshotPhysicsWorld2DControllerForTest(controller).bodyIds[0]!;
    controller.queueCommands([{
      kind: 'set-pose', bodyId,
      pose: { position: [30, 0], rotationDegrees: 0 },
    }]);
    frames.flush(2);
    expect(pixelAt(canvas, 37, 8)).toEqual([37, 99, 235, 255]);
    expect(pixelAt(canvas, 17, 8)).toEqual([0, 0, 0, 0]);
    click(canvas, 37, 8);
    click(canvas, 17, 8);
    expect(clicks).toEqual(['hit']);

    crc(canvas, root(11));
    expect(() => frames.flush(3)).toThrow(/ancestor transform|authored pose/i);
  });

  it('moves a dynamic primitive when its Canvas click applies an impulse', () => {
    const frames = new ManualFrames();
    frames.install();
    let body!: ReturnType<typeof crcPhysicsBody2D>;
    let clickCount = 0;
    const Ball = () => {
      body = crcPhysicsBody2D();
      return (
        <Circle
          physics={dynamicBody2D({ handle: body, mass: 1 })}
          style={{ cx: 20, cy: 20, radius: 5, fill: '#2563eb' }}
          onClick={() => {
            clickCount += 1;
            applyImpulse2D(body, [100, 0]);
          }}
        />
      );
    };
    const canvas = document.createElement('canvas');
    canvas.width = 60;
    canvas.height = 40;
    document.body.appendChild(canvas);
    mounts.push(crc(canvas, (
      <PhysicsWorld2D gravity={[0, 0]} fixedStepMilliseconds={100}>
        <Ball />
      </PhysicsWorld2D>
    )));
    frames.flush(0);
    frames.flush(0);

    expect(pixelAt(canvas, 20, 20)).toEqual([37, 99, 235, 255]);
    click(canvas, 20, 20);
    expect(clickCount).toBe(1);
    frames.flush(100);

    expect(body.position.get()).toEqual([10, 0]);
    expect(body.linearVelocity.get()).toEqual([100, 0]);
    frames.flush(200);

    expect(pixelAt(canvas, 30, 20)).toEqual([37, 99, 235, 255]);
    expect(pixelAt(canvas, 15, 20)).toEqual([0, 0, 0, 0]);
  });

  it('leaves kinematic authored placement under application authority', () => {
    const frames = new ManualFrames();
    frames.install();
    let translateX = 10;
    const root = () => (
      <PhysicsWorld2D>
        <Group
          physics={kinematicBody2D({ collider: false })}
          style={{ translateX }}
        >
          <Rectangle
            physics={collider2D()}
            style={{ x: 5, y: 5, width: 10, height: 10, fill: '#2563eb' }}
          />
        </Group>
      </PhysicsWorld2D>
    );
    const canvas = document.createElement('canvas');
    canvas.width = 60;
    canvas.height = 25;
    document.body.appendChild(canvas);
    mounts.push(crc(canvas, root()));
    frames.flush(0);
    frames.flush(1);

    translateX = 30;
    crc(canvas, root());
    frames.flush(2);
    expect(pixelAt(canvas, 37, 8)).toEqual([37, 99, 235, 255]);
    expect(pixelAt(canvas, 17, 8)).toEqual([0, 0, 0, 0]);
  });

  it('cedes disabled pose authority and re-enables at the current authored pose', () => {
    const frames = new ManualFrames();
    frames.install();
    let enabled = false;
    let translateX = 10;
    const root = () => (
      <PhysicsWorld2D gravity={[0, 0]}>
        <Group
          physics={dynamicBody2D({
            collider: false,
            enabled,
            linearVelocity: [3, 4],
            reenableVelocity: 'preserve',
          })}
          style={{ translateX }}
        >
          <Rectangle
            physics={collider2D()}
            style={{ x: 5, y: 5, width: 10, height: 10, fill: '#2563eb' }}
          />
        </Group>
      </PhysicsWorld2D>
    );
    const canvas = document.createElement('canvas');
    canvas.width = 70;
    canvas.height = 25;
    document.body.appendChild(canvas);
    mounts.push(crc(canvas, root()));
    frames.flush(0);
    frames.flush(0);

    translateX = 30;
    enabled = true;
    crc(canvas, root());
    frames.flush(0);
    expect(pixelAt(canvas, 37, 8)).toEqual([37, 99, 235, 255]);
    expect(pixelAt(canvas, 17, 8)).toEqual([0, 0, 0, 0]);
  });

  it('keeps authored placement at acquisition and applies one parent-local dynamic delta', () => {
    const parent = new DOMMatrix().translate(10, 5).rotate(30);
    const local = new DOMMatrix().translate(20, 4).rotate(15);
    const capture = captureBodyPresentation2D(parent, local, 'Group');

    expect(capture.initialPose.position[0]).toBeCloseTo(25.3205, 4);
    expect(capture.initialPose.position[1]).toBeCloseTo(18.4641, 4);
    expect(capture.initialPose.rotationDegrees).toBeCloseTo(45);
    expect(matrix(resolveDynamicPresentationTransform2D(
      capture,
      capture.initialPose,
      parent,
      local,
      'Group',
    ))).toEqual([1, 0, 0, 1, 0, 0]);

    const moved = resolveDynamicPresentationTransform2D(
      capture,
      { position: [55, 28], rotationDegrees: 70 },
      parent,
      local,
      'Group',
    );
    const presentedWorld = parent.multiply(moved).multiply(local);
    const expectedWorld = matrix(new DOMMatrix().translate(55, 28).rotate(70));
    matrix(presentedWorld).forEach((value, index) => {
      expect(value).toBeCloseTo(expectedWorld[index]!, 5);
    });
  });

  it('diagnoses authored pose changes while an enabled dynamic body owns pose', () => {
    const parent = new DOMMatrix().translate(10, 5);
    const local = new DOMMatrix().translate(20, 4);
    const capture = captureBodyPresentation2D(parent, local, 'Group');
    expect(() => resolveDynamicPresentationTransform2D(
      capture,
      capture.initialPose,
      parent,
      new DOMMatrix().translate(21, 4),
      'Group',
    )).toThrow(/Group.*authored.*dynamic.*teleportBody2D|Group.*dynamic.*authored.*teleportBody2D/i);
    expect(() => resolveDynamicPresentationTransform2D(
      capture,
      capture.initialPose,
      new DOMMatrix().translate(11, 5),
      local,
      'Group',
    )).toThrow(/ancestor transform.*dynamic/i);
  });

  it('rejects noninvertible, skewed, and non-rigid dynamic ancestors', () => {
    expect(() => captureBodyPresentation2D(
      new DOMMatrix().scale(0, 1),
      new DOMMatrix(),
      'Rectangle',
    )).toThrow(/noninvertible/i);
    expect(() => captureBodyPresentation2D(
      new DOMMatrix().skewX(10),
      new DOMMatrix(),
      'Rectangle',
    )).toThrow(/skewed|rigid/i);
    expect(() => captureBodyPresentation2D(
      new DOMMatrix().scale(2),
      new DOMMatrix(),
      'Rectangle',
    )).toThrow(/non-rigid|scale/i);
  });

  it('accepts browser transform round-trip noise around a rigid ancestor', () => {
    const browserIdentity = new DOMMatrix([
      0.9999999803366121,
      0,
      0,
      1.0000000018736235,
      0,
      3.3213614218633807e-22,
    ]);

    expect(() => captureBodyPresentation2D(
      browserIdentity,
      new DOMMatrix(),
      'Circle',
    )).not.toThrow();
  });
});

function matrix(value: DOMMatrixReadOnly): readonly number[] {
  return [value.a, value.b, value.c, value.d, value.e, value.f].map(entry =>
    Math.abs(entry) < 1e-10 ? 0 : Number(entry.toFixed(8))
  );
}

function pixelAt(canvas: HTMLCanvasElement, x: number, y: number): number[] {
  return Array.from(canvas.getContext('2d')!.getImageData(x, y, 1, 1).data);
}

function click(canvas: HTMLCanvasElement, x: number, y: number): void {
  const bounds = canvas.getBoundingClientRect();
  for (const type of ['mousedown', 'mouseup', 'click']) {
    canvas.dispatchEvent(new MouseEvent(type, {
      bubbles: true, button: 0, buttons: type === 'mousedown' ? 1 : 0,
      clientX: bounds.left + x, clientY: bounds.top + y,
    }));
  }
}

class ManualFrames {
  private callbacks = new Map<number, FrameRequestCallback>();
  private nextId = 0;

  install(): void {
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => {
      const id = ++this.nextId;
      this.callbacks.set(id, callback);
      return id;
    });
    vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(id => {
      this.callbacks.delete(id);
    });
  }

  flush(time: number): void {
    const entry = this.callbacks.entries().next().value as readonly [number, FrameRequestCallback] | undefined;
    if (!entry) throw new Error('No CRC host frame is pending.');
    this.callbacks.delete(entry[0]);
    entry[1](time);
  }
}
