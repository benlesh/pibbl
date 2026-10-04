import { Absolute, Group, Path, createRectanglePath, useLayoutBox } from '@crc/core';

export const AGENT_LAYOUT_PLACEMENT_SOURCE_ID = 'agent-layout-placement-example';
export type LayoutPlacementMode = 'clipped' | 'overflow-visible' | 'repaired' | 'overlap-allowed' | 'overlap-prohibited';
type Box = Readonly<{ x: number; y: number; width: number; height: number }>;
interface ItemProps {
  style: { left: number; top: number; width: number; height: number };
  localX: number;
  overlap: boolean;
  onActivate?: (id: 'primary' | 'peer') => void;
  onAllocation: (box: Box) => void;
}
function PlacedItem({ localX, overlap, onAllocation, onActivate }: ItemProps) {
  // Public allocation is local to the placed child; it is not a paint bound.
  onAllocation(useLayoutBox());
  return <Group>
    <Path style={{ d: createRectanglePath({ x: localX, y: 0, width: 20, height: 20 }), fill: '#2563eb' }} onClick={() => onActivate?.('primary')} />
    {overlap ? <Path style={{ d: createRectanglePath({ x: 10, y: 0, width: 20, height: 20 }), fill: '#f97316' }} onClick={() => onActivate?.('peer')} /> : null}
  </Group>;
}

/** One public scene shared by layout diagnosis and its independent geometry oracle. */
export function AgentLayoutPlacementScene({ mode, onAllocation, onActivate }: {
  mode: LayoutPlacementMode;
  onActivate?: (id: 'primary' | 'peer') => void;
  onAllocation: (box: Box) => void;
}) {
  return <Group style={{ translateX: 40, translateY: 30 }}>
    <Group style={{ scaleX: 2, scaleY: 2 }}>
      <Absolute style={{ width: 100, height: 80, overflow: mode === 'overflow-visible' ? 'visible' : 'clip' }}>
        <PlacedItem style={{ left: 30, top: 20, width: 20, height: 20 }} localX={mode === 'clipped' || mode === 'overflow-visible' ? 90 : 0} overlap={mode === 'overlap-allowed' || mode === 'overlap-prohibited'} onAllocation={onAllocation} onActivate={onActivate} />
      </Absolute>
    </Group>
  </Group>;
}
