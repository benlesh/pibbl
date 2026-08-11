import type {
  ScenarioController,
  ScenarioDefinition,
  ScenarioStateField,
} from './types';

const STYLE_ID = 'crc-scenario-surface-styles';

export const scenarioSurfaceStyles = `
  .scenario-detail {
    display: grid;
    gap: 24px;
  }

  .scenario-detail__header {
    display: grid;
    gap: 8px;
  }

  .scenario-detail__eyebrow,
  .scenario-detail__tags,
  .scenario-detail__summary {
    margin: 0;
  }

  .scenario-detail__eyebrow {
    color: #475569;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .scenario-detail__title {
    color: #0f172a;
    font-size: clamp(28px, 5vw, 48px);
    line-height: 1;
    margin: 0;
  }

  .scenario-detail__summary {
    color: #475569;
    font-size: 17px;
    line-height: 1.6;
    max-width: 68ch;
  }

  .scenario-detail__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    list-style: none;
    padding: 0;
  }

  .scenario-detail__tag {
    background: #e2e8f0;
    border-radius: 999px;
    color: #334155;
    font-size: 12px;
    font-weight: 700;
    padding: 5px 10px;
  }

  .scenario-runner {
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 16px;
    box-shadow: 0 18px 50px rgb(15 23 42 / 10%);
    overflow: hidden;
  }

  .scenario-runner__visual {
    align-items: stretch;
    background: #f8fafc;
    display: grid;
    grid-template-columns: 480px 240px;
    min-height: 240px;
    width: 720px;
  }

  .scenario-runner__canvas {
    display: block;
    height: 240px;
    width: 480px;
  }

  .scenario-runner__state {
    background: #0f172a;
    color: #f8fafc;
    display: grid;
    grid-auto-rows: min-content;
    margin: 0;
    padding: 28px 24px;
  }

  .scenario-runner__state-title {
    color: #94a3b8;
    font: 700 11px/1.4 Arial, sans-serif;
    letter-spacing: 0.08em;
    margin: 0 0 20px;
    text-transform: uppercase;
  }

  .scenario-runner__state-row {
    border-top: 1px solid #334155;
    display: grid;
    gap: 4px;
    padding: 12px 0;
  }

  .scenario-runner__state dt {
    color: #94a3b8;
    font: 12px/1.4 Arial, sans-serif;
  }

  .scenario-runner__state dd {
    font: 700 16px/1.4 Arial, sans-serif;
    margin: 0;
  }

  .scenario-runner__controls {
    align-items: center;
    border-top: 1px solid #e2e8f0;
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    padding: 16px;
  }

  .scenario-runner__button {
    background: #0f172a;
    border: 1px solid #0f172a;
    border-radius: 9px;
    color: #ffffff;
    cursor: pointer;
    font: 700 14px/1 Arial, sans-serif;
    min-height: 42px;
    padding: 0 16px;
  }

  .scenario-runner__button--secondary {
    background: #ffffff;
    color: #0f172a;
  }

  .scenario-runner__button:focus-visible {
    outline: 3px solid #38bdf8;
    outline-offset: 2px;
  }

  .scenario-docs {
    display: grid;
    gap: 20px;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  }

  .scenario-docs__section {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 20px;
  }

  .scenario-docs__section h2 {
    color: #0f172a;
    font-size: 18px;
    margin: 0 0 14px;
  }

  .scenario-docs__steps,
  .scenario-docs__limitations {
    color: #475569;
    display: grid;
    gap: 12px;
    line-height: 1.5;
    margin: 0;
    padding-left: 22px;
  }

  .scenario-source {
    background: #020617;
    border-radius: 12px;
    color: #e2e8f0;
    max-height: 520px;
    overflow: auto;
    padding: 20px;
  }

  .scenario-source code {
    font: 13px/1.6 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    white-space: pre;
  }

  @media (max-width: 840px) {
    .scenario-runner {
      overflow-x: auto;
    }
  }
`;

interface MountScenarioSurfaceOptions<TState> {
  container: HTMLElement;
  scenario: ScenarioDefinition<TState>;
  sourceText: string;
}

export interface ScenarioSurface<TState> {
  controller: ScenarioController<TState>;
  canvas: HTMLCanvasElement;
  visual: HTMLElement;
  updateButton: HTMLButtonElement;
  resetButton: HTMLButtonElement;
  dispose: () => void;
}

function installStyles(document: Document): void {
  if (document.getElementById(STYLE_ID)) {
    return;
  }
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = scenarioSurfaceStyles;
  document.head.appendChild(style);
}

function appendStateFields(
  stateList: HTMLDListElement,
  fields: readonly ScenarioStateField[],
): void {
  stateList.querySelectorAll('.scenario-runner__state-row').forEach(row => row.remove());

  for (const field of fields) {
    const row = document.createElement('div');
    row.className = 'scenario-runner__state-row';
    const term = document.createElement('dt');
    term.textContent = field.label;
    const detail = document.createElement('dd');
    detail.textContent = field.value;
    row.append(term, detail);
    stateList.appendChild(row);
  }
}

function createTagList(tags: readonly string[]): HTMLUListElement {
  const list = document.createElement('ul');
  list.className = 'scenario-detail__tags';
  for (const tag of tags) {
    const item = document.createElement('li');
    item.className = 'scenario-detail__tag';
    item.textContent = tag;
    list.appendChild(item);
  }
  return list;
}

export function mountScenarioSurface<TState>(
  options: MountScenarioSurfaceOptions<TState>,
): ScenarioSurface<TState> {
  installStyles(options.container.ownerDocument);

  const article = document.createElement('article');
  article.className = 'scenario-detail';
  article.dataset.scenarioId = options.scenario.metadata.id;

  const header = document.createElement('header');
  header.className = 'scenario-detail__header';
  const eyebrow = document.createElement('p');
  eyebrow.className = 'scenario-detail__eyebrow';
  eyebrow.textContent = `${options.scenario.metadata.category} · ${options.scenario.metadata.visibility} · ${options.scenario.metadata.maturity}`;
  const title = document.createElement('h1');
  title.className = 'scenario-detail__title';
  title.textContent = options.scenario.metadata.title;
  const summary = document.createElement('p');
  summary.className = 'scenario-detail__summary';
  summary.textContent = options.scenario.metadata.summary;
  header.append(
    eyebrow,
    title,
    summary,
    createTagList([
      ...options.scenario.metadata.apiTags,
      ...options.scenario.metadata.conceptTags,
    ]),
  );

  const runner = document.createElement('section');
  runner.className = 'scenario-runner';
  runner.ariaLabel = `${options.scenario.metadata.title} interactive example`;
  const visual = document.createElement('div');
  visual.className = 'scenario-runner__visual';
  visual.dataset.testid = 'scenario-visual';
  const canvas = document.createElement('canvas');
  canvas.className = 'scenario-runner__canvas';
  canvas.dataset.testid = 'scenario-canvas';
  canvas.setAttribute('aria-label', `${options.scenario.metadata.title} canvas`);
  const stateList = document.createElement('dl');
  stateList.className = 'scenario-runner__state';
  stateList.ariaLive = 'polite';
  const stateTitle = document.createElement('p');
  stateTitle.className = 'scenario-runner__state-title';
  stateTitle.textContent = 'Live scenario state';
  stateList.appendChild(stateTitle);
  visual.append(canvas, stateList);

  const controls = document.createElement('div');
  controls.className = 'scenario-runner__controls';
  const updateButton = document.createElement('button');
  updateButton.className = 'scenario-runner__button';
  updateButton.type = 'button';
  updateButton.textContent = 'Update scene';
  const resetButton = document.createElement('button');
  resetButton.className = 'scenario-runner__button scenario-runner__button--secondary';
  resetButton.type = 'button';
  resetButton.textContent = 'Reset';
  controls.append(updateButton, resetButton);
  runner.append(visual, controls);

  const docs = document.createElement('div');
  docs.className = 'scenario-docs';
  const instructions = document.createElement('section');
  instructions.className = 'scenario-docs__section';
  const instructionsTitle = document.createElement('h2');
  instructionsTitle.textContent = 'Manual procedure';
  const steps = document.createElement('ol');
  steps.className = 'scenario-docs__steps';
  for (const step of options.scenario.metadata.manualSteps) {
    const item = document.createElement('li');
    const action = document.createElement('strong');
    action.textContent = `${step.action} `;
    item.append(action, step.expected);
    steps.appendChild(item);
  }
  instructions.append(instructionsTitle, steps);

  const limitations = document.createElement('section');
  limitations.className = 'scenario-docs__section';
  const limitationsTitle = document.createElement('h2');
  limitationsTitle.textContent = 'Known limitations';
  const limitationsList = document.createElement('ul');
  limitationsList.className = 'scenario-docs__limitations';
  for (const limitation of options.scenario.metadata.knownLimitations) {
    const item = document.createElement('li');
    item.textContent = limitation;
    limitationsList.appendChild(item);
  }
  limitations.append(limitationsTitle, limitationsList);
  docs.append(instructions, limitations);

  const sourceSection = document.createElement('section');
  sourceSection.className = 'scenario-docs__section';
  const sourceTitle = document.createElement('h2');
  sourceTitle.textContent = `Exercised source · ${options.scenario.metadata.sourcePath}`;
  const source = document.createElement('pre');
  source.className = 'scenario-source';
  const code = document.createElement('code');
  code.textContent = options.sourceText;
  source.appendChild(code);
  sourceSection.append(sourceTitle, source);

  article.append(header, runner, docs, sourceSection);
  options.container.replaceChildren(article);

  const controller = options.scenario.mount({
    canvas,
    onStateChange: state => appendStateFields(
      stateList,
      options.scenario.formatState(state),
    ),
  });
  const update = () => controller.update();
  const reset = () => controller.reset();
  updateButton.addEventListener('click', update);
  resetButton.addEventListener('click', reset);

  return {
    controller,
    canvas,
    visual,
    updateButton,
    resetButton,
    dispose: () => {
      updateButton.removeEventListener('click', update);
      resetButton.removeEventListener('click', reset);
      controller.dispose();
      article.remove();
    },
  };
}
