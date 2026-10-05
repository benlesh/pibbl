import { Group, Rectangle, Text, drive, repeat, sequence, wait, marker, tween, parallel, useSignal, useReaction, computed, useVisibilityTransition, bifrost, type WritableSignal } from '@pibbl/core';
import { Sprite, defineSpriteAnimation, type SpriteFrame, type SpriteSheet } from '@pibbl/core/sprites';
import { PhysicsWorld2D, pibblPhysicsBody2D, dynamicBody2D, staticBody2D, collider2D, setLinearVelocity2D, teleportBody2D, type PibblPhysicsBodyHandle2D } from '@pibbl/core/physics/2d';
import { blockX, advanceEndlessWorld, cutJumpVelocity, breakBrick, type GameState, type Block, type Debris, type Flight, type Trampoline } from './model';

import { useMachine, type MachineActor } from '@pibbl/core/machines';
import { launchBoost, stopBoost, boostVelocity, landedTrampoline } from './boost';
import { useGamePlayback, useGameBody, whenGameResumed, type GamePauseResources } from './pause';
import { playerMachine } from './player-machine';
import { playerCollider2D } from './player-physics';
import { type SessionContext, type SessionEvent, type SessionInput } from './machines';

export interface GameSession {
  game: GameState; revision: WritableSignal<number>; keys: Set<string>; jump: boolean;
  paused?: boolean; pauseResources?: GamePauseResources;
  presentation?: 'spawning' | 'dying'; deathPosition?: { x: number; y: number };
  body?: PibblPhysicsBodyHandle2D; grounded: boolean; sheet: SpriteSheet;
  onUpdate: () => void;
  flow: MachineActor<SessionContext, SessionEvent, SessionInput>;
  jumpVelocity?: number; playerState?: string; boostUntil: number; previousPosition?: readonly [number, number];
}
type TerrainFrames = {
  left: WritableSignal<SpriteFrame>; right: WritableSignal<SpriteFrame>; cloud: WritableSignal<SpriteFrame>;
  leftCapLeft: WritableSignal<SpriteFrame>; leftCapRight: WritableSignal<SpriteFrame>;
  rightCapLeft: WritableSignal<SpriteFrame>; rightCapRight: WritableSignal<SpriteFrame>;
};
function Brick({ block, session, frames }: { block: Block; session: GameSession; frames: TerrainFrames }) {
  return <Group style={{ translateX: block.x, translateY: block.y }} physics={staticBody2D({ collider: false })}>
    <BlockPaint block={block} session={session} frames={frames} />
  </Group>;
}
function BlockPaint({ block, session, frames }: { block: Block; session: GameSession; frames: TerrainFrames }) {
  const neighbor = (offset: number) => session.game.blocks.some(other => other.y === block.y && other.x === block.x + offset && other.conveyor === block.conveyor);
  const frame = block.motion ? frames.cloud : block.conveyor === undefined ? session.sheet.frames[block.brick ? 'brick' : 'stone'] :
    !neighbor(-40) ? block.conveyor < 0 ? frames.leftCapLeft : frames.rightCapLeft :
      !neighbor(40) ? block.conveyor < 0 ? frames.leftCapRight : frames.rightCapRight :
        block.conveyor < 0 ? frames.left : frames.right;
  return <>
    <Rectangle style={{ width: block.width, height: block.height }} physics={collider2D({ tag: `block:${block.id}`, friction: 0, onCollisionStart: event => {
      if (event.otherTag !== 'player') return;
      if (event.normal[1] > 0.6) session.grounded = true;
      if (!block.brick && session.boostUntil > session.game.time && event.normal[1] < 0.6) stopBoost(session);
      if (block.brick && event.normal[1] < -0.6) {
        const brick = breakBrick(session.game, block.id);
        if (brick) {
          session.flow.send({ type: 'BREAK_BRICK' });
          session.flow.send({ type: 'COLLECT', amount: 5 });
          session.game.flights.push({ id: session.game.nextId++, x: brick.x + 30, y: brick.y - session.game.camera });
          session.revision.update(value => value + 1); session.onUpdate();
        }
      }
    }, onCollisionEnd: event => { if (event.otherTag === 'player' && event.normal[1] > 0.6) session.grounded = false; } })} />
    <Sprite frame={frame} sampling="nearest" style={{ width: block.width, height: block.height }} pointerEvents="none" />
  </>;
}
function CloudPlatform({ blocks, session, frames }: { blocks: Block[]; session: GameSession; frames: TerrainFrames }) {
  const first = blocks[0];
  const x = useSignal(computed(() => {
    session.revision.get();
    return Math.round(blockX(first, session.game.time));
  })).get();
  // Clouds are one-way terrain, so they draw directly and never create side or ceiling colliders.
  return <Group style={{ translateX: x, translateY: Math.round(first.y - session.game.camera) + session.game.camera }}>
    {blocks.map(block => <Group key={`tile:${block.id}`} style={{ translateX: block.x - first.x }}>
      <Sprite frame={frames.cloud} sampling="nearest" style={{ width: block.width, height: block.height }} pointerEvents="none" />
    </Group>)}
  </Group>;
}
function Spring({ spring, frame }: { spring: Trampoline; frame: WritableSignal<SpriteFrame> }) {
  return <Group style={{ translateX: spring.x, translateY: spring.y }}>
    <Sprite frame={frame} sampling="nearest" style={{ width: 40, height: 20 }} pointerEvents="none" />
  </Group>;
}
function Clouds({ session }: { session: GameSession }) {
  const far = useSignal(session.sheet.frames['cloud-0']), nearFrame = useSignal(session.sheet.frames['cloud-1']);
  useGamePlayback(session, parallel(...[far, nearFrame].map((frame, index) => repeat(drive(frame,
    session.sheet.animations[`cloud-${index}`] ?? defineSpriteAnimation({ frames: [frame.get()], fps: 1 }),
  ), { iterations: Infinity }))), { autoplay: true });
  // A fixed set wraps in screen space: climbing never allocates more cloud objects.
  return <>{Array.from({ length: 8 }, (_, index) => {
    const near = index >= 4;
    const span = 900;
    const y = ((index * 193 - session.game.camera * (near ? 0.32 : 0.14)) % span + span) % span - 130;
    return <Group key={index} style={{ translateX: (index * 137) % 540 - 80, translateY: y }}>
      <Sprite frame={index % 2 ? nearFrame : far} sampling="nearest" style={{ width: near ? 192 : 128, height: near ? 96 : 64, opacity: near ? 0.32 : 0.16 }} pointerEvents="none" />
    </Group>;
  })}</>;
}
function Fragment({ fragment, sheet, session }: { fragment: Debris; sheet: SpriteSheet; session: GameSession }) {
  const body = pibblPhysicsBody2D();
  useGameBody(session, body);
  return <Group style={{ translateX: fragment.x, translateY: fragment.y }} physics={dynamicBody2D({ handle: body, mass: 0.1, collider: false, linearVelocity: [fragment.vx, fragment.vy], angularVelocityDegreesPerSecond: fragment.vx * 3 })}>
    <Rectangle style={{ width: 12, height: 10 }} physics={collider2D({ sensor: true })} />
    <Sprite frame={sheet.frames[`shard-${fragment.id % 2}`]} sampling="nearest" style={{ width: 14, height: 12 }} />
  </Group>;
}
function FlyingCoin({ flight, session }: { flight: Flight; session: GameSession }) {
  const x = useSignal(flight.x), y = useSignal(flight.y);
  const frame = useSignal(session.sheet.frames['coin-0']);
  useGamePlayback(session, parallel(
    drive(x, tween({ from: flight.x, to: 355, duration: 550 })),
    drive(y, tween({ from: flight.y, to: 26, duration: 550 })),
    repeat(drive(frame, session.sheet.animations.spin), { iterations: 2 }),
  ), { autoplay: true, onEvent: event => {
    if (event.type === 'finish') { session.game.flights = session.game.flights.filter(item => item.id !== flight.id); session.revision.update(v => v + 1); }
  } });
  return <Group style={{ translateX: x, translateY: y }}><Sprite frame={frame} style={{ width: 24, height: 24 }} sampling="nearest" /></Group>;
}
function Player({ session }: { session: GameSession }) {
  const body = pibblPhysicsBody2D();
  useGameBody(session, body);
  // Authored pose is the mount-time spawn; later respawns use teleportBody2D.
  const spawn = useSignal(session.game.checkpoint).get();
  const frame = useSignal(session.sheet.frames.standing);
  const facing = useSignal(false);
  const player = useMachine(playerMachine, { input: { frame, sheet: session.sheet, jump: () => { session.jumpVelocity = -560; session.grounded = false; } } });
  useReaction(() => { session.body = body; return () => { session.body = undefined; }; }, []);
  useGamePlayback(session, repeat(sequence(wait(1000 / 60), marker('tick')), { iterations: Infinity }), { autoplay: true, onEvent: event => {
    if (event.type !== 'marker' || session.game.phase !== 'playing' || session.paused || session.presentation || !body.enabled.get()) return;
    const g = session.game;
    g.time += 1000 / 60;
    let [px, py] = body.position.get();
    let [vx, vy] = body.linearVelocity.get();
    const previous = session.previousPosition;
    const landed = previous && landedTrampoline(g.trampolines, previous, [px, py]);
    if (landed) {
      g.trampolines = g.trampolines.filter(spring => spring.id !== landed.id);
      launchBoost(session, g.time);
    }
    // Gray and conveyor terrain use ordinary physical contact. Clouds are swept
    // one-way ledges: only descending feet may land, never side or ceiling hits.
    let cloudSupport = previous && vy >= 0 ? g.blocks.find(b => b.motion && px + 24 > blockX(b, g.time) && px < blockX(b, g.time) + b.width && previous[1] + 40 <= b.y && py + 40 >= b.y) : undefined;
    if (cloudSupport) {
      py = cloudSupport.y - 40;
      vy = 0;
      teleportBody2D(body, { position: [px, py], rotationDegrees: 0 });
      setLinearVelocity2D(body, [vx, 0]);
    }
    session.previousPosition = [px, py];
    const support = Math.abs(vy) < 20 ? g.blocks.find(b => !b.motion && px + 24 > blockX(b, g.time) && px < blockX(b, g.time) + b.width && Math.abs(py + 40 - b.y) < 4) : undefined;
    session.grounded = !!support || !!cloudSupport;
    const direction = Number(session.keys.has('KeyD')) - Number(session.keys.has('KeyA'));
    player.send({ type: 'MOVE', direction });
    if (session.boostUntil > g.time) player.send({ type: 'BOOST' });
    else if (session.grounded) player.send({ type: 'LAND' });
    else if (vy >= -30) player.send({ type: 'FALL' });
    if (session.jump && session.grounded) player.send({ type: 'JUMP' });
    let nextY = session.jumpVelocity ?? vy;
    nextY = boostVelocity(session, g.time, nextY);
    if (!session.boostUntil) nextY = cutJumpVelocity(nextY, session.keys.has('Space') || session.keys.has('KeyW'));
    session.jumpVelocity = undefined;
    session.jump = false;
    if (session.keys.has('KeyS') && !session.grounded) nextY = Math.max(nextY, 300);
    const carried = support?.conveyor ?? (cloudSupport ? (blockX(cloudSupport, g.time) - blockX(cloudSupport, g.time - 1000 / 60)) * 60 : 0);
    const nextX = direction * 190 + carried;
    if (nextX !== vx || nextY !== vy) setLinearVelocity2D(body, [nextX, nextY]);
    if (direction) facing.set(direction < 0);
    session.playerState = player.snapshot.get().value;
    if (px < 0 || px > 456) teleportBody2D(body, { position: [Math.max(0, Math.min(456, px)), py], rotationDegrees: 0 });
    advanceEndlessWorld(g, py, 1000 / 60);
    const tier = Math.max(0, Math.floor((520 - py) / 240));
    if (session.grounded && tier > g.tier) { g.tier = tier; g.checkpoint = { x: px, y: py - 2 }; }
    for (const coin of [...g.coinsLeft]) if (Math.abs(px + 12 - coin.x) < 27 && Math.abs(py + 20 - coin.y) < 36) {
      g.coinsLeft = g.coinsLeft.filter(c => c.id !== coin.id); session.flow.send({ type: 'COLLECT', amount: 1 });
      g.flights.push({ id: g.nextId++, x: coin.x, y: coin.y - g.camera });
    }
    g.debris = g.debris.filter(d => g.time - d.born < 1600);
    if (py - g.camera >= 640) {
      session.deathPosition = { x: px + 12, y: Math.min(610, py - g.camera) };
      session.presentation = 'dying';
      session.keys.clear();
      session.jump = false;
      session.boostUntil = 0;
    }
    session.revision.update(v => v + 1); session.onUpdate();
  } });
  return <Group physics={dynamicBody2D({ handle: body, mass: 1, collider: false, fixedRotation: true, ccd: true })} style={{ translateX: spawn.x, translateY: spawn.y }}>
    <Rectangle style={{ width: 24, height: 40 }} physics={playerCollider2D()} />
    <Group style={{ translateX: -9, translateY: -12 }}>
      <Sprite frame={frame} flipX={facing} sampling="nearest" style={{ width: 42, height: 52 }} />
    </Group>
  </Group>;
}
function SpawnArrival({ session }: { session: GameSession }) {
  const transition = useVisibilityTransition({ initial: false, enter: bifrost({ region: { x: -21, y: -52, width: 42, height: 52 }, entry: { x: 0, y: -700 } }), duration: 850 });
  useReaction(() => {
    let active = true;
    let cancelResume = () => {};
    queueMicrotask(() => {
      if (!active) return;
      void transition.show().then(result => {
      if (active && result.status === 'finished') {
        cancelResume = whenGameResumed(session, () => {
          if (!active) return;
          session.presentation = undefined;
          session.revision.update(value => value + 1);
        });
      }
      });
    });
    return () => { active = false; cancelResume(); };
  }, []);
  return <Group style={{ translateX: session.game.checkpoint.x + 12, translateY: session.game.checkpoint.y + 40 - session.game.camera }}>
    <Group style={{ transition: transition.binding }}>
      <Group style={{ translateX: -21, translateY: -52 }}><Sprite frame={session.sheet.frames.standing} sampling="nearest" style={{ width: 42, height: 52 }} /></Group>
    </Group>
  </Group>;
}
function DeathFlight({ session }: { session: GameSession }) {
  const origin = session.deathPosition ?? { x: 240, y: 610 };
  const x = useSignal(origin.x), y = useSignal(origin.y), scale = useSignal(1), rotation = useSignal(-12);
  useGamePlayback(session, parallel(
    drive(x, tween({ from: origin.x, to: 240, duration: 450 })),
    sequence(drive(y, tween({ from: origin.y, to: 240, duration: 450 })), drive(y, tween({ from: 240, to: 960, duration: 750 }))),
    drive(scale, tween({ from: 1, to: 5.5, duration: 1200 })),
    drive(rotation, tween({ from: -12, to: 20, duration: 1200 })),
  ), { autoplay: true, onEvent: event => {
    if (event.type !== 'finish') return;
    session.flow.send({ type: 'LIFE_LOST' });
    session.onUpdate();
    session.revision.update(value => value + 1);
  } });
  // Translate the camera-facing sprite separately: Group scales/rotates its own translation.
  return <Group style={{ translateX: x, translateY: y }}>
    <Group style={{ scaleX: scale, scaleY: scale, rotationDegrees: rotation }}>
      <Group style={{ translateX: -21, translateY: -26 }}>
        <Sprite frame={session.sheet.frames['skid-1'] ?? session.sheet.frames.standing} sampling="nearest" style={{ width: 42, height: 52 }} />
      </Group>
    </Group>
  </Group>;
}
export function GameScene({ session }: { session: GameSession }) {
  return session.flow.snapshot.get().matches('playing') ? <PlayingScene session={session} /> : <Rectangle style={{ width: 480, height: 640, fill: '#142f3c' }} />;
}
function PlayingScene({ session }: { session: GameSession }) {
  session.revision.get();
  const g = session.game;
  const moving = new Map<number, Block[]>();
  for (const block of g.blocks) if (block.platformId !== undefined) {
    const group = moving.get(block.platformId) ?? []; group.push(block); moving.set(block.platformId, group);
  }
  const coin = useSignal(session.sheet.frames['coin-0']);
  const springFrame = useSignal(session.sheet.frames.trampoline);
  const leftBelt = useSignal(session.sheet.frames.conveyor ?? session.sheet.frames.stone);
  const rightBelt = useSignal(session.sheet.frames.conveyor ?? session.sheet.frames.stone);
  const leftCapLeft = useSignal(session.sheet.frames['conveyor-left'] ?? session.sheet.frames.conveyor ?? session.sheet.frames.stone);
  const leftCapRight = useSignal(session.sheet.frames['conveyor-right'] ?? session.sheet.frames.conveyor ?? session.sheet.frames.stone);
  const rightCapLeft = useSignal(session.sheet.frames['conveyor-left'] ?? session.sheet.frames.conveyor ?? session.sheet.frames.stone);
  const rightCapRight = useSignal(session.sheet.frames['conveyor-right'] ?? session.sheet.frames.conveyor ?? session.sheet.frames.stone);
  const cloudBlock = useSignal(session.sheet.frames['cloud-block'] ?? session.sheet.frames.stone);
  const terrainFrames = { left: leftBelt, right: rightBelt, leftCapLeft, leftCapRight, rightCapLeft, rightCapRight, cloud: cloudBlock };
  const belt = session.sheet.animations.conveyor ?? defineSpriteAnimation({ frames: [session.sheet.frames.stone], fps: 1 });
  const capLeft = session.sheet.animations['conveyor-left'] ?? belt;
  const capRight = session.sheet.animations['conveyor-right'] ?? belt;
  useGamePlayback(session, parallel(
    repeat(drive(leftBelt, belt), { iterations: Infinity, direction: 'reverse' }),
    repeat(drive(rightBelt, belt), { iterations: Infinity }),
    repeat(drive(leftCapLeft, capLeft), { iterations: Infinity, direction: 'reverse' }),
    repeat(drive(leftCapRight, capRight), { iterations: Infinity, direction: 'reverse' }),
    repeat(drive(rightCapLeft, capLeft), { iterations: Infinity }),
    repeat(drive(rightCapRight, capRight), { iterations: Infinity }),
    repeat(drive(cloudBlock, session.sheet.animations['cloud-block'] ?? defineSpriteAnimation({ frames: [session.sheet.frames.stone], fps: 1 })), { iterations: Infinity }),
    repeat(drive(coin, session.sheet.animations.spin), { iterations: Infinity }),
    repeat(drive(springFrame, session.sheet.animations.spring ?? defineSpriteAnimation({ frames: [session.sheet.frames.trampoline], fps: 1 })), { iterations: Infinity }),
  ), { autoplay: true });
  return <>
    <Rectangle style={{ width: 480, height: 640, fill: '#142f3c' }} />
    <Clouds session={session} />
    {Array.from({ length: 12 }, (_, i) => <Rectangle key={`star:${i}`} style={{ left: (i * 97) % 480, top: ((i * 73 - g.camera * 0.15) % 640 + 640) % 640, width: 2, height: 2, fill: '#719798' }} />)}
    <Group style={{ translateY: -g.camera }}>
      <PhysicsWorld2D space="local" gravity={[0, 1050]}>
        {g.blocks.filter(block => block.platformId === undefined).map(block => <Brick key={`block:${block.id}`} block={block} session={session} frames={terrainFrames} />)}
        {[...moving].map(([id, blocks]) => <CloudPlatform key={`platform:${id}`} blocks={blocks} session={session} frames={terrainFrames} />)}
        {g.trampolines.map(spring => <Spring key={`spring:${spring.id}`} spring={spring} frame={springFrame} />)}
        {g.coinsLeft.map(item => <Group key={`coin:${item.id}`} style={{ translateX: item.x - 12, translateY: item.y - 12 }}><Sprite frame={coin} style={{ width: 24, height: 24 }} sampling="nearest" /></Group>)}
        {g.debris.map(fragment => <Fragment key={`fragment:${fragment.id}`} fragment={fragment} sheet={session.sheet} session={session} />)}
        {!session.presentation && <Player session={session} />}
      </PhysicsWorld2D>
    </Group>
    {session.presentation === 'spawning' && <SpawnArrival session={session} />}
    {session.presentation === 'dying' && <DeathFlight session={session} />}
    {g.flights.map(flight => <FlyingCoin key={`flight:${flight.id}`} flight={flight} session={session} />)}
    <Rectangle style={{ width: 480, height: 58, fill: '#0c2029', opacity: 0.96 }} />
    <Text style={{ left: 20, top: 20, fill: '#fff2cf', font: '17px monospace' }}>SCORE {String(g.score).padStart(6, '0')}</Text>
    <Text style={{ left: 270, top: 20, fill: '#ffd777', font: '17px monospace' }}>{g.coins} COINS</Text>
    <Text style={{ left: 395, top: 20, fill: '#ff987b', font: '17px monospace' }}>♥ {g.lives}</Text>
  </>;
}
