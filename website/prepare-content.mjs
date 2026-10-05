import { readFile, readdir, mkdir, writeFile, rm, cp } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import {
  loadDocumentation,
  loadAuthored,
  topics,
  topicFor,
} from "./documentation.mjs";
import { learningExampleCatalog } from "../packages/scenarios/src/learning-catalog.ts";
import { galleries, galleryExamples } from "./gallery.mjs";

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
// Preserve the content root so a running Astro watcher keeps its collection.
await rm(publicDir, { recursive: true, force: true });
await mkdir(generated, { recursive: true });
await mkdir(publicDir, { recursive: true });
const catalog = [];
const imported = await loadDocumentation(root, playground);
const records = [...(await loadAuthored(root)), ...imported.records];
const minimalExamples = new Map();
for (const slug of galleries.find((gallery) => gallery.id === "shapes").slugs) {
  const record = imported.records.find(
    (record) => record.id === `reference/components/${slug}`,
  );
  const symbol = record?.meta.symbols?.[0];
  const snippet = record?.content.match(/```tsx\n([\s\S]*?)\n```/)?.[1];
  if (!symbol || !snippet)
    throw new Error(`Missing minimal shape source for ${slug}`);
  const code = `/** @jsxImportSource @crc/core */\nimport { crc, ${symbol} } from '@crc/core';\n\nconst canvas = document.createElement('canvas');\ncanvas.width = 320;\ncanvas.height = 240;\ndocument.body.append(canvas);\n\nconst controller = crc(canvas, (\n${snippet}\n));\n\nwindow.addEventListener('pagehide', () => controller.dispose(), { once: true });\n`;
  const url = `/minimal/${slug}.tsx`;
  await mkdir(resolve(publicDir, "minimal"), { recursive: true });
  await writeFile(resolve(publicDir, `minimal/${slug}.tsx`), code);
  minimalExamples.set(symbol, url);
  record.content += `\n## Complete minimal example\n\nCompile this TSX module with \`jsx: "react-jsx"\` and \`jsxImportSource: "@crc/core"\`, then load it from a browser entry point after the document body exists. It creates and mounts one canvas; dispose the controller before removing or replacing that canvas. The interactive study linked below adds controls beyond this minimal use case.\n\n[Download source](${url})\n\n\`\`\`tsx\n${code}\`\`\`\n`;
}
for (const gallery of galleries) {
  records.push({
    id: `catalogs/${gallery.id}`,
    meta: {
      title: gallery.title,
      description: `Explore ${gallery.title.toLowerCase()} with runnable examples.`,
      kind: "gallery",
      source: "website/gallery.mjs",
    },
    content:
      "[All galleries](/catalogs/)\n\n" +
      gallery.slugs
        .map((slug) => {
          const example = galleryExamples.find(
            (example) => example.slug === slug,
          );
          return `- [${example.title}](/examples/${slug}/): ${example.summary} [Full page](/experience/${slug}/) · [Playground](${playground}#/examples/${example.browseGroup}/${slug})`;
        })
        .join("\n"),
  });
}
const catalogLanding = records.find((record) => record.id === "catalogs");
catalogLanding.content =
  "## Browse visually\n\n" +
  galleries
    .map((gallery) => `- [${gallery.title}](/catalogs/${gallery.id}/)`)
    .join("\n") +
  "\n\n" +
  catalogLanding.content;
for (const example of galleryExamples) {
  const id = `examples/${example.slug}`;
  let record = records.find((record) => record.id === id);
  if (!record) {
    record = {
      id,
      meta: {
        title: example.title,
        description: example.summary,
        kind: "example",
        source: example.source.path,
        sources: [example.source.path],
      },
      content: `${example.summary}\n\n## Try it\n\n${example.prompts.gesture}\n\n## What to learn\n\n${example.objectives.map((objective) => `- ${objective}`).join("\n")}\n\n## Integration boundaries\n\n${example.apiNotes.map((note) => `- ${note}`).join("\n")}\n\nThis is a CRC Canvas example. Its mount owns its runtime resources; call its controller's dispose method when removing it. The preview starts automatically unless reduced motion is enabled; Stop disposes the mount. Preserve the source's logical canvas size and aspect ratio. Native HTML is not captured by Canvas filters.\n`,
    };
    records.push(record);
  }
  record.content =
    `[Full-page experience](/experience/${example.slug}/) · [Open playground](${playground}#/examples/${example.browseGroup}/${example.slug})\n\n` +
    record.content;
  const apiLinks = example.api.flatMap((symbol) => {
    const entry = imported.entries.find(
      (entry) => entry.symbol === symbol && entry.url,
    );
    return entry ? [`- [${symbol}](${entry.url})`] : [];
  });
  record.content += `\n## Related APIs\n\n${apiLinks.join("\n")}\n`;
}
for (const record of imported.records) {
  const examples = galleryExamples.filter((example) =>
    example.api.some((symbol) => record.meta.symbols?.includes(symbol)),
  );
  if (examples.length)
    record.content +=
      "\n## Interactive examples\n\n" +
      examples
        .map(
          (example) =>
            `- [${example.title}](/examples/${example.slug}/) · [Full page](/experience/${example.slug}/)`,
        )
        .join("\n");
}
for (const entry of imported.entries) {
  entry.exampleCandidates = galleryExamples
    .filter((example) => example.api.includes(entry.symbol))
    .map((example) => `/examples/${example.slug}/`);
  entry.minimalExample = minimalExamples.get(entry.symbol) ?? null;
  entry.exampleReview = entry.minimalExample
    ? "complete-minimal-source"
    : "pending";
}
records.push({
  id: "agents/documentation-status",
  meta: {
    title: "Documentation completeness",
    description:
      "Reference destinations are not proof of complete minimal examples.",
    kind: "reference-index",
    source: "website/prepare-content.mjs",
  },
  content:
    `Every public API needs an explanation, its simplest complete code example, and appropriate verification. Visual APIs should also have live previews. Types need usage examples rather than meaningless standalone canvases.\n\nThe inventory currently contains ${new Set(imported.entries.map((entry) => entry.symbol)).size} distinct symbol names. ${minimalExamples.size} shape APIs have complete minimal programs checked by the minimal-example test. **The remaining per-symbol minimal-example work is incomplete.** Grouped documentation is not counted as proof of a complete minimal example.\n\n[Machine-readable inventory](/agents/coverage.json) includes example candidates from the learning catalog. These are discovery links, not certifications of minimality or verification. A null minimalExample means a complete minimal program has not yet been supplied.\n\n## Review queue\n\n` +
    [
      ...new Map(
        imported.entries.map((entry) => [entry.symbol, entry]),
      ).values(),
    ]
      .sort((a, b) => a.symbol.localeCompare(b.symbol))
      .map(
        (entry) =>
          `- [${entry.symbol}](${entry.url}): ${entry.kind}; ${entry.minimalExample ? "[complete minimal source](" + entry.minimalExample + ")" : "minimal example pending"}${entry.exampleCandidates.length ? "; [existing example](" + entry.exampleCandidates[0] + ")" : ""}.`,
      )
      .join("\n"),
});
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
        "Export-to-reference destinations only. exampleCandidates are discovery links; minimalExample and exampleReview explicitly track the unverified per-symbol requirement.",
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
for (const path of await readdir(generated, { recursive: true })) {
  if (path.endsWith(".md") && !ids.has(path.slice(0, -3))) {
    await rm(resolve(generated, path));
  }
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
  `Prepared ${catalog.length} public pages; ${imported.entries.filter((entry) => !entry.url).length} missing export reference destinations. Minimal-example completeness is tracked separately.\n`,
);
