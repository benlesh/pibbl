import type { ScenarioSurface } from '@crc/scenarios/surface';
import {
  getScenarioBySlug,
  loadScenario,
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
brand.href = '#/scenarios/baseline-smoke';
brand.textContent = 'CRC';
const brandDescription = document.createElement('p');
brandDescription.className = 'gallery-brand__description';
brandDescription.textContent = 'Shared manual and automated scenario gallery';
const navigation = document.createElement('nav');
navigation.ariaLabel = 'Scenario catalog';
const navigationHeading = document.createElement('p');
navigationHeading.className = 'gallery-nav__heading';
navigationHeading.textContent = 'Getting started';
const navigationList = document.createElement('ul');
navigationList.className = 'gallery-nav';

for (const scenario of scenarioCatalog) {
  const item = document.createElement('li');
  const link = document.createElement('a');
  link.className = 'gallery-nav__link';
  link.dataset.scenarioSlug = scenario.metadata.slug;
  link.href = `#/scenarios/${scenario.metadata.slug}`;
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

function selectedSlug(): string {
  const match = /^#\/scenarios\/([a-z0-9-]+)$/.exec(window.location.hash);
  return match?.[1] ?? smokeScenarioEntry.metadata.slug;
}

let renderVersion = 0;

async function renderSelectedScenario(): Promise<void> {
  const currentVersion = ++renderVersion;
  const slug = selectedSlug();
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

  for (const link of Array.from(navigationList.querySelectorAll<HTMLAnchorElement>('a'))) {
    const isCurrent = link.dataset.scenarioSlug === selectedEntry.metadata.slug;
    link.classList.toggle('gallery-nav__link--active', isCurrent);
    if (isCurrent) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  }

  if (slug !== selectedEntry.metadata.slug) {
    window.history.replaceState(null, '', `#/scenarios/${selectedEntry.metadata.slug}`);
  }
}

window.addEventListener('hashchange', () => void renderSelectedScenario());
window.addEventListener('beforeunload', () => void activeSurface?.dispose());
void renderSelectedScenario();
