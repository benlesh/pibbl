/** @jsxImportSource @pibbl/core */
import { Group, Rectangle, pibbl, signal, type PibblController } from '@pibbl/core';
import {
  PhysicsWorld2D,
  collider2D,
  dynamicBody2D,
  inspectPhysics2D,
  pibblPhysicsWorld2D,
  staticBody2D,
  type PibblPhysicsWorldHandle2D,
} from '@pibbl/core/physics/2d';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { advanceEndlessWorld, createGame } from './model.ts';

describe('Brick Climb endless world ownership', () => {
  const mounts: PibblController[] = [];

  afterEach(() => {
    for (const mount of mounts.splice(0)) mount.dispose();
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it('keeps keyed physics blocks bounded while pruning and releases all world resources on dispose', () => {
    const frames = new ManualFrames();
    frames.install();
    const game = createGame();
    const revision = signal(0);
    let world!: PibblPhysicsWorldHandle2D;
    const Capture = () => { world = pibblPhysicsWorld2D(); };
    const World = () => {
      revision.get();
      return <PhysicsWorld2D space="local" gravity={[0, 0]}>
        <Capture />
        {game.blocks.map(block => <Group
          key={`block:${block.id}`}
          physics={staticBody2D({ collider: false })}
          style={{ translateX: block.x, translateY: block.y }}
        >
          <Rectangle
            physics={collider2D()}
            style={{ width: 40, height: 40, fill: '#fff' }}
          />
        </Group>)}
        {game.trampolines.map(spring => <Group
          key={`spring:${spring.id}`}
          physics={staticBody2D({ collider: false })}
          style={{ translateX: spring.x, translateY: spring.y }}
        >
          <Rectangle physics={collider2D({ sensor: true })} style={{ width: 40, height: 8, fill: '#5f5' }} />
        </Group>)}
        {game.debris.map(fragment => <Group
          key={`fragment:${fragment.id}`}
          physics={dynamicBody2D({ collider: false, mass: 0.1 })}
          style={{ translateX: fragment.x, translateY: fragment.y }}
        >
          <Rectangle physics={collider2D({ sensor: true })} style={{ width: 12, height: 10, fill: '#f95' }} />
        </Group>)}
      </PhysicsWorld2D>;
    };
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 640;
    document.body.appendChild(canvas);
    const mount = pibbl(canvas, <World />);
    mounts.push(mount);
    frames.flush(0);

    let maximumBodies = 0;
    for (let step = 1; step <= 240; step++) {
      // Move far enough each iteration to exercise both deterministic generation and pruning.
      advanceEndlessWorld(game, -step * 220, 1000 / 30);
      game.time += 1000 / 30;
      if (step % 12 === 0) {
        game.debris.push({ id: game.nextId++, x: 200, y: game.camera + 300, vx: 0, vy: 0, born: game.time });
      }
      game.debris = game.debris.filter(fragment => game.time - fragment.born < 1_600);
      revision.update(value => value + 1);
      frames.flush(step * (1000 / 30));
      // The root plans the keyed topology, then the world commits it on the following frame.
      frames.flush(step * (1000 / 30) + 0.01);
      const snapshot = inspectPhysics2D(world);
      maximumBodies = Math.max(maximumBodies, snapshot.bodies.length);
      const expected = game.blocks.length + game.trampolines.length + game.debris.length;
      expect(snapshot.bodies).toHaveLength(expected);
      expect(snapshot.colliders).toHaveLength(expected);
    }

    expect(maximumBodies).toBeLessThan(250);
    // Keep the live public world long enough to observe exact release of every child resource.
    game.blocks = [];
    game.trampolines = [];
    game.debris = [];
    revision.update(value => value + 1);
    frames.flush(8_100);
    frames.flush(8_100.01);
    const emptied = inspectPhysics2D(world);
    expect(emptied.bodies).toHaveLength(0);
    expect(emptied.colliders).toHaveLength(0);

    mount.dispose();
    mounts.splice(mounts.indexOf(mount), 1);
    expect(frames.pending()).toBe(0);
  });
});

class ManualFrames {
  private readonly callbacks = new Map<number, FrameRequestCallback>();
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
    if (!entry) throw new Error('No Pibbl host frame is pending.');
    this.callbacks.delete(entry[0]);
    entry[1](time);
  }

  pending(): number { return this.callbacks.size; }
}
