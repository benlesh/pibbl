import { describe, expect, it } from 'vitest';
import {
  createElement,
  Group,
  Rectangle,
  Text,
  type CRCNode,
} from '../../index';

function Card(props: { title?: string; children?: CRCNode }): CRCNode {
  return props.children;
}

function KeyedCard(props: { key: string }): CRCNode {
  return props.key;
}

type MixedKeyProps =
  | { kind: 'plain' }
  | { kind: 'keyed'; key: string };
type ValidUnionProps = { kind: 'first' } | { kind: 'second'; title?: string };

function MixedKeyCard(_props: MixedKeyProps): CRCNode {
  return undefined;
}
function ValidUnionCard(_props: ValidUnionProps): CRCNode {
  return undefined;
}

type CustomChild =
  | string
  | { readonly label: string }
  | readonly CustomChild[]
  | Iterable<CustomChild>;

function CustomChildCard(_props: { children?: CustomChild }): CRCNode {
  return undefined;
}

describe('createElement', () => {
  it('types variadic children from the target component contract', () => {
    const count = 1;
    const text = createElement(
      Text,
      null,
      'Count: ',
      count,
      [' / ', [2]],
      new Set([' total']),
    );
    const child = createElement(Rectangle, {
      style: { width: 10, height: 10 },
    });
    const group = createElement(Group, null, child, [child], new Set([child]));
    const custom = createElement(
      CustomChildCard,
      null,
      { label: 'custom' },
      ['nested'],
      new Set([{ label: 'iterable' }]),
    );

    // @ts-expect-error containers reject nonzero raw numbers
    createElement(Group, null, 1);
    // @ts-expect-error Text rejects CRC element children
    createElement(Text, null, child);
    // @ts-expect-error drawing leaves reject children
    createElement(Rectangle, { style: { width: 10, height: 10 } }, child);
    // @ts-expect-error custom components retain their declared child restriction
    createElement(CustomChildCard, null, 1);

    expect(text.props.children).toEqual([
      'Count: ',
      1,
      [' / ', [2]],
      new Set([' total']),
    ]);
    expect(group.props.children).toEqual([child, [child], new Set([child])]);
    expect(custom.props.children).toEqual([
      { label: 'custom' },
      ['nested'],
      new Set([{ label: 'iterable' }]),
    ]);
  });

  it('reserves numeric keys and omits them from delivered prop types', () => {
    const element = createElement(Card, { key: 42, title: 'CRC' });
    const nullProps = createElement(Card, null);
    const validUnionNull = createElement(ValidUnionCard, null);
    const validUnionBranch = createElement(ValidUnionCard, { kind: 'second' });
    // @ts-expect-error keys are construction metadata, not component props
    void element.props.key;
    // @ts-expect-error key accepts only string and number values
    createElement(Card, { key: true, title: 'CRC' });
    // @ts-expect-error component props may not declare the reserved key field
    createElement(KeyedCard, null);
    // @ts-expect-error a key in any union member remains reserved
    createElement(MixedKeyCard, null);

    expect(element.key).toBe('42');
    expect(nullProps.props).toEqual({});
    expect(validUnionNull.props).toEqual({});
    expect(validUnionBranch.props).toEqual({ kind: 'second' });
    expect('key' in element.props).toBe(false);
  });

  it('creates a branded immutable descriptor with a normalized key', () => {
    const element = createElement(Card, { key: 42, title: 'CRC' }, 'child');

    expect(element.type).toBe(Card);
    expect(element.key).toBe('42');
    expect(element.props).toEqual({ title: 'CRC', children: 'child' });
    expect('key' in element.props).toBe(false);
    expect((element as { $$typeof?: symbol }).$$typeof)
      .toBe(Symbol.for('@crc/core.element'));
    expect(Object.keys(element)).toEqual(['type', 'props', 'key']);
    expect(Object.isFrozen(element)).toBe(import.meta.env.DEV);
    expect(Object.isFrozen(element.props)).toBe(import.meta.env.DEV);
  });

  it('accepts null props and preserves explicitly supplied children without variadic children', () => {
    const empty = createElement(Card, null);
    const supplied = createElement(Card, { children: 'supplied' });

    expect(empty.props).toEqual({});
    expect(supplied.props).toEqual({ children: 'supplied' });
  });

  it('uses one child directly and multiple children as an array over props children', () => {
    const one = createElement(Card, { children: 'supplied' }, 'one');
    const many = createElement(Card, { children: 'supplied' }, 'one', 'two');

    expect(one.props).toEqual({ children: 'one' });
    expect(many.props).toEqual({ children: ['one', 'two'] });
  });

  it('defensively removes a props key while preferring a compiler key', () => {
    const props = Object.create({ inherited: 'kept' }) as {
      key: number;
      title: string;
    };
    props.key = 7;
    props.title = 'CRC';

    const defensive = createElement(Card, props);
    const compiler = createElement(Card, { key: 7, title: 'CRC' });

    expect(defensive.key).toBe('7');
    expect(compiler.key).toBe('7');
    expect(defensive.props).toEqual({ title: 'CRC' });
    expect('key' in defensive.props).toBe(false);
  });

  it('shallowly copies and freezes synthetic props without freezing nested author objects', () => {
    const nested = { mutable: true };
    const props = { title: 'before', nested };
    const element = createElement(Card, props);
    props.title = 'after';
    nested.mutable = false;

    expect(element.props).toEqual({ title: 'before', nested: { mutable: false } });
    expect(element.props).not.toBe(props);
    expect((element.props as typeof props).nested).toBe(nested);
    expect(Object.isFrozen(nested)).toBe(false);
  });
});
