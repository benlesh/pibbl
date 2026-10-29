import { Flex, Group, Rectangle, Text, computed, signal, useConst, useLayoutBox, type BoxStyle, type FlexItemStyle, type PibblResponsiveStyle } from '@pibbl/core';

/** Contents shares the parent layout while Group keeps its transform and event ancestry. */
function ParticipationCard({ name, color, identity: identify, select, style: _style }: { name: string; color: string; identity: () => number; select: (value: string) => void; style: PibblResponsiveStyle<BoxStyle & FlexItemStyle> }) {
    const box = useLayoutBox();
    const identity = useConst(identify);
    return <><Rectangle onClick={() => select(`${name}: mounted identity ${identity}`)} style={{ width: box.width, height: box.height, fill: color, cornerRadius: 10, cursor: 'pointer' }} />
      <Text pointerEvents="none" style={{ left: 12, top: 18, font: 'bold 15px sans-serif', fill: '#fff' }}>{name}</Text>
      <Text pointerEvents="none" style={{ left: 12, top: 44, font: '11px monospace', fill: '#fff' }}>{`Identity ${identity}`}</Text></>;
  }

export function LayoutParticipationExample() {
  const state = useConst(() => {
    const participation = signal<'contents' | 'hidden'>('contents');
    const selected = signal('Click a card');
    let nextIdentity = 0;
    return { participation, selected, identity: () => ++nextIdentity,
      label: computed(() => participation.get() === 'contents' ? 'Hide first two cards' : 'Restore first two cards') };
  });
  return <>
    <Rectangle pointerEvents="none" style={{ width: 580, height: 260, fill: '#f3f0e8' }} />
    <Text pointerEvents="none" style={{ left: 20, top: 18, font: 'bold 20px sans-serif', fill: '#19375b' }}>Shared layout, preserved identity</Text>
    <Text pointerEvents="none" style={{ left: 20, top: 50, font: '12px sans-serif', fill: '#475569' }}>The first two cards share the outer Flex. Hide and restore them: their identities stay the same.</Text>
    <Flex style={{ left: 20, top: 88, width: 540, height: 84, gap: 14, alignItems: 'flex-start' }}>
      <Group key="contents" style={{ layoutParticipation: state.participation, translateY: 4 }}>
        <ParticipationCard identity={state.identity} select={value => state.selected.set(value)} key="A" name="First" color="#a63758" style={{ width: 140, height: 76, minWidth: 0, flexShrink: 0 }} />
        <ParticipationCard identity={state.identity} select={value => state.selected.set(value)} key="B" name="Second" color="#426b61" style={{ width: 140, height: 76, minWidth: 0, flexShrink: 0 }} />
      </Group>
      <ParticipationCard identity={state.identity} select={value => state.selected.set(value)} key="C" name="Following" color="#19375b" style={{ width: 140, height: 76, minWidth: 0, flexShrink: 0 }} />
    </Flex>
    <Rectangle onClick={() => state.participation.update(value => value === 'contents' ? 'hidden' : 'contents')} style={{ left: 20, top: 194, width: 220, height: 36, fill: '#19375b', cornerRadius: 6, cursor: 'pointer' }} />
    <Text pointerEvents="none" style={{ left: 32, top: 205, font: '12px sans-serif', fill: '#fff' }}>{state.label}</Text>
    <Text pointerEvents="none" style={{ left: 260, top: 205, font: '12px sans-serif', fill: '#19375b' }}>{state.selected}</Text>
  </>;
}
