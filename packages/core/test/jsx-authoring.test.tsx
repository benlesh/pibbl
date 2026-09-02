import {
  createElement,
  crc,
  crcState,
  Group,
  Rectangle,
  Text,
  type CRCController,
  type CRCNode,
  type TextStyle,
} from '@crc/core';
import { userEvent } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface CanvasTraceEntry {
  readonly operation: 'fill' | 'fillText';
  readonly value: string;
  readonly x?: number;
  readonly y?: number;
  readonly fillStyle: string | CanvasGradient | CanvasPattern;
  readonly textAlign?: CanvasTextAlign;
}

const controllers = new Set<CRCController>();

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  for (const controller of controllers) controller.dispose();
  controllers.clear();
  vi.restoreAllMocks();
});

describe('public JSX component authoring', () => {
  it('mounts, updates through an event, preserves source paint order, and disposes', async () => {
    const trace = observeCanvasTrace();

    function Poster(): CRCNode {
      const [message, setMessage] = crcState('HELLO');
      return (
        <Group>
          <Rectangle
            style={{ width: 240, height: 120, fill: '#1f4bd8' }}
            onClick={() => setMessage('CRC')}
          />
          <Text
            style={{
              x: 120,
              y: 48,
              fill: '#fff',
              textAlign: 'center',
            }}
          >
            {message} {0}
          </Text>
        </Group>
      );
    }

    const canvas = createCanvas();
    const controller = crc(canvas, <Poster />);
    controllers.add(controller);
    await nextFrame();

    expect(trace).toEqual([
      {
        operation: 'fill',
        value: 'rectangle',
        fillStyle: '#1f4bd8',
      },
      {
        operation: 'fillText',
        value: 'HELLO 0',
        x: 120,
        y: 48,
        fillStyle: '#ffffff',
        textAlign: 'center',
      },
    ]);

    await userEvent.click(canvas, { position: { x: 20, y: 20 } });
    await nextFrame();
    expect(trace.slice(-2)).toEqual([
      {
        operation: 'fill',
        value: 'rectangle',
        fillStyle: '#1f4bd8',
      },
      {
        operation: 'fillText',
        value: 'CRC 0',
        x: 120,
        y: 48,
        fillStyle: '#ffffff',
        textAlign: 'center',
      },
    ]);

    const settledTrace = trace.slice();
    controller.dispose();
    controllers.delete(controller);
    controller.dispose();
    await userEvent.click(canvas, { position: { x: 20, y: 20 } });
    await nextFrame();
    expect(trace).toEqual(settledTrace);
  });

  it('gives createElement scenes the same semantic Canvas behavior as JSX', async () => {
    const trace = observeCanvasTrace();
    const scene = createElement(Group, null, [
      createElement(Rectangle, {
        style: { width: 240, height: 120, fill: '#1f4bd8' },
      }),
      createElement(
        Text,
        {
          style: {
            x: 120,
            y: 48,
            fill: '#fff',
            textAlign: 'center',
          },
        },
        'HELLO ',
        0,
      ),
    ]);
    const controller = crc(createCanvas(), scene);
    controllers.add(controller);
    await nextFrame();

    expect(trace).toEqual([
      {
        operation: 'fill',
        value: 'rectangle',
        fillStyle: '#1f4bd8',
      },
      {
        operation: 'fillText',
        value: 'HELLO 0',
        x: 120,
        y: 48,
        fillStyle: '#ffffff',
        textAlign: 'center',
      },
    ]);
  });

  it('rejects a CRC element inside Text at runtime', () => {
    let pendingFrame: FrameRequestCallback | undefined;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      pendingFrame = callback;
      return 1;
    });
    const invalid = createElement(
      Text,
      null,
      createElement(Rectangle, {
        style: { width: 10, height: 10 },
      }) as never,
    );
    const controller = crc(createCanvas(), invalid);
    controllers.add(controller);

    expect(() => pendingFrame?.(0)).toThrowError(
      'Text received a CRC element inside textual content as a CRC child.',
    );
  });

  it('types Text content separately from leaf and style input', () => {
    const style: TextStyle = { fill: '#fff' };
    void style;

    // @ts-expect-error TextStyle no longer contains textual content
    const legacyStyle: TextStyle = { text: 'legacy' };
    // @ts-expect-error Rectangle is a leaf and rejects JSX children
    const rectangleWithChild = <Rectangle style={{ width: 10, height: 10 }}>bad</Rectangle>;
    // @ts-expect-error Text rejects CRC elements as textual children
    const textWithElement = <Text><Rectangle style={{ width: 10, height: 10 }} /></Text>;

    expect(legacyStyle).toEqual({ text: 'legacy' });
    expect([rectangleWithChild, textWithElement]).toHaveLength(2);
  });
});

function observeCanvasTrace(): CanvasTraceEntry[] {
  const trace: CanvasTraceEntry[] = [];
  vi.spyOn(CanvasRenderingContext2D.prototype, 'fill')
    .mockImplementation(function (this: CanvasRenderingContext2D) {
      trace.push({
        operation: 'fill',
        value: 'rectangle',
        fillStyle: this.fillStyle,
      });
    });
  vi.spyOn(CanvasRenderingContext2D.prototype, 'fillText')
    .mockImplementation(function (
      this: CanvasRenderingContext2D,
      value: string,
      x: number,
      y: number,
    ) {
      trace.push({
        operation: 'fillText',
        value,
        x,
        y,
        fillStyle: this.fillStyle,
        textAlign: this.textAlign,
      });
    });
  return trace;
}

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 240;
  canvas.height = 120;
  document.body.appendChild(canvas);
  return canvas;
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}
