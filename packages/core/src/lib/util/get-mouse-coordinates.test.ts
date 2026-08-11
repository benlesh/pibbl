import { userEvent } from '@vitest/browser/context';
import { describe, expect, it, vi } from 'vitest';
import { renderDiv, TestDOM } from '../test-utils/component-test';
import { getMouseCoordinates } from './get-mouse-coordinates';

describe('getMouseCoordinates', () => {
  it('should calculate coordinates relative to target element', async () => {
    const div = renderDiv({ width: 200, height: 200 });
    const testDOM = new TestDOM(div);
    const onClick = vi.fn();
    div.addEventListener('click', (event) => {
      expect([event.clientX, event.clientY]).toEqual(getMouseCoordinates(event));
      onClick(getMouseCoordinates(event));
    });

    await testDOM.click({ position: { x: 100, y: 150 } });
    expect(onClick).toHaveBeenCalledWith([100, 150]);
  });

  it('should handle negative coordinates', async () => {
    const div = renderDiv({ width: 200, height: 200 });
    div.style.margin = '50px';
    div.style.padding = '50px';
    const onClick = vi.fn();

    div.addEventListener('click', (event) => {
      onClick(getMouseCoordinates(event));
    });

    await userEvent.click(document.body, { position: { x: 25, y: 25 } });
    expect(onClick).not.toHaveBeenCalled();
    await userEvent.click(document.body, { position: { x: 100, y: 100 } });
    expect(onClick).toHaveBeenCalledWith([50, 100]);
  });

  it('should cache and return same coordinates for same event', async () => {
    const div = renderDiv({ width: 200, height: 200 });
    const testDOM = new TestDOM(div);
    const results: Array<readonly [number, number]> = [];

    div.addEventListener('click', (event) => {
      // Call getMouseCoordinates twice with the same event
      results.push(getMouseCoordinates(event));
      results.push(getMouseCoordinates(event));
    });

    await testDOM.click({ position: { x: 100, y: 150 } });

    // Should be the exact same array reference
    expect(results[0]).toBe(results[1]);
    expect(results[0]).toEqual([100, 150]);
  });

  it('should handle decimal coordinates', async () => {
    const div = renderDiv({
      width: 200,
      height: 200,

    });

    div.style.left = '50.2px';
    div.style.top = '50.3px';
    const testDOM = new TestDOM(div);
    const onClick = vi.fn();

    div.addEventListener('click', (event) => {
      onClick(getMouseCoordinates(event));
    });

    await testDOM.click({ position: { x: 100.5, y: 150.7 } });
    expect(onClick).toHaveBeenCalledWith([100, 150]);
  });

  it('should handle zero bounds', async () => {
    const div = renderDiv({ width: 200, height: 200 });
    const testDOM = new TestDOM(div);
    const onClick = vi.fn();

    div.addEventListener('click', (event) => {
      onClick(getMouseCoordinates(event));
    });

    await testDOM.click({ position: { x: 100, y: 150 } });
    expect(onClick).toHaveBeenCalledWith([100, 150]);
  });
});
