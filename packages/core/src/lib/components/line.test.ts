import { page } from '@vitest/browser/context';
import { describe, expect, it, vi } from 'vitest';
import { componentTest } from '../test-utils/component-test';
import { takeScreenshot } from '../util/test-utils';
import { g } from './g';
import { line, LineProps } from './line';

// Default test configuration for a diagonal line
const defaultOptions: LineProps = {
  coords: [[50, 50], [150, 150]], // diagonal line from (50,50) to (150,150)
  strokeStyle: 'black',
  lineWidth: 1,
};

describe('line', () => {
  describe('basic rendering', () => {
    it('renders a simple line', async () => {
      await componentTest(line(defaultOptions));
      await takeScreenshot(page);
    });

    // Tests different line styles and configurations
    it('renders lines with different styles', async () => {
      await componentTest(g({ children: [
        // Red line with increased width
        line({
          ...defaultOptions,
          strokeStyle: 'red',
          lineWidth: 2,
        }),
        // Blue line offset to the right
        line({
          ...defaultOptions,
          coords: [[200, 50], [300, 150]],
          strokeStyle: 'blue',
          lineWidth: 4,
        }),
        // Green line with large interaction area
        line({
          ...defaultOptions,
          coords: [[50, 150], [150, 250]],
          strokeStyle: 'green',
          lineWidth: 6,
          lineInteractionWidth: 20, // Creates a wider area for mouse interactions
        }),
      ] }));
      await takeScreenshot(page);
    });

    // Demonstrates complex line rendering capabilities
    it('renders a multi-point line, like a sine wave', async () => {
      await componentTest(line({
        ...defaultOptions,
        strokeStyle: 'lime',
        lineWidth: 3,
        // Generate 100 points following a sine wave pattern
        coords: Array.from({ length: 100 }, (_, i) => [i * 4, Math.sin(i * 0.1) * 100 + 150]),
      }));
      await takeScreenshot(page);
    });
  });

  // Tests mouse interactions without expanded hit area
  it('properly handles mouse click-type events without lineInteractionWidth', async () => {
    const onClick = vi.fn();
    const onDblClick = vi.fn();
    const onContextMenu = vi.fn();

    const canvas = await componentTest(line({
      ...defaultOptions,
      onClick,
      onDblClick,
      onContextMenu,
    }));

    await canvas.click({ position: { x: 100, y: 100 } });
    expect(onClick).toHaveBeenCalledTimes(1);

    await canvas.dblClick({ position: { x: 100, y: 100 } });
    expect(onDblClick).toHaveBeenCalledTimes(1);

    await canvas.click({ position: { x: 100, y: 100 }, button: 'right' });
    expect(onContextMenu).toHaveBeenCalledTimes(1);
  });

  // Tests mouse interactions with expanded hit area
  it('properly handles mouse click-type events with lineInteractionWidth', async () => {
    const onClick = vi.fn();
    const onDblClick = vi.fn();
    const onContextMenu = vi.fn();

    const canvas = await componentTest(line({
      ...defaultOptions,
      lineInteractionWidth: 20,
      onClick,
      onDblClick,
      onContextMenu,
    }));

    await canvas.click({ position: { x: 100, y: 110 } });
    expect(onClick).toHaveBeenCalledTimes(1);

    await canvas.dblClick({ position: { x: 100, y: 110 } });
    expect(onDblClick).toHaveBeenCalledTimes(1);

    await canvas.click({ position: { x: 100, y: 110 }, button: 'right' });
    expect(onContextMenu).toHaveBeenCalledTimes(1);
  });

  // Tests hover behavior with precise hit detection
  it('properly handles mouse movement interactions without lineInteractionWidth', async () => {
    const onMouseOver = vi.fn();
    const onMouseOut = vi.fn();
    const onMouseMove = vi.fn();

    const canvas = await componentTest(line({
      ...defaultOptions,
      onMouseOver,
      onMouseOut,
      onMouseMove,
    }));

    await canvas.mouseMove({ position: { x: 150, y: 0 } });
    expect(onMouseMove).not.toHaveBeenCalled();
    expect(onMouseOver).not.toHaveBeenCalled();
    expect(onMouseOut).not.toHaveBeenCalled();

    await canvas.mouseMove({ position: { x: 100, y: 100 } });
    expect(onMouseMove).toHaveBeenCalledTimes(1);
    expect(onMouseOver).toHaveBeenCalledTimes(1);
    expect(onMouseOut).not.toHaveBeenCalled();

    await canvas.mouseMove({ position: { x: 150, y: 0 } });
    expect(onMouseMove).toHaveBeenCalledTimes(1);
    expect(onMouseOver).toHaveBeenCalledTimes(1);
    expect(onMouseOut).toHaveBeenCalledTimes(1);
  });

  // Tests hover behavior with expanded hit area
  it('properly handles mouse movement interactions with lineInteractionWidth', async () => {
    const onMouseOver = vi.fn();
    const onMouseOut = vi.fn();
    const onMouseMove = vi.fn();

    const canvas = await componentTest(line({
      ...defaultOptions,
      lineInteractionWidth: 20,
      onMouseOver,
      onMouseOut,
      onMouseMove,
    }));

    await canvas.mouseMove({ position: { x: 150, y: 0 } });
    expect(onMouseMove).not.toHaveBeenCalled();
    expect(onMouseOver).not.toHaveBeenCalled();
    expect(onMouseOut).not.toHaveBeenCalled();

    await canvas.mouseMove({ position: { x: 105, y: 95 } });
    expect(onMouseMove).toHaveBeenCalledTimes(1);
    expect(onMouseOver).toHaveBeenCalledTimes(1);
    expect(onMouseOut).not.toHaveBeenCalled();

    await canvas.mouseMove({ position: { x: 150, y: 0 } });
    expect(onMouseMove).toHaveBeenCalledTimes(1);
    expect(onMouseOver).toHaveBeenCalledTimes(1);
    expect(onMouseOut).toHaveBeenCalledTimes(1);
  });
});
