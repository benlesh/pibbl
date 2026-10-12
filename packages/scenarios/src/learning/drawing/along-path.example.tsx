import { pibbl, Circle, Group, Line, Path, PathGeometry, Rectangle, Text, useConst, useRef, useSignal, type PibblController, type PibblPointerEvent, type PathBendAlign, type PathBendBaseline, type PathBendFit, transformPath, arcBendTransform, pathBendTransform } from '@pibbl/core';


interface Controls {
  baseline: PathBendBaseline; align: PathBendAlign; fit: PathBendFit;
  cx: number; cy: number; sweep: number; radius: number; offset: number; normalOffset: number;
  mode: 'arc' | 'path'; c1x: number; c1y: number; c2x: number; c2y: number;
}
const initial: Controls = { baseline: 'center', align: 'center', fit: 'stretch', cx: 400, cy: 430, sweep: Math.PI * 0.8, radius: 190, offset: 0, normalOffset: 0, mode: 'path', c1x: 280, c1y: 230, c2x: 520, c2y: 390 };
const frame = { x: 0, y: -28, width: 280, height: 56 };
const guideArc = (controls: Controls) => ({ cx: controls.cx, cy: controls.cy, radius: controls.radius, startAngle: -Math.PI / 2 - controls.sweep / 2, sweep: controls.sweep });

function originalOutline() {
  const p = new PathGeometry();
  p.moveTo(0, -28);
  p.lineTo(230, -28);
  p.quadraticCurveTo(250, -28, 280, 0);
  p.quadraticCurveTo(250, 28, 230, 28);
  p.lineTo(0, 28);
  p.lineTo(16, 0);
  p.closePath();
  // Opposite-winding cutouts make the thickness and local rotation visible.
  for (const x of [55, 105, 155, 205]) {
    p.moveTo(x - 8, -15); p.lineTo(x - 8, 15);
    p.lineTo(x + 8, 15); p.lineTo(x + 8, -15); p.closePath();
  }
  return p;
}

function bend(source: ReturnType<typeof originalOutline>, controls: Controls) {
  return controls.mode === 'arc'
    ? transformPath(source, arcBendTransform({ source: frame, arc: guideArc(controls), ...controls, overflow: 'extend' }), { ...controls, tolerance: 0.15 })
    : transformPath(source, pathBendTransform({ ...{ source: frame, ...controls, overflow: 'extend' }, guide: guideGeometry(controls) }), { ...controls, tolerance: 0.15 });
}

function guideGeometry(controls: Controls) {
  const guide = new PathGeometry();
  if (controls.mode === 'arc') {
    const arc = guideArc(controls);
    guide.arc(arc.cx, arc.cy, arc.radius, arc.startAngle, arc.startAngle + arc.sweep);
  } else {
    guide.moveTo(180, 330);
    guide.bezierCurveTo(controls.c1x, controls.c1y, controls.c2x, controls.c2y, 620, 310);
  }
  return guide;
}

function Button({ x, y, width, label, action }: { x: number; y: number; width: number; label: string; action: () => void }) {
  return <>
    <Rectangle style={{ left: x, top: y, width, height: 32, fill: '#e9edea', cursor: 'pointer' }} onClick={action} />
    <Text style={{ left: x + width / 2, top: y + 9, textAlign: 'center', font: '13px sans-serif', fill: '#233c35' }} pointerEvents="none">{label}</Text>
  </>;
}

function PathBendingStudy() {
  const source = useConst(originalOutline);
  const first = useConst(() => ({ controls: initial, geometry: bend(source, initial), error: '' }));
  const state = useSignal(first);
  const drag = useRef<{ pointerId: number; control: 1 | 2 | 'center' | 'radius' | 'sweep' } | null>(null);
  const { controls, geometry, error } = state.get();
  const update = (patch: Partial<Controls>) => {
    const previous = state.get();
    const next = { ...previous.controls, ...patch };
    try { state.set({ controls: next, geometry: bend(source, next), error: '' }); }
    catch (cause) { state.set({ controls: previous.controls, geometry: previous.geometry, error: cause instanceof Error ? cause.message : String(cause) }); }
  };
  const guide = guideGeometry(controls);
  const arc = guideArc(controls);
  const baseline = controls.baseline === 'top' ? -28 : controls.baseline === 'bottom' ? 28 : typeof controls.baseline === 'number' ? controls.baseline : 0;
  const presets: PathBendBaseline[] = ['center', 'bottom', 'top', 0];
  const label = controls.baseline === 'bottom' ? 'bottom (above)' : controls.baseline === 'top' ? 'top (below)' : String(controls.baseline);
  const endAngle = arc.startAngle + arc.sweep;
  const endX = controls.mode === 'arc' ? arc.cx + arc.radius * Math.cos(endAngle) : 620;
  const endY = controls.mode === 'arc' ? arc.cy + arc.radius * Math.sin(endAngle) : 310;
  const tangentLength = Math.hypot(620 - controls.c2x, 310 - controls.c2y);
  const tx = controls.mode === 'arc' ? -Math.sin(endAngle) : (620 - controls.c2x) / tangentLength;
  const ty = controls.mode === 'arc' ? Math.cos(endAngle) : (310 - controls.c2y) / tangentLength;
  const stop = (event: PibblPointerEvent) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const handle = (control: 1 | 2 | 'center' | 'radius' | 'sweep', x: number, y: number) => <Circle key={control}
    style={{ cx: x, cy: y, radius: 8, fill: '#eebf4b', stroke: '#173c34', strokeWidth: 2, cursor: 'grab' }}
    onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); drag.current = { pointerId: event.pointerId, control }; }}
    onPointerMove={event => {
      if (drag.current?.pointerId !== event.pointerId || drag.current.control !== control) return;
      if (control === 'center') update({ cx: Math.max(270, Math.min(530, event.x)), cy: Math.max(360, Math.min(435, event.y)) });
      else if (control === 'radius') update({ radius: Math.max(100, Math.min(210, state.get().controls.cy - event.y)) });
      else if (control === 'sweep') {
        const current = state.get().controls;
        const angle = Math.atan2(event.y - current.cy, event.x - current.cx);
        update({ sweep: Math.max(0.7, Math.min(Math.PI * 1.05, 2 * (angle + Math.PI / 2))) });
      } else {
        const x = Math.max(control === 1 ? 200 : 440, Math.min(control === 1 ? 360 : 600, event.x));
        const y = Math.max(220, Math.min(395, event.y));
        update(control === 1 ? { c1x: x, c1y: y } : { c2x: x, c2y: y });
      }
    }}
    onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={() => { drag.current = null; }} />;

  return <>
    <Rectangle style={{ width: 800, height: 620, fill: '#faf8f1' }} pointerEvents="none" />
    <Text style={{ left: 28, top: 28, font: '700 25px sans-serif', fill: '#173c34' }} pointerEvents="none">{controls.mode === 'arc' ? 'ALONG ARC' : 'ALONG PATH'}</Text>
    <Text style={{ left: 772, top: 36, textAlign: 'right', font: '700 12px sans-serif', fill: '#9b7418' }} pointerEvents="none">DRAG THE GOLD HANDLES</Text>
    <Text style={{ left: 28, top: 64, font: '14px sans-serif', fill: '#586b65' }} pointerEvents="none">Bend the whole outline. Choose which source baseline follows the gold guide.</Text>
    <Text style={{ left: 28, top: 108, font: '700 11px sans-serif', fill: '#687b73' }} pointerEvents="none">SOURCE OUTLINE</Text>
    <Group style={{ translateX: 260, translateY: 150 }}>
      <Path style={{ d: source, fill: '#bdd5c8', stroke: '#467366', strokeWidth: 1 }} pointerEvents="none" />
      <Rectangle style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height, stroke: '#9ca9a1', strokeWidth: 1 }} pointerEvents="none" />
      <Line style={{ coords: [[-20, baseline], [300, baseline]], stroke: '#bb8d22', strokeWidth: 2 }} pointerEvents="none" />
    </Group>
    <Text style={{ left: 28, top: 213, font: '700 11px sans-serif', fill: '#687b73' }} pointerEvents="none">BENT GEOMETRY</Text>
    <Path style={{ d: geometry, fill: '#247760', stroke: '#173c34', strokeWidth: 1.5 }} pointerEvents="none" />
    {controls.mode === 'arc' && <>
      <Line style={{ coords: [[arc.cx, arc.cy], [arc.cx, arc.cy - arc.radius]], stroke: '#d7cfb8', strokeWidth: 1 }} pointerEvents="none" />
      {handle('center', arc.cx, arc.cy)}
      {handle('radius', arc.cx, arc.cy - arc.radius)}
      {handle('sweep', endX, endY)}
      <Text style={{ left: arc.cx + 15, top: arc.cy - 4, font: '11px sans-serif', fill: '#9b7418' }} pointerEvents="none">move center</Text>
      <Text style={{ left: arc.cx + 15, top: arc.cy - arc.radius - 18, font: '11px sans-serif', fill: '#9b7418' }} pointerEvents="none">radius</Text>
      <Text style={{ left: endX + 15, top: endY - 4, font: '11px sans-serif', fill: '#9b7418' }} pointerEvents="none">sweep</Text>
    </>}
    {controls.mode === 'path' && <>
      <Line style={{ coords: [[180, 330], [controls.c1x, controls.c1y]], stroke: '#c3c8bf', strokeWidth: 1 }} pointerEvents="none" />
      <Line style={{ coords: [[620, 310], [controls.c2x, controls.c2y]], stroke: '#c3c8bf', strokeWidth: 1 }} pointerEvents="none" />
      {handle(1, controls.c1x, controls.c1y)}
      {handle(2, controls.c2x, controls.c2y)}
    </>}
    <Path style={{ d: guide, stroke: '#c29732', strokeWidth: 2 }} pointerEvents="none" />
    <Line style={{ coords: [[endX - tx * 10 - ty * 5, endY - ty * 10 + tx * 5], [endX, endY], [endX - tx * 10 + ty * 5, endY - ty * 10 - tx * 5]], stroke: '#c29732', strokeWidth: 2 }} pointerEvents="none" />
    <Text style={{ left: 400, top: 445, textAlign: 'center', font: '12px sans-serif', fill: '#586b65' }} pointerEvents="none">
      {`${controls.mode === 'arc' ? `Radius ${Math.round(controls.radius)} · sweep ${Math.round(controls.sweep * 180 / Math.PI)}°` : 'Drag the gold handles'} · offset ${controls.offset} · normal offset ${controls.normalOffset} · ${geometry.segmentCount} segments`}
    </Text>
    <Button x={28} y={459} width={215} label={`Baseline: ${label}`} action={() => update({ baseline: presets[(presets.indexOf(controls.baseline) + 1) % presets.length] })} />
    <Button x={255} y={459} width={200} label={`Fit: ${controls.fit}`} action={() => update({ fit: controls.fit === 'none' ? 'stretch' : 'none' })} />
    <Button x={467} y={459} width={180} label={`Align: ${controls.align}`} action={() => update({ align: controls.align === 'start' ? 'center' : controls.align === 'center' ? 'end' : 'start' })} />
    <Button x={659} y={459} width={113} label={controls.mode === 'arc' ? 'Radius −' : 'Flatten'} action={() => update(controls.mode === 'arc' ? { radius: Math.max(30, controls.radius - 20) } : { c1y: 330, c2y: 310 })} />
    <Button x={28} y={503} width={146} label="Along −20" action={() => update({ offset: controls.offset - 20 })} />
    <Button x={184} y={503} width={146} label="Along +20" action={() => update({ offset: controls.offset + 20 })} />
    <Button x={340} y={503} width={146} label="Normal −10" action={() => update({ normalOffset: controls.normalOffset - 10 })} />
    <Button x={496} y={503} width={151} label="Normal +10" action={() => update({ normalOffset: controls.normalOffset + 10 })} />
    <Button x={659} y={503} width={113} label={controls.mode === 'arc' ? 'Radius +' : 'Curve'} action={() => update(controls.mode === 'arc' ? { radius: controls.radius + 20 } : { c1y: 230, c2y: 390 })} />
    <Button x={659} y={547} width={113} label="Reset" action={() => { drag.current = null; state.set(first); }} />
    <Text style={{ left: 28, top: 555, font: '12px sans-serif', fill: error ? '#a23835' : '#586b65' }} pointerEvents="none">
      {error ? 'Cannot bend — showing the last valid preview.' : controls.mode === 'arc' ? 'Positive normal offset points inward on this clockwise arc.' : 'Guide direction is left to right. Positive normal offset follows its right-hand side.'}
    </Text>
    <Text style={{ left: 28, top: 582, font: '11px sans-serif', fill: '#586b65' }} pointerEvents="none">
      {error || 'Change the baseline, fitting, and alignment. Both modes preserve the original outline.'}
    </Text>
  </>;
}

export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(canvas, <PathBendingStudy />);
}
