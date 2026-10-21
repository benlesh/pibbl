import { Flex, Layer, Rectangle, Text, pibbl, signal, computed, useLayoutBox, type PibblController } from '@pibbl/core';

export default function mount(canvas: HTMLCanvasElement): PibblController {
  const revision = signal(0);
  const width = computed(() => revision.get()%2 === 0 ? 680 : 420);
  const contentInk = signal('#ffffff');
  const background = signal('#f3f0e8');
  const hits = signal(0);
  const rasters: { width: number; revision: number }[] = [];
  let cleanRasters = 0;
  function Content() {
    const box = useLayoutBox(), stamp = revision.get();
    rasters.push({ width: box.width, revision: stamp });
    return <>
      <Rectangle style={{ width: box.width, height: box.height, fill: stamp%2 ? '#a63758' : '#19375b', cursor: 'pointer' }} onClick={() => hits.update(value => value+1)} />
      <Text pointerEvents="none" style={{ left: 12, top: 16, width: box.width-24, wrap: true, font: '18px sans-serif', fill: contentInk }}>{`Raster ${stamp} · ${box.width} px`}</Text>
      <Text pointerEvents="none" style={{ left: 12, top: 64, width: box.width-24, wrap: true, lineHeight: 24, font: '16px sans-serif', fill: '#ffffff' }}>Click this bitmap. Resize and content change share one signal update and one final-size raster.</Text>
    </>;
  }
  function CleanContent() {
    cleanRasters++;
    const box = useLayoutBox();
    return <>
      <Rectangle style={{ width: box.width, height: box.height, fill: '#426b61' }} />
      <Text pointerEvents="none" style={{ left: 12, top: 16, width: box.width-24, wrap: true, font: '14px sans-serif', fill: '#ffffff' }}>Clean sibling bitmap</Text>
    </>;
  }
  function Button({ x, label, onClick }: { x: number; label: string; onClick(): void }) {
    return <>
      <Rectangle style={{ left: x, top: 96, width: 180, height: 36, fill: '#19375b', cursor: 'pointer' }} onClick={onClick} />
      <Text pointerEvents="none" style={{ left: x+12, top: 106, font: '14px sans-serif', fill: '#ffffff' }}>{label}</Text>
    </>;
  }
  const controller = pibbl(canvas, <>
    <Rectangle style={{ width: 760, height: 460, fill: background }} />
    <Text style={{ left: 28, top: 24, font: 'bold 24px sans-serif', fill: '#19375b' }}>WASM · Allocated Layer</Text>
    <Text style={{ left: 28, top: 62, font: '14px sans-serif', fill: '#475569' }}>Resize + content should rasterize once at the final width. Green stays cached.</Text>
    <Button x={28} label="Resize + content" onClick={() => revision.update(value => value+1)} />
    <Button x={224} label="Content only" onClick={() => contentInk.update(value => value === '#ffffff' ? '#ffe59d' : '#ffffff')} />
    <Button x={420} label="Root paint only" onClick={() => background.update(value => value === '#f3f0e8' ? '#e8e4da' : '#f3f0e8')} />
    <Flex style={{ left: 28, top: 160, width, height: 220, gap: 16 }}>
      <Layer style={{ flexBasis: 0, flexGrow: 1, minWidth: 0, height: 220 }}><Content /></Layer>
      <Layer style={{ width: 120, minWidth: 0, height: 220, flexShrink: 0 }}><CleanContent /></Layer>
    </Flex>
  </>);
  const read = (globalThis as typeof globalThis & { __PIBBL_LAYOUT_DIAGNOSTICS__?: () => Record<string, number> }).__PIBBL_LAYOUT_DIAGNOSTICS__;
  const panel = document.createElement('pre');
  panel.style.cssText = 'font:12px monospace;white-space:pre-wrap;color:#19375b;padding:12px;background:#e7e5df';
  canvas.insertAdjacentElement('afterend',panel);
  const refresh = () => { panel.textContent = `${read ? 'EXPERIMENTAL WASM · '+Object.entries(read()).map(([key,value]) => `${key}: ${value}`).join(' · ') : 'Normal JS build'}\nparent width: ${width.get()} px · content rasters: ${rasters.length} · clean rasters: ${cleanRasters} · hits: ${hits.get()}\nlast rasters: ${rasters.slice(-4).map(value => `${value.revision}@${value.width}px`).join(', ')}`; };
  refresh(); const timer = window.setInterval(refresh,200);
  return { dispose() { window.clearInterval(timer); panel.remove(); controller.dispose(); } };
}
