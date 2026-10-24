import { expect, it, vi } from 'vitest';
import { Text, createElement, type CanvasMeasurementService, type SystemStyle } from '@pibbl/core';
import { canvasMeasurementService } from './canvas-measurement';
import { measureBaselineElement, setPreparedBaselineOwner } from './measure';
import { GLOBAL_STATE } from '../global-state';
import { RootRenderTransaction } from '../render-transaction';
import { setPreNormalizedStyle } from '../style/resolve-dispatch';

it('isolates requested Canvas baseline state on success and failure', () => {
  const context = document.createElement('canvas').getContext('2d')!;
  context.font = '17px serif'; context.textBaseline = 'bottom';
  const service = canvasMeasurementService(context);
  const metrics = service.measureTextAtBaseline!('Ag', { font: '20px monospace', textBaseline: 'top' });
  expect(Number.isFinite(metrics.alphabeticBaseline)).toBe(true);
  expect(context.font).toBe('17px serif'); expect(context.textBaseline).toBe('bottom');
  const failure = new Error('measurement unavailable');
  const spy = vi.spyOn(context, 'measureText').mockImplementationOnce(() => { throw failure; });
  expect(() => service.measureTextAtBaseline!('Ag', { font: '20px monospace', textBaseline: 'top' })).toThrow(failure);
  expect(context.font).toBe('17px serif'); expect(context.textBaseline).toBe('bottom');
  spy.mockRestore();
});

it('requires explicit finite Text baseline metrics and preserves service method receivers', () => {
  const text = createElement(Text, { children: 'Ag', style: { width: 80, height: 40, font: '20px sans-serif', textBaseline: 'top' } });
  const allocation = { x: 0, y: 0, width: 80, height: 40 };
  const metrics = { width: 20, actualBoundingBoxLeft: 0, actualBoundingBoxRight: 20, actualBoundingBoxAscent: 0, actualBoundingBoxDescent: 20 } as TextMetrics;
  const legacy: CanvasMeasurementService = { measureText: () => metrics };
  expect(measureBaselineElement(text, allocation, legacy)).toEqual({ status: 'unsupported', reason: expect.stringContaining('measureTextAtBaseline') });
  const service: CanvasMeasurementService & { offset: number } = {
    offset: 12,
    measureText: () => metrics,
    measureTextAtBaseline() { return { ...metrics, alphabeticBaseline: -this.offset }; },
  };
  expect(measureBaselineElement(text, allocation, service)).toEqual({ status: 'measured', first: 12, last: 12 });
  service.offset = Number.NaN;
  expect(measureBaselineElement(text, allocation, service)).toEqual({ status: 'unsupported', reason: expect.stringContaining('finite alphabeticBaseline') });
});


it('returns first and last service-reported Text baselines for wrapped lines and rejects a zero-line allocation', () => {
  const metrics = (text: string): TextMetrics => ({
    width: text.length * 6,
    actualBoundingBoxLeft: 0,
    actualBoundingBoxRight: text.length * 6,
    actualBoundingBoxAscent: 8,
    actualBoundingBoxDescent: 2,
    alphabeticBaseline: -4,
  } as TextMetrics);
  const service: CanvasMeasurementService = {
    measureText: metrics,
    measureTextAtBaseline: text => metrics(text),
  };
  const text = createElement(Text, {
    children: 'aa aa aa',
    style: { width: 20, height: 30, font: '10px monospace', textBaseline: 'top', lineHeight: 10, wrap: true, fit: 'visible', overflow: 'visible' },
  });
  expect(measureBaselineElement(text, { x: 0, y: 0, width: 20, height: 30 }, service)).toEqual({ status: 'measured', first: 4, last: 24 });
  expect(measureBaselineElement(text, { x: 0, y: 0, width: 20, height: 0 }, service)).toEqual({ status: 'unsupported', reason: expect.stringContaining('does not resolve a line') });
});


it('requires and consumes the exact current-owner proof for a mounted responsive baseline selection', () => {
  const previousTransaction = GLOBAL_STATE.renderTransaction;
  const previousRefs = GLOBAL_STATE.componentRefs;
  const transaction = new RootRenderTransaction();
  const receiver = {};
  const style: SystemStyle & { width: number; height: number; font: string } = { width: 40, height: 20, font: '10px monospace' };
  const element = createElement(Text, { children: 'Ag', style });
  const owner = { x: 0, y: 0, width: 100, height: 80 };
  const allocation = { x: 0, y: 0, width: 40, height: 20 };
  const query = { basis: { width: 100, height: 80 }, axes: 1 };
  const service = canvasMeasurementService(document.createElement('canvas').getContext('2d')!);
  try {
    GLOBAL_STATE.renderTransaction = transaction;
    GLOBAL_STATE.componentRefs = {} as NonNullable<typeof GLOBAL_STATE.componentRefs>;
    setPreNormalizedStyle(element, style, element, receiver, query);
    expect(() => measureBaselineElement(element, allocation, service)).toThrow('PIBBL_STYLE_QUERY_MEASUREMENT');
    setPreNormalizedStyle(element, style, element, receiver, query);
    setPreparedBaselineOwner(element, { ...owner, width: 99 });
    expect(() => measureBaselineElement(element, allocation, service)).toThrow('PIBBL_STYLE_QUERY_MEASUREMENT');
    setPreNormalizedStyle(element, style, element, receiver, query);
    setPreparedBaselineOwner(element, owner);
    expect(measureBaselineElement(element, allocation, service).status).toBe('measured');
    setPreNormalizedStyle(element, style, element, receiver, query);
    expect(() => measureBaselineElement(element, allocation, service)).toThrow('PIBBL_STYLE_QUERY_MEASUREMENT');
  } finally {
    transaction.finish(false);
    GLOBAL_STATE.renderTransaction = previousTransaction;
    GLOBAL_STATE.componentRefs = previousRefs;
  }
});
