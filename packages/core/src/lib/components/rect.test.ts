import { page, userEvent } from '@vitest/browser/context';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { componentTest } from '../test-utils/component-test';
import { takeScreenshot } from '../util/test-utils';
import { rect } from './rect';

describe('rect', () => {
  it('renders a rectangle in browser', async () => {
    await componentTest(rect({
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      fillStyle: 'red',
      strokeStyle: 'black',
      lineWidth: 2,
    }));

    await takeScreenshot(page);
  });

  describe('mouse events', () => {
    it('should allow clicking on the center, and along the border', async () => {
      const onClick = vi.fn();
      const onDblClick = vi.fn();
      const onMouseDown = vi.fn();
      const onMouseUp = vi.fn();
      const onContextMenu = vi.fn();

      const x = 50;
      const y = 50;
      const width = 100;
      const height = 100;
      const lineWidth = 2;
      const centerX = x + width / 2;
      const centerY = y + height / 2;
      const onBorderX = x + width + (lineWidth / 2);
      const onBorderY = y + height + (lineWidth / 2);
      const offRectX = x - 10;
      const offRectY = y - 10;

      const canvas = await componentTest(rect({
        x,
        y,
        width,
        height,
        fillStyle: 'red',
        strokeStyle: 'black',
        lineWidth,
        onClick,
        onDblClick,
        onMouseDown,
        onMouseUp,
        onContextMenu,
      }));

      await canvas.click({ position: { x: offRectX, y: offRectY } });
      expect(onClick).not.toHaveBeenCalled();

      await canvas.click({ position: { x: centerX, y: centerY } });
      expect(onClick).toHaveBeenCalledTimes(1);

      await canvas.click({ position: { x: onBorderX, y: onBorderY } });
      expect(onClick).toHaveBeenCalledTimes(2);

      await canvas.dblClick({ position: { x: offRectX, y: offRectY } });
      expect(onDblClick).not.toHaveBeenCalled();

      await canvas.dblClick({ position: { x: centerX, y: centerY } });
      expect(onDblClick).toHaveBeenCalledTimes(1);

      await canvas.dblClick({ position: { x: onBorderX, y: onBorderY } });
      expect(onDblClick).toHaveBeenCalledTimes(2);

      await canvas.click({ position: { x: offRectX, y: offRectY }, button: 'right' });
      expect(onContextMenu).not.toHaveBeenCalled();

      await canvas.click({ position: { x: centerX, y: centerY }, button: 'right' });
      expect(onContextMenu).toHaveBeenCalledTimes(1);

      await canvas.click({ position: { x: onBorderX, y: onBorderY }, button: 'right' });
      expect(onContextMenu).toHaveBeenCalledTimes(2);
    });

    it('should handle mouse up and down events', async () => {
      const onMouseDown = vi.fn();

      const onMouseUp = vi.fn(() => {
        window.console.log('mouse up');
      });

      const x = 50;
      const y = 50;
      const width = 100;
      const height = 100;
      const lineWidth = 2;
      const centerX = x + width / 2;
      const centerY = y + height / 2;
      const onBorderX = x + width + (lineWidth / 2);
      const onBorderY = y + height + (lineWidth / 2);
      const offRectX = x - 10;
      const offRectY = y - 10;

      const canvas = await componentTest(rect({
        x,
        y,
        width,
        height,
        onMouseDown,
        onMouseUp,
        fillStyle: 'red',
        strokeStyle: 'black',
        lineWidth,
      }));

      await canvas.mouseDown({ position: { x: offRectX, y: offRectY } });
      expect(onMouseDown).not.toHaveBeenCalled();

      await canvas.mouseUp({ position: { x: offRectX, y: offRectY } });
      expect(onMouseUp).not.toHaveBeenCalled();

      await canvas.mouseDown({ position: { x: centerX, y: centerY } });
      expect(onMouseDown).toHaveBeenCalledTimes(1);

      await canvas.mouseUp({ position: { x: centerX, y: centerY } });
      expect(onMouseUp).toHaveBeenCalledTimes(1);

      await canvas.mouseDown({ position: { x: onBorderX, y: onBorderY } });
      expect(onMouseDown).toHaveBeenCalledTimes(2);

      await canvas.mouseUp({ position: { x: onBorderX, y: onBorderY } });
      expect(onMouseUp).toHaveBeenCalledTimes(2);
    });

    it('should handle mouse over and out events for a rect with a border', async () => {
      const onMouseOver = vi.fn();
      const onMouseOut = vi.fn();

      const x = 50;
      const y = 50;
      const width = 100;
      const height = 100;
      const lineWidth = 10;
      const centerX = x + width / 2;
      const centerY = y + height / 2;
      const onBorderX = x - 2;
      const onBorderY = y - 2;

      const canvas = await componentTest(rect({
        x,
        y,
        width,
        height,
        fillStyle: 'red',
        strokeStyle: 'black',
        lineWidth,
        onMouseOver,
        onMouseOut,
      }));

      // start in the corner
      await canvas.mouseMove({ position: { x: 0, y: 0 } });
      expect(onMouseOver).not.toHaveBeenCalled();
      expect(onMouseOut).not.toHaveBeenCalled();

      // move to the border
      await canvas.mouseMove({ position: { x: onBorderX, y: onBorderY } });
      expect(onMouseOver).toHaveBeenCalledTimes(1);
      expect(onMouseOut).not.toHaveBeenCalled();

      // move back to the corner
      await canvas.mouseMove({ position: { x: 0, y: 0 } });
      expect(onMouseOver).toHaveBeenCalledTimes(1);
      expect(onMouseOut).toHaveBeenCalledTimes(1);

      // move to the center
      await canvas.mouseMove({ position: { x: centerX, y: centerY } });
      expect(onMouseOver).toHaveBeenCalledTimes(2);
      expect(onMouseOut).toHaveBeenCalledTimes(1);

      // move back to the corner
      await canvas.mouseMove({ position: { x: 0, y: 0 } });
      expect(onMouseOver).toHaveBeenCalledTimes(2);
      expect(onMouseOut).toHaveBeenCalledTimes(2);
    });

    it('should handle mouse over and mouse out for a rect without a border', async () => {
      const onMouseOver = vi.fn();
      const onMouseOut = vi.fn();
      const x = 50;
      const y = 50;
      const width = 100;
      const height = 100;
      const centerX = x + width / 2;
      const centerY = y + height / 2;

      const canvas = await componentTest(rect({
        x,
        y,
        width,
        height,
        fillStyle: 'red',
        lineWidth: 0,
        onMouseOver,
        onMouseOut,
      }));

      await canvas.mouseMove({ position: { x: 0, y: 0 } });
      expect(onMouseOver).not.toHaveBeenCalled();
      expect(onMouseOut).not.toHaveBeenCalled();

      await canvas.mouseMove({ position: { x: centerX, y: centerY } });
      expect(onMouseOver).toHaveBeenCalledTimes(1);
      expect(onMouseOut).not.toHaveBeenCalled();

      await canvas.mouseMove({ position: { x: 0, y: 0 } });
      expect(onMouseOver).toHaveBeenCalledTimes(1);
      expect(onMouseOut).toHaveBeenCalledTimes(1);
    });

    it('should handle mouse move events', async () => {
      const onMouseMove = vi.fn();
      const x = 50;
      const y = 50;
      const width = 100;
      const height = 100;
      const centerX = x + width / 2;
      const centerY = y + height / 2;

      const canvas = await componentTest(rect({
        x,
        y,
        width,
        height,
        fillStyle: 'red',
        onMouseMove,
      }));

      await canvas.mouseMove({ position: { x: 0, y: 0 } });
      expect(onMouseMove).not.toHaveBeenCalled();

      await canvas.mouseMove({ position: { x: centerX, y: centerY } });
      expect(onMouseMove).toHaveBeenCalledTimes(1);
    });
  });
});
