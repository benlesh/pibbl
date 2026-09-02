export type ScenarioVisibility =
  | 'documentation-candidate'
  | 'test-laboratory';

export type ScenarioMaturity =
  | 'baseline'
  | 'characterization'
  | 'contract'
  | 'trusted';

export interface ScenarioInstruction {
  action: string;
  expected: string;
}

export interface ScenarioAction {
  id: string;
  label: string;
}

export interface ScenarioSourceReference {
  id: string;
  language: 'tsx';
  marker: string;
  path: string;
}

export interface ScenarioMetadata {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  apiTags: readonly string[];
  conceptTags: readonly string[];
  manualSteps: readonly ScenarioInstruction[];
  knownLimitations: readonly string[];
  learningOrder: number;
  visibility: ScenarioVisibility;
  visibilityReason: string;
  maturity: ScenarioMaturity;
}

export interface ScenarioMountContext<TState> {
  canvas: HTMLCanvasElement;
  referenceHost?: HTMLElement;
  onStateChange?: (state: Readonly<TState>) => void;
}

export interface ScenarioController<TState> {
  getState: () => Readonly<TState>;
  perform: (actionId: string) => Promise<void>;
  reset: () => Promise<void>;
  settled: () => Promise<void>;
  dispose: () => Promise<void>;
}

export interface ScenarioStateField {
  label: string;
  value: string;
}

export interface ScenarioCatalogRecord {
  metadata: ScenarioMetadata;
  canvas: {
    width: number;
    height: number;
  };
  actions: readonly ScenarioAction[];
  source: ScenarioSourceReference;
  load: () => Promise<unknown>;
}

export interface ScenarioCatalogEntry<TState> extends ScenarioCatalogRecord {
  load: () => Promise<ScenarioDefinition<TState>>;
}

export interface ScenarioCatalogGroup {
  key: string;
  label: string;
  scenarios: readonly AnyScenarioCatalogEntry[];
}

export interface ScenarioCatalogIndex {
  learningPath: readonly AnyScenarioCatalogEntry[];
  byApi: readonly ScenarioCatalogGroup[];
  byConcept: readonly ScenarioCatalogGroup[];
  byCategory: readonly ScenarioCatalogGroup[];
  byVisibilityAndMaturity: readonly ScenarioCatalogGroup[];
}

export interface ScenarioDefinition<TState> {
  id: string;
  sourceId: string;
  actionIds: readonly string[];
  mount: (
    context: ScenarioMountContext<TState>,
  ) => Promise<ScenarioController<TState>>;
  formatState: (state: Readonly<TState>) => readonly ScenarioStateField[];
}

export type AnyScenarioCatalogEntry = ScenarioCatalogEntry<any>;
export type AnyScenarioDefinition = ScenarioDefinition<any>;
