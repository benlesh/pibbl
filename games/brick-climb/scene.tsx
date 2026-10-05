import { Group, Rectangle, Text, drive, repeat, sequence, wait, marker, tween, parallel, usePlayback, useSignal, useReaction, useRef, type WritableSignal } from '@pibbl/core';
import { Sprite, type SpriteSheet } from '@pibbl/core/sprites';
import { PhysicsWorld2D, pibblPhysicsBody2D, dynamicBody2D, staticBody2D, collider2D, setLinearVelocity2D, teleportBody2D, type PibblPhysicsBodyHandle2D } from '@pibbl/core/physics/2d';
import { awardCoins, breakBrick, type GameState, type Block, type Debris, type Flight } from './model';

export interface GameSession {
  game: GameState; revision: WritableSignal<number>; keys: Set<string>; jump: boolean;
  body?: PibblPhysicsBodyHandle2D; grounded: boolean; sheet: SpriteSheet;
  onUpdate: () => void;
}
function Brick({ block, session }: { block: Block; session: GameSession }) {
  return <Group style={{ translateX: block.x, translateY: block.y }} physics={staticBody2D({ collider: false })}>
    <Rectangle style={{ width: block.width, height: 24 }} physics={collider2D({ tag: `block:${block.id}`, friction: 0, onCollisionStart: event => {
      if (event.otherTag !== 'player') return;
      if (event.normal[1] > 0.6) session.grounded = true;
      if (block.brick && event.normal[1] < -0.6) {
        const brick = breakBrick(session.game, block.id);
        if (brick) {
          awardCoins(session.game, 5);
          session.game.flights.push({ id: session.game.nextId++, x: brick.x + 30, y: brick.y - session.game.camera });
          session.revision.update(value => value + 1); session.onUpdate();
        }
      }
    }, onCollisionEnd: event => { if (event.otherTag === 'player' && event.normal[1] > 0.6) session.grounded = false; } })} />
    <Sprite frame={session.sheet.frames[block.brick ? 'brick' : 'stone']} sampling="nearest" style={{ width: block.width, height: 24 }} pointerEvents="none" />
  </Group>;
}
function Fragment({ fragment, sheet }: { fragment: Debris; sheet: SpriteSheet }) {
  return <Group style={{ translateX: fragment.x, translateY: fragment.y }} physics={dynamicBody2D({ mass: 0.1, collider: false, linearVelocity: [fragment.vx, fragment.vy], angularVelocityDegreesPerSecond: fragment.vx * 3 })}>
    <Rectangle style={{ width: 12, height: 10 }} physics={collider2D({ sensor: true })} />
    <Sprite frame={sheet.frames[`shard-${fragment.id % 2}`]} sampling="nearest" style={{ width: 14, height: 12 }} />
  </Group>;
}
function FlyingCoin({ flight, session }: { flight: Flight; session: GameSession }) {
  const x = useSignal(flight.x), y = useSignal(flight.y);
  const frame = useSignal(session.sheet.frames['coin-0']);
  usePlayback(parallel(
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
  const walkFrame = useSignal(session.sheet.frames.standing);
  const facing = useSignal(false);
  const state = useSignal('idle');
  const lastX = useRef(0);
  usePlayback(repeat(drive(walkFrame, session.sheet.animations.walk), { iterations: Infinity }), { autoplay: true });
  useReaction(() => { session.body = body; return () => { session.body = undefined; }; }, []);
  usePlayback(repeat(sequence(wait(1000 / 60), marker('tick')), { iterations: Infinity }), { autoplay: true, onEvent: event => {
    if (event.type !== 'marker' || session.game.phase !== 'playing' || !body.enabled.get()) return;
    const g = session.game;
    g.time += 1000 / 60;
    const [px, py] = body.position.get();
    const [vx, vy] = body.linearVelocity.get();
    // Geometric feet support supplements contact notifications across adjacent blocks.
    session.grounded = Math.abs(vy) < 20 && g.blocks.some(b => px + 24 > b.x && px < b.x + b.width && Math.abs(py + 40 - b.y) < 4);
    const direction = Number(session.keys.has('KeyD')) - Number(session.keys.has('KeyA'));
    let nextY = vy;
    if (session.jump && session.grounded) { nextY = -560; session.grounded = false; }
    session.jump = false;
    if (session.keys.has('KeyS') && !session.grounded) nextY = Math.max(nextY, 300);
    const nextX = direction * 190;
    if (nextX !== vx || nextY !== vy) setLinearVelocity2D(body, [nextX, nextY]);
    if (direction) facing.set(direction < 0);
    state.set(!session.grounded ? (vy < -30 ? 'jump' : 'fall') : direction ? 'walk' : 'idle');
    lastX.current = px;
    if (px < 0 || px > 456) teleportBody2D(body, { position: [Math.max(0, Math.min(456, px)), py], rotationDegrees: 0 });
    g.camera = Math.min(g.camera, py - 270);
    const tier = Math.min(8, Math.max(0, Math.floor((500 - py) / 180)));
    if (session.grounded && tier > g.tier) { g.tier = tier; g.checkpoint = { x: px, y: py - 2 }; }
    for (const coin of [...g.coinsLeft]) if (Math.abs(px + 12 - coin.x) < 27 && Math.abs(py + 20 - coin.y) < 36) {
      g.coinsLeft = g.coinsLeft.filter(c => c.id !== coin.id); awardCoins(g, 1);
      g.flights.push({ id: g.nextId++, x: coin.x, y: coin.y - g.camera });
    }
    g.debris = g.debris.filter(d => g.time - d.born < 1600);
    if (py - g.camera > 670) {
      g.lives--;
      if (!g.lives) g.phase = 'over';
      else { teleportBody2D(body, { position: [g.checkpoint.x, g.checkpoint.y], rotationDegrees: 0 }); setLinearVelocity2D(body, [0, 0]); g.camera = Math.min(0, g.checkpoint.y - 420); }
    }
    if (py < -900) g.phase = 'won';
    session.revision.update(v => v + 1); session.onUpdate();
  } });
  const pose = state.get();
  return <Group physics={dynamicBody2D({ handle: body, mass: 1, collider: false, fixedRotation: true, ccd: true })} style={{ translateX: session.game.checkpoint.x, translateY: session.game.checkpoint.y }}>
    <Rectangle style={{ width: 24, height: 40 }} physics={collider2D({ friction: 0, restitution: 0, tag: 'player' })} />
    <Group style={{ translateX: -9, translateY: -12 }}>
      <Sprite frame={pose === 'walk' ? walkFrame : session.sheet.frames[pose === 'idle' ? 'standing' : pose]} flipX={facing} sampling="nearest" style={{ width: 42, height: 52 }} />
    </Group>
  </Group>;
}
export function GameScene({ session }: { session: GameSession }) {
  session.revision.get();
  const g = session.game;
  const coin = useSignal(session.sheet.frames['coin-0']);
  usePlayback(repeat(drive(coin, session.sheet.animations.spin), { iterations: Infinity }), { autoplay: true });
  return <>
    <Rectangle style={{ width: 480, height: 640, fill: '#142f3c' }} />
    {Array.from({ length: 12 }, (_, i) => <Rectangle key={i} style={{ left: (i * 97) % 480, top: ((i * 73 - g.camera * 0.15) % 640 + 640) % 640, width: 2, height: 2, fill: '#719798' }} />)}
    <Group style={{ translateY: -g.camera }}>
      <PhysicsWorld2D space="local" gravity={[0, 1050]}>
        {g.blocks.map(block => <Brick key={block.id} block={block} session={session} />)}
        {g.coinsLeft.map(item => <Group key={item.id} style={{ translateX: item.x - 12, translateY: item.y - 12 }}><Sprite frame={coin} style={{ width: 24, height: 24 }} sampling="nearest" /></Group>)}
        {g.debris.map(fragment => <Fragment key={fragment.id} fragment={fragment} sheet={session.sheet} />)}
        <Player session={session} />
      </PhysicsWorld2D>
    </Group>
    {g.flights.map(flight => <FlyingCoin key={flight.id} flight={flight} session={session} />)}
    <Rectangle style={{ width: 480, height: 58, fill: '#0c2029', opacity: 0.96 }} />
    <Text style={{ left: 20, top: 20, fill: '#fff2cf', font: '17px monospace' }}>SCORE {String(g.score).padStart(6, '0')}</Text>
    <Text style={{ left: 270, top: 20, fill: '#ffd777', font: '17px monospace' }}>{g.coins} COINS</Text>
    <Text style={{ left: 395, top: 20, fill: '#ff987b', font: '17px monospace' }}>♥ {g.lives}</Text>
  </>;
}
