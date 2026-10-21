/** One pending public mount/update request per canvas; no renderer state is acquired here. */
interface MountRequest {
  waitUntilReady(ready: Promise<void>): Promise<void>;
  assertCurrent(): void;
  finish(): void;
  cancel(message: string): void;
}
const pending = new WeakMap<object, MountRequest>();

export function reserveMountRequest(
  canvas: object,
  signal?: AbortSignal,
): MountRequest {
  if (signal?.aborted)
    throw new DOMException("Pibbl mount was aborted.", "AbortError");
  pending.get(canvas)?.cancel("Pibbl mount was superseded by a newer request.");
  let cancellation: DOMException | undefined;
  let rejectWaiting: ((reason: unknown) => void) | undefined;
  const detach = () => signal?.removeEventListener("abort", onAbort);
  const request: MountRequest = {
    waitUntilReady(ready) {
      return new Promise<void>((resolve, reject) => {
        rejectWaiting = reject;
        ready.then(resolve, reject);
        if (cancellation) reject(cancellation);
      });
    },
    assertCurrent() {
      if (cancellation) throw cancellation;
      if (signal?.aborted || pending.get(canvas) !== request) {
        throw new DOMException(
          "Pibbl mount is no longer current.",
          "AbortError",
        );
      }
    },
    finish() {
      detach();
      rejectWaiting = undefined;
      if (pending.get(canvas) === request) pending.delete(canvas);
    },
    cancel(message) {
      if (cancellation) return;
      cancellation = new DOMException(message, "AbortError");
      detach();
      if (pending.get(canvas) === request) pending.delete(canvas);
      rejectWaiting?.(cancellation);
      rejectWaiting = undefined;
    },
  };
  function onAbort() {
    request.cancel("Pibbl mount was aborted.");
  }
  pending.set(canvas, request);
  signal?.addEventListener("abort", onAbort, { once: true });
  if (signal?.aborted) onAbort();
  return request;
}

/** Disposal must not let an already pending update resurrect the released mount. */
export function invalidatePendingMount(canvas: object): void {
  pending
    .get(canvas)
    ?.cancel("Pibbl mount was cancelled because its canvas was disposed.");
}
