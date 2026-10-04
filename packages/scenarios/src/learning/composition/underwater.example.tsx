import { crc, Group, Layer, Rectangle, Text, useSignal, useTexture, type CRCController } from '@crc/core';
import { displacement } from '@crc/core/filters';
import { waterWaves } from '@crc/core/textures';

function Underwater() {
  const enabled = useSignal(true);
  const paused = useSignal(false);
  const strength = useSignal(8);
  const speed = useSignal(0.4);
  const rippleStrength = useSignal(1);
  const clicks = useSignal(0);
  const water = useTexture(waterWaves({ seed: 7, speed: speed.get(), paused: paused.get(), rippleStrength: rippleStrength.get() }), {
    resolution: { width: 256, height: 128 },
  });
  const map = water.paint({ mode: 'stretch' });
  const buttons = [
    { label: enabled.get() ? 'WATER ON' : 'WATER OFF', click: () => enabled.update(value => !value) },
    { label: paused.get() ? 'RESUME' : 'PAUSE', click: () => paused.update(value => !value) },
    { label: `STRENGTH ${strength.get()}`, click: () => strength.update(value => value === 8 ? 18 : value === 18 ? 0 : 8) },
    { label: `RIPPLE ${rippleStrength.get()}×`, click: () => rippleStrength.update(value => value === 0 ? 0.5 : value === 0.5 ? 1 : value === 1 ? 2 : value === 2 ? 4 : 0) },
    { label: `SPEED ${speed.get()}`, click: () => speed.update(value => value === 0.4 ? 1 : value === 1 ? 0 : 0.4) },
  ];
  return (
    <Group>
      <Rectangle style={{ width: 800, height: 540, fill: '#edf3ee' }} />
      <Text style={{ x: 32, y: 43, font: '800 28px sans-serif', fill: '#143d42' }}>A scene beneath moving water</Text>
      <Text style={{ x: 32, y: 70, font: '14px sans-serif', fill: '#45636b' }}>Click anywhere in the water to send out ripples. The scene stays in place.</Text>
      <Group
        onClick={event => {
          if (event.x >= 32 && event.x <= 624 && event.y >= 94 && event.y <= 386) {
            water.send({ type: 'ripple', x: (event.x - 32) / 592, y: (event.y - 94) / 292 });
          }
        }}
        style={{ filter: enabled.get() ? displacement({ map, strength, region: { x: 32, y: 94, width: 592, height: 292 } }) : [] }}
      >
        <Layer style={{ width: 800, height: 400 }}>
          <Rectangle style={{ x: 32, y: 94, width: 592, height: 292, fill: '#103c4a' }} />
          {Array.from({ length: 15 }, (_, index) => (
            <Rectangle key={`vertical-${index}`} style={{ x: 40 + index * 40, y: 94, width: 1, height: 292, fill: '#2b6570' }} />
          ))}
          {Array.from({ length: 8 }, (_, index) => (
            <Rectangle key={`horizontal-${index}`} style={{ x: 32, y: 100 + index * 40, width: 592, height: 1, fill: '#2b6570' }} />
          ))}
          <Text style={{ x: 70, y: 151, font: '800 30px sans-serif', fill: '#b6f3e2' }}>STILL SCENE / LIVE WATER</Text>
          <Rectangle style={{ x: 230, y: 205, width: 190, height: 100, fill: '#44c8ab', cursor: 'pointer' }} onClick={() => clicks.update(value => value + 1)} />
          <Text pointerEvents="none" style={{ x: 325, y: 264, textAlign: 'center', font: '800 21px sans-serif', fill: '#103c4a' }}>CLICK ME</Text>
          <Text style={{ x: 70, y: 356, font: '14px monospace', fill: '#b6f3e2' }}>An explicit Layer keeps this scene cached.</Text>
        </Layer>
      </Group>
      <Rectangle pointerEvents="none" style={{ x: 230, y: 205, width: 190, height: 100, stroke: '#ffc76b', strokeWidth: 2 }} />
      <Rectangle pointerEvents="none" style={{ x: 648, y: 94, width: 120, height: 120, fill: water.paint({ mode: 'stretch' }) }} />
      <Text style={{ x: 648, y: 237, font: '700 14px sans-serif', fill: '#143d42' }}>LIVE RG MAP</Text>
      <Text style={{ x: 648, y: 265, font: '12px sans-serif', fill: '#45636b' }}>Red: horizontal</Text>
      <Text style={{ x: 648, y: 285, font: '12px sans-serif', fill: '#45636b' }}>Green: vertical</Text>
      <Text style={{ x: 648, y: 344, font: '700 17px monospace', fill: '#143d42' }}>{`CLICKS ${clicks.get()}`}</Text>
      {buttons.map((button, index) => (
        <Group key={index}>
          <Rectangle style={{ x: 32 + index * 150, y: 418, width: 140, height: 48, fill: '#143d42', cursor: 'pointer' }} onClick={button.click} />
          <Text pointerEvents="none" style={{ x: 102 + index * 150, y: 449, textAlign: 'center', font: '700 14px sans-serif', fill: '#ffffff' }}>{button.label}</Text>
        </Group>
      ))}
      <Text style={{ x: 32, y: 503, font: '13px sans-serif', fill: '#45636b' }}>Try several clicks. Speed zero still lets ripples spread; pause freezes everything.</Text>
    </Group>
  );
}

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <Underwater />);
}
