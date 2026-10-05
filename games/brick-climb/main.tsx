import { pibbl, signal, drive, repeat, usePlayback, useSignal, Group, Text, Rectangle, type PibblController } from '@pibbl/core';
import { Sprite, loadSpriteSheet, defineSpriteAnimation, type SpriteSheet } from '@pibbl/core/sprites';
import { aseprite } from '@pibbl/core/sprites/formats/aseprite';
import atlasUrl from './assets/sprites.json?url';
import characterUrl from './assets/character-v2.json?url';
import coinUrl from './assets/coins-v3.json?url';
import atlasImage from './assets/sprites.png?url';
import characterImage from './assets/character-v2.png?url';
import coinImage from './assets/coins-v3.png?url';
import sceneryImage from './assets/scenery.svg?url';
import terrainImage from './assets/terrain.svg?url';
import './style.css';
import { createMachine } from '@pibbl/core/machines';
import { sessionMachine } from './machines';
import { createGame, respawnPoint } from './model';
import { setGamePaused } from './pause';
import { GameScene, type GameSession } from './scene';
const app = document.getElementById('app')!;
app.innerHTML = `<header><a href="/">Pibbl / PLAY LAB</a><span>01 — SPRITES + PHYSICS</span><a href="?preview">SPRITE INSPECTOR ↗</a></header><main><aside><p class="eyebrow">A LITTLE UPWARD ADVENTURE</p><h1>BRICK<br><em>CLIMB.</em></h1><p>Break a path.<br>Find your footing.<br>Keep going up.</p><div class="controls"><p><kbd>A</kbd> <kbd>D</kbd> Move</p><p><kbd>W</kbd> / <kbd>SPACE</kbd> Hold to jump higher</p><p><kbd>S</kbd> Fast fall</p><p><kbd>ESC</kbd> Pause</p></div><small>500 coins = one extra life.<br>Hit bricks from underneath.<br>Land on gold trampolines to launch.<br>Desktop keyboard · original sprite art</small></aside><section class="cabinet"><div class="cabinet-top"><span>THE ASCENT</span><span id="level">TIER 01</span></div><div class="screen"><canvas width="480" height="640" tabindex="0" aria-label="Brick Climb game. A and D move, W or Space jumps, S falls faster."></canvas><div id="splash"><p class="eyebrow">READY TO MAKE A BREAK?</p><h2>Up is the<br>only way.</h2><p>Jump beneath bricks to break them.<br>Keep ahead of the rising screen.</p><button id="start">LET’S CLIMB →</button><small>Click to begin, then use your keyboard.</small></div></div><div class="cabinet-bottom"><span id="status">PRESS START</span><button id="restart">RESTART ↻</button></div></section><aside class="notes"><p class="eyebrow">HOW IT WORKS</p><h3>Small sprites.<br>Real physics.</h3><p>Belts carry you with their tread. Cloud platforms drift. Gray stone stays still and stops a boost. Every fragment is a physical body. Every animated frame runs on Pibbl’s shared clock.</p><div class="rule"></div><p class="eyebrow">THE GOAL</p><p>Climb as high as you can. The screen keeps rising. Falling below it costs a life.</p><a href="?preview">Inspect the sprite frames →</a></aside></main><footer>BUILT WITH Pibbl <span>Canvas 2D · Signals · Animation · Physics</span></footer>`;
const canvas = document.querySelector('canvas')!;
const splash = document.getElementById('splash')!;
const screen = document.querySelector('.screen')!;
let pauseOverlay: HTMLDivElement | undefined;

function removePauseOverlay() {
  pauseOverlay?.remove();
  pauseOverlay = undefined;
}

function resume() {
  if (!session) return;
  setGamePaused(session, false);
  removePauseOverlay();
  canvas.focus();
}

function pause() {
  if (!session || session.game.phase !== 'playing' || session.paused) return;
  session.keys.clear();
  session.jump = false;
  setGamePaused(session, true);
  pauseOverlay = document.createElement('div');
  pauseOverlay.className = 'pause-overlay';
  pauseOverlay.style.cssText = 'position:absolute;inset:0;display:grid;place-items:center;overflow:hidden;background:#102832;color:#fff2cf;text-align:center';
  pauseOverlay.innerHTML = `<img alt="Frozen game screen"><div><p class="eyebrow">PAUSED</p><h2>Take a breath.</h2><button type="button" data-resume>RESUME →</button><button type="button" data-restart>RESTART ↻</button></div>`;
  const frozen = pauseOverlay.querySelector('img')!;
  frozen.src = canvas.toDataURL();
  frozen.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;opacity:.28;image-rendering:pixelated');
  const controls = pauseOverlay.querySelector('div')!;
  controls.setAttribute('style', 'position:relative;display:grid;gap:14px');
  pauseOverlay.querySelector('[data-resume]')!.addEventListener('click', resume);
  pauseOverlay.querySelector('[data-restart]')!.addEventListener('click', start);
  screen.appendChild(pauseOverlay);
  pauseOverlay.querySelector<HTMLButtonElement>('[data-resume]')!.focus();
}
// Import images explicitly: small metadata files may become data URLs in a build,
// so relative image paths inside their JSON cannot be used as a URL base.
const assets = [[atlasUrl, atlasImage], [characterUrl, characterImage], [coinUrl, coinImage]];
const loaded = await Promise.allSettled([...assets.map(([url, image]) => {
  const parser = aseprite();
  return loadSpriteSheet(url, { format: { parse(data) {
    return { ...parser.parse(data), images: [new URL(image, document.baseURI).href] };
  } } });
}), loadSpriteSheet(sceneryImage, { grid: { frameWidth: 64, frameHeight: 32 } }), loadSpriteSheet(terrainImage, { grid: { frameWidth: 40, frameHeight: 40 } })]);
const sheets = loaded.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
const failure = loaded.find(result => result.status === 'rejected');
if (failure?.status === 'rejected') {
  sheets.forEach(resource => resource.dispose());
  throw failure.reason;
}
const sheet: SpriteSheet = { frames: Object.freeze(Object.assign({}, ...sheets.map(s => s.frames), { 'cloud-0': sheets[3].frames[0], 'cloud-1': sheets[3].frames[4], trampoline: sheets[3].frames[8], conveyor: sheets[4].frames[0], 'conveyor-left': sheets[4].frames[4], 'conveyor-right': sheets[4].frames[8], 'cloud-block': sheets[4].frames[12] })), animations: Object.freeze(Object.assign({}, ...sheets.map(s => s.animations), Object.fromEntries(['cloud-0', 'cloud-1', 'spring'].map((name, row) => [name, defineSpriteAnimation({ frames: Array.from({ length: 4 }, (_, column) => sheets[3].frames[row * 4 + column]), fps: row < 2 ? 3 : 6 })])), Object.fromEntries(['conveyor', 'conveyor-left', 'conveyor-right', 'cloud-block'].map((name, row) => [name, defineSpriteAnimation({ frames: Array.from({ length: 4 }, (_, column) => sheets[4].frames[row * 4 + column]), fps: row === 3 ? 3 : 8 })])))), dispose: () => sheets.forEach(s => s.dispose()) };
let controller: PibblController | undefined;
let session: GameSession;
const preview = new URLSearchParams(location.search).has('preview');
function update() {
  const g = session.game;
  const snapshot = session.flow.snapshot.get();
  Object.assign(g, snapshot.context, { phase: snapshot.value });
  document.getElementById('level')!.textContent = `TIER ${String(g.tier + 1).padStart(2, '0')}`;
  document.getElementById('status')!.textContent = g.phase === 'playing' ? 'BREAK · JUMP · COLLECT' : g.phase.toUpperCase();
  if (g.phase === 'over') {
    splash.hidden = false;
    splash.querySelector('h2')!.innerHTML = 'One more<br>climb?';
    splash.querySelector('p:not(.eyebrow)')!.textContent = `Score ${g.score} · ${g.coins} coins collected`;
    document.getElementById('start')!.textContent = 'CLIMB AGAIN →';
    session.keys.clear();
  }
}
function start() {
  removePauseOverlay();
  controller?.dispose();
  session?.flow.stop();
  const flow = createMachine(sessionMachine, { input: { respawn: () => {
    respawnPoint(session.game);
    session.presentation = 'spawning';
    session.boostUntil = 0;
    session.previousPosition = undefined;
    session.grounded = false;
    session.jump = false;
    session.jumpVelocity = undefined;
  } } });
  session = { game: createGame(), revision: signal(0), keys: new Set(), jump: false, grounded: false, boostUntil: 0, presentation: 'spawning', sheet, flow, onUpdate: update };
  flow.start(); flow.send({ type: 'START' }); update(); splash.hidden = true;
  controller = pibbl(canvas, <GameScene session={session} />); canvas.focus(); update();
}
document.getElementById('start')!.addEventListener('click', start);
document.getElementById('restart')!.addEventListener('click', start);
window.addEventListener('keydown', event => {
  if (!session || session.game.phase !== 'playing') return;
  if (event.code === 'Escape') {
    event.preventDefault();
    if (event.repeat) return;
    session.paused ? resume() : pause();
    return;
  }
  if (document.activeElement !== canvas || session.presentation || session.paused || !['KeyA', 'KeyD', 'KeyW', 'KeyS', 'Space'].includes(event.code)) return;
  event.preventDefault(); session.keys.add(event.code);
  if (!event.repeat && (event.code === 'KeyW' || event.code === 'Space')) session.jump = true;
});
canvas.addEventListener('keyup', event => { session?.keys.delete(event.code); });
canvas.addEventListener('blur', () => { session?.keys.clear(); if (session) session.jump = false; });
function Preview() {
  const frame = useSignal(sheet.frames['run-0']);
  const coin = useSignal(sheet.frames['coin-0']);
  usePlayback(repeat(drive(frame, sheet.animations.walk), { iterations: Infinity }), { autoplay: true });
  usePlayback(repeat(drive(coin, sheet.animations.spin), { iterations: Infinity }), { autoplay: true });
  const names = ['standing', 'idle-1', ...Array.from({ length: 6 }, (_, i) => `run-${i}`), 'jump', 'fall', 'skid-0', 'skid-1', ...Array.from({ length: 8 }, (_, i) => `coin-${i}`), 'brick', 'stone', 'shard-0', 'shard-1'].filter(name => sheet.frames[name]);
  return <>
    <Rectangle style={{ width: 480, height: 640, fill: '#142f3c' }} />
    <Group style={{ translateX: 110, translateY: 20 }}><Sprite frame={frame} sampling="nearest" style={{ width: 96, height: 120 }} /></Group>
    <Group style={{ translateX: 280, translateY: 50 }}><Sprite frame={coin} sampling="nearest" style={{ width: 72, height: 72 }} /></Group>
    <Text style={{ left: 25, top: 156, fill: '#fff2cf', font: '12px monospace' }}>6 run poses · 2 airborne poses · 8 coin frames</Text>
    {names.map((name, index) => <Group key={name} style={{ translateX: 16 + index % 6 * 77, translateY: 190 + Math.floor(index / 6) * 96 }}>
      <Rectangle style={{ width: 65, height: 69, fill: '#23434b' }} />
      <Sprite frame={sheet.frames[name]} sampling="nearest" style={{ width: 56, height: 60 }} />
      <Text style={{ left: 2, top: 75, fill: '#fff2cf', font: '10px monospace' }}>{name}</Text>
    </Group>)}
  </>;
}
if (preview) { splash.hidden = true; document.getElementById('level')!.textContent = 'FRAME INSPECTOR'; controller = pibbl(canvas, <Preview />); }
window.addEventListener('pagehide', () => { controller?.dispose(); session?.flow.stop(); sheet.dispose(); });
// Read-only diagnostics for the same manually playable scene.
Object.defineProperty(window, 'brickClimb', { value: { observe: () => session ? { phase: session.game.phase, coins: session.game.coins, lives: session.game.lives, score: session.game.score, bricks: session.game.blocks.filter(b => b.brick).length, debris: session.game.debris.length, camera: session.game.camera, position: session.body?.position.get(), velocity: session.body?.linearVelocity.get(), grounded: session.grounded, playerState: session.playerState, machineStatus: session.flow.snapshot.get().status, presentation: session.presentation, paused: !!session.paused, boosting: session.boostUntil > session.game.time, trampolines: session.game.trampolines.map(item => ({ ...item })) } : { phase: 'start' } } });
