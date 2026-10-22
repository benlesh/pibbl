import { createElement, Rectangle, signal } from '@pibbl/core';
import { pibblSync } from '@pibbl/core/sync';
import { LayoutPreflightLab } from '../../../packages/scenarios/src/layout-preflight-lab';

const width = signal(80), grow = signal(0), healthyWidth = signal(50);
let evaluations = 0, allocatedWidth = 0, hits = 0, failures = 0;
const title = document.createElement('h1'); title.textContent = 'Known sibling layout preflight';
const description = document.createElement('p'); description.textContent = 'Fail the later blue sibling: the earlier red component must not run. The green independent root still updates. Recover explicitly resubmits the scene at the latest 100px width, then click its right edge.';
const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 40; canvas.id = 'subject';
const healthy = document.createElement('canvas'); healthy.width = 100; healthy.height = 40; healthy.id = 'healthy';
canvas.style.border = healthy.style.border = '1px solid #94a3b8';
const controls = document.createElement('div'), state = document.createElement('pre');
document.body.append(title, description, canvas, healthy, controls, state);
const scene = createElement(LayoutPreflightLab, { width, grow,
  evaluate: (value: number) => { evaluations++; allocatedWidth = value; }, hit: () => { hits++; },
});
let subject = pibblSync(canvas, scene);
const independent = pibblSync(healthy, createElement(Rectangle, { style: { width: healthyWidth, height: 30, fill: '#008000' } }));
const refresh = () => { state.textContent = JSON.stringify({ evaluations, allocatedWidth, hits, failures, healthyWidth: healthyWidth.get() }); };
const error = (event: ErrorEvent) => {
  if (String(event.error?.message).includes('flexGrow received -1')) { failures++; event.preventDefault(); refresh(); }
};
window.addEventListener('error', error);
for (const [label, action] of [
  ['Fail later sibling', () => { width.set(100); grow.set(-1); healthyWidth.set(70); }],
  ['Recover', () => { grow.set(0); subject = pibblSync(canvas, scene); }],
] as const) {
  const button = document.createElement('button'); button.textContent = label; button.onclick = () => { action(); refresh(); }; controls.append(button);
}
const timer = window.setInterval(refresh, 50); refresh();
window.addEventListener('pagehide', () => { clearInterval(timer); window.removeEventListener('error', error); subject.dispose(); independent.dispose(); }, { once: true });
