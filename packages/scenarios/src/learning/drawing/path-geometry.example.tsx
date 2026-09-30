import {
  crc, Path, PathGeometry, Circle, Line, Rectangle, Text,
  toSvgPathData, flattenPath, simplifyPath, subdividePath, useConst, useSignal, useRef,
  type CRCController, type CRCPointerEvent,
} from '@crc/core';

/** Edit original geometry while comparing independent derived geometry. */
function PathGeometryStudy() {
  const geometry = useConst(() => {
    const path = new PathGeometry();
    path.moveTo(80, 280);
    path.bezierCurveTo(150, 100, 290, 100, 360, 280);
    path.closePath();
    return path;
  });
  const generation = useSignal(0);
  const mode = useSignal(0);
  const modes = ['Original', 'Flatten', 'Simplify', 'Subdivide'];
  const hovering = useSignal(false);
  const drag = useRef<{ pointerId: number; control: 1 | 2 } | null>(null);
  generation.get();
  const curve = geometry.getSegment(1);
  if (curve.type !== 'cubic') throw new Error('Expected a cubic segment.');
  const currentMode = mode.get();
  const preview = currentMode === 1 ? flattenPath(geometry, { tolerance: 3 })
    : currentMode === 2 ? simplifyPath(flattenPath(geometry, { tolerance: 0.5 }), { tolerance: 5 })
    : currentMode === 3 ? subdividePath(geometry, { divisions: 4 }) : geometry.clone();
  preview.transform(new DOMMatrix().translate(420, 65).scale(0.65));
  const stop = (event: CRCPointerEvent) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
  const handle = (control: 1 | 2, x: number, y: number) => (
    <Circle
      key={control}
      style={{ cx: x, cy: y, radius: 10, fill: '#f7c948', stroke: '#17211d', strokeWidth: 3, cursor: 'grab' }}
      onPointerDown={event => {
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { pointerId: event.pointerId, control };
      }}
      onPointerMove={event => {
        if (drag.current?.pointerId !== event.pointerId || drag.current.control !== control) return;
        const current = geometry.getSegment(1);
        if (current.type !== 'cubic') return;
        const nextX = Math.round(Math.max(30, Math.min(390, event.x)));
        const nextY = Math.round(Math.max(80, Math.min(320, event.y)));
        geometry.setSegment(1, control === 1
          ? { ...current, cp1x: nextX, cp1y: nextY }
          : { ...current, cp2x: nextX, cp2y: nextY });
        generation.update(value => value + 1);
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={() => { drag.current = null; }}
    />
  );
  return <>
    <Rectangle style={{ width: 760, height: 460, fill: '#f7f0df' }} pointerEvents="none" />
    <Text style={{ left: 30, top: 38, font: '800 24px sans-serif', fill: '#17211d' }} pointerEvents="none">
      EDITABLE PATH GEOMETRY
    </Text>
    <Text style={{ left: 30, top: 63, font: '14px sans-serif', fill: '#44554d' }} pointerEvents="none">
      Drag the gold control points. Hover inside the filled outline.
    </Text>
    <Path style={{ d: geometry, fill: hovering.get() ? '#f0b7ce' : '#74d3ae', stroke: '#17211d', strokeWidth: 3 }}
      onPointerEnter={() => hovering.set(true)} onPointerLeave={() => hovering.set(false)} />
    <Path style={{ d: preview, fill: '#b9c7f3', stroke: '#334f94', strokeWidth: 2 }} pointerEvents="none" />
    <Text style={{ left: 440, top: 300, font: '13px sans-serif', fill: '#334f94' }} pointerEvents="none">
      {`${modes[currentMode]} · ${preview.segmentCount} segments · transformed copy`}
    </Text>
    <Line style={{ coords: [[80, 280], [curve.cp1x, curve.cp1y]], stroke: '#7a877e', strokeWidth: 1 }} pointerEvents="none" />
    <Line style={{ coords: [[360, 280], [curve.cp2x, curve.cp2y]], stroke: '#7a877e', strokeWidth: 1 }} pointerEvents="none" />
    {handle(1, curve.cp1x, curve.cp1y)}
    {handle(2, curve.cp2x, curve.cp2y)}
    <Rectangle style={{ left: 440, top: 315, width: 280, height: 27, fill: '#334f94', cursor: 'pointer' }}
      onClick={() => mode.update(value => (value + 1) % modes.length)} />
    <Text style={{ left: 580, top: 321, textAlign: 'center', font: '13px sans-serif', fill: '#ffffff' }} pointerEvents="none">
      Change operation →
    </Text>
    <Rectangle style={{ left: 20, top: 350, width: 720, height: 90, fill: '#17211d' }} pointerEvents="none" />
    <Text style={{ left: 36, top: 377, font: '700 13px monospace', fill: '#74d3ae' }} pointerEvents="none">
      {`SVG PATH DATA · revision ${geometry.revision}`}
    </Text>
    <Text style={{ left: 36, top: 410, font: '14px monospace', fill: '#fffdf6' }} pointerEvents="none">
      {toSvgPathData(geometry)}
    </Text>
  </>;
}

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <PathGeometryStudy />);
}
