import type { PibblInstance } from '../types.js';

const leases = new WeakMap<HTMLElement, PibblInstance>();

export function reserveHtmlOverlay(instance: PibblInstance, overlay: HTMLElement): void {
  const canvas = instance.eventRoot.canvas;
  if (!canvas || instance.parent) throw new Error('htmlOverlay requires an HTMLCanvasElement root, not a Layer.');
  if (overlay?.nodeType !== 1 || overlay.namespaceURI !== 'http://www.w3.org/1999/xhtml' ||
      overlay.ownerDocument !== canvas.ownerDocument || !overlay.isConnected || !canvas.isConnected ||
      canvas.parentElement !== overlay.parentElement || canvas.nextElementSibling !== overlay) {
    throw new Error('htmlOverlay must be a connected HTML element immediately after the canvas in the same parent and document.');
  }
  if (leases.has(overlay) || overlay.childNodes.length) throw new Error('htmlOverlay must be empty and exclusively owned by one Pibbl root.');
  leases.set(overlay, instance);
  instance.eventRoot.htmlOverlay = overlay;
  instance.mainTeardowns.add(() => {
    instance.eventRoot.html?.dispose();
    instance.eventRoot.html = undefined;
    instance.eventRoot.htmlOverlay = undefined;
    if (leases.get(overlay) === instance) leases.delete(overlay);
  });
}

export function validateHtmlOverlay(canvas: HTMLCanvasElement, overlay: HTMLElement): void {
  const view = canvas.ownerDocument.defaultView!;
  if (!canvas.isConnected || !overlay.isConnected || canvas.parentElement !== overlay.parentElement || canvas.nextElementSibling !== overlay) {
    throw new Error('HtmlBox overlay and canvas must remain connected adjacent siblings.');
  }
  for (const element of [canvas, overlay]) {
    const style = view.getComputedStyle(element);
    if (style.transform !== 'none' || ['paddingLeft','paddingRight','paddingTop','paddingBottom','borderLeftWidth','borderRightWidth','borderTopWidth','borderBottomWidth'].some(key => parseFloat(style[key as keyof CSSStyleDeclaration] as string) !== 0)) {
      throw new Error('HtmlBox canvas and overlay must have no independent CSS transform, padding, or border. Style their common wrapper instead.');
    }
  }
  if (Math.abs(canvas.clientWidth - overlay.clientWidth) > 1 || Math.abs(canvas.clientHeight - overlay.clientHeight) > 1 || canvas.offsetLeft !== overlay.offsetLeft || canvas.offsetTop !== overlay.offsetTop) {
    throw new Error('HtmlBox overlay must share the canvas content rectangle.');
  }
}
