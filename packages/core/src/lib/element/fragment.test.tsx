import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Fragment } from '../../index.js';
import { crc } from '../crc.js';
import { defineComp } from '../define-comp.js';
import { clearSharedState } from '../global-state.js';
import { crcRef } from '../hooks/crc-ref.js';

interface IdentityProbeProps {
  label: string;
  observations: Map<string, number>;
}

let nextIdentity = 0;

const IdentityProbe = defineComp(({
  label,
  observations,
}: IdentityProbeProps) => {
  const identity = crcRef<number>();
  identity.current ??= ++nextIdentity;
  observations.set(label, identity.current);
});

beforeEach(() => {
  document.body.innerHTML = '';
  nextIdentity = 0;
});

afterEach(() => {
  clearSharedState();
  vi.restoreAllMocks();
});

describe('Fragment identity', () => {
  it('keeps parentage stable through nested arrays and unkeyed fragments', async () => {
    const canvas = createCanvas();
    const observations = new Map<string, number>();
    const controller = crc(
      canvas,
      IdentityProbe({ key: 'stable', label: 'initial', observations }),
    );
    await nextFrame();
    const initial = observations.get('initial');

    crc(canvas, [[
      <>{IdentityProbe({ key: 'stable', label: 'nested', observations })}</>,
    ]]);
    await nextFrame();

    expect(observations.get('nested')).toBe(initial);
    controller.dispose();
  });

  it('uses a keyed Fragment as one stable parent scope', async () => {
    const canvas = createCanvas();
    const observations = new Map<string, number>();
    const scoped = (label: string) => (
      <Fragment key="scope">
        {IdentityProbe({ key: 'child', label, observations })}
      </Fragment>
    );
    const controller = crc(canvas, scoped('initial'));
    await nextFrame();
    const initial = observations.get('initial');

    crc(canvas, scoped('same-scope'));
    await nextFrame();
    expect(observations.get('same-scope')).toBe(initial);

    crc(canvas, IdentityProbe({
      key: 'child',
      label: 'without-scope',
      observations,
    }));
    await nextFrame();
    expect(observations.get('without-scope')).not.toBe(initial);
    controller.dispose();
  });

  it('preserves keyed sibling state through reorder after flattening', async () => {
    const canvas = createCanvas();
    const observations = new Map<string, number>();
    const keyed = (label: string) => IdentityProbe({
      key: label,
      label,
      observations,
    });
    const controller = crc(canvas, [keyed('a'), [<>{keyed('b')}</>]]);
    await nextFrame();
    const a = observations.get('a');
    const b = observations.get('b');

    crc(canvas, <>{[[keyed('b')], keyed('a')]}</>);
    await nextFrame();

    expect(observations.get('a')).toBe(a);
    expect(observations.get('b')).toBe(b);
    controller.dispose();
  });

  it('assigns unkeyed same-type state by flattened occurrence order', async () => {
    const canvas = createCanvas();
    const observations = new Map<string, number>();
    const unkeyed = (label: string) => IdentityProbe({ label, observations });
    const controller = crc(canvas, [unkeyed('a'), [<>{unkeyed('b')}</>]]);
    await nextFrame();
    const firstSlot = observations.get('a');
    const secondSlot = observations.get('b');

    crc(canvas, <>{[
      [unkeyed('inserted')],
      <>{unkeyed('a')}</>,
      unkeyed('b'),
    ]}</>);
    await nextFrame();

    expect(observations.get('inserted')).toBe(firstSlot);
    expect(observations.get('a')).toBe(secondSlot);
    expect(observations.get('b')).not.toBe(firstSlot);
    expect(observations.get('b')).not.toBe(secondSlot);
    controller.dispose();
  });

  it('remounts a keyed child moved between keyed Fragment parents', async () => {
    const canvas = createCanvas();
    const observations = new Map<string, number>();
    const tree = (right: boolean, label: string) => [
      <Fragment key="left">
        {right ? null : IdentityProbe({ key: 'child', label, observations })}
      </Fragment>,
      <Fragment key="right">
        {right ? IdentityProbe({ key: 'child', label, observations }) : null}
      </Fragment>,
    ];
    const controller = crc(canvas, tree(false, 'left'));
    await nextFrame();
    const leftIdentity = observations.get('left');

    crc(canvas, tree(true, 'right'));
    await nextFrame();

    expect(observations.get('right')).not.toBe(leftIdentity);
    controller.dispose();
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
