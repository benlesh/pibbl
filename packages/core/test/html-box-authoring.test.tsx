import { expect, it } from 'vitest';
import { HtmlBox, createElement, type HtmlBoxEventHandlers, type HtmlMountCallback, type PibblElement } from '@pibbl/core';

it('preserves generic props across JSX and createElement authoring', () => {
  const mount: HtmlMountCallback<{ label: string }> = (_element, initial, signal) => {
    const label: string = initial.label;
    const abort: AbortSignal = signal;
    void label; void abort;
    return next => { const text: string = next.label; void text; };
  };
  const handlers: HtmlBoxEventHandlers = {
    onPointerMove(event) {
      const coordinates: number[] = [event.x, event.y, event.localX, event.localY];
      const original: PointerEvent = event.originalEvent;
      void coordinates; void original;
    },
    onKeyDown(event) {
      const key: string = event.key;
      // @ts-expect-error Keyboard events have no pointer coordinates.
      void event.localX;
      void key;
    },
  };
  const jsx: PibblElement = <HtmlBox data={{ label: 'hello' }} mount={mount} {...handlers} />;
  const plain = createElement(HtmlBox, { data: { label: 'hello' }, mount, ...handlers });
  expect(jsx.type).toBe(HtmlBox); expect(plain.type).toBe(HtmlBox);
  // @ts-expect-error mismatched payload must not widen callback types
  const bad = <HtmlBox data={{ label: 123 }} mount={mount} />;
  // @ts-expect-error createElement must preserve generic payload agreement
  const badPlain = createElement(HtmlBox, { data: { label: 123 }, mount });
  void bad; void badPlain;
});
