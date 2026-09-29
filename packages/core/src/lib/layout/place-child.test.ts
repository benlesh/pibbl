import { describe, expect, it, vi } from 'vitest';
import { crc } from '../crc';
import { getCRCInstance } from '../global-state';
import { useLayoutBox } from '../hooks/use-layout-box';
import { useRef } from '../hooks/use-ref';
import { useSignal } from '../hooks/use-signal';
import { useReaction } from '../hooks/use-reaction';
import { componentTest } from '../test-utils/component-test';
import type { Length } from '../style/types';
import { Rectangle } from '../components/rect';
import { HorizontalLine } from '../components/horizontal-line';
import { Image } from '../components/img';
import { Layer } from '../components/layer';
import { Text } from '../components/text';
import { VerticalLine } from '../components/vertical-line';
import type { CRCElement, SystemStyle } from '../types';
import {
  createPlacementIdentityHint,
  placeChild,
} from './place-child';
import { createElement } from '../element/create-element';
import { definePrimitive } from '../define-primitive';

describe('layout placement', () => {
  it('publishes a stable local allocation and composes placement into paint and interaction', async () => {
    const boxes: Readonly<{ x: number; y: number; width: number; height: number }>[] = [];
    const transforms: DOMMatrix[] = [];
    const onClick = vi.fn();
    const Probe = definePrimitive<{}>((_props: {}, _style, context) => {
      boxes.push(useLayoutBox());
      transforms.push(context.getTransform());
      return createElement(Rectangle, {
        style: { width: 80, height: 20, fill: 'red' },
        onClick,
      });
    });
    const child = createElement(Probe, { key: 'probe' });
    const element = placeChild({
      element: child,
      box: { x: 40, y: 30, width: 80, height: 20 },
      identityHint: createPlacementIdentityHint(child, 0),
    });

    const canvas = await componentTest(element);
    await canvas.click({ position: { x: 50, y: 35 } });
    crc(canvas.element, element);
    await nextFrame();

    expect(boxes[0]).toEqual({ x: 0, y: 0, width: 80, height: 20 });
    expect(boxes[1]).toBe(boxes[0]);
    expect(transforms[0].e).toBe(40);
    expect(transforms[0].f).toBe(30);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('applies an optional child-space clip to paint and hit testing', async () => {
    const onClick = vi.fn();
    const child = createElement(Rectangle, {
      style: { width: 100, height: 40, fill: 'red' },
      onClick,
    });
    const canvas = await componentTest(placeChild({
      element: child,
      box: { x: 20, y: 10, width: 100, height: 40 },
      clipInChildSpace: { x: 0, y: 0, width: 20, height: 40 },
      identityHint: createPlacementIdentityHint(child, 0),
    }));

    await canvas.click({ position: { x: 30, y: 20 } });
    await canvas.click({ position: { x: 70, y: 20 } });

    expect(onClick).toHaveBeenCalledOnce();
  });

  it('preserves keyed state across reflow', async () => {
    const values: number[] = [];
    const Stateful = (_props: {}) => {
      const value = useSignal(0);
      values.push(value.get());
      return createElement(Rectangle, {
        style: { width: 40, height: 20, fill: 'blue' },
        onClick: () => value.update(old => old + 1),
      });
    };
    const renderAt = (x: number) => {
      const child = createElement(Stateful, { key: 'stable' });
      return placeChild({
        element: child,
        box: { x, y: 10, width: 40, height: 20 },
        identityHint: createPlacementIdentityHint(child, 0),
      });
    };
    const canvas = await componentTest(renderAt(20));
    await canvas.click({ position: { x: 30, y: 15 } });

    crc(canvas.element, renderAt(60));
    await nextFrame();

    expect(values.at(-1)).toBe(1);
  });

  it('keeps unkeyed A/B/A identities when B is inserted or removed', async () => {
    const observations = new Map<string, number>();
    let nextIdentity = 0;
    const A = ({ label }: { label: string }) => {
      const identity = useRef<number>();
      identity.current ??= ++nextIdentity;
      observations.set(label, identity.current);
    };
    const B = (_props: {}) => undefined;
    const Host = ({ includeB }: { includeB: boolean }) => {
      const first = createElement(A, { label: 'first' });
      const middle = createElement(B, {});
      const second = createElement(A, { label: 'second' });
      const children = [
        placeChild({
          element: first,
          box: { x: 0, y: 0, width: 10, height: 10 },
          identityHint: createPlacementIdentityHint(first, 0),
        }),
        ...(includeB ? [placeChild({
          element: middle,
          box: { x: 10, y: 0, width: 10, height: 10 },
          identityHint: createPlacementIdentityHint(middle, 0),
        })] : []),
        placeChild({
          element: second,
          box: { x: 20, y: 0, width: 10, height: 10 },
          identityHint: createPlacementIdentityHint(second, 1),
        }),
      ];
      return children;
    };
    const canvas = await componentTest(createElement(Host, { includeB: false }));
    const initial = new Map(observations);

    crc(canvas.element, createElement(Host, { includeB: true }));
    await nextFrame();
    expect(observations).toEqual(initial);

    crc(canvas.element, createElement(Host, { includeB: false }));
    await nextFrame();
    expect(observations).toEqual(initial);
  });

  it('cleans removed observation ownership and interaction exactly once', async () => {
    const cleanup = vi.fn();
    const Child = (_props: {}) => {
      useLayoutBox();
      useReaction(() => cleanup, []);
      return createElement(Rectangle, {
        style: { width: 20, height: 20, fill: 'red' },
        onClick: () => undefined,
      });
    };
    const Host = ({ show }: { show: boolean }) => {
      if (!show) return;
      const child = createElement(Child, { key: 'owned' });
      return placeChild({
        element: child,
        box: { x: 0, y: 0, width: 20, height: 20 },
        identityHint: createPlacementIdentityHint(child, 0),
      });
    };
    const canvas = await componentTest(createElement(Host, { show: true }));
    expect(getCRCInstance(canvas.element).regions.size).toBe(1);

    crc(canvas.element, createElement(Host, { show: false }));
    await nextFrame();

    expect(cleanup).toHaveBeenCalledOnce();
    expect(getCRCInstance(canvas.element).regions.size).toBe(0);
  });
});

describe('resolved built-in styles', () => {
  it('resolves percentages once against the containing allocation after placement', async () => {
    const observedBoxes: Readonly<{ x: number; y: number; width: number; height: number }>[] = [];
    const Observe = ({ element }: { element: CRCElement<any> }) => {
      observedBoxes.push(useLayoutBox());
      return element;
    };
    const observedRect = createElement(Observe, {
      element: createElement(Rectangle, {
        style: { width: '50%', height: 20, fill: 'red' },
      }),
    });
    const rectCanvas = await componentTest(placeChild({
      element: observedRect,
      box: { x: 0, y: 0, width: 100, height: 20 },
      identityHint: createPlacementIdentityHint(observedRect, 0),
    }), { width: 200, height: 80 });
    expect(observedBoxes[0]).toEqual({ x: 0, y: 0, width: 100, height: 20 });
    expect(rectCanvas.element.getContext('2d')!.getImageData(75, 10, 1, 1).data[3])
      .toBe(255);

    const fillText = vi.spyOn(CanvasRenderingContext2D.prototype, 'fillText');
    const textElement = createElement(Text, {
      style: {
        width: '50%',
        height: 20,
        fit: 'squish',
        fill: 'black',
      },
    }, 'a very wide line of text');
    await componentTest(placeChild({
      element: textElement,
      box: { x: 0, y: 0, width: 100, height: 20 },
      identityHint: createPlacementIdentityHint(textElement, 0),
    }), { width: 200, height: 80 });
    expect(fillText.mock.lastCall?.[3]).toBe(100);

    const onImageClick = vi.fn();
    const imageElement = createElement(Image, {
      style: { src: 'image.png', width: '50%', height: 20 },
      onClick: onImageClick,
    });
    const imageCanvas = await componentTest(placeChild({
      element: imageElement,
      box: { x: 0, y: 0, width: 100, height: 20 },
      identityHint: createPlacementIdentityHint(imageElement, 0),
    }), { width: 200, height: 80 });
    await imageCanvas.click({ position: { x: 75, y: 10 } });
    expect(onImageClick).toHaveBeenCalledOnce();

    const drawImage = vi.spyOn(CanvasRenderingContext2D.prototype, 'drawImage');
    const layerElement = createElement(Layer, {
      style: { width: '50%', height: 20 },
      children: createElement(Rectangle, { style: { width: 10, height: 10, fill: 'blue' } }),
    });
    await componentTest(placeChild({
      element: layerElement,
      box: { x: 0, y: 0, width: 100, height: 20 },
      identityHint: createPlacementIdentityHint(layerElement, 0),
    }), { width: 200, height: 80 });
    const offscreen = drawImage.mock.lastCall?.[0] as OffscreenCanvas;
    expect(offscreen.width).toBe(100);
  });

  it('keeps parent left/top participation separate from line endpoints', async () => {
    const onHorizontalClick = vi.fn();
    const horizontal = createElement(HorizontalLine, {
      style: {
        left: 80,
        top: 30,
        y: 5,
        x1: 0,
        x2: 40,
        stroke: 'black',
        strokeWidth: 2,
        lineInteractionWidth: 10,
      },
      onClick: onHorizontalClick,
    });
    const horizontalCanvas = await componentTest(placeChild({
      element: horizontal,
      box: { x: 50, y: 10, width: 100, height: 40 },
      identityHint: createPlacementIdentityHint(horizontal, 0),
    }), { width: 200, height: 100 });
    await horizontalCanvas.click({ position: { x: 60, y: 15 } });
    expect(onHorizontalClick).toHaveBeenCalledOnce();

    const onVerticalClick = vi.fn();
    const vertical = createElement(VerticalLine, {
      style: {
        left: 70,
        top: 60,
        x: 5,
        y1: 0,
        y2: 40,
        stroke: 'black',
        strokeWidth: 2,
        lineInteractionWidth: 10,
      },
      onClick: onVerticalClick,
    });
    const verticalCanvas = await componentTest(placeChild({
      element: vertical,
      box: { x: 100, y: 10, width: 40, height: 80 },
      identityHint: createPlacementIdentityHint(vertical, 0),
    }), { width: 200, height: 100 });
    await verticalCanvas.click({ position: { x: 105, y: 20 } });
    expect(onVerticalClick).toHaveBeenCalledOnce();
  });

  it('resolves root percentages against intrinsic Canvas allocation', async () => {
    const canvas = await componentTest(createElement(Rectangle, {
      style: {
        left: '10%',
        width: '50%',
        height: 20,
        fill: 'red',
      },
    }), { width: 300, height: 100 });
    const context = canvas.element.getContext('2d')!;

    expect(context.getImageData(31, 10, 1, 1).data[3]).toBe(255);
    expect(context.getImageData(179, 10, 1, 1).data[3]).toBe(255);
    expect(context.getImageData(181, 10, 1, 1).data[3]).toBe(0);
  });

  it('supports typed custom normalization and resolution capabilities', async () => {
    interface ProbeStyle extends SystemStyle {
      width: Length;
    }
    interface NormalizedProbeStyle extends SystemStyle {
      width: Length;
    }
    interface ResolvedProbeStyle extends SystemStyle {
      width: number;
    }
    const widths: number[] = [];
    const Probe = definePrimitive<
      {},
      ProbeStyle,
      NormalizedProbeStyle,
      ResolvedProbeStyle
    >((_props, style) => {
      widths.push(style.width);
    }, {
      normalizeStyle: style => style,
      resolveStyle: (style, context) => ({
        width: typeof style.width === 'number' ? style.width :
          context.allocation.width * Number.parseFloat(style.width) / 100,
      }),
    });

    expect(Object.keys(createElement(Probe, { style: { width: '50%' } }).type))
      .not.toContain('resolveStyle');
    await componentTest(createElement(Probe, { style: { width: '50%' } }), { width: 300 });
    expect(widths).toEqual([150]);
  });

  it('requires percentage-capable resolved schemas to become allocation-free', () => {
    interface PercentageStyle extends SystemStyle {
      radius: `${number}%`;
    }
    interface NumericStyle extends SystemStyle {
      radius: number;
    }

    void definePrimitive<{}, PercentageStyle, PercentageStyle, PercentageStyle>(
      () => undefined,
      // @ts-expect-error the resolved schema still contains allocation syntax
      { resolveStyle: (style: PercentageStyle) => style },
    );
    type UnionResolvedStyle = NumericStyle | PercentageStyle;
    void definePrimitive<
      {},
      PercentageStyle,
      PercentageStyle,
      UnionResolvedStyle
    >(
      () => undefined,
      // @ts-expect-error one resolved union member still contains allocation syntax
      { resolveStyle: (style: PercentageStyle) => style },
    );
    const Resolved = definePrimitive<
      {},
      PercentageStyle,
      PercentageStyle,
      NumericStyle
    >((_props, style) => {
      const radius: number = style.radius;
      void radius;
    }, {
      resolveStyle: style => ({
        radius: Number.parseFloat(style.radius),
      }),
    });

    expect((
      createElement(Resolved, { style: { radius: '50%' } }).props.style as
        { radius: string }
    ).radius).toBe('50%');
  });

  it('preserves explicit opaque built-in style-language strings', async () => {
    const Host = (_props: {}) => [
      createElement(Text, {
        style: {
          width: 100,
          height: 20,
          fill: 'hsl(0 50% 50%)',
        },
      }, '50%'),
      createElement(Image, {
        style: {
          src: 'data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22/%3E',
          width: 10,
          height: 10,
        },
      }),
      createElement(Rectangle, {
        style: {
          width: 10,
          height: 10,
          alignSelf: 'auto',
        },
      }),
    ];
    const canvas = await componentTest(createElement(Host, {}));

    expect(canvas.element).toBeInstanceOf(HTMLCanvasElement);
  });

  // @ts-expect-error local paint offsets do not accept auto
  void createElement(Rectangle, { style: { left: 'auto', width: 20, height: 20 } });
});

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}
