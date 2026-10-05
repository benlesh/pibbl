export const BLOCK_SIZE = 40;
/** A shared horizontal path for every tile in one moving stone ledge. */
export interface PlatformMotion { amplitude: number; period: number; phase: number }
/** One square terrain tile. Moving ledges share both platformId and motion. */
export interface Block { id: number; x: number; y: number; width: number; height: number; brick: boolean; platformId?: number; motion?: PlatformMotion; /** Signed pixels per second for a static conveyor belt. */ conveyor?: number }
export interface Coin { id: number; x: number; y: number }
export interface Trampoline { id: number; x: number; y: number }
export interface Debris { id: number; x: number; y: number; vx: number; vy: number; born: number }
export interface Flight { id: number; x: number; y: number }
export interface GameState {
  phase: 'start' | 'playing' | 'over'; score: number; coins: number; lives: number;
  camera: number; checkpoint: { x: number; y: number }; tier: number; time: number;
  blocks: Block[]; coinsLeft: Coin[]; trampolines: Trampoline[]; debris: Debris[]; flights: Flight[]; nextId: number;
  nextTier: number;
}

const WORLD_WIDTH = 480;
const PLAYER_WIDTH = 24;
const PLAYER_HEIGHT = 40;
const TIER_SPACING = 240;
const GENERATE_AHEAD = 1_280;
const PRUNE_BELOW = 900;
const CAMERA_SPEED = 12;
const CAMERA_SPEED_CAP = 70;
const CAMERA_HEADROOM = 270;

function tierY(tier: number): number { return 400 - tier * TIER_SPACING; }

/** Returns a tile's world x position at a logical game time. */
export function blockX(block: Block, time: number): number {
  if (!block.motion) return block.x;
  const { amplitude, period, phase } = block.motion;
  return block.x + amplitude * Math.sin(time / period * Math.PI * 2 + phase);
}

function cameraSpeed(camera: number): number {
  return Math.min(CAMERA_SPEED_CAP, CAMERA_SPEED + Math.max(0, -camera) / 80);
}

/** A stable tiny integer hash for generation; it is independent of gameplay IDs. */
function randomAt(tier: number, salt: number): number {
  let value = (tier + 1) * 0x9e3779b1 + salt * 0x85ebca6b;
  value = Math.imul(value ^ value >>> 16, 0x7feb352d);
  value = Math.imul(value ^ value >>> 15, 0x846ca6b);
  return ((value ^ value >>> 16) >>> 0) / 0x1_0000_0000;
}

function generateTier(game: GameState, tier: number): void {
  const y = tierY(tier);
  let ledgeWidth = 2 + Math.floor(randomAt(tier, 1) * 3);
  let ledgeX = randomAt(tier, 2) < 0.5 ? 40 : 480 - 40 - ledgeWidth * BLOCK_SIZE;
  const moving = tier > 2 && tier % 3 === 0;
  const conveyor = tier > 2 && tier % 3 === 1 ? (tier % 2 ? 65 : -65) : undefined;
  if (conveyor !== undefined) ledgeWidth = Math.max(3, ledgeWidth);
  const platformId = moving ? game.nextId : undefined;
  const amplitude = 60 + Math.floor(randomAt(tier, 3) * 41);
  if (moving) ledgeX = Math.max(amplitude + 8, Math.min(480 - ledgeWidth * BLOCK_SIZE - amplitude - 8, ledgeX));
  const motion = moving ? Object.freeze({ amplitude, period: 4_000 + Math.floor(randomAt(tier, 4) * 2_001), phase: randomAt(tier, 5) * Math.PI * 2 }) : undefined;
  for (let column = 0; column < ledgeWidth; column++) game.blocks.push({ id: game.nextId++, x: ledgeX + column * BLOCK_SIZE, y: y + 120, width: BLOCK_SIZE, height: BLOCK_SIZE, brick: false, platformId, motion, conveyor });
  const gap = tier > 2 ? 2 + Math.floor(randomAt(tier, 6) * 8) : -1;
  const gapWidth = tier > 2 && randomAt(tier, 7) > 0.45 ? 2 : 1;
  for (let column = 0; column < 12; column++) {
    if (column >= gap && column < gap + gapWidth) continue;
    game.blocks.push({ id: game.nextId++, x: column * BLOCK_SIZE, y, width: BLOCK_SIZE, height: BLOCK_SIZE, brick: true });
  }
  const coinCount = 4 + Math.floor(randomAt(tier, 8) * 3);
  for (let column = 0; column < coinCount; column++) game.coinsLeft.push({ id: game.nextId++, x: 55 + column * (370 / Math.max(1, coinCount - 1)) + Math.round((randomAt(tier, column + 9) - 0.5) * 20), y: y - 34 });
  if (!moving && randomAt(tier, 16) < 1 / 3) game.trampolines.push({ id: game.nextId++, x: ledgeX + Math.floor(ledgeWidth / 2) * BLOCK_SIZE, y: y + 100 });
}

/** Generates deterministic tiers through the upward buffer above the current camera. */
export function ensureWorldAhead(game: GameState): void {
  const target = game.camera - GENERATE_AHEAD;
  while (tierY(game.nextTier) >= target) { generateTier(game, game.nextTier); game.nextTier++; }
}

/** Releases platforms, pickups, and coins far below the screen. */
export function pruneWorld(game: GameState): void {
  const cutoff = game.camera + PRUNE_BELOW;
  game.blocks = game.blocks.filter(block => block.y <= cutoff);
  game.coinsLeft = game.coinsLeft.filter(coin => coin.y <= cutoff);
  game.trampolines = game.trampolines.filter(trampoline => trampoline.y <= cutoff);
}

/** Advances the upward-only camera, fills the generation buffer, and prunes old world data. */
export function advanceEndlessWorld(game: GameState, playerY: number, deltaMilliseconds: number): void {
  const elapsed = Math.max(0, Number.isFinite(deltaMilliseconds) ? deltaMilliseconds : 0);
  const slowCamera = game.camera - cameraSpeed(game.camera) * elapsed / 1000;
  const followCamera = Number.isFinite(playerY) ? playerY - CAMERA_HEADROOM : game.camera;
  game.camera = Math.min(game.camera, slowCamera, followCamera);
  ensureWorldAhead(game);
  pruneWorld(game);
}

/** Chooses the lowest visible solid ledge or creates a centered recovery ledge without moving camera. */
export function respawnPoint(game: GameState): { x: number; y: number } {
  const visible = game.blocks.filter(block => !block.brick && !block.motion && block.conveyor === undefined && block.y - game.camera >= 250 && block.y - game.camera <= 560).sort((first, second) => second.y - first.y);
  let ledge = visible[0];
  if (!ledge) {
    const x = (WORLD_WIDTH - BLOCK_SIZE * 3) / 2;
    const y = game.camera + 480;
    const recovery = Array.from({ length: 3 }, (_, column) => ({ id: game.nextId++, x: x + column * BLOCK_SIZE, y, width: BLOCK_SIZE, height: BLOCK_SIZE, brick: false }));
    game.blocks.push(...recovery);
    ledge = recovery[1];
  }
  const point = { x: Math.max(0, Math.min(WORLD_WIDTH - PLAYER_WIDTH, blockX(ledge, game.time) + ledge.width / 2 - PLAYER_WIDTH / 2)), y: ledge.y - PLAYER_HEIGHT };
  game.checkpoint = point;
  return point;
}

/** Cuts a released rising jump to a short hop while preserving held and falling velocity. */
export function cutJumpVelocity(verticalVelocity: number, held: boolean): number {
  return held || verticalVelocity >= 0 ? verticalVelocity : Math.max(verticalVelocity, -220);
}

export function createGame(): GameState {
  const game: GameState = {
    phase: 'start', score: 0, coins: 0, lives: 3, camera: 0, checkpoint: { x: 230, y: 540 }, tier: 0, time: 0,
    blocks: [], coinsLeft: [], trampolines: [], debris: [], flights: [], nextId: 1, nextTier: 0,
  };
  for (let column = 0; column < 12; column++) game.blocks.push({ id: game.nextId++, x: column * BLOCK_SIZE, y: 580, width: BLOCK_SIZE, height: BLOCK_SIZE, brick: false });
  ensureWorldAhead(game);
  return game;
}
export function awardCoins(game: GameState, count: number): void {
  game.lives += Math.floor((game.coins + count) / 500) - Math.floor(game.coins / 500);
  game.coins += count; game.score += count * 100;
}
export function breakBrick(game: GameState, id: number): Block | undefined {
  const brick = game.blocks.find(block => block.id === id && block.brick);
  if (!brick) return;
  game.blocks = game.blocks.filter(block => block.id !== id); game.score += 25;
  for (let i = 0; i < 4; i++) game.debris.push({ id: game.nextId++, x: brick.x + 5 + i * 9, y: brick.y, vx: (i - 1.5) * 75, vy: -180 - (i % 2) * 90, born: game.time });
  return brick;
}
