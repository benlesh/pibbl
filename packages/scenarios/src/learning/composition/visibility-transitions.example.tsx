import { crc, Group, Rectangle, Circle, Text, fade, embers, hologram, bifrost, slide, zoom, wipe, blurReveal, dissolve, useVisibilityTransition, useSignal, type CRCController, type CRCVisibilityTransition } from '@crc/core';

const effects = ['bifrost', 'hologram', 'embers', 'fade', 'slide', 'zoom', 'wipe', 'blur', 'dissolve'] as const;
type Effect = typeof effects[number];
const region = { x: 100, y: 145, width: 600, height: 240 };
const definitions = { bifrost: bifrost({ region, entry: { x: 400, y: -240 } }), hologram: hologram({ region }), embers: embers({ region, charDepth: 65, burnWidth: 12, wind: 100, seed: 4, linger: 700 }), fade: fade(), slide: slide({ x: -100, y: 0 }), zoom: zoom({ origin: { x: 400, y: 265 }, from: .15 }), wipe: wipe({ region }), blur: blurReveal(), dissolve: dissolve({ region, cellSize: 6, seed: 4 }) };

function Subject({ effect, register }: { effect: Effect; register: (handle: CRCVisibilityTransition) => void }) {
  const transition = useVisibilityTransition({ initial: true, enter: definitions[effect], duration: 900 });
  register(transition);
  return <Group style={{ transition: transition.binding }}>
    <Rectangle style={{ x: 100, y: 145, width: 600, height: 240, cornerRadius: 20, fill: '#254c64' }} />
    <Circle style={{ cx: 232, cy: 267, radius: 75, fill: '#59e2cc' }} />
    <Circle style={{ cx: 282, cy: 267, radius: 75, fill: '#59e2cc' }} />
    <Text style={{ x: 394, y: 238, font: '600 28px sans-serif', fill: '#f0faf7' }}>Ordinary CRC content</Text>
    <Text style={{ x: 394, y: 281, font: '15px sans-serif', fill: '#b8d6df' }}>Text, shapes, and overlapping children.</Text>
    <Text style={{ x: 394, y: 315, font: '15px sans-serif', fill: '#b8d6df' }}>{`One subject. ${effect.toUpperCase()} transition.`}</Text>
  </Group>;
}

function Demo() {
  const effect = useSignal<Effect>('bifrost');
  const mounted = useSignal(true), message = useSignal('Ready. Hide, reverse, or exit and unmount.');
  // A plain callback hands the mounted handle to event closures without scheduling a render.
  let handle: CRCVisibilityTransition | undefined;
  const register = (value: CRCVisibilityTransition) => { handle = value; };
  const run = async (action: 'show' | 'hide' | 'remove') => {
    const current = handle;
    if (!current) { message.set('The subject is unmounted. Choose Remount.'); return; }
    message.set(action === 'show' ? 'Entering…' : effect.get() === 'embers' ? 'Exiting. Waiting for the ash to settle…' : 'Exiting…');
    const result = await (action === 'show' ? current.show() : current.hide());
    message.set(`Request ${result.requestId}: ${result.phase} ${result.status}`);
    if (action === 'remove' && result.status === 'finished' && !current.visible.get()) {
      mounted.set(false); message.set('Exit finished. Subject unmounted safely.');
    }
  };
  const buttons = [
    { label: 'SHOW', action: () => { void run('show'); } },
    { label: 'HIDE', action: () => { void run('hide'); } },
    { label: 'EXIT + UNMOUNT', action: () => { void run('remove'); } },
    { label: 'REMOUNT', action: () => { mounted.set(true); message.set('Mounted with a fresh transition owner.'); } },
  ];
  return <Group>
    <Rectangle style={{ width: 800, height: 560, fill: '#0a1723' }} />
    <Text style={{ x: 40, y: 48, font: '12px monospace', fill: '#88aebc' }}>PUBLIC API / TRANSITION LIBRARY</Text>
    <Text style={{ x: 40, y: 95, font: '600 30px sans-serif', fill: '#ecf8f4' }}>Visibility transitions</Text>
    <Text style={{ x: 400, y: 275, textAlign: 'center', font: '14px sans-serif', fill: '#7e9fad' }}>The subject is hidden or unmounted.</Text>
    <Rectangle style={{ x: 600, y: 84, width: 160, height: 38, cornerRadius: 6, fill: '#20394b', cursor: 'pointer' }} onClick={() => { effect.update(value => effects[(effects.indexOf(value) + 1) % effects.length]!); mounted.set(true); }} />
    <Text pointerEvents="none" style={{ x: 680, y: 103, textAlign: 'center', textBaseline: 'middle', font: '600 12px sans-serif', fill: '#ecf8f4' }}>EFFECT: {effect.get().toUpperCase()}</Text>
    {mounted.get() && <Subject key={effect.get()} effect={effect.get()} register={register} />}
    {buttons.map((button, i) => <Group key={button.label}>
      <Rectangle style={{ x: 40 + i * 184, y: 425, width: 168, height: 42, cornerRadius: 6, fill: '#20394b', cursor: 'pointer' }} onClick={button.action} />
      <Text pointerEvents="none" style={{ x: 124 + i * 184, y: 446, textBaseline: 'middle', textAlign: 'center', font: '600 12px sans-serif', fill: '#ecf8f4' }}>{button.label}</Text>
    </Group>)}
    <Text style={{ x: 40, y: 504, font: '14px monospace', fill: '#76e4ce' }}>{message.get()}</Text>
    <Text style={{ x: 40, y: 540, font: '12px sans-serif', fill: '#88aebc' }}>Click EFFECT to cycle nine presets. Show reverses a pending exit.</Text>
  </Group>;
}
export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <Demo />);
}
