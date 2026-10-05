import {
  Path,
  crc,
  useEventTarget,
  useLinePath,
  useRectPath,
  useSvgPath,
  type PixelGridAlignment,
} from '@crc/core';

const canvas = document.createElement('canvas');
canvas.width = 340;
canvas.height = 150;
const status = document.createElement('p');
status.setAttribute('role', 'status');
document.body.append(canvas, status);

function Paths() {
  const alignment: PixelGridAlignment = 'round';
  const rectangle = useRectPath(16, 18, 90, 90, { alignToPixelGrid: alignment, cornerRadius: 8 });
  const line = useLinePath([[123, 107], [169, 18], [215, 107]]);
  const svg = useSvgPath('M235 107 L280 18 L325 107 Z');
  useEventTarget({ onClick: () => { status.textContent = 'Rounded rectangle'; } }, { path: rectangle, fill: true });
  useEventTarget({ onClick: () => { status.textContent = 'Polyline'; } }, { path: line, lineInteractionWidth: 12 });
  useEventTarget({ onClick: () => { status.textContent = 'SVG triangle'; } }, { path: svg, fill: true });
  return <>
    <Path pointerEvents="none" style={{ d: rectangle, fill: '#2563eb' }} />
    <Path pointerEvents="none" style={{ d: line, stroke: '#be123c', strokeWidth: 5 }} />
    <Path pointerEvents="none" style={{ d: svg, fill: '#0f766e' }} />
  </>;
}

const controller = crc(canvas, <Paths />);
window.addEventListener('pagehide', () => controller.dispose(), { once: true });
