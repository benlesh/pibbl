import { compileNativeFilters, type NativePreparedFilter } from '../../filters/native-operations';
import { invert, blur } from '@crc/core/filters';
import { describe, expect, it, vi } from 'vitest';
import { definePrimitive } from '../define-primitive';
import { createElement } from '../element/create-element';
import { executeRender } from '../execute-render';
import { mountCRC } from '../mount-crc';
import type { CRCController, CRCNode, SystemStyle } from '../types';
import { setPreNormalizedStyle, takePreNormalizedStyle } from './resolve-dispatch';
import { normalizeDirectChildStyle } from '../layout/absolute';

describe('render style dispatch', () => {
  it('checks placement metadata only once for an ordinary primitive', () => {
    const Probe = definePrimitive<{}>(() => undefined);
    const element = createElement(Probe, {});
    let placementMap: WeakMap<object, unknown> | undefined;
    const originalSet = WeakMap.prototype.set;
    const set = vi.spyOn(WeakMap.prototype, 'set').mockImplementation(function (this: WeakMap<object, unknown>, key, value) {
      if (key === element && (value as { source?: unknown })?.source === element) placementMap = this;
      return originalSet.call(this, key, value);
    });
    try { setPreNormalizedStyle(element, {}); } finally { set.mockRestore(); }
    expect(placementMap).toBeDefined();
    takePreNormalizedStyle(element);
    let lookups = 0;
    const originalGet = WeakMap.prototype.get;
    const get = vi.spyOn(WeakMap.prototype, 'get').mockImplementation(function (this: WeakMap<object, unknown>, key) {
      if (this === placementMap && key === element) lookups++;
      return originalGet.call(this, key);
    });
    let mounted: ReturnType<typeof mountAndRender> | undefined;
    try {
      mounted = mountAndRender(element);
      expect(lookups).toBe(1);
    } finally {
      get.mockRestore();
      mounted?.controller.dispose();
    }
  });
  it('consumes placement metadata for plain components without altering their raw props', () => {
    const style = { filter: [] };
    let received: unknown;
    function Plain(props: { style: SystemStyle }) { received = props.style; }
    const element = createElement(Plain, { style });
    setPreNormalizedStyle(element, {}, element, {}, { basis: { width: 700, height: 160 }, axes: 1 });
    const mounted = mountAndRender(element);
    try {
      expect(received).toBe(style);
      expect(takePreNormalizedStyle(element)).toBeUndefined();
    } finally {
      mounted.controller.dispose();
    }
  });

  it('does not recover query eligibility from an earlier preparation sharing a receiver token', () => {
    const Probe = definePrimitive<{}, SystemStyle>(() => undefined);
    const receiver = {};
    const basis = { x: 0, y: 0, width: 700, height: 100 };
    normalizeDirectChildStyle(createElement(Probe, {
      style: { when: [{ query: { minWidth: 600 }, style: {} }] },
    }), receiver, basis);
    const next = createElement(Probe, {});
    const style = normalizeDirectChildStyle(next, receiver, basis);
    setPreNormalizedStyle(next, style, next, receiver);
    expect(takePreNormalizedStyle(next)?.query).toBeUndefined();
  });

  it.each([undefined, [], [{ query: { minWidth: 100 }, style: { label: 'wide' } }]])(
    'removes the reserved query field before custom callbacks: %j',
    when => {
      const received: object[] = [];
      const Probe = definePrimitive<{}, SystemStyle & { label?: string }>(
        (_props, style) => { received.push(style); },
        {
          normalizeStyle: style => { received.push(style); return style; },
          resolveStyle: style => { received.push(style); return style; },
        },
      );
      const mounted = mountAndRender(createElement(Probe, { style: { when } }));
      try {
        expect(received).toHaveLength(3);
        for (const value of received) expect(value).not.toHaveProperty('when');
        expect(received[2]).toEqual(when?.length ? { label: 'wide' } : {});
      } finally {
        mounted.controller.dispose();
      }
    },
  );

  it('keeps system filters outside custom normalization and resolution', () => {
    interface ProbeStyle extends SystemStyle {
      label?: string;
    }
    interface NormalizedProbeStyle extends SystemStyle {
      label: string;
    }
    let normalizerInput: Readonly<ProbeStyle> | undefined;
    let resolverInput: Readonly<NormalizedProbeStyle> | undefined;
    let renderedStyle: Readonly<NormalizedProbeStyle> | undefined;
    const Probe = definePrimitive<{}, ProbeStyle, NormalizedProbeStyle, NormalizedProbeStyle>(
      (_props, style) => {
        renderedStyle = style;
      },
      {
        normalizeStyle: style => {
          normalizerInput = style;
          return { label: 'normalized' };
        },
        resolveStyle: style => {
          resolverInput = style;
          return { label: 'resolved' };
        },
      },
    );

    const mounted = mountAndRender(createElement(Probe, {
      style: { filter: invert({ amount: 1 }) },
    }));
    try {
      expect(normalizerInput).not.toHaveProperty('filter');
      expect(resolverInput).not.toHaveProperty('filter');
      expect(renderedStyle?.label).toBe('resolved');
      expect(compileNativeFilters(renderedStyle!.filter as unknown as readonly NativePreparedFilter[], 1)).toBe('invert(1)');
    } finally {
      mounted.controller.dispose();
    }
  });

  it('uses a pre-normalized clone as the authoritative system filter source', () => {
    interface ProbeStyle extends SystemStyle {
      label?: string;
    }
    interface NormalizedProbeStyle extends SystemStyle {
      label: string;
    }
    let normalizerCalls = 0;
    let resolverInput: Readonly<NormalizedProbeStyle> | undefined;
    let renderedStyle: Readonly<NormalizedProbeStyle> | undefined;
    const Probe = definePrimitive<{}, ProbeStyle, NormalizedProbeStyle, NormalizedProbeStyle>(
      (_props, style) => {
        renderedStyle = style;
      },
      {
        normalizeStyle: () => {
          normalizerCalls++;
          return { label: 'normalized' };
        },
        resolveStyle: style => {
          resolverInput = style;
          return { label: 'resolved' };
        },
      },
    );
    const source = createElement(Probe, {
      style: { filter: blur({ radius: 3 }) },
    });
    const placed = createElement(Probe, {
      style: { filter: blur({ radius: 3 }) },
    });
    const placedStyle: ProbeStyle = {
      label: 'placed',
      filter: invert({ amount: 1 }),
    };
    setPreNormalizedStyle(placed, placedStyle, source);

    const mounted = mountAndRender(placed);
    try {
      expect(normalizerCalls).toBe(0);
      expect(resolverInput).not.toHaveProperty('filter');
      expect(renderedStyle?.label).toBe('resolved');
      expect(compileNativeFilters(renderedStyle!.filter as unknown as readonly NativePreparedFilter[], 1)).toBe('invert(1)');
    } finally {
      mounted.controller.dispose();
    }
  });

  it('rejects invalid filter numbers before invoking the primitive render callback', () => {
    let renders = 0;
    const Probe = definePrimitive<{}>(() => {
      renders++;
    });
    const mounted = mount(createElement(Probe, {
      style: {
        filter: [
          invert({ amount: 1 }),
          blur({ radius: -1 }),
        ],
      },
    }));
    try {
      expect(() => executeRender(mounted.canvas, 1)).toThrowError(/filter\[1\]\.radius/);
      expect(renders).toBe(0);
    } finally {
      mounted.controller.dispose();
    }
  });

  it('continues validating nested custom fields named filter', () => {
    interface ProbeStyle extends SystemStyle {
      effects: {
        filter: string;
      };
    }
    const Probe = definePrimitive<{}, ProbeStyle>(() => undefined);
    const mounted = mount(createElement(Probe, {
      style: { effects: { filter: '50%' } },
    }));
    try {
      expect(() => executeRender(mounted.canvas, 1)).toThrowError(/effects\.filter/);
    } finally {
      mounted.controller.dispose();
    }
  });
});

function mountAndRender(root: CRCNode): {
  canvas: HTMLCanvasElement;
  controller: CRCController;
} {
  const mounted = mount(root);
  executeRender(mounted.canvas, 1);
  return mounted;
}

function mount(root: CRCNode): {
  canvas: HTMLCanvasElement;
  controller: CRCController;
} {
  const canvas = document.createElement('canvas');
  canvas.width = 200;
  canvas.height = 100;
  document.body.appendChild(canvas);
  return { canvas, controller: mountCRC(canvas, root) };
}
