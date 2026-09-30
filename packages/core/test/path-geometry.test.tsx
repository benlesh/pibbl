import { describe, expect, it, vi } from 'vitest';
import {
  Clip,
  Path,
  PathGeometry,
  Rectangle,
  toPath2D,
  toSvgPathData,
  useEventTarget,
  useSignal,
} from '@crc/core';
import mountPathGeometryExample from '../../scenarios/src/learning/drawing/path-geometry.example';
import { componentTest, TestCanvas } from '../src/lib/test-utils/component-test';

function outline() {
  const geometry = new PathGeometry();
  geometry.moveTo(10, 10);
  geometry.bezierCurveTo(10, 30, 30, 30, 30, 10);
  geometry.closePath();
  return geometry;
}

describe('public editable path geometry', () => {
  it('uses one geometry snapshot for Clip paint and hit testing', async () => {
    const geometry = rectangleGeometry(10, 10, 30, 30);
    const onClick = vi.fn();
    const moveTo = vi.spyOn(Path2D.prototype, 'moveTo');
    const lineTo = vi.spyOn(Path2D.prototype, 'lineTo');
    const canvas = await componentTest(
      <Clip style={{ d: geometry }}>
        <Rectangle style={{ width: 60, height: 60, fill: 'blue' }} />
        <Path style={{ d: geometry, fill: 'red' }} onClick={onClick} />
      </Clip>,
    );

    expect(canvas.element.getContext('2d')!.getImageData(20, 20, 1, 1).data[2])
      .toBe(0);
    expect(canvas.element.getContext('2d')!.getImageData(5, 5, 1, 1).data[3])
      .toBe(0);
    await canvas.click({ position: { x: 20, y: 20 } });
    await canvas.click({ position: { x: 5, y: 5 } });
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(moveTo).toHaveBeenCalledTimes(1);
    expect(lineTo).toHaveBeenCalledTimes(3);
  });

  it('snapshots PathGeometry passed to an explicit event target on render', async () => {
    const geometry = rectangleGeometry(0, 0, 20, 20);
    const onClick = vi.fn();
    let refresh!: () => void;
    function Target() {
      const generation = useSignal(0);
      generation.get();
      refresh = () => generation.update(value => value + 1);
      useEventTarget({ onClick }, { path: geometry, fill: true });
      return null;
    }
    const canvas = await componentTest(<Target />);

    await canvas.click({ position: { x: 10, y: 10 } });
    geometry.transform(new DOMMatrix().translate(40, 0));
    await canvas.click({ position: { x: 10, y: 10 } });
    refresh();
    await vi.waitFor(async () => {
      await canvas.click({ position: { x: 50, y: 10 } });
      expect(onClick).toHaveBeenCalledTimes(3);
    });
  });

  it('exports independent snapshots and updates paint and hit geometry together', async () => {
    const geometry = outline();
    const before = toPath2D(geometry);
    const other = toPath2D(geometry);
    expect(other).not.toBe(before);
    other.rect(100, 100, 10, 10);
    const context = document.createElement('canvas').getContext('2d')!;
    expect(context.isPointInPath(before, 105, 105)).toBe(false);
    expect(toSvgPathData(geometry)).toBe('M 10 10 C 10 30 30 30 30 10 Z');
    const onClick = vi.fn();
    let refresh!: () => void;
    function Example() {
      const generation = useSignal(0);
      generation.get();
      refresh = () => generation.update(value => value + 1);
      return <Path style={{ d: geometry, fill: '#ff0000' }} onClick={onClick} />;
    }
    const canvas = await componentTest(<Example />);
    await canvas.click({ position: { x: 20, y: 15 } });
    expect(onClick).toHaveBeenCalledTimes(1);
    const revision = geometry.revision;
    geometry.setSegment(1, {
      type: 'cubic', cp1x: 10, cp1y: 40, cp2x: 30, cp2y: 40, x: 30, y: 10,
    });
    geometry.transform(new DOMMatrix().translate(50, 0));
    expect(geometry.revision).toBeGreaterThan(revision);
    // Mutation alone must not change the last rendered interaction snapshot.
    await canvas.click({ position: { x: 20, y: 15 } });
    expect(onClick).toHaveBeenCalledTimes(2);
    refresh();
    await vi.waitFor(() => {
      expect(Array.from(canvas.element.getContext('2d')!
        .getImageData(70, 15, 1, 1).data)).toEqual([255, 0, 0, 255]);
    });
    await canvas.click({ position: { x: 20, y: 15 } });
    expect(onClick).toHaveBeenCalledTimes(2);
    await canvas.click({ position: { x: 70, y: 15 } });
    expect(onClick).toHaveBeenCalledTimes(3);
    expect(context.isPointInPath(before, 20, 15)).toBe(true);
    const svg = new Path2D(toSvgPathData(geometry));
    expect(context.isPointInPath(svg, 70, 15)).toBe(true);
    expect(context.isPointInPath(svg, 20, 15)).toBe(false);
  });
  it('applies path playground operations and restores original curves on reset', async () => {
    const cubic = vi.spyOn(Path2D.prototype, 'bezierCurveTo');
    const move = vi.spyOn(Path2D.prototype, 'moveTo');
    const drawn: string[] = [];
    const original = CanvasRenderingContext2D.prototype.fillText;
    const text = vi.spyOn(CanvasRenderingContext2D.prototype, 'fillText')
      .mockImplementation(function (this: CanvasRenderingContext2D, value, x, y, maxWidth) {
        drawn.push(value);
        original.call(this, value, x, y, maxWidth);
      });
    const element = document.createElement('canvas');
    element.width = 760;
    element.height = 460;
    document.body.appendChild(element);
    const controller = mountPathGeometryExample(element);
    const canvas = new TestCanvas(element, controller);
    try {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      expect(drawn).toContain('Original · 2 curves · 3 anchors · 4 controls');
      await canvas.mouseDown({ position: { x: 160, y: 90 } });
      await canvas.mouseMove({ position: { x: 180, y: 120 } });
      await canvas.mouseUp({ position: { x: 180, y: 120 } });
      expect(cubic).toHaveBeenCalledWith(180, 120, 240, 330, 370, 205);
      cubic.mockClear();
      await canvas.mouseMove({ position: { x: 200, y: 150 } });
      expect(cubic).not.toHaveBeenCalledWith(200, 150, 240, 330, 370, 205);
      await canvas.mouseMove({ position: { x: 80, y: 245 } });
      await canvas.mouseDown({ position: { x: 80, y: 245 } });
      await canvas.mouseMove({ position: { x: 95, y: 260 } });
      await canvas.mouseUp({ position: { x: 95, y: 260 } });
      expect(move).toHaveBeenCalledWith(95, 260);
      for (const [x, label] of [[100, 'Flatten'], [285, 'Simplify'], [470, 'Subdivide']] as const) {
        drawn.length = 0;
        await canvas.click({ position: { x, y: 395 } });
        expect(drawn.some(value => value.startsWith(`${label} ·`))).toBe(true);
        if (label !== 'Subdivide') expect(drawn.some(value => value.endsWith('0 controls'))).toBe(true);
      }
      drawn.length = 0;
      await canvas.click({ position: { x: 655, y: 395 } });
      expect(drawn).toContain('Original · 2 curves · 3 anchors · 4 controls');
      await canvas.click({ position: { x: 470, y: 395 } });
      expect(drawn).toContain('Subdivide · 8 curves · 9 anchors · 16 controls');

    } finally {
      canvas.dispose();
      text.mockRestore();
      cubic.mockRestore();
      move.mockRestore();
    }
  });

  it('keeps independently scheduled roots on their own consumed revisions', async () => {
    const geometry = rectangleGeometry(0, 0, 20, 20);
    const firstClick = vi.fn(), secondClick = vi.fn();
    let refreshFirst!: () => void;
    function First() {
      const generation = useSignal(0);
      generation.get();
      refreshFirst = () => generation.update(value => value + 1);
      return <Path style={{ d: geometry, fill: 'red' }} onClick={firstClick} />;
    }
    const first = await componentTest(<First />);
    const second = await componentTest(<Path style={{ d: geometry, fill: 'blue' }} onClick={secondClick} />);
    geometry.transform({ e: 50 });
    refreshFirst();
    await vi.waitFor(() => expect(first.element.getContext('2d')!.getImageData(60, 10, 1, 1).data[0]).toBe(255));
    await first.click({ position: { x: 60, y: 10 } });
    await second.click({ position: { x: 10, y: 10 } });
    await second.click({ position: { x: 60, y: 10 } });
    expect(firstClick).toHaveBeenCalledTimes(1);
    expect(secondClick).toHaveBeenCalledTimes(1);
  });

  it('keeps clones independent and rejects invalid edits atomically', () => {
    const geometry = outline();
    const copy = geometry.clone();
    const revision = geometry.revision;
    const svg = toSvgPathData(geometry);
    expect(() => geometry.setSegment(1, { type: 'line', x: NaN, y: 0 })).toThrow();
    expect(() => geometry.transform(new DOMMatrix().rotateAxisAngle(1, 0, 0, 45))).toThrow();
    expect(toSvgPathData(geometry)).toBe(svg);
    expect(geometry.revision).toBe(revision);
    copy.setSegment(1, { type: 'line', x: 50, y: 50 });
    expect(toSvgPathData(copy)).toBe('M 10 10 L 50 50 Z');
    expect(toSvgPathData(geometry)).toBe(svg);
    copy.clear();
    expect(copy.segmentCount).toBe(0);
    expect(toSvgPathData(copy)).toBe('');
  });

});

function rectangleGeometry(x: number, y: number, width: number, height: number) {
  const geometry = new PathGeometry();
  geometry.moveTo(x, y);
  geometry.lineTo(x + width, y);
  geometry.lineTo(x + width, y + height);
  geometry.lineTo(x, y + height);
  geometry.closePath();
  return geometry;
}
