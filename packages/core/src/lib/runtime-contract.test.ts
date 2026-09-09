import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Circle,
  Rectangle,
  LayoutDiagnostic,
  Polygon,
  crcWhenChanged,
} from '../index';
import { crc } from './crc';
import { definePrimitive } from './define-primitive';
import { createElement, isCRCElement } from './element/create-element';
import { clearSharedState, getCRCInstance } from './global-state';
import { crcRef } from './hooks/crc-ref';
import { crcState, type StateUpdater } from './hooks/crc-state';
import type { CRCNode, SystemStyle } from './types';
import { RegularPolygon } from './components/regular-polygon';

interface IdentityProbeProps {
  label: string;
  onRender: (label: string, identity: number) => void;
}

let nextIdentity = 0;

const IdentityProbe = ({
  label,
  onRender,
}: IdentityProbeProps) => {
  const identity = crcRef<number>();
  identity.current ??= ++nextIdentity;
  onRender(label, identity.current);
};

beforeEach(() => {
  document.body.innerHTML = '';
  nextIdentity = 0;
});

afterEach(() => {
  clearSharedState();
  vi.restoreAllMocks();
});

describe('element and primitive contract', () => {
  it('creates fresh elements with stable component type and copied descriptor props', () => {
    const Component = vi.fn((_props: { value: number }) => undefined);
    const firstProps = { value: 1 };
    const secondProps = { value: 2 };

    const first = createElement(Component, firstProps);
    const second = createElement(Component, secondProps);

    expect(first).not.toBe(second);
    expect(first.type).toBe(Component);
    expect(second.type).toBe(Component);
    expect(first.props).toEqual({ value: 1 });
    expect(second.props).toEqual({ value: 2 });
    expect(first.props).not.toBe(firstProps);
    expect(second.props).not.toBe(secondProps);
  });

  it('stores specified style on props while delivering resolved primitive arguments', async () => {
    const calls: unknown[] = [];
    interface ProbeStyle extends SystemStyle {
      width: number;
    }
    const Probe = definePrimitive<{ value: number }, ProbeStyle>(
      (props, style, ctx) => {
        calls.push({ props, style, canvas: ctx.canvas });
      },
    );
    const style = { width: 40 };
    const input = { value: 7, key: 'probe', style };
    const element = createElement(Probe, input);

    expect(element).toMatchObject({
      props: { value: 7, style },
      key: 'probe',
    });
    expect(element.props).not.toBe(input);
    expect(element.props.style).toBe(style);
    expect('key' in element.props).toBe(false);

    const canvas = createCanvas();
    const controller = crc(canvas, element);
    await nextFrame();

    expect(calls).toEqual([
      { props: { value: 7 }, style, canvas },
    ]);
    controller.dispose();
  });

  it('rejects unresolved allocation values before invoking a primitive without a resolver', () => {
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    let pending: FrameRequestCallback | undefined;
    window.requestAnimationFrame = callback => {
      pending = callback;
      return 1;
    };
    const callback = vi.fn();
    interface UnresolvedStyle extends SystemStyle {
      radius: `${number}%`;
    }
    // @ts-expect-error percentage-capable declared styles require resolveStyle
    const Unresolved = definePrimitive<{}, UnresolvedStyle>(callback);
    const canvas = createCanvas();

    try {
      const controller = crc(canvas, createElement(Unresolved, {
        style: { radius: '50%' },
      }));
      expect(() => pending?.(0)).toThrowError(/radius.*50%.*resolve/i);
      expect(callback).not.toHaveBeenCalled();
      controller.dispose();
    } finally {
      window.requestAnimationFrame = originalRequestAnimationFrame;
    }
  });

  it('rejects allocation syntax leaked by an untyped explicit identity resolver', () => {
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    let pending: FrameRequestCallback | undefined;
    window.requestAnimationFrame = callback => {
      pending = callback;
      return 1;
    };
    const callback = vi.fn();
    const UnsafeDefine = definePrimitive as any;
    const Leaky = UnsafeDefine(callback, {
      resolveStyle: (style: any) => style,
    });
    const canvas = createCanvas();

    try {
      const controller = crc(canvas, createElement(Leaky, {
        style: { radius: '50%' },
      }));
      expect(() => pending?.(0)).toThrowError(/radius.*50%.*resolve/i);
      expect(callback).not.toHaveBeenCalled();
      controller.dispose();
    } finally {
      window.requestAnimationFrame = originalRequestAnimationFrame;
    }
  });
});

describe('crc root updates', () => {
  it('tears down existing refs after a filtered final-composite failure and recovers', () => {
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    let pending: FrameRequestCallback | undefined;
    window.requestAnimationFrame = callback => {
      pending = callback;
      return 1;
    };
    const canvas = createCanvas();
    let cleanups = 0;
    const setup = vi.fn(() => () => cleanups++);
    const ResourceBearingSibling = (_props: {}) => {
      crcWhenChanged(setup, []);
      return createElement(Rectangle, {
        style: { x: 2, y: 2, width: 8, height: 8, fill: 'blue' },
        onClick: () => undefined,
      });
    };
    const drawImage = vi.spyOn(
      CanvasRenderingContext2D.prototype,
      'drawImage',
    ).mockImplementation(() => {
      throw new Error('filtered final composite failed');
    });

    try {
      crc(canvas, [
        createElement(ResourceBearingSibling, {}),
        createElement(Rectangle, {
          style: {
            x: 12,
            y: 2,
            width: 8,
            height: 8,
            fill: 'red',
            filter: { type: 'blur', radius: 1 },
          },
        }),
      ]);

      expect(() => pending?.(0)).toThrowError('filtered final composite failed');
      const failed = getCRCInstance(canvas);
      expect(setup).toHaveBeenCalledOnce();
      expect(cleanups).toBe(1);
      expect(failed.refs.size).toBe(0);
      expect(failed.eventRoot.targets.size).toBe(0);
      expect(failed.filterSurfacePool.snapshot()).toMatchObject({
        activePairs: 0,
        pairCheckouts: 1,
        pairReturns: 1,
      });

      drawImage.mockRestore();
      crc(canvas, createElement(Rectangle, {
        style: {
          x: 4,
          y: 4,
          width: 8,
          height: 8,
          fill: 'green',
          filter: { type: 'grayscale', amount: 1 },
        },
      }));
      expect(() => pending?.(1)).not.toThrow();
      expect(getCRCInstance(canvas).refs.size).toBe(1);
      expect(getCRCInstance(canvas).filterSurfacePool.snapshot()).toMatchObject({
        activePairs: 0,
        pairCheckouts: 2,
        pairReturns: 2,
      });
    } finally {
      drawImage.mockRestore();
      window.requestAnimationFrame = originalRequestAnimationFrame;
    }
  });

  it('cleans up a failed shape render and recovers on the same Canvas', () => {
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    let pending: FrameRequestCallback | undefined;
    window.requestAnimationFrame = callback => {
      pending = callback;
      return 1;
    };
    const canvas = createCanvas();
    const arcTo = vi.spyOn(Path2D.prototype, 'arcTo');
    const addEventListener = vi.spyOn(canvas, 'addEventListener');
    const removeEventListener = vi.spyOn(canvas, 'removeEventListener');
    const cleanup = vi.fn();
    const setup = vi.fn(() => cleanup);
    let acquiredResources:
      | { clickListeners: number; targets: number }
      | undefined;
    const ResourceBearingSibling = (_props: {}) => {
      crcWhenChanged(setup, []);
      return createElement(Circle, {
        style: { radius: 4, fill: '#2563eb' },
        onClick: () => undefined,
      });
    };
    const AcquisitionProbe = (_props: {}) => {
      const instance = getCRCInstance(canvas);
      acquiredResources = {
        clickListeners: instance.eventRoot.nativeListeners?.count('click') ?? 0,
        targets: instance.eventRoot.targets.size,
      };
    };

    try {
      crc(canvas, [
        createElement(ResourceBearingSibling, {}),
        createElement(AcquisitionProbe, {}),
        createElement(Polygon, {
          style: {
            coords: [[0, 0], [40, 0], [40, 40], [0, 40]],
            cornerRadius: -1,
          },
        }),
      ]);

      let failure: unknown;
      try {
        pending?.(0);
      } catch (error) {
        failure = error;
      }
      expect(failure).toBeInstanceOf(LayoutDiagnostic);
      expect(failure).toMatchObject({
        component: 'Polygon',
        property: 'cornerRadius',
        suppliedValue: -1,
        algorithm: 'render-dispatch',
      });
      expect((failure as Error).message).toMatch(/nonnegative/);
      expect(setup).toHaveBeenCalledOnce();
      expect(acquiredResources).toEqual({ clickListeners: 1, targets: 1 });
      const clickAcquisition = addEventListener.mock.calls.find(
        ([type]) => type === 'click',
      );
      expect(clickAcquisition).toBeDefined();
      expect(cleanup).toHaveBeenCalledOnce();
      const failed = getCRCInstance(canvas);
      expect(failed.refs.size).toBe(0);
      expect(failed.eventRoot.targets.size).toBe(0);
      expect(failed.eventRoot.nativeListeners?.count('click')).toBe(0);
      expect(removeEventListener).toHaveBeenCalledWith(
        'click',
        clickAcquisition?.[1],
        false,
      );
      expect(canvas.style.cursor).toBe('');

      crc(canvas, createElement(Polygon, {
        style: {
          coords: [[0, 0], [40, 0], [40, 40], [0, 40]],
          cornerRadius: 8,
          fill: '#2563eb',
        },
      }));
      expect(() => pending?.(1)).not.toThrow();
      expect(arcTo).toHaveBeenCalledTimes(4);
      expect(getCRCInstance(canvas).refs.size).toBe(1);
    } finally {
      window.requestAnimationFrame = originalRequestAnimationFrame;
    }
  });

  it('cleans up a structurally invalid regular polygon and recovers on the same Canvas', () => {
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    let pending: FrameRequestCallback | undefined;
    window.requestAnimationFrame = callback => {
      pending = callback;
      return 1;
    };
    const canvas = createCanvas();
    const cleanup = vi.fn();
    const setup = vi.fn(() => cleanup);
    const ResourceBearingSibling = (_props: {}) => {
      crcWhenChanged(setup, []);
      return createElement(Circle, {
        style: { cx: 8, cy: 8, radius: 4, fill: '#2563eb' },
        onClick: () => undefined,
      });
    };

    try {
      crc(canvas, [
        createElement(ResourceBearingSibling, {}),
        createElement(RegularPolygon, {
          style: {
            sides: 6,
            circumradius: 20,
            inradius: 10,
          },
        } as unknown as Parameters<typeof RegularPolygon>[0]),
      ]);

      let failure: unknown;
      try {
        pending?.(0);
      } catch (error) {
        failure = error;
      }
      expect(failure).toBeInstanceOf(LayoutDiagnostic);
      expect(failure).toMatchObject({
        component: 'RegularPolygon',
        property: 'circumradius|inradius|sideLength',
        algorithm: 'render-dispatch',
      });
      expect((failure as Error).message).toMatch(/exactly one/);
      expect(setup).toHaveBeenCalledOnce();
      expect(cleanup).toHaveBeenCalledOnce();
      expect(getCRCInstance(canvas).refs.size).toBe(0);
      expect(getCRCInstance(canvas).eventRoot.targets.size).toBe(0);

      crc(canvas, createElement(RegularPolygon, {
        style: {
          sides: 6,
          cx: 40,
          cy: 40,
          circumradius: 20,
          fill: '#2563eb',
        },
      }));
      expect(() => pending?.(1)).not.toThrow();
      expect(getCRCInstance(canvas).refs.size).toBe(1);
    } finally {
      window.requestAnimationFrame = originalRequestAnimationFrame;
    }
  });

  it('returns one controller and commits only the latest queued root', async () => {
    const canvas = createCanvas();
    const renders: number[] = [];
    const Root = ({ value }: { value: number }) => {
      renders.push(value);
    };

    const controller = crc(canvas, createElement(Root, { value: 1 }));
    expect(crc(canvas, createElement(Root, { value: 2 }))).toBe(controller);
    expect(crc(canvas, createElement(Root, { value: 3 }))).toBe(controller);
    await nextFrame();

    expect(renders).toEqual([3]);
    controller.dispose();
  });

  it('does not lose a pending root replacement to a state update', async () => {
    const canvas = createCanvas();
    const renders: string[] = [];
    let setValue: StateUpdater<number> | undefined;
    const StatefulRoot = (_props: {}) => {
      const [value, setter] = crcState(0);
      setValue = setter;
      renders.push(`stateful:${value}`);
    };
    const ReplacementRoot = (_props: {}) => {
      renders.push('replacement');
    };
    const controller = crc(canvas, createElement(StatefulRoot, {}));
    await nextFrame();

    crc(canvas, createElement(ReplacementRoot, {}));
    setValue?.(1);
    const pendingRoot = getCRCInstance(canvas).pendingRoot;
    expect(isCRCElement(pendingRoot) && pendingRoot.type)
      .toBe(createElement(ReplacementRoot, {}).type);
    expect(getCRCInstance(canvas).pendingUpdateParents).toBe(true);
    await nextFrame();

    expect(renders).toEqual(['stateful:0', 'replacement']);
    controller.dispose();
  });

  it('lets the latest explicit root win after a state update while preserving parent intent', async () => {
    const canvas = createCanvas();
    const renders: string[] = [];
    let setValue: StateUpdater<number> | undefined;
    const StatefulRoot = (_props: {}) => {
      const [value, setter] = crcState(0);
      setValue = setter;
      renders.push(`stateful:${value}`);
    };
    const FirstReplacement = (_props: {}) => {
      renders.push('first-replacement');
    };
    const LatestReplacement = (_props: {}) => {
      renders.push('latest-replacement');
    };
    const controller = crc(canvas, createElement(StatefulRoot, {}));
    await nextFrame();

    setValue?.(1);
    crc(canvas, createElement(FirstReplacement, {}));
    crc(canvas, createElement(LatestReplacement, {}));
    const instance = getCRCInstance(canvas);
    expect(isCRCElement(instance.pendingRoot) && instance.pendingRoot.type)
      .toBe(createElement(LatestReplacement, {}).type);
    expect(instance.pendingUpdateParents).toBe(true);
    await nextFrame();

    expect(renders).toEqual(['stateful:0', 'latest-replacement']);
    controller.dispose();
  });
});

describe('component tree identity', () => {
  it('does not assign identity slots to falsy children', async () => {
    const canvas = createCanvas();
    const observations = new Map<string, number>();
    const onRender = (label: string, identity: number) => {
      observations.set(label, identity);
    };
    const Host = ({ expanded }: { expanded: boolean }): CRCNode =>
      expanded ?
        [
          null,
          createElement(IdentityProbe, { label: 'a', onRender }),
          false,
          '',
          0,
          createElement(IdentityProbe, { label: 'b', onRender }),
          undefined,
        ] :
        [
          createElement(IdentityProbe, { label: 'a', onRender }),
          false,
          createElement(IdentityProbe, { label: 'b', onRender }),
        ];
    const controller = crc(canvas, createElement(Host, { expanded: false }));
    await nextFrame();
    const initial = new Map(observations);

    crc(canvas, createElement(Host, { expanded: true }));
    await nextFrame();

    expect(observations).toEqual(initial);
    controller.dispose();
  });

  it('keeps keyed identities through insertion and reordering, then remounts a removed key', async () => {
    const canvas = createCanvas();
    const observations = new Map<string, number>();
    const onRender = (label: string, identity: number) => {
      observations.set(label, identity);
    };
    const Host = ({ labels }: { labels: string[] }) =>
      labels.map(label => createElement(IdentityProbe, { key: label, label, onRender }));
    const controller = crc(canvas, createElement(Host, { labels: ['a', 'b'] }));
    await nextFrame();
    const a = observations.get('a');
    const b = observations.get('b');

    crc(canvas, createElement(Host, { labels: ['b', 'c', 'a'] }));
    await nextFrame();
    expect(observations.get('a')).toBe(a);
    expect(observations.get('b')).toBe(b);
    expect(observations.get('c')).not.toBe(a);
    expect(observations.get('c')).not.toBe(b);

    crc(canvas, createElement(Host, { labels: ['b', 'c'] }));
    await nextFrame();
    crc(canvas, createElement(Host, { labels: ['a', 'b', 'c'] }));
    await nextFrame();
    expect(observations.get('a')).not.toBe(a);

    controller.dispose();
  });

  it('uses occurrence order for unkeyed siblings of the same type', async () => {
    const canvas = createCanvas();
    const observations = new Map<string, number>();
    const onRender = (label: string, identity: number) => {
      observations.set(label, identity);
    };
    const Host = ({ labels }: { labels: string[] }) =>
      labels.map(label => createElement(IdentityProbe, { label, onRender }));
    const controller = crc(canvas, createElement(Host, { labels: ['a', 'b'] }));
    await nextFrame();
    const firstSlot = observations.get('a');
    const secondSlot = observations.get('b');

    crc(canvas, createElement(Host, { labels: ['inserted', 'a', 'b'] }));
    await nextFrame();

    expect(observations.get('inserted')).toBe(firstSlot);
    expect(observations.get('a')).toBe(secondSlot);
    expect(observations.get('b')).not.toBe(firstSlot);
    expect(observations.get('b')).not.toBe(secondSlot);
    controller.dispose();
  });

  it('remounts when a key is reused for a different component type', async () => {
    const canvas = createCanvas();
    const values: string[] = [];
    const First = (_props: {}) => {
      values.push(crcRef('first').current!);
    };
    const Second = (_props: {}) => {
      values.push(crcRef('second').current!);
    };
    const Host = ({ second }: { second: boolean }) =>
      second ? createElement(Second, { key: 'shared' }) : createElement(First, { key: 'shared' });
    const controller = crc(canvas, createElement(Host, { second: false }));
    await nextFrame();

    crc(canvas, createElement(Host, { second: true }));
    await nextFrame();

    expect(values).toEqual(['first', 'second']);
    controller.dispose();
  });

  it('uses function identity when distinct component types have the same name', async () => {
    const canvas = createCanvas();
    const values: string[] = [];
    const First = function SameName(_props: {}) {
      values.push(crcRef('first').current!);
    };
    const Second = function SameName(_props: {}) {
      values.push(crcRef('second').current!);
    };
    const controller = crc(canvas, createElement(First, {}));
    await nextFrame();

    crc(canvas, createElement(Second, {}));
    await nextFrame();

    expect(values).toEqual(['first', 'second']);
    controller.dispose();
  });

  it('rejects duplicate explicit keys among siblings', () => {
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    let pending: FrameRequestCallback | undefined;
    window.requestAnimationFrame = callback => {
      pending = callback;
      return 1;
    };
    const canvas = createCanvas();
    const Host = (_props: {}) => [
      createElement(IdentityProbe, { key: 'duplicate', label: 'a', onRender: () => {} }),
      createElement(IdentityProbe, { key: 'duplicate', label: 'b', onRender: () => {} }),
    ];

    try {
      const controller = crc(canvas, createElement(Host, {}));
      expect(() => pending?.(0)).toThrowError(
        'Host received duplicate CRC key "duplicate" as a CRC child.',
      );
      controller.dispose();
    } finally {
      window.requestAnimationFrame = originalRequestAnimationFrame;
    }
  });
});

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  return canvas;
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}
