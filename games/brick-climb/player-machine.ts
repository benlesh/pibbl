import { drive, repeat, type WritableSignal } from '@pibbl/core';
import { assign, defineMachine } from '@pibbl/core/machines';
import { playAnimation } from '@pibbl/core/machines/animation';
import { defineSpriteAnimation, type SpriteFrame, type SpriteSheet } from '@pibbl/core/sprites';

/** Horizontal intent retained while airborne. */
export interface PlayerContext { /** Left, stationary, or right. */ direction: number }
/** Physical contacts and keyboard intent, independent of animation frame ticks. */
export type PlayerEvent =
  | { type: 'MOVE'; direction: number }
  | { type: 'JUMP' }
  | { type: 'FALL' }
  | { type: 'LAND' }
  | { type: 'DIE' }
  | { type: 'BOOST' };
/** Resources owned by the mounted character. */
export interface PlayerInput {
  /** Sprite output sampled by the current state's playback. */ frame: WritableSignal<SpriteFrame>;
  /** Shared atlas resources owned by the game. */ sheet: SpriteSheet;
  /** Apply a grounded jump impulse to the physics body. */ jump: () => void;
}

const clip = (name: 'idle' | 'walk' | 'jump' | 'fall') => playAnimation<PlayerContext, PlayerEvent, PlayerInput>(({ input }) => {
  const animation = input.sheet.animations[name] ?? defineSpriteAnimation({ frames: [input.sheet.frames[name]], fps: 1 });
  return repeat(drive(input.frame, animation), { iterations: Infinity });
});

/** Locomotion owns exactly one sprite playback; physical motion remains in the world. */
export const playerMachine = defineMachine<PlayerContext, PlayerEvent, PlayerInput>({
  initial: 'idle',
  context: () => ({ direction: 0 }),
  on: { DIE: 'dead', BOOST: 'rising' },
  states: {
    idle: {
      invoke: { task: clip('idle') },
      on: {
        MOVE: { guard: ({ event }) => event.direction !== 0, target: 'running', actions: assign(({ event }) => ({ direction: event.direction })) },
        JUMP: { target: 'rising', actions: ({ input }) => input.jump() },
        FALL: 'falling',
      },
    },
    running: {
      invoke: { task: clip('walk') },
      on: {
        MOVE: [
          { guard: ({ event }) => event.direction === 0, target: 'idle', actions: assign(() => ({ direction: 0 })) },
          { guard: ({ context, event }) => context.direction !== event.direction, actions: assign(({ event }) => ({ direction: event.direction })) },
        ],
        JUMP: { target: 'rising', actions: ({ input }) => input.jump() },
        FALL: 'falling',
      },
    },
    rising: {
      invoke: { task: clip('jump') },
      on: {
        MOVE: { guard: ({ context, event }) => context.direction !== event.direction, actions: assign(({ event }) => ({ direction: event.direction })) },
        FALL: 'falling',
      },
    },
    falling: {
      invoke: { task: clip('fall') },
      on: {
        MOVE: { guard: ({ context, event }) => context.direction !== event.direction, actions: assign(({ event }) => ({ direction: event.direction })) },
        LAND: [
          { guard: ({ context }) => context.direction !== 0, target: 'running' },
          { target: 'idle' },
        ],
      },
    },
    dead: { on: { DIE: {} } },
  },
});
