import { sanitizeHtml } from "monaco-editor/base/browser/domSanitize";
import { expect, it } from "vitest";

it("preserves safe Monaco hover markup while removing executable attributes and URLs", () => {
  const result = String(
    sanitizeHtml(
      '<p><strong>Documentation</strong> <a href="https://example.com">safe link</a><a href="javascript:alert(1)">unsafe link</a><img src="x" onerror="alert(1)"></p>',
    ),
  );
  const template = document.createElement("template");
  template.innerHTML = result;
  expect(template.content.querySelector("strong")?.textContent).toBe(
    "Documentation",
  );
  expect(template.content.querySelector("a")?.getAttribute("href")).toBe(
    "https://example.com",
  );
  expect(template.content.querySelectorAll("a")[1].hasAttribute("href")).toBe(
    false,
  );
  expect(template.content.querySelector("img")?.hasAttribute("onerror")).toBe(
    false,
  );
});

it("does not leak per-call Monaco sanitizer configuration into later calls", () => {
  const markup = '<span pibbl-probe="first">Text</span>';
  expect(
    String(
      sanitizeHtml(markup, {
        allowedAttributes: { augment: ["pibbl-probe"] },
      }),
    ),
  ).toContain('pibbl-probe="first"');
  expect(String(sanitizeHtml(markup))).not.toContain("pibbl-probe");
});
