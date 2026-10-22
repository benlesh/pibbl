interface MountRequest { cancel(): void }
const pendingMounts = new WeakMap<object, MountRequest>();

export function mountAbortError(): DOMException {
  return new DOMException('Pibbl mount was cancelled or superseded.', 'AbortError');
}

export function cancelPendingMount(canvas: object): void {
  pendingMounts.get(canvas)?.cancel();
}

/** One reservation per Canvas; no mutable mount state exists while loading. */
export function reserveMount(canvas: HTMLCanvasElement, signal?: AbortSignal) {
  if (signal?.aborted) throw mountAbortError();
  cancelPendingMount(canvas);
  let active = true;
  let reject!: (error: unknown) => void;
  const cancelled = new Promise<never>((_resolve, fail) => { reject = fail; });
  const request: MountRequest = { cancel() {
    if (!active) return;
    finish();
    reject(mountAbortError());
  } };
  function finish(): void {
    active = false;
    signal?.removeEventListener('abort', request.cancel);
    if (pendingMounts.get(canvas) === request) pendingMounts.delete(canvas);
  }
  pendingMounts.set(canvas, request);
  signal?.addEventListener('abort', request.cancel, { once: true });
  return {
    cancelled,
    assertCurrent() { if (!active || signal?.aborted || pendingMounts.get(canvas) !== request) throw mountAbortError(); },
    finish,
  };
}
