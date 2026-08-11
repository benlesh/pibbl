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
  sourcePath: string;
  visibility: ScenarioVisibility;
  maturity: ScenarioMaturity;
}

export interface ScenarioMountContext<TState> {
  canvas: HTMLCanvasElement;
  onStateChange?: (state: TState) => void;
}

export interface ScenarioController<TState> {
  getState: () => TState;
  update: () => void;
  reset: () => void;
  dispose: () => void;
}

export interface ScenarioCatalogEntry {
  metadata: ScenarioMetadata;
  canvas: {
    width: number;
    height: number;
  };
}

export interface ScenarioDefinition<TState> extends ScenarioCatalogEntry {
  mount: (context: ScenarioMountContext<TState>) => ScenarioController<TState>;
}
