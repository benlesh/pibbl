import {
  createElement, definePrimitive, Flow, Rectangle, signal,
  type PibblResponsiveStyle, type PibblSizeQuery, type PibblStyleRule,
  type FlowStyle, type SystemStyle, type BoxStyle, type LayoutItemStyle, type SignalValue,
} from '@pibbl/core';

const content = {
  width: '100%', height: 112, direction: 'vertical',
  when: [{ query: { minWidth: 600, maxHeight: 900 }, style: { direction: 'horizontal', gap: signal(12) } }],
} satisfies PibblResponsiveStyle<FlowStyle>;
<Flow children={null} style={content} />;
createElement(Flow, { style: content, children: null });
function Actions(_props: { style?: SignalValue<PibblResponsiveStyle<BoxStyle & LayoutItemStyle> | undefined> }) {
  return <Flow children={null} style={content} />;
}
const outer = signal<PibblResponsiveStyle<BoxStyle & LayoutItemStyle>>({ width: 320, height: 160 });
<Actions style={outer} />;
createElement(Actions, { style: outer });
<Flow children={null} style={signal<PibblResponsiveStyle<FlowStyle> | undefined>(undefined)} />;
<Rectangle style={{ width: 100, height: 40, when: [{ query: { minHeight: 0 }, style: { fill: signal('red') } }] }} />;
// @ts-expect-error Required base width/height cannot be supplied only by a rule.
<Rectangle style={{ when: [{ query: { minWidth: 0 }, style: { width: 100, height: 40 } }] }} />;
// @ts-expect-error Conditions require at least one bound.
const empty: PibblSizeQuery = {};
void empty;
// @ts-expect-error Foreign conditions are outside the closed vocabulary.
const pointer: PibblSizeQuery = { pointer: 'coarse' };
void pointer;
const nested: PibblStyleRule<FlowStyle> = { query: { minHeight: 0 }, style: {
  // @ts-expect-error Nested conditions are forbidden.
  when: [],
} };
void nested;
// @ts-expect-error The list itself is not a signal input.
<Flow children={null} style={{ when: signal([]) }} />;
// @ts-expect-error Thresholds are plain numbers.
<Flow children={null} style={{ when: [{ query: { minWidth: signal(400) }, style: {} }] }} />;
// @ts-expect-error Patch objects are not signal inputs.
<Flow children={null} style={{ when: [{ query: { maxHeight: 300 }, style: signal({ gap: 8 }) }] }} />;
// @ts-expect-error Patch keys remain the receiver's closed style vocabulary.
<Flow children={null} style={{ when: [{ query: { maxWidth: 300 }, style: { fill: 'red' } }] }} />;

interface InvalidSpecified extends SystemStyle { when?: string }
// @ts-expect-error Pibbl: style.when is framework-owned.
definePrimitive<{}, InvalidSpecified>(() => undefined);
interface InvalidNormalized extends SystemStyle { when?: number }
// @ts-expect-error Normalized styles cannot claim framework-owned input names.
definePrimitive<{}, SystemStyle, InvalidNormalized>(() => undefined);
interface InvalidResolved extends SystemStyle { when?: boolean }
// @ts-expect-error Resolved styles cannot claim framework-owned input names.
definePrimitive<{}, SystemStyle, SystemStyle, InvalidResolved>(() => undefined);
type InvalidUnion = SystemStyle | InvalidSpecified;
// @ts-expect-error Every union member must leave when to the framework.
definePrimitive<{}, InvalidUnion>(() => undefined);
// Opaque custom data remains available.
definePrimitive<{}, SystemStyle & { custom?: { when: string } }>(() => undefined);
