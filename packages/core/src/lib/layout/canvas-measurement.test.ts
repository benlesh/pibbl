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
