import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { crc } from '../crc';
import { defineComp } from '../define-comp';
import { clearSharedState } from '../global-state';
import { crcWhenChanged } from './crc-when-changed';

interface ChangeProbeProps {
  dependency: number;
  setup: (dependency: number) => (() => void) | void;
}

const ChangeProbe = defineComp(({ dependency, setup }: ChangeProbeProps) => {
  crcWhenChanged(() => setup(dependency), [dependency]);
});

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  clearSharedState();
});

describe('crcWhenChanged cleanup ownership', () => {
  it('runs each cleanup exactly once across dependency changes and disposal', async () => {
    const canvas = createCanvas();
    const events: string[] = [];
    const setup = (dependency: number) => {
      events.push(`setup:${dependency}`);
      return () => events.push(`cleanup:${dependency}`);
    };

    const controller = crc(canvas, ChangeProbe({ dependency: 1, setup }));
    await nextFrame();

    crc(canvas, ChangeProbe({ dependency: 2, setup }));
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

    const controller = crc(canvas, ChangeProbe({ dependency: 1, setup }));
    await nextFrame();
    crc(canvas, ChangeProbe({ dependency: 2, setup }));
    await nextFrame();
    crc(canvas, ChangeProbe({ dependency: 3, setup }));
    await nextFrame();
    controller.dispose();

    expect(events).toEqual([
      'setup:1',
      'cleanup:1',
      'setup:2',
      'setup:3',
    ]);
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
