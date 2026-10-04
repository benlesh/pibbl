import { getWorkbenchEntryBySlug } from "@crc/scenarios";
import * as monaco from "monaco-editor/editor/editor.api";
import { expect, it } from "vitest";
import { mountEditorWorkbench } from "../src/editor-workbench";

it("owns separate models while two mounts of the same lesson initialize", async () => {
  const before = monaco.editor.getModels().length;
  const entry = getWorkbenchEntryBySlug("diagram-editor-canvas-scene")!;
  const source = 'export default function mount() { return { dispose() {} }; }';
  const containers = [document.createElement("div"), document.createElement("div")];
  for (const container of containers) document.body.append(container);
  const results = await Promise.allSettled(containers.map(container =>
    mountEditorWorkbench({ container, entry, canonicalSource: source, initialSource: source }),
  ));
  try {
    expect(results.map(result => result.status)).toEqual(["fulfilled", "fulfilled"]);
    expect(monaco.editor.getModels()).toHaveLength(before + 2);
  } finally {
    for (const result of results) if (result.status === "fulfilled") result.value.dispose();
    for (const container of containers) container.remove();
  }
  expect(monaco.editor.getModels()).toHaveLength(before);
}, 30_000);
