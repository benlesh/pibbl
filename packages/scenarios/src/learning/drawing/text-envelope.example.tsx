import {
  crc, Group, Path, PathGeometry, Circle, Line, Rectangle, Text, HtmlBox, signal,
  envelopeTransform, affineTransform, composeTransforms, transformPath,
  type CRCController, type CRCPointerEvent, type HtmlMountCallback, type PathPoint, type PathRect,
} from '@crc/core';
import { loadOutlineFont, createTextGeometry, type OutlineFont } from '@crc/text';

type Curve = [PathPoint, PathPoint, PathPoint, PathPoint];
const colors = ['#dc6743', '#4d9089', '#9065b0', '#bb8b31', '#4478b2'];
function curvePath(points: Curve) {
  const p = new PathGeometry(); p.moveTo(points[0].x, points[0].y);
  p.bezierCurveTo(points[1].x, points[1].y, points[2].x, points[2].y, points[3].x, points[3].y); return p;
}
function preset(name: string): Curve[] {
  if (name === 'Wave') return [
    [{ x: 110, y: 340 }, { x: 340, y: 200 }, { x: 590, y: 470 }, { x: 850, y: 320 }],
    [{ x: 110, y: 500 }, { x: 340, y: 350 }, { x: 590, y: 630 }, { x: 850, y: 490 }],
  ];
  if (name === 'Pinch') return [
    [{ x: 110, y: 290 }, { x: 340, y: 420 }, { x: 620, y: 420 }, { x: 850, y: 290 }],
    [{ x: 110, y: 550 }, { x: 340, y: 420 }, { x: 620, y: 420 }, { x: 850, y: 550 }],
  ];
  if (name === 'Straight') return [
    [{ x: 110, y: 320 }, { x: 355, y: 320 }, { x: 605, y: 320 }, { x: 850, y: 320 }],
    [{ x: 110, y: 510 }, { x: 355, y: 510 }, { x: 605, y: 510 }, { x: 850, y: 510 }],
  ];
  return [
    [{ x: 110, y: 340 }, { x: 290, y: 210 }, { x: 620, y: 300 }, { x: 850, y: 270 }],
    [{ x: 110, y: 535 }, { x: 330, y: 490 }, { x: 620, y: 610 }, { x: 850, y: 420 }],
  ];
}

export default function mount(canvas: HTMLCanvasElement): CRCController {
  const abort = new AbortController(), generation = signal(0);
  let font: OutlineFont | undefined, disposed = false;
  let curves = preset('Ribbon'), content = 'BEND THE RULES', rotation = 0, skew = 0, showGuides = true;
  let source = new PathGeometry(), bounds: PathRect = { x: 0, y: 0, width: 1, height: 1 };
  let output = new PathGeometry(), grid = new PathGeometry(), message = 'Loading outline font…', valid = false;
  let placement = new DOMMatrix(), selected = 0, lastTime = 0;
  let drag: { pointer: number; curve: number; point: number } | undefined;
  const update = () => {
    if (!font || disposed) return;
    const start = performance.now();
    try {
      placement = new DOMMatrix().translate(480, 420).rotate(rotation).skewX(skew).translate(-480, -420);
      const guides = curves.map((points, i) => ({ at: i / (curves.length - 1), path: curvePath(points) }));
      const mapping = composeTransforms(envelopeTransform({ source: bounds, guides }), affineTransform(placement));
      const next = transformPath(source, mapping, { tolerance: 0.45, maxSegments: 80_000 });
      const lines = new PathGeometry();
      for (let i = 0; i <= 12; i++) { const x = bounds.x + bounds.width * i / 12; lines.moveTo(x, bounds.y); lines.lineTo(x, bounds.y + bounds.height); }
      for (let i = 0; i <= 4; i++) { const y = bounds.y + bounds.height * i / 4; lines.moveTo(bounds.x, y); lines.lineTo(bounds.x + bounds.width, y); }
      const nextGrid = transformPath(lines, mapping, { tolerance: 0.7, maxSegments: 30_000 });
      output = next; grid = nextGrid; valid = true;
      lastTime = performance.now() - start;
      message = source.segmentCount ? `${curves.length} guides · ${output.segmentCount.toLocaleString()} outline segments · ${lastTime.toFixed(0)} ms` : 'Type something to shape.';
    } catch (error) {
      valid = false; message = `Preview paused: ${error instanceof Error ? error.message : String(error)}`;
    }
    generation.update(n => n + 1);
  };
  const shape = () => {
    if (!font) return;
    try {
      const text = createTextGeometry(font, content, { fontSize: 150 });
      source = text.geometry; bounds = text.inkBounds ?? { x: 0, y: 0, width: 1, height: 1 };
      update();
    } catch (error) { valid = false; message = `Cannot outline this text: ${error instanceof Error ? error.message : String(error)}`; generation.update(n => n + 1); }
  };
  const controls: HtmlMountCallback<unknown> = (element, _data, lifetime) => {
    element.style.cssText += ';font:13px system-ui;color:#263e3b;display:flex;flex-wrap:wrap;gap:10px;align-content:start';
    const input = document.createElement('input'); input.value = content; input.maxLength = 48; input.setAttribute('aria-label', 'Text to warp');
    input.style.cssText = 'flex:1;min-width:240px;height:42px;box-sizing:border-box;padding:10px 14px;font:600 17px system-ui;border:1px solid #b9c9be;border-radius:7px;background:#fffdf7;color:#233b36';
    input.addEventListener('input', () => { content = input.value; shape(); }, { signal: lifetime }); element.append(input);
    const select = document.createElement('select'); select.setAttribute('aria-label', 'Envelope preset');
    for (const name of ['Ribbon', 'Wave', 'Pinch', 'Straight']) { const o = document.createElement('option'); o.textContent = name; select.append(o); }
    select.style.cssText = 'height:42px;padding:0 14px;font:inherit;border:1px solid #b9c9be;border-radius:7px;background:#fffdf7;color:#233b36';
    select.addEventListener('change', () => { curves = preset(select.value); selected = 0; update(); }, { signal: lifetime }); element.append(select);
    const button = (label: string, action: () => void) => {
      const b = document.createElement('button'); b.textContent = label; b.type = 'button';
      b.style.cssText = 'height:42px;padding:0 13px;font:600 12px system-ui;border:1px solid #b9c9be;border-radius:7px;background:#e7ede2;color:#233b36;cursor:pointer';
      b.addEventListener('click', action, { signal: lifetime }); element.append(b); return b;
    };
    const addGuide = button('+ Guide', () => {
      if (curves.length >= 5) return;
      const i = Math.min(selected, curves.length - 2), a = curves[i], b = curves[i + 1];
      curves.splice(i + 1, 0, a.map((p, j) => ({ x: (p.x + b[j].x) / 2, y: (p.y + b[j].y) / 2 })) as Curve);
      selected = i + 1; update();
    }); addGuide.title = 'Insert a guide after the selected curve (up to five).';
    button('− Guide', () => { if (curves.length > 2) { curves.splice(Math.max(1, Math.min(selected, curves.length - 2)), 1); selected = 0; update(); } });
    button('Reset', () => { curves = preset('Ribbon'); rotation = skew = selected = 0; rotationInput.value = skewInput.value = '0'; select.value = 'Ribbon'; update(); });
    const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:22px;align-items:center;flex-wrap:wrap;width:100%;padding-top:4px'; element.append(row);
    const range = (label: string, min: number, max: number, change: (n: number) => void) => {
      const wrapper = document.createElement('label'); wrapper.style.cssText = 'display:flex;gap:9px;align-items:center'; wrapper.append(label);
      const slider = document.createElement('input'); slider.type = 'range'; slider.min = String(min); slider.max = String(max); slider.value = '0'; slider.setAttribute('aria-label', label); slider.style.cssText = 'width:135px;accent-color:#367c6c';
      slider.addEventListener('input', () => { change(Number(slider.value)); update(); }, { signal: lifetime }); wrapper.append(slider); row.append(wrapper); return slider;
    };
    const rotationInput = range('Rotate', -30, 30, n => { rotation = n; });
    const skewInput = range('Skew', -30, 30, n => { skew = n; });
    const label = document.createElement('label'), toggle = document.createElement('input'); toggle.type = 'checkbox'; toggle.checked = true;
    toggle.addEventListener('change', () => { showGuides = toggle.checked; generation.update(n => n + 1); }, { signal: lifetime }); label.append(toggle, ' Show guides'); row.append(label);
    return () => {};
  };
  const stop = (event: CRCPointerEvent) => {
    if (drag?.pointer !== event.pointerId) return; drag = undefined;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  function Scene() {
    generation.get();
    return <>
      <Rectangle style={{ width: 960, height: 700, fill: '#f6f3e9' }} pointerEvents="none" />
      <Text style={{ x: 28, y: 24, font: '800 28px system-ui', fill: '#233b36' }} pointerEvents="none">Bend the rules.</Text>
      <Text style={{ x: 932, y: 34, textAlign: 'right', font: '600 11px system-ui', fill: '#47796d' }} pointerEvents="none">TEXT / ENVELOPE / COMPOSITION</Text>
      <Text style={{ x: 28, y: 62, font: '14px system-ui', fill: '#63746b' }} pointerEvents="none">Your words. Your curves. Drag the solid endpoints and hollow control handles anywhere.</Text>
      <Group style={{ translateX: 28, translateY: 94 }}><HtmlBox mount={controls} data={null} style={{ width: 904, height: 108 }} /></Group>
      <Rectangle style={{ x: 20, y: 220, width: 920, height: 420, fill: '#eeeee3' }} pointerEvents="none" />
      {showGuides && <Path style={{ d: grid, stroke: '#bdc9bb', strokeWidth: 0.8 }} pointerEvents="none" />}
      <Path style={{ d: output, fill: '#233b36', stroke: '#233b36', strokeWidth: 1.5, opacity: valid ? 1 : 0.3 }} pointerEvents="none" />
      {showGuides && curves.map((points, i) => {
        const color = colors[i], shown = points.map(p => placement.transformPoint(p));
        const path = curvePath(points); path.transform(placement);
        return <>
          <Path key={`curve-${i}`} style={{ d: path, stroke: color, strokeWidth: selected === i ? 2.5 : 1.5 }} pointerEvents="none" />
          <Line key={`arm-a-${i}`} style={{ coords: [[shown[0].x, shown[0].y], [shown[1].x, shown[1].y]], stroke: color, strokeWidth: 1 }} pointerEvents="none" />
          <Line key={`arm-b-${i}`} style={{ coords: [[shown[2].x, shown[2].y], [shown[3].x, shown[3].y]], stroke: color, strokeWidth: 1 }} pointerEvents="none" />
          {shown.map((p, j) => <Circle key={`handle-${i}-${j}`} style={{ cx: p.x, cy: p.y, radius: j === 0 || j === 3 ? 8 : 7, fill: j === 0 || j === 3 ? color : '#fffdf7', stroke: color, strokeWidth: 2, cursor: 'grab' }}
            onPointerDown={event => { selected = i; event.currentTarget.setPointerCapture(event.pointerId); drag = { pointer: event.pointerId, curve: i, point: j }; generation.update(n => n + 1); }}
            onPointerMove={event => {
              if (drag?.pointer !== event.pointerId || drag.curve !== i || drag.point !== j) return;
              const q = placement.inverse().transformPoint({ x: event.x, y: event.y });
              curves[i][j] = { x: q.x, y: q.y }; update();
            }} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={() => { drag = undefined; }} />)}
        </>;
      })}
      <Text style={{ x: 28, y: 656, font: '12px system-ui', fill: valid ? '#63746b' : '#a33b25' }} pointerEvents="none">{message}</Text>
      <Text style={{ x: 932, y: 678, textAlign: 'right', font: '11px system-ui', fill: '#63746b' }} pointerEvents="none">Outline → envelope → rotate & skew · original text stays intact</Text>
    </>;
  }
  const placeholder = document.createComment('text-envelope canvas'); canvas.before(placeholder);
  const wrapper = document.createElement('div'); wrapper.style.cssText = 'position:relative;width:100%;height:100%;isolation:isolate';
  const overlay = document.createElement('div'); overlay.style.cssText = 'position:absolute;inset:0;z-index:1;pointer-events:none';
  const previousStyle = canvas.getAttribute('style'); canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
  placeholder.after(wrapper); wrapper.append(canvas, overlay);
  let controller: CRCController | undefined;
  const dispose = () => {
    if (disposed) return; disposed = true; abort.abort(); font?.dispose(); drag = undefined;
    try { controller?.dispose(); } finally {
      if (canvas.parentElement === wrapper) placeholder.after(canvas);
      if (previousStyle === null) canvas.removeAttribute('style'); else canvas.setAttribute('style', previousStyle);
      wrapper.remove(); placeholder.remove();
    }
  };
  try { controller = crc(canvas, <Scene />, { viewport: { width: 960, height: 700 }, htmlOverlay: overlay }); }
  catch (error) { dispose(); throw error; }
  void loadOutlineFont(new URL('/crc-text/Lato-Regular.ttf', document.baseURI), { signal: abort.signal }).then(value => {
    if (disposed) { value.dispose(); return; } font = value; shape();
  }).catch(error => { if (!disposed) { message = `Font loading failed: ${String(error)}`; generation.update(n => n + 1); } });
  return { dispose };
}
