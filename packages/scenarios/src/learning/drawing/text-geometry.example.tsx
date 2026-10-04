import { crc, Path, Circle, Text, Rectangle, signal, type CRCController, type PathGeometry, type PathSegment, type CRCPointerEvent } from '@crc/core';
import { loadOutlineFont, createTextGeometry, type OutlineFont } from '@crc/text';

export default function mount(canvas: HTMLCanvasElement): CRCController {
  const abort = new AbortController();
  const form = document.createElement('form');
  const input = document.createElement('input');
  const button = document.createElement('button');
  const reset = document.createElement('button');
  const status = document.createElement('span');
  form.style.cssText = 'display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:14px;background:#16232d;color:#dbe7ea;font:14px sans-serif';
  input.setAttribute('aria-label', 'Text to turn into an outline');
  input.value = 'Hello CRC'; input.maxLength = 36;
  input.style.cssText = 'font:inherit;padding:10px;border:1px solid #8da1aa;border-radius:6px;min-width:220px';
  button.type = 'button'; button.textContent = 'Generate outline'; button.disabled = true;
  reset.textContent = 'Reset points'; reset.type = 'button'; reset.disabled = true;
  for (const el of [button, reset]) el.style.cssText = 'font:inherit;padding:10px;border-radius:6px;cursor:pointer';
  status.setAttribute('role', 'status'); status.textContent = 'Loading font…';
  form.append(input, button, reset, status); canvas.before(form);
  const previousTouch = canvas.style.touchAction; canvas.style.touchAction = 'none';
  const generation = signal(0);
  let geometry: PathGeometry | undefined, original: PathGeometry | undefined;
  let font: OutlineFont | undefined, disposed = false;
  let drag: { pointer: number; segment: number; xKey: string; yKey: string } | undefined;
  const stop = (event: CRCPointerEvent) => {
    if (drag?.pointer !== event.pointerId) return;
    drag = undefined;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  function Scene() {
    generation.get();
    const handles = [];
    let index = 0;
    for (const segment of geometry ?? []) {
      const segmentIndex = index++;
      const keys = segment.type === 'quadratic' ? [['cpx', 'cpy'], ['x', 'y']]
        : segment.type === 'cubic' ? [['cp1x', 'cp1y'], ['cp2x', 'cp2y'], ['x', 'y']]
          : segment.type === 'move' || segment.type === 'line' ? [['x', 'y']] : [];
      for (const [xKey, yKey] of keys) {
        const values = segment as unknown as Record<string, number>;
        handles.push(<Circle key={`${segmentIndex}:${xKey}`} style={{ cx: values[xKey], cy: values[yKey], radius: xKey === 'x' ? 3 : 4, fill: xKey === 'x' ? '#e8f5f1' : '#ffc46a', stroke: '#243c46', strokeWidth: 1, cursor: 'grab' }}
          onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); drag = { pointer: event.pointerId, segment: segmentIndex, xKey, yKey }; }}
          onPointerMove={event => {
            if (!geometry || drag?.pointer !== event.pointerId || drag.segment !== segmentIndex || drag.xKey !== xKey) return;
            const current = geometry.getSegment(segmentIndex);
            geometry.setSegment(segmentIndex, { ...current, [xKey]: event.x, [yKey]: event.y } as PathSegment);
            generation.update(value => value + 1);
            status.textContent = `Point moved · revision ${geometry.revision}`;
          }} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={() => { drag = undefined; }} />);
      }
    }
    return <>
      <Rectangle style={{ width: 900, height: 480, fill: '#102029' }} pointerEvents="none" />
      <Text style={{ left: 28, top: 28, font: '700 25px sans-serif', fill: '#f0f7f5' }} pointerEvents="none">TYPE IT. SHAPE IT.</Text>
      <Text style={{ left: 28, top: 65, font: '15px sans-serif', fill: '#a4bdc4' }} pointerEvents="none">Generate an outline, then drag the gold control points or white endpoints.</Text>
      {geometry && <Path style={{ d: geometry, fill: '#59bca8', stroke: '#a0f0d6', strokeWidth: 1 }} pointerEvents="none" />}
      {handles}
      <Text style={{ left: 28, top: 435, font: '14px monospace', fill: '#a4bdc4' }} pointerEvents="none">{`${geometry?.segmentCount ?? 0} editable segments · no font shaping during dragging`}</Text>
    </>;
  }
  const generate = () => {
    if (!font || disposed) return;
    try {
      const start = performance.now();
      const result = createTextGeometry(font, input.value, { fontSize: 130 });
      const scale = Math.min(1, 820 / Math.max(1, result.advance.x));
      result.geometry.transform({ a: scale, d: scale, e: 38, f: 290 });
      geometry = result.geometry; original = geometry.clone(); drag = undefined;
      generation.update(value => value + 1); reset.disabled = false;
      status.setAttribute('role', 'status'); status.style.cssText = '';
      status.textContent = `${result.glyphs.length} glyphs · advance ${result.advance.x.toFixed(1)} · ink ${result.inkBounds ? result.inkBounds.width.toFixed(1) + " × " + result.inkBounds.height.toFixed(1) : "empty"} · ${(performance.now() - start).toFixed(1)} ms`;
    } catch (error) {
      geometry = original = undefined; drag = undefined; reset.disabled = true;
      generation.update(value => value + 1);
      status.setAttribute('role', 'alert');
      status.style.cssText = 'flex-basis:100%;padding:10px;border:1px solid #ffb4a9;border-radius:6px;background:#482b2b;color:#ffe1db';
      status.textContent = `Cannot generate outline: ${error instanceof Error ? error.message : String(error)} Try text supported by this demo font; most emoji are not supported.`;
    }
  };
  button.onclick = generate;
  input.onkeydown = event => { if (event.key === "Enter") { event.preventDefault(); generate(); } };
  form.onsubmit = event => { event.preventDefault(); };
  reset.onclick = () => { if (original) { geometry = original.clone(); drag = undefined; generation.update(value => value + 1); } };
  let controller: CRCController;
  const dispose = () => {
    if (disposed) return; disposed = true; abort.abort(); font?.dispose(); font = undefined;
    controller?.dispose(); form.remove(); canvas.style.touchAction = previousTouch;
    geometry = original = undefined; form.onsubmit = null; reset.onclick = null; button.onclick = null; input.onkeydown = null;
  };
  try { controller = crc(canvas, <Scene />); }
  catch (error) { dispose(); throw error; }
  void loadOutlineFont(new URL('/crc-text/ABeeZee-Regular.ttf', document.baseURI), { signal: abort.signal }).then(value => {
    if (disposed) { value.dispose(); return; }
    font = value; button.disabled = false; generate();
  }).catch(error => { if (!disposed) status.textContent = `Font loading failed: ${String(error)}`; });
  return { dispose };
}
