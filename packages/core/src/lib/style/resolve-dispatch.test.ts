import { describe, expect, it } from 'vitest';
import { definePrimitive } from '../define-primitive';
import { createElement } from '../element/create-element';
import { executeRender } from '../execute-render';
import { mountCRC } from '../mount-crc';
import type { CRCController, CRCNode, SystemStyle } from '../types';
import { setPreNormalizedStyle } from './resolve-dispatch';

describe('render style dispatch', () => {
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
      style: { filter: { type: 'invert', amount: 1 } },
    }));
    try {
      expect(normalizerInput).not.toHaveProperty('filter');
      expect(resolverInput).not.toHaveProperty('filter');
      expect(renderedStyle).toEqual({
        label: 'resolved',
        filter: [{ type: 'invert', amount: 1 }],
      });
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
      style: { filter: { type: 'blur', radius: 3 } },
    });
    const placed = createElement(Probe, {
      style: { filter: { type: 'blur', radius: 3 } },
    });
    const placedStyle: ProbeStyle = {
      label: 'placed',
      filter: { type: 'invert', amount: 1 },
    };
    setPreNormalizedStyle(placed, placedStyle, source);

    const mounted = mountAndRender(placed);
    try {
      expect(normalizerCalls).toBe(0);
      expect(resolverInput).not.toHaveProperty('filter');
      expect(renderedStyle).toEqual({
        label: 'resolved',
        filter: [{ type: 'invert', amount: 1 }],
      });
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
          { type: 'invert', amount: 1 },
          { type: 'blur', radius: -1 },
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
