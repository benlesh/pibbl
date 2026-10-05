import { assign, defineMachine } from '@pibbl/core/machines';

/** Session accounting, independent of character animation and physical poses. */
export interface SessionContext {
  /** Total coins collected in this run. */
  coins: number;
  /** Remaining attempts, including the currently active player. */
  lives: number;
  /** Points earned through coins and broken bricks. */
  score: number;
}
/** Events emitted by the start controls and the physical world. */
export type SessionEvent =
  | { type: 'START' }
  | { type: 'RESTART' }
  | { type: 'COLLECT'; amount: number }
  | { type: 'BREAK_BRICK' }
  | { type: 'LIFE_LOST' };
/** Application-owned world operations; the machine owns their admission. */
export interface SessionInput {
  /** Restore the character on a safe visible platform. */
  respawn: () => void;
}

/** Game lifecycle and scoring. Events outside playing cannot award points. */
export const sessionMachine = defineMachine<SessionContext, SessionEvent, SessionInput>({
  initial: 'start',
  context: () => ({ coins: 0, lives: 3, score: 0 }),
  states: {
    start: { on: { START: 'playing' } },
    playing: {
      on: {
        COLLECT: {
          guard: ({ event }) => Number.isSafeInteger(event.amount) && event.amount > 0,
          actions: assign(({ context, event }) => {
            const coins = context.coins + event.amount;
            return {
              coins,
              lives: context.lives + Math.floor(coins / 500) - Math.floor(context.coins / 500),
              score: context.score + event.amount * 100,
            };
          }),
        },
        BREAK_BRICK: {
          actions: assign(({ context }) => ({ score: context.score + 25 })),
        },
        LIFE_LOST: [
          { guard: ({ context }) => context.lives === 1, target: 'over', actions: assign(() => ({ lives: 0 })) },
          { actions: [assign(({ context }) => ({ lives: context.lives - 1 })), ({ input }) => input.respawn()] },
        ],
      },
    },
    over: { on: { RESTART: { target: 'playing', actions: assign(() => ({ coins: 0, lives: 3, score: 0 })) } } },
  },
});
