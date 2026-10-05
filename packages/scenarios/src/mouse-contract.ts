import type { TraceEventType } from './event-trace';

/**
 * An expected semantic mouse event in a deterministic contract trace.
 *
 * @see {@link TraceEventType}
 * @see {@link formatContractTrace}
 * @see {@link MouseContractCase}
 */
export interface MouseContractTraceEvent {
  /** Type recorded or configured by this scenario. See {@link TraceEventType}. */
  type: TraceEventType;
  /** Target recorded or configured by this scenario. See {@link MouseContractTraceEvent}. */
  target: string;
  /**
   * Logical related target recorded or configured by this scenario. See
   * {@link MouseContractTraceEvent}.
   */
  logicalRelatedTarget: string | null;
}

/**
 * The capture, target, and bubble ordering policy expected by a mouse fixture.
 *
 * @see {@link formatOrderingPolicy}
 * @see {@link MouseContractCase}
 */
export type MouseContractOrderingPolicy =
  | {
      /** Kind recorded or configured by this scenario. See {@link MouseContractOrderingPolicy}. */
      kind: 'fixed';
    }
  | {
      /** Kind recorded or configured by this scenario. See {@link MouseContractOrderingPolicy}. */
      kind: 'browser-dependent';
      /**
       * Reference environment recorded or configured by this scenario. See
       * {@link MouseContractOrderingPolicy}.
       */
      referenceEnvironment: string;
    };

/**
 * Expected logical targeting behavior for a mouse-contract fixture.
 *
 * @see {@link MouseContractCase}
 */
export interface MouseContractTargeting {
  /**
   * Candidate policy recorded or configured by this scenario. See {@link MouseContractTargeting}.
   */
  candidatePolicy: 'any-mouse-handler-or-cursor';
  /**
   * Identity policy recorded or configured by this scenario. See {@link MouseContractTargeting}.
   */
  identityPolicy: 'stable-logical-region';
  /** Candidates recorded or configured by this scenario. See {@link MouseContractTargeting}. */
  candidates: readonly string[];
}

/**
 * A logical probe location used to exercise a mouse-contract fixture.
 *
 * @see {@link MouseContractCase}
 */
export interface MouseContractVisualProbe {
  /** X recorded or configured by this scenario. See {@link MouseContractVisualProbe}. */
  x: number;
  /** Y recorded or configured by this scenario. See {@link MouseContractVisualProbe}. */
  y: number;
  /**
   * Expected target recorded or configured by this scenario. See {@link MouseContractVisualProbe}
   * .
   */
  expectedTarget: string | null;
}

/**
 * A deterministic targeting and event-order fixture with expected trace and visual probes.
 *
 * @see {@link MouseContractTraceEvent}
 * @see {@link MouseContractOrderingPolicy}
 * @see {@link MouseContractTargeting}
 * @see {@link MouseContractVisualProbe}
 * @see {@link getMouseContractCase}
 * @see {@link MOUSE_CONTRACT_CASES}
 * @see {@link validateMouseContractCases}
 */
export interface MouseContractCase {
  /** Id recorded or configured by this scenario. See {@link MouseContractCase}. */
  id: string;
  /** Title recorded or configured by this scenario. See {@link MouseContractCase}. */
  title: string;
  /** Phase recorded or configured by this scenario. See {@link MouseContractCase}. */
  phase: 'reference-only' | 'tfc-04' | 'tfc-05';
  /** Gesture recorded or configured by this scenario. See {@link MouseContractCase}. */
  gesture: string;
  /** Native trace recorded or configured by this scenario. See {@link MouseContractTraceEvent}. */
  nativeTrace: readonly MouseContractTraceEvent[] | null;
  /** Crc trace recorded or configured by this scenario. See {@link MouseContractTraceEvent}. */
  crcTrace: readonly MouseContractTraceEvent[];
  /** Ordering recorded or configured by this scenario. See {@link MouseContractOrderingPolicy}. */
  ordering: MouseContractOrderingPolicy;
  /** Targeting recorded or configured by this scenario. See {@link MouseContractTargeting}. */
  targeting: MouseContractTargeting;
  /** Rule recorded or configured by this scenario. See {@link MouseContractCase}. */
  rule: string;
  /** Visual target recorded or configured by this scenario. See {@link MouseContractCase}. */
  visualTarget: 'a' | 'b' | 'canvas-root' | 'child' | 'layer' | 'none' | 'top';
  /** Visual probe recorded or configured by this scenario. See {@link MouseContractVisualProbe}. */
  visualProbe: MouseContractVisualProbe;
}

type MouseContractCaseInput = Omit<MouseContractCase, 'phase'>;

const FIXED_ORDERING = { kind: 'fixed' } as const;

function event(
  type: TraceEventType,
  target: string,
  logicalRelatedTarget: string | null = null,
): MouseContractTraceEvent {
  return { type, target, logicalRelatedTarget };
}

function targeting(candidates: readonly string[]): MouseContractTargeting {
  return {
    candidatePolicy: 'any-mouse-handler-or-cursor',
    identityPolicy: 'stable-logical-region',
    candidates,
  };
}

const CONTRACT_CASES = [
  {
    id: 'enter-region',
    title: 'Enter a region',
    gesture: 'Move from Canvas background into A.',
    nativeTrace: [event('mouseover', 'a', 'canvas-background'), event('mousemove', 'a')],
    crcTrace: [event('mouseover', 'a', 'canvas-background'), event('mousemove', 'a')],
    ordering: FIXED_ORDERING,
    targeting: targeting(['a']),
    rule: 'Resolve one logical target; report entry before movement.',
    visualTarget: 'a',
    visualProbe: { x: 120, y: 132, expectedTarget: 'a' },
  },
  {
    id: 'move-within-region',
    title: 'Move within a region',
    gesture: 'Move from one point in A to another point in A.',
    nativeTrace: [event('mousemove', 'a')],
    crcTrace: [event('mousemove', 'a')],
    ordering: FIXED_ORDERING,
    targeting: targeting(['a']),
    rule: 'A stable logical target receives movement without another boundary event.',
    visualTarget: 'a',
    visualProbe: { x: 120, y: 132, expectedTarget: 'a' },
  },
  {
    id: 'switch-regions',
    title: 'Switch sibling regions',
    gesture: 'Move from A directly into B.',
    nativeTrace: [
      event('mouseout', 'a', 'b'),
      event('mouseover', 'b', 'a'),
      event('mousemove', 'b'),
    ],
    crcTrace: [
      event('mouseout', 'a', 'b'),
      event('mouseover', 'b', 'a'),
      event('mousemove', 'b'),
    ],
    ordering: FIXED_ORDERING,
    targeting: targeting(['a', 'b']),
    rule: 'Exit precedes entry, and both transitions precede movement.',
    visualTarget: 'b',
    visualProbe: { x: 350, y: 152, expectedTarget: 'b' },
  },
  {
    id: 'leave-region-to-canvas-background',
    title: 'Leave a region for Canvas background',
    gesture: 'Move from A to a non-interactive point inside the root Canvas.',
    nativeTrace: [event('mouseout', 'a', 'canvas-background')],
    crcTrace: [event('mouseout', 'a', 'canvas-background')],
    ordering: FIXED_ORDERING,
    targeting: targeting(['a']),
    rule: 'Clear the logical region target while the pointer remains inside the Canvas.',
    visualTarget: 'none',
    visualProbe: { x: 430, y: 190, expectedTarget: null },
  },
  {
    id: 'exit-root-canvas',
    title: 'Exit the root Canvas',
    gesture: 'Move from A beyond the root Canvas boundary.',
    nativeTrace: [event('mouseout', 'a', 'outside-root')],
    crcTrace: [event('mouseout', 'a', 'outside-root')],
    ordering: FIXED_ORDERING,
    targeting: targeting(['a']),
    rule: 'Clear the logical target and report one exit when the native pointer leaves the Canvas.',
    visualTarget: 'none',
    visualProbe: { x: 430, y: 190, expectedTarget: null },
  },
  {
    id: 'overlap-topmost',
    title: 'Overlapping siblings',
    gesture: 'Enter a point painted by A and later-painted B.',
    nativeTrace: [event('mouseover', 'top', 'canvas-background'), event('mousemove', 'top')],
    crcTrace: [event('mouseover', 'top', 'canvas-background'), event('mousemove', 'top')],
    ordering: FIXED_ORDERING,
    targeting: targeting(['a', 'top']),
    rule: 'Only the topmost interactive hit in reverse paint order is the logical target.',
    visualTarget: 'top',
    visualProbe: { x: 240, y: 132, expectedTarget: 'top' },
  },
  {
    id: 'nested-child',
    title: 'Nested group child',
    gesture: 'Enter an interactive child inside a transformed group.',
    nativeTrace: [event('mouseover', 'child', 'canvas-background'), event('mousemove', 'child')],
    crcTrace: [event('mouseover', 'child', 'canvas-background'), event('mousemove', 'child')],
    ordering: FIXED_ORDERING,
    targeting: targeting(['child']),
    rule: 'Target the deepest painted child only; CRC does not synthesize DOM propagation.',
    visualTarget: 'child',
    visualProbe: { x: 184, y: 132, expectedTarget: 'child' },
  },
  {
    id: 'clip-intersection-miss',
    title: 'Nested clip miss',
    gesture: 'Move inside the path but outside one active ancestor clip.',
    nativeTrace: null,
    crcTrace: [],
    ordering: FIXED_ORDERING,
    targeting: targeting(['a']),
    rule: 'All active clips intersect; failing any clip excludes the candidate target.',
    visualTarget: 'none',
    visualProbe: { x: 302, y: 130, expectedTarget: null },
  },
  {
    id: 'transformed-hit',
    title: 'Transformed geometry hit',
    gesture: 'Enter the visible location of a scaled and translated path.',
    nativeTrace: null,
    crcTrace: [event('mouseover', 'a', 'canvas-background'), event('mousemove', 'a')],
    ordering: FIXED_ORDERING,
    targeting: targeting(['a']),
    rule: 'Root coordinates stay in Canvas space while render transforms determine the hit.',
    visualTarget: 'a',
    visualProbe: { x: 302, y: 132, expectedTarget: 'a' },
  },
  {
    id: 'later-layer-topmost',
    title: 'Later layer wins',
    gesture: 'Enter overlap between a root region and a later-painted layer region.',
    nativeTrace: null,
    crcTrace: [event('mouseover', 'layer', 'canvas-background'), event('mousemove', 'layer')],
    ordering: FIXED_ORDERING,
    targeting: targeting(['a', 'layer']),
    rule: 'Layer composition participates in reverse-paint-order target selection.',
    visualTarget: 'layer',
    visualProbe: { x: 240, y: 132, expectedTarget: 'layer' },
  },
  {
    id: 'css-scaled-coordinates',
    title: 'CSS-scaled Canvas coordinates',
    gesture: 'Interact at the CSS-scaled visual center of A.',
    nativeTrace: null,
    crcTrace: [event('mousemove', 'a')],
    ordering: FIXED_ORDERING,
    targeting: targeting(['a']),
    rule: 'Expose intrinsic Canvas coordinates while CSS scaling only changes client-space placement.',
    visualTarget: 'a',
    visualProbe: { x: 240, y: 132, expectedTarget: 'a' },
  },
  {
    id: 'fill-hit',
    title: 'Filled path hit',
    gesture: 'Enter the configured fill area of A.',
    nativeTrace: null,
    crcTrace: [event('mouseover', 'a', 'canvas-background'), event('mousemove', 'a')],
    ordering: FIXED_ORDERING,
    targeting: targeting(['a']),
    rule: 'A configured fill uses isPointInPath and emits entry before movement.',
    visualTarget: 'a',
    visualProbe: { x: 120, y: 132, expectedTarget: 'a' },
  },
  {
    id: 'stroke-hit',
    title: 'Stroked path hit',
    gesture: 'Enter the configured stroke interaction geometry of A.',
    nativeTrace: null,
    crcTrace: [event('mouseover', 'a', 'canvas-background'), event('mousemove', 'a')],
    ordering: FIXED_ORDERING,
    targeting: targeting(['a']),
    rule: 'A positive interaction stroke hits without requiring a fill.',
    visualTarget: 'a',
    visualProbe: { x: 75, y: 132, expectedTarget: 'a' },
  },
  {
    id: 'fill-stroke-hit',
    title: 'Combined fill and stroke hit',
    gesture: 'Enter a path whose configured fill and stroke both contain the point.',
    nativeTrace: null,
    crcTrace: [event('mouseover', 'a', 'canvas-background'), event('mousemove', 'a')],
    ordering: FIXED_ORDERING,
    targeting: targeting(['a']),
    rule: 'Combined fill and stroke geometry still emits one entry before one movement.',
    visualTarget: 'a',
    visualProbe: { x: 73, y: 132, expectedTarget: 'a' },
  },
  {
    id: 'transparent-fill-hit',
    title: 'Transparent configured fill hit',
    gesture: 'Enter a path whose configured fill is visually transparent.',
    nativeTrace: null,
    crcTrace: [event('mouseover', 'a', 'canvas-background'), event('mousemove', 'a')],
    ordering: FIXED_ORDERING,
    targeting: targeting(['a']),
    rule: 'Configured fill geometry remains interactive regardless of rendered opacity or alpha.',
    visualTarget: 'a',
    visualProbe: { x: 120, y: 132, expectedTarget: 'a' },
  },
  {
    id: 'line-interaction-width-hit',
    title: 'Expanded line interaction hit',
    gesture: 'Move near a thin painted line but inside its wider interaction stroke.',
    nativeTrace: null,
    crcTrace: [event('mouseover', 'a', 'canvas-background'), event('mousemove', 'a')],
    ordering: FIXED_ORDERING,
    targeting: targeting(['a']),
    rule: 'lineInteractionWidth expands hit geometry without changing painted stroke width.',
    visualTarget: 'a',
    visualProbe: { x: 240, y: 141, expectedTarget: 'a' },
  },
  {
    id: 'line-interaction-width-miss',
    title: 'Outside expanded line interaction',
    gesture: 'Move beyond both the painted and interaction strokes.',
    nativeTrace: null,
    crcTrace: [],
    ordering: FIXED_ORDERING,
    targeting: targeting(['a']),
    rule: 'A candidate whose fill and interaction stroke both miss is pointer-transparent.',
    visualTarget: 'none',
    visualProbe: { x: 240, y: 164, expectedTarget: null },
  },
  {
    id: 'primary-click-same-target',
    title: 'Primary click on one target',
    gesture: 'Press and release the primary button on A without leaving it.',
    nativeTrace: [event('mousedown', 'a'), event('mouseup', 'a'), event('click', 'a')],
    crcTrace: [event('mousedown', 'a'), event('mouseup', 'a'), event('click', 'a')],
    ordering: FIXED_ORDERING,
    targeting: targeting(['a']),
    rule: 'Activation requires the same still-live logical target for down and up.',
    visualTarget: 'a',
    visualProbe: { x: 120, y: 132, expectedTarget: 'a' },
  },
  {
    id: 'primary-click-cross-target',
    title: 'Primary press and release on siblings',
    gesture: 'Press on A, move to B, and release on B.',
    nativeTrace: [
      event('mousedown', 'a'),
      event('mouseout', 'a', 'b'),
      event('mouseover', 'b', 'a'),
      event('mousemove', 'b'),
      event('mouseup', 'b'),
      event('click', 'common-ancestor'),
    ],
    crcTrace: [
      event('mousedown', 'a'),
      event('mouseout', 'a', 'b'),
      event('mouseover', 'b', 'a'),
      event('mousemove', 'b'),
      event('mouseup', 'b'),
    ],
    ordering: FIXED_ORDERING,
    targeting: targeting(['a', 'b']),
    rule: 'CRC has no ancestor propagation target, so sibling down/up produces no region click.',
    visualTarget: 'b',
    visualProbe: { x: 350, y: 152, expectedTarget: 'b' },
  },
  {
    id: 'primary-click-reentry',
    title: 'Leave and re-enter during primary press',
    gesture: 'Press on A, leave for Canvas background, re-enter A, and release on A.',
    nativeTrace: [
      event('mousedown', 'a'),
      event('mouseout', 'a', 'canvas-background'),
      event('mouseover', 'a', 'canvas-background'),
      event('mousemove', 'a'),
      event('mouseup', 'a'),
      event('click', 'a'),
    ],
    crcTrace: [
      event('mousedown', 'a'),
      event('mouseout', 'a', 'canvas-background'),
      event('mouseover', 'a', 'canvas-background'),
      event('mousemove', 'a'),
      event('mouseup', 'a'),
      event('click', 'a'),
    ],
    ordering: FIXED_ORDERING,
    targeting: targeting(['a']),
    rule: 'Reference Chromium retains activation when down, up, and native click resolve to the same live target; movement hysteresis remains platform-defined.',
    visualTarget: 'a',
    visualProbe: { x: 120, y: 132, expectedTarget: 'a' },
  },
  {
    id: 'double-click',
    title: 'Double click',
    gesture: 'Complete two eligible primary clicks on A.',
    nativeTrace: [
      event('mousedown', 'a'),
      event('mouseup', 'a'),
      event('click', 'a'),
      event('mousedown', 'a'),
      event('mouseup', 'a'),
      event('click', 'a'),
      event('dblclick', 'a'),
    ],
    crcTrace: [
      event('mousedown', 'a'),
      event('mouseup', 'a'),
      event('click', 'a'),
      event('mousedown', 'a'),
      event('mouseup', 'a'),
      event('click', 'a'),
      event('dblclick', 'a'),
    ],
    ordering: FIXED_ORDERING,
    targeting: targeting(['a']),
    rule: 'Double click requires two successful clicks on the same still-live logical target.',
    visualTarget: 'a',
    visualProbe: { x: 120, y: 132, expectedTarget: 'a' },
  },
  {
    id: 'context-menu',
    title: 'Context menu',
    gesture: 'Invoke the secondary-button menu on B.',
    nativeTrace: [event('mousedown', 'b'), event('contextmenu', 'b'), event('mouseup', 'b')],
    crcTrace: [event('mousedown', 'b'), event('contextmenu', 'b'), event('mouseup', 'b')],
    ordering: {
      kind: 'browser-dependent',
      referenceEnvironment: 'Chromium on macOS',
    },
    targeting: targeting(['b']),
    rule: 'Target each native event independently; preserve the browser order rather than normalizing it.',
    visualTarget: 'b',
    visualProbe: { x: 350, y: 152, expectedTarget: 'b' },
  },
  {
    id: 'replace-handler-during-dispatch',
    title: 'Replace a handler during dispatch',
    gesture: 'A handler replaces itself while processing a logical movement event.',
    nativeTrace: null,
    crcTrace: [event('mousemove', 'a')],
    ordering: FIXED_ORDERING,
    targeting: targeting(['a']),
    rule: 'Snapshot listeners per logical event; the replacement becomes eligible on the next logical event.',
    visualTarget: 'a',
    visualProbe: { x: 120, y: 132, expectedTarget: 'a' },
  },
  {
    id: 'remove-handler-during-dispatch',
    title: 'Remove a handler during dispatch',
    gesture: 'An earlier handler removes a later listener before its turn.',
    nativeTrace: null,
    crcTrace: [event('mousemove', 'a')],
    ordering: FIXED_ORDERING,
    targeting: targeting(['a']),
    rule: 'Listener removal remains effective during a snapshot; skip the removed listener and continue others.',
    visualTarget: 'a',
    visualProbe: { x: 120, y: 132, expectedTarget: 'a' },
  },
  {
    id: 'remove-target-during-move-plan',
    title: 'Remove the new target during a move plan',
    gesture: 'While leaving A for B, the mouseout handler removes B.',
    nativeTrace: null,
    crcTrace: [event('mouseout', 'a', 'b')],
    ordering: FIXED_ORDERING,
    targeting: targeting(['a', 'b']),
    rule: 'Skip planned entry and movement for a target removed before those logical events.',
    visualTarget: 'none',
    visualProbe: { x: 350, y: 152, expectedTarget: null },
  },
  {
    id: 'remove-target-during-press',
    title: 'Remove the down target before release',
    gesture: 'Press A, remove its logical region, then release over the former location.',
    nativeTrace: [event('mousedown', 'a')],
    crcTrace: [event('mousedown', 'a')],
    ordering: FIXED_ORDERING,
    targeting: targeting(['a']),
    rule: 'A removed identity receives no later release or activation, and removal clears pending click state.',
    visualTarget: 'none',
    visualProbe: { x: 120, y: 132, expectedTarget: null },
  },
  {
    id: 'throwing-handler-continues',
    title: 'Thrown handler does not stop dispatch',
    gesture: 'The first handler for A throws while another planned handler remains.',
    nativeTrace: null,
    crcTrace: [event('mousemove', 'a')],
    ordering: FIXED_ORDERING,
    targeting: targeting(['a']),
    rule: 'Report the exception and continue the remaining listeners in the current logical event.',
    visualTarget: 'a',
    visualProbe: { x: 120, y: 132, expectedTarget: 'a' },
  },
] as const satisfies readonly MouseContractCaseInput[];

const REQUIRED_CASE_IDS = [
  'leave-region-to-canvas-background',
  'exit-root-canvas',
  'primary-click-reentry',
  'context-menu',
  'css-scaled-coordinates',
  'fill-hit',
  'stroke-hit',
  'fill-stroke-hit',
  'transparent-fill-hit',
  'line-interaction-width-hit',
  'line-interaction-width-miss',
  'replace-handler-during-dispatch',
  'remove-handler-during-dispatch',
  'remove-target-during-move-plan',
  'remove-target-during-press',
  'throwing-handler-continues',
] as const;

const TFC_05_CASE_IDS = new Set<string>([
  'nested-child',
  'clip-intersection-miss',
  'transformed-hit',
  'later-layer-topmost',
  'css-scaled-coordinates',
]);

const REFERENCE_ONLY_CASE_IDS = new Set<string>(['context-menu']);

function assignContractPhases<const Cases extends readonly MouseContractCaseInput[]>(
  cases: Cases,
): readonly (Cases[number] & Pick<MouseContractCase, 'phase'>)[] {
  return cases.map(contractCase => ({
    ...contractCase,
    phase: TFC_05_CASE_IDS.has(contractCase.id) ?
        'tfc-05' :
      REFERENCE_ONLY_CASE_IDS.has(contractCase.id) ?
          'reference-only' :
        'tfc-04',
  }));
}

/**
 * Validates deterministic mouse-contract fixtures and returns the typed case collection.
 *
 * @param cases - Contract cases whose identifiers and metadata should be validated.
 * @returns The supplied cases after successful validation.
 *
 * @see {@link MouseContractCase}
 */
export function validateMouseContractCases<const Cases extends readonly MouseContractCase[]>(
  cases: Cases,
): Cases {
  const ids = new Set<string>();

  for (const contractCase of cases) {
    if (!contractCase.id || ids.has(contractCase.id)) {
      throw new Error(`Mouse contract case ids must be non-empty and unique: "${contractCase.id}".`);
    }
    ids.add(contractCase.id);

    if (!['reference-only', 'tfc-04', 'tfc-05'].includes(contractCase.phase)) {
      throw new Error(`Mouse contract case "${contractCase.id}" has an invalid phase.`);
    }

    if (!contractCase.targeting.candidates.length) {
      throw new Error(`Mouse contract case "${contractCase.id}" needs at least one candidate target.`);
    }
    if (new Set(contractCase.targeting.candidates).size !== contractCase.targeting.candidates.length) {
      throw new Error(`Mouse contract case "${contractCase.id}" has duplicate candidate targets.`);
    }
    if (
      contractCase.visualProbe.expectedTarget !== null &&
      !contractCase.targeting.candidates.includes(contractCase.visualProbe.expectedTarget)
    ) {
      throw new Error(`Mouse contract case "${contractCase.id}" probes a non-candidate target.`);
    }
    if (
      contractCase.ordering.kind === 'browser-dependent' &&
      !contractCase.ordering.referenceEnvironment.trim()
    ) {
      throw new Error(`Mouse contract case "${contractCase.id}" needs a reference environment.`);
    }

    for (const trace of [contractCase.nativeTrace, contractCase.crcTrace]) {
      if (trace === null) {
        continue;
      }
      for (const traceEvent of trace) {
        const isBoundary = traceEvent.type === 'mouseover' || traceEvent.type === 'mouseout';
        if (isBoundary !== (traceEvent.logicalRelatedTarget !== null)) {
          throw new Error(
            `Mouse contract case "${contractCase.id}" must set logicalRelatedTarget only on boundary events.`,
          );
        }
        if (traceEvent.target === traceEvent.logicalRelatedTarget) {
          throw new Error(`Mouse contract case "${contractCase.id}" relates a target to itself.`);
        }
      }
    }
  }

  for (const requiredId of REQUIRED_CASE_IDS) {
    if (!ids.has(requiredId)) {
      throw new Error(`Mouse contract is missing required case "${requiredId}".`);
    }
  }

  const reentry = cases.find(contractCase => contractCase.id === 'primary-click-reentry');
  if (!reentry?.crcTrace.some(traceEvent => traceEvent.type === 'click')) {
    throw new Error('Mouse contract re-entry must preserve the measured Chromium click reference.');
  }
  const contextMenu = cases.find(contractCase => contractCase.id === 'context-menu');
  if (contextMenu?.ordering.kind !== 'browser-dependent') {
    throw new Error('Mouse contract context-menu ordering must remain browser-dependent.');
  }

  return cases;
}

/**
 * Validated deterministic fixtures for mouse targeting and event ordering.
 *
 * @see {@link MouseContractCase}
 */
export const MOUSE_CONTRACT_CASES = validateMouseContractCases(assignContractPhases(CONTRACT_CASES));

/**
 * A stable identifier of a deterministic mouse-contract fixture.
 *
 * @see {@link MouseContractCase}
 */
export type MouseContractCaseId = (typeof MOUSE_CONTRACT_CASES)[number]['id'];

/**
 * Finds a mouse contract fixture by identifier, or returns undefined.
 *
 * @param id - Contract case identifier.
 * @returns The matching case, or undefined when absent. See {@link MouseContractCase}.
 *
 * @see {@link MouseContractCase}
 */
export function getMouseContractCase(id: string): MouseContractCase | undefined {
  return MOUSE_CONTRACT_CASES.find(contractCase => contractCase.id === id);
}

/**
 * Formats an expected mouse-event trace for inspection, including the absent-trace case.
 *
 * @param trace - Recorded events, or null when no trace is available. See
 * {@link MouseContractTraceEvent} .
 * @returns Human-readable event trace text.
 *
 * @see {@link MouseContractTraceEvent}
 */
export function formatContractTrace(trace: readonly MouseContractTraceEvent[] | null): string {
  if (trace === null) {
    return 'Canvas-specific';
  }
  if (!trace.length) {
    return 'No region event';
  }
  return trace.map(({ type, target, logicalRelatedTarget }) =>
    `${type}(${target}${logicalRelatedTarget ? ` ← ${logicalRelatedTarget}` : ''})`,
  ).join(' → ');
}

/**
 * Formats the ordering policy of a mouse-event contract case.
 *
 * @param ordering - Expected event ordering policy. See {@link MouseContractOrderingPolicy}.
 * @returns Human-readable text describing the ordering policy.
 *
 * @see {@link MouseContractOrderingPolicy}
 */
export function formatOrderingPolicy(ordering: MouseContractOrderingPolicy): string {
  return ordering.kind === 'fixed' ?
    'Fixed contract order' :
    `Browser-dependent · reference: ${ordering.referenceEnvironment}`;
}
