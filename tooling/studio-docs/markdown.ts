import MarkdownIt from "markdown-it";
import type { Token } from "markdown-it";
import * as YAML from "yaml";

import type {
  LoadedPublicDoc,
  PublicDocHeading,
  PublicDocInternalLink,
} from "./model";
import { validatePublicDocFrontmatter } from "./model";

export { validatePublicDocFrontmatter } from "./model";

const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
});
markdown.renderer.rules.link_open = (
  tokens,
  index,
  options,
  _environment,
  self,
) => {
  const token = tokens[index];
  const href = token.attrGet("href");
  if (typeof href === "string" && isExternalLink(href)) {
    token.attrJoin("rel", "noreferrer");
  }
  return self.renderToken(tokens, index, options);
};
const rawHtmlDetector = new MarkdownIt({ html: true });

export function parsePublicMarkdown(
  path: string,
  source: string,
): LoadedPublicDoc {
  const { frontmatterSource, markdownSource } = splitFrontmatter(path, source);
  const frontmatter = validatePublicDocFrontmatter(
    YAML.parse(frontmatterSource),
    path,
  );
  assertNoRawHtml(path, markdownSource);

  const tokens = markdown.parse(markdownSource, {});
  const headings = assignHeadingIds(tokens);
  const internalLinks = collectInternalLinks(tokens, headings);
  const html = markdown.renderer.render(tokens, markdown.options, {});

  return {
    frontmatter,
    route: routeFor(frontmatter.kind, frontmatter.slug, frontmatter),
    html,
    plainText: collectPlainText(tokens),
    headings,
    internalLinks,
  };
}

function splitFrontmatter(
  path: string,
  source: string,
): { frontmatterSource: string; markdownSource: string } {
  const lines = source.split(/\r?\n/u);
  if (lines[0] !== "---") {
    throw new Error(`${path}: public Markdown must begin with frontmatter.`);
  }

  const closingIndex = lines.findIndex(
    (line, index) => index > 0 && line === "---",
  );
  if (closingIndex === -1) {
    throw new Error(`${path}: frontmatter must end with a closing --- line.`);
  }

  return {
    frontmatterSource: lines.slice(1, closingIndex).join("\n"),
    markdownSource: lines.slice(closingIndex + 1).join("\n"),
  };
}

function assertNoRawHtml(path: string, source: string): void {
  const containsRawHtml = rawHtmlDetector.parse(source, {}).some((token) => {
    if (token.type === "html_block") return true;
    return (
      token.children?.some((child) => child.type === "html_inline") ?? false
    );
  });
  if (containsRawHtml) {
    throw new Error(`${path}: Raw HTML is not supported in public Markdown.`);
  }
}

function assignHeadingIds(tokens: Token[]): readonly PublicDocHeading[] {
  const counts = new Map<string, number>();
  const headings: PublicDocHeading[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type !== "heading_open") continue;

    const inline = tokens[index + 1];
    const text = inline?.type === "inline" ? inlineText(inline) : "";
    const baseId = githubHeadingId(text);
    const occurrence = (counts.get(baseId) ?? 0) + 1;
    counts.set(baseId, occurrence);
    const id = occurrence === 1 ? baseId : `${baseId}-${occurrence}`;
    token.attrSet("id", id);
    headings.push({ id, level: Number(token.tag.slice(1)), text });
  }

  return headings;
}

function collectInternalLinks(
  tokens: readonly Token[],
  headings: readonly PublicDocHeading[],
): readonly PublicDocInternalLink[] {
  const links: PublicDocInternalLink[] = [];
  let headingIndex = -1;

  for (const token of tokens) {
    if (token.type === "heading_open") {
      headingIndex += 1;
      continue;
    }
    if (token.type !== "inline") continue;

    for (const child of token.children ?? []) {
      if (child.type !== "link_open") continue;
      const href = child.attrGet("href");
      if (typeof href === "string" && href.startsWith("#/")) {
        const sourceHeading = headings[headingIndex]?.id;
        if (sourceHeading === undefined) {
          throw new Error(
            "Internal documentation links must appear beneath a heading.",
          );
        }
        links.push({ href, sourceHeading });
      }
    }
  }

  return links;
}

function collectPlainText(tokens: readonly Token[]): string {
  const values: string[] = [];
  for (const token of tokens) {
    if (token.type === "inline") {
      const value = inlineText(token);
      if (value.length > 0) values.push(value);
    } else if (token.type === "fence" || token.type === "code_block") {
      const value = token.content.trim();
      if (value.length > 0) values.push(value);
    }
  }
  return values.join("\n");
}

function inlineText(token: Token): string {
  return (token.children ?? [])
    .filter((child) => child.type === "text" || child.type === "code_inline")
    .map((child) => child.content)
    .join("")
    .trim();
}

function githubHeadingId(value: string): string {
  const normalized = value
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/[\s-]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  return normalized.length > 0 ? normalized : "section";
}

function isExternalLink(href: string): boolean {
  return /^https?:\/\//u.test(href) || href.startsWith("mailto:");
}

function routeFor(
  kind: LoadedPublicDoc["frontmatter"]["kind"],
  slug: string,
  frontmatter: LoadedPublicDoc["frontmatter"],
): string {
  switch (kind) {
    case "landing":
      return `#/${slug}`;
    case "tutorial":
      if (slug === frontmatter.tutorial) {
        return `#/learn/tutorials/${slug}`;
      }
      return `#/learn/tutorials/${frontmatter.tutorial ?? "diagram-editor"}/${slug}`;
    case "guide":
      return `#/learn/guides/${slug}`;
    case "api":
      return apiRouteFor(slug, frontmatter);
  }
}

function apiRouteFor(
  slug: string,
  frontmatter: LoadedPublicDoc["frontmatter"],
): string {
  switch (frontmatter.apiCategory) {
    case "component":
      return `#/api/components/${slug}`;
    case "function":
      return `#/api/functions/${slug}`;
    case "hook":
      return `#/api/hooks/${slug}`;
    case "types":
      return `#/api/types/${frontmatter.typeDomain ?? slug}`;
    case "overview":
    case undefined:
      return "#/api";
  }
}
