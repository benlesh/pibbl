import type { ScenarioSurface } from '@crc/scenarios/surface';
import {
  getScenarioBySlug,
  getScenarioRoute,
  loadScenario,
  scenarioCatalogIndex,
  scenarioCatalog,
  smokeScenarioEntry,
} from '@crc/scenarios';
import { mountScenarioSurface } from '@crc/scenarios/surface';
import { loadScenarioSource } from './scenario-sources';
import './style.css';

const app = document.getElementById('app');
if (!app) {
  throw new Error('No app element found.');
}

const shell = document.createElement('div');
shell.className = 'gallery-shell';
const sidebar = document.createElement('aside');
sidebar.className = 'gallery-sidebar';
const brand = document.createElement('a');
brand.className = 'gallery-brand';
brand.href = '#/scenarios';
brand.textContent = 'CRC';
const brandDescription = document.createElement('p');
brandDescription.className = 'gallery-brand__description';
brandDescription.textContent = 'Shared manual and automated scenario gallery';
const navigation = document.createElement('nav');
navigation.ariaLabel = 'Scenario catalog';
const navigationHeading = document.createElement('p');
navigationHeading.className = 'gallery-nav__heading';
navigationHeading.textContent = 'Learning path';
const navigationList = document.createElement('ul');
navigationList.className = 'gallery-nav';

const indexItem = document.createElement('li');
const indexLink = document.createElement('a');
indexLink.className = 'gallery-nav__link gallery-nav__link--index';
indexLink.dataset.scenarioIndex = 'true';
indexLink.href = '#/scenarios';
const indexTitle = document.createElement('strong');
indexTitle.textContent = 'Scenario index';
const indexDetail = document.createElement('span');
indexDetail.textContent = `${scenarioCatalog.length} executable examples`;
indexLink.append(indexTitle, indexDetail);
indexItem.appendChild(indexLink);
navigationList.appendChild(indexItem);

let lastCategory = '';
for (const scenario of [...scenarioCatalog].sort(
  (left, right) => left.metadata.learningOrder - right.metadata.learningOrder,
)) {
  if (scenario.metadata.category !== lastCategory) {
    const category = document.createElement('li');
    category.className = 'gallery-nav__category';
    category.textContent = scenario.metadata.category;
    navigationList.appendChild(category);
    lastCategory = scenario.metadata.category;
  }
  const item = document.createElement('li');
  const link = document.createElement('a');
  link.className = 'gallery-nav__link';
  link.dataset.scenarioSlug = scenario.metadata.slug;
  link.href = getScenarioRoute(scenario);
  const title = document.createElement('strong');
  title.textContent = scenario.metadata.title;
  const maturity = document.createElement('span');
  maturity.textContent = scenario.metadata.maturity;
  link.append(title, maturity);
  item.appendChild(link);
  navigationList.appendChild(item);
}

navigation.append(navigationHeading, navigationList);
sidebar.append(brand, brandDescription, navigation);
const main = document.createElement('main');
main.className = 'gallery-main';
shell.append(sidebar, main);
app.appendChild(shell);

let activeSurface: ScenarioSurface<any> | undefined;

function selectedSlug(): string | undefined {
  const match = /^#\/scenarios\/([a-z0-9-]+)$/.exec(window.location.hash);
  return match?.[1];
}

let renderVersion = 0;

function createIndexScenarioLink(
  entry: (typeof scenarioCatalog)[number],
): HTMLAnchorElement {
  const link = document.createElement('a');
  link.href = getScenarioRoute(entry);
  link.textContent = entry.metadata.title;
  return link;
}

function appendFacetSection(
  host: HTMLElement,
  title: string,
  groups: typeof scenarioCatalogIndex.byApi,
): void {
  const section = document.createElement('section');
  section.className = 'catalog-index__facet';
  const heading = document.createElement('h2');
  heading.textContent = title;
  const list = document.createElement('dl');
  for (const group of groups) {
    const term = document.createElement('dt');
    term.textContent = group.label;
    const detail = document.createElement('dd');
    group.scenarios.forEach((entry, index) => {
      if (index) {
        detail.append(', ');
      }
      detail.appendChild(createIndexScenarioLink(entry));
    });
    list.append(term, detail);
  }
  section.append(heading, list);
  host.appendChild(section);
}

function renderScenarioIndex(): void {
  const article = document.createElement('article');
  article.className = 'catalog-index';
  const eyebrow = document.createElement('p');
  eyebrow.className = 'scenario-detail__eyebrow';
  eyebrow.textContent = 'Executable CRC evidence';
  const title = document.createElement('h1');
  title.className = 'scenario-detail__title';
  title.textContent = 'Scenario index';
  const summary = document.createElement('p');
  summary.className = 'scenario-detail__summary';
  summary.textContent = `${scenarioCatalog.length} shared examples serve the manual gallery and browser suite. Documentation candidates stay separate from diagnostic laboratories.`;
  article.append(eyebrow, title, summary);

  const path = document.createElement('section');
  path.className = 'catalog-index__learning';
  const pathTitle = document.createElement('h2');
  pathTitle.textContent = 'Learning progression';
  const pathList = document.createElement('ol');
  for (const entry of scenarioCatalogIndex.learningPath) {
    const item = document.createElement('li');
    const link = createIndexScenarioLink(entry);
    const metadata = document.createElement('span');
    metadata.textContent = `${entry.metadata.category} · ${entry.metadata.visibility} · ${entry.metadata.maturity}`;
    const summaryText = document.createElement('p');
    summaryText.textContent = entry.metadata.summary;
    item.append(link, metadata, summaryText);
    pathList.appendChild(item);
  }
  path.append(pathTitle, pathList);
  article.appendChild(path);

  const facets = document.createElement('div');
  facets.className = 'catalog-index__facets';
  appendFacetSection(facets, 'By public API', scenarioCatalogIndex.byApi);
  appendFacetSection(facets, 'By concept', scenarioCatalogIndex.byConcept);
  appendFacetSection(facets, 'By category', scenarioCatalogIndex.byCategory);
  appendFacetSection(
    facets,
    'By visibility and maturity',
    scenarioCatalogIndex.byVisibilityAndMaturity,
  );
  article.appendChild(facets);
  main.replaceChildren(article);
}

function updateActiveNavigation(slug?: string): void {
  indexLink.classList.toggle('gallery-nav__link--active', !slug);
  if (slug) {
    indexLink.removeAttribute('aria-current');
  } else {
    indexLink.setAttribute('aria-current', 'page');
  }
  for (const link of Array.from(navigationList.querySelectorAll<HTMLAnchorElement>('[data-scenario-slug]'))) {
    const isCurrent = link.dataset.scenarioSlug === slug;
    link.classList.toggle('gallery-nav__link--active', isCurrent);
    if (isCurrent) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  }
}

async function renderSelectedScenario(): Promise<void> {
  const currentVersion = ++renderVersion;
  const slug = selectedSlug();
  if (!slug) {
    await activeSurface?.dispose();
    activeSurface = undefined;
    renderScenarioIndex();
    updateActiveNavigation();
    if (window.location.hash !== '#/scenarios') {
      window.history.replaceState(null, '', '#/scenarios');
    }
    return;
  }
  const selectedEntry = getScenarioBySlug(slug) ?? smokeScenarioEntry;
  const [definition, sourceText] = await Promise.all([
    loadScenario(selectedEntry),
    loadScenarioSource(selectedEntry),
  ]);
  if (currentVersion !== renderVersion) {
    return;
  }

  await activeSurface?.dispose();
  activeSurface = await mountScenarioSurface({
    container: main,
    entry: selectedEntry,
    definition,
    sourceText,
  });

  updateActiveNavigation(selectedEntry.metadata.slug);

  if (slug !== selectedEntry.metadata.slug) {
    window.history.replaceState(null, '', `#/scenarios/${selectedEntry.metadata.slug}`);
  }
}

window.addEventListener('hashchange', () => void renderSelectedScenario());
window.addEventListener('beforeunload', () => void activeSurface?.dispose());
void renderSelectedScenario();
