import { Rectangle, Text, pibbl } from '@pibbl/core';
import { Fragment, jsxDEV, type JSX } from '@pibbl/core/jsx-dev-runtime';

const canvas = document.createElement('canvas');
canvas.width = 280;
canvas.height = 140;
document.body.append(canvas);

const source = { fileName: 'development.ts', lineNumber: 15, columnNumber: 3 };
const component: JSX.ElementType = Rectangle;
const background = jsxDEV(
  component,
  { style: { width: 280, height: 140, fill: '#0f766e' } },
  'background',
  false,
  source,
  undefined,
);
const label = jsxDEV(
  Text,
  { style: { left: 20, top: 48, font: '24px sans-serif', fill: '#fff' }, children: 'Development JSX' },
  'label',
  false,
  source,
  undefined,
);
const root = jsxDEV(
  Fragment,
  { children: [background, label] },
  undefined,
  true,
  source,
  undefined,
);
const controller = pibbl(canvas, root);
window.addEventListener('pagehide', () => controller.dispose(), { once: true });
