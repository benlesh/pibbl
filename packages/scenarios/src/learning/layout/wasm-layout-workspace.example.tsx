import {
  Absolute, Flex, Flow, FocusManagement, Grid, Group, Rectangle, Text,
  autoFitTracks, computed, minmax, signal, useConst, useLayoutBox, useSignal,
  type BoxStyle, type FlexItemStyle, type GridItemStyle, type PibblResponsiveStyle,
} from '@pibbl/core';

type ItemStyle = PibblResponsiveStyle<BoxStyle & FlexItemStyle & GridItemStyle>;
function WorkspaceButton({ label, activate, style }: { label: string; activate: () => void; style: ItemStyle }) {
  return <Absolute style={{ left: style.left, top: style.top, width: style.width, height: style.height }}>
    <Rectangle keyboardFocusable onClick={activate} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') activate(); }} style={{ width: '100%', height: '100%', fill: '#19375b', cornerRadius: 6, cursor: 'pointer' }} />
    <Text pointerEvents="none" style={{ left: 12, top: 9, width: '100%', height: 20, font: '12px sans-serif', fill: '#fff' }}>{label}</Text>
  </Absolute>;
}
function WorkspaceCard({ title, detail, select, style: _style }: { title: string; detail: string; select: (label: string) => void; style: ItemStyle }) {
  const box = useLayoutBox(), clicks = useSignal(0);
  const stamp = useConst(() => Math.round(performance.now() * 1000).toString(36));
  return <>
    <Rectangle keyboardFocusable onClick={() => { clicks.update(value => value + 1); select(title); }} onKeyDown={event => { if (event.key === 'Enter') { clicks.update(value => value + 1); select(title); } }} style={{ width: box.width, height: box.height, fill: '#fff', cornerRadius: 8, cursor: 'pointer' }} />
    <Flex style={{ width: box.width, height: box.height, padding: 12, boxSizing: 'border-box', flexDirection: 'column', gap: 5, alignItems: 'stretch' }}>
      <Text pointerEvents="none" style={{ height: 18, minHeight: 0, flexShrink: 0, font: 'bold 13px sans-serif', fill: '#19375b' }}>{title}</Text>
      <Text pointerEvents="none" style={{ width: 'auto', height: 'auto', minHeight: 0, flexShrink: 0, wrap: true, font: '11px sans-serif', lineHeight: 15, fill: '#475569' }}>{detail}</Text>
      <Text pointerEvents="none" style={{ height: 15, minHeight: 0, flexShrink: 0, font: '10px monospace', fill: '#426b61' }}>{`Clicks ${clicks.get()} · ${stamp}`}</Text>
    </Flex>
  </>;
}
function WorkspaceBoard({ select, style: _style }: { select: (label: string) => void; style: ItemStyle }) {
  const box = useLayoutBox();
  return <Grid style={{ width: box.width, height: box.height, gridTemplateColumns: [autoFitTracks(minmax({ min: 110, max: '1fr' }))], gridTemplateRows: [105, 105], gridAutoRows: 105, gap: 10 }}>
    <WorkspaceCard key="geometry" title="One geometry" detail="Paint and clicks follow the same allocated box." select={select} style={{ width: 'auto', height: 'auto' }} />
    <WorkspaceCard key="content" title="Real content" detail="Text wraps at its final allocated width." select={select} style={{ width: 'auto', height: 'auto' }} />
    <WorkspaceCard key="identity" title="Stable state" detail="Resize after clicking. The counter stays with its card." select={select} style={{ width: 'auto', height: 'auto' }} />
    <WorkspaceCard key="native" title="Native tracks" detail="Automatic fit changes the number of columns." select={select} style={{ width: 'auto', height: 'auto' }} />
  </Grid>;
}
function WorkspaceSidebar({ select, style: _style }: { select: (label: string) => void; style: ItemStyle }) {
  const box = useLayoutBox(), visits = useSignal(0);
  const identity = useConst(() => Math.round(performance.now() * 1000).toString(36));
  return <>
    <Rectangle pointerEvents="none" style={{ width: box.width, height: box.height, fill: '#e3e9e1', cornerRadius: 8 }} />
    <Flex style={{ width: box.width, height: box.height, padding: 10, boxSizing: 'border-box', flexDirection: 'column', gap: 10 }}>
      <Text pointerEvents="none" style={{ height: 20, minHeight: 0, flexShrink: 0, font: 'bold 13px sans-serif', fill: '#19375b' }}>Workspace</Text>
      <Group style={{ layoutParticipation: 'contents' }}>
        <WorkspaceButton label="Projects" activate={() => { visits.update(value => value + 1); select('Projects'); }} style={{ width: 'stretch', height: 32, minHeight: 0, flexShrink: 0 }} />
        <WorkspaceButton label="Activity" activate={() => { visits.update(value => value + 1); select('Activity'); }} style={{ width: 'stretch', height: 32, minHeight: 0, flexShrink: 0 }} />
      </Group>
      <Text pointerEvents="none" style={{ height: 15, minHeight: 0, flexShrink: 0, font: '10px monospace', fill: '#426b61' }}>{`Visits ${visits.get()}`}</Text>
      <Text pointerEvents="none" style={{ height: 15, minHeight: 0, flexShrink: 0, font: '9px monospace', fill: '#426b61' }}>{`Identity ${identity}`}</Text>
    </Flex>
  </>;
}
function WorkspaceHeader({ style: _style }: { style: ItemStyle }) {
  const box = useLayoutBox();
  return <Flow style={{ width: box.width, height: box.height, padding: 8, boxSizing: 'border-box', gap: 12, wrap: true }}>
    <Text pointerEvents="none" style={{ width: 105, height: 20, font: '12px sans-serif', fill: '#19375b' }}>Shared layout</Text>
    <Text pointerEvents="none" style={{ width: 105, height: 20, font: '12px sans-serif', fill: '#426b61' }}>Preserved state</Text>
    <Text pointerEvents="none" style={{ width: 105, height: 20, font: '12px sans-serif', fill: '#a63758' }}>Source order</Text>
  </Flow>;
}

/** One composition for exercising the integrated native layout capabilities. */
export function WasmLayoutWorkspaceExample() {
  const state = useConst(() => {
    const width = signal(710), sidebar = signal<'normal' | 'hidden'>('normal'), selected = signal('Select a card or navigation item');
    return { width, sidebar, selected, columns: computed(() => [sidebar.get() === 'hidden' ? 0 : 150, '1fr'] as const) };
  });
  return <FocusManagement><Group>
    <Rectangle pointerEvents="none" style={{ width: 760, height: 500, fill: '#f3f0e8' }} />
    <Text pointerEvents="none" style={{ left: 24, top: 18, font: 'bold 22px sans-serif', fill: '#19375b' }}>A workspace that reflows</Text>
    <WorkspaceButton label="Resize workspace" activate={() => state.width.update(value => value === 710 ? 490 : 710)} style={{ left: 24, top: 56, width: 155, height: 34 }} />
    <WorkspaceButton label="Hide / restore sidebar" activate={() => state.sidebar.update(value => value === 'normal' ? 'hidden' : 'normal')} style={{ left: 190, top: 56, width: 185, height: 34 }} />
    <Grid style={{ left: 24, top: 104, width: state.width, height: 330, gridTemplateColumns: state.columns, gridTemplateRows: [40, 230, 40], gap: 10 }}>
      <WorkspaceHeader style={{ gridColumnStart: 1, gridColumnSpan: 2, gridRowStart: 1, width: 'auto', height: 'auto' }} />
      <WorkspaceSidebar select={label => state.selected.set(label)} style={{ layoutParticipation: state.sidebar, gridColumnStart: 1, gridRowStart: 2, width: 'auto', height: 'auto' }} />
      <WorkspaceBoard select={label => state.selected.set(label)} style={{ gridColumnStart: 2, gridRowStart: 2, width: 'auto', height: 'auto' }} />
      <Text pointerEvents="none" style={{ gridColumnStart: 1, gridColumnSpan: 2, gridRowStart: 3, width: 'auto', height: 'auto', font: '12px sans-serif', fill: '#19375b' }}>{state.selected}</Text>
    </Grid>
    <Text pointerEvents="none" style={{ left: 24, top: 460, font: '12px sans-serif', fill: '#475569' }}>Click cards, resize, and hide / restore the sidebar. Tab follows source order.</Text>
  </Group></FocusManagement>;
}
