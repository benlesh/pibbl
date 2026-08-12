/**
 * AbortSignal is SLOW AS A DEAD TURTLE to deal with because of
 * addEventListener and removeEventListener. Strong avoid.
 */
export class Teardowns {
  private readonly _teardowns = new Set<() => void>();
  private _closed = false;

  get closed(): boolean {
    return this._closed;
  }

  follow(parentTeardown: Teardowns): void {
    const handler = () => {
      this.execute();
    };
    parentTeardown.add(handler);
    this.add(() => parentTeardown.remove(handler));
  }

  add(teardown: () => void): void {
    if (this._closed) {
      runTeardown(teardown);
    } else {
      this._teardowns.add(teardown);
    }
  }

  remove(teardown: () => void): void {
    this._teardowns.delete(teardown);
  }

  execute(): void {
    if (this._closed) {
      return;
    }

    this._closed = true;
    const teardowns = Array.from(this._teardowns);
    this._teardowns.clear();
    for (const teardown of teardowns) {
      runTeardown(teardown);
    }
  }
}

export function runTeardown(teardown: () => void): void {
  try {
    teardown();
  } catch (error) {
    try {
      reportError(error);
    } catch {
      // Error reporting must not prevent the remaining resources from releasing.
    }
  }
}
