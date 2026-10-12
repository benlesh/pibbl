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
interface Projection { registration: HtmlBoxRegistration; world: DOMMatrix; clips: Clip[]; opacity: number; }

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
  private rendered = new Set<HtmlBoxSlot>();
  constructor(private readonly root: PibblEventRoot) {}

  private enterTransaction(): void {
    const transaction = this.root.renderTransaction;
    if (!transaction) throw new Error('HtmlBox requires an active render transaction.');
    if (transaction === this.transaction) return;
    this.transaction = transaction;
    this.pending = new Map(this.snapshots);
    this.rendered = new Set();
    transaction.onPublish!(() => this.publish());
    transaction.onFinish(success => {
      if (!success) this.reset();
      this.pending = undefined;
      this.transaction = undefined;
      this.rendered.clear();
    });
  }

  beginRender(instance: PibblInstance): void {
    this.enterTransaction();
    this.pending!.set(instance, []);
  }

  suspend(instance: PibblInstance): void {
    if (instance !== this.root.rootInstance) return;
    this.enterTransaction();
    this.root.renderTransaction!.onPublish!(() => {
      this.root.focusPolicy?.suspendHtmlRegions?.();
      if (this.viewport) this.viewport.hidden = true;
      for (const slot of this.live) { slot.region.active = false; if (slot.shell) slot.shell.inert = true; }
    });
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

  private publish(): void {
    if (this.disposed || !this.pending) return;
    const canvas = this.root.canvas!;
    const overlay = this.root.htmlOverlay!;
    validateHtmlOverlay(canvas, overlay);
    const rootInstance = this.root.rootInstance!;
    if (rootInstance.surface.kind === 'root' && (!rootInstance.surface.display.width || !rootInstance.surface.display.height)) {
      this.root.focusPolicy?.suspendHtmlRegions?.();
      if (this.viewport) this.viewport.hidden = true;
      for (const slot of this.live) { slot.region.active = false; if (slot.shell) slot.shell.inert = true; }
      return;
    }
    const surface = rootInstance.surface.snapshot!;
    const rootMatrix = new DOMMatrix().scale(1 / surface.backingPixelsPerCssPixelX, 1 / surface.backingPixelsPerCssPixelY).multiply(surface.renderTransform);
    const projections: Projection[] = [];
    const visited = new Set<PibblInstance>();
    const walk = (instance: PibblInstance, world: DOMMatrix, clips: Clip[], opacity: number) => {
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
          if (![hostWorld.a,hostWorld.b,hostWorld.c,hostWorld.d,hostWorld.e,hostWorld.f].every(Number.isFinite)) throw new Error('HtmlBox transform must be finite.');
          projections.push({ registration: entry, world: hostWorld, clips: inherited, opacity: opacity * entry.opacity });
        }
      }
    };
    walk(rootInstance, new DOMMatrix(), [], 1);
    const desired = new Set(projections.map(p => p.registration.slot));
    for (const slot of this.live) if (!desired.has(slot)) this.retire(slot);
    if (projections.length) this.ensureDOM();
    if (this.viewport) this.viewport.hidden = false;
    for (const [index, projection] of projections.entries()) this.apply(projection, rootMatrix, index);
    this.snapshots = new Map([...this.pending].filter(([owner]) => visited.has(owner)));
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
    this.svg.style.cssText = 'position:absolute;pointer-events:none';
    this.root.htmlOverlay!.append(this.svg, this.viewport);
  }

  private apply(projection: Projection, rootMatrix: DOMMatrix, index: number): void {
    const { registration: r, world, clips, opacity } = projection;
    const slot = r.slot;
    const first = !slot.shell;
    const doc = this.root.canvas!.ownerDocument;
    if (first) {
      slot.shell = doc.createElement('div'); slot.shell.dataset.pibblHtmlBox = '';
      slot.shell.style.cssText = 'position:absolute;left:0;top:0;transform-origin:0 0;pointer-events:none;isolation:isolate';
      slot.content = doc.createElement('div'); slot.content.dataset.pibblHtmlContent = '';
      slot.content.style.cssText = 'position:absolute;box-sizing:border-box';
      slot.shell.append(slot.content); this.viewport!.append(slot.shell);
      slot.clipping = []; slot.abort = new (doc.defaultView!.AbortController)();
      slot.region.content = slot.content;
      this.live.add(slot);
    }
    const matrix = rootMatrix.multiply(world);
    const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
    const visible = r.border.width > 0 && r.border.height > 0 && determinant !== 0;
    slot.shell!.style.width = `${r.border.width}px`; slot.shell!.style.height = `${r.border.height}px`;
    slot.shell!.style.transform = cssMatrix(matrix); slot.shell!.style.zIndex = String(index);
    slot.shell!.style.opacity = String(opacity); slot.shell!.style.overflow = r.overflow;
    slot.content!.style.left = `${r.content.x}px`; slot.content!.style.top = `${r.content.y}px`;
    slot.content!.style.width = `${r.content.width}px`; slot.content!.style.height = `${r.content.height}px`;
    slot.content!.style.pointerEvents = r.interactive ? 'auto' : 'none';
    slot.shell!.inert = !visible || !r.interactive;
    slot.shell!.style.visibility = visible ? 'visible' : 'hidden';
    slot.region.active = visible && r.interactive;
    const corners = [[0,0],[r.border.width,0],[0,r.border.height],[r.border.width,r.border.height]].map(([x,y]) => world.transformPoint({x,y}));
    const xs = corners.map(p => p.x), ys = corners.map(p => p.y);
    slot.region.rootBounds = { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs)-Math.min(...xs), height: Math.max(...ys)-Math.min(...ys) };
    slot.callback = r.onFocusChange;
    if (visible) this.applyClips(slot, clips, world.inverse());
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
    slot.shell!.inert = !visible || !r.interactive;
    slot.shell!.style.visibility = visible ? 'visible' : 'hidden';
  }

  private applyClips(slot: HtmlBoxSlot, clips: Clip[], inverseWorld: DOMMatrix): void {
    const definitions = slot.clipping!;
    const doc = this.root.canvas!.ownerDocument;
    while (definitions.length < clips.length) {
      const definition = doc.createElementNS(SVG, 'clipPath');
      definition.id = `pibbl-html-clip-${++nextId}`;
      definition.setAttribute('clipPathUnits', 'userSpaceOnUse');
      definition.append(doc.createElementNS(SVG, 'path'));
      this.svg!.append(definition); definitions.push(definition);
    }
    clips.forEach((clip, index) => {
      const definition = definitions[index]; const path = definition.firstElementChild!;
      setAttribute(path, 'd', clip.data);
      setAttribute(path, 'clip-rule', clip.rule);
      setAttribute(path, 'transform', cssMatrix(inverseWorld.multiply(clip.matrix)));
      if (index + 1 < clips.length) setAttribute(definition, 'clip-path', `url(#${definitions[index+1].id})`);
      else definition.removeAttribute('clip-path');
    });
    slot.shell!.style.clipPath = clips.length ? `url(#${definitions[0].id})` : 'none';
    while (definitions.length > clips.length) definitions.pop()!.remove();
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
function setAttribute(element: Element, name: string, value: string): void { if (element.getAttribute(name) !== value) element.setAttribute(name, value); }
