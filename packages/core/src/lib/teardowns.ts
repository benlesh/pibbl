/**
 * AbortSignal is SLOW AS A DEAD TURTLE to deal with because of
 * addEventListener and removeEventListener. Strong avoid.
 */
export class Teardowns {
  private readonly _teardowns = new Set<() => void>();
  private _closed = false;

  get closed() {
    return this._closed;
  }

  follow(parentTeardown: Teardowns) {
    const handler = () => {
      this.execute();
    };
    parentTeardown.add(handler);
    this.add(() => parentTeardown.remove(handler));
  }

  add(teardown: () => void) {
    if (this._closed) {
      teardown();
    } else {
      this._teardowns.add(teardown);
    }
  }

  remove(teardown: () => void) {
    this._teardowns.delete(teardown);
  }

  execute() {
    if (!this._closed) {
      this._closed = true;
      for (const teardown of this._teardowns) {
        teardown();
      }
      this._teardowns.clear();
    }
  }
}
