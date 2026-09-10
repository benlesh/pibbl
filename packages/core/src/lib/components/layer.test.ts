import type { RectangleProps } from './rect';
import type { RectStyle } from '../style/types';
import type { SystemStyle } from '../types';
import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { crc } from '../crc';
import { createElement } from '../element/create-element';
import { Fragment } from '../element/fragment';
import { executeRender } from '../execute-render';
import { getCRCInstance, GLOBAL_STATE } from '../global-state';
import { crcCursor } from '../hooks/crc-cursor';
import { crcEvent } from '../hooks/crc-event';
import { crcEventTarget } from '../hooks/crc-event-target';
import { crcRef } from '../hooks/crc-ref';
import { crcState } from '../hooks/crc-state';
import { crcWhenChanged } from '../hooks/crc-when-changed';
import { signal } from '../signals/graph';
import {
  installSchedulerDriverForTest,
  ManualSchedulerDriver,
} from '../scheduler/testing';
import { focusManaged } from '../focus/policy-test-support';
import { componentTest } from '../test-utils/component-test';
import type { CRCController, CRCNode } from '../types';
import { takeScreenshot } from '../util/test-utils';
import { Clip } from './clip';
import { Group } from './g';
import { Layer } from './layer';
import { Rectangle } from './rect';
import { Text } from './text';
import { definePrimitive } from '../define-primitive';

describe('Layer children and retained subtree contract', () => {
  it('refreshes a pending signal-driven child bitmap before composing it', () => {
    const driver = new ManualSchedulerDriver();
    const restoreDriver = installSchedulerDriverForTest(driver);
    const color = signal('red');
    let childRenders = 0;
    const Child = (_props: {}): CRCNode => {
      childRenders++;
      return createElement(Rectangle, {
        style: { width: 20, height: 20, fill: color.get() },
      });
    };
    const scene = createElement(Layer, {
      style: { width: 20, height: 20 },
      children: createElement(Child, {}),
    });
    const canvas = document.createElement('canvas');
    canvas.width = 20;
    canvas.height = 20;
    document.body.appendChild(canvas);
    const controller = crc(canvas, scene, { pixelRatio: 1 });
    const drawImage = vi.spyOn(CanvasRenderingContext2D.prototype, 'drawImage');

    try {
      driver.flush(10);
      const layerCanvas = layerCanvasFrom(drawImage);
      drawImage.mockClear();

      color.set('blue');
      driver.flush(20);

      expect(childRenders).toBe(2);
      expect(pixel(canvas, 5, 5)).toEqual([0, 0, 255, 255]);
      expect(drawImage).toHaveBeenCalledTimes(1);
      const child = getCRCInstance(layerCanvas);
      expect(child.completedRenderRevision).toBe(child.requestedRenderRevision);
    } finally {
      drawImage.mockRestore();
      controller.dispose();
      restoreDriver();
    }
  });

  it('refreshes nested pending layer surfaces from child to parent', () => {
    const driver = new ManualSchedulerDriver();
    const restoreDriver = installSchedulerDriverForTest(driver);
    const color = signal('red');
    let nestedRenders = 0;
    const NestedChild = (_props: {}): CRCNode => {
      nestedRenders++;
      return createElement(Rectangle, {
        style: { width: 20, height: 20, fill: color.get() },
      });
    };
    const scene = createElement(Layer, {
      style: { width: 20, height: 20 },
      children: createElement(Layer, {
        style: { width: 20, height: 20 },
        children: createElement(NestedChild, {}),
      }),
    });
    const canvas = document.createElement('canvas');
    canvas.width = 20;
    canvas.height = 20;
    document.body.appendChild(canvas);
    const controller = crc(canvas, scene, { pixelRatio: 1 });
    const drawImage = vi.spyOn(CanvasRenderingContext2D.prototype, 'drawImage');
    const offscreenDrawImage = vi.spyOn(
      OffscreenCanvasRenderingContext2D.prototype,
      'drawImage',
    );

    try {
      driver.flush(10);
      const outer = Array.from(GLOBAL_STATE.crcInstances.values())
        .find(instance => instance.parent === canvas)!;
      const nested = Array.from(GLOBAL_STATE.crcInstances.values())
        .find(instance => instance.parent === outer.canvas)!;
      drawImage.mockClear();
      offscreenDrawImage.mockClear();

      color.set('blue');
      driver.flush(20);

      expect(nestedRenders).toBe(2);
      expect(pixel(canvas, 5, 5)).toEqual([0, 0, 255, 255]);
      expect(offscreenDrawImage.mock.calls.map(([source]) => source)).toEqual([
        nested.canvas,
      ]);
      expect(drawImage.mock.calls.map(([source]) => source)).toEqual([outer.canvas]);
      expect(nested.completedRenderRevision).toBe(nested.requestedRenderRevision);
      expect(outer.completedRenderRevision).toBe(outer.requestedRenderRevision);
    } finally {
      offscreenDrawImage.mockRestore();
      drawImage.mockRestore();
      controller.dispose();
      restoreDriver();
    }
  });

  it('reuses a clean child bitmap when a parent signal changes Layer placement', () => {
    const driver = new ManualSchedulerDriver();
    const restoreDriver = installSchedulerDriverForTest(driver);
    const offset = signal(0);
    let childRenders = 0;
    const Child = (_props: {}): CRCNode => {
      childRenders++;
      return createElement(Rectangle, {
        style: { width: 20, height: 20, fill: 'red' },
      });
    };
    const Root = (_props: {}): CRCNode => createElement(Group, {
      style: { translateX: offset.get() },
      children: createElement(Layer, {
        style: { width: 20, height: 20 },
        children: createElement(Child, {}),
      }),
    });
    const root = createElement(Root, {});
    const canvas = document.createElement('canvas');
    canvas.width = 40;
    canvas.height = 20;
    document.body.appendChild(canvas);
    const controller = crc(canvas, root, { pixelRatio: 1 });

    try {
      driver.flush(10);

      offset.set(10);
      driver.flush(20);

      expect(childRenders).toBe(1);
      expect(pixel(canvas, 15, 5)).toEqual([255, 0, 0, 255]);
    } finally {
      controller.dispose();
      restoreDriver();
    }
  });

  it('isolates scheduler-driven Layer A and nested signal work from sibling Layer B', () => {
    const driver = new ManualSchedulerDriver();
    const restoreDriver = installSchedulerDriverForTest(driver);
    const aSignal = signal(0);
    const nestedSignal = signal(0);
    const renders = { root: 0, a: 0, b: 0, nested: 0 };
    const AChild = (_props: {}): CRCNode => {
      renders.a++;
      aSignal.get();
      return createElement(Rectangle, {
        style: { width: 20, height: 20, fill: 'red' },
      });
    };
    const NestedChild = (_props: {}): CRCNode => {
      renders.nested++;
      nestedSignal.get();
      return createElement(Rectangle, {
        style: { x: 20, width: 20, height: 20, fill: 'blue' },
      });
    };
    const BChild = (_props: {}): CRCNode => {
      renders.b++;
      return createElement(Rectangle, {
        style: { width: 20, height: 20, fill: 'green' },
      });
    };
    const Root = (_props: {}): CRCNode => {
      renders.root++;
      return createElement(Fragment, {
        children: [
          createElement(Layer, {
            style: { width: 40, height: 20 },
            children: [
              createElement(AChild, {}),
              createElement(Layer, {
                style: { width: 40, height: 20 },
                children: createElement(NestedChild, {}),
              }),
            ],
          }),
          createElement(Layer, {
            style: { width: 20, height: 20 },
            children: createElement(BChild, {}),
          }),
        ],
      });
    };
    const canvas = document.createElement('canvas');
    canvas.width = 40;
    canvas.height = 20;
    document.body.appendChild(canvas);
    const controller = crc(canvas, createElement(Root, {}), { pixelRatio: 1 });
    const drawImage = vi.spyOn(CanvasRenderingContext2D.prototype, 'drawImage');
    const offscreenDrawImage = vi.spyOn(
      OffscreenCanvasRenderingContext2D.prototype,
      'drawImage',
    );

    try {
      driver.flush(10);
      const [aLayer, bLayer] = Array.from(GLOBAL_STATE.crcInstances.values())
        .filter(instance => instance.parent === canvas);
      const nestedLayer = Array.from(GLOBAL_STATE.crcInstances.values())
        .find(instance => instance.parent === aLayer!.canvas)!;
      drawImage.mockClear();
      offscreenDrawImage.mockClear();

      aSignal.set(1);
      driver.flush(20);

      expect(renders).toEqual({ root: 2, a: 2, b: 1, nested: 1 });
      expect(drawImage.mock.calls.map(([source]) => source)).toEqual([
        aLayer!.canvas,
        bLayer!.canvas,
      ]);
      expect(aLayer!.completedRenderRevision).toBe(aLayer!.requestedRenderRevision);
      expect(bLayer!.completedRenderRevision).toBe(bLayer!.requestedRenderRevision);
      drawImage.mockClear();
      offscreenDrawImage.mockClear();

      nestedSignal.set(1);
      driver.flush(30);

      expect(renders).toEqual({ root: 3, a: 3, b: 1, nested: 2 });
      expect(offscreenDrawImage.mock.calls.map(([source]) => source)).toEqual([
        nestedLayer.canvas,
      ]);
      expect(drawImage.mock.calls.map(([source]) => source)).toEqual([
        aLayer!.canvas,
        bLayer!.canvas,
      ]);
      expect(nestedLayer.completedRenderRevision).toBe(
        nestedLayer.requestedRenderRevision,
      );
      expect(aLayer!.completedRenderRevision).toBe(aLayer!.requestedRenderRevision);
    } finally {
      offscreenDrawImage.mockRestore();
      drawImage.mockRestore();
      controller.dispose();
      restoreDriver();
    }
  });

  it('reuses the cached child bitmap when only an outer filter changes', () => {
    let childRenders = 0;
    const Counted = (_props: {}) => {
      childRenders += 1;
      return createElement(Rectangle, {
        style: { x: 10, y: 10, width: 30, height: 30, fill: '#ef4444' },
      });
    };
    const scene = (amount: number) => createElement(Layer, {
      style: {
        width: 60,
        height: 50,
        filter: { type: 'opacity', amount },
      },
      children: createElement(Counted, {}),
    });
    const mounted = mountNow(scene(0.75));
    const firstAlpha = pixel(mounted.canvas, 20, 20)[3]!;

    renderNow(mounted.canvas, scene(0.25));

    const parent = getCRCInstance(mounted.canvas);
    const child = Array.from(GLOBAL_STATE.crcInstances.values())
      .find(instance => instance.parent === mounted.canvas)!;
    expect(childRenders).toBe(1);
    expect(firstAlpha).toBeGreaterThan(180);
    expect(pixel(mounted.canvas, 20, 20)[3]).toBeLessThan(70);
    expect(parent.filterSurfacePool.snapshot()).toMatchObject({
      activePairs: 0,
      pairCheckouts: 2,
      pairReturns: 2,
    });
    expect(child.filterSurfacePool.snapshot().surfaceSlots).toBe(0);
    mounted.controller.dispose();
  });

  it('owns descendant filter surfaces in the child instance and releases them on removal', () => {
    const onClick = vi.fn();
    const scene = (show: boolean) => createElement(Group, {
      style: { translateX: 30, translateY: 20 },
      children: show ? createElement(Layer, {
        style: { width: 80, height: 60 },
        children: createElement(Layer, {
          style: { width: 70, height: 50 },
          children: createElement(Rectangle, {
            style: {
              x: 10,
              y: 10,
              width: 30,
              height: 20,
              fill: '#2563eb',
              filter: { type: 'blur', radius: 2 },
            },
            onClick,
          }),
        }),
      }) : undefined,
    });
    const mounted = mountNow(scene(true));
    const parent = getCRCInstance(mounted.canvas);
    const child = Array.from(GLOBAL_STATE.crcInstances.values())
      .find(instance => instance.parent === mounted.canvas)!;
    const grandchild = Array.from(GLOBAL_STATE.crcInstances.values())
      .find(instance => instance.parent === child.canvas)!;
    const childCanvas = child.canvas;
    const grandchildCanvas = grandchild.canvas;
    const childPool = child.filterSurfacePool;
    const grandchildPool = grandchild.filterSurfacePool;

    expect(parent.filterSurfacePool.snapshot().surfaceSlots).toBe(0);
    expect(childPool.snapshot().surfaceSlots).toBe(0);
    expect(grandchildPool.snapshot()).toMatchObject({
      surfaceSlots: 2,
      activePairs: 0,
      pairCheckouts: 1,
      pairReturns: 1,
    });
    dispatchClick(mounted.canvas, 55, 40);
    expect(onClick).toHaveBeenCalledOnce();

    renderNow(mounted.canvas, scene(false));

    expect(GLOBAL_STATE.crcInstances.has(childCanvas)).toBe(false);
    expect(GLOBAL_STATE.crcInstances.has(grandchildCanvas)).toBe(false);
    expect(parent.paintEntries.size).toBe(0);
    expect(childPool.snapshot()).toMatchObject({
      surfaceSlots: 0,
      activePairs: 0,
    });
    expect(grandchildPool.snapshot()).toMatchObject({
      surfaceSlots: 0,
      activePairs: 0,
      releasedSurfaceSlots: 2,
    });
    mounted.controller.dispose();
  });

  it('materializes arrays and iterables once per Layer traversal and paints every child in source order', () => {
    let iterations = 0;
    let childRenders = 0;
    function CountedChild(): CRCNode {
      childRenders++;
      return createElement(Rectangle, {
        style: { x: 20, y: 10, width: 40, height: 30, fill: '#ef4444' },
      });
    }
    const iterable: Iterable<CRCNode> = {
      *[Symbol.iterator]() {
        iterations++;
        yield createElement(CountedChild, {});
      },
    };
    const scene = () => createElement(Layer, {
      style: { width: 80, height: 60 },
      children: [
        createElement(Rectangle, {
          style: { width: 60, height: 40, fill: '#2563eb' },
        }),
        iterable,
      ],
    });
    const mounted = mountNow(scene());

    expect(iterations).toBe(1);
    expect(childRenders).toBe(1);
    expect(pixel(mounted.canvas, 5, 5)).toEqual([37, 99, 235, 255]);
    expect(pixel(mounted.canvas, 30, 20)).toEqual([239, 68, 68, 255]);

    renderNow(mounted.canvas, scene());
    expect(iterations).toBe(2);
    expect(childRenders).toBe(1);
    mounted.controller.dispose();
  });

  it('accepts empty Layer content without child resources or painted pixels', () => {
    const drawImage = vi.spyOn(
      CanvasRenderingContext2D.prototype,
      'drawImage',
    );
    const mounted = mountNow(createElement(Layer, {
      style: { width: 40, height: 30 },
      children: [],
    }));
    const offscreen = layerCanvasFrom(drawImage);
    const child = getCRCInstance(offscreen);

    expect(pixel(mounted.canvas, 10, 10)).toEqual([0, 0, 0, 0]);
    expect(child.paintEntries.size).toBe(0);
    expect(child.regions.size).toBe(0);
    mounted.controller.dispose();
  });

  it('preserves keyed child state while invalidating the cache for child reorder', () => {
    let mounts = 0;
    const trace: string[] = [];
    function Stateful({ label }: { label: string }): CRCNode {
      const identity = crcRef<number>();
      identity.current ??= ++mounts;
      trace.push(`${label}:${identity.current}`);
      return createElement(Rectangle, {
        style: { width: 10, height: 10 },
      });
    }
    const child = (label: string) => createElement(Stateful, {
      key: label,
      label,
    });
    const scene = (labels: readonly string[]) => createElement(Layer, {
      children: labels.map(child),
    });
    const mounted = mountNow(scene(['a', 'b']));
    expect(trace).toEqual(['a:1', 'b:2']);

    renderNow(mounted.canvas, scene(['b', 'a']));

    expect(trace).toEqual(['a:1', 'b:2', 'b:2', 'a:1']);
    expect(mounts).toBe(2);
    mounted.controller.dispose();
  });

  it('compares retained trees recursively and invalidates for prop, style, and child-sequence changes', () => {
    let renders = 0;
    function Counted(props: {
      version: number;
      style: { tone: string };
    }): CRCNode {
      renders++;
      return createElement(Rectangle, {
        style: {
          width: 20,
          height: 20,
          fill: props.style.tone,
        },
      });
    }
    const scene = (
      version: number,
      tone: string,
      extraChild: boolean,
    ) => createElement(Layer, {
      children: createElement(Group, {
        children: [
          createElement(Counted, { version, style: { tone } }),
          extraChild ? createElement(Rectangle, {
            key: 'extra',
            style: { x: 30, width: 10, height: 10 },
          }) : false,
        ],
      }),
    });
    const mounted = mountNow(scene(1, '#ef4444', false));
    expect(renders).toBe(1);

    renderNow(mounted.canvas, scene(1, '#ef4444', false));
    expect(renders).toBe(1);

    renderNow(mounted.canvas, scene(2, '#ef4444', false));
    expect(renders).toBe(2);

    renderNow(mounted.canvas, scene(2, '#2563eb', false));
    expect(renders).toBe(3);

    renderNow(mounted.canvas, scene(2, '#2563eb', true));
    expect(renders).toBe(4);
    mounted.controller.dispose();
  });

  it('invalidates and repaints when a reused mutable style object changes', () => {
    const sharedStyle = {
      width: 20,
      height: 20,
      fill: '#ef4444',
    };
    const scene = () => createElement(Layer, {
      children: createElement(Rectangle, { style: sharedStyle }),
    });
    const mounted = mountNow(scene());
    expect(pixel(mounted.canvas, 10, 10)).toEqual([239, 68, 68, 255]);

    sharedStyle.fill = '#2563eb';
    renderNow(mounted.canvas, scene());

    expect(pixel(mounted.canvas, 10, 10)).toEqual([37, 99, 235, 255]);
    mounted.controller.dispose();
  });

  it('invalidates when a reused descendant element mutable child array changes', () => {
    const children: CRCNode[] = [
      createElement(Rectangle, {
        style: { width: 20, height: 20, fill: '#ef4444' },
      }),
    ];
    const descendant = createElement(Group, { children });
    const scene = () => createElement(Layer, { children: descendant });
    const mounted = mountNow(scene());
    expect(pixel(mounted.canvas, 10, 10)).toEqual([239, 68, 68, 255]);

    children.push(createElement(Rectangle, {
      style: { width: 20, height: 20, fill: '#2563eb' },
    }));
    renderNow(mounted.canvas, scene());

    expect(pixel(mounted.canvas, 10, 10)).toEqual([37, 99, 235, 255]);
    mounted.controller.dispose();
  });

  it('invalidates when an enumerable symbol-keyed prop changes', () => {
    const tone = Symbol('tone');
    let renders = 0;
    const Counted = (props: { [tone]: string }) => {
      renders++;
      return createElement(Rectangle, {
        style: { width: 20, height: 20, fill: props[tone] },
      });
    };
    const scene = (fill: string) => createElement(Layer, {
      children: createElement(Counted, { [tone]: fill }),
    });
    const mounted = mountNow(scene('#ef4444'));
    expect(renders).toBe(1);

    renderNow(mounted.canvas, scene('#2563eb'));

    expect(renders).toBe(2);
    expect(pixel(mounted.canvas, 10, 10)).toEqual([37, 99, 235, 255]);
    mounted.controller.dispose();
  });

  it('cache-hits for unchanged fresh structural trees', () => {
    let renders = 0;
    const Counted = ({ tone }: { tone: string }) => {
      renders++;
      return createElement(Rectangle, { style: { width: 20, height: 20, fill: tone } });
    };
    const scene = () => createElement(Layer, {
      children: createElement(Group, {
        style: { translateX: 5 },
        children: createElement(Counted, { tone: '#ef4444' }),
      }),
    });
    const mounted = mountNow(scene());

    renderNow(mounted.canvas, scene());

    expect(renders).toBe(1);
    mounted.controller.dispose();
  });

  it('does not execute an unchanged opaque nested iterable during equality', () => {
    let iterations = 0;
    let renders = 0;
    const Counted = (_props: {}) => {
      renders++;
      return createElement(Rectangle, { style: { width: 20, height: 20, fill: '#ef4444' } });
    };
    const nestedIterable: Iterable<CRCNode> = {
      *[Symbol.iterator]() {
        iterations++;
        yield createElement(Counted, {});
      },
    };
    const scene = () => createElement(Layer, {
      children: createElement(Group, { children: nestedIterable }),
    });
    const mounted = mountNow(scene());
    expect([iterations, renders]).toEqual([1, 1]);

    renderNow(mounted.canvas, scene());

    expect([iterations, renders]).toEqual([1, 1]);
    mounted.controller.dispose();
  });

  it('commits snapshots after successful child renders and discards failed attempts', () => {
    interface RevisionStyle extends SystemStyle {
      revision: number;
    }
    const sharedStyle: RevisionStyle = { revision: 1 };
    let shouldFail = false;
    let renders = 0;
    const Child = (_props: {} & { style: Readonly<RevisionStyle> }) => {
      renders++;
      if (shouldFail) {
        sharedStyle.revision = 4;
        throw new Error('snapshot candidate failed');
      }
      sharedStyle.revision = 2;
      return createElement(Rectangle, { style: { width: 20, height: 20, fill: '#2563eb' } });
    };
    const scene = () => createElement(Layer, {
      children: createElement(Child, { style: sharedStyle }),
    });
    const mounted = mountNow(scene());

    renderNow(mounted.canvas, scene());
    expect(renders).toBe(1);

    sharedStyle.revision = 3;
    shouldFail = true;
    expect(() => renderNow(mounted.canvas, scene()))
      .toThrowError('snapshot candidate failed');

    shouldFail = false;
    renderNow(mounted.canvas, scene());
    renderNow(mounted.canvas, scene());

    expect(renders).toBe(3);
    expect(pixel(mounted.canvas, 10, 10)).toEqual([37, 99, 235, 255]);
    mounted.controller.dispose();
  });

  it('includes transparent policy metadata in retained-tree equality', () => {
    let renders = 0;
    const Counted = (_props: {}) => {
      renders++;
      return createElement(Rectangle, { style: { width: 20, height: 20 } });
    };
    const managedScene = () => createElement(Layer, {
      children: focusManaged(createElement(Counted, {})),
    });
    const mounted = mountNow(managedScene());
    expect(renders).toBe(1);

    renderNow(mounted.canvas, managedScene());
    expect(renders).toBe(1);

    renderNow(mounted.canvas, createElement(Layer, {
      children: createElement(Counted, {}),
    }));
    expect(renders).toBe(2);
    expect(getCRCInstance(mounted.canvas).eventRoot.focusPolicy).toBeUndefined();
    mounted.controller.dispose();
  });

  it('replays retained focus metadata on a cache hit without executing child components', () => {
    let renders = 0;
    const FocusTarget = ({ label }: { label: string }) => {
      renders++;
      crcEventTarget(
        { onClick: () => undefined },
        { path: rectanglePath(0, 0, 30, 30), fill: true },
      );
      return createElement(Rectangle, { style: { width: 30, height: 30 }, key: label });
    };
    const scene = () => createElement(Layer, {
      children: focusManaged(createElement(Fragment, {
        key: 'cached-policy-scope',
        children: createElement(FocusTarget, { label: 'cached' }),
      })),
    });
    const mounted = mountNow(scene());
    const policy = getCRCInstance(mounted.canvas).eventRoot.focusPolicy as unknown as
      { readonly candidates: readonly { readonly target: unknown }[] };
    const target = policy.candidates[0].target;
    expect(renders).toBe(1);

    renderNow(mounted.canvas, scene());

    const replayedPolicy = getCRCInstance(mounted.canvas).eventRoot.focusPolicy as unknown as
      { readonly candidates: readonly { readonly target: unknown }[] };
    expect(renders).toBe(1);
    expect(replayedPolicy).toBe(policy);
    expect(replayedPolicy.candidates).toHaveLength(1);
    expect(replayedPolicy.candidates[0].target).toBe(target);
    mounted.controller.dispose();
  });

  it('updates transformed Layer hit testing for multiple child targets', () => {
    const bottomClick = vi.fn();
    const topClick = vi.fn();
    const mounted = mountNow(createElement(Group, {
      style: { translateX: 40, translateY: 20, scaleX: 1.5 },
      children: createElement(Layer, {
        style: { width: 80, height: 60 },
        children: [
          createElement(Rectangle, {
            style: { width: 70, height: 50, fill: '#2563eb' },
            onClick: bottomClick,
          }),
          createElement(Rectangle, {
            style: { x: 20, y: 10, width: 30, height: 30, fill: '#ef4444' },
            onClick: topClick,
          }),
        ],
      }),
    }));

    dispatchClick(mounted.canvas, 105, 40);
    expect(topClick).toHaveBeenCalledOnce();
    expect(bottomClick).not.toHaveBeenCalled();
    dispatchClick(mounted.canvas, 68, 25);
    expect(bottomClick).toHaveBeenCalledOnce();
    mounted.controller.dispose();
  });

  it('resizes the retained offscreen surface and rerenders its children', () => {
    let renders = 0;
    function Counted(): CRCNode {
      renders++;
      return createElement(Rectangle, {
        style: { width: 20, height: 20, fill: '#2563eb' },
      });
    }
    const drawImage = vi.spyOn(
      CanvasRenderingContext2D.prototype,
      'drawImage',
    );
    const scene = (width: number, height: number) => createElement(Layer, {
      style: { width, height },
      children: createElement(Counted, {}),
    });
    const mounted = mountNow(scene(80, 60));
    expect(renders).toBe(1);

    renderNow(mounted.canvas, scene(120, 70));

    const call = drawImage.mock.lastCall!;
    const offscreen = call[0] as OffscreenCanvas;
    expect([offscreen.width, offscreen.height]).toEqual([120, 70]);
    expect(call.slice(1)).toEqual([0, 0, 120, 70, 0, 0, 120, 70]);
    expect(renders).toBe(2);
    mounted.controller.dispose();
  });

  it('fails closed and releases the child controller when a Layer child throws', () => {
    let cleanups = 0;
    function Child({ fail }: { fail: boolean }): CRCNode {
      crcWhenChanged(() => () => cleanups++, []);
      if (fail) throw new Error('layer child failed');
      return createElement(Rectangle, {
        style: { width: 20, height: 20, fill: '#ef4444' },
      });
    }
    const scene = (fail: boolean) => createElement(Layer, {
      children: createElement(Child, { fail }),
    });
    const drawImage = vi.spyOn(
      CanvasRenderingContext2D.prototype,
      'drawImage',
    );
    const mounted = mountNow(scene(false));
    const offscreen = layerCanvasFrom(drawImage);

    expect(() => renderNow(mounted.canvas, scene(true)))
      .toThrowError('layer child failed');
    expect(cleanups).toBe(1);
    expect(GLOBAL_STATE.crcInstances.has(offscreen)).toBe(false);
    expect(getCRCInstance(mounted.canvas).refs.size).toBe(0);
    expect(getCRCInstance(mounted.canvas).paintEntries.size).toBe(0);
    mounted.controller.dispose();
  });

  it('disposes one child controller and its resources exactly once', () => {
    let cleanups = 0;
    function Child(): CRCNode {
      crcWhenChanged(() => () => cleanups++, []);
      return createElement(Rectangle, {
        style: { width: 20, height: 20 },
        onClick: () => undefined,
      });
    }
    const drawImage = vi.spyOn(
      CanvasRenderingContext2D.prototype,
      'drawImage',
    );
    const mounted = mountNow(createElement(Layer, {
      children: createElement(Child, {}),
    }));
    const parent = getCRCInstance(mounted.canvas);
    const offscreen = layerCanvasFrom(drawImage);

    mounted.controller.dispose();
    mounted.controller.dispose();

    expect(cleanups).toBe(1);
    expect(parent.paintEntries.size).toBe(0);
    expect(GLOBAL_STATE.crcInstances.has(mounted.canvas)).toBe(false);
    expect(GLOBAL_STATE.crcInstances.has(offscreen)).toBe(false);
  });
});

describe('layer', () => {
  interface MyComponentProps {
    onRender: () => void;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    fillStyle?: string;
  }

  const MyComponent = ({ onRender, x = 0, y = 0, width = 100, height = 100, fillStyle = 'blue' }: MyComponentProps) => {
    const [counter, setCounter] = crcState(0);
    onRender();
    return createElement(Rectangle, {
      style: {
        x,
        y,
        width,
        height,
        fill: fillStyle,
      },
      onClick: () => setCounter(counter + 1),
    });
  };

  const myComponent = MyComponent;

  it('uses style as the sole offscreen-dimension authority', async () => {
    const drawImage = vi.spyOn(
      CanvasRenderingContext2D.prototype,
      'drawImage',
    );
    const legacyInput = {
      style: { width: 123, height: 87 },
      width: 500,
      height: 400,
      render: createElement(Rectangle, {
        style: { x: 0, y: 0, width: 10, height: 10, fill: 'red' },
      }),
    } as any;

    await componentTest(createElement(Layer, legacyInput));

    const offscreen = drawImage.mock.lastCall![0] as OffscreenCanvas;
    expect([offscreen.width, offscreen.height]).toEqual([123, 87]);
    drawImage.mockRestore();
  });

  it('allocates and composites an offscreen backing at root logical density', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 100;
    canvas.style.cssText = 'display:block; width:300px; height:300px';
    document.body.appendChild(canvas);
    const drawImage = vi.spyOn(CanvasRenderingContext2D.prototype, 'drawImage');
    const controller = crc(canvas, createElement(Layer, {
      style: { width: 200, height: 100 },
      children: createElement(Rectangle, {
        style: { width: 200, height: 100, fill: '#2563eb' },
      }),
    }), { pixelRatio: 2 });

    await settleSurface();

    const call = drawImage.mock.lastCall!;
    const offscreen = call[0] as OffscreenCanvas;
    expect([offscreen.width, offscreen.height]).toEqual([600, 300]);
    expect(call.slice(1)).toEqual([0, 0, 600, 300, 0, 0, 200, 100]);
    controller.dispose();
    drawImage.mockRestore();
  });

  it('rerenders an unchanged layer when root logical density changes', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 100;
    canvas.style.cssText = 'display:block; width:200px; height:100px';
    document.body.appendChild(canvas);
    let renders = 0;
    const Counted = (_props: {}) => {
      renders++;
      return createElement(Rectangle, { style: { width: 200, height: 100, fill: '#2563eb' } });
    };
    const drawImage = vi.spyOn(CanvasRenderingContext2D.prototype, 'drawImage');
    const controller = crc(canvas, createElement(Layer, {
      style: { width: 200, height: 100 },
      children: createElement(Counted, {}),
    }), { pixelRatio: 2 });
    await settleSurface();

    canvas.style.width = '300px';
    canvas.style.height = '150px';
    await settleSurface();

    const offscreen = drawImage.mock.lastCall![0] as OffscreenCanvas;
    expect([offscreen.width, offscreen.height]).toEqual([600, 300]);
    expect(renders).toBe(2);
    controller.dispose();
    drawImage.mockRestore();
  });

  it('renders basic content to offscreen canvas', async () => {
    await componentTest(createElement(Layer, {
      children: createElement(myComponent, {
        onRender: () => {},
        x: 50,
        y: 50,
        width: 100,
        height: 100,
      }),
    }));
    await takeScreenshot(page);
  });

  it('respects custom dimensions', async () => {
    await componentTest(createElement(Layer, {
      style: {
        width: 200,
        height: 150
      },
      children: createElement(Rectangle, {
        style: {
          x: 0,
          y: 0,
          width: 200,
          height: 150,
          fill: 'green'
        }
      })
    }));
    await takeScreenshot(page);
  });

  describe('render optimization', () => {
    it('optimizes renders compared to non-layered components', async () => {
      let normalRenderCount = 0;
      let layeredRenderCount = 0;

      const NORMAL_RECT_CENTER = { x: 50, y: 50 };
      const LAYERED_RECT_CENTER = { x: 150, y: 50 };

      const _canvas = await componentTest(createElement(Group, {
        children: [
          // Non-layered component
          createElement(myComponent, {
            onRender: () => normalRenderCount++,
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            fillStyle: 'blue',
          }),
          // Same component inside a layer
          createElement(Layer, {
            children: createElement(myComponent, {
              onRender: () => layeredRenderCount++,
              x: 100,
              y: 0,
              width: 100,
              height: 100,
              fillStyle: 'red',
            }),
          }),
        ],
      }));

      // Initial render count should be 1 for each
      expect(normalRenderCount).toBe(1);
      expect(layeredRenderCount).toBe(1);

      await _canvas.click({ position: NORMAL_RECT_CENTER });
      // Non-layered component should re-render, layered should not
      expect(normalRenderCount).toBe(2);
      expect(layeredRenderCount).toBe(1);

      await _canvas.click({ position: LAYERED_RECT_CENTER });
      // Non-layered component should re-render again, layered still should not
      expect(normalRenderCount).toBe(3);
      expect(layeredRenderCount).toBe(2);
    });

    it('only re-renders when props change', async () => {
      let renderCount = 0;
      const countedRect = definePrimitive<RectangleProps, RectStyle>((props, style) => {
        renderCount++;
        return createElement(Rectangle, {
          ...props,
          style,
        });
      });

      const wrapperComponent = (_props: {}) => {
        const [fillStyle, setFillStyle] = crcState('blue');
        const [layerWidth, setLayerWidth] = crcState(200);

        return createElement(Group, {
          children: [
            createElement(Rectangle, {
              style: {
                x: 0,
                y: 0,
                width: 200,
                height: 200,
                fill: 'green',
              },
              onClick: () => {
                setFillStyle('red');
                setLayerWidth(300);
              },
            }),
            createElement(Layer, {
              style: {
                width: layerWidth
              },
              children: createElement(countedRect, {
                style: {
                  x: 0,
                  y: 0,
                  width: 200,
                  height: 200,
                  fill: fillStyle
                }
              })
            }),
          ],
        });
      };

      const canvas = await componentTest(createElement(wrapperComponent, {}));
      // Click to trigger state changes
      await canvas.click({ position: { x: 100, y: 100 } });

      // Should re-render due to prop changes from state updates
      expect(renderCount).toBe(2);
    });

    it('re-renders when only the root element style changes', async () => {
      let renderCount = 0;
      const renderProps = { onRender: () => renderCount++ };
      interface CountedRectStyle extends SystemStyle {
        version: number;
      }
      const countedRect = ({ onRender }: typeof renderProps & { style: Readonly<CountedRectStyle> }) => {
        onRender();
        return createElement(Rectangle, {
          style: {
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            fill: 'blue',
          },
        });
      };
      const wrapperComponent = (_props: {}) => {
        const [styleVersion, setStyleVersion] = crcState(1);
        return createElement(Group, {
          children: [
            createElement(Rectangle, {
              style: {
                x: 100,
                y: 0,
                width: 100,
                height: 100,
                fill: 'green',
              },
              onClick: () => setStyleVersion(2),
            }),
            createElement(Layer, {
              children: createElement(countedRect, {
                ...renderProps,
                style: { version: styleVersion },
              }),
            }),
          ],
        });
      };

      const canvas = await componentTest(createElement(wrapperComponent, {}));
      expect(renderCount).toBe(1);

      await canvas.click({ position: { x: 150, y: 50 } });

      expect(renderCount).toBe(2);
    });

    it('re-renders when only the root element props change', async () => {
      let renderCount = 0;
      const countedRect = ({ onRender }: {
        version: number;
        onRender: () => void;
      }) => {
        onRender();
        return createElement(Rectangle, {
          style: {
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            fill: 'blue',
          },
        });
      };
      const wrapperComponent = (_props: {}) => {
        const [version, setVersion] = crcState(1);
        return createElement(Group, {
          children: [
            createElement(Rectangle, {
              style: {
                x: 100,
                y: 0,
                width: 100,
                height: 100,
                fill: 'green',
              },
              onClick: () => setVersion(2),
            }),
            createElement(Layer, {
              children: createElement(countedRect, {
                version,
                onRender: () => renderCount++,
              }),
            }),
          ],
        });
      };

      const canvas = await componentTest(createElement(wrapperComponent, {}));
      expect(renderCount).toBe(1);

      await canvas.click({ position: { x: 150, y: 50 } });

      expect(renderCount).toBe(2);
    });

    it('re-renders when dimensions change on the same mount', async () => {
      let renderCount = 0;
      const onRender = () => renderCount++;
      const wrapperComponent = (_props: {}) => {
        const [size, setSize] = crcState(100);
        return createElement(Group, { children: [
          createElement(Rectangle, {
            style: {
              x: 0,
              y: 0,
              width: 300,
              height: 300,
              fill: 'green',
            },
            onClick: () => setSize(200),
          }),
          createElement(Layer, {
            style: {
              width: size,
              height: size
            },
            children: createElement(myComponent, {
              onRender,
              width: size,
              height: size
            })
          }),
        ] });
      };

      const canvas = await componentTest(createElement(wrapperComponent, {}));
      expect(renderCount).toBe(1);

      await canvas.click({ position: { x: 250, y: 250 } });

      expect(renderCount).toBe(2);
    });
  });

  describe('complex rendering', () => {
    it('handles nested components', async () => {
      await componentTest(createElement(Layer, {
        children: createElement(Group, {
          style: {
            translateX: 100,
            translateY: 100
          },
          children: [createElement(Rectangle, {
            style: {
              x: 0,
              y: 0,
              width: 50,
              height: 50,
              fill: 'purple'
            }
          }), createElement(Text, {
            style: {
              x: 10,
              y: 30,
              fill: 'white'
            }
          }, 'Layered!')]
        }),
      }));
      await takeScreenshot(page);
    });

    it('handles multiple layers', async () => {
      await componentTest(createElement(Group, {
        children: [
          // Background layer
          createElement(Layer, {
            children: createElement(Rectangle, {
              style: {
                x: 0,
                y: 0,
                width: 300,
                height: 200,
                fill: 'lightblue',
              },
            }),
          }),
          // Content layer
          createElement(Layer, {
            children: createElement(Group, {
              style: {
                translateX: 50,
                translateY: 50
              },
              children: [createElement(Rectangle, {
                style: {
                  x: 0,
                  y: 0,
                  width: 100,
                  height: 100,
                  fill: 'rgba(255, 0, 0, 0.5)'
                }
              }), createElement(Text, {
                style: {
                  x: 20,
                  y: 50,
                  fill: 'white'
                }
              }, 'Multiple Layers')]
            }),
          }),
          // Overlay layer
          createElement(Layer, {
            children: createElement(Rectangle, {
              style: {
                x: 100,
                y: 100,
                width: 50,
                height: 50,
                fill: 'rgba(0, 255, 0, 0.5)',
              },
            }),
          }),
        ],
      }));
      await takeScreenshot(page);
    });
  });

  describe('interaction behavior', () => {
    it('handles mouse events through layers', async () => {
      const onClick = vi.fn();
      const BLUE_RECT_CENTER = { x: 75, y: 75 };
      const EMPTY_SPACE_POSITION = { x: 25, y: 25 };

      const canvas = await componentTest(createElement(Layer, {
        children: createElement(Rectangle, {
          style: {
            x: 50,
            y: 50,
            width: 100,
            height: 100,
            fill: 'blue',
          },
          onClick,
        }),
      }));

      await canvas.click({ position: BLUE_RECT_CENTER });
      expect(onClick).toHaveBeenCalledTimes(1);

      await canvas.click({ position: EMPTY_SPACE_POSITION });
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('handles events with multiple layers', async () => {
      const onClickTop = vi.fn();
      const onClickBottom = vi.fn();
      const RED_RECT_CENTER = { x: 75, y: 75 };
      const BLUE_RECT_EXCLUSIVE_AREA = { x: 25, y: 25 };

      const canvas = await componentTest(createElement(Group, {
        children: [
          // Bottom layer
          createElement(Layer, {
            children: createElement(Rectangle, {
              style: {
                x: 0,
                y: 0,
                width: 200,
                height: 200,
                fill: 'blue',
              },
              onClick: onClickBottom,
            }),
          }),
          // Top layer
          createElement(Layer, {
            children: createElement(Rectangle, {
              style: {
                x: 50,
                y: 50,
                width: 100,
                height: 100,
                fill: 'red',
              },
              onClick: onClickTop,
            }),
          }),
        ],
      }));

      await canvas.click({ position: RED_RECT_CENTER });
      expect(onClickTop).toHaveBeenCalledTimes(1);
      expect(onClickBottom).not.toHaveBeenCalled();

      await canvas.click({ position: BLUE_RECT_EXCLUSIVE_AREA });
      expect(onClickTop).toHaveBeenCalledTimes(1);
      expect(onClickBottom).toHaveBeenCalledTimes(1);
    });

    it('lets root content painted after a layer win the global target', async () => {
      const onClickLayer = vi.fn();
      const onClickRoot = vi.fn();
      const canvas = await componentTest(createElement(Group, {
        children: [
          createElement(Layer, {
            children: createElement(Rectangle, {
              style: {
                x: 40,
                y: 40,
                width: 120,
                height: 120,
                fill: 'orange',
              },
              onClick: onClickLayer,
            }),
          }),
          createElement(Rectangle, {
            style: {
              x: 70,
              y: 70,
              width: 60,
              height: 60,
              fill: 'purple',
            },
            onClick: onClickRoot,
          }),
        ],
      }));

      await canvas.click({ position: { x: 100, y: 100 } });
      expect(onClickRoot).toHaveBeenCalledOnce();
      expect(onClickLayer).not.toHaveBeenCalled();
    });

    it('composes the parent transform into layer hit testing', async () => {
      const onClick = vi.fn();
      const canvas = await componentTest(createElement(Group, {
        style: {
          translateX: 120,
          translateY: 50,
          scaleX: 1.5
        },
        children: [createElement(Layer, {
          style: {
            width: 80,
            height: 80
          },
          children: createElement(Rectangle, {
            style: {
              x: 0,
              y: 0,
              width: 60,
              height: 60,
              fill: 'teal'
            },
            onClick
          })
        })]
      }));

      await canvas.click({ position: { x: 225, y: 80 } });
      expect(onClick).toHaveBeenCalledOnce();

      await canvas.click({ position: { x: 30, y: 30 } });
      expect(onClick).toHaveBeenCalledOnce();
    });

    it('clips interaction to the offscreen layer dimensions', async () => {
      const onClick = vi.fn();
      const canvas = await componentTest(createElement(Layer, {
        style: {
          width: 50,
          height: 50
        },
        children: createElement(Rectangle, {
          style: {
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            fill: 'blue'
          },
          onClick
        })
      }));

      await canvas.click({ position: { x: 25, y: 25 } });
      expect(onClick).toHaveBeenCalledOnce();

      await canvas.click({ position: { x: 75, y: 25 } });
      expect(onClick).toHaveBeenCalledOnce();
    });

    it('recursively resolves transformed nested layers', async () => {
      const onClick = vi.fn();
      const canvas = await componentTest(createElement(Layer, {
        style: {
          width: 200,
          height: 150
        },
        children: createElement(Group, {
          style: {
            translateX: 60,
            translateY: 30
          },
          children: [createElement(Layer, {
            style: {
              width: 80,
              height: 80
            },
            children: createElement(Rectangle, {
              style: {
                x: 0,
                y: 0,
                width: 60,
                height: 60,
                fill: 'green'
              },
              onClick
            })
          })]
        })
      }));

      await canvas.click({ position: { x: 90, y: 60 } });
      expect(onClick).toHaveBeenCalledOnce();

      await canvas.click({ position: { x: 30, y: 30 } });
      expect(onClick).toHaveBeenCalledOnce();
    });

    it('applies parent clips to layered interaction geometry', async () => {
      const clipPath = new Path2D();
      clipPath.rect(50, 50, 80, 80);
      const onClick = vi.fn();
      const canvas = await componentTest(createElement(Clip, {
        style: {
          d: clipPath
        },
        children: [createElement(Layer, {
          children: createElement(Rectangle, {
            style: {
              x: 0,
              y: 0,
              width: 180,
              height: 180,
              fill: 'red'
            },
            onClick
          })
        })]
      }));

      await canvas.click({ position: { x: 80, y: 80 } });
      expect(onClick).toHaveBeenCalledOnce();

      await canvas.click({ position: { x: 25, y: 25 } });
      expect(onClick).toHaveBeenCalledOnce();
    });

    it('shares transitions, cursor targeting, and observer order with the root', async () => {
      const calls: string[] = [];
      const LayerTarget = (_props: {}) => {
        crcEvent('mousemove', () => calls.push('observer'));
        return createElement(Rectangle, {
          style: {
            x: 50,
            y: 50,
            width: 100,
            height: 100,
            fill: 'orange',
            cursor: 'pointer',
          },
          onMouseOver: () => calls.push('layer-over'),
          onMouseOut: () => calls.push('layer-out'),
          onMouseMove: () => calls.push('layer-move'),
        });
      };
      const canvas = await componentTest(createElement(Group, {
        children: [
          createElement(Rectangle, {
            style: {
              x: 0,
              y: 0,
              width: 200,
              height: 200,
              fill: 'blue',
              cursor: 'crosshair',
            },
            onMouseOver: () => calls.push('root-over'),
            onMouseMove: () => calls.push('root-move'),
          }),
          createElement(Layer, { children: createElement(LayerTarget, {}) }),
        ],
      }));

      await canvas.mouseMove({ position: { x: 100, y: 100 } });
      expect(calls).toEqual(['layer-over', 'layer-move', 'observer']);
      expect(canvas.element.style.cursor).toBe('pointer');

      await canvas.mouseMove({ position: { x: 20, y: 20 } });
      expect(calls).toEqual([
        'layer-over',
        'layer-move',
        'observer',
        'layer-out',
        'root-over',
        'root-move',
        'observer',
      ]);
      expect(canvas.element.style.cursor).toBe('crosshair');
    });

    it('roots a pathless layer cursor as the Canvas fallback', async () => {
      const LayerDefaultCursor = (_props: {}) => {
        crcCursor({ style: 'wait' });
        return createElement(Rectangle, {
          style: {
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            fill: 'gray',
          },
        });
      };
      const canvas = await componentTest(createElement(Layer, {
        children: createElement(LayerDefaultCursor, {}),
      }));

      await canvas.mouseMove({ position: { x: 50, y: 50 } });
      expect(canvas.element.style.cursor).toBe('wait');
    });
  });
});

function mountNow(root: CRCNode): {
  canvas: HTMLCanvasElement;
  controller: CRCController;
} {
  const canvas = document.createElement('canvas');
  canvas.width = 200;
  canvas.height = 100;
  canvas.style.cssText = 'display:block;width:200px;height:100px';
  document.body.appendChild(canvas);
  const controller = crc(canvas, root, { pixelRatio: 1 });
  executeRender(canvas, performance.now(), root, false);
  return { canvas, controller };
}

function renderNow(canvas: HTMLCanvasElement, root: CRCNode): void {
  executeRender(canvas, performance.now(), root, false);
}

function pixel(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
): number[] {
  return Array.from(canvas.getContext('2d')!.getImageData(x, y, 1, 1).data);
}

function dispatchClick(canvas: HTMLCanvasElement, x: number, y: number): void {
  const bounds = canvas.getBoundingClientRect();
  for (const type of ['mousedown', 'mouseup', 'click']) {
    canvas.dispatchEvent(new MouseEvent(type, {
      bubbles: true,
      button: 0,
      buttons: type === 'mousedown' ? 1 : 0,
      cancelable: true,
      clientX: bounds.left + x,
      clientY: bounds.top + y,
    }));
  }
}

function rectanglePath(
  x: number,
  y: number,
  width: number,
  height: number,
): Path2D {
  const path = new Path2D();
  path.rect(x, y, width, height);
  return path;
}

function layerCanvasFrom(drawImage: {
  readonly mock: { readonly calls: readonly (readonly unknown[])[] };
}): OffscreenCanvas {
  const canvas = drawImage.mock.calls
    .map(call => call[0])
    .find(value => value instanceof OffscreenCanvas);
  if (!(canvas instanceof OffscreenCanvas)) {
    throw new Error('Expected Layer to composite an OffscreenCanvas.');
  }
  return canvas;
}

async function settleSurface(): Promise<void> {
  await nextFrame();
  await nextFrame();
  await nextFrame();
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}
