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
  it('gives JSX and createElement the same scheduled interactive lifecycle', () => {
    const jsxLifecycle = driveInteractiveScene('jsx');
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    const createElementLifecycle = driveInteractiveScene('createElement');

    expect(createElementLifecycle).toEqual(jsxLifecycle);
    expect(jsxLifecycle).toEqual({
      synchronousMountTrace: [],
      initialFrameTrace: expectedTrace('HELLO'),
      synchronousEventTrace: expectedTrace('HELLO'),
      updatedFrameTrace: [
        ...expectedTrace('HELLO'),
        ...expectedTrace('CRC'),
      ],
      disposedTrace: [
        ...expectedTrace('HELLO'),
        ...expectedTrace('CRC'),
      ],
      pendingFramesAfterDisposal: 0,
    });
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

type AuthoringMode = 'createElement' | 'jsx';

function driveInteractiveScene(authoring: AuthoringMode) {
  const frames = useManualAnimationFrames();
  const trace = observeCanvasTrace();
  const canvas = createCanvas();
  const controller = crc(canvas, interactiveScene(authoring));
  const synchronousMountTrace = trace.slice();

  frames.flushNext();
  const initialFrameTrace = trace.slice();

  dispatchCanvasClick(canvas, 20, 20);
  const synchronousEventTrace = trace.slice();

  frames.flushNext();
  const updatedFrameTrace = trace.slice();

  controller.dispose();
  controller.dispose();
  dispatchCanvasClick(canvas, 20, 20);

  return {
    synchronousMountTrace,
    initialFrameTrace,
    synchronousEventTrace,
    updatedFrameTrace,
    disposedTrace: trace.slice(),
    pendingFramesAfterDisposal: frames.pendingCount(),
  };
}

function interactiveScene(authoring: AuthoringMode): CRCNode {
  function Poster(_props: { readonly children?: never }): CRCNode {
    const [message, setMessage] = crcState('HELLO');
    const rectangleProps = {
      style: { width: 240, height: 120, fill: '#1f4bd8' } as const,
      onClick: () => setMessage('CRC'),
    };
    const textStyle = {
      x: 120,
      y: 48,
      fill: '#fff',
      textAlign: 'center',
    } as const;

    return authoring === 'jsx' ? (
      <Group>
        <Rectangle {...rectangleProps} />
        <Text style={textStyle}>{message} {0}</Text>
      </Group>
    ) : createElement(Group, null, [
      createElement(Rectangle, rectangleProps),
      createElement(Text, { style: textStyle }, message, ' ', 0),
    ]);
  }

  return authoring === 'jsx' ? <Poster /> : createElement(Poster, {});
}

function expectedTrace(message: string): CanvasTraceEntry[] {
  return [
    {
      operation: 'fill',
      value: 'rectangle',
      fillStyle: '#1f4bd8',
    },
    {
      operation: 'fillText',
      value: `${message} 0`,
      x: 120,
      y: 48,
      fillStyle: '#ffffff',
      textAlign: 'center',
    },
  ];
}

function dispatchCanvasClick(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
): void {
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

function useManualAnimationFrames() {
  let nextId = 1;
  const pending = new Map<number, FrameRequestCallback>();
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
    const id = nextId++;
    pending.set(id, callback);
    return id;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => {
    pending.delete(id);
  });

  return {
    flushNext() {
      const next = pending.entries().next().value as
        [number, FrameRequestCallback] | undefined;
      if (!next) throw new Error('Expected a pending animation frame.');
      pending.delete(next[0]);
      next[1](performance.now());
    },
    pendingCount: () => pending.size,
  };
}
