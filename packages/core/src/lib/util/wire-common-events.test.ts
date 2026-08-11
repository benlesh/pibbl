import { describe, expect, it, vi } from 'vitest';
import { crcCursor } from '../hooks/crc-cursor';
import { crcEvent } from '../hooks/crc-event';
import { CRCBasicMouseEvents, CursorStyleProps } from '../types';
import { wireCommonEvents } from './wire-common-events';

/** I generally prefer not to mock modules _ever_. */
vi.mock('../hooks/crc-event', () => ({
  crcEvent: vi.fn(),
}));

vi.mock('../hooks/crc-cursor', () => ({
  crcCursor: vi.fn(),
}));

describe('wireCommonEvents', () => {
  const path = new Path2D();
  const events = {
    onClick: vi.fn(),
    onContextMenu: vi.fn(),
    onDblClick: vi.fn(),
    onMouseMove: vi.fn(),
    onMouseOut: vi.fn(),
    onMouseOver: vi.fn(),
    onMouseDown: vi.fn(),
    onMouseUp: vi.fn(),
    cursor: 'pointer',
  } satisfies Required<CRCBasicMouseEvents & CursorStyleProps>;

  it('should wire up all mouse events with provided handlers', () => {
    wireCommonEvents(events, path, true, 1);

    // Verify each event is wired up correctly
    expect(crcEvent).toHaveBeenCalledWith('click', events.onClick, path, true, 1);
    expect(crcEvent).toHaveBeenCalledWith('contextmenu', events.onContextMenu, path, true, 1);
    expect(crcEvent).toHaveBeenCalledWith('dblclick', events.onDblClick, path, true, 1);
    expect(crcEvent).toHaveBeenCalledWith('mousemove', events.onMouseMove, path, true, 1);
    expect(crcEvent).toHaveBeenCalledWith('mousedown', events.onMouseDown, path, true, 1);
    expect(crcEvent).toHaveBeenCalledWith('mouseup', events.onMouseUp, path, true, 1);
    expect(crcEvent).toHaveBeenCalledWith('mouseover', events.onMouseOver, path, true, 1);
    expect(crcEvent).toHaveBeenCalledWith('mouseout', events.onMouseOut, path, true, 1);
  });

  it('should wire up cursor style', () => {
    wireCommonEvents(events, path, true, 1);

    expect(crcCursor).toHaveBeenCalledWith({
      path,
      style: 'pointer',
      fill: true,
      lineInteractionWidth: 1,
    });
  });

  it('should handle undefined path', () => {
    wireCommonEvents(events, undefined, true, 1);

    // Verify events are still wired up with undefined path
    expect(crcEvent).toHaveBeenCalledWith('click', events.onClick, undefined, true, 1);
    expect(crcCursor).toHaveBeenCalledWith({
      path: undefined,
      style: 'pointer',
      fill: true,
      lineInteractionWidth: 1,
    });
  });

  it('should handle missing event handlers', () => {
    const minimalProps = {
      cursor: 'pointer',
    } satisfies Required<CursorStyleProps>;

    wireCommonEvents(minimalProps, path, true, 1);

    // Verify crcEvent is called with undefined handlers
    expect(crcEvent).toHaveBeenCalledWith('click', undefined, path, true, 1);
    expect(crcEvent).toHaveBeenCalledWith('contextmenu', undefined, path, true, 1);
  });

  it('should handle missing cursor style', () => {
    const propsWithoutCursor = {
      onClick: vi.fn(),
    } satisfies CRCBasicMouseEvents;

    wireCommonEvents(propsWithoutCursor, path, true, 1);

    expect(crcCursor).toHaveBeenCalledWith({
      path,
      style: undefined,
      fill: true,
      lineInteractionWidth: 1,
    });
  });
});
