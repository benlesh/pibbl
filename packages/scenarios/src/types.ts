import type { agentTargetingVerificationScenarioEntry, animationLabScenarioEntry, createScenarioCatalogIndex, getScenarioRoute } from './catalog.js';
/**
 * Controls whether a scenario is listed or only directly addressable in the lab.
 *
 * @see {@link ScenarioMetadata}
 */
export type ScenarioVisibility =
  | 'documentation-candidate'
  | 'test-laboratory';

/**
 * The recorded stability level of a scenario's contract.
 *
 * @see {@link ScenarioMetadata}
 */
export type ScenarioMaturity =
  | 'baseline'
  | 'characterization'
  | 'contract'
  | 'trusted';

/**
 * A manual exercise and its expected observation for a scenario.
 *
 * @see {@link ScenarioMetadata}
 */
export interface ScenarioInstruction {
  /** Action recorded or configured by this scenario. See {@link ScenarioInstruction}. */
  action: string;
  /** Expected recorded or configured by this scenario. See {@link ScenarioInstruction}. */
  expected: string;
}

/**
 * A named action that a scenario exposes for manual and headless execution.
 *
 * @see {@link ScenarioCatalogRecord}
 */
export interface ScenarioAction {
  /** Id recorded or configured by this scenario. See {@link ScenarioAction}. */
  id: string;
  /** Label recorded or configured by this scenario. See {@link ScenarioAction}. */
  label: string;
}

/**
 * Source-file metadata used to inspect or edit a scenario in the Studio.
 *
 * @see {@link ScenarioCatalogRecord}
 */
export interface ScenarioSourceReference {
  /** Id recorded or configured by this scenario. See {@link ScenarioSourceReference}. */
  id: string;
  /** Language recorded or configured by this scenario. See {@link ScenarioSourceReference}. */
  language: 'tsx';
  /** Marker recorded or configured by this scenario. See {@link ScenarioSourceReference}. */
  marker: string;
  /** Path recorded or configured by this scenario. See {@link ScenarioSourceReference}. */
  path: string;
}

/**
 * Identity, presentation, and verification metadata for a deterministic scenario.
 *
 * @see {@link ScenarioInstruction}
 * @see {@link ScenarioVisibility}
 * @see {@link ScenarioMaturity}
 * @see {@link ScenarioCatalogRecord}
 */
export interface ScenarioMetadata {
  /** Id recorded or configured by this scenario. See {@link ScenarioMetadata}. */
  id: string;
  /** Slug recorded or configured by this scenario. See {@link ScenarioMetadata}. */
  slug: string;
  /** Title recorded or configured by this scenario. See {@link ScenarioMetadata}. */
  title: string;
  /** Summary recorded or configured by this scenario. See {@link ScenarioMetadata}. */
  summary: string;
  /** Category recorded or configured by this scenario. See {@link ScenarioMetadata}. */
  category: string;
  /** Api tags recorded or configured by this scenario. See {@link ScenarioMetadata}. */
  apiTags: readonly string[];
  /** Concept tags recorded or configured by this scenario. See {@link ScenarioMetadata}. */
  conceptTags: readonly string[];
  /** Manual steps recorded or configured by this scenario. See {@link ScenarioInstruction}. */
  manualSteps: readonly ScenarioInstruction[];
  /** Known limitations recorded or configured by this scenario. See {@link ScenarioMetadata}. */
  knownLimitations: readonly string[];
  /** Learning order recorded or configured by this scenario. See {@link ScenarioMetadata}. */
  learningOrder: number;
  /** Visibility recorded or configured by this scenario. See {@link ScenarioVisibility}. */
  visibility: ScenarioVisibility;
  /** Visibility reason recorded or configured by this scenario. See {@link ScenarioMetadata}. */
  visibilityReason: string;
  /** Maturity recorded or configured by this scenario. See {@link ScenarioMaturity}. */
  maturity: ScenarioMaturity;
}

/**
 * Canvas and host context supplied while mounting a scenario implementation.
 *
 * @see {@link ScenarioDefinition}
 */
export interface ScenarioMountContext<TState> {
  /** Canvas recorded or configured by this scenario. See {@link ScenarioMountContext}. */
  canvas: HTMLCanvasElement;
  /** Reference host recorded or configured by this scenario. See {@link ScenarioMountContext}. */
  referenceHost?: HTMLElement;
  /**
   * On state change recorded or configured by this scenario. See {@link ScenarioMountContext}.
   * @param state - Latest semantic state reported by the scenario.
   */
  onStateChange?: (state: Readonly<TState>) => void;
}

/**
 * Mounted scenario controls for dispatching actions, reading state, and disposing resources.
 *
 * @see {@link ScenarioDefinition}
 */
export interface ScenarioController<TState> {
  /**
   * Get state recorded or configured by this scenario. See {@link ScenarioController}.
   * @returns The scenario's current semantic state.
   */
  getState: () => Readonly<TState>;
  /**
   * Perform recorded or configured by this scenario. See {@link ScenarioController}.
   * @param actionId - Identifier of the scenario action to execute.
   * @returns A promise that resolves after the action completes.
   */
  perform: (actionId: string) => Promise<void>;
  /**
   * Reset recorded or configured by this scenario. See {@link ScenarioController}.
   * @returns A promise that resolves after the scenario returns to its initial state.
   */
  reset: () => Promise<void>;
  /**
   * Settled recorded or configured by this scenario. See {@link ScenarioController}.
   * @returns A promise that resolves when the scenario's pending work settles.
   */
  settled: () => Promise<void>;
  /**
   * Dispose recorded or configured by this scenario. See {@link ScenarioController}.
   * @returns A promise that resolves after the scenario releases its owned resources.
   */
  dispose: () => Promise<void>;
}

/**
 * Presentation metadata for a field in a scenario's observed state.
 *
 * @see {@link ScenarioDefinition}
 */
export interface ScenarioStateField {
  /** Label recorded or configured by this scenario. See {@link ScenarioStateField}. */
  label: string;
  /** Value recorded or configured by this scenario. See {@link ScenarioStateField}. */
  value: string;
}

/**
 * Metadata required to identify, route, and present a deterministic scenario.
 *
 * @see {@link ScenarioMetadata}
 * @see {@link ScenarioAction}
 * @see {@link ScenarioSourceReference}
 * @see {@link ScenarioCatalogEntry}
 * @see {@link getScenarioRoute}
 */
export interface ScenarioCatalogRecord {
  /** Metadata recorded or configured by this scenario. See {@link ScenarioMetadata}. */
  metadata: ScenarioMetadata;
  /** Canvas recorded or configured by this scenario. See {@link ScenarioCatalogRecord}. */
  canvas: {
    /** Width recorded or configured by this scenario. See {@link ScenarioCatalogRecord}. */
    width: number;
    /** Height recorded or configured by this scenario. See {@link ScenarioCatalogRecord}. */
    height: number;
  };
  /** Actions recorded or configured by this scenario. See {@link ScenarioAction}. */
  actions: readonly ScenarioAction[];
  /** Source recorded or configured by this scenario. See {@link ScenarioSourceReference}. */
  source: ScenarioSourceReference;
  /**
   * Load recorded or configured by this scenario. See {@link ScenarioCatalogRecord}.
   * @returns A promise for the catalog entry's loaded module.
   */
  load: () => Promise<unknown>;
}

/**
 * Scenario metadata paired with a lazy loader for its typed implementation.
 *
 * @see {@link ScenarioCatalogRecord}
 * @see {@link ScenarioDefinition}
 * @see {@link AnyScenarioCatalogEntry}
 * @see {@link agentTargetingVerificationScenarioEntry}
 * @see {@link animationLabScenarioEntry}
 */
export interface ScenarioCatalogEntry<TState> extends ScenarioCatalogRecord {
  /**
   * Load recorded or configured by this scenario. See {@link ScenarioDefinition}.
   * @returns A promise for the scenario definition. See {@link ScenarioDefinition}.
   */
  load: () => Promise<ScenarioDefinition<TState>>;
}

/**
 * A named group of deterministic scenarios for lab navigation.
 *
 * @see {@link AnyScenarioCatalogEntry}
 * @see {@link ScenarioCatalogIndex}
 */
export interface ScenarioCatalogGroup {
  /** Key recorded or configured by this scenario. See {@link ScenarioCatalogGroup}. */
  key: string;
  /** Label recorded or configured by this scenario. See {@link ScenarioCatalogGroup}. */
  label: string;
  /** Scenarios recorded or configured by this scenario. See {@link AnyScenarioCatalogEntry}. */
  scenarios: readonly AnyScenarioCatalogEntry[];
}

/**
 * Indexes used to look up and group deterministic scenario catalog records.
 *
 * @see {@link AnyScenarioCatalogEntry}
 * @see {@link ScenarioCatalogGroup}
 * @see {@link createScenarioCatalogIndex}
 */
export interface ScenarioCatalogIndex {
  /** Learning path recorded or configured by this scenario. See {@link AnyScenarioCatalogEntry}. */
  learningPath: readonly AnyScenarioCatalogEntry[];
  /** By api recorded or configured by this scenario. See {@link ScenarioCatalogGroup}. */
  byApi: readonly ScenarioCatalogGroup[];
  /** By concept recorded or configured by this scenario. See {@link ScenarioCatalogGroup}. */
  byConcept: readonly ScenarioCatalogGroup[];
  /** By category recorded or configured by this scenario. See {@link ScenarioCatalogGroup}. */
  byCategory: readonly ScenarioCatalogGroup[];
  /**
   * By visibility and maturity recorded or configured by this scenario. See
   * {@link ScenarioCatalogGroup}.
   */
  byVisibilityAndMaturity: readonly ScenarioCatalogGroup[];
}

/**
 * The metadata and mount function of a manually usable, headlessly driven scenario.
 *
 * @see {@link ScenarioMountContext}
 * @see {@link ScenarioController}
 * @see {@link ScenarioStateField}
 * @see {@link AnyScenarioDefinition}
 * @see {@link ScenarioCatalogEntry}
 */
export interface ScenarioDefinition<TState> {
  /** Id recorded or configured by this scenario. See {@link ScenarioDefinition}. */
  id: string;
  /** Source id recorded or configured by this scenario. See {@link ScenarioDefinition}. */
  sourceId: string;
  /** Action ids recorded or configured by this scenario. See {@link ScenarioDefinition}. */
  actionIds: readonly string[];
  /**
   * Mount recorded or configured by this scenario. See {@link ScenarioMountContext},
   * {@link ScenarioController}.
   * @param context - Canvas, initial state, and state-change reporting services. See
   * {@link ScenarioMountContext} .
   * @returns A promise for the mounted scenario controller. See {@link ScenarioController}.
   */
  mount: (context: ScenarioMountContext<TState>) => Promise<ScenarioController<TState>>;
  /**
   * Format state recorded or configured by this scenario. See {@link ScenarioStateField}.
   * @param state - Current semantic state to format.
   * @returns Display fields representing that state. See {@link ScenarioStateField}.
   */
  formatState: (state: Readonly<TState>) => readonly ScenarioStateField[];
}

/**
 * A scenario catalog entry whose observation type is erased for heterogeneous catalog storage.
 *
 * @see {@link ScenarioCatalogEntry}
 * @see {@link ScenarioCatalogGroup}
 * @see {@link ScenarioCatalogIndex}
 * @see {@link createScenarioCatalogIndex}
 */
export type AnyScenarioCatalogEntry = ScenarioCatalogEntry<any>;
/**
 * A scenario definition whose observation type is erased for heterogeneous consumers.
 *
 * @see {@link ScenarioDefinition}
 */
export type AnyScenarioDefinition = ScenarioDefinition<any>;
