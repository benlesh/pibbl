import { pibbl, HtmlBox, Group, Clip, FocusManagement, Rectangle, Text, PathGeometry, useSignal, useConst, type PibblController, type HtmlMountCallback } from '@pibbl/core';

const mountEditor: HtmlMountCallback<string> = (element, title, signal) => {
  element.style.cssText += ';padding:22px;font:15px system-ui;color:#163a40;background:#e7f6ef';
  const label = document.createElement('label');
  label.style.cssText = 'display:grid;gap:10px;font-weight:650';
  const caption = document.createElement('span'); caption.textContent = title;
  const input = document.createElement('input'); input.placeholder = 'Type here, then move the box';
  input.style.cssText = 'width:100%;padding:10px;border:1px solid #87b2a3;border-radius:5px;font:inherit;box-sizing:border-box';
  label.append(caption, input);
  const button = document.createElement('button'); button.textContent = 'Native clicks: 0';
  button.style.cssText = 'margin-top:15px;padding:10px 16px;background:#164c45;color:white;border:0;border-radius:5px;font:inherit;cursor:pointer';
  let clicks = 0;
  button.addEventListener('click', () => { button.textContent = `Native clicks: ${++clicks}`; }, { signal });
  element.append(label, button);
  return next => { caption.textContent = next; };
};

function HtmlBoxLesson() {
  const angle = useSignal(0); const position = useSignal(0); const scale = useSignal(1); const after = useSignal(0);
  const clip = useConst(() => { const path = new PathGeometry(); path.roundRect(0, 0, 340, 190, 24); return path; });
  const controls = [
    { text: 'ROTATE', action: () => angle.update(value => value === 20 ? -20 : value + 10) },
    { text: 'MOVE', action: () => position.update(value => value === 60 ? 0 : value + 20) },
    { text: 'SCALE', action: () => scale.update(value => value === 1 ? 0.8 : 1) },
  ];
  return <FocusManagement><Group>
    <Rectangle style={{ width: 720, height: 480, fill: '#fffdf6' }} />
    <Text style={{ left: 32, top: 45, font: '700 28px system-ui', fill: '#163a40' }}>HTML, inside your canvas app</Text>
    <Text style={{ left: 32, top: 75, font: '14px system-ui', fill: '#42655f' }}>Native editing. Pibbl placement, transforms, clipping, and focus.</Text>
    {controls.map((control, index) => <Group key={control.text}>
      <Rectangle style={{ left: 32 + index * 135, top: 96, width: 120, height: 40, fill: '#164c45', cursor: 'pointer' }} onClick={control.action} />
      <Text pointerEvents="none" style={{ left: 92 + index * 135, top: 122, textAlign: 'center', font: '700 12px system-ui', fill: 'white' }}>{control.text}</Text>
    </Group>)}
    <Group style={{ translateX: 145 + position.get(), translateY: 174 }}>
      <Group style={{ rotationDegrees: angle.get(), rotationOrigin: [170, 95], scaleX: scale.get(), scaleY: scale.get() }}>
        <Clip style={{ d: clip }}>
          <HtmlBox mount={mountEditor} data="Your note" style={{ width: 340, height: 190 }} />
        </Clip>
      </Group>
    </Group>
    <Rectangle style={{ left: 32, top: 404, width: 190, height: 40, fill: '#164c45', cursor: 'pointer' }} onClick={() => after.update(n => n + 1)} />
    <Text pointerEvents="none" style={{ left: 127, top: 430, textAlign: 'center', font: '700 12px system-ui', fill: 'white' }}>{`CANVAS CLICKS: ${after.get()}`}</Text>
    <Text style={{ left: 242, top: 429, font: '13px system-ui', fill: '#42655f' }}>Tab between Canvas and HTML. Your text stays put.</Text>
  </Group></FocusManagement>;
}

export default function mount(canvas: HTMLCanvasElement): PibblController {
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
  let controller: PibblController;
  const restore = () => {
    if (canvas.parentElement === wrapper) placeholder.after(canvas);
    if (canvas.getAttribute('style') === ownedStyle) {
      if (previousStyle === null) canvas.removeAttribute('style'); else canvas.setAttribute('style', previousStyle);
    }
    wrapper.remove(); placeholder.remove();
  };
  try { controller = pibbl(canvas, <HtmlBoxLesson />, { viewport: { width: 720, height: 480 }, htmlOverlay: overlay }); }
  catch (error) { restore(); throw error; }
  let disposed = false;
  return { dispose() { if (disposed) return; disposed = true; try { controller.dispose(); } finally { restore(); } } };
}
