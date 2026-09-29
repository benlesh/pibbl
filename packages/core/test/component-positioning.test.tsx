import { Absolute, Flex, Group, Rectangle, crc, signal, type CRCNode, type CRCController } from '@crc/core';
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

  it('keeps independently authored child offsets after a parent places a function component', () => {
    const authoredStyle = { left: 30, top: 40, width: 30, height: 30 };
    const originalKeys = Reflect.ownKeys(authoredStyle);
    function Card(_props: { style: typeof authoredStyle }) {
      return <Rectangle style={{ left: 5, top: 7, width: 10, height: 10, fill: '#ff0000' }} />;
    }
    const canvas = mount(
      <Absolute>
        <Card style={authoredStyle} />
      </Absolute>,
    );
    const context = canvas.getContext('2d')!;
    expect(Array.from(context.getImageData(35, 47, 1, 1).data)).toEqual([255, 0, 0, 255]);
    expect(Array.from(context.getImageData(30, 40, 1, 1).data)[3]).toBe(0);
    expect(Reflect.ownKeys(authoredStyle)).toEqual(originalKeys);
    expect(authoredStyle).toEqual({ left: 30, top: 40, width: 30, height: 30 });
  });

  it('keeps a forwarded component override relative to its parent placement', () => {
    function Forward({ style }: { style: { left: number; top: number; width: number; height: number } }) {
      return <Rectangle style={{ ...style, left: 5, top: 7, fill: '#2563eb' }} />;
    }
    const canvas = mount(
      <Absolute>
        <Forward style={{ left: 30, top: 40, width: 10, height: 10 }} />
      </Absolute>,
    );
    const context = canvas.getContext('2d')!;
    expect(Array.from(context.getImageData(35, 47, 1, 1).data)).toEqual([37, 99, 235, 255]);
    expect(Array.from(context.getImageData(30, 40, 1, 1).data)[3]).toBe(0);
  });

  it('consumes same-valued offsets through an intentional style spread', () => {
    function Forward({ style }: { style: { left: number; top: number; width: number; height: number } }) {
      return <Rectangle style={{ ...style, left: 30, top: 40, fill: '#00ff00' }} />;
    }
    const canvas = mount(
      <Absolute>
        <Forward style={{ left: 30, top: 40, width: 10, height: 10 }} />
      </Absolute>,
    );
    const context = canvas.getContext('2d')!;
    expect(Array.from(context.getImageData(30, 40, 1, 1).data)).toEqual([0, 255, 0, 255]);
    expect(Array.from(context.getImageData(60, 80, 1, 1).data)[3]).toBe(0);
  });

  it('keeps independently authored same-valued offsets relative to parent placement', () => {
    function Card(_props: { style: { left: number; top: number; width: number; height: number } }) {
      return <Rectangle style={{ left: 30, top: 40, width: 10, height: 10, fill: '#ff0000' }} />;
    }
    const canvas = mount(
      <Absolute>
        <Card style={{ left: 30, top: 40, width: 10, height: 10 }} />
      </Absolute>,
    );
    const context = canvas.getContext('2d')!;
    expect(Array.from(context.getImageData(60, 80, 1, 1).data)).toEqual([255, 0, 0, 255]);
    expect(Array.from(context.getImageData(30, 40, 1, 1).data)[3]).toBe(0);
  });

  it('forwards a placement style signal once without replacing the author signal', () => {
    const authoredStyle = signal({ left: 30, top: 40, width: 10, height: 10, fill: '#ff0000' });
    let received: unknown;
    function Forward({ style }: { style: typeof authoredStyle }) {
      received = style;
      return <Rectangle style={style} />;
    }
    const canvas = mount(
      <Absolute>
        <Forward style={authoredStyle} />
      </Absolute>,
    );
    const context = canvas.getContext('2d')!;
    expect(received).toBe(authoredStyle);
    expect(Array.from(context.getImageData(30, 40, 1, 1).data)[3]).toBe(255);
    expect(Array.from(context.getImageData(60, 80, 1, 1).data)[3]).toBe(0);
  });

  it('consumes a selected responsive placement branch once through a forwarding component', () => {
    const authoredStyle = {
      width: 10,
      height: 10,
      when: [{
        query: { minWidth: 100 },
        style: { left: 30, top: 40 },
      }],
    };
    function Forward({ style }: { style: typeof authoredStyle }) {
      return <Rectangle style={{ ...style, fill: '#00ff00' }} />;
    }
    const canvas = mount(
      <Absolute>
        <Forward style={authoredStyle} />
      </Absolute>,
    );
    const context = canvas.getContext('2d')!;
    expect(Array.from(context.getImageData(30, 40, 1, 1).data)).toEqual([0, 255, 0, 255]);
    expect(Array.from(context.getImageData(60, 80, 1, 1).data)[3]).toBe(0);
  });

  it('compares a forwarded responsive offset with the parent-selected branch', () => {
    const authoredStyle = {
      width: 100,
      height: 10,
      when: [
        { query: { minWidth: 140 }, style: { left: 30, top: 40 } },
        { query: { maxWidth: 120 }, style: { left: 5, top: 7 } },
      ],
    };
    function Forward({ style }: { style: typeof authoredStyle }) {
      return <Rectangle style={{ ...style, fill: '#f59e0b' }} />;
    }
    const canvas = mount(
      <Absolute>
        <Forward style={authoredStyle} />
      </Absolute>,
    );
    const context = canvas.getContext('2d')!;
    expect(Array.from(context.getImageData(35, 47, 1, 1).data)).toEqual([245, 158, 11, 255]);
    expect(Array.from(context.getImageData(30, 40, 1, 1).data)[3]).toBe(0);
  });

  it('compares a forwarded responsive style signal with the parent-selected branch', () => {
    const authoredStyle = signal({
      width: 100,
      height: 10,
      fill: '#f59e0b',
      when: [
        { query: { minWidth: 140 }, style: { left: 30, top: 40 } },
        { query: { maxWidth: 120 }, style: { left: 5, top: 7 } },
      ],
    });
    function Forward({ style }: { style: typeof authoredStyle }) {
      return <Rectangle style={style} />;
    }
    const canvas = mount(
      <Absolute>
        <Forward style={authoredStyle} />
      </Absolute>,
    );
    const context = canvas.getContext('2d')!;
    expect(Array.from(context.getImageData(35, 47, 1, 1).data)).toEqual([245, 158, 11, 255]);
    expect(Array.from(context.getImageData(30, 40, 1, 1).data)[3]).toBe(0);
  });
});
