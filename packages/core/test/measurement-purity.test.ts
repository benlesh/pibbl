import { createElement, definePrimitive, measureElement, signal, Text } from '@crc/core';
import { expect, it } from 'vitest';

const constraints = { minWidth: 0, maxWidth: 100, minHeight: 0, maxHeight: 100 };
const metrics = { width: 10, actualBoundingBoxLeft: 0, actualBoundingBoxRight: 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 } as TextMetrics;
const service = { measureText: () => metrics };

it.each(['normalize', 'measure', 'text-service'] as const)(
  'rejects signal writes during standalone measurement %s and restores the write policy', stage => {
    const value = signal(1);
    let updaterCalls = 0;
    const write = () => value.update(previous => { updaterCalls++; return previous + 1; });
    const Probe = definePrimitive<{}>(() => { throw new Error('must not render'); }, {
      normalizeStyle: style => { if (stage === 'normalize') write(); return style; },
      measure: () => { if (stage === 'measure') write(); return { status: 'measured', size: { width: 10, height: 10 } }; },
    });
    const element = stage === 'text-service' ? createElement(Text, {}, 'test') : createElement(Probe, {});
    const measuringService = stage === 'text-service' ? { measureText: () => { write(); return metrics; } } : service;
    expect(() => measureElement(element, constraints, measuringService)).toThrow(/measurement.*signal|signal.*measurement/i);
    expect(value.get()).toBe(1);
    expect(updaterCalls).toBe(0);
    value.set(3);
    expect(value.get()).toBe(3);
    expect(measureElement(createElement(Text, {}, 'ok'), constraints, service).status).toBe('measured');
  },
);
