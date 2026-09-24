import { definePrimitive, signal, useSignal, type SystemStyle } from '@crc/core';
/** @jsxImportSource @crc/core */
import {
  boxShape2D,
  type CRCPhysicsShape2D,
  withPhysicsShape2D,
} from '../../../2d.js';
import { describe, expect, it, vi } from 'vitest';
import { requireShapeRecord2D } from '../shape-records.js';
import { inferCanvasColliderShape2D } from './inference.js';

describe('withPhysicsShape2D', () => {
  it('returns a distinct primitive with value-owned resolved-style inference and leaves its source untouched', () => {
    interface DiamondStyle extends SystemStyle { readonly size: number; }
    const RawDiamond = definePrimitive<{}, DiamondStyle>(function renderDiamond() {});
    const resolver = vi.fn((style: Readonly<DiamondStyle>) => boxShape2D({
      width: style.size,
      height: style.size,
    }));
    const Diamond = withPhysicsShape2D(RawDiamond, { resolveShape: resolver });

    expect(Diamond).not.toBe(RawDiamond);
    expect(() => inferCanvasColliderShape2D({
      componentType: RawDiamond,
      componentName: 'Diamond',
      style: { size: 8 },
    })).toThrow(/explicit shape/i);
    const shape = inferCanvasColliderShape2D({
      componentType: Diamond,
      componentName: 'Diamond',
      style: { size: 8 },
    });
    expect(requireShapeRecord2D(shape).leaves[0]).toMatchObject({
      kind: 'box', halfWidth: 4, halfHeight: 4,
    });
    expect(resolver).toHaveBeenCalledOnce();
  });

  it('passes an immutable owned style snapshot and rejects mutation, async results, and non-shapes', () => {
    interface ProbeStyle extends SystemStyle { readonly size: number; }
    const Raw = definePrimitive<{}, ProbeStyle>(function renderProbe() {});
    const Mutating = withPhysicsShape2D(Raw, {
      resolveShape(style) {
        (style as { size: number }).size = 99;
        return boxShape2D({ width: 1, height: 1 });
      },
    });
    expect(() => inferCanvasColliderShape2D({
      componentType: Mutating,
      componentName: 'Mutating',
      style: { size: 3 },
    })).toThrow(/mutate|read.?only|extensible|assign/i);

    const Async = withPhysicsShape2D(Raw, {
      resolveShape: (() => Promise.resolve(boxShape2D({ width: 1, height: 1 }))) as unknown as
        (style: Readonly<ProbeStyle>) => CRCPhysicsShape2D,
    });
    expect(() => inferCanvasColliderShape2D({
      componentType: Async,
      componentName: 'Async',
      style: { size: 3 },
    })).toThrow(/synchronous|Promise/i);

    const Invalid = withPhysicsShape2D(Raw, {
      resolveShape: (() => ({})) as unknown as
        (style: Readonly<ProbeStyle>) => CRCPhysicsShape2D,
    });
    expect(() => inferCanvasColliderShape2D({
      componentType: Invalid,
      componentName: 'Invalid',
      style: { size: 3 },
    })).toThrow(/CRC physics 2D shape/i);
  });

  it('rejects hooks and signal writes from a shape resolver', () => {
    interface ProbeStyle extends SystemStyle { readonly size: number; }
    const Raw = definePrimitive<{}, ProbeStyle>(function renderProbe() {});
    const state = signal(1);
    const Writing = withPhysicsShape2D(Raw, {
      resolveShape() {
        state.set(2);
        return boxShape2D({ width: 1, height: 1 });
      },
    });
    expect(() => inferCanvasColliderShape2D({
      componentType: Writing,
      componentName: 'Writing',
      style: { size: 3 },
    })).toThrow(/pure primitive resolver/i);
    expect(state.get()).toBe(1);

    const Hooked = withPhysicsShape2D(Raw, {
      resolveShape() {
        useSignal(1);
        return boxShape2D({ width: 1, height: 1 });
      },
    });
    expect(() => inferCanvasColliderShape2D({
      componentType: Hooked,
      componentName: 'Hooked',
      style: { size: 3 },
    })).toThrow(/hooks can only be called/i);
  });
});
