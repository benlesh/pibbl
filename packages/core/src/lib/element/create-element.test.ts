import { describe, expect, it } from 'vitest';
import {
  createElement,
  type CRCNode,
} from '../../index';

function Card(props: { title?: string; children?: CRCNode }): CRCNode {
  return props.children;
}

describe('createElement', () => {
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
