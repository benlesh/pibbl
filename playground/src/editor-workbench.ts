import type { LearningExampleCatalogEntry } from "@crc/scenarios";
import * as monaco from "monaco-editor/editor/editor.api";
import "monaco-editor/editor/browser/coreCommands";
import "monaco-editor/editor/contrib/bracketMatching/browser/bracketMatching";
import "monaco-editor/editor/contrib/clipboard/browser/clipboard";
import "monaco-editor/editor/contrib/codeAction/browser/codeActionContributions";
import "monaco-editor/editor/contrib/contextmenu/browser/contextmenu";
import "monaco-editor/editor/contrib/find/browser/findController";
import "monaco-editor/editor/contrib/folding/browser/folding";
import "monaco-editor/editor/contrib/format/browser/formatActions";
import "monaco-editor/editor/contrib/gotoError/browser/gotoError";
import "monaco-editor/editor/contrib/gotoSymbol/browser/goToCommands";
import "monaco-editor/editor/contrib/hover/browser/hoverContribution";
import "monaco-editor/editor/contrib/indentation/browser/indentation";
import "monaco-editor/editor/contrib/linesOperations/browser/linesOperations";
import "monaco-editor/editor/contrib/parameterHints/browser/parameterHints";
import "monaco-editor/editor/contrib/semanticTokens/browser/documentSemanticTokens";
import "monaco-editor/editor/contrib/semanticTokens/browser/viewportSemanticTokens";
import "monaco-editor/editor/contrib/snippet/browser/snippetController2";
import "monaco-editor/editor/contrib/suggest/browser/suggestController";
import "monaco-editor/editor/contrib/tokenization/browser/tokenization";
import "monaco-editor/editor/contrib/wordOperations/browser/wordOperations";
import "monaco-editor/languages/definitions/typescript/register";
import "monaco-editor/language/typescript/monaco.contribution";
import {
  getTypeScriptWorker,
  ModuleKind,
  ModuleResolutionKind,
  ScriptTarget,
  typescriptDefaults,
} from "monaco-editor/languages/features/typescript/register";
import { setupTypeScript } from "monaco-editor/languages/features/typescript/tsMode";
import EditorWorker from "monaco-editor/editor/editor.worker?worker";
import TypeScriptWorker from "monaco-editor/language/typescript/ts.worker?worker";
import crcDeclarations from "./crc-editor-types.txt?raw";
import { replaceCodeRoute } from "./share-code";
import { SandboxPreview, type PreviewEvent } from "./sandbox-runner";

declare global {
  interface Window {
    MonacoEnvironment?: {
      getWorker: (_moduleId: string, label: string) => Worker;
    };
  }
}

interface DiagnosticMessageChain {
  messageText: string;
  next?: readonly DiagnosticMessageChain[];
}

interface WorkerDiagnostic {
  start?: number;
  length?: number;
  category: number;
  code: number;
  messageText: string | DiagnosticMessageChain;
}

interface TextChange {
  span: { start: number; length: number };
  newText: string;
}

interface EmitOutput {
  emitSkipped: boolean;
  outputFiles: readonly { name: string; text: string }[];
}

interface WorkbenchOptions {
  container: HTMLElement;
  entry: LearningExampleCatalogEntry;
  canonicalSource: string;
  initialSource: string;
  sourceIssue?: string;
}

export interface MountedEditor {
  dispose(): void;
}

let monacoConfigured = false;

function configureMonaco(): void {
  if (monacoConfigured) return;
  monacoConfigured = true;
  window.MonacoEnvironment = {
    getWorker: (_moduleId, label) =>
      label === "typescript" || label === "javascript"
        ? new TypeScriptWorker()
        : new EditorWorker(),
  };
  typescriptDefaults.setCompilerOptions({
    target: ScriptTarget.ESNext,
    module: ModuleKind.ESNext,
    moduleResolution: ModuleResolutionKind.NodeJs,
    strict: true,
    allowNonTsExtensions: true,
    noEmitOnError: false,
    useDefineForClassFields: true,
  });
  typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    onlyVisible: false,
  });
  typescriptDefaults.setExtraLibs([
    {
      content: crcDeclarations,
      filePath: "file:///node_modules/@crc/core/index.d.ts",
    },
  ]);
  typescriptDefaults.setEagerModelSync(true);
  setupTypeScript(typescriptDefaults);
  monaco.editor.defineTheme("crc-studio", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "FF7A66", fontStyle: "bold" },
      { token: "string", foreground: "F7C948" },
      { token: "number", foreground: "74D3AE" },
      { token: "type.identifier", foreground: "91A7FF" },
      { token: "identifier", foreground: "F4F1E8" },
      { token: "comment", foreground: "859087", fontStyle: "italic" },
    ],
    colors: {
      "editor.background": "#111713",
      "editor.foreground": "#f4f1e8",
      "editorLineNumber.foreground": "#657068",
      "editorLineNumber.activeForeground": "#f7c948",
      "editor.selectionBackground": "#1f4bd877",
      "editor.inactiveSelectionBackground": "#1f4bd844",
      "editorCursor.foreground": "#ff6b57",
      "editor.lineHighlightBackground": "#1b241e",
      "editorGutter.background": "#111713",
      "editorError.foreground": "#ff7a66",
      "editorWarning.foreground": "#f7c948",
      "editorBracketMatch.background": "#74d3ae33",
      "editorBracketMatch.border": "#74d3ae",
    },
  });
}

function flattenDiagnosticMessage(
  message: string | DiagnosticMessageChain,
): string {
  if (typeof message === "string") return message;
  const parts = [message.messageText];
  for (const child of message.next ?? [])
    parts.push(flattenDiagnosticMessage(child));
  return parts.join(" ");
}

function markerFor(
  model: monaco.editor.ITextModel,
  diagnostic: WorkerDiagnostic,
): monaco.editor.IMarkerData {
  const start = model.getPositionAt(diagnostic.start ?? 0);
  const end = model.getPositionAt(
    (diagnostic.start ?? 0) + (diagnostic.length ?? 1),
  );
  return {
    severity:
      diagnostic.category === 1
        ? monaco.MarkerSeverity.Error
        : monaco.MarkerSeverity.Warning,
    message: flattenDiagnosticMessage(diagnostic.messageText),
    code: String(diagnostic.code),
    startLineNumber: start.lineNumber,
    startColumn: start.column,
    endLineNumber: end.lineNumber,
    endColumn: end.column,
  };
}

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const input = document.createElement("textarea");
  input.value = value;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  input.remove();
}

function button(label: string, className = "studio-tool"): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.className = className;
  element.textContent = label;
  return element;
}

function renderOutput(list: HTMLUListElement, event: PreviewEvent): void {
  const item = document.createElement("li");
  item.className = `studio-output__item studio-output__item--${event.level ?? event.kind}`;
  item.textContent =
    event.kind === "mounted"
      ? "Preview mounted successfully."
      : (event.message ?? event.kind);
  list.appendChild(item);
  while (list.children.length > 24) list.firstElementChild?.remove();
}

async function getReadyTypeScriptWorker(): ReturnType<
  typeof getTypeScriptWorker
> {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      return await getTypeScriptWorker();
    } catch {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 25));
    }
  }
  throw new Error(
    "The TypeScript language service did not start. Reload the lesson and try again.",
  );
}

export async function mountEditorWorkbench(
  options: WorkbenchOptions,
): Promise<MountedEditor> {
  configureMonaco();

  const workbench = document.createElement("section");
  workbench.className = "studio-workbench";
  workbench.ariaLabel = "Editable lesson playground";

  const previewPanel = document.createElement("section");
  previewPanel.className = "studio-preview";
  const previewHeader = document.createElement("div");
  previewHeader.className = "studio-panel-heading";
  const previewLabel = document.createElement("div");
  previewLabel.innerHTML = "<span>01</span><strong>Live canvas</strong>";
  const status = document.createElement("p");
  status.className = "studio-run-status";
  status.role = "status";
  status.ariaLive = "polite";
  status.textContent = "Preparing editor…";
  previewHeader.append(previewLabel, status);
  const previewHost = document.createElement("div");
  previewHost.className = "studio-preview__host";
  previewHost.style.aspectRatio = `${options.entry.canvas.width} / ${options.entry.canvas.height}`;
  previewPanel.append(previewHeader, previewHost);

  const editorPanel = document.createElement("section");
  editorPanel.className = "studio-editor";
  const editorHeader = document.createElement("div");
  editorHeader.className = "studio-panel-heading studio-panel-heading--dark";
  const editorLabel = document.createElement("div");
  editorLabel.innerHTML = "<span>02</span><strong>TypeScript</strong>";
  const tools = document.createElement("div");
  tools.className = "studio-tools";
  const formatButton = button("Format");
  const copyButton = button("Copy");
  const resetButton = button("Reset");
  const shareButton = button("Share", "studio-tool studio-tool--accent");
  tools.append(formatButton, copyButton, resetButton, shareButton);
  editorHeader.append(editorLabel, tools);
  const editorHost = document.createElement("div");
  editorHost.className = "studio-editor__host";
  const diagnostics = document.createElement("div");
  diagnostics.className = "studio-diagnostics";
  diagnostics.ariaLive = "polite";
  const output = document.createElement("details");
  output.className = "studio-output";
  const outputSummary = document.createElement("summary");
  outputSummary.textContent = "Console and runtime output";
  const outputList = document.createElement("ul");
  outputList.className = "studio-output__list";
  output.append(outputSummary, outputList);
  editorPanel.append(editorHeader, editorHost, diagnostics, output);
  workbench.append(previewPanel, editorPanel);
  options.container.appendChild(workbench);

  const model = monaco.editor.createModel(
    options.initialSource,
    "typescript",
    monaco.Uri.parse(`file:///lessons/${options.entry.slug}.ts`),
  );
  const editor = monaco.editor.create(editorHost, {
    model,
    theme: "crc-studio",
    automaticLayout: false,
    minimap: { enabled: false },
    fontFamily: '"JetBrains Mono Variable", "JetBrains Mono", monospace',
    fontSize: 14,
    lineHeight: 23,
    lineNumbersMinChars: 3,
    padding: { top: 18, bottom: 18 },
    scrollBeyondLastLine: false,
    tabSize: 2,
    insertSpaces: true,
    bracketPairColorization: { enabled: true },
    guides: { bracketPairs: true, indentation: true },
    suggest: { showWords: false },
    quickSuggestions: { other: true, comments: false, strings: false },
    hover: { enabled: "on" },
    accessibilitySupport: "auto",
  });
  const resizeObserver = new ResizeObserver(() => editor.layout());
  resizeObserver.observe(editorHost);
  const preview = new SandboxPreview(previewHost);
  let debounceTimer: number | undefined;
  let compileVersion = 0;
  let disposed = false;

  const setDiagnostics = (
    markers: readonly monaco.editor.IMarkerData[],
  ): void => {
    monaco.editor.setModelMarkers(model, "crc-studio", [...markers]);
    diagnostics.replaceChildren();
    if (!markers.length) {
      diagnostics.textContent = "No TypeScript issues.";
      diagnostics.classList.add("studio-diagnostics--clear");
      return;
    }
    diagnostics.classList.remove("studio-diagnostics--clear");
    const list = document.createElement("ul");
    for (const marker of markers) {
      const item = document.createElement("li");
      item.textContent = `Line ${marker.startLineNumber}: ${marker.message}`;
      list.appendChild(item);
    }
    diagnostics.appendChild(list);
  };

  const compileAndRun = async (): Promise<void> => {
    const version = ++compileVersion;
    status.textContent = "Checking TypeScript…";
    const workerFactory = await getReadyTypeScriptWorker();
    if (disposed || version !== compileVersion) return;
    const worker = await workerFactory(model.uri);
    if (disposed || version !== compileVersion) return;
    const fileName = model.uri.toString();
    const [syntactic, semantic] = await Promise.all([
      worker.getSyntacticDiagnostics(fileName) as Promise<WorkerDiagnostic[]>,
      worker.getSemanticDiagnostics(fileName) as Promise<WorkerDiagnostic[]>,
    ]);
    if (disposed || version !== compileVersion) return;
    const workerDiagnostics = [...syntactic, ...semantic];
    const markers = workerDiagnostics.map((value) => markerFor(model, value));
    setDiagnostics(markers);
    if (workerDiagnostics.some((value) => value.category === 1)) {
      status.textContent = `Preview preserved · fix ${workerDiagnostics.filter((value) => value.category === 1).length} issue${workerDiagnostics.filter((value) => value.category === 1).length === 1 ? "" : "s"}`;
      return;
    }
    const emitted = (await worker.getEmitOutput(fileName)) as EmitOutput;
    if (disposed || version !== compileVersion) return;
    const javascript = emitted.outputFiles.find((file) =>
      file.name.endsWith(".js"),
    )?.text;
    if (emitted.emitSkipped || !javascript) {
      status.textContent =
        "Preview preserved · TypeScript emitted no JavaScript";
      return;
    }
    status.textContent = "Starting a fresh preview…";
    outputList.replaceChildren();
    try {
      preview.run({
        code: javascript,
        width: options.entry.canvas.width,
        height: options.entry.canvas.height,
        onEvent: (event) => {
          renderOutput(outputList, event);
          if (event.kind === "mounted")
            status.textContent = "Live · changes run automatically";
          if (event.kind === "error") {
            status.textContent = "Preview preserved · runtime error";
            output.open = true;
          }
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      status.textContent = "Preview preserved · unsupported module shape";
      renderOutput(outputList, { kind: "error", message });
      output.open = true;
    }
  };

  const scheduleRun = (): void => {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => void compileAndRun(), 450);
  };

  const sourceChange = model.onDidChangeContent(() => {
    const route = replaceCodeRoute(
      window.location.hash,
      model.getValue(),
      options.canonicalSource,
    );
    shareButton.disabled = route.tooLong;
    shareButton.title = route.tooLong
      ? "This edit is too large for a shareable URL (16,000 character limit)."
      : "";
    if (route.tooLong)
      status.textContent =
        "Edit is live locally, but too large to share in a URL.";
    scheduleRun();
  });

  formatButton.addEventListener(
    "click",
    () =>
      void (async () => {
        const workerFactory = await getReadyTypeScriptWorker();
        const worker = await workerFactory(model.uri);
        const changes = (await worker.getFormattingEditsForDocument(
          model.uri.toString(),
          {
            indentSize: 2,
            tabSize: 2,
            convertTabsToSpaces: true,
            semicolons: "insert",
            newLineCharacter: "\n",
          },
        )) as TextChange[];
        const edits = changes.map((change) => ({
          range: monaco.Range.fromPositions(
            model.getPositionAt(change.span.start),
            model.getPositionAt(change.span.start + change.span.length),
          ),
          text: change.newText,
        }));
        editor.executeEdits("crc-format", edits);
        editor.focus();
      })(),
  );
  copyButton.addEventListener(
    "click",
    () =>
      void copyText(model.getValue()).then(() => {
        status.textContent = "TypeScript copied.";
      }),
  );
  resetButton.addEventListener("click", () => {
    model.setValue(options.canonicalSource);
    status.textContent = "Original lesson restored.";
    editor.focus();
  });
  shareButton.addEventListener(
    "click",
    () =>
      void (async () => {
        const route = replaceCodeRoute(
          window.location.hash,
          model.getValue(),
          options.canonicalSource,
        );
        if (route.tooLong) {
          status.textContent =
            "This edit is too large for a shareable URL (16,000 character limit).";
          return;
        }
        await copyText(route.url);
        status.textContent = "Share URL copied.";
      })(),
  );

  if (options.sourceIssue) {
    status.textContent = options.sourceIssue;
    output.open = true;
    renderOutput(outputList, { kind: "error", message: options.sourceIssue });
  }
  await compileAndRun();

  return {
    dispose(): void {
      disposed = true;
      compileVersion++;
      window.clearTimeout(debounceTimer);
      sourceChange.dispose();
      resizeObserver.disconnect();
      preview.dispose();
      editor.dispose();
      model.dispose();
      workbench.remove();
    },
  };
}

export function mountReadOnlySource(
  container: HTMLElement,
  source: string,
  slug: string,
): MountedEditor {
  configureMonaco();
  const model = monaco.editor.createModel(
    source,
    "typescript",
    monaco.Uri.parse(`file:///testing/${slug}.ts`),
  );
  const editor = monaco.editor.create(container, {
    model,
    theme: "crc-studio",
    readOnly: true,
    domReadOnly: true,
    automaticLayout: true,
    minimap: { enabled: false },
    fontFamily: '"JetBrains Mono Variable", "JetBrains Mono", monospace',
    fontSize: 13,
    lineHeight: 22,
    scrollBeyondLastLine: false,
    padding: { top: 16, bottom: 16 },
  });
  return {
    dispose(): void {
      editor.dispose();
      model.dispose();
    },
  };
}
