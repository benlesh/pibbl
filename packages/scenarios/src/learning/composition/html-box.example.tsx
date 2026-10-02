import { crc, HtmlBox, Group, Clip, FocusManagement, Rectangle, Text, Path, PathGeometry, useSignal, useConst, usePlayback, repeat, sequence, wait, track, tween, type CRCController, type HtmlMountCallback } from '@crc/core';

interface InputBox { readonly x: number; readonly y: number; readonly width: number; readonly height: number; }
interface EditorData {
  readonly title: string;
  readonly onInputHover: (box: InputBox | null) => void;
}

const mountEditor: HtmlMountCallback<EditorData> = (element, initial, signal) => {
  // Keep the supplied positioned DIV as the input's offsetParent. Its native
  // layout offsets include this padding, without any screen-space transform.
  element.style.cssText += ';padding:22px;font:15px system-ui;color:#d9edf7';
  let current = initial;
  let hovered = false;
  const label = document.createElement('label');
  label.style.cssText = 'display:grid;gap:10px;font-weight:650';
  const caption = document.createElement('span'); caption.textContent = current.title;
  const input = document.createElement('input'); input.placeholder = 'Hover here to charge the field';
  input.style.cssText = 'width:100%;padding:10px;border:1px solid #6187a6;border-radius:6px;font:inherit;box-sizing:border-box;background:#091725;color:#edfaff;outline-color:#94e8ff';
  label.append(caption, input);
  const button = document.createElement('button'); button.textContent = 'Native clicks: 0';
  button.style.cssText = 'margin-top:15px;padding:10px 16px;background:#203c52;color:#e0f3ff;border:1px solid #37576e;border-radius:5px;font:inherit;cursor:pointer';
  let clicks = 0;
  button.addEventListener('click', () => { button.textContent = `Native clicks: ${++clicks}`; }, { signal });
  element.append(label, button);
  const report = () => {
    if (!hovered || signal.aborted) return;
    current.onInputHover({ x: input.offsetLeft, y: input.offsetTop, width: input.offsetWidth, height: input.offsetHeight });
  };
  input.addEventListener('pointerenter', () => { hovered = true; report(); }, { signal });
  input.addEventListener('pointerleave', () => { hovered = false; current.onInputHover(null); }, { signal });
  // ResizeObserver reports after layout, outside mount/update evaluation. Keep
  // the arc origins aligned if fonts or the native input's dimensions change.
  const observer = new ResizeObserver(report);
  observer.observe(input); observer.observe(label);
  signal.addEventListener('abort', () => observer.disconnect(), { once: true });
  return next => { current = next; caption.textContent = next.title; };
};

/** Deterministic jagged branches from the measured input to the panel perimeter. */
function discharge(box: InputBox, frame: number) {
  const path = new PathGeometry();
  let seed = (frame + 1) * 7919;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let index = 0; index < 12; index++) {
    const horizontal = index < 8;
    const bottom = index % 2 === 0;
    const fraction = 0.08 + random() * 0.84;
    const startX = horizontal ? box.x + fraction * box.width : box.x + (bottom ? box.width : 0);
    const startY = horizontal ? box.y + (bottom ? box.height : 0) : box.y + fraction * box.height;
    const endX = horizontal ? 25 + random() * 290 : bottom ? 339 : 1;
    const endY = horizontal ? bottom ? 189 : 1 : 25 + random() * 140;
    const dx = endX - startX; const dy = endY - startY;
    const length = Math.hypot(dx, dy);
    path.moveTo(startX, startY);
    for (let step = 1; step <= 8; step++) {
      const t = step / 8;
      const jitter = step === 8 ? 0 : (random() - 0.5) * Math.min(24, length * 0.5);
      const x = startX + dx * t - dy / length * jitter;
      const y = startY + dy * t + dx / length * jitter;
      path.lineTo(x, y);
      if (step === 4) {
        path.lineTo(x + (random() - 0.5) * 25, y + (random() - 0.5) * 25);
        path.moveTo(x, y);
      }
    }
  }
  return path;
}

function HtmlBoxLesson() {
  const angle = useSignal(0); const position = useSignal(0); const scale = useSignal(1); const after = useSignal(0);
  const inputBox = useSignal<InputBox | null>(null);
  const clock = useSignal(0);
  const playback = usePlayback(repeat(sequence(track(clock, tween({ from: 0, to: 1000, duration: 1000 })), wait(16)), { iterations: Infinity }));
  const editorData = useConst<EditorData>(() => ({
    title: 'Your note',
    onInputHover(box) {
      const wasHovered = inputBox.get() !== null;
      inputBox.set(box);
      if (box && !wasHovered) playback.play();
      else if (!box) playback.pause();
    },
  }));
  const measured = inputBox.get();
  const arcs = measured ? discharge(measured, Math.floor(clock.get() / 65)) : null;
  const clip = useConst(() => { const path = new PathGeometry(); path.roundRect(0, 0, 340, 190, 24); return path; });
  const controls = [
    { text: 'ROTATE', action: () => angle.update(value => value === 20 ? -20 : value + 10) },
    { text: 'MOVE', action: () => position.update(value => value === 60 ? 0 : value + 20) },
    { text: 'SCALE', action: () => scale.update(value => value === 1 ? 0.8 : 1) },
  ];
  return <FocusManagement><Group>
    <Rectangle style={{ width: 720, height: 480, fill: '#080f1c' }} />
    <Text style={{ x: 32, y: 45, font: '700 28px system-ui', fill: '#e2f2ff' }}>Native HTML. Canvas electricity.</Text>
    <Text style={{ x: 32, y: 75, font: '14px system-ui', fill: '#91a8c2' }}>Native editing. CRC placement, transforms, clipping, and focus.</Text>
    {controls.map((control, index) => <Group key={control.text}>
      <Rectangle style={{ x: 32 + index * 135, y: 96, width: 120, height: 40, fill: '#203c52', cursor: 'pointer' }} onClick={control.action} />
      <Text pointerEvents="none" style={{ x: 92 + index * 135, y: 122, textAlign: 'center', font: '700 12px system-ui', fill: 'white' }}>{control.text}</Text>
    </Group>)}
    <Group key="editor" style={{ translateX: 145 + position.get(), translateY: 174 }}>
      <Group style={{ rotationDegrees: angle.get(), rotationOrigin: [170, 95], scaleX: scale.get(), scaleY: scale.get() }}>
        <Clip style={{ d: clip }}>
          <Path key="panel" pointerEvents="none" style={{ d: clip, fill: '#102536', stroke: '#35586e', strokeWidth: 2 }} />
          {arcs && <Group key="lightning">
            <Path pointerEvents="none" style={{ d: arcs, stroke: '#398bff', strokeWidth: 11, opacity: 0.1 }} />
            <Path pointerEvents="none" style={{ d: arcs, stroke: '#55bdff', strokeWidth: 5, opacity: 0.22 }} />
            <Path pointerEvents="none" style={{ d: arcs, stroke: '#a0eaff', strokeWidth: 1.8, opacity: 0.85 }} />
            <Path pointerEvents="none" style={{ d: arcs, stroke: '#f1fcff', strokeWidth: 0.7 }} />
          </Group>}
          <HtmlBox
            key="native-editor"
            mount={mountEditor}
            data={editorData}
            style={{ width: 340, height: 190 }}
          />
        </Clip>
      </Group>
    </Group>
    <Rectangle style={{ x: 32, y: 404, width: 190, height: 40, fill: '#203c52', cursor: 'pointer' }} onClick={() => after.update(n => n + 1)} />
    <Text pointerEvents="none" style={{ x: 127, y: 430, textAlign: 'center', font: '700 12px system-ui', fill: 'white' }}>{`CANVAS CLICKS: ${after.get()}`}</Text>
    <Text style={{ x: 242, y: 429, font: '13px system-ui', fill: '#91a8c2' }}>Hover the input. Native layout powers Canvas lightning.</Text>
  </Group></FocusManagement>;
}

export default function mount(canvas: HTMLCanvasElement): CRCController {
  const placeholder = document.createComment('HtmlBox lesson canvas');
  canvas.before(placeholder);
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:relative;width:100%;height:100%;isolation:isolate';
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:absolute;inset:0;z-index:1;pointer-events:none';
  const previousStyle = canvas.getAttribute('style');
  canvas.style.cssText = 'display:block;width:100%;height:100%;border:0;padding:0';
  const ownedStyle = canvas.getAttribute('style');
  placeholder.after(wrapper); wrapper.append(canvas, overlay);
  let controller: CRCController;
  const restore = () => {
    if (canvas.parentElement === wrapper) placeholder.after(canvas);
    if (canvas.getAttribute('style') === ownedStyle) {
      if (previousStyle === null) canvas.removeAttribute('style'); else canvas.setAttribute('style', previousStyle);
    }
    wrapper.remove(); placeholder.remove();
  };
  try { controller = crc(canvas, <HtmlBoxLesson />, { viewport: { width: 720, height: 480 }, htmlOverlay: overlay }); }
  catch (error) { restore(); throw error; }
  let disposed = false;
  return { dispose() { if (disposed) return; disposed = true; try { controller.dispose(); } finally { restore(); } } };
}
