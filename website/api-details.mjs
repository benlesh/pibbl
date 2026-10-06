import { readFile } from "node:fs/promises";
import { relative } from "node:path";
import { execFileSync } from "node:child_process";
import {
  collectPublicApiDetails,
  pibblPublicCompilerOptions,
  pibblPublicEntryPaths,
} from "../tooling/studio-docs/api-exports.ts";

const escapeHTML = (text) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

// Start with signal so the combined authored/generated presentation can be
// evaluated before expanding it to every public declaration and member.
export async function addApiDetails(root, records) {
  const details = await collectPublicApiDetails(
    { root: pibblPublicEntryPaths.root },
    pibblPublicCompilerOptions,
    ["signal"],
  );
  const destinations = new Map();
  for (const record of records) {
    for (const symbol of record.meta.symbols ?? []) {
      destinations.set(
        symbol,
        `/${record.id}/${record.meta.apiCategory === "type" || record.id.startsWith("reference/types/") ? `#${symbol.toLowerCase()}` : ""}`,
      );
    }
  }
  const link = (text) =>
    text.replace(
      /\{@link(?:code|plain)?\s+([^\s}|]+)(?:\s*\|?\s*([^}]+))?\}/g,
      (_match, name, label) => {
        const url = destinations.get(name);
        return url ? `[${label ?? name}](${url})` : `\`${label ?? name}\``;
      },
    );
  const revision = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  const sources = new Map();
  for (const detail of details) {
    const page = records.find((record) =>
      record.meta.symbols?.includes(detail.name),
    );
    if (!page) throw new Error(`No reference page for ${detail.name}`);
    const path = relative(root, detail.file);
    const id = `source/${path.replace(/\.tsx?$/, "")}`;
    const parameters = detail.tags
      .filter((tag) => tag.name === "param")
      .map((tag) => {
        const [, name, description] =
          (tag.text ?? "").match(/^(\S+)\s*(?:-\s*)?([\s\S]*)$/) ?? [];
        return `- **\`${name}\`** — ${link(description ?? "")}`;
      });
    const returns = detail.tags
      .filter((tag) => tag.name === "returns" || tag.name === "return")
      .map((tag) => link(tag.text ?? ""))
      .join("\n\n");
    const content = `\n## API details from source\n\n${link(detail.description)}\n\n\`\`\`ts\n${detail.name}: ${detail.signature}\n\`\`\`\n\n### Parameters\n\n${parameters.join("\n")}\n\n### Returns\n\n${returns}\n\n[View source — ${path}:${detail.line}](/${id}/#L${detail.line})\n`;
    page.content = page.content.replace(
      "\n## Implementation guidance for agents",
      `${content}\n## Implementation guidance for agents`,
    );
    if (!sources.has(id)) {
      const source = await readFile(detail.file, "utf8");
      let matchesCommit = false;
      try {
        matchesCommit =
          execFileSync("git", ["show", `${revision}:${path}`], {
            cwd: root,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
          }) === source;
      } catch {
        /* Untracked sources have no published counterpart. */
      }
      sources.set(id, {
        id,
        meta: {
          title: path,
          description: "Exact source used to generate this reference.",
          kind: "source",
          source: path,
        },
        content: `This is the source snapshot used to build these API details. ${matchesCommit ? `[View this revision on GitHub](https://github.com/benlesh/pibbl/blob/${revision}/${path}#L${detail.line}).` : "This file contains local changes; its line links refer to this snapshot, not a published GitHub revision."}\n\n[Back to ${detail.name}](/${page.id}/)\n\n<pre class="api-source"><code>${source
          .split("\n")
          .map(
            (line, i) =>
              `<span id="L${i + 1}"><a href="#L${i + 1}" aria-label="Line ${i + 1}">${i + 1}</a> ${escapeHTML(line)}</span>`,
          )
          .join("\n")}</code></pre>\n`,
      });
    }
  }
  records.push(...sources.values());
}
