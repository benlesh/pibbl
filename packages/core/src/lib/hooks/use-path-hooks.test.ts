import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pibbl } from '../pibbl';
import { clearSharedState } from '../global-state';
import { useLinePath } from './use-line-path';
import { useConst } from './use-const';
import { useRectPath } from './use-rect-path';
import { useSvgPath } from './use-svg-path';
import { createElement } from '../element/create-element';

class FakePath2D {
  readonly commands: string[] = [];

  constructor(readonly data?: string) {}

  moveTo(x: number, y: number): void {
    this.commands.push(`moveTo:${x},${y}`);
  }

  lineTo(x: number, y: number): void {
    this.commands.push(`lineTo:${x},${y}`);
  }

  closePath(): void {
    this.commands.push('closePath');
  }

  rect(x: number, y: number, width: number, height: number): void {
    this.commands.push(`rect:${x},${y},${width},${height}`);
  }

  roundRect(
    x: number,
    y: number,
    width: number,
    height: number,
    radii: number | readonly number[],
  ): void {
    this.commands.push(`roundRect:${x},${y},${width},${height},${radii}`);
  }
}

beforeEach(() => {
  document.body.innerHTML = '';
  vi.stubGlobal('Path2D', FakePath2D);
});

afterEach(() => {
  clearSharedState();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('memoized path hooks', () => {
  it('delegates sharp and rounded rectangles and memoizes effective radii', async () => {
    const canvas = createCanvas();
    const paths: FakePath2D[] = [];
    const Probe = ({ phase }: { phase: number }) => {
      paths.push(useRectPath(1, 2, 3, 4, phase === 0 ? {} :
        phase === 1 ? { cornerRadius: 4, cornerRadii: [0, null] } :
          phase === 2 ? { cornerRadii: [0, 4, 4, 4] } :
            { cornerRadii: [0, 4, 3, 4] }) as unknown as FakePath2D);
    };
    const controller = pibbl(canvas, createElement(Probe, { phase: 0 }));
    await nextFrame();
    pibbl(canvas, createElement(Probe, { phase: 1 }));
    await nextFrame();
    pibbl(canvas, createElement(Probe, { phase: 2 }));
    await nextFrame();
    pibbl(canvas, createElement(Probe, { phase: 3 }));
    await nextFrame();

    expect(paths[0].commands).toEqual(['rect:1,2,3,4']);
    expect(paths[1].commands).toEqual(['roundRect:1,2,3,4,0,4,4,4']);
    expect(paths[2]).toBe(paths[1]);
    expect(paths[3]).not.toBe(paths[2]);
    controller.dispose();
  });

  it('rejects invalid direct rounded radii', () => {
    const frames = new ManualFrames();
    const canvas = createCanvas();
    const Probe = () => {
      useRectPath(0, 0, 1, 1, { cornerRadius: -1 });
    };
    const controller = pibbl(canvas, createElement(Probe, {}));
    expect(() => frames.flush()).toThrow(/cornerRadius.*nonnegative/);
    controller.dispose();
    frames.restore();
  });

  it('adjusts the box before delegating rounded radii without changing them', async () => {
    const canvas = createCanvas();
    const paths: FakePath2D[] = [];
    const Probe = () => {
      paths.push(useRectPath(1.2, 2.3, 3.4, 4.5, {
        alignToPixelGrid: 'round',
        lineWidth: 1,
        cornerRadius: 9,
      }) as unknown as FakePath2D);
    };
    const controller = pibbl(canvas, createElement(Probe, {}));
    await nextFrame();

    expect(paths[0].commands).toEqual(['roundRect:0.5,1.5,4,5,9,9,9,9']);
    controller.dispose();
  });

  it('keeps rectangle identity for equal effective geometry and replaces it when geometry changes', async () => {
    const canvas = createCanvas();
    const paths: Path2D[] = [];
    interface RectProbeProps {
      lineWidth?: number;
      width: number;
    }
    const Probe = ({ lineWidth, width }: RectProbeProps) => {
      paths.push(useRectPath(1, 2, width, 4, {
        alignToPixelGrid: 'round',
        lineWidth,
      }));
    };
    const controller = pibbl(canvas, createElement(Probe, { width: 3, lineWidth: 1 }));
    await nextFrame();
    pibbl(canvas, createElement(Probe, { width: 3, lineWidth: 1 }));
    await nextFrame();
    pibbl(canvas, createElement(Probe, { width: 5, lineWidth: 1 }));
    await nextFrame();

    expect(paths[1]).toBe(paths[0]);
    expect(paths[2]).not.toBe(paths[0]);
    controller.dispose();
  });

  it('tracks line coordinates and closePath in the memo identity', async () => {
    const canvas = createCanvas();
    const paths: FakePath2D[] = [];
    interface LineProbeProps {
      closePath: boolean;
      coords: [number, number][];
    }
    const Probe = ({ closePath, coords }: LineProbeProps) => {
      paths.push(useLinePath(coords, { closePath }) as unknown as FakePath2D);
    };
    const controller = pibbl(canvas, createElement(Probe, {
      coords: [[0, 0], [10, 10]],
      closePath: false,
    }));
    await nextFrame();
    pibbl(canvas, createElement(Probe, {
      coords: [[0, 0], [10, 10]],
      closePath: false,
    }));
    await nextFrame();
    pibbl(canvas, createElement(Probe, {
      coords: [[0, 0], [10, 10]],
      closePath: true,
    }));
    await nextFrame();
    pibbl(canvas, createElement(Probe, {
      coords: [[0, 0], [20, 10]],
      closePath: true,
    }));
    await nextFrame();

    expect(paths[1]).toBe(paths[0]);
    expect(paths[2]).not.toBe(paths[0]);
    expect(paths[2].commands).toContain('closePath');
    expect(paths[3]).not.toBe(paths[2]);
    controller.dispose();
  });

  it('memoizes SVG data exactly and delegates parsing to Path2D', async () => {
    const canvas = createCanvas();
    const paths: FakePath2D[] = [];
    const Probe = ({ data }: { data: string }) => {
      paths.push(useSvgPath(data) as unknown as FakePath2D);
    };
    const controller = pibbl(canvas, createElement(Probe, { data: 'M0 0L10 10' }));
    await nextFrame();
    pibbl(canvas, createElement(Probe, { data: 'M0 0L10 10' }));
    await nextFrame();
    pibbl(canvas, createElement(Probe, { data: 'not-pibbl-validated' }));
    await nextFrame();

    expect(paths[1]).toBe(paths[0]);
    expect(paths[2]).not.toBe(paths[0]);
    expect(paths[2].data).toBe('not-pibbl-validated');
    controller.dispose();
  });

  it('propagates Path2D parse failures and recovers on a valid retry', () => {
    class ParsingPath2D extends FakePath2D {
      constructor(data?: string) {
        if (data === 'bad') throw new SyntaxError('invalid SVG path');
        super(data);
      }
    }
    vi.stubGlobal('Path2D', ParsingPath2D);
    const frames = new ManualFrames();
    const canvas = createCanvas();
    const Probe = ({ data }: { data: string }) => {
      useSvgPath(data);
    };
    const controller = pibbl(canvas, createElement(Probe, { data: 'bad' }));
    expect(() => frames.flush()).toThrowError('invalid SVG path');

    pibbl(canvas, createElement(Probe, { data: 'M0 0' }));
    expect(() => frames.flush()).not.toThrow();
    controller.dispose();
    frames.restore();
  });

  it('treats each public memoized path hook as a distinct hook kind', () => {
    const frames = new ManualFrames();
    const canvas = createCanvas();
    const Probe = ({ path }: { path: boolean }) => {
      if (path) useRectPath(0, 0, 1, 1);
      else useConst(() => new Path2D());
    };
    const controller = pibbl(canvas, createElement(Probe, { path: false }));
    frames.flush();
    pibbl(canvas, createElement(Probe, { path: true }));
    expect(() => frames.flush()).toThrowError(/hook order changed/i);
    controller.dispose();
    frames.restore();
  });
});

class ManualFrames {
  private readonly callbacks = new Map<number, FrameRequestCallback>();
  private nextId = 1;
  private readonly request = vi
    .spyOn(globalThis, 'requestAnimationFrame')
    .mockImplementation(callback => {
      const id = this.nextId++;
      this.callbacks.set(id, callback);
      return id;
    });
  private readonly cancel = vi
    .spyOn(globalThis, 'cancelAnimationFrame')
    .mockImplementation(id => {
      this.callbacks.delete(id);
    });

  flush(): void {
    const entry = Array.from(this.callbacks.entries()).at(-1);
    if (!entry) throw new Error('No pending Pibbl frame');
    const [id, callback] = entry;
    this.callbacks.delete(id);
    callback(performance.now());
  }

  restore(): void {
    this.request.mockRestore();
    this.cancel.mockRestore();
  }
}

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  return canvas;
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}
