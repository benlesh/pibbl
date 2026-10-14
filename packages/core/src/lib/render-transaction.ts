import type { PibblRenderTransaction } from './types.js';

/** Root-wide publications and ordinary commit callbacks precede completion observers. */
export class RootRenderTransaction implements PibblRenderTransaction {
  private publications = new Set<() => void>();
  private callbacks = new Set<(success: boolean) => void>();
  private afterFinishCallbacks = new Set<(success: boolean) => void>();
  private result: boolean | undefined;
  private afterFinishDelivered = false;

  onPublish(callback: () => void): void {
    if (this.result !== undefined) {
      if (this.result) callback();
    } else this.publications.add(callback);
  }

  onFinish(callback: (success: boolean) => void): void {
    if (this.result !== undefined) callback(this.result);
    else this.callbacks.add(callback);
  }

  onAfterFinish(callback: (success: boolean) => void): void {
    if (this.afterFinishDelivered) {
      callback(this.result!);
    } else {
      this.afterFinishCallbacks.add(callback);
    }
  }

  finish(success: boolean): void {
    if (this.result !== undefined) return;
    const errors: unknown[] = [];
    if (success) {
      for (const publish of this.publications) {
        try { publish(); } catch (error) { errors.push(error); success = false; break; }
      }
    }
    this.publications.clear();
    this.result = success;
    const callbacks = Array.from(this.callbacks);
    this.callbacks.clear();
    for (const callback of callbacks) {
      try { callback(success); } catch (error) { errors.push(error); }
    }
    while (this.afterFinishCallbacks.size) {
      const afterFinishCallbacks = Array.from(this.afterFinishCallbacks);
      this.afterFinishCallbacks.clear();
      for (const callback of afterFinishCallbacks) {
        try { callback(success); } catch (error) { errors.push(error); }
      }
    }
    this.afterFinishDelivered = true;
    if (errors.length === 1) throw errors[0];
    if (errors.length) throw new AggregateError(errors, 'Pibbl render completion failed.');
  }
}
