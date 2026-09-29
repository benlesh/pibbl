import { Absolute, Flex, Group, Rectangle, crc, type CRCNode, type CRCController } from '@crc/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { installSchedulerDriverForTest, ManualSchedulerDriver } from '../src/lib/scheduler/testing';

let controller: CRCController | undefined;
let restore: (() => void) | undefined;

afterEach(() => {
  controller?.dispose();
  restore?.();
  document.body.replaceChildren();
});

function mount(node: CRCNode) {
  const driver = new ManualSchedulerDriver();
  restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 120;
  document.body.append(canvas);
  controller = crc(canvas, node, { pixelRatio: 1 });
  driver.flush(1);
  return canvas;
}

describe('component positioning', () => {
  it('positions a standalone Rectangle with left/top for paint and targeting', async () => {
    const onClick = vi.fn();
    const canvas = mount(
      <Group style={{ translateX: 5, translateY: 7 }}>
        <Rectangle style={{ left: 10, top: 20, width: 80, height: 40, fill: '#ff0000' }} onClick={onClick} />
      </Group>,
    );
    const context = canvas.getContext('2d')!;
    expect(Array.from(context.getImageData(15, 27, 1, 1).data)).toEqual([255, 0, 0, 255]);
    expect(Array.from(context.getImageData(14, 27, 1, 1).data)[3]).toBe(0);
    await userEvent.click(canvas, { position: { x: 15, y: 27 } });
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('consumes Absolute left/top once through a forwarding component', () => {
    const Forward = ({ style }: { style: { left: number; top: number; width: number; height: number } }) =>
      <Rectangle style={{ ...style, width: 20, height: 10, fill: '#00ff00' }} />;
    const canvas = mount(
      <Absolute>
        <Forward style={{ left: 30, top: 40, width: 20, height: 10 }} />
      </Absolute>,
    );
    const context = canvas.getContext('2d')!;
    expect(Array.from(context.getImageData(30, 40, 1, 1).data)).toEqual([0, 255, 0, 255]);
    expect(Array.from(context.getImageData(60, 80, 1, 1).data)[3]).toBe(0);
  });

  it('positions a forwarding custom child once through Group and Absolute nested in Flex', () => {
    const Forward = ({ style }: { style: { left: number; top: number; width: number; height: number } }) =>
      <Rectangle style={{ ...style, fill: '#2563eb' }} />;
    const canvas = mount(
      <Flex style={{ width: 220, height: 160 }}>
        <Absolute style={{ width: 220, height: 160, minWidth: 0 }}>
          <Group style={{ translateX: 5, translateY: 7, width: 20, height: 10 }}>
            <Forward style={{ left: 30, top: 40, width: 20, height: 10 }} />
          </Group>
        </Absolute>
      </Flex>,
    );
    const context = canvas.getContext('2d')!;
    expect(Array.from(context.getImageData(35, 47, 1, 1).data)).toEqual([37, 99, 235, 255]);
    expect(Array.from(context.getImageData(65, 87, 1, 1).data)[3]).toBe(0);
  });
});
