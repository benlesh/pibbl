import {
  crc, Path, PathGeometry, Circle, Line, Rectangle, Text,
  flattenPath, flattenPathWang, simplifyPath, simplifyPathRadial, subdividePath, useConst, useSignal, useRef,
  type CRCController, type CRCNode, type CRCPointerEvent,
} from '@crc/core';

function initialPath() {
  const path = new PathGeometry();
  path.moveTo(80, 245);
  path.bezierCurveTo(160, 90, 240, 330, 370, 205);
  path.bezierCurveTo(475, 90, 545, 330, 680, 180);
  return path;
}

/** Apply each operation to the current result, with the original as a reference. */
function PathGeometryStudy() {
  const original = useConst(initialPath);
  const geometry = useSignal(original);
  const operation = useSignal('Original');
  const message = useSignal('Apply an operation. Each click works on the current path.');
  type Handle = 'anchor' | 'first' | 'second' | 'quadratic';
  const drag = useRef<{ pointerId: number; target: CRCPointerEvent['currentTarget']; key: string; dx: number; dy: number } | null>(null);
  const stop = (event: CRCPointerEvent) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    const target = drag.current.target;
    drag.current = null;
    target.releasePointerCapture(event.pointerId);
  };
  const handle = (index: number, kind: Handle, cx: number, cy: number) => {
    const key = `${index}-${kind}`;
    return <Circle key={key}
      style={{ cx, cy, radius: kind === 'anchor' ? 6 : 5, fill: kind === 'anchor' ? '#fffdf6' : '#e9b64f', stroke: kind === 'anchor' ? '#16766d' : '#a97823', strokeWidth: 2, cursor: 'grab' }}
      onPointerDown={event => {
        if (drag.current) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { pointerId: event.pointerId, target: event.currentTarget, key, dx: cx - event.x, dy: cy - event.y };
      }}
      onPointerMove={event => {
        const active = drag.current;
        if (!active || active.pointerId !== event.pointerId || active.key !== key) return;
        const next = geometry.get().clone();
        const segment = next.getSegment(index);
        const px = Math.round(Math.max(25, Math.min(735, event.x + active.dx)));
        const py = Math.round(Math.max(85, Math.min(330, event.y + active.dy)));
        if (kind === 'anchor' && 'x' in segment) next.setSegment(index, { ...segment, x: px, y: py });
        else if (kind === 'first' && segment.type === 'cubic') next.setSegment(index, { ...segment, cp1x: px, cp1y: py });
        else if (kind === 'second' && segment.type === 'cubic') next.setSegment(index, { ...segment, cp2x: px, cp2y: py });
        else if (kind === 'quadratic' && segment.type === 'quadratic') next.setSegment(index, { ...segment, cpx: px, cpy: py });
        geometry.set(next);
        operation.set('Edited');
        message.set('Drag any point, then apply an operation. Reset restores the original.');
      }}
      onPointerUp={stop} onPointerCancel={stop}
      onLostPointerCapture={event => { if (drag.current?.pointerId === event.pointerId) drag.current = null; }}
    />;
  };
  const path = geometry.get();
  const markers: CRCNode[] = [];
  let x = 0, y = 0, anchors = 0, controls = 0, curves = 0, lines = 0;
  const anchor = (index: number, cx: number, cy: number) => {
    anchors++;
    markers.push(handle(index, 'anchor', cx, cy));
  };
  const control = (index: number, kind: Handle, ax: number, ay: number, cx: number, cy: number) => {
    controls++;
    markers.push(<Line style={{ coords: [[ax, ay], [cx, cy]], stroke: '#c9a35e', strokeWidth: 1 }} pointerEvents="none" />);
    markers.push(handle(index, kind, cx, cy));
  };
  let index = 0;
  for (const segment of path) {
    if (segment.type === 'cubic') {
      curves++;
      control(index, 'first', x, y, segment.cp1x, segment.cp1y);
      control(index, 'second', segment.x, segment.y, segment.cp2x, segment.cp2y);
    } else if (segment.type === 'quadratic') {
      curves++;
      control(index, 'quadratic', x, y, segment.cpx, segment.cpy);
    } else if (segment.type === 'line') lines++;
    if ('x' in segment) {
      x = segment.x; y = segment.y;
      anchor(index, x, y);
    }
    index++;
  }
  const apply = (label: string, transform: (value: ReturnType<typeof initialPath>) => ReturnType<typeof initialPath>, explanation: string) => {
    try {
      geometry.set(transform(geometry.get()));
      operation.set(label);
      message.set(explanation);
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      message.set('Point limit reached. Reset to explore again.');
    }
  };
  const button = (left: number, label: string, action: () => void, secondary = false, top = 376) => <>
    <Rectangle style={{ left, top, width: 170, height: 38, fill: secondary ? '#e6e5dd' : '#16766d', cursor: 'pointer' }} onClick={action} />
    <Text style={{ left: left + 85, top: top + 11, textAlign: 'center', font: '600 14px sans-serif', fill: secondary ? '#273e39' : '#ffffff' }} pointerEvents="none">{label}</Text>
  </>;
  return <>
    <Rectangle style={{ width: 760, height: 520, fill: '#fffdf6' }} pointerEvents="none" />
    <Text style={{ left: 25, top: 22, font: '700 24px sans-serif', fill: '#203e38' }} pointerEvents="none">Path playground</Text>
    <Text style={{ left: 25, top: 57, font: '13px sans-serif', fill: '#65736c' }} pointerEvents="none">Drag outlined anchors or gold controls. Gray line: original</Text>
    <Path style={{ d: original, stroke: '#d7dad4', strokeWidth: 7 }} pointerEvents="none" />
    <Path style={{ d: path, stroke: '#16766d', strokeWidth: 2 }} pointerEvents="none" />
    {markers}
    <Text style={{ left: 25, top: 340, font: '600 14px sans-serif', fill: '#203e38' }} pointerEvents="none">
      {`${operation.get()} · ${curves ? `${curves} curves` : `${lines} lines`} · ${anchors} anchors · ${controls} controls`}
    </Text>
    {button(25, 'Flatten', () => apply('Flatten', value => flattenPath(value, { tolerance: 2, maxSegments: 2048 }), 'Curves become straight lines. Maximum deviation: 2 path units.'))}
    {button(205, 'Simplify', () => apply('Simplify', value => simplifyPath(flattenPath(value, { tolerance: 1, maxSegments: 2048 }), { tolerance: 8, maxSegments: 2048 }), 'Remove points within 8 units. Curves are flattened to 1 unit first.'))}
    {button(385, 'Subdivide ×4', () => apply('Subdivide', value => subdividePath(value, { divisions: 4, maxSegments: 2048 }), 'Four pieces per segment. The shape stays the same.'))}
    {button(565, 'Reset', () => {
      geometry.set(original); operation.set('Original');
      message.set('Original restored. Try a different operation.');
    }, true)}
    {button(25, 'Flatten · Wang', () => apply('Wang', value => flattenPathWang(value, { tolerance: 2, maxSegments: 2048 }), 'Wang: uniform curve steps within 2 units. Reset to compare with Flatten.'), false, 420)}
    {button(205, 'Simplify · Radial', () => apply('Radial + DP', value => simplifyPathRadial(flattenPath(value, { tolerance: 1, maxSegments: 2048 }), { tolerance: 8, maxSegments: 2048 }), 'Radial + DP: 8 units total; curves are flattened to 1 unit first.'), false, 420)}
    {button(385, 'Dense preset', () => apply('Dense preset', () => subdividePath(flattenPath(original, { tolerance: 0.5 }), { divisions: 8, maxSegments: 2048 }), 'Dense preset loaded. Compare Simplify and Radial on these points.'), true, 420)}
    <Text style={{ left: 25, top: 481, font: '13px sans-serif', fill: '#65736c' }} pointerEvents="none">{message.get()}</Text>
  </>;
}

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <PathGeometryStudy />);
}
