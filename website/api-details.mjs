import { relative } from "node:path";
import { execFileSync } from "node:child_process";
import {
  collectPublicApiDetails,
  pibblPublicCompilerOptions,
  pibblStudioPublicEntryPaths,
  pibblPhysicsEntryPaths,
} from "../tooling/studio-docs/api-exports.ts";

const escapeHTML = (text) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/** Add source-derived API details while retaining authored guidance. */
export async function addApiDetails(root, records) {
  const names = [
    ...new Set(records.flatMap((record) => record.meta.symbols ?? [])),
  ];
  const details = await collectPublicApiDetails(
    {
      ...pibblStudioPublicEntryPaths,
      physics2dGeometry: pibblPhysicsEntryPaths.physics2dGeometry,
    },
    pibblPublicCompilerOptions,
    names,
  );
  const destinations = new Map();
  for (const record of records) {
    for (const symbol of record.meta.symbols ?? []) {
      destinations.set(
        symbol,
        `/${record.id}/${record.id.startsWith("reference/types/") ? `#${symbol.toLowerCase()}` : ""}`,
      );
    }
  }
  const anchor = (name) => `api-${name.replace(/[^A-Za-z0-9_-]/g, "-")}`;
  const link = (text) =>
    text.replace(
      /\{@link(?:code|plain)?\s+([^\s}|]+)(?:\s*\|?\s*([^}]+))?\}/g,
      (_match, target, label) => {
        if (/^https?:\/\//.test(target))
          return `[${label ?? target}](${target})`;
        const [name, member] = target.split(/[.#]/);
        const destination = destinations.get(name);
        const url =
          member && destination
            ? `${destination.split("#")[0]}#${anchor(name)}-${member}`
            : destination;
        return url ? `[${label ?? target}](${url})` : `\`${label ?? target}\``;
      },
    );
  const revision = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  const sources = new Map();
  const readableSignature = (signature) =>
    signature.replace(/import\("[^"]+"\)\.([A-Za-z_$][\w$]*)/g, (full, name) =>
      destinations.has(name) ? name : full,
    );
  const signatureMarkdown = (signature) => {
    const readable = readableSignature(signature);
    const types = [
      ...new Set(readable.match(/[A-Za-z_$][\w$]*/g) ?? []),
    ].filter((name) => destinations.has(name));
    const code = `\n\`\`\`ts\n${readable}\n\`\`\`\n`;
    return `${readable.length > 600 ? `\n<details>\n<summary>Full type declaration</summary>\n${code}\n</details>\n` : code}${types.length ? `\nRelated API: ${types.map((name) => `[${name}](${destinations.get(name)})`).join(", ")}.\n` : ""}`;
  };
  const sourceId = (file) =>
    `source/${relative(root, file).replace(/\.(tsx?)$/, "-$1")}`;
  const sourceLink = (detail) =>
    `[View source — ${relative(root, detail.file)}:${detail.line}](/${sourceId(detail.file)}/#L${detail.line})`;
  async function addSource(detail, page) {
    const id = sourceId(detail.file);
    if (sources.has(id)) return;
    const path = relative(root, detail.file);
    if (!path.startsWith("packages/") || path.includes("/node_modules/"))
      throw new Error(`Unexpected public source ${path}`);
    const source = detail.source;
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
      content: `This is the source snapshot used to build these API details. ${matchesCommit ? `[View this revision on GitHub](https://github.com/benlesh/pibbl/blob/${revision}/${path}#L${detail.line}).` : "This file contains local changes; its line links refer to this snapshot, not a published GitHub revision."}\n\n[Back to reference](/${page.id}/)\n\n<pre class="api-source"><code>${source
        .split("\n")
        .map(
          (line, i) =>
            `<span id="L${i + 1}"><a href="#L${i + 1}" aria-label="Line ${i + 1}">${i + 1}</a> ${escapeHTML(line)}</span>`,
        )
        .join("\n")}</code></pre>\n`,
    });
  }
  function tagsMarkdown(tags, level) {
    const groups = new Map();
    const labels = {
      param: "Parameters",
      returns: "Returns",
      return: "Returns",
      template: "Type parameters",
      typeParam: "Type parameters",
      remarks: "Remarks",
      example: "Examples",
      deprecated: "Deprecated",
      throws: "Throws",
      see: "See also",
      default: "Default",
      defaultValue: "Default",
    };
    for (const tag of tags) {
      const label = labels[tag.name];
      if (!label || !tag.text) continue;
      const values = groups.get(label) ?? new Set();
      let text = link(tag.text);
      if (
        tag.name === "param" ||
        tag.name === "template" ||
        tag.name === "typeParam"
      ) {
        const [, name, description] =
          text.match(/^(\S+)\s*(?:-\s*)?([\s\S]*)$/) ?? [];
        text = `- **\`${name}\`** — ${description ?? ""}`;
      }
      values.add(text);
      groups.set(label, values);
    }
    return [...groups]
      .map(
        ([label, values]) =>
          `\n${"#".repeat(level)} ${label}\n\n${[...values].join("\n\n")}\n`,
      )
      .join("");
  }
  const seen = new Set();
  const usedAnchors = new Set();
  const pageDetails = new Map();
  for (const detail of details) {
    const key = `${detail.name}:${detail.file}:${detail.line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const baseAnchor = anchor(detail.name);
    const detailAnchor = usedAnchors.has(baseAnchor)
      ? `${baseAnchor}-${detail.entry}`
      : baseAnchor;
    usedAnchors.add(detailAnchor);
    const page = records.find((record) =>
      record.meta.symbols?.includes(detail.name),
    );
    if (!page) throw new Error(`No reference page for ${detail.name}`);
    page.meta.apiSearchText =
      (page.meta.apiSearchText ?? "") +
      `\n${detail.description}\n${detail.tags.map((tag) => tag.text ?? "").join("\n")}`;
    await addSource(detail, page);
    const heading =
      page.meta.symbols.length > 1
        ? `\n### ${detail.name}${detailAnchor !== baseAnchor ? ` (${detail.entry})` : ""}\n`
        : "";
    const level = page.meta.symbols.length > 1 ? 4 : 3;
    let content = `\n<span id="${detailAnchor}"></span>\n${heading}\n${link(detail.description)}\n${signatureMarkdown(detail.signature)}${tagsMarkdown(detail.tags, level)}\n${sourceLink(detail)}\n`;
    if (detail.members.length) {
      content += `\n${"#".repeat(level)} Properties and methods\n`;
      for (const member of detail.members) {
        (page.meta.apiSearchSections ??= []).push({
          heading: {
            id: `${detailAnchor}-${member.name}`,
            level: 3,
            text: `${detail.name}.${member.name}`,
          },
          plainText: `${readableSignature(member.signature)}\n${member.description}\n${member.tags.map((tag) => tag.text ?? "").join("\n")}`,
        });
        await addSource(member, page);
        content += `\n<span id="${detailAnchor}-${member.name}"></span>\n<details>\n<summary>${escapeHTML(member.name)}${member.optional ? " (optional)" : ""}</summary>\n\n${signatureMarkdown(`${member.readonly ? "readonly " : ""}${member.name}${member.optional ? "?" : ""}: ${member.signature}`)}\n${link(member.description)}\n${tagsMarkdown(member.tags, Math.min(level + 1, 6))}\n${sourceLink(member)}\n\n</details>\n`;
      }
    }
    pageDetails.set(page, (pageDetails.get(page) ?? "") + content);
  }
  for (const [page, content] of pageDetails) {
    page.content = page.content.replace(
      "\n## Implementation guidance for agents",
      `\n## API details from source\n${content}\n## Implementation guidance for agents`,
    );
  }
  records.push(...sources.values());
}
