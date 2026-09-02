import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { crc } from './crc';
import { defineComp } from './define-comp';
import { clearSharedState, getCRCInstance } from './global-state';
import { crcRef } from './hooks/crc-ref';
import { crcState, type StateUpdater } from './hooks/crc-state';
import type { SystemStyle } from './types';

interface IdentityProbeProps {
  label: string;
  onRender: (label: string, identity: number) => void;
}

let nextIdentity = 0;

const IdentityProbe = defineComp(({
  label,
  onRender,
}: IdentityProbeProps) => {
  const identity = crcRef<number>();
  identity.current ??= ++nextIdentity;
  onRender(label, identity.current);
});

beforeEach(() => {
  document.body.innerHTML = '';
  nextIdentity = 0;
});

afterEach(() => {
  clearSharedState();
  vi.restoreAllMocks();
});

describe('defineComp contract', () => {
  it('creates fresh elements with stable component type and copied descriptor props', () => {
    const render = vi.fn();
    const Component = defineComp(render);
    const firstProps = { value: 1 };
    const secondProps = { value: 2 };

    const first = Component(firstProps);
    const second = Component(secondProps);

    expect(first).not.toBe(second);
    expect(first.type).toBe(render);
    expect(second.type).toBe(render);
    expect(first.props).toEqual({ value: 1, style: {} });
    expect(second.props).toEqual({ value: 2, style: {} });
    expect(first.props).not.toBe(firstProps);
    expect(second.props).not.toBe(secondProps);
  });

  it('stores style on props while preserving legacy callback arguments', async () => {
    const calls: unknown[] = [];
    interface ProbeStyle extends SystemStyle {
      width: number;
    }
    const Probe = defineComp<{ value: number }, ProbeStyle>(
      (props, style, ctx) => {
        calls.push({ props, style, canvas: ctx.canvas });
      },
    );
    const style = { width: 40 };
    const input = { value: 7, key: 'probe', style };
    const element = Probe(input);

    expect(element).toMatchObject({
      props: { value: 7 },
      style,
      key: 'probe',
    });
    expect(element.style).toBe(style);
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

  it('rejects unresolved allocation values before invoking a callback without a resolver', () => {
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
    const Unresolved = defineComp<{}, UnresolvedStyle>(callback);
    const canvas = createCanvas();

    try {
      const controller = crc(canvas, Unresolved({ style: { radius: '50%' } }));
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
    const UnsafeDefine = defineComp as any;
    const Leaky = UnsafeDefine(callback, {
      resolveStyle: (style: any) => style,
    });
    const canvas = createCanvas();

    try {
      const controller = crc(canvas, Leaky({ style: { radius: '50%' } }));
      expect(() => pending?.(0)).toThrowError(/radius.*50%.*resolve/i);
      expect(callback).not.toHaveBeenCalled();
      controller.dispose();
    } finally {
      window.requestAnimationFrame = originalRequestAnimationFrame;
    }
  });
});

describe('crc root updates', () => {
  it('returns one controller and commits only the latest queued root', async () => {
    const canvas = createCanvas();
    const renders: number[] = [];
    const Root = defineComp(({ value }: { value: number }) => {
      renders.push(value);
    });

    const controller = crc(canvas, Root({ value: 1 }));
    expect(crc(canvas, Root({ value: 2 }))).toBe(controller);
    expect(crc(canvas, Root({ value: 3 }))).toBe(controller);
    await nextFrame();

    expect(renders).toEqual([3]);
    controller.dispose();
  });

  it('does not lose a pending root replacement to a state update', async () => {
    const canvas = createCanvas();
    const renders: string[] = [];
    let setValue: StateUpdater<number> | undefined;
    const StatefulRoot = defineComp(() => {
      const [value, setter] = crcState(0);
      setValue = setter;
      renders.push(`stateful:${value}`);
    });
    const ReplacementRoot = defineComp(() => {
      renders.push('replacement');
    });
    const controller = crc(canvas, StatefulRoot({}));
    await nextFrame();

    crc(canvas, ReplacementRoot({}));
    setValue?.(1);
    expect(getCRCInstance(canvas).pendingRoot?.type).toBe(ReplacementRoot({}).type);
    expect(getCRCInstance(canvas).pendingUpdateParents).toBe(true);
    await nextFrame();

    expect(renders).toEqual(['stateful:0', 'replacement']);
    controller.dispose();
  });

  it('lets the latest explicit root win after a state update while preserving parent intent', async () => {
    const canvas = createCanvas();
    const renders: string[] = [];
    let setValue: StateUpdater<number> | undefined;
    const StatefulRoot = defineComp(() => {
      const [value, setter] = crcState(0);
      setValue = setter;
      renders.push(`stateful:${value}`);
    });
    const FirstReplacement = defineComp(() => {
      renders.push('first-replacement');
    });
    const LatestReplacement = defineComp(() => {
      renders.push('latest-replacement');
    });
    const controller = crc(canvas, StatefulRoot({}));
    await nextFrame();

    setValue?.(1);
    crc(canvas, FirstReplacement({}));
    crc(canvas, LatestReplacement({}));
    const instance = getCRCInstance(canvas);
    expect(instance.pendingRoot?.type).toBe(LatestReplacement({}).type);
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
    const Host = defineComp(({ expanded }: { expanded: boolean }) =>
      expanded ?
        [
          null,
          IdentityProbe({ label: 'a', onRender }),
          false,
          '',
          0,
          IdentityProbe({ label: 'b', onRender }),
          undefined,
        ] :
        [
          IdentityProbe({ label: 'a', onRender }),
          false,
          IdentityProbe({ label: 'b', onRender }),
        ],
    );
    const controller = crc(canvas, Host({ expanded: false }));
    await nextFrame();
    const initial = new Map(observations);

    crc(canvas, Host({ expanded: true }));
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
    const Host = defineComp(({ labels }: { labels: string[] }) =>
      labels.map(label => IdentityProbe({ key: label, label, onRender })),
    );
    const controller = crc(canvas, Host({ labels: ['a', 'b'] }));
    await nextFrame();
    const a = observations.get('a');
    const b = observations.get('b');

    crc(canvas, Host({ labels: ['b', 'c', 'a'] }));
    await nextFrame();
    expect(observations.get('a')).toBe(a);
    expect(observations.get('b')).toBe(b);
    expect(observations.get('c')).not.toBe(a);
    expect(observations.get('c')).not.toBe(b);

    crc(canvas, Host({ labels: ['b', 'c'] }));
    await nextFrame();
    crc(canvas, Host({ labels: ['a', 'b', 'c'] }));
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
    const Host = defineComp(({ labels }: { labels: string[] }) =>
      labels.map(label => IdentityProbe({ label, onRender })),
    );
    const controller = crc(canvas, Host({ labels: ['a', 'b'] }));
    await nextFrame();
    const firstSlot = observations.get('a');
    const secondSlot = observations.get('b');

    crc(canvas, Host({ labels: ['inserted', 'a', 'b'] }));
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
    const First = defineComp((_props: {}) => {
      values.push(crcRef('first').current!);
    });
    const Second = defineComp((_props: {}) => {
      values.push(crcRef('second').current!);
    });
    const Host = defineComp(({ second }: { second: boolean }) =>
      second ? Second({ key: 'shared' }) : First({ key: 'shared' }),
    );
    const controller = crc(canvas, Host({ second: false }));
    await nextFrame();

    crc(canvas, Host({ second: true }));
    await nextFrame();

    expect(values).toEqual(['first', 'second']);
    controller.dispose();
  });

  it('uses function identity when distinct component types have the same name', async () => {
    const canvas = createCanvas();
    const values: string[] = [];
    const First = defineComp(function SameName() {
      values.push(crcRef('first').current!);
    });
    const Second = defineComp(function SameName() {
      values.push(crcRef('second').current!);
    });
    const controller = crc(canvas, First({}));
    await nextFrame();

    crc(canvas, Second({}));
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
    const Host = defineComp(() => [
      IdentityProbe({ key: 'duplicate', label: 'a', onRender: () => {} }),
      IdentityProbe({ key: 'duplicate', label: 'b', onRender: () => {} }),
    ]);

    try {
      const controller = crc(canvas, Host({}));
      expect(() => pending?.(0)).toThrowError(/duplicate.*key/i);
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
