import { readFile, readdir } from "node:fs/promises";
import { resolve, relative, dirname } from "node:path";
import { parsePublicMarkdown } from "../tooling/studio-docs/markdown.ts";
import { websiteDocumentId } from "../tooling/studio-docs/website-routes.ts";
import {
  collectPublicExports,
  pibblPublicCompilerOptions,
  pibblStudioPublicEntryPaths,
  pibblPhysicsEntryPaths,
} from "../tooling/studio-docs/api-exports.ts";
import { parse } from "yaml";
import MarkdownIt from "markdown-it";
import { addApiDetails } from "./api-details.mjs";

const markdown = new MarkdownIt();
export const topics = {
  text: {
    title: "Text outlines and typography",
    match: /text-geometry|text-envelope|outline-font/,
  },
  lifecycle: {
    title: "Authoring, signals, and lifecycle",
    match:
      /pibbl$|create-element|signal|computed|reaction|runtime|use-const|use-ref|jsx|children|lifecycle|primitive/,
  },
  layout: {
    title: "Drawing, layout, and effects",
    match:
      /layout|style|draw|path|circle|rectangle|ellipse|polygon|star|wedge|arc$|line$|group|clip|layer$|filter|absolute|overlay|flow|flex|grid|measure|text|image|responsive/,
  },
  input: {
    title: "Input, focus, and native HTML",
    match:
      /event|focus|keyboard|mouse|pointer|hit-|cursor|html|react-integration|manipulat|drag|resize|rotation/,
  },
  animation: {
    title: "Animation and scheduling",
    match:
      /animation|animated|playback|tween|spring|easing|keyframe|drive|sequence|parallel|repeat|marker|stepper|wait$/,
  },
  textures: {
    title: "Textures and reaction-diffusion",
    match: /texture|diffusion|marble|water|tendrils|lightning|rain-/,
  },
  physics: { title: "Physics and geometry", match: /physics/ },
  particles: { title: "Canvas particles", match: /particle/ },
  visualization: {
    title: "Data visualization",
    match:
      /visualization|scale|axis|series|domain|nearest|interpolat|pie-|hover-card/,
  },
  "external-renderers": {
    title: "External renderers and Three.js",
    match: /three|render-layer/,
  },
};
export function topicFor(id) {
  // Specific domains precede broad names such as "text" and "layer".
  for (const key of [
    "external-renderers",
    "text",
    "textures",
    "physics",
    "particles",
    "visualization",
    "animation",
    "input",
    "lifecycle",
    "layout",
  ]) {
    if (topics[key].match.test(id)) return key;
  }
  return "lifecycle";
}
const entryImports = {
  root: "@pibbl/core",
  machines: "@pibbl/core/machines",
  machineAnimation: "@pibbl/core/machines/animation",
  sprites: "@pibbl/core/sprites",
  aseprite: "@pibbl/core/sprites/formats/aseprite",
  texturePacker: "@pibbl/core/sprites/formats/texture-packer",
  filters: "@pibbl/core/filters",
  textures: "@pibbl/core/textures",
  text: "@pibbl/text",
  viz: "@pibbl/core/viz",
  three: "@pibbl/three",
  particles: "@pibbl/core/particles",
  types: "@pibbl/core/types",
  jsxRuntime: "@pibbl/core/jsx-runtime",
  jsxDevRuntime: "@pibbl/core/jsx-dev-runtime",
  physics2d: "@pibbl/core/physics/2d",
  physics2dGeometry: "@pibbl/core/physics/2d/geometry",
  physics2dTesting: "@pibbl/core/physics/2d/testing",
};

export async function loadDocumentation(root, playground) {
  const publicRoot = resolve(root, "docs/site");
  const paths = (await readdir(publicRoot, { recursive: true }))
    .filter((path) => path.endsWith(".md") && /^(api|learn)\//.test(path))
    .sort();
  const loaded = await Promise.all(
    paths.map(async (path) => {
      const source = await readFile(resolve(publicRoot, path), "utf8");
      const doc = parsePublicMarkdown(`docs/site/${path}`, source);
      const id = websiteDocumentId(doc.route);
      return { ...doc, id, path, source };
    }),
  );
  const byRoute = new Map(loaded.map((doc) => [doc.route, `/${doc.id}/`]));
  const byPath = new Map(
    loaded.map((doc) => [resolve(publicRoot, doc.path), `/${doc.id}/`]),
  );
  const records = loaded.map((doc) => {
    let body = doc.source
      .replace(/^---\n[\s\S]*?\n---\n/, "")
      .replace(/^\s*# [^\n]+\n/, "");
    const links = new Set();
    const walk = (tokens) => {
      for (const token of tokens) {
        const href = token.attrGet("href") ?? token.attrGet("src");
        if (href) links.add(href);
        if (token.children) walk(token.children);
      }
    };
    walk(markdown.parse(body, {}));
    for (const href of links) {
      let target = href;
      if (href.startsWith("#/")) {
        const split = href.indexOf("#", 2);
        const route = split < 0 ? href : href.slice(0, split);
        const anchor = split < 0 ? "" : href.slice(split);
        target = byRoute.has(route)
          ? byRoute.get(route) + anchor
          : playground + href;
      } else if (!/^(https?:|mailto:|#|\/)/.test(href)) {
        const [file, anchor] = href.split("#");
        const absolute = resolve(publicRoot, dirname(doc.path), file);
        target =
          byPath.get(absolute) ??
          `https://github.com/benlesh/pibbl/blob/main/${relative(root, absolute)}`;
        if (anchor) target += `#${anchor}`;
      }
      body = body.replaceAll(`](${href})`, `](${target})`);
    }
    const topic = topicFor(doc.id);
    if (doc.frontmatter.exampleSlug) {
      body += `\n[Open the interactive workbench](${playground}#/workbench/${doc.frontmatter.exampleSlug})\n`;
    }
    body += `\n## Implementation guidance for agents\n\nRead the [${topics[topic].title} companion](/agents/topics/${topic}/) for ownership, adaptation, failure modes, and verification. [Agent start](/agents/) provides the version-selection workflow.\n`;
    return {
      id: doc.id,
      meta: {
        ...doc.frontmatter,
        description: doc.frontmatter.summary,
        source: `docs/site/${doc.path}`,
        topic,
        relatedTypes: doc.frontmatter.relatedTypes ?? [],
      },
      content: body,
    };
  });
  const inventory = await collectPublicExports(
    {
      ...pibblStudioPublicEntryPaths,
      physics2dGeometry: pibblPhysicsEntryPaths.physics2dGeometry,
    },
    pibblPublicCompilerOptions,
  );
  const symbols = new Map();
  for (const record of records)
    for (const symbol of record.meta.symbols ?? []) symbols.set(symbol, record);
  const entries = Object.entries(inventory).flatMap(([entry, exports]) =>
    ["values", "types", "overview"].flatMap((kind) =>
      exports[kind].map((symbol) => ({
        symbol,
        importPath: entryImports[entry],
        kind:
          kind === "values" ? "value" : kind === "types" ? "type" : "compiler",
        url: symbols.has(symbol) ? `/${symbols.get(symbol).id}/` : null,
        documentation: symbols.has(symbol) ? "reference-listed" : "missing",
      })),
    ),
  );
  await addApiDetails(root, records);
  const searchPages = loaded.map((page) => {
    const record = records.find((record) => record.id === page.id);
    return {
      ...page,
      plainText: page.plainText + (record?.meta.apiSearchText ?? ""),
      sections: [...page.sections, ...(record?.meta.apiSearchSections ?? [])],
    };
  });
  return { records, entries, searchPages };
}

export async function loadAuthored(root) {
  const directory = resolve(root, "docs/site/website");
  return Promise.all(
    (await readdir(directory, { recursive: true }))
      .filter((path) => path.endsWith(".mdx"))
      .sort()
      .map(async (path) => {
        const source = await readFile(resolve(directory, path), "utf8");
        const [, header, content] = source.match(
          /^---\n([\s\S]*?)\n---\n([\s\S]*)$/,
        );
        return {
          id: path.replace(/\.mdx$/, "").replace(/\/index$/, ""),
          meta: parse(header),
          content,
        };
      }),
  );
}
