import { invert, blur } from '@crc/core/filters';
import { crc, Rectangle, Text, createElement, definePrimitive, measureElement, signal, type CRCController, type SystemStyle } from '@crc/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
const controllers: CRCController[] = [];
afterEach(() => {
  for (const controller of controllers.splice(0)) controller.dispose();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});
async function settle() {
  for (let i = 0; i < 3; i++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
}
function canvas(width: number, height: number) {
  const result = document.createElement('canvas');
  result.style.width = `${width}px`; result.style.height = `${height}px`;
  document.body.append(result);
  return result;
}
describe('responsive style surfaces', () => {
  it('uses logical size under fixed fitting and density changes across equivalent mounts', async () => {
    const observed = new Map<string, string>();
    const Probe = definePrimitive<{ id: string }, SystemStyle & { color?: string }>((props, style) => {
      observed.set(props.id, style.color!);
    });
    const targets = [canvas(1000, 300), canvas(1000, 300)];
    targets.forEach((target, index) => controllers.push(crc(target,
      <Probe id={String(index)} style={{ color: 'blue', when: [{ query: { minWidth: 600, maxHeight: 200 }, style: { color: 'red' } }] }} />,
      { viewport: { width: 700, height: 160 }, pixelRatio: index + 1, fit: index ? 'fill' : 'contain' },
    )));
    await settle();
    expect([...observed.values()]).toEqual(['red', 'red']);
    for (const target of targets) { target.style.width = '320px'; target.style.height = '500px'; }
    await settle();
    expect([...observed.values()]).toEqual(['red', 'red']);
  });

  it('resumes from zero display size with the latest active value', async () => {
    const color = signal('red');
    const observed: string[] = [];
    const Probe = definePrimitive<{}, SystemStyle & { color?: string }>((_props, style) => { observed.push(style.color!); });
    const target = canvas(700, 160);
    controllers.push(crc(target, <Probe style={{ color: 'blue', when: [{ query: { minWidth: 600 }, style: { color } }] }} />, { viewport: 'responsive', pixelRatio: 1 }));
    await settle();
    expect(observed.at(-1)).toBe('red');
    target.style.width = '0px'; target.style.height = '0px';
    await settle();
    const count = observed.length;
    color.set('purple');
    await settle();
    expect(observed).toHaveLength(count);
    target.style.width = '700px'; target.style.height = '160px';
    await settle();
    expect(observed.at(-1)).toBe('purple');
  });

  it('selects filters through the existing pixel-only composition boundary', async () => {
    const target = canvas(700, 100);
    controllers.push(crc(target, <Rectangle style={{ width: 40, height: 40, fill: 'red', when: [
      { query: { minWidth: 600 }, style: { filter: invert({ amount: 1 }) } },
    ] }} />, { viewport: 'responsive', pixelRatio: 1 }));
    await settle();
    const pixel = () => Array.from(target.getContext('2d')!.getImageData(20, 20, 1, 1).data);
    expect(pixel()).toEqual([0, 255, 255, 255]);
    target.style.width = '320px';
    await settle();
    expect(pixel()).toEqual([255, 0, 0, 255]);
  });

  it('measures a selected filter without acquiring a surface or expanding the measured box', () => {
    const createSurface = vi.spyOn(globalThis, 'OffscreenCanvas');
    const result = measureElement(createElement(Text, { children: 'label', style: {
      wrap: true, width: 100, lineHeight: 12, when: [{ query: { minWidth: 600 }, style: { lineHeight: 24, filter: blur({ radius: 10 }) } }],
    } }), { minWidth: 0, maxWidth: 700, minHeight: 0, maxHeight: 100 }, {
      measureText: () => ({ width: 20, actualBoundingBoxLeft: 0, actualBoundingBoxRight: 20, actualBoundingBoxAscent: 9, actualBoundingBoxDescent: 3 }) as TextMetrics,
    });
    expect(result).toEqual({ status: 'measured', size: { width: 100, height: 24 } });
    expect(createSurface).not.toHaveBeenCalled();
  });
});
