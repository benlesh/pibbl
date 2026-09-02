import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { crc } from '../crc';
import { clearSharedState } from '../global-state';
import { crcWhenChanged } from './crc-when-changed';
import { createElement } from '../element/create-element';

interface ChangeProbeProps {
  dependency: number;
  setup: (dependency: number) => (() => void) | void;
}

const ChangeProbe = ({ dependency, setup }: ChangeProbeProps) => {
  crcWhenChanged(() => setup(dependency), [dependency]);
};

interface LifecycleProbeProps {
  events: string[];
  label: string;
}

const LifecycleProbe = ({ events, label }: LifecycleProbeProps) => {
  crcWhenChanged(() => {
    events.push(`setup:${label}`);
    return () => events.push(`cleanup:${label}`);
  }, []);
};

interface ChildHostProps {
  childLabel?: string;
  events: string[];
}

const ChildHost = ({ childLabel, events }: ChildHostProps) => {
  events.push(`render:host:${childLabel ?? 'empty'}`);
  return childLabel ?
      createElement(LifecycleProbe, { events, key: childLabel, label: childLabel }) :
    undefined;
};

const ReplacementRoot = ({ events }: { events: string[] }) => {
  events.push('render:replacement');
};

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  clearSharedState();
  vi.restoreAllMocks();
});

describe('crcWhenChanged cleanup ownership', () => {
  it('runs each cleanup exactly once across dependency changes and disposal', async () => {
    const canvas = createCanvas();
    const events: string[] = [];
    const setup = (dependency: number) => {
      events.push(`setup:${dependency}`);
      return () => events.push(`cleanup:${dependency}`);
    };

    const controller = crc(canvas, createElement(ChangeProbe, { dependency: 1, setup }));
    await nextFrame();

    crc(canvas, createElement(ChangeProbe, { dependency: 2, setup }));
    await nextFrame();
    expect(events).toEqual(['setup:1', 'cleanup:1', 'setup:2']);

    controller.dispose();
    expect(events).toEqual([
      'setup:1',
      'cleanup:1',
      'setup:2',
      'cleanup:2',
    ]);
  });

  it('forgets an old cleanup when the next callback returns void', async () => {
    const canvas = createCanvas();
    const events: string[] = [];
    const setup = (dependency: number) => {
      events.push(`setup:${dependency}`);
      if (dependency === 1) {
        return () => events.push('cleanup:1');
      }
    };

    const controller = crc(canvas, createElement(ChangeProbe, { dependency: 1, setup }));
    await nextFrame();
    crc(canvas, createElement(ChangeProbe, { dependency: 2, setup }));
    await nextFrame();
    crc(canvas, createElement(ChangeProbe, { dependency: 3, setup }));
    await nextFrame();
    controller.dispose();

    expect(events).toEqual([
      'setup:1',
      'cleanup:1',
      'setup:2',
      'setup:3',
    ]);
  });

  it('keeps the current cleanup when dependencies are unchanged', async () => {
    const canvas = createCanvas();
    const cleanup = vi.fn();
    const setup = vi.fn(() => cleanup);
    const controller = crc(canvas, createElement(ChangeProbe, { dependency: 1, setup }));
    await nextFrame();

    crc(canvas, createElement(ChangeProbe, { dependency: 1, setup }));
    await nextFrame();

    expect(setup).toHaveBeenCalledOnce();
    expect(cleanup).not.toHaveBeenCalled();
    controller.dispose();
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it('reports a throwing cleanup and continues the replacement setup', async () => {
    const canvas = createCanvas();
    const error = new Error('cleanup failed');
    const reportError = vi
      .spyOn(globalThis, 'reportError')
      .mockImplementation(() => {});
    const events: string[] = [];
    const setup = (dependency: number) => {
      events.push(`setup:${dependency}`);
      return () => {
        events.push(`cleanup:${dependency}`);
        if (dependency === 1) throw error;
      };
    };
    const controller = crc(canvas, createElement(ChangeProbe, { dependency: 1, setup }));
    await nextFrame();

    crc(canvas, createElement(ChangeProbe, { dependency: 2, setup }));
    await nextFrame();

    expect(events).toEqual(['setup:1', 'cleanup:1', 'setup:2']);
    expect(reportError).toHaveBeenCalledWith(error);
    controller.dispose();
    expect(events).toEqual([
      'setup:1',
      'cleanup:1',
      'setup:2',
      'cleanup:2',
    ]);
  });

  it('cleans up a removed child after the replacement tree renders', async () => {
    const canvas = createCanvas();
    const events: string[] = [];
    const controller = crc(canvas, createElement(ChildHost, { childLabel: 'child', events }));
    await nextFrame();
    events.length = 0;

    crc(canvas, createElement(ChildHost, { events }));
    await nextFrame();

    expect(events).toEqual(['render:host:empty', 'cleanup:child']);
    controller.dispose();
  });

  it('cleans up the old key after the replacement key mounts', async () => {
    const canvas = createCanvas();
    const events: string[] = [];
    const controller = crc(canvas, createElement(ChildHost, { childLabel: 'old', events }));
    await nextFrame();
    events.length = 0;

    crc(canvas, createElement(ChildHost, { childLabel: 'new', events }));
    await nextFrame();

    expect(events).toEqual([
      'render:host:new',
      'setup:new',
      'cleanup:old',
    ]);
    controller.dispose();
  });

  it('cleans up the old root after the replacement root renders', async () => {
    const canvas = createCanvas();
    const events: string[] = [];
    const controller = crc(canvas, createElement(LifecycleProbe, {
      events,
      label: 'old-root',
    }));
    await nextFrame();
    events.length = 0;

    crc(canvas, createElement(ReplacementRoot, { events }));
    await nextFrame();

    expect(events).toEqual(['render:replacement', 'cleanup:old-root']);
    controller.dispose();
  });
});

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  return canvas;
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}
