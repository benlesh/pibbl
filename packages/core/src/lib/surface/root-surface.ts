import type { CRCInstance } from '../types.js';
import { update } from '../update.js';
import { createLayerSurface, resolveSurface } from './resolve-surface.js';
import type {
  CRCConfig,
  CRCSurfaceSnapshot,
  LayerSurfaceState,
  RootSurfaceState,
  SurfaceDisplaySize,
} from './types.js';
import { validateSurfaceConfig } from './resolve-surface.js';

export function createRootSurfaceState(
  canvas: HTMLCanvasElement,
  config?: CRCConfig,
): RootSurfaceState {
  const resolved = validateSurfaceConfig(canvas, config);
  return {
    kind: 'root',
    config: resolved,
    display: readCanvasContentBox(canvas),
    pixelRatio: readRequestedPixelRatio(resolved.pixelRatio),
    snapshot: undefined,
    ownedWidth: undefined,
    ownedHeight: undefined,
  };
}

export function createLegacyLayerSurfaceState(
  width: number,
  height: number,
): LayerSurfaceState {
  return {
    kind: 'layer',
    managed: false,
    snapshot: createLayerSurface(width, height, 1, 1),
  };
}

export function mountRootSurface(
  instance: CRCInstance,
  canvas: HTMLCanvasElement,
): void {
  const state = instance.surface;
  if (state.kind !== 'root') return;

  if (typeof ResizeObserver !== 'function') {
    throw new Error('CRC requires ResizeObserver for Canvas surface sizing.');
  }

  const resizeObserver = new ResizeObserver(() => {
    const display = readCanvasContentBox(canvas);
    if (setDisplaySize(state, display)) {
      update(canvas);
    }
  });
  resizeObserver.observe(canvas);
  instance.mainTeardowns.add(() => resizeObserver.disconnect());

  instance.mainTeardowns.add(() => {
    restoreOwnedSize(canvas, 'width', state.ownedWidth);
    restoreOwnedSize(canvas, 'height', state.ownedHeight);
  });

  if (state.config.pixelRatio === 'device') {
    mountDensityObservers(instance, canvas, state);
  }
}

export function prepareSurface(
  instance: CRCInstance,
): CRCSurfaceSnapshot | undefined {
  const state = instance.surface;
  if (state.kind === 'layer') {
    if (!state.managed) {
      state.snapshot = createLayerSurface(
        instance.canvas.width,
        instance.canvas.height,
        1,
        1,
      );
    }
    return state.snapshot;
  }

  const canvas = instance.canvas as HTMLCanvasElement;
  state.display = readCanvasContentBox(canvas);
  if (state.config.pixelRatio === 'device') {
    state.pixelRatio = readRequestedPixelRatio('device');
  }
  let snapshot = resolveSurface(state.config, state.display, state.pixelRatio);
  state.snapshot = snapshot;
  if (!snapshot) return undefined;

  const before = state.display;
  const dimensionsChanged = canvas.width !== snapshot.backingWidth ||
    canvas.height !== snapshot.backingHeight;
  if (dimensionsChanged) {
    canvas.width = snapshot.backingWidth;
    canvas.height = snapshot.backingHeight;
    const after = readCanvasContentBox(canvas);
    if (!nearlyEqual(after.width, before.width)) {
      state.ownedWidth = ownInlineSize(
        canvas,
        'width',
        before.width,
        state.ownedWidth,
      );
    }
    if (!nearlyEqual(after.height, before.height)) {
      state.ownedHeight = ownInlineSize(
        canvas,
        'height',
        before.height,
        state.ownedHeight,
      );
    }
    const stabilized = readCanvasContentBox(canvas);
    if (setDisplaySize(state, stabilized)) {
      snapshot = resolveSurface(state.config, stabilized, state.pixelRatio);
      state.snapshot = snapshot;
      if (!snapshot) return undefined;
      if (
        canvas.width !== snapshot.backingWidth ||
        canvas.height !== snapshot.backingHeight
      ) {
        canvas.width = snapshot.backingWidth;
        canvas.height = snapshot.backingHeight;
      }
    }
  }
  return snapshot;
}

export function readCanvasContentBox(
  canvas: HTMLCanvasElement,
): SurfaceDisplaySize {
  const rect = canvas.getBoundingClientRect();
  const style = getComputedStyle(canvas);
  return {
    width: Math.max(0, rect.width - boxInsets(style, 'width')),
    height: Math.max(0, rect.height - boxInsets(style, 'height')),
  };
}

function mountDensityObservers(
  instance: CRCInstance,
  canvas: HTMLCanvasElement,
  state: RootSurfaceState,
): void {
  let mediaQuery: MediaQueryList | undefined;
  let closed = false;
  const onDensityChange = () => {
    if (closed) return;
    const next = readRequestedPixelRatio('device');
    bindMediaQuery(next);
    if (next !== state.pixelRatio) {
      state.pixelRatio = next;
      update(canvas);
    }
  };
  const bindMediaQuery = (ratio: number) => {
    mediaQuery?.removeEventListener('change', onDensityChange);
    mediaQuery = matchMedia(`(resolution: ${ratio}dppx)`);
    mediaQuery.addEventListener('change', onDensityChange);
  };

  bindMediaQuery(state.pixelRatio);
  window.addEventListener('resize', onDensityChange);
  instance.mainTeardowns.add(() => {
    closed = true;
    mediaQuery?.removeEventListener('change', onDensityChange);
    window.removeEventListener('resize', onDensityChange);
  });
}

function readRequestedPixelRatio(requested: 'device' | number): number {
  if (requested !== 'device') return requested;
  const ratio = window.devicePixelRatio;
  return Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
}

function setDisplaySize(
  state: RootSurfaceState,
  display: SurfaceDisplaySize,
): boolean {
  if (
    nearlyEqual(state.display.width, display.width) &&
    nearlyEqual(state.display.height, display.height)
  ) {
    return false;
  }
  state.display = display;
  return true;
}

function ownInlineSize(
  canvas: HTMLCanvasElement,
  property: 'width' | 'height',
  value: number,
  current: RootSurfaceState['ownedWidth'],
) {
  const owned = `${value}px`;
  const previous = current?.previous ?? canvas.style[property];
  canvas.style[property] = owned;
  return { previous, owned };
}

function restoreOwnedSize(
  canvas: HTMLCanvasElement,
  property: 'width' | 'height',
  record: RootSurfaceState['ownedWidth'],
): void {
  if (record && canvas.style[property] === record.owned) {
    canvas.style[property] = record.previous;
  }
}

function boxInsets(
  style: CSSStyleDeclaration,
  axis: 'width' | 'height',
): number {
  const values = axis === 'width' ?
    [style.borderLeftWidth, style.borderRightWidth, style.paddingLeft, style.paddingRight] :
    [style.borderTopWidth, style.borderBottomWidth, style.paddingTop, style.paddingBottom];
  return values.reduce((total, value) => total + (Number.parseFloat(value) || 0), 0);
}

function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.01;
}
