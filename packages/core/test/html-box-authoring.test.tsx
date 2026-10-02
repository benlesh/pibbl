import { expect, it } from 'vitest';
import { HtmlBox, createElement, type HtmlMountCallback, type CRCElement } from '@crc/core';

it('preserves generic props across JSX and createElement authoring', () => {
  const mount: HtmlMountCallback<{ label: string }> = (_element, initial, signal) => {
    const label: string = initial.label;
    const abort: AbortSignal = signal;
    void label; void abort;
    return next => { const text: string = next.label; void text; };
  };
  const jsx: CRCElement = <HtmlBox data={{ label: 'hello' }} mount={mount} />;
  const plain = createElement(HtmlBox, { data: { label: 'hello' }, mount });
  expect(jsx.type).toBe(HtmlBox); expect(plain.type).toBe(HtmlBox);
  // @ts-expect-error mismatched payload must not widen callback types
  const bad = <HtmlBox data={{ label: 123 }} mount={mount} />;
  // @ts-expect-error createElement must preserve generic payload agreement
  const badPlain = createElement(HtmlBox, { data: { label: 123 }, mount });
  void bad; void badPlain;
});
