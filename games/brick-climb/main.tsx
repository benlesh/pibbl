import { pibbl, signal, drive, repeat, usePlayback, useSignal, Group, type PibblController } from '@pibbl/core';
import { Sprite, loadSpriteSheet, type SpriteSheet } from '@pibbl/core/sprites';
import { aseprite } from '@pibbl/core/sprites/formats/aseprite';
import atlasUrl from './assets/sprites.json?url';
import characterUrl from './assets/character-v2.json?url';
import coinUrl from './assets/coins-v3.json?url';
import './style.css';
import { createGame } from './model';
import { GameScene, type GameSession } from './scene';
const app = document.getElementById('app')!;
app.innerHTML = `<header><a href="/">Pibbl / PLAY LAB</a><span>01 — SPRITES + PHYSICS</span><a href="?preview">SPRITE INSPECTOR ↗</a></header><main><aside><p class="eyebrow">A LITTLE UPWARD ADVENTURE</p><h1>BRICK<br><em>CLIMB.</em></h1><p>Break a path.<br>Find your footing.<br>Keep going up.</p><div class="controls"><p><kbd>A</kbd> <kbd>D</kbd> Move</p><p><kbd>W</kbd> / <kbd>SPACE</kbd> Jump</p><p><kbd>S</kbd> Fast fall</p></div><small>100 coins = one extra life.<br>Hit bricks from underneath.<br>Desktop keyboard · original sprite art</small></aside><section class="cabinet"><div class="cabinet-top"><span>THE ASCENT</span><span id="level">TIER 01 / 08</span></div><div class="screen"><canvas width="480" height="640" tabindex="0" aria-label="Brick Climb game. A and D move, W or Space jumps, S falls faster."></canvas><div id="splash"><p class="eyebrow">READY TO MAKE A BREAK?</p><h2>Up is the<br>only way.</h2><p>Jump beneath bricks to break them.<br>Use the remaining platforms to climb.</p><button id="start">LET’S CLIMB →</button><small>Click to begin, then use your keyboard.</small></div></div><div class="cabinet-bottom"><span id="status">PRESS START</span><button id="restart">RESTART ↻</button></div></section><aside class="notes"><p class="eyebrow">HOW IT WORKS</p><h3>Small sprites.<br>Real physics.</h3><p>Every falling brick fragment is a physical body. Every animated frame runs on Pibbl’s shared clock.</p><div class="rule"></div><p class="eyebrow">THE GOAL</p><p>Reach the top of eight brick tiers. A fall costs a life. Land higher to save a checkpoint.</p><a href="?preview">Inspect the sprite frames →</a></aside></main><footer>BUILT WITH Pibbl <span>Canvas 2D · Signals · Animation · Physics</span></footer>`;
const canvas = document.querySelector('canvas')!;
const splash = document.getElementById('splash')!;
const sheets = await Promise.all([atlasUrl, characterUrl, coinUrl].map(url => loadSpriteSheet(url, { format: aseprite() })));
const sheet: SpriteSheet = { frames: Object.freeze(Object.assign({}, ...sheets.map(s => s.frames))), animations: Object.freeze(Object.assign({}, ...sheets.map(s => s.animations))), dispose: () => sheets.forEach(s => s.dispose()) };
let controller: PibblController | undefined;
let session: GameSession;
const preview = new URLSearchParams(location.search).has('preview');
function update() {
  const g = session.game;
  document.getElementById('level')!.textContent = `TIER ${String(g.tier + 1).padStart(2, '0')} / 08`;
  document.getElementById('status')!.textContent = g.phase === 'playing' ? 'BREAK · JUMP · COLLECT' : g.phase.toUpperCase();
  if (g.phase === 'over' || g.phase === 'won') {
    splash.hidden = false;
    splash.querySelector('h2')!.innerHTML = g.phase === 'won' ? 'Top of<br>the world.' : 'One more<br>climb?';
    splash.querySelector('p:not(.eyebrow)')!.textContent = `Score ${g.score} · ${g.coins} coins collected`;
    document.getElementById('start')!.textContent = 'CLIMB AGAIN →';
    session.keys.clear();
  }
}
function start() {
  controller?.dispose();
  session = { game: createGame(), revision: signal(0), keys: new Set(), jump: false, grounded: false, sheet, onUpdate: update };
  session.game.phase = 'playing'; splash.hidden = true;
  controller = pibbl(canvas, <GameScene session={session} />); canvas.focus(); update();
}
document.getElementById('start')!.addEventListener('click', start);
document.getElementById('restart')!.addEventListener('click', start);
canvas.addEventListener('keydown', event => {
  if (!session || session.game.phase !== 'playing' || !['KeyA', 'KeyD', 'KeyW', 'KeyS', 'Space'].includes(event.code)) return;
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
  return <>
    <Group style={{ translateX: 110, translateY: 20 }}><Sprite frame={frame} sampling="nearest" style={{ width: 96, height: 120 }} /></Group>
    <Group style={{ translateX: 280, translateY: 50 }}><Sprite frame={coin} sampling="nearest" style={{ width: 72, height: 72 }} /></Group>
    {Object.values(sheet.frames).map((f, index) => <Group key={f.name} style={{ translateX: 16 + index % 6 * 77, translateY: 170 + Math.floor(index / 6) * 90 }}><Sprite frame={f} sampling="nearest" style={{ width: 60, height: 75 }} /></Group>)}
  </>;
}
if (preview) { splash.hidden = true; document.getElementById('level')!.textContent = 'FRAME INSPECTOR'; controller = pibbl(canvas, <Preview />); }
window.addEventListener('pagehide', () => { controller?.dispose(); sheet.dispose(); });
// Read-only diagnostics for the same manually playable scene.
Object.defineProperty(window, 'brickClimb', { value: { observe: () => session ? { phase: session.game.phase, coins: session.game.coins, lives: session.game.lives, score: session.game.score, bricks: session.game.blocks.filter(b => b.brick).length, debris: session.game.debris.length, camera: session.game.camera, position: session.body?.position.get(), velocity: session.body?.linearVelocity.get(), grounded: session.grounded } : { phase: 'start' } } });
