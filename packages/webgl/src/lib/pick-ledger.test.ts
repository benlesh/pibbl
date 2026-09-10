import {
  Group3D,
  createWebGLGeometry,
  defineWebGLPrimitive,
  type CRCWebGLPrimitiveHitInput,
} from '../index.js';
import {
  crc,
  createElement,
  type CRCNode,
  type SystemStyle,
} from '@crc/core';
import {
  executeBackendCRC,
  mountBackendCRC,
  type CRCEventTargetRegistration,
} from '@crc/core/internal';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWebGLBackend } from './backend.js';
import { resolveCamera } from './math/camera.js';
import {
  commitWebGLPickLedger,
  createWebGLPickLedger,
  recordCustomWebGLPick,
  recordGeometryWebGLPick,
  type CRCWebGLPickRecord,
} from './pick-ledger.js';

const disposals: Array<() => void> = [];

afterEach(() => {
  for (const dispose of disposals.splice(0)) dispose();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('WebGL pick ledger', () => {
  it('commits stable geometry identity with a copied model and LEQUAL source order', () => {
    const ledger = createWebGLPickLedger(80, 40);
    const geometry = createWebGLGeometry({
      positions: [-1, -1, 0, 1, -1, 0, 0, 1, 0],
    });
    const target = fakeTarget();
    const model = new Float32Array([
      1, 0, 0, 0,
      0, 2, 0, 0,
      0, 0, -3, 0,
      4, 5, 6, 1,
    ]);

    recordGeometryWebGLPick(ledger, {
      componentName: 'Triangle',
      depthMode: 'less-equal',
      geometry,
      model,
      sourceOrder: 7,
      target,
    });
    model[12] = 99;
    const committed = commitWebGLPickLedger(ledger);

    expect(committed.logicalViewport).toEqual({ width: 80, height: 40 });
    expect(committed.entries).toHaveLength(1);
    expect(committed.entries[0]).toMatchObject({
      componentName: 'Triangle',
      depthMode: 'less-equal',
      geometry,
      kind: 'geometry',
      sourceOrder: 7,
      target,
    });
    expect(Array.from(committed.entries[0]!.model)).toEqual([
      1, 0, 0, 0,
      0, 2, 0, 0,
      0, 0, -3, 0,
      4, 5, 6, 1,
    ]);
    expect(Object.isFrozen(committed)).toBe(true);
    expect(Object.isFrozen(committed.entries)).toBe(true);
  });

  it('snapshots custom props, style, model, and camera without retaining frame objects', () => {
    const ledger = createWebGLPickLedger(50, 50);
    const target = fakeTarget();
    const camera = resolveCamera(undefined, 50, 50);
    const props = { label: 'committed' };
    const style = { amount: 2 };
    const model = new Float32Array(camera.viewMatrix);
    const resolve = vi.fn(() => null);

    recordCustomWebGLPick(ledger, {
      camera,
      componentName: 'AnalyticShape',
      depthMode: 'less-equal',
      model,
      props,
      resolve,
      sourceOrder: 3,
      style,
      target,
    });
    props.label = 'mutated';
    style.amount = 9;
    model[0] = 99;
    (camera.viewMatrix as Float32Array)[0] = 77;
    const committed = commitWebGLPickLedger(ledger);
    const entry = committed.entries[0]!;

    expect(entry.kind).toBe('custom');
    if (entry.kind !== 'custom') throw new Error('expected custom pick entry');

    expect(entry).toMatchObject({
      camera: { aspect: 1 },
      componentName: 'AnalyticShape',
      depthMode: 'less-equal',
      kind: 'custom',
      props: { label: 'committed' },
      sourceOrder: 3,
      style: { amount: 2 },
      target,
    });
    expect(entry.model[0]).not.toBe(99);
    expect(entry.camera.viewMatrix[0]).not.toBe(77);
    expect(Object.isFrozen(entry.props)).toBe(true);
    expect(Object.isFrozen(entry.style)).toBe(true);
  });

  it('recursively snapshots supported custom values and preserves opaque identities', () => {
    const ledger = createWebGLPickLedger(50, 50);
    const geometry = createWebGLGeometry({
      positions: [-1, -1, 0, 1, -1, 0, 0, 1, 0],
    });
    const callback = () => undefined;
    const nested = { distance: 1 };
    const list = [{ enabled: true }];
    const typed = new Float32Array([2, 3]);
    const bytes = new Uint8Array([4, 5]);
    const view = new DataView(bytes.buffer);
    const styleNested = { threshold: 6 };

    recordCustomWebGLPick(ledger, {
      camera: resolveCamera(undefined, 50, 50),
      componentName: 'SnapshotShape',
      depthMode: 'less-equal',
      model: new Float32Array(16),
      props: { callback, geometry, list, nested, typed, view },
      resolve: () => null,
      sourceOrder: 0,
      style: { nested: styleNested },
      target: fakeTarget(),
    });
    nested.distance = 9;
    list[0]!.enabled = false;
    typed[0] = 9;
    view.setUint8(0, 9);
    styleNested.threshold = 9;
    const entry = commitWebGLPickLedger(ledger).entries[0]!;

    expect(entry.kind).toBe('custom');
    if (entry.kind !== 'custom') throw new Error('expected custom pick entry');
    const props = entry.props as {
      callback: typeof callback;
      geometry: typeof geometry;
      list: Array<{ enabled: boolean }>;
      nested: { distance: number };
      typed: Float32Array;
      view: DataView;
    };
    const style = entry.style as { nested: { threshold: number } };
    expect(props.nested.distance).toBe(1);
    expect(props.list[0]!.enabled).toBe(true);
    expect(Array.from(props.typed)).toEqual([2, 3]);
    expect(props.view.getUint8(0)).toBe(4);
    expect(style.nested.threshold).toBe(6);
    expect(props.callback).toBe(callback);
    expect(props.geometry).toBe(geometry);
    expect(Object.isFrozen(props.nested)).toBe(true);
    expect(Object.isFrozen(props.list)).toBe(true);
    expect(Object.isFrozen(props.list[0])).toBe(true);
    expect(Object.isFrozen(style.nested)).toBe(true);
  });

  it('rejects unsupported and cyclic custom snapshot graphs before publication', () => {
    const target = fakeTarget();
    const camera = resolveCamera(undefined, 50, 50);
    const unsupportedLedger = createWebGLPickLedger(50, 50);

    expect(() => recordCustomWebGLPick(unsupportedLedger, {
      camera,
      componentName: 'UnsupportedShape',
      depthMode: 'less-equal',
      model: new Float32Array(16),
      props: { nested: { mutable: new Map([['distance', 1]]) } },
      resolve: () => null,
      sourceOrder: 0,
      style: {},
      target,
    })).toThrowError(/UnsupportedShape.*props\.nested\.mutable.*Map/i);
    expect(unsupportedLedger.entries).toEqual([]);

    const cycleLedger = createWebGLPickLedger(50, 50);
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => recordCustomWebGLPick(cycleLedger, {
      camera,
      componentName: 'CyclicShape',
      depthMode: 'less-equal',
      model: new Float32Array(16),
      props: {},
      resolve: () => null,
      sourceOrder: 0,
      style: { nested: cyclic },
      target,
    })).toThrowError(/CyclicShape.*style\.nested\.self.*cyclic/i);
    expect(cycleLedger.entries).toEqual([]);
  });

  it('rejects binary subclasses without invoking their cloning hooks', () => {
    const externalBuffer = new ArrayBuffer(8);
    let bufferSpeciesCalls = 0;
    class ArrayBufferSubclass extends ArrayBuffer {
      static override get [Symbol.species](): ArrayBufferConstructor {
        bufferSpeciesCalls += 1;
        return class extends ArrayBuffer {
          constructor() {
            super(0);
            return externalBuffer;
          }
        };
      }
    }
    class Uint8ArraySubclass extends Uint8Array {}
    const externalView = new Uint8Array([7, 8]);
    const view = new Uint8ArraySubclass([1, 2]);
    let viewConstructorCalls = 0;
    Object.defineProperty(view, 'constructor', {
      value: class AliasingView {
        constructor() {
          viewConstructorCalls += 1;
          return externalView;
        }
      },
    });
    const camera = resolveCamera(undefined, 50, 50);
    const target = fakeTarget();
    const bufferLedger = createWebGLPickLedger(50, 50);

    expect(() => recordCustomWebGLPick(bufferLedger, {
      camera,
      componentName: 'BinarySubclass',
      depthMode: 'less-equal',
      model: new Float32Array(16),
      props: { buffer: new ArrayBufferSubclass(8) },
      resolve: () => null,
      sourceOrder: 0,
      style: {},
      target,
    })).toThrowError(/BinarySubclass.*props\.buffer.*ArrayBufferSubclass/i);
    expect(bufferSpeciesCalls).toBe(0);
    expect(bufferLedger.entries).toEqual([]);

    const viewLedger = createWebGLPickLedger(50, 50);
    expect(() => recordCustomWebGLPick(viewLedger, {
      camera,
      componentName: 'BinarySubclass',
      depthMode: 'less-equal',
      model: new Float32Array(16),
      props: { view },
      resolve: () => null,
      sourceOrder: 0,
      style: {},
      target,
    })).toThrowError(/BinarySubclass.*props\.view.*Uint8ArraySubclass/i);
    expect(viewConstructorCalls).toBe(0);
    expect(viewLedger.entries).toEqual([]);
  });

  it('records interactive primitives during their one draw traversal only', () => {
    const geometry = createWebGLGeometry({
      positions: [-1, -1, 0, 1, -1, 0, 0, 1, 0],
    });
    const renders: string[] = [];
    const geometryCalls = vi.fn(() => geometry);
    const customResolve = vi.fn((
      _input: CRCWebGLPrimitiveHitInput<{ label: string }, { opacity?: number }>,
    ) => null);
    interface PickStyle extends SystemStyle {
      readonly opacity?: number;
    }
    const Geometry = defineWebGLPrimitive<{ label: string }, PickStyle>(
      function renderGeometry(props) {
        renders.push(props.label);
      },
      { hit: { kind: 'geometry', geometry: geometryCalls } },
    );
    const Custom = defineWebGLPrimitive<{ label: string }, PickStyle>(
      function renderCustom(props) {
        renders.push(props.label);
      },
      { hit: { kind: 'custom', resolve: customResolve } },
    );
    const Decorative = defineWebGLPrimitive<{ label: string }, PickStyle>(
      function renderDecorative(props) {
        renders.push(props.label);
      },
      { hit: { kind: 'none' } },
    );
    const root = createElement(Group3D, {
      style: { translateX: 2, scaleX: -2, scaleY: 3 },
      children: [
        createElement(Geometry, { key: 'visible', label: 'visible' }),
        createElement(Geometry, {
          key: 'opted-out',
          label: 'opted-out',
          pointerEvents: 'none',
        }),
        createElement(Geometry, {
          key: 'zero-opacity',
          label: 'zero-opacity',
          style: { opacity: 0 },
        }),
        createElement(Custom, {
          key: 'custom',
          label: 'custom',
          style: { opacity: 0 },
        }),
        createElement(Decorative, {
          key: 'decorative',
          label: 'decorative',
          pointerEvents: 'none',
        }),
      ],
    });
    const mounted = mountScene(root);

    executeBackendCRC(mounted.mount, root, 10);
    const completed = mounted.driver.takeCompletedFrame();

    expect(renders).toEqual([
      'visible',
      'opted-out',
      'zero-opacity',
      'custom',
      'decorative',
    ]);
    expect(geometryCalls).toHaveBeenCalledTimes(2);
    expect(customResolve).not.toHaveBeenCalled();
    const entries = completed.pickEntries as readonly CRCWebGLPickRecord[];
    expect(entries.map(entry => ({
      kind: entry.kind,
      sourceOrder: entry.sourceOrder,
    }))).toEqual([
      { kind: 'geometry', sourceOrder: 0 },
      { kind: 'geometry', sourceOrder: 1 },
      { kind: 'custom', sourceOrder: 2 },
    ]);
    expect(Array.from(entries[0]!.model)).toEqual([
      -2, 0, 0, 0,
      0, 3, 0, 0,
      0, 0, 1, 0,
      2, 0, 0, 1,
    ]);
    expect(entries.map(entry => entry.target))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ kind: 'target', live: true }),
      ]));
    expect(entries.every(
      entry => entry.target.paintEntry === undefined,
    )).toBe(true);
  });
});

function mountScene(root: CRCNode) {
  const parentCanvas = document.createElement('canvas');
  const parent = crc(parentCanvas, undefined);
  const camera = resolveCamera(undefined, 100, 100);
  const driver = createWebGLBackend({
    gl: createNoopGL(),
    getCamera: () => camera,
    getContextGeneration: () => 1,
  });
  const mount = mountBackendCRC(new OffscreenCanvas(100, 100), root, {
    parent: parentCanvas,
    logicalWidth: 100,
    logicalHeight: 100,
    driver,
  });
  disposals.push(() => {
    mount.dispose();
    parent.dispose();
  });
  return { driver, mount };
}

function fakeTarget(): CRCEventTargetRegistration {
  return { kind: 'target', live: true } as CRCEventTargetRegistration;
}

function createNoopGL(): WebGL2RenderingContext {
  let constant = 1;
  return new Proxy({}, {
    get(target, property) {
      if (typeof property !== 'string') return undefined;
      const record = target as Record<string, unknown>;
      if (!(property in record)) {
        record[property] = /^[A-Z0-9_]+$/.test(property) ? constant++ :
          property === 'getParameter' ? () => 8 : () => undefined;
      }
      return record[property];
    },
  }) as WebGL2RenderingContext;
}
