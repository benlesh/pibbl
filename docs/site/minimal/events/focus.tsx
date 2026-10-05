import {
  FocusManagement,
  Group,
  KeyboardNavigation,
  Rectangle,
  Text,
  crc,
  useEventTarget,
  useRectPath,
  type CRCKeyboardNavigationOptions,
  type FocusManagementProps,
  type KeyboardNavigationProps,
} from '@crc/core';

const canvas = document.createElement('canvas');
canvas.width = 320;
canvas.height = 140;
const status = document.createElement('p');
status.setAttribute('role', 'status');
status.textContent = 'Tab to a tile, then use the arrow keys.';
document.body.append(canvas, status);

function Tile({ label, x }: { label: string; x: number }) {
  const path = useRectPath(x, 34, 112, 70);
  const focus = useEventTarget(
    {
      onFocus: () => { status.textContent = `${label} focused`; },
      onClick: () => { status.textContent = `${label} activated`; },
    },
    {
      path,
      fill: true,
      cursor: 'pointer',
      keyboardNavigationBounds: { x, y: 34, width: 112, height: 70 },
    },
  );
  return <>
    <Rectangle pointerEvents="none" style={{ left: x, top: 34, width: 112, height: 70, fill: focus.isFocused ? '#0f766e' : '#2563eb' }} />
    <Text pointerEvents="none" style={{ left: x + 25, top: 57, font: '18px sans-serif', fill: '#fff' }}>{label}</Text>
  </>;
}

const options: CRCKeyboardNavigationOptions = { mode: 'directional' };
const navigation: KeyboardNavigationProps = {
  ...options,
  children: <Group><Tile label="First" x={24} /><Tile label="Second" x={176} /></Group>,
};
const focus: FocusManagementProps = {
  children: <Group><KeyboardNavigation {...navigation} /></Group>,
};
const controller = crc(canvas, <FocusManagement {...focus} />);
window.addEventListener('pagehide', () => controller.dispose(), { once: true });
