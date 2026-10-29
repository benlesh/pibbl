import { afterEach, expect, it, vi } from 'vitest';
import { Flex, FocusManagement, Rectangle, Text, signal, type PibblController } from '@pibbl/core';
import { pibblSync } from '@pibbl/core/sync';
import { nativeLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region';

let controller: PibblController | undefined;
afterEach(() => { controller?.dispose(); controller = undefined; document.body.replaceChildren(); });
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
function click(canvas: HTMLCanvasElement, x: number, y: number): void {
  const bounds = canvas.getBoundingClientRect();
  for (const type of ['mousedown', 'mouseup', 'click']) {
    canvas.dispatchEvent(new MouseEvent(type, {
      bubbles: true, button: 0, clientX: bounds.left + x, clientY: bounds.top + y,
    }));
  }
}

it.runIf(nativeLayout)(
  'uses the existing natural Text basis and word floor for wrapped row lines before optional cross-auto placement',
  async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const canvas = document.createElement('canvas'); canvas.width = 180; canvas.height = 120;
    document.body.append(canvas);
    const context = canvas.getContext('2d')!;
    context.font = '10px monospace';
    const words = 'alpha beta gamma';
    const natural = context.measureText(words).width;
    const word = context.measureText('gamma').width;
    const width = signal(Math.ceil(natural) + 30);
    const marginTop = signal<0 | 'auto'>(0);
    const peerFill = signal('#426b61');
    const hits: string[] = [], focus: string[] = [];
    const draws: Array<{ text: string; x: number; y: number }> = [];
    const fillText = context.fillText;
    vi.spyOn(context, 'fillText').mockImplementation(function(this: CanvasRenderingContext2D, text, x, y, maxWidth) {
      if (text.startsWith('alpha') || text === 'beta gamma' || text === 'gamma') {
        const transform = this.getTransform();
        draws.push({ text, x: transform.e + x, y: transform.f + y });
      }
      fillText.call(this, text, x, y, maxWidth);
    });

    function Scene() {
      return <FocusManagement><Flex style={{
        width, height: 100, flexWrap: 'wrap', gap: 10,
        alignItems: 'flex-start', alignContent: 'flex-start',
      }}>
        <Text key="text" keyboardFocusable onFocus={() => focus.push('text')}
          onClick={() => hits.push('text')}
          style={{ wrap: true, font: '10px monospace', lineHeight: 10,
            marginTop, fill: '#19375b' }}>{words}</Text>
        <Rectangle key="peer" keyboardFocusable onFocus={() => focus.push('peer')}
          onClick={() => hits.push('peer')}
          style={{ width: 20, height: 40, minWidth: 0, minHeight: 0,
            flexShrink: 0, fill: peerFill }} />
        <Rectangle key="following" onClick={() => hits.push('following')}
          style={{ width: 60, height: 30, minWidth: 0, minHeight: 0,
            flexShrink: 0, fill: '#6e3e79' }} />
      </Flex></FocusManagement>;
    }

    controller = pibblSync(canvas, <Scene />);
    await frame();
    // The first line uses the Canvas natural advance, with peer beside it; the
    // following rectangle starts a second native wrap line.
    expect(draws).toEqual([{ text: words, x: 0, y: 0 }]);
    canvas.focus({ preventScroll: true });
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true }));
    expect(focus).toEqual(['text', 'peer']);
    click(canvas, 4, 55); await frame(); expect(hits).toEqual(['following']);
    hits.length = 0;
    const initial = snapshotWasmLayoutDiagnostics();
    const initialFocus = focus.slice();

    draws.length = 0;
    marginTop.set('auto');
    await frame();
    // Pibbl's established wrapped-line policy lets cross auto consume the peer
    // line's spare cross space. Yoga keeps this margin at zero, so this is
    // deliberate classified Pibbl behavior, not a Yoga-parity assertion.
    // It must not alter the natural main basis or peer/following membership.
    expect(draws).toEqual([{ text: words, x: 0, y: 30 }]);
    expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(initial.nodeCreates);
    expect(focus).toEqual(initialFocus);
    click(canvas, 4, 5); await frame(); expect(hits).toEqual([]);
    click(canvas, 25, 35); await frame(); expect(hits).toEqual(['text']);
    click(canvas, Math.ceil(natural) + 15, 5); await frame(); expect(hits).toEqual(['text', 'peer']);

    const beforeNarrow = snapshotWasmLayoutDiagnostics();
    const focusBeforeNarrow = focus.slice();
    draws.length = 0;
    width.set(70);
    await frame();
    // Native wrapping settles a narrower target first; Text then measures its
    // final target width and contributes two rendered lines before cross placement.
    expect(draws).toHaveLength(2);
    expect(draws.map(draw => draw.y)).toEqual([0, 10]);
    const narrowed = snapshotWasmLayoutDiagnostics();
    expect(narrowed.solves).toBeGreaterThan(beforeNarrow.solves);
    expect(narrowed.measuredLeaves).toBeGreaterThan(beforeNarrow.measuredLeaves);
    expect(narrowed.nodeCreates).toBe(initial.nodeCreates);
    expect(focus).toEqual(focusBeforeNarrow);
    click(canvas, 25, 35); await frame(); expect(hits).toEqual(['text', 'peer']);
    click(canvas, 4, 15); await frame(); expect(hits).toEqual(['text', 'peer', 'text']);

    draws.length = 0;
    width.set(Math.max(0, Math.floor(word) - 8));
    await frame();
    // A point beyond the owner width remains inside the Text item: the omitted
    // main minimum is the measured longest word, not zero.
    click(canvas, Math.max(1, Math.floor(word) - 1), 5);
    await frame();
    expect(hits.at(-1)).toBe('text');

    const beforePaint = snapshotWasmLayoutDiagnostics();
    peerFill.set('#a63758');
    await frame();
    const painted = snapshotWasmLayoutDiagnostics();
    expect(painted.solves).toBe(beforePaint.solves);
    expect(painted.nodeCreates).toBe(initial.nodeCreates);
    controller.dispose();
    const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([
      baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
    ]);
  },
);
