import { PhysicsWorld2D, crcPhysicsWorld2D, physicsBoxObstacles2D, staticBody2D, kinematicBody2D, collider2D } from '@crc/physics/2d';
import {
  Group, Rectangle, Text, crc, useConst, useComputed, usePlayback, useSignal,
  repeat, sequence, wait, marker, type CRCController,
} from '@crc/core';
import {
  Particles2D, defineParticleEffect2D, particleCurve, particleRange,
  useParticleSystem, useFlowField2D, useFlowSource2D, type CRCParticleEmitter2D,
} from '@crc/particles';

// Original procedural artwork, generated once per mount; no external assets.
function sprite(kind: 'smoke' | 'flame', variant: number): OffscreenCanvas {
  const canvas = new OffscreenCanvas(96, 96);
  const context = canvas.getContext('2d')!;
  if (kind === 'smoke') {
    for (let i = 0; i < 5; i++) {
      const angle = i * 2.4 + variant;
      const x = 48 + Math.cos(angle) * 14, y = 48 + Math.sin(angle) * 11;
      const gradient = context.createRadialGradient(x, y, 1, x, y, 29);
      gradient.addColorStop(0, 'rgba(186,198,207,0.65)');
      gradient.addColorStop(0.4, 'rgba(164,179,192,0.4)');
      gradient.addColorStop(1, 'rgba(145,160,175,0)');
      context.fillStyle = gradient;
      context.fillRect(0, 0, 96, 96);
    }
  } else {
    context.beginPath();
    context.moveTo(46, 92);
    context.bezierCurveTo(5, 81, 35, 47, 40 + variant * 8, 4);
    context.bezierCurveTo(54, 43, 93, 80, 46, 92);
    context.clip();
    const gradient = context.createRadialGradient(46, 77, 2, 46, 65, 57);
    gradient.addColorStop(0, '#fff6bc');
    gradient.addColorStop(0.22, '#ffda58');
    gradient.addColorStop(0.5, 'rgba(255,110,12,0.85)');
    gradient.addColorStop(0.78, 'rgba(216,47,6,0.3)');
    gradient.addColorStop(1, 'rgba(150,25,0,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 96, 96);
  }
  return canvas;
}

const clockProgram = repeat(sequence(wait(40), marker('emit')), { iterations: Infinity });

function FireAndFlow() {
  const burning = useSignal(true);
  const intensity = useSignal(0.8);
  const wind = useSignal(0);
  const origin = useSignal<readonly [number, number]>([360, 370]);
  const drag = useSignal<number | null>(null);
  const moving = useSignal(false);
  const obstacleX = useSignal(325);
  const motion = useConst(() => ({ seconds: 0 }));
  const leftClicks = useSignal(0), rightClicks = useSignal(0);
  const obstacles = physicsBoxObstacles2D(crcPhysicsWorld2D());
  const obstaclePosition = useComputed(() => [obstacleX.get(), 270] as const);
  const flow = useFlowField2D({ bounds: { width: 720, height: 480 }, resolution: [96, 64], obstacles });
  const force = useComputed(() => [wind.get(), -180 * intensity.get()] as const);
  const heat = useComputed(() => 4 * intensity.get());
  useFlowSource2D(flow, { position: origin, radius: 40, acceleration: force, heat, enabled: burning });
  const effects = useConst(() => {
    const smokeEmitter = (variant: number): CRCParticleEmitter2D => ({
      bounds: { min: [-720, -480], max: [720, 480] },
      name: `smoke${variant}`, capacity: 140, overflow: 'recycle-oldest' as const,
      emission: [{ type: 'manual' as const, count: 1 }],
      shape: { type: 'line' as const, from: [-18, -30] as const, to: [18, -30] as const },
      initial: { lifetimeMilliseconds: particleRange(6500, 9000), rotationDegrees: particleRange(0, 360) },
      appearance: {
        size: particleCurve([[0, 18], [0.25, 38], [1, 75]]),
        opacity: particleCurve([[0, 0], [0.08, 0.26], [0.6, 0.16], [1, 0]]),
      },
      renderer: { type: 'sprite' as const, source: sprite('smoke', variant) },
    });
    return {
    smoke: defineParticleEffect2D({ emitters: [smokeEmitter(0), smokeEmitter(1), smokeEmitter(2)] }),
    fire: defineParticleEffect2D({ emitters: [{
      bounds: { min: [-100, -180], max: [100, 60] },
      name: 'flame', capacity: 200, overflow: 'recycle-oldest',
      emission: [{ type: 'manual', count: 5 }],
      shape: { type: 'line', from: [-28, 0], to: [28, 0] },
      initial: { lifetimeMilliseconds: particleRange(400, 850), velocity: [particleRange(-16, 16), particleRange(-115, -70)], rotationDegrees: particleRange(-12, 12) },
      appearance: { size: particleCurve([[0, [30, 52]], [0.3, [34, 60]], [1, [8, 18]]]), opacity: particleCurve([[0, 0], [0.1, 0.8], [0.7, 0.5], [1, 0]]) },
      renderer: { type: 'sprite', source: sprite('flame', 1), blend: 'source-over' },
    }, {
      name: 'embers', capacity: 80, overflow: 'recycle-oldest',
      emission: [{ type: 'manual', count: 1 }], shape: { type: 'line', from: [-22, -10], to: [22, -10] },
      initial: { lifetimeMilliseconds: particleRange(1300, 2600), velocity: [particleRange(-30, 30), particleRange(-160, -90)], color: '#ffb85c', size: [2, 4] },
      motion: [{ type: 'sway', amplitude: 8, frequency: [0.3, 0.8] }],
      appearance: { opacity: particleCurve([[0, 0], [0.1, 1], [0.55, 0.6], [1, 0]]) },
      renderer: { type: 'rectangle', blend: 'additive' },
    }] }),
  };
  });
  const smoke = useParticleSystem(effects.smoke, { flow, seed: 42 });
  const fire = useParticleSystem(effects.fire, { seed: 74 });
  const tick = useConst(() => ({ value: 0 }));
  usePlayback(clockProgram, { autoplay: true, onEvent: (event) => {
    if (event.type !== 'marker') return;
    if (moving.get()) {
      motion.seconds += 0.04;
      const nextX = 325 + 90 * Math.sin(motion.seconds * 0.8);
      obstacleX.set(nextX);
    }
    if (!burning.get()) return;
    const position = origin.get();
    fire.emit('flame', { position, count: Math.round(5 * intensity.get()) });
    tick.value++;
    if (tick.value % 4 === 0) fire.emit('embers', { position });
    if (tick.value % 2 === 0) smoke.emit(`smoke${tick.value % 3}`, { position, count: Math.ceil(2 * intensity.get()) });
  } });
  const [x, y] = origin.get();
  return <Group>
    <Rectangle pointerEvents="none" style={{ width: 720, height: 480, fill: '#111820' }} />
    <Rectangle pointerEvents="none" style={{ x: 24, y: 80, width: 672, height: 360, fill: '#18232d', stroke: '#2d3b47' }} />
    <Text pointerEvents="none" style={{ x: 32, y: 34, fill: '#f4e9d5', font: '700 24px sans-serif' }}>FIRE & FLOW</Text>
    <Text pointerEvents="none" style={{ x: 32, y: 59, fill: '#9eafbd', font: '13px sans-serif' }}>Click the shapes. Drag the fuel. Smoke follows the shared field.</Text>
    <Group physics={kinematicBody2D({ collider: false, target: { position: obstaclePosition } })} style={{ translateX: obstacleX, translateY: 270 }}>
    <Rectangle physics={collider2D()} onClick={() => leftClicks.update((v) => v + 1)} style={{ x: -40, y: -40, width: 80, height: 80, fill: leftClicks.get() % 2 ? '#5bafbb' : '#326b7b', cursor: 'pointer' }} />
    </Group>
    <Rectangle physics={staticBody2D()} onClick={() => rightClicks.update((v) => v + 1)} style={{ x: 365, y: 155, width: 100, height: 54, fill: rightClicks.get() % 2 ? '#a29bcc' : '#686580', cursor: 'pointer' }} />
    <Rectangle onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drag.set(e.pointerId); }}
      onPointerMove={(e) => { if (drag.get() === e.pointerId) origin.set([Math.max(90, Math.min(630, e.x)), Math.max(320, Math.min(395, e.y))]); }}
      onPointerUp={(e) => { if (drag.get() === e.pointerId) { e.currentTarget.releasePointerCapture(e.pointerId); drag.set(null); } }}
      onPointerCancel={() => drag.set(null)}
      onClick={() => burning.update((v) => !v)}
      style={{ x: x - 40, y, width: 80, height: 54, fill: burning.get() ? '#954526' : '#4d5660', stroke: '#c78958', cursor: drag.get() === null ? 'grab' : 'grabbing' }} />
    <Particles2D system={smoke} pointerEvents="none" style={{ width: 720, height: 480 }} />
    <Particles2D system={fire} pointerEvents="none" style={{ width: 720, height: 480 }} />
    <Rectangle pointerEvents="none" style={{ x: x - 45, y: y + 39, width: 90, height: 15, fill: '#39434b', stroke: '#76808a' }} />
    <Text pointerEvents="none" style={{ x: obstacleX.get() - 35, y: 276, fill: '#f0f5fa', font: '12px sans-serif' }}>CLICKS {leftClicks}</Text>
    <Text pointerEvents="none" style={{ x: 380, y: 188, fill: '#f0f5fa', font: '12px sans-serif' }}>CLICKS {rightClicks}</Text>
    <Rectangle onClick={() => intensity.update((v) => v >= 1.2 ? 0.4 : v + 0.4)} style={{ x: 32, y: 447, width: 180, height: 26, fill: '#2d3d49', cursor: 'pointer' }} />
    <Text pointerEvents="none" style={{ x: 44, y: 465, fill: '#d5e1e8', font: '12px sans-serif' }}>Intensity {Math.round(intensity.get() * 100)}%</Text>
    <Rectangle onClick={() => wind.update((v) => v >= 80 ? -80 : v + 80)} style={{ x: 226, y: 447, width: 170, height: 26, fill: '#2d3d49', cursor: 'pointer' }} />
    <Text pointerEvents="none" style={{ x: 239, y: 465, fill: '#d5e1e8', font: '12px sans-serif' }}>Wind {wind.get() < 0 ? '←' : wind.get() > 0 ? '→' : 'still'}</Text>
    <Rectangle onClick={() => {
      moving.update((v) => !v);
    }} style={{ x: 410, y: 447, width: 278, height: 26, fill: '#2d3d49', cursor: 'pointer' }} />
    <Text pointerEvents="none" style={{ x: 423, y: 465, fill: '#d5e1e8', font: '12px sans-serif' }}>Obstacle {moving.get() ? 'moving' : 'stationary'}</Text>
  </Group>;
}
export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <PhysicsWorld2D space="local" gravity={[0, 0]}><FireAndFlow /></PhysicsWorld2D>, { pixelRatio: 1 });
}
