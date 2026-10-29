import { beforeEach, describe, expect, it, vi } from 'vitest';

const calculate = vi.fn();
const dispose = vi.fn();
vi.mock('@pibbl/core/internal/layout', () => ({
  createStandaloneLayoutKernel: () => ({ calculate, dispose }),
  prepareStandaloneLayoutKernel: () => Promise.resolve(),
}));

import { createLayoutTree } from '../src/index.js';

beforeEach(() => { calculate.mockReset(); dispose.mockReset(); });

describe('owned standalone layout trees', () => {
  it('copies public input, owns node topology, and publishes immutable changed snapshots', () => {
    calculate.mockImplementation(({ nodes }) => nodes.map((node: { id: number; style: { width?: number } }) => ({ id: node.id, x: node.id === 1 ? 0 : 20, y: 0, width: node.style.width ?? 20, height: 10 })));
    const style = { width: 20, height: 10 } as const;
    const tree = createLayoutTree();
    const root = tree.createNode({ style: { flexDirection: 'row' } });
    const child = tree.createNode({ style });
    tree.appendChild(root, child);
    const first = tree.calculateLayout({ root, width: 100, height: 40 });
    expect(first.getBox(child)).toEqual({ x: 20, y: 0, width: 20, height: 10 });
    expect(first.changes.map(change => change.node)).toEqual([root, child]);
    expect(() => tree.appendChild(child, root)).toThrow(/cycle/);
    tree.setStyle(child, { width: 30 });
    const second = tree.calculateLayout({ root, width: 100, height: 40 });
    expect(second.revision).toBe(2);
    expect(second.changes.map(change => change.node)).toEqual([child]);
    expect(first.getBox(child).width).toBe(20);
    expect(calculate.mock.calls[1]![0].nodes.find((node: { id: number }) => node.id === child.id).style.width).toBe(30);
    tree.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(() => first.getBox(child)).toThrow(/disposed/);
  });

  it('keeps the paired intrinsic callback owned by the node and forwards it without retaining results', () => {
    calculate.mockImplementation(({ nodes }) => nodes.map((node: { id: number }) => ({ id: node.id, x: 0, y: 0, width: 20, height: 10 })));
    const intrinsic = vi.fn(() => ({ minWidth: 12, maxWidth: 30, minHeight: 8, maxHeight: 18 }));
    const tree = createLayoutTree(); const root = tree.createNode({ style: { layout: 'grid', gridTemplateColumns: [20], gridTemplateRows: [10] } }); const child = tree.createNode({ measureIntrinsic: intrinsic });
    tree.appendChild(root, child); tree.calculateLayout({ root, width: 20, height: 10 });
    const sent = calculate.mock.calls[0]![0].nodes.find((node: { id: number }) => node.id === child.id);
    expect(sent.measureIntrinsic).toBe(intrinsic); expect(intrinsic).not.toHaveBeenCalled();
  });

  it('rejects cross-tree and stale ownership before invoking the kernel', () => {
    const first = createLayoutTree(); const second = createLayoutTree();
    const root = first.createNode(); const foreign = second.createNode();
    expect(() => first.appendChild(root, foreign)).toThrow(/another tree/);
    first.dispose();
    expect(() => first.calculateLayout({ root, width: 10, height: 10 })).toThrow(/disposed/);
    expect(calculate).not.toHaveBeenCalled();
  });
});
