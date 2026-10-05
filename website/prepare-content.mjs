import { readFile, mkdir, writeFile, rm, cp } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import {
  loadDocumentation,
  loadAuthored,
  topics,
  topicFor,
} from "./documentation.mjs";
import { learningExampleCatalog } from "../packages/scenarios/src/learning-catalog.ts";

const root = resolve(import.meta.dirname, "..");
const generated = resolve(import.meta.dirname, "src/content/docs");
const publicDir = resolve(import.meta.dirname, "public/generated");
const playground = process.env.CRC_PLAYGROUND_URL ?? "http://localhost:5173/";
const revision = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
const core = JSON.parse(
  await readFile(resolve(root, "packages/core/package.json"), "utf8"),
);
const compatibility = `Local checkout: @crc/core ${core.version}, base revision ${revision}, with working-tree changes. This preview does not assert compatibility with an npm release.`;
const kit = resolve(root, "docs/website-rebuild/claude-design-kit");
await rm(generated, { recursive: true, force: true });
await rm(publicDir, { recursive: true, force: true });
await mkdir(generated, { recursive: true });
await mkdir(publicDir, { recursive: true });
const catalog = [];
const imported = await loadDocumentation(root, playground);
const records = [...(await loadAuthored(root)), ...imported.records];
const reference = records.find((record) => record.id === "reference");
for (const [topic, details] of Object.entries(topics)) {
  const id = `reference/capabilities/${topic}`;
  reference.content += `\n- [${details.title}](/${id}/)\n`;
  records.push({
    id,
    meta: {
      title: details.title,
      description: `Reference by capability: ${details.title}.`,
      kind: "reference-index",
    },
    content:
      `[Detailed agent guidance](/agents/topics/${topic}/) · [All capabilities](/reference/)\n\n` +
      imported.records
        .filter(
          (record) => record.meta.kind === "api" && record.meta.topic === topic,
        )
        .map(
          (record) =>
            `- [${record.meta.title}](/${record.id}/): ${record.meta.description}`,
        )
        .join("\n"),
  });
}
reference.content +=
  "\n## Alphabetical index\n\n[Find a symbol alphabetically](/reference/alphabetical/). Values, types, and compiler entries are distinguished. Use the coverage report to check import paths; a symbol may be exported from more than one entry.\n";
records.push({
  id: "reference/alphabetical",
  meta: {
    title: "Alphabetical API index",
    description: "Find public values, types, and compiler entries by name.",
    kind: "reference-index",
  },
  content:
    "[Browse by capability](/reference/) · [Machine-readable export coverage](/agents/coverage.json)\n\n" +
    [
      ...new Map(
        imported.entries
          .filter((entry) => entry.url)
          .map((entry) => [entry.symbol, entry]),
      ).values(),
    ]
      .sort((a, b) => a.symbol.localeCompare(b.symbol))
      .map((entry) => `- [${entry.symbol}](${entry.url}) (${entry.kind})`)
      .join("\n"),
});
const guides = records.find((record) => record.id === "guides");
guides.content +=
  "\n## Guide library\n\n" +
  imported.records
    .filter((record) => record.meta.kind === "guide")
    .map(
      (record) =>
        `- [${record.meta.title}](/${record.id}/): ${record.meta.description}`,
    )
    .join("\n");
guides.content +=
  "\n\n## Step-by-step tutorials\n\n" +
  imported.records
    .filter((record) => record.meta.kind === "tutorial")
    .map((record) => `- [${record.meta.title}](/${record.id}/)`)
    .join("\n");
await mkdir(resolve(publicDir, "agents"), { recursive: true });
await writeFile(
  resolve(publicDir, "agents/coverage.json"),
  JSON.stringify(
    {
      schemaVersion: 1,
      compatibility,
      meaning:
        "Export-to-document destinations, not a snippet execution or documentation-quality certification.",
      entries: imported.entries,
      missing: imported.entries.filter((entry) => !entry.url),
    },
    null,
    2,
  ),
);
const ids = new Set();
for (const { id, meta, content: body } of records) {
  if (ids.has(id)) throw new Error(`Duplicate document ${id}`);
  ids.add(id);
  const route = id === "index" ? "/" : `/${id}/`;
  const markdownRoute = id === "index" ? "/index.md" : `/${id}.md`;
  let content = body.replaceAll("@PLAYGROUND@", playground);
  if (meta.sources) {
    content += "\n## Complete source\n";
    for (const file of meta.sources) {
      const path = resolve(root, file);
      if (
        !path.startsWith(kit + "/") &&
        !path.startsWith(resolve(root, "packages/scenarios/src/learning") + "/")
      )
        throw new Error(`Unapproved source ${file}`);
      const code = await readFile(path, "utf8");
      const example = learningExampleCatalog.find(
        (entry) => entry.source.path === file,
      );
      if (example)
        content += `\nHost setup for this source: use a canvas with width ${example.canvas.width} and height ${example.canvas.height}, compile with \`jsx: "react-jsx"\` and \`jsxImportSource: "@crc/core"\`, import its default \`mount\`, and call \`const controller = mount(canvas)\` after attaching the canvas. Call \`controller.dispose()\` before removing it.\n`;
      const name = file.split("/").at(-1);
      const language = name.split(".").at(-1);
      content += `\n### ${name}\n\n\`\`\`${language}\n${code}\n\`\`\`\n`;
    }
  }
  content += `\n## Documentation version\n\n${compatibility}\n`;
  const markdown = `# ${meta.title}\n${content}`;
  const markdownPath = resolve(publicDir, `.${markdownRoute}`);
  await mkdir(dirname(markdownPath), { recursive: true });
  await writeFile(markdownPath, markdown);
  const dest = resolve(generated, `${id}.md`);
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(
    dest,
    `---\ntitle: ${JSON.stringify(meta.title)}\ndescription: ${JSON.stringify(meta.description)}\nhead:\n  - tag: link\n    attrs:\n      rel: alternate\n      type: text/markdown\n      href: ${markdownRoute}\n---\n\n[Read as Markdown](${markdownRoute})\n\n${content}`,
  );
  catalog.push({
    id,
    title: meta.title,
    url: route,
    markdown: markdownRoute,
    kind: meta.kind ?? "guide",
    symbols: meta.symbols ?? [],
    source:
      meta.source ??
      (meta.kind === "reference-index"
        ? "website/prepare-content.mjs"
        : `docs/site/website/${id}.mdx`),
    companion:
      meta.kind === "api"
        ? `/agents/topics/${meta.topic ?? topicFor(id)}/`
        : null,
    relatedTypes: meta.relatedTypes ?? [],
    imports: [
      ...new Set(
        imported.entries
          .filter((entry) => (meta.symbols ?? []).includes(entry.symbol))
          .map((entry) => entry.importPath),
      ),
    ],
  });
}
await cp(
  resolve(root, "playground/public/tutorials"),
  resolve(import.meta.dirname, "public/tutorials"),
  { recursive: true },
);
await writeFile(
  resolve(publicDir, "catalog.json"),
  JSON.stringify(
    { schemaVersion: 1, compatibility, entries: catalog },
    null,
    2,
  ),
);
await writeFile(
  resolve(publicDir, "llms.txt"),
  `# CRC documentation preview\n\n${compatibility}\n\nRead individual topics before adapting examples. No installable agent skill is shipped in this slice.\n\n${catalog
    .filter(
      (entry) =>
        entry.id.startsWith("agents/topics/") ||
        [
          "start",
          "reference",
          "catalogs",
          "guides",
          "agents",
          "guides/native-button",
          "agents/native-button",
          "examples/stirred-ink",
        ].includes(entry.id),
    )
    .map((entry) => `- [${entry.title}](${entry.markdown})`)
    .join("\n")}\n`,
);
execFileSync("tar", [
  "-czf",
  resolve(publicDir, "claude-design-kit.tar.gz"),
  "-C",
  dirname(kit),
  "claude-design-kit",
]);
process.stdout.write(
  `Prepared ${catalog.length} public pages from docs/site only; ${imported.entries.filter((entry) => !entry.url).length} export documentation gaps.\n`,
);
