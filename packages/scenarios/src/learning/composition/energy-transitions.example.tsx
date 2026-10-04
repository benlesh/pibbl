import { crc, definePrimitive, Group, Rectangle, Text, useSignal, useRef, usePlayback, repeat, sequence, wait, track, tween, type CRCController, type CRCPointerEvent } from '@crc/core';

// A visual study built entirely on public CRC APIs, not a new filter contract.
type Effect = 'bifrost' | 'hologram' | 'embers';
interface SceneProps {
  effect: Effect; progress: number; time: number; brightness: number;
  hue: number; entry: number; targetWidth: number;
}
const transitionDuration = 1450;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const noise = (n: number) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

const EnergyScene = definePrimitive<SceneProps>((p, _style, c) => {
  const q = clamp(p.progress), t = p.time, w = p.targetWidth;
  const activity = Math.pow(Math.sin(Math.PI * q), 0.65);
  const power = activity * p.brightness * (p.effect === 'bifrost' ? Math.pow(clamp((1 - q) / 0.32), 2) : 1);
  const color = (h: number, a = 1, light = 68) => `hsla(${h + p.hue}, 100%, ${light}%, ${clamp(a)})`;
  const glow = (x: number, y: number, rx: number, ry: number, h: number, a: number) => {
    c.save(); c.translate(x, y); c.scale(rx, ry);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, color(h, a, 93)); g.addColorStop(0.18, color(h, a * 0.55)); g.addColorStop(1, color(h, 0));
    c.fillStyle = g; c.fillRect(-1, -1, 2, 2); c.restore();
  };
  c.save();
  c.fillStyle = '#070b18'; c.fillRect(0, 0, 960, 570);
  glow(480, 285, 460, 330, 225, 0.09);
  // A quiet perspective stage gives the arrival a definite place to land.
  c.strokeStyle = '#172237'; c.lineWidth = 1;
  for (let i = -8; i <= 8; i++) {
    c.beginPath(); c.moveTo(480 + i * 28, 365); c.lineTo(480 + i * 130, 570); c.stroke();
  }
  for (const y of [390, 420, 463, 521, 569]) { c.beginPath(); c.moveTo(0, y); c.lineTo(960, y); c.stroke(); }
  c.fillStyle = '#101c30'; c.beginPath(); c.ellipse(480, 453, w * 0.8 + 30, 34, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#38506a'; c.beginPath(); c.ellipse(480, 448, w * 0.8 + 30, 30, 0, 0, Math.PI * 2); c.stroke();
  const targetHue = p.effect === 'embers' ? 28 : p.effect === 'hologram' ? 183 : 265;
  if (power > 0) glow(480, 443, w * 1.5, 48, targetHue, power * 0.7);

  const reveal = q;
  const whiteHeat = p.effect === 'bifrost' ? clamp(q / 0.12) * clamp((1 - q) / 0.28) : 0;
  // Material burns at locally varying rates; the contour evolves smoothly as it advances.
  const burnY = (x: number) => 452 - 325 * q +
    Math.sin(x * 0.12 + q * 6) * 3.2 + Math.sin(x * 0.37 - q * 10) * 2 +
    Math.sin(x * 0.71 + q * 14 + Math.sin(x * 0.18 - q * 8));
  const halfWidth = (y: number) => y < 155 || y > 430 ? 0 : y < 247 ? (y - 155) / 92 * 70 : y < 357 ? 70 - (y - 247) / 110 * 16 : (430 - y) / 73 * 54;
  const silhouette = new Path2D('M480 155L550 247L534 357L480 430L426 357L410 247Z');
  const mist = (x: number, y: number, rx: number, ry: number, alpha: number, rgb: string) => {
    c.save(); c.translate(x, y); c.scale(rx, ry);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, `rgba(${rgb},${clamp(alpha)})`); g.addColorStop(0.45, `rgba(${rgb},${clamp(alpha * 0.55)})`); g.addColorStop(1, `rgba(${rgb},0)`);
    c.fillStyle = g; c.fillRect(-1, -1, 2, 2); c.restore();
  };
  if (p.effect === 'bifrost' && power > 0.001) {
    c.save(); c.globalCompositeOperation = 'lighter';
    const ex = [480, -100, 1060][p.entry], ey = p.entry === 0 ? -140 : 30;
    // A broad luminous volume beneath the strands makes their light spill into the air.
    for (let i = 0; i < 11; i++) {
      const u = i / 10 - 0.5;
      c.beginPath(); c.moveTo(ex + u * w, ey); c.lineTo(480 + u * w, 441);
      c.strokeStyle = color(i * 33, power * 0.2, 82); c.lineWidth = w / 7;
      c.shadowBlur = 48; c.shadowColor = color(i * 33, power * 0.6); c.stroke();
    }
    c.shadowBlur = 0;
    mist(480, 305, w * 1.35, 270, power * 0.62, '218,225,255');
    c.restore();
  }

  // Stretch the actual subject along the entry vector, anchored at its landing point.
  // The same progress geometry runs backward for extraction; the flow clock stays forward.
  c.save(); c.beginPath(); c.rect(0, 0, 960, 570); c.clip();
  if (p.effect === 'bifrost' && q > 0 && q < 1) {
    const ex = [480, -100, 1060][p.entry], ey = p.entry === 0 ? -140 : 30;
    const distance = Math.hypot(ex - 480, ey - 430), ux = (ex - 480) / distance, uy = (ey - 430) / distance;
    const stretch = 7 * Math.pow(1 - clamp(q / 0.56), 2);
    const travel = 220 * Math.pow(1 - clamp(q / 0.5), 2);
    c.translate(480 + ux * travel, 430 + uy * travel);
    c.transform(1 + stretch * ux * ux, stretch * ux * uy, stretch * ux * uy, 1 + stretch * uy * uy, 0, 0);
    c.translate(-480, -430);
    c.globalAlpha = clamp(q / 0.075);
  }
  if (q === 0) c.globalAlpha = 0;
  else if (q < 1 && p.effect !== 'bifrost') {
    c.beginPath();
    if (p.effect === 'embers') {
      c.moveTo(390, 455); c.lineTo(390, burnY(390));
      for (let x = 392; x <= 570; x += 2) c.lineTo(x, burnY(x));
      c.lineTo(570, 455); c.closePath();
    } else c.rect(280, 445 - 310 * reveal, 400, 310 * reveal);
    c.clip();
  }
  const points = [[480, 155], [550, 247], [534, 357], [480, 430], [426, 357], [410, 247]];
  const facets = [[0, 1, 6], [1, 2, 6], [2, 3, 6], [3, 4, 6], [4, 5, 6], [5, 0, 6]];
  points.push([480, 286]);
  const fills = ['#acc7ec', '#607da7', '#32456b', '#516489', '#86a5ce', '#d1e5f6'];
  const stretched = p.effect === 'bifrost' && q > 0 && q < 0.56;
  if (stretched) {
    const softness = 1 - clamp(q / 0.56);
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = `rgba(225,233,255,${clamp(p.brightness * 0.65)})`;
    c.filter = `blur(${22 + softness * 20}px)`; c.fill(silhouette);
    c.fillStyle = '#ffffff';
    c.filter = `blur(${4 + softness * 10}px)`; c.fill(silhouette);
    c.restore();
  } else facets.forEach((face, i) => {
    c.beginPath(); face.forEach((index, j) => { const [x, y] = points[index]; if (j === 0) c.moveTo(x, y); else c.lineTo(x, y); });
    c.closePath(); c.fillStyle = fills[i]; c.fill(); c.strokeStyle = '#d7eeff88'; c.stroke();
  });
  if (whiteHeat > 0 && !stretched) {
    c.save(); c.clip(silhouette); c.fillStyle = `rgba(255,255,255,${clamp(whiteHeat * p.brightness * 1.5)})`; c.fillRect(400, 140, 160, 300); c.restore();
  }
  if (p.effect === 'embers' && q > 0 && q < 1) {
    c.save(); c.clip(silhouette);
    // Continuous contour bands avoid the old independent vertical gradient strips.
    const band = (depth: number, fill: string) => {
      c.beginPath(); c.moveTo(398, burnY(398));
      for (let x = 400; x <= 562; x += 2) c.lineTo(x, burnY(x));
      for (let x = 562; x >= 398; x -= 2) c.lineTo(x, burnY(x) + depth);
      c.closePath(); c.fillStyle = fill; c.fill();
    };
    // Soft overlapping contours brown and blacken the intact material ahead of ignition.
    c.save(); c.filter = 'blur(4px)';
    const ashFade = clamp((1 - q) / 0.14);
    for (let depth = 96; depth >= 22; depth -= 2) band(depth, `rgba(24,14,9,${0.085 * ashFade})`);
    c.restore();
    band(20, '#302019'); band(12, '#6f2510'); band(7, '#d64b0b'); band(3, '#ffab35');
    // Overlapping coals have soft edges and irregular depths, like a porous glowing ember.
    for (let i = 0; i < 125; i++) {
      const x = 401 + noise(i * 13) * 158, depth = noise(i + 29) * 17;
      const y = burnY(x) + depth, radius = 2 + noise(i + 9) * 5;
      const heat = c.createRadialGradient(x, y, 0, x, y, radius);
      const flicker = 0.75 + Math.sin(t * 8 + i) * 0.25;
      heat.addColorStop(0, depth < 6 ? color(38, flicker, 85) : color(12, flicker * 0.8, 46));
      heat.addColorStop(0.45, color(19, 0.65, 48)); heat.addColorStop(1, color(10, 0));
      c.fillStyle = heat; c.beginPath(); c.ellipse(x, y, radius, radius * 0.75, i, 0, Math.PI * 2); c.fill();
      if (i % 3 === 0) {
        c.fillStyle = '#241a13bb'; c.beginPath(); c.ellipse(x + 1, y + 3, radius * 0.45, radius * 0.25, i, 0, Math.PI * 2); c.fill();
      }
    }
    c.restore();
  }
  if (p.effect === 'hologram' && q > 0 && q < 1) {
    c.beginPath(); points.slice(0, 6).forEach(([x, y], i) => { if (i === 0) c.moveTo(x, y); else c.lineTo(x, y); }); c.closePath(); c.clip();
    c.fillStyle = color(185, activity * 0.4); c.fillRect(400, 140, 160, 300);
    c.fillStyle = '#071b31';
    c.globalAlpha = clamp((1 - q) * 2);
    for (let y = 140; y < 440; y += 5) c.fillRect(400, y + t * 15 % 5, 160, 1.5);
    // Seeded bursts change over time, but their probability and strength vanish as it settles.
    const tick = Math.floor(t * 9);
    for (let i = 0; i < 18; i++) {
      if (noise(i * 19 + tick) > (1 - q) * 0.65) continue;
      const y = 155 + noise(i + tick * 31) * 270;
      c.fillStyle = i % 3 === 0 ? '#071323' : color(181, 0.45 * (1 - q), 90);
      c.fillRect(400, y, 160, 2 + noise(i + tick) * 7);
    }
  }
  c.restore();

  if (power > 0.001) {
    c.save(); c.globalCompositeOperation = 'lighter';
    if (p.effect === 'bifrost') {
      const ex = [480, -100, 1060][p.entry], ey = p.entry === 0 ? -140 : 30;
      // Independent entry and footprint: the column can converge from either side.
      for (let i = 0; i < 76; i++) {
        const u = i / 75 - 0.5, h = i * 5.1, x = 480 + u * w;
        const startX = ex + u * w * 0.72, flicker = 0.55 + 0.45 * Math.sin(t * 8 + i * 3.7);
        const g = c.createLinearGradient(startX, ey, x, 440);
        g.addColorStop(0, color(h, 0)); g.addColorStop(0.35, color(h, power * 0.12));
        g.addColorStop(0.9, color(h, power * (0.15 + flicker * 0.28))); g.addColorStop(1, color(h, power * 0.7, 88));
        c.strokeStyle = g; c.lineWidth = 1 + noise(i) * 5;
        c.beginPath(); c.moveTo(startX, ey);
        c.bezierCurveTo(startX + Math.sin(t * 2 + i) * 28, 165, x + Math.sin(i + t * 3) * 14, 285, x, 442); c.stroke();
        if (i % 5 === 0) glow(x, 442, 15, 7, h, power * 0.8);
      }
      const impact = Math.exp(-Math.pow((q - 0.56) / 0.085, 2));
      mist(480, 330, 200, 220, impact * p.brightness * 0.5, '255,255,255');
      mist(480, 310, 125, 195, whiteHeat * whiteHeat * p.brightness * 0.7, '255,255,255');
      glow(480, 330, w * 1.2, 240, 230, power * 0.9);
      glow(480, 442, w * 1.3, 44, 290, power * 2);
      mist(480, 442, w, 16, power, '255,255,255');
    } else if (p.effect === 'hologram') {
      const y = 445 - 310 * q, ex = [480, 230, 730][p.entry];
      for (let i = 0; i < 25; i++) {
        const x = 480 + (i / 24 - 0.5) * w;
        c.strokeStyle = color(185, power * (0.06 + noise(i) * 0.11)); c.lineWidth = 1;
        c.beginPath(); c.moveTo(ex, 450); c.lineTo(x, y); c.stroke();
      }
      glow(480, y, w * 1.1, 33, 183, power * 0.75);
      c.save();
      c.strokeStyle = color(180, power * 0.6, 85); c.lineWidth = 7;
      c.filter = 'blur(9px)';
      c.beginPath(); c.ellipse(480, y, w * 0.6, 12, 0, 0, Math.PI * 2); c.stroke();
      c.filter = 'blur(3px)'; c.lineWidth = 3; c.strokeStyle = color(180, power * 0.65, 90); c.stroke();
      c.restore();
      for (let i = 0; i < 35; i++) {
        const x = 480 + (noise(i) - 0.5) * w, dy = noise(i + 60) * 30;
        c.fillStyle = color(185, power * noise(i + 23)); c.fillRect(x, y + dy, 2, 2 + noise(i + 8) * 13);
      }
      glow(ex, 450, 48, 12, 185, power);
      // Soft overlapping wisps reveal the projector volume without a solid fog rectangle.
      for (let i = 0; i < 30; i++) {
        const drift = (noise(i + 17) + t * 0.045) % 1;
        const fy = 440 - drift * Math.max(25, 440 - y);
        const fx = ex + (480 - ex) * drift + Math.sin(t * 0.6 + i * 2.4) * w * 0.35;
        mist(fx, fy, 28 + noise(i) * 65, 10 + noise(i + 3) * 23, power * 0.09, '117,225,238');
      }
      const tick = Math.floor(t * 9);
      for (let i = 0; i < 10; i++) {
        if (noise(i * 31 + tick) > (1 - q) * 0.45) continue;
        const gy = 445 - noise(i + tick * 7) * 310 * q;
        c.fillStyle = color(185, power * (1 - q) * 0.55);
        c.fillRect(480 - halfWidth(gy) - 8, gy, halfWidth(gy) * 2 + 16, 1.5);
      }
    } else {
      const wind = [1, 1.65, -1.65][p.entry];
      // The front belongs to the object. Ash always drifts outward, even when progress reverses.
      for (let i = 0; i < 360; i++) {
        const sourceX = 410 + noise(i * 3 + 7) * 140;
        const sourceY = burnY(sourceX);
        if (Math.abs(sourceX - 480) > halfWidth(sourceY)) continue;
        const phase = t * (0.38 + noise(i + 5) * 0.55) + noise(i);
        const age = phase % 1, generation = Math.floor(phase);
        const random = noise(i * 17 + generation * 71);
        const dx = wind * age * (35 + random * 145) * w / 180;
        const dy = -age * (35 + noise(i + 9) * 140) - age * age * 35;
        const x = sourceX + dx + Math.sin(age * 9 + i) * age * 20;
        const y = sourceY + dy + Math.cos(age * 11 + i) * age * 10;
        const ash = i % 3 === 0 || age > 0.62;
        c.globalCompositeOperation = ash ? 'source-over' : 'lighter';
        c.fillStyle = ash ? `rgba(156,149,143,${power * (1 - age) * 0.55})` : color(12 + random * 35, power * (1 - age), 55 + (1 - age) * 37);
        c.save(); c.translate(x, y); c.rotate(i + age * (random - 0.5) * 12);
        const size = ash ? 1 + random * 3.5 : 0.7 + random * 2;
        c.fillRect(-size / 2, -size / 2, size, size * (ash ? 1.6 : 0.7)); c.restore();
        if (!ash && i % 8 === 0) glow(x, y, 9, 9, 25, power * (1 - age) * 0.32);
      }
      c.globalCompositeOperation = 'lighter';
      for (let x = 414; x < 550; x += 7) {
        const y = burnY(x);
        if (Math.abs(x - 480) > halfWidth(y)) continue;
        glow(x, y, 17, 13, 24, power * (0.45 + noise(x + Math.floor(t * 12)) * 0.45));
      }
      c.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 16; i++) {
        const sx = 418 + noise(i + 12) * 120, sy = burnY(sx);
        if (Math.abs(sx - 480) > halfWidth(sy)) continue;
        const age = (t * 0.16 + noise(i)) % 1;
        mist(sx + wind * age * 105, sy - age * 135, 18 + age * 38, 13 + age * 26, power * (1 - age) * 0.075, '118,108,101');
      }
    }
    c.restore();
  }
  c.restore();
});

interface StudyOptions { effect?: Effect; progress?: number; autoplay?: boolean }
function Study({ initial }: { initial: StudyOptions }) {
  const effect = useSignal<Effect>(initial.effect ?? 'bifrost'), progress = useSignal(initial.progress ?? (initial.autoplay === false ? 0.5 : 0)), time = useSignal(0);
  const brightness = useSignal(1), hue = useSignal(0), entry = useSignal(0), width = useSignal(180);
  const entering = useSignal(true);
  const dragging = useRef<number>();
  const flowProgram = useRef(repeat(sequence(track(time, tween({ from: 0, to: 60, duration: 60000 })), wait(16)), { iterations: Infinity }));
  const revealProgram = useRef(track(progress, tween({ from: 0, to: 1, duration: transitionDuration })));
  const clock = usePlayback(flowProgram.current!, { autoplay: initial.autoplay !== false });
  const playback = usePlayback(revealProgram.current!, { autoplay: initial.autoplay !== false });
  const labels = { bifrost: 'BIFROST', hologram: 'HOLOGRAM', embers: 'EMBERS / ASH' };
  const descriptions = { bifrost: 'Carried by light.', hologram: 'Reconstructed, line by line.', embers: 'Burn away. Gather from the ashes.' };
  const button = (label: string, x: number, y: number, size: number, click: () => void, active = false) => <Group key={label}>
    <Rectangle style={{ x, y, width: size, height: 38, cornerRadius: 6, fill: active ? '#304968' : '#142137', stroke: active ? '#86b6df' : '#2b3c54', strokeWidth: 1, cursor: 'pointer' }} onClick={click} />
    <Text pointerEvents="none" style={{ x: x + size / 2, y: y + 19, textBaseline: 'middle', textAlign: 'center', font: '600 11px sans-serif', fill: '#e2ebf7' }}>{label}</Text>
  </Group>;
  const scrub = (event: CRCPointerEvent) => playback.seek(clamp((event.x - 40) / 880) * transitionDuration);
  return <Group>
    <Rectangle style={{ width: 960, height: 790, fill: '#0b1220' }} />
    <EnergyScene effect={effect.get()} progress={progress.get()} time={time.get()} brightness={brightness.get()} hue={hue.get()} entry={entry.get()} targetWidth={width.get()} />
    <Text style={{ x: 40, y: 38, font: '11px monospace', fill: '#8093b0' }}>ENERGY STUDIES / ENTRANCE + EXIT</Text>
    <Text style={{ x: 40, y: 79, font: '500 30px sans-serif', fill: '#edf4ff' }}>{labels[effect.get()]}</Text>
    <Text style={{ x: 40, y: 106, font: '14px sans-serif', fill: '#9cafc8' }}>{descriptions[effect.get()]}</Text>
    <Text style={{ x: 920, y: 38, textAlign: 'right', font: '11px monospace', fill: '#8093b0' }}>PROTOTYPE 04</Text>
    {(['bifrost', 'hologram', 'embers'] as const).map((kind, i) => button(labels[kind], 40 + i * 202, 585, 190, () => { effect.set(kind); entering.set(true); playback.play(); }, effect.get() === kind))}
    {button(entering.get() ? 'EXIT ↗' : 'ENTER ↙', 660, 585, 260, () => {
      if (entering.get()) { playback.cancel(); playback.reverse(); } else playback.play();
      entering.update(v => !v);
    })}
    <Text style={{ x: 40, y: 653, font: '11px monospace', fill: '#9cafc8' }}>TRANSITION / DRAG TO EXPLORE</Text>
    <Text style={{ x: 920, y: 653, textAlign: 'right', font: '11px monospace', fill: '#d1e5f6' }}>{`${Math.round(progress.get() * 100)}% MATERIALIZED`}</Text>
    <Rectangle style={{ x: 40, y: 670, width: 880, height: 5, cornerRadius: 2, fill: '#26344a' }} />
    <Rectangle style={{ x: 40, y: 670, width: Math.max(1, 880 * progress.get()), height: 5, cornerRadius: 2, fill: '#92cafa' }} />
    <Rectangle style={{ x: 35 + 880 * progress.get(), y: 664, width: 10, height: 17, cornerRadius: 4, fill: '#e2f2ff' }} />
    <Rectangle style={{ x: 30, y: 658, width: 900, height: 30, fill: 'transparent', cursor: 'ew-resize' }}
      onPointerDown={e => { e.preventDefault(); playback.pause(); dragging.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); scrub(e); }}
      onPointerMove={e => { if (dragging.current === e.pointerId) scrub(e); }}
      onPointerUp={e => { if (dragging.current === e.pointerId) { scrub(e); dragging.current = undefined; e.currentTarget.releasePointerCapture(e.pointerId); } }}
      onPointerCancel={() => { dragging.current = undefined; }} onLostPointerCapture={() => { dragging.current = undefined; }} />
    {button(`ENTRY: ${['TOP / CENTER', 'LEFT', 'RIGHT'][entry.get()]}`, 40, 706, 180, () => entry.update(v => (v + 1) % 3))}
    {button(`AREA: ${width.get()}`, 232, 706, 150, () => width.update(v => v === 180 ? 260 : v === 260 ? 110 : 180))}
    {button(`LIGHT: ${brightness.get()}×`, 394, 706, 160, () => brightness.update(v => v === 1 ? 1.8 : v === 1.8 ? 0.4 : 1))}
    {button(`HUE: +${hue.get()}°`, 566, 706, 170, () => hue.update(v => (v + 60) % 360))}
    {button(clock.status.get() === 'running' ? 'FREEZE FLOW' : 'RESUME FLOW', 748, 706, 172, () => { if (clock.status.get() === 'running') clock.pause(); else clock.resume(); })}
    <Text style={{ x: 40, y: 773, font: '11px sans-serif', fill: '#8093b0' }}>Same artifact. Three arrivals. Scrub the transition; the energy keeps moving independently.</Text>
  </Group>;
}

export default function mount(canvas: HTMLCanvasElement, options: StudyOptions = {}): CRCController {
  return crc(canvas, <Study initial={options} />);
}
