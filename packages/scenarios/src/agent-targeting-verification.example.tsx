import {
  computed,
  Rectangle,
  Text,
  type CRCLogicalMouseEvent,
  type Signal,
} from '@crc/core';

export const AGENT_TARGETING_VERIFICATION_SOURCE_ID = 'agent-targeting-verification-example';

export type AgentTargetingMode = 'seed' | 'repair' | 'intentional-block';
export type AgentTargetingDelivery = 'action' | 'decoration' | null;

export interface AgentTargetingSceneProps {
  readonly mode: Signal<AgentTargetingMode>;
  readonly selectedItem: Signal<'item-a' | null>;
  readonly selections: Signal<number>;
  readonly deliveredTo: Signal<AgentTargetingDelivery>;
  readonly onDelivery: (
    deliveredTo: Exclude<AgentTargetingDelivery, null>,
    event: CRCLogicalMouseEvent,
  ) => void;
  readonly onRender: () => void;
}

/**
 * A small public-API-only application used to distinguish an accidental target
 * interception from an intentionally blocking decoration. The two rectangles
 * deliberately share the exact action geometry.
 */
export function AgentTargetingVerificationScene({
  mode,
  selectedItem,
  selections,
  deliveredTo,
  onDelivery,
  onRender,
}: AgentTargetingSceneProps) {
  onRender();
  const repaired = mode.get() === 'repair';

  return (
    <>
      <Rectangle
        pointerEvents="none"
        style={{ width: 480, height: 240, fill: '#f8fafc' }}
      />
      <Rectangle
        style={{
          x: 80,
          y: 64,
          width: 128,
          height: 96,
          fill: '#2563eb',
          stroke: '#1e3a8a',
          strokeWidth: 2,
        }}
        onClick={(event) => onDelivery('action', event)}
      />
      <Rectangle
        pointerEvents={repaired ? 'none' : 'auto'}
        style={{
          x: 80,
          y: 64,
          width: 128,
          height: 96,
          fill: 'rgba(0, 0, 0, 0)',
        }}
        onClick={(event) => onDelivery('decoration', event)}
      />
      <Text
        pointerEvents="none"
        style={{ x: 80, y: 36, fill: '#0f172a', font: '700 16px sans-serif' }}
      >
        {'Targeting verification fixture'}
      </Text>
      <Text
        pointerEvents="none"
        style={{ x: 80, y: 118, fill: '#ffffff', font: '700 15px sans-serif' }}
      >
        {'Select item A'}
      </Text>
      <Text
        pointerEvents="none"
        style={{ x: 232, y: 92, fill: '#334155', font: '14px sans-serif' }}
      >
        {`expected item-a: ${mode.get() !== 'intentional-block' ? 'yes' : 'no'}`}
      </Text>
      <Text
        pointerEvents="none"
        style={{ x: 232, y: 116, fill: '#334155', font: '14px sans-serif' }}
      >
        {`selected: ${selectedItem.get() ?? 'none'}`}
      </Text>
      <Text
        pointerEvents="none"
        style={{ x: 232, y: 140, fill: '#334155', font: '14px sans-serif' }}
      >
        {`deliveries: ${selections.get()} (${deliveredTo.get() ?? 'none'})`}
      </Text>
    </>
  );
}

/** Creates a deliberately dormant computed value for passivity verification. */
export function createDormantTargetingMetric(
  source: Signal<number>,
  onEvaluate: () => void,
) {
  return computed(() => {
    onEvaluate();
    return source.get() * 2;
  });
}
