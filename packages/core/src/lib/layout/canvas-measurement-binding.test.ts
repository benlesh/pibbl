import { expect, it } from 'vitest';
import { GLOBAL_STATE } from '../global-state.js';
import type { RenderingContext2D, SystemStyle } from '../types.js';
import { bindCanvasMeasurementService, canvasMeasurementService } from './canvas-measurement.js';

function context(width: number): RenderingContext2D {
  return { save() {}, restore() {}, font: '', measureText: () => ({ width }) } as unknown as RenderingContext2D;
}
it('rebinds a mounted Canvas measurement service to the current render target', () => {
  const previous = GLOBAL_STATE.renderContext;
  const first = context(10), second = context(20);
  try {
    GLOBAL_STATE.renderContext = first;
    const binding = bindCanvasMeasurementService(canvasMeasurementService(first));
    expect(binding().measureText('x', '10px monospace').width).toBe(10);
    GLOBAL_STATE.renderContext = second;
    expect(binding().measureText('x', '10px monospace').width).toBe(20);
  } finally { GLOBAL_STATE.renderContext = previous; }
});
it('preserves an explicitly supplied independent measurement service', () => {
  const previous = GLOBAL_STATE.renderContext;
  try {
    GLOBAL_STATE.renderContext = context(10);
    const service = { measureText: () => ({ width: 30 } as TextMetrics) };
    const binding = bindCanvasMeasurementService(service);
    GLOBAL_STATE.renderContext = context(20);
    expect(binding()).toBe(service);
    expect(binding().measureText('x', '10px monospace').width).toBe(30);
  } finally { GLOBAL_STATE.renderContext = previous; }
});

it('does not turn a stale responsive baseline owner into a fresh replay proof', async () => {
  const { createElement } = await import('../element/create-element.js');
  const { Text } = await import('../components/text.js');
  const { setPreNormalizedStyle } = await import('../style/resolve-dispatch.js');
  const { RootRenderTransaction } = await import('../render-transaction.js');
  const { measureBaselineElement, setPreparedBaselineOwner } = await import('./measure.js');
  const previousTransaction = GLOBAL_STATE.renderTransaction, previousRefs = GLOBAL_STATE.componentRefs;
  const first = new RootRenderTransaction(), second = new RootRenderTransaction();
  const receiver = {}, style: SystemStyle & { width: number; height: number; font: string } = { width: 40, height: 20, font: '10px monospace' };
  const owner = { x: 0, y: 0, width: 100, height: 80 }, query = { basis: owner, axes: 1 };
  const element = createElement(Text, { children: 'Ag', style });
  const service = { measureText: () => { throw new Error('An invalid owner must not reach measurement.'); } };
  try {
    GLOBAL_STATE.renderTransaction = first;
    GLOBAL_STATE.componentRefs = {} as NonNullable<typeof GLOBAL_STATE.componentRefs>;
    setPreNormalizedStyle(element, style, element, receiver, query); setPreparedBaselineOwner(element, owner);
    GLOBAL_STATE.renderTransaction = second;
    expect(() => measureBaselineElement(element, { x: 0, y: 0, width: 40, height: 20 }, service)).toThrow('PIBBL_STYLE_QUERY_MEASUREMENT');
  } finally {
    first.finish(false); second.finish(false);
    GLOBAL_STATE.renderTransaction = previousTransaction; GLOBAL_STATE.componentRefs = previousRefs;
  }
});
