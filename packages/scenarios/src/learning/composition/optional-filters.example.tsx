import { crc, Group, Rectangle, Text, useSignal, type CRCController } from '@crc/core';
import { blur } from '@crc/core/filters';

function OptionalFilters() {
  const enabled = useSignal(true);
  const radius = useSignal(4);
  const clicks = useSignal(0);
  return (
    <Group>
      <Rectangle style={{ width: 720, height: 420, fill: '#f7f0df' }} />
      <Text style={{ left: 40, top: 48, font: '800 27px sans-serif', fill: '#17211d' }}>
        Appearance changes. Targets stay put.
      </Text>
      <Text style={{ left: 40, top: 78, font: '14px sans-serif', fill: '#52615c' }}>
        Toggle blur, then click the teal square or its soft edge.
      </Text>
      <Group style={{ filter: enabled.get() ? blur({ radius }) : [] }}>
        <Rectangle
          style={{ left: 240, top: 122, width: 240, height: 160, fill: '#127e79', cursor: 'pointer' }}
          onClick={() => clicks.update(value => value + 1)}
        />
        <Text pointerEvents="none" style={{ left: 360, top: 211, textAlign: 'center', font: '800 23px sans-serif', fill: '#ffffff' }}>
          CLICK ME
        </Text>
      </Group>
      <Rectangle pointerEvents="none" style={{ left: 240, top: 122, width: 240, height: 160, stroke: '#d1782b', strokeWidth: 2 }} />
      <Rectangle style={{ left: 40, top: 330, width: 190, height: 48, fill: '#17211d', cursor: 'pointer' }} onClick={() => enabled.update(value => !value)} />
      <Text pointerEvents="none" style={{ left: 135, top: 360, textAlign: 'center', font: '700 15px sans-serif', fill: '#ffffff' }}>
        {enabled.get() ? 'TURN BLUR OFF' : 'TURN BLUR ON'}
      </Text>
      <Rectangle style={{ left: 250, top: 330, width: 190, height: 48, fill: '#ffffff', stroke: '#17211d', strokeWidth: 1, cursor: 'pointer' }} onClick={() => radius.update(value => value === 4 ? 12 : 4)} />
      <Text pointerEvents="none" style={{ left: 345, top: 360, textAlign: 'center', font: '700 15px sans-serif', fill: '#17211d' }}>
        {`BLUR RADIUS ${radius.get()}`}
      </Text>
      <Text pointerEvents="none" style={{ left: 475, top: 360, font: '700 16px monospace', fill: '#17211d' }}>
        {`CLICKS ${clicks.get()}`}
      </Text>
      <Text pointerEvents="none" style={{ left: 40, top: 403, font: '12px sans-serif', fill: '#52615c' }}>
        The orange outline marks the original target geometry.
      </Text>
    </Group>
  );
}

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <OptionalFilters />);
}
