import { userEvent } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { layer } from '../components/layer';
import { defineComp } from '../define-comp';
import type { CRCEventHandlers } from '../events/types';
import { executeRender } from '../execute-render';
import { clearSharedState, getCRCInstance } from '../global-state';
import { crcEventTarget } from '../hooks/crc-event-target';
import { mountCRC } from '../mount-crc';
import type {
  CompEl,
  CRCController,
  CRCFocusPolicyBridge,
} from '../types';
import type { CRCFocusManager } from './focus-manager';
import { withFocusManagement } from './with-focus-management';

const activeControllers = new Set<CRCController>();
const noop = () => undefined;

beforeEach(() => {
  document.body.replaceChildren();
});

afterEach(() => {
  for (const controller of activeControllers) controller.dispose();
  activeControllers.clear();
  clearSharedState();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('Canvas DOM focus host', () => {
  it('enters and exits between real native controls in both directions', async () => {
    const mounted = mountBetweenNativeControls(managed(['first', 'second']));

    mounted.before.focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(mounted.canvas);
    expect(focusedLabel(mounted.manager)).toBe('first');

    await userEvent.tab();
    expect(document.activeElement).toBe(mounted.canvas);
    expect(focusedLabel(mounted.manager)).toBe('second');

    await userEvent.tab();
    expect(document.activeElement).toBe(mounted.after);
    expect(mounted.manager.resolveKeyboardTarget()).toBeUndefined();

    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(mounted.canvas);
    expect(focusedLabel(mounted.manager)).toBe('second');

    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(mounted.canvas);
    expect(focusedLabel(mounted.manager)).toBe('first');

    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(mounted.before);
    expect(mounted.manager.resolveKeyboardTarget()).toBeUndefined();
  });

  it('uses forward entry for programmatic Canvas focus and clears on blur', () => {
    const mounted = mountBetweenNativeControls(managed(['first', 'second']));

    mounted.canvas.focus({ preventScroll: true });
    expect(document.activeElement).toBe(mounted.canvas);
    expect(focusedLabel(mounted.manager)).toBe('first');

    mounted.canvas.blur();
    expect(mounted.manager.resolveKeyboardTarget()).toBeUndefined();
  });

  it('routes native Canvas focus and blur before blur clears logical state', () => {
    const trace: string[] = [];
    const Root = defineComp(() => Target({
      label: 'only',
      handlers: {
        onClick: noop,
        onFocus: event => trace.push(event.type),
        onBlur: event => trace.push(event.type),
      },
    }));
    const mounted = mountBetweenNativeControls(withFocusManagement(Root({})));

    mounted.canvas.focus({ preventScroll: true });
    mounted.canvas.blur();

    expect(trace).toEqual(['focus', 'blur']);
    expect(mounted.manager.resolveKeyboardTarget()).toBeUndefined();
  });

  it('does not treat an already-prevented document Tab as reverse entry', async () => {
    const preventReverse = (event: KeyboardEvent) => {
      if (event.key === 'Tab' && event.shiftKey) event.preventDefault();
    };
    document.addEventListener('keydown', preventReverse, true);
    const mounted = mountBetweenNativeControls(managed(['first', 'last']));
    mounted.after.focus();

    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(mounted.after);

    mounted.canvas.focus({ preventScroll: true });
    expect(focusedLabel(mounted.manager)).toBe('first');
    document.removeEventListener('keydown', preventReverse, true);
  });

  it.each([
    ['an absent attribute', undefined, '0', null],
    ['an exact negative value', '-1', '0', '-1'],
    ['an existing positive Tab stop', '7', '7', '7'],
    ['an existing empty value', '', '0', ''],
  ] as const)(
    'owns and restores %s only while candidates are live',
    (_label, initial, active, restored) => {
      const canvas = createCanvas();
      setTabIndexAttribute(canvas, initial);
      const mounted = mountAndRender(canvas, managed(['only']));

      expect(canvas.getAttribute('tabindex')).toBe(active);

      executeRender(canvas, 2, managed([]));
      expect(canvas.getAttribute('tabindex')).toBe(restored);

      executeRender(canvas, 3, managed(['only']));
      expect(canvas.getAttribute('tabindex')).toBe(active);

      mounted.controller.dispose();
      activeControllers.delete(mounted.controller);
      expect(canvas.getAttribute('tabindex')).toBe(restored);

      mounted.controller.dispose();
      expect(canvas.getAttribute('tabindex')).toBe(restored);
    },
  );

  it('does not overwrite application tabindex mutations and snapshots a later ownership cycle', () => {
    const canvas = createCanvas();
    canvas.setAttribute('tabindex', '-1');
    const mounted = mountAndRender(canvas, managed(['only']));
    expect(canvas.getAttribute('tabindex')).toBe('0');

    canvas.setAttribute('tabindex', '9');
    executeRender(canvas, 2, managed([]));
    expect(canvas.getAttribute('tabindex')).toBe('9');

    canvas.setAttribute('tabindex', '-2');
    executeRender(canvas, 3, managed(['only']));
    expect(canvas.getAttribute('tabindex')).toBe('0');

    canvas.removeAttribute('tabindex');
    mounted.controller.dispose();
    activeControllers.delete(mounted.controller);
    expect(canvas.hasAttribute('tabindex')).toBe(false);
  });

  it('keeps exactly one document capture listener across rerenders and releases it on enhancer removal', () => {
    const add = vi.spyOn(document, 'addEventListener');
    const remove = vi.spyOn(document, 'removeEventListener');
    const canvas = createCanvas();
    const mounted = mountAndRender(canvas, managed(['only']));
    const firstAdds = documentKeydownCaptureCalls(add.mock.calls);
    expect(firstAdds).toHaveLength(1);

    executeRender(canvas, 2, managed(['only']));
    executeRender(canvas, 3, managed([]));
    expect(documentKeydownCaptureCalls(add.mock.calls)).toHaveLength(1);
    expect(documentKeydownCaptureCalls(remove.mock.calls)).toHaveLength(0);

    executeRender(canvas, 4, Scene({ labels: ['only'] }));
    const removals = documentKeydownCaptureCalls(remove.mock.calls);
    expect(removals).toHaveLength(1);
    expect(removals[0][1]).toBe(firstAdds[0][1]);
    expect(canvas.hasAttribute('tabindex')).toBe(false);

    mounted.controller.dispose();
    mounted.controller.dispose();
    activeControllers.delete(mounted.controller);
    expect(documentKeydownCaptureCalls(remove.mock.calls)).toHaveLength(1);
  });

  it('transfers the focus host across manager replacement without losing the Tab stop', () => {
    const add = vi.spyOn(document, 'addEventListener');
    const remove = vi.spyOn(document, 'removeEventListener');
    const OldHost = defineComp(() => withFocusManagement(Target({
      label: 'old',
      handlers: { onClick: noop },
    })));
    const NewHost = defineComp(() => withFocusManagement(Target({
      label: 'new',
      handlers: { onClick: noop },
    })));
    const Root = defineComp(({ replacement }: { replacement: boolean }) =>
      replacement ? NewHost({ key: 'new' }) : OldHost({ key: 'old' })
    );
    const canvas = createCanvas();
    const mounted = mountAndRender(canvas, Root({ replacement: false }));
    const priorManager = mounted.manager;
    expect(canvas.getAttribute('tabindex')).toBe('0');

    executeRender(canvas, 2, Root({ replacement: true }));
    const replacement = focusManager(canvas);
    expect(replacement).not.toBe(priorManager);
    expect(candidateLabels(replacement)).toEqual(['new']);
    expect(canvas.getAttribute('tabindex')).toBe('0');
    expect(documentKeydownCaptureCalls(add.mock.calls)).toHaveLength(2);
    expect(documentKeydownCaptureCalls(remove.mock.calls)).toHaveLength(1);

    mounted.controller.dispose();
    activeControllers.delete(mounted.controller);
    expect(canvas.hasAttribute('tabindex')).toBe(false);
    expect(documentKeydownCaptureCalls(remove.mock.calls)).toHaveLength(2);
  });

  it('enters logical focus before native focus routing after manager replacement', () => {
    const trace: string[] = [];
    const OldHost = defineComp(() => withFocusManagement(Target({
      label: 'old',
      handlers: { onClick: noop, onFocus: () => trace.push('old-focus') },
    })));
    const NewHost = defineComp(() => withFocusManagement(Target({
      label: 'new',
      handlers: { onClick: noop, onFocus: () => trace.push('new-focus') },
    })));
    const Root = defineComp(({ replacement }: { replacement: boolean }) =>
      replacement ? NewHost({ key: 'new' }) : OldHost({ key: 'old' })
    );
    const canvas = createCanvas();
    mountAndRender(canvas, Root({ replacement: false }));

    executeRender(canvas, 2, Root({ replacement: true }));
    canvas.focus({ preventScroll: true });

    expect(trace).toEqual(['new-focus']);
    expect(focusedLabel(focusManager(canvas))).toBe('new');
  });

  it('retains one host and listener when a cached layer replays its manager', () => {
    const add = vi.spyOn(document, 'addEventListener');
    const remove = vi.spyOn(document, 'removeEventListener');
    let renders = 0;
    const Inner = defineComp(() => {
      renders++;
      return withFocusManagement(Target({
        label: 'cached',
        handlers: { onClick: noop },
      }));
    });
    const Root = defineComp(({ generation: _generation }: { generation: number }) =>
      layer({
        key: 'cached-layer',
        style: { width: 30, height: 30 },
        render: Inner({}),
      })
    );
    const canvas = createCanvas();
    const mounted = mountAndRender(canvas, Root({ generation: 1 }));
    const manager = mounted.manager;

    executeRender(canvas, 2, Root({ generation: 2 }));

    expect(focusManager(canvas)).toBe(manager);
    expect(candidateLabels(manager)).toEqual(['cached']);
    expect(renders).toBe(1);
    expect(canvas.getAttribute('tabindex')).toBe('0');
    expect(documentKeydownCaptureCalls(add.mock.calls)).toHaveLength(1);
    expect(documentKeydownCaptureCalls(remove.mock.calls)).toHaveLength(0);
  });

  it('rejects a root OffscreenCanvas before acquiring a DOM focus host', () => {
    const canvas = new OffscreenCanvas(40, 40);
    const controller = mountCRC(canvas, managed(['only']));
    activeControllers.add(controller);

    expect(() => executeRender(canvas, 1)).toThrowError(
      /withFocusManagement.*HTMLCanvasElement.*root|OffscreenCanvas.*focus host/i,
    );
    expect(getCRCInstance(canvas).eventRoot.focusPolicy).toBeUndefined();
  });

  it('clears the optional structural policy as a final root cleanup guarantee', () => {
    const canvas = createCanvas();
    const controller = mountCRC(canvas, Scene({ labels: [] }));
    activeControllers.add(controller);
    executeRender(canvas, 1);
    const eventRoot = getCRCInstance(canvas).eventRoot;
    eventRoot.focusPolicy = {} as CRCFocusPolicyBridge;

    controller.dispose();
    activeControllers.delete(controller);

    expect(eventRoot.focusPolicy).toBeUndefined();
  });
});

interface TargetProps {
  readonly label: string;
  readonly handlers: CRCEventHandlers;
}

const Target = defineComp<TargetProps>(({ handlers }) => {
  crcEventTarget(handlers, {
    path: rectanglePath(0, 0, 10, 10),
  });
});

const Scene = defineComp(({ labels }: { labels: readonly string[] }) =>
  labels.map(label => Target({
    key: label,
    label,
    handlers: { onClick: noop },
  }))
);

function managed(labels: readonly string[]): CompEl<any, any> {
  return withFocusManagement(Scene({ labels }));
}

function mountBetweenNativeControls(element: CompEl<any, any>) {
  const before = document.createElement('button');
  before.textContent = 'before';
  const canvas = createCanvas(false);
  const after = document.createElement('button');
  after.textContent = 'after';
  document.body.append(before, canvas, after);
  const mounted = mountAndRender(canvas, element);
  return { ...mounted, before, after };
}

function mountAndRender(canvas: HTMLCanvasElement, element: CompEl<any, any>) {
  const controller = mountCRC(canvas, element);
  activeControllers.add(controller);
  executeRender(canvas, 1);
  return { canvas, controller, manager: focusManager(canvas) };
}

function focusManager(canvas: HTMLCanvasElement): CRCFocusManager {
  const manager = getCRCInstance(canvas).eventRoot.focusPolicy;
  if (!manager) throw new Error('Expected a focus manager.');
  return manager as CRCFocusManager;
}

function candidateLabels(manager: CRCFocusManager): string[] {
  return manager.candidates.map(candidate =>
    (candidate.target.component.element.props as { label: string }).label
  );
}

function focusedLabel(manager: CRCFocusManager): string | undefined {
  const focused = manager.resolveKeyboardTarget();
  return focused ?
    (focused.component.element.props as { label: string }).label :
    undefined;
}

function createCanvas(append = true): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 300;
  canvas.height = 200;
  if (append) document.body.appendChild(canvas);
  return canvas;
}

function setTabIndexAttribute(
  canvas: HTMLCanvasElement,
  value: string | undefined,
): void {
  if (value === undefined) canvas.removeAttribute('tabindex');
  else canvas.setAttribute('tabindex', value);
}

function documentKeydownCaptureCalls(
  calls: readonly (readonly unknown[])[],
): (readonly unknown[])[] {
  return calls.filter(call =>
    call[0] === 'keydown' &&
    (call[2] === true ||
      typeof call[2] === 'object' &&
      call[2] !== null &&
      (call[2] as AddEventListenerOptions).capture === true)
  );
}

function rectanglePath(
  x: number,
  y: number,
  width: number,
  height: number,
): Path2D {
  const path = new Path2D();
  path.rect(x, y, width, height);
  return path;
}
