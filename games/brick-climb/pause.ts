import { usePlayback, useReaction, type PibblPlayback } from '@pibbl/core';
import { disableBody2D, enableBody2D, type PibblPhysicsBodyHandle2D } from '@pibbl/core/physics/2d';

/** Game-local resources that must stop together while the player pauses. */
export interface GamePauseResources {
  readonly bodies: Set<PibblPhysicsBodyHandle2D>;
  readonly playbacks: Set<PibblPlayback>;
  readonly deferred: Set<() => void>;
}

/** Structural pause state shared by the game session and its mounted scene. */
export interface GamePauseSession {
  paused?: boolean;
  pauseResources?: GamePauseResources;
}

function resources(session: GamePauseSession): GamePauseResources {
  return session.pauseResources ??= {
    bodies: new Set(),
    playbacks: new Set(),
    deferred: new Set(),
  };
}

/** Creates a component-owned playback and enrolls it in the current game pause. */
export function useGamePlayback(
  session: GamePauseSession,
  program: Parameters<typeof usePlayback>[0],
  options?: Parameters<typeof usePlayback>[1],
): ReturnType<typeof usePlayback> {
  const playback = usePlayback(program, options);
  useReaction(() => {
    const registered = resources(session);
    registered.playbacks.add(playback);
    if (session.paused) playback.pause();
    return () => { registered.playbacks.delete(playback); };
  }, [playback]);
  return playback;
}

/** Enrolls one mounted dynamic physics body in the current game pause. */
export function useGameBody(session: GamePauseSession, body: PibblPhysicsBodyHandle2D): void {
  useReaction(() => {
    const registered = resources(session);
    registered.bodies.add(body);
    if (session.paused) disableBody2D(body);
    return () => { registered.bodies.delete(body); };
  }, [body]);
}

/** Pauses or resumes all registered game resources without recreating the scene. */
export function setGamePaused(session: GamePauseSession, paused: boolean): void {
  if (session.paused === paused) return;
  session.paused = paused;
  const registered = resources(session);
  for (const playback of registered.playbacks) paused ? playback.pause() : playback.resume();
  for (const body of registered.bodies) paused ? disableBody2D(body) : enableBody2D(body, { velocity: 'preserve' });
  if (!paused) {
    const callbacks = [...registered.deferred];
    registered.deferred.clear();
    for (const callback of callbacks) callback();
  }
}

/** Runs now when active, or exactly once after the next resume. */
export function whenGameResumed(session: GamePauseSession, callback: () => void): () => void {
  if (!session.paused) {
    callback();
    return () => {};
  }
  const deferred = resources(session).deferred;
  deferred.add(callback);
  return () => { deferred.delete(callback); };
}
