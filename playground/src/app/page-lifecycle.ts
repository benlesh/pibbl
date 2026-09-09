export interface Disposable {
  dispose(): void | Promise<void>;
}

export interface PageLifecycle {
  begin(): Promise<number>;
  isCurrent(version: number): boolean;
  setDisposable(version: number, disposable: Disposable): Promise<boolean>;
  setSurface(
    version: number,
    surface: Disposable,
  ): Promise<boolean>;
  dispose(): Promise<void>;
}

/**
 * Keeps route-owned resources in one place. Monaco workbenches always release
 * before scenario surfaces, matching the historical Studio teardown order.
 */
export function createPageLifecycle(): PageLifecycle {
  let activeDisposable: Disposable | undefined;
  let activeSurface: Disposable | undefined;
  let renderVersion = 0;

  async function clear(): Promise<void> {
    const disposable = activeDisposable;
    activeDisposable = undefined;
    await disposable?.dispose();

    const surface = activeSurface;
    activeSurface = undefined;
    await surface?.dispose();
  }

  async function replace<T extends Disposable>(
    version: number,
    value: T,
    assign: (value: T | undefined) => void,
  ): Promise<boolean> {
    if (version !== renderVersion) {
      await value.dispose();
      return false;
    }
    assign(value);
    return true;
  }

  return {
    async begin(): Promise<number> {
      const version = ++renderVersion;
      await clear();
      return version;
    },
    isCurrent(version: number): boolean {
      return version === renderVersion;
    },
    async setDisposable(
      version: number,
      disposable: Disposable,
    ): Promise<boolean> {
      return replace(version, disposable, (value) => {
        activeDisposable = value;
      });
    },
    async setSurface(
      version: number,
      surface: Disposable,
    ): Promise<boolean> {
      return replace(version, surface, (value) => {
        activeSurface = value;
      });
    },
    async dispose(): Promise<void> {
      // Invalidate every version already handed to an asynchronous page loader
      // before releasing the active resources it may otherwise replace.
      renderVersion++;
      await clear();
    },
  };
}
