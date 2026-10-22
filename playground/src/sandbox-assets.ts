// Only these public, noncredentialed assets may be fetched by the host for an
// opaque-origin preview. User-authored fetches keep normal browser behavior.
const textAssets = new Set([
  "/pibbl-layout/layout.wasm",
  "/pibbl-text/engine.mjs",
  "/pibbl-text/engine.wasm",
  "/pibbl-text/ABeeZee-Regular.ttf",
  "/pibbl-text/Lato-Regular.ttf",
]);

function sandboxAssetBase(origin: string): string {
  const path = new URL(import.meta.env.BASE_URL ?? "/", origin).pathname;
  return path.endsWith("/") ? path : `${path}/`;
}

export function isSandboxAsset(url: URL, origin: string): boolean {
  const base = sandboxAssetBase(origin);
  return (
    url.origin === origin &&
    !url.search &&
    !url.hash &&
    url.pathname.startsWith(base) &&
    textAssets.has(`/${url.pathname.slice(base.length)}`)
  );
}

/** Runs inside the iframe before the runtime and lesson are evaluated. */
export function installSandboxAssetFetch(options: {
  protocol: string;
  version: number;
  runId: number;
  paths: readonly string[];
}): void {
  const nativeFetch = globalThis.fetch.bind(globalThis);
  const origin = new URL(document.baseURI).origin;
  globalThis.fetch = async (input, init) => {
    const url = new URL(
      input instanceof Request ? input.url : String(input),
      document.baseURI,
    );
    const method =
      init?.method ?? (input instanceof Request ? input.method : "GET");
    if (
      method.toUpperCase() !== "GET" ||
      url.origin !== origin ||
      url.search ||
      url.hash ||
      !options.paths.includes(url.pathname)
    ) {
      return nativeFetch(input, init);
    }
    const request = new Request(input, init);
    return new Promise<Response>((resolve, reject) => {
      const channel = new MessageChannel();
      const close = () => {
        request.signal.removeEventListener("abort", abort);
        channel.port1.close();
      };
      const abort = () => {
        close();
        reject(request.signal.reason);
      };
      if (request.signal.aborted) {
        channel.port2.close();
        abort();
        return;
      }
      request.signal.addEventListener("abort", abort, { once: true });
      channel.port1.onmessage = ({ data }) => {
        close();
        if (data.error) reject(new TypeError(data.error));
        else
          resolve(
            new Response(data.body, {
              status: data.status,
              headers: data.headers,
            }),
          );
      };
      parent.postMessage(
        {
          protocol: options.protocol,
          version: options.version,
          runId: options.runId,
          kind: "asset",
          url: url.href,
        },
        "*",
        [channel.port2],
      );
    });
  };
}

export async function respondWithSandboxAsset(
  url: string,
  port: MessagePort,
  signal: AbortSignal,
): Promise<void> {
  try {
    const asset = new URL(url);
    if (!isSandboxAsset(asset, window.location.origin))
      throw new Error("Unsupported preview asset.");
    const response = await fetch(asset, {
      signal,
      credentials: "omit",
      redirect: "error",
    });
    const body = await response.arrayBuffer();
    port.postMessage(
      {
        body,
        status: response.status,
        headers: {
          "Content-Type":
            response.headers.get("Content-Type") ?? "application/octet-stream",
        },
      },
      [body],
    );
  } catch (error) {
    port.postMessage({
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    port.close();
  }
}

// Functions are serialized into the opaque-origin iframe, without importing
// host modules or granting the lesson same-origin access.
export function sandboxAssetSource(options: {
  protocol: string;
  version: number;
  runId: number;
}): string {
  const base = sandboxAssetBase(window.location.origin);
  const paths = [...textAssets].map(path => `${base}${path.slice(1)}`);
  return `(${installSandboxAssetFetch.toString()})(${JSON.stringify({ ...options, paths })});`;
}
