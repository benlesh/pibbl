/** Active browser hit query: may flush layout; never implies pixel visibility. */
export function probeHostPoint(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
  type Status = 'canvas' | 'blocked' | 'empty' | 'out-of-viewport' | 'invalid' | 'unsupported' | 'unavailable';
  const result = (status: Status, targetTag: string | null = null) => Object.freeze({
    schema: 'pibbl-browser-point/1', scope: 'owner-document', coordinateSpace: 'client-css',
    ancestorFrames: 'unavailable', status, targetTag,
    point: Object.freeze({ x: clientX, y: clientY }),
  });
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return result('invalid');
  const document = canvas.ownerDocument;
  const view = document.defaultView;
  if (!canvas.isConnected || !view) return result('unavailable');
  if (canvas.getRootNode() !== document) return result('unsupported');
  if (clientX < 0 || clientY < 0 || clientX >= view.innerWidth || clientY >= view.innerHeight) return result('out-of-viewport');
  const target = document.elementFromPoint(clientX, clientY);
  return result(target === canvas ? 'canvas' : target ? 'blocked' : 'empty', target?.tagName.toLowerCase() ?? null);
}
