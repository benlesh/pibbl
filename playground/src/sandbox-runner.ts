import runtimeSource from "virtual:crc-runtime-source";

const PROTOCOL = "crc-studio";
const VERSION = 1;

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

function toRunnableScript(emittedCode: string): string {
  const imports: string[] = [];
  let runnable = emittedCode.replace(
    /import\s*\{([\s\S]*?)\}\s*from\s*['"]@crc\/core['"];?/gu,
    (_statement, names: string) => {
      imports.push(names);
      return "";
    },
  );
  runnable = runnable
    .replace(/export\s+default\s+function\s+mount/gu, "function mount")
    .replace(/export\s*\{\s*\};?/gu, "");
  if (/\b(?:import|export)\b/gu.test(runnable) || imports.length !== 1) {
    throw new Error(
      "Lessons may contain one named import from @crc/core and one default mount export.",
    );
  }
  return `const { ${imports[0]} } = CRC_CORE;\n${runnable}\nglobalThis.__CRC_EXAMPLE_MOUNT__ = mount;`;
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
      controller = globalThis.__CRC_EXAMPLE_MOUNT__(canvas);
      requestAnimationFrame(() => requestAnimationFrame(() => send({ kind: 'mounted' })));
    } catch (error) {
      send({ kind: 'error', message: error instanceof Error ? error.message : printable(error) });
    }
  `;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box}html,body{height:100%;margin:0}body{display:grid;place-items:center;background:#fffdf6;overflow:hidden}
    canvas{display:block;width:100%;height:auto;max-height:100%;object-fit:contain;touch-action:none}
  </style></head><body><canvas width="${options.width}" height="${options.height}" aria-label="Live CRC lesson preview"></canvas>
  <script>${escapeScript(runtimeSource)}</script><script>${escapeScript(boot)}</script></body></html>`;
}

export class SandboxPreview {
  readonly #host: HTMLElement;
  #activeFrame: HTMLIFrameElement | undefined;
  #candidateFrame: HTMLIFrameElement | undefined;
  #runId = 0;
  #onEvent: ((event: PreviewEvent) => void) | undefined;

  constructor(host: HTMLElement) {
    this.#host = host;
    window.addEventListener("message", this.#handleMessage);
  }

  run(options: RunOptions): void {
    const runId = ++this.#runId;
    this.#onEvent = options.onEvent;
    this.#disposeFrame(this.#candidateFrame);
    const frame = document.createElement("iframe");
    frame.className = "studio-preview__frame studio-preview__frame--candidate";
    frame.dataset.runId = String(runId);
    frame.title = "Live CRC lesson preview";
    frame.sandbox.add("allow-scripts");
    frame.srcdoc = createFrameSource({
      runId,
      code: options.code,
      width: options.width,
      height: options.height,
    });
    this.#candidateFrame = frame;
    this.#host.appendChild(frame);
  }

  dispose(): void {
    this.#disposeFrame(this.#candidateFrame);
    this.#disposeFrame(this.#activeFrame);
    this.#candidateFrame = undefined;
    this.#activeFrame = undefined;
    window.removeEventListener("message", this.#handleMessage);
  }

  #disposeFrame(frame: HTMLIFrameElement | undefined): void {
    const runId = Number(frame?.dataset.runId);
    if (frame && Number.isSafeInteger(runId)) {
      frame.contentWindow?.postMessage(
        { protocol: PROTOCOL, version: VERSION, runId, kind: "dispose" },
        "*",
      );
    }
    frame?.remove();
  }

  #handleMessage = (event: MessageEvent<unknown>): void => {
    const message = event.data;
    const candidate = this.#candidateFrame;
    const active = this.#activeFrame;
    const sourceFrame =
      event.source === candidate?.contentWindow
        ? candidate
        : event.source === active?.contentWindow
          ? active
          : undefined;
    if (
      !sourceFrame ||
      !isFrameMessage(message) ||
      message.runId !== Number(sourceFrame.dataset.runId)
    )
      return;
    if (message.kind === "mounted") {
      if (sourceFrame !== candidate || message.runId !== this.#runId) return;
      const oldFrame = this.#activeFrame;
      this.#activeFrame = candidate;
      this.#candidateFrame = undefined;
      candidate.classList.remove("studio-preview__frame--candidate");
      this.#disposeFrame(oldFrame);
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
    this.#onEvent?.({ kind: "error", message: message.message });
    if (sourceFrame === candidate) {
      this.#candidateFrame = undefined;
      this.#disposeFrame(candidate);
    }
  };
}
