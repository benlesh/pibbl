import { HtmlNativeEvents, type HtmlNativeEventSnapshot } from './html-events.js';
import { stageLayoutHtmlGeometry } from '../layout/geometry-publication.js';
import { isLayoutComponentSuspended, isLayoutInstanceSuspended } from '../layout/participation.js';
import { GLOBAL_STATE } from '../global-state.js';
import { withSignalWriteForbidden } from '../signals/graph.js';
import type { PibblClippingStackEntry, PibblEventRoot, PibblInstance, PibblInteractionLayer, PibblRenderTransaction } from '../types.js';
import type { HtmlBoxRegistration, HtmlBoxSlot, HtmlBridge } from './types.js';
import { validateHtmlOverlay } from './overlay-config.js';
import { rectangleSvg } from './portable-clips.js';

const SVG = 'http://www.w3.org/2000/svg';
let nextId = 0;
type Entry = HtmlBoxRegistration | { child: PibblInstance; matrix: DOMMatrix; clips: readonly PibblClippingStackEntry[]; opacity: number; bounds: {x:number;y:number;width:number;height:number} };
type Clip = { data: string; matrix: DOMMatrix; rule: CanvasFillRule };
interface Projection { events?: HtmlNativeEventSnapshot; world: DOMMatrix; rootMatrix: DOMMatrix; transformCss?: string; definitions?: SVGClipPathElement[]; clipPath?: string; registration: HtmlBoxRegistration; matrix: DOMMatrix; bounds: { x: number; y: number; width: number; height: number }; visible: boolean; clips: Clip[]; opacity: number; }

export function requireHtmlService(owner: PibblInstance): HtmlService {
  const root = owner.eventRoot;
  if (!root.htmlOverlay || !root.canvas) throw new Error('HtmlBox requires an HTMLCanvasElement root configured with htmlOverlay.');
  return (root.html ??= new HtmlService(root)) as HtmlService;
}

export class HtmlService implements HtmlBridge {
  private snapshots = new Map<PibblInstance, Entry[]>();
  private pending: Map<PibblInstance, Entry[]> | undefined;
  private transaction: PibblRenderTransaction | undefined;
  private live = new Set<HtmlBoxSlot>();
  private svg: SVGSVGElement | undefined;
  private viewport: HTMLDivElement | undefined;
  private disposed = false;
  private suspended = false;
  private projections: Projection[] | undefined;
  private nextSnapshots: Map<PibblInstance, Entry[]> | undefined;
  private rendered = new Set<HtmlBoxSlot>();
  constructor(private readonly root: PibblEventRoot) {}

  private enterTransaction(): void {
    const transaction = this.root.renderTransaction;
    if (!transaction) throw new Error('HtmlBox requires an active render transaction.');
    if (transaction === this.transaction) return;
    this.transaction = transaction;
    this.pending = new Map(this.snapshots);
    this.rendered = new Set();
    this.suspended = false;
    transaction.onPreflight!(() => this.prepare());
    transaction.onPublish!(() => this.publish());
    transaction.onAdopt!(() => this.adopt());
    transaction.onFinish(success => {
      if (!success && transaction.failed !== false) this.reset();
      this.pending = undefined;
      this.transaction = undefined;
      this.rendered.clear();
      this.projections = undefined;
      this.nextSnapshots = undefined;
    });
  }

  beginRender(instance: PibblInstance): void {
    this.enterTransaction();
    this.pending!.set(instance, []);
  }

  suspend(instance: PibblInstance): void {
    if (instance !== this.root.rootInstance) return;
    this.enterTransaction();
    this.suspended = true;
  }

  register(registration: HtmlBoxRegistration): void {
    assertEffects();
    this.enterTransaction();
    const owner = registration.slot.owner;
    let entries = this.pending!.get(owner);
    // A service first created during this render has no candidate array yet.
    if (!entries || entries === this.snapshots.get(owner)) this.pending!.set(owner, entries = []);
    entries.push(registration);
    this.rendered.add(registration.slot);
    this.root.focusPolicy?.observeHtmlRegion?.(registration.slot.region);
  }

  recordLayer(parent: PibblInstance, child: PibblInstance, bridge: PibblInteractionLayer, opacity: number, composite: GlobalCompositeOperation): void {
    this.enterTransaction();
    if (this.hasHosts(child)) {
      assertEffects(composite);
      const entries = this.pending!.get(parent) ?? [];
      if (!this.pending!.has(parent)) this.pending!.set(parent, entries);
      entries.push({ child, matrix: copy(bridge.transform), clips: snapshotClips(bridge.clippingStack), opacity,
        bounds: { x: 0, y: 0, width: child.rootLayoutBox.width, height: child.rootLayoutBox.height } });
    }
  }

  private hasHosts(instance: PibblInstance): boolean {
    return (this.pending?.get(instance) ?? this.snapshots.get(instance) ?? []).length > 0;
  }

  release(slot: HtmlBoxSlot): void {
    if (slot.disposed) return;
    const transaction = this.root.renderTransaction;
    if (transaction) {
      transaction.onPublish!(() => this.retire(slot));
      transaction.onFinish(success => { if (!success) this.retire(slot); });
    } else this.retire(slot);
  }

  private retire(slot: HtmlBoxSlot): void {
    if (slot.disposed) return;
    slot.disposed = true;
    slot.events?.dispose();
    slot.region.active = false;
    this.root.focusPolicy?.removeHtmlFocusRegion?.(slot.region);
    try { withSignalWriteForbidden('HtmlBox abort cleanup', () => slot.abort?.abort()); }
    finally {
      slot.shell?.remove();
      for (const clip of slot.clipping ?? []) clip.remove();
      slot.clipping = [];
      slot.update = undefined;
      slot.region.content = undefined;
      this.live.delete(slot);
    }
  }

  private prepare(): void {
    if (this.disposed || !this.pending) return;
    const canvas = this.root.canvas!;
    const overlay = this.root.htmlOverlay!;
    validateHtmlOverlay(canvas, overlay);
    const rootInstance = this.root.rootInstance!;
    if (rootInstance.surface.kind === 'root' && (!rootInstance.surface.display.width || !rootInstance.surface.display.height)) {
      this.suspended = true;
      for (const slot of this.live) stageLayoutHtmlGeometry(this.transaction!, slot.region, {
        active: false, bounds: slot.region.rootBounds ?? { x: 0, y: 0, width: 0, height: 0 },
      });
      return;
    }
    const surface = rootInstance.surface.snapshot!;
    const rootMatrix = new DOMMatrix().scale(1 / surface.backingPixelsPerCssPixelX, 1 / surface.backingPixelsPerCssPixelY).multiply(surface.renderTransform);
    const projections: Projection[] = [];
    const visited = new Set<PibblInstance>();
    const walk = (
      instance: PibblInstance,
      world: DOMMatrix,
      clips: Clip[],
      opacity: number,
    ) => {
      visited.add(instance);
      for (const entry of this.pending!.get(instance) ?? []) {
        const inherited = clips.concat(entry.clips.map(clip => {
          if (clip.svgPath === undefined) throw new Error('HtmlBox cannot project a native Path2D clip. Use PathGeometry for clips enclosing HtmlBox.');
          return { data: clip.svgPath, rule: clip.fillRule, matrix: world.multiply(clip.transform) };
        }));
        if ('child' in entry) {
          const childWorld = world.multiply(entry.matrix);
          walk(entry.child, childWorld, inherited.concat({ data: rectangleSvg(entry.bounds), matrix: childWorld, rule: 'nonzero' }), opacity * entry.opacity);
        } else if (!entry.slot.disposed) {
          const hostWorld = world.multiply(entry.matrix);
          if (!(
            Number.isFinite(hostWorld.a) &&
            Number.isFinite(hostWorld.b) &&
            Number.isFinite(hostWorld.c) &&
            Number.isFinite(hostWorld.d) &&
            Number.isFinite(hostWorld.e) &&
            Number.isFinite(hostWorld.f)
          ))
            throw new Error('HtmlBox transform must be finite.');
          projections.push(prepareProjection(entry, hostWorld, rootMatrix, inherited, opacity * entry.opacity));
        }
      }
    };
    walk(rootInstance, new DOMMatrix(), [], 1);
    for (const projection of projections) {
      projection.transformCss = cssMatrix(projection.matrix);
      const slot = projection.registration.slot;
      slot.events ??= new HtmlNativeEvents(slot, () => this.svg!, target => {
        const doc = this.root.canvas!.ownerDocument;
        if (!(target instanceof doc.defaultView!.Node)) return null;
        for (const candidate of this.live) {
          if (candidate.events?.node.live && candidate.shell?.contains(target)) return candidate.events.node;
        }
        return null;
      });
      projection.events = slot.events.prepare(projection.registration.handlers, projection.world,
        projection.rootMatrix, projection.visible && projection.registration.interactive);
      stageLayoutHtmlGeometry(this.transaction!, projection.registration.slot.region, {
        bounds: projection.bounds, active: projection.visible && projection.registration.interactive,
      });
    }
    this.projections = projections;
    this.nextSnapshots = new Map([...this.pending].filter(([owner]) => visited.has(owner)));
  }

  private publish(): void {
    if (this.suspended) { this.root.focusPolicy?.suspendHtmlRegions?.(); return; }
    const projections = this.projections;
    if (!projections || this.disposed) return;
    const desired = new Set(projections.map(p => p.registration.slot));
    for (const slot of this.live) if (!desired.has(slot)) {
      if (!slot.owner.mainTeardowns.closed && (isLayoutComponentSuspended(slot.component) || isLayoutInstanceSuspended(slot.owner))) {
        slot.region.active = false; slot.events?.suspend();
        this.root.focusPolicy?.removeHtmlFocusRegion?.(slot.region);
        if (slot.shell) { slot.shell.inert = true; slot.shell.style.visibility = 'hidden'; }
      } else this.retire(slot);
    }
    if (projections.length) this.ensureDOM();
    for (const projection of projections) this.prepareClips(projection);
    for (const projection of projections) {
      const slot = projection.registration.slot;
      if ((!projection.visible || !projection.registration.interactive) && slot.region.active) {
        this.root.focusPolicy?.removeHtmlFocusRegion?.(slot.region);
        const active = this.root.canvas!.ownerDocument.activeElement;
        if (active instanceof HTMLElement && slot.content?.contains(active)) active.blur();
      }
      this.publishContent(projection);
    }
  }

  private adopt(): void {
    if (this.disposed) return;
    if (this.suspended) {
      if (this.viewport) this.viewport.hidden = true;
      for (const slot of this.live) { slot.region.active = false; slot.events?.suspend(); if (slot.shell) slot.shell.inert = true; }
      return;
    }
    if (!this.projections) return;
    if (this.viewport) this.viewport.hidden = false;
    for (let index = 0; index < this.projections.length; index++) this.applyGeometry(this.projections[index], index);
    this.snapshots = this.nextSnapshots!;
  }

  private ensureDOM(): void {
    if (this.viewport) return;
    const doc = this.root.canvas!.ownerDocument;
    this.viewport = doc.createElement('div');
    this.viewport.dataset.pibblHtmlViewport = '';
    this.viewport.style.cssText = 'position:absolute;inset:0;overflow:clip;pointer-events:none';
    this.svg = doc.createElementNS(SVG, 'svg');
    this.svg.setAttribute('width', '0'); this.svg.setAttribute('height', '0');
    this.svg.setAttribute('aria-hidden', 'true');
    this.svg.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none';
    this.root.htmlOverlay!.append(this.svg, this.viewport);
  }

  private publishContent(projection: Projection): void {
    const r = projection.registration;
    const slot = r.slot;
    const first = !slot.shell;
    const doc = this.root.canvas!.ownerDocument;
    if (first) {
      slot.shell = doc.createElement('div'); slot.shell.dataset.pibblHtmlBox = '';
      slot.shell.style.cssText = 'position:absolute;left:0;top:0;transform-origin:0 0;pointer-events:none;isolation:isolate;opacity:0';
      slot.content = doc.createElement('div'); slot.content.dataset.pibblHtmlContent = '';
      slot.content.style.cssText = 'position:absolute;box-sizing:border-box';
      slot.shell.append(slot.content); this.viewport!.append(slot.shell);
      slot.clipping = []; slot.abort = new (doc.defaultView!.AbortController)();
      slot.region.content = slot.content;
      this.live.add(slot);
    }
    slot.events!.prepareListeners(projection.events!);
    try {
      if (first) {
        const update = withSignalWriteForbidden('HtmlBox mount', () => slot.mount(slot.content!, r.data, slot.abort!.signal));
        if (typeof update !== 'function') throw new TypeError('HtmlBox mount must synchronously return an update function.');
        slot.update = update;
      } else if (this.rendered.has(slot)) {
        const result: unknown = withSignalWriteForbidden('HtmlBox update', () => slot.update!(r.data));
        if (result && typeof (result as PromiseLike<unknown>).then === 'function') throw new TypeError('HtmlBox update must be synchronous.');
      }
    } catch (error) { this.retire(slot); throw error; }
  }

  private applyGeometry(projection: Projection, index: number): void {
    const { registration: r, bounds, visible, opacity } = projection;
    const slot = r.slot;
    if (slot.disposed) return;
    slot.shell!.style.width = `${r.border.width}px`; slot.shell!.style.height = `${r.border.height}px`;
    slot.shell!.style.transform = projection.transformCss!; slot.shell!.style.zIndex = String(index);
    slot.shell!.style.opacity = String(opacity); slot.shell!.style.overflow = r.overflow;
    slot.content!.style.left = `${r.content.x}px`; slot.content!.style.top = `${r.content.y}px`;
    slot.content!.style.width = `${r.content.width}px`; slot.content!.style.height = `${r.content.height}px`;
    slot.content!.style.pointerEvents = r.interactive ? 'auto' : 'none';
    slot.shell!.inert = !visible || !r.interactive;
    slot.shell!.style.visibility = visible ? 'visible' : 'hidden';
    slot.region.active = visible && r.interactive;
    slot.region.rootBounds = bounds;
    slot.callback = r.onFocusChange;
    slot.events!.adopt(projection.events!);
    if (visible) {
      const previous = slot.clipping;
      slot.clipping = projection.definitions!;
      slot.shell!.style.clipPath = projection.clipPath!;
      if (previous !== slot.clipping) for (const definition of previous ?? []) definition.remove();
    }
  }

  private prepareClips(projection: Projection): void {
    if (!projection.visible) return;
    const slot = projection.registration.slot;
    const clips = projection.clips;
    const previous = slot.clipping;
    let unchanged = previous?.length === clips.length;
    const matrices: string[] = [];
    for (let index = 0; index < clips.length; index++) {
      const clip = clips[index];
      matrices.push(cssMatrix(clip.matrix));
      const path = previous?.[index]?.firstElementChild;
      if (!path || path.getAttribute('d') !== clip.data || path.getAttribute('clip-rule') !== clip.rule ||
          path.getAttribute('transform') !== matrices[index]) unchanged = false;
    }
    if (unchanged) {
      projection.definitions = previous;
      projection.clipPath = clips.length ? `url(#${previous![0].id})` : 'none';
      return;
    }
    const definitions: SVGClipPathElement[] = [];
    const doc = this.root.canvas!.ownerDocument;
    for (let index = 0; index < clips.length; index++) {
      const definition = doc.createElementNS(SVG, 'clipPath');
      definition.id = `pibbl-html-clip-${++nextId}`;
      definition.setAttribute('clipPathUnits', 'userSpaceOnUse');
      const path = doc.createElementNS(SVG, 'path');
      path.setAttribute('d', clips[index].data);
      path.setAttribute('clip-rule', clips[index].rule);
      path.setAttribute('transform', matrices[index]);
      definition.append(path); definitions.push(definition);
    }
    for (let index = 0; index + 1 < definitions.length; index++) definitions[index].firstElementChild!.setAttribute('clip-path', `url(#${definitions[index + 1].id})`);
    // New definitions cannot affect the live shell until its clip-path is adopted.
    for (const definition of definitions) this.svg!.append(definition);
    projection.definitions = definitions;
    projection.clipPath = definitions.length ? `url(#${definitions[0].id})` : 'none';
  }

  private reset(): void {
    for (const slot of this.live) this.retire(slot);
    this.snapshots.clear();
    this.viewport?.remove(); this.svg?.remove(); this.viewport = undefined; this.svg = undefined;
  }
  dispose(): void { if (this.disposed) return; this.disposed = true; this.reset(); }
}

function assertEffects(composite = GLOBAL_STATE.renderContext?.globalCompositeOperation): void {
  if (GLOBAL_STATE.htmlFilterDepth || composite !== 'source-over') throw new Error('HtmlBox cannot be enclosed by Canvas filters or non-default compositing. Use CSS effects inside its content instead.');
}
function copy(matrix: DOMMatrixReadOnly): DOMMatrix { return new DOMMatrix([matrix.a,matrix.b,matrix.c,matrix.d,matrix.e,matrix.f]); }
export function snapshotClips(clips: readonly PibblClippingStackEntry[]): PibblClippingStackEntry[] {
  return clips.map(clip => ({ ...clip, transform: copy(clip.transform) }));
}
function cssMatrix(m: DOMMatrixReadOnly): string { return `matrix(${m.a},${m.b},${m.c},${m.d},${m.e},${m.f})`; }


/** Settle all fallible numeric projection work before publishing any host. */
function prepareProjection(registration: HtmlBoxRegistration, world: DOMMatrix, rootMatrix: DOMMatrix, clips: Clip[], opacity: number): Projection {
  const matrix = rootMatrix.multiply(world);
  assertFiniteProjectionMatrix(matrix);
  const width = registration.border.width;
  const height = registration.border.height;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let space = 0; space < 2; space++) {
    const transform = space === 0 ? world : matrix;
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    for (let corner = 0; corner < 4; corner++) {
      const x = corner & 1 ? width : 0;
      const y = corner & 2 ? height : 0;
      const projectedX = transform.a * x + transform.c * y + transform.e;
      const projectedY = transform.b * x + transform.d * y + transform.f;
      if (!Number.isFinite(projectedX) || !Number.isFinite(projectedY)) throw new Error('HtmlBox projection must be finite.');
      left = Math.min(left, projectedX); top = Math.min(top, projectedY);
      right = Math.max(right, projectedX); bottom = Math.max(bottom, projectedY);
    }
    if (!Number.isFinite(right - left) || !Number.isFinite(bottom - top)) throw new Error('HtmlBox projection must be finite.');
    if (space === 0) { minX = left; minY = top; maxX = right; maxY = bottom; }
  }
  const bounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  if (!Number.isFinite(bounds.width) || !Number.isFinite(bounds.height)) throw new Error('HtmlBox projection must be finite.');
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
  if (Number.isNaN(determinant)) throw new Error('HtmlBox projection must be finite.');
  const visible = width > 0 && height > 0 && determinant !== 0;
  const localClips: Clip[] = [];
  if (visible && clips.length) {
    const inverse = world.inverse();
    assertFiniteProjectionMatrix(inverse);
    for (const clip of clips) {
      const local = inverse.multiply(clip.matrix);
      assertFiniteProjectionMatrix(local);
      localClips.push({ data: clip.data, rule: clip.rule, matrix: local });
    }
  }
  return { registration, world, rootMatrix, matrix, bounds, visible, clips: localClips, opacity };
}
function assertFiniteProjectionMatrix(matrix: DOMMatrixReadOnly): void {
  if (!(Number.isFinite(matrix.a) && Number.isFinite(matrix.b) && Number.isFinite(matrix.c) && Number.isFinite(matrix.d) && Number.isFinite(matrix.e) && Number.isFinite(matrix.f))) throw new Error('HtmlBox projection must be finite.');
}
