import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Fragment } from '../index.js';
import { crc } from './crc.js';
import { definePrimitive } from './define-primitive.js';
import { materializeContainerChildren } from './element/children.js';
import { executeRender } from './execute-render.js';
import { clearSharedState, getCRCInstance } from './global-state.js';
import { crcCursor } from './hooks/crc-cursor.js';
import { crcEventListener } from './hooks/crc-event-listener.js';
import { crcEventTarget } from './hooks/crc-event-target.js';
import { crcEvent } from './hooks/crc-event.js';
import { crcLayoutBox } from './hooks/crc-layout-box.js';
import { crcLinePath } from './hooks/crc-line-path.js';
import { crcMemo } from './hooks/crc-memo.js';
import { crcRectPath } from './hooks/crc-rect-path.js';
import { crcRef } from './hooks/crc-ref.js';
import { crcState, type StateUpdater } from './hooks/crc-state.js';
import { crcSvgPath } from './hooks/crc-svg-path.js';
import { crcWhenChanged } from './hooks/crc-when-changed.js';
import {
  placeAbsoluteChild,
  placeDirectChildren,
} from './layout/absolute.js';
import type { BoxStyle } from './style/types.js';
import type { CRCNode } from './types.js';

interface IdentityProbeProps {
  label: string;
  observations: Map<string, number>;
}

let nextIdentity = 0;

function IdentityProbe({
  label,
  observations,
}: IdentityProbeProps): void {
  const identity = crcRef<number>();
  identity.current ??= ++nextIdentity;
  observations.set(label, identity.current);
}

const LeafProbe = definePrimitive<{
  onRender: () => void;
}>(function renderLeafProbe({ onRender }) {
  onRender();
});

const PlacementProbe = definePrimitive<{
  children: CRCNode;
}>(function renderPlacementProbe({ children }) {
  const container = crcLayoutBox();
  return placeDirectChildren(
    materializeContainerChildren(children, 'PlacementProbe', {
      validateKeys: false,
    }),
    container,
    child => placeAbsoluteChild(container, child),
    'visible',
  );
});

beforeEach(() => {
  document.body.innerHTML = '';
  nextIdentity = 0;
});

afterEach(() => {
  clearSharedState();
  vi.restoreAllMocks();
});

describe('plain function component dispatch', () => {
  it('invokes a plain function once with frozen author props and supports every existing hook', async () => {
    const argumentCounts: number[] = [];
    const cleanups = vi.fn();
    const leafRenders = vi.fn();
    const states: number[] = [];
    const memoValues: object[] = [];
    const refs: object[] = [];
    const paths: Path2D[][] = [];
    let updateState: StateUpdater<number> | undefined;

    function HookProbe(props: { revision: number; children: CRCNode }): CRCNode {
      argumentCounts.push(arguments.length);
      expect(Object.isFrozen(props)).toBe(import.meta.env.DEV);
      expect(Object.prototype.hasOwnProperty.call(props, 'key')).toBe(false);
      expect((props.children as { type?: unknown }).type).toBe(LeafProbe);
      const [state, setState] = crcState(0);
      updateState = setState;
      states.push(state);
      memoValues.push(crcMemo(() => ({}), [props.revision]));
      refs.push(crcRef({}).current!);
      crcWhenChanged(() => cleanups, [props.revision]);
      const rectPath = crcRectPath(0, 0, 10, 10);
      const linePath = crcLinePath([[0, 0], [10, 10]]);
      const svgPath = crcSvgPath('M0 0h10v10z');
      paths.push([rectPath, linePath, svgPath]);
      crcEvent('mousemove', () => undefined);
      crcEventTarget({ onClick: () => undefined }, {
        path: rectPath,
        fill: true,
      });
      crcEventListener({ onClick: () => undefined });
      crcCursor({ style: 'pointer' });
      expect(crcLayoutBox()).toEqual({ x: 0, y: 0, width: 200, height: 80 });
      return <>{[[props.children]]}</>;
    }

    const canvas = createCanvas(200, 80);
    const controller = crc(canvas, (
      <HookProbe key="author-key" revision={1}>
        <LeafProbe onRender={leafRenders} />
      </HookProbe>
    ));
    await nextFrame();

    updateState?.(1);
    await nextFrame();

    expect(argumentCounts).toEqual([1, 1]);
    expect(states).toEqual([0, 1]);
    expect(memoValues[1]).toBe(memoValues[0]);
    expect(refs[1]).toBe(refs[0]);
    expect(paths[1][0]).toBe(paths[0][0]);
    expect(paths[1][1]).toBe(paths[0][1]);
    expect(paths[1][2]).toBe(paths[0][2]);
    expect(leafRenders).toHaveBeenCalledTimes(2);

    const hookProbeRefs = Array.from(getCRCInstance(canvas).refs.values())
      .find(ref => ref.element.type === HookProbe)!;
    expect(hookProbeRefs.hooks.map(hook => hook.kind)).toEqual([
      'state',
      'memo',
      'ref',
      'whenChanged',
      'rectPath',
      'linePath',
      'svgPath',
      'event',
      'eventTarget',
      'eventListener',
      'cursor',
    ]);

    controller.dispose();
    expect(cleanups).toHaveBeenCalledOnce();
  });

  it('delivers specified percentage style unchanged with a finite local allocation', async () => {
    const specified = { width: '50%', height: 20 } as const;
    const observations: Array<{
      style: BoxStyle;
      box: ReturnType<typeof crcLayoutBox>;
    }> = [];

    function Card(props: { style: BoxStyle; title: string }): void {
      observations.push({ style: props.style, box: crcLayoutBox() });
    }

    const canvas = createCanvas(240, 120);
    const controller = crc(
      canvas,
      <PlacementProbe>
        <Card style={specified} title="specified" />
      </PlacementProbe>,
    );
    await nextFrame();

    expect(observations).toEqual([{
      style: specified,
      box: { x: 0, y: 0, width: 120, height: 20 },
    }]);
    expect(observations[0].style).toBe(specified);
    controller.dispose();
  });

  it('fails closed and remounts a plain function after an explicit recovery render', async () => {
    const cleanups = vi.fn();
    function Failing({ fail }: { fail: boolean }): void {
      crcWhenChanged(() => cleanups, []);
      if (fail) throw new Error('plain failure');
    }

    const canvas = createCanvas();
    const controller = crc(canvas, <Failing fail={false} />);
    await nextFrame();

    expect(() => executeRender(canvas, 1, <Failing fail />))
      .toThrowError('plain failure');
    expect(cleanups).toHaveBeenCalledOnce();
    expect(getCRCInstance(canvas).refs.size).toBe(0);

    crc(canvas, <Failing fail={false} />);
    await nextFrame();
    expect(getCRCInstance(canvas).refs.size).toBe(1);

    controller.dispose();
    expect(cleanups).toHaveBeenCalledTimes(2);
  });
});

describe('plain function component identity', () => {
  it('keeps parentage stable through nested arrays and unkeyed Fragments', async () => {
    const canvas = createCanvas();
    const observations = new Map<string, number>();
    const controller = crc(
      canvas,
      <IdentityProbe key="stable" label="initial" observations={observations} />,
    );
    await nextFrame();
    const initial = observations.get('initial');

    crc(canvas, [[
      <><IdentityProbe
        key="stable"
        label="nested"
        observations={observations}
      /></>,
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
        <IdentityProbe key="child" label={label} observations={observations} />
      </Fragment>
    );
    const controller = crc(canvas, scoped('initial'));
    await nextFrame();
    const initial = observations.get('initial');

    crc(canvas, scoped('same-scope'));
    await nextFrame();
    expect(observations.get('same-scope')).toBe(initial);

    crc(canvas, <IdentityProbe
      key="child"
      label="without-scope"
      observations={observations}
    />);
    await nextFrame();
    expect(observations.get('without-scope')).not.toBe(initial);
    controller.dispose();
  });

  it('preserves keyed sibling state through reorder after flattening', async () => {
    const canvas = createCanvas();
    const observations = new Map<string, number>();
    const keyed = (label: string) => (
      <IdentityProbe key={label} label={label} observations={observations} />
    );
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
    const unkeyed = (label: string) => (
      <IdentityProbe label={label} observations={observations} />
    );
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
        {right ? null : <IdentityProbe
          key="child"
          label={label}
          observations={observations}
        />}
      </Fragment>,
      <Fragment key="right">
        {right ? <IdentityProbe
          key="child"
          label={label}
          observations={observations}
        /> : null}
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

  it('uses function identity for distinct plain components with the same name', async () => {
    const values: string[] = [];
    const First = function SameName(): void {
      values.push(crcRef('first').current!);
    };
    const Second = function SameName(): void {
      values.push(crcRef('second').current!);
    };
    const canvas = createCanvas();
    const controller = crc(canvas, <First />);
    await nextFrame();

    crc(canvas, <Second />);
    await nextFrame();

    expect(values).toEqual(['first', 'second']);
    controller.dispose();
  });
});

function createCanvas(width = 300, height = 150): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  document.body.appendChild(canvas);
  return canvas;
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}
