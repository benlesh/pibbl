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
import { focusManaged } from './policy-test-support';

const activeControllers = new Set<CRCController>();
const noop = () => undefined;
const DOM_FOCUS_HOST_EVENT_TYPES = [
  'focus',
  'focusin',
  'blur',
  'focusout',
  'keydown',
  'keyup',
  'pointerdown',
  'touchstart',
  'touchend',
  'touchcancel',
] as const;

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
    const mounted = mountBetweenNativeControls(focusManaged(Root({})));

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
    ['target', (target: HTMLElement) => target],
    ['document', () => document],
    ['window', () => window],
  ] as const)(
    'ignores reverse Tab canceled by a later %s listener',
    async (_label, preventerTarget) => {
      const mounted = mountBetweenNativeControls(managed(['first', 'last']));
      const target = preventerTarget(mounted.after);
      let trusted = false;
      const preventReverse = (event: Event) => {
        if (
          event instanceof KeyboardEvent &&
          event.key === 'Tab' &&
          event.shiftKey
        ) {
          trusted = event.isTrusted;
          event.preventDefault();
        }
      };
      target.addEventListener('keydown', preventReverse);
      let activeBeforeProgrammaticFocus: Element | null = null;
      let resolveFocusTask: () => void = () => undefined;
      const focusTask = new Promise<void>(resolve => {
        resolveFocusTask = resolve;
      });
      const queueCanvasFocus = (event: KeyboardEvent) => {
        if (event.key !== 'Tab' || !event.shiftKey) return;
        window.removeEventListener('keydown', queueCanvasFocus, true);
        setTimeout(() => {
          activeBeforeProgrammaticFocus = document.activeElement;
          mounted.canvas.focus({ preventScroll: true });
          resolveFocusTask();
        }, 0);
      };
      window.addEventListener('keydown', queueCanvasFocus, true);
      mounted.after.focus();

      await userEvent.tab({ shift: true });
      await focusTask;

      expect(trusted).toBe(true);
      expect(activeBeforeProgrammaticFocus).toBe(mounted.after);
      expect(document.activeElement).toBe(mounted.canvas);
      expect(focusedLabel(mounted.manager)).toBe('first');
      target.removeEventListener('keydown', preventReverse);
    },
  );

  it('expires an unrelated reverse Tab before later-task programmatic Canvas focus', async () => {
    const mounted = mountBetweenNativeControls(managed(['first', 'last']));
    mounted.after.focus();
    mounted.after.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    }));

    await new Promise(resolve => setTimeout(resolve, 0));
    mounted.canvas.focus({ preventScroll: true });

    expect(focusedLabel(mounted.manager)).toBe('first');
  });

  it('consumes one reverse Tab entry without reusing it', async () => {
    const mounted = mountBetweenNativeControls(managed(['first', 'last']));
    mounted.after.focus();

    await userEvent.tab({ shift: true });
    expect(focusedLabel(mounted.manager)).toBe('last');
    mounted.canvas.blur();
    mounted.canvas.focus({ preventScroll: true });

    expect(focusedLabel(mounted.manager)).toBe('first');
  });

  it('uses forward entry when a trusted Tab handler programmatically focuses the Canvas', async () => {
    const mounted = mountBetweenNativeControls(managed(['first', 'last']));
    let trusted = false;
    const focusCanvas = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !event.shiftKey) return;
      trusted = event.isTrusted;
      mounted.canvas.focus({ preventScroll: true });
      event.preventDefault();
    };
    mounted.after.addEventListener('keydown', focusCanvas);
    mounted.after.focus();

    await userEvent.tab({ shift: true });

    expect(trusted).toBe(true);
    expect(document.activeElement).toBe(mounted.canvas);
    expect(focusedLabel(mounted.manager)).toBe('first');
    mounted.after.removeEventListener('keydown', focusCanvas);
  });

  it('ignores reverse entry when an earlier queued task focuses the Canvas after Tab moves elsewhere', async () => {
    const mounted = mountBetweenNativeControls(managed(['first', 'last']));
    const origin = document.createElement('button');
    origin.textContent = 'origin';
    document.body.append(origin);
    let trusted = false;
    let activeBeforeProgrammaticFocus: Element | null = null;
    let resolveFocusTask: () => void = () => undefined;
    const focusTask = new Promise<void>(resolve => {
      resolveFocusTask = resolve;
    });
    const queueCanvasFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !event.shiftKey) return;
      trusted = event.isTrusted;
      window.removeEventListener('keydown', queueCanvasFocus, true);
      setTimeout(() => {
        activeBeforeProgrammaticFocus = document.activeElement;
        mounted.canvas.focus({ preventScroll: true });
        resolveFocusTask();
      }, 0);
    };
    window.addEventListener('keydown', queueCanvasFocus, true);
    origin.focus();

    await userEvent.tab({ shift: true });
    await focusTask;

    expect(trusted).toBe(true);
    expect(activeBeforeProgrammaticFocus).toBe(mounted.after);
    expect(document.activeElement).toBe(mounted.canvas);
    expect(focusedLabel(mounted.manager)).toBe('first');
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

  it('keeps one base tabindex snapshot when press focus precedes live candidates', () => {
    const canvas = createCanvas();
    const mounted = mountAndRender(canvas, managed([]));

    dispatchBackgroundPress(canvas);
    expect(document.activeElement).toBe(canvas);
    expect(canvas.getAttribute('tabindex')).toBe('-1');

    executeRender(canvas, 2, managed(['only']));
    expect(canvas.getAttribute('tabindex')).toBe('0');

    canvas.blur();
    expect(canvas.getAttribute('tabindex')).toBe('0');

    executeRender(canvas, 3, managed([]));
    expect(canvas.hasAttribute('tabindex')).toBe(false);

    mounted.controller.dispose();
    activeControllers.delete(mounted.controller);
    expect(canvas.hasAttribute('tabindex')).toBe(false);
  });

  it.each([
    ['a different negative value', '-2', '0', '-2'],
    ['a nonnegative value', '9', '9', '9'],
    ['an absent attribute', undefined, '0', null],
  ] as const)(
    'rebases press-only non-writing ownership after the application sets %s',
    (_label, applicationValue, active, restored) => {
      const canvas = createCanvas();
      canvas.setAttribute('tabindex', '-1');
      const mounted = mountAndRender(canvas, managed([]));

      dispatchBackgroundPress(canvas);
      expect(document.activeElement).toBe(canvas);
      expect(canvas.getAttribute('tabindex')).toBe('-1');

      setTabIndexAttribute(canvas, applicationValue);
      executeRender(canvas, 2, managed(['only']));
      expect(canvas.getAttribute('tabindex')).toBe(active);

      canvas.blur();
      executeRender(canvas, 3, managed([]));
      expect(canvas.getAttribute('tabindex')).toBe(restored);

      mounted.controller.dispose();
      activeControllers.delete(mounted.controller);
      expect(canvas.getAttribute('tabindex')).toBe(restored);
    },
  );

  it('keeps the press reason when candidates disappear and restores the base on disposal', () => {
    const canvas = createCanvas();
    const mounted = mountAndRender(canvas, managed(['only']));
    expect(canvas.getAttribute('tabindex')).toBe('0');

    dispatchBackgroundPress(canvas);
    executeRender(canvas, 2, managed([]));
    expect(document.activeElement).toBe(canvas);
    expect(canvas.getAttribute('tabindex')).toBe('-1');

    mounted.controller.dispose();
    activeControllers.delete(mounted.controller);
    expect(canvas.hasAttribute('tabindex')).toBe(false);
  });

  it('keeps exactly one document capture listener across rerenders and releases it on enhancer removal', () => {
    const add = vi.spyOn(document, 'addEventListener');
    const remove = vi.spyOn(document, 'removeEventListener');
    const canvas = createCanvas();
    const canvasAdd = vi.spyOn(canvas, 'addEventListener');
    const canvasRemove = vi.spyOn(canvas, 'removeEventListener');
    const mounted = mountAndRender(canvas, managed(['only']));
    const eventRoot = getCRCInstance(canvas).eventRoot;
    const firstAdds = documentKeydownCaptureCalls(add.mock.calls);
    expect(firstAdds).toHaveLength(1);
    for (const type of DOM_FOCUS_HOST_EVENT_TYPES) {
      expect(eventRoot.nativeListeners?.count(type), type).toBe(1);
      expect(canvasEventCalls(canvasAdd.mock.calls, type)).toHaveLength(1);
    }

    executeRender(canvas, 2, managed(['only']));
    executeRender(canvas, 3, managed([]));
    expect(documentKeydownCaptureCalls(add.mock.calls)).toHaveLength(1);
    expect(documentKeydownCaptureCalls(remove.mock.calls)).toHaveLength(0);

    executeRender(canvas, 4, Scene({ labels: ['only'] }));
    const removals = documentKeydownCaptureCalls(remove.mock.calls);
    expect(removals).toHaveLength(1);
    expect(removals[0][1]).toBe(firstAdds[0][1]);
    expect(canvas.hasAttribute('tabindex')).toBe(false);
    for (const type of DOM_FOCUS_HOST_EVENT_TYPES) {
      expect(eventRoot.nativeListeners?.count(type)).toBe(0);
      const adds = canvasEventCalls(canvasAdd.mock.calls, type);
      const removes = canvasEventCalls(canvasRemove.mock.calls, type);
      expect(adds).toHaveLength(1);
      expect(removes).toHaveLength(1);
      expect(removes[0][1]).toBe(adds[0][1]);
    }

    mounted.controller.dispose();
    mounted.controller.dispose();
    activeControllers.delete(mounted.controller);
    expect(documentKeydownCaptureCalls(remove.mock.calls)).toHaveLength(1);
  });

  it.each([
    ['old manager is visited before its replacement', false],
    ['replacement is visited before the old manager', true],
  ] as const)(
    'reuses one focus host when %s',
    (_label, reverseSlots) => {
    const add = vi.spyOn(document, 'addEventListener');
    const remove = vi.spyOn(document, 'removeEventListener');
    const OldHost = defineComp(() => focusManaged(Target({
      label: 'old',
      handlers: { onClick: noop },
    })));
    const NewHost = defineComp(() => focusManaged(Target({
      label: 'new',
      handlers: { onClick: noop },
    })));
    const Root = defineComp(({ replacement }: { replacement: boolean }) => {
      const oldSlot = replacement ? undefined : OldHost({ key: 'old' });
      const newSlot = replacement ? NewHost({ key: 'new' }) : undefined;
      return reverseSlots ? [newSlot, oldSlot] : [oldSlot, newSlot];
    });
    const canvas = createCanvas();
    const canvasAdd = vi.spyOn(canvas, 'addEventListener');
    const canvasRemove = vi.spyOn(canvas, 'removeEventListener');
    const mounted = mountAndRender(canvas, Root({ replacement: false }));
    const priorManager = mounted.manager;
    const eventRoot = getCRCInstance(canvas).eventRoot;
    const originalNativeListeners = new Map(
      DOM_FOCUS_HOST_EVENT_TYPES.map(type => [
        type,
        canvasEventCalls(canvasAdd.mock.calls, type)[0][1],
      ]),
    );
    expect(canvas.getAttribute('tabindex')).toBe('0');

    executeRender(canvas, 2, Root({ replacement: true }));
    const replacement = focusManager(canvas);
    expect(replacement).not.toBe(priorManager);
    expect(candidateLabels(replacement)).toEqual(['new']);
    expect(canvas.getAttribute('tabindex')).toBe('0');
    expect(documentKeydownCaptureCalls(add.mock.calls)).toHaveLength(1);
    expect(documentKeydownCaptureCalls(remove.mock.calls)).toHaveLength(0);
    for (const type of DOM_FOCUS_HOST_EVENT_TYPES) {
      expect(eventRoot.nativeListeners?.count(type)).toBe(1);
      const calls = canvasEventCalls(canvasAdd.mock.calls, type);
      expect(calls).toHaveLength(1);
      expect(calls[0][1]).toBe(originalNativeListeners.get(type));
      expect(canvasEventCalls(canvasRemove.mock.calls, type)).toHaveLength(0);
    }

    mounted.controller.dispose();
    activeControllers.delete(mounted.controller);
    expect(canvas.hasAttribute('tabindex')).toBe(false);
    expect(documentKeydownCaptureCalls(remove.mock.calls)).toHaveLength(1);
    for (const type of DOM_FOCUS_HOST_EVENT_TYPES) {
      expect(canvasEventCalls(canvasRemove.mock.calls, type)).toHaveLength(1);
    }
    },
  );

  it('enters logical focus before native focus routing after manager replacement', () => {
    const trace: string[] = [];
    const OldHost = defineComp(() => focusManaged(Target({
      label: 'old',
      handlers: { onClick: noop, onFocus: () => trace.push('old-focus') },
    })));
    const NewHost = defineComp(() => focusManaged(Target({
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

  it('keeps the committed host owner during a reentrant replacement render', () => {
    const trace: string[] = [];
    const documentAdd = vi.spyOn(document, 'addEventListener');
    let canvas: HTMLCanvasElement;
    let documentListenersDuringReplacement = 0;
    const OldHost = defineComp(() => Target({
      label: 'old',
      handlers: { onClick: noop, onFocus: () => trace.push('old-focus') },
    }));
    const NewHost = defineComp(() => {
      documentListenersDuringReplacement = documentKeydownCaptureCalls(
        documentAdd.mock.calls,
      ).length;
      canvas.focus({ preventScroll: true });
      return Target({
        label: 'new',
        handlers: { onClick: noop, onFocus: () => trace.push('new-focus') },
      });
    });
    const Root = defineComp(({ replacement }: { replacement: boolean }) =>
      replacement ?
        focusManaged(NewHost({ key: 'new' })) :
        focusManaged(OldHost({ key: 'old' }))
    );
    canvas = createCanvas();
    const canvasAdd = vi.spyOn(canvas, 'addEventListener');
    mountAndRender(canvas, Root({ replacement: false }));

    executeRender(canvas, 2, Root({ replacement: true }));

    expect(documentListenersDuringReplacement).toBe(1);
    expect(trace).toEqual(['old-focus']);
    for (const type of DOM_FOCUS_HOST_EVENT_TYPES) {
      expect(canvasEventCalls(canvasAdd.mock.calls, type)).toHaveLength(1);
    }

    canvas.blur();
    canvas.focus({ preventScroll: true });
    expect(trace).toEqual(['old-focus', 'new-focus']);
    expect(focusedLabel(focusManager(canvas))).toBe('new');
  });

  it('retains one host and listener when a cached layer replays its manager', () => {
    const add = vi.spyOn(document, 'addEventListener');
    const remove = vi.spyOn(document, 'removeEventListener');
    let renders = 0;
    const Inner = defineComp(() => {
      renders++;
      return focusManaged(Target({
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
    const canvasAdd = vi.spyOn(canvas, 'addEventListener');
    const canvasRemove = vi.spyOn(canvas, 'removeEventListener');
    const mounted = mountAndRender(canvas, Root({ generation: 1 }));
    const manager = mounted.manager;
    const eventRoot = getCRCInstance(canvas).eventRoot;

    executeRender(canvas, 2, Root({ generation: 2 }));

    expect(focusManager(canvas)).toBe(manager);
    expect(candidateLabels(manager)).toEqual(['cached']);
    expect(renders).toBe(1);
    expect(canvas.getAttribute('tabindex')).toBe('0');
    expect(documentKeydownCaptureCalls(add.mock.calls)).toHaveLength(1);
    expect(documentKeydownCaptureCalls(remove.mock.calls)).toHaveLength(0);
    for (const type of DOM_FOCUS_HOST_EVENT_TYPES) {
      expect(eventRoot.nativeListeners?.count(type)).toBe(1);
      expect(canvasEventCalls(canvasAdd.mock.calls, type)).toHaveLength(1);
      expect(canvasEventCalls(canvasRemove.mock.calls, type)).toHaveLength(0);
    }
  });

  it('releases the complete focus host after failed replacement and reacquires fresh on recovery', () => {
    const Throwing = defineComp(() => {
      throw new Error('expected focus-host replacement failure');
    });
    const OldHost = defineComp(() => Target({
      label: 'old',
      handlers: { onClick: noop },
    }));
    const BrokenHost = defineComp(() => [
      Target({ label: 'broken', handlers: { onClick: noop } }),
      Throwing({}),
    ]);
    const Root = defineComp(({ replacement }: { replacement: boolean }) =>
      replacement ?
        focusManaged(BrokenHost({ key: 'broken' })) :
        focusManaged(OldHost({ key: 'old' }))
    );
    const documentAdd = vi.spyOn(document, 'addEventListener');
    const documentRemove = vi.spyOn(document, 'removeEventListener');
    const canvas = createCanvas();
    canvas.setAttribute('tabindex', '-1');
    const canvasAdd = vi.spyOn(canvas, 'addEventListener');
    const canvasRemove = vi.spyOn(canvas, 'removeEventListener');
    const mounted = mountAndRender(canvas, Root({ replacement: false }));
    const eventRoot = getCRCInstance(canvas).eventRoot;
    const prior = mounted.manager;
    expect(canvas.getAttribute('tabindex')).toBe('0');

    expect(() => executeRender(
      canvas,
      2,
      Root({ replacement: true }),
    )).toThrowError('expected focus-host replacement failure');

    expect(eventRoot.focusPolicy).toBeUndefined();
    expect(prior.isDestroyed).toBe(true);
    expect(prior.candidates).toEqual([]);
    expect(canvas.getAttribute('tabindex')).toBe('-1');
    expect(documentKeydownCaptureCalls(documentAdd.mock.calls)).toHaveLength(1);
    expect(documentKeydownCaptureCalls(documentRemove.mock.calls)).toHaveLength(1);
    for (const type of DOM_FOCUS_HOST_EVENT_TYPES) {
      expect(eventRoot.nativeListeners?.count(type)).toBe(0);
      expect(canvasEventCalls(canvasRemove.mock.calls, type)).toHaveLength(1);
    }

    executeRender(canvas, 3, Root({ replacement: false }));
    const recovered = focusManager(canvas);
    expect(recovered).not.toBe(prior);
    expect(candidateLabels(recovered)).toEqual(['old']);
    expect(canvas.getAttribute('tabindex')).toBe('0');
    expect(documentKeydownCaptureCalls(documentAdd.mock.calls)).toHaveLength(2);
    expect(documentKeydownCaptureCalls(documentRemove.mock.calls)).toHaveLength(1);
    for (const type of DOM_FOCUS_HOST_EVENT_TYPES) {
      expect(eventRoot.nativeListeners?.count(type)).toBe(1);
      expect(canvasEventCalls(canvasAdd.mock.calls, type)).toHaveLength(2);
      expect(canvasEventCalls(canvasRemove.mock.calls, type)).toHaveLength(1);
    }
  });

  it('rejects a root OffscreenCanvas before acquiring a DOM focus host', () => {
    const canvas = new OffscreenCanvas(40, 40);
    const controller = mountCRC(canvas, managed(['only']));
    activeControllers.add(controller);

    expect(() => executeRender(canvas, 1)).toThrowError(
      /FocusManagement.*HTMLCanvasElement.*root|OffscreenCanvas.*focus host/i,
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
  return focusManaged(Scene({ labels }));
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

function dispatchBackgroundPress(canvas: HTMLCanvasElement): MouseEvent {
  const bounds = canvas.getBoundingClientRect();
  const event = new MouseEvent('mousedown', {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX: bounds.left + 250,
    clientY: bounds.top + 100,
  });
  canvas.dispatchEvent(event);
  return event;
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

function canvasEventCalls(
  calls: readonly (readonly unknown[])[],
  type: (typeof DOM_FOCUS_HOST_EVENT_TYPES)[number],
): (readonly unknown[])[] {
  return calls.filter(call => call[0] === type);
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
