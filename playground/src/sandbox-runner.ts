import runtimeSource from "virtual:crc-runtime-source";
import { toRunnableScript } from "./sandbox-module";

const PROTOCOL = "crc-studio";
const VERSION = 1;
const PREVIEW_START_TIMEOUT_MS = 10_000;

type LogLevel = "log" | "info" | "warn" | "error";

type FrameMessage =
  | {
      protocol: typeof PROTOCOL;
      version: typeof VERSION;
      runId: number;
      kind: "mounted";
    }
  | {
      protocol: typeof PROTOCOL;
      version: typeof VERSION;
      runId: number;
      kind: "log";
      level: LogLevel;
      args: readonly string[];
    }
  | {
      protocol: typeof PROTOCOL;
      version: typeof VERSION;
      runId: number;
      kind: "error";
      message: string;
    };

export interface PreviewEvent {
  kind: "mounted" | "log" | "error";
  level?: LogLevel;
  message?: string;
}

interface RunOptions {
  code: string;
  width: number;
  height: number;
  onEvent: (event: PreviewEvent) => void;
}

function isFrameMessage(value: unknown): value is FrameMessage {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.protocol === PROTOCOL &&
    record.version === VERSION &&
    typeof record.runId === "number" &&
    typeof record.kind === "string"
  );
}

function escapeScript(source: string): string {
  return source.replaceAll("</script", "<\\/script");
}

function createFrameSource(options: {
  runId: number;
  code: string;
  width: number;
  height: number;
}): string {
  const runnable = toRunnableScript(options.code);
  const boot = `
    const protocol = '${PROTOCOL}';
    const version = ${VERSION};
    const runId = ${options.runId};
    const send = message => parent.postMessage({ protocol, version, runId, ...message }, '*');
    const printable = value => {
      try { return typeof value === 'string' ? value : JSON.stringify(value); }
      catch { return String(value); }
    };
    for (const level of ['log', 'info', 'warn', 'error']) {
      const original = console[level].bind(console);
      console[level] = (...args) => {
        original(...args);
        send({ kind: 'log', level, args: args.map(printable) });
      };
    }
    let controller;
    const dispose = () => {
      controller?.dispose();
      controller = undefined;
    };
    addEventListener('message', event => {
      const message = event.data;
      if (event.source !== parent || message?.protocol !== protocol || message?.version !== version || message?.runId !== runId || message?.kind !== 'dispose') return;
      dispose();
    });
    addEventListener('pagehide', dispose, { once: true });
    addEventListener('error', event => send({ kind: 'error', message: event.message || 'Unknown runtime error' }));
    addEventListener('unhandledrejection', event => send({ kind: 'error', message: printable(event.reason) }));
    try {
      ${runnable}
      const canvas = document.querySelector('canvas');
      const mountedController = globalThis.__CRC_EXAMPLE_MOUNT__(canvas);
      if (!mountedController || typeof mountedController.dispose !== 'function') {
        throw new Error('Preview mount must return a controller with dispose().');
      }
      controller = mountedController;
      send({ kind: 'mounted' });
    } catch (error) {
      send({ kind: 'error', message: error instanceof Error ? error.message : printable(error) });
    }
  `;
  // Keep bundled names separate from boot variables while awaiting WASM startup.
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box}html,body{height:100%;margin:0}body{display:grid;place-items:center;background:#fffdf6;overflow:hidden}
    canvas{display:block;width:100%;height:100%;min-width:0;min-height:0;max-height:100%;object-fit:contain;touch-action:none}
  </style></head><body><canvas width="${options.width}" height="${options.height}" aria-label="Live CRC lesson preview"></canvas>
  <script type="module">try {
await (async () => {
${escapeScript(runtimeSource)}
})();
${escapeScript(boot)}
} catch (error) { parent.postMessage({ protocol: '${PROTOCOL}', version: ${VERSION}, runId: ${options.runId}, kind: 'error', message: String(error) }, '*'); }</script></body></html>`;
}

export class SandboxPreview {
  readonly #host: HTMLElement;
  #frame: HTMLIFrameElement | undefined;
  #startTimeout: number | undefined;
  #runId = 0;
  #onEvent: ((event: PreviewEvent) => void) | undefined;

  constructor(host: HTMLElement) {
    this.#host = host;
    window.addEventListener("message", this.#handleMessage);
  }

  run(options: RunOptions): void {
    const runId = ++this.#runId;
    this.#onEvent = options.onEvent;
    this.#clearStartTimeout();
    this.#disposeFrame(this.#frame);
    const frame = document.createElement("iframe");
    frame.className = "studio-preview__frame";
    frame.dataset.runId = String(runId);
    frame.title = "Live CRC lesson preview";
    frame.sandbox.add("allow-scripts");
    frame.srcdoc = createFrameSource({
      runId,
      code: options.code,
      width: options.width,
      height: options.height,
    });
    this.#frame = frame;
    this.#host.appendChild(frame);
    this.#startTimeout = window.setTimeout(() => {
      if (this.#frame !== frame || this.#runId !== runId) return;
      this.#frame = undefined;
      this.#disposeFrame(frame);
      this.#onEvent?.({
        kind: "error",
        message:
          "The preview did not start within 10 seconds. Reload the lesson and try again.",
      });
    }, PREVIEW_START_TIMEOUT_MS);
  }

  dispose(): void {
    this.#clearStartTimeout();
    this.#disposeFrame(this.#frame);
    this.#frame = undefined;
    window.removeEventListener("message", this.#handleMessage);
  }

  #clearStartTimeout(): void {
    window.clearTimeout(this.#startTimeout);
    this.#startTimeout = undefined;
  }

  #disposeFrame(frame: HTMLIFrameElement | undefined): void {
    const runId = Number(frame?.dataset.runId);
    if (frame && Number.isSafeInteger(runId)) {
      frame.contentWindow?.postMessage(
        { protocol: PROTOCOL, version: VERSION, runId, kind: "dispose" },
        "*",
      );
    }
    window.setTimeout(() => frame?.remove());
  }

  #handleMessage = (event: MessageEvent<unknown>): void => {
    const message = event.data;
    const sourceFrame = this.#frame;
    if (
      event.source !== sourceFrame?.contentWindow ||
      !isFrameMessage(message) ||
      message.runId !== Number(sourceFrame.dataset.runId)
    )
      return;
    if (message.kind === "mounted") {
      if (message.runId !== this.#runId) return;
      this.#clearStartTimeout();
      this.#onEvent?.({ kind: "mounted" });
      return;
    }
    if (message.kind === "log") {
      this.#onEvent?.({
        kind: "log",
        level: message.level,
        message: message.args.join(" "),
      });
      return;
    }
    this.#clearStartTimeout();
    this.#onEvent?.({ kind: "error", message: message.message });
  };
}
