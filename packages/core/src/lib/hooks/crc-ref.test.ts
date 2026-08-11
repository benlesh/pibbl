import { describe, expect, it, vi } from 'vitest';
import { rect } from '../components/rect';
import { defineComp } from '../define-comp';
import { componentTest } from '../test-utils/component-test';
import { crcRef } from './crc-ref';
import { crcState } from './crc-state';

describe('crcRef', () => {
  it('keeps the reference between renders', async () => {
    const clickableArea = {
      x: 0,
      y: 0,
      width: 50,
      height: 50,
    };

    const clickableCenterPoint = {
      x: clickableArea.x + clickableArea.width / 2,
      y: clickableArea.y + clickableArea.height / 2,
    };

    interface TestComponentProps<T extends object> {
      value: T;
      onCheckRef?: (refValue: T | undefined) => void;
    }

    function TestComponent<T extends object>(props: TestComponentProps<T>) {
      const ref = crcRef<T>();
      const [count, setCount] = crcState(0);

      if (ref.current === undefined) {
        // only set the ref with the first render.
        ref.current = props.value;
      }

      return rect({
        ...clickableArea,
        fillStyle: 'red',
        onClick: () => {
          props.onCheckRef?.(ref.current);
          setCount(count + 1);
        },
      });
    }

    const testComp = defineComp(TestComponent);

    const myReference = { a: 1 };
    const onCheckRef = vi.fn();
    const canvas = await componentTest(testComp({ value: myReference, onCheckRef }));

    await canvas.click({ position: clickableCenterPoint });
    expect(onCheckRef).toHaveBeenCalledWith(myReference);

    await canvas.click({ position: clickableCenterPoint });
    expect(onCheckRef).toHaveBeenCalledWith(myReference);
  });

  it('does not re-render when the ref value changes', async () => {
    const clickableArea = {
      x: 0,
      y: 0,
      width: 50,
      height: 50,
    };

    const clickableCenterPoint = {
      x: clickableArea.x + clickableArea.width / 2,
      y: clickableArea.y + clickableArea.height / 2,
    };

    let renderCount = 0;

    function TestComponent(_props: Record<string, never>) {
      const ref = crcRef<Record<string, number>>({});

      renderCount++;

      return rect({
        ...clickableArea,
        fillStyle: 'red',
        onClick: () => {
          ref.current = { [`newRef${Math.random()}`]: Math.random() };
        },
      });
    }

    const testComp = defineComp(TestComponent);
    const canvas = await componentTest(testComp({}));
    expect(renderCount).toBe(1);

    await canvas.click({ position: clickableCenterPoint });
    expect(renderCount).toBe(1);

    await canvas.click({ position: clickableCenterPoint });
    expect(renderCount).toBe(1);
  });

  it('stores multiple refs', async () => {
    const value1 = { a: 1 };
    const value2 = { b: 2 };
    const onCheckRefs = vi.fn();

    interface TestComponentProps {
      value1: any;
      value2: any;
      onCheckRefs?: (ref1: any, ref2: any) => void;
    }

    const clickableArea = {
      x: 0,
      y: 0,
      width: 50,
      height: 50,
    };

    const clickableCenterPoint = {
      x: clickableArea.x + clickableArea.width / 2,
      y: clickableArea.y + clickableArea.height / 2,
    };

    function TestComponent(props: TestComponentProps) {
      const ref1 = crcRef<any>(props.value1);
      const ref2 = crcRef<any>(props.value2);

      return rect({
        ...clickableArea,
        fillStyle: 'red',
        onClick: () => {
          props.onCheckRefs?.(ref1.current, ref2.current);
        },
      });
    }

    const testComp = defineComp(TestComponent);
    const canvas = await componentTest(testComp({ value1, value2, onCheckRefs }));

    await canvas.click({ position: clickableCenterPoint });
    expect(onCheckRefs).toHaveBeenCalledWith(value1, value2);
  });
});
