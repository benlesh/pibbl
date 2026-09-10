import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/jetbrains-mono";
import { learningExampleCatalog } from "@crc/scenarios";
import { documentation } from "virtual:crc-studio-docs";

import { buildNavigation } from "./app/navigation";
import { createPageLifecycle } from "./app/page-lifecycle";
import { canonicalizeHash, parseStudioRoute } from "./app/routes";
import { createStudioShell } from "./app/shell";
import { createDocumentationPages } from "./docs/documentation-pages";
import { createExamplePages } from "./examples/example-pages";
import { createTestingPages } from "./testing/testing-pages";
import "./style.css";

const app = document.getElementById("app");
if (!app) throw new Error("No app element found.");

const lifecycle = createPageLifecycle();
const shell = createStudioShell({
  app,
  navigation: buildNavigation(documentation, learningExampleCatalog),
  onSearchNavigate(url) {
    window.location.hash = url;
  },
  loadSearchBundle: () => import("virtual:crc-studio-search"),
});
const documentationPages = createDocumentationPages({
  container: shell.main,
  lifecycle,
  finishRoute: shell.finishRoute,
});
const examplePages = createExamplePages({
  container: shell.main,
  lifecycle,
  finishRoute: shell.finishRoute,
});
const testingPages = createTestingPages({
  container: shell.main,
  lifecycle,
  finishRoute: shell.finishRoute,
});

function currentRoute() {
  if (
    window.location.hash === "" ||
    window.location.hash === "#" ||
    window.location.hash === "#/"
  ) {
    window.history.replaceState(null, "", "#/examples");
  }
  const canonical = canonicalizeHash(window.location.hash);
  if (canonical.changed) {
    window.history.replaceState(null, "", canonical.canonical);
  }
  return canonical.changed ? canonical.route : parseStudioRoute(window.location.hash);
}

async function renderRoute(): Promise<void> {
  const version = await lifecycle.begin();
  if (!lifecycle.isCurrent(version)) return;
  shell.closeDrawer();
  const route = currentRoute();
  shell.setActiveNavigation(route);

  switch (route.kind) {
    case "document":
      if (!(await documentationPages.render(route, version))) {
        documentationPages.renderMissing();
      }
      return;
    case "examples":
      await examplePages.renderLanding(version);
      return;
    case "example": {
      const entry = learningExampleCatalog.find(
        (candidate) =>
          candidate.slug === route.slug &&
          candidate.browseGroup === route.group,
      );
      if (entry) {
        await examplePages.renderDetail(entry, version);
      } else {
        window.history.replaceState(null, "", "#/examples");
        await examplePages.renderLanding(version);
      }
      return;
    }
    case "testing":
      testingPages.renderIndex();
      return;
    case "test":
      await testingPages.renderDetail(route.slug, version);
      return;
    case "unknown":
      window.history.replaceState(null, "", "#/examples");
      await examplePages.renderLanding(version);
  }
}

window.addEventListener("hashchange", () => void renderRoute());
window.addEventListener("beforeunload", () => {
  void lifecycle.dispose();
  shell.dispose();
});
void renderRoute();
