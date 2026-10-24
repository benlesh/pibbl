import { expect, it, vi } from 'vitest';
import { Text, createElement, type CanvasMeasurementService } from '@pibbl/core';
import { canvasMeasurementService } from './canvas-measurement';
import { measureBaselineElement } from './measure';

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
