import { crc, Group, Layer, Rectangle, Text, useSignal, useTexture, type CRCController } from '@crc/core';
import { displacement } from '@crc/core/filters';
import { waterWaves } from '@crc/textures';

function Underwater() {
  const enabled = useSignal(true);
  const paused = useSignal(false);
  const strength = useSignal(8);
  const speed = useSignal(0.4);
  const clicks = useSignal(0);
  const water = useTexture(waterWaves({ seed: 7, speed: speed.get(), paused: paused.get() }), {
    resolution: { width: 128, height: 128 },
  });
  const map = water.paint({ mode: 'repeat', tileWidth: 240, tileHeight: 240 });
  const buttons = [
    { label: enabled.get() ? 'WATER ON' : 'WATER OFF', click: () => enabled.update(value => !value) },
    { label: paused.get() ? 'RESUME' : 'PAUSE', click: () => paused.update(value => !value) },
    { label: `STRENGTH ${strength.get()}`, click: () => strength.update(value => value === 8 ? 18 : value === 18 ? 0 : 8) },
    { label: `SPEED ${speed.get()}`, click: () => speed.update(value => value === 0.4 ? 1 : value === 1 ? 0 : 0.4) },
  ];
  return (
    <Group>
      <Rectangle style={{ width: 800, height: 540, fill: '#edf3ee' }} />
      <Text style={{ left: 32, top: 43, font: '800 28px sans-serif', fill: '#143d42' }}>A scene beneath moving water</Text>
      <Text style={{ left: 32, top: 70, font: '14px sans-serif', fill: '#45636b' }}>The waves move pixels. The orange outline marks the original click target.</Text>
      <Group style={{ filter: enabled.get() ? displacement({ map, strength, region: { x: 0, y: 0, width: 800, height: 540 } }) : [] }}>
        <Layer style={{ width: 800, height: 400 }}>
          <Rectangle style={{ left: 32, top: 94, width: 592, height: 292, fill: '#103c4a' }} />
          {Array.from({ length: 15 }, (_, index) => (
            <Rectangle key={`vertical-${index}`} style={{ left: 40 + index * 40, top: 94, width: 1, height: 292, fill: '#2b6570' }} />
          ))}
          {Array.from({ length: 8 }, (_, index) => (
            <Rectangle key={`horizontal-${index}`} style={{ left: 32, top: 100 + index * 40, width: 592, height: 1, fill: '#2b6570' }} />
          ))}
          <Text style={{ left: 70, top: 151, font: '800 30px sans-serif', fill: '#b6f3e2' }}>STILL SCENE / LIVE WATER</Text>
          <Rectangle style={{ left: 230, top: 205, width: 190, height: 100, fill: '#44c8ab', cursor: 'pointer' }} onClick={() => clicks.update(value => value + 1)} />
          <Text pointerEvents="none" style={{ left: 325, top: 264, textAlign: 'center', font: '800 21px sans-serif', fill: '#103c4a' }}>CLICK ME</Text>
          <Text style={{ left: 70, top: 356, font: '14px monospace', fill: '#b6f3e2' }}>An explicit Layer keeps this scene cached.</Text>
        </Layer>
      </Group>
      <Rectangle pointerEvents="none" style={{ left: 230, top: 205, width: 190, height: 100, stroke: '#ffc76b', strokeWidth: 2 }} />
      <Rectangle pointerEvents="none" style={{ left: 648, top: 94, width: 120, height: 120, fill: water.paint({ mode: 'stretch' }) }} />
      <Text style={{ left: 648, top: 237, font: '700 14px sans-serif', fill: '#143d42' }}>LIVE RG MAP</Text>
      <Text style={{ left: 648, top: 265, font: '12px sans-serif', fill: '#45636b' }}>Red: horizontal</Text>
      <Text style={{ left: 648, top: 285, font: '12px sans-serif', fill: '#45636b' }}>Green: vertical</Text>
      <Text style={{ left: 648, top: 344, font: '700 17px monospace', fill: '#143d42' }}>{`CLICKS ${clicks.get()}`}</Text>
      {buttons.map((button, index) => (
        <Group key={index}>
          <Rectangle style={{ left: 32 + index * 188, top: 418, width: 172, height: 48, fill: '#143d42', cursor: 'pointer' }} onClick={button.click} />
          <Text pointerEvents="none" style={{ left: 118 + index * 188, top: 449, textAlign: 'center', font: '700 14px sans-serif', fill: '#ffffff' }}>{button.label}</Text>
        </Group>
      ))}
      <Text style={{ left: 32, top: 503, font: '13px sans-serif', fill: '#45636b' }}>Pause freezes the distortion; strength zero restores the original image.</Text>
    </Group>
  );
}

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <Underwater />);
}
