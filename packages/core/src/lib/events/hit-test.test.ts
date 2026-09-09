import { describe, expect, it, vi } from 'vitest';
import {
  CRCHitDisposition,
  CRCPaintEntryKind,
  hitTestScratchFactory,
  type CRCNestedPaintEntry,
  type CRCPathPaintEntry,
} from './paint-entry.js';
import {
  resolveCoordinateHit,
  resolveCoordinateTarget,
} from './hit-test.js';
import type {
  CRCEventRoot,
  CRCInstance,
} from '../types.js';
import type { CRCEventTargetRegistration } from './registrations.js';

describe('coordinate hit resolution', () => {
  it('stops at an upper block and mutates the supplied result', () => {
    const lowerResolver = vi.fn();
    const staleTarget = target();
    const { eventRoot } = rootWith([
      resolverEntry(lowerResolver),
      resolverEntry((_x, _y, output) => {
        output.disposition = CRCHitDisposition.Target;
        output.target = target();
      }),
      resolverEntry((_x, _y, output) => {
        output.disposition = CRCHitDisposition.Block;
        output.target = null;
      }),
    ]);
    const input = { rootX: 12, rootY: 18 };
    const output = {
      disposition: CRCHitDisposition.Target,
      target: staleTarget,
    };

    expect(resolveCoordinateHit(eventRoot, input, output)).toBe(output);
    expect(output).toEqual({
      disposition: CRCHitDisposition.Block,
      target: null,
    });
    expect(lowerResolver).not.toHaveBeenCalled();
  });

  it('continues past an upper miss to a lower target', () => {
    const lowerTarget = target();
    const { eventRoot } = rootWith([
      resolverEntry((_x, _y, output) => {
        output.disposition = CRCHitDisposition.Target;
        output.target = lowerTarget;
      }),
      resolverEntry((_x, _y, output) => {
        output.disposition = CRCHitDisposition.Miss;
        output.target = null;
      }),
    ]);
    const output = emptyOutput();

    resolveCoordinateHit(eventRoot, { rootX: 12, rootY: 18 }, output);

    expect(output).toEqual({
      disposition: CRCHitDisposition.Target,
      target: lowerTarget,
    });
  });

  it('stops at the upper target with its exact identity', () => {
    const lowerResolver = vi.fn();
    const upperTarget = target();
    const { eventRoot } = rootWith([
      resolverEntry(lowerResolver),
      resolverEntry((_x, _y, output) => {
        output.disposition = CRCHitDisposition.Target;
        output.target = upperTarget;
      }),
    ]);
    const output = emptyOutput();

    resolveCoordinateHit(eventRoot, { rootX: 12, rootY: 18 }, output);

    expect(output).toEqual({
      disposition: CRCHitDisposition.Target,
      target: upperTarget,
    });
    expect(lowerResolver).not.toHaveBeenCalled();
  });

  it('composes nested Canvas Layer transforms and clips', () => {
    const childTarget = target();
    const child = instanceWith([
      pathEntry(childTarget, rectangle(0, 0, 20, 20)),
    ]);
    const nested: CRCNestedPaintEntry = {
      paintKind: CRCPaintEntryKind.NestedInstance,
      instance: child,
      bounds: rectangle(0, 0, 20, 20),
      transform: new DOMMatrix().translate(10, 10),
      clippingStack: [{
        path: rectangle(0, 0, 10, 20),
        fillRule: 'nonzero',
        transform: new DOMMatrix().translate(10, 10),
      }],
      resolveLocal: undefined,
    };
    const { eventRoot } = rootWith([nested]);

    const hit = emptyOutput();
    resolveCoordinateHit(eventRoot, { rootX: 15, rootY: 15 }, hit);
    expect(hit).toEqual({
      disposition: CRCHitDisposition.Target,
      target: childTarget,
    });

    const clipped = emptyOutput();
    resolveCoordinateHit(eventRoot, { rootX: 25, rootY: 15 }, clipped);
    expect(clipped).toEqual({
      disposition: CRCHitDisposition.Miss,
      target: null,
    });
  });

  it('gives one borrowed output and mapped local point to an upper resolver', () => {
    const received: Array<unknown> = [];
    const resolver = vi.fn((x: number, y: number, output: unknown) => {
      received.push(output);
      (output as ReturnType<typeof emptyOutput>).disposition = CRCHitDisposition.Block;
      (output as ReturnType<typeof emptyOutput>).target = null;
      expect([x, y]).toEqual([2, 3]);
    });
    const { eventRoot } = rootWith([{
      paintKind: CRCPaintEntryKind.Resolver,
      instance: instanceWith([]),
      bounds: rectangle(0, 0, 20, 20),
      transform: new DOMMatrix().translate(10, 15),
      clippingStack: [],
      resolveLocal: resolver,
    }]);
    const output = emptyOutput();

    resolveCoordinateHit(eventRoot, { rootX: 12, rootY: 18 }, output);

    expect(resolver).toHaveBeenCalledTimes(1);
    expect(received).toEqual([output]);
  });

  it('checks each nested Layer boundary clip and bounds once', () => {
    const childTarget = target();
    let child = instanceWith([
      pathEntry(childTarget, rectangle(0, 0, 20, 20)),
    ]);
    const depth = 4;
    for (let level = 0; level < depth; level++) {
      child = instanceWith([{
        paintKind: CRCPaintEntryKind.NestedInstance,
        instance: child,
        bounds: rectangle(0, 0, 20, 20),
        transform: new DOMMatrix(),
        clippingStack: [{
          path: rectangle(0, 0, 20, 20),
          fillRule: 'nonzero',
          transform: new DOMMatrix(),
        }],
        resolveLocal: undefined,
      }]);
    }
    const { eventRoot } = rootWith(Array.from(child.paintEntries));
    const isPointInPath = vi.spyOn(
      CanvasRenderingContext2D.prototype,
      'isPointInPath',
    );
    const output = emptyOutput();

    resolveCoordinateHit(eventRoot, { rootX: 10, rootY: 10 }, output);

    expect(output).toEqual({
      disposition: CRCHitDisposition.Target,
      target: childTarget,
    });
    expect(isPointInPath).toHaveBeenCalledTimes(depth * 2 + 1);
  });

  it('creates one event-root scratch pair for one nested lookup', () => {
    const lowerTarget = target();
    const received: unknown[] = [];
    const lowerResolver = vi.fn((_x: number, _y: number, output: unknown) => {
      received.push(output);
      (output as ReturnType<typeof emptyOutput>).disposition = CRCHitDisposition.Target;
      (output as ReturnType<typeof emptyOutput>).target = lowerTarget;
    });
    const upperResolver = vi.fn((_x: number, _y: number, output: unknown) => {
      received.push(output);
      (output as ReturnType<typeof emptyOutput>).disposition = CRCHitDisposition.Miss;
      (output as ReturnType<typeof emptyOutput>).target = null;
    });
    const { eventRoot } = rootWith([
      resolverEntry(lowerResolver),
      resolverEntry(upperResolver),
    ]);
    const createScratch = vi.spyOn(hitTestScratchFactory, 'create');

    expect(resolveCoordinateTarget(eventRoot, { x: 12, y: 18 })).toBe(lowerTarget);

    expect(createScratch).toHaveBeenCalledTimes(1);
    expect(received).toEqual([
      eventRoot.coordinateHitOutput,
      eventRoot.coordinateHitOutput,
    ]);
    expect(eventRoot.coordinateHitInput).toEqual({ rootX: 12, rootY: 18 });
  });
});

function rootWith(entries: readonly (CRCPathPaintEntry | CRCNestedPaintEntry)[]) {
  const instance = instanceWith(entries);
  const eventRoot = {
    rootInstance: instance,
    canvas: document.createElement('canvas'),
    targets: new Set<CRCEventTargetRegistration>(),
  } as CRCEventRoot;
  attachTargets(instance, eventRoot);
  return { eventRoot, instance };
}

function attachTargets(instance: CRCInstance, eventRoot: CRCEventRoot): void {
  (instance as { eventRoot: CRCEventRoot }).eventRoot = eventRoot;
  for (const entry of instance.paintEntries) {
    if (entry.paintKind === CRCPaintEntryKind.Path) {
      (entry.target as { owner: CRCInstance }).owner = instance;
      (entry.target as { live: boolean }).live = true;
      eventRoot.targets.add(entry.target);
    } else {
      attachTargets(entry.instance, eventRoot);
    }
  }
}

function instanceWith(entries: readonly (CRCPathPaintEntry | CRCNestedPaintEntry)[]) {
  return {
    paintEntries: new Set(entries),
    mainTeardowns: { closed: false },
    surface: { snapshot: {} },
  } as unknown as CRCInstance;
}

function target(): CRCEventTargetRegistration {
  return { kind: 'target', live: true } as CRCEventTargetRegistration;
}

function pathEntry(
  eventTarget: CRCEventTargetRegistration,
  path: Path2D,
): CRCPathPaintEntry {
  return {
    paintKind: CRCPaintEntryKind.Path,
    target: eventTarget,
    path,
    fill: true,
    lineInteractionWidth: 0,
    transform: new DOMMatrix(),
    clippingStack: [],
  };
}

function resolverEntry(
  resolveLocal: NonNullable<CRCNestedPaintEntry['resolveLocal']>,
): CRCNestedPaintEntry {
  return {
    paintKind: CRCPaintEntryKind.Resolver,
    instance: instanceWith([]),
    bounds: rectangle(0, 0, 100, 100),
    transform: new DOMMatrix(),
    clippingStack: [],
    resolveLocal,
  };
}

function rectangle(x: number, y: number, width: number, height: number): Path2D {
  const path = new Path2D();
  path.rect(x, y, width, height);
  return path;
}

function emptyOutput() {
  return {
    disposition: CRCHitDisposition.Miss,
    target: null as CRCEventTargetRegistration | null,
  };
}
