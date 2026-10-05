import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setGamePaused, whenGameResumed, type GamePauseSession } from './pause.ts';

test('resume callbacks wait for an active game and run once', () => {
  const session: GamePauseSession = {};
  let calls = 0;
  whenGameResumed(session, () => calls++);
  assert.equal(calls, 1);
  setGamePaused(session, true);
  whenGameResumed(session, () => calls++);
  assert.equal(calls, 1);
  setGamePaused(session, false);
  assert.equal(calls, 2);
  setGamePaused(session, false);
  assert.equal(calls, 2);
});
