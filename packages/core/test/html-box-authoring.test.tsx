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

// The existing event vocabulary retains native types and adds local coordinates
// only for the coordinate-bearing families.
const htmlEventAuthoring = <HtmlBox data={1} mount={() => () => undefined}
  onMouseMove={event => { const position: number = event.localX + event.localY + event.x + event.y; void position; const native: MouseEvent = event.originalEvent; void native; }}
  onPointerMove={event => { const pointer: number = event.pointerId; const local: number = event.localX; void pointer; void local; }}
  onKeyDown={event => { const key: string = event.key; void key;
    // @ts-expect-error keyboard events do not invent pointer coordinates
    void event.localX;
  }}
/>;
void htmlEventAuthoring;
