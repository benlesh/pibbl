export interface Block { id: number; x: number; y: number; width: number; brick: boolean }
export interface Coin { id: number; x: number; y: number }
export interface Debris { id: number; x: number; y: number; vx: number; vy: number; born: number }
export interface Flight { id: number; x: number; y: number }
export interface GameState {
  phase: 'start' | 'playing' | 'over' | 'won'; score: number; coins: number; lives: number;
  camera: number; checkpoint: { x: number; y: number }; tier: number; time: number;
  blocks: Block[]; coinsLeft: Coin[]; debris: Debris[]; flights: Flight[]; nextId: number;
}
export function createGame(): GameState {
  const blocks: Block[] = [{ id: 0, x: 0, y: 580, width: 480, brick: false }];
  const coinsLeft: Coin[] = [];
  // Alternating approaches to ceilings. Break a passage, then land on its edge.
  for (let tier = 0; tier < 8; tier++) {
    const y = 440 - tier * 180;
    const x = tier % 2 ? 276 : 54;
    blocks.push({ id: blocks.length, x, y: y + 80, width: 150, brick: false });
    for (let col = 0; col < 8; col++) blocks.push({ id: blocks.length, x: col * 60, y, width: 60, brick: true });
    for (let col = 0; col < 5; col++) coinsLeft.push({ id: tier * 5 + col, x: 65 + col * 86, y: y - 34 });
  }
  return { phase: 'start', score: 0, coins: 0, lives: 3, camera: 0, checkpoint: { x: 100, y: 500 }, tier: 0, time: 0, blocks, coinsLeft, debris: [], flights: [], nextId: 1000 };
}
export function awardCoins(game: GameState, count: number): void {
  game.lives += Math.floor((game.coins + count) / 100) - Math.floor(game.coins / 100);
  game.coins += count; game.score += count * 100;
}
export function breakBrick(game: GameState, id: number): Block | undefined {
  const brick = game.blocks.find(block => block.id === id && block.brick);
  if (!brick) return;
  game.blocks = game.blocks.filter(block => block.id !== id); game.score += 25;
  for (let i = 0; i < 4; i++) game.debris.push({ id: game.nextId++, x: brick.x + 10 + i * 12, y: brick.y, vx: (i - 1.5) * 75, vy: -180 - (i % 2) * 90, born: game.time });
  return brick;
}
