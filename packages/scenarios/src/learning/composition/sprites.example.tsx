import { pibbl, Rectangle, Text, Group, drive, repeat, usePlayback, useSignal, useReaction, type PibblController } from '@pibbl/core';
import { Sprite, loadSpriteSheet, defineSpriteAnimation, type SpriteSheet } from '@pibbl/core/sprites';

// Four explicit vector poses in a regular grid keep this example self-contained.
const source = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="128" height="32"><g fill="#ecaa36" stroke="#713a1b" stroke-width="2"><ellipse cx="16" cy="16" rx="12" ry="13"/><ellipse cx="48" cy="16" rx="8" ry="13"/><ellipse cx="80" cy="16" rx="2" ry="13"/><ellipse cx="112" cy="16" rx="8" ry="13"/></g></svg>')}`;

function Coin({ sheet }: { sheet: SpriteSheet }) {
  const frame = useSignal(sheet.frames[0]);
  const playback = usePlayback(repeat(drive(frame, defineSpriteAnimation({
    frames: Object.values(sheet.frames), fps: 8,
  })), { iterations: Infinity }), { autoplay: true });
  return <>
    <Group style={{ translateX: 300, translateY: 110 }}><Sprite frame={frame} sampling="nearest" style={{ width: 120, height: 120 }} /></Group>
    {Object.values(sheet.frames).map((item, index) => <Group key={index} style={{ translateX: 205 + index * 85, translateY: 270 }}><Sprite frame={item} style={{ width: 48, height: 48 }} /></Group>)}
    <Rectangle style={{ left: 245, top: 345, width: 230, height: 45, fill: '#175743', cursor: 'pointer' }} onClick={() => playback.status.get() === 'running' ? playback.pause() : playback.play()} />
    <Text pointerEvents="none" style={{ left: 278, top: 359, fill: 'white', font: 'bold 16px sans-serif' }}>Pause / resume</Text>
  </>;
}

function Example() {
  const sheet = useSignal<SpriteSheet | undefined>(undefined);
  const error = useSignal('');
  useReaction(() => {
    let disposed = false;
    let resource: SpriteSheet | undefined;
    loadSpriteSheet(source, { grid: { frameWidth: 32, frameHeight: 32 } }).then(value => {
      if (disposed) value.dispose();
      else { resource = value; sheet.set(value); }
    }, reason => { if (!disposed) error.set(String(reason)); });
    return () => { disposed = true; resource?.dispose(); };
  }, []);
  const ready = sheet.get();
  return <>
    <Rectangle style={{ width: 720, height: 420, fill: '#edf3ef' }} />
    <Text style={{ left: 40, top: 45, fill: '#12392e', font: 'bold 25px sans-serif' }}>One sheet. Four frames. One signal.</Text>
    <Text style={{ left: 40, top: 85, fill: '#356354', font: '15px sans-serif' }}>The same playback API drives this discrete sprite animation.</Text>
    {ready ? <Coin sheet={ready} /> : <Text style={{ left: 40, top: 180 }}>{error.get() || 'Loading sprite sheet…'}</Text>}
  </>;
}

export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(canvas, <Example />);
}
