let prepared: WebAssembly.Module | undefined;
let preparedFingerprint: string | undefined;
let generation = 0;

interface PendingPreparation {
  readonly generation: number;
  readonly promise: Promise<void>;
  resolve(): void;
  reject(error: unknown): void;
}

let pending: PendingPreparation | undefined;

function createPendingPreparation(): PendingPreparation {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const currentGeneration = generation;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { generation: currentGeneration, promise, resolve, reject };
}

export function getPreparedLayoutModule(): WebAssembly.Module {
  if (!prepared) throw new Error('The layout engine has not been prepared.');
  return prepared;
}

export function publishPreparedLayoutModule(
  module: WebAssembly.Module,
  fingerprint: string,
): WebAssembly.Module {
  if (prepared) {
    if (preparedFingerprint !== fingerprint) {
      throw new Error('The prepared layout engine is incompatible with this binary.');
    }
    return prepared;
  }
  prepared = module;
  preparedFingerprint = fingerprint;
  if (pending) {
    const waiting = pending;
    pending = undefined;
    waiting.resolve();
  }
  return module;
}

export function prepareExternalLayoutModule(
  load: () => Promise<WebAssembly.Module>,
  fingerprint: string,
): Promise<void> {
  if (prepared) {
    if (preparedFingerprint !== fingerprint) {
      return Promise.reject(new Error('The prepared layout engine is incompatible with this binary.'));
    }
    return Promise.resolve();
  }
  if (pending) return pending.promise;

  const attempt = createPendingPreparation();
  pending = attempt;
  void load().then(
    module => {
      if (attempt.generation !== generation || prepared) return;
      try {
        publishPreparedLayoutModule(module, fingerprint);
      } catch (error) {
        if (pending === attempt) {
          pending = undefined;
          attempt.reject(error);
        }
      }
    },
    error => {
      if (attempt.generation !== generation || prepared || pending !== attempt) return;
      pending = undefined;
      attempt.reject(error);
    },
  );
  return attempt.promise;
}

/** @internal Focused loader-test isolation only. */
export function resetPreparedLayoutModuleForTest(): void {
  generation++;
  prepared = undefined;
  preparedFingerprint = undefined;
  pending = undefined;
}
