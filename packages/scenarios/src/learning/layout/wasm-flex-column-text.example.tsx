import {
  Flex, Text, Rectangle, pibbl, signal, computed, useLayoutBox,
  type PibblResponsiveStyle, type BoxStyle, type FlexItemStyle, type PibblController,
} from '@pibbl/core';

export default function mount(canvas: HTMLCanvasElement): PibblController {
  const direction = signal<'column' | 'row'>('column');
  const footerWidth = computed(() => direction.get() === 'column' ? 420 : 200);
  const widthCap = signal(420);
  const ink = signal('#19375b');
  const alignment = signal<'stretch' | 'center' | 'flex-end'>('stretch');
  const distribution = signal<'flex-start' | 'space-between' | 'center'>('flex-start');
  const footerClicks = signal(0);
  const paragraph = 'Column text takes its height from the final constrained width. Narrow this paragraph and the following sibling moves down in the same frame, keeping paint and input geometry together.';
  function Footer({ style: _specifiedStyle }: { style: PibblResponsiveStyle<BoxStyle & FlexItemStyle> }) {
    const box = useLayoutBox();
    return <>
      <Rectangle style={{ width: box.width, height: box.height, fill: '#426b61', cursor: 'pointer' }} onClick={() => footerClicks.update(value => value + 1)} />
      <Text pointerEvents="none" style={{ left: 12, top: 10, font: '14px sans-serif', fill: '#ffffff' }}>Following sibling · click</Text>
    </>;
  }
  const controller = pibbl(canvas, <>
    <Rectangle style={{ width: 760, height: 460, fill: '#f3f0e8' }} />
    <Text style={{ left: 28, top: 24, font: 'bold 24px sans-serif', fill: '#19375b' }}>WASM · Column Text</Text>
    <Rectangle style={{ left: 580, top: 24, width: 156, height: 36, fill: '#426b61', cursor: 'pointer' }} onClick={() => direction.update(value => value === 'column' ? 'row' : 'column')} />
    <Text pointerEvents="none" style={{ left: 592, top: 34, font: '14px sans-serif', fill: '#ffffff' }}>Switch row/column</Text>
    <Text style={{ left: 28, top: 62, font: '14px sans-serif', fill: '#475569' }}>Auto height follows the final width cap. The green sibling follows the text.</Text>
    <Rectangle style={{ left: 28, top: 96, width: 180, height: 36, fill: '#19375b', cursor: 'pointer' }} onClick={() => widthCap.update(value => value === 420 ? 180 : 420)} />
    <Text pointerEvents="none" style={{ left: 40, top: 106, font: '14px sans-serif', fill: '#ffffff' }}>Toggle width cap</Text>
    <Rectangle style={{ left: 224, top: 96, width: 180, height: 36, fill: '#6e3e79', cursor: 'pointer' }} onClick={() => ink.update(value => value === '#19375b' ? '#a63758' : '#19375b')} />
    <Text pointerEvents="none" style={{ left: 236, top: 106, font: '14px sans-serif', fill: '#ffffff' }}>Paint only</Text>
    <Rectangle style={{ left: 420, top: 96, width: 200, height: 36, fill: '#426b61', cursor: 'pointer' }} onClick={() => alignment.update(value => value === 'stretch' ? 'center' : value === 'center' ? 'flex-end' : 'stretch')} />
    <Text pointerEvents="none" style={{ left: 432, top: 106, font: '14px sans-serif', fill: '#ffffff' }}>Cycle alignment</Text>
    <Rectangle style={{ left: 636, top: 96, width: 100, height: 36, fill: '#19375b', cursor: 'pointer' }} onClick={() => distribution.update(value => value === 'flex-start' ? 'space-between' : value === 'space-between' ? 'center' : 'flex-start')} />
    <Text pointerEvents="none" style={{ left: 644, top: 106, font: '14px sans-serif', fill: '#ffffff' }}>Distribute</Text>
    <Flex style={{ left: 28, top: 150, width: 680, height: 280, flexDirection: direction, gap: 12, alignItems: alignment, justifyContent: distribution }}>
      <Text style={{ maxWidth: widthCap, minWidth: 0, minHeight: 0, flexShrink: 0, wrap: true, font: '16px sans-serif', lineHeight: 24, fill: ink }}>{paragraph}</Text>
      <Footer style={{ width: footerWidth, height: 36, minWidth: 0, minHeight: 0, flexShrink: 0 }} />
    </Flex>
  </>);
  const read = (globalThis as typeof globalThis & { __PIBBL_LAYOUT_DIAGNOSTICS__?: () => Record<string, number> }).__PIBBL_LAYOUT_DIAGNOSTICS__;
  const panel = document.createElement('pre');
  panel.style.cssText = 'font:12px monospace;white-space:pre-wrap;color:#19375b;padding:12px;background:#e7e5df';
  canvas.insertAdjacentElement('afterend', panel);
  const refresh = () => { panel.textContent = `${read ? 'EXPERIMENTAL WASM · ' + Object.entries(read()).map(([key,value]) => `${key}: ${value}`).join(' · ') : 'Normal JS build'}\naxis: ${direction.get()} · width cap: ${widthCap.get()} · alignment: ${alignment.get()} · distribution: ${distribution.get()} · footer hits: ${footerClicks.get()}`; };
  refresh();
  const timer = window.setInterval(refresh, 200);
  return { dispose() { window.clearInterval(timer); panel.remove(); controller.dispose(); } };
}
