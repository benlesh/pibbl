import { describe, expect, it } from 'vitest';
import {
  Arc,
  Circle,
  createElement,
  Ellipse,
  Group,
  Polygon,
  Rectangle,
  Text,
  Wedge,
  type ArcProps,
  type ArcStyle,
  type PibblNode,
  type CircleProps,
  type CircleStyle,
  type EllipseProps,
  type EllipseStyle,
  type PolygonProps,
  type PolygonStyle,
  type WedgeProps,
  type WedgeStyle,
} from '../../index';

function Card(props: { title?: string; children?: PibblNode }): PibblNode {
  return props.children;
}

function KeyedCard(props: { key: string }): PibblNode {
  return props.key;
}

type MixedKeyProps =
  | { kind: 'plain' }
  | { kind: 'keyed'; key: string };
type ValidUnionProps = { kind: 'first' } | { kind: 'second'; title?: string };

function MixedKeyCard(_props: MixedKeyProps): PibblNode {
  return undefined;
}
function ValidUnionCard(_props: ValidUnionProps): PibblNode {
  return undefined;
}

type CustomChild =
  | string
  | { readonly label: string }
  | readonly CustomChild[]
  | Iterable<CustomChild>;

function CustomChildCard(_props: { children?: CustomChild }): PibblNode {
  return undefined;
}

function CustomScalarChild(
  _props: { children?: { readonly label: string } },
): PibblNode {
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
    const firstScalarChild = { label: 'first' };
    const scalar = createElement(
      CustomScalarChild,
      null,
      firstScalarChild,
    );

    // @ts-expect-error containers reject nonzero raw numbers
    createElement(Group, null, 1);
    // @ts-expect-error Text rejects Pibbl element children
    createElement(Text, null, child);
    // @ts-expect-error drawing leaves reject children
    createElement(Rectangle, { style: { width: 10, height: 10 } }, child);
    // @ts-expect-error custom components retain their declared child restriction
    createElement(CustomChildCard, null, 1);
    // @ts-expect-error multiple children become an array that scalar child props reject
    createElement(CustomScalarChild, null, firstScalarChild, { label: 'second' });

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
    expect(scalar.props.children).toBe(firstScalarChild);
  });

  it('types standard-shape styles, props, required geometry, and leaf children', () => {
    const circleStyle: CircleStyle = { radius: 12, fill: '#2563eb' };
    const ellipseStyle: EllipseStyle = { radiusX: 18, radiusY: 9 };
    const arcStyle: ArcStyle = {
      radius: 16,
      startAngle: 0,
      endAngle: Math.PI,
      stroke: '#dc2626',
    };
    const wedgeStyle: WedgeStyle = {
      radius: 20,
      startAngle: 0,
      endAngle: Math.PI / 2,
      fill: '#f97316',
    };
    const polygonStyle: PolygonStyle = {
      coords: [[0, 0], [24, 0], [12, 18]],
      fill: '#16a34a',
    };
    const circleProps: CircleProps = { onClick: () => undefined };
    const ellipseProps: EllipseProps = { onClick: () => undefined };
    const arcProps: ArcProps = { onClick: () => undefined };
    const wedgeProps: WedgeProps = { onClick: () => undefined };
    const polygonProps: PolygonProps = { onClick: () => undefined };

    const shapes = [
      createElement(Circle, { ...circleProps, style: circleStyle }),
      createElement(Ellipse, { ...ellipseProps, style: ellipseStyle }),
      createElement(Arc, { ...arcProps, style: arcStyle }),
      createElement(Wedge, { ...wedgeProps, style: wedgeStyle }),
      createElement(Polygon, { ...polygonProps, style: polygonStyle }),
    ];

    // @ts-expect-error standard shapes are drawing leaves and reject children
    createElement(Circle, { style: circleStyle }, 'bad');
    // @ts-expect-error standard shapes are drawing leaves and reject children
    createElement(Ellipse, { style: ellipseStyle }, 'bad');
    // @ts-expect-error standard shapes are drawing leaves and reject children
    createElement(Arc, { style: arcStyle }, 'bad');
    // @ts-expect-error standard shapes are drawing leaves and reject children
    createElement(Wedge, { style: wedgeStyle }, 'bad');
    // @ts-expect-error standard shapes are drawing leaves and reject children
    createElement(Polygon, { style: polygonStyle }, 'bad');
    // @ts-expect-error Arc is stroke-only and rejects fill paint
    createElement(Arc, { style: { ...arcStyle, fill: 'red' } });
    // @ts-expect-error circular radius excludes auto
    createElement(Circle, { style: { radius: 'auto' } });
    // @ts-expect-error ellipse radii exclude auto
    createElement(Ellipse, { style: { radiusX: 10, radiusY: 'auto' } });
    createElement(Arc, {
      style: {
        // @ts-expect-error Arc radius excludes auto
        radius: 'auto',
        startAngle: 0,
        endAngle: 1,
      },
    });
    createElement(Wedge, {
      style: {
        // @ts-expect-error Wedge radius excludes auto
        radius: 'auto',
        startAngle: 0,
        endAngle: 1,
      },
    });
    // @ts-expect-error Circle requires radius geometry
    createElement(Circle, { style: {} });
    // @ts-expect-error Ellipse requires both radii
    createElement(Ellipse, { style: { radiusX: 10 } });
    // @ts-expect-error Arc requires radius and both angles
    createElement(Arc, { style: { radius: 10 } });
    // @ts-expect-error Wedge requires radius and both angles
    createElement(Wedge, { style: { startAngle: 0, endAngle: 1 } });
    // @ts-expect-error Polygon requires coordinates
    createElement(Polygon, { style: {} });

    expect(shapes).toHaveLength(5);
  });

  it('reserves numeric keys and omits them from delivered prop types', () => {
    const element = createElement(Card, { key: 42, title: 'Pibbl' });
    const nullProps = createElement(Card, null);
    const validUnionNull = createElement(ValidUnionCard, null);
    const validUnionBranch = createElement(ValidUnionCard, { kind: 'second' });
    // @ts-expect-error keys are construction metadata, not component props
    void element.props.key;
    // @ts-expect-error key accepts only string and number values
    createElement(Card, { key: true, title: 'Pibbl' });
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
    const element = createElement(Card, { key: 42, title: 'Pibbl' }, 'child');

    expect(element.type).toBe(Card);
    expect(element.key).toBe('42');
    expect(element.props).toEqual({ title: 'Pibbl', children: 'child' });
    expect('key' in element.props).toBe(false);
    expect((element as { $$typeof?: symbol }).$$typeof)
      .toBe(Symbol.for('@pibbl/core.element'));
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
    props.title = 'Pibbl';

    const defensive = createElement(Card, props);
    const compiler = createElement(Card, { key: 7, title: 'Pibbl' });

    expect(defensive.key).toBe('7');
    expect(compiler.key).toBe('7');
    expect(defensive.props).toEqual({ title: 'Pibbl' });
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
