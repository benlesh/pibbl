import { afterEach, describe, expect, it } from 'vitest';
import { installRecordingPath2D } from './recording-path2d.test-util';
import { createSvgPath } from './svg-path';

let recording: ReturnType<typeof installRecordingPath2D> | undefined;

afterEach(() => recording?.restore());

describe('createSvgPath', () => {
  it('forwards SVG data unchanged to a fresh Path2D constructor', () => {
    recording = installRecordingPath2D();
    const first = createSvgPath({ d: 'M0 0L2 2' });
    const second = createSvgPath({ d: 'M0 0L2 2' });

    expect(recording.commands(first)).toEqual([['constructor', 'M0 0L2 2']]);
    expect(second).not.toBe(first);
  });

  it('produces usable closed platform paths after restoring Path2D', () => {
    recording = installRecordingPath2D();
    recording.restore();
    const context = document.createElement('canvas').getContext('2d')!;

    expect(context.isPointInPath(createSvgPath({
      d: 'M0 0H20V20H0Z',
    }), 10, 10)).toBe(true);
  });
});
