import { createElement, Rectangle, signal } from '@pibbl/core';
import { pibblSync } from '@pibbl/core/sync';
import { LayoutPreflightLab, HtmlProjectionLab } from '../../../packages/scenarios/src/layout-preflight-lab';

const width = signal(80), grow = signal(0), minimum = signal(0), nested = signal(false), direct = signal(false), described = signal(false), layer = signal(false), grid = signal(false), gridRoot = signal(false), flow = signal(false), nativeGrid = signal(false), nativeFlow = signal(false), nativeSpan = signal(false), nativeFill = signal('red'), healthyWidth = signal(50);
let evaluations = 0, allocatedWidth = 0, hits = 0, failures = 0, layerHits = 0, nativeHits = 0;
const nativeWidths = [0, 0, 0];
const title = document.createElement('h1'); title.textContent = 'Known sibling layout preflight';
const description = document.createElement('p'); description.textContent = 'Fail the later blue sibling: the earlier red component must not run. The green independent root still updates. Recover explicitly resubmits the scene at the latest 100px width, then click its right edge.';
const canvas = document.createElement('canvas'); canvas.width = 300; canvas.height = 60; canvas.id = 'subject';
const healthy = document.createElement('canvas'); healthy.width = 100; healthy.height = 40; healthy.id = 'healthy';
canvas.style.border = healthy.style.border = '1px solid #94a3b8';
const controls = document.createElement('div'), state = document.createElement('pre');
document.body.append(title, description, canvas, healthy, controls, state);
const scene = createElement(LayoutPreflightLab, { width, grow, minimum, nested, direct, described, layer, grid, gridRoot, flow, nativeGrid, nativeFlow, nativeSpan, nativeFill, nativeWidth: (index: number, value: number) => { nativeWidths[index] = value; }, nativeHit: () => { nativeHits++; },
  evaluate: (value: number) => { evaluations++; allocatedWidth = value; }, hit: () => { hits++; }, layerHit: () => { layerHits++; },
});
let subject = pibblSync(canvas, scene);
const independent = pibblSync(healthy, createElement(Rectangle, { style: { width: healthyWidth, height: 30, fill: '#008000' } }));
const htmlOverflow = signal(false);
let htmlMounts = 0, htmlUpdates = 0, htmlAborts = 0, htmlFailures = 0, htmlClicks = 0;
const htmlWrapper = document.createElement('div'); htmlWrapper.style.cssText = 'position:relative;width:240px;height:40px;isolation:isolate';
const htmlCanvas = document.createElement('canvas'); htmlCanvas.width = 240; htmlCanvas.height = 40; htmlCanvas.style.cssText = 'display:block;width:100%;height:100%;margin:0';
const htmlOverlay = document.createElement('div'); htmlOverlay.id = 'projection-overlay'; htmlOverlay.style.cssText = 'position:absolute;inset:0;pointer-events:none';
htmlWrapper.append(htmlCanvas, htmlOverlay); document.body.insertBefore(htmlWrapper, controls);
const htmlScene = createElement(HtmlProjectionLab, { overflow: htmlOverflow,
  mount: (element: HTMLDivElement, _data: boolean, abort: AbortSignal) => {
    htmlMounts++; const button = document.createElement('button'); button.textContent = 'Native HTML host'; button.style.cssText = 'margin:0;padding:0;width:96px;height:24px'; button.addEventListener('click', () => { htmlClicks++; refresh(); }, { signal: abort }); element.append(button);
    abort.addEventListener('abort', () => { htmlAborts++; }); return () => { htmlUpdates++; };
  },
  laterMount: () => () => {},
});
let htmlSubject = pibblSync(htmlCanvas, htmlScene, { htmlOverlay });
const refresh = () => { state.textContent = JSON.stringify({ evaluations, allocatedWidth, hits, layerHits, nativeWidths, nativeHits, failures, healthyWidth: healthyWidth.get(), htmlMounts, htmlUpdates, htmlAborts, htmlFailures, htmlClicks }); };
const error = (event: ErrorEvent) => {
  if (String(event.error?.message).includes('HtmlBox projection must be finite')) { htmlFailures++; event.preventDefault(); refresh(); }
  if (String(event.error?.message).includes('flexGrow received -1') || String(event.error?.message).includes('minimum must not exceed maximum')) { failures++; event.preventDefault(); refresh(); }
};
window.addEventListener('error', error);
for (const [label, action] of [
  ['Fail HTML projection', () => { htmlOverflow.set(true); healthyWidth.set(70); }],
  ['Recover HTML', () => { htmlOverflow.set(false); htmlSubject = pibblSync(htmlCanvas, htmlScene); }],
  ['Use native Flow wrap', () => { width.set(60); nativeFill.set('blue'); nativeFlow.set(true); }],
  ['Widen native Flow', () => { width.set(100); }],
  ['Paint native Flow', () => { nativeFill.set('orange'); }],
  ['Use native Grid spans', () => { width.set(200); nativeFill.set('blue'); nativeSpan.set(true); nativeGrid.set(true); }],
  ['Use native Grid tracks', () => { width.set(200); nativeGrid.set(true); }],
  ['Resize native tracks', () => { width.set(260); }],
  ['Paint native tracks', () => { nativeFill.set('orange'); }],
  ['Use prepared Grid root', () => { gridRoot.set(true); }],
  ['Use Flow sequence', () => { flow.set(true); }],
  ['Use Grid cells', () => { grid.set(true); }],
  ['Use Layer boundary', () => { layer.set(true); }],
  ['Use nested layout', () => { nested.set(true); }],
  ['Use direct root', () => { direct.set(true); }],
  ['Use described layout', () => { described.set(true); }],
  ['Fail later sibling', () => { width.set(100); grow.set(-1); healthyWidth.set(70); }],
  ['Fail later sizing', () => { width.set(100); minimum.set(90); healthyWidth.set(70); }],
  ['Recover', () => { grow.set(0); minimum.set(0); subject = pibblSync(canvas, scene); }],
] as const) {
  const button = document.createElement('button'); button.textContent = label; button.onclick = () => { action(); refresh(); }; controls.append(button);
}
const timer = window.setInterval(refresh, 50); refresh();
window.addEventListener('pagehide', () => { clearInterval(timer); window.removeEventListener('error', error); subject.dispose(); independent.dispose(); htmlSubject.dispose(); }, { once: true });
